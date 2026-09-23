import type { Table } from 'dexie';
import type { SalesCRMDatabase } from '../../db/database';
import type { Activity, BulkAssignmentAudit, CallRecord, FollowUp, ImportAudit, Lead, MessageHistory, Remark, User } from '../../db/types';
import type { SyncEntityType } from './syncTypes';

export interface SyncEntityMap {
  leads: Lead;
  call_records: CallRecord;
  activities: Activity;
  remarks: Remark;
  follow_ups: FollowUp;
  message_history: MessageHistory;
  import_audits: ImportAudit;
  profiles: User;
  bulk_assignment_audits: BulkAssignmentAudit;
}

export type SyncRecord = { id: string; updatedAt?: string } & Record<string, unknown>;
export type RemoteSyncRecord = { id: string } & Record<string, unknown>;

const tableNames = {
  leads: 'leads', call_records: 'callRecords', activities: 'activities', remarks: 'remarks',
  follow_ups: 'followUps', message_history: 'messageHistory', import_audits: 'importAudits',
  profiles: 'users', bulk_assignment_audits: 'bulkAssignmentAudits',
} as const satisfies Record<SyncEntityType, keyof SalesCRMDatabase>;

export function isSyncEntityType(value: string): value is SyncEntityType {
  return Object.hasOwn(tableNames, value);
}

// The synchronization layer operates on the common record identity. Entity-specific
// readers retain their concrete Dexie types; remote values are checked at ingress.
export function syncTable(db: SalesCRMDatabase, entity: SyncEntityType): Table<SyncRecord, string> {
  return db.table<SyncRecord, string>(tableNames[entity]);
}

export function remoteSyncRecord(value: unknown): RemoteSyncRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      !('id' in value) || typeof value.id !== 'string' || !value.id) {
    throw new Error('Invalid sync record identity.');
  }
  return value as RemoteSyncRecord;
}
