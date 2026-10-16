# Hosted Supabase migration and security preflight — 2026-10-16

See [the post-release follow-up](POST-RELEASE-RECONCILIATION.md) for confirmed Production/Preview linkage and current recovery blockers. Release-hold statements below are historical.

**Status:** Read-only verification completed; migration-history reconciliation **NOT performed**. **Do not run `db push`, `migration repair`, `db reset`, or production deployment against a hosted project until the prerequisites below are met.**

This document describes **live, read-only checks** against the two Supabase projects connected to this account. No database objects, migrations, auth settings, or user records were changed. The local Codex/GitHub disposable Supabase database used by CI is separate.

## Project identity and current history

| Source | Last migration version | Last migration name | Migration count |
| --- | --- | --- | ---: |
| GitHub branch `development/crm-storage-backup` | `20261003000018` | `revoke_anon_sync_mutate` | 19 files |
| `CRM-Staging` (`dhoinifpzijqyobcamlv`) | `20261003055436` | `revoke_anon_sync_mutate` | 19 records |
| `AmaratvKrishi-India's Project` (`lahvcodvgubplzfshare`) | `20261003055551` | `revoke_anon_sync_mutate` | 19 records |

The **first 18 version IDs match** across all three histories. Only the final migration's version differs. The stored last migration statements in the two hosted databases match each other and match the Git-tracked migration SQL, apart from a trailing newline. They revoke `sync_mutate` execution from `PUBLIC`/`anon` and grant execution to `authenticated` and `service_role`.

**Conclusion:** A migration **tracking** mismatch exists, but the last migration's intended privilege change has been applied in both hosted projects. Reapplying it or creating duplicate migration objects is unnecessary. A later `supabase db push` may still fail because the CLI compares *timestamps*, not migration names or body equivalence.

Do not assume the second project is production based only on its display name; confirm its environment classification and deployment linkage with the owner before any remote changes.

## Compared schema and permission evidence

Read-only comparisons between the two hosted projects:

| Object category | CRM-Staging | Other Amaratv project | Comparison |
| --- | ---: | ---: | --- |
| Public columns (name/type/default/nullability) | 213 | 213 | Exact match |
| Public RLS policies (expressions, roles, commands) | 28 | 28 | Exact match |
| Public indexes (DDL definition) | 48 | 48 | Exact match |
| Public inspected functions (signature and SQL definition normalized for CRLF vs LF) | 18 | 18 | Exact match |
| Migration history records | 19 | 19 | Last version differs |

Five raw function-definition MD5 hashes initially differed: `current_profile_id`, `reserve_agent_provisioning`, `sync_head`, `sync_mutate`, and `sync_was_deleted`. They were shown to differ only in line endings: after converting CRLF to LF, **all 18 function hashes matched** across the two hosted projects. The original hashes are not evidence of semantic code drift.

The five RLS-enabled, no-policy tables reported by security advisors are `agent_provisioning_policy`, `agent_provisioning_rate_limits`, `operational_error_readers`, `sync_deleted_keys`, and `sync_revision_heads`. For all five, `anon` and `authenticated` lack direct `SELECT` privileges, and `authenticated` lacks direct `INSERT`. Service-role read access exists. No unrestricted RLS policy should be added merely to clear an informational warning.

`public.sync_mutate(text,text,uuid,bigint,jsonb)` privileges on **both** projects:

- `anon EXECUTE`: **false**
- `authenticated EXECUTE`: **true**
- `service_role EXECUTE`: **true**

Neither `anon` nor `authenticated` can `CREATE` in the `public` schema, per `has_schema_privilege`. This reduces (but does not eliminate) concern over helper functions with `search_path=public`.

Read-only advisory review found **10 authenticated-callable SECURITY DEFINER functions** and **disabled leaked-password protection** on both projects. These are review items, **not confirmed vulnerabilities**. Their uses and intended RPC availability must be validated before changing function grants or definer behavior; blindly revoking these helpers may break RLS or application logic. Review password protection in Supabase Auth settings separately, considering plan/support and user experience:

- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Safe reconciliation sequence — **not authorized/executed**

1. **Confirm project roles**: `CRM-Staging` is clearly labeled staging; explicitly identify whether `AmaratvKrishi-India's Project` is production, development, or another environment. Confirm neither has concurrent migrations or pending deployment actions.
2. **Backup and recovery**: obtain a tested, timestamped, separately retained schema/migration-history backup and appropriate recovery access. Do not expose database passwords or service-role keys in chat, GitHub commits, or terminal logs.
3. **Freeze migration changes** during reconciliation. Reconfirm 19-record histories, the exact last migration statement, table/function schema comparison, and permissions. Check for changes since this audit.
4. **CRM-Staging first**: use a Supabase CLI version consistent with the CRM toolchain, with an explicitly verified staging project link. Run read-only `supabase migration list --linked` and ensure only the documented timestamp mismatch appears. Only after an explicit approval for a staging metadata change, repair the *history record* by marking the remote-only `20261003055436` as reverted and the canonical repo `20261003000018` as applied. The Supabase CLI `migration repair` command **changes migration-tracking records only; it does not undo/apply the SQL**.
5. Run read-only `supabase migration list --linked` again, inspect the effective `sync_mutate` permissions, and run disposable-database sync/RLS regression tests. If unexpected differences appear, stop; investigate rather than applying `db push`.
6. **Second project separately**: after the staging change has been validated, confirm project identity, create/verify backups, and obtain explicit project-specific authorization. The old timestamp for that project would be `20261003055551`, not the staging timestamp. Do **not** automatically apply staging commands to the second project.
7. Preserve the audit trail: record approvals, actual commands, previous/new versions, timestamps and verification. Do not treat a CI green run on disposable Supabase as proof that hosted migration history is aligned.

For reference, these are **proposed command shapes only; do not run unattended** after reading this document:

```bash
# AFTER approval, verified staging link and backups — NOT EXECUTED
supabase migration list --linked
supabase migration repair 20261003055436 --status reverted --linked
supabase migration repair 20261003000018 --status applied --linked
supabase migration list --linked
```

**Do not execute these against the other hosted project** without separate review and authorization. Do not edit previously applied migration SQL or re-run the last migration to solve its timestamp discrepancy.

Supabase references:
- https://supabase.com/docs/guides/deployment/database-migrations
- https://supabase.com/docs/reference/cli/supabase-migration-list

## Readiness decision

- **Disposable Supabase CI:** green on latest verified GitHub run #61; migration reset, Node/Vitest integration, F040/F047, `supabase-sync` and browser CRUD/multi-client checks passed.
- **Hosted schema alignment between the two connected projects:** public columns, indexes, policies and normalized function definitions match.
- **Hosted migration history:** **NOT aligned to GitHub**; remote metadata changes need backup, confirmation, and approval.
- **Hosted security advisors:** informational/no-policy tables have no direct client permissions; callable definer helpers and leaked-password setting need separate careful review.
- **Production deployment/main merge:** remain **on hold**. Merge of PR #7 is known to trigger Vercel Production. There are also outstanding Android runtime/device, Snyk moderate-risk acceptance, and PR review requirements.

This report is an audit/preflight, not an authorization to alter hosted databases.
