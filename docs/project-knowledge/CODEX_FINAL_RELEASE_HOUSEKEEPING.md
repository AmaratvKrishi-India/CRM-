# CODEX FINAL RELEASE HOUSEKEEPING REPORT

Phase 3 — Migration ledger baseline + final release housekeeping.
Executed 2026-08-22 (Asia/Calcutta) by Codex.

## 1. Starting State

- Production app operational: Vercel `crm-blush-omega.vercel.app` (HTTP 200),
  Supabase `lahvcodvgubplzfshare` ACTIVE_HEALTHY, RLS active.
- LOCAL migration ledger = 6 files in `supabase/migrations/`.
- REMOTE migration ledger = 0. The `supabase_migrations` schema did not exist
  on production at all (`relation "supabase_migrations.schema_migrations"
  does not exist`), confirming migrations were applied outside CLI tracking.
- `npx supabase migration list` before repair: all 6 entries `remote: ""`.
- HEAD = `de18fab` on `main`, in sync with `origin/main`.
- Note: `docs/FINAL_DATA_REVERIFICATION_REPORT.md` and
  `docs/LOCAL_VS_CLOUD_REVERIFICATION.md` named in the phase brief do not
  exist; closest equivalents used: `docs/LOCAL_VS_CLOUD_SUPABASE_SCHEMA_REPORT.md`,
  `docs/FINAL_RELEASE_VERIFICATION.md`.

## 2. Six Local Migrations (Inventory)

1. `20260820000001_phase2e_central_schema.sql`
   Creates `uuid-ossp` extension and 9 tables: `organizations`, `profiles`,
   `leads`, `call_records`, `activities`, `remarks`, `follow_ups`,
   `message_history`, `import_audits`, plus 12 performance indexes and the
   unique `idx_profiles_org_email` partial index.
2. `20260820000002_phase2e_rls_policies.sql`
   Creates helper functions `current_user_org_id()`, `current_user_role()`,
   `is_org_admin()`, `is_active_org_user()`; enables RLS on all 9 tables;
   creates org-scoped SELECT/INSERT/UPDATE policies; creates
   `protect_profile_immutable_fields()` + `trg_protect_profile_immutable_fields`
   (BEFORE UPDATE on `profiles`).
3. `20260820000003_phase2j_call_duration_indexes.sql`
   Creates 2 indexes on `call_records`:
   `idx_call_records_org_user_verif_started` and
   `idx_call_records_org_lead_started`. (Both `CREATE INDEX IF NOT EXISTS`.)
4. `20260820000004_phase2k_realtime_publication.sql`
   Sets `REPLICA IDENTITY FULL` on 8 tables and adds them to the
   `supabase_realtime` publication (guarded DO-block, idempotent).
5. `20260820000005_phase2k_bulk_assignment.sql`
   Creates `bulk_assignment_audits` table, 2 indexes, RLS + admin-only
   policies, replica identity FULL, realtime publication entry.
6. `20260820000006_rls_agent_lead_isolation.sql`
   Creates `current_profile_id()`, `protect_lead_immutable_fields()` +
   `trg_protect_lead_immutable_fields` (BEFORE UPDATE on `leads`), and
   replaces org-level policies with strict agent lead-isolation policies on
   `leads`, `call_records`, `follow_ups`, `remarks`, `activities`,
   `message_history`, and admin-only `import_audits` policies.

## 3. Production Schema Verification (READ-ONLY, via `supabase db query --linked`)

Verified present on `lahvcodvgubplzfshare`:

- All 10 public tables (migrations 1 + 5): `organizations`, `profiles`,
  `leads`, `call_records`, `activities`, `remarks`, `follow_ups`,
  `message_history`, `import_audits`, `bulk_assignment_audits`.
- All 7 public functions: `current_user_org_id`, `current_user_role`,
  `is_org_admin`, `is_active_org_user`, `protect_profile_immutable_fields`
  (migrations 1-2) and `current_profile_id`,
  `protect_lead_immutable_fields` (migration 6).
- Both triggers: `trg_protect_profile_immutable_fields` (profiles),
  `trg_protect_lead_immutable_fields` (leads), both enabled (`tgenabled='O'`).
- RLS enabled on all 10 tables; 26 policies present.
- `leads_select_policy` / `leads_update_policy` quals contain
  `is_org_admin() OR assigned_to = current_profile_id() OR created_by =
  current_profile_id()` — confirming these are the MIGRATION 6 agent-isolation
  versions, not the older org-only versions.
- `REPLICA IDENTITY FULL` on all 9 migration-4/5 tables
  (`organizations` remains default, matching migration 4).
- `supabase_realtime` publication contains all 9 expected tables.
- Migration 5 indexes present (`idx_bulk_assign_org_target_started`,
  `idx_bulk_assign_org_performed`).

DEVIATION FOUND: Migration 3's two indexes are ABSENT from production
(`call_records` has only `call_records_pkey`, `idx_call_records_org_lead`,
`idx_call_records_org_user`). Migration 3 was therefore never applied to
production. This is performance-only (no functional/security impact) but the
ledger must reflect it truthfully.

Production data (read-only counts): `organizations`=1, `profiles`=3,
`leads`=1, all other tables 0. Production is no longer an empty baseline;
it holds live seed/operational rows.

## 4. Remote Migration Ledger State

- BEFORE repair: `supabase_migrations` schema did not exist; ledger empty (0/6).
- AFTER repair: `supabase_migrations.schema_migrations` contains exactly
  `20260820000001`, `20260820000002`, `20260820000004`, `20260820000005`,
  `20260820000006`. Migration `20260820000003` intentionally left PENDING.
- `npx supabase migration list` after repair: 5 entries show matching
  local+remote versions; entry 3 shows `remote: ""` (pending).

## 5. Ledger Repair Decision

Decision: baseline 5 of 6 migrations as applied; leave migration 3 pending.

Rationale: `supabase migration repair <versions> --status applied --linked`
is the supported Supabase CLI mechanism that ONLY writes version rows into
`supabase_migrations.schema_migrations`. It does not read or execute any file
in `supabase/migrations/`, does not touch `public` schema objects, and does
not touch application data. Marking migration 3 as applied would have been a
false ledger entry (its indexes do not exist on production) and would have
permanently skipped them on any future `db push`.

Consequence: a future `supabase db push` will execute ONLY migration 3, which
consists of exactly two `CREATE INDEX IF NOT EXISTS` statements on
`call_records` — purely additive, non-destructive, no data mutation, no
existing-object modification.

## 6. Repair Executed

YES — one command, executed 2026-08-22:

```
npx supabase migration repair 20260820000001 20260820000002 20260820000004 20260820000005 20260820000006 --status applied --linked
```

CLI response: `Repaired migration history: [...] => applied`.
No other write command of any kind was run against production.

## 7. Post-Repair Production Schema Verification

Re-queried after repair (read-only):

- Functions = 7, triggers = 2, policies = 26, RLS-enabled tables = 10,
  `call_records` indexes = 3 — ALL IDENTICAL to pre-repair snapshot.
- Realtime publication and replica identity unchanged.
- PRODUCTION_SCHEMA_MUTATION = NONE.
- MIGRATION_SQL_REEXECUTED = NO.

## 8. Production Data Safety Verification

Row counts re-queried after repair: `organizations`=1, `profiles`=3,
`leads`=1, all others 0 — IDENTICAL to pre-repair counts.

- PRODUCTION_DATA_MUTATION = NONE.
- No INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE/RESET executed at any point.
- No `supabase db push`, `db reset`, or `migration up` was run.
- No Vercel deploy, no auth change, no RLS change.

## 9. Test Results

- `npm test` (full suite): 115 tests / 22 suites — 114 PASS, 1 FAIL.
  The single failure is `multiDeviceSync.test.ts` Step 1 (Sign In click
  timed out at 30s while the locator log shows the element resolved
  visible/enabled/stable) under full parallel suite load. This is the same
  known timing flake observed in Phase 2, not an application defect.
- `npx tsx --test tests/multiDeviceSync.test.ts` (standalone rerun):
  13/13 PASS (~92s), including independent PostgreSQL verification,
  offline outbox recovery, and RLS enforcement steps.
- `npm run verify` NOT executed (it runs `supabase db reset` against the
  local Docker stack; avoided per phase instructions).

## 10. Build Results

- `npm run build` (`tsc && vite build`): PASS, clean production bundle, 1.97s.
- Android release APK not rebuilt (not required): existing
  `android/app/build/outputs/apk/release/app-release.apk` v2.0.0 (versionCode 2)
  remains the tested artifact.

## 11. Emulator Results

- `emulator-5556` (ADMIN), `emulator-5558` (AGENT A), `emulator-5560` (AGENT B):
  all ONLINE (`adb devices -l`).
- `com.amaratvkrishi.salescrm` v2.0.0 installed on all three.
- Full Admin/Agent A/Agent B multi-device workflow, lead isolation, sync,
  offline recovery, and RLS enforcement: PASS via standalone multi-device suite.

## 12. Remaining Non-Blocking Items

1. Migration `20260820000003` pending on production (2 missing
   `call_records` analytics indexes). Apply via a future human-supervised
   `supabase db push` — it will run ONLY those two additive
   `CREATE INDEX IF NOT EXISTS` statements. NON-BLOCKING (performance-only).
2. No dedicated staging Supabase project (`.env.staging` points at production).
3. No CI/CD (`.github/` absent).
4. Orphaned legacy Vercel deployment `amaratv-krishi-crm.vercel.app` still live.
5. `JAVA_HOME` / `ANDROID_HOME` unset on this machine (blocks future APK
   rebuilds; not needed for this phase).
6. `multiDeviceSync.test.ts` Step 1 selector is timing-sensitive under full
   parallel suite load (flake observed; clean standalone and in Phase 2 rerun).
7. Working tree carries docs-only drift inherited from takeover phases
   (modified docs, untracked reports/artifacts) — uncommitted by design;
   human decision on commit baseline.
8. `scripts/check_emulators.ps1` — small read-only ADB diagnostic helper
   added this phase; deletion was blocked by sandbox policy, left in place
   (harmless, no secrets).

## 13. Future `supabase db push` Safety Requirement

The ledger is now truthful: 5 applied, 1 pending. Any future
`supabase db push` MUST be preceded by:

1. `npx supabase migration list` — confirm only intended pending versions.
2. Review of every pending migration file's SQL before push.
3. Today, the only pending version is `20260820000003` (two additive
   `CREATE INDEX IF NOT EXISTS` statements) — safe, but still run under
   human supervision against the linked production project.

NEVER run `supabase db reset` or re-baseline against production. Never mark
a version `applied` whose objects are not verified present.

## 14. Final Release Check

| Gate | Status |
|------|--------|
| APPLICATION | PASS |
| DATABASE | PASS |
| CLOUD RLS | PASS |
| MIGRATION 6 | PASS |
| MIGRATION LEDGER | PASS (5/6 baselined; 3 pending by design, additive-only) |
| SYNC | PASS |
| OFFLINE | PASS |
| ANDROID STUDIO EMULATORS | PASS (5556/5558/5560) |
| ANDROID BUILD | PASS (existing v2.0.0 APK, not rebuilt) |
| WEB BUILD | PASS |
| SECURITY | PASS (RLS verified in catalog; secret scan PASS in suite) |
| PRODUCTION SAFETY | PASS (zero schema/data mutation; ledger-only write) |

## 15. Final Verdict

**RELEASE_HOUSEKEEPING_COMPLETE** — application remains **RELEASE_READY**.

No secrets, keys, JWTs, or tokens are contained in this document.
