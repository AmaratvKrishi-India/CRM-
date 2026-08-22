# Background Synchronisation Architecture

## 1. Principles & Zero-Friction UX
The Amaratv Krishi Field Sales CRM adheres to strict offline-first principles:
1. **Never Block or Interrupt the User:** The application NEVER shows "Please sync your data" popups, blocking loaders, or forced sync confirmations during field calling workflows.
2. **Automatic Lifecycle Triggering:** Sync operates silently in the background whenever conditions permit.
3. **Optional Manual Trigger:** An optional "Sync Now" button is available in the UI (Settings / Header) for manual verification, but is never required for normal operations.

---

## 2. Synchronization Lifecycle & Triggers
The `BackgroundSyncManager` singleton registers the following automated triggers upon successful authentication:
- **Startup / Session Restore:** As soon as the app loads with an active session, a silent sync cycle is executed.
- **Network Reconnect:** Listens to Capacitor `Network.addListener('networkStatusChange')` and browser `online` events to immediately trigger outbox drain and delta pull upon regaining internet connectivity.
- **App Resume / Foregrounding:** Listens to Capacitor `App.addListener('appStateChange')` (`isActive === true`) and DOM `visibilitychange` (`!document.hidden`) to sync fresh updates when the representative switches back to the CRM from the native phone dialer or WhatsApp.
- **Periodic Interval:** Executes every 60 seconds while the application is in the foreground.
- **Realtime Acceleration:** Supabase WebSocket channel receives remote inserts/updates and accelerates them directly into local Dexie.

---

## 3. Concurrency Protection & Resilience
- **Single-Flight Mutex (`isSyncing`):** Prevents concurrent overlapping push/pull cycles. If a sync is already running, incoming triggers return immediately without queuing duplicates.
- **Exponential Backoff:** If a sync cycle fails due to network errors or cloud downtime, retries back off exponentially:
  - 1s → 2s → 4s → 8s → 16s → 32s (capped at 32 seconds, max 6 attempts).
  - Backoff counters reset immediately upon successful sync or network reconnect.
- **Transactional Outbox Queue:** Local mutations (leads created/updated, calls logged, remarks added) are written synchronously to the local Dexie `outbox` table before returning to the UI. Outbox items persist across app restarts until confirmed by the server.

---

## 4. Android Background Execution Constraints
- **Foreground Auto-Sync:** Fully reliable via Capacitor app state and WebView lifecycle events.
- **Killed / Background State:** Android OS restricts background JavaScript execution when an app is in deep sleep or killed. The CRM handles this cleanly by executing a comprehensive delta sync the instant the app returns to foreground.
- **No Invasive Permissions:** Avoids background battery drain, background location, or intrusive persistent notification requirements.
