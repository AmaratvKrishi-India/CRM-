# Consolidation acceptance

Reviewed 2026-10-03.

**Overall status:** Technical changes are handled through PR #2. Keep this goal open until the manual cleanup checklist is confirmed. Physical-device testing is documented separately and is not required to finish the revised goal.

## Preserved scope

- Preserve the main checkout at C:\Users\PC\Desktop\calling app - Copy.
- Preserve C:\Users\PC\Desktop\keys.
- No 2FA setting was changed. Sign-in and account checks used password only.
- No cleanup deletion has been performed by Codex. The only registered Git worktree is the main checkout; none is registered under C:\Users\PC\Desktop\AUDIT.

## Verification record

| Area | Current evidence |
|---|---|
| Dependencies | Full npm audit reports zero vulnerabilities. The unused Artillery, AVA, Detox, Karma, Nightwatch, TAP, and TestCafe runners were removed after confirming the retained suites use Node test, Vitest, Playwright, and Maestro. The lockfile and package manifest are synchronized. |
| Local checks | Typecheck, lint, staging config/build, production build, release Android preparation, license inventory generation, and targeted security/Maestro tests pass. The child-lead Supabase integration test passes 3/3. |
| GitHub Actions | PR #2 is the supported merge path. Its workflow uses checkout v7, setup-node v7, and setup-java v6. The prior Node 20 action-runtime warning is addressed. The current exact-head check is recorded on the PR; non-failing Android/Gradle deprecation warnings may still appear. |
| Browser tests | CI has separate mocked-auth Chromium, tablet, and local-Supabase browser jobs. The mocked-auth suite skips 11 cases that require a real backend; the dedicated local-Supabase suite covers those flows. Current dedicated coverage passed 11 CRUD/multi-client cases and 2 tablet cases. |
| sync_mutate | Migration revoke_anon_sync_mutate was applied to hosted Staging first, then Production. Both projects report anon EXECUTE false and authenticated/service-role EXECUTE true. Anonymous REST calls are denied. Staging authenticated runtime was not tested because the available designated account is Production-only; Staging returned invalid_credentials and no user was provisioned. |
| Auth redirects | Staging Site URL and its only redirect entry are https://crm-git-codex-actions-node24-runtime-amaratv-krishi.vercel.app. Production Site URL and its only redirect entry are https://crm-blush-omega.vercel.app. No wildcard redirect is configured. |
| Production data | Password-only authenticated API CRUD passed with a unique consolidation marker; the marker was deleted and a follow-up query returned zero matches. No customer record was changed. This exercised the authenticated sync_mutate route. The in-app permanent-delete flow, which requires an export and acknowledgement, was not exercised. Browser 6 remained at the Production sign-in form, so UI-level CRUD is unverified. |
| Production deployment | The canonical Vercel Production URL is https://crm-blush-omega.vercel.app. The current main deployment, exact revision, READY state, and response check are recorded in Vercel and the PR #2 closeout. |
| Android | Current debug APK: android/app/build/outputs/apk/debug/app-debug.apk. SHA-256 E8599D0A9A43882B297855A3F9B93A559552A7491805262F8C233E4828DD6D04. Package com.amaratvkrishi.salescrm, version 2.0.0 (2). It built, installed, and launched on emulator sdk_gphone16k_x86_64 / Android 17 / API 37. Earlier emulator acceptance covered password-only login/logout and designated lead list/create/edit flows. Physical-device behavior remains unverified. |
| Security review | The license inventory path check is confined to node_modules and has regression coverage. The watchdog shell-input candidate was reviewed; no exploit was confirmed. Existing Supabase advisor findings and the interrupted Strix coverage run are described in Known Issues. |

## Closeout checklist

1. PR #2 is the supported merge path. Its check history and closeout note record the exact-head CI result and resulting Production deployment.
2. Complete the manual cleanup in Consolidation Cleanup. Delete AUDIT last. Then tell Codex cleanup is complete so it can run read-only existence checks.
3. Physical-device checks are optional under the revised goal. Use Android Device Acceptance if a device is available; record untested calling, SIM, hardware, and device-specific behavior as unverified.