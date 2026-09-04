# 18 - SYNC ENGINE

## Document Metadata
- **DOCUMENT_STATUS:** CURRENT
- **LAST_VERIFIED:** 2026-08-25
- **SOURCE_OF_TRUTH:** `src/services/sync/` (syncEngine.ts, syncPush.ts, syncPull.ts, syncQueue.ts, syncConflictResolver.ts, backgroundSyncManager.ts, syncStateRepository.ts, syncTypes.ts, useSync.ts)
- **SCOPE:** Complete sync engine implementation details
- **RELATED_DOCUMENTS:** 17_OFFLINE_FIRST.md, 19_REALTIME.md, 08_SYNC_REALTIME_ARCHITECTURE.md

---

## Sync Engine Overview

The sync engine implements an **offline-first, push-then-pull** bidirectional synchronization between Dexie (IndexedDB) and Supabase PostgreSQL.

### Key Files
| File | Size | Purpose |
|------|------|---------|
| `syncEngine.ts` | 7,600 bytes | Central coordinator |
| `syncPush.ts` | 12,857 bytes | Push mutations to cloud |
| `syncPull.ts` | 11,840 bytes | Pull changes from cloud |
| `syncQueue.ts` | 6,584 bytes | Outbox queue management |
| `syncConflictResolver.ts` | 3,629 bytes | Conflict resolution logic |
| `backgroundSyncManager.ts` | 5,385 bytes | Auto-sync lifecycle |
| `syncStateRepository.ts` | 1,911 bytes | Cursor/state persistence |
| `syncTypes.ts` | 1,785 bytes | Type definitions |
| `useSync.ts` | 845 bytes | React hook |

---

## Sync Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      SYNC ENGINE FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LOCAL WRITE                                                    │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │ Repository  │───►│   Dexie     │───►│  Outbox     │         │
│  │ .create()   │    │ Transaction │    │  Enqueue    │         │
│  └─────────────┘    └─────────────┘    └──────┬──────┘         │
│                                                │                │
│                                                ▼                │
│  PUSH PHASE                              ┌─────────────┐         │
│  ┌─────────────┐    ┌─────────────┐    │  SyncPush   │         │
│  │ Read PENDING│───►│ Batch by    │───►│  (batched,  │         │
│  │   Outbox    │    │ entityType  │    │  operation- │         │
│  └─────────────┘    └─────────────┘    │  aware)     │         │
│       │                                 └──────┬──────┘         │
│       ▼                                        │                │
│  ┌─────────────┐                              │                │
│  │  Supabase   │                              │                │
│  │  Upsert/    │◄─────────────────────────────┘                │
│  │  Delete     │                                                 │
│  └─────────────┘                                                 │
│       │                                                           │
│       ▼                                                           │
│  PULL PHASE                                                       │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐           │
│  │  Cursor     │───►│  Incremental│───►│  Conflict   │           │
│  │  (pull     │    │  Pull per   │    │  Resolver   │           │
│  │  cursor)   │    │  Table      │    │  (4 rules)  │           │
│  └─────────────┘    └─────────────┘    └──────┬──────┘           │
│                                                │                  │
│                                                ▼                  │
│  ┌─────────────┐                              │                  │
│  │  Local      │◄─────────────────────────────┘                  │
│  │  Upsert     │                                                   │
│  └─────────────┘                                                   │
│       │                                                             │
│       ▼                                                             │
│  ┌─────────────┐                                                   │
│  │ SyncState   │                                                   │
│  │ Update      │                                                   │
│  └─────────────┘                                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Sync Types (`syncTypes.ts`)

### Entity Types (9)
```typescript
type SyncEntityType =
  | 'leads'
  | 'call_records'
  | 'activities'
  | 'remarks'
  | 'follow_ups'
  | 'message_history'
  | 'import_audits'
  | 'profiles'
  | 'bulk_assignment_audits';
```

### Operations
```typescript
type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';
```

### Outbox Status
```typescript
type OutboxStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'DEAD_LETTER';
```

### Sync Engine Status
```typescript
type SyncEngineStatus =
  | 'SYNCED'
  | 'SYNCING'
  | 'OFFLINE'
  | 'PENDING'
  | 'ERROR'
  | 'AUTH_REQUIRED';
```

### Conflict Resolution
```typescript
type ConflictResolution = 'LOCAL_WON' | 'REMOTE_WON' | 'MERGED';

interface SyncConflict {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  localData: Record<string, any>;
  remoteData: Record<string, any>;
  resolution: ConflictResolution;
  resolvedAt: string;
}
```

### Sync Result
```typescript
interface SyncResult {
  pushedCount: number;
  pulledCount: number;
  failedCount: number;
  conflictsCount: number;
  durationMs: number;
  error?: string | null;
}
```

---

## Sync Queue (`syncQueue.ts`)

### Enqueue (Atomic with Data Write)
```typescript
// Every repository method calls this in SAME transaction
async enqueue(item: Omit<OutboxItem, 'id' | 'createdAt' | 'updatedAt' | 'retryCount' | 'status'>): Promise<void> {
  await db.transaction('rw', [this.table, db.outbox], async () => {
    await this.table.put(entity);  // Data write
    await db.outbox.put({          // Queue write
      ...item,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      retryCount: 0,
      status: 'PENDING',
    });
  });
}
```

**BUG-4 Fix (2026-08-23):** If enqueue fails → entire transaction rolls back. No silent data loss.

### Compound Index
```typescript
outbox: 'id, entityType, entityId, operation, status, retryCount, createdAt, updatedAt, [status+createdAt]'
```
- `[status+createdAt]` enables efficient PENDING reads ordered by creation time

---

## Push Phase (`syncPush.ts`)

### Algorithm
```typescript
async push(): Promise<PushResult> {
  // 1. Read PENDING items (oldest first)
  const pending = await db.outbox
    .where('status').equals('PENDING')
    .sortBy('createdAt');

  // 2. Group by entityType
  const batches = groupBy(pending, 'entityType');

  // 3. Process each batch
  for (const [entityType, items] of Object.entries(batches)) {
    await this.pushBatch(entityType, items);
  }
}
```

### Operation-Aware Push (BUG-8 Fix)
```typescript
async pushBatch(entityType: SyncEntityType, items: OutboxItem[]): Promise<void> {
  // Separate by operation
  const createsUpdates = items.filter(i => i.operation !== 'DELETE');
  const deletes = items.filter(i => i.operation === 'DELETE');

  // CREATE/UPDATE → accumulate → single upsert
  if (createsUpdates.length > 0) {
    const payload = createsUpdates.map(i => this.toSnakeCase(i.payload));
    await supabase.from(entityType).upsert(payload, { onConflict: 'id' });
    await this.markSynced(createsUpdates);
  }

  // DELETE → flush upserts first → individual deletes
  for (const item of deletes) {
    // Flush any pending upserts for same entity
    await this.flushPendingUpserts(entityType);
    
    // Individual delete (idempotent: 0-row = success)
    await supabase.from(entityType).delete().eq('id', item.entityId);
    await this.markSynced([item]);
  }
}
```

**Key Rules:**
- DELETE never converted to upsert (no resurrection)
- DELETE is idempotent (0-row delete = success)
- Order: flush upserts → then delete

### Error Handling
```typescript
try {
  await pushBatch(entityType, items);
} catch (error) {
  // Single-record retry fallback
  for (const item of items) {
    try {
      await pushSingle(item);
    } catch (singleError) {
      await markFailed(item, singleError.message);
      item.retryCount++;
    }
  }
}
```

---

## Pull Phase (`syncPull.ts`)

### Cursor-Based Incremental Pull
```typescript
async pull(): Promise<PullResult> {
  const syncState = await this.syncStateRepo.get();
  const cursor = syncState.lastPullCursor;

  for (const entityType of ENTITY_TYPES) {
    // Query: updated_at > cursor
    const { data, error } = await supabase
      .from(entityType)
      .select('*')
      .gt('updated_at', cursor)
      .order('updated_at', { ascending: true })
      .limit(PAGE_SIZE);

    // Paginate until no more results
    while (data.length === PAGE_SIZE) {
      const nextCursor = data[data.length - 1].updated_at;
      // ... fetch next page
    }
  }
}
```

### Conflict Resolution per Record
```typescript
for (const remoteRecord of remoteRecords) {
  const localRecord = await db[entityType].get(remoteRecord.id);
  
  if (!localRecord) {
    // New record - insert
    await db[entityType].put(remoteRecord);
  } else {
    // Conflict - resolve
    const resolved = conflictResolver.resolve(localRecord, remoteRecord);
    await db[entityType].put(resolved);
  }
}
```

---

## Conflict Resolver (`syncConflictResolver.ts`)

### Four Rules (Priority Order)

```typescript
resolve(local: Entity, remote: Entity): Entity {
  // Rule 1: Append-only entities (activities) - local wins on UUID
  if (entityType === 'activities') {
    if (local.id === remote.id) return local; // Idempotency
  }

  // Rule 2: Call records - VERIFIED always wins
  if (entityType === 'call_records') {
    const localVerified = local.verification_status === 'VERIFIED';
    const remoteVerified = remote.verification_status === 'VERIFIED';
    
    if (localVerified && !remoteVerified) return local;
    if (!localVerified && remoteVerified) return remote;
  }

  // Rule 3: LWW by updatedAt
  const localTime = new Date(local.updated_at).getTime();
  const remoteTime = new Date(remote.updated_at).getTime();
  
  if (localTime > remoteTime) return local;
  if (remoteTime > localTime) return remote;

  // Rule 4: Equal timestamps → REMOTE wins (server canonical)
  return remote; // Recorded as REMOTE_WON conflict
}
```

### Conflict Recording
```typescript
// Conflicts stored for audit
interface SyncConflict {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  localData: Record<string, any>;
  remoteData: Record<string, any>;
  resolution: 'LOCAL_WON' | 'REMOTE_WON' | 'MERGED';
  resolvedAt: string;
}
```

---

## Background Sync Manager (`backgroundSyncManager.ts`)

### Trigger Points
| Trigger | Listener | Behavior |
|---------|----------|----------|
| User Login | `AuthContext` on auth change | Immediate full sync |
| App Resume | `CapacitorApp.addListener('appStateChange')` | Trigger sync |
| Visibility Change | `document.visibilityState` | Trigger sync |
| Network Reconnect | `window.addEventListener('online')` | Trigger sync |
| Periodic | `setInterval` (configurable) | Trigger sync |

### Single-Flight Mutex
```typescript
let isSyncing = false;

async triggerSync(): Promise<void> {
  if (isSyncing) return; // Already running
  
  isSyncing = true;
  try {
    await syncEngine.sync();
  } finally {
    isSyncing = false;
  }
}
```

### Exponential Backoff
```typescript
const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 32000]; // Cap at 32s

async retryWithBackoff(attempt: number): Promise<void> {
  const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
  await sleep(delay);
  await triggerSync();
}
```

### Non-Blocking UI
- Sync runs in background
- Only `SyncStatusBadge` updates
- No modal confirmations
- Toast only on errors

---

## Sync State Repository (`syncStateRepository.ts`)

### Persisted State (Single Row)
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
  status: SyncEngineStatus;
}
```

### Cursor Management
```typescript
// Pull cursor = max(updated_at) of successfully pulled records
async updatePullCursor(newCursor: string): Promise<void> {
  await db.syncState.update('current', {
    lastPullCursor: newCursor,
    lastPullAt: new Date().toISOString(),
  });
}

// Push cursor implicit via outbox status
async updatePushTime(): Promise<void> {
  await db.syncState.update('current', {
    lastPushAt: new Date().toISOString(),
  });
}
```

---

## React Integration (`useSync.ts`)

```typescript
interface UseSyncReturn {
  status: SyncEngineStatus;
  lastSync: Date | null;
  error: string | null;
  triggerSync: () => Promise<void>;
}

export function useSync(): UseSyncReturn {
  const [status, setStatus] = useState<SyncEngineStatus>('PENDING');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to sync state changes
  useEffect(() => {
    const unsubscribe = syncEngine.onStatusChange(setStatus);
    return unsubscribe;
  }, []);

  const triggerSync = useCallback(async () => {
    setError(null);
    try {
      const result = await syncEngine.sync();
      setLastSync(new Date());
      if (result.error) setError(result.error);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  return { status, lastSync, error, triggerSync };
}
```

### SyncStatusBadge Component
```typescript
// Displays in header (both Admin and Agent)
const statusColors = {
  SYNCED: 'text-green-600',
  SYNCING: 'text-yellow-600 animate-pulse',
  OFFLINE: 'text-gray-500',
  PENDING: 'text-blue-600',
  ERROR: 'text-red-600',
  AUTH_REQUIRED: 'text-orange-600',
};
```

---

## Sync Engine API

### Main Entry Point
```typescript
class SyncEngine {
  // Full bidirectional sync
  async sync(): Promise<SyncResult> {
    const pushResult = await this.push();
    const pullResult = await this.pull();
    await this.updateState({ pushResult, pullResult });
    return { ...pushResult, ...pullResult };
  }

  // Push only
  async push(): Promise<PushResult>;

  // Pull only
  async pull(): Promise<PullResult>;

  // Status subscription
  onStatusChange(callback: (status: SyncEngineStatus) => void): () => void;
}
```

---

## Performance Characteristics

| Metric | Value | Notes |
|--------|-------|-------|
| **Push batch size** | 50 records | Configurable |
| **Pull page size** | 100 records | Configurable |
| **Max retry attempts** | 6 | Before DEAD_LETTER |
| **Backoff max** | 32 seconds | Exponential |
| **Sync mutex** | Single-flight | Prevents conflicts |
| **Typical sync duration** | 200-500ms | Local + network |
| **Outbox growth** | Unbounded | Cleanup on SYNCED |

---

## Testing

### Unit Tests
| Test File | Coverage |
|-----------|----------|
| `syncOutboxQueue.test.ts` (11 tests) | Queue status flow, retries, atomic enqueue |
| `syncConflictResolver.test.ts` (7 tests) | 4 conflict rules, edge cases |
| `realSupabasePostgres.test.ts` (15 tests) | Real PostgreSQL integration |

### E2E Tests
| Test | Scenario |
|------|----------|
| `multiDeviceSync.test.ts` (13 tests) | 3 Android emulators, real network loss, concurrent edits |

---

## Known Sync Limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| No partial entity sync | Full entity push/pull | Acceptable for current sizes |
| Conflict UI not exposed | User unaware of merges | Silent resolution |
| No priority queue | All entities equal | Acceptable for current load |
| Single-threaded sync | Sequential entity types | No parallel push/pull |
| Cursor per sync state | Not per table | Works for current scale |