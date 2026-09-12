/**
 * Sync Outbox Queue Manager (Phase 2F)
 * Enqueues local mutations for asynchronous push synchronization.
 * Guarantees zero mutation loss during offline periods and handles retries.
 */

import type { SalesCRMDatabase } from '../../db/database';
import { db as defaultDb } from '../../db/database';
import Dexie from 'dexie';
import { DeviceService } from '../deviceService';
import { serverRevision, type OutboxItem, type SyncEntityType, type SyncOperation } from './syncTypes';

export interface SyncQueueCapacity {
  unsyncedItems: number;
  unsyncedBytes: number;
  warningBytes: number;
  maximumBytes: number;
  warning: boolean;
}

export class SyncQueueCapacityError extends Error {
  readonly capacity: SyncQueueCapacity;

  constructor(capacity: SyncQueueCapacity) {
    super('Offline changes have reached the local sync storage limit. Reconnect and sync before making more changes.');
    this.name = 'SyncQueueCapacityError';
    this.capacity = capacity;
  }
}

export class SyncQueue {
  /** Items that fail this many times are parked as DEAD_LETTER instead of retrying forever. */
  static readonly MAX_RETRY_COUNT = 10;
  static readonly RETRY_BASE_MS = 1000;
  static readonly RETRY_MAX_MS = 32_000;

  static readonly DEFAULT_WARNING_BYTES = 8 * 1024 * 1024;
  static readonly DEFAULT_MAXIMUM_BYTES = 10 * 1024 * 1024;
  private static readonly SCAN_PAGE_SIZE = 100;

  private database?: SalesCRMDatabase;

  private readonly warningBytes: number;

  private readonly maximumBytes: number;

  constructor(database?: SalesCRMDatabase, limits: { warningBytes?: number; maximumBytes?: number } = {}) {
    this.database = database;
    this.maximumBytes = limits.maximumBytes ?? SyncQueue.DEFAULT_MAXIMUM_BYTES;
    this.warningBytes = limits.warningBytes ?? Math.min(SyncQueue.DEFAULT_WARNING_BYTES, this.maximumBytes);
    if (this.warningBytes < 0 || this.maximumBytes <= 0 || this.warningBytes > this.maximumBytes) {
      throw new Error('Sync queue byte limits are invalid.');
    }
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

  private byteSize(value: unknown): number {
    const json = JSON.stringify(value);
    return typeof TextEncoder === 'undefined'
      ? encodeURIComponent(json).replace(/%[0-9A-F]{2}|./g, 'x').length
      : new TextEncoder().encode(json).byteLength;
  }

  private isUnsynced(item: OutboxItem): boolean {
    return item.status !== 'SYNCED';
  }

  private async measureUnsyncedCapacity(database = this.getDatabase()): Promise<SyncQueueCapacity> {
    const scope = database.requireAccessScope();
    let unsyncedItems = 0;
    let unsyncedBytes = 0;
    const scopedItems = await database.outbox
      .where('[organizationId+userId+sequence]')
      .between([scope.organizationId, scope.userId, Dexie.minKey], [scope.organizationId, scope.userId, Dexie.maxKey])
      .toArray();
    for (const item of scopedItems) {
      if (!this.isUnsynced(item)) continue;
      unsyncedItems += 1;
      unsyncedBytes += this.byteSize(item);
    }
    return {
      unsyncedItems,
      unsyncedBytes,
      warningBytes: this.warningBytes,
      maximumBytes: this.maximumBytes,
      warning: unsyncedBytes >= this.warningBytes,
    };
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

    await database.transaction('rw', database.outbox, async () => {
      const scopeKey = [scope.organizationId, scope.userId];
      const newest = await database.outbox
        .where('[organizationId+userId+sequence]')
        .between([...scopeKey, Dexie.minKey], [...scopeKey, Dexie.maxKey])
        .reverse()
        .first();
      item.sequence = (newest?.sequence || 0) + 1;
      item.expectedRevision = serverRevision(input.payload) ?? (input.operation === 'CREATE' ? 0 : undefined);
      // The predecessor is causal local enqueue order, independent of wall clocks.
      const previous = await database.outbox
        .where('[organizationId+userId+entityType+entityId+sequence]')
        .between(
          [scope.organizationId, scope.userId, item.entityType, item.entityId, Dexie.minKey],
          [scope.organizationId, scope.userId, item.entityType, item.entityId, Dexie.maxKey]
        )
        .reverse()
        .filter((row) => row.status !== 'SYNCED' && row.status !== 'DEAD_LETTER')
        .first();
      if (previous) item.predecessorId = previous.id;

      const capacity = await this.measureUnsyncedCapacity(database);
      const nextBytes = capacity.unsyncedBytes + this.byteSize(item);
      if (nextBytes > this.maximumBytes) {
        throw new SyncQueueCapacityError({
          ...capacity,
          unsyncedItems: capacity.unsyncedItems + 1,
          unsyncedBytes: nextBytes,
          warning: true,
        });
      }
      await database.outbox.add(item);
    });
    return item;
  }

  /**
   * Retrieves pending or retryable outbox items.
   * Items that exceeded MAX_RETRY_COUNT are parked as DEAD_LETTER and excluded.
   */
  async getPendingItems(limit = 50): Promise<OutboxItem[]> {
    if (!Number.isSafeInteger(limit) || limit < 1) return [];
    const database = this.getDatabase();
    const scope = database.requireAccessScope();
    const retryable: OutboxItem[] = [];
    const nowMs = Date.now();
    const lower = [scope.organizationId, scope.userId, Dexie.minKey];
    const upper = [scope.organizationId, scope.userId, Dexie.maxKey];
    let offset = 0;

    while (retryable.length < limit) {
      const page = await database.outbox
        .where('[organizationId+userId+sequence]')
        .between(lower, upper)
        .offset(offset)
        .limit(SyncQueue.SCAN_PAGE_SIZE)
        .toArray();
      if (page.length === 0) break;
      offset += page.length;

      for (const item of page) {
        if (item.status !== 'PENDING' && item.status !== 'FAILED') continue;
        if (item.predecessorId) {
          const predecessor = await database.outbox.get(item.predecessorId);
          if (predecessor && predecessor.status !== 'SYNCED') continue;
        }
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

      if (page.length < SyncQueue.SCAN_PAGE_SIZE) break;
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
  async markFailed(
    id: string,
    error: string,
    options: { retryable?: boolean; classification?: string; retryAfterMs?: number } = {}
  ): Promise<void> {
    const database = this.getDatabase();
    const scope = database.requireAccessScope();
    const now = new Date().toISOString();
    const item = await database.outbox.get(id);
    if (!item || item.organizationId !== scope.organizationId || item.userId !== scope.userId) return;

    const retryCount = item.retryCount + 1;
    const retryable = options.retryable ?? true;
    const deadLetter = !retryable || retryCount >= SyncQueue.MAX_RETRY_COUNT;
    const exponentialDelay = SyncQueue.RETRY_BASE_MS * Math.pow(2, Math.max(0, retryCount - 1));
    const retryDelay = Math.min(
      Math.max(0, options.retryAfterMs ?? exponentialDelay),
      SyncQueue.RETRY_MAX_MS
    );
    const safeError = options.classification ? `[${options.classification}] ${error}` : error;
    await database.outbox.update(id, {
      status: deadLetter ? 'DEAD_LETTER' : 'FAILED',
      retryCount,
      nextAttemptAt: deadLetter ? null : new Date(Date.now() + retryDelay).toISOString(),
      lastError: safeError,
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
    unsyncedBytes: number;
    warningBytes: number;
    maximumBytes: number;
    capacityWarning: boolean;
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

    const capacity = await this.measureUnsyncedCapacity(database);
    return {
      pending,
      syncing,
      synced,
      failed,
      deadLetter,
      total: all.length,
      unsyncedBytes: capacity.unsyncedBytes,
      warningBytes: capacity.warningBytes,
      maximumBytes: capacity.maximumBytes,
      capacityWarning: capacity.warning,
    };
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
