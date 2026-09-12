# Final Release Verification — 2026-09-12

**Decision:** **NOT RELEASE-APPROVED**
**Branch:** `codex/release-readiness`

## Current verified state

- `npm test -- --runInBand`: **285/285 passed** on the current release-readiness checkout.
- `npm run test:all`: **10/10 suites passed**, including **38/38 integration tests** after increasing only the local Realtime delivery/test timeout allowance; the event-delivery assertion itself remains unchanged.
- Production Supabase project `lahvcodvgubplzfshare`: **14/14 repository migrations applied**.
- Pre-migration production schema and data dumps were created under the operator's Desktop `final/backups` folder before migrations 8–14 were applied.
- Production signing identity recovered from the operator's external OneDrive key store and verified against the historical production certificate.
- Production certificate SHA-256: `A131697E3CDF7ADE44C5C3DF3563E6CBB9FA54969B5A718CE03DA49A20DC0ED6`.
- Signed release APK and AAB built successfully with Android Studio's bundled JDK/SDK.
- APK SHA-256: `91969DBC97FFF267457B1128369FFB1FE214873D8B54259C08D217D6E2E22433`.
- AAB SHA-256: `0C2ABB908E925D3CBED03FDB07AC9C85C3D41BF67A423689532613826EC807FA`.
- APK size: **6,152,979 bytes**. AAB size: **5,975,682 bytes**.
- APK and AAB signature verification both passed with the production signing identity.

## Android artifact smoke

The exact signed APK was installed and cold-launched successfully on Android Studio emulators `emulator-5554`, `emulator-5556`, and `emulator-5558`. The package is `com.amaratvkrishi.salescrm`, versionName `2.0.0`, versionCode `2`, minSdk `24`, targetSdk `36`. On `emulator-5554` the signed release was additionally confirmed as the top resumed activity.

No physical Android device was connected during this verification. Native Maestro flows were not run against production because they intentionally perform test writes and are configured for the local Supabase test environment.

## Remaining blocker

Final release approval remains blocked only by the repository's required **physical-device smoke test of the exact signed APK**. Connect an authorized USB-debugging Android device, install this exact APK, cold-launch it, verify the resumed activity/process, and record that evidence before changing the decision to RELEASE-APPROVED.

## Safety notes

- No signing key, keystore password, service-role secret, database password, or production data dump is stored in this repository.
- The production migrations were applied only after explicit operator authorization and backup creation.
- Historical signed artifacts remain historical evidence; the hashes above identify the newly rebuilt candidate verified on 2026-09-12.
