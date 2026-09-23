import type { SupabaseClient } from '@supabase/supabase-js';
import type { SalesCRMDatabase } from '../../db/database';
import { canAccessLead, type AccessScope } from '../../db/accessScope';
import { pruneLeadData } from '../../db/pruning';
import { applyPulledRemoteRecord } from './syncPullApply';
import { serverRevision, type SyncConflict, type SyncEntityType, type SyncRunGuard } from './syncTypes';

const LEAD_HISTORY_ENTITIES: readonly SyncEntityType[] = [
  'call_records',
  'activities',
  'remarks',
  'follow_ups',
  'message_history',
];

async function backfillHistoryEntity(
  client: SupabaseClient,
  db: SalesCRMDatabase,
  scope: AccessScope,
  leadId: string,
  entityType: SyncEntityType,
  allConflicts: SyncConflict[],
  guard?: SyncRunGuard,
): Promise<number> {
  let appliedCount = 0;
  let from = 0;
  const pageSize = 500;

  while (true) {
    guard?.();
    const { data, error } = await client.from(entityType).select('*')
      .eq('organization_id', scope.organizationId)
      .eq('lead_id', leadId)
      .order('sync_revision', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    guard?.();

    if (error) throw new Error(`Failed to backfill ${entityType}: ${error.message}`);
    const rows = data || [];
    for (const row of rows) {
      if (row.organization_id !== scope.organizationId || serverRevision(row) === undefined) {
        throw new Error('Invalid lead-history backfill row.');
      }
      if (await applyPulledRemoteRecord(db, scope, entityType, row, allConflicts, guard)) {
        appliedCount++;
      }
    }

    if (rows.length < pageSize) return appliedCount;
    from += pageSize;
  }
}

export async function backfillPulledLeadHistory(
  client: SupabaseClient,
  db: SalesCRMDatabase,
  scope: AccessScope,
  leadIds: Set<string>,
  allConflicts: SyncConflict[],
  guard?: SyncRunGuard,
): Promise<number> {
  let appliedCount = 0;
  for (const leadId of leadIds) {
    for (const entityType of LEAD_HISTORY_ENTITIES) {
      appliedCount += await backfillHistoryEntity(
        client,
        db,
        scope,
        leadId,
        entityType,
        allConflicts,
        guard,
      );
    }
  }
  return appliedCount;
}

export async function collectPulledVisibleLeadIds(
  client: SupabaseClient,
  scope: AccessScope,
  guard?: SyncRunGuard,
): Promise<Set<string>> {
  const visibleIds = new Set<string>();
  const pageSize = 1000;
  let from = 0;

  while (true) {
    guard?.();
    let query = client.from('leads')
      .select('id, organization_id')
      .eq('organization_id', scope.organizationId);
    if (scope.role === 'AGENT') {
      query = query.or(`assigned_to.eq.${scope.userId},created_by.eq.${scope.userId}`);
    }

    const { data, error } = await query.range(from, from + pageSize - 1);
    guard?.();
    if (error) throw new Error(`Failed to verify lead visibility: ${error.message}`);

    const rows = data || [];
    for (const row of rows) {
      if (row.id && row.organization_id === scope.organizationId) visibleIds.add(row.id);
    }
    if (rows.length < pageSize) return visibleIds;
    from += pageSize;
  }
}

export async function pruneInvisiblePulledLeads(
  db: SalesCRMDatabase,
  scope: AccessScope,
  visibleIds: Set<string>,
): Promise<void> {
  const outbox = await db.outbox.toArray();
  const unsyncedCreates = new Set(
    outbox
      .filter(item =>
        item.organizationId === scope.organizationId &&
        item.userId === scope.userId &&
        item.entityType === 'leads' &&
        item.operation === 'CREATE' &&
        item.status !== 'SYNCED'
      )
      .map(item => item.entityId),
  );

  const localLeads = await db.leads.toArray();
  const missingIds = localLeads
    .filter(lead =>
      (scope.role === 'ADMIN' || canAccessLead(scope, lead)) &&
      !visibleIds.has(lead.id) &&
      !unsyncedCreates.has(lead.id)
    )
    .map(lead => lead.id);

  await pruneLeadData(db, missingIds, scope, scope.role === 'ADMIN');
}
