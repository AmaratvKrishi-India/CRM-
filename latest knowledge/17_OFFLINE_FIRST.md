# 17 - OFFLINE-FIRST ARCHITECTURE

## Document Metadata
- **DOCUMENT_STATUS:** CURRENT
- **LAST_VERIFIED:** 2026-08-25
- **SOURCE_OF_TRUTH:** `src/db/`, `src/services/sync/`, `src/services/realtime/`
- **SCOPE:** Complete offline-first architecture of the Amaratv Krishi CRM
- **RELATED_DOCUMENTS:** 11_FRONTEND_ARCHITECTURE.md, 18_SYNC_ENGINE.md, 19_REALTIME.md

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     OFFLINE-FIRST LAYERS                        │
├─────────────────────────────────────────────────────────────────┤
│  UI Layer (React)                                               │
│  ├── Reads from: Local Dexie (instant, no network)             │
│  └── Writes to: Local Dexie + Outbox Queue (instant)           │
├─────────────────────────────────────────────────────────────────┤
│  Data Layer (Dexie IndexedDB v5)                                │
│  ├── 13 Entity Stores (leads, calls, follow-ups, etc.)         │
│   - Compound indexes for mobile filtering                       │
│   - Hooks: creating/updating → timestamps + isSynced=0          │
│  ├── Outbox Store (queue)                                       │
│   - entityType, entityId, operation, payload, status           │
│   - Compound index: [status+createdAt]                         │
│  ├── SyncState Store (single row, id='current')                │
│   - deviceId, organizationId, cursors, timestamps, status      │
│  └── Versioning (optimistic concurrency)                       │
├─────────────────────────────────────────────────────────────────┤
│  Sync Layer (Background)                                        │
│  ├── SyncQueue: Enqueue in same transaction as data write     │
│  ├── SyncPush: Batched push by entityType                      │
│  ├── SyncPull: Cursor-based incremental pull                   │
│  ├── SyncConflictResolver: 4-rule resolution                  │
│  ├── BackgroundSyncManager: Triggers + exponential backoff    │
│  └── RealtimeService: Hints for immediate sync                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Principles

### 1. Local-First Writes
**Rule:** Components MUST NOT write directly to Supabase.
```
Component → Repository.create/update/delete()
           → Dexie transaction (data + outbox enqueue)
           → Returns immediately (no await on network)
```

### 2. Atomic Data + Outbox
**BUG-4 Fix (2026-08-23):** Enqueue failure aborts transaction.
```typescript
// In repository:
await db.transaction('rw', [db.leads, db.outbox], async () => {
  await db.leads.put(lead);           // Data write
  await db.outbox.enqueue({...});     // Queue for sync
  // If enqueue throws → BOTH rolled back
});
```

### 3. Soft Deletes Everywhere
```sql
-- All entities have:
deleted_at TIMESTAMPTZ NULL

-- Delete = UPDATE SET deleted_at = NOW()
-- Query = WHERE deleted_at IS NULL
-- Sync propagates deleted_at
-- Restore = SET deleted_at = NULL
```

### 4. UUID Primary Keys
- All entities use UUID v4 (`crypto.randomUUID()`)
- No auto-increment integers
- Enables offline creation without coordination

### 5. Version Field (Optimistic Concurrency)
```typescript
interface BaseEntity {
  version?: number;  // Incremented on each update
}
// UPDATE WHERE id=$1 AND version=$2 → fails if stale
```

---

## Dexie Database Schema (Version 5)

### Entity Stores (13)
| Store | Key Fields | Compound Indexes |
|-------|------------|------------------|
| `leads` | id, phone, businessName, status, createdBy, assignedTo, isSynced, deletedAt, nextFollowUpAt, lastContactedAt, createdAt, updatedAt | `[status+deletedAt]`, `[assignedTo+deletedAt]`, `[locality+deletedAt]`, `[isSynced+deletedAt]` |
| `remarks` | id, leadId, type, createdAt, isSynced, deletedAt | `[leadId+deletedAt]` |
| `callHistory` | id, leadId, outcome, startedAt, isSynced, deletedAt | `[leadId+deletedAt]` |
| `followUps` | id, leadId, scheduledAt, status, priority, isSynced, deletedAt | `[status+scheduledAt]`, `[leadId+deletedAt]` |
| `messageHistory` | id, leadId, channel, sentStatus, sentAt, isSynced, deletedAt | `[leadId+deletedAt]` |
| `messageTemplates` | id, category, isDefault, isSynced, deletedAt | `[category+deletedAt]` |
| `users` | id, email, role, status, isSynced, deletedAt | `[role+status]`, `[role+deletedAt]` |
| `activities` | id, leadId, userId, activityType, createdAt, isSynced, deletedAt | `[leadId+deletedAt]`, `[userId+createdAt]` |
| `callRecords` | id, leadId, userId, outcome, startedAt, isSynced, deletedAt | `[leadId+deletedAt]`, `[userId+startedAt]` |
| `importAudits` | id, uploadedBy, createdAt, isSynced | `[uploadedBy+createdAt]` |
| `outbox` | id, entityType, entityId, operation, status, retryCount, createdAt, updatedAt | `[status+createdAt]` |
| `syncState` | id (single row 'current') | - |
| `bulkAssignmentAudits` | id, organizationId, performedBy, targetAgentId, status, startedAt, isSynced, deletedAt | `[targetAgentId+startedAt]`, `[performedBy+startedAt]` |

### Automatic Hooks
```typescript
// Creating hook (all tables except importAudits)
table.hook('creating', (_primKey, obj) => {
  const now = new Date().toISOString();
  if (!obj.createdAt) obj.createdAt = now;
  if (!obj.updatedAt) obj.updatedAt = now;
  if (obj.isSynced === undefined) obj.isSynced = 0;
  if (obj.deletedAt === undefined) obj.deletedAt = null;
});

// Updating hook
table.hook('updating', (modifications, _primKey, _obj) => {
  const now = new Date().toISOString();
  return {
    ...modifications,
    updatedAt: modifications.updatedAt || now,
    isSynced: modifications.isSynced !== undefined ? modifications.isSynced : 0,
  };
});
```

---

## Outbox Queue

### Schema (`OutboxItem`)
```typescript
interface OutboxItem {
  id: string;                    // UUID
  organizationId: string | null;
  userId: string;
  deviceId: string | null;
  entityType: SyncEntityType;    // 9 types
  entityId: string;              // Target entity UUID
  operation: SyncOperation;      // CREATE | UPDATE | DELETE
  payload: Record<string, any>;  // Full entity snapshot
  createdAt: string;             // ISO DateTime
  updatedAt: string;             // ISO DateTime
  retryCount: number;            // 0 initially
  lastAttemptAt: string | null;
  lastError: string | null;
  status: OutboxStatus;          // PENDING | SYNCING | SYNCED | FAILED | DEAD_LETTER
}
```

### Status Flow
```
PENDING → SYNCING → SYNCED
                ↓
              FAILED → (retry) → SYNCING
                ↓ (max retries)
              DEAD_LETTER
```

### Enqueue Process
```typescript
// Every repository write:
async create(entity) {
  await db.transaction('rw', [db.leads, db.outbox], async () => {
    await db.leads.put(entity);
    await db.outbox.put({
      entityType: 'leads',
      entityId: entity.id,
      operation: 'CREATE',
      payload: entity,
      status: 'PENDING',
      // ... other fields
    });
  });
}
```

---

## Sync Engine

### Push Phase (`syncPush.ts`)
1. **Read PENDING** items ordered by `createdAt`
2. **Batch by entityType** (9 types)
3. **Transform** camelCase → snake_case
4. **Operation-aware push (BUG-8 fix):**
   - `CREATE`/`UPDATE` → accumulate → `.upsert({ onConflict: 'id' })`
   - `DELETE` → flush pending upserts → `.delete().eq('id', entityId)` individually
   - DELETE never becomes upsert (no resurrection)
   - DELETE idempotent (0-row = success)
5. **On batch failure:** Single-record retry fallback
6. **Mark** SYNCED or FAILED with error
7. **Increment** retryCount on failure

### Pull Phase (`syncPull.ts`)
1. **Cursor-based:** `lastPullCursor` per sync state
2. **Query per table:** `SELECT * WHERE updated_at > cursor ORDER BY updated_at ASC`
3. **Incremental pagination** (safe, no infinite loops)
4. **Transform** snake_case → camelCase
5. **Apply ConflictResolver** per incoming record
6. **Upsert** resolved records into Dexie

### Conflict Resolution (`syncConflictResolver.ts`)
**Four Rules:**
1. **Append-only entities (activities):** Local wins on UUID match (idempotency)
2. **Call records:** `VERIFIED` status ALWAYS wins over `UNVERIFIED` (regardless of timestamp)
3. **All others:** Last-Write-Wins (LWW) by `updatedAt` timestamp
4. **LWW tie-break (BUG-5 fix):** Equal timestamps → REMOTE wins (server canonical), recorded as `REMOTE_WON` conflict

---

## Background Sync Manager

### Trigger Points
| Trigger | Implementation |
|---------|----------------|
| User login | Immediate full sync |
| App resume | `CapacitorApp.addListener('appStateChange')` |
| Visibility change | `document.visibilityState` |
| Network reconnect | `window.addEventListener('online')` |
| Periodic interval | Configurable timer (default 15min) |

### Behavior
- **Single-flight mutex:** No concurrent syncs
- **Exponential backoff:** 1s, 2s, 4s, 8s, 16s, 32s (cap)
- **Non-blocking UI:** Status badge only, no modal confirmations

### Sync State (`SyncState`)
```typescript
interface SyncState {
  id: 'current';
  deviceId: string;
  organizationId: string | null;
  lastSuccessfulSyncAt: string | null;
  lastPullCursor: string | null;
  lastPushAt: string | null;
  lastPullAt: string | null;
  lastSyncError: string | null;
  status: SyncEngineStatus;  // SYNCED | SYNCING | OFFLINE | PENDING | ERROR | AUTH_REQUIRED
}
```

---

## Realtime Integration

### Realtime as Sync Hint
```typescript
// RealtimeService.onEntityChange(entityType, payload)
// → Hydrates into local Dexie immediately
// → Emits to listeners for UI update
// Pull sync remains eventual-consistency fallback
```

### Connection States
```
DISCONNECTED → CONNECTING → SUBSCRIBING → SUBSCRIBED
                    ↓                    ↓
               RECONNECTING ←─────── ERROR
```

### Subscribed Tables (8)
`profiles`, `leads`, `call_records`, `activities`, `remarks`, `follow_ups`, `message_history`, `import_audits`
+ `bulk_assignment_audits` (migration 5, server-only)

---

## Offline Capabilities Matrix

| Feature | Offline Read | Offline Write | Offline Queue | Notes |
|---------|--------------|---------------|---------------|-------|
| Lead List/Detail | ✅ | ✅ | ✅ | Full CRUD |
| Call Lifecycle | ✅ | ✅ | ✅ | State machine local |
| Follow-ups | ✅ | ✅ | ✅ | Notifications work offline |
| WhatsApp | ✅ (templates) | ✅ (history) | ✅ | Send requires network |
| Remarks | ✅ | ✅ | ✅ | |
| Activity Timeline | ✅ | ❌ (append-only) | N/A | Server is source |
| Admin Dashboard | ✅ | N/A | N/A | Reads local |
| Agent Management | ❌ | ❌ | ❌ | Requires Edge Function |
| Reports | ✅ | N/A | N/A | Generates from local |
| Backup/Restore | ✅ | ✅ | N/A | Full JSON |
| Settings | ✅ | ✅ | N/A | LocalStorage |
| Auth | ✅ (session) | ❌ | N/A | Login requires network |

---

## Network Transitions

### Offline → Online
1. `window.addEventListener('online')` fires
2. `BackgroundSyncManager` triggers sync
3. Push local changes → Pull remote changes
4. Conflict resolution applied
5. UI updates via realtime + local changes

### Online → Offline
1. `window.addEventListener('offline')` fires
2. `SyncEngineStatus` → `OFFLINE`
3. Writes continue to local Dexie + outbox
4. SyncStatusBadge shows OFFLINE

### App Background/Foreground
- **Capacitor AppListener** detects state changes
- **CallLifecycleService** handles dialer transitions
- **Foreground return** → triggers immediate sync if pending

---

## Data Integrity Guarantees

### Write Path
```
User Action
    │
    ▼
Repository.create/update/delete()
    │
    ▼
Dexie Transaction (data + outbox)
    │
    ├─ Success → Return to UI (instant)
    │
    └─ Failure → Rollback both → Throw error
```

### Sync Path
```
Outbox PENDING
    │
    ▼
SyncEngine.sync()
    │
    ├─ Push Phase
    │   ├─ Batch by entityType
    │   ├─ Operation-aware (upsert vs delete)
    │   ├─ Single-record fallback on batch failure
    │   └─ Mark SYNCED/FAILED
    │
    ├─ Pull Phase
    │   ├─ Cursor-based incremental
    │   ├─ ConflictResolver per record
    │   └─ Local upsert
    │
    └─ Update SyncState (cursors, timestamps)
```

### Conflict Resolution Guarantees
| Scenario | Resolution |
|----------|------------|
| Same entity modified locally + remotely | LWW by `updatedAt` |
| Call record: local UNVERIFIED, remote VERIFIED | **Remote (VERIFIED) wins** |
| Call record: local VERIFIED, remote UNVERIFIED | **Local (VERIFIED) wins** |
| Activity (append-only) | Local wins (idempotent UUID) |
| Equal timestamps | **Remote wins** (server canonical) |

---

## Testing Offline Behavior

### Automated Tests
| Test File | Coverage |
|-----------|----------|
| `realDexieRepositoryOutbox.test.ts` | Atomic write+outbox |
| `syncOutboxQueue.test.ts` | Queue status flow, retries |
| `syncConflictResolver.test.ts` | 4 conflict rules |
| `backgroundSync.test.ts` | Trigger points, backoff |
| `multiDeviceSync.test.ts` | 3 emulators, real network loss |

### Manual Verification
1. **Airplane mode:** Create lead → verify local → enable network → verify sync
2. **Force stop:** Kill app during sync → reopen → verify data intact
3. **Concurrent edit:** Two devices edit same lead → verify conflict resolution
4. **Network flakiness:** Intermittent connectivity → verify eventual consistency

---

## Known Offline Limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| No background sync on iOS Safari | iOS PWA limited | Native Android primary |
| Large dataset sync on slow network | Timeout risk | Chunked pull, exponential backoff |
| Conflict UI not exposed | User unaware of merges | Silent resolution (LWW + VERIFIED) |
| No partial entity sync | Full entity push/pull | Acceptable for current entity sizes |
| Realtime not available offline | No live updates | Pull sync on reconnect |