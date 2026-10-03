# Consolidation acceptance

Reviewed 2026-10-03.

**Overall status:** Consolidation and manual cleanup are complete. PR #2 merged as `180b6ed`; the follow-up PR #3 is on `main` at `86ba19abc6494093f988c143c39def465d91d2bd`. Android CI run `37107103579` passed for the merged changes, and canonical Production is READY at that revision. Physical-device testing is documented separately and is optional.

## Preserved scope

- Preserve the main checkout at C:\Users\PC\Desktop\calling app - Copy and C:\Users\PC\Desktop\keys. Read-only checks confirmed both remain.
- No 2FA setting was changed. Sign-in and account checks used password only.
- The user confirmed manual cleanup. Read-only checks on 2026-10-03 found all 15 external and 20 internal cleanup targets absent. The protected project, signing files, and `.lostpixel/.gitignore` remain. The generated, Git-ignored `html.meta.json.gz` had no code references and has since been removed from the repository.
- Only the main checkout is registered as a Git worktree; `C:\Users\PC\Desktop\AUDIT` is absent and has no registered worktree.

## Verification record

| Area | Current evidence |
|---|---|
| Dependencies | Full npm audit reports zero vulnerabilities. The unused Artillery, AVA, Detox, Karma, Nightwatch, TAP, and TestCafe runners were removed after confirming the retained suites use Node test, Vitest, Playwright, and Maestro. The lockfile and package manifest are synchronized. |
| Local checks | Typecheck, lint, staging config/build, production build, release Android preparation, license inventory generation, and targeted security/Maestro tests pass. The child-lead Supabase integration test passes 3/3. |
| GitHub Actions | PR #2 merged as `180b6ed`; follow-up PR #3 is on `main` at `86ba19abc6494093f988c143c39def465d91d2bd`. Run `37107103579` passed for the merged web and Android changes. The workflow uses checkout v7, setup-node v7, and setup-java v6. The prior Node 20 action-runtime warning is addressed; non-failing Android/Gradle deprecation warnings may still appear. |
| Browser tests | CI has separate mocked-auth Chromium, tablet, and local-Supabase browser jobs. The mocked-auth suite skips 11 cases that require a real backend; the dedicated local-Supabase suite covers those flows. Current dedicated coverage passed 11 CRUD/multi-client cases and 2 tablet cases. |
| sync_mutate | Migration revoke_anon_sync_mutate was applied to hosted Staging first, then Production. Both projects report anon EXECUTE false and authenticated/service-role EXECUTE true. Anonymous REST calls are denied. Staging authenticated runtime was not tested because the available designated account is Production-only; Staging returned invalid_credentials and no user was provisioned. |
| Auth redirects | Staging Site URL and its only redirect entry are https://crm-9eg6dhffb-amaratv-krishi.vercel.app. Production Site URL and its only redirect entry are https://crm-blush-omega.vercel.app. No wildcard redirect is configured. The Staging branch alias was detached while preserving the Staging deployment and its unique URL. |
| Production data | Password-only authenticated API CRUD passed with a unique consolidation marker; the marker was deleted and a follow-up query returned zero matches. No customer record was changed. This exercised the authenticated sync_mutate route. The in-app permanent-delete flow, which requires an export and acknowledgement, was not exercised. Browser 6 remained at the Production sign-in form, so UI-level CRUD is unverified. |
| Vercel cleanup | The 24 specifically approved Preview deployments and the separately approved Preview deployment `dpl_GtC5xyLMHrzBZUGwvaQfAVAt4KXi` were removed. The CRM project/domain, all Production deployments, retained Staging deployment `dpl_DRHexu6KWiiqDchtWmEJHbac98DE`, and Supabase projects/data were preserved. The post-removal inventory contained 23 Production deployments and the retained Staging Preview deployment. |
| Production deployment | The canonical Vercel Production URL is https://crm-blush-omega.vercel.app. Deployment `dpl_FmBUQAu5sxtEKYKcnyQMcNEwJQC9` is READY at `86ba19abc6494093f988c143c39def465d91d2bd`. |
| Android | The debug APK tested on emulator had SHA-256 E8599D0A9A43882B297855A3F9B93A559552A7491805262F8C233E4828DD6D04, package `com.amaratvkrishi.salescrm`, version 2.0.0 (2). It installed and launched on sdk_gphone16k_x86_64 / Android 17 / API 37. Earlier emulator acceptance covered password-only login/logout and designated lead list/create/edit flows. Its generated in-repository build output was removed during manual cleanup; see Android Device Acceptance before another install. Physical-device behavior remains unverified. |
| Security review | The license inventory path check is confined to node_modules and has regression coverage. The watchdog shell-input candidate was reviewed; no exploit was confirmed. Existing Supabase advisor findings and the interrupted Strix coverage run are described in Known Issues. |

## Closeout checklist

1. PR #2 and follow-up PR #3 are merged; Android CI run `37107103579` passed. Production is READY at the resulting `main` revision.
2. Manual cleanup is confirmed and read-only checks found all listed targets absent. Protected project/signing paths remain, and no worktree is registered under AUDIT.
3. Physical-device checks are optional under the revised goal. Record calling, SIM, hardware, and device-specific behavior as unverified until tested on a physical device.
