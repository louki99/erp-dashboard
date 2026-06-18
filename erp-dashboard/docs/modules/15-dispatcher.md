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
8. [Bon de Chargement (BCH)](#8-bon-de-chargement-bch)
   - [List BCH](#81-list-bch)
   - [BCH Detail](#82-bch-detail)
   - [Create BCH](#83-create-bch)
   - [Update BCH](#84-update-bch)
   - [Add BLs to BCH](#85-add-bls-to-bch)
   - [Remove BL from BCH](#86-remove-bl-from-bch)
   - [Submit BCH to Warehouse](#87-submit-bch-to-warehouse)
   - [Resubmit BCH](#88-resubmit-bch)
   - [Cancel BCH](#89-cancel-bch)
   - [Print BCH](#810-print-bch)
   - [Shortage Balance](#811-shortage-balance)
   - [Save Balance (Quantity Split)](#812-save-balance)
9. [Delivery Orders (DO)](#9-delivery-orders-do)
10. [Preparations — Shortage Queue](#10-preparations--shortage-queue)
11. [Decharges (Returns & Cancellations)](#11-decharges)
12. [Riders & Batches (LOT)](#12-riders--batches)
    - [Logistics Batches](#get-backenddispatcherbatches)
    - [Delivery Missions (unwired, schema only)](#12b-delivery-missions--not-yet-wired-schema-only)
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

| Responsibility | Description |
|---|---|
| **Receive confirmed orders** | Pick up BCs approved by ADV and convert them into delivery notes (BL) |
| **Plan deliveries** | Group BLs into shipments (BCH), assign riders and vehicles |
| **Submit to warehouse** | Send BCH to Magasinier for physical preparation |
| **Manage shortages** | Split prepared quantities between BLs when stock is partial |
| **Handle cancellations** | Cancel BLs or BCH and release reserved stock |
| **Monitor logistics** | Track batch picking, shortage queues, and return processing |

---

## 2. Logistics Pipeline Overview

> **Correction (2026-06-16, second pass):** an earlier version of this section collapsed
> everything into "one pipeline" and placed `validate_delivery_order` *before* `create_batch`.
> Both were wrong. The `routes/backend.php:913` comment reads `BC → DO → Lot → BP → Val.DO →
> BL → BCH` — **`Val.DO` comes after `BP`**, not before `Lot`, and that comment doesn't mention
> `optimize_do` at all. Tracing the actual status guards in code confirms there are **two
> separate, non-intersecting pipelines** that both end at a BCH with BLs. A DO goes down
> *one or the other* — never both, since they use mutually exclusive `DoStatus` values
> (`OPTIMIZED`/`IN_PREPARATION`/`PREPARED` only exist on the V2 side; `VALIDATED` only exists
> on the LOT side).

### Pipeline 1 — LOT path (the `routes/backend.php:913` chain — bulk warehouse picking)

```text
ADV confirms order (BC)
         │
         ▼
  create_delivery_order (creation, id=0; pass auto_allocate=true to allocate immediately)
         │
         ▼
  DO: draft  ──[runAllocation, only runs if auto_allocate=true at creation]──►  DO: allocated / partially_allocated
         │
    [create_batch]  (logistics-batch decision — requires DO status allocated/partially_allocated/
         │            validated; groups multiple DOs of the same branch into one LOT, status 'open')
         ▼
  LogisticsBatch (LOT) — open
         │
    [seal_batch]    (locks the LOT, aggregates every DO's items by product_id into ONE
         │            PreparationOrder (BP) for the whole LOT — one bulk pick instead of
         │            one pick per DO/customer)
         ▼
  LOT: sealed, BP: pending
         │
  [Magasinier completes BP — complete_preparation, bon-preparation decision]
         │
         ├─── Full ──► BP: completed_full ──► generateBlsFromBp() creates one BL per
         │                                     partner from picked quantities (feature-
         │                                     flagged: erp.workflow.bl_from_bp) — see
         │             CompletePreparationDecision.php:303-345
         └─── Partial (Shortage) ──► BP: completed_partial → [adjust_quantities] → shortage_accepted
         │
    [validate_delivery_order]  (Val.DO — requires DO already allocated/partially_allocated
         │                       AND, if the DO has a LOT, that LOT's BP must already be
         │                       completed_full/shortage_accepted; DOES NOT allocate stock
         │                       itself, despite the name — see validate() guard at
         │                       ValidateDeliveryOrderDecision.php:51,63-82)
         ▼
  DO: validated
         │
    [create_bch]  (bon-chargement decision — groups the BLs generated above for a rider,
         │          sets rider_id/vehicle_id at creation time; not a DO-layer field)
         ▼
  Shipment (BCH) — pending → [submit_to_warehouse] → [mark_bch_loaded] → [mark_bch_in_transit]
```

### Pipeline 2 — "Dispatch V2" path (`config/decisions.php:577` comment — per-DO, skips LOT entirely)

```text
DO: draft
         │
    [optimize_do]  (consolidates delivery_zone + planned_delivery_date only — no
         │           driver_id/vehicle_id at this layer; allowed from draft/allocated/
         │           partially_allocated)
         ▼
  DO: optimized
         │
    [start_do_preparation]  (spawns a BP scoped to just this DO — NOT the LOT's aggregated BP)
         ▼
  DO: in_preparation
         │
    [complete_do_preparation]  (Magasinier marks this DO's own BP complete; handles its
         │                       own shortage adjustments independently of §12's batch flow)
         ▼
  DO: prepared
         │
    [generate_bch_from_dos]  ("the ONLY place where BLs are generated in the new flow" per
         │                     its own docblock — GenerateBchFromDosDecision.php:11-14;
         │                     creates the BCH + BLs directly from one or more DOs, no
         │                     LogisticsBatch/Val.DO step at all; requires DoStatus
         │                     prepared/ready_for_loading — isReadyForDispatch())
         ▼
  DO: dispatched, Shipment (BCH) created with its BLs
```

> **`generate_bch_from_dos` is not a "shortcut off the LOT path"** — it is the terminal
> decision of a fully separate pipeline with its own BP-per-DO mechanism and its own shortage
> handling, never touching `LogisticsBatch`, `seal_batch`, or `validate_delivery_order`. Pick
> Pipeline 1 for bulk warehouse picking across many DOs at once (one aggregated BP); pick
> Pipeline 2 for a single DO dispatched on its own.

> **Correction (2026-06-17):** the line below ("driver/vehicle assignment does not happen on
> the DO") was true when last written but is now stale — commit `b932476` reintroduced
> `driver_id`/`vehicle_id` fields on `optimize_do` (`OptimizeDeliveryOrderDecision.php:31-32`,
> `DispatchService::optimizeDo()` persists them to `delivery_orders.driver_id`/`vehicle_id`).
> Treat what `optimize_do` sets as a **proposed/planning-time** vehicle only — it is **not**
> binding. The authoritative vehicle for an actual shipment is still resolved at
> `generate_bch_from_dos` time (`options.vehicle_id` override, falling back to the first DO's
> `vehicle_id` if not overridden) and is what gets written to `shipments.vehicle_id`. Multiple
> DOs combined into one BCH call always ship on the single vehicle resolved for that call, even
> if their individual `vehicle_id`s disagree — there's no per-DO truck assignment once they're
> grouped into a BCH. The `assign_do_resources` decision is still removed from the
> `delivery-order` model type — do not call it, it no longer exists in the registry; use
> `optimize_do` for the planning-time proposal and `generate_bch_from_dos`/`create_bch` for the
> binding assignment.

> ⚠️ **[LOOSE END / FUTURE TODO GAP] — "Rider Accept" → automatic WHT trigger is not implemented.**
> A `delivery_missions` table and `App\Models\DeliveryMission` exist (lifecycle `CREATED →
> STARTED → CLOSED`, doc comment: "STARTED: WHT created (MAIN→VAN)"), but there is **no
> registered decision, no controller, and no route** wired to this model anywhere in the
> codebase (`config/decisions.php` has no `delivery-mission` entry; `grep` for
> `DeliveryMission::` outside the model itself only turns up incidental relations on
> `DeliveryNote`/`WarehouseTransfer`). `MarkBchInTransitDecision` (the real "rider departs"
> step) does **not** create a `WarehouseTransfer`. Until this is built, inventory balancing
> between the warehouse and a rider's mobile depot is a **manual** process — do not document
> or build a frontend "Rider Accept" button against a backend trigger that doesn't exist yet.

---

## 3. Status Glossary

### BL (Bon de Livraison) statuses

| Value | Meaning | Who drives it |
|---|---|---|
| `draft` | Freshly created | Dispatcher |
| `confirmed` | Stock reserved, ready to group | Dispatcher |
| `batched` | Assigned to a logistics batch | Dispatcher |
| `submitted_to_magasinier` | Submitted with BCH | Dispatcher |
| `in_preparation` | Magasinier is picking | Magasinier |
| `ready` | Picked, awaiting loading | Magasinier |
| `loaded` | On the vehicle | Livreur |
| `in_transit` | En route to partner | Livreur |
| `delivered` | Successfully delivered | Livreur |
| `partially_delivered` | Partial delivery confirmed | Livreur |
| `returned` | Returned by partner | Livreur |
| `cancelled` | Cancelled | Dispatcher |

### BCH (Bon de Chargement) statuses

| Value | Meaning |
|---|---|
| `pending` | Created, awaiting submission |
| `in_preparation` | BP being prepared by Magasinier |
| `prepared` | Warehouse ready (Scenario A or BP completed) |
| `validated` | Validated, awaiting loading |
| `loaded` | Items loaded on vehicle |
| `in_transit` | Shipment in transit |
| `completed` | Delivery cycle complete |
| `cancelled` | Cancelled |

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

**Response `200`:**
```json
{
  "stats": {
    "pending_orders": 6,
    "draft_bls": 12,
    "pending_bch": 3,
    "in_transit": 5,
    "shortage_queue": 1,
    "confirmed_today": 4
  },
  "recentPreparations": [
    {
      "id": 88,
      "bp_number": "BP-2026-00088",
      "status": "pending",
      "shipment": { "id": 22, "shipment_number": "BCH-2026-00022" },
      "rider": { "id": 9, "name": "Youssef Livreur" }
    }
  ]
}
```

| Field | Description |
|---|---|
| `pending_orders` | BCs confirmed by ADV, not yet dispatched |
| `draft_bls` | BLs in DRAFT status |
| `shortage_queue` | BPs in `completed_partial` awaiting quantity balancing |

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

### 7.2 Draft BLs

`GET /backend/dispatcher/bon-livraisons/draft`

Returns BLs in `draft`, `preparing`, or `prepared` status that are not yet assigned to a BCH. Used to populate the BCH creation screen.

```bash
curl https://api.omni360.cloud/api/backend/dispatcher/bon-livraisons/draft \
  -H "Authorization: Bearer {TOKEN}"
```

---

### 7.3 Confirmed BLs

`GET /backend/dispatcher/bon-livraisons/confirmed`

Returns BLs in `confirmed` status not yet in a batch. Used for grouping into BCH.

```bash
curl https://api.omni360.cloud/api/backend/dispatcher/bon-livraisons/confirmed \
  -H "Authorization: Bearer {TOKEN}"
```

---

### 7.4 BL Detail

`GET /backend/dispatcher/bon-livraisons/{id}`

Full BL detail including partner, order, items, rider, preparation, assets, tracking.

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
  "rider": null,
  "dispatcher": { "id": 7, "name": "Karim Dispatcher" },
  "items": [
    {
      "id": 2001,
      "product_id": 55,
      "quantity": 20,
      "allocated_qty": 20,
      "prepared_quantity": null,
      "unit_price": 3500.00,
      "total_price": 70000.00,
      "product": { "id": 55, "name": "Huile Végétale 5L", "sku": "HUI-VEG-5L" }
    }
  ],
  "bon_chargement": null,
  "preparation": null,
  "assets": null,
  "tracking": null,
  "workflow_instance": {
    "id": 90,
    "current_step": { "name": "dispatch_confirmation", "label": "Confirmation Dispatcher" }
  }
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

## 8. Bon de Chargement (BCH)

> BCH mutations go through dedicated dispatcher routes **and** the workflow engine depending on the action. Routes that require `Idempotency-Key` are marked with ⚡.

---

### 8.1 List BCH

`GET /backend/dispatcher/bon-chargements`

**Query parameters:** `status`, `rider_id`, `search`, `page`

```bash
curl "https://api.omni360.cloud/api/backend/dispatcher/bon-chargements?status=pending" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:**
```json
{
  "bch": {
    "current_page": 1,
    "per_page": 20,
    "total": 3,
    "data": [
      {
        "id": 22,
        "shipment_number": "BCH-2026-00022",
        "status": "pending",
        "branch_code": "CASA-01",
        "has_shortage": false,
        "rider": { "id": 9, "name": "Youssef Livreur" },
        "dispatcher": { "id": 7, "name": "Karim Dispatcher" },
        "delivery_notes_count": 3,
        "created_at": "2026-06-15T11:00:00Z"
      }
    ]
  },
  "stats": {
    "total": 10,
    "pending": 3,
    "in_preparation": 2,
    "prepared": 4,
    "completed": 1
  }
}
```

---

### 8.2 BCH Detail

`GET /backend/dispatcher/bon-chargements/{id}`

Full BCH with BLs, BP, rider, dispatcher info.

```bash
curl https://api.omni360.cloud/api/backend/dispatcher/bon-chargements/22 \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:**
```json
{
  "id": 22,
  "shipment_number": "BCH-2026-00022",
  "status": "pending",
  "branch_code": "CASA-01",
  "has_shortage": false,
  "shortage_acknowledged": false,
  "notes": null,
  "estimated_departure": null,
  "rider": { "id": 9, "name": "Youssef Livreur" },
  "dispatcher": { "id": 7, "name": "Karim Dispatcher" },
  "vehicle": { "id": 3, "plate": "12345-A-1" },
  "delivery_notes": [
    {
      "id": 501,
      "delivery_number": "BL-2026-00501",
      "status": "confirmed",
      "total_amount": 127500.00,
      "partner": { "id": 12, "name": "Supermarché Atlas" }
    }
  ],
  "preparation_order": null,
  "created_at": "2026-06-15T11:00:00Z"
}
```

---

### 8.3 Create BCH ⚡

`POST /backend/dispatcher/bon-chargements`

Group BLs into a new BCH and assign a rider.

```bash
curl -X POST https://api.omni360.cloud/api/backend/dispatcher/bon-chargements \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bch:create:bl-501-502:1718358300" \
  -d '{
    "decision": "create_bch",
    "bl_ids": [501, 502],
    "rider_id": 9,
    "vehicle_id": 3,
    "planned_date": "2026-06-16",
    "notes": "Tournée matinale zone Centre"
  }'
```

**Request body:**

| Field | Required | Type | Description |
|---|---|---|---|
| `decision` | yes | `string` | Must be `"create_bch"` |
| `bl_ids` | yes | `number[]` | BL IDs to group (must all be same branch, status `confirmed` or `ready`) |
| `rider_id` | no | `number` | Assign rider |
| `vehicle_id` | no | `number` | Assign vehicle |
| `planned_date` | no | `date` | Planned departure date |
| `notes` | no | `string` | max 500 chars |

**Response `200`:**
```json
{
  "success": true,
  "message": "BCH créé avec succès",
  "data": {
    "bch_id": 22,
    "shipment_number": "BCH-2026-00022",
    "status": "pending",
    "bl_count": 2,
    "attached_bls": [501, 502],
    "rider_id": 9,
    "planned_date": "2026-06-16"
  }
}
```

---

### 8.4 Update BCH ⚡

`PUT /backend/dispatcher/bon-chargements/{id}`

Update BCH header (rider, date, notes).

```bash
curl -X PUT https://api.omni360.cloud/api/backend/dispatcher/bon-chargements/22 \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bch:22:update:1718358400" \
  -d '{
    "decision": "update_bch",
    "rider_id": 10,
    "planned_date": "2026-06-17",
    "notes": "Report d'\''un jour — véhicule en maintenance"
  }'
```

**Request body:**

| Field | Required | Type | Description |
|---|---|---|---|
| `decision` | yes | `string` | Must be `"update_bch"` |
| `rider_id` | no | `number` | Change rider (propagated to linked BLs) |
| `planned_date` | no | `date` | New departure date |
| `notes` | no | `string` | max 500 chars |

**Constraint:** BCH must be in `pending`, `prepared`, or `validated`. Cannot update while BP is in progress.

**Response `200`:**
```json
{
  "success": true,
  "message": "BCH mis à jour",
  "data": {
    "shipment_id": 22,
    "shipment_number": "BCH-2026-00022",
    "updates": { "rider_id": 10, "planned_date": "2026-06-17" },
    "added_bls": [],
    "removed_bls": [],
    "current_bl_count": 2
  }
}
```

---

### 8.5 Add BLs to BCH ⚡

`POST /backend/dispatcher/bon-chargements/{id}/bls`

```bash
curl -X POST https://api.omni360.cloud/api/backend/dispatcher/bon-chargements/22/bls \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bch:22:add-bls:1718358500" \
  -d '{
    "decision": "update_bch",
    "add_delivery_note_ids": [503, 504]
  }'
```

**Request body:**

| Field | Required | Type | Description |
|---|---|---|---|
| `decision` | yes | `string` | Must be `"update_bch"` |
| `add_delivery_note_ids` | yes | `number[]` | BL IDs to add (must be same branch, status `draft`/`preparing`/`prepared`, not in another BCH) |

**Response `200`:** Same shape as Update BCH with populated `added_bls`.

---

### 8.6 Remove BL from BCH ⚡

`DELETE /backend/dispatcher/bon-chargements/{id}/bls/{blId}`

```bash
curl -X DELETE https://api.omni360.cloud/api/backend/dispatcher/bon-chargements/22/bls/503 \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bch:22:remove-bl-503:1718358600" \
  -d '{
    "decision": "update_bch",
    "remove_delivery_note_ids": [503]
  }'
```

The removed BL returns to `draft` status and can be added to a different BCH.

**Response `200`:** Same shape as Update BCH with populated `removed_bls`.

---

### 8.7 Submit BCH to Warehouse ⚡

`POST /backend/dispatcher/bon-chargements/{id}/submit`

Triggers the handoff to the Magasinier. Two scenarios are handled automatically:

| Scenario | Condition | Result |
|---|---|---|
| **A** | All BLs are already `ready` | BCH → `prepared` (no BP created) |
| **B** | BLs need preparation | BP created → BCH → `in_preparation` |

**Requirement:** BCH must have a `rider_id` assigned.

```bash
curl -X POST https://api.omni360.cloud/api/backend/dispatcher/bon-chargements/22/submit \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bch:22:submit:1718358700" \
  -d '{}'
```

**Response `200` — Scenario B (most common):**
```json
{
  "success": true,
  "message": "BCH soumis au magasinier",
  "data": {
    "scenario": "B",
    "shipment_id": 22,
    "shipment_status": "in_preparation",
    "bp_created": true,
    "bp_id": 88,
    "bp_number": "BP-2026-00088",
    "updated_bls": [501, 502]
  }
}
```

**Response `200` — Scenario A:**
```json
{
  "success": true,
  "message": "BCH validé automatiquement (BLs déjà prêts)",
  "data": {
    "scenario": "A",
    "shipment_id": 22,
    "shipment_status": "prepared",
    "bp_created": false
  }
}
```

---

### 8.8 Resubmit BCH ⚡

`POST /backend/dispatcher/bon-chargements/{id}/resubmit`

Resubmit a BCH after its BP was rejected by the Magasinier.

```bash
curl -X POST https://api.omni360.cloud/api/backend/dispatcher/bon-chargements/22/resubmit \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bch:22:resubmit:1718360000" \
  -d '{"decision": "resubmit_bch"}'
```

**Constraint:** BCH must have status `pending` and its BP must be `rejected`.

**Response `200`:** New BP created, same structure as submit Scenario B.

---

### 8.9 Cancel BCH ⚡

`POST /backend/dispatcher/bon-chargements/{id}/cancel`

Cancels a pending BCH, releases all stock reservations, and reverts BLs to `draft`.

```bash
curl -X POST https://api.omni360.cloud/api/backend/dispatcher/bon-chargements/22/cancel \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bch:22:cancel:1718360100" \
  -d '{
    "decision": "cancel_bch",
    "reason": "Livreur indisponible. BCH sera recréé demain."
  }'
```

**Request body:**

| Field | Required | Type | Description |
|---|---|---|---|
| `decision` | yes | `string` | Must be `"cancel_bch"` |
| `reason` | yes | `string` | min 10 chars |

**Constraint:** Only `pending` BCH can be cancelled (not once submitted to Magasinier).

**Response `200`:**
```json
{
  "success": true,
  "message": "BCH annulé",
  "data": {
    "shipment_id": 22,
    "shipment_number": "BCH-2026-00022",
    "status": "cancelled",
    "decharge_id": 15,
    "reason": "Livreur indisponible. BCH sera recréé demain."
  }
}
```

---

### 8.10 Print BCH

`GET /backend/dispatcher/bon-chargements/{id}/print`

Returns structured data for generating a printable loading manifest.

```bash
curl https://api.omni360.cloud/api/backend/dispatcher/bon-chargements/22/print \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:**
```json
{
  "bch": {
    "id": 22,
    "shipment_number": "BCH-2026-00022",
    "status": "prepared",
    "planned_date": "2026-06-16"
  },
  "rider": { "id": 9, "name": "Youssef Livreur", "phone": "+212 6 00 11 22 33" },
  "vehicle": { "id": 3, "plate": "12345-A-1", "capacity_kg": 5000 },
  "delivery_notes": [
    {
      "id": 501,
      "delivery_number": "BL-2026-00501",
      "partner": { "id": 12, "name": "Supermarché Atlas", "address": "Bd Hassan II, Casablanca" },
      "items": [
        { "product_name": "Huile Végétale 5L", "sku": "HUI-VEG-5L", "quantity": 20, "prepared_quantity": 20 }
      ]
    }
  ],
  "preparation_items": [
    { "product_id": 55, "product_name": "Huile Végétale 5L", "total_quantity": 20, "total_prepared": 20 }
  ],
  "totals": {
    "bl_count": 2,
    "item_count": 5,
    "total_amount": 215000.00
  }
}
```

---

### 8.11 Shortage Balance

`GET /backend/dispatcher/bon-chargements/{id}/balance`

Analyze the shortage after a partial preparation. Returns current quantities per product per BL, along with suggested split strategies.

```bash
curl https://api.omni360.cloud/api/backend/dispatcher/bon-chargements/22/balance \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:**
```json
{
  "bch_id": 22,
  "shipment_number": "BCH-2026-00022",
  "products": [
    {
      "product_id": 55,
      "product_name": "Huile Végétale 5L",
      "sku": "HUI-VEG-5L",
      "total_requested": 40,
      "total_prepared": 30,
      "shortage": 10,
      "requesting_bls": [
        {
          "bl_id": 501,
          "delivery_number": "BL-2026-00501",
          "partner_name": "Supermarché Atlas",
          "requested": 20,
          "current_prepared": 20,
          "suggested_equal": 15,
          "suggested_fifo": 20
        },
        {
          "bl_id": 502,
          "delivery_number": "BL-2026-00502",
          "partner_name": "Épicerie Al Wafa",
          "requested": 20,
          "current_prepared": 10,
          "suggested_equal": 15,
          "suggested_fifo": 10
        }
      ]
    }
  ]
}
```

---

### 8.12 Save Balance ⚡

`PUT /backend/dispatcher/bon-chargements/{id}/balance`

Apply a quantity split strategy to resolve a shortage.

**Three strategies:**

#### Strategy 1 — Manual

```bash
curl -X PUT https://api.omni360.cloud/api/backend/dispatcher/bon-chargements/22/balance \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bch:22:balance:manual:1718360200" \
  -d '{
    "decision": "adjust_quantities",
    "split_strategy": "manual",
    "adjustments": [
      { "bl_item_id": 2001, "new_quantity": 18, "reason": "Priorité partenaire A" },
      { "bl_item_id": 2002, "new_quantity": 12 }
    ]
  }'
```

#### Strategy 2 — Equal (server-computed)

```bash
curl -X PUT https://api.omni360.cloud/api/backend/dispatcher/bon-chargements/22/balance \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bch:22:balance:equal:1718360200" \
  -d '{
    "decision": "adjust_quantities",
    "split_strategy": "equal"
  }'
```

#### Strategy 3 — FIFO (first-attached BL gets full allocation)

```bash
curl -X PUT https://api.omni360.cloud/api/backend/dispatcher/bon-chargements/22/balance \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bch:22:balance:fifo:1718360200" \
  -d '{
    "decision": "adjust_quantities",
    "split_strategy": "fifo"
  }'
```

**Request body:**

| Field | Required | Type | Description |
|---|---|---|---|
| `decision` | yes | `string` | Must be `"adjust_quantities"` |
| `split_strategy` | yes | `string` | `manual`, `equal`, or `fifo` |
| `adjustments` | if manual | `array` | `[{ bl_item_id, new_quantity, reason? }]` |

**Constraint:** Per product, `sum(new_quantity)` must equal `total_prepared` — you cannot invent stock.

**Response `200`:**
```json
{
  "success": true,
  "message": "Quantités rééquilibrées",
  "data": {
    "shipment_id": 22,
    "shipment_number": "BCH-2026-00022",
    "status": "ready",
    "adjusted_items": 2,
    "total_adjustments": 2
  }
}
```

---

## 9. Delivery Orders (DO)

Delivery Orders are logistics planning units that group orders by delivery zone and date.

There are **two ways to create a DO** — pick based on what you need:

| Need | Use |
|---|---|
| Simple create, no extra ceremony | `POST /backend/dispatcher/delivery-orders` (REST) |
| Auto-trigger allocation in the same call, full audit trail, idempotent retries | `POST /backend/workflow/delivery-order/0/execute` with `decision: "create_delivery_order"` |

Both paths ultimately call the same `DeliveryOrderService::createFromOrders()`, which enforces the same safety rules regardless of entry point: every order must be `CONFIRMED`/`ADV_APPROVED`, and an order already linked to a DO (`bc_status = CONVERTED_TO_DO`) is rejected. The REST endpoint does **not** support `auto_allocate` and is not idempotency-key protected; the workflow decision does both (`create_delivery_order` is in `config('erp.idempotency.required_workflow_decisions')`, so an `Idempotency-Key` header is mandatory on that path).

### `GET /backend/dispatcher/delivery-orders`

**Query parameters:** `status` (see [DoStatus](#3-status-glossary)), `search`, `per_page`, `page` (standard Laravel pagination — `paginate()` resolves the current page from the `page` query string automatically, no extra backend code needed)

```bash
curl "https://api.omni360.cloud/api/backend/dispatcher/delivery-orders?status=optimized" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:** Flat Laravel paginator (same envelope shape as `GET /backend/dispatcher/orders/pending` — no `success`/`data` wrapper):
```json
{
  "current_page": 1,
  "data": [ { "id": 10, "do_number": "DO-2026-00010", "status": "optimized", "...": "..." } ],
  "per_page": 20,
  "total": 4,
  "...": "(standard Laravel paginator fields)"
}
```

### `POST /backend/dispatcher/delivery-orders`

Consolidate confirmed BCs into a new DO (`DRAFT` status). All `order_ids` must currently be `CONFIRMED`/`ADV_APPROVED` and not already attached to another DO.

```bash
curl -X POST https://api.omni360.cloud/api/backend/dispatcher/delivery-orders \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -d '{
    "order_ids": [95, 102, 110],
    "planned_delivery_date": "2026-06-18",
    "delivery_zone": "ZONE-SUD",
    "itinerary_id": 3,
    "notes": "Tournée lundi secteur 5"
  }'
```

**Body:** `order_ids` (array, required, must reference confirmed orders), `planned_delivery_date` (date, optional), `delivery_zone` (string, optional), `itinerary_id` (int, optional, must exist), `notes` (string, optional).

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "id": 12,
    "do_number": "DOA000-A01-000001",
    "status": "draft",
    "orders_count": 3,
    "orders": [...],
    "items": [...],
    "itinerary": {...}
  }
}
```

**Response `422`:** order not confirmed, already in a DO, mixed ERP periods, or no branch on the authenticated user — body is `{"message": "..."}` (no `success` key).

### `GET /backend/dispatcher/delivery-orders/{id}`

Full DO detail with linked orders, BLs, and the BCH chain.

```bash
curl https://api.omni360.cloud/api/backend/dispatcher/delivery-orders/10 \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:** wrapped, not flat — `{success, data: {deliveryOrder, batches, bchs}}`:
```json
{
  "success": true,
  "data": {
    "deliveryOrder": {
      "id": 10,
      "do_number": "DO-2026-00010",
      "status": "optimized",
      "planned_delivery_date": "2026-06-16",
      "delivery_zone": "Centre-Ville",
      "driver_id": 9,
      "vehicle_id": 3,
      "driver": { "id": 9, "name": "Youssef Livreur", "phone": "+212..." },
      "vehicle": { "id": 3, "plate_number": "12345-A-1", "internal_code": "VH-03", "type": "van", "make": "...", "model": "..." },
      "items": [ { "...": "with .product" } ],
      "orders": [ { "...": "with .partner" } ],
      "delivery_notes": [ { "...": "with .partner, .items.product" } ],
      "logistics_batch": { "...": "with .delivery_notes, .preparation_order.items.product" }
    },
    "batches": [ { "...": "the DO's logistics_batch, wrapped in an array (empty if none)" } ],
    "bchs": [
      {
        "id": 5,
        "shipment_number": "BCH-...",
        "livreur": { "id": 9, "name": "Youssef Livreur", "phone": "+212..." },
        "dispatcher": { "id": 4, "name": "..." },
        "vehicle": { "id": 3, "plate_number": "12345-A-1", "...": "..." },
        "delivery_notes": [ { "...": "with .partner, .items.product" } ]
      }
    ]
  }
}
```

`driver`/`vehicle` are eager-loaded directly on the DO (and `livreur`/`vehicle` on each BCH) — you do **not** need a separate `GET /backend/dispatcher/livreurs` lookup just to resolve who's assigned on a DO/BCH detail screen. Use `/dispatcher/livreurs` only for populating an assignment dropdown (list of available drivers).

---

## 10. Preparations — Shortage Queue

`GET /backend/dispatcher/preparations/shortage-queue`

Lists BPs in shortage states that require the dispatcher to take action: split quantities, accept shortages, or request rework.

```bash
curl https://api.omni360.cloud/api/backend/dispatcher/preparations/shortage-queue \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:** Paginated list of `PreparationOrder` with `shipment`, `delivery_notes`, `items`.

```json
{
  "current_page": 1,
  "per_page": 20,
  "total": 1,
  "data": [
    {
      "id": 88,
      "bp_number": "BP-2026-00088",
      "status": "completed_partial",
      "total_shortage_percentage": 25.0,
      "is_critical_shortage": false,
      "shipment": {
        "id": 22,
        "shipment_number": "BCH-2026-00022",
        "has_shortage": true
      },
      "items": [
        {
          "id": 3001,
          "product_id": 55,
          "requested_quantity": 40,
          "prepared_quantity": 30,
          "shortage_quantity": 10,
          "shortage_reason": "Rupture de stock temporaire"
        }
      ]
    }
  ]
}
```

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

Full décharge detail including items, related BL, BCH, and partner.

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

## 12. Riders & Batches

### `GET /backend/dispatcher/livreurs`

List available riders (delivery drivers).

```bash
curl https://api.omni360.cloud/api/backend/dispatcher/livreurs \
  -H "Authorization: Bearer {TOKEN}"
```

### `GET /backend/dispatcher/vehicles`

List active vehicles for the dispatcher's branch — use this to populate dropdowns wherever
`vehicle_id` is requested (`create_bch`, `optimize_do`, `generate_bch_from_dos`), instead of
asking the user to type a raw numeric ID. Scoped by `Auth::user()->branch_code` when set
(unscoped — returns all active vehicles — if the authenticated user has no `branch_code`).

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
an active BCH today") — only `status = active/maintenance/retired`. Flag to backend if the
frontend needs live availability.

### `GET /backend/dispatcher/batches`

List logistics batches (LOTs), scoped to the authenticated dispatcher's `branch_id`.

**Query parameters:** `status` (`open`/`sealed`), `search` (matches `batch_number`), `per_page`

```bash
curl "https://api.omni360.cloud/api/backend/dispatcher/batches?status=open" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:** Paginated `LogisticsBatch[]` plus open/sealed counts (`DispatcherController::batchesIndex()`).

```json
{
  "current_page": 1,
  "per_page": 20,
  "total": 5,
  "data": [
    {
      "id": 3,
      "batch_number": "BATCH-2026-00003",
      "status": "open",
      "branch_code": "CASA-01",
      "dispatcher": { "id": 7, "name": "Karim Dispatcher" },
      "delivery_notes": [],
      "preparation_order": null,
      "created_at": "2026-06-15T11:00:00Z"
    }
  ]
}
```

> Top-level stats (sibling to the paginator, not shown above) are `{"open": N, "sealed": N}` — there is no `ready`/`in_progress`/`completed` bucket; those statuses don't exist on `LogisticsBatch`.

### `GET /backend/dispatcher/batches/{id}`

Batch detail with linked BLs (`deliveryNotes`), preparation order, dispatcher. **Wrapped, not flat** — `{success, data: {batch}}` (`DispatcherController::showBatch()`).

```bash
curl "https://api.omni360.cloud/api/backend/dispatcher/batches/3" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "batch": {
      "id": 3,
      "batch_number": "BATCH-2026-00003",
      "status": "sealed",
      "branch_code": "CASA-01",
      "sealed_at": "2026-06-15T12:00:00Z",
      "preparation_order_id": 88,
      "dispatcher": { "id": 7, "name": "Karim Dispatcher" },
      "delivery_notes": [
        { "id": 501, "delivery_number": "BL-2026-00501", "partner": { "id": 12, "name": "Supermarché Atlas" }, "items": [] }
      ],
      "preparation_order": {
        "id": 88,
        "bp_number": "BP-2026-00088",
        "status": "pending",
        "items": [
          { "id": 3001, "product_id": 55, "requested_quantity": 40, "prepared_quantity": 0 }
        ],
        "shipment": { "id": 22, "shipment_number": "BCH-2026-00022", "rider": { "id": 9, "name": "Youssef Livreur" } }
      }
    }
  }
}
```

> Note: `delivery_notes` on the batch detail is populated once the BP has been completed and BLs generated from it — a freshly-`open` batch has DOs attached (via `delivery_orders.logistics_batch_id`), not yet BLs.

### Batch Status Lifecycle

The real `logistics-batch` decisions, from `config/decisions.php` and the decision classes in `app/Decisions/Dispatcher/`:

```
LOT created from DOs (create_batch)
       │
       ▼
     open ──[update_batch]──► open  (add/remove DOs, edit notes — only while open)
       │
   [seal_batch]   (aggregates every DO's items by product_id into ONE BP for the whole LOT)
       │
       ▼
    sealed
```

`delete_batch` removes an `open` batch (and detaches its DOs) — there is no `cancel_batch`/`validate_batch`/`start_delivery`/`complete_batch` decision; those keys do not exist anywhere in `config/decisions.php`.

| Status | Meaning | Set by |
|---|---|---|
| `open` | Batch created, DOs can still be added/removed | `create_batch` |
| `sealed` | Locked, BP generated, DOs frozen | `seal_batch` |

---

## 12b. Delivery Missions — not yet wired (schema only)

> ⚠️ **[LOOSE END / FUTURE TODO GAP]** A `delivery_missions` table and `App\Models\DeliveryMission`
> exist in the codebase, but **no controller, no route, and no decision** currently uses them.
> `config/decisions.php` has no `delivery-mission` model-type entry at all. Do not build a
> frontend screen against `GET /backend/dispatcher/delivery-missions` — it does not exist.

The model's own docblock describes the *intended* (not yet implemented) semantics, which are
different from what was previously documented here — a `DeliveryMission` is **one rider session
per BCH** (not one stop per BL):

```
DeliveryMission lifecycle (per App\Models\DeliveryMission docblock — aspirational, unwired):
  CREATED  — Rider accepted BCH, inspecting goods
  STARTED  — WarehouseTransfer created (MAIN → VAN), rider en route delivering BLs
  CLOSED   — All deliveries done, reconciliation passed, stock balanced
```

Real columns on `delivery_missions` (from the migration, not currently populated by any code path): `mission_number`, `rider_id`, `shipment_id`, `vehicle_id`, `branch_code`, `status`, `started_at`, `closed_at`, `van_stock_reconciled`, `cod_reconciled`, `returns_reconciled`, `total_bls`, `delivered_bls`, `failed_bls`, `total_returns`, `total_cod_collected`.

This is the same gap called out in §2: until a decision/controller is built against this model, the rider-accept → WHT trigger is manual.

---

## 12c. Warehouse Transfers

> **Correction (2026-06-17):** every endpoint, request body, response shape, and status value
> previously documented in this section was fabricated — none of it matches the real
> `WarehouseTransferController`/`WarehouseTransferService`/`warehouse_transfers` schema. This
> rewrite is verified directly against the controller, service, and `Schema::getColumnListing()`
> on the live DB. The routes below did not exist under the `dispatcher` prefix until this date —
> they've been wired to the controller's pre-existing (previously unrouted) `index`/`show`
> methods, so list/detail are now live; `create-from-bch`/`accept`/`reject` were added the same
> way against the controller's existing methods.

A **Warehouse Transfer** (WT) moves stock from the **main warehouse to a rider's van** —
created automatically when a dispatcher accepts a completed BCH (`createFromBch`), not a
manual branch-to-branch request form. There is **no generic "create an arbitrary transfer
between two branches" endpoint or service method anywhere in the codebase** — every WT is tied
to a source document: a BCH (`createFromShipment`), a loading request, or a décharge
reconciliation. If your screen needs a freeform "pick source branch, destination branch, and
products" creation flow, **that capability does not exist on the backend** — talk to backend/product
before building it; the request body documented here previously (`source_branch_id`,
`destination_branch_id`, `items[]`) was invented, not derived from real code.

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
        "shipment_id": 22,
        "rider_id": 9,
        "from_warehouse": "MAIN-CASA-01",
        "to_warehouse": "VAN-9",
        "transfer_type": "bch_to_van",
        "progress_level": 0,
        "synced_to_erp": false,
        "bon_chargement": { "id": 22, "shipment_number": "BCH-2026-00022" },
        "livreur": { "id": 9, "name": "Youssef Livreur" },
        "created_at": "2026-06-15T08:00:00Z"
      }
    ]
  }
}
```

### `GET /backend/dispatcher/warehouse-transfers/{id}`

Full transfer detail with items, BCH, rider, accepter. (`WarehouseTransferController::show()` → `WarehouseTransferService::getTransferDetails()`.)

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
    "shipment_id": 22,
    "rider_id": 9,
    "from_warehouse": "MAIN-CASA-01",
    "to_warehouse": "VAN-9",
    "notes": null,
    "accepted_by": null,
    "accepted_at": null,
    "bon_chargement": {
      "id": 22,
      "shipment_number": "BCH-2026-00022",
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
        "product": { "id": 55, "name": "Huile Végétale 5L" }
      }
    ],
    "created_at": "2026-06-15T08:00:00Z"
  }
}
```

### `POST /backend/dispatcher/warehouse-transfers/from-bch/{bchId}` ⚡

Create a WT from a **completed** BCH — the only real "create" path. Items/quantities are
derived automatically from the BCH's delivery notes; there is no request body to author manually.

```bash
curl -X POST "https://api.omni360.cloud/api/backend/dispatcher/warehouse-transfers/from-bch/22" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: wt:create:$(date +%s)" \
  -d '{}'
```

**Constraint:** BCH must be `status = completed`, else `422 {"success": false, "message": "BCH must be completed before creating warehouse transfer"}`.

**Response `201`:**
```json
{
  "success": true,
  "message": "...",
  "warehouse_transfer_id": 5
}
```

> There is a second, different acceptance path — `POST /backend/warehouse-transfers/bch/{bchId}/accept` (no `dispatcher` prefix, registered separately in `routes/backend.php`) — which both creates the WT **and** flips the BCH to `in_transit` in one call, but only accepts BCH in `prepared`/`loaded` status (not `completed`). Don't call both for the same BCH; pick one path depending on which BCH status you're acting on.

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
  used only by the décharge-reconciliation creation path, not the BCH path). If your screen
  needs ship/receive actions, they need to be built from scratch — this isn't a routing gap
  like list/detail/accept/reject were.
- No manual/arbitrary transfer creation (see the warning above) — only BCH-driven.
- `accept`/`reject` have **no status guard** (no check that the transfer is currently `pending`
  before transitioning) and **no idempotency replay check** beyond the header requirement —
  unlike the BL/BCH/DO decision engine, this controller does direct `$model->update()` calls,
  not the `Decision` class pattern used elsewhere in this doc. Flag to backend if you need the
  same guarantees (constraint checks, replay-safe responses) as the rest of the dispatcher API.

### Real `warehouse_transfers` status values (from code, not invented)

| Status | Meaning | Set by |
|---|---|---|
| `pending` | Created, awaiting acceptance | `createFromBch` / `createFromShipment` |
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
# Blocked with 422 if the vehicle/rider is linked to an active BCH (see guard below).
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

### Active-shipment guard on unassign

> **Added 2026-06-17:** `unassignRider` now **hard-blocks with `422`** if the vehicle (or its
> currently-assigned rider, via `rider_id`) is linked to a `shipments` row whose `status` is
> **not** `completed` or `cancelled` (i.e. `pending`/`in_preparation`/`prepared`/`validated`/
> `loaded`/`in_transit`). This prevents unassigning a rider/vehicle mid-BCH, which would break
> traceability of who/what actually carried a given shipment.
> ```json
> {"success": false, "message": "Cannot unassign vehicle/rider while linked to an active Bon de Chargement."}
> ```
> To support disabling the "Retirer" button proactively in the UI instead of waiting for the
> 422, **all three vehicle-listing endpoints now include a `has_active_shipments` boolean**:
> `GET /backend/dispatcher/vehicles` (§12), `GET /backend/riders/with-vehicles` (above, on each
> vehicle inside `vehicles[]`), and `GET /api/vans` (`index`). When `true`, hide/disable
> "Retirer" and show a tooltip — e.g. *"Impossible de retirer : BCH en cours"*. Verified via
> tinker: creating a `pending` `Shipment` tied to a vehicle/rider sets `has_active_shipments:
> true` on that vehicle and makes `unassign` return `422`; deleting/completing the shipment
> restores normal unassign behavior.

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
      "name": "rider_required",
      "reason": "Un livreur doit être assigné avant de soumettre le BCH au magasinier.",
      "context": { "shipment_id": 22 }
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

type BchStatus =
  | 'pending'
  | 'in_preparation'
  | 'prepared'
  | 'validated'
  | 'loaded'
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

type DoStatus =
  | 'draft'
  | 'pending_allocation'
  | 'allocated'
  | 'partially_allocated'
  | 'optimized'
  | 'in_preparation'
  | 'prepared'
  | 'ready_for_loading'
  | 'dispatched'
  | 'cancelled'
  | 'rejected';

// ─── Core Models ─────────────────────────────────────────────────────────────

interface Rider {
  id: number;
  name: string;
  phone?: string;
}

interface Vehicle {
  id: number;
  plate: string;
  capacity_kg?: number;
}

interface DeliveryNoteItem {
  id: number;
  product_id: number;
  quantity: number;
  allocated_qty: number;
  prepared_quantity?: number | null;
  unit_price: number;
  total_price: number;
  product: { id: number; name: string; sku: string };
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
  partner: { id: number; name: string; code: string };
  order?: { id: number; order_code: string; bc_status: string };
  rider?: Rider | null;
  dispatcher?: { id: number; name: string };
  items?: DeliveryNoteItem[];
  bon_chargement?: Pick<Shipment, 'id' | 'shipment_number' | 'status'> | null;
  preparation?: Pick<PreparationOrder, 'id' | 'bp_number' | 'status'> | null;
  created_at: string;
}

interface Shipment {
  id: number;
  shipment_number: string;
  status: BchStatus;
  branch_code: string;
  has_shortage: boolean;
  shortage_acknowledged: boolean;
  notes?: string;
  estimated_departure?: string;
  rider?: Rider | null;
  dispatcher?: { id: number; name: string };
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
  status: BpStatus;
  total_shortage_percentage?: number;
  is_critical_shortage?: boolean;
  shortage_acknowledged: boolean;
  preparation_efficiency?: number | null;
  magasinier?: { id: number; name: string } | null;
  shipment?: Pick<Shipment, 'id' | 'shipment_number' | 'status'> | null;
  items?: PreparationOrderItem[];
  created_at: string;
  prepared_at?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
}

interface DeliveryOrder {
  id: number;
  do_number: string;
  status: DoStatus;
  planned_delivery_date: string;
  delivery_zone?: string;
  orders_count: number;
  total_ordered_amount: number;
  driver?: Rider | null;
  vehicle?: Vehicle | null;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

interface DispatcherDashboard {
  stats: {
    pending_orders: number;
    draft_bls: number;
    pending_bch: number;
    in_transit: number;
    shortage_queue: number;
    confirmed_today: number;
  };
  recentPreparations: Array<{
    id: number;
    bp_number: string;
    status: BpStatus;
    shipment: { id: number; shipment_number: string };
    rider?: Rider | null;
  }>;
}

// ─── BCH List Response ────────────────────────────────────────────────────────

interface BchIndexResponse {
  bch: {
    current_page: number;
    per_page: number;
    total: number;
    data: Shipment[];
  };
  stats: {
    total: number;
    pending: number;
    in_preparation: number;
    prepared: number;
    completed: number;
  };
}

// ─── Balance Check ────────────────────────────────────────────────────────────

interface ShortageProductBalance {
  product_id: number;
  product_name: string;
  sku: string;
  total_requested: number;
  total_prepared: number;
  shortage: number;
  requesting_bls: Array<{
    bl_id: number;
    delivery_number: string;
    partner_name: string;
    requested: number;
    current_prepared: number;
    suggested_equal: number;
    suggested_fifo: number;
  }>;
}

interface BalanceAnalysis {
  bch_id: number;
  shipment_number: string;
  products: ShortageProductBalance[];
}

// ─── Logistics Batch (LOT) ───────────────────────────────────────────────────

type BatchStatus = 'open' | 'sealed';

interface LogisticsBatch {
  id: number;
  batch_number: string;
  status: BatchStatus;
  branch_code: string;
  dispatcher?: { id: number; name: string };
  sealed_at?: string | null;
  preparation_order_id?: number | null;
  delivery_notes?: DeliveryNote[];
  preparation_order?: Pick<PreparationOrder, 'id' | 'bp_number' | 'status'> | null;
  notes?: string | null;
  created_at: string;
}

// ─── Delivery Mission (DM) — schema exists, NOT wired to any decision/controller/route ──
// See [LOOSE END / FUTURE TODO GAP] in §12b. Do not build a frontend screen against this yet.

type DeliveryMissionStatus = 'created' | 'started' | 'closed';

interface DeliveryMission {
  id: number;
  mission_number: string;
  status: DeliveryMissionStatus;
  rider_id: number;
  shipment_id: number;
  vehicle_id?: number | null;
  branch_code: string;
  started_at?: string | null;
  closed_at?: string | null;
  van_stock_reconciled: boolean;
  cod_reconciled: boolean;
  returns_reconciled: boolean;
  total_bls?: number | null;
  delivered_bls?: number | null;
  failed_bls?: number | null;
  total_returns?: number | null;
  total_cod_collected?: number | null;
}

// ─── Warehouse Transfer (WT) ─────────────────────────────────────────────────

type TransferStatus =
  | 'pending'
  | 'approved'
  | 'in_transit'
  | 'received'
  | 'partially_received'
  | 'cancelled'
  | 'rejected';

interface WarehouseTransferItem {
  id: number;
  product_id: number;
  product_name?: string;
  requested_quantity: number;
  approved_quantity?: number | null;
  received_quantity?: number | null;
  unit_cost: number;
}

interface WarehouseTransfer {
  id: number;
  transfer_number: string;
  status: TransferStatus;
  transfer_type: string;
  source_branch_id: number;
  destination_branch_id: number;
  source_warehouse_id?: number | null;
  destination_warehouse_id?: number | null;
  notes?: string | null;
  requested_by?: { id: number; name: string };
  approved_by?: { id: number; name: string } | null;
  items?: WarehouseTransferItem[];
  created_at: string;
  approved_at?: string | null;
  completed_at?: string | null;
}

// ─── Workflow Decision Types ──────────────────────────────────────────────────

type BlDecision = 'update_delivery' | 'split_delivery' | 'cancel_delivery' | 'confirm_delivery' | 'mark_ready' | 'mark_loaded' | 'mark_in_transit' | 'mark_delivered' | 'mark_partial_delivery' | 'mark_returned';
type BchDecision = 'create_bch' | 'update_bch' | 'submit_to_warehouse' | 'validate_shipment' | 'mark_bch_loaded' | 'mark_bch_in_transit' | 'complete_shipment' | 'cancel_bch' | 'adjust_quantities' | 'resubmit_bch' | 'acknowledge_shortage';
type BatchDecision = 'create_batch' | 'update_batch' | 'seal_batch' | 'delete_batch';
// No MissionDecision type — DeliveryMission has no registered decisions (see §12b, §16).

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
```

---

## 15. End-to-End Workflow Examples

### Example A — Full Dispatch Cycle (Happy Path)

```bash
# Step 1: Dispatcher checks confirmed orders
curl "https://api.omni360.cloud/api/backend/dispatcher/orders/pending" \
  -H "Authorization: Bearer {TOKEN}"
# → order id: 201, bc_status: "confirmed"

# Step 2: (System/ADV creates BLs from orders — see BC workflow)
# BL id: 501 is created in "draft" status

# Step 3: Dispatcher reviews the draft BL
curl "https://api.omni360.cloud/api/backend/dispatcher/bon-livraisons/501" \
  -H "Authorization: Bearer {TOKEN}"

# Step 4: Dispatcher assigns rider and sets delivery date
curl -X PUT "https://api.omni360.cloud/api/backend/dispatcher/bon-livraisons/501" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bl:501:update:$(date +%s)" \
  -d '{"decision":"update_delivery","rider_id":9,"delivery_date":"2026-06-16"}'

# Step 5: Create a BCH grouping this BL (+ BL 502 for same route)
curl -X POST "https://api.omni360.cloud/api/backend/dispatcher/bon-chargements" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bch:create:$(date +%s)" \
  -d '{"decision":"create_bch","bl_ids":[501,502],"rider_id":9,"vehicle_id":3}'
# → bch_id: 22

# Step 6: Submit to Magasinier
curl -X POST "https://api.omni360.cloud/api/backend/dispatcher/bon-chargements/22/submit" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bch:22:submit:$(date +%s)" \
  -d '{}'
# → Scenario B: bp_id: 88 created, BCH → "in_preparation"

# Step 7: Magasinier prepares (see Module 16 — Magasinier)
# → BCH eventually becomes "prepared", BLs become "ready"

# Step 8: Dispatcher prints loading manifest
curl "https://api.omni360.cloud/api/backend/dispatcher/bon-chargements/22/print" \
  -H "Authorization: Bearer {TOKEN}"
```

---

### Example B — Shortage Handling

```bash
# Magasinier completes BP with partial quantities → BCH: completed_partial

# Step 1: Dispatcher sees shortage in queue
curl "https://api.omni360.cloud/api/backend/dispatcher/preparations/shortage-queue" \
  -H "Authorization: Bearer {TOKEN}"
# → bp_id: 88, status: "completed_partial", shortage: 10 units of product 55

# Step 2: Analyze the balance
curl "https://api.omni360.cloud/api/backend/dispatcher/bon-chargements/22/balance" \
  -H "Authorization: Bearer {TOKEN}"
# → product 55: 30 prepared, 40 requested across 2 BLs
# → suggested_equal: 15 each

# Step 3a: Apply equal split
curl -X PUT "https://api.omni360.cloud/api/backend/dispatcher/bon-chargements/22/balance" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bch:22:balance:$(date +%s)" \
  -d '{"decision":"adjust_quantities","split_strategy":"equal"}'
# → BCH: "ready"

# Step 3b: OR manual override (give priority to BL 501)
curl -X PUT "https://api.omni360.cloud/api/backend/dispatcher/bon-chargements/22/balance" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bch:22:balance:manual:$(date +%s)" \
  -d '{
    "decision": "adjust_quantities",
    "split_strategy": "manual",
    "adjustments": [
      {"bl_item_id": 2001, "new_quantity": 20, "reason": "Client prioritaire"},
      {"bl_item_id": 2002, "new_quantity": 10}
    ]
  }'
```

---

### Example C — BL Split Before Grouping

```bash
# BL 501 has mixed cold chain and ambient products — must be split
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

---

### Example D — Dispatcher Rejects a BCH After Magasinier Rejects BP

```bash
# Magasinier rejects the BP (material issue, wrong items, etc.)
# → BP status: "rejected", BCH reverts to "pending"

# Dispatcher resubmits
curl -X POST "https://api.omni360.cloud/api/backend/dispatcher/bon-chargements/22/resubmit" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bch:22:resubmit:$(date +%s)" \
  -d '{"decision":"resubmit_bch"}'
# → New BP created → BCH: "in_preparation"
```

---

## 16. Decision Registry

All workflow decisions available to the `dispatcher` role. Execute any decision via:

```
POST /api/backend/workflow/{model-type}/{id}/execute
```

with body `{ "decision": "<decision_key>", ...fields }`.

### BL (bon-livraison) decisions

| Decision key | `allowedFromStates` | What it does |
|---|---|---|
| `confirm_delivery` | `draft` | Confirms BL, reserves stock — advances to `confirmed` |
| `update_delivery` | `draft`, `confirmed` | Updates rider, delivery date, notes |
| `split_delivery` | `draft` | Splits BL into 2+ child BLs |
| `cancel_delivery` | `draft`, `confirmed` | Cancels BL, releases reserved stock |
| `mark_ready` | `in_preparation` | Marks BL ready after preparation (Magasinier action) |
| `mark_loaded` | `ready` | Confirms items loaded onto vehicle |
| `mark_in_transit` | `loaded` | Rider departs — BL in transit |
| `mark_delivered` | `in_transit` | Full delivery confirmed |
| `mark_partial_delivery` | `in_transit` | Partial delivery recorded |
| `mark_returned` | `in_transit`, `partially_delivered` | Return recorded |
| `reopen_delivery` | `cancelled` | Reopen cancelled BL (admin only) |

### BCH (bon-chargement / shipment) decisions

| Decision key | `allowedFromStates` | What it does |
|---|---|---|
| `create_bch` | *(creation)* | Creates BCH from selected BLs |
| `update_bch` | `pending`, `prepared`, `validated` | Updates rider, date, BL list |
| `submit_to_warehouse` | `pending` | Submits to Magasinier; creates BP if needed |
| `validate_shipment` | `prepared` | Dispatcher validates prepared BCH |
| `mark_bch_loaded` | `validated` | Confirms loading complete |
| `mark_bch_in_transit` | `loaded` | Shipment in transit |
| `complete_shipment` | `in_transit` | Delivery cycle complete |
| `cancel_bch` | `pending` | Cancels BCH, releases stock, reverts BLs to draft |
| `resubmit_bch` | `pending` (BP rejected) | Creates new BP after rejection |
| `adjust_quantities` | `in_preparation` (shortage) | Applies shortage split strategy |
| `acknowledge_shortage` | `in_preparation` | Acknowledges the shortage before balancing |

### BP (bon-preparation / preparation-order) decisions

| Decision key | `allowedFromStates` | What it does |
|---|---|---|
| `start_preparation` | `pending` | Magasinier starts picking |
| `complete_preparation` | `in_progress` | All items picked — full |
| `report_shortage` | `in_progress` | Mark partial pick with shortage details |
| `reject_preparation` | `pending`, `in_progress` | Magasinier rejects BP |
| `request_rework` | `completed_partial` | Dispatcher requests re-pick after shortage review |
| `accept_shortage` | `awaiting_shortage_review` | Dispatcher accepts shortage, proceeds |

### DO (delivery-order) decisions

Model-type slug: **`delivery-order`** (singular, kebab-case — `do` is also accepted and normalizes to `delivery-order`, see `WorkflowController::normalizeModelType()`).

| Decision key | `allowedFromStates` | What it does |
|---|---|---|
| `create_delivery_order` ⚡ | *(creation — `id` = `0`)* | Consolidate confirmed BCs into a new DO. Equivalent to `POST /backend/dispatcher/delivery-orders` (§9), but supports `auto_allocate`/`allocation_strategy` in the same call. Idempotency-key required. `branch_code` is **optional** — if omitted, it's derived from the selected orders' shared `branch_id` (`Branch::find($order->branch_id)->code`). Returns `mixed_branches` violation if the selected orders span more than one branch — pass `branch_code` explicitly to disambiguate in that case. |
| `update_delivery_order` | any | Update planned date, zone, itinerary, notes |
| `optimize_do` | `draft`, `allocated`, `partially_allocated` | Consolidates `delivery_zone`/`planned_delivery_date`/`notes` → `optimized`. Also accepts optional `driver_id`/`vehicle_id` as a **planning-time proposal** (not binding) — see the §2 correction (2026-06-17) above for why this contradicts older docs/training data: the authoritative vehicle for the actual shipment is still resolved at `generate_bch_from_dos` time, which can differ from what was proposed here, especially when multiple DOs are combined into one BCH. |
| `start_do_preparation` | `optimized` | Spawns a BP for Magasinier → `in_preparation` |
| `complete_do_preparation` | `in_preparation` | Magasinier marks DO preparation complete (handles shortage `adjustments`) → `prepared` |
| `generate_bch_from_dos` ⚡ | `prepared`, `ready_for_loading` | **Pipeline 2 (§2) terminal step.** Generate a BCH (shipment) from one or more DOs, bypassing LOT/Val.DO entirely. Body: `do_ids` (array, required — defaults to `[the URL {id}]` if omitted, so a single-DO call needs no extra body), optional `driver_id`, `vehicle_id`, `departure_date`, `notes`. Locks the DO(s) → `dispatched`. If `wms.volumetric_dispatch` is enabled (and `wms.advanced_mode`), this is also where `VolumetricDispatchGate::assertCanDispatchBatch()` runs — it evaluates the **aggregated** weight/volume of every `do_ids` entry against the **one** resolved vehicle (`options.vehicle_id` ?? first DO's `vehicle_id`), not each DO individually against its own stored `vehicle_id`. |
| `delete_delivery_order` ⚡ | `draft` | Delete a DO (admin/dispatcher only — high risk) |
| `validate_delivery_order` | requires DO `allocated`/`partially_allocated` AND ≥1 unit actually allocated (see fix below) AND, if the DO has a logistics batch, that batch's BP must already be `completed_full`/`shortage_accepted` | **Pipeline 1 (§2) step — runs AFTER the LOT's BP completes, not before `create_batch`.** Despite the name, this does **not** allocate stock itself (`runAllocation()` only runs at DO creation via `auto_allocate`) — it only validates that allocation + BP-completion already happened, then sets DO → `validated`. `allowedFromStates` is declared empty on the class; the real gate is `DeliveryOrder::isAllocated()` plus the BP-status check, both enforced in `validate()` (`ValidateDeliveryOrderDecision.php:51,63-82`). **Frontend must never call this right after `create_delivery_order`** — see the incident note below. |

> ⚠️ **Incident (2026-06-18) — DO validated with zero stock allocated, cause not fully resolved.**
> A DO (`do_id: 3`) was created via `create_delivery_order(auto_allocate: true)` against orders
> with no available depot stock, correctly landing in `partially_allocated` with `allocated_qty
> = 0` on every line (`runAllocation()`'s status logic — `DeliveryOrderService.php:205-207` —
> always returns `ALLOCATED`/`PARTIALLY_ALLOCATED`, never leaves the DO at `pending_allocation`,
> even at 0% success). **9 seconds later**, the same DO was `validated` by the same user, with
> `total_allocated_amount: 0.00` and no `logistics_batch_id` — i.e. `validate_delivery_order`
> ran despite zero real allocation and without ever going through Pipeline 1's LOT/BP step.
>
> **Two separate things were found and fixed:**
> 1. **Real validation gap (fixed):** `ValidateDeliveryOrderDecision::validate()` only checked
>    `isAllocated()` — a status check (`ALLOCATED`/`PARTIALLY_ALLOCATED`), not a quantity check.
>    Since `runAllocation()` sets `PARTIALLY_ALLOCATED` even at 0 units allocated, and no
>    logistics batch existed yet (skipping the BP-completeness check entirely), **nothing in the
>    guard blocked validating a DO with zero actual allocation**. Added a 4th check: `sum(allocated_qty) <= 0`
>    → `zero_allocation` violation. A DO that failed allocation entirely can no longer be validated.
> 2. **Caller never identified.** A full server-side audit (decision classes, controllers, event
>    listeners, model observers, scheduled commands, queued jobs) found **no code path that
>    auto-calls `validate_delivery_order`** — `CreateDeliveryOrderDecision::doExecute()` does not
>    chain it, no `execute()` override exists, no listener/observer touches `DeliveryOrder.status`.
>    The frontend team independently confirmed only one network request
>    (`create_delivery_order`) fires from the drag-drop-confirm flow. Server request logs for the
>    incident window weren't available to cross-check. **Added request-context logging to
>    `ValidateDeliveryOrderDecision::doExecute()`** (actor, request_id, IP/UA) so the *next*
>    occurrence can be traced to its actual caller. If you see this again, check
>    `storage/logs/laravel.log` for `"validate_delivery_order called"` around the timestamp.

⚡ = idempotency-key required (`config('erp.idempotency.required_workflow_decisions')`).

```bash
curl -X POST https://api.omni360.cloud/api/backend/workflow/delivery-order/0/execute \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -H "Idempotency-Key: do:create:$(date +%s)" \
  -d '{
    "decision": "create_delivery_order",
    "metadata": {
      "order_ids": [95, 102, 110],
      "planned_delivery_date": "2026-06-18",
      "delivery_zone": "ZONE-SUD",
      "itinerary_id": 3,
      "auto_allocate": true,
      "allocation_strategy": "priority_first"
    }
  }'
```

> ⚠️ **Calling convention:** decision-specific fields (`order_ids`, `branch_code`, etc.) must be nested under the top-level **`metadata`** key (or equivalently `data.metadata` — both are merged together server-side, see `WorkflowController::executeDecision()`). Putting them flat under `data` does **not** work — every `*Decision::validate()`/`doExecute()` reads `$context->data['metadata']`, which the controller always populates (with at least audit fields), so a flat `data` payload is silently ignored. This applies to every decision in this document, not just `create_delivery_order`.

> ℹ️ **`branch_code` is optional as of `CreateDeliveryOrderDecision`'s latest fix.** `orders.branch_code` was dropped by the 3NF normalization migration (`2026_06_24_000000_normalize_branch_code_to_branch_id.php`) in favor of `orders.branch_id`, but `delivery_orders.branch_code` was not migrated. Rather than forcing the frontend to look up `branch_id → code` itself, the decision now derives it server-side from the selected orders when `branch_code` is omitted from the payload. Only pass `branch_code` explicitly if you need to override, or if the selected orders span multiple branches (the decision returns a `mixed_branches` violation in that case, listing the conflicting `branch_ids`).

`generate_bch_from_dos` — single-DO call (no body needed, `do_ids` defaults to the URL `{id}`):

```bash
curl -X POST https://api.omni360.cloud/api/backend/workflow/delivery-order/42/execute \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -H "Idempotency-Key: do:bch:$(date +%s)" \
  -d '{"decision": "generate_bch_from_dos", "metadata": {}}'
```

Grouping multiple DOs into one BCH — pass `do_ids` explicitly (the URL `{id}` is still required but only used to resolve the subject for authorization):

```bash
curl -X POST https://api.omni360.cloud/api/backend/workflow/delivery-order/42/execute \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -H "Idempotency-Key: do:bch:$(date +%s)" \
  -d '{
    "decision": "generate_bch_from_dos",
    "metadata": {
      "do_ids": [42, 43, 44],
      "driver_id": 7,
      "vehicle_id": 12,
      "departure_date": "2026-06-18"
    }
  }'
```

### Logistics Batch (logistics-batch) decisions

Model-type slug: **`logistics-batch`**. Creation decisions (`create_batch`) execute against `id = 0`, same convention as `create_delivery_order`.

| Decision key | `allowedFromStates` | What it does |
|---|---|---|
| `create_batch` ⚡ | *(creation — `id` = `0`)* | Groups `delivery_order_ids` (array, required) + `branch_code` (required) into a new LOT, status `open`. DOs must be `allocated`/`partially_allocated`/`validated`, same branch, and not already in another open/sealed/in_preparation batch. |
| `update_batch` | `open` | Add/remove DOs (`add_delivery_order_ids`/`remove_delivery_order_ids`) or edit `notes`. Blocked once sealed. |
| `seal_batch` ⚡ | `open` (requires ≥1 DO) | Locks the LOT, aggregates every DO's items by `product_id` across the whole batch, generates ONE `PreparationOrder` (BP) → LOT `sealed`. Idempotent — replaying returns the same BP. |
| `delete_batch` | `open` | Deletes an unsealed batch, detaches its DOs. |

There is **no** `validate_batch`/`start_delivery`/`complete_batch`/`cancel_batch` decision — those keys were previously documented here but do not exist in `config/decisions.php`. See §12 for the real `open → sealed` lifecycle.

### Delivery Mission decisions — none registered

`App\Models\DeliveryMission` exists but has **no entry under any model type in `config/decisions.php`**, no controller, no route. There is no `start_mission`/`complete_mission`/`partial_delivery`/`fail_delivery`/`reschedule_mission` decision anywhere in the codebase — see the [LOOSE END / FUTURE TODO GAP] note in §12b.

### How to check available decisions for a record

```bash
# Check which decisions are available RIGHT NOW for BL 501
curl "https://api.omni360.cloud/api/backend/workflow/bon-livraison/501/decisions" \
  -H "Authorization: Bearer {TOKEN}"

# Check for BCH 22
curl "https://api.omni360.cloud/api/backend/workflow/bon-chargement/22/decisions" \
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
| `order_id` | `bigint FK` | Source order (BC) |
| `partner_id` | `bigint FK` | Delivery destination partner |
| `rider_id` | `bigint FK` | Assigned livreur |
| `dispatcher_id` | `bigint FK` | Dispatcher who created it |
| `branch_id` | `bigint FK` | Owning branch |
| `bon_chargement_id` | `bigint FK` | BCH this BL belongs to (null = not batched) |
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
| `order_product_id` | `bigint FK` | Source order line |
| `quantity` | `decimal` | Requested quantity |
| `allocated_qty` | `decimal` | Quantity allocated from stock |
| `prepared_quantity` | `decimal` | Quantity actually prepared by Magasinier |
| `unit_price` | `decimal` | Unit price at time of order |
| `total_price` | `decimal` | `quantity × unit_price` |

### shipments (BCH)

| Column | Type | Description |
|---|---|---|
| `id` | `bigint` | Primary key |
| `shipment_number` | `varchar` | BCH reference (e.g. `BCH-2026-00022`) |
| `status` | `varchar` | BchStatus enum value |
| `branch_id` | `bigint FK` | Owning branch |
| `rider_id` | `bigint FK` | Assigned livreur |
| `dispatcher_id` | `bigint FK` | Dispatcher who created |
| `vehicle_id` | `bigint FK` | Vehicle assigned |
| `has_shortage` | `boolean` | Set `true` when BP reports partial preparation |
| `shortage_acknowledged` | `boolean` | Set `true` when Dispatcher accepts shortage |
| `estimated_departure` | `timestamp` | Planned departure time |

### shipment_deliveries (BCH ↔ BL pivot)

| Column | Type | Description |
|---|---|---|
| `id` | `bigint` | Primary key |
| `shipment_id` | `bigint FK` | Parent BCH |
| `delivery_note_id` | `bigint FK` | BL included in this BCH |
| `sequence_order` | `int` | Delivery stop order |
| `is_primary` | `boolean` | Primary BL for this partner stop |

### preparation_orders (BP)

| Column | Type | Description |
|---|---|---|
| `id` | `bigint` | Primary key |
| `bp_number` | `varchar` | BP reference (e.g. `BP-2026-00088`) |
| `status` | `varchar` | BpStatus enum value |
| `shipment_id` | `bigint FK` | Parent BCH |
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
| `preparation_order_id` | `bigint FK` | Parent BP |
| `product_id` | `bigint FK` | Product |
| `delivery_note_item_id` | `bigint FK` | Linked BL line item |
| `requested_quantity` | `decimal` | Quantity the Dispatcher requested |
| `available_quantity` | `decimal` | Stock available at time of picking |
| `prepared_quantity` | `decimal` | Quantity actually picked |
| `shortage_quantity` | `decimal` | `requested - prepared` |
| `shortage_reason` | `varchar` | Magasinier's note on shortage cause |
| `shortage_reported_at` | `timestamp` | When shortage was flagged |

### logistics_batches (LOT)

> **Corrected 2026-06-17**: previously listed `branch_code` here — that column was actually
> dropped by the 3NF normalization migration (`logistics_batches` is `branch_id`-only).
> Verified via `Schema::hasColumn('logistics_batches', 'branch_code')` → `false` on the live DB.
> Code that reads `$batch->branch_code` (e.g. `SealBatchDecision`'s/`ContinuePreparationDecision`'s
> `$bp->logisticsBatch?->branch_code` fallback chain) silently gets `null` from this source —
> harmless there since it falls through to `deliveryNotes.branch_code` next, but don't trust
> `logisticsBatch->branch_code` as a value source elsewhere without checking first.

| Column | Type | Description |
|---|---|---|
| `id` | `bigint` | Primary key |
| `batch_number` | `varchar` | LOT reference (e.g. `BATCH-2026-00003`) |
| `branch_id` | `bigint FK` | Owning branch |
| `dispatcher_id` | `bigint FK` | Dispatcher who created the batch |
| `preparation_order_id` | `bigint FK` | BP generated by `seal_batch` (null until sealed) |
| `status` | `varchar` | `open` or `sealed` in practice — column comment also lists `in_preparation`/`completed`/`cancelled` as reserved-but-unused values; no decision currently sets them |
| `sealed_at` | `timestamp` | When `seal_batch` ran |
| `notes` | `text` | Dispatcher notes |

> No `rider_id`/`vehicle_id`/`delivery_date`/`total_amount` columns on this table — fleet assignment and delivery dates live on the BCH (`shipments`), not the LOT.

### delivery_missions (DM) — schema exists, unwired

| Column | Type | Description |
|---|---|---|
| `id` | `bigint` | Primary key |
| `mission_number` | `varchar` | DM reference |
| `rider_id` | `bigint FK` | Rider for this session |
| `shipment_id` | `bigint FK` | The BCH this mission covers |
| `vehicle_id` | `bigint FK` | Vehicle |
| `branch_code` | `varchar` | Owning branch |
| `status` | `varchar` | `created`, `started`, `closed` (per model constants — no code currently writes these) |
| `started_at` / `closed_at` | `timestamp` | Session bounds |
| `van_stock_reconciled` / `cod_reconciled` / `returns_reconciled` | `boolean` | Reconciliation flags |
| `total_bls` / `delivered_bls` / `failed_bls` / `total_returns` / `total_cod_collected` | numeric | Session totals |

See the [LOOSE END / FUTURE TODO GAP] note in §2 and §12b — this table is migrated but no decision, controller, or route populates it yet.

### delivery_orders (DO)

> **Corrected 2026-06-17** against `Schema::getColumnListing('delivery_orders')` — previous
> version said `branch_id`/`rider_id`; the real columns are `branch_code` (string, **not**
> migrated by the 3NF pass — see the `branch_code` optional-derivation note in §16) and
> `driver_id` (not `rider_id`).

| Column | Type | Description |
|---|---|---|
| `id` | `bigint` | Primary key |
| `do_number` | `varchar` | DO reference (e.g. `DO-2026-00010`) |
| `status` | `varchar` | DoStatus enum value |
| `branch_code` | `varchar FK` | Owning branch (`branches.code`) |
| `driver_id` | `bigint FK` | Driver assigned (planning-time proposal — see §2/§16 `optimize_do` correction) |
| `vehicle_id` | `bigint FK` | Vehicle (same caveat as `driver_id`) |
| `planned_delivery_date` | `date` | Planned date for all stops in this DO |
| `delivery_zone` | `varchar` | Geographic zone label |
| `itinerary_id` | `bigint FK` | Itinerary |
| `logistics_batch_id` | `bigint FK` | LOT this DO belongs to, Pipeline 1 only (§2) |
| `dispatched_bch_id` | `bigint FK` | BCH this DO was dispatched into, Pipeline 2 only (§2) |
| `allocation_run_id` | `varchar` | Set by `runAllocation()`, only when created with `auto_allocate` |
| `total_ordered_amount` / `total_allocated_amount` | `decimal` | Sums across linked orders |
| `orders_count` / `products_count` | `int` | Denormalized counts |
| `optimized_by` / `optimized_at` | mixed | Set by `optimize_do` |
| `dispatched_by` / `dispatched_at` | mixed | Set by `generate_bch_from_dos` |
| `period_id` | `bigint FK` | ERP period |

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

> Corrected 2026-06-17 against `Schema::getColumnListing('warehouse_transfers')` on the live DB — the
> previous version of this table was entirely fabricated (no `source_branch_id`/`destination_branch_id`/
> `approved_by_id`/`completed_at` columns exist). See §12c for the real lifecycle.

| Column | Type | Description |
|---|---|---|
| `id` | `bigint` | Primary key |
| `transfer_number` | `varchar` | WT reference (e.g. `WT-2026-00005`) |
| `status` | `varchar` | `pending`/`accepted`/`completed`/`rejected`/`validated` — see §12c |
| `shipment_id` | `bigint FK` | Source BCH (`shipments.id`) |
| `rider_id` | `bigint FK` | Rider this transfer is for |
| `livreur_emplacement_code` | `varchar` | Rider's mobile stock emplacement code |
| `from_warehouse` | `varchar` | Origin warehouse code (string, not an FK id) |
| `to_warehouse` | `varchar` | Destination warehouse code (string, not an FK id) |
| `from_storage_location_id` | `bigint FK` | Origin storage location |
| `to_storage_location_id` | `bigint FK` | Destination storage location |
| `transfer_type` | `varchar` | e.g. `bch_to_van` |
| `progress_level` | `int` | 0–100, set by `accept()` (→50) and completion flows |
| `synced_to_erp` / `erp_sync_status` / `erp_error_message` / `erp_synced_at` / `erp_transfer_id` | mixed | Sage X3 sync tracking |
| `accepted_by` | `bigint FK` | User who accepted |
| `accepted_at` | `timestamp` | When accepted |
| `notes` | `text` | Free text — also used to store the `reject()` reason (no dedicated rejection column) |
| `delivery_mission_id` | `bigint FK` | Linked DM (schema-only, see §12b) |
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
| `requested_quantity` | `decimal` | Quantity requested |
| `transferred_quantity` | `decimal` | Quantity actually transferred from warehouse |
| `delivered_quantity` | `decimal` | Quantity delivered to the partner |
| `returned_quantity` | `decimal` | Quantity returned |
| `unit_price` | `decimal` | Price at transfer time |
| `delivery_note_id` | `bigint FK` | Linked BL, if applicable |
| `stock_batch_id` / `batch_number` / `expiry_date` | mixed | Lot/batch tracking |
| `sales_group_code` | `varchar` | Sales group classification |

### delivery_order_orders

| Column | Type | Description |
|---|---|---|
| `id` | `bigint` | Primary key |
| `delivery_order_id` | `bigint FK` | Parent DO |
| `order_id` | `bigint FK` | Order (BC) assigned to this DO |

### delivery_order_items

| Column | Type | Description |
|---|---|---|
| `id` | `bigint` | Primary key |
| `delivery_order_id` | `bigint FK` | Parent DO |
| `order_product_id` | `bigint FK` | Source order line item |
| `product_id` | `bigint FK` | Product being delivered |
| `quantity` | `decimal` | Quantity allocated to this DO |

### shipment_delivery_orders

| Column | Type | Description |
|---|---|---|
| `id` | `bigint` | Primary key |
| `shipment_id` | `bigint FK` | Parent BCH |
| `delivery_order_id` | `bigint FK` | Target Delivery Order (DO) |

### preparation_delivery_notes

| Column | Type | Description |
|---|---|---|
| `id` | `bigint` | Primary key |
| `preparation_order_id` | `bigint FK` | Parent BP |
| `delivery_note_id` | `bigint FK` | Target Delivery Note (BL) for shortage mapping |

---

## 18. Entity Relationship Summary

```
Order (BC)
  └─► DeliveryOrderOrders ──► DeliveryOrder (DO)
                                    │
                                    ▼ (logistics_batch_id)
                              LogisticsBatch (LOT)
                                    │
                                [seal_batch]
                                    ▼
                              PreparationOrder (BP)  [ONE BP for the whole LOT]
                                    └─► PreparationOrderItem (aggregated by product_id across all DOs)

(After BP completion, BLs are generated and the chain continues per-BL:)

DeliveryNote (BL)
  ├─► DeliveryNoteItem [1:many]
  └─► ShipmentDelivery ──► Shipment (BCH)
                                 └─► PreparationOrder (BP)   [also reachable directly per-BCH
                                                               via the generate_bch_from_dos shortcut,
                                                               which skips the LOT step]

DeliveryMission (DM) — schema only, not wired to any of the above (see §12b)

WarehouseTransfer (WT)
  ├─► WarehouseTransferItem
  └─► Branch (source) → Branch (destination)
```

**Key navigation pattern for frontend:**

1. Start from `Order.id` → fetch `/dispatcher/orders/{id}` to get `delivery_notes[]`
2. From `DeliveryOrder.id` → fetch `/workflow/delivery-order/{id}` (§16) to get the DO, its `logistics_batch`, and any `bchs[]`
3. From `LogisticsBatch.id` → fetch `/dispatcher/batches/{id}` to get `delivery_notes[]` + `preparation_order` (§12)
4. From `DeliveryNote.id` → fetch `/dispatcher/bon-livraisons/{id}` to get `bon_chargement`, `preparation`
5. From `Shipment.id` → fetch `/dispatcher/bon-chargements/{id}` to get `delivery_notes[]` + `preparation_order`
6. From `PreparationOrder.id` → fetch BP detail for shortage analysis

---

*Generated from source: `app/Http/Controllers/Backend/DispatcherController.php`, `app/Decisions/Dispatcher/`, `routes/backend.php`, `config/decisions.php`, `database/migrations/`, `app/Enums/BlStatus.php`*  
*Last updated: 2026-06-16 — pipeline (§2), batch lifecycle (§12, §16), and delivery-mission gap (§12b, §17, §18) corrected against source after an audit found the previous LOT/DM sections were fabricated/aspirational rather than implemented.*
