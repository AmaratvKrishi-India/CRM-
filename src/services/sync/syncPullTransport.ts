import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccessScope } from '../../db/accessScope';
import { remoteSyncRecord, type RemoteSyncRecord } from './syncRecords';
import type { SyncEntityType } from './syncTypes';
import { parseRevisionCursor, serverRevision } from './syncTypes';

export async function resolvePullRevisionHead(
  client: SupabaseClient,
  sinceCursor: string | null,
  untilRevision?: number,
): Promise<{ lower: number; head: number }> {
  const lower = parseRevisionCursor(sinceCursor);
  if (untilRevision !== undefined) {
    if (!Number.isSafeInteger(untilRevision) || untilRevision < lower) {
      throw new Error('Invalid server revision head; cursor retained.');
    }
    return { lower, head: untilRevision };
  }

  const { data, error } = await client.rpc('sync_head');
  if (error) throw new Error(error.message);
  if (!Number.isSafeInteger(data) || data < lower) {
    throw new Error('Invalid server revision head; cursor retained.');
  }
  return { lower, head: data };
}

export async function fetchPullEntityPage(
  client: SupabaseClient,
  scope: AccessScope,
  entityType: SyncEntityType,
  lower: number,
  head: number,
  afterRevision?: number,
  afterId?: string,
): Promise<RemoteSyncRecord[]> {
  let query = client.from(entityType).select('*')
    .eq('organization_id', scope.organizationId)
    .gte('sync_revision', lower)
    .lte('sync_revision', head)
    .order('sync_revision', { ascending: true })
    .order('id', { ascending: true })
    .limit(500);

  if (afterRevision !== undefined && afterId) {
    query = query.or(`sync_revision.gt.${afterRevision},and(sync_revision.eq.${afterRevision},id.gt."${afterId}")`);
  }

  if (scope.role === 'AGENT') {
    if (entityType === 'leads') {
      query = query.or(`assigned_to.eq.${scope.userId},created_by.eq.${scope.userId}`);
    }
    if (entityType === 'profiles') query = query.eq('id', scope.userId);
    if (entityType === 'import_audits') query = query.eq('uploaded_by', scope.userId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to pull ${entityType}: ${error.message}`);
  return (data || []).map(remoteSyncRecord);
}

export function validatePullRevisionPage(
  rows: RemoteSyncRecord[],
  organizationId: string,
  lower: number,
  head: number,
): void {
  for (const row of rows) {
    const revision = serverRevision(row);
    const outsideWindow = revision === undefined || revision < lower || revision > head;
    if (outsideWindow || row.organization_id !== organizationId) {
      throw new Error('Invalid revision-window row.');
    }
  }
}
