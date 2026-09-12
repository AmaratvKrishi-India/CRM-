# 14 — Migration History

**Document status:** CURRENT
**Last reviewed:** 2026-09-10
**Source of truth:** [`supabase/migrations/`](../../supabase/migrations/)

This is the ordered migration inventory in the current checkout. A filename's presence does not prove that it has been applied to local, staging, or production. Verify each target environment separately before deployment.

## Ordered migrations

| # | File | Purpose |
|---:|---|---|
| 1 | `20260820000001_phase2e_central_schema.sql` | Core organizations, profiles, leads, CRM child tables, indexes, and base constraints |
| 2 | `20260820000002_phase2e_rls_policies.sql` | Organization-level helper functions and RLS policies |
| 3 | `20260820000003_phase2j_call_duration_indexes.sql` | Call-duration analytics indexes |
| 4 | `20260820000004_phase2k_realtime_publication.sql` | Realtime publication and replica identity setup |
| 5 | `20260820000005_phase2k_bulk_assignment.sql` | Bulk-assignment audit table and policies |
| 6 | `20260820000006_rls_agent_lead_isolation.sql` | Agent lead visibility and immutability hardening |
| 7 | `20260820000007_call_records_extended_fields_and_lead_delete.sql` | Call-attempt fields, verified duration/status checks, child delete behavior, and lead deletion policy |
| 8 | `20260905000008_server_sync_ordering.sql` | Server revision and ordering primitives for synchronization |
| 9 | `20260906000009_agent_provisioning_abuse_controls.sql` | Agent-provisioning rate and abuse controls |
| 10 | `20260906000010_lead_purge_policy.sql` | Controlled permanent lead purge policy and audit boundary |
| 11 | `20260907000011_operational_reporting.sql` | Sanitized operational error reporting schema, access, and retention policy |
| 12 | `20260907000012_sync_conflict_http_status.sql` | HTTP status behavior for sync conflicts |
| 13 | `20260907000013_call_record_attempt_identity.sql` | Stable call-attempt identity and uniqueness protection |
| 14 | `20260909000014_child_lead_rls_hardening.sql` | Parent-lead visibility checks for child-record RLS policies |

## Deployment rules

- Apply migrations in filename order.
- Test against a disposable local database first.
- Use an isolated staging project whose reference differs from production.
- Confirm the linked project before `db push` or any function deployment.
- Do not reset, seed, or run destructive SQL against production as part of verification.
- Record the resulting environment migration ledger and focused RLS/sync checks in a dated evidence report.

## Related documents

- [06 — Database reference](./06_DATABASE_REFERENCE.md)
- [07 — Supabase security model](./07_SUPABASE_SECURITY_MODEL.md)
- [08 — Sync and realtime architecture](./08_SYNC_REALTIME_ARCHITECTURE.md)
- [22 — Deployment runbook](./22_DEPLOYMENT_RUNBOOK.md)
- [24 — Isolated staging environment](./24_STAGING_ENVIRONMENT.md)
