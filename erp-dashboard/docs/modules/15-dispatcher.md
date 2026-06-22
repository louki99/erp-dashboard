# Module 15 — Dispatcher

> **Audience:** Frontend developers consuming the Dispatcher API  
> **Base URL:** `https://api.omni360.cloud/api/backend`  
> **Auth:** `Authorization: Bearer <token>` — user must hold the `dispatcher` role (or `root` / `admin`)  
> **Idempotency:** All mutating endpoints require `Idempotency-Key: <unique-string>` header

---

## Table of Contents

1. [What is the Dispatcher?](#1-what-is-the-dispatcher)
2. [Logistics Pipeline Overview](#2-logistics-pipeline-overview)
3. [Status Glossary](#3-status-glossary)
4. [Authentication](#4-authentication)
5. [Dashboard](#5-dashboard)
6. [Orders (BC → Dispatch)](#6-orders-bc--dispatch)
7. [Bon de Livraison (BL)](#7-bon-de-livraison-bl)
   - [List BLs](#71-list-bls)
   - [Draft BLs](#72-draft-bls)
   - [Confirmed BLs](#73-confirmed-bls)
   - [BL Detail](#74-bl-detail)
   - [Update BL](#75-update-bl)
   - [Split BL](#76-split-bl)
   - [Cancel BL](#77-cancel-bl)
8. [Delivery Missions](#8-delivery-missions)
   - [Create Delivery Mission](#81-create-delivery-mission)
   - [Confirm Delivery Mission](#82-confirm-delivery-mission) — atomic allocate + generate BP (replaces `allocate_delivery_note` + `generate_preparation_for_mission`, removed 2026-06-21)
   - [Start Delivery Mission](#83-start-delivery-mission)
   - [Complete Delivery Mission](#84-complete-delivery-mission)
   - [Update Delivery Mission](#85-update-delivery-mission) — now includes `add_order_ids`/`remove_order_ids`
   - [Reopen Delivery Mission](#86-reopen-delivery-mission-new-2026-06-22) — new
   - [Cancel Delivery Mission](#87-cancel-delivery-mission)
   - [Mission Detail](#88-mission-detail)
   - [Batch Preview (virtual, read-only)](#89-batch-preview-virtual-read-only)
9. [Delivery Orders (DO) — REMOVED](#9-delivery-orders-do--removed)
10. [Preparations — Shortage Queue](#10-preparations--shortage-queue)
11. [Decharges (Returns & Cancellations)](#11-decharges)
12. [Riders & Vehicles](#12-riders--vehicles)
    - [Warehouse Transfers](#12c-warehouse-transfers)
    - [Fleet & Rider Master Data](#12d-fleet--rider-master-data)
13. [Error Handling](#13-error-handling)
14. [TypeScript Interfaces](#14-typescript-interfaces)
15. [End-to-End Workflow Examples](#15-end-to-end-workflow-examples)
16. [Decision Registry](#16-decision-registry)
17. [Database Schema Reference](#17-database-schema-reference)
18. [Entity Relationship Summary](#18-entity-relationship-summary)

---

## 1. What is the Dispatcher?

The **Dispatcher** is the logistics orchestration role in FoodSolution's B2B fulfillment pipeline. It sits between ADV (order validation) and the Magasinier (warehouse).

> **2026-06-20 architecture migration:** the old BC → DO → LOT/BCH pipelines (and the
> parallel "Dispatch V2" BC → DO → BP → BCH pipeline) have been fully replaced by a single
> **Delivery Mission** pipeline. The `shipments`, `shipment_deliveries`,
> `shipment_delivery_orders`, `delivery_orders`, `delivery_order_items`,
> `delivery_order_orders`, `logistics_batches`, and `preparation_delivery_notes` tables are
> **dropped** — see `docs/modules/planning_refactor_schema.md` for the full rationale. This
> document only describes the current, live API surface.

| Responsibility | Description |
|---|---|
| **Receive confirmed orders** | Pick up BCs approved by ADV |
| **Plan deliveries** | Drag & drop confirmed BCs into a Delivery Mission — assigns rider + vehicle and generates one BL per partner |
| **Allocate stock** | Run shortage-tolerant allocation per BL; uncovered demand becomes a backlog order automatically |
| **Trigger preparation** | Generate one BP per mission for the Magasinier to pick |
| **Manage shortages** | Split prepared quantities between BLs when stock is partial (Magasinier side, Module 16) |
| **Handle cancellations** | Cancel a draft mission and release reserved stock |
| **Monitor logistics** | Track mission status, shortage queues, and return processing |

---

## 2. Logistics Pipeline Overview

> **2026-06-20 — architecture migration.** The old BC → DO → LOT → BP → BCH pipeline and the
> parallel "Dispatch V2" BC → DO → BP → BCH pipeline are both **gone**. They have been replaced
> by a single **Delivery Mission** pipeline: the dispatcher's drag & drop action now creates the
> mission *and* its BLs directly, in one call, with no intermediate Delivery Order or Logistics
> Batch layer. See `docs/modules/planning_refactor_schema.md` for the full migration rationale
> and the list of dropped tables.

### The Delivery Mission pipeline

> **2026-06-21 — `allocate_delivery_note` and `generate_preparation_for_mission` REMOVED.**
> Per-BL allocation and BP generation used to be two manual steps the dispatcher triggered
> separately. They are now **one atomic decision** — `confirm_delivery_mission` — see §8.2. Both
> old decisions are gone from `config/decisions.php`; calling them now returns `decision_not_found`.
> **If your UI still calls `allocate_delivery_note` or `generate_preparation_for_mission`, it is
> broken and must be updated** — see the message to the UI team in this doc's changelog.

```text
ADV confirms order (BC)
         │
         ▼
  create_delivery_mission  (dispatcher's Drag&Drop action — driver_id + vehicle_id required
         │                  up front. Creates the DeliveryMission container AND, in the same
         │                  call, generates one DeliveryNote (BL) per partner — merging
         │                  multiple selected BCs for the same partner into a single BL.
         │                  No stock is touched here.)
         ▼
  Mission: draft, BL(s): draft
         │
   [update_delivery_mission]  (optional, repeatable while draft — edit rider/vehicle/notes,
         │                      add/remove whole BLs, or add_order_ids/remove_order_ids to
         │                      attach/detach individual BCs — see §8.5.)
         ▼
    confirm_delivery_mission  (ONE atomic call, ONE DB transaction — replaces the old
         │                      allocate_delivery_note + generate_preparation_for_mission pair.
         │                      For every BL on the mission: shortage-tolerant stock allocation
         │                      (never throws — uncovered delta becomes a backlog Order via
         │                      ShortageBacklogService). Then, in the SAME call, aggregates every
         │                      BL's allocated_quantity by product_id into ONE PreparationOrder
         │                      (BP) for the whole mission. If every line across every BL came
         │                      back with 0 allocated (fully backlogged), NO BP is generated and
         │                      the mission is left in 'draft' — output.fully_backlogged: true.)
         ▼
  Mission: in_preparation, BP: pending   (or: still 'draft' if fully backlogged)
         │
  [Magasinier executes the BP — start_preparation / complete_preparation, Module 16]
         │
    [reopen_delivery_mission]  (dispatcher can pull the mission back to 'draft' at any point
         │                       while the BP is still 'pending'/'in_progress' — e.g. a
         │                       salesperson needs to edit a BC already inside the mission.
         │                       Atomically cancels the BP (status: cancelled, kept for audit),
         │                       releases the reserved stock, BLs → draft. See §8.6. Blocked
         │                       once the BP is already completed/rejected — race-condition
         │                       guard re-checked inside the transaction.)
         ▼
  BP completed → BLs → ready → WarehouseTransfer (CENTRAL → VAN) auto-created by
         │         WarehouseTransferService::createFromMission() — see §12c
         ▼
  Mission: ready
         │
    [start_delivery_mission]  (rider departs — mission must be 'ready')
         ▼
  Mission: in_transit, BLs: in_transit
         │
  [Rider delivers — see the Rider/Livreur module]
         │
    [complete_delivery_mission]  (mission must be 'in_transit' — computes delivery stats)
         ▼
  Mission: completed
```

A mission can also be **cancelled** while still `draft` (`cancel_delivery_mission`) — see §8.7.
There is no `adjust_quantities` (shortage-rebalancing across multiple BLs sharing one mission's
BP) or `create_decharge` (van → depot unload after a mission) decision yet — both are explicitly
deferred, see the note at the end of §8 and the comments in `config/decisions.php`.

> **Known gap — not yet ported.** The old `bon-chargement` pipeline had two decisions that have
> **no `delivery-mission` equivalent today**:
> - `adjust_quantities` — manual/equal/fifo shortage-rebalancing across multiple BLs grouped in
>   one shipment. Deferred; see `config/decisions.php`'s `delivery-mission` block comment.
> - `create_decharge` — generating a van → depot unload record after a mission. The old
>   `CreateDechargeDecision` was built entirely around `Shipment` (now dropped) and was not
>   ported; `config/decisions.php`'s `decharge` block comment confirms no replacement exists yet.
>
> Do not build frontend screens against either of these — they do not exist on the backend.

---

## 3. Status Glossary

### BL (Bon de Livraison) statuses

| Value | Meaning | Who drives it |
|---|---|---|
| `draft` | Freshly created, in a draft mission | Dispatcher |
| `confirmed` | Stock allocated by `confirm_delivery_mission` (was `allocate_delivery_note`, removed 2026-06-21) | Dispatcher |
| `batched` | Integrated into a mission's BP picking run, same call as the allocation above (was a separate `generate_preparation_for_mission` step, removed 2026-06-21 — no more `logistics_batches` table) | Dispatcher |
| `submitted_to_magasinier` | Reserved value, not currently set by the mission pipeline | — |
| `in_preparation` | Magasinier is picking | Magasinier |
| `ready` | Picked, warehouse transfer generated | Magasinier |
| `loaded` | On the vehicle | Livreur |
| `in_transit` | Mission started — rider departed | Livreur |
| `delivered` | Successfully delivered | Livreur |
| `partially_delivered` | Partial delivery confirmed | Livreur |
| `returned` | Returned by partner | Livreur |
| `cancelled` | Cancelled (BL-level cancel, split, or mission-level `cancel_delivery_mission`) | Dispatcher |

### Delivery Mission statuses

| Value | Meaning | Set by |
|---|---|---|
| `draft` | Created via Drag&Drop; BLs generated in draft, no stock touched. Also reachable FROM `in_preparation` via `reopen_delivery_mission` | `create_delivery_mission` / `reopen_delivery_mission` |
| `in_preparation` | BLs allocated/confirmed, BP generated (atomically), Magasinier picking | `confirm_delivery_mission` |
| `ready` | BP completed, warehouse transfer (depot → van) generated | auto, on BP completion (`CompletePreparationDecision` → `WarehouseTransferService::createFromMission()`) |
| `in_transit` | Rider departed | `start_delivery_mission` |
| `completed` | All deliveries done, stats computed | `complete_delivery_mission` |
| `cancelled` | Abandoned before completion (only reachable from `draft`) | `cancel_delivery_mission` |

### BP (Bon de Préparation) statuses

| Value | Meaning |
|---|---|
| `pending` | Awaiting Magasinier |
| `in_progress` | Magasinier picking |
| `completed_full` | All items prepared |
| `completed_partial` | Shortage — partial preparation |
| `shortage_accepted` | Dispatcher accepted shortage |
| `awaiting_shortage_review` | Pending dispatcher decision |
| `rejected` | Rejected by Magasinier |
| `cancelled` | Cancelled by `reopen_delivery_mission` (dispatcher pulled the mission back to draft to edit a BC) — kept for audit, never deleted |

---

## 4. Authentication

```bash
curl -X POST https://api.omni360.cloud/api/backend/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dispatcher@foodsolution.com","password":"secret"}'
```

**Response:**
```json
{
  "token": "2|def456abc...",
  "user": {
    "id": 7,
    "name": "Karim Dispatcher",
    "roles": ["dispatcher"]
  }
}
```

---

## 5. Dashboard

### `GET /backend/dispatcher/dashboard`

```bash
curl https://api.omni360.cloud/api/backend/dispatcher/dashboard \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:** (`DispatcherController::dashboard()` — reflects the mission-based pipeline; `missions_*` counters replaced the old `do_active`/`lot_open`/`lot_sealed`/`lot_in_preparation`/`bch_pending`/`bch_in_preparation`/`bch_prepared` fields)
```json
{
  "pipeline": {
    "bc_confirmed": 6,

    "missions_draft": 2,
    "missions_in_preparation": 1,
    "missions_ready": 1,
    "missions_in_transit": 3,

    "bp_pending": 1,
    "bp_in_progress": 1,
    "bp_shortage_queue": 1,
    "bp_rejected": 0,

    "bl_draft": 4,
    "bl_confirmed": 5,
    "bl_ready": 2,

    "bl_loaded": 0,
    "bl_in_transit": 5,
    "delivered_today": 4
  },
  "alerts": {
    "shortage_queue": 1,
    "rejected_bps": 0,
    "overdue_deliveries": 1
  },
  "activity": {
    "recent_orders": [
      { "id": 201, "order_code": "BC-2026-00201", "bc_status": "confirmed", "total_amount": 127500.00, "order_date": "2026-06-19", "partner": { "id": 12, "name": "Supermarché Atlas", "code": "PAR-00012" } }
    ],
    "active_deliveries": [
      { "id": 501, "delivery_number": "BL-2026-00501", "status": "in_transit", "livreur": { "id": 9, "name": "Youssef Livreur" } }
    ],
    "recent_shortages": [
      { "id": 88, "bp_number": "BP-2026-00088", "status": "completed_partial", "total_shortage_percentage": 25.0, "delivery_mission_id": 14, "deliveryMission": { "id": 14, "mission_number": "MSN-20260619-0001", "status": "in_preparation" } }
    ]
  }
}
```

| Field | Description |
|---|---|
| `pipeline.bc_confirmed` | BCs confirmed by ADV, not yet dispatched into a mission |
| `pipeline.missions_draft` / `missions_in_preparation` / `missions_ready` / `missions_in_transit` | Delivery missions by status (branch-scoped) |
| `pipeline.bp_shortage_queue` | BPs in `completed_partial`/`awaiting_shortage_review` |
| `pipeline.bl_draft` / `bl_confirmed` / `bl_ready` | BLs by status |
| `alerts.overdue_deliveries` | BLs in `in_transit`/`loaded`/`confirmed` whose `delivery_date` has passed |

> All counters are scoped to the authenticated dispatcher's `branch_id`/`branch_code` when set
> (company-wide if the user has no branch assigned).

---

## 6. Orders (BC → Dispatch)

### `GET /backend/dispatcher/orders/pending`

List BCs with status `confirmed`, ready to be converted into BLs.

**Query parameters:** `search` (order_code, bc_number, partner name), `page`

```bash
curl "https://api.omni360.cloud/api/backend/dispatcher/orders/pending" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:** Paginated list of `Order` objects with `partner`, `order_products`.

```json
{
  "current_page": 1,
  "per_page": 20,
  "total": 6,
  "data": [
    {
      "id": 201,
      "order_code": "BC-2026-00201",
      "bc_status": "confirmed",
      "total_amount": 127500.00,
      "branch_code": "CASA-01",
      "partner": { "id": 12, "name": "Supermarché Atlas", "code": "PAR-00012" },
      "order_products": [
        { "id": 1001, "product_id": 55, "quantity": 20, "unit_price": 3500.00 }
      ]
    }
  ]
}
```

### `GET /backend/dispatcher/orders/{id}`

Full order detail with partner, products, branch, sales rep, and linked delivery notes.

```bash
curl https://api.omni360.cloud/api/backend/dispatcher/orders/201 \
  -H "Authorization: Bearer {TOKEN}"
```

---

## 7. Bon de Livraison (BL)

> **Mutations** go through the workflow engine at `POST /backend/workflow/bon-livraison/{id}/execute`.  
> **Idempotency-Key** header is required on all mutation calls.

---

### 7.1 List BLs

`GET /backend/dispatcher/bon-livraisons`

**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `status` | `string` | Filter by BL status |
| `rider_id` | `number` | Filter by assigned rider |
| `search` | `string` | Search delivery_number, partner name/code |
| `page` | `number` | Default 1, 20 per page |

```bash
curl "https://api.omni360.cloud/api/backend/dispatcher/bon-livraisons?status=draft" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:** Paginated `DeliveryNote[]`.

```json
{
  "current_page": 1,
  "per_page": 20,
  "total": 12,
  "data": [
    {
      "id": 501,
      "delivery_number": "BL-2026-00501",
      "status": "draft",
      "total_amount": 127500.00,
      "delivery_date": "2026-06-16",
      "branch_code": "CASA-01",
      "partner": { "id": 12, "name": "Supermarché Atlas" },
      "rider": null,
      "order": { "id": 201, "order_code": "BC-2026-00201" }
    }
  ]
}
```

---

### 7.2 Draft BLs ⚠️ broken — references dropped tables

`GET /backend/dispatcher/bon-livraisons/draft`

> **Not migrated — calling this will error.** `DispatcherController::draftBls()` still filters
> `->whereDoesntHave('bonChargements')`, and `DeliveryNote::bonChargements()` is still defined as
> `belongsToMany(Shipment::class, 'shipment_deliveries')` — both `shipments` and
> `shipment_deliveries` are dropped tables (§2). This endpoint was not updated as part of the
> 2026-06-20 migration and will throw a DB error (`relation "shipments" does not exist` or
> similar) if called. Do not build against it. There is no replacement endpoint yet — for the
> mission-based flow, fetch draft BLs via `GET /backend/dispatcher/bon-livraisons?status=draft`
> (§7.1) instead, which does not depend on the broken relation.

---

### 7.3 Confirmed BLs ⚠️ broken — references dropped tables

`GET /backend/dispatcher/bon-livraisons/confirmed`

> **Not migrated — calling this will error.** `DispatcherController::confirmedBls()` filters
> `->whereNull('logistics_batch_id')->whereDoesntHave('bonChargements')` — both
> `delivery_notes.logistics_batch_id` and the `bonChargements` relation reference dropped tables
> (`logistics_batches`, `shipments`/`shipment_deliveries`). Same gap as §7.2 — use
> `GET /backend/dispatcher/bon-livraisons?status=confirmed` (§7.1) instead.

---

### 7.4 BL Detail

`GET /backend/dispatcher/bon-livraisons/{id}`

Full BL detail including partner, order, items, rider, dispatcher, assets, tracking, preparation.
(`DispatcherController::showBl()` returns the raw `DeliveryNote` model — not wrapped in
`success`/`data`.)

```bash
curl https://api.omni360.cloud/api/backend/dispatcher/bon-livraisons/501 \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:**
```json
{
  "id": 501,
  "delivery_number": "BL-2026-00501",
  "status": "draft",
  "delivery_mission_id": 14,
  "total_amount": 127500.00,
  "delivery_date": "2026-06-16",
  "notes": null,
  "branch_code": "CASA-01",
  "is_quantity_locked": false,
  "partner": {
    "id": 12,
    "name": "Supermarché Atlas",
    "code": "PAR-00012"
  },
  "order": {
    "id": 201,
    "order_code": "BC-2026-00201",
    "bc_status": "confirmed"
  },
  "livreur": null,
  "dispatcher": { "id": 7, "name": "Karim Dispatcher" },
  "items": [
    {
      "id": 2001,
      "product_id": 55,
      "ordered_quantity": 20,
      "allocated_quantity": 20,
      "prepared_quantity": null,
      "unit_price": 3500.00,
      "product": { "id": 55, "name": "Huile Végétale 5L", "sku": "HUI-VEG-5L" }
    }
  ],
  "preparation": null
}
```

---

### 7.5 Update BL

`PUT /backend/dispatcher/bon-livraisons/{id}`

Update delivery date, rider, or notes. Dispatcher cannot modify line quantities.

```bash
curl -X PUT https://api.omni360.cloud/api/backend/dispatcher/bon-livraisons/501 \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bl:501:update:1718358000" \
  -d '{
    "delivery_date": "2026-06-17",
    "rider_id": 9,
    "notes": "Livraison prioritaire — client VIP"
  }'
```

**OR via workflow engine:**
```bash
curl -X POST https://api.omni360.cloud/api/backend/workflow/bon-livraison/501/execute \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bl:501:update_delivery:1718358000" \
  -d '{
    "decision": "update_delivery",
    "delivery_date": "2026-06-17",
    "rider_id": 9,
    "notes": "Livraison prioritaire"
  }'
```

**Request body:**

| Field | Required | Type | Description |
|---|---|---|---|
| `delivery_date` | no | `date` | New delivery date (YYYY-MM-DD) |
| `rider_id` | no | `number` | Assign/change rider |
| `notes` | no | `string` | max 500 chars |

**Response `200`:**
```json
{
  "success": true,
  "message": "BL mis à jour",
  "data": {
    "delivery_note_id": 501,
    "delivery_number": "BL-2026-00501",
    "updates": {
      "delivery_date": "2026-06-17",
      "rider_id": 9
    },
    "total_amount": 127500.00
  }
}
```

---

### 7.6 Split BL

Split a DRAFT BL into multiple child BLs (e.g. by product category or delivery zone).

```bash
curl -X POST https://api.omni360.cloud/api/backend/dispatcher/bon-livraisons/501/split \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bl:501:split:1718358100" \
  -d '{
    "decision": "split_delivery",
    "splits": [
      {
        "label": "Épicerie sèche",
        "item_ids": [2001, 2002]
      },
      {
        "label": "Produits frais",
        "item_ids": [2003]
      }
    ]
  }'
```

**Request body:**

| Field | Required | Type | Description |
|---|---|---|---|
| `decision` | yes | `string` | Must be `"split_delivery"` |
| `splits` | yes | `array` | Min 2 splits; each must have `item_ids` (non-overlapping, covers all items) |
| `splits[].label` | no | `string` | Description for this split |
| `splits[].item_ids` | yes | `number[]` | IDs of `delivery_note_items` to include |

**Constraint:** Products with `allow_partial_delivery = false` cannot be split across deliveries.

**Response `200`:**
```json
{
  "success": true,
  "message": "BL divisé en 2 livraisons",
  "data": {
    "parent_delivery_note_id": 501,
    "split_count": 2,
    "child_bls": [
      { "id": 502, "delivery_number": "BL-2026-00502", "items_count": 2 },
      { "id": 503, "delivery_number": "BL-2026-00503", "items_count": 1 }
    ]
  }
}
```

> The parent BL (501) is set to `cancelled` (marked as split). Stock reservations are released and re-reserved per child BL.

---

### 7.7 Cancel BL

```bash
curl -X POST https://api.omni360.cloud/api/backend/dispatcher/bon-livraisons/501/cancel \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bl:501:cancel:1718358200" \
  -d '{
    "decision": "cancel_delivery",
    "reason": "Le partenaire a annulé sa demande de livraison."
  }'
```

**Request body:**

| Field | Required | Type | Description |
|---|---|---|---|
| `decision` | yes | `string` | Must be `"cancel_delivery"` |
| `reason` | yes | `string` | min 10 chars |

**Response `200`:**
```json
{
  "success": true,
  "message": "BL annulé",
  "data": {
    "delivery_note_id": 501,
    "status": "cancelled",
    "stock_released": true
  }
}
```

---

## 8. Delivery Missions

> A **Delivery Mission** is the dispatcher's Drag&Drop container — one zone/tour, one driver,
> one vehicle (`App\Models\DeliveryMission`, `app/Decisions/Dispatcher/*DeliveryMission*.php`).
> It replaces Shipment/BCH **and** the BC→DO intermediate layer in one step: creating a mission
> also generates its BLs directly from the selected confirmed orders. All 6 decisions below are
> registered under the **`delivery-mission`** model type in `config/decisions.php`. Most are
> executed through the generic workflow route:
>
> ```
> POST /backend/workflow/delivery-mission/{id}/execute
> ```
>
> `create_delivery_mission` is a **creation** decision (`id = 0`) and also has a dedicated REST
> shortcut — a thin wrapper around `WorkflowController::executeDecision()`, same guards, same
> idempotency requirement, same response shape as calling the generic route directly.

---

### 8.1 Create Delivery Mission ⚡

`POST /backend/dispatcher/delivery-missions`

(`DispatcherController::createDeliveryMission()` → `decision: "create_delivery_mission"`,
modelType `delivery-mission`, `id = 0`.)

Drag & drop one or more **confirmed** orders into a new mission. Creates the
`DeliveryMission` (driver + vehicle required up front) **and**, in the same call, generates one
`DeliveryNote` (BL) per partner — orders for the same partner are merged into a single BL, with
their line items summed by `product_id`. No stock is touched at this step; every BL lands in
`draft` and the source orders move from `confirmed` to `converted_to_bl`.

```bash
curl -X POST https://api.omni360.cloud/api/backend/dispatcher/delivery-missions \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -H "Idempotency-Key: mission:create:$(date +%s)" \
  -d '{
    "order_ids": [201, 207, 212],
    "rider_id": 9,
    "vehicle_id": 3,
    "notes": "Tournée matinale zone Centre"
  }'
```

**Request body:**

| Field | Required | Type | Description |
|---|---|---|---|
| `order_ids` | yes | `number[]` | Confirmed BC IDs to drag into the mission. Must all share the same `branch_id` — a `mixed_branches` violation is returned otherwise |
| `rider_id` | yes | `number` | Driver — must exist |
| `vehicle_id` | yes | `number` | Vehicle — must exist |
| `branch_code` | no | `string` | Derived from the selected orders' `branch_id` if omitted |
| `notes` | no | `string` | Free text |

**Response `200`:**
```json
{
  "success": true,
  "message": "Decision executed successfully",
  "decision": "create_delivery_mission",
  "output": {
    "mission_id": 14,
    "mission_number": "MSN-20260619-0001",
    "status": "draft",
    "rider_id": 9,
    "vehicle_id": 3,
    "branch_code": "A0001",
    "bl_count": 2,
    "delivery_notes": [
      {
        "id": 501,
        "delivery_number": "BL-2026-00501",
        "partner_id": 12,
        "order_ids": [201, 207],
        "items_count": 3
      },
      {
        "id": 502,
        "delivery_number": "BL-2026-00502",
        "partner_id": 18,
        "order_ids": [212],
        "items_count": 1
      }
    ]
  }
}
```

**Response `422` — validation failures:** `no_orders`, `driver_required`/`driver_not_found`,
`vehicle_required`/`vehicle_not_found`, `orders_not_found`, `order_not_confirmed` (per-order, with
`order_id`/`status` context), `mixed_branches` (with `branch_ids` context).

---

### 8.2 Confirm Delivery Mission ⚡

`POST /backend/workflow/delivery-mission/{id}/execute` with `decision: "confirm_delivery_mission"`

Mission-level, **one atomic call** (no dedicated REST shortcut — use the generic workflow route).
**Replaces the old two-step `allocate_delivery_note` + `generate_preparation_for_mission` pair**
(both removed 2026-06-21). In a single `DB::transaction()`:

1. For every `draft` BL on the mission: shortage-tolerant stock allocation, identical semantics to
   the old `allocate_delivery_note` — never throws on shortage, allocates whatever is really
   available per line, re-injects the uncovered delta as a new backlog `Order`
   (`bc_status: CONFIRMED`) via `ShortageBacklogService::createBacklogOrders()`. Every BL moves to
   `confirmed` regardless of coverage — there is **no `partially_allocated` BL status**.
2. Aggregates every BL's `allocated_quantity` (not `ordered_quantity`) by `product_id` into ONE
   `PreparationOrder` (BP) for the whole mission. Mission → `in_preparation`, every BL → `batched`.
3. **Edge case — fully backlogged:** if every line across every BL came back with 0 allocated
   (zero stock anywhere), **no BP is generated** and the mission is left in `draft` —
   `output.fully_backlogged: true`, `output.preparation: null`. This avoids creating a ghost BP
   with zero items; the dispatcher can retry later once stock arrives, or cancel the mission.

```bash
curl -X POST "https://api.omni360.cloud/api/backend/workflow/delivery-mission/14/execute" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -H "Idempotency-Key: mission:14:confirm:$(date +%s)" \
  -d '{"decision": "confirm_delivery_mission"}'
```

**Constraint:** mission must be `draft` with ≥1 `draft` BL.

**Response `200` — normal (stock found, BP generated):**
```json
{
  "success": true,
  "message": "Decision executed successfully",
  "decision": "confirm_delivery_mission",
  "output": {
    "mission_id": 14,
    "mission_number": "MSN-20260619-0001",
    "status": "in_preparation",
    "allocations": [
      {
        "delivery_note_id": 501,
        "delivery_number": "BL-2026-00501",
        "total_ordered": 40,
        "total_allocated": 40,
        "allocation_rate": 100.0,
        "backlog_orders": [],
        "backlog_orders_count": 0
      }
    ],
    "preparation": {
      "bp_id": 88,
      "bp_number": "BP-2026-00088",
      "status": "pending",
      "bl_count": 2,
      "items_count": 4
    },
    "fully_backlogged": false
  }
}
```

**Response `200` — fully backlogged (no stock anywhere, mission stays draft):**
```json
{
  "success": true,
  "decision": "confirm_delivery_mission",
  "output": {
    "mission_id": 14,
    "status": "draft",
    "allocations": [
      { "delivery_note_id": 501, "total_ordered": 40, "total_allocated": 0, "allocation_rate": 0.0,
        "backlog_orders": [{ "id": 318, "order_code": "BC-2026-00318" }], "backlog_orders_count": 1 }
    ],
    "preparation": null,
    "fully_backlogged": true
  }
}
```

**Response `422`:** `invalid_status` (mission not `draft`), `no_draft_bls` (mission has no `draft`
BLs to allocate).

---

### 8.3 Start Delivery Mission ⚡

`POST /backend/workflow/delivery-mission/{id}/execute` with `decision: "start_delivery_mission"`

Rider departs. Mission must be `ready` (BP completed, warehouse transfer already generated by
`complete_preparation` — see §12c). Moves the mission to `in_transit` and every linked BL to
`in_transit`.

```bash
curl -X POST "https://api.omni360.cloud/api/backend/workflow/delivery-mission/14/execute" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -H "Idempotency-Key: mission:14:start:$(date +%s)" \
  -d '{"decision": "start_delivery_mission"}'
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Decision executed successfully",
  "decision": "start_delivery_mission",
  "output": {
    "mission_id": 14,
    "mission_number": "MSN-20260619-0001",
    "status": "in_transit",
    "started_at": "2026-06-19T08:30:00+00:00"
  }
}
```

**Response `422`:** `invalid_status` — mission must be `ready`.

---

### 8.4 Complete Delivery Mission ⚡

`POST /backend/workflow/delivery-mission/{id}/execute` with `decision: "complete_delivery_mission"`

All deliveries done — mission must be `in_transit`. Lightweight version: does not yet enforce
full BL-by-BL delivery reconciliation (`DeliveryMission::isFullyReconciled()` exists for a future
guard, not currently checked here). Computes delivery stats via `DeliveryMission::computeStats()`
and persists them on the mission.

```bash
curl -X POST "https://api.omni360.cloud/api/backend/workflow/delivery-mission/14/execute" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -H "Idempotency-Key: mission:14:complete:$(date +%s)" \
  -d '{"decision": "complete_delivery_mission", "close_notes": "RAS"}'
```

**Request body:** `close_notes` (string, optional).

**Response `200`:**
```json
{
  "success": true,
  "message": "Decision executed successfully",
  "decision": "complete_delivery_mission",
  "output": {
    "mission_id": 14,
    "mission_number": "MSN-20260619-0001",
    "status": "completed",
    "closed_at": "2026-06-19T17:05:00+00:00",
    "total_bls": 2,
    "delivered_bls": 2,
    "failed_bls": 0,
    "total_returns": 0,
    "total_cod_collected": 0,
    "delivery_rate": 100.0
  }
}
```

**Response `422`:** `invalid_status` — mission must be `in_transit`.

---

### 8.5 Update Delivery Mission ⚡

`POST /backend/workflow/delivery-mission/{id}/execute` with `decision: "update_delivery_mission"`

Edit rider/vehicle/notes, add/remove whole BLs, or add/remove individual BCs (orders). All of this
is **only** available while the mission is still `draft` — once a BP has been generated
(`in_preparation`+), use `reopen_delivery_mission` (§8.6) first.

```bash
curl -X POST "https://api.omni360.cloud/api/backend/workflow/delivery-mission/14/execute" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -H "Idempotency-Key: mission:14:update:$(date +%s)" \
  -d '{
    "decision": "update_delivery_mission",
    "rider_id": 11,
    "add_delivery_note_ids": [504],
    "remove_delivery_note_ids": [502],
    "remove_order_ids": [318],
    "add_order_ids": [318]
  }'
```

**Request body:**

| Field | Required | Type | Description |
|---|---|---|---|
| `rider_id` | no | `number` | Change driver |
| `vehicle_id` | no | `number` | Change vehicle |
| `notes` | no | `string` | Free text |
| `add_delivery_note_ids` | no | `number[]` | BLs to attach (must be `draft`-only mission, same `branch_code`) |
| `remove_delivery_note_ids` | no | `number[]` | BLs to detach — reverts them to `draft` with `delivery_mission_id: null` |
| `add_order_ids` | no | `number[]` | **New 2026-06-22.** Confirmed BC IDs to attach. Merges into an existing draft BL for that partner if one already exists on this mission, otherwise creates a new one — same logic `create_delivery_mission` uses |
| `remove_order_ids` | no | `number[]` | **New 2026-06-22.** BC IDs to detach from this mission. The order reverts to a standalone `confirmed` BC (`delivery_mission_id: null`), free to be edited by a salesperson. If it was merged into a BL with sibling BCs (same partner), the BL's items are recomputed from the remaining BCs; if it was the only BC behind that BL, the BL is deleted entirely. **Use this — not `remove_delivery_note_ids` — when you only need to pull one BC out of a multi-BC BL**, since `remove_delivery_note_ids` detaches the whole BL (and every BC behind it) at once. To put the BC back after editing it, call `update_delivery_mission` again with `add_order_ids` |

**Response `200`:**
```json
{
  "success": true,
  "message": "Decision executed successfully",
  "decision": "update_delivery_mission",
  "output": {
    "mission_id": 14,
    "mission_number": "MSN-20260619-0001",
    "updates": { "rider_id": 11 },
    "added_bls": [{ "id": 504, "delivery_number": "BL-2026-00504" }],
    "removed_bls": [{ "id": 502, "delivery_number": "BL-2026-00502" }],
    "added_from_orders": [
      { "id": 501, "delivery_number": "BL-2026-00501", "partner_id": 12, "order_ids": [318], "items_count": 2, "merged_into_existing": true }
    ],
    "removed_orders": [
      { "order_id": 318, "order_code": "BC-2026-00318", "bl_deleted": false, "bl_id": 501, "remaining_order_ids": [201] }
    ],
    "current_bl_count": 2
  }
}
```

`removed_orders[].bl_deleted: true` and `bl_id: null` when the detached BC was the only one behind
its BL (whole BL removed). `removed_orders[].remaining_order_ids` lists the sibling BCs still
behind that BL after the recompute.

**Response `422`:** `mission_not_draft` (mission isn't `draft`), `driver_not_found`,
`vehicle_not_found`, `orders_not_in_mission` (a `remove_order_ids` entry isn't currently linked to
this mission), `order_not_confirmed`/`mixed_branches` (same `add_order_ids` checks as
`create_delivery_mission`, §8.1).

---

### 8.6 Reopen Delivery Mission ⚡ **(new 2026-06-22)**

`POST /backend/workflow/delivery-mission/{id}/execute` with `decision: "reopen_delivery_mission"`

Atomic rollback from `in_preparation` back to `draft` — the mission-edit equivalent for a
**confirmed mission**, used when a salesperson needs to change a BC that's already inside it (the
BL set is normally locked once a BP exists). One call, one `DB::transaction()`, all-or-nothing:

1. The mission's current BP is marked `status: cancelled` — **never deleted**, kept for audit.
2. Any stock reservation already allocated to the mission's BLs is released back to available
   stock (same mechanism `cancel_delivery_mission` uses).
3. The mission's BLs revert to `draft`, every item's `allocated_quantity` reset to `0`.
4. Mission → `draft`.

After reopening, use `update_delivery_mission`'s `remove_order_ids`/`add_order_ids` (§8.5) to
detach the BC, let the salesperson edit it, and re-attach it — then call
`confirm_delivery_mission` (§8.2) again to re-allocate and generate a fresh BP.

```bash
curl -X POST "https://api.omni360.cloud/api/backend/workflow/delivery-mission/14/execute" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -H "Idempotency-Key: mission:14:reopen:$(date +%s)" \
  -d '{"decision": "reopen_delivery_mission", "reason": "BC 318 needs a quantity correction"}'
```

**Request body:** `reason` (string, optional — used as the stock-release audit reason).

**Constraint:** mission must be `in_preparation` **and** its BP must still be `pending` or
`in_progress`. **Race condition guard:** if the magasinier has already run `complete_preparation`
or `reject_preparation` on the BP (status no longer `pending`/`in_progress`) — even if that
happened concurrently, between this request being validated and the row lock being acquired — the
call is rejected with `bp_already_finalized`. **Do not let the UI silently retry this error** —
surface it to the dispatcher so they know the magasinier got there first.

**Response `200`:**
```json
{
  "success": true,
  "message": "Decision executed successfully",
  "decision": "reopen_delivery_mission",
  "output": {
    "mission_id": 14,
    "mission_number": "MSN-20260619-0001",
    "status": "draft",
    "cancelled_bp_id": 88,
    "cancelled_bp_number": "BP-2026-00088",
    "reopened_bls": [{ "id": 501, "delivery_number": "BL-2026-00501" }]
  }
}
```

**Response `422`:** `invalid_status` (mission not `in_preparation`), `no_preparation_order` (no BP
to cancel), `bp_already_finalized` (BP status is no longer `pending`/`in_progress` — see the race
condition note above).

---

### 8.7 Cancel Delivery Mission ⚡

`POST /backend/workflow/delivery-mission/{id}/execute` with `decision: "cancel_delivery_mission"`

Only a `draft` mission can be cancelled (no BP generated yet — for an `in_preparation` mission, use
`reopen_delivery_mission` §8.6 first, then `update_delivery_mission` to detach the BLs/BCs you no
longer want before re-confirming, or simply leave the mission in `draft` un-confirmed). Releases
the BL-level stock reservation made by `confirm_delivery_mission` for every linked BL, reverts each
BL to `cancelled`, and marks the mission `cancelled`. Simplified versus the old `cancel_bch`: **no
décharge record is generated** — a draft mission never had goods physically picked or loaded, so
there is nothing to unload.

```bash
curl -X POST "https://api.omni360.cloud/api/backend/workflow/delivery-mission/14/execute" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -H "Idempotency-Key: mission:14:cancel:$(date +%s)" \
  -d '{
    "decision": "cancel_delivery_mission",
    "reason": "Livreur indisponible. Mission sera recréée demain."
  }'
```

**Request body:** `reason` (string, required, min 10 chars).

**Constraint:** Only `draft` missions can be cancelled.

**Response `200`:**
```json
{
  "success": true,
  "message": "Decision executed successfully",
  "decision": "cancel_delivery_mission",
  "output": {
    "mission_id": 14,
    "mission_number": "MSN-20260619-0001",
    "status": "cancelled",
    "cancelled_bls": [
      { "id": 501, "delivery_number": "BL-2026-00501" },
      { "id": 502, "delivery_number": "BL-2026-00502" }
    ],
    "reason": "Livreur indisponible. Mission sera recréée demain."
  }
}
```

**Response `422`:** `invalid_status` (mission not `draft`), `reason_required`.

---

### 8.8 Mission Detail

`GET /backend/workflow/delivery-mission/{id}`

(`WorkflowController::showDeliveryMission()`.) Full mission detail with BLs, BP, rider,
dispatcher, vehicle.

```bash
curl "https://api.omni360.cloud/api/backend/workflow/delivery-mission/14" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:**
```json
{
  "success": true,
  "mission": {
    "id": 14,
    "mission_number": "MSN-20260619-0001",
    "branch_code": "A0001",
    "dispatcher_id": 7,
    "rider_id": 9,
    "vehicle_id": 3,
    "rider": { "id": 9, "name": "Youssef Livreur" },
    "dispatcher": { "id": 7, "name": "Karim Dispatcher" },
    "status": "in_preparation",
    "started_at": null,
    "closed_at": null,
    "notes": "Tournée matinale zone Centre",
    "created_at": "2026-06-19T07:00:00+00:00"
  },
  "delivery_notes": [
    {
      "id": 501,
      "delivery_number": "BL-2026-00501",
      "status": "batched",
      "partner": { "id": 12, "name": "Supermarché Atlas" },
      "items": [ { "id": 2001, "product_id": 55, "ordered_quantity": 20, "allocated_quantity": 20, "product": { "id": 55, "name": "Huile Végétale 5L" } } ]
    }
  ],
  "preparation_order": {
    "id": 88,
    "bp_number": "BP-2026-00088",
    "status": "pending",
    "items": [ { "id": 3001, "product_id": 55, "requested_quantity": 20, "prepared_quantity": 0 } ]
  }
}
```

`GET /backend/workflow/delivery-mission/{id}/decisions` and `.../history` work the same way as
for other model types — see §16.

---

### 8.9 Batch Preview (virtual, read-only)

`GET /backend/dispatcher/delivery-missions/batch-preview`

(`DispatcherController::missionsBatchPreview()`.) The replacement for the old `LogisticsBatch`
concept — **purely virtual**, nothing is persisted. Aggregates `SUM(requested_quantity)` and
`SUM(prepared_quantity)` **GROUP BY `product_id`** across the `preparation_order_items` of the
given missions' BPs, so the Magasinier can get a combined picking PDF without a `logistics_batches`
row ever existing in the database. Per `planning_refactor_schema.md` §4, this is a deliberate
trade-off — no DB-level audit trail of "what was picked together," only application logs.

**Query parameters:** `mission_ids[]` (required, 1+ — pass 2+ for an actual cross-mission
aggregation).

```bash
curl "https://api.omni360.cloud/api/backend/dispatcher/delivery-missions/batch-preview?mission_ids[]=14&mission_ids[]=15" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:**
```json
{
  "success": true,
  "missions": [
    {
      "id": 14,
      "mission_number": "MSN-20260619-0001",
      "status": "in_preparation",
      "rider": { "id": 9, "name": "Youssef Livreur" },
      "vehicle": { "id": 3, "plate_number": "12345-A-1" },
      "bp_id": 88,
      "bp_number": "BP-2026-00088"
    },
    {
      "id": 15,
      "mission_number": "MSN-20260619-0002",
      "status": "in_preparation",
      "rider": { "id": 10, "name": "Hicham Livreur" },
      "vehicle": { "id": 4, "plate_number": "67890-B-2" },
      "bp_id": 89,
      "bp_number": "BP-2026-00089"
    }
  ],
  "products": [
    {
      "product_id": 55,
      "product_name": "Huile Végétale 5L",
      "total_requested": 60,
      "total_prepared": 0,
      "missions": [
        { "mission_id": 14, "bp_id": 88, "quantity": 20 },
        { "mission_id": 15, "bp_id": 89, "quantity": 40 }
      ]
    }
  ]
}
```

**Response `422`:** `{"success": false, "message": "mission_ids is required."}` if no
`mission_ids` are passed. Missions with no BP yet (`preparationOrder` null) are silently skipped
from the `products` aggregation but still listed in `missions`.

---

## 9. Delivery Orders (DO) — REMOVED

> **2026-06-20** — Delivery Orders are gone. The whole BC → DO intermediate layer (both the old
> LOT bulk-picking pipeline and the "Dispatch V2" per-DO pipeline) has been removed —
> `create_delivery_mission` (§8.1) now generates `DeliveryNote`s (BLs) directly from confirmed
> orders, grouped by partner, in a single call. The `delivery_orders`, `delivery_order_items`,
> and `delivery_order_orders` tables are dropped (`database/migrations/2026_07_17_130000_drop_shipment_delivery_order_logistics_batch_tables.php`).
> `GET/POST /backend/dispatcher/delivery-orders*` and the `delivery-order`/`do` workflow model
> type no longer exist — do not build against them. See [Delivery Missions](#8-delivery-missions).

---

## 10. Preparations — Shortage Queue ⚠️ broken — references dropped relations

`GET /backend/dispatcher/preparations/shortage-queue`

> **Not migrated — calling this will error.** `DispatcherController::preparationsShortageQueue()`
> still calls `->whereHas('logisticsBatch', ...)` and `->whereHas('bonChargement', ...)` on
> `PreparationOrder` — both relations were **explicitly removed** from the model on 2026-06-20
> (see `App\Models\PreparationOrder`'s own docblock comment: `shipment() / deliveryOrder() /
> bonChargement() REMOVED 2026-06-20 — ... Use deliveryMission()`). Calling either relation name
> now throws `BadMethodCallException`. This endpoint was not updated as part of the migration —
> do not build against it until it's fixed to scope by `deliveryMission` instead. Flag to backend.
>
> Intended behavior (once fixed): lists BPs in shortage states (`completed_partial`,
> `awaiting_shortage_review`, `shortage_accepted`) that require the dispatcher to take action.

---

## 11. Decharges

Returns and delivery cancellations are tracked as **décharges**.

### `GET /backend/dispatcher/decharges`

**Query parameters:** `type` (return / cancellation), `status`, `page`

```bash
curl "https://api.omni360.cloud/api/backend/dispatcher/decharges?status=pending" \
  -H "Authorization: Bearer {TOKEN}"
```

### `GET /backend/dispatcher/decharges/{id}`

Full décharge detail (`App\Models\UnloadOrder`) including items, related BL, and partner.

> **Partially broken — `bonChargement` relation references a dropped table.**
> `dechargesIndex()`/`showDecharge()` eager-load `UnloadOrder::bonChargement()`, defined as
> `belongsTo(Shipment::class, 'shipment_id')` — `Shipment`/`shipments` is dropped. Per
> `planning_refactor_schema.md` §2, `unload_orders.shipment_id` was supposed to be migrated to
> `delivery_mission_id`, but that satellite-table cleanup has not happened yet — `shipment_id`
> still exists on `unload_orders` but always points at rows that no longer exist (the
> `shipments` table itself is gone), and the `bonChargement()` relation will throw on access.
> List/detail calls may still partially succeed (Eloquent eager-loads lazily per relation), but
> don't rely on the `bonChargement`/`bon_chargement` key in the response. Flag to backend.

### `POST /backend/dispatcher/decharges/{id}/approve-return` ⚡

Approve a return or cancellation request.

```bash
curl -X POST https://api.omni360.cloud/api/backend/dispatcher/decharges/15/approve-return \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: decharge:15:approve:1718360300" \
  -d '{"comment": "Retour accepté — produits en bon état."}'
```

### `POST /backend/dispatcher/decharges/{id}/reject` ⚡

Reject a return request.

```bash
curl -X POST https://api.omni360.cloud/api/backend/dispatcher/decharges/15/reject \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: decharge:15:reject:1718360400" \
  -d '{"reason": "Produits endommagés par mauvaise manipulation du client."}'
```

---

## 12. Riders & Vehicles

### `GET /backend/dispatcher/livreurs`

List available riders (delivery drivers).

```bash
curl https://api.omni360.cloud/api/backend/dispatcher/livreurs \
  -H "Authorization: Bearer {TOKEN}"
```

### `GET /backend/dispatcher/vehicles`

List active vehicles for the dispatcher's branch — use this to populate dropdowns wherever
`vehicle_id` is requested (`create_delivery_mission`, §8.1), instead of asking the user to type a
raw numeric ID. Scoped by `Auth::user()->branch_code` when set (unscoped — returns all active
vehicles — if the authenticated user has no `branch_code`).

```bash
curl https://api.omni360.cloud/api/backend/dispatcher/vehicles \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": 3,
      "plate_number": "12345-A-1",
      "internal_code": "VH-03",
      "make": "Mercedes",
      "model": "Actros",
      "type": "truck",
      "capacity_volume": 85.50,
      "capacity_weight": 15000.00,
      "payload_kg": null,
      "capacity_length": 12.00,
      "capacity_width": 2.40,
      "capacity_height": 2.60,
      "usable_volume_ratio": 0.850,
      "loading_efficiency_ratio": 0.900,
      "cold_chain_enabled": false,
      "status": "active",
      "branch_code": "A0001",
      "has_active_shipments": false
    }
  ]
}
```

> **Added 2026-06-17:** `capacity_length`/`width`/`height`, `usable_volume_ratio`,
> `loading_efficiency_ratio`, and `cold_chain_enabled` were not previously returned by this
> endpoint (only `/backend/riders/with-vehicles` had them) — added for parity, so a
> standalone Vehicles screen (no rider context) can compute "useful volume"
> (`capacity_volume × usable_volume_ratio × loading_efficiency_ratio`, same formula
> `DeliveryOrderLoadEstimationService` uses for the WMS volumetric gate, §16) without going
> through the riders endpoint. `cold_chain_enabled` is a real column on `vehicles`
> (`Schema::getColumnListing('vehicles')` confirmed it) — it was just never selected by this
> endpoint before. Verified via tinker post-fix: all fields present in the response.

`capacity_volume` is in **m³**, `capacity_weight`/`payload_kg`/`capacity_length`/`width`/`height`
are in **kg**/**m** respectively (see §17 `vehicles` schema below for the full column list).
This endpoint does not currently expose a real-time availability flag (e.g. "already assigned to
an active mission today") — only `status = active/maintenance/retired`. Flag to backend if the
frontend needs live availability.

---

## 12c. Warehouse Transfers

> **2026-06-20 — mission-driven creation.** Warehouse Transfers are no longer created via a
> dispatcher-triggered endpoint. There is **no more `POST .../warehouse-transfers/from-bch/{bchId}`**
> (BCH is gone) and **no equivalent `from-mission` endpoint either** — WT creation is now fully
> internal: `WarehouseTransferService::createFromMission()` is called automatically by
> `CompletePreparationDecision` the moment the mission's BP is completed (see §8.2/§2). The
> dispatcher only ever **reads** WTs (list/detail) and can **accept**/**reject** one; they never
> "create" one through the API.

A **Warehouse Transfer** (WT) moves stock from the **depot to a rider's van** (CENTRAL → VAN),
one per mission, keyed by `delivery_mission_id` (not `shipment_id` anymore — that column still
exists on the table for historical rows but new transfers are mission-scoped). There is still
**no generic "create an arbitrary transfer between two branches" endpoint or service method**
anywhere in the codebase — every WT is tied to a source document: a delivery mission
(`createFromMission`), a loading request, or a décharge reconciliation.

### `GET /backend/dispatcher/warehouse-transfers`

**Query parameters:** `status`, `sync_status` (`synced`/anything else), `rider_id`, `page` (`WarehouseTransferController::index()`).

```bash
curl "https://api.omni360.cloud/api/backend/dispatcher/warehouse-transfers" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:** `{ "transfers": <paginator> }` — note the wrapper key is `transfers`, not `data`, and there's no top-level `success` key.

```json
{
  "transfers": {
    "current_page": 1,
    "per_page": 20,
    "total": 2,
    "data": [
      {
        "id": 5,
        "transfer_number": "WT-2026-00005",
        "status": "pending",
        "delivery_mission_id": 14,
        "rider_id": 9,
        "from_warehouse": "MAIN-A0001",
        "to_warehouse": "VAN-9",
        "transfer_type": "dispatcher",
        "progress_level": 0,
        "synced_to_erp": false,
        "delivery_mission": { "id": 14, "mission_number": "MSN-20260619-0001" },
        "livreur": { "id": 9, "name": "Youssef Livreur" },
        "created_at": "2026-06-19T13:00:00Z"
      }
    ]
  }
}
```

### `GET /backend/dispatcher/warehouse-transfers/{id}`

Full transfer detail with items, mission, rider, accepter. (`WarehouseTransferController::show()` → `WarehouseTransferService::getTransferDetails()`.)

```bash
curl "https://api.omni360.cloud/api/backend/dispatcher/warehouse-transfers/5" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:** `{ "transfer": <WarehouseTransfer> }` (wrapper key `transfer`, singular).

```json
{
  "transfer": {
    "id": 5,
    "transfer_number": "WT-2026-00005",
    "status": "pending",
    "delivery_mission_id": 14,
    "rider_id": 9,
    "from_warehouse": "MAIN-A0001",
    "to_warehouse": "VAN-9",
    "notes": null,
    "accepted_by": null,
    "accepted_at": null,
    "delivery_mission": {
      "id": 14,
      "mission_number": "MSN-20260619-0001",
      "delivery_notes": [ { "id": 501, "partner": { "id": 12, "name": "Supermarché Atlas" } } ]
    },
    "livreur": { "id": 9, "name": "Youssef Livreur" },
    "items": [
      {
        "id": 101,
        "product_id": 55,
        "product_name": "Huile Végétale 5L",
        "requested_quantity": 20,
        "transferred_quantity": 20,
        "delivered_quantity": 0,
        "returned_quantity": 0,
        "unit_price": 3200.00,
        "delivery_note_id": 501,
        "sales_group_code": "DRY",
        "product": { "id": 55, "name": "Huile Végétale 5L" }
      }
    ],
    "created_at": "2026-06-19T13:00:00Z"
  }
}
```

> `transferred_quantity` is sourced from each BL item's `prepared_quantity` (falling back to
> `allocated_quantity` if a line was never synced from the BP) — it reflects what the Magasinier
> actually picked, not what was originally requested.

### `POST /backend/dispatcher/warehouse-transfers/{id}/accept` ⚡

```bash
curl -X POST "https://api.omni360.cloud/api/backend/dispatcher/warehouse-transfers/5/accept" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: wt:5:accept:$(date +%s)" \
  -d '{}'
```

Sets `status: accepted`, `accepted_by: <user id>`, `accepted_at: now()`, `progress_level: 50`. No body required, no status guard in the controller (callable from any status — be careful, this is not currently gated to `pending` only).

**Response `200`:** `{"success": true, "message": "..."}`.

### `POST /backend/dispatcher/warehouse-transfers/{id}/reject` ⚡

```bash
curl -X POST "https://api.omni360.cloud/api/backend/dispatcher/warehouse-transfers/5/reject" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: wt:5:reject:$(date +%s)" \
  -d '{"reason": "Stock insuffisant au dépôt principal."}'
```

**Request body:** `reason` (string, required, max 1000 chars) — stored in `notes`, not a dedicated `rejection_reason` column.

**Response `200`:** `{"success": true, "message": "..."}`.

### What's still missing (real gaps, not just undocumented)

- No `ship`/`in_transit`/`receive`/`partially_received` transitions exist anywhere in
  `WarehouseTransferService` or the controller. The real lifecycle observed in code is just
  `pending → accepted → completed` (plus `rejected` as a terminal alternative, and `validated`
  used only by the décharge-reconciliation creation path). If your screen needs ship/receive
  actions, they need to be built from scratch — this isn't a routing gap like list/detail/accept/
  reject were.
- No manual/arbitrary transfer creation, and no dispatcher-triggered "create" endpoint at all
  anymore (see the note above) — creation is 100% internal to `complete_preparation`.
- `accept`/`reject` have **no status guard** (no check that the transfer is currently `pending`
  before transitioning) and **no idempotency replay check** beyond the header requirement —
  unlike the BL/Delivery-Mission decision engine, this controller does direct `$model->update()`
  calls, not the `Decision` class pattern used elsewhere in this doc. Flag to backend if you need
  the same guarantees (constraint checks, replay-safe responses) as the rest of the dispatcher API.

### Real `warehouse_transfers` status values (from code, not invented)

| Status | Meaning | Set by |
|---|---|---|
| `pending` | Created, awaiting acceptance | `createFromMission()` (auto, on BP completion) |
| `accepted` | Dispatcher/rider accepted | `accept()` |
| `completed` | Delivery fully reconciled | various service flows |
| `rejected` | Rejected, reason in `notes` | `reject()` |
| `validated` | Auto-validated (décharge-reconciliation creation path only) | `createDechargeReconciliationWarehouseTransfer()` |

---

## 12d. Fleet & Rider Master Data

Endpoints to populate the dispatcher's fleet/rider workspace — vehicle list, rider list, and
who's currently assigned to which vehicle. Most of this already existed in the codebase before
2026-06-17 but was scattered across three different controllers/route files and undocumented;
this section consolidates it. **Note the base URL split** — most of this doc lives under
`/api/backend/...`, but the assignment endpoints below are at the **root `/api/...`** (no
`backend` segment) — easy to miss.

### `GET /backend/dispatcher/vehicles`

See §12 — full vehicle list (all types: truck/van/motorcycle), branch-scoped, with capacity fields.

### `GET /backend/riders`

Standard `apiResource` CRUD (`RiderController`) — `index`/`show`/`store`/`update`/`destroy`.
`index` filters drivers (`role: driver`) and eager-loads their **active** delivery notes
(`in_transit`/`loaded`/`grouped`) plus `branch`. Query params: `status`, `branch_code`, `search`
(matches `first_name`/`last_name`/`phone`/`email` — note: `first_name`, not `name`; if your
`User` model doesn't have a `first_name` column this filter silently matches nothing, a
pre-existing quirk, not a doc error).

**Response `200`:** wrapped, not a plain paginator — `{ "riders": <paginator>, "branches": <Branch[]> }`
(the second key is the full branches list, for populating a branch filter dropdown alongside the rider list).

`GET /backend/riders/{id}` (`show`) additionally returns delivery stats:
```json
{
  "user": { "id": 9, "name": "Youssef Livreur", "...": "..." },
  "active_delivery_notes": [ { "id": 501, "status": "in_transit", "partner": {"...":"..."}, "order": {"...":"..."} } ],
  "completed_delivery_notes_count": 42,
  "total_b2b_deliveries": 50
}
```

### `GET /backend/riders/simple`

Lightweight rider list for dropdowns — `id`, `name`, `last_name`, `phone`, `email`,
`branch_code`, `is_active` only. Query params: `branch_code`, `status` (`approved` = active).

### `GET /backend/riders/with-vehicles`

**The key endpoint for an assignment screen** — each rider with their currently assigned
vehicle(s) and full capacity data in one call (avoids N+1 round-trips between riders and
vehicles lists). Query params: `branch_code`, `status` (`approved`/`active`), `search` (name/last_name/phone/email).

> **Fixed 2026-06-17:** this endpoint (and `index`/`simple` above) used to `500` with
> `SQLSTATE[42703]: Undefined column "branch_code"` — it did `->select([..., 'branch_code', ...])`,
> a raw SQL column reference, which bypasses the `User::branchCode()` accessor entirely and hit
> the real (now `branch_id`-only) `users` table directly. Fixed to `select([..., 'branch_id', ...])`
> and `?branch_code=` filtering now resolves through `Branch::where('code', ...)->value('id')`
> before querying. Verified working via tinker post-fix.

```bash
curl "https://api.omni360.cloud/api/backend/riders/with-vehicles?branch_code=A0001&status=approved" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "riders": [
      {
        "id": 9,
        "name": "Youssef Livreur",
        "last_name": "Livreur",
        "phone": "+212600112233",
        "email": "youssef@foodsolution.com",
        "branch_code": "A0001",
        "branch": { "code": "A0001", "name": "Casablanca Centre" },
        "is_active": true,
        "vehicles": [
          {
            "id": 3,
            "plate_number": "12345-A-1",
            "internal_code": "VH-03",
            "make": "Mercedes", "model": "Actros", "year": 2022, "type": "truck",
            "capacity_volume": 85.50, "capacity_weight": 15000.00,
            "capacity_length": 12.0, "capacity_width": 2.4, "capacity_height": 2.6,
            "payload_kg": null, "usable_volume_ratio": 0.85, "loading_efficiency_ratio": 0.9,
            "fuel_type": "diesel", "status": "active", "notes": null,
            "has_active_shipments": false,
            "display_name": "VH-03"
          }
        ]
      }
    ]
  }
}
```
`vehicles` is an array (a rider could have 0 or, in theory, more than one active assignment) — usually 0 or 1 in practice. Empty array means no vehicle currently assigned.

### `GET /backend/riders/{id}/toggle`

Toggle a rider's `is_active` flag (approve/deactivate). **Note: this is a `GET`, not a `PATCH`/`POST`**
(`RiderController::statusToggle()`), despite being a mutation — a pre-existing REST inconsistency,
not a doc error. No request body. Response: `{"success": true, "message": "...", "is_active": true}`.

### Vehicle ↔ Rider assignment (mutations) — ⚠️ different base URL: `/api/...`, not `/api/backend/...`

```bash
# List vans only (not trucks/motorcycles) with their assigned rider
curl "https://api.omni360.cloud/api/vans?branch_code=A0001" \
  -H "Authorization: Bearer {TOKEN}"

# Assign a rider to ANY vehicle (truck/van/motorcycle) — idempotency-required
# starts_at/notes/role are all optional
curl -X POST "https://api.omni360.cloud/api/vans/3/assign" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -H "Idempotency-Key: van:3:assign:$(date +%s)" \
  -d '{
    "user_id": 9,
    "starts_at": "2026-06-18T08:00:00",
    "notes": "Tournée Centre-Ville, remplace intérim de Karim",
    "role": "van_seller"
  }'

# Unassign — idempotency-required. ends_at/notes optional (defaults: ends_at=now())
# Blocked with 422 if the vehicle/rider is linked to an active delivery mission (see guard below).
curl -X POST "https://api.omni360.cloud/api/vans/3/unassign" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -H "Idempotency-Key: van:3:unassign:$(date +%s)" \
  -d '{"ends_at": "2026-06-18T18:00:00", "notes": "Fin de tournée"}'

# Update notes/ends_at/is_active on the CURRENT active assignment WITHOUT creating a new one
curl -X PUT "https://api.omni360.cloud/api/vans/3/assignment" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -H "Idempotency-Key: van:3:assignment:$(date +%s)" \
  -d '{"notes": "Véhicule en panne, intervention prévue demain"}'
```

`assign` response: `{"success": true, "message": "...", "data": <vehicle with .assignedUser>}`.
`unassign` response: `{"success": true, "message": "..."}`.
`PUT .../assignment` response: `{"success": true, "message": "...", "data": <VehicleAssignment row>}` —
`404 {"success": false, "message": "No active assignment for this vehicle."}` if the vehicle has none.

**Request body fields (all optional except `user_id` on assign):**

| Endpoint | Field | Type | Maps to `vehicle_assignments` column |
|---|---|---|---|
| `POST .../assign` | `user_id` | number, required | `user_id` |
| `POST .../assign` | `starts_at` | datetime, optional (default `now()`) | `starts_at` |
| `POST .../assign` | `notes` | string, optional, max 1000 | `notes` |
| `POST .../assign` | `role` | `van_seller`\|`delivery_agent`, optional (default `van_seller`) | `role` |
| `POST .../unassign` | `ends_at` | datetime, optional (default `now()`) | `ends_at` |
| `POST .../unassign` | `notes` | string, optional, max 1000 | `notes` |
| `PUT .../assignment` | `notes` | string, optional | `notes` |
| `PUT .../assignment` | `ends_at` | datetime, optional | `ends_at` |
| `PUT .../assignment` | `is_active` | boolean, optional | `is_active` |

`assigned_by` is always set server-side from the authenticated user — not a request field.

Internally these write to the `vehicle_assignments` table (`role: van_seller` by default, see
`VehicleAssignment::ROLE_VAN_SELLER`/`ROLE_DELIVERY_AGENT` constants) — `vehicles.driver_id`/
`assigned_user_id` columns were **dropped** by migration `2026_04_13_120000_...` in favor of this
pivot table; don't expect those columns on raw `Vehicle` model attributes.

> **Added 2026-06-17:** `starts_at`/`notes`/`role` on assign, `ends_at`/`notes` on unassign, and
> the whole `PUT .../assignment` endpoint did not exist before this date — `assign`/`unassign`
> only accepted `user_id` and hardcoded `starts_at: now()`/`ends_at: now()`, with no way to set
> `notes` or backdate/schedule `starts_at`/`ends_at`. Verified via tinker:
> `UserVanAssignmentService::reassignVan($user, $vehicle, ['notes' => '...', 'starts_at' => ...])`
> correctly persists `notes`/`starts_at` on the new `vehicle_assignments` row.

> **Fixed 2026-06-17:** `assignRider`/`unassignRider` previously hard-checked
> `$vehicle->type !== 'van'` and `404`'d otherwise — the only assign/unassign path worked for
> vans, not trucks/motorcycles. That guard has been removed (`VanController.php`); both
> endpoints now work for **any vehicle type**, since `vehicle_assignments` and
> `UserVanAssignmentService` were never actually van-specific (the stock guard,
> `VanStockGuardService::assertCanReassignRiderVan()`, already no-ops gracefully for vehicles
> with no `vanWarehouse`, i.e. trucks). The route path is still `/api/vans/{vehicle}/assign` for
> backward compatibility — the `{vehicle}` param accepts any vehicle ID regardless of type, the
> "vans" in the URL is now just legacy naming, not a type restriction. `GET /api/vans` (`index`)
> is unchanged and still lists vans only — use `/backend/dispatcher/vehicles` (§12) or
> `/backend/riders/with-vehicles` (above) for an all-types view.

### Active-mission guard on unassign

> `unassignRider` **hard-blocks with `422`** if the vehicle (or its currently-assigned rider, via
> `rider_id`) is linked to a `delivery_missions` row whose `status` is **not** `completed` or
> `cancelled` (i.e. `draft`/`in_preparation`/`ready`/`in_transit`). This prevents unassigning a
> rider/vehicle mid-mission, which would break traceability of who/what actually carried a given
> delivery. `Vehicle::activeBonChargements()` (kept its legacy method name — it's now a
> `hasMany(DeliveryMission::class, 'vehicle_id')`, see `app/Models/Vehicle.php`) is the relation
> backing this check.
> ```json
> {"success": false, "message": "Cannot unassign vehicle/rider while linked to an active Bon de Chargement."}
> ```
> (The error message text itself wasn't updated to say "mission" — still reads "Bon de
> Chargement" even though the underlying check is mission-based; flag to backend if this should
> be reworded.)
>
> To support disabling the "Retirer" button proactively in the UI instead of waiting for the
> 422, **all three vehicle-listing endpoints still include a `has_active_shipments` boolean**
> (field name kept as-is — it now reflects active missions, not `shipments` rows, which no
> longer exist): `GET /backend/dispatcher/vehicles` (§12), `GET /backend/riders/with-vehicles`
> (above, on each vehicle inside `vehicles[]`), and `GET /api/vans` (`index`). When `true`,
> hide/disable "Retirer" and show a tooltip — e.g. *"Impossible de retirer : mission en cours"*.

---

## 13. Error Handling

| HTTP Status | Meaning | Common cause |
|---|---|---|
| `401` | Unauthenticated | Missing/expired Bearer token |
| `403` | Forbidden | User lacks `dispatcher` role |
| `404` | Not Found | Resource ID doesn't exist |
| `409` | Conflict | Duplicate idempotency key with different body |
| `422` | Validation / Decision blocked | Invalid body, constraint check failed |
| `500` | Server error | Check application logs |

**422 decision blocked (workflow):**
```json
{
  "success": false,
  "message": "La décision est bloquée",
  "constraints": [
    {
      "name": "driver_required",
      "reason": "A driver (rider_id) is required to create a mission.",
      "context": { "mission_id": 14 }
    }
  ]
}
```

**Idempotency replay (already processed):**
```json
{
  "success": true,
  "message": "Already processed",
  "data": { ... }
}
```

> Idempotent replays return HTTP `200` with the original result. Never retry with the same key if the first attempt returned a non-5xx error.

---

## 14. TypeScript Interfaces

```typescript
// ─── BL Status ───────────────────────────────────────────────────────────────

type BlStatus =
  | 'draft'
  | 'confirmed'
  | 'batched'
  | 'submitted_to_magasinier'
  | 'in_preparation'
  | 'ready'
  | 'loaded'
  | 'in_transit'
  | 'delivered'
  | 'partially_delivered'
  | 'returned'
  | 'cancelled';

type DeliveryMissionStatus =
  | 'draft'
  | 'in_preparation'
  | 'ready'
  | 'in_transit'
  | 'completed'
  | 'cancelled';

type BpStatus =
  | 'pending'
  | 'in_progress'
  | 'completed_full'
  | 'completed_partial'
  | 'shortage_accepted'
  | 'awaiting_shortage_review'
  | 'partial_rework_requested'
  | 'shortage_split_done'
  | 'rejected';

// ─── Core Models ─────────────────────────────────────────────────────────────

interface Rider {
  id: number;
  name: string;
  phone?: string;
}

interface Vehicle {
  id: number;
  plate_number: string;
  capacity_kg?: number;
}

interface DeliveryNoteItem {
  id: number;
  product_id: number;
  ordered_quantity: number;
  allocated_quantity: number;
  prepared_quantity?: number | null;
  delivered_quantity?: number;
  unit_price: number;
  unit?: string;
  sales_group_code?: string | null;
  product: { id: number; name: string; sku?: string };
}

interface DeliveryNote {
  id: number;
  delivery_number: string;
  status: BlStatus;
  total_amount: number;
  delivery_date?: string;
  notes?: string;
  branch_code: string;
  is_quantity_locked: boolean;
  delivery_mission_id?: number | null;
  partner: { id: number; name: string; code: string };
  order?: { id: number; order_code: string; bc_status: string };
  rider?: Rider | null;
  dispatcher?: { id: number; name: string };
  items?: DeliveryNoteItem[];
  delivery_mission?: Pick<DeliveryMission, 'id' | 'mission_number' | 'status'> | null;
  preparation?: Pick<PreparationOrder, 'id' | 'bp_number' | 'status'> | null;
  created_at: string;
}

// ─── Delivery Mission — the dispatcher's Drag&Drop container, replaces Shipment/BCH ──

interface DeliveryMission {
  id: number;
  mission_number: string;
  status: DeliveryMissionStatus;
  rider_id: number;
  dispatcher_id?: number;
  vehicle_id: number;
  branch_code: string;
  notes?: string | null;
  started_at?: string | null;
  closed_at?: string | null;
  close_notes?: string | null;
  van_stock_reconciled: boolean;
  cod_reconciled: boolean;
  returns_reconciled: boolean;
  total_bls?: number | null;
  delivered_bls?: number | null;
  failed_bls?: number | null;
  total_returns?: number | null;
  total_cod_collected?: number | null;
  rider?: Rider | null;
  dispatcher?: { id: number; name: string } | null;
  vehicle?: Vehicle | null;
  delivery_notes?: DeliveryNote[];
  preparation_order?: PreparationOrder | null;
  created_at: string;
}

interface PreparationOrderItem {
  id: number;
  product_id: number;
  requested_quantity: number;
  available_quantity?: number;
  prepared_quantity: number;
  shortage_quantity: number;
  shortage_reason?: string | null;
  shortage_reported_at?: string | null;
}

interface PreparationOrder {
  id: number;
  bp_number: string;
  delivery_mission_id: number;
  status: BpStatus;
  total_shortage_percentage?: number;
  is_critical_shortage?: boolean;
  shortage_acknowledged: boolean;
  preparation_efficiency?: number | null;
  magasinier?: { id: number; name: string } | null;
  delivery_mission?: Pick<DeliveryMission, 'id' | 'mission_number' | 'status'> | null;
  items?: PreparationOrderItem[];
  created_at: string;
  prepared_at?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

interface DispatcherDashboard {
  pipeline: {
    bc_confirmed: number;
    missions_draft: number;
    missions_in_preparation: number;
    missions_ready: number;
    missions_in_transit: number;
    bp_pending: number;
    bp_in_progress: number;
    bp_shortage_queue: number;
    bp_rejected: number;
    bl_draft: number;
    bl_confirmed: number;
    bl_ready: number;
    bl_loaded: number;
    bl_in_transit: number;
    delivered_today: number;
  };
  alerts: {
    shortage_queue: number;
    rejected_bps: number;
    overdue_deliveries: number;
  };
  activity: {
    recent_orders: Array<Record<string, unknown>>;
    active_deliveries: Array<Pick<DeliveryNote, 'id' | 'delivery_number' | 'status'>>;
    recent_shortages: Array<Pick<PreparationOrder, 'id' | 'bp_number' | 'status' | 'total_shortage_percentage' | 'delivery_mission_id'>>;
  };
}

// ─── Batch Preview (virtual, read-only — see §8.9) ───────────────────────────

interface MissionBatchPreviewProduct {
  product_id: number;
  product_name: string | null;
  total_requested: number;
  total_prepared: number;
  missions: Array<{ mission_id: number; bp_id: number; quantity: number }>;
}

interface MissionBatchPreviewResponse {
  success: boolean;
  missions: Array<{
    id: number;
    mission_number: string;
    status: DeliveryMissionStatus;
    rider: Pick<Rider, 'id' | 'name'> | null;
    vehicle: Pick<Vehicle, 'id' | 'plate_number'> | null;
    bp_id?: number | null;
    bp_number?: string | null;
  }>;
  products: MissionBatchPreviewProduct[];
}

// ─── Warehouse Transfer (WT) ─────────────────────────────────────────────────

type TransferStatus = 'pending' | 'accepted' | 'completed' | 'rejected' | 'validated';

interface WarehouseTransferItem {
  id: number;
  product_id: number;
  product_code?: string | null;
  product_name?: string | null;
  requested_quantity: number;
  transferred_quantity: number;
  delivered_quantity: number;
  returned_quantity: number;
  unit_price: number;
  delivery_note_id?: number | null;
  sales_group_code?: string | null;
}

interface WarehouseTransfer {
  id: number;
  transfer_number: string;
  status: TransferStatus;
  transfer_type: string;
  delivery_mission_id: number;
  rider_id: number;
  from_warehouse: string;
  to_warehouse: string;
  progress_level: number;
  synced_to_erp?: boolean;
  notes?: string | null;
  accepted_by?: number | null;
  accepted_at?: string | null;
  delivery_mission?: Pick<DeliveryMission, 'id' | 'mission_number'> | null;
  livreur?: Rider | null;
  items?: WarehouseTransferItem[];
  created_at: string;
}

// ─── Workflow Decision Types ──────────────────────────────────────────────────

type BlDecision = 'update_delivery' | 'split_delivery' | 'cancel_delivery' | 'confirm_delivery' | 'mark_ready' | 'mark_loaded' | 'mark_in_transit' | 'mark_delivered' | 'mark_partial_delivery' | 'mark_returned';
// allocate_delivery_note REMOVED 2026-06-21 — folded into confirm_delivery_mission, see §2/§8.2.
type DeliveryMissionDecision = 'create_delivery_mission' | 'confirm_delivery_mission' | 'reopen_delivery_mission' | 'start_delivery_mission' | 'complete_delivery_mission' | 'update_delivery_mission' | 'cancel_delivery_mission';
// generate_preparation_for_mission REMOVED 2026-06-21 — folded into confirm_delivery_mission.
// adjust_quantities / create_decharge have NO delivery-mission equivalent yet — see §2, §8.

interface WorkflowExecuteResponse {
  success: boolean;
  message: string;
  decision?: string;
  output?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

interface WorkflowConstraint {
  name: string;
  reason: string;
  context?: Record<string, unknown>;
}
```

---

## 15. End-to-End Workflow Examples

### Example A — Full Mission Cycle (Happy Path, with both allocation outcomes)

End-to-end through the current Delivery Mission pipeline (§2, §8): BC → mission creation →
per-BL allocation → BP generation → Magasinier preparation → warehouse transfer (auto) →
mission departure → mission completion.

```bash
# Step 1: Dispatcher checks confirmed orders ready to dispatch
curl "https://api.omni360.cloud/api/backend/dispatcher/orders/pending" \
  -H "Authorization: Bearer {TOKEN}"
# → orders 201 (partner 12), 207 (partner 12), 212 (partner 18), all bc_status: "confirmed"

# Step 2: Drag & drop the 3 orders into a new mission — orders 201+207 (same partner) merge
# into ONE BL, order 212 becomes a separate BL. No stock touched yet.
curl -X POST "https://api.omni360.cloud/api/backend/dispatcher/delivery-missions" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -H "Idempotency-Key: mission:create:$(date +%s)" \
  -d '{"order_ids":[201,207,212],"rider_id":9,"vehicle_id":3,"notes":"Tournée matinale zone Centre"}'
# → output.mission_id: 14, status: "draft", bl_count: 2
#   delivery_notes: [{id: 501, partner_id: 12, order_ids: [201,207]}, {id: 502, partner_id: 18, order_ids: [212]}]

# Step 3: Confirm the mission — ONE atomic call allocates stock for every BL on it
# (BL 501 fully covered, BL 502 has a shortfall) AND generates the BP, in one transaction.
curl -X POST "https://api.omni360.cloud/api/backend/workflow/delivery-mission/14/execute" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -H "Idempotency-Key: mission:14:confirm:$(date +%s)" \
  -d '{"decision": "confirm_delivery_mission"}'
# → output.status: "in_preparation"
#   output.allocations: [
#     {delivery_note_id: 501, total_ordered: 40, total_allocated: 40, allocation_rate: 100.0, backlog_orders_count: 0},
#     {delivery_note_id: 502, total_ordered: 15, total_allocated: 9, allocation_rate: 60.0,
#      backlog_orders: [{id: 318, order_code: "BC-2026-00318", bc_status: "confirmed"}], backlog_orders_count: 1}
#   ]
#   output.preparation: {bp_id: 88, bp_number: "BP-2026-00088", bl_count: 2, items_count: 3}
#   output.fully_backlogged: false
# → BL 501/502: "confirmed" then immediately "batched" (NOT "partially_allocated" — no such BL status)
# → BC-2026-00318 (the shortfall) reappears in GET /backend/dispatcher/orders/pending, ready for a future mission

# Step 5: Magasinier executes the BP (Module 16, not repeated here) — start_preparation,
# update items while picking, then complete_preparation. On completion, BLs → "ready" AND
# WarehouseTransferService::createFromMission() auto-creates the depot→van transfer —
# mission flips straight to "ready" (no separate dispatcher-triggered WT step, see §12c).

# Step 6: Rider departs
curl -X POST "https://api.omni360.cloud/api/backend/workflow/delivery-mission/14/execute" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -H "Idempotency-Key: mission:14:start:$(date +%s)" \
  -d '{"decision": "start_delivery_mission"}'
# → output.status: "in_transit"; BLs 501/502 → "in_transit"

# Step 7: (Rider delivers — see the Rider/Livreur module, not covered here)

# Step 8: Dispatcher/rider closes the mission once all deliveries are resolved
curl -X POST "https://api.omni360.cloud/api/backend/workflow/delivery-mission/14/execute" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -H "Idempotency-Key: mission:14:complete:$(date +%s)" \
  -d '{"decision": "complete_delivery_mission", "close_notes": "RAS"}'
# → output.status: "completed", delivery_rate: 100.0 (computed via DeliveryMission::computeStats())
```

---

### Example B — Cancelling a Draft Mission

```bash
# Mission 15 is still draft (BP not generated yet) — dispatcher cancels it
curl -X POST "https://api.omni360.cloud/api/backend/workflow/delivery-mission/15/execute" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -H "Idempotency-Key: mission:15:cancel:$(date +%s)" \
  -d '{"decision":"cancel_delivery_mission","reason":"Livreur indisponible. Mission sera recréée demain."}'
# → output.status: "cancelled"; all linked BLs → "cancelled", stock reservations released
# → No décharge generated (simplification vs. the old cancel_bch — see §8.7)
```

---

### Example C — BL Split Before Allocation

```bash
# BL 501 has mixed cold chain and ambient products — must be split before allocation
curl -X POST "https://api.omni360.cloud/api/backend/dispatcher/bon-livraisons/501/split" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bl:501:split:$(date +%s)" \
  -d '{
    "decision": "split_delivery",
    "splits": [
      {"label": "Produits ambiants", "item_ids": [2001, 2002]},
      {"label": "Produits frais", "item_ids": [2003]}
    ]
  }'
# → BL 501 cancelled (split), child BLs 502 and 503 created in DRAFT
```

`SplitDeliveryDecision` (`split_delivery`, modelType `bon-livraison`) is unrelated to the dropped
Shipment/DO/LogisticsBatch tables — it only ever operated on `delivery_notes`/`delivery_note_items`,
so it carried over unchanged.

---

### Example D — Editing a BC Already Inside a Confirmed Mission **(new 2026-06-22)**

A salesperson needs to correct a quantity on BC 318, which is already merged into BL 501 inside
mission 14 — and mission 14 is already `in_preparation` (BP generated, magasinier not done yet).

```bash
# Step 1: Pull the mission back to draft — cancels the BP (kept for audit), releases the
# reserved stock, BLs → draft. Fails with bp_already_finalized if the magasinier already
# completed/rejected the BP in the meantime.
curl -X POST "https://api.omni360.cloud/api/backend/workflow/delivery-mission/14/execute" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -H "Idempotency-Key: mission:14:reopen:$(date +%s)" \
  -d '{"decision": "reopen_delivery_mission", "reason": "BC 318 quantity correction"}'
# → output.status: "draft", cancelled_bp_id: 88, reopened_bls: [{id: 501, ...}]

# Step 2: Detach BC 318 from the mission — it reverts to a standalone confirmed BC.
# BL 501 had BC 318 merged with sibling BC 201 (same partner) — items are recomputed
# from BC 201 alone, BL is NOT deleted.
curl -X POST "https://api.omni360.cloud/api/backend/workflow/delivery-mission/14/execute" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -H "Idempotency-Key: mission:14:detach:$(date +%s)" \
  -d '{"decision": "update_delivery_mission", "remove_order_ids": [318]}'
# → output.removed_orders: [{order_id: 318, bl_deleted: false, bl_id: 501, remaining_order_ids: [201]}]

# Step 3: Salesperson edits BC 318 freely (it's a standalone confirmed order now) — not
# covered here, see the Sales/ADV module.

# Step 4: Dispatcher re-attaches the corrected BC 318 to the mission.
curl -X POST "https://api.omni360.cloud/api/backend/workflow/delivery-mission/14/execute" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -H "Idempotency-Key: mission:14:reattach:$(date +%s)" \
  -d '{"decision": "update_delivery_mission", "add_order_ids": [318]}'
# → output.added_from_orders: [{id: 501, partner_id: 12, order_ids: [318], merged_into_existing: true}]

# Step 5: Re-confirm — fresh allocation + a brand-new BP, replacing the cancelled one.
curl -X POST "https://api.omni360.cloud/api/backend/workflow/delivery-mission/14/execute" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -H "Idempotency-Key: mission:14:reconfirm:$(date +%s)" \
  -d '{"decision": "confirm_delivery_mission"}'
# → output.status: "in_preparation", output.preparation.bp_id: 89 (new BP, the old one (88) stays "cancelled")
```

---

## 16. Decision Registry

All workflow decisions available to the `dispatcher` role. Execute any decision via:

```
POST /api/backend/workflow/{model-type}/{id}/execute
```

with body `{ "decision": "<decision_key>", ...fields }`.

### BL (bon-livraison) decisions

| Decision key | `allowed_roles` | `risk_level` | What it does |
|---|---|---|---|
| `confirm_delivery` | dispatcher, admin | medium | Confirms BL, reserves stock — advances to `confirmed`. **Throws on insufficient stock** (hard exception) — for mission-created BLs, stock allocation now happens via `confirm_delivery_mission` instead (§8.2), never call this on a mission BL directly |
| `update_delivery` | dispatcher, admin | low | Updates rider, delivery date, notes |
| `split_delivery` | dispatcher, admin | medium | Splits BL into 2+ child BLs — see §7.6 |
| `cancel_delivery` | dispatcher, admin | high | Cancels BL, releases reserved stock |
| `process_return` | dispatcher, admin | high | Processes a return on this BL |
| `mark_delivery_failed` | dispatcher, admin | medium | Marks delivery as failed |
| `confirm_delivery_completion` | dispatcher, admin | medium | Confirms delivery completion |
| `create_delivery_return` | rider, dispatcher, admin | medium | Rider creates an immediate return at delivery time |

### Delivery Mission decisions

Model-type slug: **`delivery-mission`** (also accepted as `mission`, normalized by
`WorkflowController::normalizeModelType()`). Full request/response shapes are documented in §8.

| Decision key | `allowed_roles` | `risk_level` | What it does |
|---|---|---|---|
| `create_delivery_mission` ⚡ | dispatcher, supply_manager, admin | medium | *(creation — `id` = `0`)* Drag&Drop confirmed orders into a new mission; generates one BL per partner. See §8.1 |
| `confirm_delivery_mission` ⚡ | dispatcher, supply_manager, admin | medium | Atomic: allocates stock for every BL, then generates the BP. Replaces `allocate_delivery_note` + `generate_preparation_for_mission` (both removed 2026-06-21). See §8.2 |
| `start_delivery_mission` | dispatcher, rider, admin | medium | Rider departs — mission must be `ready`. See §8.3 |
| `complete_delivery_mission` | dispatcher, rider, admin | medium | Mission must be `in_transit` — computes stats. See §8.4 |
| `update_delivery_mission` | dispatcher, admin | low | Edit rider/vehicle/notes/BL list/individual BCs (BL/BC list only while `draft`). See §8.5 |
| `reopen_delivery_mission` ⚡ | dispatcher, supply_manager, admin | high | **New 2026-06-22.** Cancels the BP and rolls an `in_preparation` mission back to `draft` so its BCs can be edited. See §8.6 |
| `cancel_delivery_mission` | dispatcher, admin | high | Cancel a `draft` mission, release stock. See §8.7 |

⚡ = idempotency-key required (`config('erp.idempotency.required_workflow_decisions')`).

> **Known gaps — not ported, no `delivery-mission` equivalent exists today:**
> - `adjust_quantities` (manual/equal/fifo shortage-rebalancing across multiple BLs sharing one
>   mission's BP) — `config/decisions.php`'s `delivery-mission` block has an explicit comment
>   noting this was not ported.
> - `create_decharge` (van → depot unload after a mission) — `CreateDechargeDecision` was built
>   entirely around `Shipment` and was not replaced; the `decharge` block's `approve_decharge`/
>   `reject_decharge` decisions still exist (they operate on an existing décharge created some
>   other way), but nothing currently *creates* a décharge from a delivery mission.

```bash
curl -X POST https://api.omni360.cloud/api/backend/workflow/delivery-mission/0/execute \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -H "Idempotency-Key: mission:create:$(date +%s)" \
  -d '{
    "decision": "create_delivery_mission",
    "metadata": {
      "order_ids": [201, 207, 212],
      "rider_id": 9,
      "vehicle_id": 3
    }
  }'
```

> ⚠️ **Calling convention:** decision-specific fields (`order_ids`, `rider_id`, etc.) must be
> nested under the top-level **`metadata`** key (or equivalently `data.metadata` — both are
> merged together server-side, see `WorkflowController::executeDecision()`). Putting them flat
> under `data` does **not** work — every `*Decision::validate()`/`doExecute()` reads
> `$context->data['metadata']`, which the controller always populates (with at least audit
> fields), so a flat `data` payload is silently ignored. The dedicated REST routes (§8.1, §8.2)
> handle this wrapping for you — only relevant if you call the generic workflow route directly.

### BP (bon-preparation / preparation-order) decisions

| Decision key | `allowed_roles` | `risk_level` | What it does |
|---|---|---|---|
| `start_preparation` | magasinier, warehouse, admin | low | Magasinier starts picking |
| `update_preparation` | magasinier, warehouse, admin | low | Update items while picking |
| `complete_preparation` | magasinier, warehouse, admin | medium | All items picked. On the mission flow, this is also where the warehouse transfer is auto-created (§12c) |
| `reject_preparation` | magasinier, warehouse, admin | medium | Magasinier rejects BP |
| `report_shortage` | magasinier, warehouse, admin | medium | Mark partial pick with shortage details |
| `continue_preparation` | magasinier, warehouse, admin | low | Resume a paused preparation |
| `review_partial_preparation` | dispatcher, admin | medium | Dispatcher shortage resolution (operates on BP, not BCH — BCH no longer exists) |

`create_bp_from_orders`/`create_bp_from_bls` are **removed** — a BP is now always created
atomically by `confirm_delivery_mission` (delivery-mission modelType, §8.2), never directly from
orders/BLs.

### How to check available decisions for a record

```bash
# Check which decisions are available RIGHT NOW for BL 501
curl "https://api.omni360.cloud/api/backend/workflow/bon-livraison/501/decisions" \
  -H "Authorization: Bearer {TOKEN}"

# Check for mission 14
curl "https://api.omni360.cloud/api/backend/workflow/delivery-mission/14/decisions" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:**
```json
{
  "success": true,
  "model": "bon-livraison",
  "subject_id": 501,
  "decisions": [
    {
      "key": "confirm_delivery",
      "label": "Confirmer la livraison",
      "available": true,
      "constraints": []
    },
    {
      "key": "cancel_delivery",
      "label": "Annuler la livraison",
      "available": false,
      "constraints": [
        {
          "name": "rider_assigned",
          "reason": "Assign a rider before you can cancel"
        }
      ]
    }
  ]
}
```

> `available: true` with empty `constraints` means the decision can be executed immediately. `available: false` means the constraints listed must be resolved first.

---

## 17. Database Schema Reference

Key columns for the entities the Dispatcher API works with. Use these when building queries, mapping API responses, or debugging.

### orders

| Column | Type | Description |
|---|---|---|
| `id` | `bigint` | Primary key |
| `order_code` | `varchar` | Human-readable order code (e.g. `BC-2026-00201`) |
| `bc_number` | `varchar` | Legacy BC number |
| `bc_status` | `varchar` | Order lifecycle status |
| `branch_id` | `bigint FK` | Branch that owns the order |
| `order_branch_id` | `bigint FK` | Branch assigned for order processing |
| `source_branch_id` | `bigint FK` | Branch from which SFA placed the order |
| `source_warehouse_id` | `bigint FK` | Warehouse at source branch |
| `partner_id` | `bigint FK` | Partner / client |
| `salesperson_id` | `bigint FK` | SFA who placed the order |
| `adv_agent_id` | `bigint FK` | ADV agent who processed |
| `total_amount` | `decimal` | Order total |
| `confirmed_at` | `timestamp` | When ADV confirmed |

### delivery_notes (BL)

| Column | Type | Description |
|---|---|---|
| `id` | `bigint` | Primary key |
| `delivery_number` | `varchar` | BL reference (e.g. `BL-2026-00501`) |
| `status` | `varchar` | BlStatus enum value |
| `order_id` | `bigint FK` | Source order (BC) — only the "primary" order when a mission merged several orders for the same partner; the full set of consumed `order_ids` is only visible in `create_delivery_mission`'s response payload, not as a column |
| `delivery_mission_id` | `bigint FK` | Mission this BL belongs to (replaces `bon_chargement_id`/`shipment_id`) |
| `partner_id` | `bigint FK` | Delivery destination partner |
| `rider_id` | `bigint FK` | Assigned livreur |
| `dispatcher_id` | `bigint FK` | Dispatcher who created it |
| `branch_code` | `varchar` | Owning branch |
| `warehouse_transfer_id` | `bigint FK` | Set once `complete_preparation` generates the mission's WT (§12c) |
| `is_quantity_locked` | `boolean` | Prevents dispatcher from changing quantities |
| `delivery_date` | `date` | Planned delivery date |
| `total_amount` | `decimal` | BL total |
| `parent_delivery_note_id` | `bigint FK` | Parent BL when this is a split child |

### delivery_note_items

| Column | Type | Description |
|---|---|---|
| `id` | `bigint` | Primary key |
| `delivery_note_id` | `bigint FK` | Parent BL |
| `product_id` | `bigint FK` | Product |
| `ordered_quantity` | `decimal` | Requested quantity (summed across merged orders for the same product) |
| `allocated_quantity` | `decimal` | Quantity allocated from stock by `confirm_delivery_mission`, reset to `0` by `reopen_delivery_mission` |
| `prepared_quantity` | `decimal` | Quantity actually prepared by Magasinier |
| `delivered_quantity` | `decimal` | Quantity actually delivered |
| `unit_price` | `decimal` | Unit price at time of order |
| `unit` | `varchar` | Unit of measure |
| `sales_group_code` | `varchar` | Sales group classification |

### preparation_orders (BP)

| Column | Type | Description |
|---|---|---|
| `id` | `bigint` | Primary key |
| `bp_number` | `varchar` | BP reference (e.g. `BP-2026-00088`) |
| `status` | `varchar` | BpStatus enum value |
| `delivery_mission_id` | `bigint FK` | **The only FK on this table now** — one BP per mission, replaces `shipment_id`/`logistics_batch_id`/`delivery_order_id` (all dropped, see `App\Models\PreparationOrder`'s docblock notes) |
| `magasinier_id` | `bigint FK` | Magasinier assigned |
| `total_shortage_percentage` | `decimal` | % of items short |
| `is_critical_shortage` | `boolean` | Flag for severe shortage (>= threshold) |
| `shortage_acknowledged` | `boolean` | Dispatcher has reviewed shortage |
| `preparation_efficiency` | `decimal` | `(prepared / requested) × 100` |
| `prepared_at` | `timestamp` | When BP was completed |
| `rejected_at` | `timestamp` | When BP was rejected |
| `rejection_reason` | `text` | Magasinier rejection comment |

### preparation_order_items

| Column | Type | Description |
|---|---|---|
| `id` | `bigint` | Primary key |
| `bon_preparation_id` | `bigint FK` | Parent BP (table column name — not `preparation_order_id`) |
| `product_id` | `bigint FK` | Product |
| `delivery_note_item_id` | `bigint FK` | Linked BL line item |
| `order_id` / `partner_id` | `bigint FK` | Source order/partner, for grouping in the picking list |
| `requested_quantity` | `decimal` | Aggregated from `delivery_note_items.allocated_quantity` across the mission's confirmed BLs |
| `available_quantity` | `decimal` | Stock available at BP-generation time (snapshot) |
| `prepared_quantity` | `decimal` | Quantity actually picked |
| `shortage_quantity` | `decimal` | `requested - prepared` |
| `shortage_reason` | `varchar` | Magasinier's note on shortage cause |
| `shortage_reported_at` | `timestamp` | When shortage was flagged |

### delivery_missions (DM) — fully wired, live

| Column | Type | Description |
|---|---|---|
| `id` | `bigint` | Primary key |
| `mission_number` | `varchar` | DM reference (e.g. `MSN-20260619-0001`) |
| `rider_id` | `bigint FK` | Driver for this mission |
| `dispatcher_id` | `bigint FK` | Dispatcher who created it |
| `vehicle_id` | `bigint FK` | Vehicle assigned |
| `branch_code` | `varchar` | Owning branch |
| `status` | `varchar` | `draft`/`in_preparation`/`ready`/`in_transit`/`completed`/`cancelled` (see §3) |
| `started_at` / `closed_at` | `timestamp` | Mission bounds, set by `start_delivery_mission`/`complete_delivery_mission` |
| `close_notes` / `closed_by` | mixed | Set by `complete_delivery_mission` |
| `notes` | `text` | Free text |
| `van_stock_reconciled` / `cod_reconciled` / `returns_reconciled` | `boolean` | Reconciliation flags (`DeliveryMission::refreshReconciliation()`) |
| `total_bls` / `delivered_bls` / `failed_bls` / `total_returns` / `total_cod_collected` | numeric | Computed by `DeliveryMission::computeStats()` on completion |

> `shipment_id` (the transitional column from the Phase 1 migration) and the model's
> `shipment()`/`bonChargement()` relation aliases were both dropped on 2026-06-20
> (Phase 4) — `delivery_missions` has no remaining link to the (now-gone) `shipments`
> table.

### vehicles

> Added 2026-06-17 — this table was referenced from §12/§12d but never actually documented here.
> Verified against `Schema::getColumnListing('vehicles')` on the live DB.

| Column | Type | Description |
|---|---|---|
| `id` | `bigint` | Primary key |
| `plate_number` | `varchar` | Registration plate, unique |
| `internal_code` | `varchar` | Internal reference (e.g. `VAN-001`), unique, nullable |
| `make` / `model` / `year` | mixed | Vehicle identity |
| `type` | `varchar` | `truck`/`van`/`motorcycle` |
| `capacity_volume` | `decimal` | Cargo volume, **m³** |
| `usable_volume_ratio` | `decimal` | Usable fraction of `capacity_volume` (default 0.85 in code if null) |
| `loading_efficiency_ratio` | `decimal` | Real-loading efficiency factor (default 0.9 in code if null) |
| `capacity_length` / `capacity_width` / `capacity_height` | `decimal` | Cargo dimensions, **m** |
| `capacity_weight` | `decimal` | Max weight capacity, **kg** |
| `payload_kg` | `decimal` | Max gross payload, **kg** — preferred over `capacity_weight` when set (see `DeliveryOrderLoadEstimationService::resolveVehicleMaxWeightKg()`) |
| `cold_chain_enabled` | `boolean` | Refrigerated/cold-chain capable |
| `fuel_type` | `varchar` | `diesel`/`gasoline`/`electric` |
| `status` | `varchar` | `active`/`maintenance`/`retired` |
| `branch_code` | `varchar FK` | Home branch (`branches.code`) — **not** migrated to `branch_id` by the 3NF pass |
| `storage_location_id` | `bigint FK` | Physical storage location (mobile warehouse), if provisioned as a van |
| `notes` | `text` | Free text |

**No `driver_id`/`assigned_user_id` columns** — dropped by migration `2026_04_13_120000_...` in
favor of the `vehicle_assignments` table (§12d). Don't expect those as raw `Vehicle` attributes;
use the `activeAssignments`/`assignedUser` relations instead.

### vehicle_assignments

| Column | Type | Description |
|---|---|---|
| `id` | `bigint` | Primary key |
| `vehicle_id` | `bigint FK` | Vehicle |
| `user_id` | `bigint FK` | Rider/driver |
| `role` | `varchar` | `van_seller` or `delivery_agent` (`VehicleAssignment::ROLE_*` constants) |
| `starts_at` / `ends_at` | `timestamp` | Assignment window — `ends_at` null while active |
| `is_active` | `boolean` | Exactly one active row per vehicle is enforced by a partial unique index (Postgres) |
| `assigned_by` | `bigint FK` | Dispatcher who made the assignment |
| `notes` | `text` | Free text |

### warehouse_transfers (WT)

| Column | Type | Description |
|---|---|---|
| `id` | `bigint` | Primary key |
| `transfer_number` | `varchar` | WT reference (e.g. `WT-2026-00005`) |
| `status` | `varchar` | `pending`/`accepted`/`completed`/`rejected`/`validated` — see §12c |
| `delivery_mission_id` | `bigint FK` | Source mission — **the live FK** for new transfers (replaces `shipment_id`, see §2) |
| `shipment_id` | `bigint FK` | Legacy column, kept on the table for historical rows; not written by `createFromMission()` |
| `rider_id` | `bigint FK` | Rider this transfer is for |
| `livreur_emplacement_code` | `varchar` | Rider's mobile stock emplacement code |
| `from_warehouse` | `varchar` | Origin warehouse code (string, not an FK id) |
| `to_warehouse` | `varchar` | Destination warehouse code (string, not an FK id) |
| `from_storage_location_id` | `bigint FK` | Origin storage location (depot) |
| `to_storage_location_id` | `bigint FK` | Destination storage location (rider's van) |
| `transfer_type` | `varchar` | `dispatcher` for mission-generated transfers |
| `progress_level` | `int` | 0–100, set by `accept()` (→50) and completion flows |
| `synced_to_erp` / `erp_sync_status` / `erp_error_message` / `erp_synced_at` / `erp_transfer_id` | mixed | Sage X3 sync tracking |
| `accepted_by` | `bigint FK` | User who accepted |
| `accepted_at` | `timestamp` | When accepted |
| `notes` | `text` | Free text — also used to store the `reject()` reason (no dedicated rejection column) |
| `loading_request_id` | `bigint FK` | If created from a conventional loading request flow |
| `decharge_reconciliation_request_id` | `bigint FK` | If created from a décharge reconciliation flow |
| `period_id` | `bigint FK` | ERP period |

### warehouse_transfer_items

| Column | Type | Description |
|---|---|---|
| `id` | `bigint` | Primary key |
| `warehouse_transfer_id` | `bigint FK` | Parent WT |
| `product_id` | `bigint FK` | Product |
| `product_code` / `product_name` | `varchar` | Denormalized snapshot at transfer time |
| `requested_quantity` | `decimal` | Quantity requested (`delivery_note_items.allocated_quantity`) |
| `transferred_quantity` | `decimal` | Quantity actually transferred (`prepared_quantity`, falling back to `allocated_quantity`) |
| `delivered_quantity` | `decimal` | Quantity delivered to the partner |
| `returned_quantity` | `decimal` | Quantity returned |
| `unit_price` | `decimal` | Price at transfer time |
| `delivery_note_id` | `bigint FK` | Linked BL |
| `sales_group_code` | `varchar` | Sales group classification — **required**, `complete_preparation`/`createFromMission` throws if any line is missing it |
| `stock_batch_id` / `batch_number` / `expiry_date` | mixed | Lot/batch tracking |

---

## 18. Entity Relationship Summary

```
Order (BC)
  └─► [create_delivery_mission, grouped by partner_id] ──► DeliveryMission
                                                                  │
                                                                  ▼
                                                          DeliveryNote (BL) — draft
                                                                  │
                                              [confirm_delivery_mission — ONE atomic call:
                                               allocate every BL, then generate the BP]
                                                                  ▼
                                                          DeliveryNote (BL) — confirmed → batched
                                                                  │  (shortfall → backlog Order,
                                                                  │   via ShortageBacklogService)
                                                                  ▼
                                                          PreparationOrder (BP)  [ONE BP per mission]
                                                                  │
                                                  [reopen_delivery_mission — rolls BACK to
                                                   draft: BP → cancelled, stock released,
                                                   BLs → draft, mission → draft]
                                                                  └─► PreparationOrderItem
                                                                       (aggregated by product_id
                                                                        across the mission's BLs)
                                                                  │
                                                  [Magasinier: start/complete_preparation]
                                                                  ▼
                                                          WarehouseTransfer (WT)  [auto-created,
                                                                  │                CENTRAL → VAN]
                                                                  └─► WarehouseTransferItem
                                                                  ▼
                                                  [start_delivery_mission / complete_delivery_mission]
                                                                  ▼
                                                          DeliveryMission — completed
```

**Key navigation pattern for frontend:**

1. Start from `Order.id` → fetch `/dispatcher/orders/{id}` to get linked delivery notes (via `order_logistics_details`)
2. From `DeliveryMission.id` → fetch `/workflow/delivery-mission/{id}` (§8.8) to get the mission, its `delivery_notes[]`, and `preparation_order`
3. From `DeliveryNote.id` → fetch `/dispatcher/bon-livraisons/{id}` to get `delivery_mission`, `preparation`
4. From `PreparationOrder.id` → fetch `/workflow/bon-preparation/{id}` for shortage analysis — payload includes `mission` (not `batch`/`bch`)
5. From `DeliveryMission.id` → fetch `/dispatcher/warehouse-transfers?...` filtered by rider/status to find its auto-generated WT

---

*Generated from source: `app/Http/Controllers/Backend/DispatcherController.php`, `app/Http/Controllers/Backend/WorkflowController.php`, `app/Decisions/Dispatcher/`, `app/Models/DeliveryMission.php`, `app/Models/PreparationOrder.php`, `app/Services/Dispatcher/MissionBlGeneratorService.php`, `app/Services/Dispatcher/MissionRollbackService.php`, `app/Services/WarehouseTransferService.php`, `routes/backend.php`, `config/decisions.php`, `database/migrations/`, `app/Enums/BlStatus.php`, `docs/modules/planning_refactor_schema.md`*

*Last updated: 2026-06-22 —*
1. *`allocate_delivery_note` and `generate_preparation_for_mission` (removed 2026-06-21) folded into one atomic `confirm_delivery_mission` (§8.2) — sections, examples, the decision registry, and TypeScript types updated throughout to stop referencing the removed decisions.*
2. *New `update_delivery_mission` fields `add_order_ids`/`remove_order_ids` (§8.5) — detach/re-attach a single BC from a draft mission's merged BL without touching the whole BL, for when a salesperson needs to edit a BC already inside a mission.*
3. *New `reopen_delivery_mission` decision (§8.6) — atomic rollback from `in_preparation` back to `draft`: cancels the BP (`status: cancelled`, kept for audit), releases reserved stock, BLs → draft. Blocked once the BP is no longer `pending`/`in_progress` (race-condition guard, re-checked inside the transaction). Required a new migration adding `cancelled` to `preparation_orders`' status CHECK constraint.*
4. *All of the above verified live end-to-end against a real WSL Postgres instance (transaction + rollback, not assumed from code reading).*

*Previous update: 2026-06-20 — full rewrite for the BC → DeliveryMission architecture migration. The old BC → DO → LOT/BCH pipeline and the parallel "Dispatch V2" BC → DO → BP → BCH pipeline are both removed; `shipments`, `shipment_deliveries`, `shipment_delivery_orders`, `delivery_orders`, `delivery_order_items`, `delivery_order_orders`, `logistics_batches`, and `preparation_delivery_notes` are dropped (`database/migrations/2026_07_17_130000_drop_shipment_delivery_order_logistics_batch_tables.php`). `adjust_quantities` and `create_decharge` have no `delivery-mission` equivalent yet — explicitly deferred, see §2 and §16.*
