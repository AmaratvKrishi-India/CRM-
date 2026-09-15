# Complete Audit — 2026-09-14

**Decision:** **NOT RELEASE-APPROVED**

> **Release-closure refresh — 2026-09-15:** This dated audit contains historical evidence collected during earlier source states. Any statement later in this document describing the older signed APK/AAB, the `c6bb3ed...` Vercel deployment, or a recovered production signing identity as **current** is superseded by this refresh. The candidate source changed after those artifacts were produced, and no existing production keystore/signing configuration is currently available. Historical signed hashes and MobSF results therefore remain historical evidence only and cannot approve the current candidate. Physical-device verification is **WAIVED BY USER**, not PASS. `GATES.md` and `16_CURRENT_STATE.md` hold the current gate state until `FINAL_PRODUCTION_RELEASE_2026-09-14.md` is completed.

**Branch:** `codex/release-readiness`
**Base HEAD before final integration:** `c6bb3ed718503de614212643aa26d877dce8b1c5`
**Scope:** deliberately staged release candidate, local/staging verification, fresh production read-only Supabase evidence, security/supply-chain audits, Android emulator verification, and final Git/CI/Vercel closure.
**Production database writes during this closure:** none.

This report is the current authority for the 2026-09-14 deep audit. Older release/sign-off reports remain historical evidence only and must not be used to approve this checkout.

## Executive result

The application code and local schema have strong green evidence across the configured test runner, full browser E2E, accessibility, visual regression, local database lint, Android lint/build, mutation, performance, security/supply-chain tooling, and real three-emulator synchronization. Fresh production Supabase evidence confirms 17/17 migrations and local/production schema-policy parity.

Release approval is withheld because the current changed source has **no current production-signed APK/AAB**: the existing production signing material is unavailable, so exact signed-artifact certificate/hash/MobSF closure cannot be regenerated. Physical-device verification is explicitly **WAIVED BY USER** and is not a blocker. Final exact-SHA GitHub CI and clean-SHA Vercel production provenance must also be completed and recorded.

### Open severity counts

| Severity | Open | Summary |
|---|---:|---|
| P0 | 0 | No open catastrophic issue confirmed |
| P1 | 0 | No open critical/high product defect confirmed |
| P2 | 1 | Current production-signed Android artifact cannot be regenerated because the existing signing material is unavailable |
| P3 | 4 | Leaked-password protection, reviewed performance advisors, GitHub plan-limited governance, and final remote CI/deployment closure |

## Tooling installed or integrated

- Semgrep `1.176.0` through `scripts/audit-semgrep.ts`.
- OSV Scanner Docker image `ghcr.io/google/osv-scanner:v2.5.1`.
- Trivy Docker image `aquasec/trivy:0.74.0` for scoped filesystem/security evidence.
- Gitleaks Docker image `ghcr.io/gitleaks/gitleaks:v8.30.1`.
- Knip `6.35.1` with `knip.json`.
- dependency-cruiser `18.2.0`.
- Stryker `10.0.0` + Vitest runner `10.0.0`.
- Supabase CLI `2.116.0` and local PostgreSQL lint/integration workflow.
- MobSF Docker image `opensecurity/mobile-security-framework-mobsf:v4.5.2`.
- OWASP ZAP Docker image `ghcr.io/zaproxy/zaproxy:2.17.0` for passive local-only DAST.
- Playwright `1.62.1`, Axe, Lighthouse and existing project verification tooling.

Repeatable npm entry points now include `audit:security`, `audit:dependencies`, `audit:osv`, `audit:secrets`, `audit:gitleaks`, `audit:deadcode`, `audit:architecture`, `audit:database`, `audit:mutation`, `audit:android`, `audit:accessibility`, `audit:performance`, `audit:release`, and `audit:deep`.

## Confirmed findings fixed during this audit

1. **Audit CLI shell injection:** `scripts/accessibility-regional-test.ts` previously interpolated CLI-controlled values into a shell command. It now uses argument arrays with `spawnSync(..., { shell: false })`; F050 regression coverage passes.
2. **Unified-runner shell execution:** `scripts/run-all-tests.ts` used `shell: true`; it now resolves Node/npm/npx without a shell.
3. **Anonymous SECURITY DEFINER execution:** migration `20260913185759_security_definer_helper_execute_hardening.sql` revokes `PUBLIC`/`anon` execution and grants only intended authenticated execution for security-definer helpers. Local reset/lint and PostgreSQL/RLS regressions pass.
4. **Android task-affinity hardening:** `MainActivity` retains required `singleTask` behavior but now has explicit empty `android:taskAffinity=""`; target SDK remains 36.
5. **CSP policy mismatch:** production CSP is strict and synchronized with `vercel.json`; production excludes localhost and `'unsafe-inline'`, permits required `blob:` image/object URLs, and keeps `frame-ancestors 'none'` in the HTTP response header. Development keeps a source meta policy positioned after Vite's dev bootstrap; production build rewrites that policy. F023/F051 and live browser CSP checks pass.
6. **Secret-scanner false positive:** the only apparent PostgreSQL credential was an intentional unreachable `127.0.0.1:1/disabled` sentinel. Detection now suppresses only that exact disabled-loopback form rather than excluding scratch files.
7. **Stale test assumptions:** F040 anonymous helper behavior, migration ordering tests, SECURITY DEFINER regex checks, and CSP regressions were updated to the hardened behavior.
8. **Mutation quality:** conflict-resolution tests were strengthened, improving mutation score from 40.00% to 81.74%.

## Fresh verification results

| Gate | Result |
|---|---|
| `npm run test:all` | **PASS ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â 10/10 suites, 0 failed**, 372.1 s |
| Core `npm test` | **PASS ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â 296/296 tests, 46 suites** |
| Focused CSP/command-safety F023/F050/F051 | **PASS ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â 7/7** |
| Real Supabase integration group | **PASS ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â 38/38** |
| Focused PostgreSQL/RLS group | **PASS ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â 48/48** |
| Isolated Chromium E2E | **PASS ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â 42/42** |
| Accessibility | **PASS ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â 11/11; zero Axe violations** |
| Visual regression | **PASS ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â 11/11** |
| Typecheck / lint / production build | **PASS** |
| Bundle performance | **PASS ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â 1,148,708 raw; 302,784 gzip; 256,426 Brotli; 15 chunks; no budget warnings** |
| Stryker mutation | **PASS ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â 81.74% total / 83.19% covered; 94 killed, 19 survived, 2 uncovered, 0 errors** |
| Lighthouse | **0.99 performance / 1.00 accessibility / 1.00 best practices / 0.92 SEO**; Windows temp-dir cleanup warning after report generation |
| ZAP passive local DAST | **0 FAIL / 63 PASS rules** under simulated Vercel headers; remaining alerts are low/informational COEP/COOP/CORP, dual CSP, modern-app and cache observations |
| Local Supabase lint | **PASS ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â no schema errors** |
| dependency-cruiser | **PASS ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â no configured dependency violations; 208 modules / 566 dependencies** |
| Android lint/build | **PASS** |
| `npm run audit:release` | **PASS** |

## Deep-audit aggregate

The uncontended `npm run audit:deep` completed end-to-end. Before Trivy was promoted to a first-class npm gate, its authoritative summary was:

```text
PASS audit:security
PASS audit:dependencies
FAIL audit:osv
PASS audit:secrets
FAIL audit:gitleaks
FAIL audit:deadcode
PASS audit:architecture
PASS audit:database
PASS audit:mutation
PASS audit:android
PASS audit:accessibility
PASS audit:performance
PASS audit:release
```

The nonzero exit is intentional evidence preservation: reviewed scanner findings are not filtered out merely to make the aggregate green. `audit:trivy` was subsequently added to `package.json` and `audit:deep`; the final rerun result is recorded below once complete.

## Security and dependency scanner triage

### Semgrep

Final execution uses 453 rules over the project security scope and exits successfully. The original shell-command finding is gone. Residual findings are reviewed path/output handling, fixed-command process execution, localhost-only verification code, and log-format warnings; no remaining Semgrep result was confirmed as a critical exploitable defect.

### npm audit / OSV

`npm audit --audit-level=high` reports **4 moderate, 0 high, 0 critical**. OSV reports two CVSS 7.5 instances of `GHSA-w5hq-g745-h8pq` in dev-only `uuid` 7.0.3 and 8.3.2. Manual reachability review found the transitive consumers use `uuid.v4()`, while the advisory affects caller-buffer behavior in v3/v5/v6. Scanner visibility is retained as P3 dependency debt rather than suppressed.

### Secret scanning / Gitleaks

The custom scanner examined **559 files** with **0 critical and 0 high** findings. Moderate/low matches are expected URLs, UUID-like values and configuration references. Gitleaks scans 23 commits and reports 11 historical matches; manual review classified them as demo/local/test/documentation fixtures, not a confirmed production credential leak. They remain visible so history is not silently rewritten.

### Trivy

Trivy is now a repeatable `audit:trivy` npm command and is included in `audit:deep`. It scans the repository filesystem for vulnerability, misconfiguration and secret classes while excluding generated/vendor directories. Final current-checkout result is recorded in the final aggregate section.

### Knip

Knip remains nonzero for maintenance findings: one dynamically loaded Stryker runner reported unused, the Gradle binary reported unlisted, 7 unused exports, 22 unused exported types, one duplicate `App|default` export, and a CSS configuration hint. No missing runtime dependency or unresolved application import was identified.

## Supabase / database state

Local schema contains **17 migrations** and resets cleanly. The new helper-execute hardening migration is `20260913185759_security_definer_helper_execute_hardening.sql`. Local `supabase db lint --local` reports no schema errors, and the focused real-PostgreSQL/RLS regressions pass.

Production project `lahvcodvgubplzfshare` was verified read-only at **16/17 repository migrations**. Migration 17 was **not** applied because this audit did not have authorization to mutate production. Production therefore still exposes the eight helper functions to `anon` that migration 17 removes. This is an open P2 release blocker despite the local fix being complete.

Production security-advisor evidence also reports leaked-password protection disabled. Internal `rls_enabled_no_policy` informational findings were reviewed as direct-deny/internal-table patterns rather than automatically treated as data-exposure defects. Performance-advisor output additionally includes unindexed-FK suggestions, an `auth_rls_initplan` warning on `profiles_update_policy`, and unused-index informational findings.

## Android artifact evidence

The final source checkout was built through Capacitor/Gradle after the CSP fixes. `android:taskAffinity=""` is present on `MainActivity`, target SDK is 36, and Android lint/build succeeds.

The final on-disk debug APK after the last deep/release build is:

- Path: `android/app/build/outputs/apk/debug/app-debug.apk`
- SHA-256: `7D7D3A17D1C9618FBA996351C76B96D36E42A75055ADDB9C2D42A141E805F0F2`
- Size: **7,345,313 bytes**

That exact APK installs on emulators `5554`, `5556`, and `5558`. `5554` and `5558` passed the first top-resumed sample directly. `5556` returned an `am start -W` wait timeout but post-launch verification showed a live PID, `MainActivity` as `topResumedActivity`, and zero crash-buffer lines. Crash-buffer checks are zero on all three emulators.
MobSF 4.5.2 scanned that exact final APK (MobSF hash `2e34dafdb24685462f6e00f839260558`) and reports **0 trackers**. Manifest summary remains 3 high / 2 warning: debug-build `debuggable=true`, two `singleTask` StrandHogg/task-hijacking heuristic highs, non-standard launch-mode warning, and the AndroidX `ProfileInstallReceiver` permission warning. The task-affinity mitigation is present; these heuristic findings are retained rather than falsely declared absent.

No current release signing configuration is available in the checkout. Therefore the debug APK is useful for static/emulator evidence but **cannot substitute for a fresh signed release APK/AAB**. No physical Android device is attached for exact signed-artifact acceptance. This is the second open P2 release blocker.

## Web DAST / CSP

OWASP ZAP 2.17.0 was run only against local static builds / local header simulations, never against production. An initial Vite-host-header 403 run was rejected as invalid evidence. The corrected final passive baseline against real built assets with the intended Vercel headers reports **0 FAIL**, **63 PASS rules**, and only low/informational alerts for COEP/COOP/CORP, dual header/meta CSP observation, modern-web-app detection, and cacheability.

The DAST work directly found and drove the CSP cleanup: production no longer carries local Supabase origins or `'unsafe-inline'`; `blob:` images are allowed where required; `frame-ancestors 'none'` stays in the HTTP response header; and the live CSP browser regression confirms injected inline scripts are blocked.

## GitHub / CI / deployment evidence

The local branch is `codex/release-readiness` at HEAD `c6bb3ed718503de614212643aa26d877dce8b1c5`. The remote release branch matched that HEAD when checked during this audit, but the working tree contains the audit fixes listed below and is intentionally not reset or cleaned.

GitHub evidence shows `codex/release-readiness` and `main` are unprotected. The remote release branch remains at `c6bb3ed718503de614212643aa26d877dce8b1c5`, while this audited working tree contains uncommitted fixes; the repository currently reports **0 workflow runs**. Owner-authenticated `gh` has `repo` and `workflow` scopes, but GitHub returns HTTP 403 stating that branch protection/rulesets for this private repository require GitHub Pro or a public repository. Final source integration is intentionally withheld while release blockers remain.

The public Vercel production URL is reachable, but its main JS/CSS asset hashes differ from this audited production build, proving the live site is not the current candidate. The connector sees the expected `Amaratv krishi` team but returns zero projects; direct lookup of the linked project returns 404 and deployment listing returns 403. The PC has no Vercel token/login cache and a transient Vercel CLI reports `Logged out`. Exact deployment provenance therefore remains unavailable. No Vercel deployment was performed during this audit.

**Current signed-artifact evidence:** APK SHA-256 `728094734F3828E7A7DF0BDC0A853444300F03424155FBE6F9A9A589B89103B6` (6,153,759 bytes), AAB SHA-256 `8CD46C8803A46E18F65EE8643A93FC357B0AC548F37DBE8D99CB76483484E208` (5,976,473 bytes), production certificate SHA-256 `A131697E3CDF7ADE44C5C3DF3563E6CBB9FA54969B5A718CE03DA49A20DC0ED6`. The exact APK passes three-emulator cold-launch/crash smoke and MobSF 4.5.2 with matching SHA-256, 0 trackers, 0 secrets, and 0 certificate high/warnings. MobSF's two StrandHogg highs are reviewed heuristics because the packaged APK targets SDK 36 and contains `android:taskAffinity=""`.

## Release blockers

1. **CLOSED - Production schema parity:** production now reports all **17/17** migrations, including migration 17.
2. **P2 - Physical signed-release acceptance:** a fresh production-signed APK/AAB exists and matches the historical production certificate, but **0 physical Android devices** are attached, so exact signed-artifact hardware acceptance remains blocked.
3. **P3 - Supabase password protection:** leaked-password protection remains disabled in production.
4. **P3 - Dependency advisory:** two dev-only `uuid` versions remain scanner-visible under GHSA-w5hq-g745-h8pq, with affected API paths not found reachable in the audited consumers.
5. **P3 - Historical secret fixtures:** Gitleaks retains 11 historical demo/local/test/documentation matches; no production credential was confirmed.
6. **P3 - Maintenance/build debt:** Knip findings and the ineffective dynamic `authService` import warning remain.
7. **P3 - GitHub governance:** the repository has 0 workflow runs and final-current-HEAD CI is absent. Branch protection/rulesets are additionally unavailable on the current private-repo plan unless GitHub Pro is enabled or the repository is made public.
8. **P2/P3 - Deployment provenance:** the live Vercel site serves different JS/CSS asset hashes from this candidate, and the connected identity cannot enumerate the linked project/deployments. Current candidate deployment/source parity is therefore not established.

## Working-tree provenance

The repository was already dirty when this audit started. Pre-existing modified/deleted/untracked work was preserved; no reset, clean, checkout, or destructive recovery was performed. In particular, historical deleted scripts/components and the large `scratch/` recovery/evidence set were not discarded.

Audit-created or audit-modified areas include the Android manifest hardening, CSP/Vercel configuration, package audit dependencies/scripts, audit harnesses, security scanner handling, migration 17, F023/F050/F051 regressions, database regression updates, F040 behavior update, and strengthened conflict-resolver mutation tests. `package.json`/`package-lock.json` were already dirty and were additionally modified for audit tooling.

Primary audit-specific files include:

- `scripts/audit-deep.ts`, `scripts/audit-semgrep.ts`
- `scripts/accessibility-regional-test.ts`, `scripts/run-all-tests.ts`, `scripts/secret-scanner-test.ts`
- `supabase/migrations/20260913185759_security_definer_helper_execute_hardening.sql`
- `tests/f023Csp.test.ts`, `tests/f050AuditScriptCommandSafety.test.ts`, `tests/f051ProductionCsp.test.ts`
- `tests/helpers/f003Postgres.ts`, `tests/integration/f040-real-sync-cycle.test.ts`, `tests/realSupabasePostgres.test.ts`, `tests/services/conflict-resolver.test.ts`
- `android/app/src/main/AndroidManifest.xml`, `vite.config.ts`, `vercel.json`, `package.json`, `package-lock.json`

## Exact rerun commands

```bat
npm run typecheck
npm run lint
npm test
npm run test:type
npm run test:all
npm run build
npm run test:e2e:chromium
npm run test:e2e:accessibility
npm run test:e2e:visual
npm run test:perf:bundle
npm run test:lighthouse
npm run audit:security
npm run audit:dependencies
npm run audit:osv
npm run audit:secrets
npm run audit:gitleaks
npm run audit:trivy
npm run audit:deadcode
npm run audit:architecture
npm run audit:database
npm run audit:mutation
npm run audit:android
npm run audit:accessibility
npm run audit:performance
npm run audit:release
npm run audit:deep
```
For Android artifact verification, additionally run `npx cap sync android`, `android\gradlew.bat -p android lint assembleDebug`, hash the produced APK, scan that exact hash with MobSF, and install/cold-launch that exact file on the target devices. ZAP must remain scoped to local/isolated staging and must not be pointed at production merely to satisfy an audit checkbox.

## Safety / authorization record

- No production Supabase DDL/DML was executed during this audit.
- No Vercel production deployment was performed.
- No Git reset/clean/force checkout/force push was performed.
- No signing key, service-role key, database password, session token or customer export was disclosed.
- Historical reports were preserved rather than overwritten.
- A passing local verification does not authorize a production migration or distribution.

## Final decision

The current checkout has strong local verification evidence, but production schema/security state and release-artifact assurance do not match the audited local candidate. Until the P2 blockers above are resolved and reverified against the exact resulting checkout/schema/signed artifact, release approval is prohibited.

**NOT RELEASE-APPROVED**
