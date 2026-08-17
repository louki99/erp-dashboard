# Mode GCOM (Gestion Commerciale Pure) — Complete Guide

> **Version**: 2026-08-15 — updated for cancellation/avoir, PDF, partial
> line cancel, dedicated permission, `sales_mode`, and the `GcomDatabaseSeeder`
> demo tenant (see §13 for what's new since the initial build).
> **Audience**: this doc is written for two readers — backend maintainers
> (architecture/rationale, §1–7, §9–12) and **frontend/UI integrators**
> (§8 API Reference and §13–15, which are self-contained — you can build a
> GCOM UI from those sections alone without reading the rest).
> **Branch**: `gcom` (isolated working branch off `feature/build-studio-document`)
> **Services**: `App\Domains\Gcom\*` — `GcomDirectInvoiceService`, `GcomOrderService`, `GcomDeliveryNoteService`, `GcomCreditNoteService`, `GcomPaymentController`, plus shared helpers under `App\Domains\Gcom\Shared\Services`
> **Routes**: `routes/backend/gcom.php`, prefix `/api/backend/gcom/*`, `permission:manage-gcom` (granted to `root`+`admin` by default)

---

## Table of Contents

1. [Why GCOM Is a Separate Module](#1-why-gcom-is-a-separate-module)
2. [The Nine Document Flows](#2-the-nine-document-flows)
3. [Golden Rule: Stock Deduction Timing](#3-golden-rule-stock-deduction-timing)
4. [Settlement Classification](#4-settlement-classification)
5. [Credit Control Integration](#5-credit-control-integration)
6. [Règlement & Lettrage](#6-règlement--lettrage)
7. [Shared Services (the reuse layer)](#7-shared-services-the-reuse-layer)
8. [API Reference](#8-api-reference) — **start here for UI integration**
9. [Cancellation & Avoir (Credit Notes)](#9-cancellation--avoir-credit-notes)
10. [Real Bugs Found Building This](#10-real-bugs-found-building-this)
11. [Known Gaps — Deliberately Deferred](#11-known-gaps--deliberately-deferred)
12. [Testing](#12-testing)
13. [Status & Enum Reference](#13-status--enum-reference)
14. [Frontend Integration Notes](#14-frontend-integration-notes)
15. [Getting a Test Tenant — GcomDatabaseSeeder](#15-getting-a-test-tenant--gcomdatabaseseeder)

---

## 1. Why GCOM Is a Separate Module

GCOM ("Gestion Commerciale pure") targets back-office B2B/grossiste/négoce
sales — quotes, direct counter invoicing, credit accounts — with **zero
field-sales dependency**: no `Visit`, no `WorkSession`, no van, no route, no
tournée, no ADV derogation workflow.

Before writing any GCOM code, an audit (2026-08-13) checked whether the
existing "Conventional" van-selling subsystem or POS already covered this.
**They don't.** Findings:

- `DirectInvoiceOrchestrator` (Conventional) hard-requires an open `Visit`
  tied to a `WorkSession`, and a van-anchored warehouse context
  (`app/Services/Sales/Conventional/DirectInvoiceOrchestrator.php`). It's
  "SFA-lite" — instant invoicing per tournée stop — not GCOM.
- `LoadingRequest`/`ConventionalDechargeReconciliationService`/
  `ConventionalDailyLedgerService` are all truck-loading/van-ledger
  concepts, not counter-sale concepts.
- `config/conventional_sales.php`'s flags (`adv_validation_on_session_end`,
  `session_reconciliation_required`, ...) all key off `WorkSession`/van
  close-out — Conventional is not zero-field-constraint as configured.
- POS is a distinct, not-yet-production concept — not reused.

**Conclusion**: GCOM is new code, but it is *not* a rewrite of the Core
Engine. It calls the same generic, channel-agnostic primitives every other
part of the ERP uses — `StockService`, `InvoiceService`,
`PartnerProductPriceResolver`, `VatResolutionService`,
`CreditControlEngine`, `PaymentTransferService`, `LetteringService` — none
of which required forking. Several of those primitives turned out to be
already generic in *implementation* despite only ever being *called* from
van-specific code (`StockService::deductForDirectSale()` takes any
warehouse code — it just had no non-van caller until GCOM).

---

## 2. The Nine Document Flows

| # | Flow | Entry point | Status |
|---|------|-------------|--------|
| 1 | Devis → BC → Facture | `POST /quotes/{id}/convert-to-order` → `POST /orders/{id}/convert-to-invoice` | ✅ |
| 2 | Devis → Facture Directe | `POST /quotes/{id}/convert` | ✅ |
| 3 | BC → Facture | `POST /orders` → `POST /orders/{id}/convert-to-invoice` | ✅ |
| 4 | BC → BL → Facture | `POST /orders` → `.../convert-to-bl` → `POST /delivery-notes/{id}/convert-to-invoice` | ✅ |
| 5 | BL Direct → Facture | `POST /delivery-notes` → `.../convert-to-invoice` | ✅ |
| 6 | Facture Directe / Comptoir | `POST /direct-invoices` (1-click: BC + stock-out + invoice) | ✅ |
| 7 | Règlement à la facture (ESP/Chèque/Effet/Virement) | Built into every invoice-producing endpoint via `payment_method` | ✅ |
| 8 | Lettrage (imputer un règlement sur 1+ factures) | `POST /payments` | ✅ |
| 9 | Encours client / crédit | `CreditControlEngine`, checked on every non-immediate sale | ✅ |

No flow is privileged — a user can start at Devis, BC, BL, or straight at
Facture, and convert forward from wherever they start. Nothing in the
Order/Invoice/DeliveryNote schema enforces a fixed sequence for GCOM
documents; the *services* simply offer every entry point.

**Traceability**: no new `origin_document_type`/`origin_document_id`
columns were added (see §10) — the existing relational chain already
carries this: `Invoice.order_id` / `Invoice.delivery_note_id` /
`DeliveryNote.order_id` / `Quote.converted_order_id`. Walking backward from
an invoice to its quote (if any) is a two-hop join, not a stored field.

---

## 3. Golden Rule: Stock Deduction Timing

> Stock deducts at the **first document that physically materializes the
> sale** for a given flow. Never before. Never twice.

| Flow | Deducts at | Does NOT deduct at |
|------|-----------|---------------------|
| Facture Directe/Comptoir (#6) | Invoice creation (only document that exists) | — |
| BC → Facture (#3) | `convertOrderToInvoice()` | BC creation |
| BC → BL → Facture (#4) | `convertOrderToDeliveryNote()` (BC→BL) | BC creation, BL→Facture |
| BL Direct → Facture (#5) | BL creation (`createDirectDeliveryNote()`) | BL→Facture |

This is enforced by `StockService::deductForDirectSale()` being called from
exactly one place per flow (`GcomDirectInvoiceService::createDirectInvoice`/
`convertOrderToInvoice`, or `GcomDeliveryNoteService::
createDeliveryNoteFromOrder`) — never from both a BC-creation step and its
later conversion. `convertOrderToInvoice()` and `convertDeliveryNoteToInvoice()`
are also idempotent: calling either again on an already-invoiced
order/BL returns the existing invoice rather than re-running anything.

Covered by `GcomFlexibleDocumentFlowTest` — this is the single most
important invariant in the whole module, verified explicitly per flow
(stock quantity asserted after each hop, not just at the end).

---

## 4. Settlement Classification

Six payment methods (`cash`, `card`, `credit`, `cheque`, `effet`,
`transfer`), three behaviors, classified by
`App\Domains\Gcom\Shared\Services\GcomSettlementClassifier`:

| Behavior | Methods | Invoice ends as | Exposure via |
|---|---|---|---|
| **Immediate** | cash, card | `fully_paid` immediately | none |
| **Instrument** | cheque, effet | `fully_paid` (settled by the instrument) + a `FinancialInstrument` row `PENDING` | `ExposureCalculator`'s `pending_cheques`/`pending_effets` terms |
| **Credit** | credit, transfer | `pending` (`is_credit_sale=true`) | `ExposureCalculator`'s `open_invoices` term |

**Why cheque/effet mark the invoice paid, not pending**: a physical
instrument changed hands at the point of sale — from an AR perspective the
invoice is settled, replaced by "effets/chèques à recevoir" as the real
remaining risk. Marking it `pending` too would double-count the same
amount as both an open invoice and a pending instrument.

**Treasury unification (2026-08-15)**: every Immediate and Instrument
settlement — i.e. anything that closes `fully_paid` at document creation,
cash/card/cheque/effet, never credit/transfer — now ALSO creates a real
`payment_transfers` row (registered → validated) and a `letterings` row
linking it to the invoice, via `GcomInstrumentRegistrar::recordSettlement()`.
Before this, `payment_transfers`/`letterings` only ever got populated by a
later règlement (§6) — a comptoir cash/cheque sale left both empty despite
the invoice closing paid, which is what prompted this. `payment_transfers`
is now the single source of truth for every GCOM cash inflow, comptoir or
deferred, not just deferred ones. Cheque/effet still ALSO get a
`FinancialInstrument` row — the two aren't redundant: `financial_instruments`
tracks the physical document's own bank-clearing lifecycle (registered →
deposited → cleared/rejected), `payment_transfers`/`letterings` is the
accounting journal (who paid, how much, against which invoice).

Stamp duty (`StampDutyService`, 0.25%) applies to `cash` only, by Moroccan
law — computed once, at BC creation (`GcomOrderBuilder::build()`), not
per-conversion-step.

---

## 5. Credit Control Integration

Every non-immediate settlement (`credit`, `transfer`, `cheque`, `effet`)
runs `CreditControlEngine::evaluateOrderEligibility()` — the same engine
fixed/tested earlier in this session for the SFA/mobile channel (see
`docs/modules/08-payment-credit.md` §11.11) — **before any row is
written**. Pricing/tax for every line is pre-computed first specifically so
the check sees the real order total, not an estimate.

**No derogation path.** GCOM has no ADV/approval workflow anywhere. A hard
block (`CreditDecision::canProceed() === false`) throws a `DomainException`
and the sale is rejected outright — there is nothing to route the request
to for manual override, unlike the télévendeur BC channel.

**Checked once, at BC creation** (`GcomOrderService::createOrder()`), not
re-checked at each later conversion step (BC→Facture, BC→BL, BL→Facture) —
nothing about the order's partner/amount changes between BC and its
eventual invoice, so re-checking would be redundant, and there's no
derogation path to react differently to anyway.

A resolved `payment_term_id` is required for `credit`/`transfer` — either
passed explicitly or falling back to the partner's default term
(`Partner::paymentTerm()`). No fallback exists for a partner with no term
configured — the sale is rejected with a clear message rather than silently
picking an arbitrary term.

---

## 6. Règlement & Lettrage

`PaymentTransferService` and `LetteringService` (both pre-existing,
`app/Services/*`) were already fully channel-agnostic — keyed on
`invoice_id`/`partner_id`, no `canal` filter anywhere. The actual gap was
that neither was reachable from any backend/admin endpoint, only from
`CollectionService` (mobile field-collection). `GcomPaymentController`
closes that:

- `POST /payments` — registers a payment, validates it immediately (no ADV
  approval step, same design as the rest of GCOM), then letters it: either
  against explicit `allocations` (`[{invoice_id, amount}]`) or
  auto-lettered oldest-open-invoice-first (`LetteringService::autoLetter()`).
- `GET /partners/{partner}/open-invoices` — lookup for deciding what a
  règlement should cover.

This is how a `credit`/`transfer` GCOM invoice (left `pending` at creation)
gets settled later — GCOM doesn't special-case this, it's the same
mechanism every other credit invoice in the ERP uses. It's also, since
2026-08-15, the exact same register→validate→letter sequence an
*immediate* settlement runs at document creation (§4) — same tables, same
shape, whether the money arrived at the counter or three weeks later.

**Per-partner financial views** (2026-08-15, `GcomPartnerFinanceController`)
— three reads for a "vue financière complète par client" screen:

- `GET /partners/{partner}/financial-instruments` — row-level cheque/effet
  portfolio. Query: `status?` (`PENDING`/`DEPOSITED`/`CLEARED`/`REJECTED`/
  `CANCELLED`), `instrument_type?` (`CHEQUE`/`EFFET`), `per_page?`. This
  genuinely didn't exist anywhere before — checked first: the only other
  `FinancialInstrument` endpoint in the whole codebase is a mobile
  *create* action, no list/index anywhere.
- `GET /partners/{partner}/statement` — `{ partner_id, total_debit,
  total_credit, current_balance, pending_instruments_total, credit_limit,
  available_credit }`. `credit_limit`/`available_credit` are read straight
  from `CreditControlEngine::getCreditState()` — the same source
  `GET /api/backend/credit-v2/partners/{partner}` and
  `GET /api/backend/partners/{id}/balances` already use elsewhere in the
  ERP (both pre-existing, both already reachable by a GCOM admin today —
  checked before building anything, not reimplemented here). `total_debit`/
  `total_credit`/`current_balance` are a genuinely different, LIFETIME
  number (every invoice/payment/avoir ever, not the current open exposure
  those two endpoints track), computed fresh from GCOM's own invoices/
  letterings/credit-notes.
- `GET /partners/{partner}/ledger` — chronological merged debit/credit
  entries (`type`: `invoice`/`payment`/`credit_note`, plus a running
  `running_balance`). Query: `from?`/`to?` (`YYYY-MM-DD`, filters each
  entry's own date). Built directly from `Invoice`/`Lettering`/
  `CreditNote` — deliberately NOT from `MsTransaction`, even though that
  table already gets `partner_id`-tagged postings for invoices and
  payments (`InvoiceService::postInvoiceFinancialPosting()`,
  `PaymentTransferService::validatePayment()`): `GcomCreditNoteService`
  never posts an `MsTransaction` entry for an avoir, so a ledger built
  from that table would silently miss every credit note.

All three scope by `order.partner_id`/`invoice.partner_id` directly — no
multi-tier billing-partner indirection
(`Partner::resolveBillingPartner()`), since no GCOM flow uses a payer
partner today.

---

## 7. Shared Services (the reuse layer)

Extracted 2026-08-13 when BC/BL support was added, so pricing/credit/
order-building logic has exactly one implementation instead of three
copies (the class of duplication that caused several real bugs earlier
this session — two `CreditControlService`, two `PartnerCreditService`; see
`docs/modules/08-payment-credit.md` §11.11).

| Class | Responsibility |
|---|---|
| `GcomPricingCalculator` | Line pricing/tax (`PartnerProductPriceResolver` + `VatResolutionService`, called **with** `$partner` — unlike `SalespersonCartService::addLine()`, which doesn't and silently skips partner VAT-group overrides) |
| `GcomSettlementClassifier` | Payment-method → behavior classification + the credit-limit check |
| `GcomContextResolver` | Branch/company/central-warehouse/cash-term resolution |
| `GcomOrderBuilder` | Builds the BC (`Order` + `OrderProduct` rows), no stock/invoice side effects |
| `GcomInstrumentRegistrar` | Two responsibilities: `register()` — a `FinancialInstrument` (cheque/effet) + marks the invoice paid. `recordSettlement()` (2026-08-15) — a `payment_transfers`+`letterings` entry for any immediate settlement (cash/card/cheque/effet), the treasury-unification mechanism above; also closes the gap where `InvoiceService::generateFromDeliveryNote()` always returns `'pending'` (no `is_credit_sale`-driven split, unlike `createFromPosOrder()`) |
| `GcomQuoteItemsExtractor` | Validates a quote is convertible (not already converted/expired) and extracts line items |

`GcomOrderService`, `GcomDeliveryNoteService`, and
`GcomDirectInvoiceService` each compose these rather than duplicating any
of this logic.

---

## 8. API Reference

**Base URL**: `/api/backend/gcom`
**Auth**: `Authorization: Bearer <sanctum-token>` (every request) — see §14
for the full header list and how to obtain a token.
**Gate**: `permission:manage-gcom` — the authenticated user's role must
carry this permission (`root`/`admin` have it by default). A user without
it gets `403 Forbidden` on every route in this file.
**Idempotency**: every route marked 🔁 below additionally requires an
`X-Idempotency-Key` header (any UUID, one per logical action — see §14).
Missing it on a 🔁 route returns `422`.

All list (`GET` index) endpoints return Laravel's standard paginator
shape — see §14 for the exact envelope, documented once instead of
repeated below.

### Quotes (Devis)

**`GET /quotes`** — list the *authenticated user's own* quotes only
(`Quote.user_id = current user` — there is no cross-user quote listing on
this endpoint).
Query: `status?` (`draft`|`sent`|`accepted`|`expired`|`converted`), `per_page?`

**`GET /quotes/{id}`** — 403 if the quote belongs to a different user.

**`GET /quotes/{id}/pdf`** — streams the Devis PDF (`Content-Type:
application/pdf`). `?download=1` for an attachment instead of inline,
`?price_mode=ht|ttc` for whether line items print HT or TTC (see the
HT/TTC print toggle note below §8 — defaults to `ht`, this document's own
existing convention, if omitted). Same generic document pipeline as BC/BL
below (`App\Services\DocumentService`, type `devis`) — genuinely new as of
2026-08-17, no document type anywhere in the codebase rendered a Quote
before this. Not a JSON endpoint — point a browser `<a href>`/download
button directly at this URL (with the auth header), same caveat as every
other PDF endpoint in this module.

**`POST /quotes`**
```json
{
  "partner_id": 12,
  "items": [{ "product_id": 42, "quantity": 3 }],
  "notes": "Devis pour ouverture de saison",
  "expires_at": "2026-09-01T00:00:00Z"
}
```
→ `201`, `{ "success": true, "quote": { "id": 7, "status": "draft", ... } }`

**`POST /quotes/{id}/convert`** 🔁 — Devis → Facture Directe (flow #2).
Skips the BC stage entirely — lands straight on a paid or credit invoice.
```json
{
  "payment_method": "cash",
  "payment_term_id": null,
  "instrument": null
}
```
All fields optional (`payment_method` defaults to `"cash"`). If
`payment_method` is `cheque`/`effet`, `instrument` is required:
```json
{ "payment_method": "cheque", "instrument": { "reference_number": "CHQ-0001", "due_date": "2026-10-12", "bank_name": "Attijariwafa", "bank_account": "011..." } }
```
→ `200`, `{ "success": true, "message": "Quote converted to invoice", "invoice": {...}, "quote": { "status": "converted", ... } }`

**`POST /quotes/{id}/convert-to-order`** 🔁 — Devis → BC (flow #1, first
hop). Body: `{ "payment_method"?, "payment_term_id"? }`.
→ `201`, `{ "success": true, "order": { "bc_status": "confirmed", ... }, "quote": { "status": "converted", ... } }`

### Orders (BC)

**Montant HT/TVA/TTC**: `order.sub_total` (HT), `order.tax_amount` (TVA),
`order.total_amount` (TTC) are all real columns, always populated at BC
creation (not only after an invoice exists) — read them directly, no
computation needed on the client. `order.stamp_duty` is separate (cash
sales only, not VAT).

**`GET /orders`** — scoped to `canal = 'GCOM'` automatically (SFA/POS
orders never appear here). Query: `partner_id?`, `bc_status?` (in
practice only `confirmed`|`cancelled` ever appear — see §13),
`per_page?`.

**`GET /orders/{order}`** — 404 if the order isn't a GCOM order. Response
includes `products` (line items), `partner`, `invoices`, `deliveryNotes`.

**`GET /orders/{order}/pdf`** — streams the BC PDF (`Content-Type:
application/pdf`). `?download=1` for an attachment, `?price_mode=ht|ttc`
for whether line items print HT or TTC (defaults to `ht` if omitted).
2026-08-17: reuses the ERP's generic document pipeline
(`App\Services\DocumentService`, type `bc`) — the same one
`Backend\DocumentController` already exposes for other channels, not a
GCOM-specific renderer. Not a JSON endpoint.

**`POST /orders`** 🔁 — flow #1 (second hop, if not started from a quote)
/ #3 / #4's BC leg.
```json
{
  "partner_id": 12,
  "items": [{ "product_id": 42, "quantity": 3 }],
  "payment_method": "credit",
  "payment_term_id": 5,
  "notes": "Commande mensuelle"
}
```
`payment_term_id` is **required** if `payment_method` is `credit`/`transfer`
and the partner has no default payment term configured — otherwise it
falls back to `Partner.paymentTerm()`.
→ `201`, `{ "success": true, "message": "Order created", "order": {...} }`

Does **not** touch stock or create an invoice — see §3.

**`POST /orders/{order}/convert-to-invoice`** 🔁 — flow #3 (BC → Facture,
no BL). Body: `{ "instrument"? }` (same shape as quotes' convert, required
for cheque/effet). Idempotent: calling again on an already-invoiced order
returns the existing invoice instead of erroring.
→ `200`, `{ "success": true, "message": "Order converted to invoice", "invoice": {...} }`

**`POST /orders/{order}/convert-to-bl`** 🔁 — flow #4's first hop (BC → BL).
Body is optional:
```json
{ "delivery_date": "2026-08-25", "payment_method": "cash" }
```
Both fields optional independently. `delivery_date` (`YYYY-MM-DD`) defaults
to today, sets `delivery_note.delivery_date`. `payment_method` (one of
`cash`/`card`/`credit`/`cheque`/`effet`/`transfer`) defaults to the BC's
existing method; if it differs from that, it **replaces** the order's
payment method at this point (`order.financial_metadata.payment_method`) —
this is the last moment before stock/invoicing lock the order in, so it's
the last chance to correct a payment method chosen wrong at BC creation.
Changing it has real side effects, not just a label update:
- **Stamp duty is recalculated**, not left frozen from BC creation —
  moving to `cash` adds it, moving away from `cash` removes it
  (`order.stamp_duty`/`total_amount`/`payable_amount` all update
  accordingly; StampDutyService is cash-only by Moroccan law).
- **Credit is re-checked** if moving from an immediate method
  (`cash`/`card`, never checked at BC creation) to any other method —
  `422 "Credit check failed: ..."` if it fails, same as at BC creation.
- `order.is_credit_sale` and `order.payment_term_id` are re-synced when
  the credit classification flips (`credit`/`transfer` vs. everything
  else) — same resolution `POST /orders` itself uses, so `422` with "No
  payment term resolved..." if the partner has no default term and one
  wasn't already on the order.

→ `201`, `{ "success": true, "message": "Order converted to delivery note", "delivery_note": {...} }`
→ `422` on a malformed `delivery_date`, an invalid `payment_method`, a
failed credit re-check, or a missing payment term for a new credit sale.

**`POST /orders/{order}/cancel`** 🔁 — see §9. Body: `{ "reason": "..." }`
(required, max 255 chars). Only allowed if the BC has no BL and no
invoice yet.
→ `200`, `{ "success": true, "message": "Order cancelled", "order": { "bc_status": "cancelled", "cancellation_reason_code": "...", ... } }`
→ `422` if a BL or invoice already exists, or the BC isn't `confirmed`.

**`POST /orders/{order}/lines`** 🔁 — adds a brand-new product line to an
existing BC, same "before any BL/invoice" guard as the other line-level
actions below.
```json
{ "product_id": 77, "quantity": 4 }
```
Price is resolved fresh via the same pricing engine `POST /orders` uses —
not something the client computes. Rejects a `product_id` already on the
order (`422`) — use the `PATCH` update-line endpoint below to change an
existing line's quantity instead. For a credit-sale BC, adding a line
always grows the total, so the credit limit is unconditionally re-checked.
→ `201`, `{ "success": true, "message": "Order line added", "order": {...} }`
→ `422` if the product is already on the order, `quantity` is missing/≤ 0,
a BL/invoice already exists, or the new total breaches the credit limit.

**`POST /orders/{order}/lines/{orderProduct}/cancel`** 🔁 — partial or
full single-line cancellation, same "before any BL/invoice" guard.
`orderProduct` is the `OrderProduct` row id — `order.products[].pivot.id`
in every GCOM order response (see §14 for the gotcha this used to be
before the 2026-08-15 fix).
```json
{ "quantity": 2, "reason": "Le client a réduit sa commande" }
```
`quantity` omitted (or ≥ the line's own quantity) removes the line
entirely. Removing the last remaining line cancels the whole BC (same
effect as the whole-order cancel above).
→ `200`, `{ "success": true, "message": "Order line cancelled", "order": {...} }`

**`PATCH /orders/{order}/lines/{orderProduct}`** 🔁 — changes a BC line's
quantity in **either** direction (the cancel endpoint above only ever
reduces/removes). Same "before any BL/invoice" guard, same `orderProduct`
id gotcha as above.
```json
{ "quantity": 15 }
```
Price is re-resolved fresh for the new quantity (not linearly rescaled),
so a price-list change since the BC was created is picked up — other,
untouched lines on the same order keep their original creation-time price.
For a credit-sale BC, the credit limit is re-checked only when the new
total is **higher** than before a reduction never needs re-checking.
Stock is **not** touched — a GCOM BC never touches stock either way (see
§3); there is nothing to reflect until the BC is converted to a BL/invoice.
→ `200`, `{ "success": true, "message": "Order line updated", "order": {...} }`
→ `422` if `quantity` is missing/≤ 0 (use the cancel endpoint to remove a
line), a BL/invoice already exists, or the new total breaches the
partner's credit limit.

### Delivery Notes (BL)

**Montant HT/TVA/TTC**: `delivery_notes` has no `sub_total`/`tax_amount`
columns at all in the schema — only a flat TTC `total_amount`. Since a
GCOM BL always has an underlying Order with the real breakdown already
correct, `index`/`show`/`store` below all attach `sub_total` (HT) and
`tax_amount` (TVA) to the response, proxied from that order — read them
directly off `delivery_note.sub_total`/`delivery_note.tax_amount`, no
need to reach into `delivery_note.order` for them.

**`GET /delivery-notes`** — scoped to `order.canal = 'GCOM'`. Query:
`partner_id?`, `status?` (in practice only `delivered`|`cancelled` for
GCOM — no separate confirm/load/transit steps, a BL is `delivered` the
moment it's created; see §13), `per_page?`.

**`GET /delivery-notes/{deliveryNote}`** — 404 if not from a GCOM order.

**`GET /delivery-notes/{deliveryNote}/pdf`** — streams the BL PDF
(`Content-Type: application/pdf`). `?download=1` for an attachment,
`?price_mode=ht|ttc` for whether line items print HT or TTC (defaults to
`ttc` if omitted — the opposite default from BC/Devis, this document's own
existing convention). Same generic document pipeline as BC above
(`App\Services\DocumentService`, type `bl`). Not a JSON endpoint.

**`POST /delivery-notes`** 🔁 — flow #5 (BL Direct → Facture). Creates an
underlying BC transparently, then the BL — stock deducts **here**, at BL
creation, not later.
```json
{
  "partner_id": 12,
  "items": [{ "product_id": 42, "quantity": 3 }],
  "payment_method": "cash",
  "notes": "Livraison directe comptoir"
}
```
→ `201`, `{ "success": true, "message": "Delivery note created", "delivery_note": { "id": 5, "total_amount": "320.80", "sub_total": "268.91", "tax_amount": "51.09", ... } }`

**`POST /delivery-notes/{deliveryNote}/convert-to-invoice`** 🔁 — flow #4
second hop / #5's only hop. Body: `{ "instrument"? }`.
→ `200`, `{ "success": true, "message": "Delivery note converted to invoice", "invoice": {...} }`

**`POST /delivery-notes/{deliveryNote}/cancel`** 🔁 — see §9. Restocks
immediately. Body: `{ "reason": "..." }` (required, max 255 chars).
→ `200`, `{ "success": true, "message": "Delivery note cancelled", "delivery_note": {...} }`
→ `422` if an invoice already exists for this BL.

**`POST /delivery-notes/{deliveryNote}/lines/{item}/return`** 🔁 —
2026-08-18, see §9bis (CAS 1 of the returns architecture). `{item}` is the
`DeliveryNoteItem` row id (`delivery_note.items[].id`).
```json
{ "quantity": 3, "reason": "DAMAGED", "condition": "damaged" }
```
`condition` — `sellable` (default) | `damaged` | `technical` — see §9bis
for exactly where each one lands. `reason` — **2026-08-18, was free text,
now one of**: `DEFECTIVE`, `DAMAGED`, `WRONG_ITEM`, `CHANGE_MIND`,
`NOT_AS_DESCRIBED`, `EXPIRED`, `CUSTOMER_REQUEST`, `DUPLICATE_ORDER`,
`OTHER` (the same `App\Enums\ReturnReason` `credit_note_items` already
uses) — breaking change, `422` for anything else now. `quantity` must be
strictly less than the line's current quantity (returning the whole
line/BL isn't this endpoint's job — use `cancel` above for that, only
possible before invoicing either way). Restocks immediately and
recomputes the BL's `total_amount`; no separate step needed to bill the
net quantity — `convert-to-invoice` already reads the line's live
quantity. Each call is now also persisted as its own row (see below) —
previously `reason`/`condition` only ended up as freeform text buried in
`StockMovement.notes`, unreachable from any GET.
→ `200`, `{ "success": true, "message": "Delivery note line reduced", "delivery_note": {...} }`
→ `422` if the BL is already invoiced, `quantity` is ≥ the line's current
quantity, or `reason` isn't one of the values above.

**`GET /delivery-notes/{deliveryNote}/returns`** — 2026-08-18. Every CAS 1
return event recorded against this BL (any line), newest first.
→ `{ "success": true, "returns": [{ "id": 7, "delivery_note_item_id": 12, "product": {"code": "P001", "name": "..."}, "quantity": "3.000", "condition": "damaged", "reason": "DAMAGED", "stock_location": "GCB01-DAMAGED", "returned_by": {"id": 3, "name": "..."}, "returned_at": "2026-08-18T10:30:00.000000Z" }] }`

**`GET /delivery-notes/{deliveryNote}/returns/{return}/pdf`** — 2026-08-18,
bon de retour. `{return}` is a row id from the list above (each `return`
call already touches exactly one product/line, so one row prints cleanly
as one document — no aggregation across multiple return events). Same
generic pipeline as BC/Devis/BL/Facture (`App\Services\DocumentService`,
type `return`), same design family (logo, info boxes, line table,
signature block). `?download=1` for an attachment. `404` if `{return}`
doesn't belong to `{deliveryNote}` or the BL isn't a GCOM one.

### Direct Invoice (Facture Directe / Comptoir)

**`POST /direct-invoices`** 🔁 — flow #6, the 1-click path: BC + stock-out
+ invoice in one call. This is the endpoint a POS-style "comptoir" screen
should call.
```json
{
  "partner_id": 12,
  "items": [{ "product_id": 42, "quantity": 3 }],
  "payment_method": "cash",
  "notes": "Vente comptoir",
  "payment_term_id": null,
  "instrument": null
}
```
→ `201`, `{ "success": true, "message": "Invoice created", "invoice": { "id": 88, "status": "fully_paid", "total_amount": "75.19", "remaining_amount": "0.00", "items": [...], "partner": {...}, "order": {...} } }`

### Invoices (consultation only)

Every flow above lands here — there's no separate "create invoice"
concept beyond the endpoints already listed.

**`GET /invoices`** — scoped to `order.canal = 'GCOM'`. Query:
`partner_id?`, `status?` (`pending`|`partially_paid`|`fully_paid`|
`overdue` — see §13), `from?`/`to?` (invoice_date range, `YYYY-MM-DD`),
`per_page?`.

**`GET /invoices/{invoice}`** — 404 if not a GCOM invoice. Response
includes `items`, `partner` (full model), `order`, `order.deliveryNotes`,
plus two attached fields (2026-08-15, real gap reported by the UI team):

- `payments` — array, every `payment_transfers` row lettered against this
  invoice (comptoir settlements from §4's treasury unification AND
  deferred règlements from §6, same shape either way): `payment_transfer_id`,
  `code`, `amount_applied` (this lettering's share — usually the full
  invoice total, since GCOM never splits one payment across several
  invoices today), `payment_total_amount`, `payment_method`, `status`,
  `reference`, `bank`, `payment_date`, `lettering_date`, `notes`. Empty
  array for a `credit`/`transfer` invoice not yet settled.
- `financial_instrument` — object or `null`. The registered cheque/effet
  for this invoice (§4), with its own bank-clearing lifecycle independent
  of the invoice's own status: `id`, `instrument_type`, `reference_number`,
  `status` (`pending`/`deposited`/`cleared`/`rejected`), `amount`,
  `due_date`, `bank_name`, `bank_account`, `deposited_at`, `cleared_at`,
  `rejected_at`, `rejection_reason`. Always `null` for cash/card/credit/
  transfer.

**`GET /invoices/{invoice}/pdf`** — streams the invoice PDF
(`Content-Type: application/pdf`). Migrated 2026-08-18 onto the same
`DocumentService`/`documents._layout` pipeline BC/Devis/BL already use
(was `InvoiceDocumentService`/`documents.invoice_v1` — same plainer
template still used, untouched, by `Backend\OrderController` and POS).
Two real gaps this closed, both reported by the UI team after wiring a
shared "Imprimer" (HT/TTC) button across all 4 GCOM screens:

- `?price_mode=ht|ttc` — line-item prices HT or TTC. **Defaults to TTC**
  if omitted (this endpoint's own pre-existing convention — unlike BC/Devis,
  which default to HT), so existing callers see no behavior change.
- `?download=1` — attachment instead of inline (same query param BC/Devis/BL
  already use).
- Visual design now matches BC/Devis/BL exactly (logo, status badge,
  detailed CODE/DÉSIGNATION/UNITÉ/QTÉ/P.U./REM./MONTANT/TVA table, seller/
  client info boxes incl. a payment box with due date + mode, a
  payé/reste-à-payer breakdown when the invoice isn't fully settled,
  signature grid, legal footer) — no longer the older, sparser
  `invoice_v1` layout.

Not a JSON endpoint: point a browser `<a href>`/download button directly
at this URL (with the auth header), don't run it through your normal JSON
fetch wrapper.

### Avoir (Credit Notes) — see §9 for the full design

**`GET /invoices/{invoice}/credit-notes`** — list credit notes issued
against one invoice.
→ `{ "success": true, "credit_notes": [{ "id": 3, "status": "APPROVED", "total_amount": "75.19", "refund_amount": "0.00", "items": [...] }] }`

**`POST /invoices/{invoice}/credit-notes`** 🔁
```json
{
  "amount": null,
  "reason": "Retour marchandise défectueuse",
  "items": [{ "product_id": 42, "quantity": 1, "condition": "damaged" }]
}
```
- `amount` omitted → full `total_amount` (this **is** how a GCOM invoice
  gets cancelled after the fact — no separate "cancel invoice" endpoint).
- `items` present → also restocks (a physical "retour"); `items` omitted
  → pure financial correction, no stock movement.
- `items[].condition` — 2026-08-18, `sellable` (default) | `damaged` |
  `technical` — see §9bis for exactly where each one lands. Omit entirely
  for a plain sellable return, no behavior change from before this field
  existed.
- `reason` is required, max 500 chars.

→ `201`, `{ "success": true, "message": "Credit note created", "credit_note": {...}, "invoice": { "remaining_amount": "0.00", "status": "fully_paid", ... } }`
→ `422` if `amount` exceeds the invoice's `total_amount`.

### Payments (Règlement & Lettrage)

**`GET /payments`** — **channel-agnostic**: every payment for the given
partner, not just GCOM-originated ones (règlement has no `canal` concept
anywhere in this codebase). `partner_id` is **required** — there is no
global cross-partner feed on this endpoint. Query: `partner_id` (required),
`status?`, `per_page?`.

**`POST /payments`** 🔁 — register a règlement and letter it against open
invoices, in one call (no separate ADV-approval step — validated
immediately).
```json
{
  "partner_id": 12,
  "amount": 1250.00,
  "payment_term_id": 5,
  "payment_method_id": 2,
  "reference": "VIR-2026-0042",
  "bank_id": 3,
  "maturity_date": null,
  "notes": "Virement reçu",
  "instrument": null,
  "allocations": [{ "invoice_id": 88, "amount": 1250.00, "notes": "" }],
  "auto_letter": true
}
```
- `payment_method_id` (optional, 2026-08-17) — pick it from `GET
  /api/backend/masterdata/payment-methods`. If omitted, it falls back
  through the resolution chain documented just below. **This is the field
  the "Nouveau Règlement" screen's method dropdown should actually submit
  — not `payment_term_id`.** `payment_term_id` still controls the
  échéance/timing side and is separately required either way.
- `instrument` (required when `payment_method_id` resolves to
  cheque/effet, same shape as everywhere else in GCOM: `{
  reference_number, due_date, bank_name?, bank_account? }`) — a cheque/
  effet received at règlement time, weeks after the original sale, now
  gets the same bank-clearing lifecycle tracking (`financial_instruments`,
  `PENDING → DEPOSITED → CLEARED/REJECTED`) as one handed over at the
  counter. Linked via `financial_instruments.payment_transfer_id`, not
  `invoice_id` — a single règlement can letter across several invoices, so
  there's no one invoice to anchor it to. `422` if `payment_method_id`
  resolves to cheque/effet and `instrument` is missing.
- `allocations` present → letters exactly those invoices for exactly
  those amounts (explicit lettrage).
- `allocations` omitted **and** `auto_letter` true (the default) → letters
  the partner's oldest open invoices first, automatically, up to `amount`.
- Omit both `allocations` and set `auto_letter: false` to register the
  payment without lettering it yet (a partner-level credit balance to
  letter manually later).

→ `201`, `{ "success": true, "message": "Payment registered and lettered", "payment": {...}, "lettering": { ... LetteringService::getPaymentLetteringSummary() shape ... } }`

**`bank_id` is required** whenever `payment_term_id` resolves to a non-cash
term (`PaymentTransferService::registerPayment()`'s own guard) — populate
the picker from `GET /api/backend/masterdata/banks` (outside GCOM's own
routes, same "no duplicate master-data endpoints" rule as partners/
products — real gap found 2026-08-16, `Bank` the model already existed but
no listing endpoint anywhere did). → `{ "success": true, "data": [{ "id": 3, "code": "...", "name": "Attijariwafa Bank", "swift_code": "...", "is_active": true }] }`

**How `payment_method_id` is resolved** (real bug fixed 2026-08-16: every
payment term genuinely attached to a real partner failed with either
`"Bank is required for this payment method"` or `"Unable to resolve a
payment method for this payment term."` depending on whether `bank_id`
happened to be sent — both messages, same root cause). You never send
`payment_method_id` yourself in normal use; `PaymentTransferService::
registerPayment()` resolves it in this order:
1. An explicit `payment_method_id` in the request, if you send one.
2. The payment term's own `payment_method_id`, if it has one configured.
3. If the term is a cash term (`is_cash=true`) — automatically resolved to
   the system's cash `PaymentMethod`, deterministically, before step 4 (so
   a partner's generic default can never override an explicitly-cash
   règlement).
4. The partner's `partner_financial_profiles.default_payment_method_id`
   — the intended source of truth for credit-type terms per
   `database/sql/04_partenaires_commerciaux.sql`'s own documented
   architecture (payment_terms carry only timing logic; the settlement
   method is a per-partner fact).

`422 "Unable to resolve a payment method for this payment term."` now
means exactly one thing: none of the four sources above resolved anything
for this partner+term — check the partner's financial profile has a
`default_payment_method_id` set (`GET`/`PUT
/api/backend/partners/{id}/balances` or the equivalent admin screen; no
GCOM-specific endpoint for this, it's partner master data). This no
longer gets masked by the bank-requirement check — that's checked
strictly after method resolution now, so it never produces a second,
different-looking error for the same missing configuration.

**`GET /partners/{partner}/open-invoices`** — convenience lookup for
building a "which invoices does this règlement cover" picker.
→ `{ "success": true, "invoices": [{ "id": 88, "invoice_number": "INV-...", "invoice_date": "...", "due_date": "...", "total_amount": "...", "paid_amount": "...", "remaining_amount": "...", "status": "pending" }] }`

### Per-partner financial views — see §6 for the full design rationale

**`GET /partners/{partner}/financial-instruments`** — Query: `status?`,
`instrument_type?`, `per_page?`.
→ `{ "success": true, "financial_instruments": { "data": [{ "id": 1, "instrument_type": "CHEQUE", "reference_number": "CHQ-0001", "amount": "300.00", "status": "PENDING", "due_date": "2026-10-12", "bank_name": "...", ... }], ...pagination... } }`

**`GET /partners/{partner}/statement`**
→ `{ "success": true, "statement": { "partner_id": 1, "total_debit": 15000.00, "total_credit": 10797.20, "current_balance": 4202.80, "pending_instruments_total": 5359.20, "credit_limit": 50000.00, "available_credit": 40438.00 } }`

**`GET /partners/{partner}/ledger`** — Query: `from?`, `to?` (`YYYY-MM-DD`).
→ `{ "success": true, "partner_id": 1, "ledger": [{ "type": "invoice", "date": "2026-08-01", "reference": "INV-2026-00042", "debit": 1500.00, "credit": 0, "running_balance": 1500.00, "invoice_id": 88 }, { "type": "payment", "date": "2026-08-10", "reference": "PAY-2026-000004", "debit": 0, "credit": 1500.00, "running_balance": 0, "payment_transfer_id": 4 }, { "type": "credit_note", "date": "2026-08-12", "reference": "AV-2026-00003", "debit": 0, "credit": 200.00, "running_balance": -200.00, "credit_note_id": 3 }] }`

### Common request shapes

```json
// items — used by /quotes, /orders, /delivery-notes, /direct-invoices
[{ "product_id": 42, "quantity": 3 }]

// payment_method — every endpoint that produces/converts to an invoice
"cash" | "card" | "credit" | "cheque" | "effet" | "transfer"

// instrument — required when payment_method is cheque or effet
{
  "reference_number": "CHQ-0001",
  "due_date": "2026-10-12",
  "bank_name": "Attijariwafa Bank",     // optional
  "bank_account": "011780000012345678"  // optional
}
```

### Response & error envelope

Every mutating endpoint returns `{ "success": bool, "message"?: string }`
plus the created/updated resource under a named key (`invoice`, `order`,
`delivery_note`, `quote`, `credit_note`, `payment` — never a generic
`data`). Validation and domain errors return `422` with
`{ "success": false, "message": "..." }` — credit-limit rejections
included, message format `"Credit check failed: {reason}"`. See §14 for
the full status-code table and how to distinguish error types.

---

## 9. Cancellation & Avoir (Credit Notes)

Two separate mechanisms, deliberately not unified into one "undo" concept —
they cover different points in the document lifecycle:

**Cancellation (`GcomOrderService::cancelOrder()` /
`GcomDeliveryNoteService::cancelDeliveryNote()`)** — for documents that
haven't reached an invoice yet:

- A BC can only be cancelled while it has no BL and no invoice.
- A BL can only be cancelled while it has no invoice; cancelling restocks
  immediately via `StockService::restockForReturn()` (new, generic — the
  restock counterpart to `deductForDirectSale()`, idempotent per
  `referenceType+referenceId+product` since multiple returns can happen
  against the same order over time).
- Neither is built on the existing `CancellationService`
  (`cancelBonCommande()`/`cancelDeliveryNote()`): that service requires
  draft/pending statuses and a magasinier-approval-gated decharge before
  releasing stock — incompatible with GCOM's immediate-confirm,
  no-approval-workflow design (see §10 bug list — this was actually
  verified by reading the code, not assumed).

**Partial line cancellation (`GcomOrderService::cancelOrderLine()`)** —
same "before any BL/invoice" guard as the whole-BC cancel, but operates on
one `OrderProduct` line: a smaller `quantity` reduces the line and
recomputes the order's totals (sub_total/total_amount/payable_amount/
stamp_duty) from the remaining lines, never by decrementing the old
totals (avoids rounding drift across repeated partial cancellations,
mirroring `GcomOrderBuilder::build()`'s own "never trust a header total,
only sum(lines)" rule). Omitting `quantity` (or passing ≥ the line's own
quantity) removes the line entirely; removing the last line cancels the
whole BC. There is no equivalent for BL/invoice lines — once a BL exists,
cancel the whole BL (restocks everything); once invoiced, use an avoir
(§ below).

**Line quantity update (`GcomOrderService::updateOrderLine()`)** — the
missing "increase" counterpart to partial cancellation above: sets a BC
line's quantity to any new value, in either direction, before any
BL/invoice exists. Unlike `cancelOrderLine()`, price is **re-resolved**
via `GcomPricingCalculator` for the new quantity rather than linearly
rescaled from the old line total — picks up a price-list change since BC
creation the same way a fresh order would. Order totals are recomputed the
same "sum(lines), never decrement" way. For a credit-sale BC, the credit
limit (normally checked once, at BC creation — see §3) is re-checked only
when the new total is higher than before, since a reduction can't violate
a limit that already passed at the higher amount. Stock is never touched
either way — a plain BC never does (§3), so there's nothing to reconcile
until the BC is converted to a BL/invoice, at which point stock reacts to
whatever quantities are on the order at that moment.

**Adding a new line (`GcomOrderService::addOrderLine()`)** — completes the
trio: a partner adds a product they didn't originally order, still before
any BL/invoice. Same guard, same fresh-pricing approach as
`updateOrderLine()`. A `product_id` already on the order is rejected
rather than merged — ambiguous otherwise (merge quantities? re-price as
one combined line?), and `updateOrderLine()` already owns "change an
existing line's quantity" unambiguously. Unlike `updateOrderLine()`,
adding a line can only ever grow the total, so a credit-sale BC's limit
is unconditionally re-checked rather than only on growth.

**Why none of the three (cancel/update/add) exist for an already-invoiced
BC/BL** — this is where GCOM's "no cancelling once an invoice exists" rule
(see Known Gaps, §11) applies just as much to line-level edits as to the
whole document: an issued invoice is a fiscal snapshot, not a draft.
Needing to add an item after invoicing means creating a **new** BC/Facture
for that item, not reopening the old one — see §11 for the worked example
of why, and what to do instead.

**Avoir (`GcomCreditNoteService::createCreditNote()`, new)** — for
documents that already have an invoice. This is the first mechanism
anywhere in the codebase that makes a `CreditNote` actually reduce
`Invoice.remaining_amount`: the pre-existing `CreditNoteService`
(POS/exchange-flavored) only offset **new** orders at checkout and fed
`ExposureCalculator` as a risk input — it never touched an existing
invoice's debt.

- Validates the credited `amount` against the invoice's **`total_amount`**,
  not `remaining_amount`. A `remaining_amount` ceiling would make it
  impossible to credit an already-fully-paid cash-sale invoice — the single
  most common real "return after a till sale" scenario — since
  `remaining_amount` is already `0` at creation for cash/card sales.
- The credited amount splits into `appliedToDebt = min(amount, remaining)`
  (reduces `Invoice.remaining_amount`, flips status to
  `fully_paid`/`partially_paid`) and `refundAmount = amount - appliedToDebt`
  (stored on `CreditNote.refund_amount` — money owed back to the partner,
  not a debt reduction).
- `items` present → also restocks via `StockService::restockForReturn()`
  and marks each `CreditNoteItem.is_restocked = true`.
- `items` omitted → pure financial correction (commercial gesture, billing
  error), no stock movement.
- No separate "cancel invoice" endpoint — a full-amount avoir (omit
  `amount`) **is** how a GCOM invoice gets cancelled after the fact,
  matching real accounting practice (a validated invoice is credited, never
  deleted).
- Auto-approved immediately (`CreditNoteStatus::APPROVED`) — GCOM has no
  derogation/approval workflow anywhere else either.

### 9bis. Returns architecture — 3 use cases, condition routing (2026-08-18)

Agreed and built with the UI team as a single coherent design across BC/BL/avoir:

**CAS 1 — return before invoicing (no avoir needed).** A BL is created,
the client refuses/returns part of it before the BL is ever converted.
`GcomDeliveryNoteService::reduceLineQuantity()` — see §8
(`POST /delivery-notes/{deliveryNote}/lines/{item}/return`) — reduces the
line's own quantity, restocks the returned amount immediately
(condition-aware, below), and recomputes the BL's `total_amount`.
`convertToInvoice()`/`InvoiceService::generateFromDeliveryNote()` already
read live `DeliveryNoteItem` quantities, not a snapshot taken at BL
creation — so a later conversion bills exactly the net quantity with
**zero changes needed on the invoicing side**. Strictly a reduction: the
returned quantity must be less than the line's current quantity — to
return an entire line/the whole BL, use the existing whole-BL
cancellation instead (only possible before invoicing either way).

**Persistence + printable bon de retour (2026-08-18)** — real gap
reported by the UI team: `reason`/`condition` reached `StockService::
restockForReturn()` from the start, but only ended up baked into
`StockMovement.notes` as freeform text — unreachable from any GET, and
unable to represent more than one return event on the same line (a line
can be returned more than once). Each `reduceLineQuantity()` call now
also writes a `DeliveryNoteReturn` row (`delivery_note_id`,
`delivery_note_item_id`, `product_id`, `quantity`, `condition`, `reason`
— the `ReturnReason` enum, see below — `stock_location`, `returned_by`,
`returned_at`), exposed via `GET /delivery-notes/{deliveryNote}/returns`
and printable one-per-row via
`GET /delivery-notes/{deliveryNote}/returns/{return}/pdf` (see §8) —
same `DocumentService`/`documents._layout` pipeline as BC/Devis/BL/
Facture. `reason` moved from free text to the same `App\Enums\
ReturnReason` enum `credit_note_items.return_reason` already declares
(`DEFECTIVE`, `DAMAGED`, `WRONG_ITEM`, `CHANGE_MIND`,
`NOT_AS_DESCRIBED`, `EXPIRED`, `CUSTOMER_REQUEST`, `DUPLICATE_ORDER`,
`OTHER`) — a breaking validation change, done for consistency across
return paths rather than leave CAS 1 as the one arbitrary-text outlier.
Note this doesn't yet extend to CAS 2/3: `GcomCreditNoteService` still
never populates `CreditNoteItem.return_reason` either (a pre-existing,
separate gap — flagged, not fixed here, since it wasn't part of what was
reported).

**CAS 2 — return after invoicing (avoir + restock).** Already covered
above — `POST /invoices/{id}/credit-notes` with `items` present.

**CAS 3 — pure financial avoir (no stock movement).** Already covered
above — `POST /invoices/{id}/credit-notes` with `items` omitted.

**Condition routing** — shared by CAS 1 and CAS 2's restock path, both
ultimately call `StockService::restockForReturn()`, which now accepts an
optional `condition` per item (`sellable` default, `damaged`, or
`technical` — omit entirely for the exact prior behavior, fully backward
compatible):

| `condition` | Destination | Sellable stock impact |
|---|---|---|
| `sellable` (default) | The warehouse's own aggregate stock — immediately available for sale | `available_quantity` increases |
| `damaged` | A dedicated `StorageLocationType::DAMAGED` location, auto-provisioned per warehouse on first use | **Untouched** — invisible to every normal stock-availability lookup |
| `technical` | A dedicated `StorageLocationType::QUARANTINE` location (SAV / expertise interne), auto-provisioned per warehouse on first use | **Untouched**, same as `damaged` |

Non-sellable stock is tracked under its OWN `Stock` row, keyed by the
destination location's `location_code` rather than the real warehouse
code (`Stock.storage_location_id` set to that location's id) — this is
what makes it invisible to `bulkStock()`/pricing/order-creation without
having to touch any of those call sites: they only ever query the real
warehouse code. Matches the pre-existing inter-location transfer guard
elsewhere in `StockService` (a `DAMAGED`-location product must pass
through `QUARANTINE`/`SCRAP` before it can become sellable again) — this
restock path only ever places non-sellable returns into `DAMAGED` or
`QUARANTINE`, never directly back into sellable stock.

For CAS 2, `condition` is per `items[]` entry
(`POST /invoices/{id}/credit-notes` — see §8) and is also recorded on
`CreditNoteItem`: `is_scrap = true` for `damaged`, and `stock_location`
set to wherever it actually landed (resolved via the same
`StockService::resolveConditionLocation()` the restock itself uses, so
the two can never disagree).

**Explicitly decided against**: reusing the legacy `BonRetour` system for
a dedicated physical "bon de retour" document — its final stock-writing
step calls methods that don't exist on the class it depends on
(`StockService::addStock()`/`writeOffStock()`, neither of which is
real), so it's not a working reference to extend. `CreditNote` +
`StockMovement` (already battle-tested, already covers CAS 2/3 in full)
is the system of record for GCOM returns; no separate return-document
entity was introduced.

---

## 10. Real Bugs Found Building This

Not assumed, not pre-existing knowledge — each found via a failing test
while building GCOM, then confirmed against the actual codebase.

1. **`StockService::deductForDirectSale()` read `$order->branch_code`**,
   which isn't a real column (`orders.branch_code` was dropped; ~35 call
   sites across the app still read it expecting a value). Every call to
   this method failed with a `NOT NULL` violation on
   `stock_movements.branch_code` — silently unnoticed because its only
   prior caller (`SubmitOrderDecision::deductVanStockIfDirectSale()`) is
   gated behind a flag that defaults off. Fixed with a minimal, scoped
   patch (`$order->branch?->code` fallback) — the other ~35 call sites are
   a separate, much larger pre-existing issue, flagged not fixed.

2. **`LetteringService::getPaymentLetteringSummary()` eager-loaded
   `letterings.order.invoice`** — `Order` has no singular `invoice()`
   relation, only `invoices()` (an order can have several, e.g.
   per-order-mode invoicing). `RelationNotFoundException` on every call.
   Never caught because this method was never reachable via any controller
   before `GcomPaymentController`. Fixed to the real relation name.

3. **`GcomContextResolver`'s cash-payment-term lookup was silently scoped
   by `PaymentTerm`'s `HasDataScoping` trait** (per-user data-rule
   allowlist) — the exact trap `CreditLimitConstraint::isCashTerm()` and
   `SubmitOrderDecision` already document and bypass elsewhere in this
   codebase, just not copied into the new GCOM code on the first pass.
   A real GCOM user without explicit payment-term allowlisting would have
   gotten `"No cash payment term configured"` on every cash/card sale
   despite one existing. Fixed with `withoutGlobalScopes()`.

4. Earlier in the same session, building the underlying Facture
   Directe/Comptoir slice: `InvoiceService::createFromPosOrder()`'s credit-
   state recalculation gap (found and fixed 2026-08-11, see
   `docs/modules/08-payment-credit.md`) — confirmed via test that it fires
   correctly for GCOM-originated invoices too, not just POS/SFA.

5. **`CreditNote::generateNumber()` called `DocumentNumberingService` with
   document type `'AVOIR'`**, which was never a recognized code —
   `legacySeriesColumnsForDocumentType()` only maps `AVR`/`CN`/
   `CREDIT_NOTE`. This method has thrown `CriticalConfigurationException`
   for every caller in the codebase's history, including the pre-existing,
   never-exercised `CreditNoteService` — nothing had ever hit this path
   before `GcomCreditNoteService`'s tests. Fixed: `'AVOIR'` → `'AVR'`.

6. **No seeded `TokenSerie` template ever populated
   `credit_note_prefix`/`credit_note_next_number`** — not the `TV01`
   migration, not any of the `FD97`/`FD98`/`FD99`/`ERP` rows in
   `TokenSerieSeeder`. Only `TokenSerie::autoGenerate()` (per-branch/device
   series) sets it. Combined with bug #5, credit notes had **never** been
   issuable anywhere in this codebase, on any channel. Fixed with a new
   backfill migration
   (`2026_08_14_120000_backfill_missing_credit_note_token_series_prefix.php`)
   that derives `{prefix}{code}` for any series missing it, matching
   `autoGenerate()`'s own convention (guarantees uniqueness since `code` is
   unique) — applied to both the test DB and the dev DB.

7. **`GcomCreditNoteService` used `Invoice->loadMissing('order', ...)`**,
   but `GcomCreditNoteController::store()`'s 404 guard had already called
   `$invoice->loadMissing('order:id,canal')` — a narrow column select.
   `loadMissing()` treats an already-loaded relation as satisfied and skips
   reloading it, so the service saw an `Order` with only `id`/`canal`
   populated and everything else (`branch_id` included) `null` — surfaced
   as "No central warehouse configured for order N's branch," but only
   through the HTTP layer (`GcomCancellationAndCreditNoteTest`'s direct
   service-call tests never hit this, since they pass a fully-loaded
   `Invoice`). Fixed by switching the service to `load()` (unconditional
   reload) instead of `loadMissing()`.

8. **`GcomOrderBuilder::build()` never set `orders.tax_amount`** — stayed
   at its 0 default for every GCOM order. `sub_total`/`total_amount` were
   always correct (computed the same way), so it looked fine on any
   already-invoiced order, because `InvoiceService` incidentally
   back-filled the order's `tax_amount` as a side effect of invoice
   creation. Any BC or BL still *awaiting* invoicing showed the right HT
   and TTC but VAT stuck at `0` on every consultation response — found
   2026-08-15 while reviewing those responses for the UI handoff. Fixed by
   computing it the same way `sub_total` already is (from
   `GcomPricingCalculator`'s line totals, excluding stamp duty).
   Separately, `delivery_notes` has no `sub_total`/`tax_amount` columns in
   the schema at all — `GcomDeliveryNoteController` now proxies both from
   the BL's underlying order onto the response instead (see §8).

---

## 11. Known Gaps — Deliberately Deferred

Resolved since the initial build (kept here, struck through, so the
history is traceable rather than silently vanishing from the doc):

- ~~`sales.mode` company-scoped switch.~~ **Built 2026-08-14**, consuming
  side wired **2026-08-15** — `companies.sales_mode` (`GCOM`/`SFA`/
  `HYBRID`) + `GET`/`PUT /api/backend/companies/{company}/sales-mode` for
  managing it, and `POST /api/backend/login`'s response now includes
  `user.company.sales_mode` + `user.can.access_gcom` directly — no second
  call needed at bootstrap. See §14.
- ~~No PDF generation wired for GCOM invoices.~~ **Built 2026-08-14** —
  `GET /invoices/{invoice}/pdf`, see §8.
- ~~No avoir/credit-note or order/BL/invoice cancellation flow.~~ **Built
  2026-08-14** — see §9.
- ~~No partial-BC-line cancellation.~~ **Built 2026-08-14** —
  `GcomOrderService::cancelOrderLine()`, see §8/§9.
- ~~No way to increase a BC line's quantity (only reduce/remove).~~
  **Built 2026-08-15** — `GcomOrderService::updateOrderLine()`,
  `PATCH /orders/{order}/lines/{orderProduct}`, see §8/§9.
- ~~No way to add a brand-new product line to an existing BC.~~ **Built
  2026-08-15** — `GcomOrderService::addOrderLine()`,
  `POST /orders/{order}/lines`, see §8/§9.
- ~~`payment_transfers`/`letterings` were only ever populated by a later
  règlement — a comptoir cash/cheque sale left both empty.~~ **Fixed
  2026-08-15** — real gap reported by the UI team. See §4/§6/§7
  ("Treasury unification") — `GcomInstrumentRegistrar::recordSettlement()`.
- ~~No way to list a partner's pending cheques/effets, no debit/credit
  statement, no chronological account ledger.~~ **Built 2026-08-16**
  (requested by the UI team) — `GcomPartnerFinanceController`, see §6/§8.
- ~~`POST /payments` rejected every payment term genuinely attached to a
  real partner.~~ **Fixed 2026-08-16** — real bug reported by the UI team
  (règlement screen unusable for any of the 3 ORBIS test partners,
  regardless of which of their real terms was picked). Root causes: (1)
  `payment_terms.payment_method_id` was missing from `PaymentTerm::
  $fillable`, so every attempt to set it was silently dropped — including
  `GcomDatabaseSeeder`'s own; (2) `PaymentTransferService::
  registerPayment()` never fell back to
  `partner_financial_profiles.default_payment_method_id`, the actual
  source of truth for credit-type terms per this codebase's own
  documented architecture (`database/sql/04_partenaires_commerciaux.sql`);
  (3) `PaymentTerm::find()` was scoped (`HasDataScoping`+
  `BelongsToCompany`), same trap already fixed once on
  `GcomContextResolver::resolvePaymentTermId()` for the same model. See
  §8 for the full resolution order and `tests/Feature/Payment/
  PaymentTransferMethodResolutionTest.php`.
- ~~`POST /payments` had no `payment_method_id`/`instrument` fields at
  all — a cheque/effet received at DEFERRED règlement time (weeks after
  the original credit sale) never got any bank-clearing lifecycle
  tracking, only a plain `payment_transfers` row.~~ **Built 2026-08-17**
  (UI team confirmed this was needed, no per-partner method restriction
  needed) — `GcomInstrumentRegistrar::registerForPaymentTransfer()`,
  linked via `financial_instruments.payment_transfer_id` rather than
  `invoice_id` (a règlement can letter across several invoices). See §8.
- ~~No PDF for BC (`GET /orders/{order}/pdf`), Devis
  (`GET /quotes/{id}/pdf`), or BL (`GET /delivery-notes/{deliveryNote}/pdf`)
  — only the invoice had one.~~ **Built 2026-08-17.** BC and BL needed no
  new template work at all — `App\Services\DocumentService` +
  `App\Documents\DocumentDataResolver` (a second, already-generic
  document pipeline, separate from `InvoiceDocumentService`, already
  exposed for other channels via `Backend\DocumentController` at
  `/api/backend/documents/{bc,bl}/{id}`) already had full resolver cases
  and Blade templates (`documents/bc.blade.php`, `documents/bl.blade.php`)
  for both — this just wires the existing pipeline into GCOM's own routes
  with the usual `canal !== 'GCOM'` → 404 guard, same pattern as the
  invoice PDF. Devis was the one genuinely missing piece — no document
  type anywhere rendered a Quote before this — added `resolveDevis()` +
  `documents/devis.blade.php`, modeled closely on the BC resolver/template.
  Also fixed a real dormant bug found while touching `resolveBc()`: the
  commercial's name was stored under the key `'preSelling'`, but
  `bc.blade.php` reads `$data['sales_rep']` — silently blank on every BC
  PDF ever generated, in both the info box and the signature line.
  These templates (logo/letterhead, colored branded header, status badge,
  bordered totals box, dashed notes block, two-column signature grid with
  "Signature & Cachet" lines, legal footer with Capital social/RC/IF/ICE,
  watermark support) are considerably more polished than the invoice's own
  `documents.invoice_v1` template — ~~worth considering migrating the
  invoice PDF onto the same `documents._layout` family for visual
  consistency across the whole GCOM document set, but that's a separate,
  deliberately-not-done-here change (the invoice PDF already works and
  wasn't reported broken)~~. **Done — see below.**
- ~~`price_mode` had no effect on the invoice PDF (BC/Devis/BL got the
  toggle, the invoice didn't), and the invoice PDF's design didn't match
  BC/Devis/BL (older, plainer `documents.invoice_v1` template — no logo,
  no detailed line table, no signature block).~~ **Built 2026-08-18** —
  real gaps reported by the UI team (evidence: a `pdftotext` diff across 3
  live invoices proving `price_mode` was a total no-op, and a side-by-side
  text-extract comparison against a BC for the same client/product showing
  the layout gap) while wiring a shared "Imprimer" (HT/TTC) button across
  all 4 GCOM screens. Both closed in one move: `GcomInvoiceController::
  pdf()` now calls the same `DocumentService`/`DocumentDataResolver`
  pipeline as BC/Devis/BL (type `'invoice'`) instead of the older
  `InvoiceDocumentService` — new `DocumentDataResolver::resolveInvoice()`
  + `documents/invoice.blade.php` (extends `documents._layout`, same as
  the other three). `InvoiceDocumentService` itself is untouched —
  `Backend\OrderController` and `POS\PosOrderController` still depend on
  it and neither was reported broken. `price_mode` defaults to `ttc`
  (this endpoint's own pre-existing convention) when omitted, so no
  existing caller's output changes unless it opts in.
- ~~No way to print a document HT or TTC — some clients need the
  tax-excluded figure for their own accounting, others need the final
  tax-included one.~~ **Built 2026-08-17** — `?price_mode=ht|ttc` on all
  three new PDF endpoints (§8). Each document keeps its own prior default
  when the param is omitted (BC/Devis: `ht`, BL: `ttc`) — fully backward
  compatible, existing bookmarked/embedded PDF links keep behaving exactly
  as before. Real caching bug found and fixed while wiring this: the PDF
  cache was keyed on document type+id **only** — a `?price_mode=ttc`
  request right after the default one would have silently been served the
  stale HT bytes back. `DocumentService::storagePath()` now folds every
  render-affecting option (`price_mode`, `show_prices`, `watermark`) into
  the cache path itself, and is now `public` so
  `DocumentController::url()` — which used to hardcode its own
  independent copy of the same path logic — calls it instead rather than
  risking the two drifting apart again.
- ~~No way to reduce a BL line's quantity before invoicing (partial return
  at delivery, no avoir should be needed since no invoice exists yet), and
  no condition/destination targeting on any restock (everything always
  went back to sellable stock at the central warehouse, no way to route
  damaged/technical returns elsewhere).~~ **Built 2026-08-18** — full plan
  agreed with the UI team first (§9bis has the complete design):
  `GcomDeliveryNoteService::reduceLineQuantity()` for CAS 1,
  `StockService::restockForReturn()` extended with a per-item `condition`
  (shared by CAS 1 and the existing CAS 2 avoir restock), routing
  `damaged`/`technical` returns into dedicated `DAMAGED`/`QUARANTINE`
  `StorageLocation`s instead of sellable stock. Explicitly decided
  **against** reviving the legacy `BonRetour` system for this (its final
  stock-writing step calls methods that don't exist on the class it
  depends on) — `CreditNote` + `StockMovement` remains the system of
  record.
- ~~Seeded GCOM products never had `is_active` set, hidden from any
  "active only" consumer despite `Product::updateOrCreate()` otherwise
  succeeding.~~ **Fixed 2026-08-17** — GCOM's own order-creation paths
  never filter by `is_active` (`findOrFail` only), so this stayed
  unnoticed until `GET /telesales/catalog/products` (reused by GCOM,
  which does filter) returned zero products for reasons that had nothing
  to do with `company_id`/partner scoping.
- ~~`GET /telesales/catalog/products`'s `stock_available` was silently
  always `0` for GCOM stock once a warehouse had any storage location
  configured.~~ **Fixed 2026-08-17** — see the product-picker section in
  §14 for the full explanation (SFA vs. GCOM stock-recording convention
  mismatch).
- ~~`GcomDirectInvoiceService::convertOrderToInvoice()` and
  `convertDeliveryNoteToInvoice()` read `order.payment_method` (the
  Attribute accessor), which always returns `null` for a GCOM order — it
  casts through the legacy `PaymentMethod` enum (`CASH='Cash Payment'`
  etc.), and GCOM's own lowercase vocabulary (`'cash'`, `'credit'`, ...)
  never matches any case. Both silently fell back to `'cash'`
  unconditionally.~~ **Fixed 2026-08-15**, found investigating the
  `payment_transfers`/`financial_instruments`-always-empty report above.
  Impact was **worse than empty tables**: on the BL→Facture path
  specifically, `convertDeliveryNoteToInvoice()` used this value to decide
  whether to force-close the invoice — meaning **every genuine credit-sale
  invoice converted via BC→BL→Facture (or BL Direct→Facture) was being
  silently marked `fully_paid`** instead of staying `pending`, losing its
  credit exposure. `convertOrderToInvoice()` (BC→Facture, skips BL) wasn't
  affected the same way — `InvoiceService::createFromPosOrder()` decides
  paid/pending from `order.is_credit_sale` (a real column), not this
  accessor — so only its `financial_instruments` registration was broken
  there, not the invoice status. Both now read
  `order.financialMetadata?->payment_method` directly, matching the
  pattern already established in `GcomOrderService` for the same accessor
  bug. See `tests/Feature/Gcom/GcomTreasuryUnificationTest.php ::
  credit_sale_via_bl_stays_pending_not_paid` for the regression test.
- ~~`convert-to-bl`'s `delivery_date`/`payment_method` body fields were
  silently accepted and ignored.~~ **Fixed 2026-08-15** — real bug
  reported by the UI team, confirmed live against order 15 (both fields
  sent, neither had any effect: the BL got the request's real creation
  timestamp, the order kept its original payment method). Neither field
  existed in the controller's validation at all — anything sent there was
  simply never read. Now wired through to
  `GcomDeliveryNoteService::createDeliveryNoteFromOrder()`, including the
  stamp-duty recalculation and credit re-check a payment-method change
  requires. See §8.
- ~~`order.products[].pivot.id` didn't actually exist on any GCOM order
  response.~~ **Fixed 2026-08-15** — found by the UI team wiring the
  line-cancel button: `Order::products()`'s `withPivot([...])` never
  listed `id`, so Laravel never hydrated it on `POST /orders`, `GET
  /orders/{order}`, or the cancel-line/update-line responses. The doc's
  own §14 gotcha note was itself wrong (claimed `GET` used a different,
  flat shape) — never actually verified against a live response. One
  real `pivot.id` now, same shape everywhere. See §14.
- ~~`role:admin|root` gating, not a dedicated permission.~~ **Narrowed
  2026-08-14** — `permission:manage-gcom` (see banner at the top of this
  doc). Still only granted to `root`/`admin` by the seeder; create and
  grant a narrower role when real GCOM back-office users need it (§14 has
  the exact API calls to do this).
- ~~No printable document for a CAS 1 partial return (bon de retour) —
  BC/Devis/BL/Facture all had PDFs, a physical return had none, and
  nothing about the return (reason/condition/date) was persisted anywhere
  queryable, only buried as freeform text in `StockMovement.notes`.~~
  **Built 2026-08-18** — real gap reported by the UI team while wiring
  the CAS 1 return flow, who correctly noted §9bis's design choice (no
  dedicated `BonRetour` entity, `CreditNote`+`StockMovement` as the system
  of record) doesn't by itself give a physical return anything to sign —
  see §9bis and §8 for the full design (new `DeliveryNoteReturn` event
  table + `GET .../returns` + `GET .../returns/{return}/pdf`, `reason`
  moved to the shared `ReturnReason` enum). Deliberately still no
  dedicated entity/workflow — this only adds a queryable record + a
  printable view of data that already existed in principle.

Still open:

- **Setup/Bootstrap payload conditioning** (skip `device_parameters`/
  `sync_settings`/`geofence_rules` for GCOM-only tenants) — likely moot in
  practice since GCOM and SFA are already on fully separate route surfaces
  (a GCOM client simply never calls the SFA sync/bootstrap endpoint), but
  not formally confirmed.
- **No cancelling — or editing — a BC/BL once an invoice exists.** No
  add-line/update-line/cancel-line endpoint reaches an invoiced document,
  by design: an issued invoice is a fiscal snapshot, not something that
  gets silently rewritten after the fact (matches real accounting practice
  — a validated invoice is credited, never un-issued). Worked example:
  Facture `FAC-2026-00042` is issued for 10× product A. The client then
  asks for 3× product B on top.
  - **Wrong**: looking for a "add line to invoice" endpoint — none exists,
    and none should; it would mean silently changing a number that may
    already be printed/sent/reported.
  - **Right**: create a **new** BC (`POST /orders`) for the 3× product B,
    then convert it to its own invoice the normal way (§3). The client
    ends up with two invoices instead of one amended invoice — this is
    the expected, correct outcome, not a workaround.
  - If the original 10× product A was wrong (not just "needs more added")
    — e.g. wrong quantity or wrong product entirely — that's a correction,
    not an addition: issue an avoir against `FAC-2026-00042` for the
    incorrect part (§9), then create a fresh, correct BC/Facture.
- **Origin-document tracking is relational, not a stored polymorphic
  field.** Works today (see §2) but requires a join to walk backward from
  an invoice to its quote. Revisit only if a single-query "full document
  history" view is actually needed.
- **No dedicated Inventaire/Purchase-Reception UI-facing docs in this
  file** — those are generic (not GCOM-scoped) backend features, not
  documented here; see `app/Http/Controllers/Backend/
  InventoryCheckController.php` and `PurchaseReceptionController.php`
  directly if a GCOM screen needs to trigger a stock count or receipt.

---

## 12. Testing

| File | Covers |
|---|---|
| `tests/Feature/Gcom/GcomDirectInvoiceServiceTest.php` | Facture Directe (#6), Devis→Facture (#2), credit sales, cheque/effet instruments |
| `tests/Feature/Gcom/GcomDirectInvoiceControllerTest.php` | HTTP layer for the above |
| `tests/Feature/Gcom/GcomPaymentControllerTest.php` | Règlement/lettrage (#7/#8) |
| `tests/Feature/Gcom/GcomFlexibleDocumentFlowTest.php` | BC/BL flows (#1, #3, #4, #5) — the stock-deduction-timing invariant, credit checks at BC creation, Devis→BC |
| `tests/Feature/Gcom/GcomFlexibleDocumentControllerTest.php` | HTTP layer for BC/BL flows |
| `tests/Feature/Gcom/GcomConsultationEndpointsTest.php` | List/show endpoints — GET /orders, /delivery-notes, /invoices, /payments, canal/partner scoping, cross-tenant 404s |
| `tests/Feature/Gcom/GcomAdminCanUseTelesalesCatalogTest.php` | GCOM reuse of `GET /telesales/catalog/products` — partner-aware pricing, permission gate, and `stock_available` correctly found under the bare warehouse code even when a storage location exists for that warehouse |
| `tests/Feature/Gcom/GcomCancellationAndCreditNoteTest.php` | §9 — BC/BL cancellation + restocking, full/partial avoir, the total_amount-vs-remaining_amount split (refund_amount path), HTTP layer for cancel + credit-note endpoints |
| `tests/Feature/Gcom/GcomReturnsConditionTest.php` | §9bis — CAS 1 (BL partial return pre-invoice, net billing on convert), condition routing (sellable/damaged/technical → available/DAMAGED/QUARANTINE) shared by BL returns and credit-note restocks, guards (already invoiced, whole-line removal rejected, invalid `reason`), `CreditNoteItem.is_scrap`/`stock_location`, `DeliveryNoteReturn` persistence + `GET .../returns` + bon de retour PDF + cross-BL 404 (2026-08-18), HTTP layer |
| `tests/Feature/Gcom/GcomOrderLineCancellationTest.php` | Partial/full single-line BC cancellation, order-total recomputation, HTTP layer |
| `tests/Feature/Gcom/GcomOrderLineUpdateTest.php` | BC line quantity increase/decrease, re-pricing, stock untouched, credit re-check on increase only, HTTP layer |
| `tests/Feature/Gcom/GcomOrderLineAdditionTest.php` | Adding a new product line to an existing BC, rejects duplicate product, stock untouched, credit re-check, HTTP layer |
| `tests/Feature/Gcom/GcomConvertToBlOptionsTest.php` | `convert-to-bl`'s `delivery_date`/`payment_method` body — explicit date honored, defaults, stamp-duty recalculation both directions, credit re-check on switching to a non-immediate method, `is_credit_sale`/`payment_term_id` re-sync, HTTP layer |
| `tests/Feature/Gcom/GcomTreasuryUnificationTest.php` | Treasury unification (§4/§6/§7) — `payment_transfers`+`letterings` created for cash/card/cheque comptoir sales and BC→Facture/BL→Facture immediate settlements, none created for credit sales, cheque gets both a `FinancialInstrument` and a `payment_transfers` row, and the credit-sale-via-BL-was-wrongly-fully_paid regression |
| `tests/Feature/Gcom/GcomInvoiceDetailPaymentInfoTest.php` | `GET /invoices/{invoice}`'s `payments`/`financial_instrument` fields — cash/cheque comptoir, empty for an unsettled credit invoice, populated once a deferred règlement lands |
| `tests/Feature/Gcom/GcomPartnerFinanceControllerTest.php` | `GET /partners/{partner}/{financial-instruments,statement,ledger}` — instrument filtering + cross-partner isolation, statement debit/credit/balance/pending-instruments/credit-limit for cash and mixed credit+cheque scenarios, ledger entry types + running balance including a deferred règlement and an avoir |
| `tests/Feature/Gcom/GcomDeferredChequeSettlementTest.php` | `POST /payments`'s `payment_method_id`/`instrument` fields — a deferred cheque/effet creates a `FinancialInstrument` linked via `payment_transfer_id` (not `invoice_id`), rejects a cheque with no instrument details, an explicit `payment_method_id` overrides the term's default |
| `tests/Feature/Gcom/GcomInvoicePdfTest.php` | `GET /invoices/{invoice}/pdf` — real PDF bytes returned, correct `Content-Type`, 404 for non-GCOM invoices, HT vs. TTC renders differ and cache separately (2026-08-18, migration onto the BC/Devis/BL pipeline) |
| `tests/Feature/Gcom/GcomDocumentPdfTest.php` | `GET /orders/{order}/pdf`, `/delivery-notes/{deliveryNote}/pdf`, `/quotes/{id}/pdf` — real PDF bytes for BC/BL/Devis, 404 for non-GCOM BC/BL, 403 for someone else's Devis, HT vs. TTC renders differ and cache separately |
| `tests/Feature/CompanySalesModeTest.php` | `sales_mode` GET/PUT, default value, invalid-mode rejection, permission gate |
| `tests/Feature/Warehouse/InventoryCheckTest.php` | Generic (not GCOM-scoped) — inventaire lifecycle, included here since it shares `StockService`/`StockUpdateService` with GCOM |
| `tests/Feature/Warehouse/PurchaseReceptionValidationTest.php` | Generic — stock reception validate/reverse, same reason |
| `tests/Feature/MasterDataBanksTest.php` | Generic (not GCOM-scoped) — `GET /masterdata/banks`, active-only + name-ordered, feeds the `bank_id` picker `POST /gcom/payments` needs |
| `tests/Feature/Payment/PaymentTransferMethodResolutionTest.php` | Generic (not GCOM-scoped) — `PaymentTransferService::registerPayment()`'s `payment_method_id` resolution order: term's own, cash-term auto-resolve takes priority over the partner's generic default, partner default for credit terms, and the single consistent error when nothing resolves |

188 tests total across `tests/Feature/Gcom/` + `tests/Feature/Warehouse/` +
`tests/Feature/Payment/` + `tests/Feature/Partners/` +
`tests/Feature/CompanySalesModeTest.php` passing together as of this doc —
run all of these together when touching any GCOM shared service, since
several (`CreditControlEngine`, `StockService`, `StockUpdateService`,
`LetteringService`) are also exercised by Payment/Partners/Warehouse
tests.

---

## 13. Status & Enum Reference

These `status`/`bc_status` columns are shared with the rest of the ERP
(SFA, POS, télévendeur) and carry many values GCOM never produces — a
`GET /orders/{order}` response is *never* going to come back
`pending_derogation` or `in_preparation`, for example, since GCOM has no
derogation workflow and no picking/loading pipeline. Building status
badges/filters against the full underlying enum would add dead code paths
for states that can't occur on this API surface. The tables below list
**only the values GCOM's own code paths actually set** — treat anything
else as belonging to a different channel's data, not a state your GCOM UI
needs to handle.

### `order.bc_status` (BC / Devis-converted-to-BC)

| Value | Meaning | Set by |
|---|---|---|
| `confirmed` | The only "active" state — GCOM BCs are confirmed immediately on creation, never draft | `GcomOrderBuilder::build()` |
| `cancelled` | Cancelled before any BL/invoice existed (whole-order or last-line cancel) | `GcomOrderService::cancelOrder()`/`cancelOrderLine()` |

### `deliveryNote.status` (BL)

| Value | Meaning | Set by |
|---|---|---|
| `delivered` | The only "active" state — GCOM has no loading/transit pipeline; a BL is considered delivered the moment it's created | `GcomDeliveryNoteService` (both `createDeliveryNoteFromOrder()` and `createDirectDeliveryNote()`) |
| `cancelled` | Cancelled before an invoice existed (restocks) | `GcomDeliveryNoteService::cancelDeliveryNote()` |

### `invoice.status`

| Value | Meaning |
|---|---|
| `pending` | Credit/transfer sale, not yet settled — real encours |
| `partially_paid` | Some règlement/avoir applied, balance remains |
| `fully_paid` | Cash/card at creation, or cheque/effet (instrument registered), or fully settled by règlement/avoir since |
| `overdue` | `pending`/`partially_paid` past its due date (background job, not GCOM-specific) |

### `quote.status`

| Value | Meaning |
|---|---|
| `draft` | Just created |
| `sent` | Not used by any GCOM endpoint today (present for parity with the shared `Quote` model) |
| `accepted` | Not used by any GCOM endpoint today |
| `expired` | Past `expires_at`, not converted |
| `converted` | Converted to an Order (`convert-to-order`) or Invoice (`convert`) — `Quote.converted_order_id` set for the order case |

### `credit_note.status`

| Value | Meaning |
|---|---|
| `APPROVED` | The only value GCOM produces — every avoir is auto-approved immediately, no derogation workflow |

*(`DRAFT`/`PENDING`/`REJECTED`/`CANCELLED` exist on the shared enum but
are never set by any GCOM code path.)*

### `payment_method` (request field, not a DB enum)

| Value | Settlement behavior (§4) |
|---|---|
| `cash` | Immediate — `fully_paid`, stamp duty applied |
| `card` | Immediate — `fully_paid`, no stamp duty |
| `cheque` | Instrument — `fully_paid` + pending `FinancialInstrument`, `instrument` object required |
| `effet` | Instrument — same as cheque |
| `credit` | Credit — `pending`, opens real encours, `payment_term_id` required (or partner default) |
| `transfer` | Credit — same as `credit` |

### `company.sales_mode`

| Value | Meaning |
|---|---|
| `GCOM` | This company operates GCOM back-office only (stored flag — nothing enforces it yet, see §11) |
| `SFA` | Field-sales only |
| `HYBRID` | Both (the default for every company unless set otherwise) |

---

## 14. Frontend Integration Notes

### Headers

| Header | Required on | Value |
|---|---|---|
| `Authorization` | every request | `Bearer <sanctum-token>` |
| `Accept` | every request | `application/json` (the API also forces this server-side, but send it) |
| `Content-Type` | `POST`/`PUT` requests | `application/json` |
| `X-Idempotency-Key` | every route marked 🔁 in §8 | a fresh UUID **per logical action** — see below |

Obtaining the bearer token is outside GCOM's scope (standard Sanctum
login flow elsewhere in this API) — once you have it, every call below
just needs it attached.

### Login response — deciding whether to show GCOM at all

`POST /api/backend/login` (outside `/gcom/*`, the normal login endpoint —
`LoginController::getUserCompleteData()`) now returns, alongside the
existing `user.roles`/`user.permissions`/`user.branch` fields:

```json
{
  "success": true,
  "user": {
    "...": "...",
    "company": { "id": 2, "name": "ORBIS DISTRIBUTION", "code": "ORBIS", "sales_mode": "GCOM" },
    "can": { "...": "...", "access_gcom": true }
  }
}
```

This is everything the UI needs at bootstrap, in the login response
itself — no second call:
- `user.can.access_gcom` (boolean) — whether this user actually holds
  `manage-gcom`. Gate the whole GCOM menu section on this, not on
  `sales_mode` alone — a `HYBRID` company can still have GCOM-only users
  and vice versa.
- `user.company.sales_mode` (`GCOM`|`SFA`|`HYBRID`) — the company-level
  default. Use it to decide the *default* landing view/menu emphasis, not
  as an access-control check (that's what `can.access_gcom` is for).

### Product picker with real partner pricing (HT/TVA/TTC)

`GET /api/backend/products` (generic catalog browsing) deliberately does
**not** resolve price list / partner-specific pricing — that's not its
job. For "pick a partner, then show what they'd actually pay for each
product," use the existing télévendeur catalog endpoint instead of
anything under `/gcom/*`:

```
GET /api/backend/telesales/catalog/products?partner_id={id}&search=&per_page=20
```

Requires the `televendeur.view_products` permission (granted to
`root`/`admin` — same as `manage-gcom`, so any GCOM admin already has it).
Response per product:

```json
{
  "id": 42, "code": "ORBIS-HV1L", "name": "Huile Végétale 1L",
  "price": 22.5, "price_source": "partner",
  "price_list": { "id": 3, "code": "ORBIS_STD", "name": "ORBIS — Tarif standard" },
  "tax_rate": 20.0,
  "stock_available": 498.0,
  "packagings": [...], "flags": {...}
}
```

- `price_source` is `"partner"` when `partner_id` was given and a real
  override/price-list price resolved, `"generic"` otherwise (list price
  fallback) — use this to decide whether to show "prix standard" vs "prix
  négocié" in the UI.
- `price` is already TTC. `tax_rate` (%) is what you need to back out
  HT: `price_ht = price / (1 + tax_rate/100)`.
- `partner_id` is optional — omit it to browse the catalog before a
  partner is selected; the response shape doesn't change, only
  `price_source` flips to `"generic"`.
- This is the **same underlying pricing engine** (`PartnerProductPriceResolver`)
  every GCOM document (Devis/BC/BL/Facture) uses server-side — the price
  you show here is the price that endpoint will actually charge.

**`stock_available` was silently always `0` for GCOM stock — fixed
2026-08-17.** Real bug: this endpoint's stock lookup (shared with the SFA
télévendeur channel) preferred a warehouse's storage-location codes over
its own bare code whenever ANY active sellable/depot `StorageLocation` was
configured for that warehouse — correct for SFA's own convention, but
GCOM's stock (`StockService::deductForDirectSale()`, `GcomContextResolver`,
and manually-entered stock) is always written under the warehouse's bare
code, with no location granularity. If a warehouse happened to also have
a storage location configured for an unrelated WMS reason, every product's
real stock became invisible in this response. Now queries both the bare
warehouse code and any location codes — no client-side change needed,
`stock_available` just reflects real numbers now.

### Idempotency keys — how to generate them correctly

Every mutating GCOM endpoint (all `POST` routes) requires
`X-Idempotency-Key`. **Generate a new UUID per user action** (e.g., per
"Valider" button click), not once per app session and not once per
screen load. If the same key is replayed (e.g., a retried request after a
network timeout), the server returns the **original** response instead of
re-running the action — this is what makes "double-click on submit" or
"retry after timeout" safe. Reusing a key across genuinely different
actions (e.g., hardcoding one key for a whole session) will make the
second action silently return the first action's stale result.

### Response envelope

Every endpoint responds with a top-level `success: boolean`. On success,
the created/updated resource is under a **named** key matching the
resource type — never a generic `data`:

```json
{ "success": true, "message": "Invoice created", "invoice": { ... } }
```

List endpoints wrap results in Laravel's standard paginator shape, under
the resource's plural name:

```json
{
  "success": true,
  "orders": {
    "current_page": 1,
    "data": [ { "id": 1, "..." : "..." }, ... ],
    "per_page": 20,
    "total": 47,
    "last_page": 3,
    "next_page_url": "...?page=2",
    "prev_page_url": null
  }
}
```

### Status codes

| Code | Meaning | Body |
|---|---|---|
| `200` | Success (GET, or a mutation that doesn't create a new resource — e.g. cancel) | `{ success: true, ... }` |
| `201` | Success, a new resource was created (order/invoice/quote/BL/credit-note/payment) | `{ success: true, ... }` |
| `403` | Missing `manage-gcom` permission, or a quote belonging to a different user | Laravel's default 403 body (not the `{success:false}` shape) |
| `404` | Resource doesn't exist, **or** it exists but isn't a GCOM document (e.g. an SFA invoice ID passed to a GCOM endpoint — every `show`/`convert`/`cancel` endpoint checks `canal === 'GCOM'` and 404s otherwise, indistinguishable from a truly missing ID) | Laravel's default 404 body |
| `422` | Validation failure **or** a domain rule rejection (credit limit exceeded, wrong document state for the action, etc.) — same status code for both, distinguish by reading `message` | `{ success: false, message: "..." }` |
| `422` (idempotency) | `X-Idempotency-Key` missing on a 🔁 route | Idempotency middleware's own error body |

There is no `400` in normal use and no `500` in any tested path — a
`500` means a real bug, not a UI-side mistake to handle gracefully.

### `orderProduct` id gotcha (line cancel/update)

`POST /orders/{order}/lines/{orderProduct}/cancel` and
`PATCH /orders/{order}/lines/{orderProduct}` both need the `OrderProduct`
row's own `id` (not the product's id) as `{orderProduct}`.

**Real bug, fixed 2026-08-15**: this doc previously claimed `GET
/orders/{order}` exposed a flat `order.products[].id` for this — it
didn't. Every GCOM order response (`POST /orders`, `GET /orders/{order}`,
and the `order` object returned by the cancel-line/update-line endpoints
themselves) loads the same `products` belongs-to-many relation, and
`Order::products()`'s `withPivot([...])` never listed `id`, so Laravel
never hydrated it — `pivot.id` was `undefined` everywhere, not just on
one endpoint. One consistent shape now, everywhere:

```
order.products[].id        → the Product's own id (name, code, etc. live at this level)
order.products[].pivot.id  → the OrderProduct row's id — THIS is what {orderProduct} wants
```

### Practical integration order

If building GCOM screens from scratch, this is the dependency order that
avoids dead ends (mirrors the backend setup order in
`docs/modules/29-gcom-onboarding-orbis-distribution.md`):

1. Partner picker (needs `GET /masterdata/partners` or similar — outside
   GCOM's own routes, see the main partner CRUD docs).
2. Product picker (same — outside GCOM's own routes).
3. Comptoir screen → `POST /direct-invoices` (flow #6) — the simplest
   flow, good first integration target, exercises pricing/stock/credit/
   stamp-duty all at once.
4. BC screen → `POST /orders`, `GET /orders`, `GET /orders/{order}`.
5. BC → BL/Facture conversion buttons → `convert-to-bl`/`convert-to-invoice`.
6. Devis screen → `POST /quotes` + its two convert endpoints.
7. Règlement screen → `GET /partners/{partner}/open-invoices` +
   `POST /payments`.
8. Cancellation/avoir actions layered onto the BC/BL/Invoice detail
   screens once the create/convert flows work.

---

## 15. Getting a Test Tenant — GcomDatabaseSeeder

For frontend development against a real, working GCOM dataset without
touching production/shared demo data:

```bash
php artisan db:seed --class=GcomDatabaseSeeder
```

Provisions an isolated company (**ORBIS DISTRIBUTION**, `sales_mode=GCOM`)
with everything needed to hit every endpoint in §8 immediately:

- 1 branch + central warehouse (`ORBIS-CAS`)
- A working token series (document numbering)
- Payment terms: cash + two credit terms (30j, 60j fin de mois)
- An admin user: `admin@orbis.ma` / `orbis2026` — has `manage-gcom`
- 3 products with stock in the central warehouse
- 3 B2B partners, each with a fixed-price override on every product and a
  financial profile (credit limit) so credit sales work immediately

Idempotent — safe to re-run any time without creating duplicates or
resetting anything. Doesn't touch existing data outside its own rows
(`company_id`-scoped where the schema supports it — see the seeder's own
comments for the one caveat around `BelongsToCompany`'s auto-fill only
applying to authenticated-user contexts, not seeders).

Quick manual smoke test once seeded:
```bash
curl -X POST https://<host>/api/backend/gcom/direct-invoices \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $(uuidgen)" \
  -d '{"partner_id": <ORBIS-CLI-001 id>, "items": [{"product_id": <ORBIS-HV1L id>, "quantity": 2}], "payment_method": "cash"}'
```
Look up the actual partner/product ids first — `select id, code from
partners where company_id = (select id from companies where code =
'ORBIS');` and the equivalent for `products`.
