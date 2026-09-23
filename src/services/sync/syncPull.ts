import { type RemoteSyncRecord, type SyncRecord, type SyncEntityMap } from './syncRecords';
/**
 * Sync Pull Engine (Phase 2F)
 * Pulls incremental changes from Supabase PostgreSQL since the last cursor
 * and reconciles them into local Dexie using deterministic conflict resolution.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../supabaseClient';
import type { SalesCRMDatabase } from '../../db/database';
import { db as defaultDb } from '../../db/database';
import type { AccessScope } from '../../db/accessScope';
import type { SyncEntityType, SyncConflict} from './syncTypes';
import { revisionCursor, serverRevision, type SyncRunGuard } from './syncTypes';
import { applyPulledRemoteRecord } from './syncPullApply';
import { backfillPulledLeadHistory, collectPulledVisibleLeadIds, pruneInvisiblePulledLeads } from './syncPullReconciliation';
import { fetchPullEntityPage, resolvePullRevisionHead, validatePullRevisionPage } from './syncPullTransport';
import { transformFromPgRecord } from './syncRecordTransforms';

const SYNC_ENTITIES: readonly SyncEntityType[] = ['leads', 'call_records', 'activities', 'remarks', 'follow_ups', 'message_history', 'import_audits', 'profiles', 'bulk_assignment_audits'];

export class SyncPull {
  private database?: SalesCRMDatabase;

  constructor(database?: SalesCRMDatabase) {
    this.database = database;
  }

  private getDatabase(): SalesCRMDatabase {
    return this.database || defaultDb;
  }

  /** Transforms PostgreSQL snake_case rows to local Dexie camelCase format. */
  static transformFromPgRecord<T extends SyncEntityType>(entityType: T, row: Record<string, unknown>): SyncEntityMap[T] & SyncRecord;
  static transformFromPgRecord(entityType: SyncEntityType, input: Record<string, unknown>): SyncRecord {
    return transformFromPgRecord(entityType, input);
  }

  /** Page one entity inside a committed, organization-wide revision window. */
  async pullEntityChanges(
    client: SupabaseClient,
    entityType: SyncEntityType,
    sinceCursor: string | null,
    guard?: SyncRunGuard,
    untilRevision?: number,
  ): Promise<{ records: RemoteSyncRecord[]; newestTimestamp: string | null }> {
    const scope = this.getDatabase().requireAccessScope();
    const { lower, head } = await resolvePullRevisionHead(client, sinceCursor, untilRevision);
    const records: RemoteSyncRecord[] = [];
    let afterRevision: number | undefined;
    let afterId: string | undefined;

    while (true) {
      guard?.();
      const rows = await fetchPullEntityPage(client, scope, entityType, lower, head, afterRevision, afterId);
      guard?.();
      validatePullRevisionPage(rows, scope.organizationId, lower, head);
      records.push(...rows);
      if (rows.length < 500) break;
      const last = rows[rows.length - 1];
      if (afterRevision === last.sync_revision && afterId === last.id) throw new Error('Sync page made no progress.');
      afterRevision = serverRevision(last);
      afterId = last.id;
    }
    return { records, newestTimestamp: revisionCursor(head) };
  }

  private async pullCoreEntities(
    client: SupabaseClient,
    db: SalesCRMDatabase,
    scope: AccessScope,
    sinceCursor: string | null,
    head: number,
    allConflicts: SyncConflict[],
    guard?: SyncRunGuard,
  ): Promise<{ totalPulled: number; historyLeadIds: Set<string> }> {
    let totalPulled = 0;
    const historyLeadIds = new Set<string>();
    for (const entityType of SYNC_ENTITIES) {
      guard?.();
      const { records } = await this.pullEntityChanges(client, entityType, sinceCursor, guard, head);
      for (const row of records) {
        const applied = await applyPulledRemoteRecord(db, scope, entityType, row, allConflicts, guard);
        if (applied) totalPulled++;
        if (scope.role === 'AGENT' && applied && entityType === 'leads' && sinceCursor !== null) historyLeadIds.add(row.id);
      }
    }
    return { totalPulled, historyLeadIds };
  }

  /**
   * Executes pull sync across all entities and reconciles into local Dexie.
   */
  async pullAllChanges(
    sinceCursor: string | null,
    client: SupabaseClient | null = getSupabaseClient(),
    guard?: SyncRunGuard,
  ): Promise<{ pulledCount: number; conflicts: SyncConflict[]; newCursor: string | null }> {
    if (!client) throw new Error('Supabase client is not initialized.');
    const db = this.getDatabase();
    const scope = db.requireAccessScope();
    const allConflicts: SyncConflict[] = [];
    const { lower, head } = await resolvePullRevisionHead(client, sinceCursor);
    guard?.();
    if (head < lower) throw new Error('Invalid server revision head.');

    const core = await this.pullCoreEntities(client, db, scope, sinceCursor, head, allConflicts, guard);
    const backfilled = await backfillPulledLeadHistory(client, db, scope, core.historyLeadIds, allConflicts, guard);
    const visibleIds = await collectPulledVisibleLeadIds(client, scope, guard);
    await pruneInvisiblePulledLeads(db, scope, visibleIds);

    return {
      pulledCount: core.totalPulled + backfilled,
      conflicts: allConflicts,
      newCursor: revisionCursor(head),
    };
  }}
