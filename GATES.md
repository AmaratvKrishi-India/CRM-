# Current Acceptance Gates

**Last reviewed:** 2026-09-12
**Decision:** **NOT RELEASE-APPROVED**
**Branch:** `codex/release-readiness`
**Parent HEAD before this verification:** `edc8b3fd3a1169d1f2e3ca4bf19fadbb5844ae7a`

This file is the current gate summary for the checkout. It replaces the older v2.0.0 gate snapshot, which remains available in dated evidence reports. A passing local check does not authorize a production deployment.

## Gate summary

| Gate | Status | Evidence / reason |
|---|---|---|
| TypeScript | PASS | Fresh `npm run typecheck` exit 0 on 2026-09-12 |
| Lint | PASS WITH WARNINGS | Fresh exit 0; 0 errors and 77 `no-explicit-any` warnings |
| Production build | PASS | Fresh `npm run build` passed; 2,011 modules transformed |
| Full required runner | PASS | `npm test -- --runInBand`: 285/285; `npm run test:all`: 10/10 configured suites, 0 failures, every required suite and the quality gate passed |
| Bundle / performance | PASS | 15 chunks, 1,145,899 bytes total minified JS, no budget warnings; Lighthouse 1.00 performance |
| Dependency security | PASS AT REQUIRED THRESHOLD | `npm audit --audit-level=high`: 0 high/critical; 4 moderate advisories disclosed |
| Accessibility | PASS | 11/11 Playwright accessibility checks; 0 reported violations; Lighthouse accessibility 1.00 |
| Isolated staging | PASS WITH SCOPED EVIDENCE | Auth/RLS, sync, Realtime 16/16, offline reconnect, CRUD/archive/recovery, current call lifecycle, and scheduled expiry passed against `CRM-Staging` only |
| Android compilation | PASS, SIGNED | Fresh Capacitor sync and Gradle release APK/AAB build succeeded with the verified production signing identity |
| Emulator smoke | PASS | Exact signed release APK installed and cold-launched successfully on emulators `5554`, `5556`, and `5558`; `5554` also confirmed the app as top resumed activity |
| Production migration parity | PASS | Intended production project `lahvcodvgubplzfshare` is verified at 14/14 repository migrations after an authorized, backed-up migration window |
| Current signed release artifact | PASS | Production signing identity recovered externally and matched to historical certificate; APK/AAB signatures verify and exact hashes are recorded in the 2026-09-12 report |
| Production deployment | PARTIAL | Production database migrations are complete. Application distribution remains blocked pending exact signed-APK physical-device smoke |
| Documentation | PASS | Duplicate/stale documentation cleanup and CURRENT-doc reconciliation are complete; fresh scan on 2026-09-11 found 0 broken local Markdown links and no targeted stale technical/release claims |

## Release blockers

1. Connect an authorized physical Android device and install/cold-launch the exact signed APK identified in the 2026-09-12 verification report.
2. Record the physical-device process/activity smoke evidence, then issue a new dated release decision before distribution.
3. Repeat artifact-dependent gates after any code/schema/signing change.

## Evidence precedence

Use the newest report that tests the exact current checkout and scope. The current authority is [FINAL_RELEASE_VERIFICATION_2026-09-12.md](./docs/project-knowledge/FINAL_RELEASE_VERIFICATION_2026-09-12.md); the [September 9 sign-off](./docs/project-knowledge/FINAL_RELEASE_SIGNOFF_2026-09-09.md) is historical only.

## Safety rules

- Never treat a historical v2.0.0 APK as proof for the current working tree.
- Never point staging commands at the production Supabase reference.
- Never place service-role keys, database passwords, session tokens, customer exports, or signing material in the repository.
- Preserve the dirty working tree and record failed attempts; do not filter failures out of a gate summary.
