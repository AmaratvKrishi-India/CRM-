# Deletion, Retention, and Saved-Change Recovery

**Document status:** CURRENT
**Last reviewed:** 2026-09-10
**Source of truth:** lead/profile repositories, purge migration, audit tests, and sync recovery services

The application archive action uses `softDeleteLead`; `restoreLead` reverses it.
Archive and restore keep business history. Each actual transition records one
`LEAD_UPDATED` activity whose metadata action is `ARCHIVED` or `RESTORED`, with the
actor and target lead ID. The activity, mutation and both outbox writes are one
transaction. Agent update/activation/deactivation/deletion similarly commit their
profile mutation and activity together. Provisioning retains its existing protected
server-side audit and compensation flow.

There is no automatic lead-retention deadline or purge UI. `hardDeleteLead` is an
internal maintenance API. It requires an active admin scope, an archived lead, no
unsynced lead/child mutations, and explicit `recoveryExportSaved` and
`acknowledgePermanentDeletion` confirmations. These are a caller's acknowledgement,
not cryptographic proof that an export is usable. The operator must retain and
validate a complete recovery backup before invoking it. A transaction rollback
protects a failed purge; it does not undo a completed one. Account partitioning and
server RLS remain the authorization boundaries.

Migration `20260906000010_lead_purge_policy.sql` restricts permanent lead DELETE to
organization administrators. Ordinary agents continue to archive through UPDATE.
The local archive/export prerequisites are deliberately separate from the protected
server conditional-delete protocol. Any future purge UI must present the exact
scope and irreversible effect, collect explicit acknowledgement, verify backup
recovery, and use this API. A business retention period must be specified before
introducing scheduled purges; no period is invented here.

Purge records a `PURGED` activity in the same transaction. Deletion events use a null
lead foreign key plus a target ID in metadata, so the audit event and its queued
delivery survive child-data deletion. Metadata contains the action and identifier,
not a copy of personal/business fields. Current local backups, account storage
clearing and existing maintenance can still affect local audit availability; a
local audit is not an immutable compliance archive. Cross-device retained-event
delivery is tested separately from local transaction correctness.

## Failed sync changes

Open Settings → Preferences → Saved changes needing attention. Inspect the retained
payload and error, and use Export saved change to select/copy recovery JSON into a
private file. The panel pages twenty entries at a time, scoped to the signed-in
account. Exporting does not remove or alter the saved mutation.

After restoring connectivity or correcting access, Retry unchanged uses the original
UUID and payload. For a revision conflict, sync first, compare the saved payload
with the current record, then reapply intended fields through the ordinary edit
form. A permanent validation failure also needs a corrected record through that
form. The original retained mutation remains available; it is never rewritten under
the same UUID or silently discarded. Failed items are not deleted by elapsed time
or by successful-item cleanup. Protect the export before clearing app storage or
changing devices. Device storage pressure and native lifecycle verification remain
runtime checks for F014/F016/F028.
