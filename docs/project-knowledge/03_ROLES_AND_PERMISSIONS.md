# 03 - ROLES & PERMISSIONS

## Identity System
- Supabase Auth (email/password) -> `auth.users`
- CRM Profiles -> `public.profiles` (1-to-1 with auth.users via `auth_user_id`)

## Defined Roles
Only two roles exist in the system (`UserRole` type):
1. **ADMIN**: Organization administrator. Has unrestricted access to all data within their organization. Can provision new agents, view all reports, reassign leads, and access bulk operations.
2. **AGENT**: Field sales representative. Strictly isolated. Can only access leads explicitly assigned to them or created by them.

## Data Isolation Boundaries
- **Organization Boundary**: Enforced on ALL roles. A user can only access rows where `organization_id` matches their own `current_user_org_id()`.
- **Agent Boundary**: Enforced via `current_profile_id()`. Agents only see leads where `assigned_to` or `created_by` equals their profile ID. All child tables (calls, remarks, follow-ups) follow this lead-level boundary.

## Permissions Matrix

| Capability | ADMIN | AGENT |
| :--- | :---: | :---: |
| Login to Admin Dashboard | Yes | No |
| View All Org Leads | Yes | No |
| View Assigned Leads | Yes | Yes |
| Create Leads | Yes | Yes |
| Edit Lead Core Details | Yes | No |
| Log Calls / Remarks | Yes | Yes (on assigned leads only) |
| Schedule Follow-ups | Yes | Yes (on assigned leads only) |
| Create/Deactivate Agents | Yes | No |
| View Org-Wide Reports | Yes | No |
| Run Bulk Assignments | Yes | No |
| Import Excel Leads | Yes | No |

## Enforcing Mechanisms
- **PostgreSQL RLS**: Row-Level Security policies on all tables.
- **Trigger Functions**: `protect_profile_immutable_fields()` prevents AGENT from changing their own role or org. `protect_lead_immutable_fields()` prevents AGENT from reassigning leads or changing org.
- **Client-Side Routing**: `App.tsx` routes to `<AdminShell />` for ADMINs and `<SalesAppContent />` for AGENTs based on `currentUser.role`.
