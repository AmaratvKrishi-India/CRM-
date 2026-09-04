# 03 - FEATURE INVENTORY

## Document Metadata
- **DOCUMENT_STATUS:** CURRENT
- **LAST_VERIFIED:** 2026-08-25
- **SOURCE_OF_TRUTH:** Source code analysis (src/, components/, services/, db/)
- **SCOPE:** Complete inventory of all features in the Amaratv Krishi Field Sales CRM
- **RELATED_DOCUMENTS:** 01_PROJECT_OVERVIEW.md, 02_PRODUCT_REQUIREMENTS.md, 05_USER_WORKFLOWS.md

---

## Feature Inventory

Each feature is documented with: FEATURE_ID, FEATURE_NAME, ROLE, LOCATION, DESCRIPTION, ENTRY_POINT, DEPENDENCIES, DATA_USED, OFFLINE_SUPPORT, SYNC_SUPPORT, REALTIME_SUPPORT, ERROR_HANDLING, TEST_COVERAGE, CURRENT_STATUS, KNOWN_LIMITATIONS.

---

### FEAT-001: Excel Lead Import
- **FEATURE_NAME:** Excel Lead Import
- **ROLE:** ADMIN
- **LOCATION:** `src/components/import/`, `src/services/excelParser.ts`, `src/services/leadAssignmentService.ts`
- **DESCRIPTION:** Import leads from XLSX files with fuzzy column detection, phone normalization (+91/Lucknow STD), duplicate detection, and preview before import.
- **ENTRY_POINT:** `ExcelImporter.tsx` → `excelParser.parseExcel()` → `leadNormalizer.normalizeLeads()` → `leadRepository.bulkCreate()`
- **DEPENDENCIES:** xlsx library, leadNormalizer, leadRepository, syncQueue
- **DATA_USED:** leads table, import_audits table
- **OFFLINE_SUPPORT:** ✅ Full - imports to local Dexie, queues to outbox
- **SYNC_SUPPORT:** ✅ Bidirectional - import audit + leads sync to cloud
- **REALTIME_SUPPORT:** ❌ Not applicable (admin-only batch operation)
- **ERROR_HANDLING:** Duplicate confirmation modal, invalid row skipping, import audit logging
- **TEST_COVERAGE:** `realExcelParser.test.ts` (3 tests), `leadNormalizer.test.ts` (13 tests)
- **CURRENT_STATUS:** ✅ IMPLEMENTED
- **KNOWN_LIMITATIONS:** Single file at a time; no CSV support; column mapping UI basic

---

### FEAT-002: Manual Lead Creation
- **FEATURE_NAME:** Manual Lead Creation
- **ROLE:** ADMIN, AGENT (ADMIN can create for any agent; AGENT creates for self)
- **LOCATION:** `src/components/leads/CreateLeadModal.tsx`, `src/db/repositories/leadRepository.ts`
- **DESCRIPTION:** Create individual leads with full field set including business info, contact details, location, and assignment.
- **ENTRY_POINT:** `CreateLeadModal.tsx` → `leadRepository.create()`
- **DEPENDENCIES:** leadRepository, syncQueue, userRepository (for assignment)
- **DATA_USED:** leads table
- **OFFLINE_SUPPORT:** ✅ Full - creates in local Dexie, queues to outbox
- **SYNC_SUPPORT:** ✅ Bidirectional - creates locally, pushes to cloud
- **REALTIME_SUPPORT:** ✅ INSERT events trigger realtime for admin feed
- **ERROR_HANDLING:** Validation on required fields, phone normalization
- **TEST_COVERAGE:** Part of `realDexieRepositoryOutbox.test.ts`
- **CURRENT_STATUS:** ✅ IMPLEMENTED
- **KNOWN_LIMITATIONS:** No auto-complete for locality/pincode

---

### FEAT-003: Lead Search & Filter
- **FEATURE_NAME:** Lead Search & Filter
- **ROLE:** ADMIN (all org leads), AGENT (assigned leads only)
- **LOCATION:** `src/components/leads/MinimalLeadsList.tsx`, `src/db/types.ts` (LeadFilterParams), `src/db/repositories/leadRepository.ts`
- **DESCRIPTION:** Search leads by business name, phone, contact person, locality. Filter by status, locality, category, assignment, follow-up due date.
- **ENTRY_POINT:** `MinimalLeadsList.tsx` → `leadRepository.findByFilter()`
- **DEPENDENCIES:** leadRepository, Dexie compound indexes
- **DATA_USED:** leads table
- **OFFLINE_SUPPORT:** ✅ Full - queries local Dexie indexes
- **SYNC_SUPPORT:** ❌ Read-only locally; sync pulls updates
- **REALTIME_SUPPORT:** ✅ Real-time updates via Supabase Realtime on leads table
- **ERROR_HANDLING:** Empty state handling, loading states
- **TEST_COVERAGE:** Part of E2E `crm-navigation.spec.ts`
- **CURRENT_STATUS:** ✅ IMPLEMENTED
- **KNOWN_LIMITATIONS:** No full-text search; client-side filtering only

---

### FEAT-004: Individual Lead Assignment
- **FEATURE_NAME:** Individual Lead Assignment
- **ROLE:** ADMIN
- **LOCATION:** `src/components/leads/LeadAssignmentModal.tsx`, `src/services/leadAssignmentService.ts`
- **DESCRIPTION:** Assign a single lead to an agent with confirmation and audit trail.
- **ENTRY_POINT:** `LeadAssignmentModal.tsx` → `leadAssignmentService.assignLead()`
- **DEPENDENCIES:** leadRepository, userRepository, syncQueue, activityRepository
- **DATA_USED:** leads table (assigned_to, updated_by), activities table
- **OFFLINE_SUPPORT:** ✅ Full - updates local, queues to outbox
- **SYNC_SUPPORT:** ✅ Bidirectional - assignment syncs to cloud
- **REALTIME_SUPPORT:** ✅ UPDATE on leads triggers realtime
- **ERROR_HANDLING:** Validation for valid agent, audit logging
- **TEST_COVERAGE:** `realDexieRepositoryOutbox.test.ts`, `securityRlsIsolation.test.ts`
- **CURRENT_STATUS:** ✅ IMPLEMENTED
- **KNOWN_LIMITATIONS:** No reassignment history in UI (only in activities)

---

### FEAT-005: Bulk Lead Assignment
- **FEATURE_NAME:** Bulk Lead Assignment
- **ROLE:** ADMIN
- **LOCATION:** `src/components/admin/BulkLeadAssignmentModal.tsx`, `src/services/leadAssignmentService.ts`
- **DESCRIPTION:** Assign multiple filtered leads to a target agent with progress tracking, success/failure counts, and audit record.
- **ENTRY_POINT:** `BulkLeadAssignmentModal.tsx` → `leadAssignmentService.bulkAssign()`
- **DEPENDENCIES:** leadRepository, userRepository, syncQueue, bulkAssignmentAuditRepository
- **DATA_USED:** leads table, bulk_assignment_audits table, activities table
- **OFFLINE_SUPPORT:** ✅ Full - batched local updates, queued to outbox
- **SYNC_SUPPORT:** ✅ Bidirectional - audit + leads sync to cloud
- **REALTIME_SUPPORT:** ✅ Multiple UPDATE events on leads
- **ERROR_HANDLING:** Per-lead failure tracking, audit with filter snapshot, error summary
- **TEST_COVERAGE:** `bugfixRegression.test.ts` (bulk assignment tests)
- **CURRENT_STATUS:** ✅ IMPLEMENTED
- **KNOWN_LIMITATIONS:** No rollback UI; large batches may be slow

---

### FEAT-006: Call Lifecycle Management
- **FEATURE_NAME:** Call Lifecycle Management
- **ROLE:** AGENT
- **LOCATION:** `src/components/leads/CallOutcomeModal.tsx`, `src/services/callLifecycleService.ts`, `src/services/callOutcomeMapping.ts`
- **DESCRIPTION:** Complete call flow: initiate via native dialer → track state (DIAL_ATTEMPT → CONNECTED/NOT_CONNECTED) → log outcome → record verified duration.
- **ENTRY_POINT:** `LeadDetailView.tsx` → "Call" button → `callLifecycleService.initiateCall()` → `CallOutcomeModal.tsx`
- **DEPENDENCIES:** nativePlatform (Capacitor dialer), callRecordRepository, callHistoryRepository, syncQueue
- **DATA_USED:** call_records table, call_history table, leads table (call_count, last_contacted_at)
- **OFFLINE_SUPPORT:** ✅ Full - all states persisted locally
- **SYNC_SUPPORT:** ✅ Bidirectional - call records sync with idempotency (dialAttemptId)
- **REALTIME_SUPPORT:** ✅ INSERT/UPDATE on call_records
- **ERROR_HANDLING:** State machine prevents invalid transitions, duration validation
- **TEST_COVERAGE:** `realCallLifecycle.test.ts` (6 tests), `syncConflictResolver.test.ts` (7 tests)
- **CURRENT_STATUS:** ✅ IMPLEMENTED
- **KNOWN_LIMITATIONS:** No native call duration API (relies on app foreground/background)

---

### FEAT-007: Follow-up Scheduling
- **FEATURE_NAME:** Follow-up Scheduling
- **ROLE:** AGENT, ADMIN
- **LOCATION:** `src/components/followups/FollowUpModal.tsx`, `src/components/followups/FollowUpsView.tsx`, `src/db/repositories/followUpRepository.ts`
- **DESCRIPTION:** Schedule follow-up tasks with priority (LOW/MEDIUM/HIGH/URGENT), title, notes, and due date. Local notifications fire at scheduled time.
- **ENTRY_POINT:** `LeadDetailView.tsx` → "Follow-up" → `FollowUpModal.tsx` → `followUpRepository.create()`
- **DEPENDENCIES:** followUpRepository, syncQueue, Capacitor Local Notifications
- **DATA_USED:** follow_ups table, leads table (next_follow_up_at)
- **OFFLINE_SUPPORT:** ✅ Full - schedules locally, notifications work offline
- **SYNC_SUPPORT:** ✅ Bidirectional - follow-ups sync to cloud
- **REALTIME_SUPPORT:** ✅ INSERT/UPDATE on follow_ups
- **ERROR_HANDLING:** Date validation, notification permission handling
- **TEST_COVERAGE:** Part of `realDexieRepositoryOutbox.test.ts`
- **CURRENT_STATUS:** ✅ IMPLEMENTED
- **KNOWN_LIMITATIONS:** No recurring follow-ups; notification only on Android

---

### FEAT-008: WhatsApp Compose & Send
- **FEATURE_NAME:** WhatsApp Compose & Send
- **ROLE:** AGENT, ADMIN
- **LOCATION:** `src/components/whatsapp/WhatsAppComposeModal.tsx`, `src/services/templateRenderer.ts`, `src/db/seeds/defaultTemplates.ts`
- **DESCRIPTION:** Compose WhatsApp messages using predefined templates with placeholders ({{businessName}}, {{locality}}, {{contactPerson}}). Opens WhatsApp app with pre-filled message.
- **ENTRY_POINT:** `LeadDetailView.tsx` → "WhatsApp" → `WhatsAppComposeModal.tsx` → `templateRenderer.render()` → `window.open('whatsapp://send?text=...')`
- **DEPENDENCIES:** messageTemplateRepository, templateRenderer, messageHistoryRepository
- **DATA_USED:** message_templates table, message_history table
- **OFFLINE_SUPPORT:** ✅ Template rendering offline; WhatsApp requires network
- **SYNC_SUPPORT:** ✅ Bidirectional - message history syncs
- **REALTIME_SUPPORT:** ✅ INSERT on message_history
- **ERROR_HANDLING:** WhatsApp not installed handling, template validation
- **TEST_COVERAGE:** `realTemplateRenderer.test.ts` (3 tests)
- **CURRENT_STATUS:** ✅ IMPLEMENTED
- **KNOWN_LIMITATIONS:** Opens external app; no delivery confirmation; SMS fallback basic

---

### FEAT-009: Remark/Note Management
- **FEATURE_NAME:** Remark & Note Management
- **ROLE:** AGENT, ADMIN
- **LOCATION:** `src/components/leads/LeadDetailView.tsx` (remarks section), `src/db/repositories/remarkRepository.ts`
- **DESCRIPTION:** Add timestamped remarks to leads with type (PREDEFINED/CUSTOM). Shows in lead timeline.
- **ENTRY_POINT:** `LeadDetailView.tsx` → "Add Remark" → `remarkRepository.create()`
- **DEPENDENCIES:** remarkRepository, syncQueue
- **DATA_USED:** remarks table
- **OFFLINE_SUPPORT:** ✅ Full
- **SYNC_SUPPORT:** ✅ Bidirectional
- **REALTIME_SUPPORT:** ✅ INSERT on remarks
- **ERROR_HANDLING:** Basic validation
- **TEST_COVERAGE:** Part of `realDexieRepositoryOutbox.test.ts`
- **CURRENT_STATUS:** ✅ IMPLEMENTED
- **KNOWN_LIMITATIONS:** No rich text; no @mentions

---

### FEAT-010: Activity Timeline
- **FEATURE_NAME:** Activity Timeline
- **ROLE:** AGENT (own leads), ADMIN (all org leads)
- **LOCATION:** `src/components/leads/LeadTimelineView.tsx`, `src/db/repositories/activityRepository.ts`
- **DESCRIPTION:** Chronological log of all actions on a lead: calls, assignments, remarks, WhatsApp, follow-ups, status changes. Append-only, immutable.
- **ENTRY_POINT:** `LeadDetailView.tsx` → Timeline tab → `activityRepository.findByLeadId()`
- **DEPENDENCIES:** activityRepository, syncQueue
- **DATA_USED:** activities table
- **OFFLINE_SUPPORT:** ✅ Full - reads local
- **SYNC_SUPPORT:** ✅ Pull-only (append-only, server is source of truth)
- **REALTIME_SUPPORT:** ✅ INSERT on activities
- **ERROR_HANDLING:** Empty state, loading skeleton
- **TEST_COVERAGE:** Part of E2E tests
- **CURRENT_STATUS:** ✅ IMPLEMENTED
- **KNOWN_LIMITATIONS:** No filtering by activity type in UI

---

### FEAT-011: Admin Dashboard
- **FEATURE_NAME:** Admin Dashboard
- **ROLE:** ADMIN
- **LOCATION:** `src/components/admin/AdminDashboardView.tsx`, `src/services/adminAnalyticsService.ts`
- **DESCRIPTION:** Overview with KPI cards (total leads, active leads, calls today, conversion rate), status distribution, agent performance summary, recent activity feed.
- **ENTRY_POINT:** `AdminShell.tsx` → Dashboard tab → `AdminDashboardView.tsx`
- **DEPENDENCIES:** adminAnalyticsService, leadRepository, userRepository, activityRepository
- **DATA_USED:** leads, call_records, activities, users tables
- **OFFLINE_SUPPORT:** ✅ Reads from local Dexie
- **SYNC_SUPPORT:** ✅ Pulls latest from cloud
- **REALTIME_SUPPORT:** ✅ Live activity feed via Realtime
- **ERROR_HANDLING:** Loading skeletons, error boundary
- **TEST_COVERAGE:** `e2e/crm-navigation.spec.ts`
- **CURRENT_STATUS:** ✅ IMPLEMENTED
- **KNOWN_LIMITATIONS:** No date range filter on dashboard KPIs

---

### FEAT-012: Agent Management
- **FEATURE_NAME:** Agent Management
- **ROLE:** ADMIN
- **LOCATION:** `src/components/admin/AdminAgentsView.tsx`, `src/components/admin/CreateAgentModal.tsx`, `src/components/admin/EditAgentModal.tsx`, `src/components/admin/DeleteAgentModal.tsx`, `src/services/agentManagementService.ts`, `supabase/functions/create-agent/`
- **DESCRIPTION:** Create, edit, activate/deactivate, soft-delete agents. Invokes Supabase Edge Function for auth user creation.
- **ENTRY_POINT:** `AdminAgentsView.tsx` → modals → `agentManagementService` → Edge Function
- **DEPENDENCIES:** userRepository, syncQueue, Supabase Edge Function (create-agent), Supabase Auth
- **DATA_USED:** users/profiles table, auth.users
- **OFFLINE_SUPPORT:** ❌ Requires cloud (Edge Function + Auth)
- **SYNC_SUPPORT:** ✅ Pull-only for agent list; create via Edge Function
- **REALTIME_SUPPORT:** ✅ INSERT/UPDATE on profiles
- **ERROR_HANDLING:** Edge Function error handling, email validation, role validation
- **TEST_COVERAGE:** `agentDeletion.test.ts` (5 tests), `securityRlsIsolation.test.ts`
- **CURRENT_STATUS:** ✅ IMPLEMENTED
- **KNOWN_LIMITATIONS:** Cannot create agent fully offline; password reset not in app

---

### FEAT-013: Admin Reports & CSV Export
- **FEATURE_NAME:** Admin Reports & CSV Export
- **ROLE:** ADMIN
- **LOCATION:** `src/components/admin/AdminReportsView.tsx`, `src/components/admin/reports/`, `src/services/adminReportsService.ts`
- **DESCRIPTION:** Multi-tab reports: Lead Summary, Call Analytics, Agent Performance, Follow-up Tracking. Each with filters and CSV export.
- **ENTRY_POINT:** `AdminShell.tsx` → Reports tab → `AdminReportsView.tsx`
- **DEPENDENCIES:** adminReportsService, leadRepository, callRecordRepository, userRepository
- **DATA_USED:** leads, call_records, follow_ups, users, activities
- **OFFLINE_SUPPORT:** ✅ Generates from local data
- **SYNC_SUPPORT:** ✅ Pulls latest before generation
- **REALTIME_SUPPORT:** ❌ Report generation is on-demand
- **ERROR_HANDLING:** Empty data handling, CSV encoding
- **TEST_COVERAGE:** Part of E2E
- **CURRENT_STATUS:** ✅ IMPLEMENTED
- **KNOWN_LIMITATIONS:** No scheduled reports; no PDF export

---

### FEAT-014: Live Activity Feed
- **FEATURE_NAME:** Live Activity Feed
- **ROLE:** ADMIN
- **LOCATION:** `src/components/admin/LiveActivityFeed.tsx`, `src/services/realtime/realtimeService.ts`
- **DESCRIPTION:** Real-time stream of agent activities (calls, assignments, WhatsApp, follow-ups) across the organization.
- **ENTRY_POINT:** `AdminDashboardView.tsx` → Activity Feed → `LiveActivityFeed.tsx` → realtime subscriptions
- **DEPENDENCIES:** realtimeService, activityRepository, Supabase Realtime
- **DATA_USED:** activities table (via realtime)
- **OFFLINE_SUPPORT:** ❌ Requires network for realtime
- **SYNC_SUPPORT:** ❌ Real-time only; sync is separate
- **REALTIME_SUPPORT:** ✅ Primary feature - subscribes to activities table
- **ERROR_HANDLING:** Reconnection logic, fallback to pull sync
- **TEST_COVERAGE:** `multiDeviceSync.test.ts` (13 tests)
- **CURRENT_STATUS:** ✅ IMPLEMENTED
- **KNOWN_LIMITATIONS:** No filtering by agent/action type in feed

---

### FEAT-015: Bidirectional Sync Engine
- **FEATURE_NAME:** Bidirectional Sync Engine
- **ROLE:** SYSTEM (background)
- **LOCATION:** `src/services/sync/` (syncEngine.ts, syncPush.ts, syncPull.ts, syncQueue.ts, syncConflictResolver.ts, backgroundSyncManager.ts, syncStateRepository.ts)
- **DESCRIPTION:** Offline-first push-then-pull sync: local writes → outbox → batched push → cursor-based pull → conflict resolution → local upsert.
- **ENTRY_POINT:** `backgroundSyncManager.ts` triggers → `syncEngine.sync()` → push → pull
- **DEPENDENCIES:** All repositories, supabaseClient, Dexie, outbox queue
- **DATA_USED:** All 11 entity tables + outbox + sync_state
- **OFFLINE_SUPPORT:** ✅ Core architecture - queues offline, processes online
- **SYNC_SUPPORT:** ✅ This IS the sync feature
- **REALTIME_SUPPORT:** ✅ Realtime hints trigger immediate sync
- **ERROR_HANDLING:** Exponential backoff, dead letter queue, single-flight mutex, error logging
- **TEST_COVERAGE:** `syncOutboxQueue.test.ts` (11), `syncConflictResolver.test.ts` (7), `multiDeviceSync.test.ts` (13)
- **CURRENT_STATUS:** ✅ IMPLEMENTED
- **KNOWN_LIMITATIONS:** No partial sync (entity-level); conflict UI not exposed

---

### FEAT-016: Supabase Realtime Subscriptions
- **FEATURE_NAME:** Supabase Realtime Subscriptions
- **ROLE:** SYSTEM (UI hints)
- **LOCATION:** `src/services/realtime/realtimeService.ts`, `src/services/realtime/realtimeTypes.ts`
- **DESCRIPTION:** Subscribes to 8 tables (profiles, leads, call_records, activities, remarks, follow_ups, message_history, import_audits) for real-time UI updates.
- **ENTRY_POINT:** `realtimeService.subscribe()` called by components/hooks
- **DEPENDENCIES:** @supabase/supabase-js, realtimeTypes, Supabase Realtime
- **DATA_USED:** All subscribed tables via postgres_changes
- **OFFLINE_SUPPORT:** ❌ Requires network
- **SYNC_SUPPORT:** ✅ Triggers background sync on changes
- **REALTIME_SUPPORT:** ✅ This IS the realtime feature
- **ERROR_HANDLING:** Connection state machine, auto-reconnect, subscription cleanup
- **TEST_COVERAGE:** `multiDeviceSync.test.ts`
- **CURRENT_STATUS:** ✅ IMPLEMENTED
- **KNOWN_LIMITATIONS:** No selective subscription per component; all-or-nothing

---

### FEAT-017: Backup & Restore
- **FEATURE_NAME:** Backup & Restore
- **ROLE:** ADMIN
- **LOCATION:** `src/components/backup/BackupRestoreModal.tsx`, `src/services/backupService.ts`
- **DESCRIPTION:** Full JSON backup of all 13 local entity types. Restore with LWW merge strategy (remote wins on timestamp tie).
- **ENTRY_POINT:** Settings → Backup/Restore → `BackupRestoreModal.tsx`
- **DEPENDENCIES:** All repositories, backupService, Dexie export/import
- **DATA_USED:** All 13 entity tables
- **OFFLINE_SUPPORT:** ✅ Full - works entirely offline
- **SYNC_SUPPORT:** ✅ Restore queues changes to outbox for sync
- **REALTIME_SUPPORT:** ❌ Not applicable
- **ERROR_HANDLING:** Validation of backup format, version check, conflict resolution during restore
- **TEST_COVERAGE:** `backupRestoreIntegrity.test.ts` (5), `realBackupService.test.ts` (3)
- **CURRENT_STATUS:** ✅ IMPLEMENTED
- **KNOWN_LIMITATIONS:** No selective entity backup; no cloud backup storage

---

### FEAT-018: Day/Night Theme
- **FEATURE_NAME:** Day/Night Theme
- **ROLE:** ALL
- **LOCATION:** `src/context/ThemeContext.tsx`, `src/index.css` (CSS variables), `src/components/settings/SettingsModal.tsx`
- **DESCRIPTION:** System-aware theme switching with CSS custom properties. Persists preference in localStorage.
- **ENTRY_POINT:** `ThemeContext.tsx` provider → `SettingsModal.tsx` toggle
- **DEPENDENCIES:** React Context, localStorage, CSS variables
- **DATA_USED:** None (UI only)
- **OFFLINE_SUPPORT:** ✅ Fully local
- **SYNC_SUPPORT:** ❌ Not synced (device preference)
- **REALTIME_SUPPORT:** ❌ Not applicable
- **ERROR_HANDLING:** Fallback to system preference
- **TEST_COVERAGE:** `appTypography.test.ts` (4), `themeMode.test.ts` (4)
- **CURRENT_STATUS:** ✅ IMPLEMENTED
- **KNOWN_LIMITATIONS:** No custom themes; no auto-switch by time

---

### FEAT-019: Authentication & Session
- **FEATURE_NAME:** Authentication & Session Management
- **ROLE:** ALL
- **LOCATION:** `src/context/AuthContext.tsx`, `src/services/authService.ts`, `src/components/auth/LoginScreen.tsx`
- **DESCRIPTION:** Supabase Auth integration with email/password login, session persistence, auto-refresh, role-based routing.
- **ENTRY_POINT:** `App.tsx` → `AuthContext` provider → `LoginScreen.tsx`
- **DEPENDENCIES:** @supabase/supabase-js, AuthContext, authService
- **DATA_USED:** auth.users, profiles table
- **OFFLINE_SUPPORT:** ✅ Session persists; login requires network
- **SYNC_SUPPORT:** ✅ Pulls profile on login
- **REALTIME_SUPPORT:** ❌ Auth is separate
- **ERROR_HANDLING:** Invalid credentials, session expired, network errors
- **TEST_COVERAGE:** `e2e/auth.spec.ts` (4 tests)
- **CURRENT_STATUS:** ✅ IMPLEMENTED
- **KNOWN_LIMITATIONS:** No MFA; no password reset flow in app

---

### FEAT-020: Role-Based Routing & Access Control
- **FEATURE_NAME:** Role-Based Routing & Access Control
- **ROLE:** SYSTEM (enforced)
- **LOCATION:** `src/App.tsx`, `src/components/admin/AdminShell.tsx`, `src/components/dashboard/SalesDashboard.tsx`, RLS policies
- **DESCRIPTION:** Client-side routing (ADMIN → AdminShell, AGENT → SalesDashboard) + server-enforced RLS policies for data access.
- **ENTRY_POINT:** `App.tsx` → role check → render appropriate shell
- **DEPENDENCIES:** AuthContext, React Router, Supabase RLS
- **DATA_USED:** profiles table (role), all RLS-protected tables
- **OFFLINE_SUPPORT:** ✅ Client routing works; data access via local Dexie
- **SYNC_SUPPORT:** ✅ RLS enforced on cloud
- **REALTIME_SUPPORT:** ✅ RLS filters realtime events
- **ERROR_HANDLING:** Fallback to login on auth failure
- **TEST_COVERAGE:** `securityRlsIsolation.test.ts` (10 tests)
- **CURRENT_STATUS:** ✅ IMPLEMENTED
- **KNOWN_LIMITATIONS:** Client-side routing only hides UI; RLS is true enforcement

---

### FEAT-021: Multi-Device Sync Verification
- **FEATURE_NAME:** Multi-Device Sync Verification
- **ROLE:** QA/TESTING
- **LOCATION:** `tests/multiDeviceSync.test.ts`, `scripts/check_emulators.ps1`
- **DESCRIPTION:** Automated test suite running on 3 Android emulators simultaneously with Docker Supabase, verifying end-to-end sync, agent isolation, and realtime.
- **ENTRY_POINT:** `npm run test:multidevice` → `multiDeviceSync.test.ts`
- **DEPENDENCIES:** Playwright, 3 AVDs, Docker Supabase, tsx
- **DATA_USED:** All tables
- **OFFLINE_SUPPORT:** Test-only feature
- **SYNC_SUPPORT:** Test-only feature
- **REALTIME_SUPPORT:** Test-only feature
- **ERROR_HANDLING:** Emulator detection, cleanup, retry logic
- **TEST_COVERAGE:** This IS the test (13 tests, 3 consecutive runs PASS)
- **CURRENT_STATUS:** ✅ IMPLEMENTED (Test Infrastructure)
- **KNOWN_LIMITATIONS:** Requires 3 AVDs; not physical device tested

---

### FEAT-022: Security Secret Scanning
- **FEATURE_NAME:** Security Secret Scanning
- **ROLE:** SYSTEM (CI/CD)
- **LOCATION:** `tests/securitySecretScan.test.ts`, `scripts/verify.ts`
- **DESCRIPTION:** Automated scan for service role keys, keystore passwords, and other secrets in source code.
- **ENTRY_POINT:** `npm run verify` → `verify.ts` stage 12/14 → `securitySecretScan.test.ts`
- **DEPENDENCIES:** grep patterns, test runner
- **DATA_USED:** Source files
- **OFFLINE_SUPPORT:** ✅ Runs locally
- **SYNC_SUPPORT:** ❌ Not applicable
- **REALTIME_SUPPORT:** ❌ Not applicable
- **ERROR_HANDLING:** Fails verification pipeline on detection
- **TEST_COVERAGE:** This IS the test (3 tests)
- **CURRENT_STATUS:** ✅ IMPLEMENTED
- **KNOWN_LIMITATIONS:** Pattern-based only; no entropy analysis

---

## Summary Statistics

| Category | Feature Count |
|----------|---------------|
| Lead Management | 3 (FEAT-001 to 003) |
| Assignment | 2 (FEAT-004, 005) |
| Call & Communication | 4 (FEAT-006 to 009) |
| Admin & Reporting | 4 (FEAT-011 to 014) |
| Sync & Infrastructure | 3 (FEAT-015, 016, 022) |
| Backup & Settings | 2 (FEAT-017, 018) |
| Auth & Access | 2 (FEAT-019, 020) |
| Testing | 1 (FEAT-021) |
| **Total** | **22 Features** |

---

## Offline Support Matrix

| Feature | Offline Read | Offline Write | Offline Queue |
|---------|--------------|---------------|---------------|
| Lead Import | ✅ | ✅ | ✅ |
| Manual Lead Create | ✅ | ✅ | ✅ |
| Lead Search | ✅ | N/A | N/A |
| Individual Assignment | ✅ | ✅ | ✅ |
| Bulk Assignment | ✅ | ✅ | ✅ |
| Call Lifecycle | ✅ | ✅ | ✅ |
| Follow-ups | ✅ | ✅ | ✅ |
| WhatsApp | ✅ (templates) | ✅ (history) | ✅ |
| Remarks | ✅ | ✅ | ✅ |
| Activity Timeline | ✅ | N/A (append-only) | N/A |
| Admin Dashboard | ✅ | N/A | N/A |
| Agent Management | ❌ | ❌ | ❌ |
| Reports | ✅ | N/A | N/A |
| Activity Feed | ❌ | N/A | N/A |
| Sync Engine | N/A | N/A | N/A (IS the queue) |
| Realtime | ❌ | N/A | N/A |
| Backup/Restore | ✅ | ✅ | N/A |
| Theme | ✅ | ✅ | N/A |
| Auth | ✅ (session) | ❌ | N/A |
| RBAC | ✅ (local) | ✅ (local) | ✅ |