/**
 * Remark Repository
 * Manages sales notes and observations attached to leads.
 */

import type { SalesCRMDatabase } from '../database';
import { SyncQueue } from '../../services/sync/syncQueue';
import type { Remark, RemarkType } from '../types';

import { createUuid } from '../../utils/id';

export class RemarkRepository {
  constructor(private db: SalesCRMDatabase, private syncQueue?: SyncQueue) {}

  private getSyncQueue(): SyncQueue {
    return (this.syncQueue ??= new SyncQueue(this.db));
  }

  /**
   * Adds a new remark/note to a lead and updates the lead's updatedAt timestamp.
   */
  async addRemark(params: {
    leadId: string;
    content: string;
    type?: RemarkType;
    author?: string;
  }): Promise<Remark> {
    const scope = this.db.requireAccessScope();
    const { leadId, content, type = 'CUSTOM', author = 'Sales Rep' } = params;

    await this.db.requireAccessibleLead(leadId, scope);

    const now = new Date().toISOString();
    const remark: Remark = {
      id: createUuid(),
      leadId,
      userId: scope.userId,
      type,
      content: content.trim(),
      author: author.trim(),
      createdAt: now,
      updatedAt: now,
      isSynced: 0,
      deletedAt: null,
    };

    // Data writes + outbox enqueues are atomic: either all persist or none.
    await this.db.transaction('rw', [this.db.remarks, this.db.leads, this.db.outbox], async () => {
      await this.db.remarks.add(remark);
      await this.db.leads.update(leadId, {
        updatedAt: now,
        isSynced: 0,
      });
      const queue = this.getSyncQueue();
      await queue.enqueue({
        entityType: 'remarks',
        entityId: remark.id,
        operation: 'CREATE',
        payload: remark,
        userId: scope.userId,
        organizationId: scope.organizationId,
      });

      const updatedLead = await this.db.leads.get(leadId);
      if (updatedLead) {
        await queue.enqueue({
          entityType: 'leads',
          entityId: leadId,
          operation: 'UPDATE',
          payload: updatedLead,
          userId: scope.userId,
          organizationId: scope.organizationId,
        });
      }
    });

    return remark;
  }

  /**
   * Retrieves all active remarks for a lead, sorted newest first.
   */
  async getRemarksByLead(leadId: string): Promise<Remark[]> {
    await this.db.requireAccessibleLead(leadId);
    return await this.db.remarks
      .where('leadId')
      .equals(leadId)
      .and((r) => r.deletedAt === null)
      .reverse()
      .sortBy('createdAt');
  }

  /**
   * Soft-deletes a remark.
   */
  async softDeleteRemark(id: string): Promise<void> {
    const scope = this.db.requireAccessScope();
    const existing = await this.db.remarks.get(id);
    if (!existing) return;
    await this.db.requireAccessibleLead(existing.leadId, scope);
    const now = new Date().toISOString();
    // Data write + outbox enqueue are atomic: either both persist or neither.
    await this.db.transaction('rw', [this.db.remarks, this.db.outbox], async () => {
      await this.db.remarks.update(id, {
        deletedAt: now,
        updatedAt: now,
        isSynced: 0,
      });
      const updated = await this.db.remarks.get(id);
      if (updated) {
        await this.getSyncQueue().enqueue({
          entityType: 'remarks',
          entityId: updated.id,
          operation: 'UPDATE',
          payload: updated,
          userId: scope.userId,
          organizationId: scope.organizationId,
        });
      }
    });
  }

  /**
   * Hard-deletes a remark.
   */
  async hardDeleteRemark(id: string): Promise<void> {
    const existing = await this.db.remarks.get(id);
    if (!existing) return;
    await this.db.requireAccessibleLead(existing.leadId);
    await this.db.remarks.delete(id);
  }
}
