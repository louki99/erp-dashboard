# Onboarding a New GCOM Company — Worked Example: ORBIS Distribution

> **Purpose**: a concrete, step-by-step runbook for provisioning a brand-new
> company on this ERP and getting it to a working first GCOM sale (Devis,
> BC, BL, Facture, Avoir). Every endpoint below was verified against the
> actual controllers/routes in this codebase, not assumed — where no API
> endpoint exists (Company, PaymentTerm), that's called out explicitly
> instead of inventing one.
> **Companion doc**: `docs/modules/28-gcom.md` (full GCOM API reference,
> document flows, settlement rules). Read this file first to get a company
> to the point where that doc's endpoints work; read that file for what to
> do once they do.
> **Shortcut**: everything below is now also available as one command —
> `php artisan db:seed --class=GcomDatabaseSeeder` provisions this exact
> ORBIS DISTRIBUTION example end-to-end (idempotent, safe to re-run). Use
> *this* doc when setting up a **real, different** company, or to
> understand what that seeder is actually doing under the hood; use the
> seeder when you just need a working tenant to develop/test against — see
> `docs/modules/28-gcom.md` §15 for login credentials and a smoke-test call.

---

## Table of Contents

1. [Setup Order — Why It Matters](#1-setup-order--why-it-matters)
2. [Step 1 — Company](#2-step-1--company)
3. [Step 2 — Branch](#3-step-2--branch)
4. [Step 3 — Central Warehouse](#4-step-3--central-warehouse)
5. [Step 4 — Document Numbering (Token Series)](#5-step-4--document-numbering-token-series)
6. [Step 5 — Payment Terms](#6-step-5--payment-terms)
7. [Step 6 — Set the Company's Sales Mode to GCOM](#7-step-6--set-the-companys-sales-mode-to-gcom)
8. [Step 7 — Admin User + GCOM Role](#8-step-7--admin-user--gcom-role)
9. [Step 8 — Catalog Prerequisites](#9-step-8--catalog-prerequisites)
10. [Step 9 — Products](#10-step-9--products)
11. [Step 10 — Pricing](#11-step-10--pricing)
12. [Step 11 — First Customer (Partner)](#12-step-11--first-customer-partner)
13. [Step 12 — Suppliers (optional, for Purchase Reception)](#13-step-12--suppliers-optional-for-purchase-reception)
14. [Step 13 — Smoke Test: First GCOM Sale](#14-step-13--smoke-test-first-gcom-sale)
15. [Checklist Summary](#15-checklist-summary)

---

## 1. Setup Order — Why It Matters

Each step below depends on the previous one existing in the database —
skip one and the next step's `exists:` validation rule (or a GCOM
`DomainException`) will reject the request with a clear message, not a
silent failure. The order is:

```
Company → Branch → Warehouse (central) → Token Series (numbering)
  → Payment Terms → sales_mode → Admin user/role
  → VAT/Units/Categories → Products → Price List + overrides
  → Partner (customer) → [Suppliers] → first sale
```

Two of these steps — **Company** and **Payment Terms** — have **no REST API
endpoint anywhere in this codebase** (confirmed by searching every
controller and route file). They're provisioned via `php artisan tinker`
or a seeder, same as every other company already in this system was. Don't
go looking for a "Create Company" screen — there isn't one yet.

All API examples below assume:
- Base URL `https://<host>/api/backend`
- `Authorization: Bearer <sanctum-token>` header (obtained via the normal
  login endpoint, not covered here)
- `Content-Type: application/json`

---

## 2. Step 1 — Company

**No API endpoint exists for this.** Run via `php artisan tinker` (or wrap
the same call in a one-off seeder if you want it repeatable/deployable):

```php
$company = \App\Models\Company::create([
    'name'       => 'ORBIS Distribution',
    'code'       => 'ORBIS',
    'email'      => 'contact@orbis-distribution.ma',
    'phone'      => '+212 5 22 00 00 00',
    'address'    => 'Zone Industrielle, Casablanca, Maroc',
    'tax_number' => '00000000',
    'is_active'  => true,
    // 'sales_mode' defaults to 'HYBRID' — set explicitly in Step 6.
]);
```

Note it down: `$company->id`. Everything downstream references this.

---

## 3. Step 2 — Branch

Real endpoint: `POST /api/backend/branches` (`BranchController`, gated only
by `auth:sanctum` at the route-group level — no specific `permission:` on
this route as of this doc; any authenticated backend user can create a
branch today).

```bash
curl -X POST https://<host>/api/backend/branches \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "code": "ORBIS-CAS",
    "name": "ORBIS Distribution — Casablanca",
    "phone": "+212 5 22 00 00 00",
    "email": "casablanca@orbis-distribution.ma",
    "address": "Zone Industrielle, Casablanca, Maroc",
    "is_active": true,
    "is_warehouse": true,
    "is_depot": true
  }'
```

The response includes the new `branch.id`. `branch_id`/`company_id` link
must be set — this controller doesn't take `company_id` in its own create
payload (checked: it isn't in `BranchController::store()`'s validation
rules), so link it in the same tinker session as Step 1, or via a follow-up
`PUT`:

```php
$branch = \App\Models\Branch::where('code', 'ORBIS-CAS')->first();
$branch->company_id = $company->id;
$branch->save();
```

**Branch code convention used everywhere in GCOM**: the central warehouse's
`code` equals the branch's `code`. Keep `ORBIS-CAS` consistent through the
next step for this to line up.

---

## 4. Step 3 — Central Warehouse

Real endpoint: `POST /api/backend/warehouses` (`permission:create-warehouses`
— granted to root/admin/magasinier by default).

```bash
curl -X POST https://<host>/api/backend/warehouses \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "branch_id": <branch.id from Step 2>,
    "name": "Central ORBIS-CAS",
    "type": "central",
    "code": "ORBIS-CAS",
    "is_active": true
  }'
```

Passing `code` explicitly (rather than letting it auto-generate) is
deliberate here — it must exactly equal the branch code, since
`GcomContextResolver::resolveCentralWarehouse()` and every stock-touching
GCOM operation (`StockService::deductForDirectSale()`,
`restockForReturn()`, the new `InventoryCheckService`) resolve the central
warehouse via `Warehouse::centralForBranch($branch->code)` — a `code = 
branch_code AND type = central` lookup, not a stored FK. Get this wrong and
every stock movement in GCOM for this branch will fail to resolve a
warehouse.

---

## 5. Step 4 — Document Numbering (Token Series)

This is where "stock reception already existed but was broken", "GCOM's
avoir numbering never worked", and "every manually-seeded token series in
this system is missing `credit_note_prefix`" (all found and fixed during
the GCOM build — see `docs/modules/28-gcom.md` §10) all trace back to the
same root cause: **manually configuring a `TokenSerie` row field-by-field
is error-prone — 20 prefix/counter column pairs, one per document type, and
it's easy to miss one.**

**Recommended path — `TokenSerie::autoGenerate()`, via tinker.** This is
the same method the codebase already uses to provision per-branch series
elsewhere, and it populates every prefix (including `credit_note_prefix`,
the one that's been missed everywhere else) in one call:

```php
$serie = \App\Models\TokenSerie::autoGenerate(
    branchCode: 'ORBIS-CAS',
    name: 'ORBIS Distribution — Casablanca',
);
// $serie->code is auto-derived, e.g. "ORBIS-A01"; every prefix/counter
// column is set (invoice_prefix, order_prefix, credit_note_prefix, ...).
```

**Alternative — via the admin API**, if you want this driven from a UI
screen instead: `POST /api/backend/token-series`
(`TokenSerieAdminController::store()`) only accepts `code`, `name`,
`description`, `scope`, `allowed_branches`, `is_default`, `is_active` — it
does **not** set the prefix columns on create. You must follow it with a
`PUT /api/backend/token-series/{id}` populating every `*_prefix`/
`*_next_number` pair yourself (see `App\Models\TokenSerie::$fillable` for
the full column list — 20 pairs). Given how easy it is to miss one (this
exact mistake is why credit notes were broken everywhere before this
session), prefer `autoGenerate()` unless you specifically need the
UI-driven flow.

```bash
# Only if you deliberately want the manual/UI path instead of autoGenerate():
curl -X POST https://<host>/api/backend/token-series \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "code": "ORBIS01",
    "name": "ORBIS Distribution — numérotation",
    "scope": "branch",
    "allowed_branches": ["ORBIS-CAS"],
    "is_default": false,
    "is_active": true
  }'
# Then PUT /api/backend/token-series/{id} with every *_prefix/*_next_number
# pair — invoice_prefix, order_prefix, transfer_prefix (BL), credit_note_prefix,
# payment_prefix, etc. — digits_in_counter too (defaults to 6 if omitted).
```

---

## 6. Step 5 — Payment Terms

**No API endpoint creates a `PaymentTerm` row** (only list/delete exist).
Same as Company — this is a tinker/seeder step.

**Important — this table is global, not per-company.** GCOM's cash-sale
path (`GcomContextResolver::resolveCashPaymentTermId()`) resolves the cash
term with `PaymentTerm::withoutGlobalScopes()->where('is_cash', true)
->first()` — no company or branch filter. **If this ERP already has any
cash payment term configured for another company, ORBIS doesn't need a new
one** — every cash/card GCOM sale for ORBIS will resolve that same shared
term. Check first:

```php
\App\Models\PaymentTerm::withoutGlobalScopes()->where('is_cash', true)->exists();
```

If that's `false` (fresh install, or somehow never configured), create one:

```php
\App\Models\PaymentTerm::create([
    'code' => 'CASH',
    'name' => 'Comptant',
    'days_number' => 0,
    'is_credit' => false,
    'is_cash' => true,
    'calculation_type' => 'simple',
    'active' => true,
]);
```

For ORBIS's own credit terms (30-day, 60-day, etc. — used by GCOM's
`credit`/`transfer` payment methods), create dedicated rows regardless,
since these represent your actual commercial terms with each customer:

```php
$credit30 = \App\Models\PaymentTerm::create([
    'code' => 'ORBIS_30J',
    'name' => 'Crédit 30 jours — ORBIS',
    'days_number' => 30,
    'is_credit' => true,
    'is_cash' => false,
    'calculation_type' => 'simple',
    'active' => true,
]);
```

**Data-scoping caveat**: `PaymentTerm` carries a `HasDataScoping` global
scope (a per-user allowlist). GCOM's cash-term lookup already bypasses it
(`withoutGlobalScopes()`, fixed as part of this session's build — see
`docs/modules/28-gcom.md` §10 item 3). If you pass a specific
`payment_term_id` explicitly to a GCOM endpoint for a *credit* sale and it
comes back "not found" for a user who should have access, check that
user's data-rule allowlist includes this term — that's the same trap,
just on the explicit-ID path rather than the cash-lookup path.

---

## 7. Step 6 — Set the Company's Sales Mode to GCOM

Real endpoint (built this session):
`PUT /api/backend/companies/{company}/sales-mode`
(`permission:manage-system-settings`).

```bash
curl -X PUT https://<host>/api/backend/companies/<company.id>/sales-mode \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"sales_mode": "GCOM"}'
```

This is a **stored flag only** — nothing in the codebase enforces it yet
(no bootstrap/UI branch reads it as of this doc). Setting it is still worth
doing now: it's the field a future "hide SFA screens for GCOM-only
companies" decision will read, and it costs nothing to set correctly at
onboarding time versus retrofitting it later. Skip this step if you'd
rather leave it at the `HYBRID` default; nothing else in this guide depends
on it.

---

## 8. Step 7 — Admin User + GCOM Role

### 8.1 Create the user

Real endpoint: `POST /api/backend/employees`
(`permission:manage-employees`).

```bash
curl -X POST https://<host>/api/backend/employees \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "name": "ORBIS Admin",
    "phone": "+212 6 00 00 00 00",
    "email": "admin@orbis-distribution.ma",
    "branch_code": "ORBIS-CAS",
    "role": "admin"
  }'
```

Assigning the existing `admin` role gets this user `manage-gcom` (and
everything else `admin` already holds) immediately — the seeder that grants
`manage-gcom` gives it to `root`+`admin` by default (see
`database/seeders/DynamicRbacPermissionsSeeder.php`).

### 8.2 (Recommended) A narrower GCOM-only role instead

If ORBIS's back-office users should touch **only** GCOM (not the whole
`admin` surface — master data, RBAC, backups, etc.), create a scoped role
via the real RBAC API instead of assigning `admin`:

```bash
# 1. Create the role
curl -X POST https://<host>/api/backend/roles \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name": "orbis_gcom_operator"}'

# 2. Grant it exactly the GCOM permission (and inventory checks, if this
#    role also runs stock counts)
curl -X POST https://<host>/api/backend/roles/<role.id>/permissions \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"permissions": ["manage-gcom", "manage-inventory-checks"]}'
```

Then assign this role instead of `admin` when creating the employee (Step
8.1's `role` field).

---

## 9. Step 8 — Catalog Prerequisites

Before creating products, the reference/master data they point to must
exist. All of these are read via `GET /api/backend/masterdata/*` first (to
check what already exists globally — categories/units/VAT taxes are
typically shared across companies, not per-company) and created via
`/api/backend/master-data/*` (note the different prefix — `master-data`,
hyphenated, is the CRUD hub; `masterdata` is the read-only lookup hub —
these are two distinct route groups in this codebase, easy to mix up).

```bash
# Check what already exists (often nothing to create — these are usually shared):
curl https://<host>/api/backend/masterdata/vat-taxes -H "Authorization: Bearer $TOKEN"

# If ORBIS needs a category/brand/unit that doesn't exist yet:
curl -X POST https://<host>/api/backend/master-data/categories \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name": "Épicerie", "code": "EPICERIE"}'

curl -X POST https://<host>/api/backend/master-data/units \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name": "Unité", "code": "UN"}'
```

---

## 10. Step 9 — Products

Real endpoint: `POST /api/backend/products` (`permission:manage-products`).
Note this one requires a `thumbnail` image file on creation (multipart
form, not raw JSON) unless it's a later update to an existing product —
plan for that in whatever import tooling provisions ORBIS's catalog.

```bash
curl -X POST https://<host>/api/backend/products \
  -H "Authorization: Bearer $TOKEN" \
  -F "name=Huile Végétale 1L" \
  -F "description=Huile végétale conditionnée 1 litre" \
  -F "short_description=Huile 1L" \
  -F "code=ORBIS-HV1L" \
  -F "price=25.00" \
  -F "unit=<unit.id>" \
  -F "category=<category.id>" \
  -F "thumbnail=@/path/to/image.jpg"
```

---

## 11. Step 10 — Pricing

GCOM's `GcomPricingCalculator` resolves price via
`PartnerProductPriceResolver`, which checks (in priority order) a
partner-specific `PartnerPriceOverride` before falling back to the
partner's assigned `PriceList`. You need at least a default price list;
overrides are optional (used for negotiated/contract pricing per
customer).

```bash
# 1. Create a default price list
curl -X POST https://<host>/api/backend/pricing \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"code": "ORBIS_STD", "name": "ORBIS — Tarif standard", "rank": 1}'

# 2. (Optional) A fixed-price override for a specific partner/product pair
curl -X POST https://<host>/api/backend/pricing/overrides \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "partner_id": <partner.id>,
    "product_id": <product.id>,
    "fixed_price": 22.50,
    "active": true,
    "priority": 1
  }'
```

---

## 12. Step 11 — First Customer (Partner)

Real endpoint: `POST /api/backend/partners`. `price_list_id` is required
(the one from Step 10). For a partner who'll buy on credit (GCOM's
`credit`/`transfer` payment methods), also set `credit_limit` — GCOM's
`CreditControlEngine` reads this via the partner's financial profile, not
this field directly, but populating it here is still the conventional
starting point; a full credit setup (financial profile, credit state) may
need a follow-up call depending on which credit-control version
(`payment.domain_v2`) is active — see `docs/modules/08-payment-credit.md`
if credit sales reject unexpectedly.

```bash
curl -X POST https://<host>/api/backend/partners \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "name": "Épicerie Al Amal",
    "price_list_id": <price_list.id>,
    "partner_type": "CUSTOMER",
    "phone": "+212 6 11 22 33 44",
    "city": "Casablanca",
    "credit_limit": 20000,
    "payment_term_id": <credit30.id from Step 5>
  }'
```

---

## 13. Step 12 — Suppliers (optional, for Purchase Reception)

Not required for a sales-only GCOM setup, but if ORBIS also receives stock
through this ERP (Purchase Reception — `PurchaseReceptionController`,
confirmed working end-to-end this session, see
`tests/Feature/Warehouse/PurchaseReceptionValidationTest.php`):

```bash
curl -X POST https://<host>/api/backend/master-data/suppliers \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"code": "SUP-ORBIS-01", "name": "Fournisseur Général SARL", "phone": "+212 5 22 11 11 11"}'
```

Then `POST /api/backend/purchase-receptions` with `branch_code: "ORBIS-CAS"`
and a `lines[]` array to actually receive stock — see
`app/Http/Controllers/Backend/PurchaseReceptionController.php` for the full
validate/cancel/reverse workflow.

---

## 14. Step 13 — Smoke Test: First GCOM Sale

With all of the above in place, prove the chain end-to-end with a single
Facture Directe (Flow #6 — BC + stock-out + invoice in one call):

```bash
curl -X POST https://<host>/api/backend/gcom/direct-invoices \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $(uuidgen)" \
  -d '{
    "partner_id": <partner.id>,
    "items": [{"product_id": <product.id>, "quantity": 2}],
    "payment_method": "cash"
  }'
```

Expect `201` with an `invoice` object, `fully_paid`, stamp duty applied
(cash), stock deducted from `ORBIS-CAS`. If this fails, the error message
will point at whichever step above is incomplete — most commonly:

| Error | Missing step |
|---|---|
| `No active token series available for BC numbering (branch: ORBIS-CAS)` | Step 4 |
| `No cash payment term configured` | Step 5 |
| `No central warehouse configured for order ...` | Step 3 (code must equal branch code) |
| `Token series [...] is not configured for INV (invoice_prefix/invoice_next_number)` | Step 4, used the manual/UI path and missed a prefix column |

Once this works, everything in `docs/modules/28-gcom.md` (all 9 document
flows, cancellation, avoir, règlement/lettrage, consultation endpoints) is
available for ORBIS.

---

## 15. Checklist Summary

- [ ] Company `ORBIS` created (tinker)
- [ ] Branch `ORBIS-CAS` created + linked to company
- [ ] Central Warehouse `ORBIS-CAS` (type=central, code = branch code)
- [ ] Token Series provisioned via `TokenSerie::autoGenerate('ORBIS-CAS')`
- [ ] A cash `PaymentTerm` exists somewhere in the system (global — check
      before creating a duplicate)
- [ ] ORBIS credit `PaymentTerm`(s) created for negotiated terms
- [ ] `sales_mode` set to `GCOM` (optional, no enforcement yet)
- [ ] Admin/operator user created, role assigned (`admin`, or a scoped
      `manage-gcom` role)
- [ ] VAT/units/categories confirmed or created
- [ ] At least one product created
- [ ] Default price list created; overrides as needed
- [ ] At least one partner/customer created
- [ ] Suppliers created (only if using Purchase Reception)
- [ ] Smoke test: `POST /gcom/direct-invoices` returns `201`
