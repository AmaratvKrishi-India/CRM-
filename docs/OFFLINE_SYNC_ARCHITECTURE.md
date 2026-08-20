# Amaratv Krishi CRM — Offline-First Bidirectional Sync Engine (Phase 2F)

## 1. Architecture Overview
The Offline Sync Engine coordinates continuous, non-blocking data exchange between local Dexie IndexedDB instances on Android devices and the central Supabase PostgreSQL database.

```text
       ┌─────────────────────────────────────────────────────────────┐
       │                 LOCAL ANDROID DEVICE (OFFLINE-FIRST)        │
       │                                                             │
       │   [Sales UI / Admin Console]                                │
       │         │                                                   │
       │         ▼                                                   │
       │   [Dexie IndexedDB (SalesCRMDatabase v4)]                   │
       │         │                                                   │
       │         ├── (Mutations) ──► [Outbox Queue Store]            │
       │         │                         │                         │
       └─────────┼─────────────────────────┼─────────────────────────┘
                 │                         │
                 │              ┌──────────┴──────────┐
                 │              │    SYNC ENGINE      │
                 │              │  (Push/Pull Worker) │
                 │              └──────────┬──────────┘
                 │                         │
                 ▼                         ▼
       ┌─────────────────────────────────────────────────────────────┐
       │                 SUPABASE POSTGRESQL CLOUD                   │
       │                                                             │
       │   [Row Level Security (RLS) + Organization Multi-Tenancy]   │
       │   - public.organizations                                    │
       │   - public.profiles                                         │
       │   - public.leads                                            │
       │   - public.call_records                                     │
       │   - public.activities (Append-Only)                         │
       │   - public.remarks                                          │
       │   - public.follow_ups                                       │
       │   - public.message_history                                  │
       │   - public.import_audits                                    │
       └─────────────────────────────────────────────────────────────┘
```

---

## 2. Sync Components & Responsibilities

| Component | File Path | Core Functionality |
|---|---|---|
| **Sync Types** | [`src/services/sync/syncTypes.ts`](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/syncTypes.ts) | Defines `OutboxItem`, `SyncState`, `SyncConflict`, and `SyncResult`. |
| **Sync Queue** | [`src/services/sync/syncQueue.ts`](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/syncQueue.ts) | Manages persistent `outbox` table in Dexie with `PENDING`, `SYNCING`, `SYNCED`, `FAILED` states. |
| **Push Engine** | [`src/services/sync/syncPush.ts`](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/syncPush.ts) | Batches pending outbox mutations, maps columns to PostgreSQL format, upserts using UUIDs, and isolates partial failures. |
| **Pull Engine** | [`src/services/sync/syncPull.ts`](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/syncPull.ts) | Incremental pull since `lastPullCursor`, mapping snake_case rows to local models, and applying conflict rules. |
| **Conflict Resolver** | [`src/services/sync/syncConflictResolver.ts`](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/syncConflictResolver.ts) | Implements deterministic rules: UUID idempotency for append-only records, and Last-Write-Wins (LWW) for mutable entities. |
| **State Repo** | [`src/services/sync/syncStateRepository.ts`](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/syncStateRepository.ts) | Manages local `syncState` cursor, timestamps, and engine status. |
| **Sync Engine** | [`src/services/sync/syncEngine.ts`](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/syncEngine.ts) | Orchestrates Push $\rightarrow$ Pull $\rightarrow$ State update cycle and handles online/focus triggers. |
| **UI Badge** | [`src/components/sync/SyncStatusBadge.tsx`](file:///c:/Users/PC/Desktop/calling%20app/src/components/sync/SyncStatusBadge.tsx) | Non-intrusive status pill with manual sync trigger. |

---

## 3. Conflict Resolution Matrix

| Entity Type | Class | Strategy | Rationale |
|---|---|---|---|
| `call_records` | Append-Only | UUID Idempotency | Historical call records are immutable; duplicate pushes do not overwrite local metadata. |
| `activities` | Append-Only | UUID Idempotency | Activity events are immutable audit logs. |
| `message_history` | Append-Only | UUID Idempotency | WhatsApp dispatch logs are historical records. |
| `import_audits` | Append-Only | UUID Idempotency | Batch file import statistics are immutable logs. |
| `leads` | Mutable | Last-Write-Wins (LWW) | Newest `updated_at` timestamp takes precedence. |
| `follow_ups` | Mutable | Last-Write-Wins (LWW) | Newest `updated_at` timestamp takes precedence. |
| `remarks` | Mutable | Last-Write-Wins (LWW) | Newest `updated_at` timestamp takes precedence. |
| `profiles` | Mutable | Last-Write-Wins (LWW) | Central profile updates sync down to agent devices. |

---

## 4. Partial Failure & Error Isolation
- When pushing a batch of outbox mutations (e.g. 50 items):
  - If a batch upsert succeeds, all 50 items are marked `SYNCED`.
  - If a batch encounter an error (e.g. item 51 has a constraint violation), the push engine falls back to individual item processing.
  - Successfully acknowledged items are marked `SYNCED`.
  - The failed item is marked `FAILED` with its error reason and incremented `retryCount`.
  - Remaining queued items stay safely in `PENDING` state and are not discarded.

---

## 5. Offline-First Autonomy & Security Invariants
- **Zero UI Latency**: All CRM operations (calling, searching, editing, adding remarks, scheduling follow-ups) write immediately to Dexie.
- **No Service-Role Key**: Supabase client uses only public `anon` credentials with PostgreSQL Row Level Security (RLS).
- **Session Expiry Protection**: If an auth session expires, local CRM operation continues normally; sync engine transitions to `AUTH_REQUIRED` without deleting local data or clearing the outbox.
- **Backup Preservation**: Local JSON backup export preserves the `outbox` queue and sync state.
