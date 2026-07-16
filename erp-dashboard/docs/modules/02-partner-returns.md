# Partner Returns & Logistics — Operations Guide

## Overview

The Partner Returns module handles all return flows in the Omni360 SFA/ERP system. It supports two distinct return types, each with its own state machine, and integrates with the multi-branch stock ledger for cold-chain optimization.

**Key Principle:** Zero hardcoded roles. All behavior is driven by `ParameterService` (branch-level config) and `AccessProfile.settings` (user-level config).

---

## 1. Return Types

### 1.1 Commercial Return (`type = 'commercial'`)

**Who initiates:** Vendeur, Prévendeur, Gros Prévendeur (during a partner visit)  
**Trigger:** Partner has damaged, expired, or disputed products to return  
**Approval:** Required — routed dynamically via `returns.required_approval_level`

```
State Machine:
┌─────────────────────────────┐
│ PENDING_DIRECTION_APPROVAL  │ ← Created by commercial user
└──────────┬──────────────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
 APPROVED     REJECTED (terminal)
     │
     ▼
 ASSIGNED_TO_DRIVER  ← Collect_Return_Stock action generated
     │
     ▼
 COLLECTED  ← Driver confirms pickup (BR document signed)
     │
     ▼
 RECEIVED_AT_WAREHOUSE  ← Magasinier confirms physical receipt
     │
     ▼
 CLOSED (terminal, immutable)
```

### 1.2 Immediate Return (`type = 'immediate'`)

**Who initiates:** Livreur (Delivery Driver) during delivery  
**Trigger:** Client refuses delivery (closed, dispute, wrong product)  
**Approval:** NONE — executes instantly for field safety

```
State Machine:
┌───────────┐
│ IMMEDIATE │ ← Created by driver on refusal
└─────┬─────┘
      │
      ▼
 ROLLED_BACK  ← Stock credited back to Van Warehouse
      │
      ▼
 RECONCILED (terminal)  ← EOD discharge completes
```

---

## 2. Access Control Matrix

Access is governed by `$user->accessProfile->getSetting('mobile.profile.kind')`:

| Profile Kind | Commercial Return | Immediate Return | Cross-Branch Discharge |
|---|:---:|:---:|:---:|
| `VAN_SALES` | ✅ | ✅ | Via ParameterService |
| `ORDER_TAKING` | ✅ | ❌ | ❌ |
| `DELIVERY` | ❌ | ✅ | Via ParameterService |
| `WHOLESALE_PRESALES` | ✅ | ❌ | ❌ |
| `COLLECTOR` | ❌ | ❌ | ❌ |

---

## 3. Approval Workflow Configuration

### 3.1 Setting the Required Approval Level

The approval gate is 100% dynamic. Configure it per branch/company:

```sql
-- Set required approval level for a specific branch
INSERT INTO configuration_settings (configurable_type, configurable_id, key, value, type)
VALUES ('App\Models\Branch', 1, 'returns.required_approval_level', 'FINANCE', 'string');

-- Or set company-wide default
INSERT INTO configuration_settings (configurable_type, configurable_id, key, value, type)
VALUES ('App\Models\Company', 1, 'returns.required_approval_level', 'COMMERCIAL_DIRECTOR', 'string');
```

**Available levels (hierarchy):**

| Level | Rank | Typical Role |
|---|:---:|---|
| `ZONE` | 1 | Chef de Zone (CDZ) |
| `FINANCE` | 2 | Responsable Administratif et Financier (RAF) |
| `COMMERCIAL_DIRECTOR` | 3 | Directeur Commercial |
| `GLOBAL_DIRECTION` | 4 | Direction Générale |

**Rule:** The approver's `workflow.approval.level` must be **≥** the branch's `returns.required_approval_level`.

### 3.2 Assigning Approval Authority to a User

Set the user's approval level in their AccessProfile settings:

```sql
-- Give a user FINANCE-level approval authority
UPDATE access_profiles
SET settings = jsonb_set(
    settings,
    '{workflow,approval,level}',
    '"FINANCE"'
)
WHERE id = :access_profile_id;
```

Or via the AccessProfile settings JSON structure:

```json
{
  "mobile": { "profile": { "kind": "VAN_SALES", "tag": "van_sales", "label": "..." } },
  "workflow": {
    "approval": {
      "level": "FINANCE"
    }
  }
}
```

### 3.3 Switching Approval Power Between Roles

To switch a branch from CDZ approval to RAF approval — **zero code changes**:

```sql
-- Before: CDZ approves (ZONE level)
UPDATE configuration_settings
SET value = 'ZONE'
WHERE configurable_type = 'App\Models\Branch'
  AND configurable_id = :branch_id
  AND key = 'returns.required_approval_level';

-- After: RAF approves (FINANCE level)
UPDATE configuration_settings
SET value = 'FINANCE'
WHERE configurable_type = 'App\Models\Branch'
  AND configurable_id = :branch_id
  AND key = 'returns.required_approval_level';
```

---

## 4. Configuration Parameters

All parameters are resolved via `ParameterService` with branch/company/global fallback:

| Key | Type | Default | Description |
|---|---|---|---|
| `returns.required_approval_level` | string | `ZONE` | Minimum approval authority for commercial returns |
| `returns.collection_horizon_days` | integer | `7` | Days to look ahead for auto-assigning collection to a driver |
| `logistics.allow_cross_branch_discharge` | boolean | `false` | Enable cross-branch stock discharge at EOD |
| `logistics.cold_chain_distance_threshold_km` | integer | `100` | Distance (km) beyond which cold chain products discharge locally |

### Setting Parameters

```sql
-- Enable cross-branch discharge for a specific branch
INSERT INTO configuration_settings (configurable_type, configurable_id, key, value, type)
VALUES ('App\Models\Branch', :branch_id, 'logistics.allow_cross_branch_discharge', 'true', 'boolean');

-- Set cold chain threshold to 50km for strict branches
INSERT INTO configuration_settings (configurable_type, configurable_id, key, value, type)
VALUES ('App\Models\Branch', :branch_id, 'logistics.cold_chain_distance_threshold_km', '50', 'integer');
```

---

## 5. Process Flows (Step by Step)

### 5.1 Commercial Return Flow

```
1. COMMERCIAL USER creates return during partner visit
   → POST /api/v2/returns/commercial
   → Status: PENDING_DIRECTION_APPROVAL
   → Return number generated: RR-{branch_code}-{sequence}

2. SUPERVISOR approves (or rejects)
   → POST /api/v2/returns/{id}/approve
   → System checks: approver.workflow.approval.level >= branch.returns.required_approval_level
   → Status: APPROVED
   → BR document (Bon de Retour) generated in 2 copies

3. SYSTEM auto-assigns to driver
   → Looks for partner's next delivery route within `returns.collection_horizon_days`
   → Creates Collect_Return_Stock action
   → Status: ASSIGNED_TO_DRIVER
   → If no scheduled route is found within the horizon: stays APPROVED,
     `metadata.requires_manual_assignment = true` — a coordinator must call
     `POST /api/v2/returns/{id}/assign` with a `driver_id` (see §7 and §13).

4. DRIVER confirms collection at partner site
   → POST /api/v2/returns/{id}/collect
   → Both BR copies must be signed (driver + partner stamp)
   → Status: COLLECTED
   → ⚠️ DISPATCHER HARD LOCK: driver blocked from new missions until warehouse receipt

5. MAGASINIER confirms warehouse receipt
   → POST /api/v2/returns/{id}/receive
   → Physical verification against stamped BR document (Copy 2)
   → Status: RECEIVED_AT_WAREHOUSE
   → Dispatcher lock released

6. SYSTEM closes the return
   → POST /api/v2/returns/{id}/close
   → Status: CLOSED (immutable)
```

### 5.2 Immediate Return Flow

```
1. DRIVER records delivery refusal at client site
   → POST /api/v2/returns/immediate
   → GPS coordinates captured automatically
   → Status: IMMEDIATE
   → NO approval required

2. SYSTEM executes Rollback_To_Van_Stock (instant)
   → StockMovement type='return' credits driver's Van Warehouse
   → Each refused product quantity restored to van inventory
   → Status: ROLLED_BACK

3. END-OF-DAY: Driver initiates session discharge
   → BranchDischargeService evaluates discharge eligibility
   → Cold chain products prioritized for local discharge
   → Stock debited from van, credited to target warehouse
   → InterBranchTransfer created if cross-branch
   → Status: RECONCILED
```

### 5.3 Cold Chain Discharge Decision

```
EOD Discharge Initiated
    │
    ▼
logistics.allow_cross_branch_discharge enabled?
    │
    ├── NO → Discharge to HOME branch warehouse
    │         (cold_chain_risk_alert if frozen/chilled products present)
    │
    └── YES → Driver at home branch?
                │
                ├── YES → Discharge to HOME branch warehouse
                │
                └── NO → Distance to home > threshold?
                           │
                           ├── YES → Discharge to LOCAL branch warehouse
                           │         (InterBranchTransfer created)
                           │         (cold_chain_preserved = true if CHILLED/FROZEN)
                           │
                           └── NO → Discharge to HOME branch warehouse
```

---

## 6. Stock Ledger Mechanics

### 6.1 Rollback to Van Stock (Immediate Return)

When a driver records a refusal:

```
Van Warehouse (driver's vehicle):
  Product A: stock_before=45 → CREDIT +5 → stock_after=50
  Product B: stock_before=20 → CREDIT +3 → stock_after=23

StockMovement records:
  type='return', direction=credit, source_system='MOBILE'
  reference_type='App\Models\PartnerReturn', reference_id={return_id}
  period_id={active_period}
```

### 6.2 Discharge to Warehouse (EOD)

When the driver offloads at end of day:

```
Van Warehouse → DEBIT (decrease)
Central Warehouse → CREDIT (increase)

Both movements in a SINGLE transaction (atomic).
If debit would result in negative stock → stock_insufficient error → full rollback.

For cold chain products (CHILLED/FROZEN):
  notes = {"cold_chain_preserved": true}
```

### 6.3 Cross-Branch Discharge

When driver discharges to a branch different from home:

```
1. StockMovement: DEBIT from Van Warehouse (home branch)
2. StockMovement: CREDIT to Central Warehouse (local branch)
3. InterBranchTransfer record created:
   - source_branch_id = driver's home branch
   - destination_branch_id = local branch
   - status = 'pending'
   - period_id = active period
   - notes = {return_activity_id, cold_chain, discharge_reason}
```

---

## 7. API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v2/returns/commercial` | Create commercial return |
| POST | `/api/v2/returns/immediate` | Create immediate return |
| POST | `/api/v2/returns/{id}/approve` | Approve a pending return — also attempts auto-assignment (see §13) |
| POST | `/api/v2/returns/{id}/reject` | Reject a pending return |
| POST | `/api/v2/returns/{id}/assign` | **New (§13)** — manually assign an `APPROVED` return to a driver when auto-assignment couldn't find a route. Body: `{"driver_id": int}`. |
| POST | `/api/v2/returns/{id}/collect` | Confirm driver collection |
| POST | `/api/v2/returns/{id}/receive` | Confirm warehouse receipt |
| POST | `/api/v2/returns/{id}/close` | Close a return |
| GET | `/api/v2/returns/{id}/audit` | Full audit trail |
| GET | `/api/v2/returns/forms/commercial` | SUI form schema |
| GET | `/api/v2/returns/forms/immediate` | SUI form schema |
| GET | `/api/v2/returns/forms/collection` | SUI form schema |

---

## 8. Valid Return Reasons

### Commercial Returns
| Code | Description |
|---|---|
| `DAMAGED` | Produit endommagé |
| `PRICING_ERROR` | Erreur de prix |
| `COMMERCIAL_RETURN` | Retour commercial (accord) |
| `EXPIRED` | Produit expiré |
| `QUALITY_ISSUE` | Problème qualité |

### Immediate Returns (Field Refusal)
| Code | Description |
|---|---|
| `CLIENT_CLOSED` | Client fermé |
| `CLIENT_REFUSED` | Client refuse la livraison |
| `PARTIAL_REFUSAL` | Refus partiel (certains articles) |
| `DISPUTE` | Litige commercial |
| `WRONG_DELIVERY` | Erreur de livraison |

---

## 9. Database Schema

### partner_returns

```sql
partner_returns (
  id, return_number, return_type, status,
  partner_id, delivery_note_id, branch_id, period_id,
  initiated_by, approved_by, assigned_driver_id, work_session_id,
  return_reason, approval_timestamp, rejection_reason,
  collection_timestamp, warehouse_receipt_timestamp,
  gps_latitude, gps_longitude, notes, metadata,
  created_at, updated_at
)

Indexes:
  idx_partner_returns_status (status, branch_id)
  idx_partner_returns_partner (partner_id, status)
  idx_partner_returns_period (period_id)
  idx_partner_returns_driver (assigned_driver_id, status)
```

### return_items

```sql
return_items (
  id, partner_return_id, product_id, delivery_note_item_id,
  return_quantity, delivered_quantity, condition, reason,
  unit_price, total_value, cold_chain_product, storage_class,
  photo_references, notes, created_at, updated_at
)
```

---

## 10. Configuration Examples

### Example 1: Enable full cross-branch cold chain optimization for Casablanca

```sql
-- Enable cross-branch discharge
INSERT INTO configuration_settings (configurable_type, configurable_id, key, value, type)
VALUES ('App\Models\Branch', 1, 'logistics.allow_cross_branch_discharge', 'true', 'boolean');

-- Set aggressive cold chain threshold (50km)
INSERT INTO configuration_settings (configurable_type, configurable_id, key, value, type)
VALUES ('App\Models\Branch', 1, 'logistics.cold_chain_distance_threshold_km', '50', 'integer');
```

### Example 2: Require Directeur Commercial approval for returns in strict branches

```sql
INSERT INTO configuration_settings (configurable_type, configurable_id, key, value, type)
VALUES ('App\Models\Branch', 2, 'returns.required_approval_level', 'COMMERCIAL_DIRECTOR', 'string');
```

### Example 3: Give a CDZ user approval authority

```sql
UPDATE access_profiles
SET settings = jsonb_set(
    COALESCE(settings, '{}'),
    '{workflow,approval,level}',
    '"ZONE"'
)
WHERE id = :cdz_profile_id;
```

### Example 4: Give a RAF user higher approval authority

```sql
UPDATE access_profiles
SET settings = jsonb_set(
    COALESCE(settings, '{}'),
    '{workflow,approval,level}',
    '"FINANCE"'
)
WHERE id = :raf_profile_id;
```

### Example 5: Check which users can approve returns for a branch

```sql
SELECT u.id, u.name, ap.name AS profile_name,
       ap.settings->'workflow'->'approval'->>'level' AS approval_level
FROM users u
JOIN access_profiles ap ON ap.id = u.access_profile_id
WHERE u.branch_id = :branch_id
  AND ap.settings->'workflow'->'approval'->>'level' IS NOT NULL;
```

### Example 6: Query all pending returns awaiting approval

```sql
SELECT pr.id, pr.return_number, pr.partner_id, p.name AS partner_name,
       pr.return_reason, pr.created_at,
       u.name AS initiated_by_name
FROM partner_returns pr
JOIN partners p ON p.id = pr.partner_id
JOIN users u ON u.id = pr.initiated_by
WHERE pr.status = 'PENDING_DIRECTION_APPROVAL'
  AND pr.branch_id = :branch_id
ORDER BY pr.created_at ASC;
```

### Example 7: Query returns in transit (COLLECTED, not yet received)

```sql
SELECT pr.id, pr.return_number, pr.assigned_driver_id,
       u.name AS driver_name,
       pr.collection_timestamp,
       EXTRACT(EPOCH FROM (NOW() - pr.collection_timestamp)) / 3600 AS hours_in_transit
FROM partner_returns pr
JOIN users u ON u.id = pr.assigned_driver_id
WHERE pr.status = 'COLLECTED'
  AND pr.branch_id = :branch_id
ORDER BY pr.collection_timestamp ASC;
```

---

## 11. Operational Constraints (Hard Locks)

| Constraint | Behavior |
|---|---|
| Driver has COLLECTED returns | Dispatcher BLOCKED from assigning new routes |
| Previous session un-discharged | Driver BLOCKED from next-day dispatch |
| Return quantity > delivered quantity | Validation error (422) |
| Period closed | Return creation rejected |
| Insufficient approval authority | Approval rejected (403) |
| Document signatures missing | Collection confirmation blocked |
| Stock insufficient for debit | Transaction rolled back |

---

## 12. Audit Trail

Every state transition, stock movement, and discharge decision is recorded:

```
GET /api/v2/returns/{id}/audit?period_id=5

Response:
{
  "data": {
    "return_id": 42,
    "return_number": "RR-CASA-000123",
    "current_status": "CLOSED",
    "timeline": [
      { "type": "state_transition", "event": "created", "timestamp": "..." },
      { "type": "state_transition", "event": "approved", "timestamp": "..." },
      { "type": "stock_movement", "movement_type": "return", "quantity": 5, ... },
      { "type": "inter_branch_transfer", "status": "completed", ... }
    ]
  }
}
```

---

## 13. Deep Review — 2026-07-16 (production readiness)

This doc described §5.1 step 3 and §6.1 as if they always worked. They didn't.
Both are fixed now, verified end-to-end in staging; the third finding below
(avoir financier) is a real gap that is **not** fixed — flagged, not silently
patched, because closing it is a product decision (see §13.3).

### 13.1 Commercial returns could never leave `APPROVED` — fixed

`ReturnActivityService::assignToDriver()` (the method that performs the
`APPROVED → ASSIGNED_TO_DRIVER` transition described in §5.1 step 3) has
always existed and worked correctly — but **nothing ever called it**. The two
services meant to invoke it automatically after approval
(`CollectionActionService`, `CollectReturnStockService` — near-duplicates)
were never wired into `PartnerReturnController::approve()` or anywhere else.
Every commercial return that got approved was **permanently stuck at
`APPROVED`** — `collect`/`receive`/`close` were unreachable, and so was the
whole downstream warehouse pipeline.

Fixed: `PartnerReturnController::approve()` now calls
`CollectReturnStockService::generateCollectionAction()` immediately after a
successful approval (kept the more complete of the two duplicate services —
richer audit logging, returns full action details; deleted the other,
`CollectionActionService`, confirmed zero other callers). If the partner has
a scheduled itinerary/driver within `returns.collection_horizon_days`, the
return auto-advances to `ASSIGNED_TO_DRIVER`. If not, it stays `APPROVED`
with `metadata.requires_manual_assignment = true` — the pre-existing,
correctly-implemented fallback path, which previously had **no way to ever
be resolved** either. New endpoint `POST /api/v2/returns/{id}/assign` (§7)
closes that gap: a coordinator picks a driver by hand.

Verified live in staging: created a commercial return → approved →
correctly flagged `requires_manual_assignment` (no scheduled route for the
test partner) → manually assigned via the new endpoint → collected →
received at warehouse → closed. Full lifecycle, first time this has ever
completed end-to-end.

### 13.2 Immediate returns never rolled back van stock — fixed

§5.2 step 2 and §6.1 describe `Rollback_To_Van_Stock` as running
automatically the instant an immediate return is created. In the actual
code, `ReturnActivityService::createImmediateReturn()` — the method backing
the live `POST /api/v2/returns/immediate` endpoint — never called
`StockLedgerService::rollbackToVanStock()` at all. The only caller of that
method was `DeliveryRefusalHandler`, a bridge class with **zero callers
anywhere in the codebase** (no controller, listener, or decision invokes
it). Net effect: every immediate return created through the live mobile
endpoint stayed at status `IMMEDIATE` forever, and the driver's van stock
never reflected the refusal — a silent, growing drift between the ledger and
physical reality.

Fixed: `createImmediateReturn()` now calls `rollbackToVanStock()` itself,
inside the same DB transaction as the return's creation — atomic, all or
nothing. The return comes back from the create call already in
`ROLLED_BACK` status (not `IMMEDIATE`) since the rollback is no longer a
separate step. `DeliveryRefusalHandler` (still unwired — no delivery-refusal
UI/decision calls it yet) was updated to stop calling `rollbackToVanStock()`
a second time, since it would now throw (the status guard rejects a second
call once already `ROLLED_BACK`).

Verified live in staging: created an immediate return for a driver with a
real van warehouse → returned status was `ROLLED_BACK` (not `IMMEDIATE`) →
van stock for the returned product went `0 → 8` → a `StockMovement`
(`type=return`) recorded against the return, matching §6.1 exactly.

### 13.3 Avoir financier — NOT connected to PartnerReturn (flagged, not fixed)

Approving/closing a `PartnerReturn` does **not** create a `CustomerAvoir`
(store credit) or any other financial credit. There is no code path from
this module into the credit system at all. The only automatic
avoir-from-return mechanism that exists in the codebase
(`AvoirService::createFromReturn()`) is typed against a **different,
legacy** model, `ProductReturn` (POS counter-return flow,
`app/Services/ProductReturnService.php` — a third, separate return
subsystem from a different domain, not part of this module).

This is a real product gap, not a bug with an obvious one-line fix: closing
it requires deciding *when* the credit should be issued (on `APPROVED`? On
`CLOSED`, after physical receipt confirms the goods are actually back?),
*how much* (full line value? does `condition = damaged/expired` reduce or
zero out the credit?), and whether ADV/finance needs to review before the
credit is usable. None of that is specified anywhere in this document or the
code, so nothing was implemented here — flagging it explicitly rather than
guessing at the business rule. If/when this is scoped, the natural place to
wire it is `ReturnActivityService::confirmWarehouseReceipt()` or `close()`,
calling into `AvoirService` with `source_type = RETURN` and a new
`PartnerReturn`-typed source relation (`CustomerAvoir::source_return_id`
currently has no FK constraint and points at `ProductReturn` — it would need
a second nullable FK or a polymorphic relation to support both).

### 13.4 Mobile app — no UI exists for any of this

Separately from the backend fixes above: the SFA mobile app
(`sfa/omni360_mobile`) has **no screen, no API call, and no offline table**
for creating a customer return at all — commercial, immediate, or otherwise.
A salesperson cannot declare a return from the field today; the backend
capability described in this whole document has no client. This is a
substantial, multi-screen frontend feature (form, SUI screens or native
screens per the app's hybrid architecture, offline sync, navigation entry
point from the partner detail screen) — out of scope for this backend fix
pass, called out here so it isn't assumed to already exist.

### 13.5 Legacy return systems — do not confuse with this module

Three other, unrelated "return" subsystems exist in this codebase and
partially overlap in naming:
- **`BonRetour`/`ReturnOrder`/`ReturnRequest`/`ReturnMission`** — an older,
  parallel B2B return system. Its tables (`return_orders`, `return_requests`,
  `return_missions`) were dropped by
  `2026_07_01_000003_drop_legacy_return_tables.php`, but the controllers,
  service, decisions, and routes referencing them are **still registered**
  and would throw `SQLSTATE 42P01`/`42703` if actually called. Investigated
  during this review but **left in place** — several live, unrelated
  features (`WarehouseTransferService`, `WarehouseTransferController`,
  `AppServiceProvider`'s `BonRetourItem` observer, `Customer`/`Shop`
  relations) still reference these same models, so a clean removal needs a
  dedicated audit of its own, not a side-effect of this task.
- **`ProductReturn`** (POS counter/cashier returns, `routes/pos.php`,
  `ProductReturnController`) — a live, routed, **separate** subsystem for
  in-store checkout returns. Also references a dropped table
  (`product_returns`) and would currently fail if exercised — a real bug,
  but in the POS domain, out of scope here.
- **This module (`PartnerReturn`/`ReturnItem`, `/api/v2/returns/*`)** is the
  live system for salesperson/driver field returns — the one this whole
  document is about, and the only one with a working (now fully-reachable)
  state machine end to end.
