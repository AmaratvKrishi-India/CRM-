/**
 * Sync Outbox Queue Manager (Phase 2F)
 * Enqueues local mutations for asynchronous push synchronization.
 * Guarantees zero mutation loss during offline periods and handles retries.
 */

import type { SalesCRMDatabase } from '../../db/database';
import { db as defaultDb } from '../../db/database';
import { DeviceService } from '../deviceService';
import type { OutboxItem, SyncEntityType, SyncOperation } from './syncTypes';

export class SyncQueue {
  /** Items that fail this many times are parked as DEAD_LETTER instead of retrying forever. */
  static readonly MAX_RETRY_COUNT = 10;
  static readonly RETRY_BASE_MS = 1000;
  static readonly RETRY_MAX_MS = 32_000;

  private database?: SalesCRMDatabase;

  constructor(database?: SalesCRMDatabase) {
    this.database = database;
  }

  private getDatabase(): SalesCRMDatabase {
    return this.database || defaultDb;
  }

  private generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Enqueues a local entity mutation into the persistent outbox.
   */
  async enqueue(input: {
    entityType: SyncEntityType;
    entityId: string;
    operation: SyncOperation;
    payload: Record<string, any>;
    userId: string;
    organizationId?: string | null;
    deviceId?: string | null;
  }): Promise<OutboxItem> {
    const database = this.getDatabase();
    const scope = database.requireAccessScope();
    if (input.userId !== scope.userId) {
      throw new Error('Outbox mutation user does not match the active access scope.');
    }
    if (input.organizationId !== undefined && input.organizationId !== scope.organizationId) {
      throw new Error('Outbox mutation organization does not match the active access scope.');
    }
    const now = new Date().toISOString();
    const deviceId = input.deviceId || DeviceService.getDeviceId();

    const item: OutboxItem = {
      id: this.generateId(),
      organizationId: scope.organizationId,
      userId: scope.userId,
      deviceId,
      entityType: input.entityType,
      entityId: input.entityId,
      operation: input.operation,
      payload: input.payload,
      createdAt: now,
      updatedAt: now,
      retryCount: 0,
      lastAttemptAt: null,
      nextAttemptAt: null,
      lastError: null,
      status: 'PENDING',
    };

    await database.outbox.add(item);
    return item;
  }

  /**
   * Retrieves pending or retryable outbox items.
   * Items that exceeded MAX_RETRY_COUNT are parked as DEAD_LETTER and excluded.
   */
  async getPendingItems(limit = 50): Promise<OutboxItem[]> {
    const database = this.getDatabase();
    const scope = database.requireAccessScope();
    const items = await database.outbox
      .where('status')
      .anyOf('PENDING', 'FAILED')
      .sortBy('createdAt');

    const retryable: OutboxItem[] = [];
    const nowMs = Date.now();
    for (const item of items) {
      if (item.organizationId !== scope.organizationId || item.userId !== scope.userId) continue;
      if (item.retryCount >= SyncQueue.MAX_RETRY_COUNT) {
        // Park permanently failing items so they stop blocking the queue.
        await database.outbox.update(item.id, {
          status: 'DEAD_LETTER',
          updatedAt: new Date().toISOString(),
        });
        continue;
      }
      if (item.nextAttemptAt && new Date(item.nextAttemptAt).getTime() > nowMs) continue;
      retryable.push(item);
      if (retryable.length >= limit) break;
    }

    return retryable;
  }

  /**
   * Resets account-scoped SYNCING items orphaned by a killed/cancelled run.
   * This is called only after the engine single-flight lock is acquired, so any
   * existing SYNCING row belongs to an earlier process or account generation.
   */
  async recoverStuckItems(): Promise<number> {
    const database = this.getDatabase();
    const scope = database.requireAccessScope();
    const now = new Date().toISOString();

    const syncingItems = await database.outbox.where('status').equals('SYNCING').toArray();
    const stuckIds = syncingItems
      .filter(
        (item) =>
          item.organizationId === scope.organizationId &&
          item.userId === scope.userId
      )
      .map((item) => item.id);

    if (stuckIds.length === 0) return 0;

    await database.transaction('rw', database.outbox, async () => {
      for (const id of stuckIds) {
        await database.outbox.update(id, {
          status: 'PENDING',
          nextAttemptAt: null,
          updatedAt: now,
        });
      }
    });

    return stuckIds.length;
  }

  /**
   * Marks outbox items as currently SYNCING.
   */
  async markSyncing(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const database = this.getDatabase();
    const scope = database.requireAccessScope();
    const now = new Date().toISOString();

    await database.transaction('rw', database.outbox, async () => {
      for (const id of ids) {
        const item = await database.outbox.get(id);
        if (!item || item.organizationId !== scope.organizationId || item.userId !== scope.userId) continue;
        await database.outbox.update(id, {
          status: 'SYNCING',
          lastAttemptAt: now,
          nextAttemptAt: null,
          updatedAt: now,
        });
      }
    });
  }

  /**
   * Marks outbox items as successfully SYNCED.
   */
  async markSynced(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const database = this.getDatabase();
    const scope = database.requireAccessScope();
    const now = new Date().toISOString();

    await database.transaction('rw', database.outbox, async () => {
      for (const id of ids) {
        const item = await database.outbox.get(id);
        if (!item || item.organizationId !== scope.organizationId || item.userId !== scope.userId) continue;
        await database.outbox.update(id, {
          status: 'SYNCED',
          nextAttemptAt: null,
          lastError: null,
          updatedAt: now,
        });
      }
    });
  }

  /**
   * Marks an outbox item as FAILED with error message and incremented retry count.
   */
  async markFailed(id: string, error: string): Promise<void> {
    const database = this.getDatabase();
    const scope = database.requireAccessScope();
    const now = new Date().toISOString();
    const item = await database.outbox.get(id);
    if (!item || item.organizationId !== scope.organizationId || item.userId !== scope.userId) return;

    const retryCount = item.retryCount + 1;
    const deadLetter = retryCount >= SyncQueue.MAX_RETRY_COUNT;
    const retryDelay = Math.min(
      SyncQueue.RETRY_BASE_MS * Math.pow(2, Math.max(0, retryCount - 1)),
      SyncQueue.RETRY_MAX_MS
    );
    await database.outbox.update(id, {
      status: deadLetter ? 'DEAD_LETTER' : 'FAILED',
      retryCount,
      nextAttemptAt: deadLetter ? null : new Date(Date.now() + retryDelay).toISOString(),
      lastError: error,
      updatedAt: now,
    });
  }

  /** Explicit recovery path for an inspected dead-letter item. */
  async retryDeadLetter(id: string): Promise<void> {
    const database = this.getDatabase();
    const scope = database.requireAccessScope();
    const item = await database.outbox.get(id);
    if (!item || item.organizationId !== scope.organizationId || item.userId !== scope.userId) {
      throw new Error('Dead-letter mutation was not found in the active account context.');
    }
    if (item.status !== 'DEAD_LETTER') {
      throw new Error('Only dead-letter mutations can be manually retried.');
    }
    await database.outbox.update(id, {
      status: 'PENDING',
      retryCount: 0,
      lastAttemptAt: null,
      nextAttemptAt: null,
      lastError: null,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Returns summary counts of the outbox queue.
   */
  async getQueueStats(): Promise<{
    pending: number;
    syncing: number;
    synced: number;
    failed: number;
    deadLetter: number;
    total: number;
  }> {
    const database = this.getDatabase();
    const scope = database.requireAccessScope();
    const all = (await database.outbox.toArray()).filter(
      (item) => item.organizationId === scope.organizationId && item.userId === scope.userId
    );
    let pending = 0;
    let syncing = 0;
    let synced = 0;
    let failed = 0;
    let deadLetter = 0;

    for (const item of all) {
      if (item.status === 'PENDING') pending++;
      else if (item.status === 'SYNCING') syncing++;
      else if (item.status === 'SYNCED') synced++;
      else if (item.status === 'FAILED') failed++;
      else if (item.status === 'DEAD_LETTER') deadLetter++;
    }

    return { pending, syncing, synced, failed, deadLetter, total: all.length };
  }

  /**
   * Deletes synced outbox items to free storage.
   */
  async purgeSyncedItems(): Promise<number> {
    const database = this.getDatabase();
    const scope = database.requireAccessScope();
    const syncedItems = await database.outbox
      .where('status')
      .equals('SYNCED')
      .toArray();
    const syncedIds = syncedItems
      .filter((item) => item.organizationId === scope.organizationId && item.userId === scope.userId)
      .map((item) => item.id);

    await database.outbox.bulkDelete(syncedIds);
    return syncedIds.length;
  }
}
