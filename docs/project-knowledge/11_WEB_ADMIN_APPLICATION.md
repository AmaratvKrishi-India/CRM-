# 11 - WEB ADMIN APPLICATION

This document covers the administrative interfaces and capabilities available to the `ADMIN` role in the Amaratv Krishi Field Sales CRM.

## Architecture
- Rendered conditionally via `[AdminShell](file:///c:/Users/PC/Desktop/calling app/src/components/admin/AdminShell.tsx)` in `App.tsx` when `currentUser.role === 'ADMIN'`.
- Fully responsive (mobile-friendly, but optimized for desktop/tablet analytics).
- Communicates directly with the local Dexie store. Syncs transparently with Supabase.
- Leverages Supabase Realtime for live updates across the organization.

## Dashboard (`[AdminDashboardView](file:///c:/Users/PC/Desktop/calling app/src/components/admin/AdminDashboardView.tsx)`)
- **Top-level KPIs**: Total Leads, Active Agents, Total Calls Today, Verified Talk Time.
- **Pipeline Funnel**: Visual breakdown of NEW -> CONTACTED -> INTERESTED -> SAMPLE -> CUSTOMER.
- **Agent Scorecards**: List of online agents, their daily call volume, and talk time.
- **Live Activity Ticker**: Real-time scrolling feed of calls, updates, and assignments across the organization.

## Lead Management (`[AdminLeadsView](file:///c:/Users/PC/Desktop/calling app/src/components/admin/AdminLeadsView.tsx)` & Bulk Operations)
- Master list of all organization leads.
- Filtering by Status, Assigned Agent, City.
- Checkbox multi-select for Bulk Assignment (`[BulkLeadAssignmentModal](file:///c:/Users/PC/Desktop/calling app/src/components/admin/BulkLeadAssignmentModal.tsx)`).
- Direct reassignment from one agent to another (triggers immutability updates on Supabase).

## Agent Management (`[AdminAgentsView](file:///c:/Users/PC/Desktop/calling app/src/components/admin/AdminAgentsView.tsx)`)
- Full agent lifecycle: Create, Edit, Deactivate, Delete.
- Creation (`[CreateAgentModal](file:///c:/Users/PC/Desktop/calling app/src/components/admin/CreateAgentModal.tsx)`) creates auth user via `create-agent` Edge Function, bypassing client-side PKCE limitations.
- Password-less management (admins can create, but passwords are not stored locally).
- Soft deletion (historical call records/remarks remain intact).

## Reports & Analytics (`[AdminReportsView](file:///c:/Users/PC/Desktop/calling app/src/components/admin/AdminReportsView.tsx)`)
- Multi-dimensional reporting tabs: Leads, Calls, Productivity, Follow-ups, WhatsApp, Imports.
- Date range filtering (Today, Last 7 Days, This Month, All Time).
- Agent comparison metrics (Conversion rate, call-to-interest ratio).
- Export capability: Generates CSV files, sanitizes cell data to prevent spreadsheet formula injection.

## Data Governance (`[AdminDataManagementView](file:///c:/Users/PC/Desktop/calling app/src/components/admin/AdminDataManagementView.tsx)`)
- Central hub for data health.
- Excel Importer wizard.
- Duplicate detection and cleanup tools.
- Real-time Sync health inspection.
- Backup & Restore (`[BackupRestoreModal](file:///c:/Users/PC/Desktop/calling app/src/components/admin/BackupRestoreModal.tsx)`) for generating full-system JSON snapshots.
