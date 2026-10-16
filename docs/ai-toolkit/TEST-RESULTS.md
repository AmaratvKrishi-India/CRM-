# Security and regression verification

**Run date:** 2026-10-16 (UTC)
**Branch:** `development/crm-storage-backup`
**Scope:** local checks use synthetic data and credentials. No production database, deployment, or Google Drive connection was used.

## Dependency security

| Audit | Before | After |
| --- | ---: | ---: |
| Full dependency tree | 30 (6 critical, 1 high, 23 moderate) | 4 moderate, 0 high, 0 critical |
| Production dependencies (`npm audit --omit=dev`) | 0 | 0 |
| Existing high-severity gate (`npm audit --audit-level=high`) | Failed | Passed, exit 0 |

The four remaining moderate findings are all in the development-only Snyk CLI package tree: Snyk 1.1308.1 → `global-agent` / `roarr` → `sprintf-js` 1.1.2. The current upstream Snyk package still bundles the affected versions; the npm “fix” requires downgrading Snyk to 1.1306.4. The report retains this finding. No audit threshold was changed.

Detailed full and production-only npm audit output is saved under [`dependency-audit/`](dependency-audit/). Package paths, affected versions, impact, and remediation decisions are in [`SECURITY.md`](SECURITY.md).

## Local checks

| Area | Command | Result |
| --- | --- | --- |
| TypeScript application | `npm run typecheck` | PASS |
| TypeScript test types | `npm run test:type` | PASS |
| ESLint | `npm run lint` | PASS |
| Production build | `VITE_SUPABASE_URL=https://codex-test.supabase.co VITE_SUPABASE_ANON_KEY=codex-offline-test-anon-key npm run build` | PASS: 2,020 modules transformed; synthetic build values only. No service was contacted. |
| Bundle budget | `npm run test:perf:bundle` | PASS: 1,166,394 bytes total, 310,375 gzip bytes, 263,941 Brotli bytes, 17 chunks, no budget warnings. |
| Vitest service/database/utils subset | `npm run test:vitest -- tests/services tests/db tests/utils --reporter dot` | PASS: 17 files, 238 tests. |
| Full Vitest inventory | `npm run test:vitest -- --reporter=dot` | BLOCKED locally: 18 files passed; 252 tests passed and 27 skipped. Three Supabase integration files failed setup because no local Supabase stack is available: F040, F047, and `supabase-sync`. Hosted run 56 passed the complete Vitest suite on disposable Supabase: 21 files, 279 tests. |
| Node tests | `npm test -- --runInBand` | BLOCKED locally: 349 tests total, 308 passed, 19 failed, 22 cancelled. The failing PostgreSQL-backed hooks require the absent `supabase_db_calling_app` container. |
| Chromium browser suite | `npm run test:e2e:chromium` | PASS for local browser coverage: 42 passed, 11 skipped. Skipped cases are the real-Supabase CRUD and multi-client tests; they require the disposable database stack. |
| Visual regression | `npm run test:visual` | PASS: local Debian Chromium 11/11; hosted Ubuntu 24.04 Chromium 11/11. Separate Linux platform baselines; all 11 Windows baselines remain unchanged. |
| Tablet browser suite | `npx playwright test e2e/tablet-responsive.spec.ts --project=Tablet` | PASS: 2/2. |
| Secret scan | `npx tsx scripts/secret-scanner-test.ts --exclude 'node_modules/**,dist/**,build/**,**/build/**,.git/**,.env*,graft/**,android/app/src/main/assets/**,*.lock,*.log,coverage/**,test-results/**,scratch/**,local/**,strix/**,reports/**,work/**' --fail-on-found` | PASS: 468 files scanned; 0 critical/high findings. The 8 moderate and 46 low matches are heuristic URL, UUID, and path matches. `work/**` contains the local scanner checkout and Python environment, not repository source. |
| Dependency security gate | `npm audit --audit-level=high` | PASS, exit 0; npm reports the four documented moderate Snyk findings. |
| SkillSpector and planning/memory smoke checks | `bash scripts/ai-toolkit/verify.sh` | PASS: five skill definitions validated; complete harmless sample scan returned 0 findings and `SAFE`; GSD plan validation and memory retrieval passed. |

The regular Chromium run does not exercise the real-Supabase cases. It explicitly leaves those to the real-browser step after disposable Supabase starts in CI. The local full Node and Vitest commands remain blocked by missing local PostgreSQL/Supabase; their database-dependent assertions are not represented as passing. Hosted CI now runs those assertions on a disposable Supabase stack.

The default secret-scan command also saw the ignored local `work/ai-toolkit/` install and its upstream test fixtures. The successful repository scan above excludes that environment-only directory. GitHub Actions starts from a clean checkout without that local install directory and continues to run its existing secret-scanning command.

## Database and GitHub-hosted integration testing

Codex Cloud has Docker storage driver `vfs`. This workspace previously exhausted disk extracting the Supabase PostgreSQL image. No image pull, Docker reconfiguration, or cache deletion was attempted during this task.

GitHub-hosted [workflow run 56](https://github.com/AmaratvKrishi-India/CRM-/actions/runs/38886504157), for source/test commit `44b90c58b49ffe966aec98d067b84e645bdff47a`, completed successfully:

- Disposable Supabase started; `npx supabase db reset --local --yes --sql-paths ./seed.sql` applied migrations and seed data.
- `npm test -- --runInBand`: 349/349 Node tests passed.
- `npm run test:vitest -- --reporter dot`: 21 files, 279/279 tests passed, including F040, F047, `supabase-sync`, and Dexie synchronization.
- Existing dependency gate `npm audit --audit-level=high`: passed with 4 moderate development-only Snyk findings retained and reported.
- `npx tsx scripts/secret-scanner-test.ts --fail-on-found`, `npm run build`, and `npm run test:perf:bundle`: passed.
- `npm run test:e2e:chromium`: 42 passed, 11 skipped in the standard profile; all 11 Ubuntu 24.04 visual comparisons passed. The skipped real-Supabase scenarios run separately below.
- `npx playwright test e2e/tablet-responsive.spec.ts --project=Tablet`: 2/2 passed.
- `npm run test:e2e:real`: 11/11 Chromium CRUD and multi-client tests passed against the same disposable local stack.
- Android build validation: passed. GitHub Actions assembled the debug and unsigned release configurations; Gradle reported `BUILD SUCCESSFUL` with 425 tasks. No connected-device test ran.

The Ubuntu 24.04 Linux visual baselines were reviewed one by one against the current UI and existing Windows screenshots. The 11 Ubuntu images are kept in a separate `*-chromium-ubuntu24.png` set; the Debian Linux and Windows snapshots are preserved. The earlier 11 failures were missing Ubuntu-specific baselines, not CRM UI regressions.

No SQLite or mock database is used as a substitute for PostgreSQL coverage. The full local Node/Vitest runs still cannot use Supabase in this Codex Cloud workspace, but GitHub-hosted disposable PostgreSQL/Supabase now verifies migrations, F040/F047/sync integration, and live browser CRUD/multi-client behavior. No production data or external Supabase service was used.

## Toolkit regression checks

- **NVIDIA SkillSpector 2.12.0:** unchanged installation; pinned checkout at `e8850a88c02dfc53cf8abead1ff753d35b5ba853`; sample scan passes with 100% coverage and 0 findings.
- **GSD planning adapter:** sample plan validates with 2 phases and 3 completed tasks.
- **Claude-Mem adapter:** the separate-process memory retrieval smoke check passes; the full Claude-Mem runtime remains uninstalled.
- **Agent-Reach adapter:** public GitHub HEAD lookup and official README retrieval passed for `microsoft/playwright`. Sources: https://github.com/microsoft/playwright (HEAD `034f230cc68b286055186f4d9783188536f2f3cf`) and https://raw.githubusercontent.com/microsoft/playwright/main/README.md, retrieved 2026-10-16 UTC.
- **No AI Slop writing skill:** transformation check reduced “At its core, the CRM leverages a robust dashboard to facilitate lead management, highlighting the importance of streamlined sales workflows. Ultimately, it empowers teams to manage leads.” to “The dashboard helps sales teams manage leads.” The edit keeps the stated claim while removing stock phrasing; no runtime install was needed.

The Snyk npm wrapper is present at 1.1308.1, but its first run tried to fetch the CLI binary from `downloads.snyk.io` and `static.snyk.io`; both connections were reset by the environment’s enforced egress policy. No alternate network route was used. `npm audit` remains available and was run locally and in the CI security gate.

## Storage and environment

| Measurement | At task start | After local verification |
| --- | ---: | ---: |
| Writable filesystem used | 636,706,816 bytes | 1,002,053,632 bytes |
| Writable filesystem available | 31,398,723,584 bytes | 31,033,376,768 bytes (about 28.9 GiB) |
| CRM `node_modules` | About 1.1 GiB | About 1.2 GiB |
| SkillSpector environment | 217 MiB | 217 MiB |
| SkillSpector source checkout | 19 MiB | 19 MiB |

The 11 Ubuntu screenshots add about 768 KiB. The writable layer used 365,346,816 more bytes than at task start, while 31.0 GB remained available. Existing CRM dependencies, Docker images, and caches were not cleaned. The 32 GB storage limit remains sufficient.

## CI and delivery status

The workflow retains its existing `npm audit --audit-level=high` gate and resets the disposable database before Vitest. Run 56 passed the full Vitest, browser, security, and Android build jobs. The verification report update is documentation-only and remains on the same development branch and draft PR.

The existing PR remains the delivery target and must stay Draft. Do not merge, deploy, use production data, or modify `main`.
