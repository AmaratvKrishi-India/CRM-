/**
 * Amaratv Krishi Sales CRM - Dexie Database Core
 * Offline-first IndexedDB database with schema versioning, indexing, and migration support.
 */

import Dexie, { Table } from 'dexie';
import {
  Lead,
  Remark,
  CallHistory,
  FollowUp,
  MessageHistory,
  MessageTemplate,
  User,
  Activity,
  CallRecord,
  ImportAudit,
  OutboxItem,
  SyncState,
  BulkAssignmentAudit,
} from './types';
import { DEFAULT_MESSAGE_TEMPLATES } from './seeds/defaultTemplates';

export class SalesCRMDatabase extends Dexie {
  leads!: Table<Lead, string>;
  remarks!: Table<Remark, string>;
  callHistory!: Table<CallHistory, string>;
  followUps!: Table<FollowUp, string>;
  messageHistory!: Table<MessageHistory, string>;
  messageTemplates!: Table<MessageTemplate, string>;
  users!: Table<User, string>;
  activities!: Table<Activity, string>;
  callRecords!: Table<CallRecord, string>;
  importAudits!: Table<ImportAudit, string>;
  outbox!: Table<OutboxItem, string>;
  syncState!: Table<SyncState, string>;
  bulkAssignmentAudits!: Table<BulkAssignmentAudit, string>;

  constructor(dbName: string = 'AmaratvSalesCRM') {
    super(dbName);

    // Version 1: Initial Core Schema
    this.version(1).stores({
      leads: 'id, phone, businessName, category, locality, pincode, status, isSynced, deletedAt, nextFollowUpAt, lastContactedAt, createdAt, updatedAt',
      remarks: 'id, leadId, type, createdAt, isSynced, deletedAt',
      callHistory: 'id, leadId, outcome, startedAt, isSynced, deletedAt',
      followUps: 'id, leadId, scheduledAt, status, priority, isSynced, deletedAt',
      messageHistory: 'id, leadId, channel, sentStatus, sentAt, isSynced, deletedAt',
      messageTemplates: 'id, category, isDefault, isSynced, deletedAt',
    });

    // Version 2: Optimized Compound Indices for Fast Mobile Filtering & Archival
    this.version(2)
      .stores({
        leads: 'id, phone, businessName, category, locality, pincode, status, isSynced, deletedAt, nextFollowUpAt, lastContactedAt, createdAt, updatedAt, [status+deletedAt], [locality+deletedAt], [isSynced+deletedAt]',
        remarks: 'id, leadId, type, createdAt, isSynced, deletedAt, [leadId+deletedAt]',
        callHistory: 'id, leadId, outcome, startedAt, isSynced, deletedAt, [leadId+deletedAt]',
        followUps: 'id, leadId, scheduledAt, status, priority, isSynced, deletedAt, [status+scheduledAt], [leadId+deletedAt]',
        messageHistory: 'id, leadId, channel, sentStatus, sentAt, isSynced, deletedAt, [leadId+deletedAt]',
        messageTemplates: 'id, category, isDefault, isSynced, deletedAt, [category+deletedAt]',
      })
      .upgrade(async (trans) => {
        // Migration logic for existing records if migrating from v1 to v2
        const leadsTable = trans.table('leads');
        await leadsTable.toCollection().modify((lead: Lead) => {
          if (lead.deletedAt === undefined) lead.deletedAt = null;
          if (lead.isSynced === undefined) lead.isSynced = 0;
          if (lead.callCount === undefined) lead.callCount = 0;
        });
      });

    // Version 3: Multi-User, Role-Based Access, Lead Ownership, and Activity Logging (Phase 2B)
    this.version(3)
      .stores({
        leads: 'id, phone, businessName, category, locality, pincode, status, createdBy, assignedTo, isSynced, deletedAt, nextFollowUpAt, lastContactedAt, createdAt, updatedAt, [status+deletedAt], [assignedTo+deletedAt], [locality+deletedAt], [isSynced+deletedAt]',
        remarks: 'id, leadId, type, createdAt, isSynced, deletedAt, [leadId+deletedAt]',
        callHistory: 'id, leadId, outcome, startedAt, isSynced, deletedAt, [leadId+deletedAt]',
        followUps: 'id, leadId, scheduledAt, status, priority, isSynced, deletedAt, [status+scheduledAt], [leadId+deletedAt]',
        messageHistory: 'id, leadId, channel, sentStatus, sentAt, isSynced, deletedAt, [leadId+deletedAt]',
        messageTemplates: 'id, category, isDefault, isSynced, deletedAt, [category+deletedAt]',
        users: 'id, email, role, status, isSynced, deletedAt, [role+status], [role+deletedAt]',
        activities: 'id, leadId, userId, activityType, createdAt, isSynced, deletedAt, [leadId+deletedAt], [userId+createdAt]',
        callRecords: 'id, leadId, userId, outcome, startedAt, isSynced, deletedAt, [leadId+deletedAt], [userId+startedAt]',
        importAudits: 'id, uploadedBy, createdAt, isSynced, [uploadedBy+createdAt]',
      })
      .upgrade(async (trans) => {
        // Safe migration: legacy leads receive createdBy/assignedTo as null/unassigned
        const leadsTable = trans.table('leads');
        await leadsTable.toCollection().modify((lead: Lead) => {
          if (lead.createdBy === undefined) lead.createdBy = null;
          if (lead.assignedTo === undefined) lead.assignedTo = null;
          if (lead.updatedBy === undefined) lead.updatedBy = null;
        });
      });

    // Version 4: Offline Outbox Queue & Sync State Store (Phase 2F)
    this.version(4).stores({
      leads: 'id, phone, businessName, category, locality, pincode, status, createdBy, assignedTo, isSynced, deletedAt, nextFollowUpAt, lastContactedAt, createdAt, updatedAt, [status+deletedAt], [assignedTo+deletedAt], [locality+deletedAt], [isSynced+deletedAt]',
      remarks: 'id, leadId, type, createdAt, isSynced, deletedAt, [leadId+deletedAt]',
      callHistory: 'id, leadId, outcome, startedAt, isSynced, deletedAt, [leadId+deletedAt]',
      followUps: 'id, leadId, scheduledAt, status, priority, isSynced, deletedAt, [status+scheduledAt], [leadId+deletedAt]',
      messageHistory: 'id, leadId, channel, sentStatus, sentAt, isSynced, deletedAt, [leadId+deletedAt]',
      messageTemplates: 'id, category, isDefault, isSynced, deletedAt, [category+deletedAt]',
      users: 'id, email, role, status, isSynced, deletedAt, [role+status], [role+deletedAt]',
      activities: 'id, leadId, userId, activityType, createdAt, isSynced, deletedAt, [leadId+deletedAt], [userId+createdAt]',
      callRecords: 'id, leadId, userId, outcome, startedAt, isSynced, deletedAt, [leadId+deletedAt], [userId+startedAt]',
      importAudits: 'id, uploadedBy, createdAt, isSynced, [uploadedBy+createdAt]',
      outbox: 'id, entityType, entityId, operation, status, retryCount, createdAt, updatedAt, [status+createdAt]',
      syncState: 'id',
    });

    // Version 5: Bulk Assignment Audits (Phase 2K)
    this.version(5).stores({
      leads: 'id, phone, businessName, category, locality, pincode, status, createdBy, assignedTo, isSynced, deletedAt, nextFollowUpAt, lastContactedAt, createdAt, updatedAt, [status+deletedAt], [assignedTo+deletedAt], [locality+deletedAt], [isSynced+deletedAt]',
      remarks: 'id, leadId, type, createdAt, isSynced, deletedAt, [leadId+deletedAt]',
      callHistory: 'id, leadId, outcome, startedAt, isSynced, deletedAt, [leadId+deletedAt]',
      followUps: 'id, leadId, scheduledAt, status, priority, isSynced, deletedAt, [status+scheduledAt], [leadId+deletedAt]',
      messageHistory: 'id, leadId, channel, sentStatus, sentAt, isSynced, deletedAt, [leadId+deletedAt]',
      messageTemplates: 'id, category, isDefault, isSynced, deletedAt, [category+deletedAt]',
      users: 'id, email, role, status, isSynced, deletedAt, [role+status], [role+deletedAt]',
      activities: 'id, leadId, userId, activityType, createdAt, isSynced, deletedAt, [leadId+deletedAt], [userId+createdAt]',
      callRecords: 'id, leadId, userId, outcome, startedAt, isSynced, deletedAt, [leadId+deletedAt], [userId+startedAt]',
      importAudits: 'id, uploadedBy, createdAt, isSynced, [uploadedBy+createdAt]',
      outbox: 'id, entityType, entityId, operation, status, retryCount, createdAt, updatedAt, [status+createdAt]',
      syncState: 'id',
      bulkAssignmentAudits: 'id, organizationId, performedBy, targetAgentId, status, startedAt, isSynced, deletedAt, [targetAgentId+startedAt], [performedBy+startedAt]',
    });

    // Setup Hooks for Automatic Timestamp and Sync Dirty-Flag Management
    this.setupHooks();
  }

  private setupHooks(): void {
    const tables = [
      'leads',
      'remarks',
      'callHistory',
      'followUps',
      'messageHistory',
      'messageTemplates',
      'users',
      'activities',
      'callRecords',
      'importAudits',
      'bulkAssignmentAudits',
    ] as const;

    tables.forEach((tableName) => {
      const table = this[tableName];
      if (!table) return;

      table.hook('creating', (_primKey, obj) => {
        const now = new Date().toISOString();
        if (!obj.createdAt) obj.createdAt = now;
        if (!obj.updatedAt) obj.updatedAt = now;
        if (obj.isSynced === undefined) obj.isSynced = 0;
        if (obj.deletedAt === undefined && tableName !== 'importAudits') obj.deletedAt = null;
      });

      table.hook('updating', (modifications, _primKey, _obj) => {
        const now = new Date().toISOString();
        const mods = modifications as Record<string, any>;
        return {
          ...modifications,
          updatedAt: mods.updatedAt || now,
          isSynced: mods.isSynced !== undefined ? mods.isSynced : 0,
        };
      });
    });
  }

  /**
   * Seeds default templates into the database if not already present.
   */
  async seedDefaults(): Promise<void> {
    const count = await this.messageTemplates.count();
    if (count === 0) {
      const now = new Date().toISOString();
      const templatesToInsert: MessageTemplate[] = DEFAULT_MESSAGE_TEMPLATES.map((t) => ({
        ...t,
        createdAt: now,
        updatedAt: now,
        isSynced: 0,
        deletedAt: null,
      }));
      await this.messageTemplates.bulkAdd(templatesToInsert);
    }
  }

  /**
   * Safely clears all data (used for testing or total data reset).
   */
  async clearAllData(): Promise<void> {
    await this.transaction('rw', this.tables, async () => {
      await Promise.all(this.tables.map((table) => table.clear()));
    });
  }
}

// Export singleton database instance
export const db = new SalesCRMDatabase();
export function getDatabase(): SalesCRMDatabase {
  return db;
}
