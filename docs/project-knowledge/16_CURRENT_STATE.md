# 16 - CURRENT STATE & RELEASE STATUS

## Current release decision (2026-09-01): DO NOT SHIP

Phase 3 synchronization hardening and Phase 3.1 test-infrastructure recovery are complete. Clean install, TypeScript, production build, and the maintained aggregate Node suite pass (155 pass, 1 emulator-gated skip), including Phase 1–3, local PostgreSQL/RLS, offline/restart, conflict, backup/restore, retry, and mutex coverage. The complete evidence is in `PHASE_3_RECOVERY_VERIFICATION_2026-09-01.md`. The historical v2.0.0 details below describe an older release and are not approval to ship the current working tree.

## Historical release status: v2.0.0 released
- Version: 2.0.0
- Release Commit: 759a81c
- Release Date: 2026-08-22
- Post-release bugfix remediation: 2026-08-23 — all 11 findings from the final end-to-end
  functional audit fixed locally (uncommitted working tree; see [BUGFIX_RESULTS.md](../BUGFIX_RESULTS.md)).
  The released v2.0.0 production build predates these fixes; no production deployment of the fixes has occurred.

## Production Endpoints
- Web: https://crm-blush-omega.vercel.app (Vercel, amaratv-krishi/crm)
- Backend: Supabase Cloud (lahvcodvgubplzfshare.supabase.co)
- Android: shipped APK at [release/AmaratvKrishi-SalesCRM-v2.0.0.apk](file:///c:/Users/PC/Desktop/calling%20app/release/AmaratvKrishi-SalesCRM-v2.0.0.apk) (6.9 MB / 7,268,429 bytes)
- Source: GitHub AmaratvKrishi-India/CRM- (PRIVATE — verified via `gh repo view` on 2026-08-22)

## Historical verification results (2026-08-23; not current working-tree evidence)
- Cloud Migration 6: PASS (production state; migration 7 intentionally NOT applied to cloud)
- Cloud RLS / Agent Lead Isolation: PASS (read-only probe 2026-08-23: unauthenticated leads SELECT returns [])
- Local/Cloud Parity: PASS for migrations 1–6; local-only migration 7 pending cloud application as a release step
- Unit/Integration Tests: PASS — 119 tests across 31 suites (2026-08-23, post-bugfix; includes new 16-test bugfix regression suite; supersedes the 115/102 counts)
- PostgreSQL/RLS Tests: PASS — 15 tests
- Playwright E2E Tests: PASS — 32 tests across 5 specs (re-run 2026-08-23)
- 3 Android Studio Emulator Acceptance: PASS — 13/13, 3 consecutive complete runs (2026-08-23 on emulator-5556/5558/5560)
- Offline Recovery: PASS
- Android Call Lifecycle: PASS
- Pagination: PASS
- Vite Production Build: PASS (re-run 2026-08-23 post-bugfix)
- Android Release APK Build: PASS (shipped artifact 7,268,429 bytes, SHA-256 A7DD97F61718A7735BE3D0EBD0023F201BEC6B995AA4DD93A3A4E832CD30E0B9, V2-signed; rebuilt 2026-08-23 with JAVA_HOME set to Android Studio JBR)
- Security Scan: PASS (no secrets leaked; re-run 2026-08-23)
- Production Safety: PASS (read-only smoke 2026-08-23: HTTP 200, login form, no runtime errors, Supabase reachable, RLS enforced)
- TypeScript `tsc --noEmit`: PASS (2026-08-23)

## Migration Status
Migrations 1–6 applied to both local and production. Migration 7 applied to LOCAL Docker Supabase only (2026-08-23); cloud application is a deliberate release step.
1. `20260820000001_phase2e_central_schema.sql` — Central schema (9 tables)
2. `20260820000002_phase2e_rls_policies.sql` — Initial RLS policies
3. `20260820000003_phase2j_call_duration_indexes.sql` — Call analytics indexes
4. `20260820000004_phase2k_realtime_publication.sql` — Realtime setup
5. `20260820000005_phase2k_bulk_assignment.sql` — Bulk assignment audits
6. `20260820000006_rls_agent_lead_isolation.sql` — Agent Lead Isolation
7. `20260820000007_call_records_extended_fields_and_lead_delete.sql` — call_records extended fields (dial_attempt_id, reported_duration_seconds, call_status + CHECK), child FK CASCADE for cloud hard-delete, leads_delete_policy RLS (LOCAL ONLY as of 2026-08-23)

## Security Status
- RLS enabled on all 10 tables
- Agent Lead Isolation enforced (agents see only assigned_to/created_by leads)
- Admin-only tables: import_audits, bulk_assignment_audits
- Immutability triggers on profiles and leads
- No secrets in client code or dist/
- android:allowBackup=false
- SET search_path = public on all triggers
- Signing keys stored externally (not in Git)

## Environment Health (2026-08-23, refreshed by documentation audit)
- Git: local main 1 commit ahead of origin/main (not pushed; push is a manual release step); working tree clean; repo identity = AmaratvKrishi-India; repo visibility PRIVATE
- Vercel: logged in as amaratvkrishi-india; production URL live (HTTP 200)
- Supabase: project ACTIVE_HEALTHY, all 6 migrations applied (Migration 6 verified via read-only RPC probe); repo linked to `lahvcodvgubplzfshare`
- `node_modules` present and working (npm test/build/e2e all re-run successfully on 2026-08-22)
- `JAVA_HOME`/`ANDROID_HOME` unset in the audit shell (APK rebuilds require setting them inline, e.g. to Android Studio's `jbr`); signed release APK already exists in `release/`
- `.env.staging` is populated (shared cloud project URL/anon key, `VITE_APP_ENV=staging`); only `SUPABASE_ACCESS_TOKEN`/`SUPABASE_DB_PASSWORD` are intentionally empty (no dedicated staging project — NON_BLOCKING)
- Full detail: [20 - Toolchain & CLI Status](./20_TOOLCHAIN_CLI_STATUS.md), [21 - Account & Identity Map](./21_ACCOUNT_IDENTITY_MAP.md) and [FINAL A–Z Release Audit](../FINAL_A_TO_Z_RELEASE_AUDIT.md)

## Known Limitations
- No automated CI/CD pipeline (manual deployment)
- WhatsApp integration is intent-based (no API)
- No push notifications infrastructure (local only)
- Single organization deployment
- No automated backup scheduling
- Cloud hard-delete and call extended-field columns require migration 7 on the cloud project (pending release step)
- `searchAndFilterLeads` multi-value filters and sorting remain in-memory by design (single-value filters are index-narrowed since 2026-08-23)

## Completed Development Phases
- Phase 1: Core CRM (leads, calls, remarks)
- Phase 2: Multi-tenant, RLS, sync, real-time, admin analytics, reporting
- Phase 2E: Central schema migration
- Phase 2J: Call duration analytics
- Phase 2K: Bulk assignment, realtime publication
- Phase 3: Agent lifecycle, background sync, day/night theme, typography
- Release: Production deployment on Vercel + APK distribution
