/**
 * Bulk Assignment Audit Repository (Phase 2K)
 * Manages local persistence and queries for batch lead assignment audits.
 */

import type { SalesCRMDatabase } from '../database';
import { SyncQueue } from '../../services/sync/syncQueue';
import type { BulkAssignmentAudit } from '../types';

import { createUuid } from '../../utils/id';

export class BulkAssignmentAuditRepository {
  constructor(private db: SalesCRMDatabase, private syncQueue?: SyncQueue) {}

  private getSyncQueue(): SyncQueue {
    return (this.syncQueue ??= new SyncQueue(this.db));
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
    filterSnapshot?: Record<string, unknown>;
    status: 'PENDING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
    errorSummary?: string | null;
  }): Promise<BulkAssignmentAudit> {
    const scope = this.db.requireAccessScope();
    if (scope.role !== 'ADMIN') throw new Error('Only administrators can create assignment audits.');
    if (input.performedBy !== scope.userId) {
      throw new Error('Assignment audits must be attributed to the signed-in administrator.');
    }
    const now = new Date().toISOString();
    const id = input.id || createUuid();

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
