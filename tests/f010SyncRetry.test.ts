import 'fake-indexeddb/auto';
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { SalesCRMDatabase } from '../src/db/database.ts';
import { SyncPush, classifySyncFailure } from '../src/services/sync/syncPush.ts';
import { SyncQueue } from '../src/services/sync/syncQueue.ts';

const databases: SalesCRMDatabase[] = [];

async function setup(label: string, expectedRevision = 7) {
  const db = new SalesCRMDatabase(`F010_${label}_${Date.now()}_${Math.random()}`, {
    organizationId: 'org-f010', userId: 'user-f010', role: 'ADMIN',
  });
  databases.push(db);
  const queue = new SyncQueue(db);
  const item = await queue.enqueue({
    entityType: 'leads', entityId: `lead-${label}`, operation: 'DELETE',
    payload: { id: `lead-${label}`, serverRevision: expectedRevision },
    userId: 'user-f010', organizationId: 'org-f010', deviceId: 'device-f010',
  });
  return { db, queue, item };
}

async function resetRetry(db: SalesCRMDatabase, id: string) {
  await db.outbox.update(id, { nextAttemptAt: null });
}

afterEach(async () => {
  while (databases.length) {
    const db = databases.pop()!;
    db.close();
    await db.delete();
  }
});

describe('F010 sync retry classification and timeout handling', () => {
  test('1 successful request is acknowledged', async () => {
    const { db, queue, item } = await setup('success');
    const client = { rpc: async () => ({ data: { status: 'APPLIED', record: null }, error: null }) };
    assert.equal((await new SyncPush(queue, db, 50).pushPending(client as never)).pushedCount, 1);
    assert.equal((await db.outbox.get(item.id))?.status, 'SYNCED');
  });

  test('2 transient network rejection is retryable', async () => {
    const { db, queue, item } = await setup('network');
    const client = { rpc: async () => { throw new TypeError('Failed to fetch'); } };
    await new SyncPush(queue, db, 50).pushPending(client as never);
    assert.match((await db.outbox.get(item.id))!.lastError!, /TRANSIENT_NETWORK/);
    assert.equal((await db.outbox.get(item.id))?.status, 'FAILED');
  });

  test('3 timeout before acceptance remains retryable', async () => {
    const { db, queue, item } = await setup('timeout-before');
    const client = { rpc: () => new Promise(() => undefined) };
    await new SyncPush(queue, db, 2).pushPending(client as never);
    assert.match((await db.outbox.get(item.id))!.lastError!, /TIMEOUT/);
  });

  test('4 timeout after possible acceptance reuses the same logical mutation', async () => {
    const { db, queue, item } = await setup('timeout-after', 12);
    const calls: Record<string, unknown>[] = [];
    const applied = new Set<string>();
    let first = true;
    const client = { rpc: (_name: string, args: Record<string, unknown>) => {
      calls.push(args); applied.add(String(args.mutation_id));
      if (first) { first = false; return new Promise(() => undefined); }
      return Promise.resolve({ data: { status: 'APPLIED', record: null }, error: null });
    } };
    const push = new SyncPush(queue, db, 2);
    await push.pushPending(client as never);
    await resetRetry(db, item.id);
    await push.pushPending(client as never);
    assert.equal(applied.size, 1);
    assert.equal(calls[0].mutation_id, calls[1].mutation_id);
    assert.equal(calls[0].expected_revision, calls[1].expected_revision);
  });

  test('5 repeated timeout increments a bounded retry count', async () => {
    const { db, queue, item } = await setup('timeouts');
    const push = new SyncPush(queue, db, 1);
    const client = { rpc: () => new Promise(() => undefined) };
    for (let i = 0; i < 3; i++) { await resetRetry(db, item.id); await push.pushPending(client as never); }
    assert.equal((await db.outbox.get(item.id))?.retryCount, 3);
  });

  test('6 HTTP 5xx is transient', () => {
    assert.deepEqual(classifySyncFailure({ status: 503, message: 'Unavailable' }).retryable, true);
  });

  test('7 HTTP 429 is retryable and carries Retry-After milliseconds', () => {
    assert.deepEqual(classifySyncFailure({ status: 429, message: 'Slow down', retryAfterMs: 9000 }), {
      classification: 'RATE_LIMITED', message: 'Slow down', retryable: true, retryAfterMs: 9000,
    });
  });

  test('8 HTTP 400 is terminal', () => assert.equal(classifySyncFailure({ status: 400, message: 'Bad' }).retryable, false));
  test('9 HTTP 401 is terminal auth failure', () => assert.equal(classifySyncFailure({ status: 401, message: 'Unauthorized' }).classification, 'AUTH_FAILURE'));
  test('10 HTTP 403 is terminal auth failure', () => assert.equal(classifySyncFailure({ status: 403, message: 'Forbidden' }).retryable, false));
  test('11 HTTP 404 is terminal', () => assert.equal(classifySyncFailure({ status: 404, message: 'Missing' }).retryable, false));
  test('12 HTTP/F003 conflict is terminal', () => assert.equal(classifySyncFailure({ status: 409, message: 'Conflict' }).classification, 'CONFLICT'));
  test('13 validation or business error is terminal', () => assert.equal(classifySyncFailure({ message: 'validation business rule failed' }).retryable, false));
  test('14 unknown errors fail safely without retry', () => assert.equal(classifySyncFailure({ message: 'unclassified' }).classification, 'UNKNOWN'));

  test('15 retry limit parks the mutation', async () => {
    const { db, queue, item } = await setup('limit');
    for (let i = 0; i < SyncQueue.MAX_RETRY_COUNT; i++) await queue.markFailed(item.id, 'network', { retryable: true });
    assert.equal((await db.outbox.get(item.id))?.status, 'DEAD_LETTER');
  });

  test('16 exponential and rate-limit backoff are bounded', async () => {
    const { db, queue, item } = await setup('backoff');
    await queue.markFailed(item.id, 'limited', { retryable: true, retryAfterMs: 999_999 });
    const delay = new Date((await db.outbox.get(item.id))!.nextAttemptAt!).getTime() - Date.now();
    assert.ok(delay <= SyncQueue.RETRY_MAX_MS && delay > SyncQueue.RETRY_MAX_MS - 1000);
  });

  test('17 retry succeeds after transport recovery', async () => {
    const { db, queue, item } = await setup('recovery');
    let fail = true;
    const client = { rpc: async () => {
      if (fail) { fail = false; throw new TypeError('network down'); }
      return { data: { status: 'APPLIED', record: null }, error: null };
    } };
    const push = new SyncPush(queue, db, 50);
    await push.pushPending(client as never);
    await resetRetry(db, item.id);
    await push.pushPending(client as never);
    assert.equal((await db.outbox.get(item.id))?.status, 'SYNCED');
  });

  test('18 permanent failure is immediately dead-lettered', async () => {
    const { db, queue, item } = await setup('permanent');
    const client = { rpc: async () => ({ data: null, error: { status: 403, message: 'Forbidden' } }) };
    await new SyncPush(queue, db, 50).pushPending(client as never);
    assert.equal((await db.outbox.get(item.id))?.status, 'DEAD_LETTER');
    assert.equal((await db.outbox.get(item.id))?.retryCount, 1);
  });

  test('19 retry preserves mutation UUID', async () => {
    const { db, queue, item } = await setup('uuid');
    const ids: unknown[] = [];
    const client = { rpc: async (_n: string, args: Record<string, unknown>) => { ids.push(args.mutation_id); throw new TypeError('network'); } };
    const push = new SyncPush(queue, db, 50);
    await push.pushPending(client as never); await resetRetry(db, item.id); await push.pushPending(client as never);
    assert.deepEqual(ids, [item.id, item.id]);
  });

  test('20 retry preserves expected revision', async () => {
    const { db, queue, item } = await setup('revision', 44);
    const revisions: unknown[] = [];
    const client = { rpc: async (_n: string, args: Record<string, unknown>) => { revisions.push(args.expected_revision); throw new TypeError('network'); } };
    const push = new SyncPush(queue, db, 50);
    await push.pushPending(client as never); await resetRetry(db, item.id); await push.pushPending(client as never);
    assert.deepEqual(revisions, [44, 44]);
  });

  test('21 server-accepted timeout retry is idempotent by UUID', async () => {
    const { db, queue, item } = await setup('idempotent');
    const results = new Map<string, object>(); let applications = 0; let first = true;
    const client = { rpc: (_n: string, args: Record<string, unknown>) => {
      const id = String(args.mutation_id);
      if (!results.has(id)) { applications++; results.set(id, { data: { status: 'APPLIED', record: null }, error: null }); }
      if (first) { first = false; return new Promise(() => undefined); }
      return Promise.resolve(results.get(id));
    } };
    const push = new SyncPush(queue, db, 2);
    await push.pushPending(client as never); await resetRetry(db, item.id); await push.pushPending(client as never);
    assert.equal(applications, 1);
  });

  test('22 timeout never creates a second outbox mutation', async () => {
    const { db, queue } = await setup('no-duplicate');
    await new SyncPush(queue, db, 1).pushPending({ rpc: () => new Promise(() => undefined) } as never);
    assert.equal(await db.outbox.count(), 1);
  });

  test('23 offline/failed queue payload remains intact', async () => {
    const { db, queue, item } = await setup('intact');
    const before = (await db.outbox.get(item.id))!.payload;
    await new SyncPush(queue, db, 10).pushPending({ rpc: async () => { throw new TypeError('offline'); } } as never);
    assert.deepEqual((await db.outbox.get(item.id))!.payload, before);
  });

  test('24 push failure does not advance the sync cursor', async () => {
    const { db, queue } = await setup('cursor');
    await db.syncState.put({ id: 'org-f010:user-f010', organizationId: 'org-f010', userId: 'user-f010',
      deviceId: 'device-f010', lastSuccessfulSyncAt: null, lastPushAt: null, lastPullAt: null,
      lastPullCursor: 'revision:1:77', lastSyncError: null, status: 'PENDING' });
    await new SyncPush(queue, db, 1).pushPending({ rpc: () => new Promise(() => undefined) } as never);
    assert.equal((await db.syncState.get('org-f010:user-f010'))?.lastPullCursor, 'revision:1:77');
  });

  test('25 structured F003 conflict is retained and never generically retried', async () => {
    const { db, queue, item } = await setup('conflict');
    const client = { rpc: async () => ({ data: { status: 'CONFLICT', record: null }, error: null }) };
    await new SyncPush(queue, db, 50).pushPending(client as never);
    assert.equal((await db.outbox.get(item.id))?.status, 'DEAD_LETTER');
    assert.match((await db.outbox.get(item.id))!.lastError!, /SYNC_CONFLICT/);
  });
});
