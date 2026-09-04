# 02 - SYSTEM ARCHITECTURE

## High-Level Architecture
The Amaratv Krishi Field Sales CRM follows an offline-first architecture designed for agents working in regions with intermittent network connectivity. 
The data flow and high-level stack is as follows:
**React 19 SPA -> Capacitor 8 (Android wrapper) -> Dexie (local IndexedDB) -> SyncEngine (push/pull) -> Supabase PostgreSQL (cloud)**

This architecture ensures the app remains fully functional offline, capturing leads, remarks, and call histories locally, which are later synced seamlessly once the network is restored.

## Frontend Architecture
The user interface and application layer are built for performance and native-like responsiveness.
- **Frameworks & Build Tools**: React 19 SPA, Vite 8 build, TypeScript 7.
- **Entry Flow**: `main.tsx` -> [`App.tsx`](file:///c:/Users/PC/Desktop/calling%20app/src/App.tsx) -> ThemeProvider -> AuthProvider -> ErrorBoundary.
- **Role-based Routing**: 
  - **ADMIN**: Accesses the [`AdminShell`](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/AdminShell.tsx) consisting of 6 distinct tabs.
  - **AGENT**: Accesses the `SalesAppContent` featuring 3 tabs along with detail and import views.
- **State Management**: Utilizes React `useState` and `useEffect` combined with React Context ([`AuthContext.tsx`](file:///c:/Users/PC/Desktop/calling%20app/src/context/AuthContext.tsx), [`ThemeContext.tsx`](file:///c:/Users/PC/Desktop/calling%20app/src/context/ThemeContext.tsx)) and Dexie live queries for reactive database state.
- **Styling**: Tailwind CSS 4 utilizing brand (green) and earth (brown) color palettes, Inter font, and complete Day/Night themes.

## Data Layer Architecture
The local offline database enables robust querying and temporary offline storage.
- **Engine**: Dexie.js (IndexedDB wrapper) via the `SalesCRMDatabase` class defined in [`database.ts`](file:///c:/Users/PC/Desktop/calling%20app/src/db/database.ts), utilizing 13 stores in version 5.
- **Core Tables**: `leads`, `remarks`, `callHistory`, `followUps`, `messageHistory`, `messageTemplates`, `users`, `activities`, `callRecords`, `importAudits`, `outbox`, `syncState`, `bulkAssignmentAudits`.
- **Indexing**: Extensive use of compound indexes for fast filtered queries.
- **Lifecycle Hooks**: Automatic hooks for population of `createdAt`, `updatedAt`, `isSynced`, and `deletedAt`.
- **Pattern**: Implements a Repository pattern via 11 repository classes wrapping Dexie tables.
- **Initialization**: A factory function `createCRMDataLayer()` exposed in [`index.ts`](file:///c:/Users/PC/Desktop/calling%20app/src/db/index.ts) provides the `crmData` singleton. Data types defined in [`types.ts`](file:///c:/Users/PC/Desktop/calling%20app/src/db/types.ts).

## Sync Architecture
The synchronization mechanism ensures that local modifications are seamlessly communicated with the cloud backend when connectivity is available.
- **Scope**: Every engine, cursor, outbox item, retry, and realtime generation belongs to one exact organization/user/role context and its partitioned Dexie database.
- **Authority**: `SyncEngine` revalidates the current server profile before push/pull and cancels stale generations on logout, revocation, role/account change, or disposal.
- **Push**: Transactional outbox mutations preserve original scope. CREATE/UPDATE are idempotent upserts; DELETE is a scoped delete and never an upsert.
- **Pull**: Every query is organization-filtered and agent-filtered where applicable. The cursor advances only after complete reconciliation and the authoritative visibility snapshot.
- **Pruning**: Assignment revocation, remote deletion, and access loss remove inaccessible lead graphs and their queued mutations.
- **Conflict resolution**: deterministic timestamp LWW with remote tie-break, append-only tombstone protection, and verified-call protections.
- **Automation**: login, resume, visibility, reconnect, interval, realtime recovery, and manual triggers share the current engine's single-flight cycle.
- **Recovery**: bounded 1–32 second retry, ten-attempt dead letter, explicit recovery, and immediate same-account recovery of force-stopped `SYNCING` items.

## Realtime Architecture
Realtime subscriptions keep the active application in sync with backend changes in near real-time.
- **Service**: `RealtimeService` implemented in [`realtimeService.ts`](file:///c:/Users/PC/Desktop/calling%20app/src/services/realtime/realtimeService.ts) acts as the Supabase Realtime channel subscriber.
- **Scope**: Subscribes to 8 of the 9 published tables (`bulk_assignment_audits` is published but not subscribed by the client).
- **Hydration**: Hydrates incoming changes directly into the local Dexie stores.
- **Features**: Provides live activity feeds, in-app notifications, and tracks connection status.
- **Connection States**: Manages states transitioning through `DISCONNECTED` -> `CONNECTING` -> `SUBSCRIBING` -> `SUBSCRIBED` -> `RECONNECTING` -> `ERROR`.

## Authentication Architecture
Secure access is tightly integrated with Supabase edge capabilities.
- **Provider**: Supabase Auth using email and password.
- **Service**: `AuthService` in [`authService.ts`](file:///c:/Users/PC/Desktop/calling%20app/src/services/authService.ts) orchestrates sign-in processes and local user caching in the Dexie `users` table.
- **Context**: The `AuthContext` provides the React app with `currentUser`, `signIn`, and `signOut` capabilities.
- **Roles**: User roles (`ADMIN` or `AGENT`) are extracted from the `profiles` table.
- **Persistence**: Session tokens are persisted locally by the Supabase client ([`supabaseClient.ts`](file:///c:/Users/PC/Desktop/calling%20app/src/services/supabaseClient.ts)).

## Backend Architecture
The cloud source of truth, emphasizing security and agent data isolation.
- **Database**: Supabase PostgreSQL featuring 10 tables initialized over 6 migrations.
- **Security**: Robust Row Level Security (RLS) is applied to all tables, supplemented by 5 helper functions.
- **Isolation**: Agent Lead Isolation guarantees that agents only have visibility into leads assigned to them (`assigned_to`) or created by them (`created_by`).
- **Immutability**: Employs 2 immutability triggers protecting specific profile and lead fields.
- **Publication**: Realtime publication enabled for 9 tables configured with `REPLICA IDENTITY FULL` (8 in migration 4 plus `bulk_assignment_audits` in migration 5).
- **Edge Functions**: Specialized tasks are handled by edge functions, such as the `create-agent` function located at `supabase/functions/create-agent/index.ts`.

## Native Platform Layer
Allows the web application to function securely and effectively as an Android application.
- **Bridge**: Capacitor 8 bridges the web application to Android native APIs.
- **NativePlatformService**: Located in [`nativePlatform.ts`](file:///c:/Users/PC/Desktop/calling%20app/src/services/nativePlatform.ts), it handles native intent dialing (`tel:`), WhatsApp deep-linking, local notifications, and native sharing.
- **Device Identification**: A `DeviceService` generates and stores a stable client UUID in `localStorage`.
- **Scheme**: Uses the `https` Android Scheme to enforce secure WebView execution.

## Key Source Files
For a deeper dive into the system architecture, reference these essential source files:
- [App.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/App.tsx)
- [database.ts](file:///c:/Users/PC/Desktop/calling%20app/src/db/database.ts)
- [index.ts](file:///c:/Users/PC/Desktop/calling%20app/src/db/index.ts)
- [types.ts](file:///c:/Users/PC/Desktop/calling%20app/src/db/types.ts)
- [syncEngine.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/syncEngine.ts)
- [syncPush.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/syncPush.ts)
- [syncPull.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/syncPull.ts)
- [syncQueue.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/syncQueue.ts)
- [syncConflictResolver.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/syncConflictResolver.ts)
- [backgroundSyncManager.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/backgroundSyncManager.ts)
- [realtimeService.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/realtime/realtimeService.ts)
- [authService.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/authService.ts)
- [supabaseClient.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/supabaseClient.ts)
- [nativePlatform.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/nativePlatform.ts)
- [AdminShell.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/AdminShell.tsx)
- [AuthContext.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/context/AuthContext.tsx)
- [ThemeContext.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/context/ThemeContext.tsx)
