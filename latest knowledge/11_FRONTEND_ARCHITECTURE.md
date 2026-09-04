# 11 - FRONTEND ARCHITECTURE

## Document Metadata
- **DOCUMENT_STATUS:** CURRENT
- **LAST_VERIFIED:** 2026-08-25
- **SOURCE_OF_TRUTH:** `src/` directory analysis
- **SCOPE:** Complete frontend architecture of the Amaratv Krishi CRM
- **RELATED_DOCUMENTS:** 01_PROJECT_OVERVIEW.md, 09_ARCHITECTURE.md, 12_BACKEND_ARCHITECTURE.md

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      React 19 + Vite + TypeScript               │
├─────────────────────────────────────────────────────────────────┤
│  Context Layer                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   AuthContext   │  │  ThemeContext   │  │  ToastContext   │ │
│  │  (Supabase Auth)│  │  (Light/Dark)   │  │  (Notifications)│ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  Component Layer                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │   Admin      │  │   Agent      │  │       Shared         │ │
│  │  Components  │  │  Components  │  │       Components     │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  Service Layer                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │   Sync       │  │   Realtime   │  │    Business Logic    │ │
│  │  Services    │  │  Services    │  │     Services         │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  Data Layer                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Repositories  │  │   Dexie DB      │  │   Sync Queue    │ │
│  │  (14 repos)     │  │  (v5 schema)    │  │   (Outbox)      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Entry Points

### Main Entry: `src/main.tsx`
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### Root Component: `src/App.tsx` (692 lines)
- **Providers:** ErrorBoundary → ThemeProvider → ToastProvider → AuthProvider → MainAppRouter
- **Routing:** Role-based (ADMIN → AdminShell, AGENT → SalesAppContent)
- **Code Splitting:** React.lazy for AdminShell, BackupRestoreModal, SettingsModal, ExcelImporter
- **Capacitor Integration:** Hardware back button, app state change listeners
- **Realtime:** Initializes RealtimeService on auth, handles in-app notifications

---

## Context Providers

### AuthContext (`src/context/AuthContext.tsx` - 5,024 bytes)
| Responsibility | Implementation |
|----------------|----------------|
| Supabase Auth Session | `supabase.auth.getSession()`, `onAuthStateChange` |
| User Profile | Fetches from `profiles` table on login |
| Role Detection | `currentUser.role` (ADMIN/AGENT) |
| Session Persistence | Auto-refresh, localStorage fallback |
| Sign Out | `supabase.auth.signOut()` + cleanup |

**Exports:** `AuthProvider`, `useAuth`, `currentUser`, `isLoading`

### ThemeContext (`src/context/ThemeContext.tsx` - 2,602 bytes)
| Responsibility | Implementation |
|----------------|----------------|
| Theme Modes | `light` | `dark` | `system` |
| Persistence | `localStorage.setItem('theme-mode', mode)` |
| System Preference | `window.matchMedia('(prefers-color-scheme: dark)')` |
| DOM Application | `document.documentElement.setAttribute('data-theme', resolvedMode)` |
| CSS Variables | Defined in `index.css` for both themes |

**Exports:** `ThemeProvider`, `useTheme`, `mode`, `resolvedMode`, `toggleTheme`, `setMode`

### ToastContext (`src/components/common/Toast.tsx`)
| Responsibility | Implementation |
|----------------|----------------|
| Toast Queue | Array of toast objects with unique IDs |
| Auto-dismiss | Configurable duration (default 5000ms) |
| Action Buttons | Optional retry/undo actions |
| Tones | `success` | `error` | `info` | `warning` |

---

## Component Architecture

### Admin Components (18 files - `src/components/admin/`)
| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `AdminShell.tsx` | Main admin layout with sidebar | `onEnterSalesMode` |
| `AdminDashboardView.tsx` | KPIs, charts, activity feed | `onOpenLeads*`, `onCallLead` |
| `AdminLeadsView.tsx` | Org-wide lead list + bulk actions | `onOpenLead`, `onCallLead` |
| `AdminAgentsView.tsx` | Agent CRUD with modals | - |
| `AdminReportsView.tsx` | Multi-tab reports with CSV export | - |
| `AdminDataManagementView.tsx` | Backup, schema, migrations | - |
| `AgentCard.tsx` | Agent summary display | `agent`, `onEdit`, `onDelete` |
| `AgentPerformanceTable.tsx` | Sortable metrics table | `agents`, `metrics` |
| `AgentPerformanceDetail.tsx` | Drill-down agent metrics | `agentId` |
| `BulkLeadAssignmentModal.tsx` | Multi-select assignment wizard | `leads`, `onComplete` |
| `CreateAgentModal.tsx` | Agent creation form | `onSuccess` |
| `EditAgentModal.tsx` | Agent edit form | `agent`, `onSuccess` |
| `DeleteAgentModal.tsx` | Soft-delete confirmation | `agent`, `onConfirm` |
| `LiveActivityFeed.tsx` | Realtime activity stream | - |
| `AdminCallHistoryModal.tsx` | Call history for any lead | `leadId` |
| `ConfirmStatusModal.tsx` | Generic confirmation | `onConfirm`, `message` |
| `ReportFilterBar.tsx` | Report filter toolbar | `filters`, `onChange` |
| `ReportKpiCard.tsx` | KPI display card | `title`, `value`, `trend` |

### Agent Components (Dashboard + Leads)
| Component | File | Purpose |
|-----------|------|---------|
| SalesDashboard | `dashboard/SalesDashboard.tsx` | Agent home: KPIs, lead summary, actions |
| MinimalLeadsList | `leads/MinimalLeadsList.tsx` | Virtualized lead list with search/filter |
| LeadDetailView | `leads/LeadDetailView.tsx` | Master detail: Info, Timeline, Calls tabs |
| LeadTimelineView | `leads/LeadTimelineView.tsx` | Chronological activity log |
| CallOutcomeModal | `leads/CallOutcomeModal.tsx` | Call state machine UI |
| CreateLeadModal | `leads/CreateLeadModal.tsx` | Lead creation form |
| LeadAssignmentModal | `leads/LeadAssignmentModal.tsx` | Single lead assignment |
| FollowUpModal | `followups/FollowUpModal.tsx` | Schedule follow-up |
| FollowUpsView | `followups/FollowUpsView.tsx` | Follow-up list with filters |
| WhatsAppComposeModal | `whatsapp/WhatsAppComposeModal.tsx` | Template picker + preview |
| SettingsModal | `settings/SettingsModal.tsx` | Theme, notifications, sync, device info |
| BackupRestoreModal | `backup/BackupRestoreModal.tsx` | Full JSON backup/restore |

### Shared Components
| Component | Purpose |
|-----------|---------|
| `ErrorBoundary.tsx` | Catches render errors, shows fallback |
| `SyncStatusBadge.tsx` | Real-time sync status indicator |
| `Toast.tsx` | Notification provider + context |

---

## Routing Architecture

### Route Structure (No React Router - Manual State)
```typescript
// Admin Routes (AdminShell.tsx)
type AdminTab = 'dashboard' | 'leads' | 'agents' | 'reports' | 'data';

// Agent Routes (SalesAppContent.tsx)
type AppNavTab = 'DASHBOARD' | 'LEADS' | 'FOLLOW_UPS' | 'IMPORT' | 'DETAIL';
```

### Navigation Patterns
| Pattern | Implementation |
|---------|----------------|
| Admin | Sidebar with 5 tabs, persistent state |
| Agent | Bottom tab bar (3 tabs) + Detail/Import overlays |
| Deep Link | `/leads/:id` via `selectedLeadId` state |
| Modals | Stack-based, managed by parent component state |

---

## State Management

### Local Component State (useState)
- Form inputs, validation
- Modal open/close
- Tab selection
- Filter/search parameters
- Loading states

### Global State (Context)
- **AuthContext:** User, session, role, organization
- **ThemeContext:** Theme mode, toggle
- **ToastContext:** Notification queue

### Server State (Dexie + Sync)
- All entity data via repositories
- Sync status via `useSync()` hook
- Outbox queue status

---

## Data Layer

### Repository Pattern (14 Repositories)
```
src/db/repositories/
├── leadRepository.ts           (21,604 bytes) - Lead CRUD, filtering, bulk
├── callRecordRepository.ts     (7,475 bytes) - Verified call records
├── followUpRepository.ts       (11,087 bytes) - Follow-up lifecycle
├── userRepository.ts           (8,144 bytes) - User/profile cache
├── messageTemplateRepository.ts (5,887 bytes) - WhatsApp templates
├── messageHistoryRepository.ts (4,705 bytes) - Message tracking
├── remarkRepository.ts         (3,674 bytes) - Lead notes
├── callHistoryRepository.ts    (3,526 bytes) - Call outcome history
├── activityRepository.ts       (3,010 bytes) - Activity audit trail
├── bulkAssignmentAuditRepository.ts (3,098 bytes)
├── importAuditRepository.ts    (2,714 bytes) - Import audits
├── syncStateRepository.ts      (1,911 bytes) - Cursor state
├── syncQueue.ts                (6,584 bytes) - Outbox queue
└── index.ts                    (4,157 bytes) - Barrel export + factory
```

### Repository Interface Pattern
```typescript
interface BaseRepository<T> {
  create(entity: T): Promise<T>;
  getById(id: string): Promise<T | null>;
  update(id: string, changes: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
  findByFilter(params: FilterParams): Promise<T[]>;
  // Sync integration
  enqueue(entity: T, operation: SyncOperation): Promise<void>;
}
```

### Dexie Database (`src/db/database.ts` - 10,060 bytes)
- **Version 5** schema with 13 stores
- **Compound indexes** for mobile filtering
- **Hooks:** `creating` (timestamps, isSynced=0), `updating` (updatedAt, isSynced=0)
- **Seed:** Default WhatsApp templates

---

## Sync Integration

### Outbox Queue (`syncQueue.ts`)
- Every repository write calls `syncQueue.enqueue()` in same transaction
- **BUG-4 Fix:** Enqueue failure aborts transaction (atomic write+queue)
- Compound index: `[status+createdAt]`

### SyncEngine (`syncEngine.ts` - 7,600 bytes)
- Push-then-Pull pattern
- Single-flight mutex
- Exponential backoff: 1s → 2s → 4s → 8s → 16s → 32s (cap)

### Background Sync (`backgroundSyncManager.ts` - 5,385 bytes)
**Triggers:**
- User login (immediate full sync)
- App resume (`App.addListener`)
- Visibility change (`document.visibilityState`)
- Network reconnect (`window.addEventListener('online')`)
- Periodic interval (configurable)

---

## Realtime Integration

### RealtimeService (`realtimeService.ts` - 13,173 bytes)
- Subscribes to 8 tables via Supabase `postgres_changes`
- **Tables:** profiles, leads, call_records, activities, remarks, follow_ups, message_history, import_audits
- **Events:** INSERT, UPDATE, DELETE
- **Reconciliation:** Hydrates into local Dexie + emits to listeners
- **Connection States:** DISCONNECTED → CONNECTING → SUBSCRIBING → SUBSCRIBED → RECONNECTING → ERROR

### useSync Hook (`useSync.ts` - 845 bytes)
```typescript
interface UseSyncReturn {
  status: SyncEngineStatus;
  lastSync: Date | null;
  error: string | null;
  triggerSync: () => Promise<void>;
}
```

---

## Code Splitting & Performance

### Lazy Loading (React.lazy + Suspense)
| Component | Reason |
|-----------|--------|
| AdminShell | Heavy admin bundle (only for ADMIN role) |
| BackupRestoreModal | Infrequently used |
| SettingsModal | Infrequently used |
| ExcelImporter | Admin-only, large (xlsx library) |

### Bundle Optimization (vite.config.ts)
```typescript
manualChunks: {
  'vendor-react': ['react', 'react-dom'],
  'vendor-supabase': ['@supabase/supabase-js'],
  'vendor-dexie': ['dexie'],
  'vendor-ui': ['lucide-react', 'clsx', 'tailwind-merge'],
  'admin': ['src/components/admin/**'],
}
```

---

## Capacitor Native Integration

### Native Platform Service (`nativePlatform.ts` - 4,941 bytes)
| Feature | Implementation |
|---------|----------------|
| Phone Dialer | `CapacitorApp.openUrl('tel:...')` |
| Share | `Share.share({ title, text, url })` |
| Local Notifications | `LocalNotifications.schedule()` |
| Device Info | `Device.getInfo()`, `Device.getId()` |
| App State | `App.addListener('appStateChange')` |
| Back Button | `App.addListener('backButton')` |

### Call Lifecycle Service (`callLifecycleService.ts` - 10,131 bytes)
**State Machine:**
```
IDLE → DIAL_ATTEMPT → (CONNECTED | NOT_CONNECTED | CANCELLED) → OUTCOME_LOGGED
```
- Tracks `dialAttemptId` for idempotency
- Handles app background/foreground transitions
- Verifies duration via foreground time

---

## Error Handling

### ErrorBoundary (`ErrorBoundary.tsx` - 3,355 bytes)
- Catches render errors in subtree
- Shows fallback UI with retry button
- Logs to console + error reporting (if configured)

### Toast Error Pattern
```typescript
showToast({
  message: 'User-friendly error',
  tone: 'error',
  durationMs: 10000,
  action: { label: 'Retry', onClick: () => retryFn() }
});
```

### Service-Level Errors
- Repository methods throw on failure
- Callers catch and show toast with retry
- Sync errors → `SyncEngineStatus.ERROR` + badge

---

## Build & Deployment

### Build Command
```bash
npm run build  # Vite production build
```

### Output
- `dist/` - Static assets for Vercel
- `android/` - Capacitor sync for Android build

### Environment Variables
| Env | Purpose |
|-----|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_APP_VERSION` | Injected at build time |

---

## Testing

### Unit/Integration (`tests/` - 18 files, 119 tests)
| Test File | Coverage |
|-----------|----------|
| `realDexieRepositoryOutbox.test.ts` | Repository + outbox atomicity |
| `syncOutboxQueue.test.ts` | Outbox queue behavior |
| `syncConflictResolver.test.ts` | Conflict resolution rules |
| `realCallLifecycle.test.ts` | Call state machine |
| `realExcelParser.test.ts` | Excel parsing |
| `realTemplateRenderer.test.ts` | WhatsApp templates |
| `leadNormalizer.test.ts` | Phone/address normalization |
| `securityRlsIsolation.test.ts` | RLS agent/admin isolation |
| `securitySecretScan.test.ts` | Secret scanning |
| `backupRestoreIntegrity.test.ts` | Backup/restore safety |
| `agentDeletion.test.ts` | Agent soft delete |
| `appTypography.test.ts` | Font/contrast tokens |
| `themeMode.test.ts` | Theme switching |
| `backgroundSync.test.ts` | Background sync lifecycle |

### E2E (`e2e/` - 6 files, 32 tests)
| Spec | Tests |
|------|-------|
| `auth.spec.ts` | Login, session persistence |
| `crm-navigation.spec.ts` | Navigation, lead workflows |
| `bugfix-verification.spec.ts` | Import, WhatsApp, dashboard, backup |
| `mobile-responsive.spec.ts` | Viewport, responsive design |
| `theme.spec.ts` | Dark/light mode |

---

## Known Frontend Limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| No virtualization for large lists | Memory on 1000+ leads | Current dataset < 200 leads |
| Single toast queue | Overlapping toasts lost | Duration + action buttons |
| No React Router | Manual state management | Simple enough for current routes |
| All realtime subscriptions | Bandwidth on slow networks | Single-flight, no duplicate subs |
| No PWA service worker | Offline web limited | Capacitor handles Android offline |