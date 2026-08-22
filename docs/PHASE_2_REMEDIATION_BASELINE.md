# Phase 2 Remediation Pre-Flight Baseline Report

**Project**: Amaratv Krishi Field Sales CRM v2.0.0  
**Timestamp**: 2026-08-21T16:00:00+05:30  
**Git Branch**: `main`  
**Git Commit**: `759a81c796c7846fd90cb020af415149f6db3b06`  
**Working Tree Status**: Clean (no unstaged or uncommitted changes)  

---

## 1. Test Suite Baseline

- **Total Test Suites**: 4
- **Total Tests**: 17
- **Passing**: 17
- **Failing**: 0
- **Execution Time**: ~252 ms
- **Test Runner**: Node.js Native Test Runner (`node --experimental-strip-types --test tests/*.test.ts`)

| Test Suite | Tests | Status | Duration |
| :--- | :--- | :--- | :--- |
| `tests/agentDeletion.test.ts` | 5 | PASS | ~7 ms |
| `tests/appTypography.test.ts` | 4 | PASS | ~25 ms |
| `tests/backgroundSync.test.ts` | 4 | PASS | ~36 ms |
| `tests/themePreference.test.ts` | 4 | PASS | ~3 ms |

---

## 2. Compiler & Build Baseline

- **TypeScript (`npx tsc --noEmit`)**: 0 errors
- **Vite Production Build (`npm run build`)**: Succeeded in 2.63s
- **Output Bundles**:
  - `dist/index.html` (1.47 kB / gzip: 0.66 kB)
  - `dist/assets/index-*.css` (80.27 kB / gzip: 12.55 kB)
  - `dist/assets/index-*.js` (215.88 kB / gzip: 49.63 kB)
  - `dist/assets/vendor-xlsx-*.js` (419.27 kB / gzip: 139.95 kB)
  - `dist/assets/AdminShell-*.js` (166.68 kB / gzip: 30.61 kB)
  - `dist/assets/vendor-supabase-*.js` (208.11 kB / gzip: 53.77 kB)
  - `dist/assets/vendor-react-*.js` (182.12 kB / gzip: 57.31 kB)
  - `dist/assets/vendor-dexie-*.js` (95.18 kB / gzip: 31.31 kB)

---

## 3. Capacitor & Android Toolchain Baseline

- **Capacitor CLI**: `v8.5.0`
- **Capacitor Plugins Detected**:
  - `@capacitor/app@8.1.1`
  - `@capacitor/local-notifications@8.3.1`
  - `@capacitor/share@8.0.1`
- **Capacitor Sync (`npx cap sync android`)**: Succeeded (web assets copied, plugins updated in 0.53s)
- **Connected ADB Devices**: `emulator-5554` (ONLINE / device)
- **Existing Release APK**: `release/AmaratvKrishi-SalesCRM-v2.0.0.apk` (5,914,303 bytes / 5.91 MB)
- **Existing Debug APK**: `android/app/build/outputs/apk/debug/app-debug.apk` (4,651,832 bytes / 4.65 MB)

---

## 4. Supabase CLI & Backend Baseline

- **Supabase CLI Version**: `2.115.0`
- **Existing Migration Files**:
  - `20260820000001_phase2e_central_schema.sql`
  - `20260820000002_phase2e_rls_policies.sql`
  - `20260820000003_phase2j_call_duration_indexes.sql`
  - `20260820000004_phase2k_realtime_publication.sql`
  - `20260820000005_phase2k_bulk_assignment.sql`
- **Edge Functions**: `functions/create-agent/index.ts`

---

## 5. Identified Gaps To Remediate

1. **P0 Outbox Data Integrity Gap**: Repositories mutate Dexie records without reliably creating outbox mutations for offline-first push sync.
2. **P0 Supabase RLS Policy Gap**: Organization-level isolation exists, but Agent-level lead isolation must be strictly enforced.
3. **P1 Typography Offline Constraint**: Inter typography is loaded via Google Fonts CDN in `index.html` and `src/index.css`.
4. **P1 Test Suite Expansion**: Outbox queue, RLS security isolation, sync conflict resolution, and backup/restore test suites required.
