# 02 — System Architecture

**Document status:** CURRENT
**Last reviewed:** 2026-09-10
**Source of truth:** `src/`, `supabase/`, `package.json`, and [ADR-0001](../decisions/0001-account-scoped-offline-first-sync.md)

## High-level flow

```text
React UI
  → role-aware application shell
  → repositories and local Dexie transaction
  → account-scoped outbox
  → SyncEngine push/pull
  → Supabase Auth/PostgreSQL/RLS
  ↔ Supabase Realtime hints and reconciliation
```

The local store is the user-facing source for immediate reads and writes. PostgreSQL is the authorization and shared-state authority. Realtime improves freshness but does not replace the authoritative pull path.

## Application layers

### Entry and routing

- `src/main.tsx` mounts the React tree and global styles.
- `src/App.tsx` composes error, theme, toast, and auth providers, then routes ADMIN users to `AdminShell` and AGENT users to `SalesAppContent`.
- Capacitor app-state and back-button listeners are handled at the application boundary.

### UI and context

- Feature components are grouped under `src/components/` by domain: admin, leads, import, follow-ups, settings, backup, sync, and WhatsApp.
- `AuthContext` owns the verified server profile and session lifecycle.
- `ThemeContext` owns day/night presentation state.
- Shared error, modal, and toast components live under `src/components/common/`.

### Local data

`SalesCRMDatabase` in `src/db/database.ts` defines Dexie schema versions 1–7. The stores cover leads, call records/history, activities, remarks, follow-ups, message history/templates, users, import audits, bulk-assignment audits, outbox, and sync state. Repository writes and outbox insertion occur in one transaction.

The data-layer factory in `src/db/index.ts` exposes the scoped `crmData` repositories. Access scope is `{ organizationId, userId, role }`; local databases are partitioned so one account cannot inherit another account's cache or cursor.

### Synchronization

`src/services/sync/` contains the coordinator, queue, push, pull, conflict resolver, recovery service, state repository, background manager, hook, and shared types. The engine revalidates the server profile, enforces generation cancellation, pushes stable mutation IDs with expected revisions, pulls organization/agent-scoped pages, and prunes records after access is revoked.

### Realtime

`src/services/realtime/realtimeService.ts` subscribes to the published CRM entities, validates organization and role visibility, hydrates safe changes, and invokes the same scoped reconciliation path after reconnect. Realtime delivery is an optimization and recovery trigger; the pull cursor remains authoritative.

### Supabase boundary

- Auth provides sessions and JWTs.
- PostgreSQL migrations define schema, RLS, ordering, purge, reporting, and hardening behavior.
- RLS is the final data boundary; client filtering is defense in depth only.
- `supabase/functions/create-agent/index.ts` is the server-only agent provisioning boundary and is the only current Edge Function.

## Architectural invariants

- No UI component writes directly to Supabase.
- A local data mutation and its outbox item commit or roll back together.
- Every push and pull is scoped to the active account and organization.
- An acknowledged server revision is not replaced by a stale local write.
- Remote tombstones and assignment revocations cannot resurrect inaccessible local graphs.
- Logout, revocation, role change, or account change disposes the old engine before another scope is activated.

## Boundaries and ownership

| Boundary | Owner | Contract |
|---|---|---|
| UI → data layer | components + repositories | local-first, scoped writes |
| data layer → sync | repositories + outbox | durable mutation identity and atomic enqueue |
| sync → Supabase | sync services + RLS | conditional, scoped push/pull |
| Realtime → local state | realtime service | validate, reconcile, recover through pull |
| Admin provisioning → backend | agent service + Edge Function | authenticated ADMIN only |

See [08 — Sync and realtime architecture](./08_SYNC_REALTIME_ARCHITECTURE.md), [07 — Supabase security model](./07_SUPABASE_SECURITY_MODEL.md), and [16 — Current state](./16_CURRENT_STATE.md) for current evidence and release status.
