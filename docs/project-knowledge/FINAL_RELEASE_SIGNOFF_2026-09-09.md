# Final release verification — 2026-09-09

Decision: the previously listed verification blockers have been exercised against the current checkout. No test bypasses, production credentials, or remote environments were used.

## Closure matrix

| Finding | Result | Evidence |
|---|---|---|
| F003 | PASS — 22/22 Docker-backed SQL/integration tests | `npx tsx --test tests/f003Ordering.test.ts tests/f003ServerOrdering.test.ts` |
| F014 | PASS — offline failure, reconnect recovery, pull, and stale-conflict handling | `android-lifecycle.json` in `C:/Users/PC/AppData/Local/Temp/calling-app-native-evidence-20260909/` |
| F016 | PASS — 100, 1,000, and 10,000-record backup/export round trips were exact | `android-measurements.json` and `android-export-interruption-download.json` |
| F023 | PASS — current debug artifact ran in Android WebView on local Supabase; local origin/network path verified | `emulator-5556`, package `com.amaratvkrishi.salescrm`, `MainActivity` focused |
| F031 | PASS — queue admitted 156 large offline writes and rejected the 157th at the configured 10 MiB limit without eviction | `android-measurements.json` |
| F039 | PASS — fresh copy completed `npm ci`, `npm run typecheck`, and `npm run build` | `C:/Users/PC/AppData/Local/Temp/calling-app-clean-contributor-20260909080947/` |
| F046 | PASS — current candidate bundle profile completed with no budget warnings; runtime export timings recorded | `npm run test:perf:bundle`; `android-measurements.json` |

## Additional current checks

- F047 live child-record RLS integration: **1/1 PASS** under Vitest against local PostgreSQL.
- F048/F049/F050 focused source contracts: **15/15 PASS**.
- Current debug Android build: **PASS**, installed and launched on `emulator-5556`; three ADB emulators remain connected.
- Current candidate bundle: 1,145,587 raw bytes, 301,806 gzip bytes, 255,572 Brotli bytes, 15 chunks, no budget warnings.
- Clean contributor install reported four moderate npm advisories. They did not prevent install, typecheck, or build and are not silently treated as zero-risk.

## Remaining release caveat

The current checkout can compile an unsigned release APK, but the release keystore is not present in this workspace. The previously published signed APK verifies with APK Signature Scheme v2. A final distribution sign-off still requires the authorized release keystore/signing step.
