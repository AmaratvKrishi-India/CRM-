# 09 — API and Data Contracts

**Document status:** CURRENT
**Last reviewed:** 2026-09-10
**Source of truth:** `src/db/types.ts`, `src/services/sync/syncTypes.ts`, sync/realtime services, the `create-agent` Edge Function, and all 14 SQL migrations

This document describes the current contract boundaries between the TypeScript client, account-scoped Dexie storage, Supabase/Postgres, Realtime, and privileged agent provisioning.

## Core domain unions

Important current unions include:

- `UserRole`: `ADMIN | AGENT`
- `UserStatus`: `ACTIVE | INACTIVE`
- `CallVerificationStatus`: `VERIFIED | UNVERIFIED`
- `CallRecordStatus`: `DIAL_ATTEMPT | CONNECTED | NOT_CONNECTED | CANCELLED | UNKNOWN`
- `SyncOperation`: `CREATE | UPDATE | DELETE`
- `OutboxStatus`: `PENDING | SYNCING | SYNCED | FAILED | DEAD_LETTER`
- `SyncEngineStatus`: `SYNCED | SYNCING | OFFLINE | PENDING | ERROR | AUTH_REQUIRED`

For complete lead status, activity type, message/template, remark, and follow-up unions, use `src/db/types.ts`; copied enum lists in prose are not authoritative when source changes.

## Synchronized entity set

The server sync protocol allowlists these 9 entities:

`leads`, `call_records`, `activities`, `remarks`, `follow_ups`, `message_history`, `import_audits`, `profiles`, `bulk_assignment_audits`.

`organizations` is not a normal outbox entity. Client-only stores such as `messageTemplates` and `callHistory` are not part of the 9-table server mutation allowlist.
## Server sync metadata

Server-synchronized records carry a monotonic `serverRevision`/`sync_revision`. The client must treat this as server ordering metadata, not a timestamp and not the same thing as the legacy business `version` field.

The durable local `OutboxItem` currently includes:

- identity/scope: `id`, `organizationId`, `userId`, `deviceId`, `entityType`, `entityId`;
- mutation: `operation`, `payload`, `expectedRevision`, `sequence`, `predecessorId`;
- retry state: `status`, `retryCount`, `lastAttemptAt`, `nextAttemptAt`, `lastError`;
- conflict evidence: `conflictRemote`;
- timestamps: `createdAt`, `updatedAt`.

`expectedRevision` captures the mutation base and is never silently rebased. A conflict that requires review is retained as `DEAD_LETTER` with the remote conflict record rather than being overwritten by last-writer-wins behavior.

`SyncState` includes `id`, `deviceId`, **both** `organizationId` and `userId`, pull/push timestamps and cursor, last error, and engine status. The state row lives inside the verified account partition.

## Mutation RPC

Client writes use the PostgreSQL RPC:

`sync_mutate(entity, operation, mutation_id, expected_revision, payload)`

The RPC validates entity/operation allowlists, organization scope, revision metadata and payload fields. The local outbox UUID is used as `mutation_id`, making a replay of the same request idempotent. Reusing a mutation UUID with different data is rejected.
Mutation outcomes are server authoritative:

- `APPLIED` — mutation committed or an identical already-applied mutation was replayed.
- `CONFLICT` — the expected revision/row state does not match the authoritative server state; the client retains the local edit for explicit recovery/review.

Verified call duration is protected server-side: an unverified call mutation cannot downgrade a server record that already has `verification_status='VERIFIED'` and its verified duration.

## Pull and Realtime

`SyncPull` reads organization-scoped remote changes and converts PostgreSQL `snake_case` records to client `camelCase`. Revisions/cursors prevent older server state from overwriting newer state. Assignment revocation is reconciled by authoritative visible-lead snapshots and local graph pruning.

Realtime subscribes to `postgres_changes` for all **9 synchronized entity tables**, including `bulk_assignment_audits`. The channel is filtered by `organization_id`; local access-scope checks are applied again before data reaches Dexie. ADMIN can receive organization-authorized audit data; AGENT logic rejects bulk-assignment audit rows and checks parent-lead/identity authorization for other records.

Realtime is an acceleration path, not the sole consistency mechanism. Pull/recovery remains authoritative after disconnects, missed events, process restarts, or assignment changes.

## Supabase REST/RPC boundary

Normal table access uses the Supabase client with its public anon key plus the authenticated bearer session, with RLS as the server authorization boundary. Privileged service-role credentials are never part of the browser/Android client contract.

Important callable RPCs include `sync_mutate`, `sync_head`, `sync_was_deleted`, and the safe operational reporting path. Agent provisioning is intentionally **not** a direct client table/Auth-admin operation; it goes through the `create-agent` Edge Function.

## Agent provisioning request

The current `create-agent` request body requires:

- `name` — string, at least 2 characters;
- `email` — valid email string;
- `phone` — optional string;
- `password` — string, at least 6 characters;
- `idempotencyKey` — required UUID.
Successful responses return sanitized agent fields and may include `replayed: true` when an already-completed idempotent request is returned. Passwords are never returned or persisted for comparison.

## Call-duration contract

`durationSeconds` is the verified duration field. `reportedDurationSeconds` is a separate device-reported value and must not be presented as verified merely because the app paused/resumed around a dialer launch. `verificationStatus` determines whether the duration has trusted verification evidence.

## Reference files

- [`src/db/types.ts`](../../src/db/types.ts)
- [`src/services/sync/syncTypes.ts`](../../src/services/sync/syncTypes.ts)
- [`src/services/sync/syncPush.ts`](../../src/services/sync/syncPush.ts)
- [`src/services/sync/syncPull.ts`](../../src/services/sync/syncPull.ts)
- [`src/services/realtime/realtimeService.ts`](../../src/services/realtime/realtimeService.ts)
- [`supabase/functions/create-agent/index.ts`](../../supabase/functions/create-agent/index.ts)
- [`08_SYNC_REALTIME_ARCHITECTURE.md`](./08_SYNC_REALTIME_ARCHITECTURE.md)
- [`14_MIGRATION_HISTORY.md`](./14_MIGRATION_HISTORY.md)
