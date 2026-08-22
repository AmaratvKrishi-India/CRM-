# 01 - PROJECT OVERVIEW

## Application Identity
- **Name:** Amaratv Krishi Field Sales CRM
- **Package:** calling-app v2.0.0
- **Android:** com.amaratvkrishi.salescrm v2.0.0 (versionCode 2)
- **Production URL:** https://crm-blush-omega.vercel.app
- **Supabase Cloud:** lahvcodvgubplzfshare.supabase.co

## Business Purpose
Field sales CRM for managing leads in the gym/fitness/wellness market in Lucknow, Uttar Pradesh, India. Bridges mobile field agents with office administrators.

## Target Users
1. **Administrators (ADMIN)** - office-based managers: upload leads via Excel, assign to agents, monitor dashboards, manage agents, generate reports
2. **Field Sales Agents (AGENT)** - mobile users: receive assigned leads, execute phone calls, log outcomes/remarks, schedule follow-ups, send WhatsApp messages

## Technology Stack
- React 19.2.8 + React DOM 19.2.8
- Vite 8.2.2 + @vitejs/plugin-react 6.1.0
- TypeScript 7.0.2
- Tailwind CSS 4.3.3 + @tailwindcss/vite 4.3.3
- Capacitor 8.5.0 (Core + CLI + Android)
- Capacitor plugins: App 8.1.1, Share 8.0.1, Local Notifications 8.3.1
- Dexie 4.4.5 (IndexedDB)
- @supabase/supabase-js 2.112.3
- lucide-react 1.33.0 (icons)
- xlsx 0.18.5 (Excel parsing)
- clsx 2.1.1 + tailwind-merge 3.6.0 (class utilities)
- @fontsource/inter 5.3.0 (offline fonts)
- Playwright 1.62.1 (E2E)
- fake-indexeddb 6.2.5 (test mocking)
- tsx 4.23.12 (test runner)

## Main Business Workflow (7 steps)
1. **Lead Sourcing** - Admins import via Excel (XLSX) or bundled 141-record Lucknow dataset
2. **Assignment** - Individual or bulk assignment to agents
3. **Agent Execution** - Call via native dialer, log outcome + remark
4. **Follow-up** - Schedule callbacks with priority/notifications
5. **WhatsApp** - Send templated messages with catalogue attachments
6. **Monitoring** - Admin real-time dashboards, KPIs, reports, CSV exports
7. **Sync** - Offline-first Dexie -> SyncEngine -> Supabase bidirectional sync

## Major Features
- Offline-first architecture (Dexie IndexedDB + outbox queue)
- Native Android call integration (Capacitor dialer intent)
- Excel importer with fuzzy column detection
- Bidirectional real-time sync (Supabase Realtime + SyncEngine push/pull)
- Role-Based Access Control with Agent Lead Isolation (RLS)
- WhatsApp compose with template renderer
- Day/Night theme with Inter font
- JSON backup & restore with LWW merge
- Multi-device sync across 3 emulators
- Admin: agent management, bulk assignment, reports, live activity feed

## Repository Structure (with file counts)
- `src/` (90 files) - React application
  - `components/` (39 files) - UI components by feature
  - `db/` (17 files) - Dexie schema, types, repositories
  - `services/` (28 files) - Business logic, sync, native platform
  - `context/` (2 files) - Auth + Theme providers
- `tests/` (17 files) - Unit/integration tests (102+ cases)
- `e2e/` (5 files) - Playwright E2E tests (30 cases)
- `scripts/` (3 files) - Verify pipeline, schema export, cloud probe
- `supabase/` (12 files) - Migrations, seed, config, edge function
- `android/` - Capacitor Android project
- `docs/` (15 root files + 26 project-knowledge files) - Project documentation
- `public/` (2 files) - Static assets
- `release/` (1 file) - Shipped APK artifact

## Important Entry Points
- [main.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/main.tsx) - React DOM mount
- [App.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/App.tsx) - Root component, role-based routing (AdminShell vs SalesAppContent)
- [database.ts](file:///c:/Users/PC/Desktop/calling%20app/src/db/database.ts) - Dexie schema initialization
- [index.ts](file:///c:/Users/PC/Desktop/calling%20app/src/db/index.ts) - Data layer factory (crmData singleton)
- [syncEngine.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/syncEngine.ts) - Bidirectional sync coordinator
- [supabaseClient.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/supabaseClient.ts) - Supabase client factory

## Current Status
- **Release Status:** FULLY_RELEASED (v2.0.0)
- **Release Commit:** 759a81c
- **Cloud Migration 6:** PASS
- **Cloud RLS / Agent Lead Isolation:** PASS
- **All tests:** PASS (102 unit + 30 E2E + 15 PostgreSQL)
- **Production build:** PASS
- **Android APK:** PASS - shipped artifact [release/AmaratvKrishi-SalesCRM-v2.0.0.apk](file:///c:/Users/PC/Desktop/calling%20app/release/AmaratvKrishi-SalesCRM-v2.0.0.apk) (5.6 MB)
- **Web deployment:** Vercel at https://crm-blush-omega.vercel.app

> [!NOTE]
> For toolchain health, account ownership, deploy procedures, and local setup see [20 - Toolchain & CLI Status](./20_TOOLCHAIN_CLI_STATUS.md), [21 - Account & Identity Map](./21_ACCOUNT_IDENTITY_MAP.md), [22 - Deployment Runbook](./22_DEPLOYMENT_RUNBOOK.md), and [23 - Local Dev Setup](./23_LOCAL_DEV_SETUP.md).
