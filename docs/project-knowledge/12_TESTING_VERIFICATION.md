# 12 — Testing and Verification

**Document status:** CURRENT
**Last reviewed:** 2026-09-11
**Source of truth:** `package.json`, `tests/`, `e2e/`, `scripts/`, and dated verification reports

## Test topology

The repository intentionally has more than one runner. A result is valid only when its command, environment, candidate identity, and scope are recorded together.

| Layer | Tooling | Scope |
|---|---|---|
| Node suite | `tsx` + Node test runner | unit/regression and selected local integration tests |
| Vitest unit phase | Vitest 4 | service, database, and utility tests; `tests/integration/**` is explicitly excluded |
| Vitest integration phase | Vitest 4 | `tests/integration/**` only, run separately so database-dependent suites are not duplicated |
| Browser E2E | Playwright 1.62 | Chromium and configured mobile/browser projects |
| Android flows | Maestro + ADB | emulator workflows under `e2e/maestro/` |
| Database/RLS | Docker Supabase + SQL/HTTP tests | disposable local or explicitly isolated staging only |
| Static gates | TypeScript, ESLint, Vite, bundle budget, secret scan | source/build safety |

## Standard commands

```powershell
npm run test:node
npm run test:vitest
npm run typecheck
npm run lint
npm run build
npm run test:perf:bundle
npm run test:e2e:chromium
npm run test:all
```

For a local database-backed run:

```powershell
npx supabase start
npx supabase migration up --local
npm run test:node
npm run test:vitest
```

Never point local test writers at production. The staging configuration must pass `npm run verify:staging-config` and use a project reference different from production.

## Current verification position

- `npm run typecheck`: latest dated evidence reports PASS.
- `npm run lint`: latest dated evidence reports PASS with 77 disclosed `no-explicit-any` warnings and no errors.
- `npm run build`: latest dated evidence reports PASS.
- `npm run test:perf:bundle`: latest dated evidence reports PASS with no budget warnings.
- Focused ordering, RLS hardening, accessibility, WebView, and bounded-search checks are recorded as passing in [FINAL_RELEASE_SIGNOFF_2026-09-09.md](./FINAL_RELEASE_SIGNOFF_2026-09-09.md).
- Full Node/Vitest results remain environment- and runner-dependent in the dated reports; the current release gate requires a stable rerun before distribution.

## Evidence requirements

Every verification report should include:

1. branch, commit, and relevant file identity;
2. exact command and start/end time;
3. environment and target project/device;
4. pass, fail, skip, and todo counts;
5. full failure output or a path to preserved evidence;
6. cleanup result and any remaining limitation.

Do not combine unit, mocked, browser, emulator, local PostgreSQL, staging, and production claims into one undifferentiated “passed” statement.

## Test areas

- **Data safety:** Dexie persistence, repository/outbox atomicity, backup/restore, deletion audits, formula imports, and lead normalization.
- **Sync:** ordering, conflict resolution, retry/dead-letter recovery, account scoping, reconnect, pull pruning, and multi-device behavior.
- **Security:** RLS organization/agent isolation, secret scanning, Edge Function abuse controls, CSP, and WebView debugging policy.
- **UI:** role routing, keyboard access, skip links, theme, responsive layouts, and visual regression.
- **Release:** TypeScript, lint, production build, bundle budget, staging guard, emulator install/launch, and signing.

## Related documents

- [GATES.md](../../GATES.md)
- [16 — Current state](./16_CURRENT_STATE.md)
- [20 — Toolchain and CLI status](./20_TOOLCHAIN_CLI_STATUS.md)
- [23 — Local development setup](./23_LOCAL_DEV_SETUP.md)
- [24 — Isolated staging environment](./24_STAGING_ENVIRONMENT.md)
- [Latest completed historical verification](./FINAL_RELEASE_SIGNOFF_2026-09-09.md)
