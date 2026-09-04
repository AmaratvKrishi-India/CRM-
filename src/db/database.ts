/**
 * Amaratv Krishi Sales CRM - Dexie Database Core
 * Offline-first IndexedDB database with schema versioning, indexing, and migration support.
 */

import type { Table } from 'dexie';
import Dexie from 'dexie';
import type {
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
import type {
  AccessScope} from './accessScope';
import {
  LOCKED_DATABASE_NAME,
  canAccessLead,
  normalizeAccessScope,
  sameAccessScope,
  scopedDatabaseName,
} from './accessScope';

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

  readonly accessScope: AccessScope | null;

  constructor(dbName: string = LOCKED_DATABASE_NAME, accessScope: AccessScope | null = null) {
    super(dbName);
    this.accessScope = accessScope ? normalizeAccessScope(accessScope) : null;

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

    // Version 6: account-scoped cache and per-user/per-organization sync indexes.
    // Existing unscoped databases are intentionally not migrated into an
    // authenticated user's partition because their ownership cannot be proven.
    this.version(6).stores({
      leads: 'id, phone, businessName, category, locality, pincode, status, createdBy, assignedTo, isSynced, deletedAt, nextFollowUpAt, lastContactedAt, createdAt, updatedAt, [status+deletedAt], [assignedTo+deletedAt], [createdBy+deletedAt], [locality+deletedAt], [isSynced+deletedAt]',
      remarks: 'id, leadId, type, createdAt, isSynced, deletedAt, [leadId+deletedAt]',
      callHistory: 'id, leadId, outcome, startedAt, isSynced, deletedAt, [leadId+deletedAt]',
      followUps: 'id, leadId, userId, scheduledAt, status, priority, isSynced, deletedAt, [status+scheduledAt], [leadId+deletedAt], [userId+status]',
      messageHistory: 'id, leadId, userId, channel, sentStatus, sentAt, isSynced, deletedAt, [leadId+deletedAt], [userId+sentAt]',
      messageTemplates: 'id, category, isDefault, isSynced, deletedAt, [category+deletedAt]',
      users: 'id, organizationId, email, role, status, isSynced, deletedAt, [organizationId+role+status], [role+deletedAt]',
      activities: 'id, leadId, userId, activityType, createdAt, isSynced, deletedAt, [leadId+deletedAt], [userId+createdAt]',
      callRecords: 'id, leadId, userId, outcome, startedAt, isSynced, deletedAt, [leadId+deletedAt], [userId+startedAt]',
      importAudits: 'id, uploadedBy, createdAt, isSynced, [uploadedBy+createdAt]',
      outbox: 'id, organizationId, userId, entityType, entityId, operation, status, retryCount, createdAt, updatedAt, [organizationId+userId+status], [status+createdAt]',
      syncState: 'id, organizationId, userId',
      bulkAssignmentAudits: 'id, organizationId, performedBy, targetAgentId, status, startedAt, isSynced, deletedAt, [targetAgentId+startedAt], [performedBy+startedAt]',
    });

    // Setup Hooks for Automatic Timestamp and Sync Dirty-Flag Management
    this.setupHooks();
  }

  /** Rejects repository work when the database is locked or the caller scope differs. */
  requireAccessScope(requested?: AccessScope): AccessScope {
    if (!this.accessScope) {
      throw new Error('Local CRM data is locked until an active server profile is verified.');
    }
    const normalized = requested ? normalizeAccessScope(requested) : this.accessScope;
    if (!sameAccessScope(this.accessScope, normalized)) {
      throw new Error('Access scope does not match the active local data partition.');
    }
    return this.accessScope;
  }

  /** Returns a lead only when it belongs to the current role/user boundary. */
  async requireAccessibleLead(leadId: string, requested?: AccessScope): Promise<Lead> {
    const scope = this.requireAccessScope(requested);
    const lead = await this.leads.get(leadId);
    if (!lead || !canAccessLead(scope, lead)) {
      // Deliberately avoid revealing whether a forbidden record exists.
      throw new Error(`Lead ${leadId} not found.`);
    }
    return lead;
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
    this.requireAccessScope();
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
      // bulkPut keeps repeated login/activation flows idempotent. Multiple
      // callers can observe an empty store before either write completes.
      await this.messageTemplates.bulkPut(templatesToInsert);
    }
  }

  /**
   * Safely clears all data (used for testing or total data reset).
   */
  async clearAllData(): Promise<void> {
    this.requireAccessScope();
    await this.transaction('rw', this.tables, async () => {
      await Promise.all(this.tables.map((table) => table.clear()));
    });
  }
}

// Export singleton database instance
export let db = new SalesCRMDatabase();

/** Open the cache that belongs exclusively to the verified account. */
export async function activateDatabaseScope(scope: AccessScope): Promise<SalesCRMDatabase> {
  const normalized = normalizeAccessScope(scope);
  const nextName = scopedDatabaseName(normalized);
  if (db.name === nextName && db.accessScope && sameAccessScope(db.accessScope, normalized)) {
    if (!db.isOpen()) await db.open();
    return db;
  }

  db.close();
  // Replace the exported binding immediately. If opening the requested
  // partition fails, callers cannot accidentally reopen the previous cache.
  db = new SalesCRMDatabase();
  const next = new SalesCRMDatabase(nextName, normalized);
  await next.open();
  db = next;
  return db;
}

/** Close all sensitive tables and expose only an empty, unscoped database handle. */
export async function lockDatabaseScope(): Promise<SalesCRMDatabase> {
  db.close();
  db = new SalesCRMDatabase();
  return db;
}

export function getDatabase(): SalesCRMDatabase {
  return db;
}
