# 06 — Database Reference

**Document status:** CURRENT
**Last reviewed:** 2026-09-10
**Source of truth:** `supabase/migrations/`, `src/db/types.ts`, and `src/db/database.ts`

The checkout contains **14 ordered SQL migrations** and a **Dexie schema at version 7**. This document is a navigation/reference summary; exact column, constraint, policy, trigger, and index definitions remain authoritative in the ordered migrations.

## PostgreSQL application tables

The CRM has 10 primary application tables:

| Table | Purpose |
|---|---|
| `organizations` | Tenant/organization identity |
| `profiles` | Auth-linked ADMIN/AGENT profiles and status |
| `leads` | Lead/contact and pipeline state |
| `call_records` | Server-synced call attempts/outcomes |
| `activities` | Append-oriented business/audit activity |
| `remarks` | Lead remarks |
| `follow_ups` | Scheduled follow-up work |
| `message_history` | WhatsApp/SMS outreach history |
| `import_audits` | Lead-import batch audit |
| `bulk_assignment_audits` | Bulk-assignment audit |

Migration 7 changes lead-child deletion behavior: `call_records`, `remarks`, `follow_ups`, and `message_history` use `ON DELETE CASCADE`; `activities.lead_id` uses `ON DELETE SET NULL` so the activity trail can survive lead deletion.
## Server-sync metadata on synced entities

Migration 8 adds server-authoritative synchronization metadata to these 9 synchronized tables: `leads`, `call_records`, `activities`, `remarks`, `follow_ups`, `message_history`, `import_audits`, `profiles`, and `bulk_assignment_audits`.

Each receives `sync_revision`, `sync_expected_revision`, `sync_mutation_id`, and `sync_mutation_hash`, plus an `(organization_id, sync_revision, id)` index and the `assign_sync_revision` trigger. Revisions are server metadata and must not be treated as wall-clock timestamps or user-editable versions.

Additional important table changes include:

- Migration 7: `call_records.dial_attempt_id`, `reported_duration_seconds`, and `call_status`; verified and reported duration remain separate concepts.
- Migration 9: `profiles.provisioning_key` for durable/idempotent agent provisioning.
- Migration 13: unique `(organization_id, dial_attempt_id)` identity for non-null call attempts.
- Migration 14: child-record write policies are hardened through authoritative parent-lead access checks.

## Synchronization and operational support tables

Later migrations add 6 internal/support tables:

| Table | Purpose |
|---|---|
| `sync_revision_heads` | Per-organization monotonic server revision head |
| `sync_deleted_keys` | Tombstone identity memory preventing deleted UUID replay |
| `agent_provisioning_policy` | Server-side provisioning policy/capacity configuration |
| `agent_provisioning_rate_limits` | Serialized provisioning rate-limit windows |
| `operational_error_readers` | Explicit technical-reader authorization |
| `operational_errors` | Sanitized, bounded operational diagnostics with expiry |
## Important database functions

The current migration set includes, among others:

- Identity/security: `current_user_org_id`, `current_user_role`, `is_org_admin`, `is_active_org_user`, `current_profile_id`, `can_access_lead_for_current_user`.
- Sync: `sync_head`, `sync_was_deleted`, `assign_sync_revision`, and `sync_mutate`.
- Agent provisioning: `reserve_agent_provisioning`.
- Operational reporting: `can_read_operational_errors`, `report_operational_error`, and `expire_operational_errors`.

`sync_mutate(entity, operation, mutation_id, expected_revision, payload)` is the authoritative client mutation RPC. It allowlists entity/operation values, requires organization-scoped payloads, enforces expected server revision semantics, makes mutation UUID replay idempotent, remembers deleted identities, and returns `APPLIED` or `CONFLICT` state rather than relying on client-side last-write-wins upserts.

## Indexes

Do **not** use a copied index list as an exhaustive schema. Indexes are added across multiple migrations, including the original CRM indexes, call-duration indexes, bulk-assignment indexes, per-entity sync-revision indexes, provisioning/rate-limit indexes, operational-reporting indexes, and the unique call-attempt index.

For an exact environment comparison, enumerate indexes from the target PostgreSQL database and compare them with all 14 ordered migrations. Local migration files describe intended schema; they do not prove a cloud environment has applied every migration.

## Dexie IndexedDB schema

The client database is currently **version 7**. Version 6 introduced account-scoped indexes/identity on local stores; version 7 adds durable sequence ordering for the outbox.

Current local stores are: `leads`, `remarks`, `callHistory`, `followUps`, `messageHistory`, `messageTemplates`, `users`, `activities`, `callRecords`, `importAudits`, `outbox`, `syncState`, and `bulkAssignmentAudits`.
### Current v7 outbox indexes

Version 7 keeps the normal outbox fields and adds `sequence` ordering plus these important compound indexes:

- `[organizationId+userId+status]`
- `[status+createdAt]`
- `[organizationId+userId+sequence]`
- `[organizationId+userId+entityType+entityId+sequence]`

`syncState` is keyed by `id` and indexed by `organizationId` and `userId`. Repositories are locked until an active verified access scope exists, preventing a caller from reading or mutating another account partition.

Automatic Dexie hooks continue to normalize timestamps/sync dirty state; remote-sync writes are explicitly marked so they do not recursively enqueue local mutations.

## Seed data

`supabase/seed.sql` is disposable local-development data. It currently seeds one Amaratv Krishi organization, an admin plus two agent identities, and example leads. Never treat seed identities or rows as production state.

## Environment verification rule

The migration directory is the intended schema source of truth, but **environment application status is separate evidence**. Before staging or production work, verify the linked Supabase project and its applied migration state; never infer that a target cloud database matches this document merely because the local checkout contains the migrations.
