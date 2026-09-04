# 21 - ERROR HANDLING

## Document Metadata
- **DOCUMENT_STATUS:** CURRENT
- **LAST_VERIFIED:** 2026-08-25
- **SOURCE_OF_TRUTH:** `src/components/common/ErrorBoundary.tsx`, `src/services/`, `src/components/`, `tests/`
- **SCOPE:** Complete error handling strategy and patterns
- **RELATED_DOCUMENTS:** 11_FRONTEND_ARCHITECTURE.md, 17_OFFLINE_FIRST.md, 22_TESTING_STRATEGY.md

---

## Error Handling Strategy

### Core Principles

| Principle | Implementation |
|-----------|----------------|
| **Fail Fast, Recover Gracefully** | Errors caught at boundary, UI stays functional |
| **User-First Messaging** | Technical errors → user-friendly toasts with retry |
| **Offline Resilience** | Errors don't block local writes; sync handles later |
| **Observability** | Console logging + toast + error boundary reporting |
| **Idempotency** | Retry-safe operations (DELETE, upsert) |

---

## Error Categories

### 1. Validation Errors (Client-Side)
| Source | Handling |
|--------|----------|
| Form input | Inline field errors (red text, border) |
| Required fields | `aria-invalid="true"`, `aria-describedby` |
| Phone format | Real-time normalization + validation |
| Date logic | Future dates only for follow-ups |

### 2. Network Errors
| Scenario | Handling |
|----------|----------|
| Offline | Writes to local Dexie + outbox; UI shows OFFLINE badge |
| Timeout | Toast with retry action; exponential backoff |
| 4xx/5xx | Toast with error message; log to console |
| Auth expired | Redirect to login with session expired message |

### 3. Database Errors (Dexie)
| Error Type | Handling |
|------------|----------|
| Constraint violation | Toast: "Data conflict, please refresh" |
| Transaction abort | Rollback + toast with retry |
| Quota exceeded | Toast: "Storage full, backup recommended" |
| Version conflict | Optimistic concurrency retry |

### 4. Sync Errors
| Error Type | Handling |
|------------|----------|
| Push failed | Outbox item → FAILED, retryCount++, exponential backoff |
| Pull failed | SyncState.status = ERROR, toast, retry on next trigger |
| Conflict | Auto-resolved (4 rules), conflict count in badge |
| Dead letter | Max retries exceeded → DEAD_LETTER, manual intervention |

### 5. Authentication Errors
| Error | Handling |
|-------|----------|
| Invalid credentials | Inline form error |
| Session expired | Redirect to login |
| MFA required | Not implemented |
| Email not confirmed | Not enforced |

---

## Error Handling Patterns

### 1. Repository Level (Data Layer)
```typescript
// Pattern: Try/catch + toast with retry
async create(entity: Entity): Promise<Entity> {
  try {
    await db.transaction('rw', [db.table, db.outbox], async () => {
      await db.table.put(entity);
      await db.outbox.enqueue({...});
    });
    return entity;
  } catch (error) {
    console.error(`Failed to create ${entityType}:`, error);
    throw new Error(`Could not save. Please try again.`);
  }
}

// Caller handles:
try {
  await repository.create(entity);
  showToast({ message: 'Saved', tone: 'success' });
} catch (err) {
  showToast({
    message: err.message,
    tone: 'error',
    durationMs: 10000,
    action: { label: 'Retry', onClick: () => retry() }
  });
}
```

### 2. Service Level (Business Logic)
```typescript
// CallLifecycleService - state machine with error recovery
async completeCall(user: User, data: CallData): Promise<void> {
  try {
    // 1. Create call record
    const callRecord = await callRecordRepository.create({...});
    
    // 2. Update lead (call_count, last_contacted_at)
    await leadRepository.update(leadId, { callCount: lead.callCount + 1 });
    
    // 3. Create activity
    await activityRepository.create({...});
    
  } catch (error) {
    // F4 - Surface write failures visibly with retry action
    // The outcome modal stays open; toast adds persistent retry
    throw new SaveError(`Could not save call outcome: ${error.message}`);
  }
}
```

### 3. Component Level (UI)
```typescript
// Modal with error boundary
const CallOutcomeModal = ({ isOpen, lead, onSave, onCancel }) => {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async (data) => {
    setSaving(true);
    setError(null);
    try {
      await onSave(data);
      onCancel();
    } catch (err) {
      setError(err.message);
      // Modal stays open, inline error banner shows
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onCancel}>
      {error && <ErrorBanner message={error} />}
      <Form onSubmit={handleSave} disabled={saving} />
    </Modal>
  );
}
```

### 4. Global Error Boundary
```typescript
// ErrorBoundary.tsx - catches render errors
class ErrorBoundary extends React.Component<Props, State> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Render error:', error, errorInfo);
    // Could send to error reporting service
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-center">
          <h2 className="text-xl font-bold text-error">Something went wrong</h2>
          <p className="text-soft mt-2">{this.state.error?.message}</p>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 btn-primary"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

---

## Toast Notification System (`Toast.tsx`)

### Toast Types
```typescript
type ToastTone = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
  durationMs?: number;      // Default 5000
  action?: {
    label: string;
    onClick: () => void;
  };
}
```

### Usage Patterns
```typescript
// Success
showToast({ message: 'Lead saved', tone: 'success' });

// Error with retry
showToast({
  message: 'Failed to sync. Check connection.',
  tone: 'error',
  durationMs: 10000,
  action: { label: 'Retry Sync', onClick: () => triggerSync() }
});

// Warning
showToast({ message: 'Large import may take time', tone: 'warning' });

// Info
showToast({ message: 'Sync completed', tone: 'info' });
```

### Toast Queue
- Single toast at a time (new replaces old)
- Auto-dismiss after duration
- Action button prevents auto-dismiss on click
- Accessible: `role="status"`, `aria-live="polite"`

---

## Sync Error Handling

### Outbox Status Flow
```
PENDING → SYNCING → SYNCED
                ↓
              FAILED → retry (max 6) → SYNCING
                ↓ (exhausted)
              DEAD_LETTER
```

### Retry Logic
```typescript
// Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s
const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 32000];

async retry(item: OutboxItem): Promise<void> {
  const delay = BACKOFF_MS[Math.min(item.retryCount, BACKOFF_MS.length - 1)];
  await sleep(delay);
  await this.pushSingle(item);
}
```

### Error Surfacing
| Sync Error | User Notification |
|------------|-------------------|
| Single item failed | Silent (badge shows conflict count) |
| Batch failed | Toast: "Sync partial, retrying..." |
| Auth required | Toast: "Session expired, please login" |
| Network offline | Badge: OFFLINE (no toast) |
| Max retries | Toast: "Sync failed for X items" + DEAD_LETTER |

---

## Authentication Error Handling

### Login Flow
```typescript
const handleLogin = async (email: string, password: string) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    
    // Fetch profile
    const profile = await fetchProfile(data.user.id);
    setCurrentUser(profile);
    
    showToast({ message: 'Welcome back!', tone: 'success' });
  } catch (err) {
    setLoginError(err.message); // Inline form error
  }
}
```

### Session Management
```typescript
// AuthContext - auto-refresh
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    // Silent refresh
  } else if (event === 'SIGNED_OUT') {
    setCurrentUser(null);
    navigate('/login');
  } else if (event === 'USER_UPDATED') {
    // Refresh profile
  }
});
```

---

## Capacitor/Native Errors

### Back Button Handler
```typescript
// Robust Promise-based cleanup
useEffect(() => {
  let isMounted = true;
  
  const listenerPromise = CapacitorApp.addListener('backButton', () => {
    if (state.isSettingsModalOpen) setIsSettingsModalOpen(false);
    else if (state.isBackupModalOpen) setIsBackupModalOpen(false);
    else if (state.isWhatsAppModalOpen) { /* ... */ }
    else if (state.tab === 'DETAIL') { setSelectedLeadId(null); setTab('LEADS'); }
    else if (state.tab === 'LEADS') setTab('DASHBOARD');
    else CapacitorApp.minimizeApp();
  });

  return () => {
    isMounted = false;
    listenerPromise.then(handle => handle?.remove()).catch(console.warn);
  };
}, []);
```

### App State Change (Call Lifecycle)
```typescript
CapacitorApp.addListener('appStateChange', ({ isActive }) => {
  const attempt = CallLifecycleService.handleAppStateChange(isActive);
  if (isActive && attempt) {
    // Re-open outcome modal for pending call
    crmData.leads.getLeadById(attempt.leadId).then(lead => {
      if (lead) { setActiveOutcomeLead(lead); setIsOutcomeModalOpen(true); }
    });
  }
});
```

---

## Testing Error Scenarios

### Unit Tests
| Test File | Error Scenarios Covered |
|-----------|------------------------|
| `realDexieRepositoryOutbox.test.ts` | Transaction rollback, enqueue failure |
| `syncOutboxQueue.test.ts` | Queue status, retries, dead letter |
| `syncConflictResolver.test.ts` | 4 conflict rules |
| `backupRestoreIntegrity.test.ts` | Corrupt backup, version mismatch |

### E2E Tests
| Spec | Error Scenarios |
|------|----------------|
| `auth.spec.ts` | Invalid credentials, session expiry |
| `bugfix-verification.spec.ts` | Import failure, WhatsApp fail, backup fail |

### Manual Error Testing Checklist
- [ ] Airplane mode → create lead → verify local → enable network → verify sync
- [ ] Kill app during sync → reopen → verify data integrity
- [ ] Concurrent edit same lead on 2 devices → verify conflict resolution
- [ ] Invalid Excel import → verify error handling + partial import
- [ ] WhatsApp not installed → verify graceful fallback
- [ ] Force stop during call → verify state recovery
- [ ] Expired session → verify redirect to login
- [ ] Corrupt backup JSON → verify restore validation
- [ ] Network timeout during sync → verify retry + backoff

---

## Logging Standards

### Console Logging
```typescript
// Structured logging
console.log('[SyncEngine] Starting sync', { orgId, deviceId });
console.warn('[SyncPush] Batch failed, falling back to single', { entityType, error });
console.error('[CallLifecycle] Failed to save outcome', { leadId, error: err.message });

// Never log sensitive data:
// ❌ console.log(user.password)
// ❌ console.log(serviceRoleKey)
// ✅ console.log('Auth failed', { email: user.email, error: err.code })
```

### Error Context
```typescript
// Always include context for debugging
throw new Error(`Failed to ${action}: ${error.message}`, { 
  cause: error,
  context: { entityType, entityId, userId, timestamp: new Date().toISOString() }
});
```

---

## Known Error Handling Gaps

| Gap | Severity | Status |
|-----|----------|--------|
| No centralized error reporting service | MEDIUM | Console only |
| No error codes for programmatic handling | LOW | String matching only |
| Dead letter queue not exposed in UI | MEDIUM | Manual DB inspection |
| No structured logging format | LOW | Free-form console |
| Offline error queue not persisted across app restarts | LOW | Dexie persists |