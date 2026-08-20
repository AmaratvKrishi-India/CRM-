/**
 * Remark Repository
 * Manages sales notes and observations attached to leads.
 */

import { SalesCRMDatabase } from '../database';
import { Remark, RemarkType } from '../types';

export class RemarkRepository {
  constructor(private db: SalesCRMDatabase) {}

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
   * Adds a new remark/note to a lead and updates the lead's updatedAt timestamp.
   */
  async addRemark(params: {
    leadId: string;
    content: string;
    type?: RemarkType;
    author?: string;
  }): Promise<Remark> {
    const { leadId, content, type = 'CUSTOM', author = 'Sales Rep' } = params;

    const lead = await this.db.leads.get(leadId);
    if (!lead) {
      throw new Error(`Cannot add remark: Lead ${leadId} does not exist.`);
    }

    const now = new Date().toISOString();
    const remark: Remark = {
      id: this.generateId(),
      leadId,
      type,
      content: content.trim(),
      author: author.trim(),
      createdAt: now,
      updatedAt: now,
      isSynced: 0,
      deletedAt: null,
    };

    await this.db.transaction('rw', [this.db.remarks, this.db.leads], async () => {
      await this.db.remarks.add(remark);
      await this.db.leads.update(leadId, {
        updatedAt: now,
        isSynced: 0,
      });
    });

    return remark;
  }

  /**
   * Retrieves all active remarks for a lead, sorted newest first.
   */
  async getRemarksByLead(leadId: string): Promise<Remark[]> {
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
    const now = new Date().toISOString();
    await this.db.remarks.update(id, {
      deletedAt: now,
      updatedAt: now,
      isSynced: 0,
    });
  }

  /**
   * Hard-deletes a remark.
   */
  async hardDeleteRemark(id: string): Promise<void> {
    await this.db.remarks.delete(id);
  }
}
