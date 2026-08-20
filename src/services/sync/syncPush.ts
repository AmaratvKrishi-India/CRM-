/**
 * Sync Push Engine (Phase 2F)
 * Processes local outbox items in batches and pushes them to Supabase PostgreSQL.
 * Uses UUID idempotency via upsert and handles partial batch failures with exponential retries.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../supabaseClient';
import { SyncQueue } from './syncQueue';
import { OutboxItem, SyncEntityType } from './syncTypes';

export class SyncPush {
  constructor(private queue: SyncQueue = new SyncQueue()) {}

  /**
   * Transforms local camelCase payload into Supabase PostgreSQL snake_case columns.
   */
  static transformToPgRecord(entityType: SyncEntityType, payload: Record<string, any>, defaultOrgId: string | null = null): Record<string, any> {
    const orgId = payload.organizationId || payload.organization_id || defaultOrgId || '00000000-0000-0000-0000-000000000001';

    const base = {
      id: payload.id,
      organization_id: orgId,
      created_at: payload.createdAt || payload.created_at || new Date().toISOString(),
      updated_at: payload.updatedAt || payload.updated_at || new Date().toISOString(),
      deleted_at: payload.deletedAt !== undefined ? payload.deletedAt : (payload.deleted_at || null),
    };

    switch (entityType) {
      case 'leads':
        return {
          ...base,
          business_name: payload.businessName || payload.business_name || '',
          category: payload.category || 'Gym',
          phone: payload.phone || '',
          phone_raw: payload.phoneRaw || payload.phone_raw || null,
          phone_e164: payload.phoneE164 || payload.phone_e164 || null,
          phone_type: payload.phoneType || payload.phone_type || 'mobile',
          alternate_phone: payload.alternatePhone || payload.alternate_phone || null,
          contact_person: payload.contactPerson || payload.contact_person || null,
          address: payload.address || '',
          locality: payload.locality || '',
          pincode: payload.pincode || null,
          city: payload.city || 'Lucknow',
          state: payload.state || 'Uttar Pradesh',
          website: payload.website || null,
          rating: payload.rating || null,
          review_count: payload.reviewCount || payload.review_count || null,
          source: payload.source || 'Field Sales',
          source_file: payload.sourceFile || payload.source_file || null,
          source_row: payload.sourceRow || payload.source_row || null,
          status: payload.status || 'NEW',
          custom_notes: payload.customNotes || payload.custom_notes || '',
          last_contacted_at: payload.lastContactedAt || payload.last_contacted_at || null,
          next_follow_up_at: payload.nextFollowUpAt || payload.next_follow_up_at || null,
          call_count: payload.callCount || payload.call_count || 0,
          created_by: payload.createdBy || payload.created_by || null,
          assigned_to: payload.assignedTo || payload.assigned_to || null,
          updated_by: payload.updatedBy || payload.updated_by || null,
        };

      case 'call_records':
        return {
          ...base,
          lead_id: payload.leadId || payload.lead_id,
          user_id: payload.userId || payload.user_id || null,
          device_id: payload.deviceId || payload.device_id || null,
          started_at: payload.startedAt || payload.started_at,
          answered_at: payload.answeredAt || payload.answered_at || null,
          ended_at: payload.endedAt || payload.ended_at || null,
          duration_seconds: payload.durationSeconds || payload.duration_seconds || 0,
          outcome: payload.outcome || 'OTHER',
          remark: payload.remark || null,
          verification_status: payload.verificationStatus || payload.verification_status || 'UNVERIFIED',
        };

      case 'activities':
        return {
          ...base,
          lead_id: payload.leadId || payload.lead_id || null,
          user_id: payload.userId || payload.user_id || null,
          device_id: payload.deviceId || payload.device_id || null,
          activity_type: payload.activityType || payload.activity_type,
          metadata: payload.metadata || {},
        };

      case 'remarks':
        return {
          ...base,
          lead_id: payload.leadId || payload.lead_id,
          user_id: payload.userId || payload.user_id || null,
          content: payload.content || '',
          type: payload.type || 'CUSTOM',
          author: payload.author || 'Sales Rep',
        };

      case 'follow_ups':
        return {
          ...base,
          lead_id: payload.leadId || payload.lead_id,
          user_id: payload.userId || payload.user_id || null,
          scheduled_at: payload.scheduledAt || payload.scheduled_at,
          title: payload.title || 'Follow-up',
          notes: payload.notes || null,
          priority: payload.priority || 'MEDIUM',
          status: payload.status || 'PENDING',
          completed_at: payload.completedAt || payload.completed_at || null,
          outcome_notes: payload.outcomeNotes || payload.outcome_notes || null,
        };

      case 'message_history':
        return {
          ...base,
          lead_id: payload.leadId || payload.lead_id,
          user_id: payload.userId || payload.user_id || null,
          template_id: payload.templateId || payload.template_id || null,
          channel: payload.channel || 'WHATSAPP',
          recipient_phone: payload.recipientPhone || payload.recipient_phone,
          message_content: payload.messageContent || payload.message_content,
          sent_status: payload.sentStatus || payload.sent_status || 'SENT',
          sent_at: payload.sentAt || payload.sent_at || base.created_at,
        };

      case 'import_audits':
        return {
          id: payload.id,
          organization_id: orgId,
          uploaded_by: payload.uploadedBy || payload.uploaded_by || null,
          device_id: payload.deviceId || payload.device_id || null,
          filename: payload.filename || 'import.xlsx',
          source: payload.source || 'Excel Import',
          started_at: payload.startedAt || payload.started_at,
          completed_at: payload.completedAt || payload.completed_at || null,
          total_rows: payload.totalRows || payload.total_rows || 0,
          imported: payload.imported || 0,
          updated: payload.updated || 0,
          duplicates: payload.duplicates || 0,
          invalid: payload.invalid || 0,
          created_at: base.created_at,
          updated_at: base.updated_at,
        };

      case 'bulk_assignment_audits':
        return {
          ...base,
          performed_by: payload.performedBy || payload.performed_by,
          target_agent_id: payload.targetAgentId || payload.target_agent_id,
          selected_lead_count: payload.selectedLeadCount || payload.selected_lead_count || 0,
          successful_count: payload.successfulCount || payload.successful_count || 0,
          failed_count: payload.failedCount || payload.failed_count || 0,
          started_at: payload.startedAt || payload.started_at,
          completed_at: payload.completedAt || payload.completed_at,
          filter_snapshot: payload.filterSnapshot || payload.filter_snapshot || {},
          status: payload.status || 'COMPLETED',
          error_summary: payload.errorSummary || payload.error_summary || null,
        };

      default:
        return { ...payload, organization_id: orgId };
    }
  }

  /**
   * Pushes all pending outbox mutations to Supabase.
   */
  async pushPending(client: SupabaseClient | null = getSupabaseClient()): Promise<{
    pushedCount: number;
    failedCount: number;
    errors: string[];
  }> {
    if (!client) {
      throw new Error('Supabase client is not initialized or configured.');
    }

    const items = await this.queue.getPendingItems(50);
    if (items.length === 0) {
      return { pushedCount: 0, failedCount: 0, errors: [] };
    }

    const itemIds = items.map((i) => i.id);
    await this.queue.markSyncing(itemIds);

    let pushedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // Group items by entityType for efficient batch upserts
    const byEntity: Record<SyncEntityType, OutboxItem[]> = {} as any;
    for (const item of items) {
      if (!byEntity[item.entityType]) {
        byEntity[item.entityType] = [];
      }
      byEntity[item.entityType].push(item);
    }

    for (const [entityType, entityItems] of Object.entries(byEntity) as [SyncEntityType, OutboxItem[]][]) {
      const records = entityItems.map((i) => SyncPush.transformToPgRecord(entityType, i.payload, i.organizationId));

      try {
        const { error } = await client
          .from(entityType)
          .upsert(records, { onConflict: 'id' });

        if (error) {
          // If batch failed, fallback to item-by-item to isolate the failing record
          for (let idx = 0; idx < entityItems.length; idx++) {
            const item = entityItems[idx];
            const record = records[idx];
            try {
              const { error: singleError } = await client
                .from(entityType)
                .upsert(record, { onConflict: 'id' });

              if (singleError) {
                await this.queue.markFailed(item.id, singleError.message);
                failedCount++;
                errors.push(`${entityType} item ${item.entityId}: ${singleError.message}`);
              } else {
                await this.queue.markSynced([item.id]);
                pushedCount++;
              }
            } catch (err: any) {
              await this.queue.markFailed(item.id, err.message || 'Push error');
              failedCount++;
              errors.push(`${entityType} item ${item.entityId}: ${err.message}`);
            }
          }
        } else {
          // Entire batch succeeded
          await this.queue.markSynced(entityItems.map((i) => i.id));
          pushedCount += entityItems.length;
        }
      } catch (err: any) {
        // Network or client exception
        for (const item of entityItems) {
          await this.queue.markFailed(item.id, err.message || 'Push exception');
        }
        failedCount += entityItems.length;
        errors.push(`${entityType} batch: ${err.message}`);
      }
    }

    return { pushedCount, failedCount, errors };
  }
}
