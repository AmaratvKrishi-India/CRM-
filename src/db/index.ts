/**
 * Amaratv Krishi CRM Data Layer - Public Entry Point
 */

import { db, SalesCRMDatabase } from './database';
import { LeadRepository } from './repositories/leadRepository';
import { RemarkRepository } from './repositories/remarkRepository';
import { CallHistoryRepository } from './repositories/callHistoryRepository';
import { FollowUpRepository } from './repositories/followUpRepository';
import { MessageHistoryRepository } from './repositories/messageHistoryRepository';
import { MessageTemplateRepository } from './repositories/messageTemplateRepository';
import { UserRepository } from './repositories/userRepository';
import { ActivityRepository } from './repositories/activityRepository';
import { CallRecordRepository } from './repositories/callRecordRepository';
import { ImportAuditRepository } from './repositories/importAuditRepository';
import { BulkAssignmentAuditRepository } from './repositories/bulkAssignmentAuditRepository';
import { SyncHelper } from './services/syncHelper';
import { DashboardService } from '../services/dashboardService';
import { BackupService } from '../services/backupService';
import { DeviceService } from '../services/deviceService';

import { SyncQueue } from '../services/sync/syncQueue';
import { SyncPush } from '../services/sync/syncPush';
import { SyncPull } from '../services/sync/syncPull';
import { SyncConflictResolver } from '../services/sync/syncConflictResolver';
import { SyncStateRepository } from '../services/sync/syncStateRepository';
import { SyncEngine } from '../services/sync/syncEngine';

export * from './types';
export * from './database';
export * from './services/leadNormalizer';
export * from './services/syncHelper';
export * from './seeds/defaultTemplates';
export * from './repositories/leadRepository';
export * from './repositories/remarkRepository';
export * from './repositories/callHistoryRepository';
export * from './repositories/followUpRepository';
export * from './repositories/messageHistoryRepository';
export * from './repositories/messageTemplateRepository';
export * from './repositories/userRepository';
export * from './repositories/activityRepository';
export * from './repositories/callRecordRepository';
export * from './repositories/importAuditRepository';
export * from './repositories/bulkAssignmentAuditRepository';
export * from '../services/dashboardService';
export * from '../services/backupService';
export * from '../services/deviceService';
export * from '../services/sync/syncTypes';
export * from '../services/sync/syncQueue';
export * from '../services/sync/syncPush';
export * from '../services/sync/syncPull';
export * from '../services/sync/syncConflictResolver';
export * from '../services/sync/syncStateRepository';
export * from '../services/sync/syncEngine';

/**
 * CRM Data Services Factory
 */
export function createCRMDataLayer(customDb: SalesCRMDatabase = db) {
  const syncQueue = new SyncQueue(customDb);
  const syncStateRepo = new SyncStateRepository(customDb);
  const syncPush = new SyncPush(syncQueue);
  const syncPull = new SyncPull(customDb);
  const syncEngine = new SyncEngine(syncQueue, syncPush, syncPull, syncStateRepo);

  return {
    db: customDb,
    leads: new LeadRepository(customDb),
    remarks: new RemarkRepository(customDb),
    callHistory: new CallHistoryRepository(customDb),
    followUps: new FollowUpRepository(customDb),
    messages: new MessageHistoryRepository(customDb),
    templates: new MessageTemplateRepository(customDb),
    users: new UserRepository(customDb),
    activities: new ActivityRepository(customDb),
    callRecords: new CallRecordRepository(customDb),
    importAudits: new ImportAuditRepository(customDb),
    bulkAssignmentAudits: new BulkAssignmentAuditRepository(customDb),
    sync: new SyncHelper(customDb),
    syncEngine,
    syncQueue,
    syncPush,
    syncPull,
    syncStateRepo,
    dashboard: new DashboardService(customDb),
    backup: new BackupService(customDb),
    device: DeviceService,
  };
}

export const crmData = createCRMDataLayer(db);

