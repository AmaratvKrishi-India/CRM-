# CODEX POST-TAKEOVER VERIFICATION REPORT

Phase 2 — Android Studio emulator restoration + final regression.
Executed 2026-08-22 (Asia/Calcutta) by Codex in verification-only mode.

Constraints honored: no application source changes, no production Supabase writes,
no migrations, no `supabase db push`, no `supabase migration repair`, no Vercel
deploy, no staging creation, no physical devices. Android Studio emulators only.

## 1. Git State

- HEAD = `de18fabd7979f49fe4d792b15eae2fa4bab720dd`
- Branch = `main`, `origin/main` = `de18fab` (in sync)
- Working tree: docs-only drift inherited from the takeover phase
  (modified docs, untracked `GATES.md`, docs 22/23, test artifacts).
  No changes introduced by this phase except this report and test logs.

## 2. Source-Code Drift

`git diff -- src/ supabase/ android/ tests/ e2e/ scripts/ package.json` = EMPTY.
No application-code drift. Nothing was modified.

## 3. Release APK (existing artifact, NOT rebuilt)

- Path: `android/app/build/outputs/apk/release/app-release.apk`
- Size: 7,267,257 bytes
- Modified: 2026-08-22 09:07:41 +05:30
- SHA-256: `A91BF040A3A5E6CF5AD2ECED316F92B69AE66A6BBF77BF8A75B2999A9AA9999C`
- applicationId: `com.amaratvkrishi.salescrm`, versionName `2.0.0`, versionCode `2`
  (confirmed in `output-metadata.json`)
- Baked-in backend: `http://127.0.0.1:15432` (local Docker Supabase via
  `adb reverse`), matching the multi-device test design. Emulators have no
  external internet; this is expected and correct for the test environment.

## 4. Emulator Detection (dynamic, via `adb devices -l`)

| Device | State | Model |
|--------|-------|-------|
| emulator-5556 | device (online) | sdk_gphone16k_x86_64 |
| emulator-5558 | device (online) | sdk_gphone16k_x86_64 |
| emulator-5560 | device (online) | sdk_gphone16k_x86_64 |

## 5. Installation (`adb install -r`, no uninstall, no data wipe)

| Device | Install | Package | versionName | versionCode | Launch |
|--------|---------|---------|-------------|-------------|--------|
| emulator-5556 | Success | com.amaratvkrishi.salescrm | 2.0.0 | 2 | MainActivity focused |
| emulator-5558 | Success | com.amaratvkrishi.salescrm | 2.0.0 | 2 | MainActivity focused |
| emulator-5560 | Success | com.amaratvkrishi.salescrm | 2.0.0 | 2 | MainActivity focused |

WebView CDP sockets (`webview_devtools_remote_<pid>`) confirmed live on all
three devices; `MainActivity.java` enables WebView debugging explicitly.

## 6. Smoke + Multi-Device Workflow (emulators only, local Docker Supabase)

Executed via `tests/multiDeviceSync.test.ts` (unmodified), which drives the
three emulators over ADB + CDP against the local Docker Supabase stack
(`supabase_db_calling_app`, healthy, port 15432).

- ADMIN (emulator-5556): launch, login `admin@amaratvkrishi.com`, ADMIN badge
  dashboard, lead ingestion (3 leads), assignment of Lead A -> Rahul,
  Lead B -> Pooja. PASS.
- AGENT A (emulator-5558): launch, login `rahul@amaratvkrishi.com`, Field Sales
  Dashboard, lead isolation (Lead A visible; B and C isolated), status
  INTERESTED, remark, call record 90s CONNECTED/VERIFIED, follow-up. PASS.
- AGENT B (emulator-5560): launch, login `pooja@amaratvkrishi.com`, lead
  isolation (Lead B visible; A isolated), status SAMPLE_REQUESTED, remark,
  call record 45s CONNECTED/VERIFIED, follow-up. PASS.
- Admin received both agents' updates after sync; independent PostgreSQL
  verification PASS; offline outbox queue + network recovery PASS; RLS tenant
  and agent isolation PASS; clean teardown PASS.

Standalone run: 13/13 PASS (duration ~202s).

## 7. Test Matrix

| Area | Result | Evidence |
|------|--------|----------|
| Git | PASS | HEAD = origin/main = de18fab |
| Source-code drift | PASS | git diff empty for src/, supabase/, android/, tests/, e2e/, scripts/ |
| Production Supabase | PASS | lahvcodvgubplzfshare reachable; RPC + REST probes HTTP 200 |
| Migration 6 | PASS | POST /rest/v1/rpc/current_profile_id -> HTTP 200 (function live) |
| Cloud RLS | PASS | anon GET leads/call_records/remarks/follow_ups/profiles -> 200 with [] (0 rows) |
| Vercel | PASS | https://crm-blush-omega.vercel.app -> HTTP 200, serves Amaratv Krishi CRM |
| Android APK | PASS | app-release.apk 7,267,257 bytes, SHA-256 A91BF040...999C, v2.0.0/2 |
| Emulator installation | PASS | adb install -r Success on 5556/5558/5560 |
| Emulator launch | PASS | MainActivity focused on all three; CDP endpoints live |
| Admin workflow | PASS | multiDeviceSync Steps 1-3, 8&9 |
| Agent A workflow | PASS | multiDeviceSync Steps 4, 6 |
| Agent B workflow | PASS | multiDeviceSync Steps 5, 7 |
| Multi-device sync | PASS | 13/13 standalone; 115/115 in final full run |
| Offline recovery | PASS | Step 11: offline mutation synced after recovery |
| Android call lifecycle | PASS | 90s + 45s CONNECTED/VERIFIED call records persisted and visible to Admin |
| Unit/integration tests | PASS | npm test: 115 tests / 22 suites, 115 pass, 0 fail (final rerun) |
| Build | PASS | npm run build (tsc && vite build) clean, 3.86s |
| Security | PASS | securitySecretScan + securityRlsIsolation PASS within run; Step 12 RLS enforcement PASS |
| Production safety | PASS | read-only probes only; zero INSERT/UPDATE/DELETE/DDL against production |
| Migration ledger | FAIL | LOCAL = 6, REMOTE = 0 (ledger empty); documented, NOT repaired per instructions |
| Staging | NOT TESTED | no staging environment exists; out of scope for this phase |
| CI/CD | NOT TESTED | no .github/ present; out of scope for this phase |

## 8. Test Run Details

- Run 1 (full `npm test`): 114/115. Single failure: multiDeviceSync Step 4
  `waitForSelector('text=Field Sales Dashboard')` timed out at 15s under full
  parallel suite load (locator log shows the element DID resolve visible).
  Timing flake, not an application defect.
- Run 2 (full `npm test`, rerun): 115/115 PASS, 0 fail, ~84.7s.
- Standalone `multiDeviceSync.test.ts`: 13/13 PASS, ~202s.
- `npm run build`: PASS.
- `npm run verify`: NOT executed. Inspected previously: it runs
  `supabase db reset` against the LOCAL Docker stack (destructive to local
  seed data). Not needed for this phase and avoided per instructions.

## 9. Production Safety

- No INSERT / UPDATE / DELETE / ALTER / DROP / TRUNCATE / RESET / MIGRATE
  executed against production Supabase.
- No `supabase db push`, no `supabase migration repair`, no Vercel deploy.
- Only read-only HTTP probes (GET table reads, POST RPC) touched production.
- Local Docker database changes were limited to the test suite's own fixed-UUID
  fixtures, which is the suite's designed behavior.

## 10. Migration Ledger (inspection only, NOT repaired)

- LOCAL MIGRATIONS = 6 (`supabase/migrations/20260820000001..000006`)
- REMOTE LEDGER = 0 (`npx supabase migration list`: all 6 entries show
  `remote: ""`; `supabase_migrations.schema_migrations` is empty)
- Production SQL objects demonstrably exist (migration 6 RPC returns 200;
  all tables respond), so they were applied outside CLI tracking.
- RISK of a future `supabase db push`: the CLI would attempt to re-apply all
  6 migrations against a database where the objects already exist. Depending
  on idempotency of each statement, this would fail on duplicate object
  creation or, worse, recreate/alter live production objects. Any future push
  must be preceded by a human-supervised ledger baseline/repair
  (e.g. `supabase migration repair <version> --status applied` for all 6).
- NOT repaired in this phase, per instructions.

## 11. Remaining Non-Blocking Items

1. Remote Supabase migration ledger empty (local 6 vs remote 0) — release
   hygiene; requires human decision before any future `db push`.
2. No dedicated staging Supabase project (`.env.staging` points at production).
3. No CI/CD (`.github/` absent).
4. Orphaned legacy Vercel deployment (`amaratv-krishi-crm.vercel.app`) still
   publicly serving under the old account scope.
5. `JAVA_HOME` / `ANDROID_HOME` unset on this machine — Android rebuild would
   be blocked; not needed this phase since the existing APK was used.
6. multiDeviceSync Step 4 selector is timing-sensitive under full parallel
   suite load (1 flake observed in run 1; clean in run 2 and standalone).
7. Working tree carries docs-only drift from the takeover phase (uncommitted).

## 12. FINAL VERDICT

**TAKEOVER_VERIFIED_WITH_NONBLOCKING_ITEMS**

The release state is verified: APK installed and running on all three Android
Studio emulators, full Admin/Agent A/Agent B workflows pass, multi-device sync,
offline recovery, call lifecycle, and RLS isolation all pass, 115/115 tests,
clean build, production untouched. Outstanding items are staging/CI/CD and
migration-ledger hygiene, which are explicitly out of scope for this phase.
