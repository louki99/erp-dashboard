# Module 23 — Audit Trail & Traceability (`logs` schema)

*Created: 2026-07-17 — infrastructure/security deep dive ahead of the production `db:fresh`.*

## 1. Why a dedicated `logs` schema

Audit/traceability tables were living in `public` alongside transactional business tables (orders, products), which pollutes backup/replication scope and VACUUM scheduling for what is, by nature, append-heavy write traffic that's rarely read.

**Final 5-table "AI-ready master source"** (Idris's spec, 2026-07-17 follow-up, migration `2026_07_30_000000_finalize_logs_schema_ai_ready_tables`):

| Table | What it is | Model |
|---|---|---|
| `logs.activity_logs` | **The main table** — `App\Traits\Auditable`'s table, renamed from `audit_logs`. Model lifecycle audit trail (created/updated/deleted/restored), `correlation_id`/`user_role`/`action_intent`, `old_values`/`new_values` as `jsonb` | `App\Models\AuditLog` (class name kept — see note below) |
| `logs.wms_audit_logs` | Append-only WMS Tier 2/3 audit trail (emplacement movements, lot assignments) — see [Module 22](22-stock-wms.md). Already had `reason_code` NOT NULL + `stock_batch_id`/`quantity` before this pass, no change needed | `App\Models\WmsAuditLog` |
| `logs.system_anomalies` | **New.** Business-rule rejections / error conditions (e.g. `WMS_INVALID_BATCH`) for monitoring/prediction | `App\Models\SystemAnomaly` |
| `logs.ai_interactions` | **New.** Audits the AI itself — prompt/response/feedback | `App\Models\AiInteraction` |
| `logs.sync_history` | **New.** Offline-first field sync tracking (device_id, captured_at, synced_at) | `App\Models\SyncHistory` |

Plus one legacy table kept for historical reads only: `logs.audit_field_changes` (former `TracksFieldChanges` table — see §3.1, nothing new written there since 2026-07-17).

**Explicitly NOT moved**: `partner_credit_history`, `payment_transfer_history`, `credit_events`, `shortage_history`, and ~20 other tables with "log"/"history"/"audit" in their name — these are business/financial data, not technical traceability, and moving them risked breaking reports/joins that expect them in `public`. Full inventory of what was considered and excluded is in the `2026_07_29_000000` migration's docblock.

**Why `App\Models\AuditLog` keeps its class name despite the table becoming `activity_logs`**: the class is used directly (bypassing the `Auditable` trait) in ~26 files spanning Treasury, Returns, BC approval, invoice generation, stock deduction, and more. Renaming the PHP class would touch all of them for zero functional gain — Eloquent already fully abstracts the table name, so every one of those call sites kept working unchanged once `$table` was repointed. The table name is what matters for the "AI-ready master source" framing; the class name doesn't leak into the schema.

**New columns on `activity_logs`** (all nullable, backward compatible with the 26 existing writers that don't set them):
- `correlation_id` (uuid) — groups every row written during the same HTTP request/job. Auto-populated from an incoming `X-Correlation-Id`/`X-Request-Id` header, or a UUID generated once per request otherwise (`Auditable::getAuditCorrelationId()`).
- `user_role` (string) — same value as the existing `user_type` column, kept alongside it for naming consistency with the new schema (didn't rename `user_type` — it's read by existing consumers).
- `action_intent` (string) — short structured label distinct from `description` (a full sentence). Defaults to the raw event name (`created`/`updated`/...); override `Auditable::getAuditActionIntent()` per model, or pass `'action_intent' => '...'` to `logAuditEvent()`'s `$metadata`, for something more specific (e.g. `PARTNER_BLOCK`).

## 2. ⚠️ Prior art — why this migration never touches `search_path`

This codebase already tried a multi-schema layout once: `2026_06_25_200000_create_pos_schema_and_move_tables.php` created a `pos` schema and set `search_path = 'pos,public'` for a dedicated connection. The result, documented directly in that migration's own comments: **any later migration that didn't explicitly pin its own search_path got silently routed into `pos` instead of `public`** — this misplaced ~25 unrelated tables (including `wms_audit_logs` and reporting tables) for over two weeks before two cleanup migrations (`2026_07_03_001611_move_treasury_tables_from_pos_to_public_schema`, `2026_07_03_181522_move_erp_core_tables_from_pos_to_public_schema`) moved everything back.

The one schema that *did* work reliably is `routings` (`2026_06_28_195123_create_routings_schema.php`) — because every reference to it, in migrations and in the one model that uses it, is **always explicitly schema-qualified** (`routings.routing_batches`), never relying on `search_path` order.

`2026_07_29_000000_create_logs_schema_and_move_audit_tables` follows the `routings` pattern exactly:
- `config/database.php`'s `search_path` is **untouched** (`'public,pos'`, same as before).
- Every model touching a moved table sets `protected $table = 'logs.<name>'` explicitly (`AuditLog`, `AuditFieldChange`, `WmsAuditLog`, `WmsExpiryAlertLog`).
- The one raw-query caller (`ExpiryAlertService::emitAlert()`) uses `DB::table('logs.wms_expiry_alert_log')` explicitly.

Nothing here depends on schema resolution order — the exact class of bug that broke `pos` cannot recur.

Verified end-to-end in a disposable staging DB before being applied to the dev DB: schema created, all 4 tables moved, `audit_level` column present, gating logic exercised at all 3 levels, `ExpiryAlertService`'s raw query confirmed reaching the moved table (FK constraint check succeeded against a real row), no data loss (all pre-existing `audit_logs` rows survived the move on the real dev DB).

## 3. The audit gating engine — `audit.level`

Before this change, `App\Traits\Auditable` unconditionally logged every create/update/delete/restore on every model that used it, with full old/new value diffs and IP/UA/URL/route/method every time. `config('audit.level')` / `AUDIT_LEVEL` env now gates that:

| Level | What gets logged | Payload |
|---|---|---|
| `standard` | Only `deleted` events (+ anything written via `logAuditEvent()` directly, e.g. auth failures — always logged regardless of level) | Light: description only, no old/new values, no IP/UA/request context |
| `medium` (**default**) | `standard` + `created`/`updated`/`restored` on every Auditable model | Who did what, when — still no old/new values or request context by default |
| `advanced` | Everything at `medium`, plus full `old_values`/`new_values` diff on every event, plus `ip_address`/`user_agent`/`url`/`route`/`method` | Full forensic capture — this is exactly what the trait did unconditionally before this change |

**Per-field override — `$watchedFields`**: a model can declare `protected static array $watchedFields = ['status', 'credit_limit', ...]`. Changes to those specific fields **always** get full old/new value capture, regardless of the active level (but request context — IP/UA — is still `advanced`-only). This is how `Partner` (`status`, `blocked_until`, `block_reason`, `allocation_priority`, `min_allocation_pct`) and `Invoice` (`status`, `total_amount`, `paid_amount`, `remaining_amount`, `is_locked`) keep precise tracking of their sensitive fields at any level.

### 3.1 Consolidation — `TracksFieldChanges` retired

Before this change, `Partner` and `Invoice` used **two separate audit pipelines** simultaneously: `Auditable` (→ `audit_logs`) and `TracksFieldChanges` (→ `audit_field_changes`) — a `status` change was written to both tables independently, with no dedup. `TracksFieldChanges` is now removed from both models; its `$watchedFields` concept was folded directly into `Auditable` (§3, above). `logs.audit_field_changes` and `App\Models\AuditFieldChange` are kept for historical reads (nothing new is written there going forward).

### 3.2 Extending audit coverage to a new model

```php
use App\Traits\Auditable;

class YourModel extends Model
{
    use Auditable;

    // Optional — fields that always get full old/new capture regardless of audit.level
    protected static array $watchedFields = ['status', 'amount'];
}
```

That's it — `created`/`updated`/`deleted`/`restored` are automatically wired via the trait's boot method.

## 4. Auth-failure logging

`App\Http\Controllers\Backend\Auth\LoginController::login()` now writes an `AuditLog` row (`event: 'auth_failed'`, `audit_level: 'standard'`) directly (not via the queued `ProcessAuditLog` path — a failed login has no committed transaction to defer past) whenever backend credentials are rejected, capturing the attempted email, IP, and user-agent. This is always written regardless of the configured `audit.level`, matching the STANDARD tier's explicit inclusion of security-critical events.

## 5. Admin API — Activity Logs console

`App\Http\Controllers\Backend\AuditLogController`, gated by the new `browse-audit-logs` permission (`root`, `admin` by default — see `DynamicRbacPermissionsSeeder`).

### `GET /api/backend/admin/logs/activities`

| Query param | Type | Notes |
|---|---|---|
| `user_id` | int | Exact match on the acting user |
| `entity_type` | string | Partial match on `auditable_type` — e.g. `Order` matches `App\Models\Order` |
| `action` | string | Matches `event` — `created`/`updated`/`deleted`/`restored`/`auth_failed`/whatever a `logAuditEvent()` call used (not a fixed enum) |
| `audit_level` | string | `standard`/`medium`/`advanced` |
| `date_from`, `date_to` | date | Both required together, filters `created_at` |
| `per_page` | int | Capped at 100 |

Response: standard Laravel paginator wrapping `AuditLog` rows (with `user:id,name,email` eager-loaded).

**Example** (captured against the dev DB):

```json
{
  "success": true,
  "data": {
    "current_page": 1,
    "data": [
      {
        "id": 14,
        "auditable_type": "App\\Models\\Partner",
        "auditable_id": 1,
        "event": "deleted",
        "audit_level": "standard",
        "user_id": 2,
        "old_values": null,
        "new_values": null,
        "description": "Partner 'Test Delete Partner' was deleted",
        "created_at": "2026-07-17T17:03:12.000000Z",
        "user": { "id": 2, "name": "Admin", "email": "admin@foodsolution.ma" }
      }
    ],
    "total": 14,
    "per_page": 20
  }
}
```

### `GET /api/backend/admin/logs/activities/{id}`

Full row (including `old_values`/`new_values` when populated) plus a pre-built `diff` array for the frontend's comparison component:

```json
{
  "success": true,
  "data": { "...": "full AuditLog row" },
  "diff": [
    { "attribute": "status", "old": "ACTIVE", "new": "ON_HOLD" }
  ]
}
```

## 6. The 3 new tables — wiring status

`SystemAnomaly`, `AiInteraction`, `SyncHistory` (§1) all follow the same append-only convention as `AuditLog`/`WmsAuditLog` (`const UPDATED_AT = null`, `$fillable`-driven, schema-qualified `$table`).

### 6.1 `SystemAnomaly` — wired (2026-07-17, migration `2026_07_30_000000`, commit follow-up)

Idris's explicit spec: "give the AI fuel on the Supply Chain side," scoped **only** to two triggers (not every WMS/business-rule failure):

| Trigger | error_code | error_severity | Hook point |
|---|---|---|---|
| WMS batch rejection | `WMS_INVALID_BATCH` | `WARNING` | `App\Exceptions\Handler::register()` — a `reportable(function (InvalidBatchException $e) {...})` closure. `reportable()` is a pure side effect (doesn't touch the JSON response already built by `render()`'s existing `WmsException` branch), scoped to this one exception subclass rather than the generic `WmsException` base, matching "uniquement" in the spec. `reference_type` = `App\Models\StockBatch::class`, `reference_id` = the batch id, `context_payload` = `$e->toArray()` (batch_id/batch_number/reason). |
| Vehicle overload (volume or weight) | `ROUTE_OVERLOAD` (new code, didn't exist before) | `CRITICAL` | `App\Services\Dispatcher\VehicleCapacityService::buildResult()` — the single private method both `check()` and `checkFromOrderIds()` funnel through, right after `$overloadedVolume`/`$overloadedWeight` are computed. Fires whenever either is true. `reference_type` = `App\Models\Vehicle::class`, `context_payload` captures the full volume/weight totals vs. effective capacity plus concurrent mission ids. |

Both verified end-to-end against the real dev DB: the `InvalidBatchException` case by throwing it through Laravel's actual `ExceptionHandler::report()` pipeline and confirming the row; the `ROUTE_OVERLOAD` case by invoking `buildResult()` with forced-overload inputs via reflection (real vehicle/product overload data wasn't available in the dev DB at verification time — no vehicle had `capacity_volume` populated yet). Both test rows were deleted after verification.

## 7. Admin console API — advanced search, export, settings, purge (2026-07-17, migration `2026_07_31_000000`)

Built for the UI team's monitoring screens. All routes sit under `/api/backend/admin/logs/*`, inside the `backend.` route-name prefix (so full route names are e.g. `backend.admin.logs.activities.index`).

### 7.1 Advanced search — `GET /admin/logs/activities` (extended)

On top of the existing filters (§5), four new ones:

| Param | Behavior |
|---|---|
| `user_role` | Exact match on `activity_logs.user_role`. |
| `module_context` | Coarse module label (`wms`, `sales`, `dispatch`, `finance`, `partners`, `rbac`, ...) — **not a DB column**. Derived at query time from `auditable_type` via `config('audit.module_map')`, a static FQCN → module array. Extend that map as more models adopt `Auditable`; a model not listed just won't match any `module_context` filter (still returned unfiltered). |
| `changed_field` | jsonb key-existence search on `old_values`/`new_values` — e.g. `?changed_field=total_weight_kg` finds every row where that key appears in the before/after diff. Implemented as `jsonb_exists(old_values, ?)` (a function call, not the native `?` operator — Postgres's `?` jsonb operator collides with PDO's positional-bind placeholder syntax in Laravel's query builder, so `jsonb_exists()` is used instead; behaviorally identical). Backed by two GIN indexes (`activity_logs_old_values_gin_idx`, `activity_logs_new_values_gin_idx`, migration `2026_07_31_000000`) so this doesn't degrade to a seq scan as the table grows. |
| `correlation_id` | **Trace/correlation viewer.** Every row written during the same HTTP request/job shares one `correlation_id` (§1). When this param is present, the endpoint switches mode: returns the full causal chain in chronological order (oldest first), **unpaginated**, capped at 500 rows — the "extract the whole tree in one request" behavior asked for — instead of the normal `latest()`-ordered paginator. |

`error_code` is deliberately **not** a filter here — it doesn't exist on `activity_logs` (it's a `system_anomalies` column). Anomaly search is a separate endpoint (§7.2) rather than a unified feed, since the two tables have different shapes (event/old-new-diff vs error_code/severity) and different audiences (security/compliance vs ops/supply-chain).

### 7.2 Anomaly search — `GET /admin/logs/anomalies`, `GET /admin/logs/anomalies/{id}`

New `SystemAnomalyLogController`, same `browse-audit-logs` permission. Filters: `error_code`, `error_severity` (WARNING/CRITICAL), `source` (wms/dispatcher/...), `reference_type` (partial match), `user_id`, `date_from`/`date_to`, `per_page` (capped at 100).

### 7.3 Export — `POST /admin/logs/export/download`, `GET /admin/logs/export/download/{filename}`

```json
// POST body
{ "date_from": "2026-06-01", "date_to": "2026-07-01", "source": "activities", "module_context": "wms", "format": "csv" }
```
`source`: `activities` (default) or `anomalies`. `format`: `csv` (default) or `json`. `date_to` must be ≥ `date_from`; range capped at `config('audit.export.max_range_days')` (default 366 days).

Response is **not** the file itself — it's a download link (shape depends on the disk, see below):
```json
{ "success": true, "data": { "filename": "activities_export_<uuid>.zip", "download_url": "http://minio:9000/loggers/log-exports/activities_export_<uuid>.zip?X-Amz-Signature=...", "expires_in_hours": 24 } }
```

Mechanics (`App\Services\Logs\LogExportService`, first `ZipArchive` usage in this codebase):
1. Streams the matching rows (`cursor()`, not `get()` — avoids loading a large export fully into memory) into a temp CSV/JSON file, zips it, stores it on `config('audit.export.disk')`.
2. **Disk-aware download link (`LogExportService::downloadUrl()`)** — this is the important part for Prod:
   - **`AUDIT_EXPORT_DISK=minio_logs`** (default — Idris's infra review, 2026-07-17): a **dedicated MinIO disk** (`config/filesystems.php`), pointed at its own bucket (`MINIO_LOGS_BUCKET`, default `loggers`) — deliberately **isolated from the `minio` disk's `omni360-dms` bucket** (DMS documents), same MinIO server/credentials otherwise, so log exports don't share lifecycle/retention/access policy with document management files. The download link is a **direct-to-bucket presigned URL** via `Storage::disk('minio_logs')->temporaryUrl()` — Laravel's S3 driver signs it natively (AWS SigV4), works unmodified against MinIO since it's S3-compatible (verified end-to-end: built a real zip, fetched the presigned URL with plain `curl`, got a valid archive back — `http://localhost:9000/loggers/log-exports/...?X-Amz-Signature=...` — and separately confirmed the file is invisible on the `minio`/`omni360-dms` disk, only visible on `minio_logs`/`loggers`, proving the isolation). The app server is **never in the download path** — no risk of a large admin export saturating local disk or app memory. `use_path_style_endpoint => true` on the `minio_logs` disk is required for this to work against MinIO (already set).
   - **`AUDIT_EXPORT_DISK=local`** (dev-only fallback, no MinIO required): the `local` driver has no native `temporaryUrl()` support, so `downloadUrl()` falls back to `URL::temporarySignedRoute()` (the same pattern `ConventionalInvoiceReceiptService` uses) pointing at `LogExportController::retrieve()`, which streams the file through the app. Fine at dev scale; must never be the disk in staging/Prod.
   - The branch is a simple `config("filesystems.disks.{$disk}.driver") === 's3'` check — no disk-name special-casing, so `s3` (the AWS disk) or `minio` (the DMS disk) would also get the direct-presigned-URL path if ever pointed at by `AUDIT_EXPORT_DISK` — but the isolated `minio_logs` disk is the intended default, not `minio`.
3. TTL either way = `config('audit.export.signed_url_ttl_hours')` (default 24h).
4. **Route-registration gotcha hit during build** (only relevant to the `local`-disk fallback path): `URL::temporarySignedRoute()` needs the route's *fully-qualified* name including the outer group's `backend.` prefix (`backend.admin.logs.export.retrieve`), not just `admin.logs.export.retrieve` — using the short name silently threw `RouteNotFoundException` at generation time.
5. **Middleware gotcha hit during build** (also `local`-fallback only, since the `minio_logs` path never touches this app's routes): the whole `backend.php` route file runs under `force.json` middleware, which unconditionally overwrites `Content-Type` to `application/json` on every response — this corrupted the binary zip download until fixed with `->withoutMiddleware('force.json')` on the retrieve route.
6. Files are swept regardless of whether they were ever downloaded by `logs:cleanup-exports` (new artisan command, scheduled hourly in `Kernel.php`), which deletes anything older than `config('audit.export.retention_hours')` (default 48h) — disk hygiene independent of the link's own (shorter) expiry. Works identically against `minio_logs` or `local` (`Storage::disk($disk)->files()`/`->delete()` are disk-agnostic).

### 7.4 Settings — `GET`/`PUT /admin/logs/settings`

Live-toggle `audit.level` (standard/medium/advanced) without a deploy/restart — e.g. bump to `advanced` during a fraud investigation, then back down. Gated by a new `manage-audit-settings` permission (root/admin).

Mechanics: `logs.audit_settings` is a single-row table (`id` pinned to 1 via a `CHECK` constraint), seeded from `env('AUDIT_LEVEL')` on migrate. `App\Services\Logs\AuditSettingsService` reads it through a 5-minute cache (`Cache::remember`), invalidated immediately on write (`Cache::forget`) so a `PUT` takes effect on the very next audit write, not after the TTL. `App\Traits\Auditable::currentAuditLevel()` now delegates to this service instead of reading `config('audit.level')` directly — the config value is still the bootstrap default (used to seed the row, and as a fallback if it's ever missing/invalid), not the live source of truth anymore.

```json
// GET
{ "success": true, "data": { "audit_level": "medium" } }
// PUT body: { "audit_level": "advanced" }
{ "success": true, "data": { "audit_level": "advanced", "updated_at": "2026-07-17T17:23:16.000000Z" } }
```

### 7.5 Purge — `POST /admin/logs/purge`

`root`-only (`purge-audit-logs` permission — there is no `superadmin` tier in this app's RBAC; `root` is the top role). **Archive-then-delete**, not a hard delete: reuses `LogExportService` to snapshot every matching row as a JSON zip archive *before* removing anything, and returns that archive's signed download link alongside the count — so a purge is never a one-way data-loss operation on its own.

```json
// POST body
{ "older_than_months": 12, "target": "all" }
```
`older_than_months` minimum 3 (guards against an accidental mass-purge of everything). `target`: `activities`, `anomalies`, or `all` (default). Response shape:
```json
{
  "success": true,
  "data": {
    "activities": { "purged_count": 4213, "archive": { "filename": "...", "download_url": "..." } },
    "anomalies":  { "purged_count": 187,  "archive": { "filename": "...", "download_url": "..." } }
  }
}
```
If a target has zero matching rows, its `archive` is `null` and `purged_count` is `0` — no empty archive is written.

All of §7 verified end-to-end against the real dev DB through Laravel's actual HTTP kernel (not just unit-level calls) — auth, `permission:` gating (confirmed a non-root `admin` user gets `403` on purge), the zip build/download round-trip (confirmed `Content-Type: application/zip` and a genuine 403 on a tampered filename), and the settings live-toggle. Test rows/tokens/files were all cleaned up after.

`sync_history` and `ai_interactions` remain intentionally unwired — see 6.2/6.3.

### 6.2 `AiInteraction` — intentionally empty

No AI-assisted client-side features are deployed yet. Leave empty until that Front work ships; it will populate naturally once it does. Not scheduled.

### 6.3 `SyncHistory` — intentionally deferred

Candidate write site: `sfa/omni360_mobile`'s offline-first sync engine, once its mobile sync workers are stabilized (next sprint per Idris, not yet scheduled). Schema/model are final; do not wire until asked.

`diff` is empty when the event has no `changed_attributes` (e.g. a `standard`-level delete, or a `medium`-level update where old/new weren't captured).
