# PHASE 4 — DATABASE COMPATIBILITY

## Executive Summary

Migration 7 was executed only against disposable local PostgreSQL databases. The migration applied cleanly, preserved the seeded records and relationships, accepted both the previous and current call-record contracts through the local Supabase REST API, preserved authenticated RLS isolation, and delivered a real Realtime event to three authenticated local clients.

The Phase 4 status is blocked because the required repository regression command did not finish green: `npm test -- --runInBand` exited 1 after 166 passing tests and one emulator setup failure. The standalone legacy Supabase integration suite also could not start because its `supabase-test` dependency is absent. These are validation-gate blockers, not observed migration-7 schema or compatibility defects.

No production database, production credentials, production data, deployment target, or Android release was accessed or modified.

## Migration 7 Inventory

Migration history found under `supabase/migrations/`:

1. `20260820000001_phase2e_central_schema.sql`
2. `20260820000002_phase2e_rls_policies.sql`
3. `20260820000003_phase2j_call_duration_indexes.sql`
4. `20260820000004_phase2k_realtime_publication.sql`
5. `20260820000005_phase2k_bulk_assignment.sql`
6. `20260820000006_rls_agent_lead_isolation.sql`
7. `20260820000007_call_records_extended_fields_and_lead_delete.sql`

The local Supabase migration history reported version `20260820000007`, named `call_records_extended_fields_and_lead_delete`.

MIGRATION_7_FILE: `supabase/migrations/20260820000007_call_records_extended_fields_and_lead_delete.sql`

MIGRATION_7_OBJECTIVE: support current call lifecycle payloads and align cloud lead deletion with local hard-delete cascade behavior.

TABLES_CHANGED: `public.call_records`, `public.leads`, `public.remarks`, `public.follow_ups`, `public.message_history`

COLUMNS_ADDED: `public.call_records.dial_attempt_id UUID`, `public.call_records.reported_duration_seconds INT`, `public.call_records.call_status TEXT`; all are nullable and have no default.

COLUMNS_MODIFIED: none.

INDEXES: none added, removed, or changed by migration 7.

CONSTRAINTS: adds `call_records_call_status_check`; replaces the lead foreign keys on `call_records`, `remarks`, `follow_ups`, and `message_history` from `ON DELETE RESTRICT` to `ON DELETE CASCADE`.

TRIGGERS: none added, removed, or changed.

FUNCTIONS: none added, removed, or changed.

RLS_POLICIES: adds `leads_delete_policy`; existing RLS policies remain present and RLS remains enabled.

REALTIME_IMPACT: migration 7 does not alter publication membership or replica identity. `call_records` remains in `supabase_realtime` with `REPLICA IDENTITY FULL`; its new columns are included in the published row shape.

Application dependencies identified from the source and repository graph:

- `src/db/types.ts:170-190` defines `CallRecord`, including the three new local fields.
- `src/db/repositories/callRecordRepository.ts:56-108` stores the fields and enqueues call-record mutations.
- `src/services/callLifecycleService.ts:233-310` creates the lifecycle payload.
- `src/services/sync/syncPush.ts:117-133` maps current camelCase fields to PostgreSQL snake_case fields.
- `src/services/sync/syncPull.ts:97-115` maps the PostgreSQL fields back to local records.
- `src/services/realtime/realtimeService.ts:211-225, 352-374` subscribes to and reconciles `call_records` changes.
- `tests/bugfixRegression.test.ts:75-107` covers local/outbox/push/pull field round-tripping.

## Pre-Migration Baseline

The baseline was created in disposable database `phase4_validation_20260901` after applying migrations 1–6 and before applying migration 7. The local-only test harness created a minimal `auth.users`, `auth.uid()`, role, and `supabase_realtime` publication scaffold; no production or linked remote database was used.

Baseline schema facts:

- 10 public base tables.
- `call_records` had 16 columns, ending with `deleted_at`; the three migration-7 fields were absent.
- The four lead-child foreign keys used `ON DELETE RESTRICT`.
- `call_records` had five indexes, including its primary key and the two duration/chronology indexes from migration 3.
- All 10 public tables had RLS enabled; none had forced RLS.
- Nine tables were members of `supabase_realtime`; `call_records` had full replica identity.
- Baseline schema-only dump digest: `FDC977FCA9E8AEC2B84427D8308BCA45B25ACA9A7696876FB140D880ED746464`.

Fixtures inserted before migration 7:

| Entity | Rows |
| --- | ---: |
| organizations | 2 |
| profiles | 4 |
| leads | 4 |
| call_records | 3 |
| remarks | 1 |
| follow_ups | 1 |
| message_history | 1 |
| activities | 1 |
| import_audits | 1 |
| bulk_assignment_audits | 1 |

## Production-Like Database

Validation used the repository’s local Supabase stack (`supabase_db_calling_app`) and three disposable databases inside that local PostgreSQL container:

- `phase4_validation_20260901`: baseline fixtures, migration 7, compatibility, RLS, cascade, and schema checks.
- `phase4_repeatability_20260901`: fresh complete migration-history replay.
- `phase4_backup_restore_20260901`: restore target for the local backup test.

The local API was bound to `127.0.0.1:15432` and the local database to port `15433`. The test databases were identified by local database/container names and were not linked to or connected to production.

## Migration Execution

Migrations 1–6 were applied to `phase4_validation_20260901` using the equivalent of:

```text
docker exec supabase_db_calling_app psql -U postgres -d phase4_validation_20260901 -v ON_ERROR_STOP=1
```

Each migration exited 0. Migration 7 was then streamed from the checked-in SQL file into the same disposable database with `ON_ERROR_STOP=1`.

Migration 7 result:

- exit code: 0
- result: all statements completed
- failures: none
- notices: only expected `IF EXISTS` notices for the absent pre-existing check constraint and delete policy in the fresh baseline

## Schema Comparison

Post-migration schema checks returned:

| Check | Result |
| --- | ---: |
| public base tables | 10 |
| new nullable/no-default call columns | 3 |
| `call_status` check constraint | 1 |
| intended cascading lead foreign keys | 4 |
| `leads_delete_policy` | 1 |
| public tables with RLS enabled | 10 |
| public tables with forced RLS | 0 |
| realtime publication tables | 9 |
| `call_records` replica identity FULL | 1 |
| expected protection triggers | 2 |
| expected helper/protection functions | 7 |

The post-migration schema-only dump digest was `43B9A112801811D2E37E1BFF8F3AC3B8E669696B497348607F335C3DD9D9BA15`. Catalog comparison showed the intended additions and four FK action changes only. There was no `DROP TABLE`, `DROP COLUMN`, destructive type change, data transformation, RLS disablement, policy removal, or privilege escalation in migration 7. The intentional `DROP CONSTRAINT` and `DROP POLICY` statements are followed immediately by the intended replacement definitions.

## Data Preservation

All original fixture identity and relationship checks passed after migration 7:

- original lead IDs present: `4/4`
- original call IDs present: `3/3`
- original call-to-lead organization relationships valid: `3/3`
- original call timestamps valid: `3/3`
- no original records were deleted or reassigned

The post-contract count was `call_records=5` because two additional disposable contract-test calls were inserted; all other fixture counts remained unchanged. The original fixture rows retained stable IDs, ownership, and timestamps.

The authenticated cascade test inserted one disposable lead with call, remark, follow-up, message, and activity children. An authenticated agent deleted that lead through the new `leads_delete_policy`; the four cascading child rows remaining count was `0`, and the activity row remained with `lead_id IS NULL` as intended by its existing `ON DELETE SET NULL` behavior.

## Previous Client Compatibility

Previous-client contract used the pre-migration `call_records` shape and omitted `dial_attempt_id`, `reported_duration_seconds`, and `call_status`. Required fields exercised included `id`, `organization_id`, `lead_id`, `user_id`, `started_at`, `outcome`, plus the existing device, timestamp, duration, remark, and verification fields.

An authenticated local REST client, using the old payload shape, successfully performed:

- create: returned call `4c000000-0000-0000-0000-000000000001`
- read: returned the row with all three new fields null
- update: changed the existing remark and end timestamp
- sync/upsert: changed the device and remark without sending any new migration-7 fields

Recorded result: `previous_api|create=...001|update=previous api update|sync=previous-api-sync|new_fields=true` and `api_compatibility|PASS`. The disposable API rows were removed after the test.

The same previous-client insert/update/upsert contract passed through authenticated SQL sessions on the migrated production-like database. The old row remained usable and its new fields remained null.

PREVIOUS_CLIENT_COMPATIBILITY: PASS

## Current Client Compatibility

Current-client fields exercised were:

- `dial_attempt_id`: UUID lifecycle/idempotency identifier
- `reported_duration_seconds`: explicitly unverified user-reported duration
- `call_status`: one of `DIAL_ATTEMPT`, `CONNECTED`, `NOT_CONNECTED`, `CANCELLED`, `UNKNOWN`

An authenticated local REST client successfully performed create, read, update, and upsert/sync with the current payload. The returned current values included:

- `dial_attempt_id=4c000000-0000-0000-0000-000000000099`
- `reported_duration_seconds=245` after update and `246` after sync
- `call_status=CONNECTED`

The migrated disposable database independently returned `current_read|1|fields_persisted=1`, `current_update|...|reported=245|status=CONNECTED`, and `current_sync|...|reported=246|status=CONNECTED`. The final assertion was `contract_final|2|old_nulls=1|current_values=1`.

CURRENT_CLIENT_COMPATIBILITY: PASS

## RLS Regression

RLS proof used `SET ROLE authenticated` with per-user JWT subject claims on the migrated disposable database. Service-role access was not used as evidence of authorization. Local postgres access was used only to create disposable fixtures and to clean up known test rows.

Observed authenticated results:

- Admin in Org A saw 4 permitted calls and 3 Org A leads.
- Agent A saw 3 permitted calls, saw 0 Agent B calls, saw 0 unassigned leads, and saw 0 Org B rows.
- Agent B saw its own call and saw 0 Agent A calls.
- Org B agent saw its own Org B call and saw 0 Org A leads.
- Cross-user update affected 0 rows and did not change the protected record.
- Cross-org call insert was denied with PostgreSQL RLS error and exit code 3.

The new authenticated lead delete path succeeded only for a permitted assigned lead and cascaded exactly the intended child records. Organization isolation and agent isolation remained intact.

RLS_REGRESSION: PASS

## Realtime Regression

The publication catalog retained nine realtime tables and `call_records` retained full replica identity. A separate actual-service test used three authenticated local Supabase clients subscribed to `call_records` with the Org A filter. Client A inserted a current-format call through local REST.

Actual propagation evidence:

```text
subscription_statuses|A=SUBSCRIBED|B=SUBSCRIBED|C=SUBSCRIBED
source_insert|id=4e000000-0000-0000-0000-000000000001|dial_attempt_id=...099|reported_duration_seconds=60|call_status=CONNECTED
propagation|A=1|B=1|C=1|total=3
REALTIME_EXIT_CODE=0
```

The test used authenticated JWT clients, not anonymous or service-role proof. The disposable Realtime row was removed after the test.

REALTIME_REGRESSION: PASS

## Migration Repeatability

On fresh disposable database `phase4_repeatability_20260901`, migrations 1–7 were applied in filename order. Every migration exited 0. Final assertions returned:

```text
table_count|10
migration7_columns|3
migration7_cascade_fks|4
migration7_delete_policy|1
realtime_tables|9
ASSERT_EXIT_CODE=0
```

No undocumented manual intervention was required beyond the explicitly documented local test harness bootstrap for `auth.uid()` and the realtime publication.

MIGRATION_REPEATABILITY: PASS

## Backup / Rollback Readiness

No production backup was taken. Against the migrated disposable database, the local backup proxy was:

1. create a PostgreSQL custom-format `pg_dump` archive;
2. verify the archive with `pg_restore --list`;
3. restore it into fresh disposable database `phase4_backup_restore_20260901`;
4. validate restored table and row shape.

Evidence:

- dump exit code: 0
- archive size: 65,381 bytes
- archive list entries: 155
- restore exit code: 0
- restored public tables: 10
- restored call rows: 5
- restored migration-7 columns: 3

The repository contains no migration-7 down migration. Migration 7 is not safely reversible in place once new call fields contain data: dropping those fields would lose current-client state, and restoring the four foreign keys to `RESTRICT` would be a schema behavior change. The production rollback strategy should therefore be a verified pre-migration database restore, followed by coordinated client rollback. A previous client can operate against the migrated schema, but a current client cannot safely be rolled back to a pre-7 schema after it has emitted the new columns.

The production operator procedure remains: take/verify the managed Supabase backup or approved logical backup before migration, apply through the approved migration process, stop on nonzero execution/schema validation, and restore the verified backup if rollback is required. This procedure was tested only against the disposable local database as required.

BACKUP_READINESS: PASS (disposable local backup/restore proxy; no production operation performed)

## Regression Tests

| Command | Exit | Result |
| --- | ---: | --- |
| `npm run typecheck` | 0 | PASS |
| `npm run lint` | 0 | PASS; 93 warnings, 0 errors |
| `npm test -- --runInBand` | 1 | 166 pass, 1 fail |
| `npm run build` | 0 | PASS; Vite build completed |
| `npx vitest run tests/integration/supabase-sync.test.ts` | 1 | no tests ran; import failed because `supabase-test` is not installed |

The single full-suite failure was `tests/multiDeviceSync.test.ts:197` / `:213`, where the Admin emulator dashboard marker timed out after the existing ADB listener error (`listener 'tcp:19222' not found`). The later multi-device workflow steps, the 15-test `Real Supabase Local & PostgreSQL Integration Tests (Docker Stack)` suite, call lifecycle tests, sync tests, RLS tests, and realtime reconciliation tests passed in the same run. The emulator test created uniquely named local test rows; those rows and children were explicitly removed afterward.

No separate Android/Maestro release smoke was run beyond the emulator-dependent test included in the required `npm test` command. No web or Android deployment was performed.

## Findings

The migration and database compatibility checks themselves passed. The release decision is blocked by incomplete repository regression infrastructure.

## Critical Findings

None observed.

## High Findings

- HIGH-1: The required `npm test -- --runInBand` gate exits 1 because the Admin emulator login/setup test times out after an ADB listener error. This leaves the complete regression gate unverified.
- HIGH-2: The standalone `tests/integration/supabase-sync.test.ts` suite cannot run because `supabase-test` is referenced by `tests/integration/supabase-test-harness.ts` but is not installed in the checkout. This is an additional validation coverage gap.

## Medium Findings

- MEDIUM-1: Migration 7 has no down migration and is not safely reversible in place after current-client fields are populated. Rollback depends on a verified database restore and coordinated client rollback.

## Low Findings

- LOW-1: `npm run lint` reports 93 warnings but no errors; these were not changed as part of Phase 4.
- LOW-2: The repository `graft` CLI was not available on PATH in the Windows shell. The checked-in `graft/INDEX.md` and relevant graph nodes were read before source inspection; no source modification was required for this validation phase.

## Release Blockers

- RB-1: Required full regression command is not green (`npm test -- --runInBand`, exit 1).
- RB-2: The legacy standalone Supabase integration suite cannot execute until its missing `supabase-test` dependency/harness issue is resolved or explicitly waived.

## Evidence

- Migration files: `supabase/migrations/20260820000001_*.sql` through `20260820000007_*.sql`.
- Baseline disposable DB: `phase4_validation_20260901`, migrations 1–6 plus fixtures before migration 7.
- Post-migration disposable DB: `phase4_validation_20260901`, migration 7 exit code 0 and catalog assertions above.
- Repeatability disposable DB: `phase4_repeatability_20260901`, all seven migrations exit code 0.
- Backup restore disposable DB: `phase4_backup_restore_20260901`, dump/list/restore assertions above.
- Local REST compatibility: authenticated old and current payload runs, exit code 0.
- Local actual Realtime: three authenticated clients, `A=1|B=1|C=1`, exit code 0.
- Regression command outputs: typecheck 0, lint 0, full tests 1, build 0, legacy integration file 1.
- Production safety: no production connection, migration, data modification, deployment, commit, or push performed.

## Blocker Remediation

### RB-1 / HIGH-1 — multi-device regression gate

**Original failure.** The initial full runner exited `1` with `166` passing and one failing test. The recorded failure was `Step 1: Admin Emulator Setup & Login` at `tests/multiDeviceSync.test.ts:213`, waiting for the Admin dashboard badge after an ADB `listener ... not found` message. An independent pre-fix reproduction instead failed at `Step 5: Agent B Emulator Setup, Login & Lead Isolation` at line `414`, waiting for `Field Sales Dashboard`; this independently established that the failure was nondeterministic rather than Admin-specific.

**Root cause.** `prepareDevice` clears each Android app's storage and returns after the WebView DevTools endpoint and DOM are available. A freshly cleared WebView can display the native login form before React's delegated form handlers are reliably interactive. The failed Agent B page retained both typed credentials, showed neither an authentication request nor an error, and a later real click immediately made the expected local Auth, profile, and sync requests before rendering the dashboard. The absent-forward ADB message was a best-effort stale-forward cleanup message, not the login failure's cause.

**Remediation.** `tests/multiDeviceSync.test.ts` now:

- proves that the login UI is interactive through a reversible password-visibility state transition before entering credentials;
- waits for the actual local `POST /auth/v1/token?grant_type=password` response and asserts HTTP `200`;
- retains the original role/dashboard assertions and their existing bounds.

No dashboard assertion was weakened, no test was skipped or mocked, and no production application behavior was changed.

**Results.**

- Independent post-fix command: `npx tsx --test tests/multiDeviceSync.test.ts --runInBand`
  - exit `0`; `13` passed, `0` failed.
- Full required command: `npm test -- --runInBand`
  - exit `0`; `167` passed, `0` failed, clean process exit.

The deterministic local test leads, calls, remarks, and follow-ups created by the test were removed afterward; the explicit verification count was `0`.

### RB-2 / HIGH-2 — legacy Vitest Supabase harness

**Classification.** `E — obsolete and replaced by a verified current test system.` This is not a safe missing-dependency repair.

**Evidence.**

- `npm ls supabase-test --depth=0` returned an empty dependency tree.
- `npx vitest run tests/integration/supabase-sync.test.ts --reporter=verbose` exited `1` before test execution because `supabase-test` cannot be resolved from `tests/integration/supabase-test-harness.ts:7`.
- `npx vitest run tests/integration/dexie-supabase-sync.test.ts --reporter=verbose` exited `1` before test execution because the removed PascalCase `@/services/sync/ConflictResolver` module cannot be resolved.
- The harness also targets a different local layout (`54322` / `54321` instead of the configured `15433` / `15432`), missing `sync_queue`, `set_rls_context` and `reset_rls_context` RPCs, and removed/renamed schema fields such as `agent_id` and `reported_duration`.

Installing `supabase-test` alone would therefore not restore a valid suite; it would only reveal its incompatible table, RPC, and source-API assumptions. The legacy files were retained and no test was deleted or skipped. Residual references in historical Vitest-oriented scripts and CI configuration are stale test-infrastructure references; migrating that separate CI lane was not required to establish or replace Phase 4 database coverage.

**Verified current equivalent coverage.** The repository documents and the root Node runner execute the current suites:

- `tests/realSupabasePostgres.test.ts`: real local Docker Supabase/PostgreSQL schema, RLS, CRUD, triggers, and sync invariants — `15` passed in the full run.
- `tests/realDexieRepositoryOutbox.test.ts`: real Dexie repository and durable outbox behavior — `6` passed.
- `tests/phase3Synchronization.test.ts`: account partitioning, cursor, outbox, revocation, pull, Realtime, retries, conflict, and restore isolation — `14` passed.
- `tests/multiDeviceSync.test.ts`: real Android auth, actual local Supabase synchronization, PostgreSQL verification, RLS, and offline recovery — `13` passed.

These are current, executable test files included by `npm test`; their actual `167/167` full-run result proves the equivalent coverage exists. HIGH-2 is closed as an obsolete-harness classification, not waived due to an unrelated test.

### Mandatory regression rerun

| Command | Exit | Actual result |
| --- | ---: | --- |
| `npm ci` | 0 | 447 packages installed; dependency audit advisories and the pending `esbuild` install-script approval warning were reported but did not block installation. |
| `npm run typecheck` | 0 | PASS |
| `npm run lint` | 0 | PASS; 93 pre-existing warnings, 0 errors |
| `npm test -- --runInBand` | 0 | PASS; 167 passed, 0 failed |
| `npm run build` | 0 | PASS |

### Phase 4 database compatibility rerun

All database work below used only new disposable local databases named `phase4_remediation_20260902`, `phase4_repeatability_remediation_20260902`, and `phase4_backup_restore_remediation_20260902`; each was removed after validation.

| Gate | Result | Remediation evidence |
| --- | --- | --- |
| Migration 7 | PASS | Applied cleanly over a fresh migrations-1–6 baseline with a local `auth.uid()`/Realtime bootstrap. |
| Schema compatibility | PASS | 3 extended columns, 1 status constraint, 4 cascading lead FKs, 1 lead-delete policy, 10 RLS tables, and 9 Realtime publication tables. |
| Data preservation | PASS | 4 original leads and 3 original calls retained; all 3 baseline calls retained null migration-7 fields. |
| Previous-client compatibility | PASS | Authenticated SQL create/update and local REST create/update/upsert without new fields retained null extended fields. |
| Current-client compatibility | PASS | Authenticated SQL and local REST create/update persisted `dial_attempt_id`, `reported_duration_seconds=246`, and `call_status=CONNECTED`. |
| RLS regression | PASS | Admin A saw 3 Org-A leads/2 calls; Agent A and Agent B each saw only 1 permitted lead/call; cross-user update changed 0 rows; Org-B agent saw only its own lead. |
| Authenticated lead delete/cascade | PASS | Agent A deleted one permitted assigned lead; 4 cascading child rows were removed and its activity's `lead_id` was set null. |
| Realtime regression | PASS | Three independently authenticated local Admin clients reached `SUBSCRIBED`; one current-format call INSERT propagated once to each (`[1,1,1]`). The fixture was removed. |
| Migration repeatability | PASS | All migrations 1–7 applied from scratch; final checks returned 10 tables, 3 extended columns, 4 cascade FKs, 1 delete policy, and 9 Realtime tables. |
| Backup readiness | PASS | Custom-format local backup had 173 catalog entries; restore into a fresh disposable DB retained 10 public tables, 4 original leads, 3 original calls, and all 3 migration-7 columns. |

### Finding disposition

- HIGH-1: **FIXED.** WebView login interactivity is now synchronized with a real UI-state handshake and authenticated network response.
- HIGH-2: **FIXED (classification E).** The stale harness is demonstrably incompatible; current equivalent coverage exists and passed in the required full suite.
- MEDIUM-1: **ACCEPTED.** Migration 7 intentionally has no safe in-place down migration after current-client values exist. The verified rollback path is backup restore plus coordinated client rollback; the disposable backup/restore rerun passed.
- LOW-1: **ACCEPTED.** Lint has 93 non-blocking pre-existing warnings and no errors; they are unrelated to the confirmed blockers.
- LOW-2: **ACCEPTED.** The `graft` executable remains unavailable on PATH, but the checked-in graph was used before source inspection; it has no effect on the built artifact or database behavior.

No production database, deployment, commit, or push operation was performed.

## Final Decision

PHASE_4_STATUS: PASS
