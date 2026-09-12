import type { AccessScope } from './accessScope';
import type { SalesCRMDatabase } from './database';

/** Removes revoked leads, their local graph, and queued mutations that can no longer be authorized. */
export async function pruneLeadData(
  scopedDb: SalesCRMDatabase,
  leadIds: Iterable<string>,
  scope: AccessScope = scopedDb.requireAccessScope(),
  preserveMutations = false
): Promise<void> {
  scopedDb.requireAccessScope(scope);
  const revoked = new Set(leadIds);
  if (revoked.size === 0) return;

  await scopedDb.transaction('rw', scopedDb.tables, async () => {
    const ids = Array.from(revoked);
    await scopedDb.leads.bulkDelete(ids);
    await Promise.all([
      scopedDb.remarks.filter((row) => revoked.has(row.leadId)).delete(),
      scopedDb.callHistory.filter((row) => revoked.has(row.leadId)).delete(),
      scopedDb.followUps.filter((row) => revoked.has(row.leadId)).delete(),
      scopedDb.messageHistory.filter((row) => revoked.has(row.leadId)).delete(),
      scopedDb.callRecords.filter((row) => revoked.has(row.leadId)).delete(),
      scopedDb.activities.filter((row) => !!row.leadId && revoked.has(row.leadId)).delete(),
      (async () => {
        const mutations = scopedDb.outbox.filter((item) => {
        if (item.organizationId !== scope.organizationId || item.userId !== scope.userId) return false;
        if (item.entityType === 'leads') return revoked.has(item.entityId);
        const leadId = item.payload.leadId || item.payload.lead_id;
        return typeof leadId === 'string' && revoked.has(leadId);
        });
        if (preserveMutations) {
          await mutations.modify({ status: 'DEAD_LETTER', nextAttemptAt: null,
            lastError: 'SYNC_CONFLICT: authoritative deletion; local edit retained for review.' });
        } else await mutations.delete();
      })(),
    ]);
  });
}
