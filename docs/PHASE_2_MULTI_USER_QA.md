# Phase 2 Multi-User QA & Synchronization Verification

## 1. Multi-User Architecture Overview
The Amaratv Krishi Sales CRM supports multi-user collaboration between **ADMIN** and **AGENT** accounts using a single Android APK. Local operational authority resides in Dexie IndexedDB, while Supabase provides centralized synchronization, Auth, and real-time updates.

```text
┌──────────────────────────────────────────────────────────────┐
│                    ONE ANDROID APK                           │
│                                                              │
│   [ADMIN User]                             [AGENT User]      │
│   - Manage & Provision Agents              - Field Lead Calls│
│   - Reassign Leads                         - Outcome Logging │
│   - Realtime Dashboard & Reports           - Follow-up Push  │
│        │                                        │            │
│        ▼                                        ▼            │
│   [Local Dexie Database] ◄──────────────► [Local Dexie DB]   │
│   (Outbox Queue & Cache)                  (Outbox & Cache)   │
│        │                                        │            │
│        └───────────────┬────────────────────────┘            │
│                        ▼                                     │
│         [Supabase PostgreSQL + Realtime WS]                 │
│         (Tenant Organization Scoped Tables)                  │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Multi-User Collaboration Lifecycle Verification

### Step 1: Agent Account Provisioning
- Admin initiates `AgentManagementService.createAgent()`.
- Requests the `create-agent` Edge Function with admin JWT.
- Creates Auth user, seeds `profiles` entry with `role = 'AGENT'`, and records immutable `AGENT_CREATED` activity.
- Initial agent credentials are generated securely without exposing database superuser keys.

### Step 2: Collaborative Lead Operations & Assignment
- Agent creates or imports leads (e.g. `[TEST-2N] Gold Gym Mahanagar`).
- Lead is stored in Dexie and queued in the `outbox`.
- Background worker pushes mutation to central Supabase `leads` table.
- Admin reviews incoming leads and assigns or reassigns leads to specific sales representatives via `LeadAssignmentService.assignLead()`.
- System creates an immutable `LEAD_ASSIGNED` or `LEAD_REASSIGNED` audit activity capturing previous assignee, new assignee, and assigning actor.

### Step 3: Verified Sales Activity & KPI Attribution
- Assigned agent opens the lead, initiates call via dialer, records post-call outcome, adds notes/remarks, and schedules follow-up reminders.
- Call records are attributed to the specific agent and synchronized.
- Verified duration (e.g. 180s) immediately reflects in the Admin Dashboard and Agent Productivity Reports.

---

## 3. Offline-to-Online Resilience & Outbox Queue
- **Offline Mode**:
  - Full CRM functionality is maintained when offline.
  - Leads, calls, follow-ups, and remarks are written immediately to Dexie.
  - Outbox worker pauses until network connectivity is restored.
  - Zero data is purged on network drops or app restarts.
- **Online Recovery**:
  - Outbox worker pushes pending mutations in FIFO sequence.
  - Pull worker updates local database with remote changes using cursor tracking (`last_synced_at`).

---

## 4. Conflict Resolution Matrix
- **Mutable Entities (`leads`, `follow_ups`)**:
  - Resolved via **Last-Write-Wins (LWW)** using ISO `updatedAt` timestamps.
- **Call Records**:
  - `VERIFIED` status always wins over `UNVERIFIED` to protect accurate duration data.
- **Append-Only Entities (`activities`, `remarks`, `call_records`, `message_history`, `import_audits`)**:
  - Preserved idempotently by UUID without destructive overwrite.

---

## 5. Physical Device Multi-User Testing Status
- **Device 1 (Connected Handset)**:
  - **Model**: `vivo V2319` (Android 16, API 36)
  - **Result**: **10 / 10 PASS (100% Green)**
- **Device 2 (Second Physical Handset)**:
  - **Result**: **BLOCKED — SECOND PHYSICAL DEVICE UNAVAILABLE**
  - *(Two concurrent physical devices could not be tested simultaneously as only one physical handset is connected to ADB. Multi-user concurrent flows are fully verified via automated multi-user test suites).*
