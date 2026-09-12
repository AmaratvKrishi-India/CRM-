# 16 — Current State and Release Decision

**Document status:** CURRENT
**Last reviewed:** 2026-09-11
**Source of truth:** this checkout, `package.json`, `src/`, `supabase/migrations/`, `GATES.md`, and the newest dated verification reports
**Release decision:** **NOT RELEASE-APPROVED**

## Checkout identity

| Item | Value |
|---|---|
| Branch | `codex/release-readiness` |
| HEAD reviewed | `edc8b3fd3a1169d1f2e3ca4bf19fadbb5844ae7a` |
| Application version | `2.0.0` |
| Web production URL | `https://crm-blush-omega.vercel.app` |
| Protected production Supabase ref | `lahvcodvgubplzfshare` |
| Allowed isolated staging ref in recent evidence | `dhoinifpzijqyobcamlv` |
| Current migration files | 14 ordered SQL migrations |
| Current local Dexie schema | Version 7 |

The working tree contains pre-existing tracked and untracked changes. This documentation refresh does not commit, reset, clean, push, deploy, or modify production.

## What is implemented

- React 19 + Vite 8 + TypeScript 6 application wrapped with Capacitor 8 for Android.
- Role-based ADMIN and AGENT experiences routed from `src/App.tsx`.
- Account-scoped Dexie local storage with repositories, transactional outbox, sync state, and schema versions 1–7.
- Scoped push/pull synchronization, server-revision ordering, retained conflicts, recovery, and Supabase Realtime reconciliation.
- PostgreSQL RLS for organization and agent lead isolation, with later migrations for ordering, abuse controls, reporting, attempt identity, purge policy, and child-record hardening.
- One server-side `create-agent` Edge Function.
- Playwright, Maestro, Node, Vitest, database, security, and performance verification tooling.

## Repository snapshot

Living documentation intentionally avoids volatile file counts. For dated audits, count the live checkout and record the exact command and exclusions used.

| Area | Role |
|---|---|
| `src/` | React application, data layer, services, sync, and utilities |
| `tests/` | Node/Vitest unit, integration, security, type, and performance tests |
| `e2e/` | Playwright specs, helpers, Maestro flows, snapshots, and evidence |
| `scripts/` | Verification, probes, generation, reports, and test runners |
| `supabase/migrations/` | Ordered PostgreSQL schema/security changes |
| `docs/project-knowledge/` | Living guides plus dated verification evidence |

## Latest verification position

The fresh [September 12 final verification](./FINAL_RELEASE_VERIFICATION_2026-09-12.md) records the current green code and artifact baseline: `npm test -- --runInBand` passed 285/285, the aggregate runner passed all 10 configured suites with every required suite and its quality gate green, and typecheck, lint, build, bundle, security-at-high-severity, accessibility, E2E, visual, local integration, isolated-staging, production migration parity, signing, and emulator artifact checks passed in their recorded scopes.

The current decision remains **NOT RELEASE-APPROVED**, but the previous database and signing blockers are cleared. Intended production is now verified at **14/14 migrations** after an authorized backed-up migration window. The recovered production signing identity exactly matches the historical certificate, and the newly rebuilt APK/AAB are signed and verified. The exact signed APK installed and cold-launched successfully on Android Studio emulators `5554`, `5556`, and `5558`. The only remaining hard release gate is a physical-device smoke test of this exact signed APK. See [GATES.md](../../GATES.md) and [FINAL_RELEASE_VERIFICATION_2026-09-12.md](./FINAL_RELEASE_VERIFICATION_2026-09-12.md).

## Evidence rules

- Historical v2.0.0 release documents describe the shipped artifact, not this dirty working tree.
- Local, staging, and production evidence are separate scopes. A local or staging pass never proves production state.
- A focused test proves only the behavior and environment it exercised.
- A failed or unavailable gate remains visible; it is not converted into a pass by using a different runner.
- New verification should create a new dated report and then update this document and `GATES.md`.

## Main entry points

- `src/main.tsx` — React mount and global providers
- `src/App.tsx` — role-based application routing and agent workspace
- `src/db/database.ts` — Dexie schema and access-scope enforcement
- `src/db/index.ts` — data-layer factory and repositories
- `src/services/sync/syncEngine.ts` — scoped synchronization coordinator
- `src/services/realtime/realtimeService.ts` — realtime subscriptions and reconciliation
- `src/services/supabaseClient.ts` — configured Supabase client factory
- `supabase/functions/create-agent/index.ts` — admin-only agent provisioning

## Next actions

1. Connect an authorized USB-debugging Android phone and install/cold-launch the exact signed APK from the 2026-09-12 candidate.
2. Record physical-device process/activity smoke evidence for that exact hash.
3. If the physical-device smoke passes, update GATES.md, this document, and the dated verification authority to a final release decision.
4. Repeat artifact-dependent gates after any code, schema, or signing change.
