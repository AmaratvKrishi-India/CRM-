/**
 * Central Sync Engine (Phase 2F)
 * Coordinates offline-first bidirectional synchronization between local Dexie and Supabase PostgreSQL.
 * Manages triggers (app startup, online event, interval, manual sync) and state subscriptions.
 */

import { getSupabaseClient } from '../supabaseClient';
import { SyncQueue } from './syncQueue';
import { SyncPush } from './syncPush';
import { SyncPull } from './syncPull';
import { SyncStateRepository } from './syncStateRepository';
import type { SyncState, SyncResult} from './syncTypes';
import { SyncCancelledError } from './syncTypes';
import { accessScopeFromUser, type AccessScope, sameAccessScope } from '../../db/accessScope';

type SyncAuthorizer = () => Promise<AccessScope | null>;

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
  private generation = 0;
  private disposed = false;
  private readonly expectedScope: AccessScope | null;
  private readonly authorize: SyncAuthorizer;

  constructor(
    queue?: SyncQueue,
    pushEngine?: SyncPush,
    pullEngine?: SyncPull,
    stateRepo?: SyncStateRepository,
    authorize?: SyncAuthorizer
  ) {
    this.queue = queue || new SyncQueue();
    this.pushEngine = pushEngine || new SyncPush(this.queue);
    this.pullEngine = pullEngine || new SyncPull();
    this.stateRepo = stateRepo || new SyncStateRepository();
    try {
      this.expectedScope = this.stateRepo.getAccessScope();
    } catch {
      this.expectedScope = null;
    }
    this.authorize = authorize || (async () => {
      // Avoid an eager SyncEngine -> AuthService -> db/index -> SyncEngine
      // cycle during application bootstrap. Authentication is needed only
      // when a real sync begins.
      const { AuthService } = await import('../authService');
      const { user } = await AuthService.validateAndLoadCurrentProfile();
      return user ? accessScopeFromUser(user) : null;
    });

    this.setupNetworkListeners();
  }

  private setupNetworkListeners(): void {
    if (typeof window !== 'undefined') {
      this.onlineHandler = () => {
        if (!this.disposed) void this.triggerSync();
      };
      this.offlineHandler = () => {
        if (this.disposed) return;
        void this.stateRepo.setStatus('OFFLINE').then(() => this.notifyListeners()).catch(() => {});
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

  /** Invalidates in-flight work and permanently retires this account-bound engine. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation++;
    this.stopAutoSync();
    this.disposeNetworkListeners();
    this.listeners = [];
  }

  private assertRunActive(runGeneration: number): void {
    if (this.disposed || runGeneration !== this.generation || !this.expectedScope) {
      throw new SyncCancelledError();
    }
    const current = this.stateRepo.getAccessScope();
    if (!sameAccessScope(current, this.expectedScope)) {
      throw new SyncCancelledError('Synchronization account context changed during the run.');
    }
  }

  private async notifyListeners(): Promise<void> {
    if (this.disposed) return;
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
    if (this.disposed) return () => {};
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
    if (this.disposed || this.isSyncing) {
      return null;
    }
    return await this.synchronizeNow();
  }

  /**
   * Executes a full bidirectional sync cycle: Push -> Pull -> Update State.
   */
  async synchronizeNow(): Promise<SyncResult> {
    if (this.disposed || !this.expectedScope) {
      return { pushedCount: 0, pulledCount: 0, failedCount: 0, conflictsCount: 0, durationMs: 0, error: 'Synchronization context is inactive' };
    }
    if (this.isSyncing) {
      return { pushedCount: 0, pulledCount: 0, failedCount: 0, conflictsCount: 0, durationMs: 0, error: 'Sync already in progress' };
    }

    const startTime = Date.now();
    const runGeneration = this.generation;
    const guard = () => this.assertRunActive(runGeneration);
    this.isSyncing = true;
    let pushedCount = 0;
    let failedCount = 0;
    let pulledCount = 0;
    let conflictsCount = 0;
    let syncError: string | null = null;

    try {

    // 1. Check Offline / Network Connectivity
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      guard();
      await this.stateRepo.setStatus('OFFLINE');
      return { pushedCount: 0, pulledCount: 0, failedCount: 0, conflictsCount: 0, durationMs: 0, error: 'Device is offline' };
    }

    // 2. Check Supabase Client
    const client = getSupabaseClient();
    if (!client) {
      return { pushedCount: 0, pulledCount: 0, failedCount: 0, conflictsCount: 0, durationMs: 0, error: 'Supabase unconfigured' };
    }

    // 3. Revalidate the server-authoritative identity and role for this exact
    // account context. A cached session alone cannot authorize synchronization.
    const verifiedScope = await this.authorize();
    guard();
    if (!verifiedScope || !sameAccessScope(verifiedScope, this.expectedScope)) {
      await this.stateRepo.setStatus('AUTH_REQUIRED');
      return { pushedCount: 0, pulledCount: 0, failedCount: 0, conflictsCount: 0, durationMs: 0, error: 'Authentication required' };
    }

    await this.stateRepo.setStatus('SYNCING');
    await this.notifyListeners();

    // Recover outbox items orphaned in SYNCING by a previously killed app run.
    try {
      guard();
      await this.queue.recoverStuckItems();
    } catch (err) {
      if (err instanceof SyncCancelledError) throw err;
      console.warn('recoverStuckItems failed:', err);
    }

      // 4. PUSH SYNC: Send local outbox mutations to Supabase
      guard();
      const pushRes = await this.pushEngine.pushPending(client, guard);
      guard();
      pushedCount = pushRes.pushedCount;
      failedCount = pushRes.failedCount;

      // Purge successfully-synced outbox rows so the queue does not grow unbounded.
      try {
        guard();
        await this.queue.purgeSyncedItems();
      } catch (err) {
        console.warn('purgeSyncedItems failed:', err);
      }

      const pushTimestamp = new Date().toISOString();
      guard();
      await this.stateRepo.updateSyncState({ lastPushAt: pushTimestamp });

      // 5. PULL SYNC: Pull remote incremental changes from Supabase
      const currentState = await this.stateRepo.getSyncState();
      guard();
      const pullRes = await this.pullEngine.pullAllChanges(currentState.lastPullCursor, client, guard);
      guard();
      pulledCount = pullRes.pulledCount;
      conflictsCount = pullRes.conflicts.length;

      const pullTimestamp = new Date().toISOString();
      const updates: Partial<Omit<SyncState, 'id' | 'organizationId' | 'userId' | 'deviceId'>> = {
        lastPullAt: pullTimestamp,
        lastSuccessfulSyncAt: pullTimestamp,
        lastSyncError: null,
        status: failedCount > 0 ? 'PENDING' : 'SYNCED',
      };

      if (pullRes.newCursor) {
        updates.lastPullCursor = pullRes.newCursor;
      }

      await this.stateRepo.updateSyncState(updates);
    } catch (err: unknown) {
      syncError = err instanceof Error ? err.message : 'Sync failed';
      if (!(err instanceof SyncCancelledError)) {
        try {
          guard();
          await this.stateRepo.setStatus('ERROR', syncError);
        } catch (stateError) {
          if (!(stateError instanceof SyncCancelledError)) throw stateError;
        }
      }
    } finally {
      this.isSyncing = false;
      if (!this.disposed && runGeneration === this.generation) await this.notifyListeners();
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
    if (this.disposed) return;
    this.stopAutoSync();
    this.triggerSync();
    this.autoSyncInterval = setInterval(() => {
      void this.triggerSync();
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
