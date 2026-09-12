# 04 — Navigation Map

**Document status:** CURRENT
**Last reviewed:** 2026-09-11
**Source of truth:** [`src/App.tsx`](../../src/App.tsx), [`AdminShell.tsx`](../../src/components/admin/AdminShell.tsx), and feature components

## Routing model

The application is a React SPA without `react-router-dom`. Navigation is state-based so the same local data layer and lifecycle state remain available offline.

```text
Unauthenticated → LoginScreen
Authenticated ADMIN → AdminShell
Authenticated AGENT → SalesAppContent
```

## Admin shell

[`AdminShell`](../../src/components/admin/AdminShell.tsx) exposes:

1. **HOME** — organization dashboard, KPIs, and live activity
2. **LEADS** — organization-wide lead management and assignment
3. **AGENTS** — provisioning, status, performance, and lifecycle actions
4. **DATA** — import, duplicate review, data health, and backup/restore
5. **REPORTS** — analytics and CSV exports
6. **SETTINGS** — shared settings and account actions

Admin preview can enter the agent workspace and has an explicit return action.

## Agent workspace

[`SalesAppContent`](../../src/App.tsx) exposes:

1. **DASHBOARD** — personal metrics and today's work
2. **LEADS** — assigned leads, search, bounded pagination, and quick actions
3. **FOLLOW UPS** — overdue, today, and upcoming callbacks

Additional shared state-based views include lead detail, settings, backup/restore, call outcome, and WhatsApp composition. The `IMPORT` state also exists in the shared workspace implementation, but its visible entry points are ADMIN-gated; AGENT users do not receive Excel-import permission.

## Shared flows

- [`CallOutcomeModal`](../../src/components/leads/CallOutcomeModal.tsx) records outcome, note, duration status, and optional follow-up.
- [`LeadDetailView`](../../src/components/leads/LeadDetailView.tsx) exposes history and scoped lead actions.
- [`ExcelImporter`](../../src/components/import/ExcelImporter.tsx) handles mapping, preview, duplicate classification, and import audit.
- [`SyncStatusBadge`](../../src/components/sync/SyncStatusBadge.tsx) and [`SyncRecoveryPanel`](../../src/components/sync/SyncRecoveryPanel.tsx) expose retained sync state and recovery.
- [`BackupRestoreModal`](../../src/components/backup/BackupRestoreModal.tsx) handles validated JSON backup and restore.

## Navigation invariants

- The server-verified role determines the shell.
- UI visibility never replaces RLS or repository access checks.
- Android back navigation closes the topmost modal/view before minimizing the app.
- Skip links, focus management, tab semantics, and keyboard navigation are part of the current accessibility contract.
