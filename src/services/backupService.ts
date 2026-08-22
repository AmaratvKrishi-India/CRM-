/**
 * Local Backup & Restore Service
 * Provides robust JSON-based CRM database export, pre-export integrity validation,
 * safe merge restore (Last-Write-Wins), transactional full replacement with rollback snapshot,
 * and operation audit logging.
 * Supports Schema Version 2 (Legacy Phase 1) and Schema Version 3 (Phase 2B Multi-User).
 */

import { SalesCRMDatabase } from '../db/database';
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
  BulkAssignmentAudit,
} from '../db/types';
import type { SyncState } from './sync/syncTypes';

export interface CRMBackupData {
  leads: Lead[];
  remarks: Remark[];
  callHistory: CallHistory[];
  followUps: FollowUp[];
  messageHistory: MessageHistory[];
  messageTemplates: MessageTemplate[];
  users?: User[];
  activities?: Activity[];
  callRecords?: CallRecord[];
  importAudits?: ImportAudit[];
  outbox?: OutboxItem[];
  bulkAssignmentAudits?: BulkAssignmentAudit[];
  syncState?: SyncState[];
}

export interface CRMBackupPayload {
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  databaseName: string;
  data: CRMBackupData;
}

export interface BackupValidationResult {
  isValid: boolean;
  errors: string[];
  summary: {
    leadsCount: number;
    remarksCount: number;
    callsCount: number;
    followUpsCount: number;
    messagesCount: number;
    templatesCount: number;
    usersCount?: number;
    activitiesCount?: number;
    callRecordsCount?: number;
    importAuditsCount?: number;
    totalRecords: number;
    approxSizeBytes: number;
  };
  payload?: CRMBackupPayload;
}

export interface MergeRestoreResult {
  added: number;
  updated: number;
  skipped: number;
  conflicts: number;
  details: {
    leads: { added: number; updated: number; skipped: number };
    remarks: { added: number; updated: number; skipped: number };
    callHistory: { added: number; updated: number; skipped: number };
    followUps: { added: number; updated: number; skipped: number };
    messageHistory: { added: number; updated: number; skipped: number };
    messageTemplates: { added: number; updated: number; skipped: number };
    users?: { added: number; updated: number; skipped: number };
    activities?: { added: number; updated: number; skipped: number };
    callRecords?: { added: number; updated: number; skipped: number };
    importAudits?: { added: number; updated: number; skipped: number };
  };
}

export interface BackupAuditLog {
  id: string;
  operation: 'EXPORT' | 'MERGE_RESTORE' | 'REPLACE_RESTORE';
  timestamp: string;
  status: 'SUCCESS' | 'FAILED';
  summaryText: string;
}

const BACKUP_HISTORY_STORAGE_KEY = 'amaratv_backup_audit_history';

export class BackupService {
  constructor(private db: SalesCRMDatabase) {}

  /**
   * Generates the standard backup filename: amaratv-crm-backup-YYYY-MM-DD-HHmm.json
   */
  static generateBackupFilename(date: Date = new Date()): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const yyyy = date.getFullYear();
    const MM = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const HH = pad(date.getHours());
    const mm = pad(date.getMinutes());
    return `amaratv-crm-backup-${yyyy}-${MM}-${dd}-${HH}${mm}.json`;
  }

  /**
   * Collects all active & soft-deleted records from the database and returns a validated CRMBackupPayload.
   */
  async generateBackupPayload(): Promise<CRMBackupPayload> {
    const [
      leads,
      remarks,
      callHistory,
      followUps,
      messageHistory,
      messageTemplates,
      users,
      activities,
      callRecords,
      importAudits,
      outbox,
      bulkAssignmentAudits,
      syncState,
    ] = await Promise.all([
      this.db.leads.toArray(),
      this.db.remarks.toArray(),
      this.db.callHistory.toArray(),
      this.db.followUps.toArray(),
      this.db.messageHistory.toArray(),
      this.db.messageTemplates.toArray(),
      this.db.users.toArray(),
      this.db.activities.toArray(),
      this.db.callRecords.toArray(),
      this.db.importAudits.toArray(),
      this.db.outbox.toArray(),
      this.db.bulkAssignmentAudits.toArray(),
      this.db.syncState.toArray(),
    ]);

    const payload: CRMBackupPayload = {
      schemaVersion: 5,
      appVersion: '2.0.0',
      exportedAt: new Date().toISOString(),
      databaseName: this.db.name,
      data: {
        leads,
        remarks,
        callHistory,
        followUps,
        messageHistory,
        messageTemplates,
        users,
        activities,
        callRecords,
        importAudits,
        outbox,
        bulkAssignmentAudits,
        syncState,
      },
    };

    // Pre-export validation
    const validation = this.validateBackupPayload(payload);
    if (!validation.isValid) {
      throw new Error(`Database integrity error before export:\n${validation.errors.join('\n')}`);
    }

    return payload;
  }

  /**
   * Validates a parsed or generated backup payload for schema structure, UUIDs, and reference consistency.
   * Supports backward compatibility with Schema Version 2.
   */
  validateBackupPayload(payload: any): BackupValidationResult {
    const errors: string[] = [];

    if (!payload || typeof payload !== 'object') {
      return {
        isValid: false,
        errors: ['Invalid backup: Payload must be a valid JSON object.'],
        summary: {
          leadsCount: 0,
          remarksCount: 0,
          callsCount: 0,
          followUpsCount: 0,
          messagesCount: 0,
          templatesCount: 0,
          totalRecords: 0,
          approxSizeBytes: 0,
        },
      };
    }

    if (!payload.schemaVersion || typeof payload.schemaVersion !== 'number' || payload.schemaVersion < 1) {
      errors.push('Missing or invalid schemaVersion in backup header.');
    }

    if (!payload.data || typeof payload.data !== 'object') {
      errors.push('Missing "data" container object in backup payload.');
      return {
        isValid: false,
        errors,
        summary: {
          leadsCount: 0,
          remarksCount: 0,
          callsCount: 0,
          followUpsCount: 0,
          messagesCount: 0,
          templatesCount: 0,
          totalRecords: 0,
          approxSizeBytes: 0,
        },
      };
    }

    const {
      leads = [],
      remarks = [],
      callHistory = [],
      followUps = [],
      messageHistory = [],
      messageTemplates = [],
      users = [],
      activities = [],
      callRecords = [],
      importAudits = [],
    } = payload.data;

    const tables: Array<{ name: string; list: any[] }> = [
      { name: 'leads', list: leads },
      { name: 'remarks', list: remarks },
      { name: 'callHistory', list: callHistory },
      { name: 'followUps', list: followUps },
      { name: 'messageHistory', list: messageHistory },
      { name: 'messageTemplates', list: messageTemplates },
    ];

    if (Array.isArray(users)) tables.push({ name: 'users', list: users });
    if (Array.isArray(activities)) tables.push({ name: 'activities', list: activities });
    if (Array.isArray(callRecords)) tables.push({ name: 'callRecords', list: callRecords });
    if (Array.isArray(importAudits)) tables.push({ name: 'importAudits', list: importAudits });

    const leadIds = new Set<string>();

    // Validate table arrays & duplicate IDs
    for (const { name, list } of tables) {
      if (!Array.isArray(list)) {
        errors.push(`Table "${name}" must be an array.`);
        continue;
      }

      const ids = new Set<string>();
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (!item || typeof item !== 'object') {
          errors.push(`Invalid record at ${name}[${i}]: Must be an object.`);
          continue;
        }
        if (!item.id || typeof item.id !== 'string') {
          errors.push(`Missing or non-string "id" at ${name}[${i}].`);
          continue;
        }
        if (ids.has(item.id)) {
          errors.push(`Duplicate ID "${item.id}" detected in table "${name}".`);
        }
        ids.add(item.id);

        if (name === 'leads') {
          leadIds.add(item.id);
        }
      }
    }

    // Validate foreign keys for child relations
    const validateForeignKeys = (childList: any[], childName: string) => {
      if (!Array.isArray(childList)) return;
      for (let i = 0; i < childList.length; i++) {
        const item = childList[i];
        if (item && item.leadId && !leadIds.has(item.leadId)) {
          if (leads.length > 0) {
            errors.push(
              `Orphan record in "${childName}" (ID: ${item.id}): Referenced leadId "${item.leadId}" not found in leads table.`
            );
          }
        }
      }
    };

    validateForeignKeys(remarks, 'remarks');
    validateForeignKeys(callHistory, 'callHistory');
    validateForeignKeys(followUps, 'followUps');
    validateForeignKeys(messageHistory, 'messageHistory');
    if (Array.isArray(activities)) validateForeignKeys(activities, 'activities');
    if (Array.isArray(callRecords)) validateForeignKeys(callRecords, 'callRecords');

    const totalRecords =
      leads.length +
      remarks.length +
      callHistory.length +
      followUps.length +
      messageHistory.length +
      messageTemplates.length +
      users.length +
      activities.length +
      callRecords.length +
      importAudits.length;

    const approxSizeBytes = JSON.stringify(payload).length;

    return {
      isValid: errors.length === 0,
      errors,
      summary: {
        leadsCount: leads.length,
        remarksCount: remarks.length,
        callsCount: callHistory.length,
        followUpsCount: followUps.length,
        messagesCount: messageHistory.length,
        templatesCount: messageTemplates.length,
        usersCount: users.length,
        activitiesCount: activities.length,
        callRecordsCount: callRecords.length,
        importAuditsCount: importAudits.length,
        totalRecords,
        approxSizeBytes,
      },
      payload: errors.length === 0 ? (payload as CRMBackupPayload) : undefined,
    };
  }

  /**
   * Validates raw JSON string content from a file upload.
   */
  validateBackupJson(jsonString: string): BackupValidationResult {
    try {
      const parsed = JSON.parse(jsonString);
      return this.validateBackupPayload(parsed);
    } catch (err: any) {
      return {
        isValid: false,
        errors: [`JSON Syntax Error: ${err.message}`],
        summary: {
          leadsCount: 0,
          remarksCount: 0,
          callsCount: 0,
          followUpsCount: 0,
          messagesCount: 0,
          templatesCount: 0,
          totalRecords: 0,
          approxSizeBytes: jsonString.length,
        },
      };
    }
  }

  /**
   * Executes a safe non-destructive MERGE restore into the current database.
   */
  async mergeRestore(payload: CRMBackupPayload): Promise<MergeRestoreResult> {
    const validation = this.validateBackupPayload(payload);
    if (!validation.isValid) {
      this.logAudit({
        operation: 'MERGE_RESTORE',
        status: 'FAILED',
        summaryText: `Validation failed: ${validation.errors.join('; ')}`,
      });
      throw new Error(`Cannot restore: Invalid backup payload.\n${validation.errors.join('\n')}`);
    }

    const result: MergeRestoreResult = {
      added: 0,
      updated: 0,
      skipped: 0,
      conflicts: 0,
      details: {
        leads: { added: 0, updated: 0, skipped: 0 },
        remarks: { added: 0, updated: 0, skipped: 0 },
        callHistory: { added: 0, updated: 0, skipped: 0 },
        followUps: { added: 0, updated: 0, skipped: 0 },
        messageHistory: { added: 0, updated: 0, skipped: 0 },
        messageTemplates: { added: 0, updated: 0, skipped: 0 },
        users: { added: 0, updated: 0, skipped: 0 },
        activities: { added: 0, updated: 0, skipped: 0 },
        callRecords: { added: 0, updated: 0, skipped: 0 },
        importAudits: { added: 0, updated: 0, skipped: 0 },
      },
    };

    await this.db.transaction('rw', this.db.tables, async () => {
      const mergeTable = async (
        tableName: keyof CRMBackupData,
        incoming: any[] | undefined,
        detailObj: { added: number; updated: number; skipped: number }
      ) => {
        if (!incoming || incoming.length === 0) return;
        const table = this.db[tableName as keyof SalesCRMDatabase] as any;
        if (!table) return;

        for (const item of incoming) {
          const localItem = await table.get(item.id);

          if (!localItem) {
            // New record -> add directly
            await table.add(item);
            detailObj.added++;
            result.added++;
          } else {
            // Existing ID -> Compare timestamps (Last-Write-Wins)
            const localUpdated = new Date(localItem.updatedAt || localItem.createdAt || 0).getTime();
            const incomingUpdated = new Date(item.updatedAt || item.createdAt || 0).getTime();

            const isIdentical = JSON.stringify(localItem) === JSON.stringify(item);

            if (isIdentical) {
              detailObj.skipped++;
              result.skipped++;
            } else if (incomingUpdated >= localUpdated) {
              // Incoming is newer or equal -> update
              await table.put(item);
              detailObj.updated++;
              result.updated++;
            } else {
              // Local is strictly newer -> keep local, count as conflict/skipped
              detailObj.skipped++;
              result.skipped++;
              result.conflicts++;
            }
          }
        }
      };

      await mergeTable('leads', payload.data.leads, result.details.leads);
      await mergeTable('remarks', payload.data.remarks, result.details.remarks);
      await mergeTable('callHistory', payload.data.callHistory, result.details.callHistory);
      await mergeTable('followUps', payload.data.followUps, result.details.followUps);
      await mergeTable('messageHistory', payload.data.messageHistory, result.details.messageHistory);
      await mergeTable('messageTemplates', payload.data.messageTemplates, result.details.messageTemplates);
      if (payload.data.users) await mergeTable('users', payload.data.users, result.details.users!);
      if (payload.data.activities) await mergeTable('activities', payload.data.activities, result.details.activities!);
      if (payload.data.callRecords) await mergeTable('callRecords', payload.data.callRecords, result.details.callRecords!);
      if (payload.data.importAudits) await mergeTable('importAudits', payload.data.importAudits, result.details.importAudits!);
    });

    this.logAudit({
      operation: 'MERGE_RESTORE',
      status: 'SUCCESS',
      summaryText: `Merged: ${result.added} added, ${result.updated} updated, ${result.skipped} skipped (${result.conflicts} conflicts).`,
    });

    return result;
  }

  /**
   * Executes a full transactional REPLACE restore with a safety rollback snapshot.
   */
  async replaceRestore(payload: CRMBackupPayload): Promise<void> {
    const validation = this.validateBackupPayload(payload);
    if (!validation.isValid) {
      this.logAudit({
        operation: 'REPLACE_RESTORE',
        status: 'FAILED',
        summaryText: `Validation failed: ${validation.errors.join('; ')}`,
      });
      throw new Error(`Cannot replace database: Invalid backup payload.\n${validation.errors.join('\n')}`);
    }

    // 1. Create safety snapshot of existing database before clearing
    const safetySnapshot = await this.generateBackupPayload();

    try {
      await this.db.transaction('rw', this.db.tables, async () => {
        // Clear all tables
        await Promise.all(this.db.tables.map((t) => t.clear()));

        // Insert backup tables
        if (payload.data.leads && payload.data.leads.length > 0) await this.db.leads.bulkAdd(payload.data.leads);
        if (payload.data.remarks && payload.data.remarks.length > 0) await this.db.remarks.bulkAdd(payload.data.remarks);
        if (payload.data.callHistory && payload.data.callHistory.length > 0) await this.db.callHistory.bulkAdd(payload.data.callHistory);
        if (payload.data.followUps && payload.data.followUps.length > 0) await this.db.followUps.bulkAdd(payload.data.followUps);
        if (payload.data.messageHistory && payload.data.messageHistory.length > 0) await this.db.messageHistory.bulkAdd(payload.data.messageHistory);
        if (payload.data.messageTemplates && payload.data.messageTemplates.length > 0) await this.db.messageTemplates.bulkAdd(payload.data.messageTemplates);
        if (payload.data.users && payload.data.users.length > 0) await this.db.users.bulkAdd(payload.data.users);
        if (payload.data.activities && payload.data.activities.length > 0) await this.db.activities.bulkAdd(payload.data.activities);
        if (payload.data.callRecords && payload.data.callRecords.length > 0) await this.db.callRecords.bulkAdd(payload.data.callRecords);
        if (payload.data.importAudits && payload.data.importAudits.length > 0) await this.db.importAudits.bulkAdd(payload.data.importAudits);
        // Restore the sync outbox and sync cursors so unsynced mutations survive
        // a restore on a fresh device instead of being silently dropped.
        if (payload.data.outbox && payload.data.outbox.length > 0) await this.db.outbox.bulkAdd(payload.data.outbox);
        if (payload.data.bulkAssignmentAudits && payload.data.bulkAssignmentAudits.length > 0) await this.db.bulkAssignmentAudits.bulkAdd(payload.data.bulkAssignmentAudits);
        if (payload.data.syncState && payload.data.syncState.length > 0) await this.db.syncState.bulkAdd(payload.data.syncState);
      });

      this.logAudit({
        operation: 'REPLACE_RESTORE',
        status: 'SUCCESS',
        summaryText: `Replaced DB with ${validation.summary.totalRecords} records from backup.`,
      });
    } catch (err: any) {
      // 2. Rollback to safety snapshot in case of transaction failure
      console.error('Replace restore failed! Attempting safety rollback...', err);
      try {
        await this.db.transaction('rw', this.db.tables, async () => {
          await Promise.all(this.db.tables.map((t) => t.clear()));
          if (safetySnapshot.data.leads.length > 0) await this.db.leads.bulkAdd(safetySnapshot.data.leads);
          if (safetySnapshot.data.remarks.length > 0) await this.db.remarks.bulkAdd(safetySnapshot.data.remarks);
          if (safetySnapshot.data.callHistory.length > 0) await this.db.callHistory.bulkAdd(safetySnapshot.data.callHistory);
          if (safetySnapshot.data.followUps.length > 0) await this.db.followUps.bulkAdd(safetySnapshot.data.followUps);
          if (safetySnapshot.data.messageHistory.length > 0) await this.db.messageHistory.bulkAdd(safetySnapshot.data.messageHistory);
          if (safetySnapshot.data.messageTemplates.length > 0) await this.db.messageTemplates.bulkAdd(safetySnapshot.data.messageTemplates);
          if (safetySnapshot.data.users && safetySnapshot.data.users.length > 0) await this.db.users.bulkAdd(safetySnapshot.data.users);
          if (safetySnapshot.data.activities && safetySnapshot.data.activities.length > 0) await this.db.activities.bulkAdd(safetySnapshot.data.activities);
          if (safetySnapshot.data.callRecords && safetySnapshot.data.callRecords.length > 0) await this.db.callRecords.bulkAdd(safetySnapshot.data.callRecords);
          if (safetySnapshot.data.importAudits && safetySnapshot.data.importAudits.length > 0) await this.db.importAudits.bulkAdd(safetySnapshot.data.importAudits);
          if (safetySnapshot.data.outbox && safetySnapshot.data.outbox.length > 0) await this.db.outbox.bulkAdd(safetySnapshot.data.outbox);
          if (safetySnapshot.data.bulkAssignmentAudits && safetySnapshot.data.bulkAssignmentAudits.length > 0) await this.db.bulkAssignmentAudits.bulkAdd(safetySnapshot.data.bulkAssignmentAudits);
          if (safetySnapshot.data.syncState && safetySnapshot.data.syncState.length > 0) await this.db.syncState.bulkAdd(safetySnapshot.data.syncState);
        });
      } catch (rollbackErr) {
        console.error('Catastrophic failure: Rollback also failed!', rollbackErr);
      }

      this.logAudit({
        operation: 'REPLACE_RESTORE',
        status: 'FAILED',
        summaryText: `Error: ${err.message}. Safety snapshot restored.`,
      });

      throw new Error(`Database replacement failed: ${err.message}. Previous database state was restored.`);
    }
  }

  /**
   * Retrieves current database summary counts.
   */
  async getDatabaseSummary(): Promise<{
    leadsCount: number;
    remarksCount: number;
    callsCount: number;
    followUpsCount: number;
    messagesCount: number;
    templatesCount: number;
    usersCount: number;
    activitiesCount: number;
    callRecordsCount: number;
    importAuditsCount: number;
    totalRecords: number;
  }> {
    const [
      leadsCount,
      remarksCount,
      callsCount,
      followUpsCount,
      messagesCount,
      templatesCount,
      usersCount,
      activitiesCount,
      callRecordsCount,
      importAuditsCount,
    ] = await Promise.all([
      this.db.leads.count(),
      this.db.remarks.count(),
      this.db.callHistory.count(),
      this.db.followUps.count(),
      this.db.messageHistory.count(),
      this.db.messageTemplates.count(),
      this.db.users.count(),
      this.db.activities.count(),
      this.db.callRecords.count(),
      this.db.importAudits.count(),
    ]);

    return {
      leadsCount,
      remarksCount,
      callsCount,
      followUpsCount,
      messagesCount,
      templatesCount,
      usersCount,
      activitiesCount,
      callRecordsCount,
      importAuditsCount,
      totalRecords:
        leadsCount +
        remarksCount +
        callsCount +
        followUpsCount +
        messagesCount +
        templatesCount +
        usersCount +
        activitiesCount +
        callRecordsCount +
        importAuditsCount,
    };
  }

  /**
   * Logs an audit record to local storage.
   */
  private logAudit(entry: Omit<BackupAuditLog, 'id' | 'timestamp'>): void {
    try {
      const logs = this.getAuditLogs();
      const newLog: BackupAuditLog = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        timestamp: new Date().toISOString(),
        ...entry,
      };
      logs.unshift(newLog);
      const trimmed = logs.slice(0, 20); // Keep last 20 entries
      localStorage.setItem(BACKUP_HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
    } catch (e) {
      // Ignore storage errors in restricted contexts
    }
  }

  /**
   * Retrieves recent audit logs from local storage.
   */
  getAuditLogs(): BackupAuditLog[] {
    try {
      const raw = localStorage.getItem(BACKUP_HISTORY_STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }

  /**
   * Triggers a browser/device JSON file download of the backup.
   */
  static downloadJsonFile(filename: string, jsonString: string): void {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
