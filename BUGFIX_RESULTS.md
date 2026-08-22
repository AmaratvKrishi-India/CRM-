# Amaratv Krishi Sales CRM — Bugfix Results Report

Date: 2026-08-23 • Project: `C:\Users\PC\Desktop\calling app` • App v2.0.0, DB schema v5

## 1. Scope

The bug hunt reported 23 bugs (6 critical, 6 high, 6 medium, 5 low). All 23 were addressed:
22 fixed in code, 1 (#22) explicitly accepted as a documented risk. A full-project recheck
after the fixes found and fixed 1 additional bug that the original list did not cover.

Result: 19 files modified (+437 / -91 lines), 1 new e2e regression spec added.
Nothing has been committed; review with `git diff`.

## 2. Bug-by-bug fix details

### Critical (data loss / core features broken)

**#1 Excel imports never sync to cloud — FIXED**
- `src/services/excelParser.ts`: `importRecords()` now accepts `userId`, enqueues one outbox
  `CREATE` per imported lead and one `UPDATE` per overwritten duplicate, and writes an
  `import_audit` row via `ImportAuditRepository.createAudit` (which enqueues its own outbox
  item). Imported leads set `createdBy`/`updatedBy`.
- `src/components/import/ExcelImporter.tsx`: new `currentUserId` prop, passed through as `userId`.
- `src/App.tsx`: sales-mode `<ExcelImporter>` now passes `currentUserId={currentUser?.id || null}`.
- Verified in browser: after importing 141 leads, IndexedDB contained 141 leads, 1 importAudit
  with `uploadedBy = 'usr-admin-001'`, 141 outbox `leads` CREATE items carrying `userId`, and an
  `import_audits` outbox item.

**#2 Excel numeric phone cells marked INVALID — FIXED**
- `src/db/services/leadNormalizer.ts`: `normalizePhoneNumber` now accepts `string | number`.
  Numeric cells are converted with `toLocaleString('fullwide', { useGrouping: false })` so
  `9876543210` arriving as a JS number no longer fails the `typeof === 'string'` guard and no
  scientific-notation/grouping artifacts are introduced.

**#3 `profiles` push structurally broken — FIXED**
- `src/services/sync/syncPush.ts`: added a proper `profiles` case to `transformToPgRecord`
  mapping to snake_case columns (`last_login_at`, `created_by`, `role`, `status`, `version`, ...).
- `src/services/sync/syncQueue.ts`: added `MAX_RETRY_COUNT = 10`; items that fail 10+ times are
  parked as `DEAD_LETTER` (new `OutboxStatus` in `syncTypes.ts`) instead of retrying forever.
  `getQueueStats()` now reports `deadLetter`.

**#4 WhatsApp deep link missing country code — FIXED**
- `src/components/whatsapp/WhatsAppComposeModal.tsx`: launch now uses
  `lead.phoneE164 || lead.phone`, so links open as `https://wa.me/919876543210?...`.
- Verified in browser: intercepted `window.open` URL contained `https://wa.me/919876543210`
  and the messageHistory record stored `recipientPhone === '+919876543210'`.

**#5 Dashboard / lead detail read the wrong call table — FIXED**
- `src/services/dashboardService.ts`: "Calls Today" and the recent-activity feed now read
  `db.callRecords` (the table Phase 2J writes to) instead of legacy `db.callHistory`; activity
  detail uses `call.remark` instead of the old `call.notes` field.
- `src/db/repositories/leadRepository.ts`: `getLeadWithFullHistory` reads `db.callRecords`;
  `LeadWithHistory.callHistory` retyped to `CallRecord[]`; `getLeadStats.totalCallsLogged`
  counts `callRecords`.
- `src/components/leads/LeadDetailView.tsx`: calls list typed as `CallRecord`, renders `call.remark`.
- Verified in browser: after seeding one callRecord, the dashboard "Calls Today" card showed `1`.

**#6 Replace-restore silently drops the outbox — FIXED**
- `src/services/backupService.ts`: replace-restore now also restores `outbox`,
  `bulkAssignmentAudits`, and `syncState` (both the restore path and the catastrophic-failure
  rollback path), so unsynced mutations survive a restore onto a fresh device.

### High

**#7 Stuck `SYNCING` outbox items never recover — FIXED**
- `src/services/sync/syncQueue.ts`: new `recoverStuckItems()` resets `SYNCING` items older than
  5 minutes (app killed mid-push) back to `PENDING`.
- `src/services/sync/syncEngine.ts`: calls `recoverStuckItems()` at the start of every sync run.

**#8 Pull cursor skips boundary-timestamp rows — FIXED**
- `src/services/sync/syncPull.ts`: `pullEntityChanges` now uses inclusive `gte('updated_at', cursor)`
  for the first page of a run, then keyset pagination on `(updated_at, id)` via PostgREST
  `.or('updated_at.gt."ts",and(updated_at.eq."ts",id.gt."id")')`, with per-run id dedupe.
  Rows sharing a boundary timestamp can no longer be skipped.

**#9 Pulled profiles lose `organizationId` — FIXED**
- `src/services/sync/syncPull.ts`: `transformFromPgRecord` now maps `organization_id` for
  `profiles` (and `leads`), so org scoping and realtime channels survive a pull.

**#10 Push can resurrect clobbered remote changes — FIXED**
- `src/services/sync/syncPush.ts`: new `isStalePayload()` compares the payload's `updatedAt`
  against the current local record; if the local record is newer (e.g. remote won LWW during
  pull), the stale payload is dropped (marked SYNCED) instead of pushed. Wired into
  `pushPendingChanges` before `markSyncing`. `SyncPush` now receives the DB handle via
  `src/db/index.ts` (`new SyncPush(syncQueue, customDb)`).

**#11 `RealtimeService.setSyncEngine()` never called — FIXED**
- `src/App.tsx` (`MainAppRouter`): `RealtimeService.setSyncEngine(crmData.syncEngine)` is now
  called before `RealtimeService.init(currentUser)`, so websocket reconnects reconcile
  incrementally from cursors instead of re-pulling all 9 tables from scratch.

**#12 "Today" computed in UTC — FIXED**
- `src/services/dashboardService.ts` and `src/db/repositories/leadRepository.ts` (`getLeadStats`):
  the today window is now computed from local-time midnight to 23:59:59.999 and compared with
  `>=`/`<=` instead of `toISOString().slice(0,10)` prefix matching. Early-morning IST activity
  (00:00–05:30) no longer counts against yesterday.

### Medium

**#13 Double sync loop — FIXED**
- `src/services/sync/backgroundSyncManager.ts`: `startInterval()` no longer also calls
  `syncEngine.startAutoSync()`; the manager owns the single 60s interval (needed for backoff).
  `stopInterval()` defensively calls `syncEngine.stopAutoSync()` so no engine-owned interval
  can linger.

**#14 `CallLifecycleService.handleAppStateChange` was dead code — FIXED**
- `src/App.tsx`: new effect subscribes to Capacitor `appStateChange` and drives the
  DIAL → BACKGROUND → FOREGROUND state machine. When the user returns from the dialer with an
  active attempt, the call-outcome modal re-opens automatically. Listener is removed on cleanup.

**#15 `hardDeleteLead` enqueued nothing and skipped child tables — FIXED**
- `src/db/repositories/leadRepository.ts`: cascade now includes `callRecords` and `activities`,
  and a `DELETE` outbox item is enqueued so the deletion propagates to the cloud instead of the
  lead being resurrected by the next pull.

**#16 First-login bootstrap enqueued redundant profiles CREATE — FIXED**
- `src/services/authService.ts`: bootstrap now uses `repo.putUser(localUser)` directly instead of
  `createUser()`, since the profile already exists server-side.

**#17 Backup header lies about versions — FIXED**
- `src/services/backupService.ts`: header now `schemaVersion: 5`, `appVersion: '2.0.0'`.
- `tests/realBackupService.test.ts` updated to assert both.

**#18 `||` collapsed legitimate zeros — FIXED**
- `src/services/sync/syncPush.ts`: numeric fields now use `??` — `rating`, `review_count`,
  `source_row`, `call_count`, `duration_seconds`, import-audit counters (`total_rows`,
  `imported`, `updated`, `duplicates`, `invalid`), and bulk-assignment counters. `0` values no
  longer collapse to null/defaults.

### Low

**#19 `purgeSyncedItems()` never called — FIXED**
- `src/services/sync/syncEngine.ts`: after a successful push, `queue.purgeSyncedItems()` runs so
  the outbox (and its stats scan) no longer grows unbounded.

**#20 `online` listener never removed, fired after logout — FIXED**
- `src/services/sync/syncEngine.ts`: handlers are stored refs with a new `disposeNetworkListeners()`
  method for removal, and the `online` handler now checks `AuthService.getCurrentSession()` before
  triggering a sync, so post-logout reconnects no longer write `AUTH_REQUIRED` state.

**#21 `updateLead` left `phoneRaw` stale — FIXED**
- `src/db/repositories/leadRepository.ts`: `updateLead` now refreshes `phoneRaw` alongside
  `phone`/`phoneE164`/`phoneType`.

**#22 Full-table scans in search/filter/stats — ACCEPTED RISK**
- Left as-is deliberately: correct at current Lucknow-scale data volumes; flagged for indexing
  work if the dataset grows toward 50k+ leads.

**#23 Truncated mobiles accepted as landlines — FIXED**
- `src/db/services/leadNormalizer.ts`: a 7–8 digit string starting with 6–9 is now classified
  `invalid` (almost certainly a truncated mobile typo) instead of being silently turned into a
  valid `0522` landline. Genuine local landlines (starting 2–4) still normalize as before.

## 3. New bug found during the full-project recheck — FIXED

**Admin Data tab import path missing `currentUserId`**
- `src/components/admin/data/AdminDataManagementView.tsx`: the Admin → Data → Import Center
  `<ExcelImporter>` was not passing `currentUserId`, so imports launched from the admin console
  would have been attributed to the `'local-user'` fallback in outbox items and import audits.
  Now passes `currentUserId={currentUser?.id || null}`.
- Verified in browser: import from the Admin Data tab produced `uploadedBy = 'usr-admin-001'`.

Recheck scans that came back clean (no action needed):
- Legacy `db.callHistory` reads remain only in `backupService` / `syncHelper` /
  `callHistoryRepository` — intentional, for backup compatibility with pre-Phase-2J data.
- No UI consumer of `getQueueStats().deadLetter` yet — the field is additive and safe.
- `syncPull` PostgREST `.or()` keyset syntax validated against the running local stack.
- `mergeRestore` intentionally skips the outbox; `replaceRestore` (the destructive path) is the
  one that restores it.
- `seedDefaults()` is pre-existing dead code, not a regression: the WhatsApp modal ships its own
  first-time template setup path (exercised by the e2e spec).

## 4. Verification evidence

**Type check**
```
npx tsc --noEmit   → clean (exit 0, no output)
```

**Unit + integration tests**
```
npm test           → 115 passed / 0 failed (22 suites)
```
Includes the live multi-device suite (3 Android emulators + Docker Supabase): admin/agent lead
isolation, assignment, workflows, sync push/pull, offline queue recovery, PostgreSQL RLS
enforcement, backup/restore against real Dexie, Excel ingestion, and the secret-leak scanner.

**Browser / e2e (Playwright)**
```
npx playwright test → 32 passed / 0 failed (chromium + Mobile Chrome)
```
Includes the new permanent regression spec `e2e/bugfix-verification.spec.ts`, which drives the
real UI end to end:
1. Admin login → Admin > Data > Import Center > Launch Importer > "Load 141 Leads" > Import.
2. Asserts IndexedDB (`AmaratvSalesCRM`): 141 leads, 1 importAudit with correct `uploadedBy`,
   141 outbox `leads` CREATE items with `userId`, and an `import_audits` outbox item (#1).
3. Switch to Field Sales Mode, create a lead with phone `9876543210`.
4. Seed a callRecord and assert the dashboard "Calls Today" card shows `1` (#5/#12).
5. Open the WhatsApp modal, run first-time template setup, intercept `window.open`, and assert
   the URL is `https://wa.me/919876543210...` and messageHistory stores `+919876543210` (#4).
6. Export a backup and assert `schemaVersion: 5`, `appVersion: '2.0.0'`, and that
   `outbox` / `syncState` / `bulkAssignmentAudits` arrays are present with the expected lead,
   callRecord, and importAudit counts (#6/#17).

## 5. Files changed

| File | Bugs covered |
|---|---|
| `src/services/excelParser.ts` | #1 |
| `src/components/import/ExcelImporter.tsx` | #1 |
| `src/components/admin/data/AdminDataManagementView.tsx` | #1 + new bug |
| `src/db/services/leadNormalizer.ts` | #2, #23 |
| `src/services/sync/syncPush.ts` | #3, #10, #18 |
| `src/services/sync/syncQueue.ts` | #3, #7 |
| `src/services/sync/syncTypes.ts` | #3 (DEAD_LETTER status) |
| `src/components/whatsapp/WhatsAppComposeModal.tsx` | #4 |
| `src/services/dashboardService.ts` | #5, #12 |
| `src/db/repositories/leadRepository.ts` | #5, #12, #15, #21 |
| `src/components/leads/LeadDetailView.tsx` | #5 |
| `src/services/backupService.ts` | #6, #17 |
| `src/services/sync/syncPull.ts` | #8, #9 |
| `src/services/sync/syncEngine.ts` | #7, #19, #20 |
| `src/App.tsx` | #11, #14, #1 (userId prop) |
| `src/services/sync/backgroundSyncManager.ts` | #13 |
| `src/services/authService.ts` | #16 |
| `src/db/index.ts` | #10 (SyncPush DB wiring) |
| `tests/realBackupService.test.ts` | #17 (assertions updated) |
| `e2e/bugfix-verification.spec.ts` | new permanent regression spec |

## 6. Accepted risks / known non-regressions

- **#22** full-table scans in `searchAndFilterLeads` / distinct-value queries / `getLeadStats`:
  acceptable at current scale; revisit with indexes at 50k+ leads.
- `callHistoryRepository.logCall` has zero callers; the legacy `callHistory` table is kept for
  backup/restore compatibility with older device data.
- `seedDefaults()` is pre-existing dead code (superseded by the WhatsApp modal's first-time
  setup flow); left untouched to avoid unrelated churn.

## 7. Status

All 23 reported bugs resolved (22 fixed, 1 accepted with rationale), 1 additional bug found and
fixed during recheck, and the full verification stack is green: typecheck clean, 115/115 unit
tests, 32/32 Playwright e2e tests including the new browser-driven bugfix verification spec.
Changes are uncommitted for review (`git diff`); goal closed at ~18.0M tokens over ~2h 20m.
