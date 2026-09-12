# Agent Lifecycle and Deletion Architecture

**Document status:** CURRENT
**Last reviewed:** 2026-09-10
**Source of truth:** agent management services, profile policies, deletion audits, and recovery tests

## 1. Overview & Business Requirements
In Amaratv Krishi Field Sales CRM, sales representatives (AGENTS) engage in direct field operations: calling gym owners, pitching products, sending WhatsApp catalogues, and scheduling follow-ups.

When a sales representative leaves or is removed:
1. Their account must be **permanently disabled / deleted** from active operations.
2. **CRM History must NEVER be lost or orphaned.** Every lead, call duration, remark, follow-up, and audit log ever performed by that representative must remain 100% intact for business intelligence, customer relationship continuity, and executive reporting.

---

## 2. Security Boundaries & Authorization
- **Admin Only:** Only authenticated users with `role: 'ADMIN'` and `status: 'ACTIVE'` can create, edit, activate, deactivate, or delete agent accounts (`AgentManagementService.assertAdmin()`).
- **Self-Deletion Guard:** Administrators are strictly prohibited from deleting their own accounts.
- **Target Role Constraint:** Only accounts with `role: 'AGENT'` can be deleted via this lifecycle.
- **Immediate Login Block:** Once deleted, the agent's account status is set to `INACTIVE` with a non-null `deletedAt` ISO timestamp. On subsequent session validation or login attempts, `AuthService.signIn()` and `AuthService.validateAndLoadCurrentProfile()` reject access with an explicit error.

---

## 3. Data Integrity & Non-Destructive Soft Deletion
- **No Physical Record Deletion:** Neither the user profile nor their historical actions are removed from IndexedDB or Supabase PostgreSQL tables.
- **Preserved Entity Relationships:**
  - `leads.assignedTo`: Remains linked to the agent ID so historical assignments can be queried.
  - `call_records.userId`: Preserves exact timestamps, call lifecycle metadata, and call durations.
  - `activities.userId`: Append-only audit logs retain full historical attribution.
  - `remarks.userId` & `follow_ups.userId`: Fully retained.
- **Active Selectors & Dropdowns:** `userRepository.getActiveAgentsForAssignment()` queries only accounts with `role: 'AGENT'`, `status: 'ACTIVE'`, and `deletedAt === null`. Deleted agents do not appear in assignment lists.
- **Audit Logging:** An immutable `AGENT_DELETED` activity record is appended with actor ID, device ID, deleted agent metadata, and UTC timestamp.

---

## 4. Cloud Synchronization
When an agent is deleted locally:
1. `users` table updates `status: 'INACTIVE'`, `deletedAt: <timestamp>`, `updatedAt: <timestamp>`, `isSynced: 0`.
2. Supabase `profiles` table is updated with matching `status` and `deleted_at` timestamps.
3. The mutation is synced to all connected devices via Outbox and Realtime channels.
