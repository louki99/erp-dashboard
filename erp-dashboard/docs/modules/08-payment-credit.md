# Payment & Credit — Complete Guide

> **Version**: Payment Domain V2 (2026-07)  
> **Services**: `CreditControlEngine`, `ExposureCalculator`, `PartnerCreditService`, `InvoiceService`, `PeriodAssignmentService`  
> **Config**: `config/payment_domain_v2.php`, `config/erp.php`

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Credit States](#2-credit-states)
3. [Credit Exposure Calculation](#3-credit-exposure-calculation)
4. [Payment Terms & Methods](#4-payment-terms--methods)
5. [Invoice Generation](#5-invoice-generation)
6. [Period Management](#6-period-management)
7. [Cash Reconciliation](#7-cash-reconciliation)
8. [Configuration Parameters](#8-configuration-parameters)
9. [API Endpoints](#9-api-endpoints)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Architecture Overview

### 1.1 Payment Domain V2

The payment domain uses a feature-flagged architecture with two parallel systems:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PAYMENT DOMAIN V2 PIPELINE                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────────┐     ┌──────────────────────┐                       │
│  │ CreditControl    │────▶│ ExposureCalculator   │                       │
│  │ Engine           │     │ (pure read)          │                       │
│  └────────┬─────────┘     └──────────────────────┘                       │
│           │                                                               │
│           ▼                                                               │
│  ┌──────────────────┐     ┌──────────────────────┐                       │
│  │ PartnerCredit    │     │ PartnerFinancial     │                       │
│  │ State (cached)   │     │ Profile              │                       │
│  └──────────────────┘     └──────────────────────┘                       │
│                                                                           │
│  ┌──────────────────┐     ┌──────────────────────┐                       │
│  │ PaymentOverride  │     │ PaymentSchedule      │                       │
│  │ Service          │     │ Calculator           │                       │
│  └──────────────────┘     └──────────────────────┘                       │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

**Feature flag:** `payment.domain_v2.enabled` (system_configurations table / `PAYMENT_DOMAIN_V2_ENABLED` env)

When **disabled**, legacy `CreditControlService` and `PaymentPolicyService` remain active.

### 1.2 Service Map

| Service | Namespace | Responsibility |
|---------|-----------|----------------|
| `CreditControlEngine` | `App\Domains\Payment\CreditControl\Services` | Evaluates order eligibility against credit |
| `ExposureCalculator` | `App\Domains\Payment\CreditControl\Services` | Pure-read exposure from all source tables |
| `CreditStateRecalculator` | `App\Domains\Payment\CreditControl\Services` | Batch recalculation of partner states |
| `PartnerCreditService` | `App\Services\B2B` | Legacy credit operations (increase/decrease) |
| `PaymentOverrideService` | `App\Domains\Payment\Override\Services` | Temporary credit overrides with approval |
| `PaymentScheduleCalculator` | `App\Domains\Payment\Schedule` | Payment term scheduling |
| `InvoiceService` | `App\Services` | BL → Invoice, POS → Invoice generation |
| `PeriodAssignmentService` | `App\Services` | Accounting period resolution |

### 1.3 Migration Strategy

```
1. Deploy with enabled=false (tables created, no behavior change)
2. Run data migration (populate partner_financial_profiles, partner_credit_states)
3. Enable in staging, validate
4. Enable in production
```

---

## 2. Credit States

### 2.1 Decision Algorithm

`CreditControlEngine::evaluateOrderEligibility(Partner, orderAmount)` follows this priority:

| Priority | Status | Condition |
|:---:|--------|-----------|
| 1 | **HARD_BLOCK** | Partner explicitly blocked (`PartnerFinancialProfile.blocked = true`) |
| 2 | **HARD_BLOCK** | Severe overdue (oldest_overdue_days > `severe_overdue_days` config) |
| 3 | **HARD_BLOCK** | Exposure + order > limit + tolerance (no room even with tolerance) |
| 4 | **SOFT_BLOCK** | Exposure + order > limit (within tolerance %) |
| 5 | **WARNING** | Exposure + order > 80% of limit |
| 6 | **ALLOWED** | Otherwise |

### 2.2 CreditDecision Value Object

Each evaluation returns a `CreditDecision` with:

```php
CreditDecision::hardBlock(
    reason: string,
    exposure: float,
    limit: float,
    excess: ?float,
    derogationAvailable: bool
);

CreditDecision::softBlock(
    reason: string,
    exposure: float,
    limit: float,
    requiresApproval: bool
);

CreditDecision::warning(
    reason: string,
    exposure: float,
    limit: float,
    usagePercent: float
);

CreditDecision::allowed(
    exposure: float,
    limit: float,
    available: float
);
```

### 2.3 Tolerance Mechanism

```
effectiveLimit = creditLimit + (creditLimit × over_credit_tolerance_pct / 100)
```

The tolerance percentage comes from `PartnerFinancialProfile.over_credit_tolerance_pct`. If exposure + order exceeds `creditLimit` but stays within `effectiveLimit`, the result is **SOFT_BLOCK** (requires approval).

### 2.4 Caching

Credit states are cached in Redis with key `credit_state:{partner_id}` and TTL of 60 seconds (configurable). Cache is invalidated on:
- Order confirmation (`RecalculateOnOrderConfirmed` listener)
- Payment received (`RecalculateOnPaymentReceived` listener)
- Manual recalculation via `CreditStateRecalculator`

---

## 3. Credit Exposure Calculation

### 3.1 Formula

```
Exposure = Open Invoices
         + Pending Cheques (PENDING | DEPOSITED)
         + Pending Effets (PENDING | DEPOSITED)
         + Confirmed Orders (not invoiced)
         + Delivered not Invoiced (BLs)
         - Validated Payments (unapplied)
         - Credit Notes (approved, remaining)
```

### 3.2 Source Tables

| Component | Table | Filter |
|-----------|-------|--------|
| Open Invoices | `invoices` | `status IN ('pending', 'partially_paid', 'overdue')` → `remaining_amount` |
| Pending Cheques | `financial_instruments` | `instrument_type = 'CHEQUE'`, `status IN ('PENDING', 'DEPOSITED')` |
| Pending Effets | `financial_instruments` | `instrument_type = 'EFFET'`, `status IN ('PENDING', 'DEPOSITED')` |
| Confirmed Orders | `orders` | `bc_status IN ('confirmed', 'approved', 'in_delivery')`, no invoice |
| Delivered not Invoiced | `delivery_notes` | `status = 'DELIVERED'`, `invoice_id IS NULL` |
| Validated Payments | `payment_transfers` | `status = 'validated'`, `remaining_amount > 0` |
| Credit Notes | `credit_notes` | `status = 'APPROVED'` → `total_amount - COALESCE(refund_amount, 0)` |

### 3.3 Credit Limit Resolution

Priority:
1. `PartnerFinancialProfile.credit_limit_amount` (V2, active profile where `effective_to IS NULL`)
2. `partners.credit_limit` (legacy fallback)

### 3.4 Debug Query — Full Exposure Breakdown

```sql
-- Get full exposure for a partner
SELECT
    p.id,
    p.code,
    p.name,
    p.credit_limit,
    COALESCE(inv.open_invoices, 0) AS open_invoices,
    COALESCE(chq.pending_cheques, 0) AS pending_cheques,
    COALESCE(eff.pending_effets, 0) AS pending_effets,
    COALESCE(ord.confirmed_orders, 0) AS confirmed_orders,
    COALESCE(bl.delivered_not_invoiced, 0) AS delivered_not_invoiced,
    COALESCE(pay.validated_payments, 0) AS validated_payments,
    (COALESCE(inv.open_invoices, 0) + COALESCE(chq.pending_cheques, 0) 
     + COALESCE(eff.pending_effets, 0) + COALESCE(ord.confirmed_orders, 0)
     + COALESCE(bl.delivered_not_invoiced, 0) - COALESCE(pay.validated_payments, 0)
    ) AS total_exposure
FROM partners p
LEFT JOIN LATERAL (
    SELECT SUM(remaining_amount) AS open_invoices
    FROM invoices WHERE partner_id = p.id AND status IN ('pending', 'partially_paid', 'overdue')
) inv ON true
LEFT JOIN LATERAL (
    SELECT SUM(amount) AS pending_cheques
    FROM financial_instruments WHERE partner_id = p.id AND instrument_type = 'CHEQUE' AND status IN ('PENDING', 'DEPOSITED')
) chq ON true
LEFT JOIN LATERAL (
    SELECT SUM(amount) AS pending_effets
    FROM financial_instruments WHERE partner_id = p.id AND instrument_type = 'EFFET' AND status IN ('PENDING', 'DEPOSITED')
) eff ON true
LEFT JOIN LATERAL (
    SELECT SUM(total_amount) AS confirmed_orders
    FROM orders WHERE partner_id = p.id AND bc_status IN ('confirmed', 'approved', 'in_delivery')
      AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.order_id = orders.id)
) ord ON true
LEFT JOIN LATERAL (
    SELECT SUM(total_amount) AS delivered_not_invoiced
    FROM delivery_notes WHERE partner_id = p.id AND status = 'DELIVERED' AND (invoice_id IS NULL OR invoice_id = 0)
) bl ON true
LEFT JOIN LATERAL (
    SELECT SUM(remaining_amount) AS validated_payments
    FROM payment_transfers WHERE partner_id = p.id AND status = 'validated' AND remaining_amount > 0
) pay ON true
WHERE p.id = :partner_id;
```

---

## 4. Payment Terms & Methods

### 4.1 Two Independent Dimensions

Payment in Omni360 is split into two orthogonal concepts:

```
PAYMENT = METHOD (HOW you pay) + TERM (WHEN you pay)
```

| Dimension | Table | Examples |
|---|---|---|
| **PaymentMethod** (HOW) | `payment_methods` | Cash (Espèces), Chèque, LCI/Effet, Virement, Carte |
| **PaymentTerm** (WHEN) | `payment_terms` | Comptant, NET30, NET60, Fin de Mois, Fin de Mois +30j |

**Example combinations:**
- Partner A: **CHEQUE + FIN_MOIS** → pays by cheque at end of month
- Partner B: **CASH + IMMEDIATE** → pays cash on delivery
- Partner C: **EFFET + NET60** → LCI due in 60 days
- Partner D: **50% CHEQUE FDM + 50% EFFET 60j** → split payment (uses term lines)

### 4.2 Payment Methods

Table: `payment_methods`

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint PK | |
| `code` | varchar(30) | Business key: CASH, CHEQUE, EFFET, VIREMENT, CARD |
| `name` | varchar | Display name |
| `type` | varchar | Category: cash, cheque, transfer, bill_of_exchange |
| `requires_reference` | boolean | Whether a reference number is needed (cheque #) |
| `requires_bank` | boolean | Whether bank selection is needed |
| `display_order` | int | Sort order in mobile app |
| `is_active` | boolean | Soft-disable flag |

**Visibility control:** `data_rules` with `model_type = 'App\Models\PaymentMethod'` controls which methods are visible per user/partner/role/profile/branch (same 5-level cascade as PaymentTerm).

### 4.3 Payment Terms

Table: `payment_terms`

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint PK | |
| `code` | varchar | Business key: IMMEDIATE, NET30, NET60, FIN_MOIS |
| `name` | varchar | Display label |
| `days_number` | int | Net days for payment |
| `is_credit` | boolean | Whether this is a credit term (affects exposure) |
| `is_cash` | boolean | Whether this is a cash term |
| `calculation_type` | varchar | `simple` or `installment` |
| `active` | boolean | |

### 4.4 Payment Term Lines (Installment Schedules)

Table: `payment_term_lines` — defines **split payment schedules** for complex terms.

| Column | Type | Description |
|--------|------|-------------|
| `payment_term_id` | FK | Parent term |
| `line_number` | int | Sequence (1, 2, 3...) |
| `percentage` | decimal | % of total due on this line |
| `days` | int | Days after invoice date |
| `day_of_month` | int nullable | Fixed day (for "fin de mois" logic: 31 = end of month) |
| `payment_method_id` | FK nullable | Specific method for this installment |

**Examples:**

| Term | Lines | Meaning |
|---|---|---|
| `NET30` (simple) | No lines needed | Full amount due in 30 days |
| `FIN_MOIS` | Line 1: days=0, day_of_month=31 | Due at end of current month |
| `FIN_MOIS_30` | Line 1: days=30, day_of_month=31 | Due at end of month + 30 days |
| `SPLIT_30_60` | Line 1: 50%, days=30 / Line 2: 50%, days=60 | Half in 30 days, half in 60 days |
| `CHQ_FDM_LCI_60` | Line 1: 50%, FDM, method=CHEQUE / Line 2: 50%, 60j, method=EFFET | Mixed method split |

### 4.5 Partner Payment Configuration

**Resolution priority for default term:**
```
partner_financial_profiles.default_payment_term_id  (V2 — highest priority)
  → partners.payment_term_id                        (legacy fallback)
```

**Resolution priority for default method:**
```
partner_financial_profiles.default_payment_method_id  (V2)
  → NULL (no legacy fallback for method)
```

**Extra selectable terms:** `partner_payment_terms` pivot table (many-to-many).

### 4.6 Configuration Examples (SQL)

#### Set Default Payment Method + Term for a Partner

```sql
-- Partner 55 pays by CHEQUE with FIN_MOIS (end of month) term
INSERT INTO partner_financial_profiles (partner_id, default_payment_method_id, default_payment_term_id, credit_limit_amount)
VALUES (
    55,
    (SELECT id FROM payment_methods WHERE code = 'CHEQUE'),
    (SELECT id FROM payment_terms WHERE code = 'FIN_MOIS'),
    50000.00
)
ON CONFLICT (partner_id) WHERE effective_to IS NULL
DO UPDATE SET
    default_payment_method_id = EXCLUDED.default_payment_method_id,
    default_payment_term_id = EXCLUDED.default_payment_term_id;
```

#### Restrict Which Methods a Partner Can Use (data_rules)

```sql
-- Partner 55 can ONLY use CHEQUE and ESPECES
-- Once concrete 'allow' rules exist, all other methods are blocked for this partner
INSERT INTO data_rules (model_type, model_id, scope_type, scope_value, action)
VALUES
  ('App\Models\PaymentMethod', (SELECT id FROM payment_methods WHERE code = 'CASH'), 'partner', '55', 'allow'),
  ('App\Models\PaymentMethod', (SELECT id FROM payment_methods WHERE code = 'CHEQUE'), 'partner', '55', 'allow');
```

#### Block a Specific Method for a Partner

```sql
-- Partner 100 cannot use VIREMENT (all other methods remain visible)
INSERT INTO data_rules (model_type, model_id, scope_type, scope_value, action)
VALUES ('App\Models\PaymentMethod', (SELECT id FROM payment_methods WHERE code = 'VIREMENT'), 'partner', '100', 'deny');
```

#### Set "Fin de Mois" for a Partner

```sql
-- Via financial profile (V2 — preferred)
UPDATE partner_financial_profiles
SET default_payment_term_id = (SELECT id FROM payment_terms WHERE code = 'FIN_MOIS')
WHERE partner_id = 55 AND effective_to IS NULL;

-- Or via legacy column (fallback)
UPDATE partners SET payment_term_id = (SELECT id FROM payment_terms WHERE code = 'FIN_MOIS') WHERE id = 55;
```

#### Allow Multiple Payment Terms for a Partner

```sql
-- Partner 55 can choose between IMMEDIATE, NET30, and FIN_MOIS
INSERT INTO partner_payment_terms (partner_id, payment_term_id, is_default)
VALUES
  (55, (SELECT id FROM payment_terms WHERE code = 'IMMEDIATE'), false),
  (55, (SELECT id FROM payment_terms WHERE code = 'NET30'), false),
  (55, (SELECT id FROM payment_terms WHERE code = 'FIN_MOIS'), true);  -- default

-- Enable extra terms selection in SFA
-- Set: sales.partner_extra_payment_terms.enabled = true
```

#### Create a Split Payment Term with Lines

```sql
-- Create term: 50% Chèque Fin de Mois + 50% LCI à 60 jours
INSERT INTO payment_terms (code, name, days_number, is_credit, is_cash, calculation_type, active)
VALUES ('CHQ_FDM_LCI_60', '50% Chèque FDM + 50% LCI 60j', 60, true, false, 'installment', true);

-- Create installment lines
INSERT INTO payment_term_lines (payment_term_id, line_number, percentage, days, day_of_month, payment_method_id)
VALUES
  ((SELECT id FROM payment_terms WHERE code = 'CHQ_FDM_LCI_60'), 1, 50, 0, 31,
   (SELECT id FROM payment_methods WHERE code = 'CHEQUE')),
  ((SELECT id FROM payment_terms WHERE code = 'CHQ_FDM_LCI_60'), 2, 50, 60, NULL,
   (SELECT id FROM payment_methods WHERE code = 'EFFET'));
```

#### Complete Partner Setup (Method + Term + Restrictions)

```sql
-- Full setup for Partner "Marjane Casablanca" (ID 55):
-- Pays 50% by chèque at end of month + 50% by LCI at 60 days
-- Can only use CHEQUE and EFFET methods

-- 1. Assign the split term
UPDATE partner_financial_profiles
SET default_payment_term_id = (SELECT id FROM payment_terms WHERE code = 'CHQ_FDM_LCI_60'),
    default_payment_method_id = (SELECT id FROM payment_methods WHERE code = 'CHEQUE')
WHERE partner_id = 55 AND effective_to IS NULL;

-- 2. Restrict allowed methods (only CHEQUE and EFFET)
INSERT INTO data_rules (model_type, model_id, scope_type, scope_value, action)
VALUES
  ('App\Models\PaymentMethod', (SELECT id FROM payment_methods WHERE code = 'CHEQUE'), 'partner', '55', 'allow'),
  ('App\Models\PaymentMethod', (SELECT id FROM payment_methods WHERE code = 'EFFET'), 'partner', '55', 'allow');
```

#### Query: Check a Partner's Payment Configuration

```sql
-- Full payment config for a partner
SELECT
    p.id, p.code, p.name,
    p.payment_term_id AS legacy_term_id,
    pt_legacy.code AS legacy_term_code,
    pfp.default_payment_method_id,
    pm.code AS default_method_code,
    pfp.default_payment_term_id,
    pt_v2.code AS v2_term_code,
    pfp.credit_limit_amount
FROM partners p
LEFT JOIN payment_terms pt_legacy ON pt_legacy.id = p.payment_term_id
LEFT JOIN partner_financial_profiles pfp ON pfp.partner_id = p.id AND pfp.effective_to IS NULL
LEFT JOIN payment_methods pm ON pm.id = pfp.default_payment_method_id
LEFT JOIN payment_terms pt_v2 ON pt_v2.id = pfp.default_payment_term_id
WHERE p.id = :partner_id;
```

#### Query: Check Allowed Payment Methods for a Partner

```sql
-- Which methods are allowed for partner 55 via data_rules?
SELECT pm.id, pm.code, pm.name, dr.action
FROM payment_methods pm
LEFT JOIN data_rules dr ON dr.model_type = 'App\Models\PaymentMethod'
    AND dr.model_id = pm.id
    AND dr.scope_type = 'partner'
    AND dr.scope_value = '55'
WHERE pm.is_active = true
ORDER BY pm.display_order;
```

#### Query: Check Payment Term Lines (Installment Schedule)

```sql
-- View installment schedule for a term
SELECT pt.code, pt.name, pt.calculation_type,
       ptl.line_number, ptl.percentage, ptl.days, ptl.day_of_month,
       pm.code AS method_code
FROM payment_terms pt
JOIN payment_term_lines ptl ON ptl.payment_term_id = pt.id
LEFT JOIN payment_methods pm ON pm.id = ptl.payment_method_id
WHERE pt.code = :term_code
ORDER BY ptl.line_number;
```

### 4.7 Enforcement Parameter

| Parameter | Values | Behavior |
|---|---|---|
| `sales.payment_method.enforced` | `OFF` | No validation — any method accepted |
| | `WARNING` | Order proceeds but warning returned |
| | `BLOCK` | Order rejected if method not allowed |

### 4.8 Financial Instruments

Table: `financial_instruments`

| Column | Role |
|--------|------|
| `partner_id` | FK |
| `instrument_type` | `CHEQUE`, `EFFET`, `CASH`, `TRANSFER` |
| `status` | `PENDING`, `DEPOSITED`, `CLEARED`, `RETURNED`, `CANCELLED` |
| `amount` | Face value |
| `due_date` | Maturity date (effets) |
| `reference` | Cheque/effet number |
| `currency` | Default `MAD` |

### 4.9 Payment Term Selection (Mobile)

`PartnerSelectablePaymentTermsService`:
- `optionsForPartner()` — returns selectable payment terms
- `selectableMethodsForPartner()` — returns selectable payment methods (user ∩ partner intersection)

If V2 enabled → uses `PaymentOverrideService` for temporary overrides.
Otherwise → resolves from partner's assigned terms + profile defaults.

### 4.10 Summary Table

| Concept | Table | Purpose |
|---|---|---|
| **Payment Method** | `payment_methods` | HOW to pay (Cash, Chèque, LCI, Virement) |
| **Payment Term** | `payment_terms` | WHEN to pay (Immediate, 30j, Fin de mois) |
| **Term Lines** | `payment_term_lines` | Installment schedule (split payments) |
| **Partner Default** | `partner_financial_profiles` | Default method + term per partner |
| **Partner Allowed Methods** | `data_rules` (scope=partner) | Which methods a partner can use |
| **Partner Extra Terms** | `partner_payment_terms` | Additional selectable terms |
| **Legacy Default** | `partners.payment_term_id` | Fallback when V2 is disabled |
| **Enforcement** | `sales.payment_method.enforced` | OFF / WARNING / BLOCK |

---

## 5. Invoice Generation

### 5.1 BL → Invoice (B2B Delivery)

`InvoiceService::createInvoiceFromDeliveryNote()`:

1. Creates `invoices` row from BL data (partner, amounts, period)
2. Copies `delivery_note_items` → `invoice_items`
3. Copies `order_promotion_details` → `invoice_promotion_details`
4. Updates partner credit: `PartnerCreditService::increaseCredit(partner, amount, order)`
5. Links BL to invoice (`delivery_notes.invoice_id`)

### 5.2 POS → Invoice

`PosCheckoutService` / `UnifiedCheckoutService`:

1. Creates order with `canal = 'POS'`
2. Applies promotions via `PromotionService::calculateOrderPromotions()`
3. Generates invoice immediately (POS = instant invoicing)
4. Handles payment collection (cash, card, deferred)
5. Updates credit if deferred payment

### 5.3 Invoice Numbering

Uses `DocumentNumberingService` with series-based tokens. Invoice codes follow pattern defined per branch/company.

### 5.4 VAT on Invoices

Tax columns on `order_products`: `tax_rate`, `unit_price_ht`, `line_tax_amount`, `line_total_ht`, `promo_*` fields.

Product VAT resolved from `product_vat_taxes` → `vat_taxes` pivot.

---

## 6. Period Management

### 6.1 Purpose

A **period** is a time bucket (default: calendar month, code `YYYYMM`) used for:
- Accounting / posting lock (`closed_at`)
- Reporting (sales, logistics KPIs, COD) grouped by `period_id`
- Workflow integrity: BC → DO → BP → BL → BCH → COD share consistent period rules

### 6.2 Schema

Table: `periods`

| Column | Role |
|--------|------|
| `code` | Stable business key (`202603`), human & API friendly |
| `name` | Display (e.g. `MARS 2026`) |
| `starts_on`, `ends_on` | Inclusive calendar bounds; drives auto-assignment |
| `is_active` | Exactly one "current" pointer (PostgreSQL partial unique index) |
| `closed_at`, `closed_by` | Immutable lock; `is_closed` = `closed_at !== null` |
| `working_days` | Optional cache; filled by job (holidays / branch calendar) |

**Partial unique index (PostgreSQL):**
```sql
CREATE UNIQUE INDEX idx_periods_single_active ON periods ((1)) WHERE is_active = true;
```

### 6.3 Business Rules

| Rule | Enforcement |
|------|-------------|
| Only one active period | `Period` model demotes others on save; partial unique index |
| Closed period → no mutations | `App\Traits\HasErpPeriod` + `ERP_PERIOD_ENFORCE_CLOSED` |
| Documents must have `period_id` | NOT NULL on BC, DO, BP, BL, BCH, COD, invoices, logistics_batches, warehouse_transfers |
| Auto assignment | Trait `creating`: open active period first, else calendar bucket |
| Cross-document consistency | All BCs in a DO same period; all DOs in one BCH same period |

### 6.4 Integrated Entities

| Code | Table | `period_id` |
|------|-------|:-----------:|
| BC | `orders` | ✓ |
| DO | `delivery_orders` | ✓ |
| BP | `preparation_orders` | ✓ |
| BL | `delivery_notes` | ✓ |
| BCH | `shipments` | ✓ |
| COD | `driver_cash_settlements` | ✓ |

### 6.5 Period Validation

```php
use App\Services\PeriodAssignmentService;
use App\Exceptions\PeriodClosedException;

$service = app(PeriodAssignmentService::class);

if ($period->isClosed()) {
    throw new PeriodClosedException('Period is closed');
}

$service->assertNotClosed($period);
```

**Bypass (migrations / repair only):**

```php
use App\Support\PeriodGuard;

PeriodGuard::whileBypassing(function () {
    // raw fixes
});
```

### 6.6 Period Configuration

`config/erp.php` → `period`:

| Key | Env | Values |
|-----|-----|--------|
| `default_strategy` | `ERP_PERIOD_DEFAULT_STRATEGY` | `active_then_date` \| `active_only` \| `date_only` |
| `enforce_closed` | `ERP_PERIOD_ENFORCE_CLOSED` | boolean |
| `immutable_period_id` | `ERP_PERIOD_IMMUTABLE_ID` | boolean |

### 6.7 Initialization

- **Migration:** `2026_03_20_120000_create_periods_table.php`
- **SQL seed:** `database/sql/00_periods.sql` — inserts 12 months for current year, idempotent `ON CONFLICT DO NOTHING`, sets `is_active` on current `YYYYMM`
- **PHPUnit:** `tests/TestCase.php` bootstraps months if `periods` is empty

---

## 7. Cash Reconciliation

### 7.1 Driver Cash Settlement (COD)

Table: `driver_cash_settlements`

Drivers collect cash on delivery. At end of shift:
1. Driver submits settlement with collected amounts
2. System compares expected (sum of BL cash payments) vs actual
3. Discrepancies flagged for review
4. Settlement linked to `period_id` for accounting

### 7.2 POS Session Settlement

`PosSession` tracks:
- Opening float
- Sales during session
- Payment method breakdown (cash, card, cheque)
- Closing count
- Variance (expected vs counted)

---

## 8. Configuration Parameters

### 8.1 System Configuration Keys

```sql
-- View all payment configuration
SELECT key, value, value_type, description
FROM system_configurations
WHERE key LIKE 'payment.%'
ORDER BY key;
```

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `payment.domain_v2.enabled` | boolean | `false` | Enable Payment Domain V2 |
| `payment.credit.warning_threshold_pct` | integer | `80` | % of limit that triggers WARNING |
| `payment.credit.severe_overdue_days` | integer | `30` | Days overdue before HARD_BLOCK |
| `payment.credit.cache_ttl_seconds` | integer | `60` | Redis cache TTL for credit states |
| `payment.credit.include_confirmed_orders` | boolean | `true` | Include confirmed orders in exposure |
| `payment.credit.include_delivered_not_invoiced` | boolean | `true` | Include delivered BLs in exposure |

### 8.2 Environment Variables

```env
PAYMENT_DOMAIN_V2_ENABLED=false
CREDIT_WARNING_THRESHOLD_PCT=80
CREDIT_SEVERE_OVERDUE_DAYS=30
CREDIT_CACHE_TTL=60
CREDIT_INCLUDE_ORDERS=true
CREDIT_INCLUDE_DELIVERED=true
PAYMENT_OVERRIDE_ESCALATION_DAYS=30
TREASURY_DEFAULT_CURRENCY=MAD
```

### 8.3 ERP Period Configuration

```env
ERP_PERIOD_DEFAULT_STRATEGY=active_then_date
ERP_PERIOD_ENFORCE_CLOSED=true
ERP_PERIOD_IMMUTABLE_ID=true
```

### 8.4 Override & Approval

| Config | Default | Description |
|--------|---------|-------------|
| `override.escalation_threshold_days` | `30` | Days extension that triggers approval workflow |
| `override.approval_roles` | `['chef_adv', 'admin']` | Roles that can approve payment overrides |

---

## 9. API Endpoints

### 9.1 Credit Control (Backend)

| Method | Endpoint | Controller | Description |
|--------|----------|------------|-------------|
| GET | `/api/credit-control/partners/{id}/state` | `CreditControlV2Controller` | Get credit state |
| GET | `/api/credit-control/partners/{id}/exposure` | `CreditControlV2Controller` | Full exposure breakdown |
| POST | `/api/credit-control/partners/{id}/evaluate` | `CreditControlV2Controller` | Evaluate order eligibility |
| POST | `/api/credit-control/recalculate` | `CreditControlV2Controller` | Batch recalculation |

### 9.2 Payment Terms (Mobile SFA)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/salesperson/partners/{id}/payment-terms` | Selectable payment terms for partner |

### 9.3 Invoices

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/invoices` | List invoices (filtered) |
| GET | `/api/invoices/{code}` | Invoice detail |
| POST | `/api/invoices/from-delivery-note` | Generate invoice from BL |

---

## 10. Troubleshooting

### 10.1 Partner Blocked — Why?

```sql
-- Check credit state
SELECT pcs.*, pfp.blocked, pfp.block_reason, pfp.over_credit_tolerance_pct
FROM partner_credit_states pcs
LEFT JOIN partner_financial_profiles pfp ON pfp.partner_id = pcs.partner_id AND pfp.effective_to IS NULL
WHERE pcs.partner_id = :partner_id;

-- Check overdue invoices
SELECT id, invoice_code, remaining_amount, due_date,
       CURRENT_DATE - due_date::date AS days_overdue
FROM invoices
WHERE partner_id = :partner_id
  AND status IN ('pending', 'partially_paid', 'overdue')
  AND due_date < CURRENT_DATE
ORDER BY due_date ASC;
```

### 10.2 Credit Exposure Mismatch

```sql
-- Compare cached state vs live calculation
SELECT 
    pcs.total_exposure AS cached_exposure,
    pcs.available_credit AS cached_available,
    pcs.updated_at AS cache_time,
    p.credit_limit AS partner_limit
FROM partner_credit_states pcs
JOIN partners p ON p.id = pcs.partner_id
WHERE pcs.partner_id = :partner_id;
```

Force recalculation:
```php
app(CreditStateRecalculator::class)->recalculateForPartner($partnerId);
```

### 10.3 Period Closed — Cannot Create Document

```sql
-- Check period status
SELECT code, name, starts_on, ends_on, is_active, closed_at, closed_by
FROM periods
WHERE is_active = true OR closed_at IS NULL
ORDER BY starts_on DESC;

-- Find documents stuck in closed period
SELECT 'orders' AS entity, COUNT(*) FROM orders WHERE period_id = :period_id
UNION ALL
SELECT 'delivery_notes', COUNT(*) FROM delivery_notes WHERE period_id = :period_id
UNION ALL
SELECT 'invoices', COUNT(*) FROM invoices WHERE period_id = :period_id;
```

### 10.4 Invoice Not Generated After Delivery

```sql
-- BLs delivered without invoice
SELECT dn.id, dn.delivery_note_code, dn.status, dn.total_amount, dn.invoice_id, dn.created_at
FROM delivery_notes dn
WHERE dn.partner_id = :partner_id
  AND dn.status = 'DELIVERED'
  AND (dn.invoice_id IS NULL OR dn.invoice_id = 0)
ORDER BY dn.created_at DESC;
```

### 10.5 Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Month boundary mismatch (BC date vs DO planned date) | Enforced "same period" rules on DO/BCH |
| Multi-company / multi-ledger | Add `company_id` to `periods` and scope uniqueness |
| Long-running documents across close | Close only after pipeline complete; or `PeriodGuard::whileBypassing` with audit |
| PostgreSQL-only partial unique index | On MySQL, enforce "single active" only in application code |

---

*Last aligned with Payment Domain V2 services and `config/payment_domain_v2.php` as of the FoodSolution repo state at authoring.*
