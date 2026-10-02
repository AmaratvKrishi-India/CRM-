# Current acceptance gates

**Last reviewed:** 2026-10-02

**Decision:** **NOT FULL RELEASE-APPROVED** — web checks pass, while production user-flow and Android-device acceptance remain incomplete.

**Candidate branch:** `codex/project-consolidation` (based on `main` at `2d72a5d837ee7045ec53b82c6aa88c4e72ac2462`).

These results cover the current candidate source. A local build or mocked browser session does not certify production behavior. GitHub CI currently fails at its clean-install step because the lockfile is out of sync; the remaining CI steps, Production deployment, and post-deployment smoke check have not run.

## Local validation

| Gate | Result | Evidence |
|---|---|---|
| TypeScript | PASS | `npm run typecheck` |
| Type tests | PASS | `npm run test:type` |
| ESLint | PASS | `npm run lint` |
| Production configuration and build | PASS | `npm run build`; the release config guard, TypeScript, and Vite production build passed. |
| Staging configuration and build | PASS | `npm run build:staging`; confirms the staging project is separate from production. |
| Full Node suite | PASS | `npm test -- --runInBand`; 348 tests, 47 suites, 0 failures, 0 skipped. Docker-backed local Supabase was running. |
| Full Vitest suite | PASS | `npm run test:vitest -- --reporter dot`; 277 tests across 21 files passed, including local integration tests. |
| Chromium browser suite | PASS WITH SKIPS | `npm run test:e2e:chromium`; 42 passed, 11 skipped, 0 failed. Tests use local Vite and mocked auth; live-backend/device-only cases skip. |
| Android release preparation | PASS | `npm run release:android:prepare`; web build, Capacitor sync, and packaged-marker gate passed. No APK install or device acceptance was run. |
| Bundle budget | PASS | `npm run test:perf:bundle`; 17 chunks, 1,166,613 raw bytes, 310,609 gzip bytes, 0 warnings. |
| Local database lint | PASS | `npm run audit:database`; Supabase reported no schema errors. |
| Secret scanner | PASS WITH LOW/MODERATE MATCHES | 477 files scanned; 0 critical, 0 high, 5 moderate, and 59 low pattern matches. The scan matched items such as public Supabase URLs and UUIDs; findings were not treated as credentials. |
| GitHub clean install | FAIL | The latest Release readiness run stopped at `npm ci`; npm reported invalid and missing lockfile entries. No CI tests ran. |
| Dependency audit | ATTENTION | `npm audit` reported 10 advisories (7 high, 2 moderate, 1 low), primarily in mobile/test tooling. A repair dry run was blocked when npm refused remote package fetches (`EALLOWREMOTE`); forced range changes were not applied. |
| Toolchain inventory | ATTENTION | 35/36 tools ready. The optional Graft version probe exits 1; Graft is not part of app build or test commands. |

## Cloud alignment and remaining checks

- Vercel project `crm` is linked to `AmaratvKrishi-India/CRM-`, with Production on `main`. The project uses Vite, the repository root, Node.js 24, and the production URL [crm-blush-omega.vercel.app](https://crm-blush-omega.vercel.app). Production remains on the existing `main` deployment until the clean-install gate passes and the candidate is merged.
- Vercel Production variables target Supabase project `lahvcodvgubplzfshare`. Preview variables target staging project `dhoinifpzijqyobcamlv`. The `VITE_APP_ENV`, `VITE_APP_VERSION`, Supabase URL, and public anon key records are split by target. Both target Auth health endpoints returned HTTP 200.
- The candidate's Vercel Preview deployment reached READY and returned HTTP 200. Its loaded environment reports `staging`, version `2.0.0`, staging project `dhoinifpzijqyobcamlv`, and Auth health HTTP 200.
- The production Supabase project reports all 18 current migration versions applied, RLS enabled for all 16 public tables, and the deployed `create-agent` code matching local source. No production migration or customer data was changed.
- Supabase advisor findings and limitations are recorded in [Known issues](./docs/KNOWN_ISSUES.md). The hosted Auth Site URL and redirect allowlist could not be retrieved: the existing Management API credential returned HTTP 401 for that configuration endpoint.
- A read-only smoke check on the existing Production deployment returned HTTP 200 for the site and Supabase Auth health. The leads REST read and `current_profile_id` RPC returned HTTP 401 / SQLSTATE `42501` because the request had no signed-in user and the helper function is not executable by the anonymous role. This is consistent with the auth-only helper grants, but does not prove signed-in operations.
- After the candidate passes GitHub checks and is deployed, run `scripts/prod_smoke.ps1` again and verify the resulting deployment and logs. The script performs read-only GET/RPC requests. No real user login or customer CRUD flow has been exercised.
- Before merge, synchronize `package-lock.json` with `package.json` and rerun the clean install and CI checks. The current npm remote-fetch restriction was not overridden.
- Current Android emulator or physical-device acceptance remains outstanding. Do not use the historical 2026-09-24 APK report as acceptance for this candidate.
- The `v2.0.0` and `v2.0.1` release branches and tags are retained because they contain release history; the Tailwind source restriction from the `v2.0.1` fix is present in current `main` source.

## Findings reviewed during consolidation

- The child-read reassignment migration `20260923000017_child_read_reassignment_hardening.sql` and local reassignment coverage are present. Production reports the migration applied, but live policy definitions were not retrieved with the current Management API access.
- Backup restore rejects inputs above 25 MiB before reading them; the exact boundary is tested.
- Chromium accessibility checks found and verified a contrast correction for the disabled Sync Now button in the day theme.
- Older source copies lacked a source fix that is present in this main checkout. Existing UI/theme changes, visual baselines, tests, and Maestro updates were retained.
