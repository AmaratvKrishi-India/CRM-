# Amaratv Krishi CRM — Analytics & Reports Architecture (Phase 2M)

## 1. Executive Summary & Architecture Overview
Milestone 2M implements the comprehensive **Admin Analytics & Reporting Suite** directly within the single Android APK. The reporting layer provides multi-dimensional sales intelligence across 7 core categories: Leads, Calls, Agent Productivity, Follow-ups, WhatsApp, Spreadsheet Imports, and Chronological Activity Logs.

```text
       ┌─────────────────────────────────────────────────────────────┐
       │                ADMIN ANALYTICS & REPORTS SUITE              │
       │                                                             │
       │  [AdminReportsView] (Tabs: Leads, Calls, Agents, etc.)      │
       │       │                                                     │
       │       ├─► ReportFilterBar (Date Presets, Rep, Locality)     │
       │       ├─► ReportKpiCard (Structured metric tiles)           │
       │       ├─► Detailed Metric Tables & Pipeline Visualizers     │
       │       └─► Sanitized CSV Export (Leads, Calls, Agents, etc.) │
       │                                                             │
       │  [AdminReportsService] (Strict ADMIN-Only Authorization)    │
       │       │                                                     │
       │       ▼                                                     │
       │  [Local Dexie Database] ◄─── (Realtime WS Ingest & Push)    │
       │  (leads, callRecords, activities, followUps, users, etc.)   │
       └─────────────────────────────────────────────────────────────┘
```

---

## 2. Seven Core Report Categories

### A. Lead Report
- **Metrics**: Total leads, new leads, assigned leads, unassigned leads, converted customers, conversion rate percentage.
- **Breakdown**: Count per status (`NEW`, `CONTACTED`, `INTERESTED`, `SAMPLE_REQUESTED`, `FOLLOW_UP`, `NEGOTIATION`, `CUSTOMER`, `NOT_INTERESTED`, etc.).
- **Attribution**: Leads created by each agent vs leads currently assigned to each agent.
- **Filters**: Date range presets, Representative, Locality, and Status.

### B. Call Report (Strict Verified Duration Invariant)
- **Metrics**: Total calls logged, verified calls, unverified calls, total verified talk time, average verified call duration, longest verified call.
- **Zero Fake Duration**: Unverified calls (`verificationStatus === 'UNVERIFIED'`) are counted separately and strictly excluded from verified talk-time sums and averages.
- **Distributions**: Calls by outcome (`CONNECTED`, `BUSY`, `NO_ANSWER`, `WRONG_NUMBER`, `CALL_BACK`), calls by calendar day, and verified talk time per sales representative.

### C. Agent Productivity Report
- **Scorecards per Agent**:
  - Leads created vs assigned.
  - Total calls made, verified calls count.
  - Verified talk time and average call duration.
  - Follow-ups created vs completed.
  - WhatsApp templates initiated.
  - Samples requested vs customers converted.
  - Conversion rate percentage (`converted / assigned * 100`).
  - Last activity timestamp and last login date.

### D. Follow-up Report
- **Status Classification**: Total follow-ups, scheduled today, upcoming, overdue, completed, and cancelled.
- **Ratios**: Overall completion percentage and overdue percentage.
- **Rep Breakdown**: Completion and overdue counts per representative.

### E. WhatsApp Report
- **Engagement**: Total messages initiated vs failed.
- **0522 Landline Guard**: Landline destinations prevented from sending WhatsApp.
- **Template Analytics**: Usage frequency per pitch template and identified top-performing template.

### F. Spreadsheet Import Report
- **Audit Logs**: Total batch imports, total leads ingested, duplicate rows skipped, and invalid rows filtered.
- **History**: Batch filenames, uploader attribution, timestamps, and row counts.

### G. Activity Stream Report
- **Chronological Audit Feed**: Lead creation, assignment, reassignment, call completions, follow-up scheduling, and WhatsApp transmissions with full actor attribution.

---

## 3. Date Handling & Filter Presets
Consistent local timezone handling supporting 7 presets:
- `TODAY`: 00:00:00 to 23:59:59 today.
- `YESTERDAY`: 00:00:00 to 23:59:59 yesterday.
- `LAST_7_DAYS`: Rolling 7 days from now.
- `LAST_30_DAYS`: Rolling 30 days from now.
- `THIS_MONTH`: First day of current month to now.
- `PREV_MONTH`: First to last day of previous month.
- `ALL_TIME`: Full historical dataset.
- `CUSTOM`: User-specified start and end ISO dates.

---

## 4. Sanitized CSV Export Engine
- **Method**: `AdminReportsService.exportReportToCSV(actor, reportType, filters)`
- **Security & Data Sanitization**:
  - Strictly accessible only to `ADMIN`.
  - Passwords, auth tokens, Supabase API keys, and internal secrets are completely omitted.
  - All text cells are escaped to prevent CSV formula injection (`"` escaping).

---

## 5. Offline-First & Realtime Integration
- **Offline Operational Source**: All reports are computed directly against local Dexie IndexedDB tables.
- **Realtime Acceleration**: Incoming Supabase Realtime events (`RealtimeService.onActivity` and `onEntityChange`) trigger non-destructive metric recalculations.

---

## 6. Security Model
- **UI Guard**: Reports navigation tab is rendered exclusively in `AdminShell` when `currentUser.role === 'ADMIN'`.
- **Service Guard**: Every method in `AdminReportsService` enforces `assertAdmin(actor)`, throwing `Unauthorized` errors on agent invocation.
- **RLS Isolation**: Central database operations remain scoped to the tenant `organization_id`.
