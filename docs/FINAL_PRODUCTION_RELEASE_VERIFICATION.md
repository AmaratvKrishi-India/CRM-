# Final Production Release Verification

**Date:** 2026-08-23 · **Project:** Amaratv Krishi Field Sales CRM · **App:** v2.0.0 (versionCode 2)

This document records the FINAL PRODUCTION RELEASE of the previously certified commit
`c9ad687e59b56932247605b329a4ebdc1907fec8` (certification verdict: RELEASE_READY). Every
PASS below contains actual execution evidence from this release run. No application code,
Supabase schema, or production data was modified during the release.

## 1. Release commit

- Certified commit: `c9ad687e59b56932247605b329a4ebdc1907fec8` ("fix: complete final release bug audit").
- Pre-release verification: `git rev-parse HEAD` = `c9ad687e59b56932247605b329a4ebdc1907fec8`,
  branch `main`, `git status --short` empty. No source changes after certification, no staged
  changes, no untracked release-critical files.
- The commit was NOT amended or rewritten during this release.

## 2. GitHub status

- Remote: `origin` = `https://github.com/AmaratvKrishi-India/CRM-.git` (private repo).
- Before push: `git ls-remote origin refs/heads/main` = `1fe694c...` (certified commit absent).
- Push: `git push origin main` -> `1fe694c..c9ad687  main -> main` (fast-forward, no force).
- After push: `git ls-remote origin refs/heads/main` and `HEAD` both =
  `c9ad687e59b56932247605b329a4ebdc1907fec8`.

## 3. Git working tree

- Clean at release time (`git status --short` empty before push).
- After release, the only working-tree change is the refreshed read-only schema probe output
  (`docs/cloud_schema_probe_results.json`, timestamp-only diff) plus this document, committed
  as one documentation-only follow-up (see Section 17/18).

## 4. Local tests

- `npx tsc --noEmit` -> exit 0, no output.
- `npm test` -> **115 pass / 0 fail / 0 skipped, 22 suites** (157.8s), exit 0.
- Note: one intermediate run showed 2 transient failures in the emulator suite's login steps
  (Playwright actionability timeouts on heavily-loaded AVDs; the same commit passed 13/13
  twice earlier the same day). After `am force-stop` recovery of the three emulators, the
  suite returned to 13/13 and `npm test` returned to 115/115. Root cause: emulator timing
  flake, not a code regression; the failing steps' own logs showed the dashboard had loaded.

## 5. Playwright

- `npx playwright test` -> **32 passed / 0 failed** (chromium + Mobile Chrome, 37.4s), exit 0.

## 6. Security

- Built-in secret-leak scanner (`securitySecretScan.test.ts`) PASS inside `npm test`.
- `git grep service_role` on tracked files: only docs, `supabase/config.toml` (local Docker
  demo config), and the scanner test itself. No private-key blocks anywhere.
- Tracked env files: only `.env.example`. No keystores or `.jks` tracked.
- No secrets, JWTs, or signing credentials printed or committed during this release.

## 7. Android APK

- `release/AmaratvKrishi-SalesCRM-v2.0.0.apk` present, 7,268,429 bytes.
- SHA-256 = `A7DD97F61718A7735BE3D0EBD0023F201BEC6B995AA4DD93A3A4E832CD30E0B9`
  (matches the certified artifact exactly; no rebuild performed).
- `android/app/build.gradle`: applicationId `com.amaratvkrishi.salescrm`,
  versionName `2.0.0`, versionCode 2.

## 8. Android Studio AVD smoke

- Devices (dynamically detected via ADB, no physical devices): `emulator-5556` = ADMIN,
  `emulator-5558` = AGENT A, `emulator-5560` = AGENT B.
- Certified APK installed on all three (`dumpsys package`: versionCode=2, versionName=2.0.0).
- Smoke evidence: `npx tsx --test tests/multiDeviceSync.test.ts` -> **13/13 PASS** (169s):
  app launches on all three, admin + both agents log in and reach their dashboards,
  lead isolation, agent workflows, admin sync, offline recovery, RLS enforcement, no crash.

## 9. Vercel deployment

- Project: `crm` in scope `amaratv-krishi` (existing canonical project; identity unchanged).
- The push to `origin/main` triggered Vercel's Git integration: deployment
  `dpl_A3H3G8tdcaZcWdY7dvbWwjajb8q3` (`crm-ee1rynupl-amaratv-krishi.vercel.app`),
  status READY, target production, built in ~6s.
- Deployment metadata: `githubCommitSha = c9ad687e59b56932247605b329a4ebdc1907fec8`,
  ref `main`, repo `AmaratvKrishi-India/CRM-`.
- Aliases include the canonical `https://crm-blush-omega.vercel.app`. No manual deploy,
  no new project, no domain or env-var changes.

## 10. Production URL

- Canonical: `https://crm-blush-omega.vercel.app` (also `crm-amaratv-krishi.vercel.app`,
  `crm-git-main-amaratv-krishi.vercel.app`).

## 11. Production smoke

- `Invoke-WebRequest https://crm-blush-omega.vercel.app` -> HTTP 200.
- Playwright browser check against the production URL: HTTP 200, title
  "Amaratv Krishi - Field Sales CRM", `#root` present, login form rendered
  (email + password inputs + Sign In button), **0 runtime/page errors**.
- JS bundle asset served HTTP 200 (226,641 bytes).

## 12. Supabase read-only verification

- Project `lahvcodvgubplzfshare.supabase.co` reachable; auth settings endpoint healthy
  (`/auth/v1/settings` returned full settings JSON).
- `scripts/probeCloudSchema.ts` (GET-only) re-run: **10/10 tables exist, 147/147 columns
  present, 17/17 foreign-key embeddings verified**; row counts visible to anon key = 0 on
  all 10 tables (RLS active).
- `scripts/prod_smoke.ps1`: VERCEL_WEB=200, REST_LEADS=200, RPC_CURRENT_PROFILE_ID=200.
- No INSERT/UPDATE/DELETE/DDL/migrations executed against production during this release.

## 13. Migration status

- Migrations 1-6 remain applied; schema parity confirmed by the 147/147 column probe and
  17/17 FK probe against the local schema snapshot.
- Migration 6 helper functions probed read-only via REST RPC (POST with empty body, the
  established read-only method): `current_profile_id` = 200, `is_org_admin` = 200,
  `current_user_org_id` = 200, `current_user_role` = 200. Migration 6 remains active.

## 14. RLS status

- PASS. Anon-key probes see 0 rows on all 10 production tables (RLS enforced).
- Agent/admin isolation additionally proven against real PostgreSQL in the emulator suite
  (Step 12) and the 15-test local RLS integration suite inside `npm test`.

## 15. Production safety

- PRODUCTION DATA MUTATION: NONE. Evidence: the schema probe output diff vs the previous
  probe is timestamp-only (identical tables/columns/FKs/row counts), and no write/DDL
  commands were issued at any point in this release.
- No force push, no history rewrite, no env-var changes, no Supabase resets.

## 16. Remaining non-blocking items

- Staging Supabase project remains unconfigured (long-standing, documented).
- #22 full-table scans acceptable at current scale; revisit with indexes at 50k+ leads.
- `disposeNetworkListeners()` defined but not invoked on logout (session guard covers it).
- JAVA_HOME must be set to the Android Studio JBR for local `gradlew` builds (shell config).
- Play Store distribution of the signed APK is a manual step (see Section 18).

## 17. Final release status

**FULLY_RELEASED**

- Certified commit `c9ad687e` is on GitHub `origin/main` (verified via `git ls-remote`).
- Vercel production is serving that exact commit (deployment metadata verified).
- Production HTTP smoke PASS, Supabase read-only verification PASS, RLS PASS,
  local regression PASS (tsc, 115/115, 32/32, build), APK artifact valid,
  no release-critical issues outstanding.

## 18. Exact distribution instructions

1. **Web:** already live. `https://crm-blush-omega.vercel.app` serves commit `c9ad687e`
   via Vercel Git integration (project `crm`, scope `amaratv-krishi`). No action needed;
   future pushes to `main` deploy automatically.
2. **Android APK:** distribute `release/AmaratvKrishi-SalesCRM-v2.0.0.apk`
   (SHA-256 `A7DD97F61718A7735BE3D0EBD0023F201BEC6B995AA4DD93A3A4E832CD30E0B9`,
   V2-signed). For Play Store: create the release in the Play Console and upload this APK
   (or generate an AAB from the same signed build with `gradlew bundleRelease` using the
   existing external keystore; JAVA_HOME = Android Studio JBR).
3. **Backend:** production Supabase (`lahvcodvgubplzfshare.supabase.co`) requires no action;
   migrations 1-6 already applied, RLS enforced.
4. **Verification:** re-run `scripts/prod_smoke.ps1` any time for a 3-line read-only health
   check (web 200 / REST 200 / RPC 200).
