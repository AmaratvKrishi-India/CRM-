# 01 — Project Overview

**Document status:** CURRENT
**Last reviewed:** 2026-09-11
**Source of truth:** `package.json`, `src/`, `supabase/`, `tests/`, and `e2e/`

## Application identity

- **Name:** Amaratv Krishi Field Sales CRM
- **Package:** `amaratvkrishi-sales-crm` v2.0.0
- **Android application ID:** `com.amaratvkrishi.salescrm`
- **Production web URL:** <https://crm-blush-omega.vercel.app>
- **Production Supabase project:** `lahvcodvgubplzfshare` (protected; never use as staging)
- **Release decision for this checkout:** not release-approved; see [16_CURRENT_STATE.md](./16_CURRENT_STATE.md)

## Business purpose

This is an offline-first field-sales CRM for the gym, fitness, and wellness market in Lucknow, Uttar Pradesh. Administrators manage the lead pool and agents; field agents work assigned leads, place calls, log outcomes, schedule follow-ups, and send WhatsApp messages.

## Core workflow

1. Admin imports or creates leads.
2. Admin assigns leads individually or in bulk.
3. Agent opens assigned leads and uses the native dialer.
4. Agent records a verified or unverified call outcome, notes, and follow-up.
5. Agent sends intent-based WhatsApp messages when appropriate.
6. Local writes enter the account-scoped Dexie store and transactional outbox.
7. The scoped sync engine pushes/pulls with Supabase; Realtime accelerates reconciliation.
8. Admin monitors dashboards, activity, reports, and assignment history.

## Technology stack

- React 19.2.8, React DOM 19.2.8, Vite 8.2.2, TypeScript 6.0.3
- Tailwind CSS 4.3.3, Inter, Lucide React
- Capacitor 8.5.1 core/Android with App, Share, and Local Notifications plugins
- Dexie 4.4.5 for account-scoped IndexedDB storage
- Supabase JS 2.112.4, PostgreSQL, Auth, Realtime, and one Edge Function
- Playwright 1.62.1, Vitest 4, Node test runner via `tsx`, Maestro, and Docker-backed SQL tests

## Current repository shape

File counts are intentionally not hard-coded in living documentation because snapshots, generated evidence, and verification scripts change frequently. For an audit, count the live checkout and record the command and exclusions with the dated evidence.

| Area | Purpose |
|---|---|
| `src/` | React UI, contexts, Dexie repositories, services, sync, realtime |
| `tests/` | Node/Vitest unit, integration, security, type, and performance coverage |
| `e2e/` | Playwright browser workflows, helpers, Maestro flows, and generated snapshots/evidence |
| `scripts/` | Verification, diagnostics, generation, probes, and test runners |
| `supabase/migrations/` | Ordered schema, RLS, sync, reporting, and hardening changes |
| `android/` | Capacitor Android build and native lifecycle surface |
| `docs/` | Living guides, ADRs, reference material, and dated verification evidence |

## Important entry points

- [`src/main.tsx`](../../src/main.tsx) — React mount
- [`src/App.tsx`](../../src/App.tsx) — role-based routing and agent workspace
- [`src/components/admin/AdminShell.tsx`](../../src/components/admin/AdminShell.tsx) — admin shell
- [`src/db/database.ts`](../../src/db/database.ts) — Dexie schema versions 1–7 and access scope
- [`src/db/index.ts`](../../src/db/index.ts) — repository/data-layer factory
- [`src/services/sync/syncEngine.ts`](../../src/services/sync/syncEngine.ts) — sync coordinator
- [`src/services/realtime/realtimeService.ts`](../../src/services/realtime/realtimeService.ts) — Realtime subscriptions
- [`src/services/supabaseClient.ts`](../../src/services/supabaseClient.ts) — Supabase client factory
- [`supabase/functions/create-agent/index.ts`](../../supabase/functions/create-agent/index.ts) — admin-only agent provisioning

## Security and data boundaries

PostgreSQL RLS is authoritative. The client also enforces an account-scoped local partition, organization filters, agent visibility checks, generation cancellation, and pruning after revoked access. Service-role credentials are limited to the Edge Function environment and must never appear in client environment files or documentation.

## Related documents

- [02 — System architecture](./02_SYSTEM_ARCHITECTURE.md)
- [07 — Supabase security model](./07_SUPABASE_SECURITY_MODEL.md)
- [08 — Sync and realtime architecture](./08_SYNC_REALTIME_ARCHITECTURE.md)
- [12 — Testing and verification](./12_TESTING_VERIFICATION.md)
- [16 — Current state](./16_CURRENT_STATE.md)
- [23 — Local development setup](./23_LOCAL_DEV_SETUP.md)
- [Documentation guide](../README.md)
