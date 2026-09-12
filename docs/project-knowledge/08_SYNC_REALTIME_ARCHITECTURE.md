# 08 — Sync and realtime architecture

**Document status:** CURRENT
**Last reviewed:** 2026-09-10
**Source of truth:** `src/services/sync/`, `src/services/realtime/`, `src/db/`, and `supabase/migrations/`

The current release decision is maintained in [16_CURRENT_STATE.md](./16_CURRENT_STATE.md) and [GATES.md](../../GATES.md). Verification statements in this guide are limited to the newest retained release evidence.

The rationale, rejected alternatives, consequences, and recovery implications for the implemented design are recorded in [ADR-0001](../decisions/0001-account-scoped-offline-first-sync.md).

## Phase 3 context boundary

Every active sync engine is constructed for one exact `{organizationId, userId, role}` access scope and one physically partitioned Dexie database. Before each cycle it revalidates the server profile. A missing, revoked, moved, or role-changed profile fails closed before push or pull. Disposal increments the engine generation, so late push, pull, realtime, timer, and retry callbacks cannot update another account's database or cursor.

In-app organization switching is **NOT SUPPORTED — VERIFIED**. A changed server organization is treated as an authorization-context change: the old engine is disposed and a separately partitioned account database must be activated.

## State and cursor model

- `syncState` is stored inside the account-partitioned Dexie database.
- The row carries both `organizationId` and `userId`; reads and updates reject mismatches.
- The revision cursor advances only after every table page inside a fixed committed-head window and the agent visibility snapshot succeed.
- A/B/A account switching therefore resumes each account's independent cursor. There is no global cursor or hard-coded organization fallback.

## Transactional outbox and push

Repository writes and outbox enqueue occur in one Dexie transaction. Each item retains mutation ID, entity ID/type, operation, payload, organization, user, device, timestamps, status, retry count, next-attempt time, error, and original scope across restart.

Push selects only the active database's exact organization/user scope. It rechecks the active engine generation at network and local-state boundaries. `CREATE`, `UPDATE`, and `DELETE` use the RLS-preserving `sync_mutate` RPC with stable mutation UUIDs and expected server revisions. Identical accepted retries are idempotent; stale mutations become durable conflicts instead of overwriting newer data. `DELETE` remains scoped to the organization and is never converted to an upsert.

Transient failures use bounded per-item exponential delay (1, 2, 4, 8, 16, then 32 seconds). Ten failed attempts move an item to `DEAD_LETTER`, preserving scope and failure details. Recovery is explicit through `retryDeadLetter`; it is not silently replayed. Items left `SYNCING` by force-stop are reset for the same account when the next single-flight cycle starts.

## Pull, reconciliation, and pruning

Every table query includes the active organization. Agent lead pulls are additionally restricted to `assigned_to` or `created_by`; profiles/import data use their applicable user/role rules. Incoming records are independently checked against local access scope, so a faulty or over-broad response cannot materialize cross-scope data.

Deletes and tombstones remove the local lead graph. After a successful agent pull, an authoritative paginated visible-lead-ID snapshot prunes reassigned or otherwise revoked leads, children, and queued mutations. A partial pull does not advance the cursor. Repeating pull or receiving the same record through realtime and pull is idempotent.

## Realtime

Realtime subscribes to all published CRM entities, including bulk-assignment audits. Each subscription is generation-bound and validates organization plus agent visibility before reconciliation. Lead deletion or assignment revocation prunes its local graph. Profile role/status changes trigger server-authoritative revalidation instead of trusting the event's cached role. Reconnect invokes the same scoped pull path, which recovers missed events; there is no unscoped full-pull fallback.

## Conflict and delete policy

- Mutable records: server `sync_revision` order is authoritative. Equal-revision dirty local edits remain pending until their conditional push is acknowledged; client timestamps do not choose a winner.
- Call records: server revision ordering and verified-duration protection prevent verified data from being demoted.
- Append-only records: duplicate IDs are idempotent, while a remote tombstone wins to prevent resurrection.
- Delete/update and delete/create outcomes are deterministic; remote tombstones are never turned back into local creates by reconciliation.

## Lifecycle and concurrency

Manual, background, reconnect, and realtime recovery share the active engine's single-flight mutex. Login/session restore, foreground/resume, reconnect, and interval triggers use only the current data layer. Logout, failed revalidation, account change, or manager stop removes listeners/timers, unsubscribes realtime, disposes the engine, and locks local access.

## Current verification

The newest retained release verification records the F003 Docker-backed ordering/integration gate at **22/22 PASS** and current emulator offline-recovery/reconnect behavior as PASS within their stated scopes. TypeScript, production build, and bundle-budget checks also passed in that evidence. The full runner topology still requires a stable rerun before distribution, and release signing remains pending; see [FINAL_RELEASE_SIGNOFF_2026-09-09.md](./FINAL_RELEASE_SIGNOFF_2026-09-09.md) and [GATES.md](../../GATES.md).
