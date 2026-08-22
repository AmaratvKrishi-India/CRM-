# 04 - NAVIGATION MAP

## Client-Side Routing Architecture
- The app is a React Single Page Application (SPA).
- No react-router-dom is used; navigation is state-based using conditional rendering in [`App.tsx`](file:///c:/Users/PC/Desktop/calling%20app/src/App.tsx), [`AdminShell.tsx`](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/AdminShell.tsx), and `SalesAppContent.tsx` to maintain offline capabilities and simplify state.

## App Root (`App.tsx`)
- Unauthenticated -> [`<LoginScreen />`](file:///c:/Users/PC/Desktop/calling%20app/src/components/auth/LoginScreen.tsx)
- Authenticated + ADMIN -> [`<AdminShell />`](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/AdminShell.tsx)
- Authenticated + AGENT -> `<SalesAppContent />` *(Rendered in App.tsx)*

## Admin Shell Navigation (`AdminShell.tsx`)
Bottom Navigation Bar with 6 main tabs (`AdminTab` type):
1. **HOME**: [`<AdminDashboardView />`](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/AdminDashboardView.tsx) - Real-time KPIs, pipeline, live activity ticker.
2. **LEADS**: [`<AdminLeadsView />`](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/AdminLeadsView.tsx) - Organization-wide lead management, assignments.
3. **AGENTS**: [`<AdminAgentsView />`](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/AdminAgentsView.tsx) - Provisioning, performance table, agent lifecycle.
4. **DATA**: [`<AdminDataManagementView />`](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/data/AdminDataManagementView.tsx) - Imports, duplicates, data health.
5. **REPORTS**: [`<AdminReportsView />`](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/AdminReportsView.tsx) - Advanced analytics, agent productivity, CSV exports.
6. **SETTINGS**: [`<SettingsModal />`](file:///c:/Users/PC/Desktop/calling%20app/src/components/settings/SettingsModal.tsx) - Theme, backup/restore, device settings.

*Note: Admins can switch to "Sales Mode" to view the agent interface.*

## Sales Agent Navigation (`SalesAppContent.tsx`)
Bottom Navigation Bar with 3 main tabs (`AppTab` type):
1. **DASHBOARD**: [`<SalesDashboard />`](file:///c:/Users/PC/Desktop/calling%20app/src/components/dashboard/SalesDashboard.tsx) - Personal metrics, today's tasks.
2. **LEADS**: [`<MinimalLeadsList />`](file:///c:/Users/PC/Desktop/calling%20app/src/components/leads/MinimalLeadsList.tsx) - My assigned leads, quick actions.
3. **FOLLOW UPS**: [`<FollowUpsView />`](file:///c:/Users/PC/Desktop/calling%20app/src/components/followups/FollowUpsView.tsx) - Overdue, Today, and Upcoming callbacks.

Additional Full-Screen Views/Modals:
- **LEAD DETAIL**: [`<LeadDetailView />`](file:///c:/Users/PC/Desktop/calling%20app/src/components/leads/LeadDetailView.tsx) - Deep dive into a single lead (timeline, info, actions).
- **IMPORT**: [`<ExcelImporter />`](file:///c:/Users/PC/Desktop/calling%20app/src/components/import/ExcelImporter.tsx) - Excel upload wizard (accessible via Data tab for Admin).
- **SETTINGS**: [`<SettingsModal />`](file:///c:/Users/PC/Desktop/calling%20app/src/components/settings/SettingsModal.tsx) - User preferences, manual sync trigger.

## Action Modals
List the key modal components that overlay the main views:
- [`<CallOutcomeModal />`](file:///c:/Users/PC/Desktop/calling%20app/src/components/leads/CallOutcomeModal.tsx) - Post-call logging screen.
- [`<WhatsAppComposeModal />`](file:///c:/Users/PC/Desktop/calling%20app/src/components/whatsapp/WhatsAppComposeModal.tsx) - Template selection and sending.
- [`<FollowUpModal />`](file:///c:/Users/PC/Desktop/calling%20app/src/components/followups/FollowUpModal.tsx) - Scheduling reminders.
- [`<LeadAssignmentModal />`](file:///c:/Users/PC/Desktop/calling%20app/src/components/leads/LeadAssignmentModal.tsx) & [`<BulkLeadAssignmentModal />`](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/BulkLeadAssignmentModal.tsx) - Admin assignment interfaces.
- [`<CreateAgentModal />`](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/CreateAgentModal.tsx), [`<EditAgentModal />`](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/EditAgentModal.tsx), [`<DeleteAgentModal />`](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/DeleteAgentModal.tsx) - Agent management.
- [`<BackupRestoreModal />`](file:///c:/Users/PC/Desktop/calling%20app/src/components/backup/BackupRestoreModal.tsx) - Disaster recovery operations.
