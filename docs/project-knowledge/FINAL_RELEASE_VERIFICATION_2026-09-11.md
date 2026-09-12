# Final Release Verification — 2026-09-11

**Status:** CURRENT FINAL-CANDIDATE EVIDENCE  
**Decision:** **NOT RELEASE-APPROVED**  
**Branch:** `codex/release-readiness`  
**HEAD:** `edc8b3fd3a1169d1f2e3ca4bf19fadbb5844ae7a`  
**Application version:** `2.0.0` (`versionCode` 2)  
**Application-input fingerprint:** `c6326d9d73da2bac450d8d51216ec0d382714318ffd9966c37002d9b5aa0879d` across 355 Git-visible application, test, Android, and Supabase input files

This report supersedes the September 9 sign-off for the current dirty working tree. It records verification of the exact application inputs above. It does not authorize a production deployment or migration.

## Release decision

The code and isolated-staging gates completed successfully, but the candidate is not releasable. Production has only 7 of the 14 repository migrations, and the production signing keystore is not present in this workspace. Consequently, no signed exact-candidate APK/AAB could be produced, certificate-verified, installed, or smoke-tested.

## Required local gates

| Command / gate | Result | Evidence |
|---|---|---|
| `npm test -- --runInBand` | PASS | 285/285 tests, 44 suites; 0 failed, skipped, cancelled, or todo |
| `npm run test:all` | PASS | 10/10 configured suites; 0 failed; every required suite and the quality gate passed; 246,543 ms |
| `npm run typecheck` | PASS | Exit 0 |
| `npm run lint` | PASS WITH WARNINGS | Exit 0; 0 errors and 77 `no-explicit-any` warnings |
| `npm run build` | PASS | TypeScript compilation and Vite production build completed; 2,011 modules transformed |
| Unit partition in unified runner | PASS | 187/187 tests in 47/47 files |
| Local Supabase integration partition | PASS | 38/38 tests in 14/14 files; run serially against the isolated local stack |
| Chromium E2E | PASS | 42/42 |
| Visual regression | PASS | 11/11 |
| Accessibility | PASS | 11/11; 0 reported axe violations |
| Bundle budget | PASS | 15 chunks; 1,145,899 bytes minified JS, 302,047 gzip, 255,849 Brotli; no budget warnings; largest chunk 276,901 bytes under the 600 KiB per-chunk threshold |
| Dependency security gate | PASS AT REQUIRED THRESHOLD | `npm audit --audit-level=high --json`: 0 high, 0 critical; 4 moderate advisories remain disclosed |
| Lighthouse | PASS | Performance 1.00, Accessibility 1.00, Best Practices 1.00, SEO 0.92. A fresh valid report was parsed; the Windows Lighthouse process emitted a post-report temporary-directory cleanup warning. |

### Runner corrections made during verification

The first aggregate run exposed two test-infrastructure defects and one timing-sensitive test:

- the aggregate runner accidentally disabled its quality gate by default;
- its dependency wrapper could report success when external scanner processes failed to start;
- local Supabase integration files could contend for one shared Realtime stack when parallelized;
- an F002 rate-window test could cross a real five-minute boundary during a long full run.

The runner now enables the quality gate by default, uses `npm audit --audit-level=high` as the required dependency gate, and serializes the local integration files. Regression contracts cover those settings. The F002 default test window is long enough to keep that test deterministic while its dedicated reset tests still override the window. The final results above were collected after these corrections.

## Android candidate

The current production web build was synchronized with `npx cap sync android`, followed by:

```text
android\gradlew.bat clean assembleRelease bundleRelease --no-daemon
BUILD SUCCESSFUL — 261 actionable tasks
```

| Artifact | Size | SHA-256 | Signing result |
|---|---:|---|---|
| `android/app/build/outputs/apk/release/app-release-unsigned.apk` | 6,144,787 bytes | `69A354D26577238B7DD221DA7AA731C9AF504F5CFEEF5F0E6C1485D2112728CF` | FAIL — `apksigner` reports `DOES NOT VERIFY` / missing `META-INF/MANIFEST.MF` |
| `android/app/build/outputs/bundle/release/app-release.aab` | 5,945,712 bytes | `E782AC7243CF27F4597B206A3AF6876101EDCAE442A1A18F9DD2CD16433CCDD4` | UNSIGNED — no signing metadata present |

`aapt` confirmed application ID `com.amaratvkrishi.salescrm`, version 2.0.0/2, minSdk 24, and targetSdk 36. Installing the exact release APK on `emulator-5554` correctly failed with `INSTALL_PARSE_FAILED_NO_CERTIFICATES`. A freshly synchronized debug build installed and launched successfully on the emulator, proving only debug packaging and startup—not the unsigned release artifact. Three emulators were available; no physical Android device was connected, so the requested final real-device smoke remains outstanding.

## Supabase production parity — read-only

`npx supabase projects list` identifies the linked, healthy project `lahvcodvgubplzfshare` as `AmaratvKrishi-India's Project`; repository environment and deployment documentation identify that same reference as protected production. The isolated healthy staging project is `dhoinifpzijqyobcamlv` (`CRM-Staging`).

`npx supabase migration list --linked` shows production at 7/14 migrations. Production contains `20260820000001` through `20260820000007`; these current repository migrations are missing remotely:

1. `20260905000008_server_sync_ordering.sql`
2. `20260906000009_agent_provisioning_abuse_controls.sql`
3. `20260906000010_lead_purge_policy.sql`
4. `20260907000011_operational_reporting.sql`
5. `20260907000012_sync_conflict_http_status.sql`
6. `20260907000013_call_record_attempt_identity.sql`
7. `20260909000014_child_lead_rls_hardening.sql`

This is a hard release failure. No production mutation, migration, deployment, or test-data write was performed.

## Isolated staging verification

All external functional writes used only `dhoinifpzijqyobcamlv`; staging isolation guards validated the project reference before execution.

| Scope | Result |
|---|---|
| Staging configuration guard | PASS; staging and production references differ |
| Auth/admin/agent/cross-organization permissions | PASS for the synthetic staging fixture; unauthenticated and foreign-tenant writes denied |
| Create/update/delete/archive/recovery | PASS in current browser and direct API staging scenarios |
| Offline to reconnect | PASS; durable outbox drained and local/remote state converged after reconnect |
| Realtime delivery | PASS; 16/16 trials subscribed, ready, delivered, and REST-recovered with 0 write failures |
| Application recovery | PASS 4/4: disconnected Realtime recovery, failed-pull retry, duplicate replay, and browser-restart archive/cursor recovery |
| Current `DIAL_ATTEMPT` lifecycle | PASS; replay idempotent, logical duplicate rejected, independent attempt accepted |
| Scheduled operational-error expiry | PASS; expired synthetic row removed by the scheduled job without a manual RPC |

One older staging matrix probe used the obsolete `DIALER_OPENED` value and received the expected current check-constraint rejection. The fresh `DIAL_ATTEMPT` test above replaces that stale probe for the current contract.

## Required blockers before approval

1. Apply migrations 8–14 to the intended production project through an authorized, backed-up production change window, then repeat the read-only parity check. Production must not be used for functional testing.
2. Make the real production keystore available through the approved secure signing process. Sign these exact rebuilt candidate inputs, then verify the certificate and artifact hashes.
3. Install and test the exact signed APK (and validate the signed AAB intended for distribution). Repeat the emulator release smoke and perform the final physical-device smoke.
4. Re-run any artifact-dependent verification after signing or any code/schema change, then update `GATES.md`, `16_CURRENT_STATE.md`, and this decision. Approval is permitted only if every required blocker is closed.

## Safety and evidence notes

- The working tree was already heavily modified; verification preserved unrelated tracked and untracked work.
- No commit, reset, clean, push, deployment, production migration, or release-signing action was performed.
- Private staging credentials and signing material are not recorded in this report.
- The Codebase Memory verification graph was used for code navigation and was supplemented by exact source reads for partially indexed SQL, Android, and documentation scopes.
