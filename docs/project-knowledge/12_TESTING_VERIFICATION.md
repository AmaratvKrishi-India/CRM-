# 12 - TESTING & VERIFICATION

## Current Phase 3 evidence — 2026-09-01

- `npm run typecheck`: PASS.
- `npx tsx --test tests/phase3Synchronization.test.ts`: PASS, 14/14.
- Selected Phase 1–3 and synchronization regression run: final 93/93 PASS across 24 suites. An earlier 92/93 run exposed only a new test's error-label expectation; the production fail-closed behavior was already correct.
- Local Docker PostgreSQL: migrations 1–7 applied successfully.
- `tests/integration/phase3_sync_rls.sql`: PASS; verifies organization isolation, agent scope, cross-org write rejection, and assignment revocation under real RLS.
- `npm test`: FAIL before collection because Vitest is absent from the partial install.
- Recovery update: clean `npm ci`, `npm run typecheck`, and `npm run build` pass. The Phase 1–3 Node-runner suite passes 25/25. The aggregate `npm test` command still fails because it mixes Node-runner suites with stale/incompatible Vitest fixtures; see `PHASE_3_RECOVERY_VERIFICATION_2026-09-01.md`.

The older counts below are historical and do not override this current evidence. Do not report the current working tree release-ready until the clean-install, unit/integration, and build gates pass.

This document provides a comprehensive overview of the testing and verification infrastructure, test files, and verification pipeline for the Amaratv Krishi Field Sales CRM.

## Test Infrastructure

| Component | Technology |
| --- | --- |
| **Test Runner** | Node.js built-in test runner via tsx |
| **E2E Framework** | Playwright 1.62.1 |
| **Fake IndexedDB** | fake-indexeddb 6.2.5 |
| **Real PostgreSQL** | Docker Supabase stack |
| **Multi-device Testing** | 3 Android Studio emulators via ADB + CDP |

## Test Commands

| Command | Description |
| --- | --- |
| `npm test` | Runs all 18 unit/integration suites (31 describe blocks, 119 tests as of 2026-08-23) |
| `npm run test:e2e` | Runs 5 Playwright spec files (32 tests) |
| `npm run verify` | Runs the full 12-stage verification pipeline |

## Unit & Integration Test Files

There are 18 unit and integration test files located in the `tests/` directory.

### 1. [agentDeletion.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/agentDeletion.test.ts)
**Describe Block:** Agent Soft Deletion & Lifecycle (Phase 3)
**Test Cases:** 5
**What is tested:** Agent soft deletion lifecycle, access control, and historical data integrity.
- Admin can successfully soft-delete an agent account
- Non-admin cannot delete an agent (RBAC guard)
- Admin cannot delete their own account
- Deleted agent is excluded from active assignment lists and selectors
- Historical CRM data associated with deleted agent remains intact

### 2. [appTypography.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/appTypography.test.ts)
**Describe Block:** App Font & Typography Constraints (Phase 3)
**Test Cases:** 4
**What is tested:** Typography configurations and offline availability.
- `tailwind.config.js` configures Inter as primary sans font
- `index.html` does not import external Google Fonts (100% offline-first)
- `index.css` imports `@fontsource/inter` locally and sets body and html font-family to Inter
- `index.css` defines CSS tokens for both Night and Day themes

### 3. [backgroundSync.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/backgroundSync.test.ts)
**Describe Block:** Automatic Background Sync Lifecycle (Phase 3)
**Test Cases:** 4
**What is tested:** Background synchronization, concurrency, and retry mechanics.
- Background sync manager initiates foreground auto-sync on user login
- Concurrent sync requests do not run overlapping instances (Single-Flight Mutex)
- Exponential backoff formula calculates correct delays and caps at 32s
- Auto-sync triggers silently without blocking UI or showing confirmation modals

### 4. [backupRestoreIntegrity.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/backupRestoreIntegrity.test.ts)
**Describe Block:** Backup & Restore Data Safety & Integrity (Stage 8)
**Test Cases:** 5
**What is tested:** JSON backup validation, error handling, and restore mechanics.
- Valid backup JSON parses successfully with all required schema keys
- Corrupted JSON is rejected with descriptive error
- Missing required tables in data container fails validation
- Merge restore resolves records via LWW comparison
- Destructive replace restore captures pre-restore snapshot for rollback safety

### 5. [leadNormalizer.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/leadNormalizer.test.ts)
**Describe Block:** Lead Normalization Service
**Test Cases:** 13
**What is tested:** Normalization rules for phone numbers, addresses, and business names.
- Phone: Standard 10-digit, +91 prefix, leading 0, Lucknow landline (0522), +91 522, local 7-digit, empty/invalid
- Address: PIN code extraction (226xxx), Lucknow localities, fallback token, null/empty
- Business: whitespace stripping, null/empty fallback

### 6. [multiDeviceSync.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/multiDeviceSync.test.ts)
**Describe Block:** Real Multi-Device E2E Synchronization (3 Emulators + Docker)
**Test Cases:** 13
**What is tested:** E2E synchronization across multiple devices, isolation, and recovery.
- Hardware prerequisites, Admin/Agent A/Agent B setup & login
- Lead isolation per agent, workflow (status/remark/call/follow-up)
- Admin receives both agents' updates, independent DB verification
- Offline outbox queue & network recovery, RLS enforcement, cleanup

### 7. [realBackupService.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/realBackupService.test.ts)
**Describe Block:** Real Backup & Restore Service Integration (Stage 8)
**Test Cases:** 3
**What is tested:** Backup integration with Dexie.
- Generates and validates full JSON backup from real Dexie
- Merge restore applies LWW across real Dexie entities
- Destructive replace restore replaces existing dataset

### 8. [realCallLifecycle.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/realCallLifecycle.test.ts)
**Describe Block:** Real Telephony Lifecycle & Outcome Mapping (Stage 7)
**Test Cases:** 6
**What is tested:** Telephony lifecycle state transitions.
- Order Confirmed -> CUSTOMER, Sample -> SAMPLE_REQUESTED, Interested -> INTERESTED
- Call Later -> FOLLOW_UP, Wrong Number -> WRONG_NUMBER
- UNVERIFIED status under ACTION_DIAL prevents fabricated talk time

### 9. [realDexieRepositoryOutbox.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/realDexieRepositoryOutbox.test.ts)
**Describe Block:** Real Dexie Repository & Outbox Integration (Stage 1 & 2)
**Test Cases:** 6
**What is tested:** Dexie persistence, outbox mutations, and scaling.
- Lead creation persists to Dexie + creates outbox item
- Lead update writes UPDATE mutation to outbox
- Follow-up lifecycle creates/completes with mutations
- Call records & telephony mutations
- Persistence across app restart (close & reopen)
- Bulk assignment scaling at 1, 10, 50, 100+ records

### 10. [realExcelParser.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/realExcelParser.test.ts)
**Describe Block:** Real Excel Parser & Lead Ingestion (Stage 9)
**Test Cases:** 3
**What is tested:** XLSX parsing and data ingestion.
- Auto-detects standard CRM column headers
- Parses XLSX binary buffer, classifies valid vs duplicate
- Imports into real Dexie with SKIP duplicate strategy

### 11. [realSupabasePostgres.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/realSupabasePostgres.test.ts)
**Describe Block:** Real Supabase Local & PostgreSQL Integration (Docker)
**Test Cases:** 15
**What is tested:** Supabase DB schema, triggers, RLS, and isolation.
- Schema: 10 core tables exist
- Seed data verification
- Constraints: role check, FK on organization_id
- Triggers: profile immutability, lead immutability (org, creator, reassignment)
- RLS: Admin sees all, Agent A isolation, Agent B isolation
- Cross-org isolation, Admin-only tables
- CRUD lifecycle, LWW conflict resolution, verified call duration protection

### 12. [realTemplateRenderer.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/realTemplateRenderer.test.ts)
**Describe Block:** WhatsApp Message Template Renderer (Stage 8)
**Test Cases:** 3
**What is tested:** Text template substitution and fallback.
- Substitutes all standard placeholder tags
- Fallback hierarchy for missing contact person
- Strips unsupported/unknown tags

### 13. [securityRlsIsolation.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/securityRlsIsolation.test.ts)
**Describe Block:** Supabase RLS Agent & Admin Lead Isolation (Stage 5 / P0 Security)
**Test Cases:** 10
**What is tested:** PostgreSQL Row Level Security (RLS) implementation.
- Admin reads all org leads, Agent A/B symmetric isolation
- Agent cannot update other agent's leads or unassigned leads
- Agent cannot reassign, alter org_id, alter created_by
- Agent can update permitted sales fields
- Admin can assign/reassign, cross-org isolation, admin-only audit tables

### 14. [securitySecretScan.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/securitySecretScan.test.ts)
**Describe Block:** Automated Security & Secret Leak Scanner (Stage 12 & 14)
**Test Cases:** 3
**What is tested:** Codebase scans for hardcoded secrets and basic app security config.
- `SERVICE_ROLE_KEY` not in client src/ or dist/
- `AndroidManifest.xml` enforces `allowBackup=false`
- PostgreSQL trigger functions enforce `SET search_path = public`

### 15. [syncConflictResolver.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/syncConflictResolver.test.ts)
**Describe Block:** Sync Conflict Resolver & Verified-Duration Protection (Stage 7)
**Test Cases:** 7
**What is tested:** Synchronization conflict resolution strategies (LWW) and verifications.
- LWW: remote newer wins, local newer wins
- Call records: VERIFIED overrides UNVERIFIED, VERIFIED never overwritten by UNVERIFIED
- Both VERIFIED: newest wins LWW
- Append-only idempotency, follow-up/remark LWW merge

### 16. [syncOutboxQueue.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/syncOutboxQueue.test.ts)
**Describe Block:** Sync Outbox Queue & Data Integrity (Stage 2 / P0)
**Test Cases:** 11
**What is tested:** Local offline queue integrity and retry logic.
- Create/update/soft-delete lead, follow-up lifecycle, remark
- Call record with dialAttemptId, WhatsApp message history
- Single/bulk assignment, import operations
- Retry/partial failure/idempotency, app restart persistence

### 17. [themeMode.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/themeMode.test.ts)
**Describe Block:** Day/Night Mode Themes (Phase 3)
**Test Cases:** 4
**What is tested:** UI theme switching and persistence.
- Default NIGHT theme, switch to DAY, switch back to NIGHT
- Explicit preference independent of OS system theme

### 18. [bugfixRegression.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/bugfixRegression.test.ts)
**Describe Blocks:** 9 (one per fixed finding)
**Test Cases:** 16
**What is tested:** Regression locks for the 2026-08-23 final-audit bugfixes.
- BUG-1: call extended fields (dialAttemptId, reportedDurationSeconds, callStatus) persist Dexie → outbox → push transform → pull transform; reported vs verified distinct; zero/missing duration
- BUG-8: DELETE outbox ops execute as deletes (never upserts), upsert-before-delete ordering, retry idempotency, failed DELETE → FAILED → retry SYNCED
- BUG-2: message_history realtime INSERT reconciles; no duplicate rows
- BUG-4: enqueue failure rolls back data write atomically (leads/remarks/activities); success path persists both
- BUG-9: edge-function 502 rejects with no orphan local agent; network-unreachable falls back to local; duplicate propagates
- BUG-3: assignment no-op paths return null, never `{}`
- BUG-5: equal-timestamp conflict resolves REMOTE deterministically and is recorded; strictly newer local still wins
- BUG-7: single-value filters narrow via index with correct totals and soft-delete exclusion
- BUG-10: Sync Now button exposes `aria-label="Sync Now"`
- BUG-6: data layer no longer exposes `sync`; syncHelper.ts deleted

## Playwright E2E Test Files

There are 5 spec files and 1 helper located in the `e2e/` directory. Each spec runs in two Playwright projects (`chromium` desktop and `Mobile Chrome`), so 16 test cases execute as 32 test runs.

### 1. [auth.spec.ts](file:///c:/Users/PC/Desktop/calling%20app/e2e/auth.spec.ts)
**Describe Block:** Login & Authentication Flow
**Test Cases:** 4
- Renders login screen with branding
- Toggles password visibility
- Error alert on invalid credentials
- Successful sign-in transitions to dashboard

### 2. [crm-navigation.spec.ts](file:///c:/Users/PC/Desktop/calling%20app/e2e/crm-navigation.spec.ts)
**Describe Block:** CRM Navigation & Lead Management Workflow
**Test Cases:** 4
- Dashboard metrics and nav tabs
- Lead creation and detail view
- Follow-ups tab and filter sections
- WhatsApp pitch modal open/close

### 3. [mobile-responsive.spec.ts](file:///c:/Users/PC/Desktop/calling%20app/e2e/mobile-responsive.spec.ts)
**Describe Block:** Mobile Viewport & Responsive Design
**Test Cases:** 3
- No horizontal overflow on mobile viewport
- Touch target accessibility (min 44x44px)
- Sticky bottom navigation during scroll

### 4. [theme.spec.ts](file:///c:/Users/PC/Desktop/calling%20app/e2e/theme.spec.ts)
**Describe Block:** Theme & Dark/Light Mode
**Test Cases:** 4
- Defaults to NIGHT mode
- Toggles to DAY mode
- Persists across reload
- Toggles back to NIGHT

### 5. [bugfix-verification.spec.ts](file:///c:/Users/PC/Desktop/calling%20app/e2e/bugfix-verification.spec.ts)
**Describe Block:** Bugfix verification: import, WhatsApp, dashboard, backup
**Test Cases:** 1
- Import enqueues outbox + audit; WhatsApp uses E.164 numbers; calls-today counts callRecords; backup header v5

### Helper: [helpers/mockAuth.ts](file:///c:/Users/PC/Desktop/calling%20app/e2e/helpers/mockAuth.ts)
Test helper containing:
- `MockUserConfig`
- `MOCK_AGENT`
- `MOCK_ADMIN`
- `setupAuthMocks`
- `performLogin`

## Verification Pipeline

The verification pipeline is executed via `scripts/verify.ts` and consists of 12 stages followed by report generation. Stages 1-11 print as `[Stage N/11]`; the multi-device synchronization test prints as `[Stage 12/12]`.

1. Environment & Production Safety Audit
2. Docker Desktop Health & Availability
3. Local Supabase Stack Lifecycle & Health
4. Database Migrations & Schema Audit
5. Real Supabase PostgreSQL & RLS Integration Tests
6. Security & Secret Leak Scan
7. Complete Unit & Integration Test Suites
8. Playwright E2E Tests
9. Web Application Production Build
10. Android Native Release APK Build
11. Android Emulator Smoke Verification & Remote Audits
12. Real Multi-Device E2E Synchronization Test

After stage 12, the pipeline generates the verification report and synchronizes GATES.md.

## Scripts Directory

There are 5 script files in the `scripts/` directory:

- [scripts/verify.ts](file:///c:/Users/PC/Desktop/calling%20app/scripts/verify.ts) — Master verification pipeline
- [scripts/exportLocalSchemaSnapshot.ts](file:///c:/Users/PC/Desktop/calling%20app/scripts/exportLocalSchemaSnapshot.ts) — Exports local DB schema to JSON
- [scripts/probeCloudSchema.ts](file:///c:/Users/PC/Desktop/calling%20app/scripts/probeCloudSchema.ts) — Read-only probes against production Supabase
- [scripts/check_emulators.ps1](file:///c:/Users/PC/Desktop/calling%20app/scripts/check_emulators.ps1) — PowerShell helper to check Android emulator status
- [scripts/prod_smoke.ps1](file:///c:/Users/PC/Desktop/calling%20app/scripts/prod_smoke.ps1) — PowerShell production smoke test
