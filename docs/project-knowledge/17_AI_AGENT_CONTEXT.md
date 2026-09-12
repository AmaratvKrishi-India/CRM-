# 17 — AI Agent Operating Context

**Document status:** CURRENT
**Last reviewed:** 2026-09-10
**Repository instructions:** read the root `AGENTS.md` before discovery or edits

## Current status and safety

- The historical v2.0.0 artifact is released, but this working tree is **not release-approved**. Read [16_CURRENT_STATE.md](./16_CURRENT_STATE.md) and [GATES.md](../../GATES.md) before making release claims.
- Production contains real data. Never run destructive SQL, reset, seed, or unverified migration operations against the production Supabase project.
- Do not commit, push, deploy, or sign an artifact unless the user explicitly authorizes that action.
- Preserve existing dirty work and inspect `git status` before overlapping edits.

## Architectural non-negotiables

1. UI components write to the scoped local data layer, not directly to Supabase.
2. Data mutation and outbox enqueue are atomic.
3. Every sync operation carries organization/user/role scope and stable mutation identity.
4. PostgreSQL RLS remains the authorization authority; client filtering is defense in depth.
5. Remote revisions, tombstones, and assignment revocations must not be overwritten or resurrected locally.
6. Service-role keys, database passwords, session tokens, customer exports, and signing secrets never enter source control or documentation.

## Discovery workflow

1. Read `AGENTS.md` and this document.
2. Check whether the optional `graft` and `rg` CLIs are installed before invoking them.
3. Use Graft commands when available; otherwise browse `graft/INDEX.md` and linked nodes directly for symbols, callers, architecture, and coverage.
4. Use `rg` for literal/exhaustive search when available; otherwise use `git grep -n`, PowerShell `Select-String`, or repository-native search.
5. Read exact current source ranges before editing or making behavioral claims; do not infer current behavior from historical reports or stale graph text.
6. Run focused checks proportional to the change and record failures honestly.

## High-value entry points

- [`src/main.tsx`](../../src/main.tsx)
- [`src/App.tsx`](../../src/App.tsx)
- [`src/db/database.ts`](../../src/db/database.ts)
- [`src/db/index.ts`](../../src/db/index.ts)
- [`src/services/sync/syncEngine.ts`](../../src/services/sync/syncEngine.ts)
- [`src/services/realtime/realtimeService.ts`](../../src/services/realtime/realtimeService.ts)
- [`src/services/supabaseClient.ts`](../../src/services/supabaseClient.ts)
- [`supabase/functions/create-agent/index.ts`](../../supabase/functions/create-agent/index.ts)

## Verification standards

- Distinguish Node, Vitest, browser, emulator, local PostgreSQL, staging, and production evidence.
- Use `npm run typecheck`, `npm run lint`, `npm run build`, and the relevant test runner for source changes.
- Use `npm run verify:staging-config` before staging builds or dev servers.
- Treat `GATES.md` as the current release decision and dated reports as scoped evidence.
- Do not call a gate green when it is skipped, blocked by environment, or only tested in a different candidate.

## Documentation maintenance

Update the relevant living guide when behavior changes and put durable rationale in `docs/decisions/`. Keep only the newest release-verification report needed to support `GATES.md`; fold still-valid conclusions into the living guides before superseded reports are removed. Follow [docs/README.md](../README.md).
