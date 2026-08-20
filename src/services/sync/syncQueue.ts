/**
 * Sync Outbox Queue Manager (Phase 2F)
 * Enqueues local mutations for asynchronous push synchronization.
 * Guarantees zero mutation loss during offline periods and handles retries.
 */

import { db as defaultDb, SalesCRMDatabase } from '../../db/database';
import { DeviceService } from '../deviceService';
import { OutboxItem, SyncEntityType, SyncOperation } from './syncTypes';

export class SyncQueue {
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
    const now = new Date().toISOString();
    const deviceId = input.deviceId || DeviceService.getDeviceId();

    const item: OutboxItem = {
      id: this.generateId(),
      organizationId: input.organizationId || null,
      userId: input.userId,
      deviceId,
      entityType: input.entityType,
      entityId: input.entityId,
      operation: input.operation,
      payload: input.payload,
      createdAt: now,
      updatedAt: now,
      retryCount: 0,
      lastAttemptAt: null,
      lastError: null,
      status: 'PENDING',
    };

    await database.outbox.add(item);
    return item;
  }

  /**
   * Retrieves pending or retryable outbox items.
   */
  async getPendingItems(limit = 50): Promise<OutboxItem[]> {
    const database = this.getDatabase();
    const items = await database.outbox
      .where('status')
      .anyOf('PENDING', 'FAILED')
      .sortBy('createdAt');

    return items.slice(0, limit);
  }

  /**
   * Marks outbox items as currently SYNCING.
   */
  async markSyncing(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const database = this.getDatabase();
    const now = new Date().toISOString();

    await database.transaction('rw', database.outbox, async () => {
      for (const id of ids) {
        await database.outbox.update(id, {
          status: 'SYNCING',
          lastAttemptAt: now,
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
    const now = new Date().toISOString();

    await database.transaction('rw', database.outbox, async () => {
      for (const id of ids) {
        await database.outbox.update(id, {
          status: 'SYNCED',
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
    const now = new Date().toISOString();
    const item = await database.outbox.get(id);
    if (!item) return;

    await database.outbox.update(id, {
      status: 'FAILED',
      retryCount: item.retryCount + 1,
      lastError: error,
      updatedAt: now,
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
    total: number;
  }> {
    const database = this.getDatabase();
    const all = await database.outbox.toArray();
    let pending = 0;
    let syncing = 0;
    let synced = 0;
    let failed = 0;

    for (const item of all) {
      if (item.status === 'PENDING') pending++;
      else if (item.status === 'SYNCING') syncing++;
      else if (item.status === 'SYNCED') synced++;
      else if (item.status === 'FAILED') failed++;
    }

    return {
      pending,
      syncing,
      synced,
      failed,
      total: all.length,
    };
  }

  /**
   * Deletes synced outbox items to free storage.
   */
  async purgeSyncedItems(): Promise<number> {
    const database = this.getDatabase();
    const syncedIds = await database.outbox
      .where('status')
      .equals('SYNCED')
      .primaryKeys();

    await database.outbox.bulkDelete(syncedIds);
    return syncedIds.length;
  }
}
