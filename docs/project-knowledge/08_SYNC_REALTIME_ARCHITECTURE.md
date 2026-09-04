# 08 - Sync and realtime architecture

## Phase 3 context boundary

Every active sync engine is constructed for one exact `{organizationId, userId, role}` access scope and one physically partitioned Dexie database. Before each cycle it revalidates the server profile. A missing, revoked, moved, or role-changed profile fails closed before push or pull. Disposal increments the engine generation, so late push, pull, realtime, timer, and retry callbacks cannot update another account's database or cursor.

In-app organization switching is **NOT SUPPORTED — VERIFIED**. A changed server organization is treated as an authorization-context change: the old engine is disposed and a separately partitioned account database must be activated.

## State and cursor model

- `syncState` is stored inside the account-partitioned Dexie database.
- The row carries both `organizationId` and `userId`; reads and updates reject mismatches.
- A pull cursor advances only after every table page and the agent visibility snapshot succeed.
- A/B/A account switching therefore resumes each account's independent cursor. There is no global cursor or hard-coded organization fallback.

## Transactional outbox and push

Repository writes and outbox enqueue occur in one Dexie transaction. Each item retains mutation ID, entity ID/type, operation, payload, organization, user, device, timestamps, status, retry count, next-attempt time, error, and original scope across restart.

Push selects only the active database's exact organization/user scope. It rechecks the active engine generation at network and local-state boundaries. `CREATE` and `UPDATE` use idempotent ID upserts; stale queued updates are marked complete without overwriting newer local data. `DELETE` always uses a scoped server delete (`id` plus `organization_id`) and is never converted to an upsert.

Transient failures use bounded per-item exponential delay (1, 2, 4, 8, 16, then 32 seconds). Ten failed attempts move an item to `DEAD_LETTER`, preserving scope and failure details. Recovery is explicit through `retryDeadLetter`; it is not silently replayed. Items left `SYNCING` by force-stop are reset for the same account when the next single-flight cycle starts.

## Pull, reconciliation, and pruning

Every table query includes the active organization. Agent lead pulls are additionally restricted to `assigned_to` or `created_by`; profiles/import data use their applicable user/role rules. Incoming records are independently checked against local access scope, so a faulty or over-broad response cannot materialize cross-scope data.

Deletes and tombstones remove the local lead graph. After a successful agent pull, an authoritative paginated visible-lead-ID snapshot prunes reassigned or otherwise revoked leads, children, and queued mutations. A partial pull does not advance the cursor. Repeating pull or receiving the same record through realtime and pull is idempotent.

## Realtime

Realtime subscribes to all published CRM entities, including bulk-assignment audits. Each subscription is generation-bound and validates organization plus agent visibility before reconciliation. Lead deletion or assignment revocation prunes its local graph. Profile role/status changes trigger server-authoritative revalidation instead of trusting the event's cached role. Reconnect invokes the same scoped pull path, which recovers missed events; there is no unscoped full-pull fallback.

## Conflict and delete policy

- Mutable records: last-write-wins by `updatedAt`; exact ties deterministically choose remote.
- Call records: timestamp ordering and verified-duration protection prevent newer verified data from being demoted.
- Append-only records: duplicate IDs are idempotent, while a remote tombstone wins to prevent resurrection.
- Delete/update and delete/create outcomes are deterministic; remote tombstones are never turned back into local creates by reconciliation.

## Lifecycle and concurrency

Manual, background, reconnect, and realtime recovery share the active engine's single-flight mutex. Login/session restore, foreground/resume, reconnect, and interval triggers use only the current data layer. Logout, failed revalidation, account change, or manager stop removes listeners/timers, unsubscribes realtime, disposes the engine, and locks local access.

## Phase 3 evidence (2026-09-01)

- Focused synchronization suite: `npx tsx --test tests/phase3Synchronization.test.ts` — 14/14 PASS.
- Local migrations 1–7: PASS on disposable Docker PostgreSQL.
- Real RLS transaction: `tests/integration/phase3_sync_rls.sql` — PASS.
- TypeScript: PASS.
- Recovery verification: clean install, TypeScript, and production build pass; the dedicated Phase 1–3 Node-runner suite passes 25/25. The aggregate `npm test` gate remains blocked by mixed test-runner topology and stale legacy fixtures, documented in `PHASE_3_RECOVERY_VERIFICATION_2026-09-01.md`. Phase 3 must not be released until that aggregate gate is repaired.
