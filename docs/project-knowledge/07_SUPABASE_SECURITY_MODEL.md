# 07 — Supabase Security Model

**Document status:** CURRENT
**Last reviewed:** 2026-09-10
**Source of truth:** all 14 files in `supabase/migrations/`, `src/services/`, and security/RLS tests

The security model is organization-scoped, role-aware, and defense-in-depth. The SQL migrations are authoritative for the final policy text; earlier policy definitions can be replaced by later migrations, so no single early migration should be described as the “final” policy set.

## Identity and access helpers

Core current helpers include:

- `current_user_org_id()` — active caller organization.
- `current_user_role()` — caller role.
- `is_org_admin()` — ADMIN test inside the caller organization.
- `is_active_org_user()` — active scoped-user test.
- `current_profile_id()` — authenticated profile UUID.
- `can_access_lead_for_current_user(p_lead_id)` — migration-14 parent-lead authorization used to harden child-record writes.

Synchronization and operational-reporting migrations add additional narrowly scoped functions such as `sync_head`, `sync_was_deleted`, `reserve_agent_provisioning`, `can_read_operational_errors`, `report_operational_error`, and `expire_operational_errors`.

## Application-table RLS

RLS is enabled on the 10 primary application tables. The intended boundary is:

- Organization data never crosses `organization_id` scope.
- ADMIN users can operate across their own organization subject to table-specific policies.
- AGENT users can see/update leads they are authorized to access and only child records tied to an accessible parent lead or their own allowed identity.
- `import_audits` and `bulk_assignment_audits` are administrative/audit surfaces and remain restricted accordingly.
### Migration-14 child-write hardening

Migration 14 replaces the earlier INSERT/UPDATE policies for `call_records`, `follow_ups`, `remarks`, `activities`, and `message_history` where appropriate. These policies call `can_access_lead_for_current_user()` so a syntactically valid child row cannot be written merely by supplying another lead ID inside the same organization.

This is the current policy layer and supersedes descriptions that stop at Migration 6.

## Synchronization security

Migration 8 adds a server-authoritative revision protocol to the 9 synchronized entities. `sync_mutate` is `SECURITY INVOKER`, so underlying RLS and triggers still evaluate as the authenticated caller.

Key controls include:

- only allowlisted entity and operation names;
- payload organization must equal `current_user_org_id()`;
- expected revision is required for existing-row mutation semantics;
- server-owned sync metadata cannot be supplied by an untrusted client;
- mutation UUID replay is idempotent and reuse with different data is rejected;
- deleted identities are remembered in `sync_deleted_keys` so a lost CREATE response cannot resurrect a hard-deleted UUID;
- conditional delete is protected by the server revision guard;
- verified call duration is preserved when an unverified mutation races with a verified server record.

`sync_revision_heads` and `sync_deleted_keys` have RLS enabled and direct privileges revoked from normal client roles; callers use the approved functions instead of direct table access.
## Agent provisioning security

The `create-agent` Edge Function authenticates the caller JWT, verifies an ACTIVE ADMIN profile, inherits the caller organization server-side, forces the new role to `AGENT`, and uses the service-role key only inside the Edge Function. Migration 9 adds durable idempotency and server-side rate/capacity reservation through `reserve_agent_provisioning`.

The client never receives or stores the service-role key. Temporary agent passwords are sent only to the privileged provisioning endpoint and are not persisted in Dexie or activity metadata.

## Operational reporting boundary

Migration 11 introduces an allowlisted operational-error path. Normal application callers report only bounded fields through `report_operational_error`; raw secrets, headers, sessions, customer payloads, and arbitrary exception bodies are not part of the approved diagnostic schema. Reader access is separately authorized through `operational_error_readers`, and retention cleanup is implemented by `expire_operational_errors`.

Repository implementation does **not** by itself prove a target cloud project has the migration, reader grants, retention process, or ingestion path deployed. Verify those facts per environment before claiming the collector is live.

## Client defense in depth

In addition to RLS:

- sync pull and Realtime apply organization filters and validate the active local access scope;
- assignment revocation is reconciled through an authoritative visible-lead snapshot and local graph pruning;
- push/delete paths include organization scope;
- account data is partitioned locally in Dexie and remains locked until the server profile is verified;
- Android uses `allowBackup=false`;
- `SUPABASE_SERVICE_ROLE_KEY` is prohibited from client source/build output and checked by security tests.

## Environment rule

The checkout contains 14 migrations, but a cloud environment may have applied fewer. Before any staging/production change, verify the exact linked Supabase project and applied migration history. Never infer deployed security posture solely from local SQL files.
