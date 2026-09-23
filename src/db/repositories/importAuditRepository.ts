/**
 * Import Audit Repository (Phase 2B)
 * Tracks lead batch import runs, attributing them to the active user and recording row counts.
 */

import type { SalesCRMDatabase } from '../database';
import { SyncQueue } from '../../services/sync/syncQueue';
import type { ImportAudit } from '../types';

import { createUuid } from '../../utils/id';

export class ImportAuditRepository {
  constructor(private db: SalesCRMDatabase, private syncQueue?: SyncQueue) {}

  private getSyncQueue(): SyncQueue {
    return (this.syncQueue ??= new SyncQueue(this.db));
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
    const scope = this.db.requireAccessScope();
    if (input.uploadedBy !== scope.userId) {
      throw new Error('Import audits must be attributed to the signed-in user.');
    }
    const now = new Date().toISOString();
    const audit: ImportAudit = {
      id: input.id || createUuid(),
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

    // Data write + outbox enqueue are atomic: either both persist or neither.
    await this.db.transaction('rw', [this.db.importAudits, this.db.outbox], async () => {
      await this.db.importAudits.add(audit);
      await this.getSyncQueue().enqueue({
        entityType: 'import_audits',
        entityId: audit.id,
        operation: 'CREATE',
        payload: audit,
        userId: scope.userId,
        organizationId: scope.organizationId,
      });
    });

    return audit;
  }

  /**
   * Retrieves import audit history, sorted newest to oldest.
   */
  async getAuditHistory(limit = 50): Promise<ImportAudit[]> {
    const scope = this.db.requireAccessScope();
    const audits = await this.db.importAudits
      .filter((audit) => scope.role === 'ADMIN' || audit.uploadedBy === scope.userId)
      .reverse()
      .sortBy('createdAt');
    return audits.slice(0, limit);
  }

  /**
   * Retrieves an audit log entry by ID.
   */
  async getAuditById(id: string): Promise<ImportAudit | undefined> {
    const scope = this.db.requireAccessScope();
    const audit = await this.db.importAudits.get(id);
    return audit && (scope.role === 'ADMIN' || audit.uploadedBy === scope.userId) ? audit : undefined;
  }
}
