# Hosted backup and recovery workflow design

Reviewed 17 October 2026 IST (16 October UTC). **Design only: not enabled or executed. Neither hosted project has a verified backup from this task.** Existing `backup-postgres.sh` and `restore-postgres-test.sh` deliberately accept only synthetic loopback databases. Do not remove those guards to export hosted data.

## Missing prerequisites

The attached environment has no approved PostgreSQL secret bindings or TCP grants. Connected Supabase SQL access does not provide a PostgreSQL login to `pg_dump` or the CLI. No owner-approved private backup destination, independently retained decryption key, or secured disposable recovery target is configured. A cloud workspace containing catalog evidence is not a recovery backup.

Use GitHub-hosted infrastructure after the owner configures the protections below. No owner PC, Drive connection, paid project, database reset, or subscription upgrade is necessary for the proposed route. Do not create paid storage or infrastructure as part of setup.

## Protected manual dispatch

Implement as a separately reviewed `.github/workflows/manual-hosted-backup.yml`, enabled only after prerequisite review. The workflow must contain no migration-repair, reset, push, upgrade, or restore-to-source command.

| Control | Required behavior |
| --- | --- |
| Trigger | `workflow_dispatch` only; one dropdown `staging` / `production`; no URL, SQL, shell, ref or command input |
| Source | Ref must be `refs/heads/main`; check out exactly the reviewed main commit; reject any ref mismatch |
| Project mapping | Fixed mapping: staging → `dhoinifpzijqyobcamlv`; production → `lahvcodvgubplzfshare` |
| Environment | Separate **existing** `CRM-Staging-Recovery` and `CRM-Production-Recovery` GitHub Environments; required owner reviewer; prevent self-review; allow only main |
| Protection preflight | Read environment metadata before the secret-bearing job. Require reviewer and branch restrictions. Missing permission, missing environment or missing protection must fail closed. Do not let a typo silently create an unprotected environment |
| Permissions | `contents: read`; no repository write, deployments, issues or PR write; grant `id-token: write` only if an already approved private destination uses scoped OIDC |
| Concurrency | One recovery operation per project; `cancel-in-progress: false`; no schedule |
| Runner | Ephemeral runner approved to handle the selected project's data; never a shared persistent runner; no PR code or unreviewed install hooks with recovery credentials |
| Tools | Reviewed, checksum-pinned PostgreSQL 17 clients, encryption client and Supabase CLI; no `latest` images or unnecessary full stack on Codex VFS |
| Network | TLS verification on; PostgreSQL Session pooler from that project's **Connect → Session pooler** panel, port 5432; no guessed pooler hostname; narrowly scoped private destination |
| Output | Fixed success/failure summaries only; no customer rows, SQL dump contents, credential values, connection URLs, auth tokens or raw restore diagnostics |

Store per-project credentials under the corresponding GitHub Environment's **Secrets**, not repository files or chat. Suggested names: `CRM_PG_HOST`, `CRM_PG_USER`, `CRM_PG_PASSWORD`, `CRM_BACKUP_RECIPIENT`, `CRM_RECOVERY_IDENTITY`, plus approved destination credentials if OIDC is unavailable. Database is `postgres`; pooler username must match the selected project. Validate the project identity using the Management API and actual connection before export. Database role should have only the privileges required for the approved complete dump.

Create a mode-0700 temporary directory and mode-0600 `PGPASSFILE` through a small reviewed program reading secret environment variables. Use libpq variables for non-secret selectors, never passwords or credential-bearing URLs in argv. Require `sslmode=verify-full` with the project's trusted CA. Disable shell tracing and debug logs. Do not echo the environment. Keep encryption identities out of artifacts and retain an independent owner-controlled key copy; loss of that copy makes recovery impossible.

## Backup contents and integrity

1. Capture each project separately. Record project ref, UTC timestamp, server/client versions, Git SHA, extensions and restore prerequisites. Current extensions on both: pg_cron 1.6.4, pg_stat_statements 1.11, pgcrypto 1.3, plpgsql 1.0, supabase_vault 0.3.1, uuid-ossp 1.1.
2. Create a consistent complete logical archive using PostgreSQL 17 `pg_dump` custom format over TLS. Preserve schema, data, sequences, constraints, policies, indexes, triggers, ownership/ACL information, Auth data and Storage metadata. Include `supabase_migrations` and all original history columns, not only version/name. Verify the archive inventory explicitly; a public-schema-only dump is insufficient.
3. Export required role definitions without role passwords. Preserve any independent configuration required for full recovery in the approved secret store: Auth providers/redirect allowlist, SMTP, API/JWT signing configuration, Edge Functions, Realtime settings and any Vault key custody. Do not assume a logical SQL dump captures provider-managed encryption keys. Current Storage object counts are zero on both projects; recheck at backup time. If nonzero, separately back up object bytes through an approved private destination; database backups contain metadata only.
4. Supabase documents CLI roles/schema/data exports for platform migration. Its filtering can omit internal recovery metadata, and raw full dumps can conflict with managed schemas/owners when imported into a fresh hosted project. Choose and rehearse the matching restore recipe; do not suppress errors or claim compatibility merely because the dump succeeded. Retain supplemental metadata explicitly when using the CLI recipe.
5. Bundle archive, role/config manifests and metadata. Encrypt **before** any upload using authenticated encryption, a separately retained recovery identity and separate project prefixes. Compute SHA-256 of the ciphertext; save the source digest inside the encrypted bundle. No plaintext dump, role file or diagnostic log may become a GitHub artifact or Git object.
6. Retrieve the retained ciphertext from its actual destination, verify SHA-256, decrypt inside protected temporary storage, compare the plaintext digest and run `pg_restore --list`. These steps establish archive/decryption integrity; they do not establish recoverability.

## Restore rehearsal and acceptance

Use an isolated, access-controlled disposable PostgreSQL 17/Supabase-compatible instance with matching roles, extensions and managed-schema prerequisites. Block application ingress, email, webhooks, external cron jobs and other external egress. Do not reuse CRM-Staging for Production data. Owner authorization must cover the selected temporary infrastructure and its data handling; a paid resource still requires explicit approval.

Restore into a fresh disposable target only, stop on the first error, and keep raw diagnostics protected because restore errors may contain row values. Never use `--clean`, `db reset`, an existing CRM project URL or the source database as the target. The rehearsal must account for managed owner/extension conflicts rather than ignoring them. Disable scheduled/side-effect operations in the isolated target before making it usable, and preserve original configuration for eventual real recovery.

Acceptance requires all of the following, separately per project:

- Download/decrypt and restore succeed without ignored errors.
- Expected tables, sequences, Auth accounts, migration metadata, indexes, constraints, triggers, policies and role/function grants exist.
- Source snapshot counts/digests and restored counts/digests agree, with the comparison results encrypted; never log customer values.
- Anonymous `sync_mutate` execution stays denied; internal tables stay inaccessible to client roles; synthetic isolated authorization checks pass.
- Original migration metadata can be recovered exactly. Rehearse supported `migration repair` forward/inverse operations against disposable infrastructure and compare **all** history fields. If the CLI cannot restore administrative fields exactly, obtain a supported Supabase recovery procedure; do not substitute direct hosted metadata edits.
- Temporary plaintext, diagnostics, credentials and restored customer data are removed from the disposable infrastructure after verification. Preserve the approved encrypted archive and a redacted timestamped outcome.

## Retention and recovery operations

Use an **existing owner-approved private store outside this public repository**. No backup upload workflow is activated until that destination and key custody are established. Proposed policy for owner review: keep seven daily copies, four weekly copies and three monthly copies, plus the last known-good pre-maintenance backup until maintenance is accepted. Confirm storage allowance/costs before enabling retention. Keep Staging and Production prefixes, access and recovery evidence separate. Retention deletion applies only to approved backup copies, never customer records in either database.

Document the recovery operator, private archive location, key owner, RPO/RTO, last tested restore date and the version-specific restore recipe. Test recovery after toolchain/schema changes. A successful dump without a retained retrievable copy, independent key and restore rehearsal must keep hosted migration repair blocked.

Once Staging recovery passes, use the supported history-only sequence documented in [POST-RELEASE-RECONCILIATION.md](POST-RELEASE-RECONCILIATION.md), under a real schema-deployment freeze. Production requires its own verified backup, successful Staging repair, and explicit authorization naming `lahvcodvgubplzfshare`. The user authorized preparation and verification; no Production metadata authorization is inferred from this design.

Official sources checked through connected documentation: [backups](https://supabase.com/docs/guides/platform/backups), [CLI backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [migration repair](https://supabase.com/docs/reference/cli/supabase-migration-repair). Free-plan projects should export and retain off-site backups; paid daily-backup availability must not be assumed for these projects.
