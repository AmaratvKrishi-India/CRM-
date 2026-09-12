# ADR-0001: Account-scoped offline-first synchronization

**Date**: 2026-09-06  
**Status**: accepted  
**Deciders**: Project maintainers; retrospectively recorded from the implemented design

## Context

The CRM must accept local work while disconnected, synchronize multiple devices without trusting device clocks, and prevent data from crossing organization or user boundaries. Mobile processes, network requests, and Realtime delivery can stop, repeat, arrive late, or complete after an account change. The implementation therefore needs durable retry and conflict evidence, a trustworthy ordering source, and pull-based recovery rather than assuming continuous delivery.

## Decision

We use an account-scoped offline-first protocol with these cooperating controls:

- Each active engine is bound to one verified `{organizationId, userId, role}` scope and one account-partitioned Dexie database. Every cycle revalidates the server profile; generation guards retire late work after logout, account change, or disposal.
- The transactional outbox commits repository mutations and their outbox entries together in Dexie transactions. Outbox records retain a stable mutation UUID, captured server base revision, causal predecessor, payload, scope, retry state, and conflict evidence across restarts.
- Server-issued revisions are monotonically increasing per-organization `sync_revision` values assigned by PostgreSQL at commit-serialized write boundaries. Device timestamps remain business metadata and never decide synchronization order.
- Push uses the RLS-preserving `sync_mutate` RPC. Mutations carry a stable UUID and expected revision; identical response-loss retries are idempotent, stale bases return `CONFLICT`, and rejected payloads remain durable as dead letters for explicit review.
- Pull reads every synchronized entity inside one fixed `(previous revision, committed head]` window, with revision-and-ID pagination. The cursor advances only after all entity pages and visibility pruning succeed.
- Realtime accelerates convergence but is not the recovery authority. Events are scope-checked, generation-checked, and revision-checked before reconciliation; reconnect invokes the same scoped pull path to recover missed events.
- Authorization fails closed. Local access requires the active partition scope, sync revalidates the server-authoritative profile, server mutations retain caller RLS, and incoming pull/Realtime records are independently checked before local persistence.

## Current Implementation

- Cycle orchestration and fail-closed revalidation: `src/services/sync/syncEngine.ts` (`SyncEngine.synchronizeNow`).
- Durable outbox, causal order, bounded retry, and force-stop recovery: `src/services/sync/syncQueue.ts` (`enqueue`, `recoverStuckItems`, `markFailed`). Repository methods wrap entity writes and enqueue operations in their own Dexie transactions.
- Conditional/idempotent push and durable conflicts: `src/services/sync/syncPush.ts` (`pushPending`).
- Fixed-head revision-window pull and scope-aware reconciliation: `src/services/sync/syncPull.ts` (`pullEntityChanges`, `pullAllChanges`).
- Revision-based local conflict handling: `src/services/sync/syncConflictResolver.ts`.
- Scoped event acceleration and reconnect reconciliation: `src/services/realtime/realtimeService.ts`.
- Server revision allocation, deleted-identity retention, and RLS-preserving mutation RPC: `supabase/migrations/20260905000008_server_sync_ordering.sql`.

## Alternatives Considered

### Client timestamps

- **Pros**: Simple comparison and no server ordering metadata.
- **Cons**: Device clock skew, future timestamps, and equal timestamps can select the wrong write or advance a cursor past later legitimate commits.
- **Why not**: Client clocks are not a trustworthy causal or commit-order source. Server revisions now determine synchronization order.

### Unconditional upserts

- **Pros**: Small client implementation and naturally repeatable creates by primary key.
- **Cons**: A stale offline write can overwrite newer server state; response-loss retry intent and conflicts become indistinguishable.
- **Why not**: Conditional expected revisions and stable mutation UUIDs preserve idempotence without silently accepting stale data.

### Realtime-only synchronization

- **Pros**: Low-latency updates and less explicit polling logic.
- **Cons**: Mobile suspension, disconnects, subscription gaps, and authorization changes can lose events; Realtime is not a durable replay log for every recovery case.
- **Why not**: Realtime remains an accelerator. Fixed-window pull is the authoritative recovery mechanism after startup and reconnect.

### Global cursor

- **Pros**: One watermark is easy to store and inspect.
- **Cons**: It can couple accounts and organizations, skip independently committed entity pages, and make account switching unsafe.
- **Why not**: Cursor and sync state belong to the exact account-partitioned database and advance only after a complete scoped pull.

## Consequences

### Positive

- Offline writes survive restart and uncertain network outcomes without relying on wall clocks.
- Stale edits are retained with server evidence instead of silently overwriting or disappearing.
- Pull repairs missed Realtime delivery, and repeated delivery remains idempotent.
- Organization, user, and role boundaries are enforced at local, orchestration, reconciliation, RPC, and RLS layers.

### Negative

- The client and database migration must be rolled out compatibly; legacy blind updates and deletes are deliberately rejected after the server protocol is active.
- Per-organization revision allocation serializes revision assignment and needs staging throughput measurement.
- Durable conflicts require explicit review; the repository does not yet provide a general conflict-recovery UI.
- Tombstone identity retention prevents reuse of a deleted UUID; a genuinely new record needs a new UUID.

### Risks

- A partially deployed protocol can strand old-client writes. Coordinate migration and client rollout; never fall back to unconditional upsert.
- Realtime delivery can be intermittent. Preserve reconnect-triggered pull and do not treat subscription success as recovery proof.
- A killed process can leave outbox rows marked `SYNCING`. The next account-bound cycle resets eligible stuck rows before push.
- Cursor advancement after partial work could skip records. The implementation advances only after the fixed-head pull and visibility snapshot complete.

## Operational and Recovery Implications

- `PENDING` and retryable `FAILED` outbox entries remain durable; ten failures park an entry as `DEAD_LETTER`. Recovery is explicit and retains the original payload and scope.
- An `APPLIED` response installs canonical server state. A `CONFLICT` response retains the rejected edit and available remote record; it is never automatically rebased.
- Startup, foreground, reconnect, and manual triggers share a single-flight engine. Logout or authorization-context change disposes the old generation and locks its local partition.
- Backups must preserve outbox and sync-state metadata so offline mutations and cursors survive restore.
- This ADR records the implemented architecture, not a release decision. Current verification scope and remaining release prerequisites are maintained in `GATES.md` and the latest release sign-off.

## Related Documentation

- `docs/project-knowledge/08_SYNC_REALTIME_ARCHITECTURE.md`
- `docs/project-knowledge/14_MIGRATION_HISTORY.md`
- `docs/project-knowledge/16_CURRENT_STATE.md`
- `docs/project-knowledge/FINAL_RELEASE_SIGNOFF_2026-09-09.md`
- `GATES.md`
