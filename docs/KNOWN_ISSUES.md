# Known issues and verification limits

Reviewed 2026-10-03. The release gate is in GATES.md. Manual cleanup is not confirmed; the overall consolidation goal remains open until the user confirms it.

## Confirmed product limits

- Synchronization does not use an OS-level WorkManager job after Android fully kills the app; the app syncs while active or resumes.
- Restore files over 25 MiB are rejected before reading.
- A release-signed APK needs external signing material. The current APK is debug-signed.

## Resolved during consolidation

- Dependency audit: npm audit reports zero vulnerabilities. Removed unused legacy runners that pulled vulnerable development-only dependency trees. Retained configured Node test, Vitest, Playwright, and Maestro suites.
- Anonymous sync mutation: revoke_anon_sync_mutate was applied to Staging and then Production. anon cannot EXECUTE public.sync_mutate; authenticated and service_role retain EXECUTE. Anonymous HTTP/RPC probes are denied.
- Auth URLs: Staging uses only https://crm-9eg6dhffb-amaratv-krishi.vercel.app. Production uses only https://crm-blush-omega.vercel.app. Each URL is its environment's Site URL and sole redirect allowlist entry; redirects are not wildcarded. The Staging branch alias was detached without deleting the retained Staging deployment.
- GitHub Actions: action references were updated to checkout v7, setup-node v7, and setup-java v6 to clear the former Node 20 action-runtime/deprecation warning. Non-failing Gradle/Android SDK toolchain deprecations may still appear.
- Production API CRUD: a unique test marker was created, updated, deleted with the authenticated sync_mutate path, and queried as absent. The cleanup result is confirmed; no customer data was included. The guarded application hard-delete/export acknowledgement UI was not exercised, so that UI path remains unverified.
- License inventory safety: package locations from the lockfile are constrained beneath node_modules. A targeted regression test covers path traversal.
- The current APK and device checklist are in Android Device Acceptance.

## Verification limits that remain

- Hosted Staging's authenticated path was not runtime-tested because the only available designated test account belongs to Production. Password sign-in to Staging returned invalid_credentials. No Staging user was created. Hosted SQL and anonymous denial were verified.
- Browser 6 was open to the Production CRM login form, not an authenticated dashboard. The signed-in Production CRUD result is API-level; browser-UI CRUD is unverified.
- The emulator confirms current APK build, install, startup, and previous password-only lead flows. A physical Android device was not used. Calling, SIM, hardware, and device-specific behavior are unverified.
- The mocked-auth Chromium job intentionally skips 11 backend-dependent cases. A separate local-Supabase browser job covers those cases; the tablet job is separate. Check PR #2 for the latest exact-head CI result.
- Local Node 26/npm 12 reports blocked package lifecycle scripts in its install policy. Hosted Node 24 CI clean install passes. This local package-script notice does not indicate an audit vulnerability.
- Gradle and Android SDK can print non-failing deprecation notices.
- Supabase advisor findings remain documented: five internal RLS-protected tables have no policies (deny by default), ten security-definer functions are executable by signed-in roles, leaked-password protection is disabled, 20 foreign keys lack indexes, one profile RLS init-plan warning, and 27 unused indexes. These were not changed without a reviewed workload and migration.
- The most recent Strix coverage run was interrupted. Its SARIF contains coverage annotations and follow-up items, not a completed security clearance.
- The optional Graft version probe fails on this Windows/Node toolchain; Graft is not part of app build or test commands.
- Historical Android and security scan output is summarized here; old reports are not current Production or physical-device evidence.
