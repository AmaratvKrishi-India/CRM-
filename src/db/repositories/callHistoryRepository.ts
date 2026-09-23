/**
 * CallHistory Repository
 * Handles logging of call attempts, outcomes, durations, and updates to Lead metrics.
 */

import type { SalesCRMDatabase } from '../database';
import type { CallHistory, CallOutcome, LeadStatus, PhoneType } from '../types';

import { createUuid } from '../../utils/id';

export class CallHistoryRepository {
  constructor(private db: SalesCRMDatabase) {}

  /**
   * Logs a call outcome and atomically updates the associated Lead's callCount, lastContactedAt, and status.
   */
  async logCall(params: {
    leadId: string;
    calledNumber: string;
    phoneType?: PhoneType;
    outcome: CallOutcome;
    durationSeconds?: number;
    notes?: string | null;
    startedAt?: string;
    updateLeadStatus?: LeadStatus;
  }): Promise<CallHistory> {
    const scope = this.db.requireAccessScope();
    const {
      leadId,
      calledNumber,
      phoneType = 'mobile',
      outcome,
      durationSeconds = 0,
      notes = null,
      startedAt,
      updateLeadStatus,
    } = params;

    const lead = await this.db.requireAccessibleLead(leadId, scope);

    const now = new Date().toISOString();
    const callStart = startedAt || now;

    const callRecord: CallHistory = {
      id: createUuid(),
      leadId,
      calledNumber,
      phoneType,
      startedAt: callStart,
      endedAt: now,
      durationSeconds,
      outcome,
      notes: notes ? notes.trim() : null,
      createdAt: now,
      updatedAt: now,
      isSynced: 0,
      deletedAt: null,
    };

    await this.db.transaction('rw', [this.db.callHistory, this.db.leads], async () => {
      await this.db.callHistory.add(callRecord);

      // Determine updated status if not explicitly passed
      let nextStatus = lead.status;
      if (updateLeadStatus) {
        nextStatus = updateLeadStatus;
      } else if (lead.status === 'NEW') {
        if (outcome === 'CONNECTED') nextStatus = 'CONTACTED';
        else if (outcome === 'WRONG_NUMBER') nextStatus = 'WRONG_NUMBER';
        else if (outcome === 'INVALID_NUMBER') nextStatus = 'WRONG_NUMBER';
      }

      await this.db.leads.update(leadId, {
        callCount: (lead.callCount || 0) + 1,
        lastContactedAt: now,
        status: nextStatus,
        updatedAt: now,
        isSynced: 0,
      });
    });

    return callRecord;
  }

  /**
   * Retrieves call logs for a specific lead, ordered latest first.
   */
  async getCallHistoryByLead(leadId: string): Promise<CallHistory[]> {
    await this.db.requireAccessibleLead(leadId);
    return await this.db.callHistory
      .where('leadId')
      .equals(leadId)
      .and((c) => c.deletedAt === null)
      .reverse()
      .sortBy('startedAt');
  }

  /**
   * Retrieves recent call logs across all leads.
   */
  async getRecentCalls(limit = 20): Promise<CallHistory[]> {
    const scope = this.db.requireAccessScope();
    const leadIds = new Set(
      (await this.db.leads.toArray())
        .filter((lead) => scope.role === 'ADMIN' || lead.assignedTo === scope.userId || lead.createdBy === scope.userId)
        .map((lead) => lead.id)
    );
    return await this.db.callHistory
      .filter((c) => leadIds.has(c.leadId) && c.deletedAt === null)
      .reverse()
      .sortBy('startedAt')
      .then((records) => records.slice(0, limit));
  }

  /**
   * Soft-deletes a call log entry.
   */
  async softDeleteCall(id: string): Promise<void> {
    const existing = await this.db.callHistory.get(id);
    if (!existing) return;
    await this.db.requireAccessibleLead(existing.leadId);
    const now = new Date().toISOString();
    await this.db.callHistory.update(id, {
      deletedAt: now,
      updatedAt: now,
      isSynced: 0,
    });
  }
}
