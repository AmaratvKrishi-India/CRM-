# CODEX TAKEOVER VERIFICATION REPORT

## 1. Takeover Date
- 2026-08-22 (Asia/Calcutta), executed by Codex in READ-ONLY takeover mode.
- No application code, schema, production data, or deployment was modified during this takeover.

## 2. Repository State
- Branch: `main`
- Remote: `origin` = https://github.com/AmaratvKrishi-India/CRM-.git
- Local `main` and `origin/main` are in sync (both at `de18fab`).
- Working tree is NOT clean (docs-only drift, see section 12):
  - Modified: `docs/AUTOMATED_VERIFICATION_REPORT.md`, `docs/project-knowledge/01_PROJECT_OVERVIEW.md`, `10_ANDROID_APPLICATION.md`, `13_DEPLOYMENT_ENVIRONMENTS.md`, `16_CURRENT_STATE.md`, `19_ENVIRONMENT_VARIABLES.md`
  - Deleted (uncommitted): `docs/project-knowledge/15_CODEBASE_INDEX.md`
  - Untracked: `GATES.md`, `docs/project-knowledge/22_DEPLOYMENT_RUNBOOK.md`, `docs/project-knowledge/23_LOCAL_DEV_SETUP.md`, `playwright-report/`, `test-results/`
- No source-code (`src/`, `supabase/`, `android/`, `tests/`, `e2e/`) changes in the working tree.

## 3. Current Commit
- HEAD = `de18fabd7979f49fe4d792b15eae2fa4bab720dd` ("docs: record toolchain status and account identity map with post-fix state")

## 4. Historical Release Commit
- `759a81c` ("feat: agent deletion, background auto-sync, Day/Night mode, Inter typography")
- HEAD is 3 commits AHEAD of the release commit:
  1. `60c74d1` docs: exhaustive update of project knowledge pack (docs, `package.json` scripts, `scripts/verify.ts`, `supabase/config.toml`)
  2. `be4d3c0` chore: align deployment identity, link Supabase project, sync release state (added e2e specs, migration 6 SQL file, expanded `scripts/verify.ts`, repository/manifest tweaks, release docs)
  3. `de18fab` docs: toolchain status + account identity map
- Notable: the migration 6 file `supabase/migrations/20260820000006_rls_agent_lead_isolation.sql` was committed in `be4d3c0`, i.e. AFTER the historical release commit `759a81c`.

## 5. Environment Mapping
| Layer | Identity | Status |
|-------|----------|--------|
| WEB | Vercel project `crm` in scope `amaratv-krishi` | PRODUCTION |
| ANDROID | `.env.production` -> Supabase cloud; APK built from release config | PRODUCTION |
| SUPABASE | `lahvcodvgubplzfshare` ("AmaratvKrishi-India's Project", ap-south-1, PostgreSQL 17.6) | PRODUCTION |
| VERCEL | CLI logged in as `amaratvkrishi-india`; project linked | LINKED |
| LOCAL | Docker Supabase stack `calling_app` running (ports 15432-15438), 6 migrations applied | RUNNING |
| STAGING | `.env.staging` now points at the production project URL (no dedicated staging project) | NOT PROVISIONED |
- Secrets were not printed or moved. Only environment identity was inspected.

## 6. Supabase Production State (READ-ONLY)
- Project: `lahvcodvgubplzfshare`, status `ACTIVE_HEALTHY`, linked via Supabase CLI (`npx supabase status`).
- Migration 6 evidence: `POST /rest/v1/rpc/current_profile_id` -> HTTP 200 (function created by migration 6 exists and executes).
- `protect_lead_immutable_fields()` cannot be confirmed via anon RPC (trigger functions are not PostgREST-exposed; probe returns PGRST202 as expected). Its presence is implied by migration 6 execution but NOT directly observable with anon credentials.
- All 10 tables (`profiles`, `organizations`, `leads`, `call_records`, `remarks`, `follow_ups`, `activities`, `message_history`, `import_audits`, `bulk_assignment_audits`) exist and respond 200 to anon SELECT with 0 visible rows (consistent with RLS filtering unauthenticated requests).
- Realtime WebSocket endpoint: OPEN (read-only connect).
- Auth settings: email sign-in enabled, signups disabled.
- CAUTION: `npx supabase migration list` shows the remote `supabase_migrations.schema_migrations` table EMPTY (all 6 entries have `remote: ""`). The production SQL objects exist (proven by RPC probe), but they were applied outside the CLI migration ledger (direct SQL / pre-link push). Future `supabase db push` would attempt to re-apply all 6 migrations.
- No INSERT/UPDATE/DELETE/DDL of any kind was executed against production.

## 7. Vercel State
- Live production project: `amaratv-krishi/crm`, latest production deployment `dpl_A33MF5589TomjWutmXLf4pzyCggZ` (READY, target=production, built from commit `de18fab` on `main`, ~7h before takeover).
- Production URL: https://crm-blush-omega.vercel.app (HTTP 200, serves "Amaratv Krishi - Field Sales CRM").
- Takeover-brief expected URL https://amaratv-krishi-crm.vercel.app is ALSO HTTP 200 and serves the same app, but per `docs/project-knowledge/21_ACCOUNT_IDENTITY_MAP.md` it is an ORPHANED deployment under the old personal account scope, not the managed project.
- No redeploy, config change, or env-var change was performed.

## 8. Android State
- applicationId: `com.amaratvkrishi.salescrm`
- versionName: `2.0.0`, versionCode: `2` (matches baseline) in `android/app/build.gradle` and `output-metadata.json`.
- Capacitor: appId `com.amaratvkrishi.salescrm`, webDir `dist`, androidScheme `https`.
- APK present: `android/app/build/outputs/apk/release/app-release.apk` (7,267,257 bytes, built 2026-08-22 09:07).
- Shipped artifact: `release/AmaratvKrishi-SalesCRM-v2.0.0.apk` (5,914,303 bytes, 2026-08-21) - different build/size than the APK currently in gradle outputs.
- Emulators detected dynamically via ADB: `emulator-5556`, `emulator-5558`, `emulator-5560` all ONLINE (device state).
- APP NOT INSTALLED on any of the three emulators (`pm list packages com.amaratvkrishi.salescrm` empty on all three).
- `JAVA_HOME` / `ANDROID_HOME` unset: Android rebuild currently BLOCKED on this machine; `adb` works via full path.

## 9. Test Infrastructure
- `npm test` -> `tsx --test tests/*.test.ts` (17 suites incl. real Dexie/Postgres/RLS/security/multi-device).
- `npm run test:e2e` -> Playwright 1.62.1, 4 specs (`auth`, `crm-navigation`, `mobile-responsive`, `theme`), chromium installed.
- `npm run verify` -> `scripts/verify.ts` (11-stage gate). Inspected, NOT executed: it runs `npx supabase db reset` against the LOCAL Docker stack only (destructive to local seed data, never production) plus read-only production probes. Flagged here per takeover rules.
- Security scan: `tests/securitySecretScan.test.ts` (part of `npm test`).
- PostgreSQL/RLS tests: `tests/realSupabasePostgres.test.ts`, `tests/securityRlsIsolation.test.ts` (run against local Docker Postgres).
- Multi-device: `tests/multiDeviceSync.test.ts` (drives 3 emulators via ADB + CDP).
- No `.github/` directory: CI/CD absent (matches historical docs).

## 10. Current Tests Executed (this takeover)
- `npm run test`: 115 tests / 22 suites -> 108 PASS, 7 FAIL, duration ~5.2s.
  - All 7 failures are inside `multiDeviceSync.test.ts` (Steps 1, 2, 4, 5, 6, 7, 8&9).
  - Root cause: `adb -s emulator-5556 shell pm clear com.amaratvkrishi.salescrm` fails because the APK is not installed on the emulators. This is an environment-state issue, not a code regression; the suite's own PostgreSQL verification (Step 10), offline-recovery (Step 11), and RLS enforcement (Step 12) steps PASS.
- `npm run build` (`tsc && vite build`): PASS (clean production bundle, ~2.7s).
- Playwright E2E: NOT executed in this takeover (not part of the minimal set).
- `npm run verify`: NOT executed (contains local `db reset`; reported instead of run).

## 11. Historical vs Current Comparison
| Area | Historical (baseline docs) | Current (executed now) | Status |
|------|------------|---------|--------|
| Git commit | 759a81c | de18fab (3 commits ahead) | FAIL |
| Web deployment | amaratv-krishi-crm.vercel.app @ 759a81c | crm-blush-omega.vercel.app @ de18fab (old URL still live, orphaned) | FAIL |
| Supabase Migration 6 | Applied to production | SQL objects live (RPC 200) but CLI migration ledger empty | PASS |
| Cloud RLS | Agent lead isolation active | Tables exist, anon reads filtered to 0 rows; trigger fn not anon-observable | PASS |
| Local/Cloud parity | 6 = 6 migrations | Local ledger 6/6; cloud objects present, ledger 0/6 | PASS |
| Authentication | PASS | Auth endpoint healthy; signups disabled; not re-authenticated | NOT TESTED |
| SyncEngine | PASS | Covered by passing Dexie/outbox/conflict suites | PASS |
| Offline queue | PASS | syncOutboxQueue + offline-recovery step PASS | PASS |
| Pagination | PASS | syncPull pagination code unchanged since release commit | PASS |
| Android | 3-emulator sync PASS | Emulators online; APK not installed; multi-device suite FAILs on install step | FAIL |
| Android version | 2.0.0 / 2 | 2.0.0 / 2 | PASS |
| APK | app-release.apk present | Present (7.27 MB); shipped release/ APK differs in size (5.91 MB) | PASS |
| Tests | 102/102 pass, 21 suites | 108/115 pass, 22 suites (7 env-related fails) | FAIL |
| Security | Scan PASS, 0 leaks | securitySecretScan PASS within current run | PASS |
| Production environment | Supabase prod + Vercel prod | Both live and healthy | PASS |

## 12. Differences Discovered
1. HEAD is `de18fab`, not the release commit `759a81c` (3 post-release commits: docs, deployment-identity alignment, toolchain docs).
2. Migration 6 SQL file entered git AFTER the release commit (in `be4d3c0`), although the SQL itself is live on production.
3. Working tree dirty: docs-only modifications + uncommitted deletion of `docs/project-knowledge/15_CODEBASE_INDEX.md` + untracked `GATES.md`, docs 22/23, test artifacts.
4. Production web URL shifted: managed production is `crm-blush-omega.vercel.app`; the takeover brief's URL `amaratv-krishi-crm.vercel.app` is a live but orphaned legacy deployment.
5. Remote `supabase_migrations` ledger is empty (migrations applied outside CLI tracking).
6. APK not installed on the three emulators -> multi-device suite fails 7 steps; historical run had the APK installed.
7. Test counts differ: historical 102 tests/21 suites vs current 115 tests/22 suites (suite growth in post-release commits).
8. `docs/FINAL_RELEASE_CANDIDATE.md` and `docs/RELEASE_BASELINE_AUDIT.md` named in the takeover brief DO NOT exist; closest equivalents are `docs/FINAL_RELEASE_VERIFICATION.md` and `docs/RELEASE_CANDIDATE_VERIFICATION.md`.
9. `.env.staging` no longer empty; it now points at the production project (still no dedicated staging project).
10. `JAVA_HOME`/`ANDROID_HOME` unset: Android rebuild blocked (documented in `20_TOOLCHAIN_CLI_STATUS.md`).

## 13. Current Blockers
- B1: Multi-device emulator suite requires the release APK installed on emulators 5556/5558/5560 (install blocked while JAVA_HOME/ANDROID_HOME unset if a rebuild is needed; existing APK can be installed via adb without rebuilding).
- B2: Remote migration ledger empty - any future `supabase db push` would try to re-apply migrations 1-6; needs a human decision (baseline/repair) before any migration work.
- B3: No dedicated staging Supabase project.
- B4: No CI/CD (.github absent).
- B5: Orphaned legacy Vercel deployment still publicly serving.

## 14. Recommended Next Action
1. Install the existing release APK on the three emulators (`adb install -r android/app/build/outputs/apk/release/app-release.apk`) and re-run `npm test` to confirm 115/115 without any rebuild.
2. Decide the git baseline: either tag `759a81c` as the release marker and accept `de18fab` as current, or commit the pending docs drift - human decision, no action taken.
3. Repair the Supabase migration ledger (e.g. `supabase migration repair` / baseline) under human supervision before any future `db push`.
4. Retire or redirect the orphaned `amaratv-krishi-crm.vercel.app` deployment.

## 15. Takeover Verdict
- TAKEOVER_HAS_DIFFERENCES

---
Historical reports were NOT modified. No deployments, migrations, resets, or production writes were performed.
