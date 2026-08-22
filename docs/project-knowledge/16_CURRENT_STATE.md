# 16 - CURRENT STATE & RELEASE STATUS

## Release Status: FULLY_RELEASED
- Version: 2.0.0
- Release Commit: 759a81c
- Release Date: 2026-08-22

## Production Endpoints
- Web: https://crm-blush-omega.vercel.app (Vercel, amaratv-krishi/crm)
- Backend: Supabase Cloud (lahvcodvgubplzfshare.supabase.co)
- Android: shipped APK at [release/AmaratvKrishi-SalesCRM-v2.0.0.apk](file:///c:/Users/PC/Desktop/calling%20app/release/AmaratvKrishi-SalesCRM-v2.0.0.apk) (5.6 MB / 5,914,303 bytes)
- Source: GitHub AmaratvKrishi-India/CRM- (public)

## Verification Results (All PASS)
- Cloud Migration 6: PASS
- Cloud RLS / Agent Lead Isolation: PASS  
- Local/Cloud Parity: PASS
- Unit/Integration Tests: PASS — 102 tests across 17 suites
- PostgreSQL/RLS Tests: PASS — 15 tests
- Playwright E2E Tests: PASS — 30 tests across 4 specs
- 3 Android Studio Emulator Acceptance: PASS
- Offline Recovery: PASS
- Android Call Lifecycle: PASS
- Pagination: PASS
- Vite Production Build: PASS
- Android Release APK Build: PASS (7.26 MB)
- Security Scan: PASS (no secrets leaked)
- Production Safety: PASS

## Migration Status
All 6 migrations applied to both local and production:
1. `20260820000001_phase2e_central_schema.sql` — Central schema (9 tables)
2. `20260820000002_phase2e_rls_policies.sql` — Initial RLS policies
3. `20260820000003_phase2j_call_duration_indexes.sql` — Call analytics indexes
4. `20260820000004_phase2k_realtime_publication.sql` — Realtime setup
5. `20260820000005_phase2k_bulk_assignment.sql` — Bulk assignment audits
6. `20260820000006_rls_agent_lead_isolation.sql` — Agent Lead Isolation

## Security Status
- RLS enabled on all 10 tables
- Agent Lead Isolation enforced (agents see only assigned_to/created_by leads)
- Admin-only tables: import_audits, bulk_assignment_audits
- Immutability triggers on profiles and leads
- No secrets in client code or dist/
- android:allowBackup=false
- SET search_path = public on all triggers
- Signing keys stored externally (not in Git)

## Environment Health (2026-08-22)
- Git: local main 1 commit ahead of origin/main + uncommitted worktree changes; repo identity = AmaratvKrishi-India
- Vercel: logged in as amaratvkrishi-india; production URL live (HTTP 200)
- Supabase: project ACTIVE_HEALTHY, all 6 migrations applied; repo NOT linked (`supabase link` pending)
- Broken: `JAVA_HOME`/`ANDROID_HOME` unset (Android builds blocked); `node_modules` missing (`npm install` needed); `.env.staging` values empty
- Full detail: [20 - Toolchain & CLI Status](./20_TOOLCHAIN_CLI_STATUS.md) and [21 - Account & Identity Map](./21_ACCOUNT_IDENTITY_MAP.md)

## Known Limitations
- No automated CI/CD pipeline (manual deployment)
- WhatsApp integration is intent-based (no API)
- No push notifications infrastructure (local only)
- Single organization deployment
- No automated backup scheduling

## Completed Development Phases
- Phase 1: Core CRM (leads, calls, remarks)
- Phase 2: Multi-tenant, RLS, sync, real-time, admin analytics, reporting
- Phase 2E: Central schema migration
- Phase 2J: Call duration analytics
- Phase 2K: Bulk assignment, realtime publication
- Phase 3: Agent lifecycle, background sync, day/night theme, typography
- Release: Production deployment on Vercel + APK distribution
