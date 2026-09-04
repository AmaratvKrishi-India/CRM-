# Background synchronisation architecture

Background synchronization is silent and optional from the user's perspective. Login/session restore, foreground resume, browser visibility, network reconnect, the periodic foreground interval, and the manual Sync Now action all delegate to the current account-scoped `SyncEngine`.

The manager does not own a global engine. It captures the active data layer and generation; stop, logout, account change, role change, or revocation disposes that engine and invalidates its callbacks. Realtime is unsubscribed on the same paths. A late network response cannot mark an old account's item synced or advance its cursor.

Only one cycle can run for an account at a time. A cycle performs server-authoritative profile validation, recovers same-account items left `SYNCING` by force-stop, pushes the exact-scope outbox, then performs a scoped incremental pull. Reconnect uses this normal pull path to recover missed realtime events.

Outbox failures retain their original organization/user identity. Per-item retries back off from 1 second to a 32-second cap and enter `DEAD_LETTER` after ten attempts; inspected recovery is explicit. Manager-level retry is also bounded. Pending and failed work survives application restart in the account's partitioned IndexedDB database.

Android may suspend JavaScript while the application is killed or deeply backgrounded. No claim is made that work continues while killed. On restart or foreground, the persisted account outbox and cursor resume only after the session is revalidated. Phase 3 covers this deterministic persistence/recovery behavior without physical-device testing.
