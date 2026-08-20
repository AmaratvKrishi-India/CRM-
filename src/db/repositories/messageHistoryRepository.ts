/**
 * MessageHistory Repository
 * Logs outbound messaging interactions (WhatsApp / SMS).
 */

import { SalesCRMDatabase } from '../database';
import { MessageHistory, MessageChannel, MessageStatus } from '../types';

export class MessageHistoryRepository {
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
    const {
      leadId,
      channel,
      recipientPhone,
      messageContent,
      templateId = null,
      sentStatus = 'INITIATED',
    } = params;

    const lead = await this.db.leads.get(leadId);
    if (!lead) {
      throw new Error(`Cannot log message: Lead ${leadId} does not exist.`);
    }

    const now = new Date().toISOString();
    const msgRecord: MessageHistory = {
      id: this.generateId(),
      leadId,
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

    await this.db.transaction('rw', [this.db.messageHistory, this.db.leads], async () => {
      await this.db.messageHistory.add(msgRecord);
      await this.db.leads.update(leadId, {
        lastContactedAt: now,
        updatedAt: now,
        isSynced: 0,
      });
    });

    return msgRecord;
  }

  /**
   * Retrieves messages for a specific lead, newest first.
   */
  async getMessageHistoryByLead(leadId: string): Promise<MessageHistory[]> {
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
    const now = new Date().toISOString();
    await this.db.messageHistory.update(id, {
      sentStatus,
      updatedAt: now,
      isSynced: 0,
    });
  }

  /**
   * Soft-deletes a message history record.
   */
  async softDeleteMessage(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.messageHistory.update(id, {
      deletedAt: now,
      updatedAt: now,
      isSynced: 0,
    });
  }
}
