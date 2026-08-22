# 07 - SUPABASE SECURITY MODEL

This document outlines the comprehensive security architecture and Row Level Security (RLS) model implemented in the Amaratv Krishi Field Sales CRM.

## Security Helper Functions (5 total)

The security model relies on five core helper functions to efficiently evaluate policies without repeated self-joins or complex subqueries. All helper functions are created as `SECURITY DEFINER`, `STABLE`, and explicitly set `SET search_path = public` to prevent search path hijacking.

1. `current_user_org_id()` -> `UUID`
   - Selects `organization_id` from the `profiles` table where `auth_user_id = auth.uid()`.
   - Used to enforce the primary organization boundary.
2. `current_user_role()` -> `TEXT`
   - Selects `role` from the `profiles` table where `auth_user_id = auth.uid()`.
3. `is_org_admin()` -> `BOOLEAN`
   - Returns `true` if `current_user_role() = 'ADMIN'`, otherwise `false`.
4. `is_active_org_user()` -> `BOOLEAN`
   - Returns `true` if `current_user_org_id() IS NOT NULL`, otherwise `false`.
5. `current_profile_id()` -> `UUID` *(Introduced in Migration 6)*
   - Selects `id` from the `profiles` table where `auth_user_id = auth.uid()`.
   - Used for direct agent isolation checks based on profile UUIDs instead of auth UUIDs.

## RLS Policy Architecture

Row Level Security (RLS) is strictly **enabled** on ALL 10 application tables. Below are the FINAL active policies, incorporating overrides from Migration 6.

### leads (3 policies)

- **leads_select_policy**: Users can select leads where the lead's `organization_id` matches their own AND they are either an `ADMIN`, the lead is assigned to their `current_profile_id()`, or the lead was created by their `current_profile_id()`.
- **leads_insert_policy**: Users can insert leads into their own organization AND they are either an `ADMIN`, or they are creating the lead themselves (`created_by = current_profile_id()`) and assigning it to themselves (`assigned_to = current_profile_id()` or `NULL`).
- **leads_update_policy**: Follows the same logic as the select policy (org match AND (admin OR assigned_to=self OR created_by=self)).

### call_records (3 policies)

- **SELECT**: Org match AND (admin OR `user_id` matches self OR `lead_id` is in the subquery of accessible leads).
- **INSERT**: Org match AND (admin OR `user_id` matches self).
- **UPDATE**: Org match AND (admin OR `user_id` matches self).

### follow_ups, remarks, activities, message_history

These tables follow the same pattern as `call_records`, relying on a `lead_id` subquery to determine access. Users can access these records if they are in the same organization and either have admin privileges, own the record, or have access to the parent lead.

### import_audits

- **SELECT**: Admin-only access within the same organization.
- **INSERT**: Admin-only access within the same organization.

### bulk_assignment_audits

- **SELECT**: Admin-only access within the same organization.
- **INSERT**: Admin-only access within the same organization.

### organizations

- **SELECT**: Accessible by any active user where `id = current_user_org_id()`.
- **UPDATE**: Admin-only.

### profiles

- **SELECT**: Accessible by any active user within the same organization.
- **INSERT**: Admin-only.
- **UPDATE**: Users can update their own profile; admins can update any profile within their organization.

## Immutability Triggers (2)

To prevent privilege escalation and unauthorized reassignment, immutability triggers block modification of critical fields.

1. `protect_profile_immutable_fields()`
   - Blocks non-admin users from changing `role`, `organization_id`, `status`, or `auth_user_id` on the `profiles` table.
2. `protect_lead_immutable_fields()`
   - Blocks non-admin users from changing a lead's `organization_id` or `created_by` field.
   - Blocks non-admin users from reassigning leads to other agents.

## Security Boundaries

The CRM architecture enforces strict data silos and operational hierarchies:

- **Organization boundary**: Enforced rigidly by checking `current_user_org_id()` on every policy. Cross-organization data access is impossible (0 rows visible).
- **Agent isolation**: Enforced by using `current_profile_id()` to check `assigned_to` or `created_by` fields. Agents cannot see or modify leads or activities assigned to other agents.
- **Admin supremacy**: Enforced by `is_org_admin()`, which explicitly bypasses agent-level restrictions within the same organization, granting full visibility and management capabilities to administrators.
- **Cross-org**: Complete isolation, 0 rows visible.
- **Service role key**: The Supabase service role key is NEVER utilized in client-side code, verified statically by `securitySecretScan.test.ts`.
- **Android**: `allowBackup=false` is enforced to prevent local data extraction.
- **SQL**: `SET search_path = public` is explicitly defined on all trigger and helper functions to neutralize search path vulnerabilities.
