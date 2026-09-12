import 'fake-indexeddb/auto';
import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { SalesCRMDatabase } from '../src/db/database.ts';
import { SyncQueue } from '../src/services/sync/syncQueue.ts';
import { recoveryGuidance, SyncRecoveryService } from '../src/services/sync/syncRecoveryService.ts';
const databases: SalesCRMDatabase[] = [];
async function fixture() {
  const db = new SalesCRMDatabase(`F028_${crypto.randomUUID()}`, { organizationId: 'org', userId: 'user', role: 'ADMIN' });
  databases.push(db);
  const queue = new SyncQueue(db);
  const item = await queue.enqueue({ entityType: 'leads', entityId: crypto.randomUUID(), operation: 'UPDATE',
    payload: { businessName: 'Preserve this change', serverRevision: 2 }, userId: 'user', organizationId: 'org' });
  await queue.markFailed(item.id, 'denied', { retryable: false, classification: 'AUTH_FAILURE' });
  return { db, queue, item, service: new SyncRecoveryService(db) };
}
afterEach(async () => { for (const db of databases.splice(0)) { db.close(); await db.delete(); } });
test('F028 inspection and export preserve the exact saved mutation without deleting it', async () => {
  const { db, item, service } = await fixture();
  assert.equal((await service.list()).items[0].id, item.id);
  const snapshot = await db.outbox.get(item.id);
  assert.deepEqual(JSON.parse(await service.exportItem(item.id)).item, snapshot);
  assert.deepEqual(await db.outbox.get(item.id), snapshot);
});
test('F028 retry after access repair retains UUID, payload and server revision', async () => {
  const { db, item, service } = await fixture();
  await service.retry(item.id);
  const row = (await db.outbox.get(item.id))!;
  assert.equal(row.status, 'PENDING'); assert.equal(row.retryCount, 0);
  assert.deepEqual(row.payload, item.payload); assert.equal(row.expectedRevision, item.expectedRevision);
  assert.equal((await service.list()).items.length, 0);
});
test('F028 another account cannot inspect, export or retry a retained mutation', async () => {
  const { db, item, service } = await fixture();
  await db.outbox.update(item.id, { userId: 'other-user' });
  assert.equal((await service.list()).items.length, 0);
  await assert.rejects(service.exportItem(item.id), /this account/);
  await assert.rejects(service.retry(item.id), /active account/);
  assert.equal((await db.outbox.get(item.id))?.status, 'DEAD_LETTER');
});
test('F028 pages retained work and never purges it during synced cleanup', async () => {
  const { db, queue, item, service } = await fixture();
  for (let i = 0; i < 25; i++) await db.outbox.add({ ...item, id: crypto.randomUUID(), sequence: i + 2, status: 'DEAD_LETTER' });
  assert.equal((await service.list()).items.length, 20);
  assert.equal((await service.list()).hasMore, true);
  assert.equal((await service.list(20)).items.length, 6);
  await queue.purgeSyncedItems(); assert.equal(await db.outbox.count(), 26);
  await assert.rejects(service.list(0, 1000), /Invalid recovery page/);
});
test('F028 guidance separates revision, authorization, validation and transient recovery', () => {
  assert.match(recoveryGuidance('[CONFLICT]'), /cannot resolve a revision conflict/);
  assert.match(recoveryGuidance('[AUTH_FAILURE]'), /administrator/);
  assert.match(recoveryGuidance('[PERMANENT]'), /normal edit form/);
  assert.match(recoveryGuidance('[TIMEOUT]'), /original identity/);
});
