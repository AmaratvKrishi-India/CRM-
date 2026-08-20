# Amaratv Krishi CRM — Phase 2 Architecture & Data Model Specification

## 1. Current Architecture (Phase 1 Baseline)

### Overview
The Phase 1 application is a single-page Android-first field sales CRM built with React 19, TypeScript, Tailwind CSS, Vite, Dexie.js (IndexedDB), and Capacitor 8 native bridge. It operates strictly locally on the Android device without any external server dependency.

```
┌────────────────────────────────────────────────────────┐
│             Android Native Container (Capacitor)       │
│  - App State & Lifecycle (App)                         │
│  - Native Phone Dialer (Intent.ACTION_DIAL)            │
│  - Native Sharing & PDF Delivery (Share)               │
│  - Local Push Reminders (LocalNotifications)           │
├────────────────────────────────────────────────────────┤
│                   React 19 Presentation Layer          │
│  - SalesDashboard, LeadDetailView, MinimalLeadsList    │
│  - CallOutcomeModal, FollowUpModal, WhatsAppModal      │
│  - ExcelImporter (XLSX parsing & deduplication)        │
│  - BackupRestoreModal (JSON Export/Merge/Replace)      │
├────────────────────────────────────────────────────────┤
│                   Service & Domain Logic               │
│  - leadNormalizer, callOutcomeMapping, backupService   │
│  - appSettingsService, nativePlatform, dashboardService│
├────────────────────────────────────────────────────────┤
│                   Local Database Engine                │
│  - Dexie.js (SalesCRMDatabase v2, IndexedDB)           │
│  - Tables: leads, remarks, callHistory, followUps,     │
│    messageHistory, messageTemplates                    │
│  - Hooks: automatic createdAt/updatedAt/isSynced/      │
│    deletedAt management                                │
└────────────────────────────────────────────────────────┘
```

### Current Strengths
- **Instant offline response**: Zero network latency for lead operations.
- **Robust data model**: UUID v4 primary keys, ISO 8601 timestamps, soft deletion (`deletedAt`), and sync dirty flags (`isSynced`) are already pre-baked into all entities.
- **Safe data backup**: Full JSON export and safe merge/replace restore with rollback snapshots.
- **119 automated tests**: Comprehensive unit and integration test suite passing.

---

## 2. Proposed Phase 2 Architecture

### Core Design Principles
1. **Single App / Single APK**: One Android codebase serving both `ADMIN` and `AGENT` roles based on authenticated session context.
2. **Local-First / Offline-First**: Dexie remains the operational database for all UI reads/writes. UI never blocks on network requests.
3. **Cloud as Sync & Auth Hub**: Supabase PostgreSQL and Auth are used strictly for authentication, centralized lead storage, append-only activity logging, and delta synchronisation.
4. **Append-Only Auditing**: State changes, call logs, WhatsApp messages, remarks, and follow-ups are recorded as permanent immutable events.
5. **Deterministic Conflict Resolution**: Controlled LWW (Last-Write-Wins) with server timestamp validation for mutable entity fields, while preserving full activity event streams.

```
                               ┌─────────────────────────────┐
                               │       ONE ANDROID APK       │
                               └──────────────┬──────────────┘
                                              │
                                       LOGIN SCREEN
                               (Email/Login ID + Password)
                                              │
                                       AUTH CONTROLLER
                                              │
                         ┌────────────────────┴────────────────────┐
                         │                                         │
                    ROLE: ADMIN                               ROLE: AGENT
                         │                                         │
                 ┌───────┴────────┐                        ┌───────┴────────┐
                 │ Admin CRM View │                        │ Sales Rep View │
                 │ - Global Leads │                        │ - My Leads     │
                 │ - Team Mgmt    │                        │ - Active Leads │
                 │ - Live Sync    │                        │ - Calling      │
                 │ - Analytics    │                        │ - WhatsApp     │
                 │ - Lead Ops     │                        │ - Follow-ups   │
                 └───────┬────────┘                        └───────┬────────┘
                         │                                         │
                         └────────────────────┬────────────────────┘
                                              │
                                   LOCAL REPOSITORIES
                                              │
                                    DEXIE LOCAL STORAGE
                             (IndexedDB - Primary Data Store)
                                              │
                                     SYNC QUEUE ENGINE
                              (Background Delta Sync Worker)
                                              │
                     ═════════════════ INTERNET BOUNDARY ═════════════════
                                              │
                                   SUPABASE CLOUD BACKEND
                     ┌────────────────────────┼────────────────────────┐
                     │                        │                        │
               SUPABASE AUTH            POSTGRESQL DB           SUPABASE REALTIME
             - Session Tokens        - RLS Security Policies   - Postgres Changes
             - Admin-created users   - Leads, Users, Activities- Activity Feed
```

---

## 3. User Model

### Entity Schema: `User`
```typescript
export type UserRole = 'ADMIN' | 'AGENT';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface User {
  id: string;              // UUID v4 matching auth.users id
  name: string;            // Full representative name (e.g., "Rahul Sharma")
  email: string;           // Login identifier / email (e.g., "rahul@amaratvkrishi.com")
  phone: string;           // Contact phone number
  role: UserRole;          // 'ADMIN' | 'AGENT'
  status: UserStatus;      // 'ACTIVE' | 'INACTIVE'
  createdAt: string;       // ISO 8601 UTC
  createdBy: string | null;// Admin user ID who created this account (null for initial super-admin)
  updatedAt: string;       // ISO 8601 UTC
  lastLoginAt: string | null; // ISO 8601 UTC of last successful authentication
  deviceId?: string | null;// Last known device identifier
}
```

### Registration Rule
- **No Self-Registration / Public Signup**: No public signup endpoint or registration form exists.
- Accounts are provisioned strictly by an `ADMIN` inside the Admin Team Management panel.

---

## 4. Role Model & Access Levels

| Role | Scope & Description |
|---|---|
| **ADMIN** | Executive & supervisory access. Full read/write access to all leads across all territories, full team management (create/deactivate agents, reset credentials), lead assignment/reassignment, full access to team activity feeds, call metrics, and performance analytics. Can also directly execute field sales actions (Call, WhatsApp, Remark, Follow-up). |
| **AGENT** | Field sales representative. Operational access limited to assigned leads and self-created leads (or unassigned pool if enabled). Can execute calls, send WhatsApp messages, record remarks, schedule follow-ups, and update lead pipeline statuses. Cannot view other agents' private statistics, cannot alter roles, cannot create users, and cannot access administrative configurations. |

---

## 5. Permission Matrix

| Capability / Action | ADMIN | AGENT | Enforcement Layer |
|---|:---:|:---:|---|
| Login with credentials | Yes | Yes | Supabase Auth + Local Token |
| Change own password | Yes | Yes | Supabase Auth API |
| Create new Agent account | Yes | No | Backend Edge Function / Supabase RLS |
| Deactivate / Reactivate Agent | Yes | No | Backend Edge Function / Supabase RLS |
| Reset Agent password | Yes | No | Backend Edge Function / Supabase RLS |
| View list of all agents | Yes | No | Database RLS + UI Router |
| View all leads across system | Yes | No | Database RLS + Local Sync Filter |
| View assigned leads | Yes | Yes | Database RLS + Local Query |
| Import leads from Excel | Yes | Yes* | Attributed to `uploadedBy` |
| Assign / Reassign lead | Yes | No | Database RLS + Activity Event |
| Call any accessible lead | Yes | Yes | Local Android Dialer + Activity Log |
| Send WhatsApp to accessible lead | Yes | Yes | Local WhatsApp Launcher + Activity Log |
| Log call outcome & remark | Yes | Yes | Append-only Activity Log + Local DB |
| Schedule & manage follow-ups | Yes | Yes | Follow-up Engine + Local Notifications |
| Change lead pipeline status | Yes | Yes | Lead Repository + Activity Log |
| View team-wide analytics & reports | Yes | No | Database RLS + UI Router |
| View own daily analytics | Yes | Yes | Local Dexie Queries |
| Local Backup & Restore | Yes | Yes (local) | BackupService |
| Central Database Full Export | Yes | No | Supabase Admin / Storage |

*\* Agents can import leads only if assigned to themselves upon import.*

---

## 6. Lead Ownership & Assignment Model

### Schema Extensions for `Lead`
Existing Phase 1 `Lead` fields are preserved with the addition of ownership and assignment tracking:

```typescript
export interface Lead {
  // Existing Phase 1 fields:
  id: string;
  businessName: string;
  category: string;
  phone: string;
  phoneRaw: string;
  phoneE164: string;
  phoneType: PhoneType;
  alternatePhone: string | null;
  contactPerson: string | null;
  address: string;
  locality: string;
  pincode: string;
  city: string;
  state: string;
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
  source: string;
  sourceFile: string | null;
  sourceRow: number | null;
  status: LeadStatus;
  customNotes: string;
  lastContactedAt: string | null;
  nextFollowUpAt: string | null;
  callCount: number;
  createdAt: string;
  updatedAt: string;
  isSynced: number;
  syncedAt: string | null;
  deletedAt: string | null;

  // New Phase 2 Ownership Fields:
  createdBy: string;           // User ID who created/imported the lead
  assignedTo: string | null;   // User ID of currently assigned Agent (or null if unassigned)
  assignedAt: string | null;   // ISO 8601 UTC when last assigned
  assignedBy: string | null;   // Admin User ID who performed the assignment
  updatedBy: string;           // User ID who made the most recent update
  version: number;             // Monotonic optimistic concurrency counter (default: 1)
}
```

### Assignment Rules
1. **Preservation of History**: When an Admin reassigns a lead from Agent A to Agent B, the lead record updates `assignedTo = Agent B`, but an immutable `LEAD_REASSIGNED` activity is logged:
   - `previousAssignedTo: Agent A`
   - `newAssignedTo: Agent B`
   - `assignedBy: Admin User`
   - `timestamp: ISO 8601`
2. **Historical Performance Retained**: All past calls, remarks, and messages made by Agent A remain permanently attributed to Agent A in reporting dashboards.

---

## 7. Activity / Event Model (Append-Only)

All meaningful actions in the system generate an immutable activity log entry.

### Entity Schema: `Activity`
```typescript
export type ActivityType =
  | 'LEAD_CREATED'
  | 'LEAD_IMPORTED'
  | 'LEAD_ASSIGNED'
  | 'LEAD_REASSIGNED'
  | 'CALL_STARTED'
  | 'CALL_COMPLETED'
  | 'CALL_OUTCOME_LOGGED'
  | 'REMARK_ADDED'
  | 'WHATSAPP_INITIATED'
  | 'WHATSAPP_FAILED'
  | 'FOLLOW_UP_CREATED'
  | 'FOLLOW_UP_COMPLETED'
  | 'FOLLOW_UP_CANCELLED'
  | 'FOLLOW_UP_RESCHEDULED'
  | 'STATUS_CHANGED'
  | 'LEAD_UPDATED';

export interface Activity {
  id: string;              // UUID v4 Primary Key
  leadId: string;          // Foreign Key -> Lead.id
  userId: string;          // Foreign Key -> User.id (actor)
  userName: string;        // Snapshot of user name at action time
  userRole: UserRole;      // Snapshot of role ('ADMIN' | 'AGENT')
  activityType: ActivityType;
  metadata: Record<string, any>; // Contextual payload (e.g. duration, old/new status, outcome)
  createdAt: string;       // ISO 8601 UTC
  deviceId: string | null; // Originating device identifier
  isSynced: number;        // 0 = pending sync, 1 = synced
  syncedAt: string | null; // ISO 8601 UTC
}
```

---

## 8. Call Tracking Model & Duration Architecture

### The Call Duration Reality Check
- **Current App Behavior**: Opens Android dialer via `tel:` URL scheme (`Intent.ACTION_DIAL`).
- **Limitation**: The difference between launching the dialer and returning to the CRM (`appStateChange`) represents **time spent outside the app**, NOT actual talk duration (a rep could be dialing, waiting for answer, or checking other apps).
- **Rule**: Never label time-outside-app as "verified talk duration".

### Phase 2 Call Record Schema: `CallRecord`
```typescript
export type CallVerificationStatus = 'VERIFIED_SYSTEM' | 'USER_REPORTED' | 'ESTIMATED_APP_RETURN';

export interface CallRecord {
  id: string;              // UUID v4 Primary Key
  leadId: string;          // Foreign Key -> Lead.id
  userId: string;          // Foreign Key -> User.id (rep who called)
  calledNumber: string;    // Sanitized dialed number
  phoneType: PhoneType;    // 'mobile' | 'landline'
  startedAt: string;       // ISO 8601 UTC dial initiation timestamp
  answeredAt: string | null;// ISO 8601 UTC (if detected by native layer)
  endedAt: string | null;  // ISO 8601 UTC call conclusion timestamp
  durationSeconds: number; // Duration in seconds (default: 0)
  verificationStatus: CallVerificationStatus;
  outcome: CallOutcome;    // 'CONNECTED' | 'BUSY' | 'NO_ANSWER' | ...
  notes: string | null;    // Sales rep note
  quickRemark: string | null; // Standardized sales tag
  deviceId: string | null;
  createdAt: string;
  updatedAt: string;
  isSynced: number;
  syncedAt: string | null;
  deletedAt: string | null;
}
```

### Verification Roadmap for Milestone 8
1. **Phase 2A-2G Baseline**: Retain existing `CallOutcomeModal` with user confirmation of outcome. Record `startedAt` and returned timestamp, storing calculated elapsed time as `verificationStatus: 'ESTIMATED_APP_RETURN'` while explicitly allowing reps to confirm/adjust call notes.
2. **Phase 2H Dedicated Milestone**: Investigate Android native plugin mechanisms (e.g., Android `PhoneStateListener` / `TelephonyCallback` or custom Capacitor plugin) to read actual call duration within distribution guidelines.

---

## 9. Import Audit Model

### Entity Schema: `ImportAudit`
```typescript
export interface ImportAudit {
  id: string;              // UUID v4 Primary Key
  uploadedBy: string;      // User ID who imported the file
  uploaderName: string;    // Snapshot of user name
  filename: string;        // e.g., "Lucknow-Gyms-Batch2.xlsx"
  source: string;          // Tag or label
  startedAt: string;       // ISO 8601 UTC
  completedAt: string;     // ISO 8601 UTC
  totalRows: number;       // Raw row count in spreadsheet
  importedCount: number;   // New leads successfully added
  updatedCount: number;    // Existing leads updated
  duplicateCount: number;  // Duplicate phone/business records detected
  invalidCount: number;    // Malformed rows rejected
  deviceId: string | null;
  createdAt: string;
  isSynced: number;
  syncedAt: string | null;
}
```

---

## 10. Sync Engine Model (Dexie ↔ Supabase)

### Synchronisation Architecture
The Sync Engine uses a transactional, bidirectional delta-sync protocol.

```
┌───────────────────────────────────────────────────────────┐
│                      LOCAL DEVICE                         │
│                                                           │
│  [Local Dexie Changes (isSynced == 0)]                    │
│            │                                              │
│            ▼                                              │
│     [Sync Queue Worker]                                   │
│            │ (POST changes with deviceId & lastSyncTime)  │
│            ▼                                              │
├────────────┼──────────────────────────────────────────────┤
│            │ INTERNET                                     │
│            ▼                                              │
│  [Supabase Edge Sync Endpoint / Postgres Functions]       │
│            │                                              │
│            ├─ 1. Ingest append-only activities & calls    │
│            ├─ 2. Ingest mutable leads (LWW with version)  │
│            ├─ 3. Fetch server changes since lastSyncTime  │
│            │                                              │
│            ▼                                              │
│  [Response: Server timestamp + Inbound delta payload]     │
│            │                                              │
├────────────┼──────────────────────────────────────────────┤
│            │ INTERNET                                     │
│            ▼                                              │
│     [Local Sync Worker]                                   │
│            │                                              │
│            ├─ Apply inbound remote changes to Dexie       │
│            └─ Mark uploaded local records as isSynced = 1 │
│                                                           │
│                      LOCAL DEVICE                         │
└───────────────────────────────────────────────────────────┘
```

### Sync State Machine
```
[DIRTY LOCAL RECORD] ──> isSynced = 0
         │
    (Sync Starts)
         │
         ▼
[SYNCING BATCH] ───────> Queued in transaction
         │
   ┌─────┴──────────────┐
   │                    │
(Success)            (Network Error)
   │                    │
   ▼                    ▼
[SYNCED]            [RETRY QUEUE]
isSynced = 1        Exponential backoff (3s, 10s, 30s, 60s)
syncedAt = now()    isSynced remains 0
```

---

## 11. Conflict Resolution Strategy

### Deterministic Conflict Matrix

| Entity Category | Strategy | Mechanism | Rationale |
|---|---|---|---|
| **Activities / Logs** (`Activity`, `CallRecord`, `MessageHistory`, `Remark`) | **Append-Only / Union** | Every record has a unique UUID. Sync simply inserts new items. Nothing is overwritten or deleted. | Complete audit trail; no sales effort is erased. |
| **Follow-Ups** (`FollowUp`) | **Union with State Sync** | New follow-ups are appended. Status changes (`COMPLETED`, `CANCELLED`) resolve via Last-Write-Wins based on `updatedAt`. | Prevents missed meetings or conflicting dates. |
| **Leads** (`Lead`) | **Field-Level LWW + Version Check** | Monotonic `version` counter and `updatedAt` comparison. If remote `version` > local, apply remote, but preserve local pending activities. | Guarantees convergence across offline edits without discarding work history. |
| **Message Templates** (`MessageTemplate`) | **Admin Authoritative** | Templates modified by Admin supersede local defaults. | Standardizes product pitch messaging across team. |

---

## 12. Local vs. Central Data Matrix

| Data Item | Local Dexie | Central Supabase | Notes |
|---|:---:|:---:|---|
| User Credentials / Passwords | ❌ None (only active JWT) | ✅ Supabase Auth | Passwords never stored in plain text or local DB |
| Active User Profile / Role | ✅ Cached in memory/storage | ✅ `users` table | Used for instant UI role-switching |
| Leads Cache | ✅ Full (or assigned subset) | ✅ Master table | Rep can search & call completely offline |
| Call & Message History | ✅ Full local history | ✅ Master table | Rep views past touchpoints without network |
| Remarks & Notes | ✅ Full local history | ✅ Master table | Instant access during active sales calls |
| Follow-Ups & Reminders | ✅ Full + Local Notifications | ✅ Master table | Fires notifications even when offline |
| Message Templates & Catalogue | ✅ Full local store | ✅ Master table | Instant WhatsApp templating |
| Un-synced Activity Queue | ✅ `isSynced: 0` collection | ❌ (Arrives on sync) | Queued until internet reconnects |
| Team-wide Analytics & KPIs | ❌ (Queried on demand) | ✅ Materialized views | Admin reports aggregated in cloud |

---

## 13. Authentication Architecture

### Secure Authentication Flow
1. **Screen**: Minimalist Login UI (`Email / Login ID` + `Password` + `Sign In` button). No public registration links.
2. **Authentication Service**: Supabase Auth handles credential verification (`signInWithPassword`).
3. **Session Persistence**: Secure JWT session stored in Capacitor secure storage / localStorage for offline session renewal.
4. **Role Extraction**: Upon login, the user's role (`ADMIN` or `AGENT`) and account status (`ACTIVE` or `INACTIVE`) are verified.
5. **Inactive Interception**: If an Admin deactivates an Agent (`status: 'INACTIVE'`), the session is immediately invalidated upon the next sync attempt, locking out the agent.

---

## 14. Security Architecture

### Multi-Layer Security Model

```
Layer 1: Mobile UI Layer
- Role-based conditional rendering (Admin routes hidden from Agents).
- Prevent UI access to user management, team reassignments, and executive KPIs.

Layer 2: Local Application Layer
- Route guards and permission checks before executing repository actions.
- Scoped Dexie queries ensuring agents view their designated leads.

Layer 3: Network & API Layer
- Bearer JWT tokens attached to all Supabase requests.
- No client-side service-role keys; only public anon key with strict RLS.

Layer 4: Database RLS (Row Level Security) Layer (PostgreSQL)
- `users`: Only ADMIN can create/update. Agents can only read own profile.
- `leads`: ADMIN has full SELECT/INSERT/UPDATE/DELETE. AGENT has SELECT/UPDATE on leads WHERE `assignedTo = auth.uid()` OR `createdBy = auth.uid()`.
- `activities` & `call_records`: INSERT allowed for authenticated users for own activities; SELECT for ADMIN (all) and AGENT (own leads).
```

---

## 15. Database Migration Strategy (Dexie v2 → v3)

### Safe Local Schema Upgrade
When Phase 2 data model is introduced in Milestone 2/3, Dexie database will upgrade from Version 2 to Version 3 cleanly without data loss:

```typescript
// Proposed Dexie Version 3 definition (to be implemented in Milestone 2/3):
this.version(3)
  .stores({
    leads: 'id, phone, businessName, category, locality, pincode, status, createdBy, assignedTo, isSynced, deletedAt, nextFollowUpAt, lastContactedAt, createdAt, updatedAt, [status+deletedAt], [assignedTo+deletedAt], [locality+deletedAt], [isSynced+deletedAt]',
    users: 'id, email, role, status, isSynced, deletedAt',
    activities: 'id, leadId, userId, activityType, createdAt, isSynced',
    callRecords: 'id, leadId, userId, outcome, startedAt, isSynced, deletedAt, [leadId+deletedAt]',
    importAudits: 'id, uploadedBy, createdAt, isSynced',
    remarks: 'id, leadId, type, author, createdAt, isSynced, deletedAt, [leadId+deletedAt]',
    followUps: 'id, leadId, scheduledAt, status, priority, isSynced, deletedAt, [status+scheduledAt], [leadId+deletedAt]',
    messageHistory: 'id, leadId, channel, sentStatus, sentAt, isSynced, deletedAt, [leadId+deletedAt]',
    messageTemplates: 'id, category, isDefault, isSynced, deletedAt, [category+deletedAt]',
  })
  .upgrade(async (trans) => {
    // Populate default createdBy/assignedTo for existing Phase 1 records
    const leadsTable = trans.table('leads');
    await leadsTable.toCollection().modify((lead) => {
      if (!lead.createdBy) lead.createdBy = 'legacy_phase1_user';
      if (lead.assignedTo === undefined) lead.assignedTo = null;
      if (lead.version === undefined) lead.version = 1;
      if (!lead.updatedBy) lead.updatedBy = lead.createdBy;
    });
  });
```

---

## 16. Offline Operation Strategy

1. **Zero Cloud Latency for Reps**: An agent standing in a gym lobby in Lucknow with poor cellular reception can:
   - Search gym leads by name or locality.
   - Tap Call or WhatsApp.
   - Log call outcomes and add remarks.
   - Schedule follow-ups.
2. **Queued Sync**: All local actions are committed to Dexie immediately with `isSynced = 0`.
3. **Background Sync Worker**: When network connectivity is detected (via `navigator.onLine` and Capacitor Network plugin), the Sync Queue flushes all pending records to Supabase in batches.

---

## 17. Real-Time Strategy

1. **Supabase Realtime (WebSockets)**:
   - Admin CRM subscribes to `postgres_changes` on `activities` and `call_records` tables.
   - As reps complete calls in Lucknow, real-time activity toasts and live ticker updates appear on the Admin Dashboard.
2. **Graceful Fallback**: If WebSocket disconnects, the sync engine uses periodic polling (every 30–60 seconds) when active.

---

## 18. Backup & Coexistence Strategy

1. **Local JSON Backup (Preserved)**:
   - The existing `BackupService` will continue to function seamlessly.
   - Schema version in backup payloads will be bumped to `schemaVersion: 3` with backward compatibility for importing `schemaVersion: 2` files.
2. **Central Cloud Backup**:
   - Supabase PostgreSQL automated daily backups.
   - Admin-exclusive CRM data export (CSV/Excel/JSON) directly from the Admin panel.

---

## 19. Cost & Infrastructure Strategy

- **Zero Added Cost Architecture**:
  - **Supabase Free Tier**:
    - Up to 50,000 monthly active users (we have < 20 reps/admins).
    - 500 MB database storage (~500,000 leads and activity records).
    - 2 GB bandwidth/month (delta sync consumes < 50 MB/month).
    - 500 concurrent real-time connections.
  - No dedicated VPS, no monthly cloud server costs, no third-party SMS gateway fees.

---

## 20. Phase 2 Implementation Sequence

| Milestone | Code | Deliverable |
|:---:|:---:|---|
| **1** | **Phase 2A** | **Architecture & Data Model Specification (Current Step)** |
| **2** | **Phase 2B** | User & Role Data Model (Dexie v3 schema, entity types, migration) |
| **3** | **Phase 2C** | Authentication & Session Management (Login UI, Supabase Auth client, session store) |
| **4** | **Phase 2D** | Admin Agent Management (Create, activate, deactivate, reset passwords) |
| **5** | **Phase 2E** | Roles & Access Control Matrix (Role guard, navigation splitting, permission checks) |
| **6** | **Phase 2F** | Central Cloud Data Schema (Supabase SQL migrations, RLS policies, indexes) |
| **7** | **Phase 2G** | Offline Sync Engine (Delta sync worker, retry queue, conflict resolution) |
| **8** | **Phase 2H** | Shared Lead Operations & Lead Ownership (Assignment, multi-agent lead ops) |
| **9** | **Phase 2I** | Call Duration & Advanced Call Tracking (Call state inspection, verified duration) |
| **10** | **Phase 2J** | Real-Time Sync & Live Activity Feeds (Supabase Realtime subscriptions) |
| **11** | **Phase 2K** | Admin CRM Dashboard & Lead Monitoring (KPI cards, pipeline views, lead audits) |
| **12** | **Phase 2L** | Team Performance Analytics & Reports (Agent leaderboards, call reports) |
| **13** | **Phase 2M** | Security Hardening & Full Production QA (E2E testing, APK build verification) |

---

## 21. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Call Duration Inaccuracy** | High | Never disguise time outside app as verified talk duration. Clearly tag duration records with `verificationStatus` and refine in Phase 2I. |
| **Offline Conflicting Lead Updates** | Medium | Immutable append-only activity history ensures no sales actions are lost. Lead metadata uses version-checked LWW. |
| **Accidental Agent Privilege Escalation** | High | Enforce permissions both at the UI route level and strictly via PostgreSQL Row Level Security (RLS). |
| **Data Loss During Dexie Migration** | High | Automated schema migration script in Dexie v3 upgrade hook tested against existing test datasets. |
| **Supabase Free Tier Inactivity Pause** | Low | Implement keep-alive heartbeat or document unpause procedure for production administration. |

---

## 22. Open Questions for Phase 2 Execution

1. **Initial Super-Admin Provisioning**: Will the initial Super-Admin account be created via Supabase dashboard / seed script during Phase 2C? *(Recommended: Seed script / env configuration)*.
2. **Lead Assignment Visibility Policy**: When an agent logs in, should they see *only* their assigned leads, or all leads with a filter for "My Leads"? *(Recommended: Default to "My Leads" with ability for Admin to toggle team-wide visibility)*.

---

## 23. Acceptance Criteria for Phase 2A Completion

- [x] Full inspection of existing Phase 1 codebase, database schema, and test suite completed.
- [x] All 119 existing automated tests passing without regression.
- [x] Production TypeScript build passing cleanly without errors.
- [x] Single APK / Single App role-based architecture established.
- [x] Complete data models defined for Users, Roles, Leads, Activities, Calls, Imports, and Sync.
- [x] Detailed `PHASE_2_ARCHITECTURE.md` and `PHASE_2_STATUS.md` documents created.
- [x] No unauthorized Phase 2 implementation code committed prematurely.
