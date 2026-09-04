/**
 * Persistent outbox queue regression tests.
 * The former suite asserted a removed OutboxRepository/idempotency API. These
 * tests retain the mutation, retry, ordering, and isolation intent against the
 * real Dexie-backed SyncQueue used by the app.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SyncQueue } from '@/services/sync/syncQueue';
import type { SalesCRMDatabase } from '@/db/database';
import { agentScope, createVitestDatabase, disposeVitestDatabase } from '../helpers/vitestDatabase';

describe('SyncQueue', () => {
  let database: SalesCRMDatabase;
  let queue: SyncQueue;

  beforeEach(() => {
    database = createVitestDatabase('sync_queue');
    queue = new SyncQueue(database);
  });

  afterEach(async () => {
    await disposeVitestDatabase(database);
  });

  function mutation(operation: 'CREATE' | 'UPDATE' | 'DELETE' = 'CREATE', entityId = crypto.randomUUID()) {
    return {
      entityType: 'leads' as const,
      entityId,
      operation,
      payload: { id: entityId, businessName: 'Queue Test Gym' },
      userId: agentScope.userId,
      organizationId: agentScope.organizationId,
      deviceId: 'vitest-device',
    };
  }

  it('should enqueue CREATE operations', async () => {
    const item = await queue.enqueue(mutation('CREATE'));

    expect(item).toMatchObject({ entityType: 'leads', operation: 'CREATE', status: 'PENDING', retryCount: 0 });
    expect(await database.outbox.get(item.id)).toMatchObject({ id: item.id, status: 'PENDING' });
  });

  it('should enqueue UPDATE operations', async () => {
    const item = await queue.enqueue(mutation('UPDATE'));
    expect(item.operation).toBe('UPDATE');
  });

  it('should enqueue DELETE operations', async () => {
    const item = await queue.enqueue(mutation('DELETE'));
    expect(item.operation).toBe('DELETE');
  });

  it('should generate an opaque mutation identifier', async () => {
    const item = await queue.enqueue(mutation());
    expect(item.id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('should preserve separate mutations for the same entity', async () => {
    const entityId = 'lead-queue-1';
    const create = await queue.enqueue(mutation('CREATE', entityId));
    const update = await queue.enqueue(mutation('UPDATE', entityId));

    expect(create.id).not.toBe(update.id);
    expect(await database.outbox.where('entityId').equals(entityId).count()).toBe(2);
  });

  it('should return pending operations in created-time order', async () => {
    const newest = await queue.enqueue(mutation('UPDATE', 'newest'));
    const oldest = await queue.enqueue(mutation('CREATE', 'oldest'));
    await database.outbox.update(newest.id, { createdAt: '2024-01-02T00:00:00.000Z' });
    await database.outbox.update(oldest.id, { createdAt: '2024-01-01T00:00:00.000Z' });

    const pending = await queue.getPendingItems();
    expect(pending.map((item) => item.entityId)).toEqual(['oldest', 'newest']);
  });

  it('should limit pending results', async () => {
    await queue.enqueue(mutation('CREATE', 'one'));
    await queue.enqueue(mutation('CREATE', 'two'));
    await queue.enqueue(mutation('CREATE', 'three'));

    expect(await queue.getPendingItems(2)).toHaveLength(2);
  });

  it('should mark an operation as synced', async () => {
    const item = await queue.enqueue(mutation());
    await queue.markSyncing([item.id]);
    await queue.markSynced([item.id]);

    expect(await database.outbox.get(item.id)).toMatchObject({ status: 'SYNCED', lastError: null, nextAttemptAt: null });
  });

  it('should handle batch mark as synced', async () => {
    const first = await queue.enqueue(mutation('CREATE', 'first'));
    const second = await queue.enqueue(mutation('UPDATE', 'second'));

    await queue.markSynced([first.id, second.id]);

    expect((await database.outbox.get(first.id))?.status).toBe('SYNCED');
    expect((await database.outbox.get(second.id))?.status).toBe('SYNCED');
  });

  it('should mark an operation as failed with its error', async () => {
    const item = await queue.enqueue(mutation());
    await queue.markFailed(item.id, 'network unavailable');

    expect(await database.outbox.get(item.id)).toMatchObject({
      status: 'FAILED', retryCount: 1, lastError: 'network unavailable',
    });
  });

  it('should increment retry count on repeated failures', async () => {
    const item = await queue.enqueue(mutation());
    await queue.markFailed(item.id, 'first failure');
    await queue.markFailed(item.id, 'second failure');

    expect(await database.outbox.get(item.id)).toMatchObject({ status: 'FAILED', retryCount: 2, lastError: 'second failure' });
  });

  it('should park operations that exceed the retry limit', async () => {
    const item = await queue.enqueue(mutation());
    for (let attempt = 0; attempt < SyncQueue.MAX_RETRY_COUNT; attempt += 1) {
      await queue.markFailed(item.id, `failure ${attempt}`);
    }

    expect(await database.outbox.get(item.id)).toMatchObject({ status: 'DEAD_LETTER', retryCount: SyncQueue.MAX_RETRY_COUNT });
  });

  it('should allow an inspected dead-letter item to be retried explicitly', async () => {
    const item = await queue.enqueue(mutation());
    for (let attempt = 0; attempt < SyncQueue.MAX_RETRY_COUNT; attempt += 1) {
      await queue.markFailed(item.id, `failure ${attempt}`);
    }

    await queue.retryDeadLetter(item.id);

    expect(await database.outbox.get(item.id)).toMatchObject({ status: 'PENDING', retryCount: 0, lastError: null });
  });

  it('should defer failed operations until their retry time', async () => {
    const item = await queue.enqueue(mutation());
    await database.outbox.update(item.id, {
      status: 'FAILED',
      nextAttemptAt: new Date(Date.now() + 60_000).toISOString(),
    });

    expect(await queue.getPendingItems()).toEqual([]);
  });

  it('should recover orphaned syncing operations before a new run', async () => {
    const item = await queue.enqueue(mutation());
    await queue.markSyncing([item.id]);

    await expect(queue.recoverStuckItems()).resolves.toBe(1);
    expect(await database.outbox.get(item.id)).toMatchObject({ status: 'PENDING', nextAttemptAt: null });
  });
});
