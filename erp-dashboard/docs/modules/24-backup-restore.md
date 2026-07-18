# Module 24 — Manage Backup & Restore

*Created: 2026-07-18.*

Admin screen for full-database backup and restore, built on `spatie/laravel-backup` ^9.0 plus a thin custom layer for restore (the package itself has no restore command) and async status tracking.

## 1. Strategy

- **Scope: database only**, not application files. App files (invoices, DMS documents) already live in MinIO/DMS and don't need re-archiving here — this is a `pg_dump` of the whole Postgres database (every schema: `public`, `pos`, `logs`, ...), gzip-compressed, zipped by the package.
- **Storage**: a dedicated MinIO bucket, `minio_backups` disk (`config/filesystems.php`), isolated from the DMS documents bucket (`minio`) and the separate `logs.*` table snapshot backup (`minio_logs`, see `App\Console\Commands\BackupLogsToMinio` — a different, already-existing feature that only backs up the `logs.*` schema every 5 days). This module supersedes nothing; it's the general-purpose "back up and restore the whole database" tool.
- **Trigger model**: two ways to fire a backup — **on-demand** (`POST /admin/backups`, immediate) and **scheduled** (admin-configured, see §6 below). Scheduling is fully dynamic: no code change or redeploy is needed to add, change, or remove a fire time — it's config data (`backup_schedules` table) checked every minute by a cron'd command, the same pattern this app already uses for "Mission Vide" auto-planning (`mission_planning_templates` / `missions:trigger-planned`).
- **Execution model**: both **create** and **restore** run as **queued jobs** (`RunBackupJob`, `RunBackupRestoreJob`), never inline on the HTTP request — a full DB dump/restore can take minutes and would otherwise hit request timeouts. Each run is tracked as a `BackupOperation` row (`pending` → `running` → `completed`/`failed`); the UI polls `GET .../operations/{id}` until it leaves `pending`/`running`.
- **Restore is destructive by design**: the dump is generated with `pg_dump --clean --if-exists --no-owner --no-privileges` (`config/database.php`, `pgsql.dump`), so replaying it with `psql` **drops and recreates every object it contains** — a true overwrite of the live database, not a merge. There is no dry-run and no partial restore. Four ephemeral/operational tables (`sessions`, `personal_access_tokens`, `backup_operations`, `backup_schedules`) are excluded from the dump entirely (`pgsql.dump.exclude_tables`) — see §7.
- **The whole app goes into maintenance mode for the duration of a restore** (not just this admin screen) — every other route 503s until it finishes, precisely because the database underneath them is being actively dropped and recreated table by table. See §7 for the full mechanism and what the UI needs to do about it.
- **Permission tiers**: `browse-backups` / `create-backups` / `delete-backups` are `root` + `admin`. `restore-backups` is **`root`-only** (same tier as `purge-audit-logs`), plus every restore call requires a typed `"confirm": "RESTORE"` field in the request body as a second guard against a mis-click.
- **Retention**: no automatic cleanup is wired up yet — `config('backup.cleanup')` has spatie's default rotation strategy configured but nothing schedules `backup:clean`. Backups accumulate until manually deleted via `DELETE /admin/backups`. (Flag to the team if you want a scheduled `backup:clean` added — straightforward, just not requested yet.)

### Files, for backend reference

| File | Role |
|---|---|
| `config/backup.php` | spatie config — DB-only, `minio_backups` disk, gzip compressor |
| `config/filesystems.php` | `minio_backups` disk definition |
| `config/database.php` | `pgsql.dump.add_extra_option` (`--clean --if-exists` flags) + `pgsql.dump.exclude_tables` (§7) |
| `app/Services/Backup/BackupService.php` | list/download-url/delete/runBackup/runRestore + enterMaintenanceForRestore/exitMaintenanceIfWeOwnIt (§7) |
| `app/Http/Middleware/PreventRequestsDuringMaintenance.php` | `$except` — routes that stay reachable during a restore (§7) |
| `app/Jobs/RunBackupJob.php`, `RunBackupRestoreJob.php` | queued execution |
| `app/Models/BackupOperation.php` | status-tracking row (now also carries `backup_schedule_id` when auto-fired) |
| `app/Http/Controllers/Backend/BackupController.php` | the backup/restore API below (§3) |
| `app/Models/BackupSchedule.php` | admin-configured fire times — `shouldFireNow()`, `scheduleLabel()` |
| `app/Console/Commands/TriggerScheduledBackupsCommand.php` | `backups:trigger-scheduled`, runs every minute (`Kernel.php`) |
| `app/Http/Controllers/Backend/BackupScheduleController.php` | the schedule CRUD API (§6) |
| `app/Console/Commands/ReapStuckBackupOperationsCommand.php` | `backups:reap-stuck`, every 15 min — final safety net, see §3.1 |
| `BackupService::cancel()` / `BackupController::cancelOperation()` | admin "kill" action for a stuck/unwanted operation — see §8 |

## 2. Auth & base URL

All endpoints are under the `backend` route group: `auth:sanctum` bearer token required, plus the `permission:` middleware noted per endpoint. Same conventions as every other admin endpoint in this app (see `roles-permissions.md`).

Base URL used in examples below: `https://api.omni360.cloud/api/backend/admin/backups` — swap for your local/staging host.

## 3. Endpoints

### `GET /admin/backups` — list backups

Permission: `browse-backups`.

Returns every backup currently on disk, newest first, plus the 20 most recent operations (backup + restore runs) for a history/activity panel.

```bash
curl -X GET "https://api.omni360.cloud/api/backend/admin/backups" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Accept: application/json"
```

```json
{
  "success": true,
  "data": {
    "backups": [
      {
        "path": "omni360/2026-07-18-14-32-10.zip",
        "filename": "2026-07-18-14-32-10.zip",
        "size_bytes": 48213112,
        "created_at": "2026-07-18T14:32:10+00:00",
        "download_url": "https://minio.internal/db-backups/omni360/2026-07-18-14-32-10.zip?X-Amz-Signature=..."
      },
      {
        "path": "omni360/2026-07-13-03-00-05.zip",
        "filename": "2026-07-13-03-00-05.zip",
        "size_bytes": 47990211,
        "created_at": "2026-07-13T03:00:05+00:00",
        "download_url": "https://minio.internal/db-backups/omni360/2026-07-13-03-00-05.zip?X-Amz-Signature=..."
      }
    ],
    "recent_operations": [
      {
        "id": 14,
        "type": "backup",
        "status": "completed",
        "path": "omni360/2026-07-18-14-32-10.zip",
        "error": null,
        "started_at": "2026-07-18T14:32:01+00:00",
        "finished_at": "2026-07-18T14:32:10+00:00",
        "created_at": "2026-07-18T14:32:01+00:00"
      },
      {
        "id": 13,
        "type": "restore",
        "status": "failed",
        "path": "omni360/2026-07-12-09-00-00.zip",
        "error": "psql restore failed: relation \"orders\" does not exist...",
        "started_at": "2026-07-17T10:02:00+00:00",
        "finished_at": "2026-07-17T10:02:41+00:00",
        "created_at": "2026-07-17T10:01:58+00:00"
      }
    ]
  }
}
```

**UI notes:**
- `download_url` is already a ready-to-use link (presigned MinIO URL in prod, or a signed app route in local/dev without MinIO — the API abstracts the difference, the UI just needs `<a href="{download_url}">`). It expires in 24h; re-fetch `index` if the link has gone stale.
- `path` is the opaque identifier to send back on `destroy` and `restore` calls — don't try to construct it client-side, always use the value returned by this endpoint.
- Use `recent_operations` to render an activity log / show a spinner if the latest `backup`/`restore` op for a given `path` is still `pending`/`running`.

---

### `POST /admin/backups` — create a new backup

Permission: `create-backups`.

No request body. Enqueues the backup job and returns immediately (`202 Accepted`) with an `operation_id` to poll.

```bash
curl -X POST "https://api.omni360.cloud/api/backend/admin/backups" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Accept: application/json"
```

```json
{
  "success": true,
  "data": { "operation_id": 15 }
}
```

Status `202`. Poll `GET /admin/backups/operations/15` (below) until `status` is `completed` or `failed`, then call `GET /admin/backups` again to pick up the new file in the list.

---

### `GET /admin/backups/operations/{id}` — poll operation status

Permission: `browse-backups`.

```bash
curl -X GET "https://api.omni360.cloud/api/backend/admin/backups/operations/15" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Accept: application/json"
```

While running:
```json
{
  "success": true,
  "data": {
    "id": 15,
    "type": "backup",
    "status": "running",
    "disk": null,
    "path": null,
    "size_bytes": null,
    "initiated_by": 7,
    "error": null,
    "started_at": "2026-07-18T15:10:02.000000Z",
    "finished_at": null,
    "created_at": "2026-07-18T15:10:01.000000Z",
    "updated_at": "2026-07-18T15:10:02.000000Z"
  }
}
```

Once finished:
```json
{
  "success": true,
  "data": {
    "id": 15,
    "type": "backup",
    "status": "completed",
    "disk": "minio_backups",
    "path": "omni360/2026-07-18-15-10-09.zip",
    "size_bytes": 48311020,
    "initiated_by": 7,
    "error": null,
    "started_at": "2026-07-18T15:10:02.000000Z",
    "finished_at": "2026-07-18T15:10:09.000000Z",
    "created_at": "2026-07-18T15:10:01.000000Z",
    "updated_at": "2026-07-18T15:10:09.000000Z"
  }
}
```

Or, on failure:
```json
{
  "success": true,
  "data": {
    "id": 16,
    "type": "restore",
    "status": "failed",
    "disk": "minio_backups",
    "path": "omni360/2026-07-13-03-00-05.zip",
    "size_bytes": null,
    "initiated_by": 7,
    "error": "psql restore failed: connection to server ... failed: timeout expired",
    "started_at": "2026-07-18T15:20:00.000000Z",
    "finished_at": "2026-07-18T15:35:00.000000Z",
    "created_at": "2026-07-18T15:19:58.000000Z",
    "updated_at": "2026-07-18T15:35:00.000000Z"
  }
}
```

**UI notes:** `status` is always one of `pending`, `running`, `completed`, `failed` — no others. Suggested polling interval: every 2–3s while `pending`/`running`, stop on any other value. `error` is a raw backend message (psql/pg_dump stderr) — fine to show verbatim in an admin-only "details" expander, not meant to be user-friendly copy.

#### 3.1 Failure handling — how "stuck" was fixed, and what the UI still needs to do

Earlier builds of this endpoint had a real bug: if the backup job threw an exception the backend didn't already anticipate (e.g. a broken vendor autoload), the operation row was left at `running` forever — nothing ever wrote `status: failed`, so any UI polling it would spin indefinitely ("en cours" that never resolves). That's now fixed on the backend with three layers, so **the API guarantee is: every operation eventually reaches `completed` or `failed`, never silently hangs**:

1. `BackupService::runBackup()`/`runRestore()` wrap their work in try/catch and always write a terminal status — including on completely unexpected exceptions, not just the failure modes we planned for.
2. `RunBackupJob`/`RunBackupRestoreJob` implement Laravel's `failed()` hook as a second layer, in case something throws outside the service call itself.
3. `backups:reap-stuck` runs every 15 minutes and force-fails anything still `pending`/`running` well past its timeout (~45 min) — the last-resort case where the queue worker process itself was killed outright (OOM, server restart) and neither layer above ever got to run.

**What the UI still needs to handle, given that guarantee:**

- **Always render the `failed` state distinctly** — don't just stop the spinner, show an explicit error state (e.g. red banner/icon) with the `error` message available in a "details" expander. A `failed` result the admin doesn't notice is as bad as a spinner that never resolves.
- **Poll with a client-side cap too.** Don't poll forever even though the backend now guarantees a terminal status within ~45 minutes — cap client-side polling around 2–3 minutes of wall time for a *manual* create/restore (typical run is seconds to low minutes on this DB size; see the `6 s DONE` queue log for a normal backup run). Past that cap, stop auto-polling and show "still running — refresh to check" rather than spinning the tab forever; the reap job's 45-minute window is a backend outer bound, not a UX target.
- **Don't rely solely on an in-memory `operation_id`.** If the admin refreshes the page or reopens the tab mid-run, re-fetch `GET /admin/backups` and use `recent_operations` to find the latest one for reconciliation instead of assuming polling state survived — this list is the source of truth, not client state.
- **A `failed` restore is a page-stop moment**, not a toast — see the restore section below for why (the DB may be left in a partially-restored state; this needs to surface to the admin loudly, not auto-dismiss after N seconds).

---

### `POST /admin/backups/operations/{id}/cancel` — kill a stuck/unwanted operation

Permission: `delete-backups`, **plus `restore-backups` (root only) if the operation is a `restore`** — cancelling a restore is checked inline against the operation's own `type` (route middleware can't branch on that). See §8 for the full concept — read it before wiring this into the UI, the two operation types are *not* equally "killable".

```bash
curl -X POST "https://api.omni360.cloud/api/backend/admin/backups/operations/21/cancel" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Accept: application/json"
```

Success:
```json
{
  "success": true,
  "data": { "operation_id": 21, "warning": null }
}
```

Success, but with a caveat the UI must surface (see §8 — this happens for a `backup` type, or a `restore` with no reachable process):
```json
{
  "success": true,
  "data": {
    "operation_id": 21,
    "warning": "The underlying pg_dump process runs inside a third-party package and cannot be signalled from this endpoint — it will continue running server-side until it finishes on its own; this only stops tracking it as active."
  }
}
```

`409` if the operation is already `completed`/`failed` — nothing to cancel:
```json
{ "success": false, "errors": { "status": "Operation is already completed — nothing to cancel." } }
```

---

### `DELETE /admin/backups` — delete a backup file

Permission: `delete-backups`.

Body: `{ "path": "..." }` — use the exact `path` value from the `index` response.

```bash
curl -X DELETE "https://api.omni360.cloud/api/backend/admin/backups" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{ "path": "omni360/2026-07-13-03-00-05.zip" }'
```

```json
{ "success": true }
```

`404` if the path doesn't match any backup currently on disk:
```json
{ "success": false, "errors": { "path": "Backup not found." } }
```

This is a synchronous, immediate delete (no confirmation phrase, no queue) — irreversible but low-blast-radius (loses one snapshot, not live data). Recommend a plain "Are you sure?" modal client-side; the API itself doesn't require typed confirmation for delete (only for restore, see below).

---

### `POST /admin/backups/restore` — restore the database from a backup

Permission: `restore-backups` (**root only**).

Body: `{ "path": "...", "confirm": "RESTORE" }`. `confirm` **must be the literal string `"RESTORE"`** — anything else, including a lowercase or translated version, fails validation. This is intentional: the UI should make the user actually type the word, not just click a checkbox, given restore fully overwrites the live database.

```bash
curl -X POST "https://api.omni360.cloud/api/backend/admin/backups/restore" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{ "path": "omni360/2026-07-18-14-32-10.zip", "confirm": "RESTORE" }'
```

```json
{
  "success": true,
  "data": { "operation_id": 17 }
}
```

Status `202` — same polling flow as backup creation (`GET /admin/backups/operations/17`).

**Validation errors** (`422`) — e.g. missing/wrong confirm text:
```json
{
  "success": false,
  "errors": {
    "confirm": ["The selected confirm is invalid."]
  }
}
```

**Not found** (`404`) if `path` doesn't match an existing backup:
```json
{ "success": false, "errors": { "path": "Backup not found." } }
```

**Suggested UI flow**: restore button → modal explaining the blast radius ("this will overwrite the entire live database with the state from {backup date}") → text input where the user must type `RESTORE` exactly → on submit, send that value verbatim as `confirm` → show a progress state driven by polling, not a fire-and-forget toast, since this can take several minutes on a large DB and ends in either "restored successfully" or a failure that needs immediate escalation (don't let the admin navigate away without seeing the final status).

#### 3.2 Restore — the full concept, for implementing the UI correctly

This is the one operation in this module that isn't "call an endpoint, show a result" — get the mental model right before building the screen.

**What "restore" actually does, mechanically.** A backup is a `pg_dump` of almost the *entire* Postgres database — every schema (`public`, `pos`, `logs`), every table, **except** four ephemeral/operational tables that are deliberately excluded from the dump (`sessions`, `personal_access_tokens`, `backup_operations`, `backup_schedules` — see §7). Restoring doesn't selectively merge data back in — it runs the dump's SQL through `psql`, which (because the dump was generated with `--clean --if-exists`) **drops and recreates every table it contains from scratch**, then repopulates it with whatever was in the database at backup time. There is no partial restore and no dry-run: it's "make the live database identical to how it looked at `{backup timestamp}`," full stop — except your login and the backup system's own bookkeeping, which are left alone.

**Because logins survive, the admin does *not* get logged out by a restore**, and the status-polling call keeps working the entire time (`backup_operations` is excluded from the dump too, so the row the UI is watching is never touched by the restore itself). What *does* happen instead: **the whole app goes into maintenance mode for the duration** — see §7 for exactly why and how to handle it. That's the mechanism that replaces "you might get logged out"; it's more predictable and it protects every user, not just the one running the restore.

**What this means for the UI build:**

1. **Read §7 before building the polling loop** — while the app is down, every route *except* the two this module uses (`GET /admin/backups`, `GET /admin/backups/operations/{id}`) returns `503`. Those two keep working normally throughout, by design, so the restore screen itself never needs special-case handling for maintenance mode — just poll `operations/{id}` exactly as documented in §3 and it'll behave normally start to finish.
2. **A `failed` restore may leave the database partially applied.** `psql` replays the dump as a long sequence of individual statements (not one all-or-nothing transaction), so a failure partway through can leave some tables restored and others not. Surface `error` prominently and tell the admin to check with ops before assuming the database is in any particular state — don't imply "nothing happened" on failure.
3. **Warn about the outage in the confirmation modal.** Every other part of the app — for every user, not just the acting admin — is unreachable while this runs. Suggested copy: *"This will overwrite the entire live database with the state from {backup date}, and take the whole application offline for other users until it finishes. This cannot be undone."* Still worth recommending a low-traffic window as an operational practice, even though the maintenance-mode mechanism makes it safe at any time.
4. **No "cancel" once started.** There's no cancel/abort endpoint — once `POST /admin/backups/restore` returns `202`, the job runs to completion or failure on its own, and the app-wide outage lasts exactly as long as that takes (typically seconds to low minutes; see §7 for the outer bound). Don't design a cancel button.

**Full sequence, tying the pieces together** (this is the same flow already shown piecemeal above, as one story):

```
1. GET  /admin/backups                              → admin picks a backup from the list (gets its `path`)
2. UI shows confirmation modal, admin types "RESTORE"
3. POST /admin/backups/restore  { path, confirm }    → 202 { operation_id }
                                                        (app is now in maintenance mode — see §7)
4. UI polls GET /admin/backups/operations/{id} every 2–3s — this call keeps working normally,
   maintenance mode does not affect it
   - status: "pending"  → "Queued…"
   - status: "running"  → "Restoring database — the application is offline for other users until this finishes."
   - status: "completed" → "Restore complete — the application is back online." (app is out of maintenance mode)
   - status: "failed"    → show `error` verbatim, do NOT auto-dismiss, tell admin to check backend logs / contact ops
```

There is intentionally no step where the UI "verifies" the restored data itself — confirming the restore actually contains the expected data is a manual admin task (spot-check after), not something this API surface does for you.

---

### `GET /admin/backups/download/{path}` — signed download fallback

Permission: `browse-backups` (+ valid signature). **You normally don't call this directly** — it's the URL already returned as `download_url` in the `index` response, and only actually resolves to this app route when the storage disk isn't S3-compatible (local/dev without MinIO). In any MinIO-backed environment, `download_url` is a direct presigned bucket URL and this route is never hit. No separate integration needed — just use `download_url` as-is from `index`.

## 4. Error shape

All endpoints share the same envelope used across this app's admin API:
- Success: `{ "success": true, "data": {...} }` (some endpoints, like `destroy`, omit `data`).
- Validation failure (`422`): `{ "success": false, "errors": { field: [messages] } }`.
- Not found (`404`): `{ "success": false, "errors": { field: "message" } }` (singular string, not an array, for not-found cases — see examples above).

## 5. Permissions quick reference

| Permission | Default roles | Gates |
|---|---|---|
| `browse-backups` | `root`, `admin` | `GET /admin/backups`, `GET .../operations/{id}`, download |
| `create-backups` | `root`, `admin` | `POST /admin/backups` |
| `delete-backups` | `root`, `admin` | `DELETE /admin/backups` |
| `restore-backups` | `root` only | `POST /admin/backups/restore` |
| `manage-backup-schedule` | `root`, `admin` | all of §6 below |

Seeded via `DynamicRbacPermissionsSeeder` — same mechanism as every other permission in this app (see `roles-permissions.md`); rerun the seeder after pulling this change, or grant manually via the Roles & Permissions admin screen.

## 6. Automatic backup schedule

Lets an admin configure **when backups run automatically**, entirely from the UI — e.g. "every day at 21:00", or "every day at 06:00 **and** 21:00" (two schedule rows), or "only Mon/Wed/Fri at 02:00". No code change, no redeploy, no cron file edit: it's a database-backed config checked every minute by `backups:trigger-scheduled` (see `Kernel.php`), the exact same pattern this app already uses for "Mission Vide" auto-planning (`mission_planning_templates`).

**How a schedule fires:**
- Each row has `is_active`, `days_of_week` (array of `0`=Sun…`6`=Sat, **empty = every day**), and `trigger_time` (`HH:MM`, minute precision).
- A background command runs every minute, and fires any active row whose day + time match "now".
- **Anti-double-fire**: once a row fires, `last_triggered_at` is stamped — it won't fire again that same day even if checked again (e.g. after a slow overlapping run). It becomes eligible again the next day.
- A fired schedule enqueues exactly the same `RunBackupJob` as a manual "create backup" click — the resulting `BackupOperation` just carries `backup_schedule_id` so the activity list (`GET /admin/backups`'s `recent_operations`) can show "auto (schedule #3)" vs "manual".
- **Multiple rows = multiple times per day.** There's no single "the schedule" — an admin adds as many rows as they want, each independent. Want twice a day? Create two rows, one at `06:00`, one at `21:00`, both `days_of_week: []`.

Permission: `manage-backup-schedule` (`root`, `admin`) on all 4 endpoints below.

### `GET /admin/backups/schedules` — list schedules

```bash
curl -X GET "https://api.omni360.cloud/api/backend/admin/backups/schedules" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Accept: application/json"
```

```json
{
  "success": true,
  "data": [
    {
      "id": 2,
      "label": "Evening full backup",
      "is_active": true,
      "days_of_week": [],
      "trigger_time": "21:00:00",
      "schedule_label": "Every day at 21:00",
      "last_triggered_at": "2026-07-17T21:00:00.000000Z",
      "created_by": 1,
      "created_at": "2026-07-10T09:00:00.000000Z",
      "updated_at": "2026-07-17T21:00:00.000000Z"
    },
    {
      "id": 1,
      "label": "Morning backup",
      "is_active": true,
      "days_of_week": [],
      "trigger_time": "06:00:00",
      "schedule_label": "Every day at 06:00",
      "last_triggered_at": "2026-07-18T06:00:01.000000Z",
      "created_by": 1,
      "created_at": "2026-07-09T08:00:00.000000Z",
      "updated_at": "2026-07-18T06:00:01.000000Z"
    }
  ]
}
```

### `POST /admin/backups/schedules` — create a schedule

Body: `label` (optional), `is_active` (optional, defaults `true`), `days_of_week` (optional array of `0`–`6`, omit/empty = every day), `trigger_time` (**required**, `HH:MM` or `HH:MM:SS`).

**Example — daily at 21:00:**
```bash
curl -X POST "https://api.omni360.cloud/api/backend/admin/backups/schedules" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{ "label": "Evening full backup", "trigger_time": "21:00" }'
```

**Example — twice a day (create this in addition to the one above, for 06:00):**
```bash
curl -X POST "https://api.omni360.cloud/api/backend/admin/backups/schedules" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{ "label": "Morning backup", "trigger_time": "06:00" }'
```

**Example — weekdays only, 02:00 (`days_of_week`: 1=Mon … 5=Fri):**
```bash
curl -X POST "https://api.omni360.cloud/api/backend/admin/backups/schedules" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{ "label": "Weeknight backup", "trigger_time": "02:00", "days_of_week": [1,2,3,4,5] }'
```

Response (`201`):
```json
{
  "success": true,
  "data": {
    "id": 3,
    "label": "Weeknight backup",
    "is_active": true,
    "days_of_week": [1, 2, 3, 4, 5],
    "trigger_time": "02:00:00",
    "schedule_label": "Mon, Tue, Wed, Thu, Fri at 02:00",
    "last_triggered_at": null,
    "created_by": 7,
    "created_at": "2026-07-18T13:40:00.000000Z",
    "updated_at": "2026-07-18T13:40:00.000000Z"
  }
}
```

### `PUT /admin/backups/schedules/{id}` — update a schedule

All fields optional/partial — send only what changed. Toggling `is_active: false` is how the UI implements a pause/resume switch without deleting the row (and losing `last_triggered_at` history).

```bash
curl -X PUT "https://api.omni360.cloud/api/backend/admin/backups/schedules/3" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{ "is_active": false }'
```

```json
{
  "success": true,
  "data": {
    "id": 3,
    "label": "Weeknight backup",
    "is_active": false,
    "days_of_week": [1, 2, 3, 4, 5],
    "trigger_time": "02:00:00",
    "schedule_label": "Mon, Tue, Wed, Thu, Fri at 02:00",
    "last_triggered_at": null,
    "created_by": 7,
    "created_at": "2026-07-18T13:40:00.000000Z",
    "updated_at": "2026-07-18T13:45:00.000000Z"
  }
}
```

Changing `trigger_time` mid-day is safe — it takes effect on the very next minute-check, and `last_triggered_at` is untouched by the update itself, so if the new time happens to be later today it will still fire today (only firing at the same time twice in one day is blocked).

### `DELETE /admin/backups/schedules/{id}` — remove a schedule

```bash
curl -X DELETE "https://api.omni360.cloud/api/backend/admin/backups/schedules/3" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Accept: application/json"
```

```json
{ "success": true }
```

Hard delete (no soft-delete/undo) — it's config, not a business record. If the UI wants a "pause" affordance instead of losing the row, use `PUT .../{id}` with `is_active: false` instead of deleting.

### `POST /admin/backups/schedules/{id}/run-now` — fire a schedule immediately

Fires this specific schedule right now instead of waiting for its `trigger_time` — useful as a "Test" / "Run Now" button next to each schedule row so an admin can confirm it actually works without waiting. Same permission (`manage-backup-schedule`), same `RunBackupJob`/`BackupOperation` polling flow as everything else in this module.

```bash
curl -X POST "https://api.omni360.cloud/api/backend/admin/backups/schedules/3/run-now" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Accept: application/json"
```

```json
{
  "success": true,
  "data": { "operation_id": 21 }
}
```

Status `202` — poll `GET /admin/backups/operations/21` (§3) exactly like a manual backup. This also stamps the schedule's `last_triggered_at`, so it counts as today's run — the regular per-minute cron check won't fire this schedule again later today even if its `trigger_time` hasn't passed yet.

### UI notes

- Render each row's `schedule_label` directly (e.g. "Every day at 21:00", "Mon, Tue, Wed, Thu, Fri at 02:00") instead of re-deriving it from `days_of_week`/`trigger_time` client-side — it's generated server-side by `BackupSchedule::scheduleLabel()` and is the source of truth for how a given config reads in English.
- `days_of_week` uses `0`=Sunday … `6`=Saturday (JS `Date.getDay()` convention) — no conversion needed from a typical JS day-picker.
- A schedule firing is indistinguishable from a manual click in terms of what happens next (same `RunBackupJob`, same `BackupOperation` polling flow from §3) — the only difference is `backup_schedule_id` being set on the resulting operation, visible in `GET /admin/backups`'s `recent_operations`.

## 7. Maintenance mode during restore

**Why this exists.** `psql` replays a restore as a long sequence of individual DROP/CREATE/COPY statements against the *live* database — it is not one atomic transaction. Without some form of lockout, every other request hitting the app during that window could see a half-restored schema: a table that's been dropped but not yet recreated, a query joining a table that still has old data against one that's already been replaced with new data, etc. Rather than accept that risk, `POST /admin/backups/restore` puts the **entire application** into Laravel's built-in maintenance mode for the duration, with two narrow, deliberate exceptions so the restore screen itself keeps working throughout.

### How it works, end to end

1. **On confirm**, `BackupController::restore()` validates the request, creates the `BackupOperation` row, then calls `BackupService::enterMaintenanceForRestore()` — **synchronously, before the job is even dispatched** — which runs `php artisan down --retry=15`. This closes the gap between "admin confirmed" and "writes actually stop": nothing can race in between.
2. From that instant, **every route in the app returns `503 Service Unavailable`** (with a `Retry-After: 15` header) — except the two listed below. This isn't scoped to this module; it's the whole application, for every user, until the restore finishes.
3. The queued job (`RunBackupRestoreJob` → `BackupService::runRestore()`) then does the actual download/extract/`psql` work, same as before.
4. **On completion (success or failure)**, `runRestore()`'s `finally` block calls `exitMaintenanceIfWeOwnIt()`, which runs `php artisan up` — bringing the app back online automatically. No manual step needed.
5. **Two hard guarantees against the app being stuck down forever**, layered the same way as the "stuck operation" guarantees in §3.1: if the job fails outside `runRestore()`'s own try/catch, `RunBackupRestoreJob::failed()` also calls `exitMaintenanceIfWeOwnIt()`; if the worker process is killed outright (OOM, restart) before even that can run, `backups:reap-stuck` (every 15 min, §3.1) detects the abandoned restore operation and brings the app back up as part of reaping it.
6. **Ownership tracking prevents double-triggering.** `enterMaintenanceForRestore()` no-ops if the app is already down for an unrelated reason (e.g. someone ran `php artisan down` manually for a deploy) — it will never take over or prematurely end someone else's maintenance window. This is tracked via a cache flag (`backup:restore:maintenance_owner`), not by assuming "down = we did it."

### What stays reachable during the outage

Configured in `App\Http\Middleware\PreventRequestsDuringMaintenance::$except`:

- `GET /api/backend/admin/backups` — the list/activity view
- `GET /api/backend/admin/backups/operations/*` — the status-poll endpoint

Every other route in the entire application — every other admin screen, every SFA/mobile endpoint, everything — returns `503` while a restore is running. This is intentional and total; it is not scoped to "just the backup module."

**Why these two specifically stay up without risk**: `backup_operations` (and `backup_schedules`) are in the *excluded-from-the-dump* list (`config/database.php`, `pgsql.dump.exclude_tables`) — the restore never touches them, so querying that table mid-restore is exactly as safe as querying it any other time. That's also why logins survive a restore now (§3.2) — `sessions`/`personal_access_tokens` are excluded from the dump for the same reason, alongside the two backup-bookkeeping tables.

### What this means for the UI, concretely

- **You do not need to write any special 503-handling for the restore screen.** Poll `GET /admin/backups/operations/{id}` exactly as documented in §3 — it is explicitly excluded from maintenance mode and will keep returning normal `200` JSON responses throughout the entire restore, start to finish.
- **You should expect 503s everywhere *else* in the app** while a restore is in flight. If your frontend has any global fetch/axios interceptor or error boundary, make sure a `503` doesn't get mishandled as a fatal app error — ideally show a lightweight "the application is temporarily offline for maintenance, please wait" state for any request outside the two excepted routes above, rather than a generic crash screen. This will surface for *any* user anywhere in the app while a restore is running, not just the admin running it.
- **The outage duration is exactly the restore's run time** — typically seconds to low minutes for this database's size (see the queue log example in §3.1: a normal *backup* run completed in `6s`; restore is comparably fast since it's the same data volume). The `backups:reap-stuck` 45-minute outer bound (§3.1) is a worst-case safety net, not a realistic expectation — don't design the "please wait" copy around that number.
- **A disaster-recovery caveat, for completeness (not a UI concern):** if a backup is ever restored onto a *brand-new, empty* database rather than the live one, `php artisan migrate` needs to run first — `sessions`/`personal_access_tokens`/`backup_operations`/`backup_schedules` are never in the dump, so a from-scratch restore alone won't create them.

## 8. Cancelling a stuck or unwanted operation

An admin can kill a `pending` or `running` operation via `POST /admin/backups/operations/{id}/cancel` (§3). **The two operation types are not equally killable — read this before designing the "Kill" button.**

### Why restore and backup behave differently

- **Restore**: `BackupService::runRestore()` runs `psql` itself, directly, via Symfony's `Process` — so its OS process id is captured the moment it starts (`runPsql()`) and persisted on the operation row. `cancel()` sends that process a real `SIGTERM`. The blocked `psql` call returns unsuccessfully, the existing failure-handling path in `runRestore()` catches it, sees the operation is already marked `cancelled`, and leaves the clean "Cancelled by admin" message alone rather than overwriting it with a raw process-exit error. **This is a genuine kill** — the actual `psql` process stops.
- **Backup**: `backup:run` is spatie/laravel-backup's own Artisan command, and it spawns `pg_dump` internally, in a process we have no handle on at all. There is no PID to signal. Cancelling a `running` backup can only **stop tracking it as active** in the UI — the underlying `pg_dump` keeps running server-side, unaffected, until it finishes on its own (its result is simply discarded — the operation row was already marked `failed`/cancelled and won't be overwritten, but the file it may still produce is not deleted automatically). **This is a soft cancel**, and the response's `warning` field says so explicitly — surface that warning to the admin, don't hide it.

Cancelling a `pending` operation (job hasn't started running yet) is the safe, unambiguous case for both types — there's no process to kill either way, since it's just a row waiting to be picked up. `cancel()` marks it `failed`/`cancelled` immediately, and a guard at the top of `runBackup()`/`runRestore()` makes sure that if the worker happens to pick the job up moments later anyway, it sees `cancelled: true` and exits immediately without doing any work — the cancellation can never be silently overwritten by a race.

### Permission model

- Cancelling a `backup` operation: `delete-backups` (root or admin) — same tier as deleting a backup file, a comparably low-risk cleanup action.
- Cancelling a `restore` operation: `delete-backups` **and** `restore-backups` (root only) — stopping a live schema rebuild mid-flight is exactly as sensitive as starting one. An `admin` (non-root) can see the cancel button but the API will `403` the actual call.

### What this means for the UI

- **Show a "Kill" button on any operation whose `status` is `pending` or `running`** — the response already tells you which via `GET /admin/backups` (`recent_operations`) or the operation-status poll.
- **Only show it as usable for a `restore` if the current user is root.** For `admin` (non-root), either hide the button on restore rows or show it disabled with a tooltip explaining why — don't let them hit a surprise `403`.
- **Always render the `warning` field if present**, distinctly from a plain success confirmation — e.g. "Backup cancelled, but note: the underlying process may still be running server-side" as a persistent banner, not a toast that disappears in 3 seconds. The admin needs to know the difference between "definitely stopped" and "stopped tracking, but it might still be running."
- **After a restore is killed, maintenance mode ends automatically** (`cancel()` calls the same `exitMaintenanceIfWeOwnIt()` used everywhere else in this module) — no separate "bring the app back online" step needed on the UI side.
- **Killing a restore mid-flight can leave the database in a partially-restored state** — exactly like a natural `failed` restore (§3.2). The confirmation before hitting "Kill" on a running restore should say so plainly: *"Stopping this now may leave the database partially restored. This is the same risk as letting it fail on its own."* Don't undersell this as a clean, safe abort.
