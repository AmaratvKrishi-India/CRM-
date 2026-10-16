# Hosted Supabase follow-up — 2026-10-16

This follow-up supersedes the release-hold and environment-identity statements in `HOSTED-SUPABASE-MIGRATION-AUDIT.md`. It does not authorize a production database change. All hosted SQL in this task was read-only catalog inspection; no customer records were queried, and no migration, grant, policy, index, Auth setting or user data was changed.

## Confirmed identities and comparison

Vercel project `prj_oQvjAM8zwuJUGwDXDKIhc5IMyJ7W` has separate Preview and Production values. Decrypted public endpoint checks establish their actual linkage:

| Environment | Supabase project | Final history version | Records |
| --- | --- | --- | ---: |
| GitHub main | Canonical migration files | 20261003000018 | 19 |
| Preview / staging | CRM-Staging, `dhoinifpzijqyobcamlv` | 20261003055436 | 19 |
| Production web | AmaratvKrishi-India's Project, `lahvcodvgubplzfshare` | 20261003055551 | 19 |

Both projects are ACTIVE_HEALTHY, PostgreSQL 17.6. Staging reports release 17.6.1.166/ga; production reports 17.6.1.164/withdrawn. The latter channel deserves owner review with Supabase support; it is not a reason to initiate an untested database upgrade.

The first 18 migration versions match Git exactly. The last SQL matches Git after trimming trailing whitespace. Both projects have identical 213 public columns, 28 policies, 48 indexes and 18 normalized function definitions, including function grants and search paths. All public application tables have RLS enabled. Five internal no-policy tables deny anon/authenticated SELECT and authenticated INSERT while retaining service-role SELECT. Neither client role can CREATE in public.

`sync_mutate(text,text,uuid,bigint,jsonb)` is SECURITY INVOKER; anon EXECUTE is false, authenticated and service_role EXECUTE are true. No SQL replay or duplicate migration is needed. The mismatch is solely the final tracking timestamp.

Catalog snapshots found no other active sessions or DDL at inspection. A later staging check still reported 19 records, the same final version, zero non-RLS public tables and anon EXECUTE false. These are point-in-time observations, not a migration freeze or a complete history of concurrent changes.

## Recovery prerequisites and blocked operation

Both servers report archive_mode=on and wal_level=logical. These settings **do not establish a usable backup, retention period, restore permission or tested recovery**. The connected tools expose no backup-list/restore-verification capability. The organization is Free. No timestamped restorable backup or recovery rehearsal was provided. The cloud environment supplies no Supabase credentials and no permitted database TCP destinations; authenticated MCP access does not supply a CLI database login.

**Blocked:** staging history repair requires verified recovery and CLI access. Production additionally requires explicit authorization for `lahvcodvgubplzfshare`; deployment linkage confirms its role, not approval to modify it. User clarification was requested without requesting credential values.

## Exact proposed CLI sequence (not executed)

CLI 2.116.0 is installed. Its `migration repair --help`, `migration list --help` and `db dump --help` were inspected. Use an authorized credential binding and a permitted connection; never include passwords or URLs containing secrets in logs or process arguments.

1. Freeze hosted migrations/deployments for the project. Verify a recent restorable database backup, its timestamp, retention, recovery operator and recovery rehearsal. Separately export the complete original schema_migrations record set to secure storage, retaining statements and administrative fields. A catalog snapshot alone is not a database recovery backup.
2. Reconfirm project identity, exactly 19 versions, the expected old timestamp, identical final SQL and effective grants. Stop on any additional drift.
3. From the reviewed checkout, staging only:

   ```bash
   npx --no-install supabase migration list --project-ref dhoinifpzijqyobcamlv
   npx --no-install supabase migration repair 20261003055436 --status reverted --project-ref dhoinifpzijqyobcamlv
   npx --no-install supabase migration repair 20261003000018 --status applied --project-ref dhoinifpzijqyobcamlv
   npx --no-install supabase migration list --project-ref dhoinifpzijqyobcamlv
   ```

   Supported repair deletes/inserts **tracking rows only**; it does not execute migration SQL. The two calls are not atomic: there are temporarily 18 records between them. Keep deployment/migration automation frozen until verification finishes. Do not substitute db push or apply_migration.

4. Require 19 versions matching the Git files, unchanged final SQL, schema fingerprints, grants and data-write counters; run disposable sync/RLS integration tests. Save before/after evidence outside the repository where it includes administrative identity fields. Never treat a green disposable test as proof of hosted repair.
5. Rollback preparation: retain the complete original history metadata and final SQL in encrypted recovery storage with the original version. The logical inverse is to mark canonical `20261003000018` reverted and original `20261003055436` applied using that recovery workspace and the same project ref. Rehearse how the installed CLI populates **all** history fields against disposable infrastructure before permitting the hosted operation. If supported repair cannot reproduce original administrative fields exactly, stop and obtain a supported Supabase recovery procedure; never manually edit hosted metadata as a shortcut. No rollback rehearsal or hosted repair was performed here, so this prerequisite remains unsatisfied. If the forward sequence stops after removing the old row, recover the original history through the rehearsed supported procedure before lifting the freeze. See [the protected recovery design](HOSTED-BACKUP-WORKFLOW-DESIGN.md).
6. Only after staging succeeds and separate production backup, rollback and authorization are verified, use the same sequence with project `lahvcodvgubplzfshare` and old version `20261003055551`. Never copy the staging old timestamp to production.

References: [migration repair](https://supabase.com/docs/reference/cli/supabase-migration-repair), [database migrations](https://supabase.com/docs/guides/deployment/database-migrations). Current documentation was retrieved through the Supabase connector. The changelog URL was blocked by cloud egress policy; no network bypass was attempted.

## Advisor review

| Finding per project | Classification and safest compatible action |
| --- | --- |
| 10 authenticated-callable SECURITY DEFINER functions | Intentional privileged helper/RPC surfaces on inspected definitions. All 10 deny anon. Keep required grants; see dependency review below. No confirmed exploit from these advisor notices. |
| 5 RLS tables without policies | Deliberate internal boundary with no direct client table privileges. Do not add permissive policies. |
| Leaked-password protection disabled | Real missing defense. Current Supabase documentation requires Pro or above; this organization is Free. Owner must approve any plan change, then enable protection in Authentication → Email/password settings and validate weak-password UX on staging. No paid resource or Auth change created. |
| 20 foreign keys without covering indexes | Performance recommendations. Evaluate representative synthetic staging queries and EXPLAIN plans before adding selective indexes; never inspect customer rows merely to clear notices. |
| 1 profiles_update_policy initplan warning | Per-row auth.uid() evaluation. Candidate optimization is `(select auth.uid())` in both USING and WITH CHECK, preserving all predicates. Defer until disposable RLS tests and a staging benchmark establish compatibility. No security boundary was widened. |
| Unused indexes: 9 staging, 26 production | Usage counters are not proof indexes are unnecessary. Retain them; review workload and constraint dependencies before considering removal. |

### Function dependency review

| Functions | Required boundary / consumer |
| --- | --- |
| current_profile_id, current_user_org_id, current_user_role | Read only the active, non-deleted profile associated with auth.uid(); used throughout RLS and synchronization. Definer avoids recursive profile-policy lookup. |
| is_active_org_user, is_org_admin | Derive state from the above helpers; policies and immutable-field triggers depend on them. |
| can_access_lead_for_current_user | Restricts by current organization and creator/assignee identity; child-table policies depend on it. |
| can_read_operational_errors | Checks an allowlisted operational reader and active profile; operational_errors_read policy depends on it. |
| sync_head, sync_was_deleted | Read internal revision/tombstone tables for the current organization. Client synchronization calls them; direct table reads remain denied. |
| report_operational_error | Verifies an active, non-deleted auth.uid()-bound profile; derives organization server-side and limits writes to 30 events/profile/minute. Application operational reporting calls it. |

Search paths are fixed; several older helpers use public, while newer helpers specify pg_catalog,public. Client CREATE in public is denied, and referenced application tables are qualified. Changing all functions to INVOKER or revoking authenticated access would break policy/internal-table access. Moving helpers to a private schema is a possible future hardening project requiring dependency updates and isolated regression testing, not a warning-suppression edit.

Advisor remediation links: [definer RPCs](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [no-policy tables](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [foreign-key indexes](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [initplan](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan), [unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
