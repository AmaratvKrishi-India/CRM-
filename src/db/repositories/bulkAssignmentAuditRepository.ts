/**
 * Bulk Assignment Audit Repository (Phase 2K)
 * Manages local persistence and queries for batch lead assignment audits.
 */

import type { SalesCRMDatabase } from '../database';
import { SyncQueue } from '../../services/sync/syncQueue';
import type { BulkAssignmentAudit } from '../types';

export class BulkAssignmentAuditRepository {
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
   * Records a new bulk assignment audit log.
   */
  async logAudit(input: {
    id?: string;
    organizationId?: string | null;
    performedBy: string;
    targetAgentId: string;
    selectedLeadCount: number;
    successfulCount: number;
    failedCount: number;
    startedAt: string;
    completedAt: string;
    filterSnapshot?: Record<string, any>;
    status: 'PENDING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
    errorSummary?: string | null;
  }): Promise<BulkAssignmentAudit> {
    const scope = this.db.requireAccessScope();
    if (scope.role !== 'ADMIN') throw new Error('Only administrators can create assignment audits.');
    if (input.performedBy !== scope.userId) {
      throw new Error('Assignment audits must be attributed to the signed-in administrator.');
    }
    const now = new Date().toISOString();
    const id = input.id || this.generateId();

    const auditRecord: BulkAssignmentAudit = {
      id,
      organizationId: scope.organizationId,
      performedBy: input.performedBy,
      targetAgentId: input.targetAgentId,
      selectedLeadCount: input.selectedLeadCount,
      successfulCount: input.successfulCount,
      failedCount: input.failedCount,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      filterSnapshot: input.filterSnapshot || {},
      status: input.status,
      errorSummary: input.errorSummary || null,
      createdAt: now,
      updatedAt: now,
      isSynced: 0,
      deletedAt: null,
      version: 1,
    };

    // Data write + outbox enqueue are atomic: either both persist or neither.
    await this.db.transaction('rw', [this.db.bulkAssignmentAudits, this.db.outbox], async () => {
      await this.db.bulkAssignmentAudits.add(auditRecord);
      await this.getSyncQueue().enqueue({
        entityType: 'bulk_assignment_audits',
        entityId: auditRecord.id,
        operation: 'CREATE',
        payload: auditRecord,
        userId: scope.userId,
        organizationId: scope.organizationId,
      });
    });

    return auditRecord;
  }

  /**
   * Retrieves all bulk assignment audits sorted by creation date descending.
   */
  async getAllAudits(limit = 100): Promise<BulkAssignmentAudit[]> {
    const scope = this.db.requireAccessScope();
    if (scope.role !== 'ADMIN') return [];
    return await this.db.bulkAssignmentAudits
      .orderBy('startedAt')
      .reverse()
      .limit(limit)
      .toArray();
  }

  /**
   * Retrieves a single bulk assignment audit by ID.
   */
  async getAuditById(id: string): Promise<BulkAssignmentAudit | undefined> {
    const scope = this.db.requireAccessScope();
    if (scope.role !== 'ADMIN') return undefined;
    const audit = await this.db.bulkAssignmentAudits.get(id);
    return audit?.organizationId === scope.organizationId ? audit : undefined;
  }
}
