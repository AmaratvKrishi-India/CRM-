# Amaratv Krishi CRM — Admin Dashboard & Performance Analytics (Phase 2L)

## 1. Executive Summary & Dashboard Architecture
Milestone 2L implements the comprehensive **Admin CRM Dashboard** in the single Android APK, allowing administrators to monitor territory-wide sales velocity, verified talk times, pipeline distribution, and individual representative scorecards while maintaining strict offline-first operational integrity.

```text
       ┌─────────────────────────────────────────────────────────────┐
       │                 ADMIN CRM COMMAND CENTER                    │
       │                                                             │
       │  [Admin Overview Screen] (Filters: Date Range & Agent)      │
       │       │                                                     │
       │       ├─► Executive KPI Cards (Leads, Calls, Talk Time)     │
       │       ├─► Sales Pipeline Visualizer (8 Stages)              │
       │       ├─► Agent Performance Scorecards (Cards/Table)        │
       │       ├─► Call History Modal (Outcome & Duration Filter)    │
       │       └─► Live Sales Activity Feed (Realtime WS)            │
       │                                                             │
       │  [AdminAnalyticsService] (Strict ADMIN Role Guard)          │
       │       │                                                     │
       │       ▼                                                     │
       │  [Dexie DB Collections] ─── (Realtime WS Acceleration)      │
       │  (leads, callRecords, activities, followUps, users, etc.)   │
       └─────────────────────────────────────────────────────────────┘
```

---

## 2. KPI Definitions & Zero Fabricated Duration Rule
- **Total Leads**: Count of all non-deleted leads in the organisation.
- **New Leads**: Leads in `NEW` status.
- **Assigned / Unassigned Leads**: Leads with `assignedTo != null` vs `assignedTo == null`.
- **Total Calls**: Sum of call records matching the active date/agent filters.
- **Verified vs Unverified Calls**:
  - `VERIFIED`: Calls with `verificationStatus === 'VERIFIED'`.
  - `UNVERIFIED`: Standard `Intent.ACTION_DIAL` calls or unverified duration attempts.
- **Verified Talk Time**: Sum of `durationSeconds` **strictly** where `verificationStatus === 'VERIFIED'`.
  > **Invariant**: Unverified calls NEVER contribute to verified talk time or average verified duration.
- **Follow-ups**:
  - `Overdue`: `status === 'PENDING'` and `scheduledAt < todayStart`.
  - `Today`: `status === 'PENDING'` and `scheduledAt` falls within today.
  - `Upcoming`: `status === 'PENDING'` and `scheduledAt > todayEnd`.
  - `Completed`: `status === 'COMPLETED'`.
- **WhatsApp Metrics**:
  - `Initiated`: Messages with `sentStatus === 'INITIATED'` or `'SENT'`.
  - `Failed`: Messages with `sentStatus === 'FAILED'`.
  > **Invariant**: Never claims delivery or read status.
- **Import Metrics**: Total batch audits and total rows imported from Excel.

---

## 3. Lead Pipeline Visualization
Visualizes lead distribution across all 8 standard system statuses:
1. `NEW` (Blue)
2. `CONTACTED` (Blue)
3. `INTERESTED` (Purple)
4. `SAMPLE_REQUESTED` (Purple)
5. `FOLLOW_UP` (Amber)
6. `NEGOTIATION` (Purple)
7. `CUSTOMER` (Emerald - Converted)
8. `NOT_INTERESTED` (Rose - Lost)

Tapping any pipeline stage instantly navigates to the Leads list filtered to that specific status.

---

## 4. Sales Representative Performance Scorecards
- **Component**: [`src/components/admin/AgentPerformanceTable.tsx`](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/AgentPerformanceTable.tsx)
- **Mobile-First Card Layout**:
  - Representative name, email/phone, status badge.
  - Leads assigned vs leads worked.
  - Total calls, verified calls count.
  - Verified talk time and average call duration.
  - Follow-ups (completed / total / overdue).
  - Last activity timestamp.
- **Agent Detail Modal (`src/components/admin/AgentPerformanceDetail.tsx`)**:
  - Full metrics breakdown.
  - "Call Agent" button with direct dialer launch.
  - "View Assigned Leads" shortcut.
  - Recent sales activity log stream for that agent.

---

## 5. Organization Call History
- **Component**: [`src/components/admin/AdminCallHistoryModal.tsx`](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/AdminCallHistoryModal.tsx)
- **Filters**:
  - Agent Filter (All / Specific Rep)
  - Verification Filter (All / Verified / Unverified)
  - Outcome Filter (All / Connected / Busy / No Answer / ...)
  - Date Range Filter (Today / Yesterday / Last 7 Days / Last 30 Days / All Time)
  - Text Search (by gym name, agent name, or notes).

---

## 6. Offline-First & Realtime Reactive Flow
- **Offline Integrity**: Dashboard calculates all metrics directly from local Dexie tables when offline. Disconnections never blank out or corrupt metrics.
- **Realtime Acceleration**: `RealtimeService.onActivity` and `RealtimeService.onEntityChange` trigger targeted data recalculation whenever a lead, call, assignment, or follow-up occurs across the team.

---

## 7. Security & Role Boundary
- `AdminAnalyticsService` methods enforce role authorization (`actor?.role === 'ADMIN'`).
- `AGENT` requests are rejected with `Unauthorized: Only administrators can access organization KPIs.`
- Organization isolation is preserved through `organization_id` scoping.
