import type { SalesCRMDatabase } from '../../db/database';
import { canAccessLead, type AccessScope } from '../../db/accessScope';
import { pruneLeadData } from '../../db/pruning';
import type { Lead } from '../../db/types';
import { SyncConflictResolver } from './syncConflictResolver';
import { syncTable, type SyncRecord } from './syncRecords';
import { transformFromPgRecord } from './syncRecordTransforms';
import type { SyncConflict, SyncEntityType, SyncRunGuard } from './syncTypes';

async function isAuthorizedPulledRecord(
  db: SalesCRMDatabase,
  scope: AccessScope,
  entityType: SyncEntityType,
  row: Record<string, unknown>,
  transformed: SyncRecord,
): Promise<boolean> {
  if (row.organization_id !== scope.organizationId) return false;
  if (scope.role === 'ADMIN') return true;

  if (entityType === 'leads') return canAccessLead(scope, transformed as unknown as Lead);
  if (entityType === 'profiles') return transformed.id === scope.userId;
  if (entityType === 'import_audits') return transformed.uploadedBy === scope.userId;
  if (entityType === 'bulk_assignment_audits') return false;

  const leadId = transformed.leadId;
  if (typeof leadId === 'string') {
    const lead = await db.leads.get(leadId);
    return !!lead && canAccessLead(scope, lead);
  }
  return entityType === 'activities' && transformed.userId === scope.userId;
}

export async function applyPulledRemoteRecord(
  db: SalesCRMDatabase,
  scope: AccessScope,
  entityType: SyncEntityType,
  row: Record<string, unknown>,
  allConflicts: SyncConflict[],
  guard?: SyncRunGuard,
): Promise<boolean> {
  const table = syncTable(db, entityType);
  let applied = false;

  await db.transaction('rw', db.tables, async () => {
    guard?.();
    db.markRemoteSyncWrites();

    const transformed = transformFromPgRecord(entityType, row);
    const existingLocal = await table.get(transformed.id);
    const authorized = await isAuthorizedPulledRecord(db, scope, entityType, row, transformed);

    if (!authorized) {
      if (entityType === 'leads' && existingLocal) {
        await pruneLeadData(db, [transformed.id], scope);
      } else if (existingLocal) {
        await table.delete(transformed.id);
      }
      return;
    }

    applied = true;
    if (entityType === 'call_records') {
      const result = SyncConflictResolver.resolveCallRecord(existingLocal, transformed);
      if (result.winner === 'REMOTE') await table.put(result.data);
      if (result.conflict) allConflicts.push(result.conflict);
      return;
    }

    if (['activities', 'message_history', 'import_audits', 'bulk_assignment_audits'].includes(entityType)) {
      const result = SyncConflictResolver.resolveAppendOnly(existingLocal, transformed);
      if (result.winner === 'REMOTE') await table.put(result.data);
      return;
    }

    const result = SyncConflictResolver.resolveMutable(entityType, existingLocal, transformed);
    if (result.winner === 'REMOTE') await table.put(result.data);
    if (result.conflict) allConflicts.push(result.conflict);
  });

  return applied;
}
