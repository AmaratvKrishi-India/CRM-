/**
 * Sync State Repository (Phase 2F)
 * Persists and retrieves local synchronization cursor, timestamps, and engine status.
 */

import { db as defaultDb, SalesCRMDatabase } from '../../db/database';
import { DeviceService } from '../deviceService';
import { SyncState, SyncEngineStatus } from './syncTypes';

export class SyncStateRepository {
  private database?: SalesCRMDatabase;

  constructor(database?: SalesCRMDatabase) {
    this.database = database;
  }

  private getDatabase(): SalesCRMDatabase {
    return this.database || defaultDb;
  }

  /**
   * Retrieves the current sync state from Dexie or initializes default.
   */
  async getSyncState(): Promise<SyncState> {
    const db = this.getDatabase();
    let state = await db.syncState.get('current');
    if (!state) {
      const deviceId = DeviceService.getDeviceId();
      state = {
        id: 'current',
        deviceId,
        organizationId: null,
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
  async updateSyncState(updates: Partial<Omit<SyncState, 'id'>>): Promise<SyncState> {
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
