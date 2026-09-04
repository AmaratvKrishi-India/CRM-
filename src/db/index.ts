/**
 * Amaratv Krishi CRM Data Layer - Public Entry Point
 */

import type {
  SalesCRMDatabase} from './database';
import {
  db,
  activateDatabaseScope,
  lockDatabaseScope,
} from './database';
import type { AccessScope} from './accessScope';
import { canAccessLead, sameAccessScope } from './accessScope';
import { pruneLeadData } from './pruning';
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
import { DashboardService } from '../services/dashboardService';
import { BackupService } from '../services/backupService';
import { DeviceService } from '../services/deviceService';

import { SyncQueue } from '../services/sync/syncQueue';
import { SyncPush } from '../services/sync/syncPush';
import { SyncPull } from '../services/sync/syncPull';
import { SyncStateRepository } from '../services/sync/syncStateRepository';
import { SyncEngine } from '../services/sync/syncEngine';

export * from './types';
export * from './database';
export * from './accessScope';
export * from './pruning';
export * from './services/leadNormalizer';
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
  const syncPush = new SyncPush(syncQueue, customDb);
  const syncPull = new SyncPull(customDb);
  const syncEngine = new SyncEngine(syncQueue, syncPush, syncPull, syncStateRepo);

  return {
    db: customDb,
    leads: new LeadRepository(customDb, syncQueue),
    remarks: new RemarkRepository(customDb, syncQueue),
    callHistory: new CallHistoryRepository(customDb),
    followUps: new FollowUpRepository(customDb, syncQueue),
    messages: new MessageHistoryRepository(customDb, syncQueue),
    templates: new MessageTemplateRepository(customDb),
    users: new UserRepository(customDb, syncQueue),
    activities: new ActivityRepository(customDb, syncQueue),
    callRecords: new CallRecordRepository(customDb, syncQueue),
    importAudits: new ImportAuditRepository(customDb, syncQueue),
    bulkAssignmentAudits: new BulkAssignmentAuditRepository(customDb, syncQueue),
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

export let crmData = createCRMDataLayer(db);

/** Rebuild every repository/service against the verified account partition. */
export async function activateCRMDataScope(scope: AccessScope) {
  if (db.accessScope && sameAccessScope(db.accessScope, scope)) {
    if (!db.isOpen()) await db.open();
    await db.seedDefaults();
    await pruneInaccessibleLocalData(db, scope);
    return crmData;
  }

  crmData.syncEngine.dispose();
  const lockedDb = await lockDatabaseScope();
  crmData = createCRMDataLayer(lockedDb);
  const scopedDb = await activateDatabaseScope(scope);
  crmData.syncEngine.dispose();
  crmData = createCRMDataLayer(scopedDb);
  await scopedDb.seedDefaults();
  await pruneInaccessibleLocalData(scopedDb, scope);
  if (typeof window !== 'undefined' && typeof import.meta.env !== 'undefined' && import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__crmData = crmData;
  }
  return crmData;
}

/** Removes cached rows that the currently verified role can no longer read. */
export async function pruneInaccessibleLocalData(scopedDb: SalesCRMDatabase, scope: AccessScope): Promise<void> {
  scopedDb.requireAccessScope(scope);
  if (scope.role === 'ADMIN') return;

  const leads = await scopedDb.leads.toArray();
  const visibleLeadIds = new Set(leads.filter((lead) => canAccessLead(scope, lead)).map((lead) => lead.id));
  const hiddenLeadIds = leads.filter((lead) => !visibleLeadIds.has(lead.id)).map((lead) => lead.id);

  if (hiddenLeadIds.length > 0) {
    await pruneLeadData(scopedDb, hiddenLeadIds, scope);
  }

  await scopedDb.transaction('rw', scopedDb.tables, async () => {
    await Promise.all([
      scopedDb.activities
        .filter((row) => !row.leadId || !visibleLeadIds.has(row.leadId) || row.userId !== scope.userId)
        .delete(),
      scopedDb.users.filter((row) => row.id !== scope.userId || row.organizationId !== scope.organizationId).delete(),
      scopedDb.importAudits.filter((row) => row.uploadedBy !== scope.userId).delete(),
      scopedDb.bulkAssignmentAudits.clear(),
    ]);

    await scopedDb.outbox.filter((item) => {
      if (item.organizationId !== scope.organizationId || item.userId !== scope.userId) return true;
      if (item.entityType === 'profiles') return item.entityId !== scope.userId;
      return item.entityType === 'bulk_assignment_audits';
    }).delete();
  });
}

/** Remove all application references to the previous account's local cache. */
export async function lockCRMData() {
  crmData.syncEngine.dispose();
  const lockedDb = await lockDatabaseScope();
  crmData = createCRMDataLayer(lockedDb);
  if (typeof window !== 'undefined' && typeof import.meta.env !== 'undefined' && import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__crmData = crmData;
  }
  return crmData;
}

// Dev-only test seam: lets Playwright specs drive the data layer deterministically
// (e.g. gating in-flight queries to reproduce list races). Vite strips
// import.meta.env.DEV from production builds, so this never ships.
if (
  typeof window !== 'undefined' &&
  typeof import.meta.env !== 'undefined' &&
  import.meta.env.DEV
) {
  (window as unknown as Record<string, unknown>).__crmData = crmData;
}
