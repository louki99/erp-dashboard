# Module 16 — Magasinier (Warehouse Keeper)

> **Audience:** Frontend developers consuming the Magasinier API  
> **Base URL:** `https://api.omni360.cloud/api/backend`  
> **Auth:** `Authorization: Bearer <token>` — user must hold the `magasinier` or `preparateur` role (or `root` / `admin`)  
> **Idempotency:** Mutating endpoints that change state require `Idempotency-Key: <unique-string>` header

---

## Table of Contents

1. [What is the Magasinier?](#1-what-is-the-magasinier)
2. [Warehouse Pipeline Overview](#2-warehouse-pipeline-overview)
3. [Status Glossary](#3-status-glossary)
4. [Authentication](#4-authentication)
5. [Dashboard](#5-dashboard)
6. [Préparations (BP)](#6-préparations-bp)
   - [List Preparations](#61-list-preparations)
   - [Preparation Detail](#62-preparation-detail)
   - [Start Preparation](#63-start-preparation)
   - [Update Item Quantities](#64-update-item-quantities)
   - [Complete Preparation](#65-complete-preparation)
   - [Reject Preparation](#66-reject-preparation)
   - [Report Shortage (explicit)](#67-report-shortage-explicit)
   - [Continue Preparation (Rework)](#68-continue-preparation-rework)
7. [Batch Picking](#7-batch-picking)
8. [Stock Management](#8-stock-management)
   - [WMS Stock API (Epic 5/6/7)](#85-wms-stock-api-epic-567)
9. [BC → BP Exception Flow (feature-flagged)](#9-bc--bp-exception-flow-feature-flagged)
10. [Conventional Loading (SFA → Van)](#10-conventional-loading)
11. [Conventional Décharge Reconciliation (EOD Van → Depot)](#11-conventional-décharge-reconciliation-eod-van--depot)
12. [Décharge — Van → Depot Unloading](#12-décharge--van--depot-unloading)
13. [Returns Processing](#13-returns-processing)
14. [Generic Workflow Utility Endpoints](#14-generic-workflow-utility-endpoints)
15. [Error Handling](#15-error-handling)
16. [TypeScript Interfaces](#16-typescript-interfaces)
17. [End-to-End Workflow Examples](#17-end-to-end-workflow-examples)

---

## 1. What is the Magasinier?

The **Magasinier** (Warehouse Keeper) is the physical fulfillment role in FoodSolution's B2B logistics chain. They receive preparation orders (BP — Bon de Préparation) created by the Dispatcher and physically pick, prepare, and hand over goods to drivers.

| Responsibility | Description |
|---|---|
| **Execute Preparations (BP)** | Pick items from shelves per the BP — report quantities picked and any shortages |
| **Stock Management** | Monitor inventory levels, log movements, perform manual adjustments |
| **Batch Picking** | Consolidate multiple BLs into a single picking pass for efficiency |
| **Loading Handover** | Mark items as ready for loading; issue QR confirmation for conventional loading |
| **Returns Processing** | Receive and quality-check returned goods |
| **Décharge (van unload)** | Receive goods unloaded from a van back to the depot after a mission; release stock |

---

## 2. Warehouse Pipeline Overview

```
Dispatcher submits BCH
         │
         ▼ (Scenario B)
  BP created — status: pending
         │
   [Magasinier starts]
         │
         ▼
  BP: in_progress
  BLs: in_preparation
         │
   [update item quantities incrementally]
         │
   [complete preparation]
         │
         ├─── No shortage ──► BP: completed_full → BLs: ready → BCH: prepared
         │
         └─── Shortage ─────► BP: completed_partial → BCH: awaiting_shortage_review
                                      │
                               [Dispatcher: accept_partial_preparation]
                                      │
                              BP: shortage_accepted ──[auto-chained, same call]──►
                                      │
                              BP: shortage_split_done (backlog BC(s) re-injected for the
                                      │                 missing delta — see below)
                                      ▼
                                BLs: ready → BCH: ready
```

> **Added 2026-06-17 — shortage backlog re-injection (was previously a real gap):**
> Before this date, `accept_partial_preparation` left the BP parked at `shortage_accepted`
> and only *suggested* (via a `next_actions` hint, never enforced) that the dispatcher
> separately call `split_remaining_quantity`. Nothing forced that follow-up call and no event
> listener did it automatically — if the dispatcher didn't click it, the shortage quantity
> permanently vanished from the demand pipeline with no trace and no way to re-plan it.
>
> `AcceptPartialPreparationDecision::execute()` now **auto-chains** `split_remaining_quantity`
> immediately after acceptance (`app/Decisions/Dispatcher/AcceptPartialPreparationDecision.php:126-148`).
> Both decisions still run their own full `evaluate()`→`doExecute()`→workflow-transition cycle
> — exactly as if a dispatcher clicked both buttons back to back — so the workflow engine's
> state-machine validation is not bypassed. The API response from `accept_partial_preparation`
> now includes a `backlog` key holding the `split_remaining_quantity` result. The BP ends at
> `shortage_split_done`, not `shortage_accepted` — **if your frontend was polling/asserting on
> `shortage_accepted` as a terminal BP status, update it.**
>
> **Revised 2026-06-17 (same day, second pass) — harmonized with the rider-loading-shortage
> spec's "BC Child" decision:** the re-injected shortage was initially shipped as a **draft BL**
> (`parent_delivery_note_id` pointing at the original BL). That's been superseded the same day —
> it now creates a **new `Order`** instead (`bc_status: CONFIRMED`), via the new
> `App\Services\Warehouse\ShortageBacklogService`, called from
> `SplitRemainingQuantityDecision::doExecute()`. One backlog `Order` per distinct original
> `order_id` (grouping multiple shorted BL lines from the same BC into a single backlog BC).
> This lands directly in **`GET /backend/dispatcher/orders/pending` (Module 15 Workspace 1)** —
> the same pool a normal salesperson order takes, ready for the dispatcher to plan into a new DO
> on the next pass. No draft BL is created anymore for this path — **if your frontend was
> reading `accept_partial_preparation`'s `backlog.backorder_bls`/`backlog.backorder_bls_count`,
> those keys are gone; use `backlog.backlog_orders`/`backlog.backlog_orders_count` instead**, and
> each entry now has `id`/`order_code`/`parent_order_id`/`parent_order_code`/`items_count`/
> `total_quantity` (no `delivery_number`/`parent_delivery_note_id` anymore).

> **Added 2026-06-18 — branch scoping bugs fixed across the whole module:** the 3NF
> normalization migration dropped `branch_code` columns in favor of `branch_id` on several
> tables (`logistics_batches`, `orders`, `stocks`), but `MagasinierController` and several
> `app/Decisions/Warehouse/*` decisions were never updated and were silently querying/writing
> a column that no longer exists. **This affected real, frequently-used endpoints**: the
> dashboard's `lowStockItems`/`readyToPrepare` counts, the entire Stock List/Low Stock endpoints
> (§8.1/§8.2 returned wrong/empty results), `pendingPreparations`' Lot-linked BPs, and the manual
> Stock Adjustment audit trail (`StockMovement.branch_code` was being written as `null` on every
> adjustment). All fixed by resolving `branch_id`/`Branch::code` correctly per table. Also fixed:
> `POST /magasinier/stock/adjust` was resolving the wrong `Stock` row by passing `product_id`
> straight through as if it were `stocks.id` — a product can have multiple Stock rows (one per
> `warehouse_code`), so this now resolves the real row from `product_id` + `branch_id` +
> (optional) `warehouse_code` first. Finally, **`GET /magasinier/returns/pending` and
> `GET /magasinier/returns/{id}` were entirely broken** (`pendingReturns`/`showReturn` methods
> referenced by the route did not exist anywhere in the codebase — calling them threw a fatal
> error) — they are now implemented for real; see [§13](#13-returns-processing).

**Décharge (van unload) flow — separate from BP preparation:**
```
Rider finishes mission, BCH → completed/closed
    │
    ▼ [Dispatcher: create_decharge]
Décharge (UnloadOrder): pending — items = undelivered qty per product
    │
    ▼ [Magasinier: approve_decharge]
Décharge: approved — stock released back to depot, items marked stock_released
```

**Conventional Loading (separate flow):**
```
Salesperson submits LoadingRequest
    │
    ▼ (ADV approves) → stock reserved in depot zone
    │
    ▼ [Magasinier fulfills]
    │
LoadingRequest: fulfilled → QR issued
    │
    ▼ [Salesperson scans QR]
LoadingRequest: confirmed → CENTRAL→VAN stock transfer applied
```

**Conventional Décharge Reconciliation (EOD, separate from the above):**
```
Salesperson ends day with unsold van stock
    │
    ▼ [Magasinier scans QR + photo + physical count]
POST /conventional-decharge-reconciliation/{id}/confirm
    │
DechargeReconciliationRequest: reconciling
    │
    ▼ [Magasinier/Dispatcher: approve_decharge_reconciliation]
DechargeReconciliationRequest: approved — VAN→depot stock transfer executed
```

---

## 3. Status Glossary

### BP (Bon de Préparation) statuses

| Value | Meaning | Next action |
|---|---|---|
| `pending` | Awaiting Magasinier to start | Start preparation |
| `in_progress` | Magasinier is picking | Update items / complete |
| `completed_full` | All items prepared, no shortage | Done — BLs → ready |
| `completed_partial` | Shortage on some items | Dispatcher must balance |
| `partial_rework_requested` | Dispatcher requested rework | Magasinier reworks via `continue_preparation` |
| `awaiting_shortage_review` | Pending dispatcher decision (also reached via `report_shortage`) | Wait |
| `shortage_split_done` | Shortage items released back into Workspace 1 as a backlog BC (`Order`, `bc_status: confirmed`) | Ready for loading — terminal state for an accepted shortage |
| `shortage_accepted` | Dispatcher accepted shortage | Transient as of 2026-06-17 — immediately auto-chains to `shortage_split_done` in the same `accept_partial_preparation` call; only observable mid-transaction |
| `rejected` | Rejected by Magasinier | Dispatcher resubmits BCH |

### Décharge (UnloadOrder) statuses

| Value | Meaning | Next action |
|---|---|---|
| `pending` | Created by dispatcher, awaiting warehouse reception | Magasinier: `approve_decharge` |
| `approved` | Goods received, stock released back to depot | Terminal |

### DechargeReconciliationRequest (EOD conventional) statuses

| Value | Meaning | Next action |
|---|---|---|
| `reconciling` | Magasinier scanned QR + entered physical counts | `approve_decharge_reconciliation` |
| `approved` | VAN→depot transfer executed | Terminal |

### PartnerReturn statuses

> ⚠️ This replaces the legacy `BonRetour`/`return_orders` system (table dropped — see
> [§13](#13-returns-processing)).

| Value | Meaning | Next action |
|---|---|---|
| `PENDING_DIRECTION_APPROVAL` | Commercial return created, awaiting approval | Approver: `approve`/`reject` (out of Magasinier scope) |
| `APPROVED` | Approved | Dispatcher assigns a driver → `ASSIGNED_TO_DRIVER` |
| `REJECTED` | Rejected | Terminal |
| `ASSIGNED_TO_DRIVER` | Driver assigned to collect from partner | Driver: `collect` |
| `COLLECTED` | Driver collected the goods | Magasinier: `receive` |
| `RECEIVED_AT_WAREHOUSE` | Magasinier confirmed physical receipt | Magasinier (or dispatcher): `close` |
| `CLOSED` | Finalized, immutable | Terminal |
| `IMMEDIATE` | Immediate-type return (field return at delivery refusal), no approval gate | Reconciliation |
| `ROLLED_BACK` | Immediate return reversed | Terminal |
| `RECONCILED` | Immediate return reconciled | Terminal |

### Stock Movement types

| Value | Meaning |
|---|---|
| `purchase` | Stock received (achat) |
| `sale` | Stock consumed (vente) |
| `adjustment` | Manual correction |
| `reservation` | Reserved for an order |
| `reservation_release` | Reservation released |
| `transfer_in` | Received from another depot |
| `transfer_out` | Sent to another depot |
| `return` | Customer return received |

---

## 4. Authentication

```bash
curl -X POST https://api.omni360.cloud/api/backend/login \
  -H "Content-Type: application/json" \
  -d '{"email":"magasinier@foodsolution.com","password":"secret"}'
```

**Response:**
```json
{
  "token": "3|ghi789jkl...",
  "user": {
    "id": 15,
    "name": "Hassan Magasinier",
    "roles": ["magasinier"]
  }
}
```

---

## 5. Dashboard

### `GET /backend/magasinier/dashboard`

```bash
curl https://api.omni360.cloud/api/backend/magasinier/dashboard \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:**
```json
{
  "pendingPreparations": 3,
  "inProgress": 1,
  "completedToday": 7,
  "lowStockItems": 12,
  "readyToPrepare": 2,
  "pendingBps": [
    {
      "id": 88,
      "bp_number": "BP-2026-00088",
      "status": "pending",
      "bonChargement": { "id": 22, "shipment_number": "BCH-2026-00022" },
      "created_at": "2026-06-15T11:30:00Z"
    }
  ]
}
```

| Field | Description |
|---|---|
| `pendingPreparations` | BPs in `pending` status (branch-scoped) |
| `inProgress` | BPs in `in_progress` or `partial_rework_requested` |
| `completedToday` | BPs completed today |
| `lowStockItems` | Stock rows in this branch with `available_quantity < minimum_quantity` |
| `readyToPrepare` | Confirmed BCs not yet assigned to a BP (direct flow, see [§9](#9-bc--bp-exception-flow-feature-flagged)) |

> **Response shape note:** the JSON keys are flat (`pendingPreparations`, not nested under a
> `stats` object) — this matches the actual `compact(...)` call in
> `MagasinierController::dashboard()`.

---

## 6. Préparations (BP)

> Most BP mutations go through the workflow engine at `POST /backend/workflow/bon-preparation/{id}/execute` with a `decision` key. Direct PUT routes also exist as shortcuts that internally call the same decisions.

---

### 6.1 List Preparations

`GET /backend/magasinier/preparations/pending`

**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `scope` | `string` | `active` (default): pending + in_progress + partial_rework_requested; `rupture_watch`: adds completed_partial; `history`: completed_full/shortage_split_done/shortage_accepted/awaiting_shortage_review/rejected; `all`: everything |
| `status` | `string` | Override scope with exact status filter (comma-separated for multiple) |
| `search` | `string` | Search by BP number, BCH number, or batch number |
| `page` | `number` | Default 1, 20 per page |

```bash
curl "https://api.omni360.cloud/api/backend/magasinier/preparations/pending?scope=active" \
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
      "id": 88,
      "bp_number": "BP-2026-00088",
      "status": "pending",
      "total_items": 5,
      "prepared_items": 0,
      "total_shortage_percentage": 0,
      "is_critical_shortage": false,
      "priority_level": "normal",
      "deadline": null,
      "bonChargement": { "id": 22, "shipment_number": "BCH-2026-00022", "status": "in_preparation" },
      "logisticsBatch": null,
      "created_at": "2026-06-15T11:30:00Z"
    }
  ],
  "list_scope_applied": "active",
  "list_scope_help": {
    "active": "pending, in_progress, partial_rework_requested",
    "rupture_watch": "active + completed_partial (rupture signalée, attente dispatch)",
    "history": "completed_full, shortage_split_done, shortage_accepted, awaiting_shortage_review, rejected",
    "all": "all statuses for branch (read-only / audit screens)"
  }
}
```

---

### 6.2 Preparation Detail

`GET /backend/magasinier/preparations/{id}`

Full BP detail with driver info, delivery notes, and all items.

```bash
curl https://api.omni360.cloud/api/backend/magasinier/preparations/88 \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:**
```json
{
  "id": 88,
  "bp_number": "BP-2026-00088",
  "status": "pending",
  "total_items": 5,
  "prepared_items": 0,
  "preparation_efficiency": null,
  "notes": null,
  "rejection_reason": null,
  "priority_level": "normal",
  "deadline": null,
  "shortage_acknowledged": false,
  "bonChargement": {
    "id": 22,
    "shipment_number": "BCH-2026-00022",
    "status": "in_preparation",
    "livreur": { "id": 9, "name": "Youssef Livreur", "phone": "+212 6 00 11 22 33" }
  },
  "magasinier": null,
  "items": [
    {
      "id": 3001,
      "product_id": 55,
      "requested_quantity": 40,
      "available_quantity": 35,
      "prepared_quantity": 0,
      "shortage_quantity": 0,
      "shortage_reason": null,
      "delivery_note_item_id": 2001,
      "product": { "id": 55, "name": "Huile Végétale 5L", "sku": "HUI-VEG-5L" }
    },
    {
      "id": 3002,
      "product_id": 60,
      "requested_quantity": 24,
      "available_quantity": 24,
      "prepared_quantity": 0,
      "shortage_quantity": 0,
      "shortage_reason": null,
      "product": { "id": 60, "name": "Sucre 50kg", "sku": "SUC-50K" }
    }
  ],
  "logisticsBatch": null,
  "created_at": "2026-06-15T11:30:00Z"
}
```

---

### 6.3 Start Preparation

`GET /backend/magasinier/preparations/{id}/prepare`

Initiates the `start_preparation` decision. This assigns the Magasinier to the BP and transitions its status to `in_progress`.

```bash
curl https://api.omni360.cloud/api/backend/magasinier/preparations/88/prepare \
  -H "Authorization: Bearer {TOKEN}"
```

> This is a GET that triggers a decision (unusual pattern). Alternatively, use the workflow endpoint:

```bash
curl -X POST https://api.omni360.cloud/api/backend/workflow/bon-preparation/88/execute \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bp:88:start:$(date +%s)" \
  -d '{"decision": "start_preparation"}'
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Préparation démarrée",
  "data": {
    "bp_id": 88,
    "bp_number": "BP-2026-00088",
    "status": "in_progress",
    "magasinier_id": 15,
    "started_at": "2026-06-15T13:00:00Z"
  }
}
```

**Side effects:**
- BP status → `in_progress`
- All linked BLs status → `in_preparation`
- Logistics batch status → `in_preparation`
- Soft stock pre-check runs (warnings only — does not block)

---

### 6.4 Update Item Quantities

`PUT /backend/magasinier/preparations/{id}/items`

Incrementally update prepared quantities for individual items while picking is in progress. Can be called multiple times before completing. Internally calls the `update_preparation` decision.

```bash
curl -X PUT https://api.omni360.cloud/api/backend/magasinier/preparations/88/items \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bp:88:update-items:1718360000" \
  -d '{
    "items": [
      { "product_id": 55, "prepared_quantity": 25 },
      { "product_id": 60, "prepared_quantity": 24 }
    ]
  }'
```

**Request body:**

| Field | Required | Type | Description |
|---|---|---|---|
| `items` | yes | `array` | Items to update |
| `items[].product_id` | yes | `number` | Product ID |
| `items[].prepared_quantity` | yes | `number` | Quantity picked so far (≤ requested_quantity, ≤ physical stock) |

**Constraint:** `prepared_quantity` cannot exceed either the `requested_quantity` or the physically available stock in depot locations.

**Response `200`:**
```json
{
  "success": true,
  "message": "Quantités mises à jour",
  "data": {
    "bp_id": 88,
    "progress_percentage": 60,
    "updated_items": [
      { "product_id": 55, "prepared_quantity": 25, "shortage_quantity": 15 },
      { "product_id": 60, "prepared_quantity": 24, "shortage_quantity": 0 }
    ]
  }
}
```

---

### 6.5 Complete Preparation

`PUT /backend/magasinier/preparations/{id}/save`

Finalizes the preparation (`complete_preparation` decision). All item quantities must be set. If any `prepared_quantity < requested_quantity`, the BP is marked `completed_partial` (shortage).

```bash
curl -X PUT https://api.omni360.cloud/api/backend/magasinier/preparations/88/save \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bp:88:complete:1718360600" \
  -d '{
    "prepared_quantities": {
      "3001": 30,
      "3002": 24
    },
    "notes": "Rupture partielle sur Huile Végétale — stock insuffisant en magasin central."
  }'
```

**Request body:**

| Field | Required | Type | Description |
|---|---|---|---|
| `prepared_quantities` | yes | `object` | Map of `item_id → prepared_quantity` (all items must be included) |
| `notes` | no | `string` | General notes for the preparation |

**Constraint:** Each quantity must be ≥ 0 and ≤ `requested_quantity`. Total per item cannot exceed available stock.

**Response `200` — No shortage:**
```json
{
  "success": true,
  "message": "Préparation complète",
  "data": {
    "bp_id": 88,
    "bp_number": "BP-2026-00088",
    "status": "completed_full",
    "total_items": 5,
    "prepared_items": 5,
    "preparation_efficiency": 100.0,
    "total_shortage_percentage": 0,
    "prepared_at": "2026-06-15T14:30:00Z"
  }
}
```

**Response `200` — With shortage:**
```json
{
  "success": true,
  "message": "Préparation partielle enregistrée — rupture signalée",
  "data": {
    "bp_id": 88,
    "bp_number": "BP-2026-00088",
    "status": "completed_partial",
    "total_items": 5,
    "prepared_items": 4,
    "preparation_efficiency": 80.0,
    "total_shortage_percentage": 25.0,
    "is_critical_shortage": false,
    "prepared_at": "2026-06-15T14:30:00Z"
  }
}
```

**Side effects (no shortage):**
- BP → `completed_full`
- All linked BLs → `ready`
- BCH → `prepared`
- Stock deducted via `DeductStockAction`
- `PreparationCompletedEvent` fired

**Side effects (with shortage):**
- BP → `completed_partial`
- BCH → `awaiting_shortage_review`
- Dispatcher must run balance analysis and approve/split quantities

---

### 6.6 Reject Preparation

`POST /backend/magasinier/preparations/{id}/reject`

Reject a BP if preparation cannot be done (wrong items, safety issue, damaged goods, etc.). Internally calls the `reject_preparation` decision.

```bash
curl -X POST https://api.omni360.cloud/api/backend/magasinier/preparations/88/reject \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bp:88:reject:1718360700" \
  -d '{
    "rejection_reason": "Articles non conformes à la commande — référence produit incorrecte sur 3 lignes."
  }'
```

**Request body:**

| Field | Required | Type | Description |
|---|---|---|---|
| `rejection_reason` | yes | `string` | Detailed rejection reason |

**Response `200`:**
```json
{
  "success": true,
  "message": "BP rejeté",
  "data": {
    "bp_id": 88,
    "status": "rejected",
    "rejected_at": "2026-06-15T14:00:00Z",
    "rejection_reason": "Articles non conformes..."
  }
}
```

**Side effects:**
- BP → `rejected`
- BCH reverts → `pending`
- Linked BCs revert → `confirmed`
- Dispatcher can resubmit the BCH

---

### 6.7 Report Shortage (explicit)

`POST /backend/workflow/bon-preparation/{id}/execute` with `decision: "report_shortage"`

**Not previously documented.** An alternative, more granular way to declare a shortage mid-pick — rather than waiting until [Complete Preparation](#65-complete-preparation), the Magasinier can report a shortage on specific lines as soon as it's discovered. BP must be `pending` or `in_progress`.

```bash
curl -X POST https://api.omni360.cloud/api/backend/workflow/bon-preparation/88/execute \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bp:88:report-shortage:$(date +%s)" \
  -d '{
    "decision": "report_shortage",
    "metadata": {
      "shortage_items": [
        {
          "product_id": 55,
          "shortage_quantity": 10,
          "shortage_reason": "out_of_stock",
          "shortage_notes": "Rupture fournisseur",
          "can_fulfill_later": true,
          "estimated_availability": "2026-06-20"
        }
      ]
    }
  }'
```

**Request body (`metadata`):**

| Field | Required | Type | Description |
|---|---|---|---|
| `shortage_items` | yes | `array` | Lines in shortage |
| `shortage_items[].product_id` | yes | `number` | Must be a product already on this BP |
| `shortage_items[].shortage_quantity` | yes | `number` | > 0 |
| `shortage_items[].shortage_reason` | yes | `string` | Common values: `out_of_stock`, `critical_item`, `perishable`, `frozen` |
| `shortage_items[].shortage_notes` | no | `string` | Free text |
| `shortage_items[].can_fulfill_later` | no | `boolean` | |
| `shortage_items[].estimated_availability` | no | `date` | |

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "bp_id": 88,
    "bp_number": "BP-2026-00088",
    "bp_status": "awaiting_shortage_review",
    "total_requested": 64,
    "total_prepared": 54,
    "total_shortage": 10,
    "shortage_percentage": 15.63,
    "is_critical": false,
    "critical_items": [],
    "shortage_items": [
      { "product_id": 55, "shortage_quantity": 10, "reason": "out_of_stock" }
    ]
  }
}
```

`is_critical_shortage` becomes `true` when `shortage_percentage > 20` OR any line uses reason `critical_item`/`perishable`/`frozen`. BP → `awaiting_shortage_review` directly (skips `completed_partial`).

---

### 6.8 Continue Preparation (Rework)

`POST /backend/workflow/bon-preparation/{id}/execute` with `decision: "continue_preparation"`

**Not previously documented.** After a dispatcher requests rework (`request_rework` decision, BP → `partial_rework_requested`), the Magasinier picks the additional stock that's now become available and reports it here.

```bash
curl -X POST https://api.omni360.cloud/api/backend/workflow/bon-preparation/88/execute \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bp:88:continue:$(date +%s)" \
  -d '{
    "decision": "continue_preparation",
    "metadata": {
      "additional_items": [
        { "product_id": 55, "additional_quantity": 6 }
      ]
    }
  }'
```

**Request body (`metadata`):**

| Field | Required | Type | Description |
|---|---|---|---|
| `additional_items` | yes | `array` | |
| `additional_items[].product_id` | yes | `number` | |
| `additional_items[].additional_quantity` | yes | `number` | > 0, capped to the remaining shortage on that line |

**Guard:** BP must be `partial_rework_requested`. Each line is also capped to actual `available_quantity` in stock — if stock is still insufficient, that line is silently skipped (check `updated_items` in the response to see what was actually applied).

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "bp_id": 88,
    "bp_number": "BP-2026-00088",
    "bp_status": "completed_full",
    "previous_total_prepared": 54,
    "additional_prepared": 6,
    "new_total_prepared": 60,
    "new_total_shortage": 0,
    "new_shortage_percentage": 0,
    "is_now_complete": true,
    "updated_items": [
      {
        "product_id": 55,
        "product_name": "Huile Végétale 5L",
        "previous_prepared": 30,
        "additional_prepared": 6,
        "new_prepared": 36,
        "new_shortage": 4
      }
    ],
    "message": "Additional items prepared - shortage reduced but still exists"
  }
}
```

`bp_status` resolves to `completed_full` if shortage reaches zero, otherwise stays `completed_partial`.

---

## 7. Batch Picking

Batch picking consolidates multiple BLs into a single picking pass, improving warehouse efficiency.

---

### 7.1 Available BLs for Picking

`GET /backend/magasinier/batch-picking`

Returns BLs in `draft` or `preparing` status available for batch picking assignment.

```bash
curl https://api.omni360.cloud/api/backend/magasinier/batch-picking \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:**
```json
[
  {
    "id": 501,
    "delivery_number": "BL-2026-00501",
    "status": "draft",
    "partner": { "id": 12, "name": "Supermarché Atlas" },
    "items": [
      {
        "id": 2001,
        "product_id": 55,
        "quantity": 20,
        "product": { "id": 55, "name": "Huile Végétale 5L", "sku": "HUI-VEG-5L" }
      }
    ]
  }
]
```

> **Not paginated** — this endpoint returns a plain array via `->get()`, not a paginator. Don't expect `current_page`/`total` keys here.

---

### 7.2 Generate Picking List

`POST /backend/magasinier/batch-picking/generate`

Creates a `BatchPickingSession` from selected BLs (`generate_picking_list` decision). Items from all BLs are consolidated by product into a single picking list.

```bash
curl -X POST https://api.omni360.cloud/api/backend/magasinier/batch-picking/generate \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: batch-pick:generate:$(date +%s)" \
  -d '{
    "delivery_note_ids": [501, 502, 503]
  }'
```

**Request body:**

| Field | Required | Type | Description |
|---|---|---|---|
| `delivery_note_ids` | yes | `number[]` | BL IDs to include in this batch session |

> The controller sets `decision: "generate_picking_list"` itself — you don't need to send it.

**Response `200`:**
```json
{
  "success": true,
  "message": "Liste de picking créée",
  "data": {
    "session_id": 5,
    "bl_count": 3,
    "consolidated_items": [
      { "product_id": 55, "product_name": "Huile Végétale 5L", "sku": "HUI-VEG-5L", "total_quantity": 40 },
      { "product_id": 60, "product_name": "Sucre 50kg", "sku": "SUC-50K", "total_quantity": 24 }
    ]
  }
}
```

---

### 7.3 Distribute Picked Items

`GET /backend/magasinier/batch-picking/{sessionId}/distribute`

Returns the picking session with all BLs and the consolidated items form. Used by the Magasinier UI to enter picked quantities and distribute them back to individual BLs.

```bash
curl https://api.omni360.cloud/api/backend/magasinier/batch-picking/5/distribute \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:**
```json
{
  "session": { "id": 5, "status": "open" },
  "bls": [
    {
      "id": 501,
      "delivery_number": "BL-2026-00501",
      "partner": { "name": "Supermarché Atlas" },
      "items": [
        { "id": 2001, "product_id": 55, "quantity": 20 }
      ]
    }
  ],
  "consolidated_items": [
    {
      "product_id": 55,
      "product_name": "Huile Végétale 5L",
      "total_requested": 40,
      "distribution": [
        { "bl_id": 501, "bl_item_id": 2001, "requested": 20 },
        { "bl_id": 502, "bl_item_id": 2002, "requested": 20 }
      ]
    }
  ]
}
```

> **Field name note:** the real response key is `bls`, not `delivery_notes`.

---

### 7.4 Save Batch Preparation

`POST /backend/magasinier/batch-picking/{sessionId}/save`

Finalize the batch picking session (`complete_batch_picking` decision) by recording total picked quantities per product and the distribution per BL.

```bash
curl -X POST https://api.omni360.cloud/api/backend/magasinier/batch-picking/5/save \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: batch-pick:5:save:1718361000" \
  -d '{
    "prepared": {
      "55": 38,
      "60": 24
    },
    "distribution": [
      { "bl_item_id": 2001, "product_id": 55, "prepared_quantity": 20 },
      { "bl_item_id": 2002, "product_id": 55, "prepared_quantity": 18 },
      { "bl_item_id": 2003, "product_id": 60, "prepared_quantity": 24 }
    ]
  }'
```

**Request body:**

| Field | Required | Type | Description |
|---|---|---|---|
| `prepared` | yes | `object` | Map `product_id → total_picked_quantity` |
| `distribution` | yes | `array` | Per-BL allocation: `[{ bl_item_id, product_id, prepared_quantity }]` |

**Constraint:** `sum(distribution.prepared_quantity per product)` must equal `prepared[product_id]`.

**Response `200`:**
```json
{
  "success": true,
  "message": "Picking par lot finalisé",
  "data": {
    "session_id": 5,
    "bl_count": 3,
    "items_prepared": 3,
    "shortages": [
      { "product_id": 55, "requested": 40, "prepared": 38, "shortage": 2 }
    ]
  }
}
```

---

## 8. Stock Management

---

### 8.1 Stock List

`GET /backend/magasinier/stock`

Lists current inventory for the Magasinier's branch.

**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `search` | `string` | Filter by product name or SKU |
| `low_stock` | `boolean` | `true` to show only items below minimum |
| `out_of_stock` | `boolean` | `true` to show only items with `available_quantity ≤ 0` |
| `page` | `number` | Default 1, 50 per page |

```bash
curl "https://api.omni360.cloud/api/backend/magasinier/stock?low_stock=true" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:**
```json
{
  "current_page": 1,
  "per_page": 50,
  "total": 12,
  "data": [
    {
      "id": 101,
      "product_id": 55,
      "warehouse_code": "CASA-01",
      "quantity": 30,
      "reserved_quantity": 5,
      "available_quantity": 25,
      "minimum_quantity": 50,
      "maximum_quantity": 200,
      "product": {
        "id": 55,
        "name": "Huile Végétale 5L",
        "sku": "HUI-VEG-5L",
        "unit": "carton"
      }
    }
  ]
}
```

**Field guide:**

| Field | Description |
|---|---|
| `quantity` | Total physical quantity in warehouse |
| `reserved_quantity` | Reserved for active orders (cannot be used for new orders) |
| `available_quantity` | `quantity - reserved_quantity` — what's actually allocatable |
| `minimum_quantity` | Alert threshold — triggers low stock warning when `available_quantity < minimum_quantity` |

---

### 8.2 Low Stock Alerts

`GET /backend/magasinier/stock/low-stock`

Returns all products with `available_quantity < minimum_quantity`. Pagination 50/page.

```bash
curl https://api.omni360.cloud/api/backend/magasinier/stock/low-stock \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:** Same shape as Stock List but pre-filtered to low stock items.

---

### 8.3 Stock Movements

`GET /backend/magasinier/stock/movements`

Audit log of all stock movements, newest first.

**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `type` | `string` | Filter by movement type: `purchase`, `sale`, `adjustment`, `reservation`, `reservation_release`, `transfer_in`, `transfer_out`, `return` |
| `product_id` | `number` | Filter by product |
| `date_from` | `date` | Filter from date (YYYY-MM-DD) |
| `date_to` | `date` | Filter to date |
| `page` | `number` | Default 1, 50 per page |

```bash
curl "https://api.omni360.cloud/api/backend/magasinier/stock/movements?type=adjustment&date_from=2026-06-01" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:**
```json
{
  "current_page": 1,
  "per_page": 50,
  "total": 23,
  "data": [
    {
      "id": 5001,
      "type": "adjustment",
      "quantity": -10,
      "balance_after": 35,
      "notes": "Produits endommagés lors de l'inspection — retirés du stock vendable.",
      "product": { "id": 55, "name": "Huile Végétale 5L", "sku": "HUI-VEG-5L" },
      "user": { "id": 15, "name": "Hassan Magasinier" },
      "created_at": "2026-06-15T09:00:00Z"
    }
  ]
}
```

**Movement `quantity` sign convention:**

| Sign | Meaning |
|---|---|
| `+` (positive) | Stock increased (purchase, return, transfer_in, reservation_release) |
| `-` (negative) | Stock decreased (sale, adjustment↓, transfer_out, reservation) |

---

### 8.4 Manual Stock Adjustment

`POST /backend/magasinier/stock/adjust`

Manually correct inventory levels. Creates a `StockMovement` audit record with type `adjustment`. Internally resolves the real `Stock` row by `product_id` + your branch + (optional) `warehouse_code`, then calls the `adjust_stock` decision.

```bash
curl -X POST https://api.omni360.cloud/api/backend/magasinier/stock/adjust \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: stock:adjust:product-55:$(date +%s)" \
  -d '{
    "product_id": 55,
    "warehouse_code": "CASA-01",
    "adjustment_type": "subtract",
    "quantity": 10,
    "reason": "Produits endommagés lors du déchargement — 10 cartons inutilisables."
  }'
```

**Request body:**

| Field | Required | Type | Description |
|---|---|---|---|
| `product_id` | yes | `number` | Product to adjust |
| `warehouse_code` | recommended | `string` | Disambiguates which Stock row when a product has more than one in your branch. If omitted, the first matching row for your branch is used. |
| `adjustment_type` | yes | `string` | `add` — increase; `subtract` — decrease; `set` — set absolute value |
| `quantity` | yes | `number` | Quantity to add/subtract/set (≥ 0) |
| `reason` | yes | `string` | min 5 chars — justification for audit trail |

**Constraint:** For `subtract`, `quantity` must not exceed `available_quantity`.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "stock_id": 101,
    "product_id": 55,
    "branch_code": "CASA-01",
    "adjustment_type": "subtract",
    "quantity": 10,
    "old_quantity": 50,
    "new_quantity": 40,
    "available_quantity": 35
  }
}
```

**`404` — no matching Stock row:**
```json
{
  "success": false,
  "message": "No stock record found for this product/warehouse."
}
```

---

### 8.5 WMS Stock API (Epic 5/6/7)

**Not previously documented.** A separate, more granular Stock API exists alongside the simpler `/magasinier/stock/*` endpoints above. All routes below require role `root`, `admin`, `magasinier`, or `dispatcher` (some are `magasinier`-only as noted).

| Method | Path | Description |
|---|---|---|
| `GET` | `/backend/storage-locations` | List storage locations (shelves/zones) |
| `GET` | `/backend/storage-locations/tree` | Full location hierarchy (zone → aisle → shelf) |
| `GET` | `/backend/storage-locations/scan/{location_code}` | Scan a shelf barcode — returns location + its current stock |
| `GET` | `/backend/storage-locations/{storage_location}` | Single location detail |
| `GET` | `/backend/stocks` | Stock list (alternate, more filterable than §8.1) |
| `GET` | `/backend/stocks/summary` | Dashboard-style aggregate stats |
| `GET` | `/backend/stocks/low-stock` | Same concept as §8.2, alternate endpoint |
| `GET` | `/backend/stocks/scan/{barcode}` | Scan a product barcode — returns product + stock across locations |
| `GET` | `/backend/stocks/{product_id}` | Stock detail by product ID |
| `GET` | `/backend/stocks/location/{location_code}` | Stock at a specific location |
| `GET` | `/backend/stocks/branch/{branch_code}` | Stock for a specific branch |
| `GET` | `/backend/stock-movements` | Movement list (alternate, `magasinier`-only along with `root`/`admin`) |
| `POST` | `/backend/stock-movements/transfer` | Move stock between locations/warehouses |
| `POST` | `/backend/stock-movements/bulk-transfer` | Bulk version of the above |

```bash
curl https://api.omni360.cloud/api/backend/storage-locations/scan/A-12-03 \
  -H "Authorization: Bearer {TOKEN}"

curl https://api.omni360.cloud/api/backend/stocks/scan/3760123456789 \
  -H "Authorization: Bearer {TOKEN}"
```

> These are controller-level CRUD endpoints (`StorageLocationController`, `StockApiController`,
> `StockMovementApiController`), not workflow decisions — no `Idempotency-Key` required except
> where noted by the controller's own validation. Request/response shapes were not exhaustively
> verified for this doc pass; treat field names as indicative and confirm against a live response
> before building UI against them.

---

## 9. BC → BP Exception Flow (feature-flagged)

**Not previously documented.** Normally a BP is only created from BLs/a BCH via the Dispatcher (`POST /backend/dispatcher/preparations/from-bls` or `/from-bch/{bchId}`, Module 15). This is an **optional, disabled-by-default** shortcut that lets the Magasinier start preparation directly from a confirmed BC, bypassing the dispatcher.

> ⚠️ Gated by `config('warehouse.direct_preparation_enabled')` (default `false`). If disabled,
> `POST .../preparations/from-orders` returns `422` with `error_code: DIRECT_PREPARATION_DISABLED`.
> Confirm with your backend lead whether this flag is on for your environment before building
> against it — bypassing the dispatcher is a deliberate authority exception, not the default path.

### `GET /backend/magasinier/orders/approved`

List confirmed BCs in your branch not yet assigned to a BP.

```bash
curl "https://api.omni360.cloud/api/backend/magasinier/orders/approved?search=Atlas" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:** Paginated list of `Order` (BC) records with `partner` and `orderProducts.product` loaded, `bc_status: confirmed`, `bon_preparation_id: null`.

### `POST /backend/magasinier/preparations/from-orders`

```bash
curl -X POST https://api.omni360.cloud/api/backend/magasinier/preparations/from-orders \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bp:from-orders:$(date +%s)" \
  -d '{ "order_ids": [501, 502] }'
```

**Request body:**

| Field | Required | Type | Description |
|---|---|---|---|
| `order_ids` | yes | `number[]` | Must each `exist:orders,id` |

Internally calls the `create_bp_from_orders` decision (`bon-preparation`, id `0`). Response shape matches other BP-creation decisions (`bp_id`, `bp_number`, `status: pending`).

---

## 10. Conventional Loading

The conventional loading flow handles **SFA field salesperson** → **van stock loading**. The Magasinier fulfills loading requests after ADV approval.

### `GET /backend/conventional-loading-requests`

List loading requests visible to Magasinier. Statuses: `approved` (ready to fulfill), `fulfilled`, `rejected_by_vendor`.

```bash
curl "https://api.omni360.cloud/api/backend/conventional-loading-requests?status=approved" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:**
```json
{
  "current_page": 1,
  "per_page": 20,
  "total": 2,
  "data": [
    {
      "id": 77,
      "status": "approved",
      "branch_id": 1,
      "notes": "Chargement du véhicule 12345-A-1 pour Marché Lundi",
      "approved_at": "2026-06-15T08:00:00Z",
      "user": { "id": 8, "name": "Ahmed Vendeur" },
      "vendeur_items_snapshot": [
        { "product_id": 55, "product_name": "Huile Végétale 5L", "quantity": 50 }
      ]
    }
  ]
}
```

### `POST /backend/conventional-loading-requests/{id}/fulfill` ⚡

Magasinier physically prepares the loading request. Issues QR token for salesperson confirmation.

```bash
curl -X POST https://api.omni360.cloud/api/backend/conventional-loading-requests/77/fulfill \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: lr:77:fulfill:$(date +%s)" \
  -d '{
    "fulfilled_quantities": {
      "55": 48
    },
    "notes": "2 cartons manquants — rupture partielle"
  }'
```

**Request body:**

| Field | Required | Type | Description |
|---|---|---|---|
| `fulfilled_quantities` | yes | `object` | Map `product_id → fulfilled_quantity` |
| `notes` | no | `string` | max 500 chars |

**Response `200`:**
```json
{
  "success": true,
  "message": "Chargement préparé — QR émis",
  "data": {
    "loading_request_id": 77,
    "status": "fulfilled",
    "qr_token": "eyJhbGc...",
    "qr_expires_at": "2026-06-15T20:00:00Z",
    "fulfilled_at": "2026-06-15T13:30:00Z"
  }
}
```

> The salesperson scans the QR code to confirm receipt. Upon confirmation, the stock transfer (CENTRAL → VAN) is applied.

### `POST /backend/conventional-loading-requests/{id}/reject-at-vendor` ⚡

Magasinier refuses to hand over items after preparation (e.g., ID mismatch, safety concern).

```bash
curl -X POST https://api.omni360.cloud/api/backend/conventional-loading-requests/77/reject-at-vendor \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: lr:77:reject-at-vendor:$(date +%s)" \
  -d '{"reason": "Le vendeur ne correspond pas à la carte identité présentée."}'
```

---

## 11. Conventional Décharge Reconciliation (EOD Van → Depot)

**Not previously documented.** End-of-day reconciliation for **conventional sales** (Van_Vendeur model): the salesperson returns unsold stock from their van, and the Magasinier confirms the physical count before it's released back to depot stock. Gated by `config('conventional_sales.enabled')`.

This is a **two-step** flow with two different endpoints:

### Step 1 — `POST /backend/conventional-decharge-reconciliation/{dechargeReconciliationRequest}/confirm`

Magasinier scans the salesperson's QR code, optionally takes a photo of the signed décharge slip, and records the physical count per product. Moves the request to `reconciling`.

```bash
curl -X POST https://api.omni360.cloud/api/backend/conventional-decharge-reconciliation/42/confirm \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Idempotency-Key: drr:42:confirm:$(date +%s)" \
  -F "qr_token=eyJhbGc..." \
  -F "photo=@signed-decharge.jpg" \
  -F 'lines=[{"product_id":55,"physical_qty":12},{"product_id":60,"physical_qty":4}]'
```

**Request body (multipart/form-data):**

| Field | Required | Type | Description |
|---|---|---|---|
| `qr_token` | yes | `string` | 8–512 chars, scanned from the salesperson's app |
| `photo` | no | `file` (image) | Max 15MB |
| `lines` | no* | JSON array | `[{ product_id, physical_qty }]` |
| `physical_by_product` | no* | JSON object | Alternative shape: `{ product_id: physical_qty }` |

\* Provide either `lines` or `physical_by_product` — `lines` takes precedence if both are sent.

**Response `200`:**
```json
{
  "message": "OK",
  "data": { "success": true, "...": "service-defined fields, not exhaustively documented" }
}
```

**`422`** if `qr_token` is invalid/expired, or if `conventional_sales.enabled` is off (`403` in that case).

### Step 2 — `POST /backend/workflow/decharge-reconciliation/{id}/execute` with `decision: "approve_decharge_reconciliation"`

Once `reconciling`, approve to execute the actual VAN→depot stock transfer.

```bash
curl -X POST https://api.omni360.cloud/api/backend/workflow/decharge-reconciliation/42/execute \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: drr:42:approve:$(date +%s)" \
  -d '{
    "decision": "approve_decharge_reconciliation",
    "metadata": { "notes": "RAS, conforme au comptage." }
  }'
```

**Guard:** request must be in `reconciling` status, with a pending `warehouseTransfer` attached (set during step 1).

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "decharge_reconciliation_id": 42,
    "status": "approved",
    "warehouse_transfer_id": 117,
    "products_transferred": 2,
    "message": "Décharge reconciliation approved. Stock returned to depot."
  }
}
```

---

## 12. Décharge — Van → Depot Unloading

**Not previously documented.** Separate from §11 — this is for goods that **stayed on the van undelivered** after a rider's mission ends (partner absent, route cancelled, etc.), not for end-of-day conventional sales reconciliation. The dispatcher creates the décharge (`create_decharge`); the Magasinier approves it to release the stock back to the depot.

### Listing (read-only, dispatcher-owned routes — also usable by Magasinier)

```bash
curl "https://api.omni360.cloud/api/backend/dispatcher/decharges?status=pending" \
  -H "Authorization: Bearer {TOKEN}"

curl https://api.omni360.cloud/api/backend/dispatcher/decharges/9 \
  -H "Authorization: Bearer {TOKEN}"
```

### `POST /backend/workflow/decharge/{id}/execute` with `decision: "approve_decharge"`

```bash
curl -X POST https://api.omni360.cloud/api/backend/workflow/decharge/9/execute \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: decharge:9:approve:$(date +%s)" \
  -d '{
    "decision": "approve_decharge",
    "metadata": { "notes": "Marchandise reçue, conforme." }
  }'
```

**Guard:** décharge must be `pending` and have at least one item.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "decharge_id": 9,
    "decharge_number": "DCH-2026-00009",
    "status": "approved",
    "items_released": 3,
    "total_value": 1240.50,
    "items": [
      { "product_id": 55, "quantity": 4, "released": true }
    ],
    "message": "Décharge approved. 3 product(s) returned to depot stock."
  }
}
```

**Side effects:** stock is added back (`quantity` and `available_quantity` incremented) at the depot `StorageLocation` for the branch; each décharge item is marked `stock_released: true` (idempotent — re-running skips already-released lines).

---

## 13. Returns Processing

> **Rewritten 2026-06-18 — two findings, both fixed/documented for real this time.**
>
> **Finding 1:** the previous version of this section documented `GET /magasinier/returns/pending`
> and `GET /magasinier/returns/{id}` with example responses that **did not match any real
> implementation** — the controller methods the routes pointed to (`pendingReturns`, `showReturn`)
> did not exist anywhere in the codebase, so calling either endpoint threw a fatal error.
>
> **Finding 2 (bigger):** while fixing Finding 1, the model originally used to back these
> methods — `App\Models\BonRetour` (table `return_orders`) — turned out to be **entirely
> dead code**. Migration `database/migrations/2026_07_01_000003_drop_legacy_return_tables.php`
> dropped `return_orders`, `return_order_items`, `return_requests`, `return_request_items`,
> `return_missions`, `product_returns`, and more, in favor of a unified `partner_returns` +
> `return_items` engine. This means **`App\Http\Controllers\Backend\BonRetourController`
> (`/backend/bon-retours/*`), `App\Http\Controllers\API\BonRetourController`
> (`/api/partner/returns/*`), `App\Http\Controllers\API\ReturnRequestController`
> (`/api/return-requests/*`), and the `warehouse_quality_check`/`finalize_return` decisions
> (`bon-retour` model type) are all currently broken** — every one throws
> `relation "return_orders" does not exist` (or `return_requests`) the moment they touch the DB.
> These routes/decisions are still registered (pre-existing state, not something this pass
> introduced) but **do not build against them.**
>
> The real, live system is `App\Models\PartnerReturn` (table `partner_returns`) +
> `App\Models\ReturnItem`, exposed via `App\Http\Controllers\API\Salesperson\PartnerReturnController`
> at **`/api/v2/returns/*`** — note the different base path, this is NOT under `/api/backend/...`.
> `pendingReturns`/`showReturn` on `MagasinierController` are now implemented for real against
> `PartnerReturn`.

### How a return reaches the warehouse

```
Salesperson creates return → PartnerReturn (commercial: PENDING_DIRECTION_APPROVAL,
                                             immediate: IMMEDIATE, no approval gate)
    │
    ▼ [Approver: approve]                  (commercial only — out of Magasinier scope)
APPROVED
    │
    ▼ [Dispatcher assigns a driver]        (out of Magasinier scope)
ASSIGNED_TO_DRIVER
    │
    ▼ [Driver: POST /v2/returns/{id}/collect]
COLLECTED — condition (good/damaged/expired) recorded per item AT COLLECTION TIME,
            there is no separate magasinier "quality check" step in this engine yet
    │
    ▼ [Magasinier: POST /v2/returns/{id}/receive]
RECEIVED_AT_WAREHOUSE
    │
    ▼ [Magasinier or dispatcher: POST /v2/returns/{id}/close]
CLOSED (terminal, immutable)
```

### Step 1 (Magasinier) — list returns awaiting warehouse action

`GET /backend/magasinier/returns/pending`

Lists `PartnerReturn` for your branch in status `ASSIGNED_TO_DRIVER` or `COLLECTED` (i.e. anything
not yet received at the warehouse).

**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `status` | `string` | Narrow to one exact status (`ASSIGNED_TO_DRIVER`, `COLLECTED`) |
| `page` | `number` | Default 1, 20 per page |

```bash
curl https://api.omni360.cloud/api/backend/magasinier/returns/pending \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:**
```json
{
  "current_page": 1,
  "per_page": 20,
  "total": 1,
  "data": [
    {
      "id": 8,
      "return_number": "RET-2026-00008",
      "status": "COLLECTED",
      "return_type": "commercial",
      "return_reason": "quality_issue",
      "partner": { "id": 12, "name": "Supermarché Atlas" },
      "deliveryNote": { "id": 501, "delivery_number": "BL-2026-00501" },
      "collection_timestamp": "2026-06-18T09:00:00Z",
      "created_at": "2026-06-15T10:00:00Z"
    }
  ]
}
```

`GET /backend/magasinier/returns/{id}` returns the same record with `items.product` loaded.

### Step 2 (Magasinier) — confirm physical receipt

`POST /api/v2/returns/{id}/receive` ⚠️ **different base path — not under `/api/backend/...`**

No request body needed; the service records `received_by_user_id` from the authenticated user.

```bash
curl -X POST https://api.omni360.cloud/api/v2/returns/8/receive \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Idempotency-Key: pr:8:receive:$(date +%s)"
```

**Guard:** status must be `COLLECTED` (enforced by `ReturnActivityService::assertValidTransition`).
On an invalid transition you get `422` with `error: "invalid_state_transition"`.

**Response `200`:**
```json
{
  "data": {
    "id": 8,
    "return_number": "RET-2026-00008",
    "status": "RECEIVED_AT_WAREHOUSE",
    "warehouse_receipt_timestamp": "2026-06-18T10:30:00Z"
  }
}
```

### Step 3 (Magasinier or dispatcher) — close

`POST /api/v2/returns/{id}/close`

```bash
curl -X POST https://api.omni360.cloud/api/v2/returns/8/close \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Idempotency-Key: pr:8:close:$(date +%s)"
```

**Guard:** status must be `RECEIVED_AT_WAREHOUSE`. → `CLOSED` (terminal — immutable after this).

**Response `200`:**
```json
{ "data": { "id": 8, "return_number": "RET-2026-00008", "status": "CLOSED" } }
```

### Full audit trail

`GET /api/v2/returns/{id}/audit` — merges status-change audit log entries, linked stock
movements, and inter-branch transfers into one chronological timeline. Useful for a return's
detail screen.

```bash
curl https://api.omni360.cloud/api/v2/returns/8/audit \
  -H "Authorization: Bearer {TOKEN}"
```

---

## 14. Generic Workflow Utility Endpoints

**Not previously documented.** Useful for building a generic "what can I do with this record"
UI instead of hardcoding decision names per screen.

### `GET /backend/workflow/{modelType}/{id}/decisions`

Lists decisions currently available for this record, given its status and your role.

```bash
curl https://api.omni360.cloud/api/backend/workflow/bon-preparation/88/decisions \
  -H "Authorization: Bearer {TOKEN}"
```

### `GET /backend/workflow/{modelType}/{id}/history`

Audit trail of every decision executed against this record.

```bash
curl https://api.omni360.cloud/api/backend/workflow/bon-preparation/88/history \
  -H "Authorization: Bearer {TOKEN}"
```

Valid `modelType` values relevant to Magasinier: `bon-preparation`, `batch-picking-session`,
`stock`, `decharge`, `decharge-reconciliation`. (`bon-retour` is also registered but is
currently dead — see [§13](#13-returns-processing).) (Response shapes were not
exhaustively verified for this doc pass — confirm against a live call before depending on
specific field names.)

---

## 15. Error Handling

| HTTP Status | Meaning | Common cause |
|---|---|---|
| `401` | Unauthenticated | Missing/expired Bearer token |
| `403` | Forbidden | User lacks `magasinier` role, or a feature flag is off (e.g. `conventional_sales.enabled`) |
| `404` | Not Found | BP / stock record doesn't exist |
| `409` | Conflict | Duplicate idempotency key |
| `422` | Validation / Decision blocked | Invalid quantities, constraint violation, feature flag disabled |
| `500` | Server error | Check application logs |

**422 — Overflow guard (qty > available stock):**
```json
{
  "success": false,
  "message": "La quantité préparée dépasse le stock disponible",
  "constraints": [
    {
      "name": "stock_overflow",
      "reason": "Huile Végétale 5L: requested 40, only 30 available in depot.",
      "context": {
        "product_id": 55,
        "requested": 40,
        "available": 30
      }
    }
  ]
}
```

**422 — BP already completed (idempotent replay not matched):**
```json
{
  "message": "La préparation est déjà finalisée.",
  "errors": {}
}
```

---

## 16. TypeScript Interfaces

```typescript
// ─── BP Status ────────────────────────────────────────────────────────────────

type BpStatus =
  | 'pending'
  | 'in_progress'
  | 'completed_full'
  | 'completed_partial'
  | 'partial_rework_requested'
  | 'shortage_split_done'
  | 'shortage_accepted'
  | 'awaiting_shortage_review'
  | 'rejected';

type StockMovementType =
  | 'purchase'
  | 'sale'
  | 'adjustment'
  | 'reservation'
  | 'reservation_release'
  | 'release'
  | 'transfer_in'
  | 'transfer_out'
  | 'return';

type AdjustmentType = 'add' | 'subtract' | 'set';

type DechargeStatus = 'pending' | 'approved';
type DechargeReconciliationStatus = 'reconciling' | 'approved';

type PartnerReturnStatus =
  | 'PENDING_DIRECTION_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'ASSIGNED_TO_DRIVER'
  | 'COLLECTED'
  | 'RECEIVED_AT_WAREHOUSE'
  | 'CLOSED'
  | 'IMMEDIATE'
  | 'ROLLED_BACK'
  | 'RECONCILED';

type ReturnType = 'commercial' | 'immediate';
type ReturnItemCondition = 'good' | 'damaged' | 'expired';

// ─── Preparation Order ────────────────────────────────────────────────────────

interface PreparationOrderItem {
  id: number;
  product_id: number;
  requested_quantity: number;
  available_quantity?: number;
  prepared_quantity: number;
  shortage_quantity: number;
  shortage_reason?: string | null;
  shortage_reported_at?: string | null;
  delivery_note_item_id?: number | null;
  product: { id: number; name: string; sku: string };
}

interface PreparationOrder {
  id: number;
  bp_number: string;
  status: BpStatus;
  total_items: number;
  prepared_items: number;
  preparation_efficiency?: number | null;
  total_shortage_percentage: number;
  is_critical_shortage: boolean;
  shortage_acknowledged: boolean;
  priority_level: 'normal' | 'high' | 'urgent';
  deadline?: string | null;
  notes?: string | null;
  rejection_reason?: string | null;
  rejected_at?: string | null;
  prepared_at?: string | null;
  magasinier?: { id: number; name: string } | null;
  bonChargement?: {
    id: number;
    shipment_number: string;
    status: string;
    livreur?: { id: number; name: string; phone?: string } | null;
  } | null;
  logisticsBatch?: { id: number; batch_number: string } | null;
  items?: PreparationOrderItem[];
  created_at: string;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

interface MagasinierDashboard {
  pendingPreparations: number;
  inProgress: number;
  completedToday: number;
  lowStockItems: number;
  readyToPrepare: number;
  pendingBps: Array<{
    id: number;
    bp_number: string;
    status: BpStatus;
    bonChargement?: { id: number; shipment_number: string } | null;
    created_at: string;
  }>;
}

// ─── Stock ────────────────────────────────────────────────────────────────────

interface StockRecord {
  id: number;
  product_id: number;
  warehouse_code: string;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  minimum_quantity: number;
  maximum_quantity?: number;
  product: {
    id: number;
    name: string;
    sku: string;
    unit?: string;
  };
}

interface StockMovement {
  id: number;
  type: StockMovementType;
  quantity: number;
  balance_after: number;
  notes?: string;
  reference_type?: string;
  reference_id?: number;
  product: { id: number; name: string; sku: string };
  user?: { id: number; name: string } | null;
  created_at: string;
}

// ─── Stock Adjustment ─────────────────────────────────────────────────────────

interface StockAdjustmentRequest {
  product_id: number;
  warehouse_code?: string;
  adjustment_type: AdjustmentType;
  quantity: number;
  reason: string;
}

interface StockAdjustmentResponse {
  success: boolean;
  data: {
    stock_id: number;
    product_id: number;
    branch_code: string | null;
    adjustment_type: AdjustmentType;
    quantity: number;
    old_quantity: number;
    new_quantity: number;
    available_quantity: number;
  };
}

// ─── Complete Preparation ─────────────────────────────────────────────────────

interface CompletePreparationRequest {
  prepared_quantities: Record<string, number>; // item_id → quantity
  notes?: string;
}

interface CompletePreparationResponse {
  success: boolean;
  message: string;
  data: {
    bp_id: number;
    bp_number: string;
    status: BpStatus;
    total_items: number;
    prepared_items: number;
    preparation_efficiency: number;
    total_shortage_percentage: number;
    is_critical_shortage?: boolean;
    prepared_at: string;
  };
}

// ─── Report Shortage / Continue Preparation ────────────────────────────────────

interface ReportShortageRequest {
  shortage_items: Array<{
    product_id: number;
    shortage_quantity: number;
    shortage_reason: string;
    shortage_notes?: string;
    can_fulfill_later?: boolean;
    estimated_availability?: string;
  }>;
}

interface ContinuePreparationRequest {
  additional_items: Array<{ product_id: number; additional_quantity: number }>;
}

// ─── Batch Picking ────────────────────────────────────────────────────────────

interface ConsolidatedItem {
  product_id: number;
  product_name: string;
  total_requested: number;
  distribution: Array<{
    bl_id: number;
    bl_item_id: number;
    requested: number;
  }>;
}

interface BatchPickingSession {
  id: number;
  status: string;
}

interface DistributeSessionResponse {
  session: BatchPickingSession;
  bls: Array<{
    id: number;
    delivery_number: string;
    partner: { name: string };
    items: Array<{ id: number; product_id: number; quantity: number }>;
  }>;
  consolidated_items: ConsolidatedItem[];
}

interface SaveBatchPickingRequest {
  prepared: Record<string, number>; // product_id → total_quantity_picked
  distribution: Array<{
    bl_item_id: number;
    product_id: number;
    prepared_quantity: number;
  }>;
}

// ─── Conventional Loading ─────────────────────────────────────────────────────

type LoadingRequestStatus =
  | 'submitted'
  | 'pending_cdz'
  | 'pending_adv'
  | 'approved'
  | 'fulfilled'
  | 'confirmed'
  | 'cancelled'
  | 'rejected'
  | 'rejected_by_vendor';

interface LoadingRequest {
  id: number;
  status: LoadingRequestStatus;
  branch_id: number;
  notes?: string;
  approved_at?: string;
  fulfilled_at?: string;
  confirmed_at?: string;
  user: { id: number; name: string };
  vendeur_items_snapshot: Array<{
    product_id: number;
    product_name: string;
    quantity: number;
  }>;
}

// ─── Décharge (Van → Depot) ─────────────────────────────────────────────────────

interface UnloadOrder {
  id: number;
  decharge_number: string;
  status: DechargeStatus;
  branch_code: string;
  items: Array<{ product_id: number; quantity: number; stock_released: boolean }>;
}

interface ApproveDechargeResponse {
  success: boolean;
  data: {
    decharge_id: number;
    decharge_number: string;
    status: 'approved';
    items_released: number;
    total_value: number;
    items: Array<{ product_id: number; quantity: number; released: boolean }>;
    message: string;
  };
}

// ─── Returns (PartnerReturn) ────────────────────────────────────────────────────

interface ReturnItem {
  id: number;
  product_id: number;
  return_quantity: number;
  delivered_quantity?: number;
  condition?: ReturnItemCondition | null;
  reason?: string;
  unit_price?: number;
  total_value?: number;
  product: { id: number; name: string; sku: string };
}

interface PartnerReturn {
  id: number;
  return_number: string;
  status: PartnerReturnStatus;
  return_type: ReturnType;
  return_reason?: string;
  partner: { id: number; name: string };
  deliveryNote?: { id: number; delivery_number: string } | null;
  items?: ReturnItem[];
  collection_timestamp?: string | null;
  warehouse_receipt_timestamp?: string | null;
  created_at: string;
}
```

---

## 17. End-to-End Workflow Examples

### Example A — Standard Preparation (No Shortage)

```bash
# Step 1: Magasinier checks pending BPs
curl "https://api.omni360.cloud/api/backend/magasinier/preparations/pending?scope=active" \
  -H "Authorization: Bearer {TOKEN}"
# → bp_id: 88, status: "pending"

# Step 2: Magasinier reviews the BP
curl "https://api.omni360.cloud/api/backend/magasinier/preparations/88" \
  -H "Authorization: Bearer {TOKEN}"
# → items: [product 55 qty:40, product 60 qty:24]

# Step 3: Start preparation
curl -X POST "https://api.omni360.cloud/api/backend/workflow/bon-preparation/88/execute" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bp:88:start:$(date +%s)" \
  -d '{"decision":"start_preparation"}'
# → BP: "in_progress", BLs: "in_preparation"

# Step 4: Update quantities incrementally while picking
curl -X PUT "https://api.omni360.cloud/api/backend/magasinier/preparations/88/items" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bp:88:items:1:$(date +%s)" \
  -d '{
    "items": [
      {"product_id": 55, "prepared_quantity": 40},
      {"product_id": 60, "prepared_quantity": 24}
    ]
  }'

# Step 5: Complete preparation — all items fully prepared
curl -X PUT "https://api.omni360.cloud/api/backend/magasinier/preparations/88/save" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bp:88:complete:$(date +%s)" \
  -d '{
    "prepared_quantities": {"3001": 40, "3002": 24}
  }'
# → BP: "completed_full"
# → BLs: "ready"
# → BCH: "prepared"
# → Stock deducted
```

---

### Example B — Partial Preparation with Shortage

```bash
# Steps 1-3 same as above

# Step 4: Stock is insufficient — only 30 of 40 available for product 55
curl -X PUT "https://api.omni360.cloud/api/backend/magasinier/preparations/88/save" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bp:88:complete:$(date +%s)" \
  -d '{
    "prepared_quantities": {
      "3001": 30,
      "3002": 24
    },
    "notes": "Rupture Huile Végétale 5L — manque 10 cartons en stock central."
  }'
# → BP: "completed_partial"
# → BCH: "awaiting_shortage_review"

# Step 5: Dispatcher accepts and the shortage delta is auto-split into a backlog BC
# (see Module 15 — Dispatcher shortage balance)
# → BP: "shortage_split_done"

# Step 5b: alternatively, dispatcher requests rework — BP → "partial_rework_requested"
# Step 5c: Magasinier picks the now-available stock and reports it
curl -X POST "https://api.omni360.cloud/api/backend/workflow/bon-preparation/88/execute" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bp:88:continue:$(date +%s)" \
  -d '{"decision":"continue_preparation","metadata":{"additional_items":[{"product_id":55,"additional_quantity":10}]}}'
# → BP: "completed_full" (shortage now fully resolved)
```

---

### Example C — Batch Picking

```bash
# BLs 501, 502, 503 are in DRAFT — Magasinier wants to pick them all at once

# Step 1: Generate picking list
curl -X POST "https://api.omni360.cloud/api/backend/magasinier/batch-picking/generate" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: batch-pick:generate:$(date +%s)" \
  -d '{
    "delivery_note_ids": [501, 502, 503]
  }'
# → session_id: 5

# Step 2: View the consolidated picking list
curl "https://api.omni360.cloud/api/backend/magasinier/batch-picking/5/distribute" \
  -H "Authorization: Bearer {TOKEN}"
# → consolidated: product 55 total 40, product 60 total 24

# Step 3: Pick from shelves, then save distribution
curl -X POST "https://api.omni360.cloud/api/backend/magasinier/batch-picking/5/save" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: batch-pick:5:save:$(date +%s)" \
  -d '{
    "prepared": {"55": 40, "60": 24},
    "distribution": [
      {"bl_item_id": 2001, "product_id": 55, "prepared_quantity": 20},
      {"bl_item_id": 2002, "product_id": 55, "prepared_quantity": 12},
      {"bl_item_id": 2003, "product_id": 55, "prepared_quantity": 8},
      {"bl_item_id": 2004, "product_id": 60, "prepared_quantity": 24}
    ]
  }'
```

---

### Example D — Manual Stock Correction

```bash
# Inventory count reveals 10 damaged cartons — must be removed from stock

# Step 1: Verify current stock
curl "https://api.omni360.cloud/api/backend/magasinier/stock?search=Huile" \
  -H "Authorization: Bearer {TOKEN}"
# → product 55: available_quantity = 45

# Step 2: Adjust down by 10
curl -X POST "https://api.omni360.cloud/api/backend/magasinier/stock/adjust" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: stock:adjust:55:$(date +%s)" \
  -d '{
    "product_id": 55,
    "warehouse_code": "CASA-01",
    "adjustment_type": "subtract",
    "quantity": 10,
    "reason": "Inventaire physique du 15/06/2026 — 10 cartons endommagés par humidité."
  }'
# → available_quantity: 35, movement created with type "adjustment"

# Step 3: Verify movement in audit log
curl "https://api.omni360.cloud/api/backend/magasinier/stock/movements?type=adjustment&product_id=55" \
  -H "Authorization: Bearer {TOKEN}"
```

---

### Example E — Conventional Loading Fulfillment

```bash
# ADV has approved a salesperson's loading request (status: approved)

# Step 1: Magasinier sees approved requests
curl "https://api.omni360.cloud/api/backend/conventional-loading-requests?status=approved" \
  -H "Authorization: Bearer {TOKEN}"
# → loading_request_id: 77, items: [product 55: qty 50]

# Step 2: Fulfill (pick items, issue QR)
curl -X POST "https://api.omni360.cloud/api/backend/conventional-loading-requests/77/fulfill" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: lr:77:fulfill:$(date +%s)" \
  -d '{
    "fulfilled_quantities": {"55": 50},
    "notes": null
  }'
# → status: "fulfilled", qr_token issued

# Step 3: Salesperson scans QR on their mobile app
# → status: "confirmed"
# → CENTRAL → VAN stock transfer applied automatically
```

---

### Example F — Returns Processing (full warehouse flow)

```bash
# Driver already collected PartnerReturn #8 from the partner (status: COLLECTED)

# Step 1: Magasinier sees it in the pending queue
curl "https://api.omni360.cloud/api/backend/magasinier/returns/pending" \
  -H "Authorization: Bearer {TOKEN}"
# → id: 8, status: "COLLECTED"

# Step 2: Confirm physical receipt at the warehouse
# Note the different base path: /api/v2/returns, not /api/backend/...
curl -X POST "https://api.omni360.cloud/api/v2/returns/8/receive" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Idempotency-Key: pr:8:receive:$(date +%s)"
# → status: "RECEIVED_AT_WAREHOUSE"

# Step 3: Close once reconciled (terminal)
curl -X POST "https://api.omni360.cloud/api/v2/returns/8/close" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Idempotency-Key: pr:8:close:$(date +%s)"
# → status: "CLOSED"
```

---

### Example G — Décharge (Van → Depot Unloading)

```bash
# Dispatcher already created décharge #9 after BCH completion (status: pending)

curl "https://api.omni360.cloud/api/backend/dispatcher/decharges/9" \
  -H "Authorization: Bearer {TOKEN}"
# → items: [product 55 qty 4]

curl -X POST "https://api.omni360.cloud/api/backend/workflow/decharge/9/execute" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: decharge:9:approve:$(date +%s)" \
  -d '{"decision":"approve_decharge","metadata":{"notes":"Marchandise reçue, conforme."}}'
# → status: "approved", stock released back to depot
```

---

*Generated from source: `app/Http/Controllers/Backend/MagasinierController.php`,
`app/Http/Controllers/API/Salesperson/PartnerReturnController.php`,
`app/Http/Controllers/Backend/DispatcherController.php` (décharge listing),
`app/Http/Controllers/Backend/ConventionalDechargeReconciliationController.php`,
`app/Decisions/Warehouse/`, `app/Decisions/Dispatcher/ApproveDechargeDecision.php`,
`app/Decisions/Dispatcher/CreateDechargeDecision.php`, `config/decisions.php`,
`routes/backend.php`, `routes/api.php`, `app/Models/PartnerReturn.php`,
`app/Models/ReturnItem.php`, `app/Models/UnloadOrder.php`, `app/Models/Stock.php`,
`database/migrations/2026_07_01_000003_drop_legacy_return_tables.php`*  
*Last updated: 2026-06-18*
