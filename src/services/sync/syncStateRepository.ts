/**
 * Sync State Repository (Phase 2F)
 * Persists and retrieves local synchronization cursor, timestamps, and engine status.
 */

import type { SalesCRMDatabase } from '../../db/database';
import { db as defaultDb } from '../../db/database';
import { DeviceService } from '../deviceService';
import type { SyncState, SyncEngineStatus } from './syncTypes';
import type { AccessScope } from '../../db/accessScope';

export class SyncStateRepository {
  private database?: SalesCRMDatabase;

  constructor(database?: SalesCRMDatabase) {
    this.database = database;
  }

  private getDatabase(): SalesCRMDatabase {
    return this.database || defaultDb;
  }

  getAccessScope(): AccessScope {
    return this.getDatabase().requireAccessScope();
  }

  /**
   * Retrieves the current sync state from Dexie or initializes default.
   */
  async getSyncState(): Promise<SyncState> {
    const db = this.getDatabase();
    const scope = db.requireAccessScope();
    const stateId = `${scope.organizationId}:${scope.userId}`;
    let state = await db.syncState.get(stateId);
    if (
      state &&
      (state.organizationId !== scope.organizationId || state.userId !== scope.userId)
    ) {
      throw new Error('Stored synchronization state does not match the active account context.');
    }
    if (!state) {
      const deviceId = DeviceService.getDeviceId();
      state = {
        id: stateId,
        deviceId,
        organizationId: scope.organizationId,
        userId: scope.userId,
        lastSuccessfulSyncAt: null,
        lastPullCursor: null,
        lastPushAt: null,
        lastPullAt: null,
        lastSyncError: null,
        status: typeof navigator !== 'undefined' && !navigator.onLine ? 'OFFLINE' : 'PENDING',
      };
      await db.syncState.put(state);
    }
    return state;
  }

  /**
   * Updates partial sync state fields.
   */
  async updateSyncState(
    updates: Partial<Omit<SyncState, 'id' | 'organizationId' | 'userId' | 'deviceId'>>
  ): Promise<SyncState> {
    const db = this.getDatabase();
    const current = await this.getSyncState();
    const updated: SyncState = {
      ...current,
      ...updates,
    };
    await db.syncState.put(updated);
    return updated;
  }

  /**
   * Updates the sync engine status.
   */
  async setStatus(status: SyncEngineStatus, error?: string | null): Promise<void> {
    const updates: Partial<SyncState> = { status };
    if (error !== undefined) {
      updates.lastSyncError = error;
    }
    await this.updateSyncState(updates);
  }
}
