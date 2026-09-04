# 19 - REALTIME

## Document Metadata
- **DOCUMENT_STATUS:** CURRENT
- **LAST_VERIFIED:** 2026-08-25
- **SOURCE_OF_TRUTH:** `src/services/realtime/` (realtimeService.ts, realtimeTypes.ts), `supabase/migrations/`
- **SCOPE:** Complete Supabase Realtime implementation
- **RELATED_DOCUMENTS:** 17_OFFLINE_FIRST.md, 18_SYNC_ENGINE.md, 08_SYNC_REALTIME_ARCHITECTURE.md

---

## Realtime Overview

Supabase Realtime provides **postgres_changes** subscriptions for real-time UI updates. The CRM subscribes to 8 tables (plus 1 server-only) for live activity feeds, lead updates, and in-app notifications.

### Key Files
| File | Size | Purpose |
|------|------|---------|
| `realtimeService.ts` | 13,173 bytes | Subscription manager, connection state, reconciliation |
| `realtimeTypes.ts` | 1,451 bytes | Type definitions for events, payloads, config |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      REALTIME FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SUPABASE (PostgreSQL)                                          │
│  ┌─────────────┐                                                │
│  │  WAL        │  (Write-Ahead Log)                             │
│  │  → logical  │                                                │
│  │  replication│                                                │
│  └──────┬──────┘                                                │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────────────────────┐                         │
│  │  Supabase Realtime Server           │                         │
│  │  (postgres_changes publication)     │                         │
│  └──────────────┬──────────────────────┘                         │
│                 │                                                 │
│         ┌───────┴───────┐                                         │
│         ▼               ▼                                         │
│  ┌─────────────┐ ┌─────────────┐                                 │
│  │ WebSocket   │ │ WebSocket   │  (per client)                   │
│  │ Client A    │ │ Client B    │                                 │
│  └──────┬──────┘ └──────┬──────┘                                 │
│         │               │                                        │
│         ▼               ▼                                        │
│  ┌─────────────────────────────────────┐                         │
│  │  realtimeService.ts                 │                         │
│  │  • Connection state machine         │                         │
│  │  • Subscription management          │                         │
│  │  • Event reconciliation             │                         │
│  │  • Local Dexie hydration            │                         │
│  └─────────────────────────────────────┘                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Publication Configuration

### Migration 4 & 5
```sql
-- REPLICA IDENTITY FULL required for UPDATE/DELETE events
ALTER TABLE profiles REPLICA IDENTITY FULL;
ALTER TABLE leads REPLICA IDENTITY FULL;
ALTER TABLE call_records REPLICA IDENTITY FULL;
ALTER TABLE activities REPLICA IDENTITY FULL;
ALTER TABLE remarks REPLICA IDENTITY FULL;
ALTER TABLE follow_ups REPLICA IDENTITY FULL;
ALTER TABLE message_history REPLICA IDENTITY FULL;
ALTER TABLE import_audits REPLICA IDENTITY FULL;
-- Migration 5 added:
ALTER TABLE bulk_assignment_audits REPLICA IDENTITY FULL;

-- Publication
ALTER PUBLICATION supabase_realtime ADD TABLE
  profiles, leads, call_records, activities,
  remarks, follow_ups, message_history, import_audits,
  bulk_assignment_audits;  -- Server-only (not subscribed by clients)
```

### Tables Subscribed by Client (8)
| Table | Events | Purpose |
|-------|--------|---------|
| `profiles` | INSERT, UPDATE, DELETE | Agent list, user updates |
| `leads` | INSERT, UPDATE, DELETE | Lead list, dashboard KPIs |
| `call_records` | INSERT, UPDATE, DELETE | Call history, analytics |
| `activities` | INSERT, UPDATE, DELETE | Live activity feed |
| `remarks` | INSERT, UPDATE, DELETE | Lead timeline |
| `follow_ups` | INSERT, UPDATE, DELETE | Follow-up list, badges |
| `message_history` | INSERT, UPDATE, DELETE | WhatsApp history |
| `import_audits` | INSERT, UPDATE, DELETE | Import status |

### Server-Only (1)
| Table | Reason |
|-------|--------|
| `bulk_assignment_audits` | Admin audit, not needed in real-time UI |

---

## Client Subscription (`realtimeService.ts`)

### Initialization
```typescript
// Called from MainAppRouter on auth change
RealtimeService.init(currentUser);

// Sets up subscriptions for user's organization
RealtimeService.setSyncEngine(crmData.syncEngine); // For reconnect reconciliation
```

### Subscription Process
```typescript
async subscribe(): Promise<void> {
  // 1. Create channel per table
  for (const table of SUBSCRIBED_TABLES) {
    const channel = supabase.channel(`realtime:${table}`)
      .on('postgres_changes', {
        event: '*',           // INSERT, UPDATE, DELETE
        schema: 'public',
        table: table,
        filter: `organization_id=eq.${orgId}`, // Org-scoped
      }, (payload) => this.handleEvent(table, payload))
      .subscribe();
    
    this.channels.set(table, channel);
  }
}
```

### Event Handling
```typescript
handleEvent(table: string, payload: RealtimePayload): void {
  // 1. Hydrate into local Dexie
  this.hydrateLocal(table, payload);
  
  // 2. Emit to listeners for UI update
  this.emit(table, payload);
  
  // 3. Trigger background sync (pull is eventual consistency fallback)
  if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
    this.syncEngine?.triggerSync();
  }
}
```

### Reconciliation per Table
| Table | Reconciliation Strategy |
|-------|------------------------|
| `profiles` | Upsert by `id` |
| `leads` | Upsert by `id` |
| `call_records` | Upsert by `id` |
| `activities` | **Insert-if-absent** (append-only, same as `import_audits`) |
| `remarks` | Upsert by `id` |
| `follow_ups` | Upsert by `id` |
| `message_history` | **Insert-if-absent** (append-only) |
| `import_audits` | **Insert-if-absent** (append-only) |

**BUG-2 Fix (2026-08-23):** `message_history` and `import_audits` use insert-if-absent to prevent duplicate realtime events.

---

## Connection State Machine

```
DISCONNECTED
    │
    ▼ (init/subscribe)
CONNECTING
    │
    ▼ (WebSocket connected)
SUBSCRIBING
    │
    ▼ (All channels SUBSCRIBED)
SUBSCRIBED ──────────────────┐
    │                         │
    ▼ (error/disconnect)      │ (reconnect)
RECONNECTING                  │
    │                         │
    ▼ (success)               │
SUBSCRIBED ◄──────────────────┘
    │
    ▼ (fatal error)
ERROR
```

### State Transitions
| From | To | Trigger |
|------|-----|---------|
| DISCONNECTED | CONNECTING | `init()` called |
| CONNECTING | SUBSCRIBING | WebSocket connected |
| SUBSCRIBING | SUBSCRIBED | All channels `SUBSCRIBED` |
| SUBSCRIBED | RECONNECTING | WebSocket error/close |
| RECONNECTING | SUBSCRIBED | Reconnection successful |
| * | ERROR | Fatal error (auth, config) |

### Auto-Reconnect
```typescript
// Exponential backoff on reconnection
const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000]; // Max 30s

channel.on('system', { event: 'error' }, () => {
  this.setState('RECONNECTING');
  this.scheduleReconnect();
});
```

---

## Event Payloads

### Postgres Changes Payload
```typescript
interface RealtimePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, any> | null;    // New record (INSERT/UPDATE)
  old: Record<string, any> | null;    // Old record (UPDATE/DELETE)
  schema: 'public';
  table: string;
  commit_timestamp: string;
}
```

### In-App Notification (`realtimeTypes.ts`)
```typescript
interface RealtimeInAppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  entityType?: SyncEntityType;
  entityId?: string;
  timestamp: string;
}
```

**Usage:** `MainAppRouter` listens for notifications and shows toast banner.

---

## Integration Points

### 1. Live Activity Feed (Admin)
```typescript
// AdminDashboardView → LiveActivityFeed
const activities = useRealtimeSubscription('activities');
// Renders real-time stream of agent actions
```

### 2. Lead List Updates (Admin + Agent)
```typescript
// MinimalLeadsList / AdminLeadsView
const leads = useRealtimeSubscription('leads');
// Status badges update in-place
```

### 3. Call History Updates
```typescript
// LeadDetailView → Calls tab
const calls = useRealtimeSubscription('call_records');
// New call records appear immediately
```

### 4. Follow-up Badge Count
```typescript
// SalesAppContent → bottom tab badge
const followUps = useRealtimeSubscription('follow_ups');
// pendingFollowUpsCount updates in real-time
```

### 5. In-App Notifications
```typescript
// MainAppRouter → Toast banner
RealtimeService.onNotification((notif) => {
  setActiveToast(notif); // Shows for 8s with dismiss
});
```

---

## RLS Filtering on Realtime

### Subscription Filter
```typescript
// All subscriptions scoped to user's organization
supabase.channel(`realtime:${table}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: table,
    filter: `organization_id=eq.${orgId}`, // Org-scoped!
  }, handler)
```

### Security Guarantee
- **Zero cross-org events:** Subscription filter + RLS = double protection
- **Agent isolation:** Events for other agents' leads filtered out
- **Admin sees all:** `is_org_admin()` bypass in RLS applies to realtime too

---

## Realtime → Sync Integration

### Dual Path Architecture
```
Realtime Event (instant)
    │
    ├─► Hydrate local Dexie (immediate UI)
    │
    └─► Trigger Background Sync (eventual consistency fallback)
```

### Reconciliation on Reconnect
```typescript
// When realtime reconnects after disconnect
async handleReconnect(): Promise<void> {
  // 1. Get current cursor from syncState
  const cursor = await syncStateRepo.getCursor();
  
  // 2. Pull incremental from cursor (catches missed events)
  await syncEngine.pullFromCursor(cursor);
  
  // 3. Merge with local (conflict resolver handles)
}
```

**Key:** Pull sync is the **source of truth**; realtime is a **hint** for immediate UI.

---

## Connection Management

### Lifecycle (MainAppRouter)
```typescript
useEffect(() => {
  if (currentUser && currentUser.status === 'ACTIVE') {
    // Give sync engine to realtime for reconnect reconciliation
    RealtimeService.setSyncEngine(crmData.syncEngine);
    RealtimeService.init(currentUser);

    // In-app notifications
    const unsubNotif = RealtimeService.onNotification((notif) => {
      setActiveToast(notif);
      setTimeout(() => setActiveToast(null), 8000);
    });

    return () => {
      unsubNotif();
      RealtimeService.unsubscribe(); // Cleanup all channels
    };
  } else {
    RealtimeService.unsubscribe();
  }
}, [currentUser]);
```

### Cleanup on Auth Change
- Logout → `RealtimeService.unsubscribe()`
- Role change → Re-init with new org scope

---

## Performance

### Connection Pooling
- Single WebSocket connection per client
- Multiplexes 8 channels over one connection
- Server-side: Supabase manages connection pooling

### Event Throttling
```typescript
// Client-side: 10 events/second max per subscription
// Configured in supabaseClient.ts:
realtime: {
  params: { eventsPerSecond: 10 }
}
```

### Memory Management
- Channels cleaned up on unsubscribe
- Event listeners removed on component unmount
- No memory leaks observed in 3-emulator tests

---

## Testing

### Multi-Device Verification (`multiDeviceSync.test.ts`)
- 3 Android emulators simultaneously
- Admin + 2 Agents
- Verifies:
  - Real-time lead assignment appears on agent device
  - Call outcomes appear on admin feed instantly
  - Follow-up badges update across devices
  - Network disconnect/reconnect handled

### Load Testing
- **Concurrent subscriptions:** 3 clients × 8 tables = 24 channels
- **Event rate:** ~50 events/second sustained
- **Latency:** <100ms event delivery (local network)

---

## Known Realtime Limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| No presence/events for user online status | Can't show "agent online" | Not in current scope |
| Single WebSocket per client | All tables share connection | Acceptable for current scale |
| Realtime not available offline | No live updates offline | Pull sync on reconnect |
| No message acknowledgment | Fire-and-forget | Eventual consistency via pull |
| Channel limit (Supabase) | 100 channels/project | Current: 8 (well under) |
| No built-in retry for failed events | Missed events possible | Pull sync fallback |