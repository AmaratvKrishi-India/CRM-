/**
 * Central Sync Engine (Phase 2F)
 * Coordinates offline-first bidirectional synchronization between local Dexie and Supabase PostgreSQL.
 * Manages triggers (app startup, online event, interval, manual sync) and state subscriptions.
 */

import { getSupabaseClient, getSupabaseConfig } from '../supabaseClient';
import { AuthService } from '../authService';
import { SyncQueue } from './syncQueue';
import { SyncPush } from './syncPush';
import { SyncPull } from './syncPull';
import { SyncStateRepository } from './syncStateRepository';
import { SyncState, SyncResult, SyncEngineStatus } from './syncTypes';

export class SyncEngine {
  private queue: SyncQueue;
  private pushEngine: SyncPush;
  private pullEngine: SyncPull;
  private stateRepo: SyncStateRepository;

  private isSyncing = false;
  private autoSyncInterval: any = null;
  private listeners: Array<(state: SyncState) => void> = [];
  private onlineHandler: (() => void) | null = null;
  private offlineHandler: (() => void) | null = null;

  constructor(
    queue?: SyncQueue,
    pushEngine?: SyncPush,
    pullEngine?: SyncPull,
    stateRepo?: SyncStateRepository
  ) {
    this.queue = queue || new SyncQueue();
    this.pushEngine = pushEngine || new SyncPush(this.queue);
    this.pullEngine = pullEngine || new SyncPull();
    this.stateRepo = stateRepo || new SyncStateRepository();

    this.setupNetworkListeners();
  }

  private setupNetworkListeners(): void {
    if (typeof window !== 'undefined') {
      this.onlineHandler = () => {
        // Guard against firing after logout: only sync when a session exists.
        AuthService.getCurrentSession()
          .then((session) => {
            if (session) this.triggerSync();
          })
          .catch(() => {});
      };
      this.offlineHandler = () => {
        this.stateRepo.setStatus('OFFLINE');
        this.notifyListeners();
      };
      window.addEventListener('online', this.onlineHandler);
      window.addEventListener('offline', this.offlineHandler);
    }
  }

  /**
   * Removes window network listeners (e.g. on logout) so stale sync triggers stop.
   */
  disposeNetworkListeners(): void {
    if (typeof window !== 'undefined') {
      if (this.onlineHandler) window.removeEventListener('online', this.onlineHandler);
      if (this.offlineHandler) window.removeEventListener('offline', this.offlineHandler);
    }
    this.onlineHandler = null;
    this.offlineHandler = null;
  }

  private async notifyListeners(): Promise<void> {
    const state = await this.stateRepo.getSyncState();
    this.listeners.forEach((cb) => {
      try {
        cb(state);
      } catch (err) {
        console.warn('Sync listener error:', err);
      }
    });
  }

  /**
   * Subscribes to sync state updates.
   */
  subscribe(callback: (state: SyncState) => void): () => void {
    this.listeners.push(callback);
    this.stateRepo.getSyncState().then(callback).catch(() => {});

    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  /**
   * Retrieves current sync state.
   */
  async getSyncState(): Promise<SyncState> {
    return await this.stateRepo.getSyncState();
  }

  /**
   * Retrieves current outbox queue stats.
   */
  async getQueueStats() {
    return await this.queue.getQueueStats();
  }

  /**
   * Triggers a sync cycle if not already syncing.
   */
  async triggerSync(): Promise<SyncResult | null> {
    if (this.isSyncing) {
      return null;
    }
    return await this.synchronizeNow();
  }

  /**
   * Executes a full bidirectional sync cycle: Push -> Pull -> Update State.
   */
  async synchronizeNow(): Promise<SyncResult> {
    if (this.isSyncing) {
      return { pushedCount: 0, pulledCount: 0, failedCount: 0, conflictsCount: 0, durationMs: 0, error: 'Sync already in progress' };
    }

    const startTime = Date.now();
    this.isSyncing = true;

    // 1. Check Offline / Network Connectivity
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      await this.stateRepo.setStatus('OFFLINE');
      this.isSyncing = false;
      await this.notifyListeners();
      return { pushedCount: 0, pulledCount: 0, failedCount: 0, conflictsCount: 0, durationMs: 0, error: 'Device is offline' };
    }

    // 2. Check Supabase Client
    const client = getSupabaseClient();
    if (!client) {
      this.isSyncing = false;
      return { pushedCount: 0, pulledCount: 0, failedCount: 0, conflictsCount: 0, durationMs: 0, error: 'Supabase unconfigured' };
    }

    // 3. Check Auth Session
    const session = await AuthService.getCurrentSession();
    if (!session) {
      await this.stateRepo.setStatus('AUTH_REQUIRED');
      this.isSyncing = false;
      await this.notifyListeners();
      return { pushedCount: 0, pulledCount: 0, failedCount: 0, conflictsCount: 0, durationMs: 0, error: 'Authentication required' };
    }

    await this.stateRepo.setStatus('SYNCING');
    await this.notifyListeners();

    // Recover outbox items orphaned in SYNCING by a previously killed app run.
    try {
      await this.queue.recoverStuckItems();
    } catch (err) {
      console.warn('recoverStuckItems failed:', err);
    }

    let pushedCount = 0;
    let failedCount = 0;
    let pulledCount = 0;
    let conflictsCount = 0;
    let syncError: string | null = null;

    try {
      // 4. PUSH SYNC: Send local outbox mutations to Supabase
      const pushRes = await this.pushEngine.pushPending(client);
      pushedCount = pushRes.pushedCount;
      failedCount = pushRes.failedCount;

      // Purge successfully-synced outbox rows so the queue does not grow unbounded.
      try {
        await this.queue.purgeSyncedItems();
      } catch (err) {
        console.warn('purgeSyncedItems failed:', err);
      }

      const pushTimestamp = new Date().toISOString();
      await this.stateRepo.updateSyncState({ lastPushAt: pushTimestamp });

      // 5. PULL SYNC: Pull remote incremental changes from Supabase
      const currentState = await this.stateRepo.getSyncState();
      const pullRes = await this.pullEngine.pullAllChanges(currentState.lastPullCursor, client);
      pulledCount = pullRes.pulledCount;
      conflictsCount = pullRes.conflicts.length;

      const pullTimestamp = new Date().toISOString();
      const updates: Partial<SyncState> = {
        lastPullAt: pullTimestamp,
        lastSuccessfulSyncAt: pullTimestamp,
        lastSyncError: null,
        status: failedCount > 0 ? 'PENDING' : 'SYNCED',
      };

      if (pullRes.newCursor) {
        updates.lastPullCursor = pullRes.newCursor;
      }

      await this.stateRepo.updateSyncState(updates);
    } catch (err: any) {
      syncError = err.message || 'Sync failed';
      await this.stateRepo.setStatus('ERROR', syncError);
    } finally {
      this.isSyncing = false;
      await this.notifyListeners();
    }

    const durationMs = Date.now() - startTime;
    return {
      pushedCount,
      pulledCount,
      failedCount,
      conflictsCount,
      durationMs,
      error: syncError,
    };
  }

  /**
   * Starts periodic background synchronization.
   */
  startAutoSync(intervalMs = 60000): void {
    this.stopAutoSync();
    this.triggerSync();
    this.autoSyncInterval = setInterval(() => {
      this.triggerSync();
    }, intervalMs);
  }

  /**
   * Stops periodic background synchronization.
   */
  stopAutoSync(): void {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }
  }
}

// Global Singleton Instance
export const syncEngine = new SyncEngine();
