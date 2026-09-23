import { syncTable, type SyncRecord } from './syncRecords';
/**
 * Sync Push Engine (Phase 2F)
 * Processes local outbox items in batches and pushes them to Supabase PostgreSQL.
 * Uses UUID idempotency via upsert and handles partial batch failures with exponential retries.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../supabaseClient';
import { SyncQueue } from './syncQueue';
import { serverRevision, type OutboxItem, type SyncEntityType } from './syncTypes';
import { SyncPull } from './syncPull';
import { SyncCancelledError, type SyncRunGuard } from './syncTypes';
import { transformToPgRecord } from './syncRecordTransforms';
import type { SalesCRMDatabase } from '../../db/database';
import type { AccessScope } from '../../db/accessScope';
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

interface SyncFailureContext {
  value: Record<string, unknown>;
  message: string;
  lower: string;
  status?: number;
  code: string;
  retryAfterMs?: number;
}

function syncFailureContext(error: unknown): SyncFailureContext {
  const value = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const message = error instanceof Error
    ? error.message
    : typeof value.message === 'string' ? value.message : 'Sync request failed.';
  const messageStatus = /(?:^|\D)([1-5]\d{2})(?:\D|$)/.exec(message)?.[1];
  const retryAfter = value.retryAfterMs ?? value.retry_after_ms;
  return {
    value,
    message,
    lower: message.toLowerCase(),
    status: numericStatus(value) ?? (messageStatus ? Number(messageStatus) : undefined),
    code: typeof value.code === 'string' ? value.code : '',
    retryAfterMs: typeof retryAfter === 'number' && Number.isFinite(retryAfter) && retryAfter >= 0 ? retryAfter : undefined,
  };
}

function matchesAny(...conditions: boolean[]): boolean {
  return conditions.some(Boolean);
}

export function classifySyncFailure(error: unknown): ClassifiedSyncFailure {
  const context = syncFailureContext(error);
  const { value, message, lower, status, code, retryAfterMs } = context;

  if (matchesAny(error instanceof SyncRequestTimeoutError, value.name === 'AbortError', /timed? ?out|timeout/.test(lower))) {
    return { classification: 'TIMEOUT', message, retryable: true };
  }
  if (error instanceof SyncProtocolResponseError) return { classification: 'TRANSIENT_SERVER', message, retryable: true };
  if (status === 429) return { classification: 'RATE_LIMITED', message, retryable: true, retryAfterMs };
  if (typeof status === 'number' && status >= 500) return { classification: 'TRANSIENT_SERVER', message, retryable: true };
  if (status === 401) return { classification: 'AUTH_FAILURE', message, retryable: false };
  if (matchesAny(status === 403, code === '42501', /permission denied|row.level security|\brls\b/.test(lower))) {
    return { classification: 'AUTH_FAILURE', message, retryable: false };
  }
  if (matchesAny(status === 409, /sync_conflict|conflict/.test(lower))) return { classification: 'CONFLICT', message, retryable: false };
  const clientStatus = typeof status === 'number' && status >= 400 && status < 500;
  if (matchesAny(clientStatus, /^22|^23/.test(code), /validation|invalid payload|business rule/.test(lower))) {
    return { classification: 'PERMANENT_CLIENT', message, retryable: false };
  }
  if (matchesAny(error instanceof SyncTransportError, error instanceof TypeError, /network|failed to fetch|fetch failed|connection|econn|offline/.test(lower))) {
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

  /** Transforms local camelCase payload into Supabase PostgreSQL snake_case columns. */
  static transformToPgRecord(
    entityType: SyncEntityType,
    payload: Record<string, unknown>,
    expectedOrgId: string | null = null,
  ): Record<string, unknown> {
    return transformToPgRecord(entityType, payload, expectedOrgId);
  }

  private mutationPayload(item: OutboxItem): Record<string, unknown> {
    if (item.operation === 'DELETE') return { id: item.entityId, organization_id: item.organizationId };
    return SyncPush.transformToPgRecord(item.entityType, {
      ...item.payload,
      createdAt: item.payload.createdAt || item.payload.created_at || item.createdAt,
      updatedAt: item.payload.updatedAt || item.payload.updated_at || item.createdAt,
    }, item.organizationId);
  }

  private validateMutationResponse(item: OutboxItem, organizationId: string, data: unknown): {
    status: 'APPLIED' | 'CONFLICT';
    row: Record<string, unknown> | null;
  } {
    if (!data || typeof data !== 'object') throw new SyncProtocolResponseError('Invalid sync mutation response.');
    const response = data as Record<string, unknown>;
    const status = response.status;
    if (status !== 'APPLIED' && status !== 'CONFLICT') throw new SyncProtocolResponseError('Invalid sync mutation response.');
    const rawRow = response.record;
    const row = rawRow && typeof rawRow === 'object' && !Array.isArray(rawRow) ? rawRow as Record<string, unknown> : null;
    if (status === 'APPLIED' && ((item.operation === 'DELETE') === Boolean(row))) {
      throw new SyncProtocolResponseError('Missing or unexpected authoritative mutation record.');
    }
    if (row && (row.id !== item.entityId || row.organization_id !== organizationId || serverRevision(row) === undefined)) {
      throw new SyncProtocolResponseError('Invalid authoritative sync record.');
    }
    return { status, row };
  }

  private async applyConflict(
    database: SalesCRMDatabase,
    item: OutboxItem,
    row: Record<string, unknown> | null,
    local: SyncRecord | undefined,
    table: ReturnType<typeof syncTable>,
  ): Promise<void> {
    await database.outbox.update(item.id, {
      status: 'DEAD_LETTER',
      lastError: 'SYNC_CONFLICT: local edit retained; review before resubmitting.',
      conflictRemote: row,
      nextAttemptAt: null,
    });
    if (row && (serverRevision(local) ?? -1) <= serverRevision(row)!) {
      await table.put(SyncPull.transformFromPgRecord(item.entityType, row));
    }
  }

  private async applyAccepted(
    database: SalesCRMDatabase,
    item: OutboxItem,
    row: Record<string, unknown> | null,
    local: SyncRecord | undefined,
    children: OutboxItem[],
    table: ReturnType<typeof syncTable>,
  ): Promise<void> {
    const revision = row ? serverRevision(row)! : undefined;
    await database.outbox.update(item.id, { status: 'SYNCED', lastError: null, nextAttemptAt: null });
    for (const child of children) {
      await database.outbox.update(child.id, {
        expectedRevision: child.operation === 'CREATE' && item.operation === 'DELETE' ? 0 : revision,
        predecessorId: undefined,
      });
    }
    if (row && (serverRevision(local) ?? -1) <= revision!) {
      if (children.length && local) await table.put({ ...local, serverRevision: revision, isSynced: 0 });
      if (!children.length) await table.put(SyncPull.transformFromPgRecord(item.entityType, row));
    }
    if (!row && item.operation === 'DELETE' && !children.length) await table.delete(item.entityId);
  }

  private async applyMutationResult(
    database: SalesCRMDatabase,
    item: OutboxItem,
    result: { status: 'APPLIED' | 'CONFLICT'; row: Record<string, unknown> | null },
    guard?: SyncRunGuard,
  ): Promise<void> {
    const table = syncTable(database, item.entityType);
    await database.transaction('rw', [table, database.outbox], async () => {
      guard?.();
      database.markRemoteSyncWrites();
      const children = await database.outbox.filter(entry => entry.predecessorId === item.id).toArray();
      const local = await table.get(item.entityId);
      if (result.status === 'CONFLICT') {
        await this.applyConflict(database, item, result.row, local, table);
        return;
      }
      await this.applyAccepted(database, item, result.row, local, children, table);
    });
  }

  private async pushOne(
    client: SupabaseClient,
    database: SalesCRMDatabase,
    scope: AccessScope,
    item: OutboxItem,
    guard?: SyncRunGuard,
  ): Promise<'APPLIED' | 'CONFLICT'> {
    if (item.payload.id !== item.entityId) throw new Error('Mutation id does not match its outbox context.');
    await this.queue.markSyncing([item.id]);
    const { data, error } = await this.callMutation(client, {
      entity: item.entityType,
      operation: item.operation,
      mutation_id: item.id,
      expected_revision: item.expectedRevision ?? (item.operation === 'CREATE' ? 0 : null),
      payload: this.mutationPayload(item),
    });
    guard?.();
    if (error) throw error;
    const result = this.validateMutationResponse(item, scope.organizationId, data);
    await this.applyMutationResult(database, item, result, guard);
    return result.status;
  }

  private async recordFailure(item: OutboxItem, error: unknown): Promise<string> {
    if (error instanceof SyncCancelledError) throw error;
    const failure = classifySyncFailure(error);
    await this.queue.markFailed(item.id, failure.message, {
      retryable: failure.retryable,
      classification: failure.classification,
      retryAfterMs: failure.retryAfterMs,
    });
    return `${item.entityType} ${item.entityId}: ${failure.classification}: ${failure.message}`;
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
        const status = await this.pushOne(client, database, scope, item, guard);
        if (status === 'CONFLICT') {
          failedCount++;
          errors.push(`${item.entityType} ${item.entityId}: SYNC_CONFLICT (edit retained)`);
        } else {
          pushedCount++;
        }
      } catch (error: unknown) {
        errors.push(await this.recordFailure(item, error));
        failedCount++;
      }
    }
    return { pushedCount, failedCount, errors };
  }}
