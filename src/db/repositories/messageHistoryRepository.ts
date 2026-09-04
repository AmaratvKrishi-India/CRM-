/**
 * MessageHistory Repository
 * Logs outbound messaging interactions (WhatsApp / SMS).
 */

import type { SalesCRMDatabase } from '../database';
import { SyncQueue } from '../../services/sync/syncQueue';
import type { MessageHistory, MessageChannel, MessageStatus } from '../types';

export class MessageHistoryRepository {
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
   * Records an outbound message attempt and updates the lead's lastContactedAt timestamp.
   */
  async logMessage(params: {
    leadId: string;
    channel: MessageChannel;
    recipientPhone: string;
    messageContent: string;
    templateId?: string | null;
    sentStatus?: MessageStatus;
  }): Promise<MessageHistory> {
    const scope = this.db.requireAccessScope();
    const {
      leadId,
      channel,
      recipientPhone,
      messageContent,
      templateId = null,
      sentStatus = 'INITIATED',
    } = params;

    await this.db.requireAccessibleLead(leadId, scope);

    const now = new Date().toISOString();
    const msgRecord: MessageHistory = {
      id: this.generateId(),
      leadId,
      userId: scope.userId,
      channel,
      templateId,
      recipientPhone,
      messageContent,
      sentStatus,
      sentAt: now,
      createdAt: now,
      updatedAt: now,
      isSynced: 0,
      deletedAt: null,
    };

    // Data writes + outbox enqueues are atomic: either all persist or none.
    await this.db.transaction('rw', [this.db.messageHistory, this.db.leads, this.db.outbox], async () => {
      await this.db.messageHistory.add(msgRecord);
      await this.db.leads.update(leadId, {
        lastContactedAt: now,
        updatedAt: now,
        isSynced: 0,
      });
      const queue = this.getSyncQueue();
      await queue.enqueue({
        entityType: 'message_history',
        entityId: msgRecord.id,
        operation: 'CREATE',
        payload: msgRecord,
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

    return msgRecord;
  }

  /**
   * Retrieves messages for a specific lead, newest first.
   */
  async getMessageHistoryByLead(leadId: string): Promise<MessageHistory[]> {
    await this.db.requireAccessibleLead(leadId);
    return await this.db.messageHistory
      .where('leadId')
      .equals(leadId)
      .and((m) => m.deletedAt === null)
      .reverse()
      .sortBy('sentAt');
  }

  /**
   * Updates the delivery/sending status of an existing message log (e.g. INITIATED -> FAILED).
   */
  async updateMessageStatus(id: string, sentStatus: MessageStatus): Promise<void> {
    const scope = this.db.requireAccessScope();
    const existing = await this.db.messageHistory.get(id);
    if (!existing) return;
    await this.db.requireAccessibleLead(existing.leadId, scope);
    const now = new Date().toISOString();
    // Data write + outbox enqueue are atomic: either both persist or neither.
    await this.db.transaction('rw', [this.db.messageHistory, this.db.outbox], async () => {
      await this.db.messageHistory.update(id, {
        sentStatus,
        updatedAt: now,
        isSynced: 0,
      });
      const updated = await this.db.messageHistory.get(id);
      if (updated) {
        await this.getSyncQueue().enqueue({
          entityType: 'message_history',
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
   * Soft-deletes a message history record.
   */
  async softDeleteMessage(id: string): Promise<void> {
    const scope = this.db.requireAccessScope();
    const existing = await this.db.messageHistory.get(id);
    if (!existing) return;
    await this.db.requireAccessibleLead(existing.leadId, scope);
    const now = new Date().toISOString();
    // Data write + outbox enqueue are atomic: either both persist or neither.
    await this.db.transaction('rw', [this.db.messageHistory, this.db.outbox], async () => {
      await this.db.messageHistory.update(id, {
        deletedAt: now,
        updatedAt: now,
        isSynced: 0,
      });
      const updated = await this.db.messageHistory.get(id);
      if (updated) {
        await this.getSyncQueue().enqueue({
          entityType: 'message_history',
          entityId: updated.id,
          operation: 'UPDATE',
          payload: updated,
          userId: scope.userId,
          organizationId: scope.organizationId,
        });
      }
    });
  }
}
