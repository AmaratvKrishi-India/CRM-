/**
 * Sync Pull Engine (Phase 2F)
 * Pulls incremental changes from Supabase PostgreSQL since the last cursor
 * and reconciles them into local Dexie using deterministic conflict resolution.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../supabaseClient';
import { db as defaultDb, SalesCRMDatabase } from '../../db/database';
import { SyncConflictResolver } from './syncConflictResolver';
import { SyncEntityType, SyncConflict } from './syncTypes';

export class SyncPull {
  private database?: SalesCRMDatabase;

  constructor(database?: SalesCRMDatabase) {
    this.database = database;
  }

  private getDatabase(): SalesCRMDatabase {
    return this.database || defaultDb;
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
    };

    switch (entityType) {
      case 'leads':
        return {
          ...base,
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
          startedAt: row.started_at,
          answeredAt: row.answered_at || null,
          endedAt: row.ended_at || null,
          durationSeconds: Number(row.duration_seconds || 0),
          outcome: row.outcome || 'OTHER',
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
        };

      case 'profiles':
        return {
          ...base,
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
        };

      default:
        return row;
    }
  }

  /**
   * Pulls incremental records for an entity table since cursor.
   */
  async pullEntityChanges(
    client: SupabaseClient,
    entityType: SyncEntityType,
    sinceCursor: string | null
  ): Promise<{ records: any[]; newestTimestamp: string | null }> {
    let query = client.from(entityType).select('*').order('updated_at', { ascending: true });

    if (sinceCursor) {
      query = query.gt('updated_at', sinceCursor);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to pull ${entityType}: ${error.message}`);
    }

    const rows = data || [];
    let newestTimestamp: string | null = null;

    if (rows.length > 0) {
      const lastRow = rows[rows.length - 1];
      newestTimestamp = lastRow.updated_at || lastRow.created_at || null;
    }

    return { records: rows, newestTimestamp };
  }

  /**
   * Executes pull sync across all entities and reconciles into local Dexie.
   */
  async pullAllChanges(
    sinceCursor: string | null,
    client: SupabaseClient | null = getSupabaseClient()
  ): Promise<{
    pulledCount: number;
    conflicts: SyncConflict[];
    newCursor: string | null;
  }> {
    if (!client) {
      throw new Error('Supabase client is not initialized.');
    }

    const db = this.getDatabase();
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
    let maxCursor: string | null = sinceCursor;

    for (const entityType of entities) {
      const { records, newestTimestamp } = await this.pullEntityChanges(client, entityType, sinceCursor);
      if (records.length === 0) continue;

      totalPulled += records.length;
      if (newestTimestamp && (!maxCursor || new Date(newestTimestamp).getTime() > new Date(maxCursor).getTime())) {
        maxCursor = newestTimestamp;
      }

      // Reconcile into Dexie
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

      const table = tableMap[entityType];
      if (!table) continue;

      for (const row of records) {
        const transformed = SyncPull.transformFromPgRecord(entityType, row);
        const existingLocal = await table.get(transformed.id);

        if (entityType === 'call_records') {
          const res = SyncConflictResolver.resolveCallRecord(existingLocal, transformed);
          if (res.winner === 'REMOTE') {
            await table.put(res.data);
          }
          if (res.conflict) {
            allConflicts.push(res.conflict);
          }
        } else if (['activities', 'message_history', 'import_audits', 'bulk_assignment_audits'].includes(entityType)) {
          const res = SyncConflictResolver.resolveAppendOnly(existingLocal, transformed);
          if (res.winner === 'REMOTE') {
            await table.put(res.data);
          }
        } else {
          const res = SyncConflictResolver.resolveMutable(entityType, existingLocal, transformed);
          if (res.winner === 'REMOTE') {
            await table.put(res.data);
          }
          if (res.conflict) {
            allConflicts.push(res.conflict);
          }
        }
      }
    }

    return {
      pulledCount: totalPulled,
      conflicts: allConflicts,
      newCursor: maxCursor,
    };
  }
}
