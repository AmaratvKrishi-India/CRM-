/**
 * Sync Push Engine (Phase 2F)
 * Processes local outbox items in batches and pushes them to Supabase PostgreSQL.
 * Uses UUID idempotency via upsert and handles partial batch failures with exponential retries.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../supabaseClient';
import { SyncQueue } from './syncQueue';
import { serverRevision, type SyncEntityType } from './syncTypes';
import { SyncPull } from './syncPull';
import { SyncCancelledError, type SyncRunGuard } from './syncTypes';
import type { SalesCRMDatabase } from '../../db/database';
import { db as defaultDb } from '../../db/database';

export type SyncFailureClassification =
  | 'TRANSIENT_NETWORK'
  | 'TIMEOUT'
  | 'TRANSIENT_SERVER'
  | 'RATE_LIMITED'
  | 'AUTH_FAILURE'
  | 'PERMANENT_CLIENT'
  | 'CONFLICT'
  | 'UNKNOWN';

export interface ClassifiedSyncFailure {
  classification: SyncFailureClassification;
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
}

class SyncRequestTimeoutError extends Error {
  constructor() {
    super('Sync request timed out before a response was received.');
    this.name = 'SyncRequestTimeoutError';
  }
}

class SyncTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncTransportError';
  }
}

class SyncProtocolResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncProtocolResponseError';
  }
}

function numericStatus(error: Record<string, unknown>): number | undefined {
  const value = error.status ?? error.statusCode;
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isInteger(parsed) ? parsed : undefined;
}

export function classifySyncFailure(error: unknown): ClassifiedSyncFailure {
  const value = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const message = error instanceof Error ? error.message :
    typeof value.message === 'string' ? value.message : 'Sync request failed.';
  const lower = message.toLowerCase();
  const messageStatus = /(?:^|\D)([1-5]\d{2})(?:\D|$)/.exec(message)?.[1];
  const status = numericStatus(value) ?? (messageStatus ? Number(messageStatus) : undefined);
  const code = typeof value.code === 'string' ? value.code : '';
  const retryAfter = value.retryAfterMs ?? value.retry_after_ms;
  const retryAfterMs = typeof retryAfter === 'number' && Number.isFinite(retryAfter) && retryAfter >= 0
    ? retryAfter : undefined;

  if (error instanceof SyncRequestTimeoutError || value.name === 'AbortError' || /timed? ?out|timeout/.test(lower)) {
    return { classification: 'TIMEOUT', message, retryable: true };
  }
  if (error instanceof SyncProtocolResponseError) {
    return { classification: 'TRANSIENT_SERVER', message, retryable: true };
  }
  if (status === 429) return { classification: 'RATE_LIMITED', message, retryable: true, retryAfterMs };
  if (status !== undefined && status >= 500) return { classification: 'TRANSIENT_SERVER', message, retryable: true };
  if (status === 401) return { classification: 'AUTH_FAILURE', message, retryable: false };
  if (status === 403 || code === '42501' || /permission denied|row.level security|\brls\b/.test(lower)) {
    return { classification: 'AUTH_FAILURE', message, retryable: false };
  }
  if (status === 409 || /sync_conflict|conflict/.test(lower)) {
    return { classification: 'CONFLICT', message, retryable: false };
  }
  if ((status !== undefined && status >= 400 && status < 500) || /^22|^23/.test(code) || /validation|invalid payload|business rule/.test(lower)) {
    return { classification: 'PERMANENT_CLIENT', message, retryable: false };
  }
  if (error instanceof SyncTransportError || error instanceof TypeError || /network|failed to fetch|fetch failed|connection|econn|offline/.test(lower)) {
    return { classification: 'TRANSIENT_NETWORK', message, retryable: true };
  }
  return { classification: 'UNKNOWN', message, retryable: false };
}

export class SyncPush {
  constructor(
    private queue: SyncQueue = new SyncQueue(),
    private database?: SalesCRMDatabase,
    private requestTimeoutMs = 15_000
  ) {}

  private async callMutation(client: SupabaseClient, args: Record<string, unknown>) {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        Promise.resolve(client.rpc('sync_mutate', args)).catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Sync transport failed.';
          throw new SyncTransportError(message);
        }),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new SyncRequestTimeoutError()), this.requestTimeoutMs);
        }),
      ]);
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    }
  }

  private getDatabase(): SalesCRMDatabase {
    return this.database || defaultDb;
  }

  private getLocalTable(entityType: SyncEntityType): any {
    const db = this.getDatabase();
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

  /**
   * Transforms local camelCase payload into Supabase PostgreSQL snake_case columns.
   */
  static transformToPgRecord(entityType: SyncEntityType, payload: Record<string, any>, expectedOrgId: string | null = null): Record<string, any> {
    const payloadOrgId = payload.organizationId || payload.organization_id || null;
    if (payloadOrgId && expectedOrgId && payloadOrgId !== expectedOrgId) {
      throw new Error('Mutation payload organization does not match its outbox context.');
    }
    const orgId = payloadOrgId || expectedOrgId;
    if (!orgId) {
      throw new Error('Mutation is missing an organization context.');
    }

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
          rating: payload.rating ?? null,
          review_count: payload.reviewCount ?? payload.review_count ?? null,
          source: payload.source || 'Field Sales',
          source_file: payload.sourceFile || payload.source_file || null,
          source_row: payload.sourceRow ?? payload.source_row ?? null,
          status: payload.status || 'NEW',
          custom_notes: payload.customNotes || payload.custom_notes || '',
          last_contacted_at: payload.lastContactedAt || payload.last_contacted_at || null,
          next_follow_up_at: payload.nextFollowUpAt || payload.next_follow_up_at || null,
          call_count: payload.callCount ?? payload.call_count ?? 0,
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
          dial_attempt_id: payload.dialAttemptId ?? payload.dial_attempt_id ?? null,
          started_at: payload.startedAt || payload.started_at,
          answered_at: payload.answeredAt || payload.answered_at || null,
          ended_at: payload.endedAt || payload.ended_at || null,
          duration_seconds: payload.durationSeconds ?? payload.duration_seconds ?? 0,
          reported_duration_seconds:
            payload.reportedDurationSeconds ?? payload.reported_duration_seconds ?? null,
          outcome: payload.outcome || 'OTHER',
          call_status: payload.callStatus || payload.call_status || null,
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
          total_rows: payload.totalRows ?? payload.total_rows ?? 0,
          imported: payload.imported ?? 0,
          updated: payload.updated ?? 0,
          duplicates: payload.duplicates ?? 0,
          invalid: payload.invalid ?? 0,
          created_at: base.created_at,
          updated_at: base.updated_at,
        };

      case 'bulk_assignment_audits':
        return {
          ...base,
          performed_by: payload.performedBy || payload.performed_by,
          target_agent_id: payload.targetAgentId || payload.target_agent_id,
          selected_lead_count: payload.selectedLeadCount ?? payload.selected_lead_count ?? 0,
          successful_count: payload.successfulCount ?? payload.successful_count ?? 0,
          failed_count: payload.failedCount ?? payload.failed_count ?? 0,
          started_at: payload.startedAt || payload.started_at,
          completed_at: payload.completedAt || payload.completed_at,
          filter_snapshot: payload.filterSnapshot || payload.filter_snapshot || {},
          status: payload.status || 'COMPLETED',
          error_summary: payload.errorSummary || payload.error_summary || null,
        };

      case 'profiles':
        return {
          ...base,
          name: payload.name || '',
          email: payload.email || '',
          phone: payload.phone ?? '',
          role: payload.role || 'AGENT',
          status: payload.status || 'ACTIVE',
          created_by: payload.createdBy || payload.created_by || null,
          last_login_at: payload.lastLoginAt || payload.last_login_at || null,
          version: payload.version ?? 1,
        };

      default:
        return { ...payload, organization_id: orgId };
    }
  }

  /**
   * Each immutable outbox snapshot is sent with its captured server revision.
   * A missing RPC is an error: never fall back to a blind upsert.
   */
  async pushPending(client: SupabaseClient | null = getSupabaseClient(), guard?: SyncRunGuard): Promise<{
    pushedCount: number; failedCount: number; errors: string[];
  }> {
    if (!client) throw new Error('Supabase client is not initialized or configured.');
    const database = this.getDatabase();
    const scope = database.requireAccessScope();
    const items = await this.queue.getPendingItems(50);
    let pushedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    for (const snapshot of items) {
      guard?.();
      const item = await database.outbox.get(snapshot.id);
      if (!item || item.status === 'SYNCED' || item.status === 'DEAD_LETTER') continue;
      if (item.organizationId !== scope.organizationId || item.userId !== scope.userId) {
        throw new Error('Outbox item escaped its account synchronization context.');
      }
      try {
        if (item.payload.id !== item.entityId) throw new Error('Mutation id does not match its outbox context.');
        await this.queue.markSyncing([item.id]);
        const payload = item.operation === 'DELETE'
          ? { id: item.entityId, organization_id: item.organizationId }
          : SyncPush.transformToPgRecord(item.entityType, {
            ...item.payload,
            // Stable defaults also make legacy/incomplete CREATE retries byte-identical.
            createdAt: item.payload.createdAt || item.payload.created_at || item.createdAt,
            updatedAt: item.payload.updatedAt || item.payload.updated_at || item.createdAt,
          }, item.organizationId);
        const { data, error } = await this.callMutation(client, {
          entity: item.entityType, operation: item.operation, mutation_id: item.id,
          expected_revision: item.expectedRevision ?? (item.operation === 'CREATE' ? 0 : null), payload,
        });
        guard?.();
        if (error) throw error;
        if (!data || !['APPLIED', 'CONFLICT'].includes(data.status)) throw new SyncProtocolResponseError('Invalid sync mutation response.');
        const row = data.record;
        if (data.status === 'APPLIED' && ((item.operation === 'DELETE') === !!row)) {
          throw new SyncProtocolResponseError('Missing or unexpected authoritative mutation record.');
        }
        if (row && (row.id !== item.entityId || row.organization_id !== scope.organizationId ||
            serverRevision(row) === undefined)) throw new SyncProtocolResponseError('Invalid authoritative sync record.');
        const table = this.getLocalTable(item.entityType);
        await database.transaction('rw', [table, database.outbox], async () => {
          guard?.();
          database.markRemoteSyncWrites();
          const children = await database.outbox.filter(entry => entry.predecessorId === item.id).toArray();
          const local = await table.get(item.entityId);
          if (data.status === 'CONFLICT') {
            // Preserve the exact rejected edit, plus server evidence. Never mark
            // an unaccepted write SYNCED or infer a newer base for retry.
            await database.outbox.update(item.id, {
              status: 'DEAD_LETTER', lastError: 'SYNC_CONFLICT: local edit retained; review before resubmitting.',
              conflictRemote: row || null, nextAttemptAt: null,
            });
            if (row && (serverRevision(local) ?? -1) <= serverRevision(row)!) {
              await table.put(SyncPull.transformFromPgRecord(item.entityType, row));
            }
          } else {
            const revision = row ? serverRevision(row)! : undefined;
            await database.outbox.update(item.id, { status: 'SYNCED', lastError: null, nextAttemptAt: null });
            for (const child of children) {
              // Only causal descendants advance their base after this exact
              // mutation succeeds; a foreign/newer server write still fails CAS.
              await database.outbox.update(child.id, {
                expectedRevision: child.operation === 'CREATE' && item.operation === 'DELETE' ? 0 : revision,
                predecessorId: undefined,
              });
            }
            if (row && (serverRevision(local) ?? -1) <= revision!) {
              if (children.length) {
                // A queued hard delete has already removed the local row.
                if (local) await table.put({ ...local, serverRevision: revision, isSynced: 0 });
              } else {
                await table.put(SyncPull.transformFromPgRecord(item.entityType, row));
              }
            }
            if (!row && item.operation === 'DELETE' && !children.length) await table.delete(item.entityId);
          }
        });
        if (data.status === 'CONFLICT') {
          failedCount++;
          errors.push(`${item.entityType} ${item.entityId}: SYNC_CONFLICT (edit retained)`);
        } else pushedCount++;
      } catch (error: unknown) {
        if (error instanceof SyncCancelledError) throw error;
        const failure = classifySyncFailure(error);
        await this.queue.markFailed(item.id, failure.message, {
          retryable: failure.retryable,
          classification: failure.classification,
          retryAfterMs: failure.retryAfterMs,
        });
        failedCount++;
        errors.push(`${item.entityType} ${item.entityId}: ${failure.classification}: ${failure.message}`);
      }
    }
    return { pushedCount, failedCount, errors };
  }
}
