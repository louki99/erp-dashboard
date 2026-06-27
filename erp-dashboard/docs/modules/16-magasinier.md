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
7. [Batch Picking](#7-batch-picking) ⚠️ orphaned/legacy — see warning in section
8. [Stock Management](#8-stock-management)
   - [WMS Stock API (Epic 5/6/7)](#85-wms-stock-api-epic-567)
9. [Conventional Loading (SFA → Van)](#9-conventional-loading)
10. [Conventional Décharge Reconciliation (EOD Van → Depot)](#10-conventional-décharge-reconciliation-eod-van--depot)
11. [Décharge — Van → Depot Unloading](#11-décharge--van--depot-unloading)
12. [Returns Processing](#12-returns-processing)
13. [Generic Workflow Utility Endpoints](#13-generic-workflow-utility-endpoints)
14. [Error Handling](#14-error-handling)
15. [TypeScript Interfaces](#15-typescript-interfaces)
16. [End-to-End Workflow Examples](#16-end-to-end-workflow-examples)

> **Removed 2026-06-22:** "BC → BP Exception Flow" (the old direct BC→BP shortcut,
> `GET orders/approved` + `POST preparations/from-orders`) — deleted entirely along with the
> `create_bp_from_orders` decision it depended on. Orders always flow through a Delivery
> Mission now (Module 15).

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

> **2026-06-22 — full architecture migration.** The old BC → DO → LOT (logistics batch) →
> BP → BL → BCH (Shipment) pipeline is **gone**. `shipments`, `delivery_orders`,
> `logistics_batches` and their pivot tables are **dropped**. Everything now flows through
> **Delivery Mission** (see Module 15 — Dispatcher). The magasinier's role is unchanged in
> spirit (pick a BP, report quantities, hand off shortages) but every BCH/Lot reference below
> is replaced by the mission. See `docs/modules/planning_refactor_schema.md` for the full
> migration rationale.

```
Dispatcher drags confirmed BCs into a Mission (create_delivery_mission)
         │
         ▼
  Mission: draft — BLs generated in draft, no stock touched yet
         │
   [Dispatcher: confirm_delivery_mission]  ◄── ATOMIC, one call:
         │                                      1. auto-reserves stock for every BL
         │                                      (shortage-tolerant — shortfall routed to a
         │                                      backlog Order automatically, never blocks)
         │                                      2. auto-generates ONE BP for the mission
         ▼
  Mission: in_preparation
  BP created — status: pending
         │
   [Magasinier: start_preparation]
         │
         ▼
  BP: in_progress  ◄── while here, the dispatcher can pull the mission back to draft via
  Mission's BLs:        reopen_delivery_mission (Module 15 §8.6) — BP → cancelled, see §3
  in_preparation
         │
   [update_preparation — item quantities incrementally]
         │
   [complete_preparation]                       OR   [report_shortage]  (optional escalation,
         │                                             mid-pick, skips straight to
         │                                             awaiting_shortage_review — §6.7)
         │
         ├─── No shortage ──► BP: completed_full
         │                         │
         │                         ├─► Mission's BLs: ready
         │                         └─► WarehouseTransfer created 'pending' (items only —
         │                              NO stock movement yet, see the gate below)
         │
         └─── Shortage ─────► BP: completed_partial
                                   │   Mission: awaiting_shortage_review (new 2026-06-23 — set
                                   │   automatically, atomically, the instant the BP finishes
                                   │   short). BLs stay exactly where they are
                                   │   (in_preparation/batched) — NOT ready, NO transfer.
                                   │   The rider cannot depart on an incomplete pick.
                                   ▼
                          [Dispatcher: review_partial_preparation]
                                      │
                              BP: awaiting_shortage_review (Mission: still awaiting_shortage_review)
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                     ▼
       [Dispatcher: accept_partial_preparation,   [Dispatcher: request_rework]
        metadata.allocations REQUIRED — see                │
        Module 15 §10, the dispatcher           BP: partial_rework_requested
        manually picks which BL loses           Mission: in_preparation (you're picking
        stock, not the system]                  again — request_rework moves it back here)
                    │                                     │
        BP: shortage_accepted                              │
        ──[auto-chained, same call,                         │
           dispatcher's allocations]──►        [Magasinier: continue_preparation]
        BP: shortage_split_done                             │
        (backlog BC(s) re-injected exactly                  │
         per the chosen allocations)
                    │                                       │
                    │                          BP: completed_full, Mission: ready
                    │                            (or still completed_partial, Mission: back
                    │                             to awaiting_shortage_review — loop back
                    │                             to dispatcher)
                    ▼                                       │
         Mission: ready, WarehouseTransfer        Mission: ready, WarehouseTransfer
         created 'pending' — same gate below      created 'pending' — same gate below
                    │                                       │
                    └─────────────────┬─────────────────────┘
                                       ▼
                          Mission: ready, WT: pending
                                       │
                         [Rider: POST .../warehouse-transfers/{id}/accept]
                                       │   ◄── THIS is what physically moves the stock
                                       │       (CENTRAL availability → VAN), not
                                       │       complete_preparation/continue_preparation/
                                       │       split_remaining_quantity. See the fix note below.
                                       ▼
                              WT: accepted, stock moved
```

> **There is no more manual "generate BP" or "allocate stock" step.** Both used to be
> separate dispatcher actions (`allocate_delivery_note` per BL, `generate_preparation_for_mission`
> for the BP) — both are **removed entirely**, folded into `confirm_delivery_mission`'s atomic
> execution. The magasinier's first touchpoint on a mission is always `start_preparation` on a
> BP that already exists with stock already reserved — there is nothing to create or allocate
> from the warehouse side anymore.
>
> **Warehouse Transfer is now automatic — but only when the BP is fully prepared.** Until this
> migration, the dispatcher manually triggered a CENTRAL→VAN transfer once the rider accepted the
> BCH. Now, `complete_preparation` creates the WT itself, but only when the BP finishes
> `completed_full` (via `WarehouseTransferService::createFromMission()`) — see
> [§6.5](#65-complete-preparation).
>
> **Fixed 2026-06-23 — three real bugs, found auditing the dispatcher↔magasinier handoff:**
> 1. **Mission/BLs used to leak to `ready` on a shortage.** `complete_preparation` advanced the
>    mission's BLs to `ready` unconditionally, regardless of `completed_full` vs
>    `completed_partial`. Fixed — BLs (and the WT) now only advance when the BP is
>    `completed_full`. On a shortage, the BLs correctly stay `in_preparation`/`batched` until
>    the dispatcher resolves it (`accept_partial_preparation` or `request_rework` +
>    `continue_preparation`) — see the diagram above and Module 15 §10.
> 2. **The real stock movement (CENTRAL availability → VAN) used to execute immediately at WT
>    creation** — i.e. the moment you, the magasinier, finished picking, before the rider had
>    done anything. If the rider rejected the mission or it needed adjusting, the stock books
>    were already wrong. Fixed: the WT is now created `pending` (items only, no stock touched).
>    **The actual stock movement only happens when the rider explicitly accepts the mission**
>    on their app (`POST /backend/dispatcher/warehouse-transfers/{id}/accept`, Module 15 §12c) —
>    this is now the real "transfer of responsibility" moment, atomic, idempotency-guarded
>    (rejects a second call once no longer `pending`).
> 3. **(Later same day) The mission used to just silently sit at `in_preparation` on a
>    shortage** — same value as "still being picked", giving the dispatcher no real signal to
>    act on and no way to filter/count missions stuck on a shortage. Fixed: new explicit mission
>    status `awaiting_shortage_review`, set atomically the instant the BP finishes
>    `completed_partial`. `request_rework` moves it back to `in_preparation` (you're picking
>    again); a `continue_preparation` attempt that's still short loops it back to
>    `awaiting_shortage_review` instead of stalling at `in_preparation`. Required widening
>    `delivery_missions.status` from `varchar(20)` to `varchar(40)` — the new value didn't fit.
> 4. **(Later still) `split_remaining_quantity` stopped deciding on its own which customer
>    loses stock.** A dispatcher flagged that the auto-split (greedy, first-BL-first across the
>    mission's BLs) was making a commercial call the system has no business making. Fixed:
>    `accept_partial_preparation` now requires `metadata.allocations:
>    [{ bl_id, product_id, quantity }]` — the dispatcher's explicit choice, sourced from
>    `review_partial_preparation`'s new `shortage_details[].affected_bls`. This doesn't touch
>    anything magasinier-side directly, but it's why a BP's eventual `shortage_split_done`
>    backlog now lands against whichever BL/customer the dispatcher picked, not whichever BL
>    happened to be first in the list.
>
> All four fixes verified live end-to-end against a real WSL Postgres instance, including the
> full shortage → rework → still-short → rework → fully-resolved → ready state machine, and a
> two-BL shortage where the dispatcher's chosen BL (not the first one) was the one reduced.

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
> the same pool a normal salesperson order takes, ready for the dispatcher to plan into a new
> mission on the next pass. No draft BL is created anymore for this path — **if your frontend was
> reading `accept_partial_preparation`'s `backlog.backorder_bls`/`backlog.backorder_bls_count`,
> those keys are gone; use `backlog.backlog_orders`/`backlog.backlog_orders_count` instead**, and
> each entry now has `id`/`order_code`/`parent_order_id`/`parent_order_code`/`items_count`/
> `total_quantity` (no `delivery_number`/`parent_delivery_note_id` anymore).

> **Fixed 2026-06-23 — the dispatcher's shortage-resolution flow was broken end-to-end,
> 4 separate bugs deep, found while auditing the dispatcher↔magasinier handoff:**
> 1. **`completed_partial` was unreachable.** `complete_preparation` hard-required every short
>    line to already have `shortage_reported_at` set (only settable via `report_shortage`), but
>    `report_shortage` itself immediately moves the BP to `awaiting_shortage_review` — so there
>    was no sequence of calls that could ever land a BP at `completed_partial`. Fixed: `complete_preparation`
>    now auto-fills the shortage fields itself when missing — see [§6.5](#65-complete-preparation).
> 2. **`accept_partial_preparation` crashed.** It auto-chains `split_remaining_quantity`
>    (added 2026-06-17, see below), which accessed `$bp->logisticsBatch`/`$bp->bonChargement` —
>    relations deleted by the mission migration — and threw `BadMethodCallException` every time.
>    This means the whole accept-and-split path has been completely broken since 2026-06-21 and
>    no test exercised it until today. Fixed to resolve the branch via `$bp->deliveryMission`.
> 3. **Payload-key bug, 4 decisions:** `accept_partial_preparation` (`acceptance_reason`),
>    `request_rework` (`rework_reason`), `report_shortage` (`shortage_items`), and
>    `continue_preparation` (`additional_items`) all read their field straight from the request's
>    top-level `data`, not `data.metadata` — but their own `schema()` definitions and every curl
>    example in this doc send these fields under `metadata`. `accept_partial_preparation` masked
>    this silently (fell back to a generic default reason, losing the dispatcher's real text);
>    `request_rework` hard-failed with `rework_reason_required` even when a reason was sent. Fixed
>    to check `metadata` first, same fix pattern as `reject_preparation` (2026-06-22).
> 4. **`continue_preparation` always crashed on its `StockMovement::create()`** — it used
>    `type: "preparation_continued"`, a value not in `stock_movements`' CHECK constraint. Fixed to
>    `type: "sale"`. See [§6.8](#68-continue-preparation-rework).
>
> All four verified live end-to-end against a real WSL Postgres instance (transaction + rollback):
> direct shortage completion → `completed_partial`, `review_partial_preparation` →
> `accept_partial_preparation` (auto-chain, real backlog BC created, no crash), and separately
> `request_rework` → `continue_preparation` → `completed_full`.

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
>
> **Superseded 2026-06-22** by the mission migration above — `logistics_batches` referenced in
> this note no longer exists at all (dropped), and the `readyToPrepare` dashboard field
> mentioned here has since been **removed entirely** (it measured "confirmed BCs not yet in a
> BP", a concept that doesn't apply anymore now that orders always go through a mission first —
> see [§5](#5-dashboard)).

> **Known gap — `create_decharge` has no mission-based replacement (as of 2026-06-22).** The
> décharge-creation flow below describes the **old** BCH-based trigger, which no longer exists
> (`CreateDechargeDecision` was built entirely around `Shipment` and was deleted along with it,
> not ported). `approve_decharge`/`reject_decharge` ([§12](#12-décharge--van--depot-unloading))
> still work on any décharge created some other way, but nothing in the current API actually
> *creates* one from a completed mission. Do not build a "create décharge" button against the
> mission flow until this is built — ask backend first.

**Décharge (van unload) flow — separate from BP preparation:**
```
Rider finishes mission — mission: completed
    │
    ▼ [no current trigger — see gap note above]
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
| `rejected` | Rejected by Magasinier | Mission/BLs revert to `draft` — dispatcher re-runs `confirm_delivery_mission` once resolved |
| `cancelled` | **New 2026-06-22.** Mission pulled back to draft by the dispatcher mid-preparation (`reopen_delivery_mission`, Module 15 §8.6) — e.g. a salesperson needs to edit a BC already inside the mission. Kept for audit, never deleted | Terminal for this BP — a brand-new BP is generated when the dispatcher re-confirms the mission |

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
  "pendingBps": [
    {
      "id": 88,
      "bp_number": "LODA000-A01-000088",
      "status": "pending",
      "delivery_mission": { "id": 22, "mission_number": "MSN-20260622-0003", "rider": { "id": 9, "name": "Youssef Livreur" } },
      "created_at": "2026-06-15T11:30:00Z"
    }
  ]
}
```

| Field | Description |
|---|---|
| `pendingPreparations` | BPs in `pending` status (branch-scoped via `deliveryMission.branch_code`) |
| `inProgress` | BPs in `in_progress` or `partial_rework_requested` |
| `completedToday` | BPs completed today |
| `lowStockItems` | Stock rows in this branch with `available_quantity < minimum_quantity` |

> **Removed 2026-06-22 — `readyToPrepare`.** This used to count confirmed BCs not yet
> assigned to a BP (the old direct BC→BP flow). That flow is gone — orders always go through a
> delivery mission first, and that "not yet planned" view is the **dispatcher's** concern now
> (`GET /backend/dispatcher/orders/pending`, Module 15), not the magasinier's. The field no
> longer appears in the response — remove any frontend code reading it.
>
> **Response shape note:** the JSON keys are flat (`pendingPreparations`, not nested under a
> `stats` object) — this matches the actual `compact(...)` call in
> `MagasinierController::dashboard()`. `pendingBps` now eager-loads `deliveryMission.rider`
> (not `bonChargement`, which no longer exists).

---

## 6. Préparations (BP)

> Most BP mutations go through the workflow engine at `POST /backend/workflow/bon-preparation/{id}/execute` with a `decision` key. Direct PUT routes also exist as shortcuts (`MagasinierController`) that internally call the same decisions and return their response unwrapped.
>
> **Response envelope:** every decision response (whether hit via the direct PUT/GET routes
> below or the generic workflow route) has the shape
> `{"success": bool, "message": string, "decision": string, "output": {...}}` — the decision's
> actual return data is under **`output`**, not `data`. (`current_state`/`request_id` are also
> present but rarely relevant to the UI.)

---

### 6.1 List Preparations

`GET /backend/magasinier/preparations/pending`

**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `scope` | `string` | `active` (default): pending + in_progress + partial_rework_requested; `rupture_watch`: adds completed_partial; `history`: completed_full/shortage_split_done/shortage_accepted/awaiting_shortage_review/rejected; `all`: everything |
| `status` | `string` | Override scope with exact status filter (comma-separated for multiple) |
| `search` | `string` | Search by BP number or mission number |
| `page` | `number` | Default 1, 20 per page |

```bash
curl "https://api.omni360.cloud/api/backend/magasinier/preparations/pending?scope=active" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200`:** (raw Laravel paginator — `MagasinierController::pendingPreparations()` returns `$paginator->toArray()` directly, not wrapped in `success`/`output`)
```json
{
  "current_page": 1,
  "per_page": 20,
  "total": 3,
  "data": [
    {
      "id": 88,
      "bp_number": "LODA000-A01-000088",
      "status": "pending",
      "total_items": 5,
      "prepared_items": 0,
      "total_shortage_percentage": 0,
      "is_critical_shortage": false,
      "priority_level": "normal",
      "deadline": null,
      "delivery_mission": {
        "id": 22,
        "mission_number": "MSN-20260622-0003",
        "status": "in_preparation",
        "rider": { "id": 9, "name": "Youssef Livreur" },
        "delivery_notes": [ { "id": 501, "delivery_number": "BLA000-A01-000501", "status": "batched" } ]
      },
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
  "bp_number": "LODA000-A01-000088",
  "status": "pending",
  "total_items": 5,
  "prepared_items": 0,
  "preparation_efficiency": null,
  "notes": null,
  "rejection_reason": null,
  "priority_level": "normal",
  "deadline": null,
  "shortage_acknowledged": false,
  "delivery_mission": {
    "id": 22,
    "mission_number": "MSN-20260622-0003",
    "status": "in_preparation",
    "rider": { "id": 9, "name": "Youssef Livreur" },
    "delivery_notes": [
      { "id": 501, "delivery_number": "BLA000-A01-000501", "status": "batched", "partner": { "id": 12, "name": "Supermarché Atlas" } }
    ]
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

**Response `200`:** (verified live against `StartPreparationDecision::doExecute()`)
```json
{
  "success": true,
  "message": "Decision executed successfully",
  "decision": "start_preparation",
  "output": {
    "bp_id": 88,
    "bp_number": "LODA000-A01-000088",
    "status": "in_progress",
    "magasinier": "Hassan Magasinier",
    "bl_count": 1,
    "stock_warnings": []
  }
}
```

`stock_warnings` is populated (non-blocking) when the soft pre-picking stock check
(`StockPrePickingValidationConstraint`) finds insufficient real stock for some line —
each entry has `product_id`, `product_name`, `requested_qty`, `available_qty`, `shortage_qty`.

**Side effects:**
- BP status → `in_progress`, `magasinier_id` assigned to the calling user
- The mission's BLs status → `in_preparation`
- Soft stock pre-check runs (warnings only — does not block), checked against the branch's
  real sellable pick-face zone (e.g. `{branch}-PFZ0`), not a placeholder "DEPOT" location

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

**Constraint:** `prepared_quantity` cannot exceed either the `requested_quantity` or the
physically available stock — checked against the branch's real sellable pick-face zone
(e.g. `{branch}-PFZ0`, resolved via `App\Services\Delivery\DeliveryLocationResolver`), not a
placeholder "DEPOT" location.

**Response `200`:** (verified live against `UpdatePreparationDecision::doExecute()`)
```json
{
  "success": true,
  "message": "Decision executed successfully",
  "decision": "update_preparation",
  "output": {
    "bp_id": 88,
    "bp_number": "LODA000-A01-000088",
    "status": "in_progress",
    "updated_items": [
      { "product_id": 55, "product_name": "Huile Végétale 5L", "requested_quantity": 40, "prepared_quantity": 25, "available_quantity": 35, "shortage": 15 },
      { "product_id": 60, "product_name": "Sucre 50kg", "requested_quantity": 24, "prepared_quantity": 24, "available_quantity": 24, "shortage": 0 }
    ],
    "statistics": {
      "total_items": 2,
      "total_requested": 64,
      "total_prepared": 49,
      "progress": 76.56,
      "is_complete": false
    }
  }
}
```

> `available_quantity` here is the real-time **physical** stock quantity (`stocks.quantity`),
> shown for reference — it is not the same number as `requested_quantity`/`prepared_quantity`.

---

### 6.5 Complete Preparation

`PUT /backend/magasinier/preparations/{id}/save`

Finalizes the preparation (`complete_preparation` decision). All item quantities must be set. If any `prepared_quantity < requested_quantity`, the BP is marked `completed_partial` (shortage).

> **Fixed 2026-06-23 — calling this directly with a shortfall, with no prior `report_shortage`
> call, now works.** It used to hard-reject with `shortage_not_reported` unless `report_shortage`
> ([§6.7](#67-report-shortage-explicit)) had already been called for every short line — but
> `report_shortage` itself immediately moves the BP to `awaiting_shortage_review`, which made it
> impossible to ever call `complete_preparation` afterward (status no longer `in_progress`). In
> practice this meant `completed_partial` could **never be reached** through the normal
> finish-picking flow. Fixed: `complete_preparation` now auto-fills `shortage_quantity`/
> `shortage_reason: "not_specified"`/`shortage_reported_at` for any short line that wasn't
> already reported, instead of blocking. `report_shortage` is unchanged — it's still the
> separate, optional **mid-pick escalation** path (see [§6.7](#67-report-shortage-explicit)),
> not a prerequisite.

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

**Response `200` — No shortage:** (verified live against `CompletePreparationDecision::doExecute()` — `prepared_quantities` keys are `bp_item_id`, the BP's own item IDs, not `delivery_note_item_id`)
```json
{
  "success": true,
  "message": "Decision executed successfully",
  "decision": "complete_preparation",
  "output": {
    "bp_id": 88,
    "bp_number": "LODA000-A01-000088",
    "status": "completed_full",
    "is_fully_prepared": true,
    "efficiency": 100,
    "shortage_percentage": 0,
    "stock_deducted": 0,
    "total_prepared": 64,
    "total_requested": 64,
    "total_shortage": 0,
    "generated_bls": [],
    "mission_id": 22,
    "warehouse_transfer": {
      "id": 3,
      "transfer_number": "WT-2026-00003",
      "status": "pending",
      "delivery_mission_id": 22,
      "rider_id": 9,
      "from_warehouse": "A0001-PFZ0",
      "to_warehouse": "A0001-VAN-MERC-01",
      "items": [
        { "id": 5, "product_id": 55, "requested_quantity": "40.000", "transferred_quantity": "40.000", "product_name": "Huile Végétale 5L", "sales_group_code": "FDP" }
      ]
    }
  }
}
```

> **New since the mission migration:** `mission_id` and `warehouse_transfer` are now part of
> this response — `complete_preparation` auto-creates the CENTRAL→VAN warehouse transfer the
> moment the BP finishes (`WarehouseTransferService::createFromMission()`), so there is no
> separate "create transfer" step for the dispatcher anymore. `stock_deducted` will be `0` for
> every mission-based BP — no physical deduction happens at preparation time, the reservation
> made by `confirm_delivery_mission` carries through to the warehouse transfer instead.
> `generated_bls` is always `[]` in the mission flow (BLs already exist, created by
> `create_delivery_mission`) — it's a leftover field from an older, now-unused code path
> (`bl_from_bp` feature flag), kept for response-shape stability, don't build logic around it.

**Response `200` — With shortage:**
```json
{
  "success": true,
  "message": "Decision executed successfully",
  "decision": "complete_preparation",
  "output": {
    "bp_id": 88,
    "bp_number": "LODA000-A01-000088",
    "status": "completed_partial",
    "is_fully_prepared": false,
    "efficiency": 80,
    "shortage_percentage": 20,
    "stock_deducted": 0,
    "total_prepared": 51.2,
    "total_requested": 64,
    "total_shortage": 12.8,
    "generated_bls": [],
    "mission_id": 22,
    "warehouse_transfer": null
  }
}
```

**Side effects (no shortage):**
- BP → `completed_full`
- The mission's BLs → `ready`
- Warehouse Transfer created — `status: pending`, items only. **No stock is moved yet** — the
  CENTRAL→VAN movement only happens once the rider accepts (Module 15 §12c). Mission → `ready`
  (ready for the rider, not yet "transfer executed")
- `PreparationCompletedEvent` fired

**Side effects (with shortage):**
- BP → `completed_partial`, `warehouse_transfer` is `null` — **the mission and its BLs stay
  exactly where they were** (`in_preparation`/`batched`) — not `ready`. No transfer is created
  until the shortage is fully resolved
- Dispatcher must run shortage review/balance actions (§10 of Module 15) — once resolved
  (`accept_partial_preparation`'s auto-chained split, or `request_rework` →
  `continue_preparation` reaching `completed_full`), the WT is generated at that point instead,
  same `pending`/no-stock-movement-yet semantics as above

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
| `rejection_reason` | yes | `string` | Detailed rejection reason — send it top-level, exactly as shown above; `MagasinierController::rejectBp()` wraps it into `metadata.rejection_reason` internally before dispatching the decision |

**Response `200`:** (verified live against `RejectPreparationDecision::doExecute()`)
```json
{
  "success": true,
  "message": "Decision executed successfully",
  "decision": "reject_preparation",
  "output": {
    "bp_id": 88,
    "bp_number": "LODA000-A01-000088",
    "status": "rejected",
    "rejected_at": "2026-06-15T14:00:00Z",
    "message": "Preparation rejected successfully"
  }
}
```

**Side effects:** (changed with the mission migration — there is no more BCH to revert). All of
the below happens inside a single `DB::transaction()` — atomic, all-or-nothing, confirmed
QA-validatable as a single all-or-nothing rollback (`app/Decisions/Warehouse/RejectPreparationDecision.php:60-114`):
- BP → `rejected` — **kept in DB for audit trail, never deleted**
- The mission reverts → `draft`
- The mission's BLs revert → `draft`
- The orders (BCs) that fed those BLs are **not** released back to "Commandes en attente" — they
  stay tied to the same mission/BLs (same driver/vehicle assignment). This is a deliberate,
  re-submittable state, not a full rollback (compare `cancel_delivery_mission`, Module 15, which
  does fully release orders) — the dispatcher sees the mission flip back to `draft` in their
  workspace, fixes the issue (e.g. corrects a reference or note), then re-runs
  `confirm_delivery_mission` (Module 15 §8.2), which re-allocates stock and generates a brand-new
  BP for the magasinier.

---

### 6.7 Report Shortage (explicit)

`POST /backend/workflow/bon-preparation/{id}/execute` with `decision: "report_shortage"`

An alternative, more granular way to declare a shortage mid-pick — rather than waiting until
[Complete Preparation](#65-complete-preparation), the Magasinier can report a shortage on
specific lines as soon as it's discovered. BP must be `pending` or `in_progress`.

> **Not a prerequisite for `complete_preparation`.** These are two independent ways to surface a
> shortage, not a two-step sequence — calling `report_shortage` immediately jumps the BP to
> `awaiting_shortage_review` (skipping `completed_partial`/`review_partial_preparation`
> entirely), so it should only be used when the magasinier wants to escalate to the dispatcher
> **before** finishing the rest of the pick (e.g. a critical/perishable item is definitely
> unavailable). If the magasinier just wants to finish picking and report the shortfall at the
> end, call `complete_preparation` ([§6.5](#65-complete-preparation)) directly with the lower
> quantity — no need to call this first.

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

**Request body note:** send `shortage_items` nested under top-level `metadata` exactly as in the
curl example above. (**Fixed 2026-06-23** — the decision used to read this field from the wrong
place internally and would silently see an empty list when sent this way; sending it correctly
now actually works end-to-end, verified live.)

**Response `200`:** (corrected 2026-06-23 — the response payload is under **`output`**, not
`data`, matching every other decision in this doc)
```json
{
  "success": true,
  "message": "Decision executed successfully",
  "decision": "report_shortage",
  "output": {
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

**Request body note:** send `additional_items` nested under top-level `metadata` exactly as in
the curl example above. (Same fix as §6.7.)

> **Fixed 2026-06-23 — this decision was completely broken until today**, two separate bugs deep:
> (1) the `additional_items` payload-key bug above meant the request body was silently ignored
> (`no_additional_items` validation failure); (2) once that was fixed, the stock movement it logs
> used `type: "preparation_continued"`, a value that **isn't in `stock_movements`' CHECK
> constraint** (allowed: `purchase`/`sale`/`transfer_in`/`transfer_out`/`adjustment`/
> `reservation`/`release`/`reservation_release`/`return`/`cancellation`) — every call threw a
> Postgres constraint violation. Now uses `type: "sale"`, the same type `DeductStockAction` uses
> for the equivalent normal-preparation deduction. Verified live end-to-end (rework → continue →
> `completed_full`).

**Response `200`:** (corrected 2026-06-23 — payload is under **`output`**, not `data`)
```json
{
  "success": true,
  "message": "Decision executed successfully",
  "decision": "continue_preparation",
  "output": {
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
    "warehouse_transfer": null,
    "message": "Additional items prepared - shortage reduced but still exists"
  }
}
```

> **New 2026-06-23 — `warehouse_transfer`.** When `is_now_complete: true` (shortage fully
> reworked away), the mission's BLs move to `ready` and a Warehouse Transfer is generated here
> — `status: pending`, same no-stock-movement-yet semantics as [§6.5](#65-complete-preparation).
> Stays `null` if the rework still leaves a shortage (`bp_status` still `completed_partial`).

`bp_status` resolves to `completed_full` if shortage reaches zero, otherwise stays `completed_partial`.

---

### 6.9 Print / Download BP PDF

See [Module 15 §12e — Document Printing & PDF Generation](15-dispatcher.md#12e-document-printing--pdf-generation) for the full spec (endpoint, query params, cache TTL, version-control gap).

**Quick reference for the Magasinier "Print BP" button:**

```
GET /api/backend/documents/bp/{id}           → inline (opens in browser tab)
GET /api/backend/documents/bp/{id}/download  → attachment (save to disk)
```

- `{id}` is the numeric **preparation order ID** (not the `bp_number` string).
- Always append `?force=1` immediately after any `complete_preparation` or
  `continue_preparation` call to flush the cache and get a PDF reflecting the final
  `prepared_quantity` values. Without this, the cached PDF from earlier in the preparation
  flow may still be served.
- `?prices=0` hides unit prices and totals — useful for the warehouse physical copy.
- `?watermark=DRAFT` while the BP is still `in_progress`; no watermark when `completed_full`.

**No batch print endpoint exists** — to print all BLs for a mission, see Module 15 §12e.

---

## 7. Batch Picking

> ⚠️ **Orphaned/legacy feature — not part of the current mission pipeline.** This whole
> subsystem (`GeneratePickingListDecision`/`CompleteBatchPickingDecision`, modelType
> `batch-picking-session`, table `batch_picking_sessions`) operates **directly on raw
> `DeliveryNote` status** (`DRAFT`/`GROUPED` — `GROUPED` is itself a deprecated `BlStatus`
> value), completely bypassing the Delivery Mission / BP pipeline described in §2. It was
> **not touched, fixed, or removed** in the 2026-06-22 mission-migration cleanup — it still
> exists in code and is technically callable, but a BL that's actually tied to a mission will
> be in status `draft`/`confirmed`/`batched`, not `DRAFT`/`GROUPED` as this flow expects, and
> the `BatchPickingSession` it creates has **zero connection to `PreparationOrder` or
> `DeliveryMission`** — completing one does not advance any mission or BP. Do not build new UI
> against this without confirming with backend first; it may be removed in a future cleanup.

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

## 9. Conventional Loading

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

## 10. Conventional Décharge Reconciliation (EOD Van → Depot)

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

## 11. Décharge — Van → Depot Unloading

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

## 12. Returns Processing

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

## 13. Generic Workflow Utility Endpoints

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

## 14. Error Handling

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

## 15. TypeScript Interfaces

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

interface DeliveryMissionRef {
  id: number;
  mission_number: string;
  status: string;
  rider?: { id: number; name: string } | null;
  delivery_notes?: Array<{ id: number; delivery_number: string; status: string; partner?: { id: number; name: string } }>;
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
  delivery_mission?: DeliveryMissionRef | null;
  items?: PreparationOrderItem[];
  created_at: string;
}

// ─── Warehouse Transfer (auto-created by complete_preparation) ────────────────

interface WarehouseTransferItem {
  id: number;
  product_id: number;
  product_name?: string | null;
  requested_quantity: number;
  transferred_quantity: number;
  sales_group_code?: string | null;
}

interface WarehouseTransfer {
  id: number;
  transfer_number: string;
  status: 'pending' | 'accepted' | 'completed' | 'rejected' | 'validated';
  delivery_mission_id: number;
  rider_id: number;
  from_warehouse: string;
  to_warehouse: string;
  items?: WarehouseTransferItem[];
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

interface MagasinierDashboard {
  pendingPreparations: number;
  inProgress: number;
  completedToday: number;
  lowStockItems: number;
  pendingBps: Array<{
    id: number;
    bp_number: string;
    status: BpStatus;
    delivery_mission?: DeliveryMissionRef | null;
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

## 16. End-to-End Workflow Examples

### Example A — Standard Preparation (No Shortage)

Upstream (Module 15 — Dispatcher, not repeated in depth here): a dispatcher drags confirmed
BCs into a mission (`create_delivery_mission`) and confirms it (`confirm_delivery_mission`) —
that single atomic call reserves stock for every BL and generates the BP the magasinier
picks up below.

```bash
# Step 1: Magasinier checks pending BPs
curl "https://api.omni360.cloud/api/backend/magasinier/preparations/pending?scope=active" \
  -H "Authorization: Bearer {TOKEN}"
# → bp_id: 88, status: "pending", delivery_mission: {id: 22, mission_number: "MSN-20260622-0003"}

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
# → BP: "in_progress", mission's BLs: "in_preparation"

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
# → output.status: "completed_full"
# → mission's BLs: "ready"
# → output.warehouse_transfer: {id: 3, transfer_number: "WT-2026-00003", from_warehouse: "A0001-PFZ0", to_warehouse: "A0001-VAN-MERC-01", ...}
#   (auto-created CENTRAL→VAN transfer — no separate dispatcher step)
# → output.stock_deducted: 0 — no physical deduction here, the reservation made when the
#   mission was confirmed carries through to the warehouse transfer instead
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
# → output.status: "completed_partial"
# → output.warehouse_transfer: null — no transfer until the shortage is resolved

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

> ⚠️ See the orphaned-feature warning in [§7](#7-batch-picking) — this example is kept for
> reference but this flow is disconnected from the current mission/BP pipeline.

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

> ⚠️ See the gap note in [§2](#2-warehouse-pipeline-overview) — there is currently no
> mission-based trigger that *creates* a décharge. This example assumes one already exists
> (created some other way) and shows the still-working approval side only.

```bash
# Assume décharge #9 already exists (status: pending) — see the gap note above for how it
# would have been created in the old (now-removed) BCH-based flow

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
`config/decisions.php`,
`routes/backend.php`, `routes/api.php`, `app/Models/PartnerReturn.php`,
`app/Models/ReturnItem.php`, `app/Models/UnloadOrder.php`, `app/Models/Stock.php`,
`database/migrations/2026_07_01_000003_drop_legacy_return_tables.php`,
`app/Models/PreparationOrder.php`, `app/Services/Dispatcher/BlAllocationService.php`,
`app/Services/Dispatcher/MissionPreparationGeneratorService.php`,
`app/Services/Delivery/DeliveryLocationResolver.php`,
`app/Services/WarehouseTransferService.php`, `app/Decisions/Dispatcher/AcceptPartialPreparationDecision.php`,
`app/Decisions/Dispatcher/RequestReworkDecision.php`, `app/Decisions/Dispatcher/ReviewPartialPreparationDecision.php`,
`app/Decisions/Dispatcher/SplitRemainingQuantityDecision.php`, `app/Http/Controllers/Backend/WarehouseTransferController.php`,
`app/Models/DeliveryMission.php`, `database/migrations/2026_07_20_110000_widen_delivery_missions_status_column.php`,
`docs/modules/planning_refactor_schema.md`*

*Last updated: 2026-06-24 — three bugs in the magasinier preparation flow found and fixed during deep audit:*
1. *`start_preparation` — mission BLs were never moved to `in_preparation` (§6.3 side effects).
   `$bp->deliveryNotes` resolves via the dropped `preparation_delivery_notes` pivot (always empty
   for mission BPs). Fixed to use `$bp->deliveryMission->deliveryNotes()` directly (same pattern
   already used in `complete_preparation`). BL-status filter in `complete_preparation` (§6.5),
   `continue_preparation` (§6.8), and `split_remaining_quantity` (Module 15 §10) updated to accept
   `in_preparation` as well as `batched` so they remain correct after BLs enter that status.*
2. *`continue_preparation` (§6.8) — stock arithmetic error: decremented `reserved_quantity` by the
   additional rework quantity. Rework picks from **un-reserved** available stock that arrived after
   the original `confirm_delivery_mission` allocation — `reserved_quantity` must remain unchanged;
   only `quantity` and the derived `available_quantity` are updated.*
3. *`continue_preparation` (§6.8) — never traced back to `delivery_note_items.prepared_quantity`
   after updating the BP item. This meant `createFromMission()` would build the WT with the old
   partial amount (written by `complete_preparation`) instead of the rework-corrected total. Fixed
   with the same `delivery_note_item_id → DeliveryNoteItem::update(['prepared_quantity' => …])`
   write that `complete_preparation` already performs.*

*Last updated: 2026-06-23 (newest pass) — `split_remaining_quantity` (Module 15 §10) no longer
auto-decides which BL loses stock on a shortage — the dispatcher must now arbitrate manually via
`accept_partial_preparation`'s `metadata.allocations`. Doesn't change any magasinier-facing
endpoint directly, but updated the §2 pipeline diagram since the `shortage_split_done` step is
no longer a silent system decision. See Module 15's changelog for full detail.

*Last updated: 2026-06-23 (latest pass) — new explicit mission status
`awaiting_shortage_review` (§2): a `completed_partial` BP now atomically blocks its mission in
this status instead of silently leaving it at `in_preparation` — the mission can't reach
`ready` until the dispatcher arbitrates. `request_rework` moves it back to `in_preparation`;
a `continue_preparation` attempt still left short loops it back to
`awaiting_shortage_review`. Required widening `delivery_missions.status` from `varchar(20)` to
`varchar(40)`. Verified live across the full state machine.

*Last updated: 2026-06-23 (second pass) — fixed the Mission-Ready/Warehouse-Transfer timing
(§2, §6.5, §6.8): a shortage BP used to still advance the mission's BLs to `ready`
unconditionally (no guard on `completed_full` vs `completed_partial`); and the real stock
movement (CENTRAL availability → VAN) used to execute immediately when the WT was created — i.e.
the moment the magasinier finished picking, not when the rider actually accepted the mission. Both
fixed: BLs/WT now only advance on `completed_full` (or once a shortage is resolved via
`accept_partial_preparation`/`continue_preparation`), and the WT is created `pending` with the
real stock movement deferred to `POST /backend/dispatcher/warehouse-transfers/{id}/accept`
(Module 15 §12c) — the rider's explicit "accept" action. Verified live end-to-end.

*Last updated: 2026-06-23 (first pass) — audited and fixed the full dispatcher↔magasinier shortage-resolution
flow (§2, §6.5, §6.7, §6.8): `completed_partial` was unreachable (a guard required
`report_shortage` first, but `report_shortage` itself skips past `completed_partial`);
`accept_partial_preparation` crashed every time via its `split_remaining_quantity` auto-chain
(dead `logisticsBatch`/`bonChargement` relations); 4 decisions
(`accept_partial_preparation`/`request_rework`/`report_shortage`/`continue_preparation`) silently
ignored their `metadata`-nested payload fields; `continue_preparation`'s stock movement violated
a CHECK constraint on every call. All fixed and verified live end-to-end. See the inline
"Fixed 2026-06-23" callouts for full detail.

*Previous update: 2026-06-22 — full rewrite for the BC → DeliveryMission architecture migration.
The old BC → DO → LOT → BP → BCH pipeline is removed; `shipments`, `delivery_orders`,
`logistics_batches` are dropped. `start_preparation`/`update_preparation`/`complete_preparation`/
`reject_preparation`/`continue_preparation` now operate against a mission-linked BP
(`PreparationOrder.deliveryMission`, not the removed `bonChargement`/`logisticsBatch`
relations) — several of these decisions had crashed on the dead relations until that fix.
`allocate_delivery_note` and `generate_preparation_for_mission` are removed entirely, folded
into `confirm_delivery_mission`'s atomic execution (Module 15). `complete_preparation` now
auto-creates the CENTRAL→VAN warehouse transfer. The "BC → BP Exception Flow" section is
removed (feature deleted). Depot/stock lookups now correctly resolve the branch's real
sellable PFZ0 zone instead of an empty placeholder "DEPOT" location. The "Batch Picking"
section (§7) is flagged as an orphaned, pre-mission-pipeline feature.*
