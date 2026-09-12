import Dexie from 'dexie';
import type { SalesCRMDatabase } from '../../db/database';
import { SyncQueue } from './syncQueue';
import type { OutboxItem } from './syncTypes';

export function recoveryGuidance(error: string | null): string {
  if (/CONFLICT|REVISION/i.test(error || '')) return 'Sync to load the current server version. Compare the saved change below, then open the record and reapply the intended fields. Retrying the original change cannot resolve a revision conflict.';
  if (/AUTH|PERMISSION|403|401/i.test(error || '')) return 'Sign in again and ask your administrator to verify your access before retrying.';
  if (/VALIDATION|PERMANENT|400|422/i.test(error || '')) return 'Inspect the saved change and correct the record through its normal edit form. Keep this export until the corrected change has synced.';
  return 'Check your connection and service availability, then retry the saved change. It keeps its original identity to prevent duplicate delivery.';
}

/** Recovery never edits or silently deletes a durable mutation. */
export class SyncRecoveryService {
  constructor(private database: SalesCRMDatabase) {}

  async list(offset = 0, limit = 20): Promise<{ items: OutboxItem[]; hasMore: boolean }> {
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new Error('Invalid recovery page.');
    }
    const scope = this.database.requireAccessScope();
    const rows = await this.database.outbox.where('[organizationId+userId+sequence]')
      .between([scope.organizationId, scope.userId, Dexie.minKey], [scope.organizationId, scope.userId, Dexie.maxKey])
      .filter(item => item.status === 'DEAD_LETTER')
      .offset(offset).limit(limit + 1).toArray();
    return { items: rows.slice(0, limit), hasMore: rows.length > limit };
  }

  async exportItem(id: string): Promise<string> {
    const scope = this.database.requireAccessScope();
    const item = await this.database.outbox.get(id);
    if (!item || item.organizationId !== scope.organizationId || item.userId !== scope.userId || item.status !== 'DEAD_LETTER') {
      throw new Error('Saved change is not available in this account.');
    }
    return JSON.stringify({ format: 'crm-sync-recovery-v1', exportedAt: new Date().toISOString(), item }, null, 2);
  }

  async retry(id: string): Promise<void> {
    await new SyncQueue(this.database).retryDeadLetter(id);
  }
}
