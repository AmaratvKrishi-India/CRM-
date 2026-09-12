# 15 — Codebase Index

**Document status:** CURRENT
**Last reviewed:** 2026-09-10
**Source of truth:** repository paths and the generated `graft/` source map

This index is a human navigation map. File counts are a checkout snapshot and may change; use `rg --files` when available; otherwise use `git ls-files`, PowerShell file discovery, or the generated source map for exhaustive discovery.

## Root

| Path | Purpose |
|---|---|
| `README.md` | Project overview and top-level navigation |
| `CONTRIBUTING.md` | Contributor rules and required checks |
| `CHANGELOG.md` | Versioned changes and documentation refreshes |
| `GATES.md` | Current release gate decision |
| `package.json` / `package-lock.json` | Scripts and locked dependencies |
| `vite.config.ts` / `tsconfig.json` | Build and TypeScript configuration |
| `playwright.config.ts` / `vitest.config.ts` | Test configuration |
| `capacitor.config.ts` | Capacitor application configuration |
| `.env.example` | Safe environment template |

## Application source (`src/`, 101 files)

| Path | Responsibility |
|---|---|
| `src/main.tsx` | React mount |
| `src/App.tsx` | Provider composition, role routing, agent workspace |
| `src/components/` | Feature UI grouped by domain |
| `src/context/` | Auth and theme providers |
| `src/db/database.ts` | Dexie schema versions 1–7 and access scope |
| `src/db/index.ts` | Data-layer factory and repository wiring |
| `src/db/repositories/` | Lead, call, follow-up, activity, message, import, user, and audit persistence |
| `src/services/` | Business services, auth, backup, native platform, reporting, Supabase, sync, and realtime |
| `src/services/sync/` | Engine, push, pull, queue, conflicts, recovery, state, background lifecycle |
| `src/services/realtime/` | Realtime channel and event types |
| `src/utils/` and `src/lib/` | Shared validation, date, labels, and hooks |

## Backend and native surfaces

| Path | Responsibility |
|---|---|
| `supabase/migrations/` | 14 ordered PostgreSQL schema/security migrations |
| `supabase/seed.sql` | Disposable local seed data |
| `supabase/functions/create-agent/` | Admin-only agent provisioning Edge Function |
| `supabase/config.toml` | Local Supabase configuration |
| `android/` | Capacitor Android project and native lifecycle code |
| `public/` | Web-served static assets |
| `release/` | Shipped APK and historical release notes |

## Verification surfaces

| Path | Inventory | Responsibility |
|---|---:|---|
| `tests/` | 65 files | Unit, integration, security, type, and performance tests |
| `e2e/` | 29 files | Playwright specs, Maestro workflows, helpers, and snapshots |
| `scripts/` | 23 files | Verification, bundle, schema, staging, catalog-generation, and smoke tooling |
| `docs/` | Living guides, ADRs, reference material | Human-maintained project knowledge; superseded evidence has been removed |
| `graft/` | Generated | Source-linked code map; use the checked-in map directly when the Graft CLI is unavailable |

## High-value symbols

- `SalesAppContent` — `src/App.tsx`
- `AdminShell` — `src/components/admin/AdminShell.tsx`
- `SalesCRMDatabase` — `src/db/database.ts`
- `createCRMDataLayer` — `src/db/index.ts`
- `SyncEngine` — `src/services/sync/syncEngine.ts`
- `RealtimeService` — `src/services/realtime/realtimeService.ts`
- `getSupabaseClient` — `src/services/supabaseClient.ts`
- `createAgent` — `supabase/functions/create-agent/index.ts`

## Discovery guidance

- Use the codebase graph for symbol and call-relationship questions.
- Use exact repository-relative paths for source links.
- Use `rg` for literal strings, configuration, and non-code documents.
- Treat `coverage/`, `dist/`, `playwright-report/`, `test-results/`, and `scratch/` as generated/local output rather than source.
