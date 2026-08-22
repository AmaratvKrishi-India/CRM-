/**
 * Import Audit Repository (Phase 2B)
 * Tracks lead batch import runs, attributing them to the active user and recording row counts.
 */

import { SalesCRMDatabase } from '../database';
import { SyncQueue } from '../../services/sync/syncQueue';
import { ImportAudit } from '../types';

export class ImportAuditRepository {
  private syncQueue?: SyncQueue;

  constructor(private db: SalesCRMDatabase, syncQueue?: SyncQueue) {
    this.syncQueue = syncQueue;
  }

  private getSyncQueue(): SyncQueue {
    if (!this.syncQueue) {
      this.syncQueue = new SyncQueue(this.db);
    }
    return this.syncQueue;
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
   * Logs an import audit record.
   */
  async createAudit(input: {
    id?: string;
    uploadedBy: string;
    filename: string;
    source: string;
    startedAt: string;
    completedAt: string;
    totalRows: number;
    imported: number;
    updated: number;
    duplicates: number;
    invalid: number;
    deviceId?: string | null;
  }): Promise<ImportAudit> {
    const now = new Date().toISOString();
    const audit: ImportAudit = {
      id: input.id || this.generateId(),
      uploadedBy: input.uploadedBy,
      deviceId: input.deviceId || null,
      filename: input.filename,
      source: input.source,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      totalRows: input.totalRows,
      imported: input.imported,
      updated: input.updated,
      duplicates: input.duplicates,
      invalid: input.invalid,
      createdAt: now,
      updatedAt: now,
      isSynced: 0,
    };

    await this.db.importAudits.add(audit);

    try {
      await this.getSyncQueue().enqueue({
        entityType: 'import_audits',
        entityId: audit.id,
        operation: 'CREATE',
        payload: audit,
        userId: audit.uploadedBy || 'local-user',
      });
    } catch (err) {
      console.warn('Outbox enqueue failed for createAudit:', err);
    }

    return audit;
  }

  /**
   * Retrieves import audit history, sorted newest to oldest.
   */
  async getAuditHistory(limit = 50): Promise<ImportAudit[]> {
    const audits = await this.db.importAudits.reverse().sortBy('createdAt');
    return audits.slice(0, limit);
  }

  /**
   * Retrieves an audit log entry by ID.
   */
  async getAuditById(id: string): Promise<ImportAudit | undefined> {
    return await this.db.importAudits.get(id);
  }
}
