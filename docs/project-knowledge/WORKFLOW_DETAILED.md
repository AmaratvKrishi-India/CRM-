# AMARATV KRISHI FIELD SALES CRM — EXHAUSTIVE WORKFLOW REFERENCE

> Scope: every user-visible action in the app, traced end-to-end through UI component →
> service function → Dexie (IndexedDB) write → sync outbox entry → Supabase push/pull →
> realtime broadcast → receiving device. Includes verbatim error strings, exact function
> names, DB tables touched, outbox operations, activity-log types, and the RLS policies
> that enforce each rule at the database layer.
>
> Verified against source on 2026-08-24. If code and this document disagree, the code wins.

---

## 0. SYSTEM ARCHITECTURE

### 0.1 Technology stack

| Layer | Technology |
|---|---|
| UI | React 18 + TypeScript + Vite, Tailwind CSS, lucide-react icons |
| Mobile shell | Capacitor (Android APK), plugins: App, Share, LocalNotifications |
| Local database | Dexie (IndexedDB), schema version 5, defined in `src/db/database.ts` |
| Cloud authority | Supabase: PostgreSQL + Row Level Security + Realtime + Edge Functions |
| Auth | Supabase Auth (email/password), session persisted under localStorage key `amaratv_crm_supabase_auth_session` |
| Sync | Custom outbox-based engine (`src/services/sync/*`), push-then-pull, last-write-wins conflicts |

### 0.2 Roles

- **ADMIN** — organization administrator. Full visibility over all leads, agents, reports,
  imports, data governance, backup/restore. Provisioning authority for agent accounts.
- **AGENT** — field sales representative. Sees only leads assigned to them (or created by
  them), their own calls/remarks/follow-ups/messages, plus org-level read of leads they can work.

Roles are stored in the `profiles` table (`role` column, CHECK `'ADMIN' | 'AGENT'`) and are
immutable at the DB layer (trigger `protect_profile_immutable_fields`, see §7.3).

### 0.3 The local-first write path (universal)

Every mutation in the app follows the same pipeline:

1. UI handler calls a service/repository function.
2. The function validates input (throws the verbatim error strings listed per action below).
3. A Dexie **transaction** writes the business table(s) AND inserts a row into the `outbox`
   table (`entityType`, `entityId`, `operation` CREATE/UPDATE/DELETE, `payload`, status `PENDING`,
   `deviceId` from `DeviceService.getDeviceId()`).
4. The transaction commits — the user sees success immediately, even fully offline.
5. `SyncEngine` (triggered by 60s interval, network events, visibility change, or manual
   "Sync Now") pushes outbox rows to Supabase via `upsert(onConflict: 'id')` batches, then
   pulls remote changes since the last cursor.
6. Supabase Realtime broadcasts the change to every other device in the organization.

### 0.4 Local tables (Dexie v5)

| Table | Synced to cloud? | Notes |
|---|---|---|
| `users` (profiles) | yes (`profiles`) | both admins and agents |
| `leads` | yes | core CRM entity |
| `callRecords` | yes (`call_records`) | verified/unverified call logs |
| `activities` | yes | append-only audit stream |
| `remarks` | yes | sales notes per lead |
| `followUps` | yes (`follow_ups`) | scheduled callbacks/visits |
| `messageHistory` | yes (`message_history`) | WhatsApp logs |
| `importAudits` | yes (`import_audits`) | Excel import batches |
| `bulkAssignmentAudits` | yes (`bulk_assignment_audits`) | bulk assignment runs |
| `templates` (messageTemplates) | **NO — local only** | WhatsApp pitch templates never leave the device |
| `outbox` | no (it IS the sync queue) | |
| `syncState` | no | single row id `'current'` |

Sync entity types (9): `leads`, `call_records`, `activities`, `remarks`, `follow_ups`,
`message_history`, `import_audits`, `profiles`, `bulk_assignment_audits`.

### 0.5 Device-local storage keys (localStorage)

| Key | Purpose |
|---|---|
| `amaratv_crm_supabase_auth_session` | Supabase auth session |
| `amaratv_crm_device_id` | UUID v4 per device install (`DeviceService`, no hardware IDs) |
| `amaratv_crm_theme_v1` | `'DAY'` or `'NIGHT'` (default `NIGHT`) |
| `amaratv_crm_app_settings_v1` | WhatsApp preview toggle + default catalogue meta (file body stored as base64) |
| `amaratv_backup_audit_history` | last 20 backup/restore audit entries |
| `amaratv_pending_dial_attempt` | in-flight phone call attempt (`CallLifecycleService`) |

---

## 1. APP BOOT & AUTHENTICATION

### 1.1 Cold boot sequence

Entry: `src/main.tsx` → `src/App.tsx`.

1. `ThemeProvider` loads theme from `amaratv_crm_theme_v1` (default `NIGHT`), applies
   `data-theme` attribute + `color-scheme` on `<html>`. Does NOT follow the Android system theme.
2. `ToastProvider` mounts the aria-live toast region (max 3 visible, default auto-dismiss 6000ms).
3. `ErrorBoundary` wraps the tree; on render crash it shows
   `'The application encountered an unexpected error. Your offline data is safe.'` with a reset action.
4. `AuthContext.initAuth()` runs:
   1. Checks Supabase configuration — if env vars are missing, `supabaseClient` throws
      `'Supabase URL or Anon Key is missing in environment configuration.'` or
      `'Invalid Supabase URL format in VITE_SUPABASE_URL.'` at construction.
   2. Calls `supabase.auth.getSession()`. If a session exists → `authService.resolveUserProfile(session.user)`:
      1. Look up local `users` table by Supabase user **id**.
      2. Else by **email** (case-insensitive).
      3. Else **remote bootstrap**: fetch the `profiles` row from Supabase and `putUser()` it
         locally (NO outbox entry — cloud is the source of truth for profiles).
      4. If still no profile → sign out; login screen shows.
   3. Sets `currentUser` in React state; `recordLogin()` updates `lastLoginAt` on the local profile.
5. `MainAppRouter` decides the root view:
   - `currentUser.role === 'ADMIN'` → `AdminShell` (unless `adminSalesMode` toggle is on, which
     renders the agent UI under a purple banner `'Field Sales Rep Mode (Admin Preview)'`).
   - `currentUser.role === 'AGENT'` → agent UI (`SalesDashboard` as home).
6. `RealtimeService.setSyncEngine(syncEngine)` then `RealtimeService.init(currentUser)` — only if
   `user.status === 'ACTIVE'`. Channel name: `org_${orgId}_${role.toLowerCase()}_${userId.substring(0,8)}`
   (orgId fallback `'default'`). Subscribes to 8 tables
   (`leads, call_records, activities, remarks, follow_ups, message_history, profiles, import_audits`),
   event `'*'`, filter `organization_id=eq.${orgId}`.
7. `BackgroundSyncManager.init(currentUser)` (started during signIn, §1.2 step 5): immediate
   silent sync + 60s interval + event listeners.
8. App.tsx registers Capacitor `appStateChange` listener: on **foreground**, calls
   `CallLifecycleService.handleAppStateChange()`; if a pending dial attempt exists
   (`amaratv_pending_dial_attempt`), reopens `CallOutcomeModal` for that lead.
9. App.tsx registers the Android hardware **back button** handler with this priority chain:
   1. Settings modal open → close it
   2. Backup modal open → close it
   3. WhatsApp compose modal open → close it
   4. Call outcome modal open → **cancel the call attempt** (`CallLifecycleService.cancelCall()`) and close
   5. DETAIL view → back to LEADS
   6. LEADS view → back to DASHBOARD
   7. IMPORT / FOLLOW_UPS views → back to DASHBOARD
   8. DASHBOARD → `minimizeApp()` (does not exit)
10. Follow-up badge counter refreshes every 15 seconds via `crmData.leads.getLeadStats()`.

### 1.2 ACTION: Login (LoginScreen)

Component: `src/components/auth/LoginScreen.tsx` → `authService.signIn(email, password)`.

Preconditions shown on screen:
- If Supabase is not configured, the submit button is disabled and a notice
  `'Authentication Setup Required'` is displayed.
- Screen has a DAY/NIGHT theme toggle (persisted) and footer
  `'Amaratv Krishi CRM v2.0 • Offline-First Sales Engine'`.

Steps:
1. Client-side guard: empty fields → `'Please enter both email and password.'` (no network call).
2. `supabase.auth.signInWithPassword({ email, password })`.
3. Failure mapping:
   - Wrong credentials → `'Invalid email or password.'`
   - Network failure → `'Network error. Please check your internet connection and try again.'`
   - Any other auth error → `'Authentication failed: No active session received.'`
4. On success, `resolveUserProfile()` runs (§1.1 step 4.2). Then local profile checks:
   - Profile missing locally AND remotely → `'Your account has not been provisioned by an administrator.'`
   - `profile.status === 'INACTIVE'` → `'Your account is inactive. Please contact your administrator.'`
5. `recordLogin()` stamps `lastLoginAt` (local update + outbox UPDATE on `profiles`).
6. `AuthContext.signIn` starts `BackgroundSyncManager.init(user)`:
   - immediate silent `syncEngine.synchronizeNow()`
   - 60s auto-sync interval (`AUTO_SYNC_INTERVAL_MS = 60000`)
   - listeners: `visibilitychange`, `focus`, `online`, Capacitor foreground → each triggers sync
   - failure backoff: exponential 1s → 2s → 4s … capped 32s (`BACKOFF_BASE_MS=1000`,
     `BACKOFF_MAX_MS=32000`), max 6 attempts (`MAX_RETRY_ATTEMPTS`); success or an `online` event resets backoff.
7. Router mounts the role shell; Realtime subscribes (§1.1 step 6).

DB/outbox effects of a successful login: `profiles.lastLoginAt` updated locally; one outbox row
(`entityType: 'profiles'`, `operation: 'UPDATE'`).

### 1.3 ACTION: Sign out

Triggered from Settings modal → Preferences tab → `Sign Out` button (closes the modal first).

Steps (`AuthContext.signOut`):
1. `BackgroundSyncManager.stop()` — removes the interval + all listeners FIRST (no orphaned sync loops).
2. `RealtimeService` channel unsubscribes.
3. `supabase.auth.signOut()` clears the session key `amaratv_crm_supabase_auth_session`.
4. **Local CRM data is NOT touched** — all leads/calls/remarks remain in IndexedDB.
   The Settings modal states this explicitly: "Logging out clears the authenticated session but
   does not delete local CRM records."
5. Router returns to `LoginScreen`.

### 1.4 Sync status badge (all screens)

Component: `src/components/sync/SyncStatusBadge.tsx` (uses `useSync()` hook over `syncEngine`).
Read-only pill + optional manual Sync Now button. States:

| Engine status | Badge label |
|---|---|
| `SYNCING` | `Syncing…` |
| `SYNCED` | `Synced` |
| `OFFLINE` | `Offline — saved locally` |
| `PENDING` | `Sync queued…` |
| `AUTH_REQUIRED` | `Sign in to enable sync` |
| `ERROR` | `Sync issue — retrying` |

Tooltip shows `Last synced: <time>` or `Error: <lastSyncError>` or `'Waiting for first sync'`.
Manual Sync Now button calls `syncEngine.synchronizeNow()` (full flow in §6.2).

---

## 2. ADMIN WORKFLOWS

### 2.0 Admin shell navigation

Component: `src/components/admin/AdminShell.tsx`. Bottom tablist, 6 tabs
(roving-tabindex keyboard nav: ArrowLeft/Right/Home/End):

| Tab id | Label | Content component |
|---|---|---|
| `HOME` | Overview | `AdminDashboardView` |
| `LEADS` | Leads | `AdminLeadsView` |
| `AGENTS` | Agents | `AdminAgentsView` |
| `DATA` | Data | `AdminDataManagementView` |
| `REPORTS` | Reports | `AdminReportsView` |
| `SETTINGS` | Settings | `SettingsModal` (opened as modal) |

### 2.1 Overview tab (AdminDashboardView)

Data load: `Promise.all` of three `AdminAnalyticsService` calls, all guarded by
`assertAdmin()` which throws
`'Unauthorized: Only active administrators can access organization analytics.'`
if the caller is missing, not ADMIN, or not ACTIVE:

1. `getOrganisationKPIs(currentUser, dateRange, selectedAgentId)` — total leads, calls,
   **verified talk time** (sums `durationSeconds` of VERIFIED calls only; average rounded).
2. `getLeadPipelineSummary(...)` — counts + percentages across the 8 pipeline stages.
3. `getAgentPerformanceList(currentUser, dateRange)` — per-agent scorecards
   (`leadsWorked` = assigned leads with ≥1 call or follow-up).

Controls:
- Date range selector: `ALL_TIME / TODAY / YESTERDAY / LAST_7_DAYS / LAST_30_DAYS`.
- Agent filter (ALL or one agent).
- "Call History" button opens `AdminCallHistoryModal` (§2.1.1).
- Sections rendered: KPI grid, pipeline summary, `AgentPerformanceTable`, `LiveActivityFeed limit={30}`.

Load failure → inline error state:
`'Could not load dashboard analytics. Check your connection and try again.'` with Retry.

#### 2.1.1 ACTION: Open Organization Call History (AdminCallHistoryModal)

1. Loads agent list from local `users` where `role === 'AGENT' && deletedAt === null`.
2. `AdminAnalyticsService.getAllCallRecords(currentUser, params)` with
   `params = { agentId?, verificationStatus, outcome?, dateRange, limit: 200 }`.
   - Result rows join lead/agent names; fallbacks `leadName = 'UnknownLead'`, `agentName = 'Sales Rep'`.
3. Filters available: Agent, Verification (`ALL/VERIFIED/UNVERIFIED`), Outcome
   (`CONNECTED/BUSY/NO_ANSWER/WRONG_NUMBER/CALL_BACK`), Date range, plus free-text search
   over lead name / agent name / remark (client-side).
4. Duration display rule: VERIFIED with duration>0 → `Xm Ys`; else if `reportedDurationSeconds`
   present → `Reported Xm Ys`; else `'Duration unavailable'`. Badge shows Verified/Unverified.
5. Load failure → `'Could not load call history. Check your connection and try again.'` + Retry button.

#### 2.1.2 LiveActivityFeed (realtime ticker)

- Initial load: local `activities` where `deletedAt === null`, newest first, sliced to `limit` (30 on dashboard, 50 standalone).
- Subscribes to `RealtimeService.onStatusChange` → connection badge:
  `SUBSCRIBED` → green "Live"; `SUBSCRIBING/RECONNECTING` → "Connecting"; else "Offline".
- Subscribes to `RealtimeService.onActivity` → incoming activity inserted at top if its `id`
  is not already present (dedupe), increments "+N new" counter.
- Filter tabs: `ALL / CALLS / ASSIGNMENTS / FOLLOW_UPS / LEADS` (prefix matching on activityType).
- Rendered descriptions per type (from `metadata`): CALL_COMPLETED (verified vs reported duration),
  LEAD_ASSIGNED, LEAD_REASSIGNED (from → to), LEAD_UNASSIGNED, LEAD_CREATED, LEAD_IMPORTED,
  FOLLOW_UP_CREATED, REMARK_ADDED.
- Manual refresh button re-runs the local load.

#### 2.1.3 ACTION: Open agent performance detail (AgentPerformanceDetail modal)

From `AgentPerformanceTable` row click (`onSelectAgent(agentId)`):
1. `AdminAnalyticsService.getAgentPerformanceDetail(currentUser, agentId, dateRange)`.
   - Unknown agent → throws `` `Agent with ID "${agentId}" not found.` ``
   - Returns `{ summary, recentActivities (latest 50), assignedLeads }`.
2. Scorecard shows: total calls (verified/unverified split), verified talk time + average,
   leads assigned vs worked, follow-ups (total/completed/overdue), WhatsApp initiated, last login.
3. Buttons:
   - `Call Agent (<phone>)` → `NativePlatformService.openDialer(phone)` (`tel:` ACTION_DIAL).
   - `View Assigned Leads (N)` → closes modal, navigates to Leads tab filtered by that agent.

### 2.2 Leads tab (AdminLeadsView)

Header stats from `LeadAssignmentService.getAssignmentStats(currentUser)`:
total / assigned / unassigned counts.

List: `MinimalLeadsList` — page size 150, search debounce 250ms, ADMIN sees all org leads
(AGENT would see only `assignedTo === self`). Load failure →
`'Could not load leads from the local database.'`

Row/card actions available to admin: open detail, assign, edit, delete (details below),
plus header actions: **Bulk Assign** and **New Lead**.

#### 2.2.1 ACTION: Create lead manually (CreateLeadModal)

1. Client validation:
   - Empty business name → `'Business / gym name is required.'`
   - Empty phone → `'Phone number is required.'`
2. `leadRepository.createLead(input, userId)`:
   1. `leadNormalizer.normalizePhone(rawPhone)` — 6 cases:
      - 10-digit starting 6-9 → mobile, E.164 `+91<digits>`
      - 12-digit `91` + mobile → mobile
      - 11-digit `0` + mobile → mobile
      - 12-digit `91522…` → landline (0522 Lucknow)
      - 11-digit `0522…` → landline
      - 7-8 digit starting 2-4 → landline
      - 7-8 digit starting 6-9 → **invalid** (throws)
   2. Duplicate check on normalized phone →
      `'Duplicate lead: A lead with phone number <phone> already exists (<BusinessName>).`
   3. PIN extraction regex `\b(226\d{3})\b` from address; locality matched against 32 known
      Lucknow localities; defaults `city = 'Lucknow'`.
   4. Fields set: `status = 'NEW'`, `createdBy = assignedTo = updatedBy = userId`,
      `source = 'Admin Manual Entry'` (admin) or `` `Field Entry (${agentName})` `` (agent).
   5. Transaction: insert lead + outbox CREATE (`leads`) + activity `LEAD_CREATED`.
3. Modal only offers 5 statuses on create: NEW / CONTACTED / INTERESTED / SAMPLE_REQUESTED / CUSTOMER.
4. Failure fallback toast: `'Failed to create lead. Please check details.'`

Realtime effect: other devices receive the `leads` INSERT + `activities` INSERT; agents do not
get a notification (no assignee yet).

#### 2.2.2 ACTION: Edit lead (EditLeadModal)

1. Validation:
   - `'Business / gym name is required.'`
   - `'Phone number is required.'`
   - `'PIN code must be exactly 6 digits.'` (if PIN provided)
2. `leadRepository.updateLead(id, patch, userId)`:
   - Missing lead → `'Lead with id <id> not found.'`
   - Phone re-normalized; if another live lead owns that phone →
     `'Another lead with phone number <phone> already exists.'`
   - Transaction: update lead (`updatedAt`, `updatedBy`) + outbox UPDATE (`leads`).
   - Status changes through all 10 statuses are allowed here
     (NEW, CONTACTED, INTERESTED, SAMPLE_REQUESTED, FOLLOW_UP, NEGOTIATION, CUSTOMER,
     NOT_INTERESTED, WRONG_NUMBER, DO_NOT_CONTACT).
3. Failure fallback: `'Failed to save changes. Please try again.'`

#### 2.2.3 ACTION: Assign a single lead (LeadAssignmentModal)

1. Modal loads agents via `AgentManagementService.getAgents(currentUser)` filtered to `status === 'ACTIVE'`.
   - Load failure → `'Failed to load sales agents.'`
2. Assign button disabled when selection equals the current assignee.
3. `LeadAssignmentService.assignLead(leadId, agentId, adminUser)`:
   1. `assertAdmin` (same ADMIN/ACTIVE checks as analytics).
   2. Lead lookup → `'Lead with ID "<id>" not found.'`
   3. Agent lookup → `'Target agent with ID "<id>" not found.'`
   4. Role check → `'Leads can only be assigned to sales representatives with the AGENT role.'`
   5. Status check → `'Cannot assign lead to inactive agent "<name>".'`
   6. Transaction: `leads.assignedTo = agentId` + outbox UPDATE (`leads`) + activity:
      - First assignment → `LEAD_ASSIGNED`
      - Changing assignee → `LEAD_REASSIGNED` (metadata carries `previousAssigneeId/Name`, `newAssigneeId/Name`)
4. Unassign path: `unassignLead()` sets `assignedTo = null` + activity `LEAD_UNASSIGNED`.
   Failure fallbacks: `'Failed to update lead assignment.'` / `'Failed to remove assignment.'`

Realtime effect (critical Admin→Agent path): the `activities` INSERT reaches the assigned
agent's device; `RealtimeService` evaluates in-app notifications:
- `LEAD_ASSIGNED`/`LEAD_REASSIGNED` with `meta.newAssigneeId === me` → toast
  title `'New Lead Assigned'`, message `` Admin assigned "<meta.leadName || 'a lead'>" to you. ``
- `LEAD_REASSIGNED` with `meta.previousAssigneeId === me` → toast `'Lead Reassigned'`.
The lead row itself also arrives via the `leads` channel and is merged with the LWW resolver (§6.4).

#### 2.2.4 ACTION: Bulk assign leads (BulkLeadAssignmentModal)

Two-step wizard:

**Step 1 — Preview & Confirm:**
1. Admin selects leads (checkboxes in list) and a target agent
   (dropdown of ACTIVE agents; default = first active agent).
   - No target selected → `'Please select a target sales representative.'`
2. Preview shows breakdown: Total selected / Unassigned / Reassigned (from current assignees).

**Step 2 — Confirm Assignment:**
3. `LeadAssignmentService.bulkAssignLeads(leadIds, agentId, adminUser, filterSnapshot)`:
   1. Empty selection → `'No leads selected for bulk assignment.'`
   2. Agent validation (same as single assign).
   3. Org boundary check → `'Unauthorized: Cross-organization assignment is strictly prohibited.'`
   4. One Dexie transaction: for each lead — set `assignedTo`, emit `LEAD_ASSIGNED` or
      `LEAD_REASSIGNED` activity, enqueue outbox UPDATE (`leads`).
   5. Writes a `bulk_assignment_audits` row (status `COMPLETED` / `PARTIAL` / `FAILED`,
      counts, `filterSnapshot {selectedCount, unassignedBreakdown, reassignedBreakdown}`)
      + outbox CREATE (`bulk_assignment_audits`) + activity `BULK_ASSIGNMENT_EXECUTED`.
4. Success screen auto-closes after 1500ms; list refreshes.

#### 2.2.5 ACTION: Delete lead (from LeadDetailView)

`leadRepository.hardDeleteLead(leadId, userId)`:
1. In-app confirmation (F13 pattern — no `window.confirm`).
2. Transaction cascades deletes across 7 tables: `leads`, `callRecords`, `remarks`,
   `followUps`, `messageHistory`, related `activities`, plus outbox rows for each,
   and enqueues outbox DELETE (`leads`).
3. Cloud side: migration 7 changed child FKs (call_records/remarks/follow_ups/message_history → leads)
   to `ON DELETE CASCADE`; RLS `leads_delete_policy` = org member AND (admin OR assigned_to=self OR created_by=self).
   Only `leads` exposes a DELETE policy; child tables have none.

### 2.3 Agents tab (AdminAgentsView)

Lists all agent profiles via `AgentManagementService.getAgents(currentUser)` (ADMIN-only).
Each `AgentCard` shows: name, role/status badges, email, phone, created date, last login,
and action buttons Edit / Deactivate-or-Activate / Delete (hidden when `deletedAt` set; a
"Deleted" badge shows instead).

Every service call below first runs `assertAdmin()`:
- `'Unauthorized: No authenticated user session.'`
- `'Unauthorized: Only administrators are permitted to manage sales agents.'`
- `'Unauthorized: Inactive administrator account.'`

#### 2.3.1 ACTION: Create agent (CreateAgentModal)

**Client-side validation (modal):**
- `'Please enter the agent full name.'`
- `'Please enter the agent email address.'`
- `'Initial password must be at least 6 characters in length.'`
- `'Passwords do not match. Please re-enter.'`

**Service validation (`agentManagementService.createAgent`):**
- `'Agent full name is required.'`
- `'Agent email is required.'`
- `'Please enter a valid email address.'`
- `'Password must be at least 6 characters in length.'`
- Duplicate email → `` `An account with email "<email>" already exists.` ``

**Cloud provisioning — Edge Function `create-agent`:**
1. Admin's Supabase JWT is sent. Function checks:
   - Missing/invalid auth → HTTP 401
   - Profile not found / inactive / not ADMIN / no organization → HTTP 403
   - name < 2 chars, invalid email, password < 6 → HTTP 400
   - Duplicate email within the organization → HTTP 409
2. Creates the Supabase Auth user (`email_confirm: true`), then inserts the `profiles` row
   (role forced to `AGENT`, organization inherited from admin, status `ACTIVE`).
   If the profile insert fails, the auth user is rolled back (deleted).
3. Writes `AGENT_CREATED` activity server-side.
4. Returns the sanitized agent object; client stores it locally via `putUser()` + outbox CREATE (`profiles`).

**Offline fallback:** ONLY when the Edge Function is unreachable
(`FunctionsFetchError` / `AbortError` / `TypeError`) does the client create a **local-only**
agent account (works on-device, no cloud auth user). Any other server error aborts with:
`` `Agent provisioning failed on the server (HTTP <code>): <message>. No local account was created. Please retry.` ``

#### 2.3.2 ACTION: Edit agent (EditAgentModal)

`agentManagementService.updateAgent(agentId, patch, adminUser)`:
- Editing an admin through this UI → `'Cannot edit administrator accounts through Agent Management.'`
- Empty name → `'Agent name cannot be empty.'`
- `role` and `id` are stripped from the patch before write (role immutability).
- Transaction: update `users` row + outbox UPDATE (`profiles`) + activity `AGENT_UPDATED`.

#### 2.3.3 ACTION: Deactivate / Activate agent (ConfirmStatusModal)

`deactivateAgent` / `activateAgent`:
- Self-deactivation guard → `'Administrators cannot deactivate their own account.'`
- Non-agent target → `'Cannot deactivate non-agent accounts through this interface.'`
- Transaction: `users.status = 'INACTIVE' | 'ACTIVE'` + outbox UPDATE (`profiles`) +
  activity `AGENT_DEACTIVATED` / `AGENT_ACTIVATED`.
- Modal shows inline error on failure: `err.message || 'Action failed.'`

Effect on the agent: their next login is rejected with
`'Your account is inactive. Please contact your administrator.'` Realtime init also refuses
to subscribe for INACTIVE users.

#### 2.3.4 ACTION: Delete agent (DeleteAgentModal)

1. Modal requires typing the agent's exact name to enable the delete button.
2. `agentManagementService.deleteAgent(agentId, adminUser)`:
   - Self-delete guard → `'Administrators cannot delete their own account.'`
   - Role guard → `'Only AGENT accounts can be deleted through this interface.'`
   - Already deleted → `` `Agent "<name>" has already been deleted.` ``
3. Local: soft-delete the profile (`status = 'INACTIVE'`, `deletedAt` set) + outbox UPDATE (`profiles`).
4. Cloud: updates the remote profile (non-fatal if it fails — local delete still stands).
5. Activity `AGENT_DELETED` logged.
6. Leads assigned to the deleted agent are NOT auto-reassigned; they remain with
   `assignedTo` pointing at the deleted profile (admin can bulk-reassign manually).

### 2.4 Data tab (AdminDataManagementView) — 4 sub-tabs

#### 2.4.1 Lead Explorer (DATABASE)
- `crmData.leads.searchAndFilterLeads({ searchTerm?, status?, locality?, limit: 200 })`
  + client-side source filter.
- Filters: search (name/phone/locality), status, locality (from `getDistinctLocalities()`), source batch.
- Row actions: open lead detail.

#### 2.4.2 Import Center (IMPORTS)
- "New Import" opens `ExcelImporter` (full flow §2.4.2.1).
- Audit history: `crmData.importAudits.getAuditHistory(50)` — per batch shows filename, date,
  Total / Imported / Updated / Skipped counts.

##### 2.4.2.1 ACTION: Excel import (ExcelImporter, 4 steps)

**Step 1 — File select & parse** (`excelParser.parseWorkbook`):
- No sheets → `'The selected workbook contains no sheets.'`
- Read failure → `'Failed to read Excel file. Please ensure it is a valid .xlsx or .csv file.'`
- `detectColumnMapping()` auto-maps columns by regex for businessName/phone/address/category/
  alternatePhone/contactPerson/website with positional fallbacks; admin can override via
  `ColumnMappingSelector` (required: Business Name, Phone Number, Full Address).

**Step 2 — Preview & validation** (`parseSheet`):
- Unknown sheet → `` `Sheet "<name>" not found in workbook.` ``
- Per-row issues (`sourceRow = rowIndex + 2` for Excel row numbers):
  - `'Missing business name'`
  - `'Missing phone number'`
  - `` `Invalid phone format: "<rawPhone>"` ``
  - `'Lucknow Landline (0522) - Calling supported, WhatsApp unavailable'` (warning, still imports)
  - `` `Duplicate phone: matches existing lead "<businessName>"` ``
  - `'Duplicate phone: appears multiple times in this Excel file'`
- Rows classified VALID / INVALID / DUPLICATE. If duplicates exist → `DuplicateConfirmModal`:
  - `Skip Duplicates (Recommended)` → duplicates skipped
  - `Update Contact Info & Overwrite Details` → updates contact fields only; status/history preserved

**Step 3 — Import** (`excelParser.importRecords`):
- INVALID rows skipped; DUPLICATE rows skipped unless overwrite chosen.
- New leads: `status = 'NEW'`, `source = 'Excel Import: <sourceFile>'`.
- ONE atomic Dexie transaction: bulkAdd leads + outbox CREATE per new lead + outbox UPDATE
  per updated duplicate + `importAudits` row + outbox CREATE (`import_audits`).
- Progress callback every 20 rows.
- Activity `LEAD_IMPORTED` / `IMPORT_COMPLETED` logged (metadata: totalRows, uploadedByName, sourceFile).

**Step 4 — Summary** (`ImportSummaryCard`): imported / updated / skipped / invalid counts.

#### 2.4.3 Data Cleanup (CLEANUP)
- Scans all live leads, groups by normalized phone → duplicate clusters (count badge on tab).
- Per cluster, first record is kept; others show `Archive Duplicate` button →
  `crmData.leads.softDeleteLead(leadId)` (sets `deletedAt`, outbox UPDATE `leads`).
  Success banner: `'Duplicate lead archived successfully.'` (auto-hides 3s).
- Non-destructive by design: call records/remarks history retained.

#### 2.4.4 Database Health (HEALTH)
- `LeadAssignmentService.getAssignmentStats` + agent counts + call records + outbox scan:
  pending (PENDING+SYNCING), failed (FAILED), last sync timestamp from `syncStateRepo.getSyncState()`.
- Read-only inspector; no mutations.

### 2.5 Reports tab (AdminReportsView)

Guard: `AdminReportsService.assertAdmin` →
`'Unauthorized: Only active administrators can access Analytics & Reports.'`

7 report tabs: `LEADS / CALLS / PRODUCTIVITY / FOLLOW_UPS / WHATSAPP / IMPORTS / ACTIVITY`.
Filter bar: date preset (`ALL_TIME / TODAY / YESTERDAY / LAST_7_DAYS / LAST_30_DAYS /
THIS_MONTH / PREV_MONTH / CUSTOM`), agent, locality.
Auto-refresh: subscribes to `RealtimeService.onActivity` + `onEntityChange` → reloads active report.

| Tab | Service call | Key outputs |
|---|---|---|
| LEADS | `getLeadReport` | 10-status breakdown, `conversionPercentage` |
| CALLS | `getCallReport` | **zero-fake-talk-time**: only VERIFIED durations counted; `longestVerifiedDurationSeconds`, `callsByDay`, `callsByOutcome`, `talkTimeByAgent` |
| PRODUCTIVITY | `getAgentProductivityReport` | `conversionRatePercentage = customers / assigned` per agent |
| FOLLOW_UPS | `getFollowUpReport` | completion % and overdue % |
| WHATSAPP | `getWhatsAppReport` | `templateUsage` sorted desc; `landlinePreventedCount` = number of landline leads |
| IMPORTS | `getImportReport` | batch list with counts |
| ACTIVITY | `getActivityReport` | max 150 rows, chronological |

**ACTION: Export CSV** (`exportReportToCSV(currentUser, type, filters)`):
- Types: `LEADS / CALLS / AGENTS / FOLLOW_UPS / ACTIVITIES` (mapped from active tab).
- CALLS CSV writes duration `0` for UNVERIFIED rows (anti-fake-talk-time).
- Quotes sanitized; file downloaded as `amaratv_report_<tab>_<YYYY-MM-DD>.csv`.

### 2.6 Settings modal (SettingsModal) — 3 tabs

#### 2.6.1 MESSAGES (WhatsApp pitch templates) — LOCAL ONLY, never synced
- List from `crmData.templates.getAllTemplates()`. Load failure toast:
  `'Could not load settings. Please try again.'`
- **Create**: prefilled intro body; `createTemplate({title, category, body, isDefault})`.
  First template auto-becomes default. Save failure → `'Could not save the template. Please try again.'`
- **Edit**: `updateTemplate(id, patch)` (same save toast on failure).
- **Set default**: `setDefaultTemplate(id)` enforces exclusivity (only one default).
  Success `'Default template updated.'` / failure `'Could not set the default template.'`
- **Duplicate**: `duplicateTemplate(id)` → title `` `Copy of ${title}` ``.
  Missing → `` `Template with id ${id} not found.` `` Failure toast `'Could not duplicate the template.'`
- **Delete**: `softDeleteTemplate(id)` (sets `isDefault=false`, soft delete).
  Success `'Template deleted.'` / failure `'Could not delete the template.'`
- Template variables (insert at cursor): `{{businessName}}`, `{{contactPersonOrSir}}`,
  `{{contactPerson}}`, `{{locality}}`, `{{city}}`, `{{phone}}`, `{{followUpDate}}`, `{{repName}}`.
- Rendering fallbacks (`templateRenderer`): contactPersonOrSir→`'Gym Manager / Owner'`,
  contactPerson→`'Sir/Madam'`, businessName→`'Your Centre'`, locality→`'Lucknow'`,
  city→`'Lucknow'`, followUpDate→`'this week'`, repName→`'Amaratv Krishi Team'`;
  final safety pass strips any unresolved `{{tags}}`.

#### 2.6.2 CATALOGUE (default attachment)
- Upload validated by `AttachmentService.validateFile`:
  - `'No file selected.'`
  - `` `File size (<size>) exceeds the 25 MB WhatsApp limit.` ``
  - `'Unsupported file type. Please attach a PDF catalogue, image, or document.'`
  - Allowed: pdf/jpeg/png/webp/doc/docx; cap 25 MB.
- `AppSettingsService.setDefaultCatalogue(file)` stores base64 in localStorage.
  Success `'Catalogue saved for Quick Send.'`
- Replace / Remove buttons; remove → `'Catalogue removed.'`

#### 2.6.3 PREFERENCES
- **Cloud Sync** card: last sync time or `'Not yet synced this session'`, `lastSyncError` if any,
  `Sync Now` button → `synchronizeNow()`.
- **App Theme**: Night / Day buttons → `ThemeContext.setTheme` (persisted `amaratv_crm_theme_v1`).
- **Preview Before WhatsApp** toggle → `AppSettingsService.setWhatsappPreviewEnabled(bool)`
  (default true; stored in `amaratv_crm_app_settings_v1`).
- **Profile card**: name, email, role badge; **Sign Out** button (§1.3).

### 2.7 Backup & Restore (BackupRestoreModal) — ADMIN only

Service: `backupService` (schemaVersion 5, appVersion `'2.0.0'`).

#### 2.7.1 ACTION: Export backup (EXPORT tab)
1. `crmData.backup.getDatabaseSummary()` → counts grid (leads/calls/remarks/follow-ups/messages/templates).
   Failure toast: `'Could not load database summary.'`
2. `generateBackupPayload()` → 13 tables incl. outbox + syncState.
3. Filename `amaratv-crm-backup-YYYY-MM-DD-HHmm.json`; downloaded via blob.
4. Success message: `` Backup saved successfully as "<filename>" (<KB> KB). ``
5. Audit entry appended to localStorage `amaratv_backup_audit_history` (keeps last 20).

#### 2.7.2 ACTION: Restore backup (RESTORE tab)
1. File select → `validateBackupJson(text)`. Validation errors (shown, first 3):
   - `` `JSON Syntax Error: <message>` ``
   - `'Invalid backup: Payload must be a valid JSON object.'`
   - `'Missing or invalid schemaVersion in backup header.'`
   - `'Missing "data" container object in backup payload.'`
   - `` `Duplicate ID "<id>" detected in table "<name>".` ``
   - `` `Orphan record in "<childName>" (ID: <id>): Referenced leadId "<leadId>" not found in leads table.` ``
2. Comparison table: current DB vs backup file per entity.
3. **Merge (recommended)** — `mergeRestore(payload)`: per-record last-write-wins:
   identical → skipped; incoming ≥ local → updated; local newer → skipped + counted as conflict.
   Success: `` Merge complete! Added: N, Updated: N, Skipped: N (N conflicts resolved). ``
   Invalid payload at call time → `'Cannot restore: Invalid backup payload.'`
4. **Replace (destructive)** — requires typing `REPLACE` (case-insensitive):
   - Wrong text → `'Please type "REPLACE" to confirm complete database replacement.'`
   - `replaceRestore(payload)`: safety snapshot held in memory → clear all tables →
     bulkAdd everything from backup (incl. outbox/syncState). On mid-transaction failure it
     rolls back the snapshot and throws
     `` `Database replacement failed: <message>. Previous database state was restored.` ``
   - Success: `` Database replaced successfully with <N> records from backup! ``
5. Both paths call `onDatabaseChanged()` → app-wide data refresh.

#### 2.7.3 HISTORY tab
Lists audit logs (operation, status SUCCESS/FAILED, timestamp, summary text) from localStorage.

---

## 3. AGENT WORKFLOWS

Agent home is `SalesDashboard`; bottom navigation: DASHBOARD / LEADS / FOLLOW_UPS / IMPORT (hidden
for agents in some builds) / DETAIL (pushed when a lead is opened).

### 3.1 Sales dashboard (SalesDashboard)

Data: `crmData.dashboard.getDashboardData()` — local-time (IST) today window. Load failure →
full-screen retry state `'Could not load your sales metrics.'` (never a blank screen).

Sections & actions:
1. **KPI grid** (9 tiles): totalLeads, notContacted (= NEW), callsToday, whatsAppToday,
   interested, samplesRequested, followUpsToday, overdueFollowUps, customers.
2. **Today's follow-ups** (top 3): each card →
   - Tap title → open lead detail
   - `Mark Done` → `crmData.followUps.completeFollowUp(id)`; failure toast
     `'Could not mark the follow-up as done. Please try again.'` with Retry action
   - `WhatsApp` (mobile numbers only; hidden for landlines)
   - `Call` → `handleCallLead(lead)` (§3.4)
3. **Sales pipeline** (8 stages, tappable) → `onOpenLeadsWithStatus(status)` filters the lead list.
4. **Lucknow localities breakdown** (top 8) → tap → `onOpenLeadsWithLocality(locality)`.
5. **Recent activity stream** (merges latest 10 calls/remarks/messages/completed follow-ups → top 15)
   → tap → opens the related lead.

Header (ADMIN-only buttons hidden for agents): `SyncStatusBadge`; for admins also Settings,
Backup, Import Data buttons.

### 3.2 Leads list (MinimalLeadsList)

- AGENT scope: `assignedTo === currentUser.id` only (enforced in query AND by RLS on cloud).
- Page size 150; search debounced 250ms over name/phone/locality.
- Filters: status, locality; sorting by updatedAt/nextFollowUpAt.
- Row actions: Call, WhatsApp (mobile only), open detail.
- Load failure → `'Could not load leads from the local database.'`

### 3.3 Lead detail (LeadDetailView) — 4 tabs

`TAB_ORDER = ['CALLS', 'REMARKS', 'FOLLOW_UPS', 'MESSAGES']` (roving-tabindex keyboard nav).

Header actions: Call, WhatsApp, Edit (opens EditLeadModal), status quick-change, delete (admin/creator).

#### 3.3.1 ACTION: Add inline remark (REMARKS tab)
1. `remarkRepository.addRemark(leadId, content, userId)`:
   - Missing lead → `'Cannot add remark: Lead <leadId> does not exist.'`
   - Transaction: insert `remarks` + outbox CREATE (`remarks`) + update lead `updatedAt`
     + outbox UPDATE (`leads`) + activity `REMARK_ADDED`.
2. Failure toast: `'Could not save the remark. Please try again.'` with Retry action.

#### 3.3.2 ACTION: Complete / cancel follow-up (FOLLOW_UPS tab)
- Complete → `completeFollowUp(id)`: sets `status='COMPLETED'`, `completedAt`,
  recalculates lead `nextFollowUpAt` (earliest remaining PENDING), enqueues outbox
  UPDATE (`follow_ups`) + UPDATE (`leads`), activity `FOLLOW_UP_COMPLETED`.
  Missing → `'Follow up <id> not found.'` Failure toast + Retry:
  `'Could not mark the follow-up as done. Please try again.'`
- Cancel → in-app confirmation naming the specific follow-up (F13) →
  `cancelFollowUp(id)`: `status='CANCELLED'` + same lead recalculation + activity `FOLLOW_UP_CANCELLED`.
  Failure toast + Retry as well.
- Reschedule → opens `FollowUpModal` with `existingFollowUp` (§3.6.2).

#### 3.3.3 CALLS tab
Lists `callRecords` for the lead: outcome badge, verified/reported duration, remark, timestamp.

#### 3.3.4 MESSAGES tab
Lists `messageHistory` rows: channel, template title, status (`INITIATED`→'Preparing',
`SENT`→'Sent', `FAILED`→'Failed'), timestamp.

#### 3.3.5 Lead timeline (LeadTimelineView)
`LeadAssignmentService.getLeadHistoryTimeline(leadId)` → chronological activities for the lead:
LEAD_CREATED, LEAD_IMPORTED, LEAD_ASSIGNED/REASSIGNED/UNASSIGNED, CALL_INITIATED,
CALL_COMPLETED (with verified/reported duration string), CALL_CANCELLED, FOLLOW_UP_CREATED,
REMARK_ADDED, STATUS_CHANGED. Empty state: `'No recorded history yet.'`

### 3.4 ACTION: Place a call (the core field workflow)

Service: `callLifecycleService` — state machine persisted in localStorage key
`amaratv_pending_dial_attempt`:

```
IDLE → DIAL_INITIATED → APP_BACKGROUND → APP_FOREGROUND → OUTCOME_PENDING → COMPLETED | CANCELLED
```

**Step 1 — Initiate dial** (`CallLifecycleService.initiateDial(lead, user)`):
1. Guards:
   - No session → `'Unauthorized: An authenticated user session is required to place calls.'`
   - No phone → `'Cannot dial lead: No phone number present.'`
2. Persists attempt `{ attemptId: uuid, leadId, userId, startedAt, state: 'DIAL_INITIATED' }`.
3. `NativePlatformService.openDialer(phone)` → `tel:` URI with **ACTION_DIAL** (never silent dial).
   The app goes to background as the native dialer opens.
4. On any failure App.tsx shows toast:
   `` `Could not start the call to ${lead.businessName}. Please try again.` ``

**Step 2 — Return to app** (Capacitor `appStateChange` foreground):
- `handleAppStateChange()` finds the pending attempt → state `OUTCOME_PENDING` →
  App.tsx reopens `CallOutcomeModal` for that lead. This also survives app kills/restarts
  because the attempt lives in localStorage.

**Step 3 — Record outcome** (`CallOutcomeModal`):
1. **Outcome picker** — 7 outcomes with descriptions:
   - `CONNECTED` 'Spoke with gym owner / decision maker / trainer'
   - `BUSY` 'Line was busy or call waiting'
   - `NO_ANSWER` 'Ringing but not answered'
   - `CALLBACK_REQUESTED` 'Asked to call back at a later time'
   - `WRONG_NUMBER` 'Incorrect number or individual personal line'
   - `INVALID_NUMBER` 'Out of service / disconnected number'
   - `OTHER` 'Other call outcome'
2. **Quick remarks** — 11 toggleable chips: `Interested`, `Asked for Price`, `Asked for Sample`,
   `Asked for Catalogue`, `Call Later`, `Meeting Required`, `Sample Sent`, `Order Confirmed`,
   `Not Interested`, `Already Has Supplier`, `Do Not Contact`. Plus free-text custom note.
3. **Duration & verification** — because Android ACTION_DIAL gives no call-state access,
   duration is self-reported (max 120 minutes, converted to seconds). The UI labels this
   `Unverified (ACTION_DIAL)`. A verification checkbox/promt marks the call VERIFIED only when
   the rep confirms a real conversation happened:
   - `verifiedDurationSeconds >= 0` provided → `verificationStatus = 'VERIFIED'`, duration counted
   - otherwise → `durationSeconds = 0`, `verificationStatus = 'UNVERIFIED'`,
     `reportedDurationSeconds` kept for audit display.
4. **Follow-up scheduling** — auto-enabled for `CALLBACK_REQUESTED` / `BUSY` outcomes and
   `Call Later` / `Meeting Required` / `Asked for Sample` remarks. Presets: Tomorrow / +2 days /
   +3 days / +1 week, all at 10:00 local; custom date picker defaults to T10:00:00 local.
   Invalid custom date → `'Please pick a valid follow-up date.'`

**Step 4 — Save** (`CallLifecycleService.completeCall(attempt, outcomePayload)`):
1. No pending attempt → `'No active call attempt found to complete.'`
2. Remark string = `[quickRemark, customNote].filter(Boolean).join(' — ')`.
3. One Dexie transaction:
   - Insert `callRecords` row (`id = attemptId`, also stored as `dialAttemptId`; `callStatus`,
     outcome, durations, verification) + outbox CREATE (`call_records`)
   - Optional remark insert + outbox CREATE (`remarks`)
   - Lead update: `callCount + 1`, `lastContactedAt = now`, new `status`, `updatedBy`
     + outbox UPDATE (`leads`)
   - Activity `CALL_COMPLETED` (metadata: outcome, verificationStatus, durationSeconds,
     reportedDurationSeconds, repName, leadName)
4. Status determination (`callOutcomeMapping.determineDefaultLeadStatus`):
   - **Remark precedence** (overrides outcome):
     `Order Confirmed`→CUSTOMER; `Asked for Sample`/`Sample Sent`→SAMPLE_REQUESTED;
     `Interested`/`Asked for Price`/`Asked for Catalogue`→INTERESTED;
     `Call Later`/`Meeting Required`→FOLLOW_UP;
     `Not Interested`/`Already Has Supplier`→NOT_INTERESTED; `Do Not Contact`→DO_NOT_CONTACT.
   - **Outcome fallback** (when no status-bearing remark):
     CONNECTED: NEW→CONTACTED (else unchanged); CALLBACK/BUSY/NO_ANSWER: NEW→FOLLOW_UP;
     WRONG_NUMBER/INVALID_NUMBER: →WRONG_NUMBER; OTHER: NEW→CONTACTED.
5. If follow-up enabled → `followUpRepository.scheduleFollowUp(...)` (§3.6.1) in the same flow.
6. Attempt purged from localStorage; state COMPLETED.
7. App.tsx failure path: toast (10s, Retry action)
   `` `Could not save the call outcome for ${businessName || 'this lead'}. Your notes were not recorded.` ``
   plus rethrow for inline banner.

**Cancel path** (`cancelCall()`): triggered by Android back button while outcome modal open,
or explicit cancel — purges the attempt, activity `CALL_CANCELLED`, NO call record written.

**Realtime effect**: `call_records` + `activities` INSERTs broadcast to org; admin's
LiveActivityFeed shows the call within seconds; AdminDashboard KPIs refresh.

### 3.5 ACTION: Send WhatsApp pitch (WhatsAppComposeModal)

Guards before compose even opens:
- Landline (0522) → banner `'WhatsApp unavailable for landlines'`; `handleOpenWhatsApp` guard
  error `'WhatsApp is unavailable for this phone number.'`
- Invalid phone → `'Invalid phone number. WhatsApp messaging cannot be initiated.'`

Compose flow:
1. First-ever use seeds template `'Amaratv Krishi — Standard Intro Pitch'` (category INTRO, isDefault).
2. Template picker (from local `templates`); body rendered via `renderMessageTemplate(template, lead)`
   with fallbacks (§2.6.1). Preview shown if `whatsappPreviewEnabled` (default true).
3. Optional catalogue attachment: default catalogue from settings, or file pick
   (validation per §2.6.2). Missing default catalogue → warning
   `'Default catalogue is unavailable. Please select another file.'`
4. **Send** (`handleOpenWhatsApp`):
   1. `messageHistoryRepository.logMessage(...)` status `INITIATED` —
      missing lead → `'Cannot log message: Lead <leadId> does not exist.'`
      Transaction: insert `messageHistory` + outbox CREATE (`message_history`).
   2. With attachment → native Share sheet (Capacitor `Share.share`, fallback `openWhatsApp`);
      without → `NativePlatformService.openWhatsApp(wa.me/<E.164>, text)` (E.164 preferred).
   3. Success → `updateMessageStatus(id, 'SENT')` + outbox UPDATE (`message_history`).
   4. Failure → status `FAILED` + toast
      `'Could not open WhatsApp. Please ensure WhatsApp or WhatsApp Business is installed on your device.'`

Landline protection is also counted in admin WhatsApp reports (`landlinePreventedCount`).

### 3.6 Follow-ups

#### 3.6.1 ACTION: Schedule follow-up (FollowUpModal)
1. Validation:
   - `'Please enter a follow-up title / objective.'`
   - `'Please select a scheduled date and time.'`
2. `followUpRepository.scheduleFollowUp(input, user)`:
   - Missing lead → `` `Cannot schedule follow up: Lead ${leadId} does not exist.` ``
   - Atomic transaction: insert `followUps` (status PENDING) + recalculate lead
     `nextFollowUpAt` (earliest PENDING) + outbox CREATE (`follow_ups`) + outbox UPDATE (`leads`)
     + activity `FOLLOW_UP_CREATED` (metadata: scheduledAt, createdByName, leadName, assignedTo).
3. Schedules an Android local notification via `NativePlatformService.scheduleNotification`
   (LocalNotifications plugin, permission-gated) for the scheduled time.

Realtime effect: `FOLLOW_UP_CREATED` with `meta.assignedTo === me` → recipient device toast
`'New Follow-Up Scheduled'`.

#### 3.6.2 ACTION: Reschedule
`rescheduleFollowUp(id, newDate)` — missing → `'Follow up <id> not found.'`
Sets new `scheduledAt`, keeps PENDING, recalculates lead `nextFollowUpAt`,
outbox UPDATE (`follow_ups`) + (`leads`), activity `FOLLOW_UP_RESCHEDULED`.
Re-schedules the Android notification.

#### 3.6.3 Follow-ups view (FollowUpsView)
- Tabs: `ALL / OVERDUE / TODAY / UPCOMING` (arrow-key nav). Buckets computed by local-time
  windows in `getGroupedPendingFollowUps()`.
- Load failure → `'Could not load your follow-ups.'`
- Card actions: Mark Done (toast + Retry on failure), Reschedule (opens FollowUpModal),
  Call, WhatsApp (mobile only; landline cards show `'WhatsApp not available'`).

### 3.7 ACTION: Agent creates a lead in the field (CreateLeadModal)

Same modal/validation as §2.2.1, with agent-specific effects:
- `source = 'Field Entry (<agentName>)'`
- `createdBy = assignedTo = updatedBy = agentUserId` (self-assigned at creation)
- Activity `LEAD_CREATED` broadcasts; admin sees it in LiveActivityFeed.
- RLS: agent INSERT allowed only with `created_by = self` AND (`assigned_to = self` OR NULL).

---

## 4. ADMIN ↔ AGENT REALTIME LOOP (end-to-end)

### 4.1 Transport

- Supabase Realtime, Postgres changes publication `supabase_realtime` covering 8 tables
  (migration 4): `leads, call_records, activities, remarks, follow_ups, message_history,
  profiles, import_audits` (+ `bulk_assignment_audits` added in migration 5).
- All tables set `REPLICA IDENTITY FULL` so UPDATE/DELETE events carry full old rows.
- Each device subscribes once per session with filter `organization_id=eq.<orgId>` —
  cross-org traffic is never received.
- Connection statuses: `SUBSCRIBING → SUBSCRIBED`, drops go `DISCONNECTED → RECONNECTING`.

### 4.2 Receiving a change (RealtimeService.handleIncomingChange)

Per table:
1. `activities`: insert-if-absent (id dedupe) → notify `activityListeners` → evaluate in-app
   notifications (§4.3).
2. `call_records`: merge via `resolveCallRecord` (VERIFIED beats UNVERIFIED, §6.4).
3. `leads / follow_ups / remarks / profiles`: merge via `resolveMutable` (LWW on `updatedAt`,
   tie → REMOTE wins).
4. `import_audits / message_history`: insert-if-absent.
5. All merges write locally with `isSynced = 1` (already cloud-authoritative) and then fire
   `entityListeners` so open views refresh.

### 4.3 In-app notification rules (agent side)

| Activity received | Condition | Toast |
|---|---|---|
| `LEAD_ASSIGNED` / `LEAD_REASSIGNED` | `meta.newAssigneeId === me` | title `'New Lead Assigned'`, `` Admin assigned "<leadName>" to you. `` |
| `LEAD_REASSIGNED` | `meta.previousAssigneeId === me` | `'Lead Reassigned'` |
| `FOLLOW_UP_CREATED` | `meta.assignedTo === me` | `'New Follow-Up Scheduled'` |

Toasts auto-dismiss after 8s (realtime notifications) vs 6s default.

### 4.4 Reconnect reconciliation

When the channel returns to `SUBSCRIBED` after `DISCONNECTED/RECONNECTING/ERROR`:
`RealtimeService` triggers `syncEngine.triggerSync()` (full push+pull) so nothing missed
during the gap is lost; if the sync engine is unavailable it falls back to a full pull.

### 4.5 The two golden loops

**Loop A — Admin assigns → Agent works → Admin sees:**
1. Admin assigns lead (§2.2.3) → local txn: `leads.assignedTo`, activity `LEAD_ASSIGNED`, outbox rows.
2. Push (≤60s or event-driven) → Supabase `leads` + `activities` updated.
3. Realtime broadcasts → agent device merges lead (now visible in their list) + shows
   `'New Lead Assigned'` toast.
4. Agent calls the lead (§3.4) → `call_records` + `activities` + lead status update → outbox.
5. Agent's push → Supabase → realtime → admin device: LiveActivityFeed prepends the call,
   dashboard KPIs (calls today, verified talk time) refresh, lead status chip updates.

**Loop B — Agent offline all day → sync on connectivity:**
1. Every action commits locally with outbox rows (`PENDING`), badge shows `Offline — saved locally`.
2. Network returns → `online` event → `syncEngine.synchronizeNow()`.
3. Push drains the outbox in createdAt order (DELETEs executed individually after preceding
   upserts flush); pull fetches everything the admin changed meanwhile (assignments, new leads).
4. Conflicts resolved per §6.4; badge → `Synced`.

---

## 5. WHATSAPP & TEMPLATE SUBSYSTEM (cross-role)

Covered action-by-action in §2.6 (admin template management) and §3.5 (agent send flow).
Key invariants:
- Templates and the default catalogue are **device-local only** — each device seeds its own.
- Landline numbers (`phoneType === 'landline'`, 0522) can be CALLED but never WhatsApp-messaged;
  enforced in UI (banner/hidden button), in `handleOpenWhatsApp` guard, and counted in reports.
- Message lifecycle: `INITIATED` (log written before leaving the app) → `SENT` (WhatsApp opened
  successfully) or `FAILED`. There is no delivery receipt — WhatsApp is opened externally.

---

## 6. SYNC ENGINE DEEP-DIVE

### 6.1 Outbox queue (SyncQueue)

- `enqueue(entityType, entityId, operation, payload)` → status `PENDING`, `retryCount = 0`,
  `deviceId` stamped.
- `getPendingItems(limit = 50)` picks `PENDING` + `FAILED` ordered by `createdAt`.
- `retryCount >= MAX_RETRY_COUNT (10)` → parked in `DEAD_LETTER` (never retried, inspectable).
- `recoverStuckItems()`: rows stuck in `SYNCING` longer than `STUCK_SYNCING_TIMEOUT_MS` (5 min)
  are reset to `PENDING` (crash recovery).
- `markFailed(id, error)` increments `retryCount`, stores `lastError`.
- `purgeSyncedItems()` deletes `SYNCED` rows after a successful push.

### 6.2 synchronizeNow() — exact order (SyncEngine)

1. `navigator.onLine === false` → status `OFFLINE`, error `'Device is offline'`, abort.
2. No Supabase client → error `'Supabase unconfigured'`, abort.
3. No auth session → status `AUTH_REQUIRED`, error `'Authentication required'`, abort.
4. Set status `SYNCING`; `recoverStuckItems()`.
5. **Push** (`syncPush.pushPending`):
   - Client guard → `'Supabase client is not initialized or configured.'`
   - Stale-payload guard: if local row's `updatedAt` is NEWER than the queued payload's
     `updatedAt`, the item is dropped (marked SYNCED) — prevents resurrecting changes the user
     already overwrote locally.
   - `transformToPgRecord`: camelCase → snake_case; organization fallback
     `'00000000-0000-0000-0000-000000000001'`.
   - Items grouped by entityType; CREATE/UPDATE batched as `upsert(onConflict: 'id')`;
     DELETE operations executed individually AFTER flushing preceding upserts (ordering preserved;
     deletes are never upserted).
   - Batch failure → item-by-item fallback; per-item error format
     `` `${entityType} item ${entityId}: ${message}` ``.
6. `purgeSyncedItems()`; stamp `lastPushAt`.
7. **Pull** (`syncPull.pullChanges`):
   - Keyset pagination, `pageSize = 500`, ordered by `(updated_at, id)`; first page uses
     inclusive `gte` on the stored cursor (boundary rows re-fetched — idempotent).
   - Each row snake→camel transformed with `isSynced = 1`, then reconciled per table:
     `call_records` → `resolveCallRecord`; `activities / message_history / import_audits /
     bulk_assignment_audits` → `resolveAppendOnly`; `leads / follow_ups / remarks / profiles`
     → `resolveMutable`. Writes happen only when REMOTE wins.
   - `newCursor = max(updated_at)` persisted.
8. Stamp `lastPullAt` + `lastSuccessfulSyncAt`; final status = `failedCount > 0 ? PENDING : SYNCED`.
9. Any exception → status `ERROR` (badge: `Sync issue — retrying`).

### 6.3 Triggers & cadence

- `BackgroundSyncManager`: on login — immediate sync, then every 60s; plus `visibilitychange`,
  `focus`, `online`, Capacitor foreground. Failure backoff 1s→32s, max 6 attempts; resets on
  success/online. Owns its own interval (does not double-start `syncEngine.startAutoSync`).
- `syncEngine` network listeners: `online` → trigger sync only if a session exists;
  `offline` → status `OFFLINE`.
- Manual: SyncStatusBadge button and Settings → Sync Now.

### 6.4 Conflict resolution (SyncConflictResolver)

| Entity class | Rule |
|---|---|
| Append-only (`activities`, `message_history`, `import_audits`, `bulk_assignment_audits`) | Local row with same UUID exists → keep LOCAL (idempotency); else insert remote |
| Mutable (`leads`, `follow_ups`, `remarks`, `profiles`) | Last-write-wins on `updatedAt`; **exact tie → REMOTE wins** (recorded as REMOTE_WON conflict) |
| `call_records` | VERIFIED strictly beats UNVERIFIED; same verification level → LWW on `updatedAt` |

The VERIFIED-priority rule is what makes talk-time tamper-resistant across devices: an
unverified edit from another device cannot downgrade a verified call record.

---

## 7. DATABASE SCHEMA & RLS ENFORCEMENT

### 7.1 Cloud tables (migration 1 unless noted)

| Table | Key columns | Notes |
|---|---|---|
| `organizations` | id, name | root tenant |
| `profiles` | id (auth.users FK), organization_id, email, role, status, name, phone, last_login_at, deleted_at | unique index `(organization_id, LOWER(email)) WHERE deleted_at IS NULL`; org FKs `ON DELETE RESTRICT` |
| `leads` | id, organization_id, business_name, phone/phone_e164/phone_type, status, assigned_to, created_by, updated_by, next_follow_up_at, call_count, deleted_at | profile FKs `ON DELETE SET NULL` |
| `call_records` | id, lead_id, user_id, outcome, duration_seconds, reported_duration_seconds, verification_status, dial_attempt_id, call_status CHECK ('DIAL_ATTEMPT','CONNECTED','NOT_CONNECTED','CANCELLED','UNKNOWN') | migration 3 duration indexes; migration 7 dial columns |
| `activities` | id, organization_id, activity_type, user_id, lead_id, metadata | **append-only** |
| `remarks` | id, lead_id, user_id, content | |
| `follow_ups` | id, lead_id, assigned_to, scheduled_at, status, priority, completed_at | |
| `message_history` | id, lead_id, channel, template_title, status | |
| `import_audits` | id, organization_id, filename, total_rows, imported, updated, duplicates, uploaded_by | |
| `bulk_assignment_audits` (mig 5) | id, organization_id, status CHECK ('PENDING','COMPLETED','PARTIAL','FAILED'), counts, filter_snapshot | RLS select+insert ADMIN-only |

Migration 7: child FKs (`call_records/remarks/follow_ups/message_history → leads`) changed to
`ON DELETE CASCADE`; `leads_delete_policy` = org + (admin OR assigned_to=self OR created_by=self).

### 7.2 RLS policy map (who can do what at the DB layer)

Helpers (SECURITY DEFINER, migration 2): `current_user_org_id()`, `current_user_role()`,
`is_org_admin()`, `is_active_org_user()`; migration 6 adds `current_profile_id()`.

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | org members | (via Edge Function) | org members, immutable fields trigger-guarded | none |
| `leads` | org + (admin OR assigned_to=self OR created_by=self) | admin, OR agent with created_by=self AND (assigned_to=self OR NULL) | same as SELECT | same as SELECT (mig 7) |
| `call_records` | agent: own rows OR rows of own leads | user_id=self | owner | none |
| `remarks` | agent: own rows OR own leads' rows | user_id=self | owner | none |
| `follow_ups` | agent: own rows OR own leads' rows | agent (assigned) | owner | none |
| `activities` | org members | user_id=self | **none** | **none** |
| `message_history` | agent: own rows OR own leads' rows | user_id=self | owner | none |
| `import_audits` | ADMIN only | ADMIN only | none | none |
| `bulk_assignment_audits` | ADMIN only | ADMIN only | none | none |

### 7.3 Immutability triggers (raise these exact errors)

`protect_profile_immutable_fields` (migration 2):
- `'Agents are strictly forbidden from altering user roles.'`
- `'Users cannot alter their organization assignment.'`
- `'Agents cannot alter user activation status.'`
- `'Authentication identity mapping cannot be changed.'`

`protect_lead_immutable_fields` (migration 6):
- `'Agents are strictly forbidden from modifying lead organization boundary.'`
- `'Agents are strictly forbidden from modifying lead creator.'`
- `'Agents are not permitted to reassign leads to other sales agents.'` (self-assign allowed)

### 7.4 Dexie local schema (versions 1–5)

Hooks auto-set `createdAt/updatedAt`, `isSynced = 0` on write, `deletedAt = null` default.
Version 3 adds call-duration indexes; version 5 adds `bulkAssignmentAudits` + dial columns.
`getLeadStats()` and dashboard "today" windows use **local device time** (IST in production).

---

## 8. ACTIVITY TYPE CATALOG (audit stream)

| Type | Emitted by | Key metadata |
|---|---|---|
| `LEAD_CREATED` | createLead | businessName, createdByName |
| `LEAD_IMPORTED` / `IMPORT_COMPLETED` | Excel import | totalRows, uploadedByName, sourceFile |
| `LEAD_ASSIGNED` | assignLead | leadName, newAssigneeId/Name, assignedByAdminName |
| `LEAD_REASSIGNED` | assignLead (change) | + previousAssigneeId/Name |
| `LEAD_UNASSIGNED` | unassignLead | unassignedByAdminName |
| `BULK_ASSIGNMENT_EXECUTED` | bulkAssignLeads | counts, target agent |
| `CALL_INITIATED` | initiateDial | repName, leadName |
| `CALL_COMPLETED` | completeCall | outcome, verificationStatus, durationSeconds, reportedDurationSeconds |
| `CALL_CANCELLED` | cancelCall | — |
| `REMARK_ADDED` | addRemark | author, leadName, content |
| `FOLLOW_UP_CREATED` | scheduleFollowUp | scheduledAt, assignedTo, createdByName |
| `FOLLOW_UP_COMPLETED` | completeFollowUp | — |
| `FOLLOW_UP_CANCELLED` | cancelFollowUp | — |
| `FOLLOW_UP_RESCHEDULED` | rescheduleFollowUp | — |
| `STATUS_CHANGED` | updateLead (status) | newStatus |
| `AGENT_CREATED` | createAgent / Edge Function | agent email/name |
| `AGENT_UPDATED` | updateAgent | — |
| `AGENT_ACTIVATED` / `AGENT_DEACTIVATED` | activate/deactivate | — |
| `AGENT_DELETED` | deleteAgent | — |

Activities are append-only everywhere: no UPDATE/DELETE policies in RLS, no local delete path.

---

## 9. VERBATIM ERROR STRING REFERENCE

### Auth
- `'Please enter both email and password.'`
- `'Invalid email or password.'`
- `'Network error. Please check your internet connection and try again.'`
- `'Your account has not been provisioned by an administrator.'`
- `'Your account is inactive. Please contact your administrator.'`
- `'Authentication failed: No active session received.'`
- `'Authentication server is not configured.'`

### Agent management
- `'Unauthorized: No authenticated user session.'`
- `'Unauthorized: Only administrators are permitted to manage sales agents.'`
- `'Unauthorized: Inactive administrator account.'`
- `'Agent full name is required.'` / `'Please enter the agent full name.'`
- `'Agent email is required.'` / `'Please enter the agent email address.'`
- `'Please enter a valid email address.'`
- `'Password must be at least 6 characters in length.'` / `'Initial password must be at least 6 characters in length.'`
- `'Passwords do not match. Please re-enter.'`
- `` `An account with email "<email>" already exists.` ``
- `` `Agent provisioning failed on the server (HTTP <code>): <message>. No local account was created. Please retry.` ``
- `'Cannot edit administrator accounts through Agent Management.'`
- `'Agent name cannot be empty.'`
- `'Administrators cannot deactivate their own account.'`
- `'Cannot deactivate non-agent accounts through this interface.'`
- `'Administrators cannot delete their own account.'`
- `'Only AGENT accounts can be deleted through this interface.'`
- `` `Agent "<name>" has already been deleted.` ``

### Leads
- `'Business / gym name is required.'` / `'Phone number is required.'`
- `'Duplicate lead: A lead with phone number <phone> already exists (<BusinessName>).`
- `'Lead with id <id> not found.'` / `'Lead with ID "<id>" not found.'`
- `'Another lead with phone number <phone> already exists.'`
- `'PIN code must be exactly 6 digits.'`
- `'Failed to create lead. Please check details.'` / `'Failed to save changes. Please try again.'`
- `'Could not load leads from the local database.'`

### Assignment
- `'Target agent with ID "<id>" not found.'`
- `'Leads can only be assigned to sales representatives with the AGENT role.'`
- `` `Cannot assign lead to inactive agent "<name>".` ``
- `'No leads selected for bulk assignment.'`
- `'Unauthorized: Cross-organization assignment is strictly prohibited.'`
- `'Please select a target sales representative.'`
- `'Failed to load sales agents.'` / `'Failed to update lead assignment.'` / `'Failed to remove assignment.'`

### Calls
- `'Unauthorized: An authenticated user session is required to place calls.'`
- `'Cannot dial lead: No phone number present.'`
- `'No active call attempt found to complete.'`
- `'Please pick a valid follow-up date.'`
- `` `Could not start the call to <businessName>. Please try again.` ``
- `` `Could not save the call outcome for <businessName>. Your notes were not recorded.` ``

### Remarks / follow-ups / messages
- `'Cannot add remark: Lead <id> does not exist.'`
- `'Could not save the remark. Please try again.'`
- `` `Cannot schedule follow up: Lead <id> does not exist.` ``
- `'Follow up <id> not found.'`
- `'Please enter a follow-up title / objective.'` / `'Please select a scheduled date and time.'`
- `'Could not mark the follow-up as done. Please try again.'`
- `'Could not load your follow-ups.'`
- `'Cannot log message: Lead <id> does not exist.'` / `'Cannot log call: Lead <id> does not exist.'`

### WhatsApp / attachments
- `'WhatsApp is unavailable for this phone number.'`
- `'Invalid phone number. WhatsApp messaging cannot be initiated.'`
- `'Could not open WhatsApp. Please ensure WhatsApp or WhatsApp Business is installed on your device.'`
- `'Default catalogue is unavailable. Please select another file.'`
- `'No file selected.'` / `` `File size (<size>) exceeds the 25 MB WhatsApp limit.` ``
- `'Unsupported file type. Please attach a PDF catalogue, image, or document.'`

### Import
- `'The selected workbook contains no sheets.'`
- `'Failed to read Excel file. Please ensure it is a valid .xlsx or .csv file.'`
- `` `Sheet "<name>" not found in workbook.` ``
- `'Missing business name'` / `'Missing phone number'` / `` `Invalid phone format: "<rawPhone>"` ``
- `'Lucknow Landline (0522) - Calling supported, WhatsApp unavailable'`
- `` `Duplicate phone: matches existing lead "<businessName>"` ``
- `'Duplicate phone: appears multiple times in this Excel file'`

### Analytics / reports
- `'Unauthorized: Only active administrators can access organization analytics.'`
- `'Unauthorized: Only active administrators can access Analytics & Reports.'`
- `` `Agent with ID "<agentId>" not found.` ``
- `'Could not load dashboard analytics. Check your connection and try again.'`
- `'Could not load call history. Check your connection and try again.'`

### Sync
- `'Device is offline'` / `'Supabase unconfigured'` / `'Authentication required'`
- `'Supabase client is not initialized or configured.'`
- `'Supabase URL or Anon Key is missing in environment configuration.'`
- `'Invalid Supabase URL format in VITE_SUPABASE_URL.'`

### Backup / settings / misc
- `'Invalid backup: Payload must be a valid JSON object.'`
- `'Missing or invalid schemaVersion in backup header.'`
- `'Missing "data" container object in backup payload.'`
- `` `Duplicate ID "<id>" detected in table "<name>".` ``
- `` `Orphan record in "<child>" (ID: <id>): Referenced leadId "<leadId>" not found in leads table.` ``
- `'Cannot restore: Invalid backup payload.'`
- `` `Database replacement failed: <message>. Previous database state was restored.` ``
- `'Please type "REPLACE" to confirm complete database replacement.'`
- `'Could not load database summary.'` / `'Could not load settings. Please try again.'`
- `'Could not load your sales metrics.'`
- `'The application encountered an unexpected error. Your offline data is safe.'`

---

## 10. ACTION COVERAGE INDEX

| # | Action | Section |
|---|---|---|
| 1 | App cold boot | §1.1 |
| 2 | Login | §1.2 |
| 3 | Sign out | §1.3 |
| 4 | Manual sync | §1.4, §6.2 |
| 5 | View admin overview dashboard | §2.1 |
| 6 | Open org call history | §2.1.1 |
| 7 | Live activity feed | §2.1.2 |
| 8 | Agent performance detail | §2.1.3 |
| 9 | Create lead | §2.2.1 |
| 10 | Edit lead | §2.2.2 |
| 11 | Assign lead | §2.2.3 |
| 12 | Bulk assign leads | §2.2.4 |
| 13 | Delete lead | §2.2.5 |
| 14 | Create agent | §2.3.1 |
| 15 | Edit agent | §2.3.2 |
| 16 | Deactivate/activate agent | §2.3.3 |
| 17 | Delete agent | §2.3.4 |
| 18 | Lead explorer / filters | §2.4.1 |
| 19 | Excel import (4 steps) | §2.4.2.1 |
| 20 | Duplicate cleanup | §2.4.3 |
| 21 | Database health inspector | §2.4.4 |
| 22 | 7 report types | §2.5 |
| 23 | CSV export | §2.5 |
| 24 | Template CRUD + default | §2.6.1 |
| 25 | Catalogue upload/remove | §2.6.2 |
| 26 | Preferences (theme, preview, sync) | §2.6.3 |
| 27 | Backup export | §2.7.1 |
| 28 | Restore merge/replace | §2.7.2 |
| 29 | Agent dashboard | §3.1 |
| 30 | Agent lead list | §3.2 |
| 31 | Lead detail tabs + inline remark | §3.3 |
| 32 | Follow-up complete/cancel from detail | §3.3.2 |
| 33 | Lead timeline | §3.3.5 |
| 34 | Place call (full lifecycle) | §3.4 |
| 35 | Cancel call | §3.4 |
| 36 | WhatsApp pitch send | §3.5 |
| 37 | Schedule follow-up | §3.6.1 |
| 38 | Reschedule follow-up | §3.6.2 |
| 39 | Follow-ups view | §3.6.3 |
| 40 | Agent field lead creation | §3.7 |
| 41 | Realtime receive/notify/reconcile | §4 |
| 42 | Sync push/pull/conflicts | §6 |
| 43 | Backup history | §2.7.3 |
| 44 | Android back-button handling | §1.1 step 9 |
| 45 | Theme toggle | §1.1, §2.6.3 |
