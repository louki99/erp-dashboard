# Pricing Engine — Complete Guide

> **Version**: Algorithm v5 (2026-07)  
> **Services**: `PriceResolverService`, `PartnerProductPriceResolver`, `TierPriceResolver`, `CurrencyRounder`  
> **Architecture**: Single unified engine (the legacy PL/pgSQL `get_effective_price_json()` is removed), single-table, single-query, zero-fallback for colisage products

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Database Schema](#2-database-schema)
3. [Resolution Algorithm (The 4-Level Hierarchy)](#3-resolution-algorithm-the-4-level-hierarchy)
4. [Configuration Parameters](#4-configuration-parameters)
5. [Feature: Volume-Based Tier Pricing (Paliers)](#5-feature-volume-based-tier-pricing-paliers)
6. [Feature: Partner Overrides & Channel Price Lists](#6-feature-partner-overrides--channel-price-lists)
7. [Feature: Price List Validity Enforcement](#7-feature-price-list-validity-enforcement)
8. [Feature: Currency Rounding (BCMath)](#8-feature-currency-rounding-bcmath)
9. [Colisage Products (has_colisage = true)](#9-colisage-products-has_colisage--true)
10. [Non-Colisage Products (has_colisage = false)](#10-non-colisage-products-has_colisage--false)
11. [Mobile Bootstrap Sync Payload](#11-mobile-bootstrap-sync-payload)
12. [Error Codes & Troubleshooting](#12-error-codes--troubleshooting)
13. [Quick Configuration Recipes](#13-quick-configuration-recipes)
14. [SQL Query Reference](#14-sql-query-reference)

---

## 1. Architecture Overview

### 1.1 Pricing Pipeline

The pricing module resolves unit prices for products through a multi-layer pipeline:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PRICING PIPELINE                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  1. PARTNER OVERRIDE (partner_price_overrides)                            │
│     Active row for (partner, product) → fixed_price per base unit         │
│     (× packaging qty) or discount on the resolved price                    │
│                                                                           │
│  1b. EFFECTIVE PRICE LIST                                                 │
│     partners.price_list_id, else channels.price_list_id (mass fallback)   │
│                                                                           │
│  2. TIER PRICING (pricing.tier_based.enabled)                            │
│     Quantity → product_pricing_tiers → tier_price (if match)             │
│                                                                           │
│  3. STANDARD 3-TIER HIERARCHY                                            │
│     Override → Standard → Linear fallback                                 │
│                                                                           │
│  4. CLAMPING                                                             │
│     min_sales_price <= price <= max_sales_price                           │
│                                                                           │
│  5. CURRENCY ROUNDING (pricing.currency_rounding)                        │
│     BCMath: round(price / step) * step                                   │
│                                                                           │
│  6. VALIDITY CHECK (pricing.validity_date_check)                         │
│     Order blocked if price list has no active line                        │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 System Component Diagram

```
┌──────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│ Mobile Client │────▶│  CatalogController   │────▶│ PartnerProduct      │
│   (SFA App)  │     │  SyncEngineController│     │ PriceResolver       │
│              │     │  SduiScreenBuilder   │     │ ::resolveBatch()    │
└──────────────┘     └──────────────────────┘     └─────────┬───────────┘
                                                            │
                                                   Single flat JOIN
                                                            │
                                                            ▼
                     ┌──────────────────────────────────────────────────┐
                     │           price_list_line_details                 │
                     │    JOIN product_packagings ON packaging_id        │
                     │    JOIN products ON product_id                    │
                     └──────────────────────────────────────────────────┘
```

All three consumer endpoints (Catalog, Sync, SDUI) call the same `resolveBatch()` method, ensuring price consistency across all channels.

### 1.3 Service Map

| Service | Responsibility |
|---|---|
| `PriceResolverService` | Entry point — routes B2B/B2C, applies rounding |
| `PartnerProductPriceResolver` | Level 1 partner overrides + core 3-tier hierarchy + tier pricing + channel price list fallback |
| `TierPriceResolver` | Volume-based tier lookup (single query batch) |
| `CurrencyRounder` | BCMath rounding utility (static, no state) |
| `PriceListValidityConstraint` | Order validation — blocks expired price lists |
| `InvoiceService` | Applies rounding to line totals and grand total |
| `SalespersonSyncEngineService` | Bootstrap sync — includes tiers, meta, config |

---

## 2. Database Schema

### 2.1 `price_list_line_details` (Single Source of Truth)

All pricing data lives in **one table**: `price_list_line_details`.

The legacy `price_list_line_packaging_prices` table has been **eliminated**. Promotional overrides and standard prices coexist in the same table, distinguished by the `is_override` boolean flag.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    price_list_line_details                           │
├─────────────────────────────────────────────────────────────────────┤
│ id              │ bigint PK                                         │
│ price_list_id   │ bigint FK → price_lists.id                        │
│ line_number     │ int (version number of the price list)            │
│ product_id      │ bigint FK → products.id                           │
│ packaging_id    │ bigint FK → product_packagings.id  [NOT NULL]     │
│ is_override     │ boolean [NOT NULL, default: false]                │
│ unit_id         │ bigint FK → units.id                              │
│ sales_price     │ decimal(15,3)                                     │
│ return_price    │ decimal(15,3)                                     │
│ min_sales_price │ decimal(15,3)                                     │
│ max_sales_price │ decimal(15,3)                                     │
│ sales_discount  │ decimal(15,6)                                     │
│ discount_amount │ decimal(15,6)                                     │
│ discount_rate   │ decimal(15,6)                                     │
├─────────────────────────────────────────────────────────────────────┤
│ UNIQUE: (price_list_id, line_number, product_id, packaging_id)      │
│ FK: packaging_id → product_packagings.id ON DELETE CASCADE          │
└─────────────────────────────────────────────────────────────────────┘
```

**Key design decisions:**
- `packaging_id` is **NOT NULL** — every pricing row is explicitly linked to a packaging
- `is_override` distinguishes promotional prices (true) from standard prices (false)
- The composite unique constraint prevents duplicate rows for the same product-packaging combo
- CASCADE on delete: removing a packaging auto-removes its pricing rows

### 2.2 `product_pricing_tiers`

Volume-based tier breakpoints for quantity discounts.

```sql
product_pricing_tiers (
  id, price_list_id, line_number, product_id, packaging_id,
  min_qty, max_qty, tier_price,
  created_at, updated_at
)

UNIQUE: (price_list_id, line_number, product_id, packaging_id, min_qty, max_qty)
CHECK: min_qty <= max_qty
CHECK: tier_price > 0
```

### 2.3 `partner_price_overrides` & `channels`

Level 1 surgical exceptions per (partner, product), and channel-level mass
price lists.

```sql
partner_price_overrides (
  id, partner_id, product_id,
  fixed_price,        -- per BASE UNIT; packaging price = fixed_price × packaging.quantity
  discount_rate, discount_amount,   -- applied on the resolved price when fixed_price is null
  valid_from, valid_to, active, priority,   -- highest priority wins
  created_at, updated_at
)

channels (
  id, code, name, description,
  price_list_id,      -- channel-level (mass) price list: fallback when partners.price_list_id is null
  is_active, sort_order, created_at, updated_at
)
```

The legacy `segment_price_lists` table and `partners.segment_code` column are
dropped (2026-07): the resolver was never wired and mass pricing now goes
through the channel price list.

### 2.4 `price_list_lines`

Versioned lines with start/end dates controlling price list validity.

```sql
-- price_list_lines table — the active version
INSERT INTO price_list_lines (price_list_id, line_number, start_date, end_date, closed)
VALUES (1, 10, '2024-01-01', '2099-12-31', false);
```

**Active line criteria** (all must be true):
- `closed = false`
- `start_date <= NOW()`
- `end_date >= NOW()`
- Highest `line_number` wins if multiple lines match

### 2.5 `product_packagings`

Packaging structures (unit, carton, kg) linked to products.

```sql
-- product_packagings table
INSERT INTO product_packagings (id, product_id, unit_id, quantity, price, is_default) VALUES
  (101, 42, 1, 1,  NULL, true),   -- Pièce (1 unit) — default
  (102, 42, 3, 12, NULL, false);  -- Carton (12 units)
```

### 2.6 Relationships Diagram

```
┌──────────────┐       ┌──────────────────┐       ┌─────────────────────────┐
│  price_lists │──1:N──│ price_list_lines  │──1:N──│ price_list_line_details  │
│  (id, code)  │       │ (line_number,    │       │ (product, packaging,     │
│              │       │  start/end date) │       │  is_override, price)     │
└──────────────┘       └──────────────────┘       └────────────┬────────────┘
                                                               │
                                                    FK: packaging_id
                                                               │
┌──────────────┐       ┌──────────────────┐                    ▼
│   products   │──1:N──│product_packagings │◀───────────────────┘
│(has_colisage)│       │(quantity, unit)   │
└──────────────┘       └──────────────────┘
       │
       │ 1:N
       ▼
┌──────────────────────┐       ┌──────────────────────┐       ┌──────────────────────┐
│product_pricing_tiers │       │partner_price_overrides│       │       channels        │
│(min_qty, max_qty,    │       │(partner, product,    │       │(code, price_list_id  │
│ tier_price)          │       │ fixed_price, priority)│       │ = mass fallback)     │
└──────────────────────┘       └──────────────────────┘       └──────────────────────┘
```

### 2.7 All Tables Summary

| Table | Purpose |
|---|---|
| `price_lists` | Named tariffs (e.g., DEMI-GROS, GROS) |
| `price_list_lines` | Versioned lines with start/end dates |
| `price_list_line_details` | Actual prices per product-packaging |
| `product_pricing_tiers` | Volume-based tier breakpoints |
| `partner_price_overrides` | Level 1 surgical exceptions per (partner, product) |
| `channels` | Commercial channels with channel-level (mass) price list |
| `product_packagings` | Packaging structures (unit, carton, kg) |
| `products` | Product master with `has_colisage` flag |
| `partners` | Partner with `price_list_id` and `channel_id` |

---

## 3. Resolution Algorithm (The 4-Level Hierarchy)

When resolving a price for a `(partner, product, packaging, quantity)` tuple, the system applies the following priority cascade:

```
┌─────────────────────────────────────────────────────────────────┐
│  LEVEL 0: TIER PRICING (when pricing.tier_based.enabled = true) │
│  → product_pricing_tiers WHERE min_qty <= qty <= max_qty         │
│  → If match found: use tier_price. STOP.                         │
│  → Source: 'tier'                                                │
├─────────────────────────────────────────────────────────────────┤
│  LEVEL 1: OVERRIDE ROW                                           │
│  WHERE is_override = true AND sales_price > 0                    │
│  → Use this price. STOP.                                         │
│  → Source: 'override'                                            │
├─────────────────────────────────────────────────────────────────┤
│  LEVEL 2: STANDARD ROW                                           │
│  WHERE is_override = false AND sales_price > 0                   │
│  → Use this price. STOP.                                         │
│  → Source: 'standard'                                            │
├─────────────────────────────────────────────────────────────────┤
│  LEVEL 3: LINEAR FALLBACK                                        │
│  ONLY IF product.has_colisage = false                            │
│  → Compute: base_sales_price × packaging.quantity                │
│  → base_sales_price = default_packaging_price / default_qty      │
│  → Source: 'linear'                                              │
├─────────────────────────────────────────────────────────────────┤
│  NO PRICE FOUND                                                  │
│  IF has_colisage = true → return NULL (source: colisage_unpriced)│
│  IF has_colisage = false → return NULL (source: no_base)         │
└─────────────────────────────────────────────────────────────────┘
```

### 3.1 Colisage Gate Rule

The **Colisage Gate** is the strict enforcement rule that prevents the system from computing prices via multiplication for products with explicit packaging structures.

**Rule**: If `product.has_colisage = true`, the system **NEVER** computes `base_price × quantity`. It either finds an explicit price row or returns `null`.

```
IF product.has_colisage = true:
    ├── Tier match found?       → Use tier price ✓
    ├── Override row found?     → Use override price ✓
    ├── Standard row found?     → Use standard price ✓
    └── No row found?           → Return NULL (colisage_unpriced) ✗ NO FALLBACK
    
IF product.has_colisage = false:
    ├── Tier match found?       → Use tier price ✓
    ├── Override row found?     → Use override price ✓
    ├── Standard row found?     → Use standard price ✓
    └── No row found?           → Compute linear fallback ✓ (allowed)
```

**Why this matters**: A carton of 12 units might cost 110 MAD (not 10 × 12 = 120 MAD). The linear multiplication would give incorrect prices for products with negotiated packaging-level pricing.

### 3.2 Post-Resolution: Clamping + Rounding

After a price is resolved (from any level), two post-processing steps apply:

1. **Clamping**: All non-null prices are clamped within `min_sales_price` / `max_sales_price` bounds (when those bounds are non-null and > 0).
2. **Currency Rounding**: BCMath rounding with configurable step: `round(price / step) * step`

---

## 4. Configuration Parameters

All parameters are resolved via `ParameterService` with the cascade: **Partner → User → AccessProfile → Role → Definition default**.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `pricing.tier_based.enabled` | boolean | `false` | Enable volume-based tier pricing (paliers) |
| `pricing.validity_date_check` | boolean | `false` | Block orders when price list is expired |
| `pricing.currency_rounding` | decimal | `0.01` | Rounding step for all prices (BCMath) |

### ParameterService Cascade

The `ParameterService` resolves configuration values through a priority cascade. The first non-null value wins:

```
Partner (most specific)
  → User
    → AccessProfile
      → Role
        → Definition default (least specific)
```

This allows fine-grained control: a specific partner can have tier pricing enabled while the rest of the company does not.

### SQL Examples for Each Parameter

```sql
-- Enable tier pricing for a specific branch
INSERT INTO configuration_settings (configurable_type, configurable_id, key, value, type)
VALUES ('App\Models\Branch', 1, 'pricing.tier_based.enabled', 'true', 'boolean');

-- Enable validity check for strict branches
INSERT INTO configuration_settings (configurable_type, configurable_id, key, value, type)
VALUES ('App\Models\Branch', 2, 'pricing.validity_date_check', 'true', 'boolean');

-- Set rounding to nearest 0.50 MAD for a specific branch
INSERT INTO configuration_settings (configurable_type, configurable_id, key, value, type)
VALUES ('App\Models\Branch', 3, 'pricing.currency_rounding', '0.50', 'decimal');
```

### Additional Configuration

| Key | Env Variable | Default | Description |
|-----|-------------|---------|-------------|
| `catalog.omit_unpriced_packagings` | `CATALOG_OMIT_UNPRICED_PACKAGINGS` | `false` | When true, packagings with null price are excluded from the catalog response |

---

## 5. Feature: Volume-Based Tier Pricing (Paliers)

### What It Does

When enabled, products can have quantity-based price breaks. Buy more → pay less per unit.

### Schema

```sql
product_pricing_tiers (
  id, price_list_id, line_number, product_id, packaging_id,
  min_qty, max_qty, tier_price,
  created_at, updated_at
)

UNIQUE: (price_list_id, line_number, product_id, packaging_id, min_qty, max_qty)
CHECK: min_qty <= max_qty
CHECK: tier_price > 0
```

### Configuration Examples

```sql
-- Product 42 (Jus d'Orange), Packaging 101 (Piece), Price List 1, Line 10:
-- Buy 1-9:   10.00 MAD/unit (standard price from price_list_line_details)
-- Buy 10-49: 9.50 MAD/unit (tier 1)
-- Buy 50+:   8.80 MAD/unit (tier 2)

INSERT INTO product_pricing_tiers (price_list_id, line_number, product_id, packaging_id, min_qty, max_qty, tier_price)
VALUES
  (1, 10, 42, 101, 10.000, 49.000, 9.500),
  (1, 10, 42, 101, 50.000, 99999.000, 8.800);
```

### Resolution Logic

```
1. Is pricing.tier_based.enabled = true? → YES
2. Does the ordered quantity fall within a tier range? → Check product_pricing_tiers
3. If match found → use tier_price (lowest if overlapping)
4. If no match → fall through to standard 3-tier hierarchy
5. Apply min/max clamping from price_list_line_details
```

### Debug Query: Check Tier Configuration

```sql
SELECT p.code, p.name, pp.quantity AS pkg_qty,
       ppt.min_qty, ppt.max_qty, ppt.tier_price
FROM product_pricing_tiers ppt
JOIN products p ON p.id = ppt.product_id
JOIN product_packagings pp ON pp.id = ppt.packaging_id
WHERE ppt.price_list_id = 1
  AND ppt.line_number = 10
ORDER BY p.code, pp.quantity, ppt.min_qty;
```

---

## 6. Feature: Partner Overrides & Channel Price Lists

> Replaces the former "Client Segment Price List Override" (removed 2026-07:
> `segment_price_lists`, `partners.segment_code` and the
> `pricing.client_segment_override` parameter are gone).

### 6.1 Partner Overrides (Level 1 — surgical exceptions)

An active `partner_price_overrides` row for `(partner_id, product_id)` wins
over the whole hierarchy, even when the partner has no price list:

- `fixed_price` (per **base unit**) → packaging price = `fixed_price × packaging.quantity`, source `partner_override`
- discount-only rows (`discount_rate` / `discount_amount`, no fixed_price) → the
  discount applies on the price resolved by the hierarchy below, source `partner_override_discount`
- selection: `active = true`, date-valid, highest `priority` wins

```sql
-- Fixed price of 10.500 MAD/unit for partner 500 on product 42
INSERT INTO partner_price_overrides (partner_id, product_id, fixed_price, active, priority)
VALUES (500, 42, 10.500, true, 10);
```

Managed in the back-office (PricingController) — applied identically in the
catalog API, the salesperson cart and SDUI (single engine).

### 6.1b Back-office API contract — `pricing/overrides` (Level 1 CRUD)

> **Audience:** Frontend ERP (écran de tarification) — remplace l'UI legacy.
> **Base URL:** `https://api.omni360.cloud/api/backend/pricing/overrides`
> **Auth:** `Authorization: Bearer <token>` — permission `manage-pricing`
> **Statut:** payloads capturés sur des réponses réelles (staging, 2026-07-13)

> 🔀 **Frontière de responsabilité** : cet écran gère les exceptions de PRIX
> (`partner_price_overrides`, Niveau 1 du moteur v5) — rien d'autre. Les
> règles de crédit/risque du client (`partner_financial_profiles` : plafonds,
> tolérance de dépassement, workflow d'approbation, versioning
> `effective_from/to`) sont un domaine distinct et opérationnel — voir
> [08-payment-credit.md](08-payment-credit.md). Ne pas exposer ni modifier
> ces champs depuis l'écran de tarification.

⚠️ **Unités — à lire avant de coder le formulaire :**
- `fixed_price` = prix par **unité de base** (le moteur dérive les colisages : `fixed_price × packaging.quantity`).
- `discount_rate` = **POURCENTAGE 0–100** (le moteur applique `prix × (rate/100)`). L'ancienne borne 0–1 (fraction) est morte — saisir `10` pour 10 %.
- `discount_rate`/`discount_amount` ne s'appliquent que si `fixed_price` est null (sinon le prix fixe court-circuite tout).
- Sélection moteur : `active = true` + fenêtre `valid_from/valid_to` + **`priority` la plus haute gagne**.

#### Lister (table d'administration) — `GET /pricing/overrides`

Query params : `partner_id`, `product_id`, `active` (bool), `q` (recherche
partner/produit par code ou nom), `per_page`. Réponse paginée Laravel avec
`partner` et `product` imbriqués — tout ce qu'il faut pour peupler la table.

```bash
curl "https://api.omni360.cloud/api/backend/pricing/overrides?partner_id=140&active=1&per_page=10" \
  -H "Authorization: Bearer {TOKEN}" -H "Accept: application/json"
```

**Response `200`:**
```json
{
  "overrides": {
    "current_page": 1,
    "data": [
      {
        "id": 1,
        "partner_id": 140,
        "product_id": 1,
        "fixed_price": "10.500",
        "discount_rate": "0.000000",
        "discount_amount": "0.000000",
        "valid_from": "2026-07-12T23:00:00.000000Z",
        "valid_to": "2026-12-30T23:00:00.000000Z",
        "active": true,
        "priority": 10,
        "partner": { "id": 140, "code": "CL00140", "name": "BOUCHERIE EL MENZAH" },
        "product": { "id": 1, "code": "PSCE0200591", "name": "JAVANA PRO BOUILLON EN POUDRE POISSON 1KG" }
      },
      {
        "id": 2,
        "partner_id": 140,
        "product_id": 2,
        "fixed_price": null,
        "discount_rate": "10.000000",
        "discount_amount": "0.000000",
        "valid_from": "2026-07-13T18:49:17.000000Z",
        "valid_to": "2099-12-30T23:00:00.000000Z",
        "active": true,
        "priority": 5,
        "partner": { "id": 140, "code": "CL00140", "name": "BOUCHERIE EL MENZAH" },
        "product": { "id": 2, "code": "BURV1KG", "name": "BURGER DE VOLAILLE SAC 1KG" }
      }
    ],
    "last_page": 1,
    "per_page": 10,
    "total": 2
  },
  "filters": { "q": "", "partner_id": 140, "product_id": 0, "active": true },
  "partners": [ { "id": 1, "code": "CL00001", "name": "TIMITAR FOOD" } ]
}
```

#### Créer — `POST /pricing/overrides`

Exception à prix fixe (défauts si omis : `valid_from = now()`,
`valid_to = 2099-12-31`, `active = true`, `priority = 0`) :

```bash
curl -X POST "https://api.omni360.cloud/api/backend/pricing/overrides" \
  -H "Authorization: Bearer {TOKEN}" -H "Accept: application/json" -H "Content-Type: application/json" \
  -d '{
    "partner_id": 140,
    "product_id": 1,
    "fixed_price": 10.500,
    "priority": 10,
    "valid_from": "2026-07-13",
    "valid_to": "2026-12-31"
  }'
```

**Response `201`:**
```json
{
  "success": true,
  "message": "Override created successfully",
  "override": {
    "id": 1, "partner_id": 140, "product_id": 1,
    "fixed_price": "10.500", "discount_rate": "0.000000", "discount_amount": "0.000000",
    "valid_from": "2026-07-12T23:00:00.000000Z", "valid_to": "2026-12-30T23:00:00.000000Z",
    "active": true, "priority": 10
  }
}
```

Exception à remise seule (10 % sur le prix résolu par la hiérarchie) :
```bash
curl -X POST ".../pricing/overrides" -H ... \
  -d '{ "partner_id": 140, "product_id": 2, "discount_rate": 10, "priority": 5 }'
```

**Erreur `422`** (ex. `discount_rate: 150`) :
```json
{
  "message": "The discount rate field must not be greater than 100.",
  "errors": { "discount_rate": ["The discount rate field must not be greater than 100."] }
}
```

#### Modifier — `PUT /pricing/overrides/{id}`

`partner_id` et `product_id` restent requis (payload complet du formulaire).

```bash
curl -X PUT "https://api.omni360.cloud/api/backend/pricing/overrides/1" \
  -H "Authorization: Bearer {TOKEN}" -H "Accept: application/json" -H "Content-Type: application/json" \
  -d '{ "partner_id": 140, "product_id": 1, "fixed_price": 11.900, "priority": 20, "valid_to": "2027-06-30" }'
```
**Response `200`:** `{"success": true, "message": "Override updated successfully"}`

`GET /pricing/overrides/{id}/edit` pré-remplit le formulaire (override +
`partner`/`product` imbriqués + liste de partners pour le select).

#### Révoquer / Supprimer

**Révocation soft (recommandée — historique conservé, le mobile purge via le
delta sync)** — `PATCH /pricing/overrides/{id}/toggle` :
```json
{ "success": true, "message": "Override disabled", "active": false }
```

**Suppression définitive** — `DELETE /pricing/overrides/{id}` :
```bash
curl -X DELETE "https://api.omni360.cloud/api/backend/pricing/overrides/2" \
  -H "Authorization: Bearer {TOKEN}" -H "Accept: application/json"
```
**Response `200`:** `{"success": true, "message": "Override deleted"}`

#### Simuler — `POST /pricing/overrides/preview` 💡

Le juge de paix pour l'UI : renvoie le prix effectif calculé par le **moteur
v5 lui-même** — affichez-le en temps réel dans le formulaire ("prix résultant").

```bash
curl -X POST "https://api.omni360.cloud/api/backend/pricing/overrides/preview" \
  -H "Authorization: Bearer {TOKEN}" -H "Accept: application/json" -H "Content-Type: application/json" \
  -d '{ "partner_id": 140, "product_id": 1 }'
```

Avant override (`source: standard`) → après création (`source: partner_override`) :
```json
{ "final_price": 17.03, "base_price": 17.03, "source": "standard", "detail": { "sales_price": "17.030", "min_sales_price": "14.476", "max_sales_price": "19.585" }, "algorithm_version": 5 }
```
```json
{ "final_price": 10.5, "base_price": 10.5, "source": "partner_override", "detail": null, "algorithm_version": 5 }
```

Remise seule : `base_price` = prix hiérarchie, `final_price` = prix remisé :
```json
{ "final_price": 21.654, "base_price": 24.06, "source": "partner_override_discount", "algorithm_version": 5 }
```

Après `toggle` off, le preview retombe sur `source: standard` — même contrat
que le panier vendeur et le catalogue : **un seul moteur, zéro divergence**.

### 6.1c Packagings helper — `GET /pricing/products/{productId}/packagings`

> **Contrat FIGÉ** (capturé staging 2026-07-14) : **ARRAY NU** (pas
> d'enveloppe `{success, ...}` — consommateur select legacy préservé).
> `id` + `label` sont les champs historiques ; le reste est additif.
> `price` est `null` sans contexte tarifaire.

Query params optionnels :

| Param | Effet |
|---|---|
| `price_list_id` | Prix résolus par le moteur v5 sur la ligne ACTIVE de cette liste |
| `line_number` | Épingle une ligne précise (défaut : ligne active) |
| `partner_id` | Liste EFFECTIVE du client (directe → fallback canal) **+ overrides N1 appliqués** |

```bash
curl "https://api.omni360.cloud/api/backend/pricing/products/3/packagings?price_list_id=4" \
  -H "Authorization: Bearer {TOKEN}" -H "Accept: application/json"
```

**Response `200`** (array nu) :
```json
[
  {
    "id": 2,
    "label": "Pièce (Qty: 1)",
    "unit": { "id": 1, "code": "PCS", "name": "Pièce" },
    "quantity": 1,
    "is_default": true,
    "price": { "unit_price": 31.09, "source": "standard", "min_price": 26.427, "max_price": 35.754, "sellable": true }
  },
  {
    "id": 213,
    "label": "Carton (Qty: 100)",
    "unit": { "id": 4, "code": "CTN", "name": "Carton" },
    "quantity": 100,
    "is_default": false,
    "price": { "unit_price": 3109, "source": "standard", "min_price": 2642.65, "max_price": 3575.35, "sellable": true }
  }
]
```

Avec `?partner_id=140` (client porteur d'un override N1 `fixed_price: 9.999`) :
```json
[
  { "id": 2,   "label": "Pièce (Qty: 1)",    "quantity": 1,   "is_default": true,
    "price": { "unit_price": 9.999, "source": "partner_override", "min_price": null, "max_price": null, "sellable": true } },
  { "id": 213, "label": "Carton (Qty: 100)", "quantity": 100, "is_default": false,
    "price": { "unit_price": 999.9, "source": "partner_override", "min_price": null, "max_price": null, "sellable": true } }
]
```

Notes :
- `price.source` = mêmes valeurs que le moteur (`partner_override`,
  `partner_override_discount`, `tier`, `override`, `standard`, `linear`,
  `colisage_unpriced`, `no_base`) ; `sellable: false` quand aucun prix.
- Pas de `return_price` ici — c'est un helper de RÉSOLUTION (prix de vente
  effectif) ; les colonnes brutes `sales_price`/`return_price` par ligne se
  gèrent via les endpoints CRUD `price-lists/{id}/lines/{n}/details`.

### 6.2 Channel Price Lists (mass fallback)

The effective price list for a partner is:

```
partners.price_list_id          (direct assignment — VIP/specific)
  else channels.price_list_id   (channel-level mass tariff via partners.channel_id)
  else no_base                  (unpriced)
```

```sql
-- All DETAIL partners without a direct list use price list 2
UPDATE channels SET price_list_id = 2 WHERE code = 'DETAIL';
```

See `Partner::effectivePriceListId()` — used by the resolver, catalog, sync
and readiness checks.

---

## 7. Feature: Price List Validity Enforcement

### What It Does

Blocks order submission when the partner's price list has no active (date-valid) line. Prevents orders from being priced against expired tariffs.

### How It Works

```
1. Is pricing.validity_date_check = true? → YES
2. Query price_list_lines for the partner's price list:
   WHERE closed = false AND start_date <= NOW(timezone) AND end_date >= NOW(timezone)
3. If active line found → order proceeds
4. If NO active line → HTTP 422, error code: PriceListExpired
```

### Timezone Awareness

The `NOW()` evaluation uses the `general.timezone` parameter (default: `Africa/Casablanca`). This ensures expiry is evaluated at the branch's local midnight, not UTC.

### Error Response

```json
{
  "error": "PriceListExpired",
  "price_list_id": 1,
  "price_list_code": "C01",
  "last_end_date": "2024-12-31"
}
```

### Bootstrap: `expiring_soon` Flag

When enabled, the mobile app receives:

```json
{
  "price_list_meta": {
    "price_list_id": 1,
    "start_date": "2024-01-01",
    "end_date": "2025-12-31",
    "expiring_soon": true
  }
}
```

`expiring_soon = true` when `end_date` is within 7 days of now.

---

## 8. Feature: Currency Rounding (BCMath)

### Formula

```
rounded_price = round(price / step) * step
```

All arithmetic via BCMath (`bcdiv`, `bcmul`, `bcadd`). Zero raw float operations.

### Examples Table

| Price | Step | Result |
|---|---|---|
| 12.30 | 0.50 | **12.50** |
| 12.70 | 0.50 | **12.50** |
| 12.80 | 0.50 | **13.00** |
| 9.99 | 0.01 | **9.99** (unchanged) |
| 15.123 | 0.05 | **15.10** |

### Where Applied

1. **PriceResolverService** — after resolving the unit price (B2B path)
2. **InvoiceService** — on each line total AND the invoice grand total (both BL and POS paths)

### Safety Guards

- Step ≤ 0 → automatically sanitized to 0.01
- Default step (0.01) = centime precision = effectively no change from existing behavior
- BCMath eliminates drift on large aggregates (e.g., 500-line invoices)

---

## 9. Colisage Products (has_colisage = true)

### The Colisage Gate Rule

If `product.has_colisage = true`, the system **NEVER** computes `base_price × quantity`. It either finds an explicit price row (override, standard, or tier) or returns `null`.

**Why**: A carton of 12 units might cost 110 MAD (not 10 × 12 = 120 MAD). The linear multiplication would give incorrect prices for products with negotiated packaging-level pricing.

### Setup Example (Step by Step)

**Example**: Product "Jus d'Orange" — sold as Piece (1 unit) and Carton (12 units) with explicit pricing.

#### Step 1: Product record

```sql
INSERT INTO products (id, code, name, has_colisage, unit_id, is_active)
VALUES (42, 'JUS-ORANGE-01', 'Jus d''Orange 1L', true, 1, true);
```

#### Step 2: Packaging structures

```sql
INSERT INTO product_packagings (id, product_id, unit_id, quantity, price, is_default) VALUES
  (101, 42, 1, 1,  NULL, true),   -- Pièce (1 unit) — default
  (102, 42, 3, 12, NULL, false);  -- Carton (12 units)
```

| id  | product_id | unit_id | quantity | is_default | Description |
|-----|-----------|---------|----------|------------|-------------|
| 101 | 42        | 1 (PCS) | 1        | true       | Pièce       |
| 102 | 42        | 3 (CTN) | 12       | false      | Carton      |

#### Step 3: Pricing rows (Standard)

```sql
INSERT INTO price_list_line_details 
  (price_list_id, line_number, product_id, packaging_id, is_override, unit_id, sales_price, min_sales_price, max_sales_price)
VALUES
  (1, 10, 42, 101, false, 1, 10.000, 8.500, 11.500),   -- Pièce: 10 MAD
  (1, 10, 42, 102, false, 3, 120.000, 102.000, 138.000); -- Carton: 120 MAD (standard)
```

#### Step 4: Promotional override (optional)

```sql
INSERT INTO price_list_line_details 
  (price_list_id, line_number, product_id, packaging_id, is_override, unit_id, sales_price, min_sales_price, max_sales_price)
VALUES
  (1, 10, 42, 102, true, 3, 110.000, 99.000, 138.000);  -- Carton PROMO: 110 MAD
```

#### Resolution result:

| Packaging | Priority 1 (Override) | Priority 2 (Standard) | Final Price | Source |
|-----------|----------------------|----------------------|-------------|--------|
| Pièce     | —                    | 10.000               | **10.000**  | standard |
| Carton    | **110.000**          | 120.000              | **110.000** | override |

The Carton gets the promotional price (110 MAD) because the override row takes priority.

### Why Linear Fallback Is Blocked

For colisage products, the system refuses to compute `base_price × quantity` because:
- Packaging prices are **negotiated independently** (e.g., carton discount)
- Linear math would produce incorrect prices (10 × 12 = 120 ≠ 110 negotiated)
- Missing price rows indicate a **data gap**, not a calculation opportunity

If a colisage product-packaging has no price row, the system returns `null` with source `colisage_unpriced`. This signals to the mobile app that the product cannot be sold in that packaging until pricing is configured.

---

## 10. Non-Colisage Products (has_colisage = false)

### Linear Fallback Explanation

For simple products without explicit packaging-level pricing, the system is allowed to compute prices via multiplication:

```
price = base_sales_price × packaging.quantity
```

Where `base_sales_price` = the price of the default packaging (quantity = 1).

This is appropriate for products where the per-unit price is constant regardless of packaging size (e.g., pens, basic supplies).

### Setup Example

**Example**: Product "Stylo BIC" — simple product, linear pricing allowed.

#### Step 1: Product record

```sql
INSERT INTO products (id, code, name, has_colisage, unit_id, is_active)
VALUES (55, 'STYLO-BIC-01', 'Stylo BIC Bleu', false, 1, true);
```

#### Step 2: Packaging structures

```sql
INSERT INTO product_packagings (id, product_id, unit_id, quantity, price, is_default) VALUES
  (201, 55, 1, 1,  NULL, true),   -- Pièce (1 unit) — default
  (202, 55, 2, 50, NULL, false);  -- Boîte (50 units)
```

#### Step 3: Pricing row (only base packaging needed)

```sql
-- Only the Pièce needs an explicit price — Boîte will use linear fallback
INSERT INTO price_list_line_details 
  (price_list_id, line_number, product_id, packaging_id, is_override, unit_id, sales_price)
VALUES
  (1, 10, 55, 201, false, 1, 2.500);  -- Pièce: 2.50 MAD
```

#### Resolution result:

| Packaging | Priority 1 | Priority 2 | Linear Fallback | Final Price | Source |
|-----------|-----------|-----------|-----------------|-------------|--------|
| Pièce     | —         | 2.500     | —               | **2.500**   | standard |
| Boîte     | —         | —         | 2.5 × 50 = 125  | **125.000** | linear |

Since `has_colisage = false`, the system is allowed to compute `base_price × quantity` for the Boîte.

---

## 11. Mobile Bootstrap Sync Payload

The sync endpoint includes pricing data for offline use:

```json
{
  "pricing": {
    "pricing_tiers": [
      {"product_id": 42, "packaging_id": 101, "min_qty": "10.000", "max_qty": "49.000", "tier_price": "9.500"},
      {"product_id": 42, "packaging_id": 101, "min_qty": "50.000", "max_qty": "99999.000", "tier_price": "8.800"}
    ],
    "partner_price_overrides": [
      {"id": 7, "partner_id": 500, "partner_code": "CL00500", "product_id": 42,
       "fixed_price": 10.5, "discount_rate": 0, "discount_amount": 0,
       "valid_from": "2026-07-01T00:00:00+00:00", "valid_to": "2099-12-31T00:00:00+00:00",
       "active": true, "priority": 10, "updated_at": "2026-07-13T09:00:00+00:00"}
    ],
    "price_list_meta": [
      {"price_list_id": 1, "start_date": "2024-01-01", "end_date": "2025-12-31", "expiring_soon": false}
    ],
    "pricing_config": {
      "currency_rounding": 0.01,
      "tier_based_enabled": false
    }
  }
}
```

### What's Included Conditionally

| Field | Condition |
|---|---|
| `pricing_tiers` | Only included when `pricing.tier_based.enabled = true` |
| `partner_price_overrides` | Always included (scoped partners × scoped products) |
| `price_list_meta` | Only included when `pricing.validity_date_check = true` |
| `pricing_config` | Always included |

### Offline Level 1 Overrides Contract

`partner_price_overrides` lets the on-device engine replicate the server's
Level 1 exactly:

- `fixed_price` is per **base unit** → packaging price = `fixed_price × packaging.quantity` (bypasses tiers/standard/linear).
- Discount-only rows (`fixed_price` null) apply `discount_rate` (%) then `discount_amount` on the price resolved by the on-device hierarchy.
- Best row per (partner, product): `active = true`, date-valid at cart time, highest `priority` (ties: latest `valid_from`, then highest `id`).
- **Full sync** sends currently-relevant rows (active, not expired). **Delta sync** sends every row changed since `last_sync` — including deactivated/expired ones — upsert by `id` and let validity filtering drop revoked rows.

---

## 12. Error Codes & Troubleshooting

### Error Codes

| Code | HTTP | Trigger | Response Fields |
|---|---|---|---|
| `PriceListExpired` | 422 | Price list has no active line | `price_list_id`, `price_list_code`, `last_end_date` |
| `colisage_unpriced` | — | Colisage product with no price row | Returned in `PackagingPriceResult.source` |
| `no_base` | — | No direct or channel price list, or no active line | Returned in `PackagingPriceResult.source` |

### Debug Queries

#### Finding Unpriced Colisage Products (Missing Rows)

```sql
-- Products with has_colisage=true that are missing pricing rows
SELECT 
    p.id, p.code, p.name,
    pp.id AS packaging_id,
    pp.quantity,
    u.code AS unit_code
FROM products p
JOIN product_packagings pp ON pp.product_id = p.id
JOIN units u ON u.id = pp.unit_id
LEFT JOIN price_list_line_details plld 
    ON plld.product_id = p.id 
    AND plld.packaging_id = pp.id
    AND plld.price_list_id = 1
    AND plld.line_number = 10
WHERE p.has_colisage = true
  AND p.is_active = true
  AND plld.id IS NULL
ORDER BY p.code, pp.quantity;
```

These are the product-packaging combinations that will return `colisage_unpriced` (null price, not sellable).

#### Finding All Override Prices

```sql
SELECT 
    p.code AS product_code,
    p.name AS product_name,
    pp.quantity AS packaging_qty,
    u.code AS unit_code,
    plld.sales_price AS promo_price,
    std.sales_price AS standard_price,
    ROUND(((std.sales_price - plld.sales_price) / std.sales_price) * 100, 1) AS discount_pct
FROM price_list_line_details plld
JOIN products p ON p.id = plld.product_id
JOIN product_packagings pp ON pp.id = plld.packaging_id
JOIN units u ON u.id = pp.unit_id
LEFT JOIN price_list_line_details std 
    ON std.price_list_id = plld.price_list_id
    AND std.line_number = plld.line_number
    AND std.product_id = plld.product_id
    AND std.packaging_id = plld.packaging_id
    AND std.is_override = false
WHERE plld.price_list_id = 1
  AND plld.line_number = 10
  AND plld.is_override = true
  AND plld.sales_price > 0
ORDER BY p.code, pp.quantity;
```

#### Checking Price List Validity

```sql
SELECT pl.id, pl.code, pl.name,
       pll.line_number, pll.start_date, pll.end_date, pll.closed,
       CASE WHEN pll.end_date - CURRENT_DATE <= 7 THEN true ELSE false END AS expiring_soon
FROM price_lists pl
JOIN price_list_lines pll ON pll.price_list_id = pl.id
WHERE pll.closed = false
  AND pll.start_date <= CURRENT_DATE
  AND pll.end_date >= CURRENT_DATE
ORDER BY pl.code, pll.line_number DESC;
```

### Common Issues

| Symptom | Likely Cause | Fix |
|---|---|---|
| Product shows null price | Missing `price_list_line_details` row for colisage product | Add explicit pricing row for the packaging |
| Linear fallback gives wrong price | Product should be `has_colisage = true` | Update `products.has_colisage = true` and add explicit rows |
| Order blocked with `PriceListExpired` | Price list line has expired `end_date` | Extend `end_date` or create new line |
| Partner override not applied | Row inactive, out of validity window, or lower priority | Check `partner_price_overrides` (`active`, `valid_from/to`, `priority`) |
| Channel fallback not applied | Partner has a direct `price_list_id`, or `channels.price_list_id` is null | Clear the direct list or set the channel list |
| Tier pricing not applied | `pricing.tier_based.enabled` is false | Enable via configuration_settings |
| Rounding seems off | Step configured incorrectly | Check `pricing.currency_rounding` value |

---

## 13. Quick Configuration Recipes

### Recipe 1: Enable tier pricing for pilot branch

```sql
INSERT INTO configuration_settings (configurable_type, configurable_id, key, value, type)
VALUES ('App\Models\Branch', 1, 'pricing.tier_based.enabled', 'true', 'boolean');
```

### Recipe 2: Set up 3-tier volume pricing for a product

```sql
INSERT INTO product_pricing_tiers (price_list_id, line_number, product_id, packaging_id, min_qty, max_qty, tier_price) VALUES
  (1, 10, 42, 101, 1.000, 9.000, 10.000),    -- 1-9 units: 10 MAD
  (1, 10, 42, 101, 10.000, 49.000, 9.500),   -- 10-49 units: 9.50 MAD
  (1, 10, 42, 101, 50.000, 99999.000, 8.800); -- 50+ units: 8.80 MAD
```

### Recipe 3: Map a whole channel to a dedicated price list (mass fallback)

```sql
-- All GROS partners without a direct price_list_id use price list 3
UPDATE channels SET price_list_id = 3 WHERE code = 'GROS';

-- (a partner with a direct partners.price_list_id keeps it — the channel
--  list only applies when the direct assignment is NULL)
```

### Recipe 4: Block orders on expired price lists

```sql
INSERT INTO configuration_settings (configurable_type, configurable_id, key, value, type)
VALUES ('App\Models\Branch', 1, 'pricing.validity_date_check', 'true', 'boolean');
```

### Recipe 5: Round prices to nearest 0.50 MAD

```sql
INSERT INTO configuration_settings (configurable_type, configurable_id, key, value, type)
VALUES ('App\Models\Company', 1, 'pricing.currency_rounding', '0.50', 'decimal');
```

### Recipe 6: Set up a new price list with active line

```sql
-- price_lists table
INSERT INTO price_lists (id, company_id, code, name, rank)
VALUES (1, 1, 'C01', 'DEMI-GROS', 10);

-- price_list_lines table — the active version
INSERT INTO price_list_lines (price_list_id, line_number, start_date, end_date, closed)
VALUES (1, 10, '2024-01-01', '2099-12-31', false);
```

### Recipe 7: Assign a partner to a price list

```sql
UPDATE partners SET price_list_id = 1 WHERE id = 100;
```

---

## 14. SQL Query Reference

### 14.1 resolveBatch() Query (Core Engine)

This is the exact query executed by `PartnerProductPriceResolver::resolveBatch()`:

```sql
SELECT
    plld.*,
    pp.quantity   AS pkg_quantity,
    pp.price      AS pkg_price,
    pp.unit_id    AS pkg_unit_id,
    pp.is_default AS pkg_is_default,
    p.has_colisage
FROM price_list_line_details plld
JOIN product_packagings pp ON pp.id = plld.packaging_id
JOIN products p ON p.id = plld.product_id
WHERE plld.price_list_id = :price_list_id
  AND plld.line_number = :line_number
  AND plld.product_id IN (:product_ids)
```

**Characteristics:**
- **1 query** regardless of how many products or packagings
- Returns both override and standard rows — PHP applies the hierarchy in-memory
- JOINs bring packaging metadata (quantity, unit) and product flag (has_colisage) in one shot

### 14.2 Tier Lookup Query

```sql
SELECT p.code, p.name, pp.quantity AS pkg_qty,
       ppt.min_qty, ppt.max_qty, ppt.tier_price
FROM product_pricing_tiers ppt
JOIN products p ON p.id = ppt.product_id
JOIN product_packagings pp ON pp.id = ppt.packaging_id
WHERE ppt.price_list_id = :price_list_id
  AND ppt.line_number = :line_number
ORDER BY p.code, pp.quantity, ppt.min_qty;
```

### 14.3 Effective Price List & Partner Override Queries

```sql
-- Effective price list (direct, else channel)
SELECT COALESCE(p.price_list_id, c.price_list_id) AS effective_price_list_id
FROM partners p
LEFT JOIN channels c ON c.id = p.channel_id
WHERE p.id = :partner_id;

-- Best partner override for a product
SELECT *
FROM partner_price_overrides
WHERE partner_id = :partner_id
  AND product_id = :product_id
  AND active = TRUE
  AND valid_from <= NOW() AND valid_to >= NOW()
ORDER BY priority DESC, valid_from DESC, id DESC
LIMIT 1;
```

### 14.4 Validity Check Query

```sql
SELECT pl.id, pl.code, pl.name,
       pll.line_number, pll.start_date, pll.end_date, pll.closed,
       CASE WHEN pll.end_date - CURRENT_DATE <= 7 THEN true ELSE false END AS expiring_soon
FROM price_lists pl
JOIN price_list_lines pll ON pll.price_list_id = pl.id
WHERE pll.closed = false
  AND pll.start_date <= CURRENT_DATE
  AND pll.end_date >= CURRENT_DATE
ORDER BY pl.code, pll.line_number DESC;
```

### 14.5 Finding Unpriced Products

```sql
-- Products with has_colisage=true that are missing pricing rows
SELECT 
    p.id, p.code, p.name,
    pp.id AS packaging_id,
    pp.quantity,
    u.code AS unit_code
FROM products p
JOIN product_packagings pp ON pp.product_id = p.id
JOIN units u ON u.id = pp.unit_id
LEFT JOIN price_list_line_details plld 
    ON plld.product_id = p.id 
    AND plld.packaging_id = pp.id
    AND plld.price_list_id = :price_list_id
    AND plld.line_number = :line_number
WHERE p.has_colisage = true
  AND p.is_active = true
  AND plld.id IS NULL
ORDER BY p.code, pp.quantity;
```

### 14.6 Finding Overrides

```sql
SELECT 
    p.code AS product_code,
    p.name AS product_name,
    pp.quantity AS packaging_qty,
    u.code AS unit_code,
    plld.sales_price AS promo_price,
    std.sales_price AS standard_price,
    ROUND(((std.sales_price - plld.sales_price) / std.sales_price) * 100, 1) AS discount_pct
FROM price_list_line_details plld
JOIN products p ON p.id = plld.product_id
JOIN product_packagings pp ON pp.id = plld.packaging_id
JOIN units u ON u.id = pp.unit_id
LEFT JOIN price_list_line_details std 
    ON std.price_list_id = plld.price_list_id
    AND std.line_number = plld.line_number
    AND std.product_id = plld.product_id
    AND std.packaging_id = plld.packaging_id
    AND std.is_override = false
WHERE plld.price_list_id = :price_list_id
  AND plld.line_number = :line_number
  AND plld.is_override = true
  AND plld.sales_price > 0
ORDER BY p.code, pp.quantity;
```

### 14.7 Manual Price Resolution (Debugging)

```sql
-- Manually resolve the price for a specific partner × product × packaging
-- (replicates what resolveBatch() does)
WITH active_line AS (
    SELECT pll.price_list_id, pll.line_number
    FROM price_list_lines pll
    JOIN partners ptr ON ptr.price_list_id = pll.price_list_id
    WHERE ptr.id = :partner_id
      AND pll.closed = false
      AND pll.start_date <= CURRENT_DATE
      AND pll.end_date >= CURRENT_DATE
    ORDER BY pll.line_number DESC
    LIMIT 1
)
SELECT 
    plld.product_id,
    plld.packaging_id,
    plld.is_override,
    plld.sales_price,
    plld.min_sales_price,
    plld.max_sales_price,
    pp.quantity AS pkg_quantity,
    p.has_colisage,
    CASE 
        WHEN plld.is_override = true AND plld.sales_price > 0 THEN 'override'
        WHEN plld.is_override = false AND plld.sales_price > 0 THEN 'standard'
        ELSE 'no_price'
    END AS source
FROM price_list_line_details plld
JOIN active_line al ON al.price_list_id = plld.price_list_id 
    AND al.line_number = plld.line_number
JOIN product_packagings pp ON pp.id = plld.packaging_id
JOIN products p ON p.id = plld.product_id
WHERE plld.product_id = :product_id
  AND plld.packaging_id = :packaging_id
ORDER BY plld.is_override DESC  -- Override first
LIMIT 1;
```

The `ORDER BY plld.is_override DESC LIMIT 1` pattern ensures the override row (if it exists) always wins.

### 14.8 In-Memory Hierarchy Resolution (PHP Pseudocode)

```php
// Group rows by (product_id, packaging_id)
foreach ($rows as $row) {
    $grouped[$row->product_id][$row->packaging_id][] = $row;
}

// For each product × packaging:
foreach ($productIds as $productId) {
    foreach ($packagings[$productId] as $packaging) {
        $detailRows = $grouped[$productId][$packaging->id] ?? [];
        
        // Priority 0: Tier pricing (if enabled + quantity matches)
        if ($tierEnabled && $tierPrice = $this->tierResolver->resolve($productId, $packaging->id, $qty)) {
            use $tierPrice; continue;
        }
        
        // Priority 1: Override (is_override=true, sales_price > 0)
        $override = collect($detailRows)
            ->where('is_override', true)
            ->filter(fn($r) => $r->sales_price > 0)
            ->first();
        
        if ($override) { use $override->sales_price; continue; }
        
        // Priority 2: Standard (is_override=false, sales_price > 0)
        $standard = collect($detailRows)
            ->where('is_override', false)
            ->filter(fn($r) => $r->sales_price > 0)
            ->first();
        
        if ($standard) { use $standard->sales_price; continue; }
        
        // Priority 3: Linear fallback (non-colisage only)
        if (!$hasColisage) { use base_price × packaging.quantity; continue; }
        
        // Colisage with no price → NULL
        return null; // source: colisage_unpriced
    }
}
```

---

## PaymentMethod vs PaymentTerm: Independent Dimensions

In the order context, **PaymentMethod** and **PaymentTerm** are independent dimensions that serve different purposes:

| Dimension | Model | Purpose | Examples |
|-----------|-------|---------|----------|
| **PaymentTerm** | `App\Models\PaymentTerm` | Defines *when* payment is due (timing/schedule) | Immediate, NET30, End of Month, 60 days |
| **PaymentMethod** | `App\Models\PaymentMethod` | Defines *how* payment is made (instrument) | Cash, Cheque, LCI, Virement (bank transfer) |

An order carries both: `payment_term_id` (timing) and `payment_method_id` (instrument). They are validated independently — a partner may be restricted to Cash-only (method) while still having NET30 terms (timing), or vice versa.

Both dimensions use the same `DataScopingService` hierarchical access control (5-level cascade, partner intersection, precomputed allow list), but their enforcement parameters are separate:
- `sales.payment_method.enforced` — controls PaymentMethod validation (OFF / WARNING / BLOCK)
- `sales.payment_method.enforced` — also used for PaymentTerm enforcement (legacy naming)

---

## Quick Reference Card

| Concept | Value |
|---------|-------|
| **Table** | `price_list_line_details` (single source of truth) |
| **Unique Key** | `(price_list_id, line_number, product_id, packaging_id)` |
| **Override Flag** | `is_override = true` → promotional price |
| **Standard Flag** | `is_override = false` → base price |
| **Tier Pricing** | `product_pricing_tiers` → volume-based discounts |
| **Partner Override (L1)** | `partner_price_overrides` → surgical per-(partner, product) exceptions |
| **Channel Fallback** | `channels.price_list_id` when `partners.price_list_id` is null |
| **Colisage Gate** | `has_colisage = true` → NO linear fallback allowed |
| **Linear Fallback** | `base_price × qty` — only for `has_colisage = false` |
| **Rounding** | BCMath: `round(price / step) * step` |
| **Clamping** | `min_sales_price <= price <= max_sales_price` |
| **DB Queries** | Exactly 1 flat JOIN + 1 overrides query via `resolveBatch()` |
| **Config Params** | `pricing.tier_based.enabled`, `pricing.validity_date_check`, `pricing.currency_rounding` |
| **Service** | `App\Services\Pricing\PartnerProductPriceResolver` |
| **Algorithm Version** | 5 |
