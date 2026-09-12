# 11 — Web and Admin Application

**Document status:** CURRENT
**Last reviewed:** 2026-09-10
**Source of truth:** `src/App.tsx`, `src/components/admin/`, `src/components/`, and `src/services/`

## Shells and roles

`src/App.tsx` routes authenticated users by their verified profile role:

- `ADMIN` enters [`AdminShell`](../../src/components/admin/AdminShell.tsx), with organization-wide dashboards, leads, agents, reports, live activity, and data-management tools.
- `AGENT` enters the field-sales workspace with dashboard, leads, follow-ups, lead detail, import where permitted, call outcome, WhatsApp, backup, and settings flows.
- Admin preview can enter the agent workspace and provides an explicit return path to the admin shell.

The UI is not the authorization boundary. Every repository and server request remains account-scoped, and PostgreSQL RLS is authoritative.

## Admin capabilities

### Dashboard and live activity

`AdminDashboardView` and `LiveActivityFeed` provide organization KPIs, lead activity, call outcomes, and live updates. Realtime events are reconciled through the same scoped local data layer.

### Lead management

`AdminLeadsView` supports lead review, create/edit, assignment, filtering, and access-aware detail views. `BulkLeadAssignmentModal` performs bounded bulk assignment and records an audit entry for the operation.

### Agent management

`AdminAgentsView`, `CreateAgentModal`, `EditAgentModal`, `DeleteAgentModal`, and `AgentCard` manage the agent lifecycle. Creation calls the authenticated `create-agent` Edge Function; the service role key never reaches the browser.

### Reporting and data management

`AdminReportsView` and the reporting services provide operational summaries and CSV export. `AdminDataManagementView` exposes backup/restore and controlled data-maintenance actions subject to the documented deletion and recovery policy.

## Agent capabilities

- Dashboard with assigned-lead metrics and pending follow-ups.
- Lead list, search, bounded pagination, detail, remarks, assignment visibility, and call history.
- Native dialer launch with outcome logging that distinguishes verified duration from unverified dial attempts.
- Follow-up scheduling and local notifications.
- Intent-based WhatsApp message composition and catalogue attachment flow.
- Offline-first writes, visible sync state, retained failures, conflict/recovery controls, and account-scoped data.
- Day/night theme and keyboard/mobile accessibility support.

## UI invariants

- A visible error means the write result is not silently presented as successful.
- Destructive actions require confirmation and preserve the audit/recovery rules.
- Admin screens show organization-wide data only when the server scope permits it.
- Agent screens never rely on client filtering alone to hide another agent's data.
- Call cancellation records no fabricated outcome or talk time.

## Related documents

- [01 — Project overview](./01_PROJECT_OVERVIEW.md)
- [02 — System architecture](./02_SYSTEM_ARCHITECTURE.md)
- [03 — Roles and permissions](./03_ROLES_AND_PERMISSIONS.md)
- [04 — Navigation map](./04_NAVIGATION_MAP.md)
- [07 — Supabase security model](./07_SUPABASE_SECURITY_MODEL.md)
- [08 — Sync and realtime architecture](./08_SYNC_REALTIME_ARCHITECTURE.md)
