# Amaratv Krishi CRM — Shared Lead Operations, Assignment & Reassignment (Phase 2I)

## 1. Architecture Overview
This milestone establishes multi-user lead ownership, pipeline reassignment, collaborative sales workflows, and complete audit trail visibility within the single unified Android application.

```text
       ┌─────────────────────────────────────────────────────────────┐
       │                 ADMIN LEAD MANAGEMENT WORKFLOW              │
       │                                                             │
       │   [Admin Leads View] ──► Search, filter by Agent/Status     │
       │         │                                                   │
       │         ├── [Assign / Reassign]                             │
       │         │         │                                         │
       │         │         ▼                                         │
       │         │   [LeadAssignmentService]                         │
       │         │         │                                         │
       │         │         ├── Updates Lead.assignedTo & updatedBy   │
       │         │         ├── Logs Immutable Activity:              │
       │         │         │   - LEAD_ASSIGNED                       │
       │         │         │   - LEAD_REASSIGNED                     │
       │         │         │   - LEAD_UNASSIGNED                     │
       │         │         └── Enqueues Outbox Mutation for Sync     │
       │         │                                                   │
       │         ▼                                                   │
       │   [Admin Sales CRM Mode]                                    │
       │   (Admin operates leads: Calls, WhatsApp, Remarks, Followups)│
       └─────────────────────────────────────────────────────────────┘
                                 │
                                 ▼ (Offline Sync Engine)
       ┌─────────────────────────────────────────────────────────────┐
       │                 AGENT LEAD WORKFLOW                         │
       │                                                             │
       │   - Agent sees assigned leads and created leads             │
       │   - New leads automatically tagged with createdBy = Agent.id│
       │   - Agent cannot reassign leads to another agent            │
       │   - Agent executes field calling and follow-up activities   │
       └─────────────────────────────────────────────────────────────┘
```

---

## 2. Lead Ownership Model

| Field | Type | Description |
|---|---|---|
| `id` | UUID v4 | Primary Key, identical in Dexie & PostgreSQL |
| `organization_id` | UUID | Multi-tenant organization boundary |
| `createdBy` | UUID | User profile ID who created/imported the lead |
| `assignedTo` | UUID / null | Active Agent currently assigned to work the lead |
| `updatedBy` | UUID | User profile ID who last modified the lead |
| `status` | LeadStatus | Pipeline stage (`NEW`, `INTERESTED`, `CUSTOMER`, etc.) |
| `createdAt` | ISO DateTime | Creation timestamp |
| `updatedAt` | ISO DateTime | Last update timestamp (used for LWW sync) |

---

## 3. Assignment & Reassignment Rules

1. **Admin Authority**:
   - Only active administrators (`role === 'ADMIN'`, `status === 'ACTIVE'`) are authorized to assign, reassign, or unassign leads.
   - Non-administrators (Agents) cannot reassign leads to another agent.
2. **Active Assignee Requirement**:
   - Leads can only be assigned to sales representatives who have `role === 'AGENT'` and `status === 'ACTIVE'`.
   - Inactive or deleted accounts are excluded from assignment selectors.
3. **Immutable Activity Audit Trail**:
   - Every assignment operation creates an append-only `Activity` event:
     - `LEAD_ASSIGNED`: Initial assignment to an agent.
     - `LEAD_REASSIGNED`: Transfer from Agent A to Agent B.
     - `LEAD_UNASSIGNED`: Removal of assignment.
   - Audit metadata captures previous assignee, new assignee, acting administrator, and timestamp.
   - Passwords and auth tokens are **never** present in metadata.

---

## 4. Chronological Timeline Visualization
The lead timeline provides complete end-to-end visibility:
```text
Lead Created (by Agent Rahul)
   ↓
Assigned (to Agent Rahul by Admin)
   ↓
Call Completed (Outcome: CONNECTED)
   ↓
Remark Added ("Gym owner requested pricing")
   ↓
Reassigned (from Agent Rahul to Agent Amit by Admin)
   ↓
Follow-up Scheduled (Sample Delivery)
```

---

## 5. Offline Queuing & Conflict Resolution
- **Offline Autonomy**: Assignments made while offline immediately update Dexie and queue into the persistent `outbox` table.
- **Last-Write-Wins (LWW)**: When cloud synchronization executes, the latest `updated_at` timestamp takes precedence. Stale offline updates cannot overwrite newer remote edits.
- **Append-Only Activities**: Activity history is never overwritten or deleted.

---

## 6. Admin Sales Mode
- Administrators can transition into Field Sales Mode with 1 tap from the Admin console.
- In Sales Mode, Admins can:
  - Search and filter all leads.
  - Initiate calls and log outcomes.
  - Dispatch WhatsApp pitch messages.
  - Add custom and predefined remarks.
  - Schedule and manage follow-ups.
  - Reassign leads directly from the lead detail view.
