# 08 - SYNC & REALTIME ARCHITECTURE

## Overview
Offline-first bidirectional sync between Dexie (IndexedDB) and Supabase PostgreSQL. Push-then-Pull pattern.

## Key Source Files
- [syncEngine.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/syncEngine.ts) (6,320 bytes) - Central coordinator
- [syncPush.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/syncPush.ts) (10,339 bytes) - Push mutations
- [syncPull.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/syncPull.ts) (10,686 bytes) - Pull changes
- [syncQueue.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/syncQueue.ts) (4,767 bytes) - Outbox queue
- [syncConflictResolver.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/syncConflictResolver.ts) (3,629 bytes) - Conflict resolution
- [backgroundSyncManager.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/backgroundSyncManager.ts) (5,210 bytes) - Auto-sync lifecycle
- [syncStateRepository.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/syncStateRepository.ts) (1,911 bytes) - Cursor state
- [syncTypes.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/syncTypes.ts) (1,769 bytes) - Type definitions
- [useSync.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/useSync.ts) (845 bytes) - React hook
- [realtimeService.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/realtime/realtimeService.ts) (13,173 bytes) - Realtime subscriber
- [realtimeTypes.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/realtime/realtimeTypes.ts) (1,451 bytes) - Realtime types

## Outbox Queue (SyncQueue)
- Dexie `outbox` table: `id`, `entityType`, `entityId`, `operation`, `payload`, `status`, `retryCount`, `lastAttemptAt`, `lastError`
- Compound index: `[status+createdAt]`
- Operations: `CREATE`, `UPDATE`, `DELETE`
- Status flow: `PENDING` -> `SYNCING` -> `SYNCED` / `FAILED`
- Every repository method calls `syncQueue.enqueue()` inside the same Dexie transaction as the data
  write (BUG-4 fix, 2026-08-23): data + outbox persist atomically, or neither does. Enqueue failure
  aborts the transaction instead of being swallowed.

## Push Phase (SyncPush)
- Reads `PENDING` outbox items ordered by `createdAt`
- Batches by `entityType` (9 entity types)
- Transforms `camelCase` -> `snake_case` for Supabase
- Operation-aware push (BUG-8 fix, 2026-08-23): `CREATE`/`UPDATE` items accumulate into an upsert
  batch (`.upsert` with `onConflict: 'id'`); a `DELETE` item flushes pending upserts first, then
  executes `.delete().eq('id', entityId)` individually. A DELETE is never converted into an upsert
  (no resurrection), and DELETE is idempotent (0-row delete = success) so retries are safe.
- On batch failure: falls back to single-record retry
- Marks items `SYNCED` or `FAILED` with error message
- Increments `retryCount` on failure
- Cloud hard-delete requires migration 000007 (child FK CASCADE + `leads_delete_policy`); applied
  locally, cloud application is a release step.

## Pull Phase (SyncPull)
- Uses cursor (`lastPullCursor`) to pull only new/changed records
- Queries each table: `SELECT * WHERE updated_at > cursor ORDER BY updated_at ASC`
- Incremental pagination (safe, no infinite loops)
- Transforms `snake_case` -> `camelCase`
- Applies `SyncConflictResolver` for each incoming record
- Upserts resolved records into Dexie

## Conflict Resolution (SyncConflictResolver)
Four rules:
1. Append-only entities (activities): local wins on UUID match (idempotency)
2. Call records: `VERIFIED` status ALWAYS wins over `UNVERIFIED` (regardless of timestamp)
3. All others: Last-Write-Wins (LWW) by `updatedAt` timestamp
4. LWW tie-break (BUG-5 fix, 2026-08-23): exactly equal timestamps resolve deterministically to
   REMOTE (server canonical; pull is the convergence path) and the tie is recorded as a
   `REMOTE_WON` conflict.

## Background Sync Manager
Trigger points:
- User login (immediate full sync)
- App resume (Capacitor `App.addListener`)
- Visibility change (`document.visibilityState`)
- Network reconnect (`window.addEventListener 'online'`)
- Periodic interval timer

Behavior:
- Single-flight mutex (no concurrent syncs)
- Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s (cap)
- Non-blocking UI (status badge only, no modal confirmations)

## Realtime Service
- Subscribes to Supabase `postgres_changes` channel
- 9 published tables (all with `REPLICA IDENTITY FULL`): `leads`, `call_records`, `activities`, `remarks`, `follow_ups`, `message_history`, `profiles`, `import_audits` (migration 4) + `bulk_assignment_audits` (migration 5)
- Client subscribes to 8 of them (all except `bulk_assignment_audits`)
- Events: `INSERT`, `UPDATE`, `DELETE`
- On receive: hydrates into local Dexie + emits to listeners. Every subscribed table has a
  reconciliation case; `message_history` uses insert-if-absent (append-only, same pattern as
  `import_audits`) — BUG-2 fix, 2026-08-23. Pull remains the eventual-consistency fallback.
- Connection states: `DISCONNECTED` -> `CONNECTING` -> `SUBSCRIBING` -> `SUBSCRIBED` -> `RECONNECTING` -> `ERROR`
- Provides: live activity feed, in-app notifications, entity change listeners

## Sync State
- Persisted in Dexie `syncState` table (single row, `id='current'`)
- Fields: `deviceId`, `organizationId`, `lastSuccessfulSyncAt`, `lastPullCursor`, `lastPushAt`, `lastPullAt`, `lastSyncError`, `status`
- SyncEngineStatus: `SYNCED`, `SYNCING`, `OFFLINE`, `PENDING`, `ERROR`, `AUTH_REQUIRED`

## React Integration
- `useSync()` hook: provides reactive sync state + manual trigger
- `SyncStatusBadge` component: displays current sync status in header
