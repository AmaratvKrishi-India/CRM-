/**
 * FollowUp Repository
 * Manages follow-up reminders, status changes, rescheduling, and syncs nextFollowUpAt with Leads.
 */

import { SalesCRMDatabase } from '../database';
import { SyncQueue } from '../../services/sync/syncQueue';
import { FollowUp, FollowUpPriority, FollowUpStatus, Lead, PhoneType, LeadStatus } from '../types';

export interface EnrichedFollowUp extends FollowUp {
  lead?: {
    id: string;
    businessName: string;
    locality: string;
    phone: string;
    phoneE164: string;
    phoneType: PhoneType;
    status: LeadStatus;
  };
}

export interface GroupedFollowUps {
  overdue: EnrichedFollowUp[];
  today: EnrichedFollowUp[];
  upcoming: EnrichedFollowUp[];
}

export class FollowUpRepository {
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
   * Recalculates and updates the lead's nextFollowUpAt timestamp based on its earliest pending follow-up.
   */
  private async recalculateLeadNextFollowUp(leadId: string): Promise<void> {
    const earliestPending = await this.db.followUps
      .where('leadId')
      .equals(leadId)
      .and((f) => f.deletedAt === null && f.status === 'PENDING')
      .sortBy('scheduledAt');

    const nextDate = earliestPending.length > 0 ? earliestPending[0].scheduledAt : null;
    const now = new Date().toISOString();

    await this.db.leads.update(leadId, {
      nextFollowUpAt: nextDate,
      updatedAt: now,
      isSynced: 0,
    });

    const updatedLead = await this.db.leads.get(leadId);
    if (updatedLead) {
      try {
        await this.getSyncQueue().enqueue({
          entityType: 'leads',
          entityId: leadId,
          operation: 'UPDATE',
          payload: updatedLead,
          userId: updatedLead.updatedBy || updatedLead.createdBy || 'local-user',
        });
      } catch (err) {
        console.warn('Outbox enqueue failed for recalculateLeadNextFollowUp:', err);
      }
    }
  }

  /**
   * Schedules a new follow-up for a lead.
   */
  async scheduleFollowUp(params: {
    leadId: string;
    userId?: string | null;
    scheduledAt: string;
    title: string;
    notes?: string | null;
    priority?: FollowUpPriority;
  }): Promise<FollowUp> {
    const { leadId, userId = null, scheduledAt, title, notes = null, priority = 'MEDIUM' } = params;

    const lead = await this.db.leads.get(leadId);
    if (!lead) {
      throw new Error(`Cannot schedule follow up: Lead ${leadId} does not exist.`);
    }

    const now = new Date().toISOString();
    const followUp: FollowUp = {
      id: this.generateId(),
      leadId,
      userId,
      scheduledAt,
      title: title.trim(),
      notes: notes ? notes.trim() : null,
      priority,
      status: 'PENDING',
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      isSynced: 0,
      deletedAt: null,
    };

    await this.db.transaction('rw', [this.db.followUps, this.db.leads, this.db.outbox], async () => {
      await this.db.followUps.add(followUp);
      await this.recalculateLeadNextFollowUp(leadId);
    });

    try {
      await this.getSyncQueue().enqueue({
        entityType: 'follow_ups',
        entityId: followUp.id,
        operation: 'CREATE',
        payload: followUp,
        userId: followUp.userId || 'local-user',
      });
    } catch (err) {
      console.warn('Outbox enqueue failed for scheduleFollowUp:', err);
    }

    return followUp;
  }

  /**
   * Alias for scheduleFollowUp.
   */
  async createFollowUp(params: {
    leadId: string;
    userId?: string | null;
    scheduledAt: string;
    title: string;
    notes?: string | null;
    priority?: FollowUpPriority;
  }): Promise<FollowUp> {
    return this.scheduleFollowUp(params);
  }

  /**
   * Reschedules an existing follow-up to a new timestamp while preserving audit trail.
   */
  async rescheduleFollowUp(params: {
    id: string;
    newScheduledAt: string;
    newTitle?: string;
    newNotes?: string | null;
    newPriority?: FollowUpPriority;
  }): Promise<FollowUp> {
    const { id, newScheduledAt, newTitle, newNotes, newPriority } = params;
    const existing = await this.db.followUps.get(id);
    if (!existing) throw new Error(`Follow up ${id} not found.`);

    const now = new Date().toISOString();
    const updates: Partial<FollowUp> = {
      scheduledAt: newScheduledAt,
      updatedAt: now,
      isSynced: 0,
    };

    if (newTitle !== undefined) updates.title = newTitle.trim();
    if (newNotes !== undefined) updates.notes = newNotes ? newNotes.trim() : null;
    if (newPriority !== undefined) updates.priority = newPriority;

    await this.db.transaction('rw', [this.db.followUps, this.db.leads, this.db.outbox], async () => {
      await this.db.followUps.update(id, updates);
      await this.recalculateLeadNextFollowUp(existing.leadId);
    });

    const updated = await this.db.followUps.get(id);
    if (updated) {
      try {
        await this.getSyncQueue().enqueue({
          entityType: 'follow_ups',
          entityId: updated.id,
          operation: 'UPDATE',
          payload: updated,
          userId: updated.userId || 'local-user',
        });
      } catch (err) {
        console.warn('Outbox enqueue failed for rescheduleFollowUp:', err);
      }
    }

    return updated!;
  }

  /**
   * Marks a follow-up as completed.
   */
  async completeFollowUp(id: string): Promise<FollowUp> {
    const item = await this.db.followUps.get(id);
    if (!item) throw new Error(`Follow up ${id} not found.`);

    const now = new Date().toISOString();

    await this.db.transaction('rw', [this.db.followUps, this.db.leads, this.db.outbox], async () => {
      await this.db.followUps.update(id, {
        status: 'COMPLETED',
        completedAt: now,
        updatedAt: now,
        isSynced: 0,
      });
      await this.recalculateLeadNextFollowUp(item.leadId);
    });

    const updated = await this.db.followUps.get(id);
    if (updated) {
      try {
        await this.getSyncQueue().enqueue({
          entityType: 'follow_ups',
          entityId: updated.id,
          operation: 'UPDATE',
          payload: updated,
          userId: updated.userId || 'local-user',
        });
      } catch (err) {
        console.warn('Outbox enqueue failed for completeFollowUp:', err);
      }
    }

    return updated!;
  }

  /**
   * Cancels a follow-up.
   */
  async cancelFollowUp(id: string): Promise<FollowUp> {
    const item = await this.db.followUps.get(id);
    if (!item) throw new Error(`Follow up ${id} not found.`);

    const now = new Date().toISOString();

    await this.db.transaction('rw', [this.db.followUps, this.db.leads, this.db.outbox], async () => {
      await this.db.followUps.update(id, {
        status: 'CANCELLED',
        updatedAt: now,
        isSynced: 0,
      });
      await this.recalculateLeadNextFollowUp(item.leadId);
    });

    const updated = await this.db.followUps.get(id);
    if (updated) {
      try {
        await this.getSyncQueue().enqueue({
          entityType: 'follow_ups',
          entityId: updated.id,
          operation: 'UPDATE',
          payload: updated,
          userId: updated.userId || 'local-user',
        });
      } catch (err) {
        console.warn('Outbox enqueue failed for cancelFollowUp:', err);
      }
    }

    return updated!;
  }

  /**
   * Retrieves all pending follow-ups categorized into OVERDUE, TODAY, and UPCOMING.
   */
  async getGroupedPendingFollowUps(): Promise<GroupedFollowUps> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

    const pendingFollowUps = await this.db.followUps
      .filter((f) => f.deletedAt === null && f.status === 'PENDING')
      .sortBy('scheduledAt');

    // Fetch associated leads for enriched cards
    const leadIds = Array.from(new Set(pendingFollowUps.map((f) => f.leadId)));
    const leads = await this.db.leads.where('id').anyOf(leadIds).toArray();
    const leadMap = new Map<string, Lead>();
    for (const lead of leads) {
      leadMap.set(lead.id, lead);
    }

    const overdue: EnrichedFollowUp[] = [];
    const today: EnrichedFollowUp[] = [];
    const upcoming: EnrichedFollowUp[] = [];

    for (const item of pendingFollowUps) {
      const lead = leadMap.get(item.leadId);
      const enriched: EnrichedFollowUp = {
        ...item,
        lead: lead
          ? {
              id: lead.id,
              businessName: lead.businessName,
              locality: lead.locality,
              phone: lead.phone,
              phoneE164: lead.phoneE164,
              phoneType: lead.phoneType,
              status: lead.status,
            }
          : undefined,
      };

      if (item.scheduledAt < todayStart) {
        overdue.push(enriched);
      } else if (item.scheduledAt <= todayEnd) {
        today.push(enriched);
      } else {
        upcoming.push(enriched);
      }
    }

    return { overdue, today, upcoming };
  }

  /**
   * Retrieves pending follow-ups scheduled for today with lead details.
   */
  async getTodayPendingFollowUps(): Promise<EnrichedFollowUp[]> {
    const grouped = await this.getGroupedPendingFollowUps();
    return grouped.today;
  }

  /**
   * Retrieves all follow-ups for a lead.
   */
  async getFollowUpsByLead(leadId: string): Promise<FollowUp[]> {
    return await this.db.followUps
      .where('leadId')
      .equals(leadId)
      .and((f) => f.deletedAt === null)
      .reverse()
      .sortBy('scheduledAt');
  }

  /**
   * Soft-deletes a follow-up.
   */
  async softDeleteFollowUp(id: string): Promise<void> {
    const item = await this.db.followUps.get(id);
    if (!item) return;

    const now = new Date().toISOString();
    await this.db.transaction('rw', [this.db.followUps, this.db.leads], async () => {
      await this.db.followUps.update(id, {
        deletedAt: now,
        updatedAt: now,
        isSynced: 0,
      });
      await this.recalculateLeadNextFollowUp(item.leadId);
    });

    const updated = await this.db.followUps.get(id);
    if (updated) {
      try {
        await this.getSyncQueue().enqueue({
          entityType: 'follow_ups',
          entityId: updated.id,
          operation: 'UPDATE',
          payload: updated,
          userId: updated.userId || 'local-user',
        });
      } catch (err) {
        console.warn('Outbox enqueue failed for softDeleteFollowUp:', err);
      }
    }
  }
}
