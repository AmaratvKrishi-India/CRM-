/**
 * Central Sync Engine (Phase 2F)
 * Coordinates offline-first bidirectional synchronization between local Dexie and Supabase PostgreSQL.
 * Manages triggers (app startup, online event, interval, manual sync) and state subscriptions.
 */

import { getSupabaseClient } from '../supabaseClient';
import { reportOperationalError } from '../operationalReportingService';
import { SyncQueue } from './syncQueue';
import { SyncPush } from './syncPush';
import { SyncPull } from './syncPull';
import { SyncStateRepository } from './syncStateRepository';
import type { SyncState, SyncResult} from './syncTypes';
import { SyncCancelledError } from './syncTypes';
import { type AccessScope, sameAccessScope } from '../../db/accessScope';
import { getVerifiedCurrentAccessScope } from '../verifiedProfileService';

type SyncAuthorizer = () => Promise<AccessScope | null>;

export class SyncEngine {
  private queue: SyncQueue;
  private pushEngine: SyncPush;
  private pullEngine: SyncPull;
  private stateRepo: SyncStateRepository;

  private isSyncing = false;
  private autoSyncInterval: ReturnType<typeof setInterval> | null = null;
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
    this.authorize = authorize || getVerifiedCurrentAccessScope;

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

  private syncResult(error: string): SyncResult {
    return {
      pushedCount: 0,
      pulledCount: 0,
      failedCount: 0,
      conflictsCount: 0,
      durationMs: 0,
      error,
    };
  }

  private async prepareSyncRun(guard: () => void): Promise<
    { client: NonNullable<ReturnType<typeof getSupabaseClient>>; result?: never } |
    { client?: never; result: SyncResult }
  > {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      guard();
      await this.stateRepo.setStatus('OFFLINE');
      return { result: this.syncResult('Device is offline') };
    }

    const client = getSupabaseClient();
    if (!client) {
      return { result: this.syncResult('Supabase unconfigured') };
    }

    const verifiedScope = await this.authorize();
    guard();
    if (!verifiedScope || !sameAccessScope(verifiedScope, this.expectedScope!)) {
      await this.stateRepo.setStatus('AUTH_REQUIRED');
      return { result: this.syncResult('Authentication required') };
    }

    await this.stateRepo.setStatus('SYNCING');
    await this.notifyListeners();
    return { client };
  }

  private async recoverStuckItems(guard: () => void): Promise<void> {
    try {
      guard();
      await this.queue.recoverStuckItems();
    } catch (err) {
      if (err instanceof SyncCancelledError) throw err;
      console.warn('recoverStuckItems failed:', err);
    }
  }

  private async pushPendingUntilDrained(
    client: NonNullable<ReturnType<typeof getSupabaseClient>>,
    guard: () => void,
  ): Promise<{ pushedCount: number; failedCount: number }> {
    const maxPushPasses = 50;
    let pushPasses = 0;
    let readyWorkAfterPass = false;
    let pushedCount = 0;
    let failedCount = 0;
    const pushErrors: string[] = [];

    do {
      guard();
      const pushRes = await this.pushEngine.pushPending(client, guard);
      guard();
      pushedCount += pushRes.pushedCount;
      failedCount += pushRes.failedCount;
      if (Array.isArray(pushRes.errors)) pushErrors.push(...pushRes.errors);
      pushPasses += 1;

      if (pushRes.pushedCount === 0 && pushRes.failedCount === 0) {
        readyWorkAfterPass = false;
        break;
      }

      guard();
      readyWorkAfterPass = (await this.queue.getPendingItems(1)).length > 0;
    } while (readyWorkAfterPass && pushPasses < maxPushPasses);

    if (readyWorkAfterPass) {
      failedCount += 1;
      pushErrors.push(`Sync drain limit reached after ${maxPushPasses} push passes.`);
    }
    if (failedCount > 0) {
      void reportOperationalError('sync_push', pushErrors.join('; ') || 'Sync push failed', failedCount, client);
    }

    return { pushedCount, failedCount };
  }

  private async purgeSyncedItems(guard: () => void): Promise<void> {
    try {
      guard();
      await this.queue.purgeSyncedItems();
    } catch (err) {
      console.warn('purgeSyncedItems failed:', err);
    }
  }

  private async pullAndPersist(
    client: NonNullable<ReturnType<typeof getSupabaseClient>>,
    guard: () => void,
    failedCount: number,
  ): Promise<{ pulledCount: number; conflictsCount: number }> {
    const currentState = await this.stateRepo.getSyncState();
    guard();
    const pullRes = await this.pullEngine.pullAllChanges(currentState.lastPullCursor, client, guard);
    guard();

    const pullTimestamp = new Date().toISOString();
    const updates: Partial<Omit<SyncState, 'id' | 'organizationId' | 'userId' | 'deviceId'>> = {
      lastPullAt: pullTimestamp,
      lastSuccessfulSyncAt: pullTimestamp,
      lastSyncError: null,
      status: failedCount > 0 ? 'PENDING' : 'SYNCED',
    };
    if (pullRes.newCursor) updates.lastPullCursor = pullRes.newCursor;

    await this.stateRepo.updateSyncState(updates);
    return {
      pulledCount: pullRes.pulledCount,
      conflictsCount: pullRes.conflicts.length,
    };
  }

  private async recordSyncFailure(
    err: unknown,
    failedCount: number,
    guard: () => void,
  ): Promise<string> {
    const syncError = err instanceof Error ? err.message : 'Sync failed';
    if (err instanceof SyncCancelledError) return syncError;

    void reportOperationalError('sync_cycle', err, Math.max(1, failedCount), getSupabaseClient());
    try {
      guard();
      await this.stateRepo.setStatus('ERROR', syncError);
    } catch (stateError) {
      if (!(stateError instanceof SyncCancelledError)) throw stateError;
    }
    return syncError;
  }

  /**
   * Executes a full bidirectional sync cycle: Push -> Pull -> Update State.
   */
  async synchronizeNow(): Promise<SyncResult> {
    if (this.disposed || !this.expectedScope) {
      return this.syncResult('Synchronization context is inactive');
    }
    if (this.isSyncing) {
      return this.syncResult('Sync already in progress');
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
      const prepared = await this.prepareSyncRun(guard);
      if (prepared.result) return prepared.result;
      const client = prepared.client;

      await this.recoverStuckItems(guard);

      const pushResult = await this.pushPendingUntilDrained(client, guard);
      pushedCount = pushResult.pushedCount;
      failedCount = pushResult.failedCount;

      await this.purgeSyncedItems(guard);
      guard();
      await this.stateRepo.updateSyncState({ lastPushAt: new Date().toISOString() });

      const pullResult = await this.pullAndPersist(client, guard, failedCount);
      pulledCount = pullResult.pulledCount;
      conflictsCount = pullResult.conflictsCount;
    } catch (err: unknown) {
      syncError = await this.recordSyncFailure(err, failedCount, guard);
    } finally {
      this.isSyncing = false;
      if (!this.disposed && runGeneration === this.generation) await this.notifyListeners();
    }

    return {
      pushedCount,
      pulledCount,
      failedCount,
      conflictsCount,
      durationMs: Date.now() - startTime,
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
