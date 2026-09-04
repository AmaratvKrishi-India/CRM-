# 02 - PRODUCT REQUIREMENTS

## Document Metadata
- **DOCUMENT_STATUS:** CURRENT
- **LAST_VERIFIED:** 2026-08-25
- **SOURCE_OF_TRUTH:** Source code analysis + existing documentation
- **SCOPE:** Business and functional requirements implemented in the Amaratv Krishi Field Sales CRM
- **RELATED_DOCUMENTS:** 01_PROJECT_OVERVIEW.md, 03_FEATURE_INVENTORY.md, 05_USER_WORKFLOWS.md

---

## Business Objectives

| Objective | Status | Evidence |
|-----------|--------|----------|
| Enable field sales agents to manage leads offline in Lucknow, UP gym/fitness market | ✅ IMPLEMENTED | Offline-first Dexie + outbox queue |
| Provide administrators with lead import, assignment, and monitoring capabilities | ✅ IMPLEMENTED | Excel import, bulk assignment, admin dashboard |
| Ensure data isolation between organizations and between agents | ✅ IMPLEMENTED | RLS policies (migration 6), agent lead isolation |
| Support bidirectional sync between mobile devices and cloud | ✅ IMPLEMENTED | SyncEngine push/pull + Supabase Realtime |
| Deliver verified call tracking with honest duration reporting | ✅ IMPLEMENTED | Call lifecycle state machine, VERIFIED/UNVERIFIED |
| Provide WhatsApp integration for templated outreach | ✅ IMPLEMENTED | Template renderer + WhatsApp compose modal |

---

## Functional Requirements

### FR-1: Lead Management
| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Import leads from Excel (XLSX) with column mapping | ✅ IMPLEMENTED | `excelParser.ts`, `ExcelImporter.tsx` |
| Fuzzy column detection for varied Excel formats | ✅ IMPLEMENTED | `leadNormalizer.ts` |
| Manual lead creation by agents/admins | ✅ IMPLEMENTED | `CreateLeadModal.tsx` |
| Lead status pipeline (NEW → CONTACTED → INTERESTED → etc.) | ✅ IMPLEMENTED | `LeadStatus` enum, `LeadDetailView.tsx` |
| Lead search/filter by name, phone, locality, status | ✅ IMPLEMENTED | `LeadFilterParams`, `MinimalLeadsList.tsx` |
| Duplicate detection during import | ✅ IMPLEMENTED | Phone-based dedup in `leadNormalizer.ts` |

### FR-2: Assignment & Ownership
| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Individual lead assignment to agents | ✅ IMPLEMENTED | `LeadAssignmentModal.tsx`, `leadAssignmentService.ts` |
| Bulk assignment with filtering | ✅ IMPLEMENTED | `BulkLeadAssignmentModal.tsx`, `leadAssignmentService.ts` |
| Assignment audit trail | ✅ IMPLEMENTED | `bulk_assignment_audits` table, migration 5 |
| Agent lead isolation (agents see only assigned/created) | ✅ IMPLEMENTED | RLS migration 6, `current_profile_id()` |

### FR-3: Call Lifecycle
| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Native dialer integration | ✅ IMPLEMENTED | `nativePlatform.ts`, Capacitor dialer intent |
| Call outcome logging (CONNECTED, BUSY, NO_ANSWER, etc.) | ✅ IMPLEMENTED | `CallOutcomeModal.tsx`, `callLifecycleService.ts` |
| Verified vs unverified duration tracking | ✅ IMPLEMENTED | `CallVerificationStatus`, `CallRecordStatus` |
| Idempotency via dial_attempt_id | ✅ IMPLEMENTED | Migration 7, `dialAttemptId` field |
| Call history per lead | ✅ IMPLEMENTED | `callHistory` + `callRecords` tables |

### FR-4: Follow-up Management
| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Schedule follow-ups with priority (LOW/MEDIUM/HIGH/URGENT) | ✅ IMPLEMENTED | `FollowUpModal.tsx`, `FollowUpStatus` |
| Follow-up completion tracking | ✅ IMPLEMENTED | `completedAt`, `outcomeNotes` |
| Local notifications for due follow-ups | ✅ IMPLEMENTED | Capacitor Local Notifications plugin |

### FR-5: WhatsApp Communication
| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Predefined message templates with placeholders | ✅ IMPLEMENTED | `MessageTemplate`, `templateRenderer.ts` |
| Template categories (INTRO, SAMPLE_OFFER, FOLLOW_UP, etc.) | ✅ IMPLEMENTED | `TemplateCategory` enum |
| WhatsApp compose with lead context | ✅ IMPLEMENTED | `WhatsAppComposeModal.tsx` |
| Message history tracking | ✅ IMPLEMENTED | `message_history` table |

### FR-6: Admin Dashboard & Reporting
| Requirement | Status | Implementation |
|-------------|--------|----------------|
| KPI metrics (leads, calls, conversions) | ✅ IMPLEMENTED | `adminAnalyticsService.ts`, `AdminDashboardView.tsx` |
| Agent performance tracking | ✅ IMPLEMENTED | `AgentPerformanceTable.tsx`, `AgentPerformanceDetail.tsx` |
| Live activity feed | ✅ IMPLEMENTED | `LiveActivityFeed.tsx`, Realtime subscriptions |
| CSV export for reports | ✅ IMPLEMENTED | `adminReportsService.ts` |

### FR-7: Offline-First Data Sync
| Requirement | Status | Implementation |
|-------------|--------|----------------|
| All writes go to local Dexie first | ✅ IMPLEMENTED | Repository pattern + `syncQueue.enqueue()` |
| Outbox queue with retry logic | ✅ IMPLEMENTED | `syncQueue.ts`, `syncPush.ts` |
| Push-then-Pull bidirectional sync | ✅ IMPLEMENTED | `syncEngine.ts` |
| Conflict resolution (LWW + VERIFIED wins) | ✅ IMPLEMENTED | `syncConflictResolver.ts` |
| Background sync on app resume/network | ✅ IMPLEMENTED | `backgroundSyncManager.ts` |

### FR-8: Backup & Restore
| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Full JSON backup of local data | ✅ IMPLEMENTED | `backupService.ts` |
| Restore with LWW merge strategy | ✅ IMPLEMENTED | `BackupRestoreModal.tsx` |
| Backup includes all entity types | ✅ IMPLEMENTED | 13 entity types in backup |

---

## Non-Functional Requirements

### NFR-1: Security
| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Organization-level data isolation | ✅ IMPLEMENTED | RLS `current_user_org_id()` on all tables |
| Agent lead isolation | ✅ IMPLEMENTED | RLS `current_profile_id()` migration 6 |
| Profile field immutability (role, org_id) | ✅ IMPLEMENTED | Trigger `protect_profile_immutable_fields()` |
| Lead field immutability (org_id, created_by) | ✅ IMPLEMENTED | Trigger `protect_lead_immutable_fields()` |
| No service role key in client code | ✅ IMPLEMENTED | Verified by `securitySecretScan.test.ts` |
| Android backup disabled | ✅ IMPLEMENTED | `allowBackup=false` in AndroidManifest |

### NFR-2: Reliability
| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Atomic data + outbox writes | ✅ IMPLEMENTED | Dexie transaction (BUG-4 fix) |
| Idempotent sync operations | ✅ IMPLEMENTED | `dialAttemptId`, upsert with `onConflict` |
| Soft deletes for sync propagation | ✅ IMPLEMENTED | `deletedAt` on all entities |
| Exponential backoff retry | ✅ IMPLEMENTED | `backgroundSyncManager.ts` (1s, 2s, 4s... cap 32s) |

### NFR-3: Performance
| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Compound indexes for mobile filtering | ✅ IMPLEMENTED | Dexie compound indexes v2-v5 |
| Cursor-based incremental pull | ✅ IMPLEMENTED | `lastPullCursor` in `SyncState` |
| Batch push by entity type | ✅ IMPLEMENTED | `syncPush.ts` batching |
| Single-flight sync mutex | ✅ IMPLEMENTED | `backgroundSyncManager.ts` |

### NFR-4: Platform
| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Android APK via Capacitor | ✅ IMPLEMENTED | `capacitor.config.ts`, signed APK in release/ |
| Web admin on Vercel | ✅ IMPLEMENTED | Vercel deploy, `vercel.json` |
| Local Supabase via Docker | ✅ IMPLEMENTED | `supabase/config.toml`, `npx supabase start` |

---

## Role-Based Requirements

### ADMIN Role
| Requirement | Status |
|-------------|--------|
| Excel lead import with column mapping | ✅ |
| Individual & bulk lead assignment | ✅ |
| Org-wide dashboard & KPIs | ✅ |
| Agent management (create, edit, deactivate) | ✅ |
| Analytics reports & CSV export | ✅ |
| Import/bulk assignment audit views | ✅ |
| Data management (backup/restore, schema view) | ✅ |

### AGENT Role
| Requirement | Status |
|-------------|--------|
| Personal dashboard with assigned leads only | ✅ |
| 1-tap dialer integration | ✅ |
| Call outcome logging | ✅ |
| Follow-up scheduling | ✅ |
| WhatsApp pitch templates | ✅ |
| Remarks & activity history | ✅ |
| Local notifications | ✅ |
| Full offline autonomy | ✅ |

---

## Data Requirements

| Entity | Storage | Sync | Offline |
|--------|---------|------|---------|
| leads | Dexie + PostgreSQL | Bidirectional | ✅ Full CRUD |
| call_records | Dexie + PostgreSQL | Bidirectional | ✅ Full CRUD |
| activities | Dexie + PostgreSQL | Bidirectional | ✅ Append-only |
| remarks | Dexie + PostgreSQL | Bidirectional | ✅ Full CRUD |
| follow_ups | Dexie + PostgreSQL | Bidirectional | ✅ Full CRUD |
| message_history | Dexie + PostgreSQL | Bidirectional | ✅ Full CRUD |
| users | Dexie + PostgreSQL | Pull-only (cloud auth) | ✅ Read-only |
| message_templates | Dexie + PostgreSQL | Pull-only | ✅ Read-only |
| import_audits | Dexie + PostgreSQL | Bidirectional | Admin only |
| bulk_assignment_audits | Dexie + PostgreSQL | Bidirectional | Admin only |
| outbox | Dexie only | N/A | Local queue |
| sync_state | Dexie only | N/A | Local state |

---

## Synchronization Requirements

| Requirement | Status | Details |
|-------------|--------|---------|
| Push local changes to cloud | ✅ | `syncPush.ts` batches by entity |
| Pull cloud changes to local | ✅ | `syncPull.ts` cursor-based |
| Realtime hints for immediate UI | ✅ | 8 tables in Supabase Realtime |
| Conflict resolution rules | ✅ | 4 rules in `syncConflictResolver.ts` |
| Dead letter queue for failures | ✅ | `DEAD_LETTER` status in outbox |
| Exactly-once semantics | ✅ | Idempotency keys, upsert + delete |

---

## Platform Requirements

| Platform | Requirement | Status |
|----------|-------------|--------|
| Android | Min SDK 24, Target SDK 36 | ✅ |
| Android | Capacitor 8.5 wrapper | ✅ |
| Android | Signed APK (Scheme v2) | ✅ |
| Web | React 19 + Vite | ✅ |
| Web | Vercel deployment | ✅ |
| Backend | Supabase PostgreSQL + RLS | ✅ |
| Backend | Edge Functions (create-agent) | ✅ |

---

## Implementation Status Summary

| Category | Total | Implemented | Partial | Not Implemented |
|----------|-------|-------------|---------|-----------------|
| Lead Management | 6 | 6 | 0 | 0 |
| Assignment | 4 | 4 | 0 | 0 |
| Call Lifecycle | 5 | 5 | 0 | 0 |
| Follow-ups | 3 | 3 | 0 | 0 |
| WhatsApp | 4 | 4 | 0 | 0 |
| Admin/Reporting | 4 | 4 | 0 | 0 |
| Sync/Offline | 5 | 5 | 0 | 0 |
| Backup/Restore | 3 | 3 | 0 | 0 |
| Security | 6 | 6 | 0 | 0 |
| Reliability | 4 | 4 | 0 | 0 |
| **Total** | **44** | **44** | **0** | **0** |

---

## Known Gaps / Future Requirements

| Requirement | Priority | Notes |
|-------------|----------|-------|
| Multi-language support (Hindi/English) | MEDIUM | Currently English only |
| Advanced analytics (funnel, cohort) | LOW | Basic KPIs only |
| Physical device testing | MEDIUM | Currently AVD-only verified |
| Push notifications (FCM) | LOW | Local notifications only |
| Photo attachment for leads | LOW | Not in current scope |