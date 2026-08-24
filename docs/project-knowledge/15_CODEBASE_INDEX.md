# 15 - CODEBASE INDEX

This document lists every file in the project with its path, size, and purpose, grouped by directory.

## Root Configuration Files (26 files)
| File | Size | Purpose |
|------|------|--------|
| [package.json](file:///c:/Users/PC/Desktop/calling%20app/package.json) | 1,662 | NPM config, scripts, deps |
| [package-lock.json](file:///c:/Users/PC/Desktop/calling%20app/package-lock.json) | 139,283 | Locked dependency tree |
| [tsconfig.json](file:///c:/Users/PC/Desktop/calling%20app/tsconfig.json) | 427 | TypeScript compiler config |
| [vite.config.ts](file:///c:/Users/PC/Desktop/calling%20app/vite.config.ts) | 941 | Vite build config with manual chunks |
| [capacitor.config.ts](file:///c:/Users/PC/Desktop/calling%20app/capacitor.config.ts) | 384 | Capacitor Android config |
| [tailwind.config.js](file:///c:/Users/PC/Desktop/calling%20app/tailwind.config.js) | 1,185 | Tailwind CSS with brand/earth colors |
| [playwright.config.ts](file:///c:/Users/PC/Desktop/calling%20app/playwright.config.ts) | 1,426 | Playwright E2E test config |
| [index.html](file:///c:/Users/PC/Desktop/calling%20app/index.html) | 702 | HTML entry with night theme default |
| [vercel.json](file:///c:/Users/PC/Desktop/calling%20app/vercel.json) | 15 | Vercel project naming (`{"name": "crm"}`) |
| [.vercelignore](file:///c:/Users/PC/Desktop/calling%20app/.vercelignore) | 25 | Excludes android/, node_modules/ |
| [.gitignore](file:///c:/Users/PC/Desktop/calling%20app/.gitignore) | 745 | Git exclusions |
| [.env](file:///c:/Users/PC/Desktop/calling%20app/.env) | 400 | Default env |
| [.env.local](file:///c:/Users/PC/Desktop/calling%20app/.env.local) | 323 | Local Docker env |
| [.env.development](file:///c:/Users/PC/Desktop/calling%20app/.env.development) | 331 | Dev env |
| [.env.staging](file:///c:/Users/PC/Desktop/calling%20app/.env.staging) | 669 | Staging env (shared cloud project) |
| [.env.production](file:///c:/Users/PC/Desktop/calling%20app/.env.production) | 400 | Production env |
| [.env.example](file:///c:/Users/PC/Desktop/calling%20app/.env.example) | 462 | Template for new devs |
| [README.md](file:///c:/Users/PC/Desktop/calling%20app/README.md) | 8,961 | Project readme |
| [GATES.md](file:///c:/Users/PC/Desktop/calling%20app/GATES.md) | 6,704 | Master acceptance gates |
| [LICENSE](file:///c:/Users/PC/Desktop/calling%20app/LICENSE) | 994 | License file |
| [BUGFIX_RESULTS.md](file:///c:/Users/PC/Desktop/calling%20app/BUGFIX_RESULTS.md) | 13,806 | Bugfix verification results |
| [THIRD_PARTY_LICENSES.md](file:///c:/Users/PC/Desktop/calling%20app/THIRD_PARTY_LICENSES.md) | 17,158 | Third-party license attributions |
| [android-mcp.log](file:///c:/Users/PC/Desktop/calling%20app/android-mcp.log) | 7,613 | MCP log |
| [e2e-run.log](file:///c:/Users/PC/Desktop/calling%20app/e2e-run.log) | 6,228 | E2E run log |
| [multidev-rerun.log](file:///c:/Users/PC/Desktop/calling%20app/multidev-rerun.log) | 4,104 | Multi-device rerun log |
| [test-output.log](file:///c:/Users/PC/Desktop/calling%20app/test-output.log) | 20,096 | Test output log |

Note: `AGENT_LIFECYCLE_ARCHITECTURE.md`, `BACKGROUND_SYNC_ARCHITECTURE.md`, `THEME_AND_TYPOGRAPHY.md`, and `PHASE_2_STATUS.md` now live under `docs/` (see Docs section below).

## Source Code (src/ - 89 files)

### Root (4 files)
- [main.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/main.tsx) (250) - React DOM mount
- [App.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/App.tsx) (20,621) - Root component with role-based routing
- [index.css](file:///c:/Users/PC/Desktop/calling%20app/src/index.css) (2,946) - Global styles, Inter font, theme tokens
- [vite-env.d.ts](file:///c:/Users/PC/Desktop/calling%20app/src/vite-env.d.ts) (38) - Vite type declarations

### Context (2 files)
- [context/AuthContext.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/context/AuthContext.tsx) (5,024) - Supabase auth provider + useAuth hook
- [context/ThemeContext.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/context/ThemeContext.tsx) (2,602) - Day/Night theme provider + useTheme hook

### Database Layer (16 files)
- [db/types.ts](file:///c:/Users/PC/Desktop/calling%20app/src/db/types.ts) (13,579) - ALL TypeScript types/interfaces
- [db/database.ts](file:///c:/Users/PC/Desktop/calling%20app/src/db/database.ts) (10,060) - Dexie schema v1-v5, hooks
- [db/index.ts](file:///c:/Users/PC/Desktop/calling%20app/src/db/index.ts) (4,157) - Barrel export + createCRMDataLayer factory
- [db/seeds/defaultTemplates.ts](file:///c:/Users/PC/Desktop/calling%20app/src/db/seeds/defaultTemplates.ts) (3,225) - Default WhatsApp templates
- [db/services/leadNormalizer.ts](file:///c:/Users/PC/Desktop/calling%20app/src/db/services/leadNormalizer.ts) (7,173) - Phone/address/name normalization
- [db/repositories/leadRepository.ts](file:///c:/Users/PC/Desktop/calling%20app/src/db/repositories/leadRepository.ts) (21,604) - Lead CRUD, filtering, bulk import
- [db/repositories/callRecordRepository.ts](file:///c:/Users/PC/Desktop/calling%20app/src/db/repositories/callRecordRepository.ts) (7,475) - Verified call records
- [db/repositories/followUpRepository.ts](file:///c:/Users/PC/Desktop/calling%20app/src/db/repositories/followUpRepository.ts) (11,087) - Follow-up lifecycle
- [db/repositories/userRepository.ts](file:///c:/Users/PC/Desktop/calling%20app/src/db/repositories/userRepository.ts) (8,144) - User/profile cache
- [db/repositories/messageTemplateRepository.ts](file:///c:/Users/PC/Desktop/calling%20app/src/db/repositories/messageTemplateRepository.ts) (5,887) - WhatsApp templates
- [db/repositories/messageHistoryRepository.ts](file:///c:/Users/PC/Desktop/calling%20app/src/db/repositories/messageHistoryRepository.ts) (4,705) - Message tracking
- [db/repositories/remarkRepository.ts](file:///c:/Users/PC/Desktop/calling%20app/src/db/repositories/remarkRepository.ts) (3,674) - Lead notes
- [db/repositories/callHistoryRepository.ts](file:///c:/Users/PC/Desktop/calling%20app/src/db/repositories/callHistoryRepository.ts) (3,526) - Call outcome history
- [db/repositories/activityRepository.ts](file:///c:/Users/PC/Desktop/calling%20app/src/db/repositories/activityRepository.ts) (3,010) - Activity audit trail
- [db/repositories/bulkAssignmentAuditRepository.ts](file:///c:/Users/PC/Desktop/calling%20app/src/db/repositories/bulkAssignmentAuditRepository.ts) (3,098) - Bulk assignment audits
- [db/repositories/importAuditRepository.ts](file:///c:/Users/PC/Desktop/calling%20app/src/db/repositories/importAuditRepository.ts) (2,714) - Import audits

### Services Layer (28 files)
- [services/adminReportsService.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/adminReportsService.ts) (28,937) - Multi-tab analytics + CSV exports
- [services/backupService.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/backupService.ts) (23,489) - JSON backup/restore
- [services/sampleData.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/sampleData.ts) (32,337) - 141 Lucknow gym dataset
- [services/adminAnalyticsService.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/adminAnalyticsService.ts) (17,184) - KPI metrics
- [services/excelParser.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/excelParser.ts) (15,389) - XLSX parsing + ingestion
- [services/leadAssignmentService.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/leadAssignmentService.ts) (12,537) - Individual + bulk assignment
- [services/agentManagementService.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/agentManagementService.ts) (12,405) - Agent CRUD + RBAC
- [services/callLifecycleService.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/callLifecycleService.ts) (10,131) - Telephony state machine
- [services/authService.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/authService.ts) (8,894) - Supabase auth + session
- [services/dashboardService.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/dashboardService.ts) (9,161) - Dashboard metrics
- [services/appSettingsService.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/appSettingsService.ts) (6,042) - Device settings
- [services/nativePlatform.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/nativePlatform.ts) (4,941) - Capacitor native bridge
- [services/callOutcomeMapping.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/callOutcomeMapping.ts) (2,715) - Outcome -> status mapping
- [services/supabaseClient.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/supabaseClient.ts) (2,463) - Supabase client factory
- [services/templateRenderer.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/templateRenderer.ts) (2,015) - WhatsApp template renderer
- [services/deviceService.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/deviceService.ts) (1,929) - Device UUID
- [services/attachmentService.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/attachmentService.ts) (2,761) - File attachment handling
- [services/realtime/realtimeService.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/realtime/realtimeService.ts) (13,173) - Supabase Realtime subscriber
- [services/realtime/realtimeTypes.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/realtime/realtimeTypes.ts) (1,451) - Realtime type defs
- [services/sync/syncPull.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/syncPull.ts) (11,840) - Pull from Supabase
- [services/sync/syncPush.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/syncPush.ts) (12,857) - Push to Supabase
- [services/sync/syncEngine.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/syncEngine.ts) (7,600) - Bidirectional sync coordinator
- [services/sync/backgroundSyncManager.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/backgroundSyncManager.ts) (5,385) - Auto-sync lifecycle
- [services/sync/syncQueue.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/syncQueue.ts) (6,584) - Outbox queue
- [services/sync/syncConflictResolver.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/syncConflictResolver.ts) (3,629) - LWW + VERIFIED protection
- [services/sync/syncStateRepository.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/syncStateRepository.ts) (1,911) - Sync cursor state
- [services/sync/syncTypes.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/syncTypes.ts) (1,785) - Sync type definitions
- [services/sync/useSync.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/useSync.ts) (845) - React sync hook

### Components (39 files)

#### Admin (18)
- [src/components/admin/AdminAgentsView.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/AdminAgentsView.tsx) (8,545) - Agent management list view
- [src/components/admin/AdminCallHistoryModal.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/AdminCallHistoryModal.tsx) (10,736) - Modal for viewing call history logs
- [src/components/admin/AdminDashboardView.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/AdminDashboardView.tsx) (15,662) - Dashboard overview for admins
- [src/components/admin/AdminLeadsView.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/AdminLeadsView.tsx) (14,638) - Admin view of all leads
- [src/components/admin/AdminReportsView.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/AdminReportsView.tsx) (24,820) - Analytics and reports view
- [src/components/admin/AdminShell.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/AdminShell.tsx) (9,824) - Main admin layout wrapper
- [src/components/admin/AgentCard.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/AgentCard.tsx) (6,508) - Card component displaying agent info
- [src/components/admin/AgentPerformanceDetail.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/AgentPerformanceDetail.tsx) (12,069) - Detailed performance metrics for an agent
- [src/components/admin/AgentPerformanceTable.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/AgentPerformanceTable.tsx) (6,461) - Table view of agent performance stats
- [src/components/admin/BulkLeadAssignmentModal.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/BulkLeadAssignmentModal.tsx) (13,345) - Modal for assigning leads in bulk
- [src/components/admin/ConfirmStatusModal.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/ConfirmStatusModal.tsx) (6,584) - Confirmation modal for status changes
- [src/components/admin/CreateAgentModal.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/CreateAgentModal.tsx) (13,420) - Modal to create a new agent
- [src/components/admin/DeleteAgentModal.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/DeleteAgentModal.tsx) (7,507) - Modal to delete an agent
- [src/components/admin/EditAgentModal.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/EditAgentModal.tsx) (8,748) - Modal to edit agent details
- [src/components/admin/LiveActivityFeed.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/LiveActivityFeed.tsx) (12,272) - Real-time feed of agent activities
- [src/components/admin/data/AdminDataManagementView.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/data/AdminDataManagementView.tsx) (30,406) - View for database/data management
- [src/components/admin/reports/ReportFilterBar.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/reports/ReportFilterBar.tsx) (3,976) - Filter bar for reports
- [src/components/admin/reports/ReportKpiCard.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/reports/ReportKpiCard.tsx) (2,150) - KPI metric card for reports

#### Auth (1)
- [src/components/auth/LoginScreen.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/auth/LoginScreen.tsx) (9,943) - Authentication login screen

#### Backup (1)
- [src/components/backup/BackupRestoreModal.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/backup/BackupRestoreModal.tsx) (23,021) - Modal for database backup and restore

#### Common (1)
- [src/components/common/ErrorBoundary.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/common/ErrorBoundary.tsx) (3,355) - React error boundary component

#### Dashboard (1)
- [src/components/dashboard/SalesDashboard.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/dashboard/SalesDashboard.tsx) (21,812) - Agent sales dashboard

#### Follow-ups (2)
- [src/components/followups/FollowUpModal.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/followups/FollowUpModal.tsx) (11,772) - Modal to schedule a follow-up
- [src/components/followups/FollowUpsView.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/followups/FollowUpsView.tsx) (12,996) - View listing scheduled follow-ups

#### Import (6)
- [src/components/import/ColumnMappingSelector.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/import/ColumnMappingSelector.tsx) (3,273) - Selector for Excel column mapping
- [src/components/import/DuplicateConfirmModal.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/import/DuplicateConfirmModal.tsx) (3,517) - Modal to confirm handling duplicates
- [src/components/import/ExcelImporter.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/import/ExcelImporter.tsx) (17,955) - Main component for Excel imports
- [src/components/import/ImportPreviewList.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/import/ImportPreviewList.tsx) (7,620) - Preview list for imported data
- [src/components/import/ImportStatsCard.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/import/ImportStatsCard.tsx) (3,559) - Statistics card for import results
- [src/components/import/ImportSummaryCard.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/import/ImportSummaryCard.tsx) (4,123) - Summary card for import batches

#### Leads (6)
- [src/components/leads/CallOutcomeModal.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/leads/CallOutcomeModal.tsx) (16,404) - Modal to record the outcome of a call
- [src/components/leads/CreateLeadModal.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/leads/CreateLeadModal.tsx) (11,216) - Modal to create a new lead manually
- [src/components/leads/LeadAssignmentModal.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/leads/LeadAssignmentModal.tsx) (10,136) - Modal to assign a single lead
- [src/components/leads/LeadDetailView.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/leads/LeadDetailView.tsx) (30,840) - Detailed view for a specific lead
- [src/components/leads/LeadTimelineView.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/leads/LeadTimelineView.tsx) (5,340) - Timeline of activities for a lead
- [src/components/leads/MinimalLeadsList.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/leads/MinimalLeadsList.tsx) (15,697) - Compact list view of leads

#### Settings (1)
- [src/components/settings/SettingsModal.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/settings/SettingsModal.tsx) (39,537) - Modal for application settings

#### Sync (1)
- [src/components/sync/SyncStatusBadge.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/sync/SyncStatusBadge.tsx) (3,201) - Badge showing current sync status

#### WhatsApp (1)
- [src/components/whatsapp/WhatsAppComposeModal.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/whatsapp/WhatsAppComposeModal.tsx) (19,104) - Modal to compose WhatsApp messages

## Tests (18 files)
- [tests/agentDeletion.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/agentDeletion.test.ts) (8,520) - Describe: Agent Soft Deletion & Lifecycle (Phase 3) - Tests: 5
- [tests/appTypography.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/appTypography.test.ts) (2,618) - Describe: App Font & Typography Constraints (Phase 3) - Tests: 4
- [tests/backgroundSync.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/backgroundSync.test.ts) (3,691) - Describe: Automatic Background Sync Lifecycle (Phase 3) - Tests: 4
- [tests/backupRestoreIntegrity.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/backupRestoreIntegrity.test.ts) (4,871) - Describe: Backup & Restore Data Safety & Integrity (Stage 8) - Tests: 5
- [tests/bugfixRegression.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/bugfixRegression.test.ts) (20,163) - Describe: Bugfix regression suite (BUG-1..BUG-10, 10 describe blocks) - Tests: 17
- [tests/leadNormalizer.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/leadNormalizer.test.ts) (5,265) - Describe: Lead Normalization Service (Tests) - Tests: 13
- [tests/multiDeviceSync.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/multiDeviceSync.test.ts) (32,515) - Describe: Real Multi-Device End-to-End Synchronization Suite (3 Android Emulators + Docker Supabase) - Tests: 13
- [tests/realBackupService.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/realBackupService.test.ts) (4,757) - Describe: Real Backup & Restore Service Integration Tests (Stage 8) - Tests: 3
- [tests/realCallLifecycle.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/realCallLifecycle.test.ts) (4,276) - Describe: Real Telephony Lifecycle & Outcome Mapping Tests (Stage 7) - Tests: 6
- [tests/realDexieRepositoryOutbox.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/realDexieRepositoryOutbox.test.ts) (11,959) - Describe: Real Dexie, Repository & Outbox Integration Tests (Stage 1 & 2) - Tests: 6
- [tests/realExcelParser.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/realExcelParser.test.ts) (3,396) - Describe: Real Excel Parser & Lead Ingestion Tests (Stage 9) - Tests: 3
- [tests/realSupabasePostgres.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/realSupabasePostgres.test.ts) (17,974) - Describe: Real Supabase Local & PostgreSQL Integration Tests (Docker Stack) - Tests: 15
- [tests/realTemplateRenderer.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/realTemplateRenderer.test.ts) (2,444) - Describe: Real WhatsApp Message Template Renderer Tests (Stage 8) - Tests: 3
- [tests/securityRlsIsolation.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/securityRlsIsolation.test.ts) (12,585) - Describe: Supabase RLS Agent & Admin Lead Isolation Tests (Stage 5 / P0 Security) - Tests: 10
- [tests/securitySecretScan.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/securitySecretScan.test.ts) (3,063) - Describe: Automated Security & Secret Leak Scanner (Stage 12 & 14) - Tests: 3
- [tests/syncConflictResolver.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/syncConflictResolver.test.ts) (5,024) - Describe: Sync Conflict Resolver & Verified-Duration Protection (Stage 7) - Tests: 7
- [tests/syncOutboxQueue.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/syncOutboxQueue.test.ts) (13,507) - Describe: Sync Outbox Queue & Data Integrity (Stage 2 / P0 Remediation) - Tests: 11
- [tests/themeMode.test.ts](file:///c:/Users/PC/Desktop/calling%20app/tests/themeMode.test.ts) (1,967) - Describe: Day / Night Mode Themes (Phase 3) - Tests: 4

## E2E (6 files)
- [e2e/auth.spec.ts](file:///c:/Users/PC/Desktop/calling%20app/e2e/auth.spec.ts) (3,283) - Describe: Login & Authentication Flow - Tests: 4
- [e2e/bugfix-verification.spec.ts](file:///c:/Users/PC/Desktop/calling%20app/e2e/bugfix-verification.spec.ts) (10,151) - Describe: Bugfix verification: import, WhatsApp, dashboard, backup - Tests: 1
- [e2e/crm-navigation.spec.ts](file:///c:/Users/PC/Desktop/calling%20app/e2e/crm-navigation.spec.ts) (5,179) - Describe: CRM Navigation & Lead Management Workflow - Tests: 4
- [e2e/mobile-responsive.spec.ts](file:///c:/Users/PC/Desktop/calling%20app/e2e/mobile-responsive.spec.ts) (1,999) - Describe: Mobile Viewport & Responsive Design Flow - Tests: 3
- [e2e/theme.spec.ts](file:///c:/Users/PC/Desktop/calling%20app/e2e/theme.spec.ts) (2,391) - Describe: Theme & Dark/Light Mode Flow - Tests: 4
- [e2e/helpers/mockAuth.ts](file:///c:/Users/PC/Desktop/calling%20app/e2e/helpers/mockAuth.ts) (3,647) - Describe: None - Tests: 0

## Scripts (5 files)
- [scripts/check_emulators.ps1](file:///c:/Users/PC/Desktop/calling%20app/scripts/check_emulators.ps1) (384) - PowerShell helper to check Android emulator status
- [scripts/exportLocalSchemaSnapshot.ts](file:///c:/Users/PC/Desktop/calling%20app/scripts/exportLocalSchemaSnapshot.ts) (6,970) - Export local Dexie schema snapshot
- [scripts/probeCloudSchema.ts](file:///c:/Users/PC/Desktop/calling%20app/scripts/probeCloudSchema.ts) (6,525) - Probe remote Supabase Postgres schema
- [scripts/prod_smoke.ps1](file:///c:/Users/PC/Desktop/calling%20app/scripts/prod_smoke.ps1) (1,147) - PowerShell production smoke test
- [scripts/verify.ts](file:///c:/Users/PC/Desktop/calling%20app/scripts/verify.ts) (35,853) - Automated end-to-end verification script

## Supabase (10 tracked files + local state)
- [supabase/.gitignore](file:///c:/Users/PC/Desktop/calling%20app/supabase/.gitignore) (72)
- [supabase/config.toml](file:///c:/Users/PC/Desktop/calling%20app/supabase/config.toml) (15,583)
- [supabase/seed.sql](file:///c:/Users/PC/Desktop/calling%20app/supabase/seed.sql) (5,467)
- [supabase/.branches/_current_branch](file:///c:/Users/PC/Desktop/calling%20app/supabase/.branches/_current_branch) (4) - local CLI state
- [supabase/.temp/cli-latest](file:///c:/Users/PC/Desktop/calling%20app/supabase/.temp/cli-latest) (8) - local CLI state
- `supabase/.temp/linked-project.json` and `supabase/.temp/project-ref` - cloud link state (`lahvcodvgubplzfshare`); other `.temp/` entries (versions, pooler-url) appear while the local stack runs
- [supabase/functions/create-agent/index.ts](file:///c:/Users/PC/Desktop/calling%20app/supabase/functions/create-agent/index.ts) (9,761)
- [supabase/migrations/20260820000001_phase2e_central_schema.sql](file:///c:/Users/PC/Desktop/calling%20app/supabase/migrations/20260820000001_phase2e_central_schema.sql) (10,380)
- [supabase/migrations/20260820000002_phase2e_rls_policies.sql](file:///c:/Users/PC/Desktop/calling%20app/supabase/migrations/20260820000002_phase2e_rls_policies.sql) (10,454)
- [supabase/migrations/20260820000003_phase2j_call_duration_indexes.sql](file:///c:/Users/PC/Desktop/calling%20app/supabase/migrations/20260820000003_phase2j_call_duration_indexes.sql) (767)
- [supabase/migrations/20260820000004_phase2k_realtime_publication.sql](file:///c:/Users/PC/Desktop/calling%20app/supabase/migrations/20260820000004_phase2k_realtime_publication.sql) (2,678)
- [supabase/migrations/20260820000005_phase2k_bulk_assignment.sql](file:///c:/Users/PC/Desktop/calling%20app/supabase/migrations/20260820000005_phase2k_bulk_assignment.sql) (2,729)
- [supabase/migrations/20260820000006_rls_agent_lead_isolation.sql](file:///c:/Users/PC/Desktop/calling%20app/supabase/migrations/20260820000006_rls_agent_lead_isolation.sql) (14,191)

## Docs (23 root files + 26 project-knowledge files)

### docs/ root
- [docs/AGENT_LIFECYCLE_ARCHITECTURE.md](file:///c:/Users/PC/Desktop/calling%20app/docs/AGENT_LIFECYCLE_ARCHITECTURE.md) (2,727)
- [docs/AUTOMATED_VERIFICATION_REPORT.md](file:///c:/Users/PC/Desktop/calling%20app/docs/AUTOMATED_VERIFICATION_REPORT.md) (58,133)
- [docs/BACKGROUND_SYNC_ARCHITECTURE.md](file:///c:/Users/PC/Desktop/calling%20app/docs/BACKGROUND_SYNC_ARCHITECTURE.md) (2,922)
- [docs/CODEX_FINAL_6_OF_6_RELEASE_VERIFICATION.md](file:///c:/Users/PC/Desktop/calling%20app/docs/CODEX_FINAL_6_OF_6_RELEASE_VERIFICATION.md) (7,384)
- [docs/CODEX_FINAL_RELEASE_HOUSEKEEPING.md](file:///c:/Users/PC/Desktop/calling%20app/docs/CODEX_FINAL_RELEASE_HOUSEKEEPING.md) (10,779)
- [docs/CODEX_POST_TAKEOVER_VERIFICATION.md](file:///c:/Users/PC/Desktop/calling%20app/docs/CODEX_POST_TAKEOVER_VERIFICATION.md) (8,727)
- [docs/CODEX_TAKEOVER_VERIFICATION.md](file:///c:/Users/PC/Desktop/calling%20app/docs/CODEX_TAKEOVER_VERIFICATION.md) (11,648)
- [docs/FINAL_A_TO_Z_RELEASE_AUDIT.md](file:///c:/Users/PC/Desktop/calling%20app/docs/FINAL_A_TO_Z_RELEASE_AUDIT.md) (24,832)
- [docs/FINAL_END_TO_END_FUNCTIONAL_AUDIT.md](file:///c:/Users/PC/Desktop/calling%20app/docs/FINAL_END_TO_END_FUNCTIONAL_AUDIT.md) (34,513)
- [docs/FINAL_POST_BUGFIX_RELEASE_VERIFICATION.md](file:///c:/Users/PC/Desktop/calling%20app/docs/FINAL_POST_BUGFIX_RELEASE_VERIFICATION.md) (15,192)
- [docs/FINAL_PRODUCTION_RELEASE_VERIFICATION.md](file:///c:/Users/PC/Desktop/calling%20app/docs/FINAL_PRODUCTION_RELEASE_VERIFICATION.md) (8,215)
- [docs/FINAL_RELEASE_VERIFICATION.md](file:///c:/Users/PC/Desktop/calling%20app/docs/FINAL_RELEASE_VERIFICATION.md) (4,974)
- [docs/GATES.md](file:///c:/Users/PC/Desktop/calling%20app/docs/GATES.md) (6,579) - duplicate of root [GATES.md](file:///c:/Users/PC/Desktop/calling%20app/GATES.md); the root copy is the refreshed one
- [docs/LOCAL_VS_CLOUD_SUPABASE_SCHEMA_REPORT.md](file:///c:/Users/PC/Desktop/calling%20app/docs/LOCAL_VS_CLOUD_SUPABASE_SCHEMA_REPORT.md) (11,850)
- [docs/PHASE_2_FINAL_REMEDIATION_REPORT.md](file:///c:/Users/PC/Desktop/calling%20app/docs/PHASE_2_FINAL_REMEDIATION_REPORT.md) (14,247)
- [docs/PHASE_2_REMEDIATION_BASELINE.md](file:///c:/Users/PC/Desktop/calling%20app/docs/PHASE_2_REMEDIATION_BASELINE.md) (3,098)
- [docs/PHASE_2_STATUS.md](file:///c:/Users/PC/Desktop/calling%20app/docs/PHASE_2_STATUS.md) (2,252)
- [docs/RELEASE_CANDIDATE_VERIFICATION.md](file:///c:/Users/PC/Desktop/calling%20app/docs/RELEASE_CANDIDATE_VERIFICATION.md) (4,239)
- [docs/THEME_AND_TYPOGRAPHY.md](file:///c:/Users/PC/Desktop/calling%20app/docs/THEME_AND_TYPOGRAPHY.md) (2,318)
- [docs/app_launch_screen.png](file:///c:/Users/PC/Desktop/calling%20app/docs/app_launch_screen.png) (329,687)
- [docs/cloud_graphql_schema.json](file:///c:/Users/PC/Desktop/calling%20app/docs/cloud_graphql_schema.json) (89)
- [docs/cloud_schema_probe_results.json](file:///c:/Users/PC/Desktop/calling%20app/docs/cloud_schema_probe_results.json) (14,204)
- [docs/local_schema_snapshot.json](file:///c:/Users/PC/Desktop/calling%20app/docs/local_schema_snapshot.json) (90,134)

### docs/project-knowledge/
- [docs/project-knowledge/README.md](file:///c:/Users/PC/Desktop/calling%20app/docs/project-knowledge/README.md) (2,344) - master index
- [docs/project-knowledge/01_PROJECT_OVERVIEW.md](file:///c:/Users/PC/Desktop/calling%20app/docs/project-knowledge/01_PROJECT_OVERVIEW.md) (4,869)
- [docs/project-knowledge/02_SYSTEM_ARCHITECTURE.md](file:///c:/Users/PC/Desktop/calling%20app/docs/project-knowledge/02_SYSTEM_ARCHITECTURE.md) (9,143)
- [docs/project-knowledge/03_ROLES_AND_PERMISSIONS.md](file:///c:/Users/PC/Desktop/calling%20app/docs/project-knowledge/03_ROLES_AND_PERMISSIONS.md) (1,930)
- [docs/project-knowledge/04_NAVIGATION_MAP.md](file:///c:/Users/PC/Desktop/calling%20app/docs/project-knowledge/04_NAVIGATION_MAP.md) (4,455)
- [docs/project-knowledge/05_BUSINESS_WORKFLOW.md](file:///c:/Users/PC/Desktop/calling%20app/docs/project-knowledge/05_BUSINESS_WORKFLOW.md) (4,609)
- [docs/project-knowledge/06_DATABASE_REFERENCE.md](file:///c:/Users/PC/Desktop/calling%20app/docs/project-knowledge/06_DATABASE_REFERENCE.md) (10,660)
- [docs/project-knowledge/07_SUPABASE_SECURITY_MODEL.md](file:///c:/Users/PC/Desktop/calling%20app/docs/project-knowledge/07_SUPABASE_SECURITY_MODEL.md) (4,959)
- [docs/project-knowledge/08_SYNC_REALTIME_ARCHITECTURE.md](file:///c:/Users/PC/Desktop/calling%20app/docs/project-knowledge/08_SYNC_REALTIME_ARCHITECTURE.md) (4,588)
- [docs/project-knowledge/09_API_DATA_CONTRACTS.md](file:///c:/Users/PC/Desktop/calling%20app/docs/project-knowledge/09_API_DATA_CONTRACTS.md) (10,813)
- [docs/project-knowledge/10_ANDROID_APPLICATION.md](file:///c:/Users/PC/Desktop/calling%20app/docs/project-knowledge/10_ANDROID_APPLICATION.md) (17,109)
- [docs/project-knowledge/11_WEB_ADMIN_APPLICATION.md](file:///c:/Users/PC/Desktop/calling%20app/docs/project-knowledge/11_WEB_ADMIN_APPLICATION.md) (3,045)
- [docs/project-knowledge/12_TESTING_VERIFICATION.md](file:///c:/Users/PC/Desktop/calling%20app/docs/project-knowledge/12_TESTING_VERIFICATION.md) (13,174)
- [docs/project-knowledge/13_DEPLOYMENT_ENVIRONMENTS.md](file:///c:/Users/PC/Desktop/calling%20app/docs/project-knowledge/13_DEPLOYMENT_ENVIRONMENTS.md) (5,812)
- [docs/project-knowledge/14_MIGRATION_HISTORY.md](file:///c:/Users/PC/Desktop/calling%20app/docs/project-knowledge/14_MIGRATION_HISTORY.md) (10,451)
- [docs/project-knowledge/15_CODEBASE_INDEX.md](file:///c:/Users/PC/Desktop/calling%20app/docs/project-knowledge/15_CODEBASE_INDEX.md) (this file)
- [docs/project-knowledge/16_CURRENT_STATE.md](file:///c:/Users/PC/Desktop/calling%20app/docs/project-knowledge/16_CURRENT_STATE.md) (4,140)
- [docs/project-knowledge/17_AI_AGENT_CONTEXT.md](file:///c:/Users/PC/Desktop/calling%20app/docs/project-knowledge/17_AI_AGENT_CONTEXT.md) (2,955)
- [docs/project-knowledge/18_EDGE_FUNCTIONS.md](file:///c:/Users/PC/Desktop/calling%20app/docs/project-knowledge/18_EDGE_FUNCTIONS.md) (3,928)
- [docs/project-knowledge/19_ENVIRONMENT_VARIABLES.md](file:///c:/Users/PC/Desktop/calling%20app/docs/project-knowledge/19_ENVIRONMENT_VARIABLES.md) (2,843)
- [docs/project-knowledge/20_TOOLCHAIN_CLI_STATUS.md](file:///c:/Users/PC/Desktop/calling%20app/docs/project-knowledge/20_TOOLCHAIN_CLI_STATUS.md) (4,148)
- [docs/project-knowledge/21_ACCOUNT_IDENTITY_MAP.md](file:///c:/Users/PC/Desktop/calling%20app/docs/project-knowledge/21_ACCOUNT_IDENTITY_MAP.md) (3,194)
- [docs/project-knowledge/22_DEPLOYMENT_RUNBOOK.md](file:///c:/Users/PC/Desktop/calling%20app/docs/project-knowledge/22_DEPLOYMENT_RUNBOOK.md) (4,677)
- [docs/project-knowledge/23_LOCAL_DEV_SETUP.md](file:///c:/Users/PC/Desktop/calling%20app/docs/project-knowledge/23_LOCAL_DEV_SETUP.md) (3,271)
- [docs/project-knowledge/FINAL_DATA_REVERIFICATION_REPORT.md](file:///c:/Users/PC/Desktop/calling%20app/docs/project-knowledge/FINAL_DATA_REVERIFICATION_REPORT.md) (2,266)
- [docs/project-knowledge/LOCAL_VS_CLOUD_REVERIFICATION.md](file:///c:/Users/PC/Desktop/calling%20app/docs/project-knowledge/LOCAL_VS_CLOUD_REVERIFICATION.md) (3,685)

## Public (2 files)
- [public/favicon.png](file:///c:/Users/PC/Desktop/calling%20app/public/favicon.png) (9,799)
- [public/logo.png](file:///c:/Users/PC/Desktop/calling%20app/public/logo.png) (306,816)

## Android (key files only, not build artifacts or font assets)
- [android/app/src/main/AndroidManifest.xml](file:///c:/Users/PC/Desktop/calling%20app/android/app/src/main/AndroidManifest.xml) (2,104)
- [android/app/src/main/java/com/amaratvkrishi/salescrm/MainActivity.java](file:///c:/Users/PC/Desktop/calling%20app/android/app/src/main/java/com/amaratvkrishi/salescrm/MainActivity.java) (361)
- [android/app/src/test/java/com/getcapacitor/myapp/ExampleUnitTest.java](file:///c:/Users/PC/Desktop/calling%20app/android/app/src/test/java/com/getcapacitor/myapp/ExampleUnitTest.java) (402)
- [android/app/src/main/res/values/strings.xml](file:///c:/Users/PC/Desktop/calling%20app/android/app/src/main/res/values/strings.xml) (340)
- [android/app/src/main/res/values/styles.xml](file:///c:/Users/PC/Desktop/calling%20app/android/app/src/main/res/values/styles.xml) (823)
- [android/app/src/main/res/xml/config.xml](file:///c:/Users/PC/Desktop/calling%20app/android/app/src/main/res/xml/config.xml) (185)
- [android/app/src/main/res/xml/file_paths.xml](file:///c:/Users/PC/Desktop/calling%20app/android/app/src/main/res/xml/file_paths.xml) (319)
- [android/app/src/main/res/layout/activity_main.xml](file:///c:/Users/PC/Desktop/calling%20app/android/app/src/main/res/layout/activity_main.xml) (535)
