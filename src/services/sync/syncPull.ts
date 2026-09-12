/**
 * Sync Pull Engine (Phase 2F)
 * Pulls incremental changes from Supabase PostgreSQL since the last cursor
 * and reconciles them into local Dexie using deterministic conflict resolution.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../supabaseClient';
import type { SalesCRMDatabase } from '../../db/database';
import { db as defaultDb } from '../../db/database';
import { canAccessLead, type AccessScope } from '../../db/accessScope';
import { pruneLeadData } from '../../db/pruning';
import type { Lead } from '../../db/types';
import { SyncConflictResolver } from './syncConflictResolver';
import type { SyncEntityType, SyncConflict} from './syncTypes';
import { parseRevisionCursor, revisionCursor, serverRevision, type SyncRunGuard } from './syncTypes';

export class SyncPull {
  private database?: SalesCRMDatabase;

  constructor(database?: SalesCRMDatabase) {
    this.database = database;
  }

  private getDatabase(): SalesCRMDatabase {
    return this.database || defaultDb;
  }

  private async isAuthorizedRecord(
    scope: AccessScope,
    entityType: SyncEntityType,
    row: Record<string, any>,
    transformed: Record<string, any>
  ): Promise<boolean> {
    if (row.organization_id !== scope.organizationId) return false;
    if (scope.role === 'ADMIN') return true;

    if (entityType === 'leads') return canAccessLead(scope, transformed as Lead);
    if (entityType === 'profiles') return transformed.id === scope.userId;
    if (entityType === 'import_audits') return transformed.uploadedBy === scope.userId;
    if (entityType === 'bulk_assignment_audits') return false;

    const leadId = transformed.leadId;
    if (typeof leadId === 'string') {
      const lead = await this.getDatabase().leads.get(leadId);
      return !!lead && canAccessLead(scope, lead);
    }
    return entityType === 'activities' && transformed.userId === scope.userId;
  }

  private tableForEntity(db: SalesCRMDatabase, entityType: SyncEntityType): any {
    const tableMap: Record<SyncEntityType, any> = {
      leads: db.leads,
      call_records: db.callRecords,
      activities: db.activities,
      remarks: db.remarks,
      follow_ups: db.followUps,
      message_history: db.messageHistory,
      import_audits: db.importAudits,
      profiles: db.users,
      bulk_assignment_audits: db.bulkAssignmentAudits,
    };
    return tableMap[entityType];
  }

  private async applyRemoteRecord(
    db: SalesCRMDatabase,
    scope: AccessScope,
    entityType: SyncEntityType,
    row: Record<string, any>,
    allConflicts: SyncConflict[],
    guard?: SyncRunGuard,
  ): Promise<boolean> {
    const table = this.tableForEntity(db, entityType);
    let applied = false;
    await db.transaction('rw', db.tables, async () => {
      guard?.();
      db.markRemoteSyncWrites();
      const transformed = SyncPull.transformFromPgRecord(entityType, row);
      const existingLocal = await table.get(transformed.id);
      const authorized = await this.isAuthorizedRecord(scope, entityType, row, transformed);
      if (!authorized) {
        if (entityType === 'leads' && existingLocal) await pruneLeadData(db, [transformed.id], scope);
        else if (existingLocal) await table.delete(transformed.id);
        return;
      }
      applied = true;
      if (entityType === 'call_records') {
        const res = SyncConflictResolver.resolveCallRecord(existingLocal, transformed);
        if (res.winner === 'REMOTE') await table.put(res.data);
        if (res.conflict) allConflicts.push(res.conflict);
      } else if (['activities', 'message_history', 'import_audits', 'bulk_assignment_audits'].includes(entityType)) {
        const res = SyncConflictResolver.resolveAppendOnly(existingLocal, transformed);
        if (res.winner === 'REMOTE') await table.put(res.data);
      } else {
        const res = SyncConflictResolver.resolveMutable(entityType, existingLocal, transformed);
        if (res.winner === 'REMOTE') await table.put(res.data);
        if (res.conflict) allConflicts.push(res.conflict);
      }
    });
    return applied;
  }

  /**
   * Transforms PostgreSQL snake_case rows to local Dexie camelCase format.
   */
  static transformFromPgRecord(entityType: SyncEntityType, row: Record<string, any>): Record<string, any> {
    const base = {
      id: row.id,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
      deletedAt: row.deleted_at || null,
      isSynced: 1,
      serverRevision: serverRevision(row),
    };

    switch (entityType) {
      case 'leads':
        return {
          ...base,
          organizationId: row.organization_id || null,
          businessName: row.business_name || '',
          category: row.category || 'Gym',
          phone: row.phone || '',
          phoneRaw: row.phone_raw || row.phone,
          phoneE164: row.phone_e164 || row.phone,
          phoneType: row.phone_type || 'mobile',
          alternatePhone: row.alternate_phone || null,
          contactPerson: row.contact_person || null,
          address: row.address || '',
          locality: row.locality || '',
          pincode: row.pincode || null,
          city: row.city || 'Lucknow',
          state: row.state || 'Uttar Pradesh',
          website: row.website || null,
          rating: row.rating !== null ? Number(row.rating) : null,
          reviewCount: row.review_count !== null ? Number(row.review_count) : null,
          source: row.source || 'Field Sales',
          sourceFile: row.source_file || null,
          sourceRow: row.source_row !== null ? Number(row.source_row) : null,
          status: row.status || 'NEW',
          customNotes: row.custom_notes || '',
          lastContactedAt: row.last_contacted_at || null,
          nextFollowUpAt: row.next_follow_up_at || null,
          callCount: Number(row.call_count || 0),
          createdBy: row.created_by || null,
          assignedTo: row.assigned_to || null,
          updatedBy: row.updated_by || null,
        };

      case 'call_records':
        return {
          ...base,
          leadId: row.lead_id,
          userId: row.user_id || null,
          deviceId: row.device_id || null,
          dialAttemptId: row.dial_attempt_id ?? null,
          startedAt: row.started_at,
          answeredAt: row.answered_at || null,
          endedAt: row.ended_at || null,
          durationSeconds: Number(row.duration_seconds || 0),
          reportedDurationSeconds:
            row.reported_duration_seconds !== null && row.reported_duration_seconds !== undefined
              ? Number(row.reported_duration_seconds)
              : null,
          outcome: row.outcome || 'OTHER',
          callStatus: row.call_status || undefined,
          remark: row.remark || null,
          verificationStatus: row.verification_status || 'UNVERIFIED',
        };

      case 'activities':
        return {
          ...base,
          leadId: row.lead_id || null,
          userId: row.user_id || null,
          deviceId: row.device_id || null,
          activityType: row.activity_type,
          metadata: row.metadata || {},
        };

      case 'remarks':
        return {
          ...base,
          leadId: row.lead_id,
          userId: row.user_id || null,
          content: row.content || '',
          type: row.type || 'CUSTOM',
          author: row.author || 'Sales Rep',
        };

      case 'follow_ups':
        return {
          ...base,
          leadId: row.lead_id,
          userId: row.user_id || null,
          scheduledAt: row.scheduled_at,
          title: row.title || 'Follow-up',
          notes: row.notes || null,
          priority: row.priority || 'MEDIUM',
          status: row.status || 'PENDING',
          completedAt: row.completed_at || null,
          outcomeNotes: row.outcome_notes || null,
        };

      case 'message_history':
        return {
          ...base,
          leadId: row.lead_id,
          userId: row.user_id || null,
          templateId: row.template_id || null,
          channel: row.channel || 'WHATSAPP',
          recipientPhone: row.recipient_phone,
          messageContent: row.message_content,
          sentStatus: row.sent_status || 'SENT',
          sentAt: row.sent_at || base.createdAt,
        };

      case 'import_audits':
        return {
          id: row.id,
          uploadedBy: row.uploaded_by || null,
          deviceId: row.device_id || null,
          filename: row.filename || 'import.xlsx',
          source: row.source || 'Excel Import',
          startedAt: row.started_at,
          completedAt: row.completed_at || null,
          totalRows: Number(row.total_rows || 0),
          imported: Number(row.imported || 0),
          updated: Number(row.updated || 0),
          duplicates: Number(row.duplicates || 0),
          invalid: Number(row.invalid || 0),
          createdAt: base.createdAt,
          updatedAt: base.updatedAt,
          isSynced: 1,
          serverRevision: base.serverRevision,
        };

      case 'profiles':
        return {
          ...base,
          organizationId: row.organization_id || null,
          name: row.name || '',
          email: row.email || '',
          phone: row.phone || '',
          role: row.role || 'AGENT',
          status: row.status || 'ACTIVE',
          createdBy: row.created_by || null,
          lastLoginAt: row.last_login_at || null,
        };

      case 'bulk_assignment_audits':
        return {
          id: row.id,
          organizationId: row.organization_id || null,
          performedBy: row.performed_by,
          targetAgentId: row.target_agent_id,
          selectedLeadCount: Number(row.selected_lead_count || 0),
          successfulCount: Number(row.successful_count || 0),
          failedCount: Number(row.failed_count || 0),
          startedAt: row.started_at,
          completedAt: row.completed_at,
          filterSnapshot: row.filter_snapshot || {},
          status: row.status || 'COMPLETED',
          errorSummary: row.error_summary || null,
          createdAt: base.createdAt,
          updatedAt: base.updatedAt,
          isSynced: 1,
          serverRevision: base.serverRevision,
        };

      default:
        return row;
    }
  }

  /** Page one entity inside a committed, organization-wide revision window. */
  async pullEntityChanges(
    client: SupabaseClient, entityType: SyncEntityType, sinceCursor: string | null,
    guard?: SyncRunGuard, untilRevision?: number
  ): Promise<{ records: any[]; newestTimestamp: string | null }> {
    const scope = this.getDatabase().requireAccessScope();
    const lower = parseRevisionCursor(sinceCursor);
    const headResult = untilRevision === undefined ? await client.rpc('sync_head') : null;
    if (headResult?.error) throw new Error(headResult.error.message);
    const head = untilRevision ?? headResult?.data;
    if (!Number.isSafeInteger(head) || head < lower) throw new Error('Invalid server revision head; cursor retained.');
    const records: any[] = [];
    let afterRevision: number | undefined;
    let afterId: string | undefined;
    while (true) {
      guard?.();
      let query = client.from(entityType).select('*')
        .eq('organization_id', scope.organizationId)
        .gte('sync_revision', lower).lte('sync_revision', head)
        .order('sync_revision', { ascending: true }).order('id', { ascending: true }).limit(500);
      if (afterRevision !== undefined && afterId) {
        query = query.or(`sync_revision.gt.${afterRevision},and(sync_revision.eq.${afterRevision},id.gt."${afterId}")`);
      }
      if (scope.role === 'AGENT' && entityType === 'leads') {
        query = query.or(`assigned_to.eq.${scope.userId},created_by.eq.${scope.userId}`);
      } else if (scope.role === 'AGENT' && entityType === 'profiles') query = query.eq('id', scope.userId);
      else if (scope.role === 'AGENT' && entityType === 'import_audits') query = query.eq('uploaded_by', scope.userId);
      const { data, error } = await query;
      guard?.();
      if (error) throw new Error(`Failed to pull ${entityType}: ${error.message}`);
      const rows = data || [];
      for (const row of rows) {
        const revision = serverRevision(row);
        if (revision === undefined || revision < lower || revision > head ||
            row.organization_id !== scope.organizationId) throw new Error('Invalid revision-window row.');
        records.push(row);
      }
      if (rows.length < 500) break;
      const last = rows[rows.length - 1];
      if (afterRevision === last.sync_revision && afterId === last.id) throw new Error('Sync page made no progress.');
      afterRevision = last.sync_revision;
      afterId = last.id;
    }
    return { records, newestTimestamp: revisionCursor(head) };
  }

  /**
   * Executes pull sync across all entities and reconciles into local Dexie.
   */
  async pullAllChanges(
    sinceCursor: string | null,
    client: SupabaseClient | null = getSupabaseClient(),
    guard?: SyncRunGuard
  ): Promise<{
    pulledCount: number;
    conflicts: SyncConflict[];
    newCursor: string | null;
  }> {
    if (!client) {
      throw new Error('Supabase client is not initialized.');
    }

    const db = this.getDatabase();
    const scope = db.requireAccessScope();
    const entities: SyncEntityType[] = [
      'leads',
      'call_records',
      'activities',
      'remarks',
      'follow_ups',
      'message_history',
      'import_audits',
      'profiles',
      'bulk_assignment_audits',
    ];

    let totalPulled = 0;
    const allConflicts: SyncConflict[] = [];
    const { data: head, error: headError } = await client.rpc('sync_head');
    guard?.();
    if (headError) throw new Error(headError.message);
    if (!Number.isSafeInteger(head) || head < parseRevisionCursor(sinceCursor)) throw new Error('Invalid server revision head.');
    const maxCursor = revisionCursor(head);

    const newlyVisibleLeadIds = new Set<string>();
    for (const entityType of entities) {
      guard?.();
      const { records } = await this.pullEntityChanges(client, entityType, sinceCursor, guard, head);
      for (const row of records) {
        const wasMissing = entityType === 'leads' && !(await db.leads.get(row.id));
        const applied = await this.applyRemoteRecord(db, scope, entityType, row, allConflicts, guard);
        if (applied) totalPulled++;
        if (scope.role === 'AGENT' && applied && wasMissing && sinceCursor !== null) newlyVisibleLeadIds.add(row.id);
      }
    }

    // A newly assigned lead can have child history older than this device's
    // saved revision cursor. Backfill that lead's complete authorized history.
    const childEntities: SyncEntityType[] = ['call_records', 'activities', 'remarks', 'follow_ups', 'message_history'];
    for (const leadId of newlyVisibleLeadIds) {
      for (const entityType of childEntities) {
        let from = 0;
        const pageSize = 500;
        while (true) {
          guard?.();
          const { data, error } = await client.from(entityType).select('*')
            .eq('organization_id', scope.organizationId).eq('lead_id', leadId)
            .order('sync_revision', { ascending: true }).order('id', { ascending: true })
            .range(from, from + pageSize - 1);
          guard?.();
          if (error) throw new Error(`Failed to backfill ${entityType}: ${error.message}`);
          const rows = data || [];
          for (const row of rows) {
            if (row.organization_id !== scope.organizationId || serverRevision(row) === undefined) {
              throw new Error('Invalid lead-history backfill row.');
            }
            if (await this.applyRemoteRecord(db, scope, entityType, row, allConflicts, guard)) totalPulled++;
          }
          if (rows.length < pageSize) break;
          from += pageSize;
        }
      }
    }

    // Compare local leads with the complete server-visible identity set. This
    // catches both assignment revocation and hard deletes that happened offline.
    const visibleIds = new Set<string>();
    const pageSize = 1000;
    let from = 0;
    while (true) {
      guard?.();
      let query = client.from('leads').select('id, organization_id')
        .eq('organization_id', scope.organizationId);
      if (scope.role === 'AGENT') query = query.or(`assigned_to.eq.${scope.userId},created_by.eq.${scope.userId}`);
      const { data, error } = await query.range(from, from + pageSize - 1);
      guard?.();
      if (error) throw new Error(`Failed to verify lead visibility: ${error.message}`);
      const rows = data || [];
      for (const row of rows) if (row.id && row.organization_id === scope.organizationId) visibleIds.add(row.id);
      if (rows.length < pageSize) break;
      from += pageSize;
    }

    const unsyncedCreates = new Set((await db.outbox.toArray())
      .filter(item => item.organizationId === scope.organizationId && item.userId === scope.userId &&
        item.entityType === 'leads' && item.operation === 'CREATE' && item.status !== 'SYNCED')
      .map(item => item.entityId));
    const missingIds = (await db.leads.toArray())
      .filter(lead => (scope.role === 'ADMIN' || canAccessLead(scope, lead)) &&
        !visibleIds.has(lead.id) && !unsyncedCreates.has(lead.id))
      .map(lead => lead.id);
    await pruneLeadData(db, missingIds, scope, scope.role === 'ADMIN');

    return {
      pulledCount: totalPulled,
      conflicts: allConflicts,
      newCursor: maxCursor,
    };
  }
}
