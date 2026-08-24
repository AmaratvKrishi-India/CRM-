# 14 - MIGRATION HISTORY

This document provides a comprehensive history of the database migrations applied to the Amaratv Krishi Field Sales CRM. It details the evolution of the database schema, security policies (RLS), real-time configurations, and performance optimizations.

> [!NOTE]
> Evolution of Row Level Security (RLS): 
> - **Migration 2** established organization-level RLS (users can see data within their organization).
> - **Migration 6** implemented strict agent-level lead isolation (agents can only see leads assigned to them or created by them).

---

### Migration 1: [20260820000001_phase2e_central_schema.sql](file:///c:/Users/PC/Desktop/calling%20app/supabase/migrations/20260820000001_phase2e_central_schema.sql) (10,380 bytes)

**Summary:** Establishes the core central schema for the CRM application.

*   **Extensions Created:** `uuid-ossp`
*   **Tables Created (9):**
    *   `organizations`
    *   `profiles`
    *   `leads`
    *   `call_records`
    *   `activities`
    *   `remarks`
    *   `follow_ups`
    *   `message_history`
    *   `import_audits`
*   **Indexes Created (13):**
    *   `idx_profiles_org_email` (UNIQUE) on `profiles(organization_id, LOWER(email)) WHERE deleted_at IS NULL`
    *   `idx_profiles_org_role_status` on `profiles(organization_id, role, status)`
    *   `idx_leads_org_assigned_deleted` on `leads(organization_id, assigned_to, deleted_at)`
    *   `idx_leads_org_status_deleted` on `leads(organization_id, status, deleted_at)`
    *   `idx_leads_org_locality_deleted` on `leads(organization_id, locality, deleted_at)`
    *   `idx_call_records_org_lead` on `call_records(organization_id, lead_id)`
    *   `idx_call_records_org_user` on `call_records(organization_id, user_id)`
    *   `idx_activities_org_lead` on `activities(organization_id, lead_id)`
    *   `idx_activities_org_user` on `activities(organization_id, user_id)`
    *   `idx_remarks_org_lead` on `remarks(organization_id, lead_id)`
    *   `idx_follow_ups_org_lead_status` on `follow_ups(organization_id, lead_id, status)`
    *   `idx_message_history_org_lead` on `message_history(organization_id, lead_id)`
    *   `idx_import_audits_org_user` on `import_audits(organization_id, uploaded_by)`

---

### Migration 2: [20260820000002_phase2e_rls_policies.sql](file:///c:/Users/PC/Desktop/calling%20app/supabase/migrations/20260820000002_phase2e_rls_policies.sql) (10,454 bytes)

**Summary:** Implements initial Organization-Level Row Level Security (RLS).

*   **Security Helper Functions Created (4):**
    *   `current_user_org_id()`: Returns the organization ID for the authenticated user.
    *   `current_user_role()`: Returns the role of the authenticated user.
    *   `is_org_admin()`: Checks if the current user has the 'Admin' role.
    *   `is_active_org_user()`: Checks if the user is active in the organization.
*   **RLS Enabled on Tables (9):** `organizations`, `profiles`, `leads`, `call_records`, `activities`, `remarks`, `follow_ups`, `message_history`, `import_audits`
*   **Initial RLS Policies (Organization-Level):**
    *   `organizations`:
        *   "Users can view their own organization" (SELECT)
    *   `profiles`:
        *   "Users can view profiles in their organization" (SELECT)
        *   "Admins can manage profiles in their organization" (ALL)
    *   `leads`:
        *   "Users can view leads in their organization" (SELECT)
        *   "Users can insert leads in their organization" (INSERT)
        *   "Users can update leads in their organization" (UPDATE)
        *   "Admins can delete leads in their organization" (DELETE)
    *   `call_records`:
        *   "Users can view call records in their organization" (SELECT)
        *   "Users can insert call records in their organization" (INSERT)
        *   "Users can update own call records" (UPDATE)
    *   `activities`:
        *   "Users can view activities in their organization" (SELECT)
        *   "Users can insert activities in their organization" (INSERT)
    *   `remarks`:
        *   "Users can view remarks in their organization" (SELECT)
        *   "Users can insert remarks in their organization" (INSERT)
        *   "Users can update own remarks" (UPDATE)
    *   `follow_ups`:
        *   "Users can view follow ups in their organization" (SELECT)
        *   "Users can insert follow ups in their organization" (INSERT)
        *   "Users can update follow ups in their organization" (UPDATE)
    *   `message_history`:
        *   "Users can view message history in their organization" (SELECT)
        *   "Users can insert message history in their organization" (INSERT)
    *   `import_audits`:
        *   "Users can view import audits in their organization" (SELECT)
        *   "Admins can insert import audits in their organization" (INSERT)
*   **Triggers:**
    *   Created function `protect_profile_immutable_fields()`
    *   Created trigger `trg_protect_profile_immutable_fields` on `profiles`

---

### Migration 3: [20260820000003_phase2j_call_duration_indexes.sql](file:///c:/Users/PC/Desktop/calling%20app/supabase/migrations/20260820000003_phase2j_call_duration_indexes.sql) (767 bytes)

**Summary:** Adds performance indexes specifically for call analytics.

*   **Indexes Created (2):**
    *   `idx_call_records_org_user_verif_started` on `call_records(organization_id, user_id, verification_status, started_at DESC)`: Optimizes per-user call analytics and verification-status filtering.
    *   `idx_call_records_org_lead_started` on `call_records(organization_id, lead_id, started_at DESC)`: Optimizes per-lead call history lookups.

---

### Migration 4: [20260820000004_phase2k_realtime_publication.sql](file:///c:/Users/PC/Desktop/calling%20app/supabase/migrations/20260820000004_phase2k_realtime_publication.sql) (2,678 bytes)

**Summary:** Configures Supabase Realtime subscriptions for UI responsiveness.

*   **REPLICA IDENTITY FULL** set on 8 tables:
    *   `profiles`, `leads`, `call_records`, `activities`, `remarks`, `follow_ups`, `message_history`, `import_audits`
*   **Realtime Publication:** Added the above 8 tables to the `supabase_realtime` publication.

---

### Migration 5: [20260820000005_phase2k_bulk_assignment.sql](file:///c:/Users/PC/Desktop/calling%20app/supabase/migrations/20260820000005_phase2k_bulk_assignment.sql) (2,729 bytes)

**Summary:** Introduces bulk assignment tracking and auditing capabilities.

*   **Tables Created (1):**
    *   `bulk_assignment_audits` (16 columns)
*   **Indexes Created (2):**
    *   `idx_bulk_assign_org_target_started` on `bulk_assignment_audits(organization_id, target_agent_id, started_at DESC)`
    *   `idx_bulk_assign_org_performed` on `bulk_assignment_audits(organization_id, performed_by, started_at DESC)`
*   **RLS Policies (Admin-only):**
    *   "Admins can view bulk assignment audits in their organization" (SELECT)
    *   "Admins can insert bulk assignment audits in their organization" (INSERT)
*   **Realtime:** Set REPLICA IDENTITY FULL on `bulk_assignment_audits` and added it to the `supabase_realtime` publication.

---

### Migration 6: [20260820000006_rls_agent_lead_isolation.sql](file:///c:/Users/PC/Desktop/calling%20app/supabase/migrations/20260820000006_rls_agent_lead_isolation.sql) (14,191 bytes)

**Summary:** Replaces Organization-Level RLS with strict **Agent Lead Isolation**. Agents can now only interact with leads assigned to them or created by them.

*   **Helper Functions Created:**
    *   `current_profile_id()`: Returns the profile ID of the authenticated user.
*   **RLS Policy Overhaul:** Drops previous policies and recreates them across 7 tables:
    *   `leads`:
        *   "Admins can view all leads in their organization" (SELECT)
        *   "Agents can view assigned or created leads" (SELECT: `assigned_to = current_profile_id() OR created_by = current_profile_id()`)
        *   "Admins can update all leads in their organization" (UPDATE)
        *   "Agents can update assigned or created leads" (UPDATE)
        *   "Users can insert leads in their organization" (INSERT)
        *   "Admins can delete leads in their organization" (DELETE)
    *   `call_records`:
        *   "Admins can view all call records in their organization" (SELECT)
        *   "Agents can view call records for assigned leads" (SELECT)
        *   "Admins can update all call records in their organization" (UPDATE)
        *   "Agents can update own call records" (UPDATE)
        *   "Users can insert call records for assigned leads" (INSERT)
        *   "Admins can delete call records in their organization" (DELETE)
    *   `follow_ups`:
        *   "Admins can view all follow_ups in their organization" (SELECT)
        *   "Agents can view follow_ups for assigned leads" (SELECT)
        *   "Admins can update all follow_ups in their organization" (UPDATE)
        *   "Agents can update own follow_ups" (UPDATE)
        *   "Users can insert follow_ups for assigned leads" (INSERT)
        *   "Admins can delete follow_ups in their organization" (DELETE)
    *   `remarks`:
        *   "Admins can view all remarks in their organization" (SELECT)
        *   "Agents can view remarks for assigned leads" (SELECT)
        *   "Admins can update all remarks in their organization" (UPDATE)
        *   "Agents can update own remarks" (UPDATE)
        *   "Users can insert remarks for assigned leads" (INSERT)
        *   "Admins can delete remarks in their organization" (DELETE)
    *   `activities`:
        *   "Admins can view all activities in their organization" (SELECT)
        *   "Agents can view activities for assigned leads" (SELECT)
        *   "Users can insert activities for assigned leads" (INSERT)
        *   "Admins can delete activities in their organization" (DELETE)
    *   `message_history`:
        *   "Admins can view all message_history in their organization" (SELECT)
        *   "Agents can view message_history for assigned leads" (SELECT)
        *   "Users can insert message_history for assigned leads" (INSERT)
        *   "Admins can delete message_history in their organization" (DELETE)
    *   `import_audits`:
        *   "Admins can view all import_audits in their organization" (SELECT)
        *   "Admins can insert import_audits in their organization" (INSERT)
*   **Triggers:**
    *   Created function `protect_lead_immutable_fields()`
    *   Created trigger `trg_protect_lead_immutable_fields` on `leads`

---

### Migration 7: [20260820000007_call_records_extended_fields_and_lead_delete.sql](file:///c:/Users/PC/Desktop/calling%20app/supabase/migrations/20260820000007_call_records_extended_fields_and_lead_delete.sql)

**Status (2026-08-23):** Applied to LOCAL Docker Supabase only (`supabase_migrations.schema_migrations` version `20260820000007`, verified via catalog queries). NOT applied to the cloud project — cloud application is a deliberate release step (production mutations prohibited during the bugfix task).

**Summary:** Supports the BUG-1 and BUG-8 fixes from the final end-to-end functional audit remediation.

*   **call_records extended fields (BUG-1):**
    *   `dial_attempt_id uuid NULL` — idempotency key linking the call record to its dial attempt
    *   `reported_duration_seconds integer NULL` — device-reported duration, kept distinct from verified `duration_seconds`
    *   `call_status text NULL` with CHECK constraint `call_records_call_status_check` (allowed statuses)
*   **Cloud hard-delete support (BUG-8):**
    *   Child FKs referencing `leads(id)` changed RESTRICT → `ON DELETE CASCADE`: `call_records`, `remarks`, `follow_ups`, `message_history`
    *   `activities.lead_id` FK stays `ON DELETE SET NULL` (activity audit trail preserved)
    *   New RLS policy `leads_delete_policy` (FOR DELETE), mirrors the update policy: org-scoped; admins may delete any org lead, agents only leads they created or are assigned to
*   **Backward compatibility:** all new columns nullable; existing rows unaffected; no data backfill required.
