# Rider Loading-Time Shortage Engine — Technical Specification (FROZEN ROADMAP)

> **Status: SPEC FROZEN, NOT IMPLEMENTED.** This document is the signed-off, locked blueprint
> for the dedicated sprint covering Case 2 (total rider shortage at loading) and Case 3 (partial
> rider shortage at loading). §7's four product questions were resolved and signed off on
> 2026-06-17 — see §7 below for the locked decisions. Nothing in §3-§6 is implemented yet; do
> not build against this doc as if the endpoints exist. See Module 15 (`15-dispatcher.md`) and
> Module 16 (`16-magasinier.md`) for what's actually live today.
>
> **Companion fix already shipped and harmonized with this spec** (same date): Case 1 —
> warehouse shortage backlog re-injection — is live, and as of the second pass on 2026-06-17
> now uses the **same "BC Child" mechanism** locked in for Cases 2/3 below (§7, point 4): a new
> `Order` (`bc_status: confirmed`) via `App\Services\Warehouse\ShortageBacklogService`, landing
> in Workspace 1 (`GET /backend/dispatcher/orders/pending`) — not a draft BL. See
> `16-magasinier.md` for the shipped Case 1 detail. §5 below should reuse
> `ShortageBacklogService::createBacklogOrders()` rather than building a second, parallel
> backlog-creation code path.

---

## 1. Problem statement

Today, loading confirmation (`ConfirmLoadingDecision`, `app/Decisions/Dispatcher/ConfirmLoadingDecision.php`)
is **dispatcher-only** and takes **no quantity input at all** — it just flips `Shipment.status`
`pending|prepared → confirmed` and every attached BL to `in_transit`, locking quantities
(`is_quantity_locked = true`). There is no point in the pipeline where a rider reports what they
actually loaded onto the truck. If a product is missing or damaged at the picking zone, the
system has no way to record that — the BCH proceeds to `in_transit` carrying quantities that may
not physically be on the vehicle, which is exactly the stock/invoicing integrity risk flagged in
the audit.

## 2. Real status ground truth (verified, not invented)

`Shipment.status` is a **plain string column, no enum/cast**. Current check-constraint values
(`database/migrations/2026_05_19_185136_add_closed_status_to_shipments_check_constraint.php:20-31`):

```
pending, in_preparation, prepared, confirmed, ready, loaded, in_transit, completed, closed, cancelled
```

> ⚠️ **Doc inconsistency found while researching this spec**: `15-dispatcher.md` §3's BCH status
> table lists `validated` (not real) and is missing `confirmed`/`ready`/`closed` (which are real).
> That table needs a separate correction pass — flagged here, not fixed in this doc to avoid
> scope creep; track as a small follow-up.

`loaded` **already exists** as a real status value but nothing currently sets it (per the earlier
audit: no `MarkBchLoaded*` class exists). The natural fit for "rider has loaded and confirmed
quantities" is to make the rider-facing flow transition into this **existing** `loaded` status
— not invent a new one — sitting between `confirmed` (current dispatcher gate) and `in_transit`.

New statuses actually needed (additive, not replacing real ones):
- `loaded_with_discrepancy` — rider loaded, but reported quantities differ from prepared. Sits
  parallel to `loaded`; both are valid predecessors of `in_transit`.
- (No new status needed for the "total shortage" case — it's `loaded_with_discrepancy` with one
  line's `loaded_quantity = 0`, handled by the same mechanism as a partial discrepancy of 100%.)

This **replaces** the `SHORTAGE_REVIEW`/`SEALED_WITH_DISCREPANCY` names floated in the original
audit request — those didn't match any real naming convention in the codebase (all real BCH
statuses are lowercase snake_case strings, no `BchStatus` enum class exists to attach constants
to). `loaded_with_discrepancy` follows the same lowercase-snake_case convention as every real
value above.

## 3. Database changes

### 3.1 `delivery_note_items` — new column

```php
// migration: add_loaded_quantity_to_delivery_note_items_table
Schema::table('delivery_note_items', function (Blueprint $table) {
    $table->decimal('loaded_quantity', 16, 3)->nullable()->after('prepared_quantity');
});
```

Fits the existing quantity-column sequence (`ordered_quantity` → `allocated_quantity` →
`prepared_quantity` → **`loaded_quantity`** → `delivered_quantity`/`refused_quantity`). Nullable:
`null` means "not yet loading-confirmed by a rider" (distinguishes from `0`, which means
"rider confirmed zero loaded" — Case 2).

**Important**: `DeliveryNoteItem::LOCKED_FIELDS` (`app/Models/DeliveryNoteItem.php:15-17`)
currently includes `prepared_quantity` and is enforced once `is_quantity_locked = true`, which
`ConfirmLoadingDecision` sets at the SAME moment as the `confirmed` transition. The new rider
flow must run **before** that lock is set, or `loaded_quantity` must be explicitly excluded from
`LOCKED_FIELDS` — recommend re-ordering so `is_quantity_locked` is only set once the rider
loading-confirmation step completes (whether clean, partial, or zero), not at the dispatcher's
`confirm_loading` step. This is a real sequencing change to `ConfirmLoadingDecision`, not just
an additive one — flag for design review before sprint planning, since it shifts what "locked"
means in the existing flow.

### 3.2 `shipments` — no new columns needed

`status` already accepts the new string value (it's an unconstrained-by-enum column; only the
Postgres CHECK constraint enumerates allowed values, so that constraint needs one more value
added via migration):

```php
// migration: add_loaded_with_discrepancy_to_shipments_check_constraint
// mirrors the pattern of 2026_05_19_185136_add_closed_status_to_shipments_check_constraint.php
```

## 4. New endpoint

```
POST /api/rider/bch/{bchId}/loading-confirmation
```

Placed in `routes/api.php`, inside the existing rider group (`auth:sanctum` +
`checkApiPermission:driver`), matching the real convention found at `routes/api.php:336-360`
(`{bchId}` param name, `idempotency.required` middleware on the route):

```php
Route::post('/bch/{bchId}/loading-confirmation', [RiderController::class, 'confirmLoading'])
    ->middleware('idempotency.required');
```

**Request body:**
```json
{
  "items": [
    { "delivery_note_item_id": 2001, "loaded_quantity": 20 },
    { "delivery_note_item_id": 2002, "loaded_quantity": 8 }
  ],
  "notes": "Carton Edam Cheese manquant — entrepôt confirme rupture"
}
```

| Field | Required | Type | Description |
|---|---|---|---|
| `items` | yes | array | One entry per `delivery_note_item` the rider is confirming. Items not listed default to `loaded_quantity = prepared_quantity` (assume fully loaded unless the rider says otherwise) — confirm this default with product before building; the alternative is requiring every line explicitly, which is safer but more friction on the PDA. |
| `items[].delivery_note_item_id` | yes | number | Must belong to a BL attached to this BCH |
| `items[].loaded_quantity` | yes | number, ≥0 | What the rider physically loaded. `0` = Case 2 (total shortage for that line). `< prepared_quantity` = Case 3 (partial). |
| `notes` | no | string | Free text, e.g. damage/shortage reason |

**Guard conditions (new decision, `RiderConfirmBchLoadingDecision` or similar, `modelType: 'bon-chargement'`):**
- `Shipment.status` must be `confirmed` (the state `ConfirmLoadingDecision` already produces) — i.e. this is the NEXT step after dispatcher confirmation, not a replacement for it.
- `Shipment.rider_id` must equal the authenticated rider (`auth()->id()`) — riders can only confirm their own BCH.
- Every `delivery_note_item_id` in the payload must belong to a BL attached to this BCH (reject cross-BCH item ids).
- `loaded_quantity` must not exceed `prepared_quantity` for that line (riders can't load more than what was prepared).

## 5. Service: `BlQuantityReconciliationService` (new)

```php
namespace App\Services\Dispatch;

class BlQuantityReconciliationService
{
    /**
     * @param  array<int,float>  $loadedQuantitiesByItemId  delivery_note_item_id => loaded_quantity
     * @return array{
     *   has_discrepancy: bool,
     *   total_truncated: float,
     *   truncated_lines: array<int,array{delivery_note_item_id:int,prepared:float,loaded:float,delta:float}>,
     * }
     */
    public function reconcile(Shipment $bch, array $loadedQuantitiesByItemId, ?string $notes = null): array;
}
```

Responsibilities (within one `DB::transaction`):
1. For each line, set `DeliveryNoteItem.loaded_quantity`.
2. Where `loaded_quantity < prepared_quantity`: this is the cascade point. **Reuse the now-shipped
   `App\Services\Warehouse\ShortageBacklogService::createBacklogOrders()`** (§7.4 — locked
   decision, harmonized with Case 1) — do **not** build a separate backorder-BL or
   backorder-Order path. Build the `{order_id, product_id, quantity, unit_price}` shortage-line
   array from each truncated `DeliveryNoteItem` (via its parent `DeliveryNote->order_id`) in the
   exact shape `SplitRemainingQuantityDecision::doExecute()` already builds (`app/Decisions/
   Dispatcher/SplitRemainingQuantityDecision.php`), then call the same service method. This is
   the only way both Case 1 (warehouse) and Cases 2/3 (rider) shortages land in the same
   Workspace 1 pool without diverging into two parallel backlog mechanisms.
3. Release the corresponding reserved stock delta (mirror `SplitRemainingQuantityDecision.php`'s
   stock-release block, lines ~119-137 post-fix — **use `branch_id`, not `branch_code`**, per the
   bug already found and fixed in that file).
4. Set `Shipment.status = 'loaded'` if no discrepancy, else `'loaded_with_discrepancy'`.
5. Dispatch `RiderLoadingDiscrepancyReportedEvent($bch->id, $truncatedLines, $actorId)` if any
   discrepancy — follows the `...Event` + past-participle convention of `LoadingConfirmedEvent`/
   `ShortageReportedEvent`/`RemainingQuantitySplitEvent`. Per §7.4, this event is also the trigger
   point for the dispatcher dashboard alert (mechanism TBD at sprint kickoff — a listener on this
   event, not new logic inside this service).

## 6. Dispatcher resolution step (new decision)

```
ResolveBchLoadingDiscrepancyDecision  (model: bon-chargement, decision key: resolve_loading_discrepancy)
allowedFromStates: ['loaded_with_discrepancy']
```

Mirrors `AcceptPartialPreparationDecision`'s acknowledge-and-proceed shape: dispatcher reviews
the rider-reported gap (already cascaded into a backorder BL + released stock by step 5 above —
this decision is acknowledgment/sign-off, not the truncation itself), then transitions
`Shipment.status: loaded_with_discrepancy → in_transit`. No "inter-truck transfer" sub-flow in
v1 — if that's needed, scope it as a v2 addition once the base discrepancy flow is proven; don't
build it speculatively now.

## 7. Product/design decisions — SIGNED OFF 2026-06-17

These four points were open questions in the first pass of this spec; all four are now locked.
Build against these, not the superseded options.

### 7.1 Default loading quantity — **Hybrid / pre-filled**

Rows are pre-filled with the prepared quantity (assume fully loaded) so the rider doesn't have
to re-type every line on the PDA. The rider only touches a line to explicitly edit it when
reporting a shortage or discrepancy. Implication for §4's request body: `items[]` should be
**pre-populated client-side from the BCH's prepared quantities** (fetched via the existing
`GET /rider/bch/{bchId}/preview`, `routes/api.php:340`) and only the **edited** lines need to
differ from `prepared_quantity` when submitted — but the API contract stays "send the full set
you're confirming," since the backend has no reason to special-case "untouched" vs. "confirmed
unchanged" rows. The hybrid behavior is a **client-side UX convenience**, not a server-side
default-inference rule — this resolves §4's original open question about whether the server
should assume missing lines are fully loaded: **no, the client always sends every line**,
pre-filled by the UI.

### 7.2 Quantity-lock timing — **Exclusion model**

`ConfirmLoadingDecision` is **not** touched. `loaded_quantity` is added to `DeliveryNoteItem`
but **excluded from `LOCKED_FIELDS`** (`app/Models/DeliveryNoteItem.php:15-17`), so the existing
dispatcher-confirm-then-lock flow keeps working exactly as today, and the new rider endpoint can
still write `loaded_quantity` on an otherwise-locked BL item after `is_quantity_locked = true`.
Trade-off accepted: "locked" no longer means "fully immutable" — `loaded_quantity` is the one
deliberate exception, documented at the `LOCKED_FIELDS` declaration when built.

### 7.3 Offline support — **Mandatory, architecturally load-bearing**

Ground-floor depot loading has unreliable connectivity. The mobile/PDA client **must** persist
loading-confirmation adjustments locally and sync via a deferred state queue (store-and-forward),
not assume a live connection at confirmation time. This is **not** an optional nice-to-have —
factor the offline-queue + conflict-resolution design into the sprint estimate from day one, not
as a stretch goal. Concretely: the single `idempotency.required` middleware (request-level,
online-only semantics) is insufficient on its own — the offline queue needs its own
client-generated idempotency key per queued adjustment, generated at capture time (not at sync
time), so a re-sent queued item after a dropped connection doesn't double-apply. Coordinate the
exact queue/conflict design with mobile team before estimating; this doc does not lock that
sub-design yet — flag as a follow-up spec once mobile scopes their local-storage approach.

### 7.4 Shortage destination — **Alert + BC Child, harmonized with Case 1**

A rider-reported shortage does two things simultaneously:
1. **Immediate dispatcher dashboard alert** — a notification flag surfaces on the dispatcher
   dashboard the moment `BlQuantityReconciliationService::reconcile()` (§5) detects a
   discrepancy, since this is discovered *after* warehouse execution and needs visibility faster
   than passively waiting for Workspace 1 polling.
2. **Backlog re-injection as a BC Child** — same mechanism as Case 1 (§1 of this doc, now
   shipped): the missing delta becomes a new `Order` (`bc_status: confirmed`) via
   `ShortageBacklogService::createBacklogOrders()`, landing in Workspace 1. **Do not build a
   second backlog-creation path** — `BlQuantityReconciliationService` (§5) should call the
   existing `ShortageBacklogService`, passing `delivery_note_item`-derived shortage lines through
   the same `{order_id, product_id, quantity, unit_price}` shape `SplitRemainingQuantityDecision`
   already uses.

The new dispatcher-alert mechanism (point 1) is **not yet designed** — this spec locks *that it
must exist*, not its implementation (notification table? broadcast event? polling flag on
`Shipment`?). Scope that as part of sprint kickoff, not assumed-trivial.

## 8. Out of scope for this spec (confirmed absent, not addressed here)

- Inter-truck stock transfer (mentioned in the original Case 2 ask) — no existing model/table
  for "move N units from BCH-A to BCH-B mid-route." Would need its own spec if prioritized.
- Any change to `DeliveryOrderLoadEstimationService`/`VolumetricDispatchGate` (Module 15 §16) —
  those run pre-dispatch, unrelated to this post-loading flow.
