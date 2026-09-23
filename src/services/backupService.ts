/**
 * Local Backup & Restore Service
 * Provides robust JSON-based CRM database export, pre-export integrity validation,
 * safe merge restore (Last-Write-Wins), transactional full replacement with rollback snapshot,
 * and operation audit logging.
 * Supports Schema Version 2 (Legacy Phase 1) and Schema Version 3 (Phase 2B Multi-User).
 */

import type { SalesCRMDatabase } from '../db/database';
import type { Table } from 'dexie';
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
  BulkAssignmentAudit,
} from '../db/types';
import type { SyncState } from './sync/syncTypes';
import { canAccessLead, type AccessScope } from '../db/accessScope';

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
  organizationId: string;
  userId: string;
  data: CRMBackupData;
}

export interface BackupSerializationOptions {
  yieldAfterRecords?: number;
  scheduler?: () => Promise<void>;
}

const yieldToEventLoop = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Serializes backup collections incrementally so large exports do not create one
 * unbounded JSON.stringify task on the browser's UI thread.
 */
export async function serializeBackupPayload(
  payload: CRMBackupPayload,
  options: BackupSerializationOptions = {}
): Promise<string> {
  const yieldAfterRecords = Math.max(1, options.yieldAfterRecords ?? 100);
  const scheduler = options.scheduler ?? yieldToEventLoop;
  const { data, ...header } = payload;
  const chunks = [JSON.stringify(header).slice(0, -1), ',"data":{'];
  let collectionIndex = 0;
  let recordsSinceYield = 0;

  for (const [name, records] of Object.entries(data)) {
    if (records === undefined) continue;
    if (collectionIndex > 0) chunks.push(',');
    chunks.push(JSON.stringify(name), ':[');

    for (let recordIndex = 0; recordIndex < records.length; recordIndex++) {
      if (recordIndex > 0) chunks.push(',');
      chunks.push(JSON.stringify(records[recordIndex]));
      recordsSinceYield++;
      if (recordsSinceYield >= yieldAfterRecords) {
        recordsSinceYield = 0;
        await scheduler();
      }
    }

    chunks.push(']');
    collectionIndex++;
  }

  chunks.push('}}');
  return chunks.join('');
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
    outbox?: { added: number; updated: number; skipped: number };
    syncState?: { added: number; updated: number; skipped: number };
    bulkAssignmentAudits?: { added: number; updated: number; skipped: number };
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
export const MAX_BACKUP_RESTORE_FILE_BYTES = 25 * 1024 * 1024;

type FieldKind = 'string' | 'number' | 'boolean' | 'object' | 'timestamp' | 'syncFlag';
type FieldRule = { kind: FieldKind; nullable?: boolean; optional?: boolean; allowEmpty?: boolean };
type RecordRules = Record<string, FieldRule>;

const SUPPORTED_BACKUP_COLLECTIONS = new Set([
  'leads', 'remarks', 'callHistory', 'followUps', 'messageHistory', 'messageTemplates',
  'users', 'activities', 'callRecords', 'importAudits', 'outbox', 'syncState',
  'bulkAssignmentAudits',
]);

const COMMON_RECORD_RULES: RecordRules = {
  id: { kind: 'string' }, createdAt: { kind: 'timestamp' },
  updatedAt: { kind: 'timestamp' }, isSynced: { kind: 'syncFlag' },
};

const RECORD_RULES: Record<string, RecordRules> = {
  leads: { ...COMMON_RECORD_RULES, businessName: { kind: 'string' }, phone: { kind: 'string' }, status: { kind: 'string' }, deletedAt: { kind: 'timestamp', nullable: true }, organizationId: { kind: 'string', nullable: true, optional: true }, createdBy: { kind: 'string', nullable: true, optional: true }, assignedTo: { kind: 'string', nullable: true, optional: true } },
  remarks: { ...COMMON_RECORD_RULES, leadId: { kind: 'string' }, content: { kind: 'string' }, author: { kind: 'string' }, type: { kind: 'string' }, deletedAt: { kind: 'timestamp', nullable: true } },
  callHistory: { ...COMMON_RECORD_RULES, leadId: { kind: 'string' }, calledNumber: { kind: 'string' }, phoneType: { kind: 'string' }, startedAt: { kind: 'timestamp' }, endedAt: { kind: 'timestamp', nullable: true }, durationSeconds: { kind: 'number' }, outcome: { kind: 'string' }, notes: { kind: 'string', nullable: true }, deletedAt: { kind: 'timestamp', nullable: true } },
  followUps: { ...COMMON_RECORD_RULES, leadId: { kind: 'string' }, scheduledAt: { kind: 'timestamp' }, title: { kind: 'string' }, notes: { kind: 'string', nullable: true }, priority: { kind: 'string' }, status: { kind: 'string' }, completedAt: { kind: 'timestamp', nullable: true }, deletedAt: { kind: 'timestamp', nullable: true } },
  messageHistory: { ...COMMON_RECORD_RULES, leadId: { kind: 'string' }, channel: { kind: 'string' }, templateId: { kind: 'string', nullable: true }, recipientPhone: { kind: 'string' }, messageContent: { kind: 'string' }, sentStatus: { kind: 'string' }, sentAt: { kind: 'timestamp' }, deletedAt: { kind: 'timestamp', nullable: true } },
  messageTemplates: { ...COMMON_RECORD_RULES, title: { kind: 'string' }, category: { kind: 'string' }, body: { kind: 'string' }, isDefault: { kind: 'boolean' }, deletedAt: { kind: 'timestamp', nullable: true } },
  users: { ...COMMON_RECORD_RULES, organizationId: { kind: 'string', nullable: true }, name: { kind: 'string' }, email: { kind: 'string' }, phone: { kind: 'string', allowEmpty: true }, role: { kind: 'string' }, status: { kind: 'string' }, createdBy: { kind: 'string', nullable: true }, lastLoginAt: { kind: 'timestamp', nullable: true }, deletedAt: { kind: 'timestamp', nullable: true } },
  activities: { ...COMMON_RECORD_RULES, leadId: { kind: 'string', nullable: true }, userId: { kind: 'string' }, deviceId: { kind: 'string', nullable: true }, activityType: { kind: 'string' }, metadata: { kind: 'object' }, deletedAt: { kind: 'timestamp', nullable: true } },
  callRecords: { ...COMMON_RECORD_RULES, leadId: { kind: 'string' }, userId: { kind: 'string' }, deviceId: { kind: 'string', nullable: true }, startedAt: { kind: 'timestamp' }, answeredAt: { kind: 'timestamp', nullable: true }, endedAt: { kind: 'timestamp', nullable: true }, durationSeconds: { kind: 'number' }, outcome: { kind: 'string' }, remark: { kind: 'string', nullable: true }, verificationStatus: { kind: 'string' }, deletedAt: { kind: 'timestamp', nullable: true } },
  importAudits: { ...COMMON_RECORD_RULES, uploadedBy: { kind: 'string', nullable: true }, deviceId: { kind: 'string', nullable: true }, filename: { kind: 'string' }, source: { kind: 'string' }, startedAt: { kind: 'timestamp' }, completedAt: { kind: 'timestamp', nullable: true }, totalRows: { kind: 'number' }, imported: { kind: 'number' }, updated: { kind: 'number' }, duplicates: { kind: 'number' }, invalid: { kind: 'number' } },
  outbox: { id: { kind: 'string' }, organizationId: { kind: 'string', nullable: true }, userId: { kind: 'string' }, deviceId: { kind: 'string', nullable: true }, entityType: { kind: 'string' }, entityId: { kind: 'string' }, operation: { kind: 'string' }, payload: { kind: 'object' }, createdAt: { kind: 'timestamp' }, updatedAt: { kind: 'timestamp' }, retryCount: { kind: 'number' }, lastAttemptAt: { kind: 'timestamp', nullable: true }, lastError: { kind: 'string', nullable: true }, status: { kind: 'string' } },
  syncState: { id: { kind: 'string' }, organizationId: { kind: 'string' }, userId: { kind: 'string' }, deviceId: { kind: 'string' }, lastSuccessfulSyncAt: { kind: 'timestamp', nullable: true }, lastPullCursor: { kind: 'string', nullable: true }, status: { kind: 'string' } },
  bulkAssignmentAudits: { ...COMMON_RECORD_RULES, organizationId: { kind: 'string', nullable: true }, performedBy: { kind: 'string' }, targetAgentId: { kind: 'string' }, selectedLeadCount: { kind: 'number' }, successfulCount: { kind: 'number' }, failedCount: { kind: 'number' }, startedAt: { kind: 'timestamp' }, completedAt: { kind: 'timestamp' }, status: { kind: 'string' }, deletedAt: { kind: 'timestamp', nullable: true } },
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function fieldMatches(value: unknown, rule: FieldRule): boolean {
  if (value === null) return !!rule.nullable;
  if (rule.kind === 'timestamp') return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
  if (rule.kind === 'syncFlag') return value === 0 || value === 1;
  if (rule.kind === 'object') return isPlainObject(value);
  if (rule.kind === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (rule.kind === 'string') return typeof value === 'string' && (rule.allowEmpty === true || value.trim().length > 0);
  return typeof value === 'boolean';
}

function validateRecordShape(table: string, item: Record<string, unknown>, index: number, errors: string[]): void {
  const rules = RECORD_RULES[table];
  if (!rules) return;
  for (const [field, rule] of Object.entries(rules)) {
    const value = item[field];
    if (value === undefined && rule.optional) continue;
    if (value === undefined) errors.push(`Missing required field "${field}" at ${table}[${index}].`);
    else if (!fieldMatches(value, rule)) errors.push(`Invalid field "${field}" at ${table}[${index}].`);
  }
}

const REQUIRED_BACKUP_COLLECTIONS = ['leads', 'remarks', 'callHistory', 'followUps', 'messageHistory', 'messageTemplates'] as const;
const FK_BACKUP_COLLECTIONS = ['remarks', 'callHistory', 'followUps', 'messageHistory', 'activities', 'callRecords'] as const;

function emptyBackupSummary(approxSizeBytes = 0): BackupValidationResult['summary'] {
  return { leadsCount: 0, remarksCount: 0, callsCount: 0, followUpsCount: 0, messagesCount: 0, templatesCount: 0, totalRecords: 0, approxSizeBytes };
}

function invalidBackup(errors: string[], approxSizeBytes = 0): BackupValidationResult {
  return { isValid: false, errors, summary: emptyBackupSummary(approxSizeBytes) };
}

function validateBackupHeader(payload: Record<string, unknown>, scope: AccessScope, errors: string[]): void {
  if (!payload.schemaVersion || typeof payload.schemaVersion !== 'number' || payload.schemaVersion < 1) {
    errors.push('Missing or invalid schemaVersion in backup header.');
  }
  if (typeof payload.schemaVersion === 'number' && payload.schemaVersion < 6) {
    errors.push('Legacy unscoped backups cannot be restored automatically; use the audited recovery process.');
  }
  if (payload.organizationId !== scope.organizationId || payload.userId !== scope.userId) {
    errors.push('Backup belongs to a different organization or signed-in user.');
  }
}

function validateBackupCollections(data: Record<string, unknown>, errors: string[]): boolean {
  for (const name of Object.keys(data)) {
    if (!SUPPORTED_BACKUP_COLLECTIONS.has(name)) errors.push(`Unsupported backup collection "${name}".`);
  }
  for (const name of REQUIRED_BACKUP_COLLECTIONS) {
    if (!Array.isArray(data[name])) errors.push(`Table "${name}" must be an array.`);
  }
  for (const name of SUPPORTED_BACKUP_COLLECTIONS) {
    if (name in data && !Array.isArray(data[name])) errors.push(`Table "${name}" must be an array.`);
  }
  return !errors.some((error) => error.includes('must be an array'));
}

function backupTables(data: Record<string, unknown>): Array<{ name: string; list: unknown[] }> {
  const tables: Array<{ name: string; list: unknown[] }> = REQUIRED_BACKUP_COLLECTIONS.map((name) => ({ name, list: data[name] as unknown[] }));
  for (const name of SUPPORTED_BACKUP_COLLECTIONS) {
    if (!(REQUIRED_BACKUP_COLLECTIONS as readonly string[]).includes(name) && Array.isArray(data[name])) {
      tables.push({ name, list: data[name] as unknown[] });
    }
  }
  return tables;
}

function validateScopedBackupRecord(
  name: string,
  item: Record<string, unknown>,
  scope: AccessScope,
  errors: string[],
): void {
  if (name === 'leads') {
    const wrongOrg = Boolean(item.organizationId) && item.organizationId !== scope.organizationId;
    const inaccessible = scope.role !== 'ADMIN' && item.assignedTo !== scope.userId && item.createdBy !== scope.userId;
    if (wrongOrg || inaccessible) errors.push(`Lead "${item.id}" is outside the active backup access scope.`);
    return;
  }
  if (name === 'users' && item.organizationId !== scope.organizationId) {
    errors.push(`Profile "${item.id}" belongs to another organization.`);
    return;
  }
  if (name === 'bulkAssignmentAudits' && item.organizationId !== scope.organizationId) {
    errors.push(`Bulk-assignment audit "${item.id}" belongs to another organization.`);
    return;
  }
  if (name === 'outbox') {
    if (item.organizationId !== scope.organizationId || item.userId !== scope.userId) {
      errors.push(`Outbox mutation "${item.id}" belongs to another synchronization context.`);
    }
    const payloadOrg = isPlainObject(item.payload) ? (item.payload.organizationId || item.payload.organization_id) : undefined;
    if (payloadOrg && payloadOrg !== scope.organizationId) errors.push(`Outbox mutation "${item.id}" contains a cross-organization payload.`);
    return;
  }
  if (name === 'syncState') {
    const expectedId = `${scope.organizationId}:${scope.userId}`;
    const wrongContext = item.id !== expectedId || item.organizationId !== scope.organizationId || item.userId !== scope.userId;
    if (wrongContext) errors.push(`Sync state "${item.id}" does not match the active synchronization context.`);
  }
}

function validateBackupTables(
  tables: Array<{ name: string; list: unknown[] }>,
  scope: AccessScope,
  errors: string[],
): Set<string> {
  const leadIds = new Set<string>();
  for (const { name, list } of tables) {
    const ids = new Set<string>();
    for (let index = 0; index < list.length; index++) {
      const item = list[index];
      if (!isPlainObject(item)) {
        errors.push(`Invalid record at ${name}[${index}]: Must be an object.`);
        continue;
      }
      validateRecordShape(name, item, index, errors);
      if (!item.id || typeof item.id !== 'string') {
        errors.push(`Missing or non-string "id" at ${name}[${index}].`);
        continue;
      }
      if (ids.has(item.id)) errors.push(`Duplicate ID "${item.id}" detected in table "${name}".`);
      ids.add(item.id);
      if (name === 'leads') leadIds.add(item.id);
      validateScopedBackupRecord(name, item, scope, errors);
    }
  }
  return leadIds;
}

function validateBackupForeignKeys(
  data: Record<string, unknown>,
  leadIds: Set<string>,
  errors: string[],
): void {
  const hasLeads = Array.isArray(data.leads) && data.leads.length > 0;
  if (!hasLeads) return;
  for (const childName of FK_BACKUP_COLLECTIONS) {
    const list = data[childName];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!isPlainObject(item) || typeof item.leadId !== 'string' || !item.leadId || leadIds.has(item.leadId)) continue;
      errors.push(`Orphan record in "${childName}" (ID: ${item.id}): Referenced leadId "${item.leadId}" not found in leads table.`);
    }
  }
}

function backupSummary(data: Record<string, unknown>, approxSizeBytes: number): BackupValidationResult['summary'] {
  const count = (name: string) => Array.isArray(data[name]) ? data[name].length : 0;
  const leadsCount = count('leads');
  const remarksCount = count('remarks');
  const callsCount = count('callHistory');
  const followUpsCount = count('followUps');
  const messagesCount = count('messageHistory');
  const templatesCount = count('messageTemplates');
  const usersCount = count('users');
  const activitiesCount = count('activities');
  const callRecordsCount = count('callRecords');
  const importAuditsCount = count('importAudits');
  return {
    leadsCount, remarksCount, callsCount, followUpsCount, messagesCount, templatesCount,
    usersCount, activitiesCount, callRecordsCount, importAuditsCount,
    totalRecords: leadsCount + remarksCount + callsCount + followUpsCount + messagesCount + templatesCount + usersCount + activitiesCount + callRecordsCount + importAuditsCount,
    approxSizeBytes,
  };
}

export class BackupService {
  constructor(private db: SalesCRMDatabase) {}

  /**
   * Rejects oversized restore files before FileReader/JSON.parse allocate their contents.
   * The supported restore-file limit is 25 MiB.
   */
  static validateRestoreFileSize(sizeBytes: number): string | null {
    if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
      return 'Backup file size is invalid.';
    }
    if (sizeBytes > MAX_BACKUP_RESTORE_FILE_BYTES) {
      return 'Backup file exceeds the supported 25 MB restore limit.';
    }
    return null;
  }

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
    const scope = this.db.requireAccessScope();
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

    const visibleLeads = leads.filter((lead) => canAccessLead(scope, lead));
    const visibleLeadIds = new Set(visibleLeads.map((lead) => lead.id));
    const visibleUsers = users.filter(
      (user) => user.organizationId === scope.organizationId && (scope.role === 'ADMIN' || user.id === scope.userId)
    );

    const payload: CRMBackupPayload = {
      schemaVersion: 6,
      appVersion: '2.0.0',
      exportedAt: new Date().toISOString(),
      databaseName: this.db.name,
      organizationId: scope.organizationId,
      userId: scope.userId,
      data: {
        leads: visibleLeads,
        remarks: remarks.filter((row) => visibleLeadIds.has(row.leadId)),
        callHistory: callHistory.filter((row) => visibleLeadIds.has(row.leadId)),
        followUps: followUps.filter((row) => visibleLeadIds.has(row.leadId)),
        messageHistory: messageHistory.filter((row) => visibleLeadIds.has(row.leadId)),
        messageTemplates,
        users: visibleUsers,
        activities: activities.filter(
          (row) => scope.role === 'ADMIN' || (row.userId === scope.userId && !!row.leadId && visibleLeadIds.has(row.leadId))
        ),
        callRecords: callRecords.filter((row) => visibleLeadIds.has(row.leadId)),
        importAudits: importAudits.filter((row) => scope.role === 'ADMIN' || row.uploadedBy === scope.userId),
        outbox: outbox.filter(
          (row) => row.organizationId === scope.organizationId && row.userId === scope.userId
        ),
        bulkAssignmentAudits: scope.role === 'ADMIN'
          ? bulkAssignmentAudits.filter((row) => row.organizationId === scope.organizationId)
          : [],
        syncState: syncState.filter(
          (row) => row.organizationId === scope.organizationId && row.userId === scope.userId
        ),
      },
    };

    // Pre-export validation
    const validation = this.validateBackupPayload(payload, false);
    if (!validation.isValid) {
      throw new Error(`Database integrity error before export:\n${validation.errors.join('\n')}`);
    }

    return payload;
  }

  /**
   * Validates a parsed or generated backup payload for schema structure, UUIDs, and reference consistency.
   * Supports backward compatibility with Schema Version 2.
   */
  validateBackupPayload(payload: unknown, calculateSize = true): BackupValidationResult {
    const errors: string[] = [];
    const scope = this.db.requireAccessScope();
    if (!isPlainObject(payload)) return invalidBackup(['Invalid backup: Payload must be a valid JSON object.']);

    validateBackupHeader(payload, scope, errors);
    if (!isPlainObject(payload.data)) {
      errors.push('Missing "data" container object in backup payload.');
      return invalidBackup(errors);
    }

    const data = payload.data;
    if (!validateBackupCollections(data, errors)) {
      const size = calculateSize ? JSON.stringify(payload).length : 0;
      return invalidBackup(errors, size);
    }

    const tables = backupTables(data);
    const leadIds = validateBackupTables(tables, scope, errors);
    validateBackupForeignKeys(data, leadIds, errors);
    const approxSizeBytes = calculateSize ? JSON.stringify(payload).length : 0;

    return {
      isValid: errors.length === 0,
      errors,
      summary: backupSummary(data, approxSizeBytes),
      payload: errors.length === 0 ? (payload as unknown as CRMBackupPayload) : undefined,
    };
  }

  /**
   * Validates raw JSON string content from a file upload.
   */
  validateBackupJson(jsonString: string): BackupValidationResult {
    try {
      const parsed = JSON.parse(jsonString);
      return this.validateBackupPayload(parsed);
    } catch (err: unknown) {
      return {
        isValid: false,
        errors: [`JSON Syntax Error: ${err instanceof Error ? err.message : String(err)}`],
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
        outbox: { added: 0, updated: 0, skipped: 0 },
        syncState: { added: 0, updated: 0, skipped: 0 },
        bulkAssignmentAudits: { added: 0, updated: 0, skipped: 0 },
      },
    };

    await this.db.transaction('rw', this.db.tables, async () => {
      const mergeTable = async <T extends { id: string; updatedAt?: string; createdAt?: string }>(
        tableName: keyof CRMBackupData,
        incoming: T[] | undefined,
        detailObj: { added: number; updated: number; skipped: number }
      ) => {
        if (!incoming || incoming.length === 0) return;
        // Resolve through the database's named properties so the concrete
        // Dexie table instance (and its hooks/test seams) is preserved while
        // keeping the generic merge loop free of `any`.
        const table = (this.db[tableName as keyof SalesCRMDatabase] as unknown) as Table<T, string> | undefined;
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
      // Profiles contain authorization state (role/status/organization). They
      // are validated for diagnostics but never restored from untrusted input.
      if (payload.data.activities) await mergeTable('activities', payload.data.activities, result.details.activities!);
      if (payload.data.callRecords) await mergeTable('callRecords', payload.data.callRecords, result.details.callRecords!);
      if (payload.data.importAudits) await mergeTable('importAudits', payload.data.importAudits, result.details.importAudits!);
      // Push sync is purely outbox-driven, so unsynced mutations only survive a
      // restore if the outbox is merged too (mirrors replaceRestore behaviour).
      if (payload.data.outbox) await mergeTable('outbox', payload.data.outbox, result.details.outbox!);
      if (payload.data.bulkAssignmentAudits)
        await mergeTable('bulkAssignmentAudits', payload.data.bulkAssignmentAudits, result.details.bulkAssignmentAudits!);

      // Sync cursor: adopt the backup's state on a fresh device, but never
      // regress a strictly-newer local cursor (that would only cause harmless
      // re-fetching, yet keeping the newer cursor is cheaper and correct).
      if (payload.data.syncState && payload.data.syncState.length > 0) {
        for (const incoming of payload.data.syncState) {
          const local = await this.db.syncState.get(incoming.id);
          if (!local) {
            await this.db.syncState.put(incoming);
            result.details.syncState!.added++;
            result.added++;
          } else {
            const localTs = new Date(local.lastSuccessfulSyncAt || 0).getTime();
            const incomingTs = new Date(incoming.lastSuccessfulSyncAt || 0).getTime();
            if (incomingTs >= localTs) {
              await this.db.syncState.put(incoming);
              result.details.syncState!.updated++;
              result.updated++;
            } else {
              result.details.syncState!.skipped++;
              result.skipped++;
              result.conflicts++;
            }
          }
        }
      }
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
        await Promise.all(this.db.tables.filter((t) => t.name !== 'users').map((t) => t.clear()));

        // Insert backup tables
        if (payload.data.leads && payload.data.leads.length > 0) await this.db.leads.bulkAdd(payload.data.leads);
        if (payload.data.remarks && payload.data.remarks.length > 0) await this.db.remarks.bulkAdd(payload.data.remarks);
        if (payload.data.callHistory && payload.data.callHistory.length > 0) await this.db.callHistory.bulkAdd(payload.data.callHistory);
        if (payload.data.followUps && payload.data.followUps.length > 0) await this.db.followUps.bulkAdd(payload.data.followUps);
        if (payload.data.messageHistory && payload.data.messageHistory.length > 0) await this.db.messageHistory.bulkAdd(payload.data.messageHistory);
        if (payload.data.messageTemplates && payload.data.messageTemplates.length > 0) await this.db.messageTemplates.bulkAdd(payload.data.messageTemplates);
        // Keep locally cached profiles; authenticated server state remains authoritative.
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
    } catch (err: unknown) {
      // 2. Rollback to safety snapshot in case of transaction failure
      console.error('Replace restore failed! Attempting safety rollback...', err);
      try {
        await this.db.transaction('rw', this.db.tables, async () => {
          await Promise.all(this.db.tables.filter((t) => t.name !== 'users').map((t) => t.clear()));
          if (safetySnapshot.data.leads.length > 0) await this.db.leads.bulkAdd(safetySnapshot.data.leads);
          if (safetySnapshot.data.remarks.length > 0) await this.db.remarks.bulkAdd(safetySnapshot.data.remarks);
          if (safetySnapshot.data.callHistory.length > 0) await this.db.callHistory.bulkAdd(safetySnapshot.data.callHistory);
          if (safetySnapshot.data.followUps.length > 0) await this.db.followUps.bulkAdd(safetySnapshot.data.followUps);
          if (safetySnapshot.data.messageHistory.length > 0) await this.db.messageHistory.bulkAdd(safetySnapshot.data.messageHistory);
          if (safetySnapshot.data.messageTemplates.length > 0) await this.db.messageTemplates.bulkAdd(safetySnapshot.data.messageTemplates);
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
        summaryText: `Error: ${err instanceof Error ? err.message : String(err)}. Safety snapshot restored.`,
      });

      throw new Error(`Database replacement failed: ${err instanceof Error ? err.message : String(err)}. Previous database state was restored.`);
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
      localStorage.setItem(this.getAuditStorageKey(), JSON.stringify(trimmed));
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }

  /**
   * Retrieves recent audit logs from local storage.
   */
  getAuditLogs(): BackupAuditLog[] {
    try {
      const raw = localStorage.getItem(this.getAuditStorageKey());
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private getAuditStorageKey(): string {
    const scope = this.db.requireAccessScope();
    return `${BACKUP_HISTORY_STORAGE_KEY}:${scope.organizationId}:${scope.userId}`;
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
    // Keep the object URL alive until the browser has had a chance to begin
    // consuming the download. Immediate revocation can race the download
    // handoff in Chromium/WebView and cause the export to disappear silently.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
