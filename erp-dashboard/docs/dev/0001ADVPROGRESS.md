# Module 14 — ADV (Administrateur de Vente)

> **Audience:** Frontend developers consuming the ADV API  
> **Base URL:** `https://api.omni360.cloud/api/backend`  
> **Auth:** All endpoints require `Authorization: Bearer <token>` and the user must hold the `adv` role (or `root` / `admin`)

---

## Table of Contents

1. [What is ADV?](#1-what-is-adv)
2. [Order (BC) State Machine](#2-order-bc-state-machine)
3. [Authentication](#3-authentication)
4. [Dashboard](#4-dashboard)
5. [BC — Bon de Commande](#5-bc--bon-de-commande)
   - [List BCs (master-detail view)](#51-list-bcs)
   - [Pending BCs](#52-pending-bcs)
   - [BC Detail](#53-bc-detail)
   - [Balance Check](#54-balance-check)
   - [Approve BC](#55-approve-bc)
   - [Reject BC](#56-reject-bc)
   - [Hold BC](#57-hold-bc)
   - [Resume BC](#58-resume-bc)
   - [Batch Approve](#59-batch-approve)
6. [Partners](#6-partners)
   - [Pending Partners](#61-pending-partners)
   - [Partner Detail](#62-partner-detail)
   - [Validate Partner](#63-validate-partner)
   - [Reject Partner](#64-reject-partner)
7. [Credit Management](#7-credit-management)
   - [Credit List](#71-credit-list)
   - [Update Credit Limit](#72-update-credit-limit)
   - [Block Partner](#73-block-partner)
   - [Unblock Partner](#74-unblock-partner)
8. [Écheances (Due Dates)](#8-écheances)
9. [Credit Derogations](#9-credit-derogations)
   - [List Derogations](#91-list-derogations)
   - [Derogation Detail](#92-derogation-detail)
   - [Request Derogation](#93-request-derogation)
   - [Approve Derogation](#94-approve-derogation)
   - [Reject Derogation](#95-reject-derogation)
10. [Error Handling](#10-error-handling)
11. [TypeScript Interfaces](#11-typescript-interfaces)
12. [End-to-End Workflow Examples](#12-end-to-end-workflow-examples)

---

## 1. What is ADV?

ADV (**Administrateur de Vente**, or Sales Administrator) is the commercial validation gate in FoodSolution's B2B order lifecycle. Every BC (Bon de Commande / purchase order) created by a salesperson or partner must be validated by an ADV agent before it flows to the dispatcher.

ADV is responsible for:

| Responsibility | Description |
|---|---|
| **BC Validation** | Review, approve, reject, or put on hold incoming orders |
| **Credit Control** | Check if a partner's order stays within their credit limit |
| **Credit Derogations** | Authorize exceptions when a partner exceeds their credit limit |
| **Partner Onboarding** | Activate or reject new partner registrations |
| **Écheances** | Monitor outstanding invoices and overdue payments |

---

## 2. Order (BC) State Machine

```
Salesperson                 ADV                       Dispatcher
─────────────────────────────────────────────────────────────────
draft
  │
  └─[submit]──────────► submitted
                            │
                       in_review ◄──────────[resume]──── on_hold
                            │                                │
                    ┌───────┼──────────────┐        [hold]──┘
                    │       │              │
               [approve]  [reject]   [credit limit
                    │       │         exceeded]
                    │       │              │
                 confirmed rejected  pending_derogation
                    │                     │
                    │              [approve_derogation]
                    ▼                     │
              Dispatcher ◄───────────────┘
```

**Status values** used in filters and response fields:

| Value | Meaning |
|---|---|
| `draft` | BC being built by salesperson |
| `submitted` | Submitted to ADV queue |
| `in_review` | ADV is actively reviewing |
| `on_hold` | ADV paused — waiting for information |
| `pending_derogation` | Credit exceeded; derogation pending |
| `confirmed` | ADV approved; ready for dispatcher |
| `rejected` | Rejected by ADV |

---

## 3. Authentication

All ADV endpoints sit behind `POST /backend/login`. The token is a Laravel Sanctum Bearer token.

```bash
curl -X POST https://api.omni360.cloud/api/backend/login \
  -H "Content-Type: application/json" \
  -d '{"email":"adv@foodsolution.com","password":"secret"}'
```

**Response:**
```json
{
  "token": "1|abc123xyz...",
  "user": {
    "id": 12,
    "name": "Fatima ADV",
    "email": "adv@foodsolution.com",
    "roles": ["adv"]
  }
}
```

Use the token in every subsequent request:
```
Authorization: Bearer 1|abc123xyz...
```

---

## 4. Dashboard

### `GET /backend/adv/dashboard`

Returns KPI counters and alert lists for the ADV home screen.

```bash
curl -X GET https://api.omni360.cloud/api/backend/adv/dashboard \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:**
```json
{
  "stats": {
    "pending_partners": 3,
    "pending_review": 14,
    "on_hold": 2,
    "pending_derogations": 1,
    "confirmed_today": 8,
    "blocked_partners": 0,
    "total_credit_exposure": 4250000.00,
    "available_credit": 1750000.00
  },
  "recentPartners": [
    {
      "id": 45,
      "code": "PAR-00045",
      "name": "Épicerie Al Wafa",
      "status": "PENDING",
      "email": "contact@alwafa.ma",
      "created_at": "2026-06-14T08:22:00Z"
    }
  ],
  "creditAlerts": [
    {
      "id": 12,
      "code": "PAR-00012",
      "name": "Supermarché Atlas",
      "credit_limit": 500000.00,
      "credit_used": 487000.00,
      "status": "ACTIVE"
    }
  ]
}
```

**Field guide:**

| Field | Type | Description |
|---|---|---|
| `stats.pending_review` | `number` | BCs in `submitted` or `in_review` state |
| `stats.pending_derogations` | `number` | Credit derogation requests awaiting decision |
| `stats.total_credit_exposure` | `number` | Sum of `credit_used` across all active partners |
| `stats.available_credit` | `number` | Sum of (`credit_limit - credit_used`) across all active partners |
| `creditAlerts` | `Partner[]` | Partners at ≥ 90% credit utilization |

---

## 5. BC — Bon de Commande

> **Important:** Read actions use `GET /backend/adv/bc/*`. Write actions (approve, reject, hold, resume) go through the generic workflow engine at `POST /backend/workflow/bon-commande/{id}/execute`.

---

### 5.1 List BCs

`GET /backend/adv/bc`

Returns a paginated list of BCs that need ADV attention, enriched with logistics summaries. Designed for a master-detail split view.

**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `status` | `string` | Filter by `bc_status`. Use `all` to disable filter. Values: `submitted`, `in_review`, `on_hold`, `pending_derogation` |
| `search` | `string` | Search by `order_code`, `bc_number`, partner `name` or `code` |
| `partner_id` | `number` | Filter by partner ID |
| `date_from` | `date` | Filter created_at ≥ date (format `YYYY-MM-DD`) |
| `date_to` | `date` | Filter created_at ≤ date |
| `amount_min` | `number` | Filter total_amount ≥ value |
| `amount_max` | `number` | Filter total_amount ≤ value |
| `page` | `number` | Page number (default 1, 20 per page) |

```bash
curl -X GET "https://api.omni360.cloud/api/backend/adv/bc?status=submitted&page=1" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:**
```json
{
  "bcs": {
    "current_page": 1,
    "per_page": 20,
    "total": 14,
    "data": [
      {
        "id": 201,
        "order_code": "BC-2026-00201",
        "bc_status": "submitted",
        "total_amount": 127500.00,
        "priority": "normal",
        "is_credit_sale": true,
        "is_overdue": false,
        "is_urgent": false,
        "items_count": 6,
        "created_at": "2026-06-14T10:30:00Z",
        "partner": {
          "id": 12,
          "code": "PAR-00012",
          "name": "Supermarché Atlas",
          "credit_limit": 500000.00,
          "credit_used": 487000.00,
          "status": "ACTIVE"
        },
        "payment_term": {
          "id": 3,
          "name": "30 jours net",
          "days": 30
        },
        "logistics_summary": {
          "total_weight_kg": 842.5,
          "total_volume_m3": 3.2,
          "data_completeness": "complete",
          "missing_issue_count": 0,
          "weight_evaluable": true,
          "volume_evaluable": true
        }
      }
    ]
  },
  "stats": {
    "pending_review": 14,
    "on_hold": 2,
    "pending_derogation": 1,
    "confirmed_today": 8,
    "overdue": 5
  },
  "partners": [
    { "id": 12, "name": "Supermarché Atlas", "code": "PAR-00012" }
  ]
}
```

**`logistics_summary.data_completeness` values:**

| Value | Meaning |
|---|---|
| `complete` | All products have logistics profiles |
| `partial` | Some products missing weight/volume data |
| `unavailable` | No logistics data |

---

### 5.2 Pending BCs

`GET /backend/adv/bc/pending`

Lightweight list of BCs in `submitted` or `in_review` only. Includes per-order logistics summary but no stats block.

**Query parameters:** `search`, `page`

```bash
curl -X GET "https://api.omni360.cloud/api/backend/adv/bc/pending?search=Atlas" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:** Same paginated shape as `bcIndex` but without `stats` and `partners` keys — the root object is the pagination envelope directly.

---

### 5.3 BC Detail

`GET /backend/adv/bc/{id}`

Full detail view for a single BC. Includes per-line stock availability, credit status, logistics per line, and partner statistics.

```bash
curl -X GET https://api.omni360.cloud/api/backend/adv/bc/201 \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:**
```json
{
  "bc": {
    "id": 201,
    "order_code": "BC-2026-00201",
    "bc_status": "submitted",
    "total_amount": 127500.00,
    "bc_notes": "Commande urgente pour réapprovisionnement",
    "is_credit_sale": true,
    "order_date": "2026-06-14",
    "due_date": "2026-07-14",
    "created_at": "2026-06-14T10:30:00Z",
    "approved_by": null,
    "approved_at": null,
    "rejected_by": null,
    "rejected_at": null,
    "reject_reason": null,
    "partner": {
      "id": 12,
      "code": "PAR-00012",
      "name": "Supermarché Atlas",
      "credit_limit": 500000.00,
      "credit_used": 487000.00,
      "status": "ACTIVE"
    },
    "payment_term": {
      "id": 3,
      "name": "30 jours net",
      "days": 30
    },
    "order_products": [
      {
        "id": 1001,
        "product_id": 55,
        "quantity": 20,
        "unit_price": 3500.00,
        "total_price": 70000.00,
        "out_of_stock": false,
        "available_stock_quantity": 145.0,
        "product": {
          "id": 55,
          "name": "Huile Végétale 5L",
          "sku": "HUI-VEG-5L"
        },
        "packaging": {
          "id": 2,
          "name": "Carton 6 unités"
        },
        "logistics_line": {
          "line_base_quantity": 20.0,
          "share_of_product_quantity": 1.0,
          "shipping_level": "carton",
          "physical_packages_estimate": 3.33,
          "line_gross_weight_kg_estimate": 110.0,
          "line_volume_m3_estimate": 0.42,
          "packaging": { "label": "Carton 6×5L", "units_per_package": 6 },
          "profile_flags": {
            "temperature_profile_code": "ambient",
            "load_category": "standard"
          },
          "shipping_constraints": {
            "temperature_profile_code": "ambient",
            "load_category": "standard"
          },
          "missing_reason": null
        }
      }
    ],
    "workflow_instance": {
      "id": 88,
      "current_step": { "name": "adv_validation", "label": "Validation ADV" },
      "transitions": [
        {
          "id": 201,
          "from_state": "submitted",
          "to_state": "in_review",
          "created_at": "2026-06-14T10:35:00Z",
          "performed_by": { "id": 12, "name": "Fatima ADV" }
        }
      ]
    }
  },
  "stockAvailable": true,
  "creditOk": false,
  "creditExceeded": true,
  "excessAmount": 14500.00,
  "pendingDerogation": null,
  "partnerStats": {
    "total_orders": 47,
    "pending_bcs": 2,
    "avg_order_value": 95000.00
  },
  "logistics_aggregate": {
    "total_weight_kg": 842.5,
    "total_volume_m3": 3.2,
    "data_completeness": "complete",
    "missing_issue_count": 0,
    "weight_evaluable": true,
    "volume_evaluable": true,
    "per_product": {}
  }
}
```

**Key fields:**

| Field | Type | Description |
|---|---|---|
| `stockAvailable` | `boolean` | `true` if all lines have sufficient stock |
| `creditOk` | `boolean` | `false` if the order would exceed the partner's credit limit |
| `creditExceeded` | `boolean` | Same as `!creditOk` |
| `excessAmount` | `number` | Amount by which credit would be exceeded (0 if not exceeded) |
| `pendingDerogation` | `object\|null` | Existing pending derogation request for this BC, if any |
| `order_products[].out_of_stock` | `boolean` | `true` if current stock is insufficient for this line |
| `order_products[].available_stock_quantity` | `number` | Live available quantity from the stocks table |
| `order_products[].logistics_line.missing_reason` | `string\|null` | `null` = data present; `"missing_product_logistics_profile"` = no logistics data |

---

### 5.4 Balance Check

`GET /backend/adv/bc/{id}/balance-check`

Standalone credit and stock check for a single BC. Use this to refresh the balance status without fetching the full BC detail.

```bash
curl -X GET https://api.omni360.cloud/api/backend/adv/bc/201/balance-check \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:**
```json
{
  "stock_ok": true,
  "credit_ok": false,
  "details": {
    "credit_limit": 500000.00,
    "credit_used": 487000.00,
    "order_amount": 127500.00,
    "total_exposure": 614500.00,
    "credit_exceeded_by": 114500.00
  }
}
```

---

### 5.5 Approve BC

BC mutations go through the **workflow engine**, not the `/adv/bc` prefix.

```
POST /backend/workflow/bon-commande/{id}/execute
```

**Required headers:**

| Header | Value |
|---|---|
| `Authorization` | `Bearer {TOKEN}` |
| `Content-Type` | `application/json` |
| `Idempotency-Key` | A unique string per action attempt (e.g. `bon-commande:201:approve:1718358000`) |

```bash
curl -X POST https://api.omni360.cloud/api/backend/workflow/bon-commande/201/execute \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bon-commande:201:approve:1718358000" \
  -d '{
    "decision": "finalize_sale",
    "comment": "Stock vérifié, crédit accordé."
  }'
```

**Request body:**

| Field | Required | Type | Description |
|---|---|---|---|
| `decision` | yes | `string` | Must be `"finalize_sale"` |
| `comment` | no | `string` | max 500 chars |

**Response `200`:**
```json
{
  "success": true,
  "message": "BC confirmé avec succès",
  "data": {
    "order_id": 201,
    "order_code": "BC-2026-00201",
    "bc_status": "confirmed",
    "approved_by": 12,
    "approved_at": "2026-06-15T09:14:00Z"
  }
}
```

**Response `422` — decision blocked:**
```json
{
  "success": false,
  "message": "La décision est bloquée par une ou plusieurs contraintes",
  "constraints": [
    {
      "name": "credit_check",
      "reason": "Le partenaire dépasse sa limite de crédit de 14 500 MAD. Une dérogation est requise.",
      "context": {
        "credit_limit": 500000,
        "credit_used": 487000,
        "order_amount": 127500
      }
    }
  ]
}
```

---

### 5.6 Reject BC

```bash
curl -X POST https://api.omni360.cloud/api/backend/workflow/bon-commande/201/execute \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bon-commande:201:reject:1718358100" \
  -d '{
    "decision": "reject_sale",
    "reason": "Documents partenaire invalides. Veuillez fournir un RIB bancaire à jour."
  }'
```

**Request body:**

| Field | Required | Type | Description |
|---|---|---|---|
| `decision` | yes | `string` | Must be `"reject_sale"` |
| `reason` | yes | `string` | min 10, max 1000 chars |

**Response `200`:**
```json
{
  "success": true,
  "message": "BC rejeté",
  "data": {
    "order_id": 201,
    "bc_status": "rejected",
    "rejected_by": 12,
    "rejected_at": "2026-06-15T09:20:00Z",
    "reject_reason": "Documents partenaire invalides. Veuillez fournir un RIB bancaire à jour."
  }
}
```

---

### 5.7 Hold BC

Put a BC on hold while waiting for additional information. The BC moves from `submitted` / `in_review` → `on_hold`.

```bash
curl -X POST https://api.omni360.cloud/api/backend/workflow/bon-commande/201/execute \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bon-commande:201:hold:1718358200" \
  -d '{
    "decision": "hold_order",
    "reason": "En attente du certificat fiscal 2026 du partenaire."
  }'
```

**Request body:**

| Field | Required | Type | Description |
|---|---|---|---|
| `decision` | yes | `string` | Must be `"hold_order"` |
| `reason` | yes | `string` | min 10, max 1000 chars |

**Response `200`:**
```json
{
  "success": true,
  "message": "BC mis en attente",
  "data": {
    "order_id": 201,
    "bc_status": "on_hold"
  }
}
```

---

### 5.8 Resume BC

Resume a BC from `on_hold` → `in_review`.

```bash
curl -X POST https://api.omni360.cloud/api/backend/workflow/bon-commande/201/execute \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bon-commande:201:resume:1718360000" \
  -d '{
    "decision": "resume_order",
    "comment": "Document reçu et validé."
  }'
```

**Request body:**

| Field | Required | Type | Description |
|---|---|---|---|
| `decision` | yes | `string` | Must be `"resume_order"` |
| `comment` | no | `string` | max 500 chars |

**Response `200`:**
```json
{
  "success": true,
  "message": "BC remis en révision",
  "data": {
    "order_id": 201,
    "bc_status": "in_review"
  }
}
```

---

### 5.9 Batch Approve

Approve up to 50 BCs in a single call.

```
POST /backend/adv/bc/batch-approve
```

```bash
curl -X POST https://api.omni360.cloud/api/backend/adv/bc/batch-approve \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "bc_ids": [201, 202, 205],
    "comment": "Validation groupée après vérification crédit"
  }'
```

**Request body:**

| Field | Required | Type | Description |
|---|---|---|---|
| `bc_ids` | yes | `number[]` | IDs of BCs to approve (max 50) |
| `comment` | no | `string` | max 500 chars |

**Response `200`:**
```json
{
  "success": true,
  "message": "2 BCs confirmés, 1 échoué",
  "results": {
    "success": [
      { "id": 201, "bc_number": "BC-2026-00201" },
      { "id": 202, "bc_number": "BC-2026-00202" }
    ],
    "failed": [
      {
        "id": 205,
        "bc_number": "BC-2026-00205",
        "reason": "Credit limit exceeded — derogation required"
      }
    ]
  }
}
```

> **Note:** The batch endpoint does not use idempotency middleware. Each BC that fails is reported individually in `results.failed`; successfully processed BCs are not rolled back.

---

## 6. Partners

### 6.1 Pending Partners

`GET /backend/adv/partners/pending`

Returns all partners with `status = PENDING`, paginated (20/page).

**Query parameters:** `search` (name, code, email), `page`

```bash
curl -X GET "https://api.omni360.cloud/api/backend/adv/partners/pending?search=Wafa" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:**
```json
{
  "current_page": 1,
  "per_page": 20,
  "total": 3,
  "data": [
    {
      "id": 45,
      "code": "PAR-00045",
      "name": "Épicerie Al Wafa",
      "email": "contact@alwafa.ma",
      "phone": "+212 6 12 34 56 78",
      "status": "PENDING",
      "credit_limit": 0,
      "credit_used": 0,
      "created_at": "2026-06-14T08:22:00Z"
    }
  ]
}
```

---

### 6.2 Partner Detail

`GET /backend/adv/partners/{id}`

Returns partner with `geoArea` and `paymentTerms` relations.

```bash
curl -X GET https://api.omni360.cloud/api/backend/adv/partners/45 \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:**
```json
{
  "id": 45,
  "code": "PAR-00045",
  "name": "Épicerie Al Wafa",
  "email": "contact@alwafa.ma",
  "status": "PENDING",
  "credit_limit": 0,
  "credit_used": 0,
  "geo_area": {
    "id": 7,
    "name": "Casablanca Centre"
  },
  "payment_terms": [
    { "id": 3, "name": "30 jours net", "days": 30 }
  ],
  "created_at": "2026-06-14T08:22:00Z"
}
```

---

### 6.3 Validate Partner

`POST /backend/adv/partners/{id}/validate`

Activates a pending partner (sets `status = ACTIVE`).

```bash
curl -X POST https://api.omni360.cloud/api/backend/adv/partners/45/validate \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"comment": "Documents vérifiés et conformes."}'
```

**Request body:**

| Field | Required | Type | Description |
|---|---|---|---|
| `comment` | no | `string` | max 500 chars |

**Response `200`:**
```json
{
  "success": true,
  "message": "Partner validated successfully",
  "data": {
    "id": 45,
    "name": "Épicerie Al Wafa",
    "status": "ACTIVE"
  }
}
```

---

### 6.4 Reject Partner

`POST /backend/adv/partners/{id}/reject`

Sets partner `status = REJECTED`.

```bash
curl -X POST https://api.omni360.cloud/api/backend/adv/partners/45/reject \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Registre de commerce expiré. Veuillez renouveler votre RC avant de soumettre à nouveau."}'
```

**Request body:**

| Field | Required | Type | Description |
|---|---|---|---|
| `reason` | yes | `string` | min 10, max 1000 chars |

**Response `200`:**
```json
{
  "success": true,
  "message": "Partner rejected",
  "data": {
    "id": 45,
    "name": "Épicerie Al Wafa",
    "status": "REJECTED"
  }
}
```

---

## 7. Credit Management

### 7.1 Credit List

`GET /backend/adv/credit`

Lists active partners ordered by `credit_used` descending. Use for credit exposure monitoring.

**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `search` | `string` | Filter by partner name or code |
| `credit_status` | `string` | `exceeded` → credit_used > credit_limit; `warning` → 90–100% utilization |
| `page` | `number` | Default 1, 20 per page |

```bash
curl -X GET "https://api.omni360.cloud/api/backend/adv/credit?credit_status=warning" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:** Paginated `Partner[]` with `credit_limit`, `credit_used`, `status` fields.

```json
{
  "current_page": 1,
  "per_page": 20,
  "total": 4,
  "data": [
    {
      "id": 12,
      "code": "PAR-00012",
      "name": "Supermarché Atlas",
      "credit_limit": 500000.00,
      "credit_used": 487000.00,
      "status": "ACTIVE"
    }
  ]
}
```

---

### 7.2 Update Credit Limit

`POST /backend/adv/credit/{id}/update-limit`

```bash
curl -X POST https://api.omni360.cloud/api/backend/adv/credit/12/update-limit \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "credit_limit": 600000,
    "reason": "Augmentation suite à 12 mois de paiement ponctuel."
  }'
```

**Request body:**

| Field | Required | Type | Description |
|---|---|---|---|
| `credit_limit` | yes | `number` | New credit limit (≥ 0) |
| `reason` | yes | `string` | min 10, max 500 chars |

**Response `200`:**
```json
{
  "success": true,
  "message": "Credit limit updated successfully",
  "data": {
    "id": 12,
    "name": "Supermarché Atlas",
    "credit_limit": 600000.00,
    "credit_used": 487000.00,
    "status": "ACTIVE"
  }
}
```

---

### 7.3 Block Partner

`POST /backend/adv/credit/{id}/block`

Sets partner `status = BLOCKED`, preventing them from placing new orders.

```bash
curl -X POST https://api.omni360.cloud/api/backend/adv/credit/12/block \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Factures impayées dépassant 90 jours."}'
```

**Request body:**

| Field | Required | Type | Description |
|---|---|---|---|
| `reason` | yes | `string` | min 10, max 500 chars |

**Response `200`:**
```json
{
  "success": true,
  "message": "Partner blocked successfully",
  "data": { "id": 12, "status": "BLOCKED" }
}
```

---

### 7.4 Unblock Partner

`POST /backend/adv/credit/{id}/unblock`

Restores partner `status = ACTIVE`.

```bash
curl -X POST https://api.omni360.cloud/api/backend/adv/credit/12/unblock \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"comment": "Solde apuré le 15/06/2026."}'
```

**Request body:**

| Field | Required | Type | Description |
|---|---|---|---|
| `comment` | no | `string` | max 500 chars |

**Response `200`:**
```json
{
  "success": true,
  "message": "Partner unblocked successfully",
  "data": { "id": 12, "status": "ACTIVE" }
}
```

---

## 8. Écheances

### `GET /backend/adv/echeances`

Lists invoices in `pending`, `partially_paid`, or `overdue` status, ordered by due date ascending.

**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `partner_id` | `number` | Filter by partner |
| `status` | `string` | `pending`, `partially_paid`, `overdue` |
| `date_from` | `date` | Due date ≥ |
| `date_to` | `date` | Due date ≤ |
| `overdue_only` | `boolean` | `true` to show only past-due invoices |
| `page` | `number` | Default 1, 20 per page |

```bash
curl -X GET "https://api.omni360.cloud/api/backend/adv/echeances?overdue_only=true" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:**
```json
{
  "echeances": {
    "current_page": 1,
    "per_page": 20,
    "total": 5,
    "data": [
      {
        "id": 301,
        "invoice_number": "FAC-2026-00301",
        "amount": 85000.00,
        "remaining_amount": 85000.00,
        "status": "overdue",
        "due_date": "2026-05-20",
        "partner": {
          "id": 12,
          "name": "Supermarché Atlas",
          "code": "PAR-00012"
        },
        "order": {
          "id": 201,
          "order_code": "BC-2026-00201"
        }
      }
    ]
  },
  "stats": {
    "total_overdue": 340000.00,
    "total_due_this_week": 120000.00,
    "overdue_count": 5
  }
}
```

---

## 9. Credit Derogations

A **credit derogation** is a formal exception request allowing an order to proceed even when the partner has exceeded their credit limit.

**Lifecycle:**
```
Order exceeds credit limit
         │
         ▼
   BC → pending_derogation
   CreditDerogation created (status: pending)
         │
         ├─[ADV approve]─► CreditDerogation: approved, BC: confirmed
         │
         └─[ADV reject]──► CreditDerogation: rejected, BC: rejected
```

---

### 9.1 List Derogations

`GET /backend/adv/derogations`

```bash
curl -X GET "https://api.omni360.cloud/api/backend/adv/derogations?status=pending" \
  -H "Authorization: Bearer {TOKEN}"
```

**Query parameters:** `status` (`pending`, `approved`, `rejected`), `search` (order_code or partner name), `page`

**Response `200`:**
```json
{
  "current_page": 1,
  "per_page": 20,
  "total": 1,
  "data": [
    {
      "id": 5,
      "status": "pending",
      "derogation_type": "credit_limit_override",
      "partner_credit_limit": 500000.00,
      "partner_credit_used": 487000.00,
      "order_amount": 127500.00,
      "total_exposure": 614500.00,
      "excess_amount": 114500.00,
      "justification": "Commande exceptionnelle pour Ramadan. Client stratégique avec 5 ans d'historique.",
      "review_comment": null,
      "created_at": "2026-06-15T08:00:00Z",
      "reviewed_at": null,
      "order": {
        "id": 201,
        "order_code": "BC-2026-00201",
        "bc_status": "pending_derogation"
      },
      "partner": {
        "id": 12,
        "name": "Supermarché Atlas",
        "code": "PAR-00012"
      },
      "requested_by": {
        "id": 8,
        "name": "Ahmed Vendeur"
      },
      "reviewed_by": null
    }
  ]
}
```

---

### 9.2 Derogation Detail

`GET /backend/adv/derogations/{id}`

```bash
curl -X GET https://api.omni360.cloud/api/backend/adv/derogations/5 \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:** Same shape as a single item in the list above.

---

### 9.3 Request Derogation

`POST /backend/adv/derogations/{order_id}/request`

Initiated by the ADV (or salesperson with permission) when credit is exceeded and a formal derogation is needed. Creates a `CreditDerogation` record and moves the BC to `pending_derogation`.

```bash
curl -X POST https://api.omni360.cloud/api/backend/adv/derogations/201/request \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "justification": "Commande exceptionnelle pour campagne Ramadan 2026. Partenaire stratégique avec 5 ans d'\''historique de paiement impeccable."
  }'
```

**Request body:**

| Field | Required | Type | Description |
|---|---|---|---|
| `justification` | yes | `string` | min 20, max 1000 chars |

**Response `200`:** Workflow execute response — `{ success, message, data }`.

---

### 9.4 Approve Derogation

`POST /backend/adv/derogations/{id}/approve`

Approves the credit override. The BC moves to `confirmed`.

```bash
curl -X POST https://api.omni360.cloud/api/backend/adv/derogations/5/approve \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"comment": "Approuvé — client VIP, historique de paiement solide."}'
```

**Request body:**

| Field | Required | Type | Description |
|---|---|---|---|
| `comment` | no | `string` | max 500 chars |

**Response `200`:**
```json
{
  "success": true,
  "message": "Dérogation approuvée",
  "data": {
    "derogation_id": 5,
    "status": "approved",
    "order_id": 201,
    "bc_status": "confirmed"
  }
}
```

---

### 9.5 Reject Derogation

`POST /backend/adv/derogations/{id}/reject`

Rejects the derogation. The BC moves to `rejected`.

```bash
curl -X POST https://api.omni360.cloud/api/backend/adv/derogations/5/reject \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Risque de crédit trop élevé. Solde en souffrance depuis 60 jours."}'
```

**Request body:**

| Field | Required | Type | Description |
|---|---|---|---|
| `reason` | yes | `string` | min 10, max 500 chars |

**Response `200`:**
```json
{
  "success": true,
  "message": "Dérogation rejetée",
  "data": {
    "derogation_id": 5,
    "status": "rejected",
    "order_id": 201,
    "bc_status": "rejected"
  }
}
```

---

## 10. Error Handling

All endpoints follow this error shape convention:

| HTTP Status | Meaning | When |
|---|---|---|
| `401` | Unauthenticated | Missing or expired Bearer token |
| `403` | Forbidden | Authenticated but missing `adv` role / permission |
| `404` | Not Found | Resource ID doesn't exist |
| `422` | Validation Error | Invalid request body or blocked decision |
| `500` | Server Error | Unexpected failure (check logs) |

**401 example:**
```json
{ "message": "Unauthenticated." }
```

**403 example:**
```json
{ "message": "This action is unauthorized." }
```

**422 validation error:**
```json
{
  "message": "The reason field is required.",
  "errors": {
    "reason": ["The reason field is required.", "The reason must be at least 10 characters."]
  }
}
```

**422 decision blocked (workflow):**
```json
{
  "success": false,
  "message": "La décision est bloquée",
  "constraints": [
    {
      "name": "partner_active_check",
      "reason": "Le partenaire est bloqué. Veuillez le débloquer avant de valider la commande.",
      "context": { "partner_status": "BLOCKED" }
    }
  ]
}
```

> When `422` comes back from a workflow execute call, always render `constraints[]` to the ADV user — each constraint explains precisely why the action is blocked.

---

## 11. TypeScript Interfaces

```typescript
// ─── Enums ───────────────────────────────────────────────────────────────────

type BcStatus =
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'on_hold'
  | 'pending_derogation'
  | 'confirmed'
  | 'rejected';

type PartnerStatus = 'PENDING' | 'ACTIVE' | 'BLOCKED' | 'REJECTED';

type DerogationStatus = 'pending' | 'approved' | 'rejected';

type DataCompleteness = 'complete' | 'partial' | 'unavailable';

// ─── Core Models ─────────────────────────────────────────────────────────────

interface Partner {
  id: number;
  code: string;
  name: string;
  email: string;
  phone?: string;
  status: PartnerStatus;
  credit_limit: number;
  credit_used: number;
  payment_term_id?: number;
  created_at: string;
}

interface PaymentTerm {
  id: number;
  name: string;
  days: number;
}

interface Product {
  id: number;
  name: string;
  sku: string;
}

interface LogisticsLine {
  line_base_quantity: number;
  share_of_product_quantity: number;
  shipping_level?: string;
  physical_packages_estimate?: number;
  line_gross_weight_kg_estimate?: number | null;
  line_volume_m3_estimate?: number | null;
  packaging?: { label: string; units_per_package: number };
  profile_flags?: {
    temperature_profile_code: string;
    load_category: string;
  };
  shipping_constraints: {
    temperature_profile_code: string | null;
    load_category: string | null;
  };
  missing_reason: string | null;
}

interface OrderProduct {
  id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  total_price: number;
  out_of_stock: boolean;
  available_stock_quantity: number;
  product: Product;
  packaging?: { id: number; name: string };
  logistics_line?: LogisticsLine;
}

interface LogisticsSummary {
  total_weight_kg: number | null;
  total_volume_m3: number | null;
  data_completeness: DataCompleteness;
  missing_issue_count: number;
  weight_evaluable: boolean;
  volume_evaluable: boolean;
}

interface WorkflowTransition {
  id: number;
  from_state: string;
  to_state: string;
  created_at: string;
  performed_by: { id: number; name: string };
}

interface WorkflowInstance {
  id: number;
  current_step: { name: string; label: string };
  transitions: WorkflowTransition[];
}

// ─── BC / Order ───────────────────────────────────────────────────────────────

interface BcListItem {
  id: number;
  order_code: string;
  bc_status: BcStatus;
  total_amount: number;
  priority: 'normal' | 'urgent';
  is_credit_sale: boolean;
  is_overdue: boolean;
  is_urgent: boolean;
  items_count: number;
  created_at: string;
  partner: Partner;
  payment_term?: PaymentTerm;
  logistics_summary: LogisticsSummary;
}

interface BcDetail {
  id: number;
  order_code: string;
  bc_status: BcStatus;
  total_amount: number;
  bc_notes?: string;
  is_credit_sale: boolean;
  order_date?: string;
  due_date?: string;
  created_at: string;
  approved_by?: number | null;
  approved_at?: string | null;
  rejected_by?: number | null;
  rejected_at?: string | null;
  reject_reason?: string | null;
  partner: Partner;
  payment_term?: PaymentTerm;
  order_products: OrderProduct[];
  workflow_instance?: WorkflowInstance;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

interface AdvDashboard {
  stats: {
    pending_partners: number;
    pending_review: number;
    on_hold: number;
    pending_derogations: number;
    confirmed_today: number;
    blocked_partners: number;
    total_credit_exposure: number;
    available_credit: number;
  };
  recentPartners: Partner[];
  creditAlerts: Partner[];
}

// ─── BC List Response ─────────────────────────────────────────────────────────

interface BcListStats {
  pending_review: number;
  on_hold: number;
  pending_derogation: number;
  confirmed_today: number;
  overdue: number;
}

interface BcIndexResponse {
  bcs: {
    current_page: number;
    per_page: number;
    total: number;
    data: BcListItem[];
  };
  stats: BcListStats;
  partners: Pick<Partner, 'id' | 'name' | 'code'>[];
}

// ─── BC Detail Response ───────────────────────────────────────────────────────

interface BcDetailResponse {
  bc: BcDetail;
  stockAvailable: boolean;
  creditOk: boolean;
  creditExceeded: boolean;
  excessAmount: number;
  pendingDerogation: CreditDerogation | null;
  partnerStats: {
    total_orders: number;
    pending_bcs: number;
    avg_order_value: number;
  };
  logistics_aggregate: LogisticsSummary & { per_product: Record<string, unknown> };
}

// ─── Balance Check ────────────────────────────────────────────────────────────

interface BalanceCheckResponse {
  stock_ok: boolean;
  credit_ok: boolean;
  details: {
    credit_limit: number;
    credit_used: number;
    order_amount: number;
    total_exposure: number;
    credit_exceeded_by: number;
  };
}

// ─── Workflow Execute ─────────────────────────────────────────────────────────

type BcDecision =
  | 'finalize_sale'
  | 'reject_sale'
  | 'hold_order'
  | 'resume_order'
  | 'request_credit_derogation';

interface WorkflowExecuteResponse {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

interface WorkflowConstraint {
  name: string;
  reason: string;
  context?: Record<string, unknown>;
}

interface WorkflowBlockedResponse {
  success: false;
  message: string;
  constraints: WorkflowConstraint[];
}

// ─── Credit Derogation ────────────────────────────────────────────────────────

interface CreditDerogation {
  id: number;
  status: DerogationStatus;
  derogation_type: 'credit_limit_override';
  partner_credit_limit: number;
  partner_credit_used: number;
  order_amount: number;
  total_exposure: number;
  excess_amount: number;
  justification: string;
  review_comment?: string | null;
  created_at: string;
  reviewed_at?: string | null;
  order: { id: number; order_code: string; bc_status: BcStatus };
  partner: Pick<Partner, 'id' | 'name' | 'code'>;
  requested_by: { id: number; name: string };
  reviewed_by?: { id: number; name: string } | null;
}

// ─── Écheances ────────────────────────────────────────────────────────────────

interface Invoice {
  id: number;
  invoice_number: string;
  amount: number;
  remaining_amount: number;
  status: 'pending' | 'partially_paid' | 'overdue';
  due_date: string;
  partner: Pick<Partner, 'id' | 'name' | 'code'>;
  order: { id: number; order_code: string };
}

interface EcheancesResponse {
  echeances: {
    current_page: number;
    per_page: number;
    total: number;
    data: Invoice[];
  };
  stats: {
    total_overdue: number;
    total_due_this_week: number;
    overdue_count: number;
  };
}
```

---

## 12. End-to-End Workflow Examples

### Example A — Normal BC Approval

```bash
# Step 1: ADV opens the BC list
curl "https://api.omni360.cloud/api/backend/adv/bc?status=submitted" \
  -H "Authorization: Bearer {TOKEN}"

# Step 2: ADV opens BC detail to review
curl "https://api.omni360.cloud/api/backend/adv/bc/201" \
  -H "Authorization: Bearer {TOKEN}"
# → creditOk: true, stockAvailable: true → safe to approve

# Step 3: ADV approves
curl -X POST "https://api.omni360.cloud/api/backend/workflow/bon-commande/201/execute" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bc:201:finalize_sale:$(date +%s)" \
  -d '{"decision":"finalize_sale","comment":"Validé après vérification."}'
# → bc_status becomes "confirmed"
# → Dispatcher can now create BL from this order
```

---

### Example B — Credit Limit Exceeded → Derogation Flow

```bash
# Step 1: ADV opens BC detail
curl "https://api.omni360.cloud/api/backend/adv/bc/201" \
  -H "Authorization: Bearer {TOKEN}"
# Response: creditExceeded: true, excessAmount: 14500.00

# Step 2: ADV cannot approve directly — must request derogation
curl -X POST "https://api.omni360.cloud/api/backend/adv/derogations/201/request" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "justification": "Client VIP avec 5 ans d'\''historique impeccable. Commande saisonnière exceptionnelle."
  }'
# → BC bc_status becomes "pending_derogation"
# → CreditDerogation record created (status: pending)

# Step 3: ADV (or supervisor) reviews the derogation
curl "https://api.omni360.cloud/api/backend/adv/derogations?status=pending" \
  -H "Authorization: Bearer {TOKEN}"

# Step 4a: Approve derogation
curl -X POST "https://api.omni360.cloud/api/backend/adv/derogations/5/approve" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"comment":"Approuvé. Limite temporaire accordée."}'
# → Derogation status: "approved"
# → BC bc_status becomes "confirmed"

# Step 4b: Or reject it
curl -X POST "https://api.omni360.cloud/api/backend/adv/derogations/5/reject" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Dépassement trop important. Solde en souffrance depuis 60 jours."}'
# → Derogation status: "rejected"
# → BC bc_status becomes "rejected"
```

---

### Example C — Hold and Resume

```bash
# ADV needs more info before deciding
curl -X POST "https://api.omni360.cloud/api/backend/workflow/bon-commande/201/execute" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bc:201:hold:$(date +%s)" \
  -d '{
    "decision": "hold_order",
    "reason": "En attente du certificat fiscal 2026. Veuillez le transmettre sous 48h."
  }'
# → bc_status: "on_hold"

# ... (partner sends document) ...

# ADV resumes the BC for review
curl -X POST "https://api.omni360.cloud/api/backend/workflow/bon-commande/201/execute" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bc:201:resume:$(date +%s)" \
  -d '{
    "decision": "resume_order",
    "comment": "Certificat fiscal reçu et validé."
  }'
# → bc_status: "in_review"
```

---

### Example D — Batch Approve Low-Risk BCs

```bash
# Get all submitted BCs
curl "https://api.omni360.cloud/api/backend/adv/bc?status=submitted" \
  -H "Authorization: Bearer {TOKEN}"
# → IDs: [201, 202, 203]

# Run balance check on each to confirm no credit issues
curl "https://api.omni360.cloud/api/backend/adv/bc/201/balance-check" -H "Authorization: Bearer {TOKEN}"
curl "https://api.omni360.cloud/api/backend/adv/bc/202/balance-check" -H "Authorization: Bearer {TOKEN}"
curl "https://api.omni360.cloud/api/backend/adv/bc/203/balance-check" -H "Authorization: Bearer {TOKEN}"

# Batch approve all clear BCs
curl -X POST "https://api.omni360.cloud/api/backend/adv/bc/batch-approve" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "bc_ids": [201, 202, 203],
    "comment": "Validation groupée — stock et crédit vérifiés."
  }'
```

---

### Example E — New Partner Onboarding

```bash
# Check pending partners
curl "https://api.omni360.cloud/api/backend/adv/partners/pending" \
  -H "Authorization: Bearer {TOKEN}"

# Review partner details
curl "https://api.omni360.cloud/api/backend/adv/partners/45" \
  -H "Authorization: Bearer {TOKEN}"

# Activate partner
curl -X POST "https://api.omni360.cloud/api/backend/adv/partners/45/validate" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"comment":"Documents vérifiés. RC et IF conformes."}'

# Set an initial credit limit
curl -X POST "https://api.omni360.cloud/api/backend/adv/credit/45/update-limit" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "credit_limit": 150000,
    "reason": "Limite initiale pour nouveau partenaire — classe B."
  }'
```

---

*Generated from source: `app/Http/Controllers/Backend/AdvController.php`, `routes/backend.php`, `app/Decisions/Adv/`, `app/Enums/BcStatus.php`*  
*Last updated: 2026-06-15*
