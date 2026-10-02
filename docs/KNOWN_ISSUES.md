# Known issues and verification limits

Reviewed 2026-10-02. This file separates confirmed product limits from current audit findings and evidence that could not be verified. The release decision is in [GATES.md](../GATES.md).

## Confirmed product limits

- **No OS-level WorkManager job:** synchronization is coordinated by the app while it is active or resumes. The current source does not implement native WorkManager scheduling for sync after the operating system fully kills the app. Verify expected behavior on devices with background restrictions before relying on unattended delivery.
- **Backup size:** restore files over 25 MiB are rejected before file reading. Export or split larger data sets before restore.
- **External release signing:** Android release signing requires external keystore properties. Signing material is intentionally kept outside this project folder.

## Current cloud findings

- **Vercel:** project `crm` is connected to the canonical GitHub repository `AmaratvKrishi-India/CRM-`, with Production on `main` and verified production URL [crm-blush-omega.vercel.app](https://crm-blush-omega.vercel.app). Production variables point to Supabase project `lahvcodvgubplzfshare`; Preview variables point to staging project `dhoinifpzijqyobcamlv`. Both Supabase Auth health endpoints returned HTTP 200 when checked with their respective public client keys.
- **Supabase production:** all 18 local migration versions match the 18 applied migration versions reported by the project. All 16 public tables report RLS enabled. The deployed `create-agent` function code matches `supabase/functions/create-agent/index.ts`. No production migration, record, or storage object was changed during consolidation.
- **Supabase advisor:** it reports five internal tables with RLS enabled and no policies (deny by default), ten security-definer functions executable by signed-in roles, leaked-password protection disabled, 20 unindexed foreign keys, one RLS initialization-plan warning on `profiles`, and 27 unused indexes. The security-definer warnings include existing authenticated RLS/sync helpers. These findings were documented rather than changed without a reviewed migration or workload.
- **Auth redirect settings:** the existing Supabase Management API credential returned HTTP 401 for the Auth configuration endpoint. The hosted Site URL and redirect allowlist therefore remain unverified; no new sign-in method or redirect configuration was guessed.
- **Live user flows:** production and Preview endpoint health was checked, but no real user login, record mutation, or customer workflow was run against a hosted environment.

## Current audit and acceptance limits

- **Dependency audit:** `npm audit` reported 10 advisories in the installed dependency tree (7 high, 2 moderate, 1 low), primarily through development and mobile-test tooling such as Appium. A non-forced audit repair could not fetch remote packages in this environment (`EALLOWREMOTE`); the force option would move packages outside their declared ranges, so no dependency override was applied.
- **Graft:** the optional `graft --version` toolchain probe exits with code 1. Graft is referenced by the optional toolchain inventory only; it is not part of the app, build, or test workflow. The toolchain inventory records an upstream Windows/Node native-build issue for its pinned version.
- **Android device acceptance:** release preparation and browser-based tests do not establish current Android emulator or physical-device acceptance. A current device run remains outstanding.
- **Child-record access after reassignment:** source includes migration `20260923000017_child_read_reassignment_hardening.sql` and local RLS integration coverage. Production reports RLS enabled and the migration applied, but the live policy definitions could not be retrieved with the current Management API credential.
- **Historical Android QA:** a 2026-09-24 report records login, navigation, read-only workflows, and sign-out on an Android 17 / Pixel 8a-profile emulator using a v2.0.0 release APK. It records no fatal app exception. An attempted install over a debug-signed package failed because its certificate differed from the release APK; that result is an install-signature mismatch, not evidence of an app crash. Performance measurements used headless software graphics and are not representative of physical-device performance. That APK was not shown to come from this checkout.
- **Deferred Fallow review notes:** earlier audit artifacts left two candidates unresolved: lockfile-derived path handling in `scripts/generate-third-party-licenses.mjs`, and shell quoting/input trust in `scripts/process-watchdog.ts`. No exploit was confirmed in those reports; these candidates were not re-audited during this consolidation.
