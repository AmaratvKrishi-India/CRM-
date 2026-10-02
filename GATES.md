# Current acceptance gates

**Last reviewed:** 2026-10-03

**Decision:** **NOT FULL RELEASE-APPROVED** — local web checks pass, but the dependency security gate still finds vulnerable packages bundled in Appium's development-only Android driver. Production write flows and current Android-device acceptance are also incomplete.

**Candidate branch:** `codex/project-consolidation` (based on `main` at `2d72a5d837ee7045ec53b82c6aa88c4e72ac2462`).

These results cover the current working tree. A local build or mocked browser session does not certify production behavior. GitHub run [37051425163](https://github.com/AmaratvKrishi-India/CRM-/actions/runs/37051425163) for `48c0951` passed `npm ci`, typecheck, lint, local Supabase startup, and all 348 Node tests, then failed the dependency security gate; later CI steps were skipped. Vercel Preview for `48c0951` is READY; Production remains on `main`.

## Local validation

| Gate | Result | Evidence |
|---|---|---|
| Clean install | PASS WITH LOCAL SCRIPT LIMIT | `npm ci --allow-remote=all` installed the lockfile on Node 26.5.0/npm 12.0.2. npm 12 blocked 15 lifecycle scripts pending local approval; Node 24 CI `npm ci` passed in run [37051425163](https://github.com/AmaratvKrishi-India/CRM-/actions/runs/37051425163). |
| TypeScript | PASS | `npm run typecheck` |
| Type tests | PASS | `npm run test:type` |
| ESLint | PASS | `npm run lint` |
| Production configuration and build | PASS | `npm run build`; the release config guard, TypeScript, and Vite production build passed. |
| Staging configuration and build | PASS | `npm run build:staging`; confirms the staging project is separate from production. |
| Full Node suite | PASS | `npm test -- --runInBand`; 348 tests, 47 suites, 0 failures, 0 skipped. Docker-backed local Supabase was running. |
| Full Vitest suite | PASS | `npm run test:vitest -- --reporter dot`; 277 tests across 21 files passed, including local integration tests. |
| Chromium browser suite | PASS WITH SKIPS | `npm run test:e2e:chromium`; 42 passed, 11 skipped, 0 failed. Tests use local Vite and mocked auth; live-backend/device-only cases skip. |
| Android release preparation | PASS (2026-10-02) | `npm run release:android:prepare`; web build, Capacitor sync, and packaged-marker gate passed. No APK install or device acceptance was run for this candidate. |
| Bundle budget | PASS | `npm run test:perf:bundle`; 17 chunks, 1,166,613 raw bytes, 310,609 gzip bytes, 0 warnings. |
| Local database lint | PASS | `npm run audit:database`; Supabase reported no schema errors. |
| Secret scanner | PASS WITH LOW/MODERATE MATCHES | 477 files scanned; 0 critical, 0 high, 5 moderate, and 59 low pattern matches. The scan matched items such as public Supabase URLs and UUIDs; findings were not treated as credentials. |
| GitHub CI | FAIL (BLOCKING) | Run [37051425163](https://github.com/AmaratvKrishi-India/CRM-/actions/runs/37051425163) for `48c0951`: `npm ci`, typecheck, lint, local Supabase startup, and 348 Node tests passed; dependency audit failed. Later steps were skipped. |
| Dependency audit | FAIL (BLOCKING) | Full `npm audit`: 5 advisories (4 high, 1 moderate), all in the development-only `appium-uiautomator2-driver@8.7.0` bundled tree. `npm audit --omit=dev`: 0 advisories. Details and upstream limit are in [Known issues](./docs/KNOWN_ISSUES.md). |
| Toolchain inventory | ATTENTION | 35/36 tools ready. The optional Graft version probe exits 1; Graft is not part of app build or test commands. |

## Cloud alignment and remaining checks

- Vercel project `crm` is linked to `AmaratvKrishi-India/CRM-`, with Production on `main`. Project inspection confirms the repository root, Vite framework, Node.js 24, and `npm run build`; the install command and output directory use Vercel defaults (`dist` for Vite). The production URL is [crm-blush-omega.vercel.app](https://crm-blush-omega.vercel.app). Production remains on the existing `main` deployment until the security gate passes and the candidate is merged.
- Vercel Production variables target Supabase project `lahvcodvgubplzfshare`. Preview variables target staging project `dhoinifpzijqyobcamlv`. The `VITE_APP_ENV`, `VITE_APP_VERSION`, Supabase URL, and public anon key records are split by target. Both target Auth health endpoints returned HTTP 200.
- The Vercel Preview for `48c0951` reached READY. An authenticated Vercel fetch returned the CRM app page; unauthenticated requests show the Vercel login screen. Production was not changed.
- The production Supabase project reports all 18 current migration versions applied, RLS enabled for all 16 public tables, and the deployed `create-agent` code matching local source. No production migration or customer data was changed.
- The staging Supabase project now reports all 18 migrations applied and RLS enabled for all 16 public tables. The child-read reassignment migration was applied to staging; checks confirm all five affected child-table policies require current parent-lead visibility while retaining their organization-admin branches. Sampled staging counts remained at 505 leads and 18 profiles. Staging `create-agent` is deployed from current local source with `verify_jwt=true`; an unauthenticated POST returned HTTP 401. Production was not changed.
- Supabase advisor findings and limitations are recorded in [Known issues](./docs/KNOWN_ISSUES.md). The public Auth settings endpoint returned HTTP 200 for both environments but omits the hosted Site URL and redirect allowlist. The existing Management API credential returned HTTP 401 for the configuration endpoint, so those two values remain unverified.
- A password-based sign-in to Production succeeded without an MFA challenge. The authenticated `current_profile_id` RPC and RLS-protected leads read both returned HTTP 200; the read was limited to one row and only its count was recorded. No customer data was written. This verifies authentication and a protected read, not production create/update/delete flows.
- After the candidate passes GitHub checks and is deployed, run `scripts/prod_smoke.ps1` again and verify the resulting deployment and logs. The script performs read-only GET/RPC requests. Full customer workflows and signed-in writes remain unverified.
- The lockfile is synchronized with `package.json`, and clean installs passed locally and in Node 24 CI. The full security audit remains the blocker; do not merge or promote to Production while it fails.
- Current Android emulator or physical-device acceptance remains outstanding. Do not use the historical 2026-09-24 APK report as acceptance for this candidate.
- The `v2.0.0` and `v2.0.1` release branches and tags are retained because they contain release history; the Tailwind source restriction from the `v2.0.1` fix is present in current `main` source.

## Findings reviewed during consolidation

- The child-read reassignment migration `20260923000017_child_read_reassignment_hardening.sql` and local reassignment coverage are present. Live SQL inspection verified all five affected child-read policies in both Production and Staging, including current parent-lead visibility and organization-admin access. The `activities` policy also preserves personal reads for unlinked activities.
- Backup restore rejects inputs above 25 MiB before reading them; the exact boundary is tested.
- Chromium accessibility checks found and verified a contrast correction for the disabled Sync Now button in the day theme.
- Older source copies lacked a source fix that is present in this main checkout. Existing UI/theme changes, visual baselines, tests, and Maestro updates were retained.
