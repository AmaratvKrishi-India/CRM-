/**
 * MessageHistory Repository
 * Logs outbound messaging interactions (WhatsApp / SMS).
 */

import type { SalesCRMDatabase } from '../database';
import { SyncQueue } from '../../services/sync/syncQueue';
import type { MessageHistory, MessageChannel, MessageStatus } from '../types';

import { createUuid } from '../../utils/id';

export class MessageHistoryRepository {
  constructor(private db: SalesCRMDatabase, private syncQueue?: SyncQueue) {}

  private getSyncQueue(): SyncQueue {
    return (this.syncQueue ??= new SyncQueue(this.db));
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
      id: createUuid(),
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
