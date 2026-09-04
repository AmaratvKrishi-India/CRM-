# PHASE 5 — TOOLCHAIN AND SECURITY

Date: 2026-09-02  
Scope: `C:\Users\PC\Desktop\calling app - Copy` only  
Phase 5 status: **BLOCKED**

## Executive Summary

Phase 5 toolchain, dependency, parser, CI, security, and Android work was completed in the `- Copy` project only. Existing user changes outside this scope were preserved. No commit, push, deployment, production change, or production API call was performed.

The original diagnosis below captured three release blockers: seven Playwright visual failures, eleven failing legacy Vitest suites, and unavailable Maestro smoke testing. The remediation and clean-install validation recorded at the end of this document resolve all three.

All mandatory local Phase 5 gates now pass: clean install, typecheck, lint with zero errors, the release Node unit suite (143/143), standalone Vitest (208/208), high-severity npm audit gate, secret scan, production build, spreadsheet security tests, complete Playwright (205/205), Android debug/release assembly, and two local-emulator Maestro smoke flows.

No critical or high security findings were identified by the completed Codex Security scan, npm audit gate, or secret scan. Four moderate dependency advisories remain in development/toolchain paths and are documented as accepted non-blocking risks.

## Clean Install

| Item | Evidence |
|---|---|
| Node | `v26.5.0` |
| npm | `11.17.0` |
| Package manager | npm |
| Lockfile | `package-lock.json` |
| Final command | `npm ci` |
| Exit code | `0` |
| Result | 552 packages added; 553 packages audited; installation reproducible |

The clean install emitted deprecation notices for older transitive packages and reported four moderate audit advisories, but completed successfully. npm also reported an `esbuild` install script pending approval; the production build completed successfully afterward.

## Dependency Lock

`package-lock.json` accurately resolves the current `package.json`; the final `npm ci` completed without a lockfile/package mismatch. The vulnerable direct `xlsx` dependency was removed and the lockfile now resolves `read-excel-file` and `papaparse` instead. `npm ls xlsx --depth=0` returned an empty direct dependency tree.

The lockfile change was limited to the dependency/toolchain work required for the parser replacement and browser/security tooling. No mass upgrade or forced audit downgrade was applied.

## Dependency Security

Command: `npm audit --audit-level=high`  
Exit code: `0`  
Result: 0 critical, 0 high, 4 moderate, 0 low.

| Package/path | Version(s) | Severity | Direct/transitive | Production impact | Fix status |
|---|---:|---|---|---|---|
| `@capacitor/cli` → `xcode` → `uuid` | `@capacitor/cli@8.5.1`, `xcode@3.0.1`, `uuid@7.0.3` | Moderate | Direct dev tool with transitive vulnerable dependency | No; build/CLI only | npm reports a force/major-changing remediation path; not applied blindly |
| `exceljs` → `uuid` | `exceljs@4.4.0`, `uuid@8.3.2` | Moderate | Direct dev-only fixture dependency with transitive vulnerable dependency | No; ExcelJS is used only by tests | `npm audit fix --force` proposes breaking `exceljs@3.4.0`; not applied |

The four advisory count represents the vulnerable dependency paths reported by npm. The original direct `xlsx` high-severity findings were removed with that package; no claim of a universal dependency-free audit is made.

## Spreadsheet Parser

The previous direct `xlsx` parser was replaced. Current application parsing is client-side and uses:

- XLSX: `read-excel-file/universal@9.3.10`
- CSV: `papaparse@5.7.0`
- Test-only real XLSX fixture generation: `exceljs@4.4.0` in devDependencies

The import path is `src/components/import/ExcelImporter.tsx` → `readWorkbook` → `parseSheet` → `importRecords` in `src/services/excelParser.ts`. Sample data uses the format-neutral `createWorkbookFromRows` helper.

Supported input formats are `.xlsx` and `.csv`. Legacy `.xls` and other file types are rejected safely.

## Spreadsheet Import Hardening

`src/services/excelParser.ts` now enforces these limits before/while parsing:

| Limit | Value |
|---|---:|
| Maximum input file | 10 MB |
| Maximum rows per sheet | 10,000 |
| Maximum columns per sheet | 50 |
| Maximum sheets | 20 |
| Maximum cells | 500,000 |
| Maximum XLSX uncompressed container size | 50 MB |
| Maximum cell text | 10,000 characters |
| Parse timeout | 10 seconds |

The XLSX path validates ZIP structure, rejects ZIP64 and excessive entries, and caps declared uncompressed size. The CSV path uses non-worker parsing with row/column guards and deadline checks. Errors are converted into safe `SpreadsheetImportError` codes instead of exposing parser internals to the UI. The timeout protects the caller’s result path; JavaScript parser work cannot be forcibly cancelled, so input/container/cell limits remain the primary resource controls.

Command: `npx tsx --test tests/realExcelParser.test.ts`  
Exit code: `0`  
Result: 7/7 passed, including real XLSX bytes, quoted CSV values, empty/malformed/oversized/unexpected files, row/column limits, duplicate classification, Dexie import, and timeout safe failure.

Import security outcomes:

| Case | Result |
|---|---|
| Valid spreadsheet | PASS |
| Empty spreadsheet | SAFE_FAILURE |
| Malformed spreadsheet/workbook | SAFE_FAILURE |
| Oversized file | REJECTED |
| Excessive rows | REJECTED |
| Excessive columns | REJECTED |
| Unexpected file type | REJECTED |
| Parser timeout/resource exhaustion case | SAFE_FAILURE |

## ESLint

Command: `npm run lint`  
Exit code: `0`  
Result: 0 errors and 87 warnings.

Warnings are visible and non-blocking. They are primarily existing `any` usages and React Hook dependency warnings. No rule was disabled to obtain a pass, and CI runs the same `npm run lint` command. The requested known baseline was 0 errors/93 warnings; the current run is 0 errors/87 warnings without hiding output.

## Vitest

`vitest.config.ts` is now the single authoritative Vitest configuration. It defines happy-dom, explicit suite discovery, setup files, source aliases, coverage thresholds, timeouts, one-thread execution, deterministic sequence settings, no retries, and CI-compatible reporters. The duplicate stale top-level Vitest configuration was removed from `package.json`.

Release unit command:

Command: `npm test -- --runInBand`  
Exit code: `0`  
Result: 143 tests passed, 0 failed, 0 cancelled, 0 skipped across 38 suites; process terminated normally.

The Node runner keeps the project’s original direct `tests/*.test.ts` scope explicit and leaves the external Docker/hardware suites out of that command. No test files were deleted. The nested Vitest-authored suites were run separately and were not suppressed when they failed. The existing Vitest setup contains fake timers for those legacy suites; no fake timers or timeout changes were added to manufacture a release-unit pass.

Standalone Vitest diagnostic:

Command: `npm run test:vitest`  
Exit code: `1`  
Result: 11 failed suites, 0 tests executed. Failures are stale/missing `ConflictResolver` imports, missing `supabase-test`, an incompatible Dexie mock, a missing setup import, a syntax error in `tests/utils/date-utils.test.ts`, missing utility modules, and renamed repository imports. This remains a release blocker rather than being excluded.

## Vite

Command: `npm run build`  
Exit code: `0`  
Result: TypeScript compilation and Vite production build succeeded; 2,007 modules transformed.

The production bundle has no source maps configured, no debug injection, and no server/service-role credential configuration. Client configuration reads only public `VITE_*` values. The spreadsheet dependency is isolated into a `vendor-spreadsheet` chunk. Localhost is used only by the development server and Playwright local web server configuration, not as a production API dependency. Source and generated-artifact checks found no application service-role credential value.

## Playwright

Configuration provides Chromium, Firefox, WebKit, Mobile Chrome, and Mobile Safari projects; local Vite web-server startup; explicit baseURL override support; bounded action/navigation/test timeouts; CI retries/workers; and API-test protection through `E2E_API_BASE_URL`. Test discovery listed 205 tests across the five configured projects, and browser binaries were installed locally.

Command: `npm run test:e2e:chromium`  
Exit code: `1`  
Result: 41 tests ran; 34 passed and 7 failed.

Passing browser coverage includes authentication, CRM navigation, lead creation/detail, follow-ups, WhatsApp modal, mobile responsiveness, import/backup regression, IndexedDB race regressions, theme behavior, and accessibility test execution. Accessibility diagnostics logged serious color-contrast and landmark findings, although the existing tests currently log rather than fail on those violations.

The seven failures are existing visual baselines: agent dashboard desktop/mobile, create-lead modal, night theme, day theme, admin dashboard, and follow-ups. Differences ranged from 1 to 275 pixels. Snapshots were not regenerated and thresholds were not loosened.

The API Playwright file requires an explicit non-production `E2E_API_BASE_URL`; it was intentionally not pointed at production and therefore was not run. This is documented as a deferred environment prerequisite, not a fabricated pass.

## CI

`.github/workflows/test-suite.yml` was reduced to commands that exist and are locally meaningful:

- `npm ci`
- `npm run typecheck`
- `npm run lint`
- `npm test -- --runInBand`
- `npm audit --audit-level=high`
- `npx tsx scripts/secret-scanner-test.ts --fail-on-found`
- `npm run build`
- `npx playwright install --with-deps chromium`
- `npm run test:e2e:chromium`
- `npx cap sync android`
- `android/gradlew assembleDebug assembleRelease --no-daemon`

The Android job uses Java 21 and runs after the web-quality job. No meaningful validation was removed to make CI green; the standalone Vitest and Maestro blockers remain visible in this report.

## Android Toolchain

| Item | Value/evidence |
|---|---|
| Java | JDK 21, Android Studio bundled JBR `21.0.10` used explicitly on this workstation |
| Gradle | Wrapper `8.14.3` |
| Android SDK | min 24, compile 36, target 36 |
| Application ID | `com.amaratvkrishi.salescrm` |
| Version | `versionCode 2`, `versionName 2.0.0` |
| Signing | Release signing is used only when an explicit external keystore-properties path is supplied; otherwise release assembly is reproducibly unsigned |

Command: `npx cap sync android`  
Exit code: `0`  
Result: Web assets and Capacitor plugins synchronized.

Command: `android/gradlew assembleDebug assembleRelease --no-daemon` with explicit JDK 21  
Exit code: `0`  
Result: Debug and release assemblies succeeded; Gradle reported only existing flatDir/unchecked-operation warnings.

Maestro check: `maestro` is not installed (`NOT_INSTALLED`, exit code 1). Relevant smoke testing is deferred until the CLI, emulator, and test target are provisioned.

## Security Review

Secret scan:

Command: `npx tsx scripts/secret-scanner-test.ts --output test-results/security/secret-scan.json --fail-on-found`  
Exit code: `0`  
Result: 511 files scanned; 0 critical, 0 high, 8 moderate, 78 low. Reported low/moderate types were possible Azure UUIDs, Supabase URL references, and kubeconfig references. The additional references are scanner-visible labels in the project’s documentation and configuration; no credential values are reproduced here.

The completed Codex Security standard scan recorded 0 reportable findings and generated its canonical manifest, findings, coverage, Markdown, and SARIF artifacts. Its workbench warning records that the working tree changed after the original scan snapshot; final-delta changes were manually reviewed and covered by the final command evidence in this report. Delegated review runtime was unavailable due usage limits, and the TAC advisory service returned `USER_NOT_LOGGED_IN`; neither condition was hidden or retried.

Manual application-source review found no service-role credential value, private-key block, unsafe HTML sink, `eval`, or `new Function`. Local Supabase/Compose credentials were changed to explicit environment substitutions. Verification/probe scripts now require explicit environment configuration rather than embedding tokens. File handling remains bounded in the parser and attachment service; local-only base64 catalogue storage remains a residual resource-consumption risk on a compromised device.

## Validation Results

| Command | Exit code | Result |
|---|---:|---|
| `npm ci` | 0 | Clean install succeeded |
| `npm run typecheck` | 0 | TypeScript check passed |
| `npm run lint` | 0 | 0 errors, 87 warnings |
| `npm test -- --runInBand` | 0 | 143 passed, 0 failed |
| `npm audit --audit-level=high` | 0 | 0 critical/high; 4 moderate advisories |
| Secret scanner with `--fail-on-found` | 0 | 0 critical/high secret findings |
| `npm run build` | 0 | Production bundle passed |
| Real parser security tests | 0 | 7 passed |
| `npx playwright test --list` | 0 | 205 tests discovered across five projects |
| `npm run test:e2e:chromium` | 1 | 34 passed, 7 visual failures |
| `npm run test:vitest` | 1 | 11 legacy suites failed before test execution |
| `npx cap sync android` | 0 | Android assets/plugins synchronized |
| Gradle debug/release assembly | 0 | Both variants assembled |
| `maestro` availability check | 1 | CLI not installed |
| `npx tsx scripts/owasp-validation-test.ts` | 1 | Existing helper scored 97/100; 33/35 ASVS checks, MFA and retention warnings |

## Findings

The original actionable release findings were the browser visual regressions, non-green standalone Vitest suite, missing Maestro prerequisite, and remaining moderate dependency advisories. The first three are resolved in the remediation section below. Existing accessibility diagnostics, the OWASP helper warnings, and moderate toolchain advisories remain follow-up items, but no critical/high vulnerability was found.

## Critical Findings

None identified.

## High Findings

None identified.

## Medium Findings

1. Four moderate npm advisories remain through `uuid` paths under Capacitor CLI tooling and test-only ExcelJS. npm’s available force fix is breaking and was not applied without verification.
2. Existing Playwright accessibility output reports serious color-contrast violations and moderate landmark/heading issues; the current tests log these findings without failing.
3. The OWASP helper reports missing MFA and retention-control evidence: 33/35 ASVS checks passed, overall helper score 97/100.

## Low Findings

The secret scanner reports 78 possible Azure UUID matches, five Supabase URL references, and three kubeconfig references at low/moderate severity. These are references or identifiers rather than exposed credential values; they remain recorded in the generated scan output and were not treated as critical/high findings.

## Accepted Risks

- The moderate dependency paths are confined to build/test tooling, have no verified production runtime impact, and require a breaking remediation path according to npm.
- ESLint has 87 visible non-blocking warnings; the lint error count is zero.
- Localhost endpoints exist in development/Playwright configuration only.
- API Playwright tests require a separately provisioned non-production endpoint and were not pointed at production.
- Android release is reproducibly unsigned when no explicit keystore properties are supplied.

## Blocker Remediation

### Vitest Legacy Suites

**Original failure.** `npm run test:vitest` exited before executing the eleven retained legacy suites because they targeted removed or renamed modules, had obsolete global mocking/timer behavior, used an incompatible Dexie setup, and contained stale test assumptions. A clean-install rerun also exposed one real Realtime test race: a ready channel could miss an unfiltered service-role fixture insert.

**Root cause and remediation.** The retained suite was updated to exercise current public behavior rather than deleted or skipped. Shared test setup now uses isolated Dexie state; current date and validation utilities were restored; the sync engine avoids its static ESM cycle; and the local Supabase harness is loopback-only with precise cleanup. The Realtime test now subscribes to a preselected lead ID and creates that exact lead through the authenticated agent/RLS path after the channel reaches `SUBSCRIBED`.

**Files changed.** The remediation includes `tests/setup.ts`, `tests/helpers/vitestDatabase.ts`, `tests/integration/local-supabase.ts`, `tests/integration/supabase-sync.test.ts`, `tests/integration/dexie-supabase-sync.test.ts`, the retained legacy suites under `tests/db/`, `tests/services/`, and `tests/utils/`, plus `src/services/sync/syncEngine.ts`, `src/services/agentManagementService.ts`, `src/utils/date.ts`, and `src/utils/validation.ts`.

**Evidence and result.** The Realtime test passed three consecutive isolated runs. Final `npm run test:vitest` exited `0`: 11 files, 208 tests passed, 0 failed. The separate release Node suite also exited `0`: 143 tests passed, 0 failed. No suite was removed, skipped, or covered by a weakened assertion.

### Playwright Visual Failures

**Original failure.** Chromium had 34/41 passing with seven screenshot mismatches: agent dashboard desktop/mobile, create-lead modal, day/night theme, admin dashboard, and follow-ups. Extending review to the configured Firefox, WebKit, Mobile Chrome, and Mobile Safari projects exposed browser-specific stale or absent baseline images.

**Root cause and remediation.** The reviewed visual differences were renderer/browser-specific text and icon rasterization, stale snapshots, and a Realtime/background-sync state race. The admin visual is fixed to a deliberate offline Realtime state; the affected dashboard, day-theme, and follow-up screenshots use the application’s normal local-first offline path so their sync badge cannot race the retry scheduler. Targeted project-specific snapshots were refreshed only after visual review. No visual threshold was loosened and no bulk snapshot update was used.

**Files changed.** `e2e/helpers/mockAuth.ts`, `e2e/visual-regression.spec.ts`, and only the affected files in `e2e/visual-regression.spec.ts-snapshots/`.

**Evidence and result.** The focused mobile visual test passed twice per browser (10/10); the complete visual specification passed 55/55; final `npm run test:e2e` from the clean install exited `0` with 205/205 passing across Chromium, Firefox, WebKit, Mobile Chrome, and Mobile Safari. Visual failures: 0.

### Maestro

**Original failure.** The report classified Maestro as unavailable because it was not on the process PATH.

**Root cause and remediation.** The known local installation was present at `C:\maestro\maestro\bin\maestro.bat`; Java 21, Android platform tools, and Maestro were supplied only to the test process. No system-wide PATH change, reinstall, project security change, or production endpoint was needed. The existing login flow was aligned to current `login-email` and `login-password` identifiers.

**Files changed.** `e2e/maestro/auth/login.yaml`; generated JUnit evidence is under the ignored `test-results/maestro/` directory.

**Evidence and result.** Maestro 2.10.0 ran against the local `com.amaratvkrishi.salescrm` target on `emulator-5554`. `maestro/phase3-blocker-smoke.yaml` passed 1/1 (20 seconds), and `e2e/maestro/auth/login.yaml` passed 1/1 (53 seconds). The first smoke execution also completed successfully but initially returned a post-test JUnit output-directory error after `npm ci`; recreating the generated directory and rerunning produced a clean exit `0`.

### Final Regression

The final validation was run after a clean locked install. All listed commands completed with exit code `0` unless noted as an expected absence check:

| Gate | Evidence |
|---|---|
| Clean checkout dependencies | `npm ci`: 552 packages added, 553 audited |
| Lockfile | `package-lock.json` reproduced cleanly; `npm ls xlsx --all` returned an empty tree (expected exit `1` for absence) |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint`: 0 errors, 87 warnings |
| Release Node tests | `npm test -- --runInBand`: 143/143 |
| Standalone Vitest | `npm run test:vitest`: 208/208 |
| Spreadsheet security | `npx tsx --test tests/realExcelParser.test.ts`: 7/7 |
| Dependency security | `npm audit --audit-level=high`: 0 critical, 0 high, 4 moderate |
| Secret scan | `npx tsx scripts/secret-scanner-test.ts --fail-on-found`: 0 critical/high findings |
| Production build | `npm run build`: TypeScript and Vite build passed, 2,008 modules transformed |
| Browser regression | `npm run test:e2e`: 205/205 across all configured projects |
| Android | `npx cap sync android`, then `assembleDebug assembleRelease --no-daemon` with Java 21: both passed |
| Maestro | phase3 blocker smoke and login flows: 1/1 each |

## Current Release Blockers

None in the requested Phase 5 blocker scope. The API Playwright path remains deliberately safety-gated on an explicitly supplied non-production `E2E_API_BASE_URL` and was not pointed at production. The four moderate toolchain/test dependency advisories, existing accessibility diagnostics, OWASP helper follow-ups, lint warnings, and unsigned local Android release fallback remain documented risks rather than critical/high release blockers.

## Final Decision

**PHASE_5_STATUS: PASS**

All three assigned Phase 5 blockers are remediated and every mandatory local validation gate is proven from a clean locked install. Do not proceed to Phase 6 automatically.

## Final Output

PHASE_5_STATUS: PASS  
NPM_CI: PASS (exit 0; 552 packages added, 553 audited)  
LOCKFILE: PASS (`package-lock.json` reproduced by `npm ci`; direct `xlsx` absent)  
DEPENDENCY_SECURITY: PASS (exit 0; 0 critical/high, 4 moderate toolchain/test advisories retained)  

VITEST: PASS (exit 0; 11 files, 208/208 tests)  
VITEST_LEGACY_SUITES: PASS (all 11 former suites retained and repaired; real local RLS/Realtime coverage)  
PLAYWRIGHT: PASS (exit 0; 205/205 across five configured browser projects)  
PLAYWRIGHT_VISUAL_FAILURES: PASS (0; visual spec 55/55)  
MAESTRO: PASS (2.10.0; phase3 blocker smoke 1/1 and login 1/1 on local emulator)  

SPREADSHEET_SECURITY: PASS (7/7; bounded parsing remains active and `xlsx` is absent)  
TYPECHECK: PASS (exit 0)  
LINT: PASS (exit 0; 0 errors, 87 warnings)  
BUILD: PASS (exit 0; production Vite build)  
ANDROID_DEBUG: PASS (exit 0)  
ANDROID_RELEASE: PASS (exit 0)  

CRITICAL_FINDINGS: 0  
HIGH_FINDINGS: 0  
MEDIUM_FINDINGS: 4 moderate npm advisories; existing accessibility and OWASP-helper follow-ups remain documented  
LOW_FINDINGS: 78 possible UUID references from the secret scan; no credential leak found  
RELEASE_BLOCKERS: NONE in the requested Phase 5 scope  

FILES_CHANGED: Blocker remediation touched the Vitest compatibility/coverage files, `e2e/helpers/mockAuth.ts`, `e2e/visual-regression.spec.ts`, affected visual snapshots, `e2e/maestro/auth/login.yaml`, and this report; pre-existing unrelated dirty-worktree changes were preserved.  
COMMITS_CREATED: NO  
PUSH_PERFORMED: NO  
PRODUCTION_MODIFIED: NO  
DEPLOYMENT_PERFORMED: NO
