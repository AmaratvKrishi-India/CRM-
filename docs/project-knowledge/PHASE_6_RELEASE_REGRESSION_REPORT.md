# PHASE 6 — FINAL RELEASE REGRESSION REPORT

Date: 2026-09-03  
Project: `C:\Users\PC\Desktop\calling app - Copy`  
`PHASE_6_STATUS: NO-GO`  
`FINAL_RECOMMENDATION: NO-GO`

This is the final Phase 6 re-validation. Feature development is frozen. Phase 7 was not started.

## Release Candidate Identity

| Field | Value |
|---|---|
| Project path | `C:\Users\PC\Desktop\calling app - Copy` |
| Branch | `codex/release-readiness` |
| HEAD SHA | `10f111d5683b538b5b00dadc07ccaf1673fe4a3a` |
| Candidate identity | `working-tree@HEAD` plus the scoped uncommitted Phase 6 delta below |
| Immutable candidate commit deployed | **Not available**; no commit was created and no authorized Vercel Preview commit/URL was supplied |
| Application version | `2.0.0` |
| Android application ID | `com.amaratvkrishi.salescrm` |
| Android version | `versionName 2.0.0`, `versionCode 2` |
| `package-lock.json` SHA-256 | `81A2C027F556832EC4FE784D5C47275C1CE7101A1E098CDC051CB475B63C6739` |
| Supabase environment | Disposable local Supabase at `127.0.0.1:15432` for writes/tests; production/Vercel checks read-only only |

## Baseline / Dirty-Tree Boundary

The starting worktree was already substantially dirty. HEAD did not change during this task; no commit, push, reset, clean, discard, stash, production migration, deployment, release, or publication was performed. The local database was used only as a disposable test database.

The Phase 6 release-readiness candidate delta is:

- `capacitor.config.ts`
- `e2e/accessibility.spec.ts`
- `e2e/newBug003-leads-list-race.spec.ts`
- `e2e/tablet-responsive.spec.ts`
- `playwright.config.ts`
- `scripts/ci-test-runner.ts`
- `scripts/csp-header-test.ts`
- `scripts/secret-scanner-test.ts`
- `scripts/security-deps-test.ts`
- `src/App.tsx`
- `src/components/auth/LoginScreen.tsx`
- `src/components/dashboard/SalesDashboard.tsx`
- `src/components/followups/FollowUpsView.tsx`
- `src/components/leads/MinimalLeadsList.tsx`
- `src/components/settings/SettingsModal.tsx`
- `src/index.css`
- `tests/multiDeviceSync.test.ts`
- `vercel.json`
- `supabase/functions/create-agent/index.ts`
- `src/components/admin/AdminDashboardView.tsx`
- `src/components/import/ExcelImporter.tsx`
- this report

Classification of the complete `git status --short` snapshot:

- **A — Phase 6 release-readiness work:** the scoped list above, including accessibility fixes, the dedicated tablet project/test, bounded Android harness changes, security scanners/header configuration, and fail-closed verifier hardening.
- **B — Existing unrelated user work:** all other pre-existing tracked modifications/deletions and untracked project files, including broad application/service/test/documentation/package changes outside the list above. They were preserved untouched.
- **C — Generated/build output:** `dist/`, Android build output, Playwright/test-results/reports, Graft cache, and generated APK/snapshot artifacts. They were retained; no cleanup was used to make the tree appear clean.

### Explicit candidate manifest

| Category | Manifest / treatment |
|---|---|
| A — release candidate scope | The Phase 6 list above, including the `vercel.json` header policy, the hardened `create-agent` Edge Function, and the CSP-compatibility hunks in the two progress-bar renderers. In already-dirty shared files, only those scoped hunks are candidate remediation; unrelated existing hunks remain Category B. |
| B — existing user work | Every other path in the initial dirty-tree snapshot. Category B was preserved; nothing was reverted, deleted, reset, cleaned, or stashed. |
| C — generated evidence | `dist/`, Playwright artifacts, security JSON/JSONL outputs, Android build output, APK/snapshot artifacts, and Graft cache. These were retained for evidence and were not used to make the tree appear clean. |

## Current Blocker Table

| Blocker | Status | Evidence observed | Root cause / boundary | Required closure evidence |
|---|---|---|---|---|
| B1 — live Vercel security headers/CSP | **BLOCKED / NO-GO** | The read-only live HTTP response returned 200 but omitted CSP and four required OWASP headers; HSTS did not match the repository policy. | The header policy is only in the uncommitted working tree; no authorized non-production Preview URL, Preview ID, or deployed candidate commit was available. Deployment is prohibited. | Authorized non-production Vercel Preview, deployed candidate commit identity, actual response headers, and same-preview browser CSP checks. |
| B5 — authenticated agent provisioning | **BLOCKED / NO-GO** | No isolated staging project, function version, identity set, or authenticated end-to-end evidence exists. Local/mock and disposable-DB checks pass only as supporting evidence. | `.env.staging` and the linked Supabase project resolve to the protected production project; creating users or altering production is prohibited. | Isolated staging proof of admin create, organization/profile/auth/role/membership, agent login, duplicate, non-admin denial, network failure, no orphan, rollback, and audit behavior. |

## Test Discovery

The 143-test and 208-test counts are different intentional runner scopes, not contradictory claims about one suite.

| Suite | Command | Files/scope | Count | CI/release role |
|---|---|---|---:|---|
| Node unit/regression | `npm run test` → `tsx scripts/run-tests.ts` | Top-level `tests/*.test.ts`; explicitly excludes `multiDeviceSync.test.ts` and `realSupabasePostgres.test.ts` | 143 | Expected; release-critical unit/regression subset |
| Vitest/integration | `npm run test:vitest` → `vitest run` | Vitest discovery across 11 files, including nested integration/service/database suites | 208 | Expected; complete intended JS unit/integration suite |
| Real Postgres/RLS | `npx tsx --test tests/realSupabasePostgres.test.ts` | Disposable local Postgres contract suite | 15 | Expected; release-critical database gate |
| Spreadsheet security | `npx tsx --test tests/realExcelParser.test.ts` | Real parser, bounds, malformed/unsupported input, timeout | 7 | Expected; release-critical import gate |
| Secret self-test | `npx tsx --test tests/securitySecretScan.test.ts` | Service-role leak, Android backup, trigger search path | 3 | Expected; release-critical security gate |
| Playwright | `npx playwright test` | 9 files; five standard browser/device projects plus dedicated Tablet project | 207 discovered; 205 passed in the full run | Expected; release-critical E2E gate |
| Three-device Android | `npx tsx --test tests/multiDeviceSync.test.ts` | Three attached emulators and local application workflow | 13 | Expected; release-critical device/sync gate |

There is no duplicate execution caused by `npm run test`: its file filter intentionally covers only top-level Node tests. Vitest is the broader intended suite; the separate real Postgres, spreadsheet, security, Playwright, and Android commands provide environment-specific evidence.

## Dependency And Toolchain

| Command | Exit code | Actual result | Evidence |
|---|---:|---|---|
| `npm ci` | 0 | 552 packages added; 553 audited | terminal run; lock hash above |
| `npm run typecheck` | 0 | TypeScript passed | command result |
| `npm run lint` | 0 | 0 errors; 87 existing warnings only | command result |
| `npm run test` | 0 | 143/143 passed; 38 suites | command result |
| `npm run test:vitest` | 0 on final retry | 208/208 passed; the first full invocation had one local Realtime readiness timeout and exited 1, then the exact suite passed on retry | command result; `tests/integration/supabase-sync.test.ts` |
| `npm run build` | 0 | Vite 8.2.2 build passed; 2,008 modules; only the existing ineffective dynamic-import warning for `authService.ts` | command result; `dist/` |
| `npm audit --audit-level=high` | 0 | No high/critical audit findings; four moderate `uuid` advisories remain and are documented below | command result |

## Database / Migration

All database writes were local/disposable. `npx supabase db lint --local` exited 0 with no schema errors. `npx tsx --test tests/realSupabasePostgres.test.ts` exited 0 with 15/15 passing, covering the expected 10-table schema, deterministic seed, constraints, immutable triggers, admin/agent/cross-organization RLS, admin-only tables, CRUD, LWW behavior, and duration invariants.

Migration list verified:

1. `20260820000001_phase2e_central_schema.sql`
2. `20260820000002_phase2e_rls_policies.sql`
3. `20260820000003_phase2j_call_duration_indexes.sql`
4. `20260820000004_phase2k_realtime_publication.sql`
5. `20260820000005_phase2k_bulk_assignment.sql`
6. `20260820000006_rls_agent_lead_isolation.sql`
7. `20260820000007_call_records_extended_fields_and_lead_delete.sql`

Result: `MIGRATIONS: PASS (local only)`, `SCHEMA: PASS`, `RLS: PASS`. No production migration was run. Local schema/RLS evidence is in `tests/realSupabasePostgres.test.ts` and `test-results/phase6/local-public-schema.sql` where present.

## Authentication / Authorization

Fresh login, logout/session clearing, account switching, demotion/deactivation/revocation behavior, direct authorization paths, and re-authentication are covered by the Vitest auth suites, local Postgres/RLS suite, browser flows, and the three-device harness. Service-role access was not used as proof of authenticated isolation. The unauthenticated create-agent contract and error paths pass, but the authenticated create-agent gate remains blocked under Agent Provisioning below.

## User Isolation

`tests/multiDeviceSync.test.ts` verified real Agent A and Agent B login and UI lead isolation; the local Postgres suite and access-scope tests verified underlying data/API isolation. IndexedDB/Dexie access is scoped by authenticated user and organization, and account-switch/revocation tests verify cached authorization is not treated as current authorization. Result: `PASS`.

## Organization Isolation

Cross-organization reads/writes and assignment boundaries were checked against local Postgres policies and application-level flows. The three-device run used one admin and two agents and verified permitted propagation without cross-agent visibility. Result: `PASS`.

## Sync / Offline

The final three-device run passed 13/13 tests, including UI login/workflow, direct local fixtures for independently verified 90-second/45-second call durations, assignment propagation, admin verification, offline queue recovery, RLS enforcement, and cleanup. Browser/Vitest coverage also exercised retry, conflict/LWW, cursor, queue, realtime, background/foreground, restart, and account-switch behavior. Result: `PASS`; the first Vitest Realtime timeout is recorded as an observed transient failure, not hidden.

## Agent Provisioning

`AUTHENTICATED_AGENT_PROVISIONING: BLOCKED`.

No isolated disposable authenticated staging Supabase project and identity set was available. `.env.staging` points to the protected production Supabase project, so it was not used. The authenticated create-agent Edge Function requires the protected administrative path; service-role or production credentials cannot substitute for the required authenticated end-to-end proof.

The scoped hardening in `supabase/functions/create-agent/index.ts` now rejects non-POST requests and malformed JSON, requires the configured anon/service-role server keys, fails closed on duplicate-profile lookup errors, derives organization and `AGENT` role from the authenticated admin profile, sanitizes the response, isolates profile/auth cleanup failures, and resolves ambiguous append-only audit writes before compensation. The client continues to cache a profile only after the server returns a verified organization/role/status.

Supporting local evidence: `npx tsx --test tests/phase2Authentication.test.ts tests/bugfixRegression.test.ts tests/securitySecretScan.test.ts` passed 28/28, but these are local mocks/data-layer checks, not authenticated staging proof.

| Required B5 proof | Status | Why it remains unverified |
|---|---|---|
| Admin creates agent | **BLOCKED / NOT VERIFIABLE** | No isolated authenticated staging endpoint/identity set. |
| Returned organization ID persists to profile | **BLOCKED / NOT VERIFIABLE** | Production-backed function could not be invoked. |
| Profile, Auth identity, role, and organization membership | **BLOCKED / NOT VERIFIABLE** | This schema represents membership with `profiles.organization_id`; no separate membership table was invented or deployed. |
| Created agent login | **BLOCKED / NOT VERIFIABLE** | No staging identity was created. |
| Duplicate handling | **BLOCKED / NOT VERIFIABLE** | Local duplicate/error paths pass; actual isolated Auth/profile duplicate behavior was not exercised. |
| Non-admin denial | **BLOCKED / NOT VERIFIABLE** | Source requires an active `ADMIN`; live authenticated denial was not exercised. |
| Network failure / no orphan | **BLOCKED / NOT VERIFIABLE** | Local service tests pass; deployed function failure/cleanup state was not observed. |
| Profile/Auth rollback, including rejected cleanup calls | **BLOCKED / NOT VERIFIABLE** | Compensation is hardened in source, but no controlled staging failure injection was authorized. |
| Audit event and ambiguous audit-write reconciliation | **BLOCKED / NOT VERIFIABLE** | Source now uses a deterministic audit ID and append-only-safe state resolution; no staging audit row was inspected. |

This is open blocker 5.

## Browser / Playwright

`npx playwright test --list` reported 207 tests in 9 files. The full run executed all 207 tests and exited 1 with 205 passed and two Mobile Safari failures. The API spec remains environment-gated when `E2E_API_BASE_URL` is absent; local data/API behavior is covered by the database and application suites.

The race regression selectors were updated only where agent headings changed from `h3` to `h2`; admin selectors remained `h3`. `npx playwright test e2e/newBug003-leads-list-race.spec.ts` passed 10/10.

Visual regression was intentionally kept unchanged. The CSP-compatible progress-bar conversion initially produced a 70-pixel Mobile Safari admin-dashboard delta; adding the matching rounded SVG geometry and explicit semantic fill tokens restored the baseline. The final targeted check, `npx playwright test e2e/visual-regression.spec.ts --project="Mobile Safari" --grep "admin dashboard"`, passed 1/1. No blind snapshot regeneration was used.

## Tablet

A dedicated Tablet project was added in `playwright.config.ts` at 1024×768 with touch enabled and a dedicated `e2e/tablet-responsive.spec.ts`. It passed 2/2 in the final full Playwright run. Coverage includes agent login/dashboard/leads/detail/outcome/follow-up workflow, no horizontal overflow, admin agent-management boundary, sign-out, and second-user role-boundary checks. Desktop/mobile projects remain enabled. Result: `PASS`; blocker 3 closed.

## Accessibility

The accessibility helper obtains axe violations and asserts an empty violation list; it does not suppress findings. The full run recorded one Mobile Safari Settings-modal color-contrast failure, while the immediate targeted rerun of that exact test passed 1/1 with zero violations. The failure was not caused by the B1/B5 files; it is recorded as a transient current-run observation and should be repeated in CI before a GO decision. No accessibility finding is being hidden.

## Android

Verified toolchain: Maestro 2.10.0, Java 21.0.12 LTS, Gradle 8.14.3, ADB 1.0.41 / platform-tools 37.0.0, and emulators `emulator-5554`, `emulator-5556`, `emulator-5558`.

| Procedure | Exit code | Result |
|---|---:|---|
| `npm run build` | 0 | Web bundle passed |
| `npx cap sync android` | 0 | Android assets synced with production HTTPS scheme; local HTTP is opt-in only for the disposable harness |
| `android\gradlew.bat assembleDebug --no-daemon` | 0 | Debug APK built |
| `android\gradlew.bat assembleRelease --no-daemon` | 0 | Release APK built; unsigned/not published |

Result: `ANDROID_DEBUG: PASS`, `ANDROID_RELEASE: PASS`, `ANDROID_SMOKE: PASS` for launch/login-screen and valid login smoke. No production artifact was signed, published, or released.

## Three-Device

`npx tsx --test tests/multiDeviceSync.test.ts` completed 13/13 with exit 0 on the final confirmation run using:

- Device A: admin
- Device B: Agent A
- Device C: Agent B

The harness builds a local-configured debug APK, verifies loopback asset configuration, installs it, performs real UI login and app workflows, uses bounded CDP-forwarding retries, and independently verifies database/RLS outcomes. Direct REST fixtures are used only for the telephony-duration invariant that a native dialer cannot produce deterministically in an attached WebView. This is real application-level evidence, not a database-only substitute. Result: `PASS`; blocker 4 closed.

## Maestro

The valid `e2e/maestro/auth/login.yaml` passed on `emulator-5554` with the local seeded agent account. `maestro/phase3-blocker-smoke.yaml` also passed its launch/login-screen assertions. The existing `e2e/maestro/auth/logout.yaml` is not executable in the installed Maestro 2.10.0 syntax (`waitFor` is rejected) and references legacy IDs (`agent-dashboard`, `profile-menu`, `logout-button`, `login-screen`, `login-form`) absent from the current source. It was run and exited 1; this is recorded as a stale test-fixture limitation, not converted to PASS. Current logout/session behavior is covered by browser and auth/data-layer tests; the real Android harness covers authenticated application workflows. Result: `MAESTRO: BLOCKED/NOT FULLY VERIFIABLE` for the legacy logout fixture; no new release blocker is invented beyond the two already-open mandatory blockers.

## Security

`npx tsx --test tests/securitySecretScan.test.ts` exited 0 with 3/3 passing. The final source scan exited 0 after scanning 497 files: 0 critical/high findings, 8 moderate scanner observations (5 Supabase URLs and 3 configuration-file path observations), and 78 low Azure-UUID observations. The final dist scan exited 0 after scanning 102 files: 0 critical/high/moderate findings and 3 low Azure-UUID observations. The scanner's configured threshold passed; the moderate observations are retained in the evidence and are not represented as zero findings.

The scanner now exempts only an exact match to the configured public `VITE_SUPABASE_ANON_KEY` under its Supabase-JWT/JWT-token rules; arbitrary JWTs remain reportable. No service-role key, private key, password, or access token was found by the self-tests/source/dist checks.

The dependency security harness exited 0 at `--fail-on=high` with OSV, OWASP dep-scan, auditfix, and supply-chain-guard executed. `npm audit --audit-level=high` also exited 0 but reports four moderate `uuid <11.1.1` advisories through `exceljs@4.4.0` and Capacitor CLI → xcode. The available forced fix would install `exceljs@3.4.0` and is a breaking downgrade; it was not applied.

Spreadsheet security: `npx tsx --test tests/realExcelParser.test.ts` exited 0 with 7/7 passing. Installed tree evidence is `read-excel-file@9.3.10`, `papaparse@5.7.0`, `exceljs@4.4.0`, with no installed `xlsx` package and no `vendor-xlsx` bundle. File-size, row/column, timeout, malformed-input, unsupported-input, and duplicate-header protections remain covered.

## Security Headers / CSP

The intended hosting architecture is Vercel static hosting. `vercel.json` now declares a restrictive CSP and the required OWASP headers; `style-src` is `self` only because the two existing dynamic progress bars were converted from inline styles to CSP-compatible SVG attributes/classes. No repository server, middleware, or reverse-proxy layer was found. Repository configuration validation and built-HTML inline-style compatibility both passed. The actual host was checked read-only:

Command: `npx tsx scripts/csp-header-test.ts --url https://crm-blush-omega.vercel.app --output test-results/security/phase6-b1-live-csp-20260903-final.json --strict`  
Exit code: **1**  
Actual result: CSP missing; CSP score 0/100; OWASP score 15/100; overall 6/100. A separate read-only `HEAD` response was HTTP 200 from Vercel with `X-Vercel-Cache: HIT`, but its `Last-Modified` timestamp and headers did not identify the current working-tree candidate.

| Header | Expected | Actual at live host | Result |
|---|---|---|---|
| Content-Security-Policy | Restrictive policy from `vercel.json` | Missing | **FAIL / BLOCKED** |
| X-Content-Type-Options | `nosniff` | Missing | **FAIL / BLOCKED** |
| X-Frame-Options | `DENY` | Missing | **FAIL / BLOCKED** |
| Referrer-Policy | `strict-origin-when-cross-origin` | Missing | **FAIL / BLOCKED** |
| Permissions-Policy | camera/microphone/geolocation/payment/USB disabled | Missing | **FAIL / BLOCKED** |
| Strict-Transport-Security | `max-age=31536000; includeSubDomains; preload` | Present but `max-age=63072000; includeSubDomains; preload` | **FAIL / MISMATCH** |

The repository policy/configuration check passed, but deployment is prohibited and no authorized Vercel Preview URL, Preview ID, or deployed commit identity is available. Therefore repository configuration cannot be treated as proof that the actual host is protected. Same-preview browser CSP enforcement checks are `NOT VERIFIABLE`; the local Playwright suite is not a live CSP proof. `B1_SECURITY_HEADERS: BLOCKED`, `B1_CSP: BLOCKED`, and blocker 1 remains open.

## Verification Script Integrity

The fail-closed review covered `scripts/verify.ts`, `scripts/run-tests.ts`, `scripts/ci-test-runner.ts`, `scripts/security-deps-test.ts`, `scripts/secret-scanner-test.ts`, and `scripts/csp-header-test.ts`. The four executed gate scripts now force exit 1 for unexpected top-level errors instead of logging an exception and potentially returning success. `scripts/run-tests.ts` propagates the child test status.

Command: `npx tsx scripts/verify.ts --self-test`  
Exit code: 0. The intentional failing command was recorded as `FAIL`, the successful command as `PASS`, and the self-test only passed when both dispositions were correct. The full legacy verifier was not run because it intentionally rewrites pre-existing release documentation/Gates files and can reset the local database; that would violate the dirty-tree preservation boundary.

## Regression Comparison

| Gate | Previous Phase 6 status | Current status | Regression? | Evidence |
|---|---|---|---|---|
| Toolchain/unit/build | Passing | Passing | No | toolchain commands above |
| Local schema/RLS | Passing | Passing | No | `tests/realSupabasePostgres.test.ts`, local lint |
| Browser E2E | Passing with investigated failures | 205/207 in the full run; final targeted affected visual check 1/1 | Current run requires follow-up | `npx playwright test`; targeted visual rerun |
| Accessibility | Blocked by serious findings | Full run had one Mobile Safari Settings contrast failure; targeted rerun 1/1 with 0 violations | Transient/current-run observation; repeat in CI | `e2e/accessibility.spec.ts` |
| Tablet coverage | Missing | 2/2 dedicated tests passed | No; remediated | `e2e/tablet-responsive.spec.ts` |
| Three-device sync | CDP attach blocked | 13/13 real app tests passed | No; remediated | `tests/multiDeviceSync.test.ts` |
| Public key/dependency disposition | Required | Exact public-key false positive closed; moderate dependencies policy-accepted | No; disposition complete | scanner outputs; Phase 5 policy |
| Live security headers | Not verified/failing | Still absent at actual host | No; remains open | live CSP output JSON |
| Authenticated provisioning | Not proven | Still unavailable without isolated staging | No; remains open | provisioning section above |

## Remaining Risks

- The actual Vercel host does not return the required CSP/OWASP headers. A deployment/hosting-layer change and a fresh live read-only check are required.
- No isolated authenticated staging environment exists for end-to-end agent provisioning proof.
- The checked-in Maestro logout flow is stale and not executable with the current Maestro syntax/IDs; browser and real Android harness evidence covers the current behavior, but the legacy flow itself is not evidence.
- One initial Vitest run hit a local Realtime readiness timeout; the final retry passed 208/208, and the Android/local Postgres gates also passed.
- The full browser run observed one Mobile Safari Settings-modal contrast failure; the exact targeted rerun passed 1/1, but CI should repeat the complete matrix before release.

## Accepted Risks

- Four moderate `uuid` advisories are retained under the Phase 5 toolchain policy: the force fix is a breaking `exceljs` downgrade, no high/critical npm audit finding exists, and the affected paths are development/tooling or parser dependency paths as documented in `docs/project-knowledge/PHASE_5_TOOLCHAIN_SECURITY_2026-09-02.md`.
- Low Azure UUID scanner observations are retained as non-secret observations; no high/critical secret finding remains.

These accepted risks do not waive the two blocked mandatory release gates.

## Release Blockers

1. **B1 — Live security headers/CSP:** `vercel.json` contains the intended policy, but the actual host returned no CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, or Permissions-Policy and an HSTS mismatch. Deployment is prohibited in this task, so the gate is `BLOCKED / NO-GO`.
2. **B5 — Authenticated agent provisioning:** no isolated authenticated staging environment is available; service-role/error-path checks cannot substitute for the required authenticated create/duplicate/rollback/audit workflow. The gate is `BLOCKED / NO-GO`.

B2 accessibility has a targeted rerun pass but one full-run Mobile Safari contrast observation requires CI follow-up; B3 tablet coverage, B4 three-device sync, and B6 public-key/dependency disposition are supported by the evidence above. This does not change the mandatory B1/B5 NO-GO decision.

## Final Recommendation

**NO-GO.** The scoped code hardening, toolchain, local database, focused provisioning paths, and targeted final browser checks pass, but the mandatory release decision cannot be GO while live hosting headers/CSP and authenticated agent provisioning remain unverified. The full browser matrix also recorded one Mobile Safari accessibility failure that needs CI follow-up. No production system, deployment, release, push, or Phase 7 work was performed.

## Final Decision Record

```text
PHASE_6_STATUS: NO-GO
FINAL_RECOMMENDATION: NO-GO
BRANCH: codex/release-readiness
HEAD_SHA: 10f111d5683b538b5b00dadc07ccaf1673fe4a3a
APP_VERSION: 2.0.0
ANDROID_VERSION: com.amaratvkrishi.salescrm versionName=2.0.0 versionCode=2
PACKAGE_LOCK_SHA256: 81A2C027F556832EC4FE784D5C47275C1CE7101A1E098CDC051CB475B63C6739

TEST_INVENTORY: npm test 143; Vitest 208; Playwright 207 discovered / 205 passed in full run; targeted affected visual 1; targeted affected accessibility 1; Postgres/RLS 15; spreadsheet 7; security self-test 3; three-device 13
NPM_CI: PASS (exit 0)
TYPECHECK: PASS (exit 0)
LINT: PASS (exit 0; 87 existing warnings, 0 errors)
UNIT_TESTS: PASS (143/143)
INTEGRATION_TESTS: PASS after retry (208/208; first run had one local Realtime timeout)
BUILD: PASS (exit 0)
NPM_AUDIT: PASS at high threshold (exit 0; 4 moderate uuid advisories retained)

DATABASE: PASS local disposable only
MIGRATIONS: PASS (7 migrations)
SCHEMA: PASS
RLS: PASS

USER_ISOLATION: PASS
ORG_ISOLATION: PASS
AUTH_REVOCATION: PASS in app/data-layer suites
LOGOUT: PASS in browser/auth suites; Android legacy Maestro logout fixture stale
ACCOUNT_SWITCH: PASS in auth/sync suites

SYNC: PASS
OFFLINE_RECOVERY: PASS
CURSOR_ISOLATION: PASS
QUEUE_ISOLATION: PASS
CONFLICT_HANDLING: PASS
REALTIME: PASS after retry

AGENT_PROVISIONING: BLOCKED / NO-GO (no isolated authenticated staging)

PLAYWRIGHT: 205/207 passed in full run; targeted affected visual PASS (1/1)
MOBILE_PLAYWRIGHT: PASS
TABLET_PLAYWRIGHT: PASS (2/2 dedicated tests)
VISUAL_REGRESSION: PASS for final targeted Mobile Safari admin-dashboard check (1/1); full run had one intermediate 70-pixel delta before the rounded semantic-fill fix
ACCESSIBILITY: TARGETED PASS (0 violations in exact Mobile Safari Settings rerun); full run recorded one transient/current-run violation

ANDROID_DEBUG: PASS
ANDROID_RELEASE: PASS
ANDROID_SMOKE: PASS (launch/login smoke)
MAESTRO: BLOCKED / NOT FULLY VERIFIABLE (valid login/smoke pass; legacy logout YAML invalid/stale)
THREE_DEVICE: PASS (13/13 real app tests)

SECURITY_HEADERS: BLOCKED / NO-GO (live host missing required headers)
CSP: BLOCKED / NO-GO (live CSP missing; strict check exit 1)
SECRET_SCAN: PASS (0 high/critical; exact public-key disposition)
DIST_SCAN: PASS (0 high/critical; 3 low Azure UUID observations)
DEPENDENCY_SECURITY: PASS at high threshold; 4 moderate npm audit findings retained by policy
SPREADSHEET_SECURITY: PASS (7/7)

VERIFICATION_SCRIPTS: PASS self-test; fail-closed exit handling hardened

CRITICAL_FINDINGS: 1 live-header checker critical classification for missing CSP; 0 secret/dependency critical findings
HIGH_FINDINGS: live-header high findings for missing/incorrect headers; 0 secret/dependency high findings
MEDIUM_FINDINGS: 8 source secret-scanner observations; 4 moderate uuid advisories; live Referrer/Permissions omissions
LOW_FINDINGS: 78 source and 3 dist low Azure UUID observations

OPEN_BLOCKERS: B1 live security headers/CSP; B5 authenticated agent provisioning staging
ACCEPTED_RISKS: 4 moderate uuid advisories per Phase 5 policy; low Azure UUID observations

FILES_CHANGED: scoped Phase 6 list in Baseline / Dirty-Tree Boundary; unrelated dirty files preserved
COMMITS_CREATED: 0
PUSH_PERFORMED: NO
PRODUCTION_MODIFIED: NO
DEPLOYMENT_PERFORMED: NO

REPORT: docs/project-knowledge/PHASE_6_RELEASE_REGRESSION_REPORT.md
```
