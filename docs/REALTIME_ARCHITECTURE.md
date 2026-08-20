# Amaratv Krishi CRM — Real-Time Updates & Live Activity Feed (Phase 2K)

## 1. Executive Summary & Architectural Overview
Milestone 2K introduces organization-scoped live synchronization via Supabase Realtime WebSockets to accelerate multi-user visibility across ADMIN and AGENT workflows while strictly preserving the offline-first Dexie operational architecture.

```text
       ┌─────────────────────────────────────────────────────────────┐
       │                REAL-TIME EVENT & SYNC FLOW                  │
       │                                                             │
       │   [AGENT A (Online)] ──► Local Dexie ──► Outbox Push       │
       │                                              │              │
       │                                              ▼              │
       │                                    [Supabase PostgreSQL]    │
       │                                    (supabase_realtime pub)  │
       │                                              │              │
       │                                              ▼              │
       │                                  [Supabase Realtime WS]     │
       │                                  (Filter: organization_id)  │
       │                                              │              │
       │                                              ▼              │
       │                                    [RealtimeService]        │
       │                                              │              │
       │                       ┌──────────────────────┴──────────┐   │
       │                       ▼                                 ▼   │
       │               [Dexie Ingest]                   [UI Listeners]
       │           (Conflict Resolution:               (Live Feed &  │
       │            VERIFIED wins over                  In-App Toast)│
       │            UNVERIFIED)                                      │
       │                       │                                     │
       │                       ▼                                     │
       │               [Local Dexie v4]                              │
       └─────────────────────────────────────────────────────────────┘
```

---

## 2. Non-Destructive Offline-First Ingestion Rule
- **Acceleration Layer**: Supabase Realtime is strictly a UI acceleration mechanism.
- **Operational Authority**: Local Dexie IndexedDB remains the primary operational database.
- **Offline Invariant**: Disconnections, WebSocket timeouts, or network loss **never** purge or truncate local Dexie data or the sync outbox queue.
- **Incremental Sync on Reconnection**: When Realtime transitions from `DISCONNECTED`/`RECONNECTING` to `SUBSCRIBED`, the service automatically triggers `SyncEngine.pullAllChanges()` from the last known sync cursor to reconcile any events missed during disconnection.

---

## 3. Organization Isolation & Channel Design
- **Single Channel Per Active Session**:
  ```typescript
  const channelName = `org_${orgId}_${user.role.toLowerCase()}_${user.id.substring(0, 8)}`;
  ```
- **PostgreSQL Changes Filter**:
  ```typescript
  channel.on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: tableName,
    filter: `organization_id=eq.${orgId}`,
  }, callback);
  ```
- **Guaranteed Isolation**: Clients never subscribe to unfiltered `postgres_changes('*')`. Cross-organization events are physically rejected by Supabase Realtime RLS.

---

## 4. Conflict Resolution & Call Duration Integrity
- Realtime payloads for `call_records` are passed directly through `SyncConflictResolver.resolveCallRecord`:
  - **VERIFIED duration strictly wins over UNVERIFIED duration**.
  - A real-time update with `verificationStatus = 'UNVERIFIED'` **cannot** overwrite a local `VERIFIED` record.
- Call durations in `LiveActivityFeed`:
  - If `VERIFIED`: Displays `${Math.floor(seconds/60)}m ${seconds%60}s • VERIFIED`.
  - If `UNVERIFIED`: Displays `Duration unavailable • UNVERIFIED`.
  - Durations are **never** calculated locally from WebSocket arrival timestamps.

---

## 5. Idempotency & Duplicate Event Safeguards
- Activities are deduplicated by immutable `Activity.id` (UUID v4). Duplicate WebSocket transmissions are dropped idempotently.
- Leads, Follow-ups, and Remarks use `SyncConflictResolver.resolveMutable` timestamp/version comparisons.

---

## 6. Live Activity Feed & In-App Alerts
- **Admin Live Feed (`src/components/admin/LiveActivityFeed.tsx`)**:
  - Live WebSocket connection indicator (`Live` green pulsing dot vs `Connecting` / `Offline`).
  - Real-time event ticker for calls, lead assignments, follow-ups, remarks, and spreadsheet imports.
  - New activity badge counter (`+N new`).
- **Agent In-App Alerts**:
  - Lightweight in-app toast notification when Admin assigns or reassigns a lead to the agent.
  - Non-intrusive alert when follow-up is scheduled.

---

## 7. Security & Permissions Audit
- **Zero Service-Role Keys in Client**: Verified.
- **Zero Invasive Telephony Permissions**: Verified.
- **Inactive Session Guard**: Inactive accounts (`status === 'INACTIVE'`) are refused Realtime channel access and immediately unsubscribed.
