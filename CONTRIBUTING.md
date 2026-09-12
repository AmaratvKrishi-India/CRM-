# Contributing

Use Node 26 and the committed package lock. Run `npm ci` in a fresh checkout, then
`npm run dev` for the web app. Copy environment templates only into ignored local
files. Never commit passwords, session tokens, service-role keys or customer exports.
Start with [README](README.md) and the [documentation guide](docs/README.md), then use [local setup](docs/project-knowledge/23_LOCAL_DEV_SETUP.md);
the machine-state table in the latter is historical, not a current prerequisite check.

For live integration tests, Docker must be running. Use `npx supabase start`, then
`npx supabase migration up --local` to apply pending migrations without resetting
data. The test harness discovers loopback credentials with `supabase status` and
refuses remote URLs. Do not paste its credential output into reports. Seed admin
and agent accounts must be available. `supabase db reset --local` destroys local
data; use it only for an explicitly disposable stack after preserving needed data.

## Change and review workflow

- Read the repository instructions and graph context before discovery. Check the
  branch, HEAD and working tree; preserve changes made by others.
- Use a `codex/` branch for assistant-created branches. Keep each defect scoped to
  its root cause and link its finding or issue in the review description.
- Keep repository writes and their outbox/audit writes atomic. Preserve stable
  mutation IDs and server revisions. Never clear unsynced work to make a test pass.
- Add a regression at the failing boundary. Distinguish mocks, real IndexedDB
  substitutes, local PostgreSQL, real HTTP/WebSocket delivery and device evidence.
- Describe behavior, why it changed, commands and exact results, migrations,
  compatibility and remaining runtime checks. Record every failed attempt before
  a justified rerun. Do not claim staging or device verification from a local build.
- Commits, pushes and deployments require task authorization. This remediation
  pass authorizes none of them.

## Required local checks

```sh
npm test -- --runInBand
npm run test:vitest
npm run typecheck
npm run lint
npm run build
npm run test:perf:bundle
```

The Node runner owns top-level tests and excludes the separate legacy emulator
and live-Postgres scripts. Vitest owns nested integration, service, database and
utility tests; its real Supabase cases require the local stack. Run the relevant
existing security/integration suites too. Explain unavailable prerequisites and
all skips. Do not repeatedly rerun a flaky gate and report only the passing run.

`npm run test:perf:bundle` measures actual minified JavaScript bytes per emitted
chunk with a 600 KiB limit, matching the existing Vite advisory limit. It writes
nonzero raw/gzip/Brotli measurements and a visualizer report under ignored
`test-results/bundle-analysis`, and exits nonzero for an exceeded or invalid
budget. `--threshold <KiB>` permits a deliberate negative test. CI enforces the
default budget. Review budget changes as product/performance decisions.

For browser changes run applicable Playwright cases (`npm run test:e2e:chromium`).
For native changes build/sync the intended environment and record device identity,
WebView version and lifecycle results. Never point local test writers at staging
or production. The [current state](docs/project-knowledge/16_CURRENT_STATE.md), [release gates](GATES.md),
and [latest release sign-off](docs/project-knowledge/FINAL_RELEASE_SIGNOFF_2026-09-09.md)
list the remaining runtime evidence and release prerequisites.
