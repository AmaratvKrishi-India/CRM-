import 'fake-indexeddb/auto';
import { afterEach, test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { SalesCRMDatabase } from '../src/db/database.ts';
import { LeadRepository } from '../src/db/repositories/leadRepository.ts';
import { SyncQueue } from '../src/services/sync/syncQueue.ts';
import { SyncPush } from '../src/services/sync/syncPush.ts';
import { SyncPull } from '../src/services/sync/syncPull.ts';
import { revisionCursor } from '../src/services/sync/syncTypes.ts';
import { RealtimeService } from '../src/services/realtime/realtimeService.ts';

// Boundary tests only: real repositories, queue and Dexie transactions with
// fake IndexedDB and a controlled RPC response. No live service or credentials.
const scope = { organizationId: 'f022-isolated-org', userId: 'f022-isolated-admin', role: 'ADMIN' as const };
const confirmation = { recoveryExportSaved: true, acknowledgePermanentDeletion: true };
const databases: SalesCRMDatabase[] = [];

afterEach(async () => {
  RealtimeService.setCustomDatabase(null);
  for (const database of databases.splice(0)) {
    database.close();
    await database.delete();
  }
});

function isolatedDatabase(t: TestContext, role: 'ADMIN' | 'AGENT' = 'ADMIN') {
  const network = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('F022 boundary tests forbid network requests.');
  });
  t.after(() => assert.equal(network.mock.callCount(), 0, 'no endpoint was contacted'));
  const database = new SalesCRMDatabase(`F022_ACK_${randomUUID()}`, { ...scope, role });
  databases.push(database);
  return database;
}

type WireRow = Record<string, unknown>;
type SelectResult = { data: WireRow[]; error: null };

// Exact read boundary used by SyncPull, including the active-only filter that
// previously confused an authorized archive with a revoked assignment.
class ControlledSelect implements PromiseLike<SelectResult> {
  private predicates: Array<(row: WireRow) => boolean> = [];
  private sortColumns: string[] = [];
  private first = 0;
  private count = Infinity;
  constructor(private rows: WireRow[]) {}
  eq(column: string, value: unknown): this { this.predicates.push(row => row[column] === value); return this; }
  is(column: string, value: unknown): this { return this.eq(column, value); }
  gte(column: string, value: number): this { this.predicates.push(row => Number(row[column]) >= value); return this; }
  lte(column: string, value: number): this { this.predicates.push(row => Number(row[column]) <= value); return this; }
  order(column: string): this { this.sortColumns.push(column); return this; }
  limit(count: number): this { this.count = count; return this; }
  range(first: number, last: number): this { this.first = first; this.count = last - first + 1; return this; }
  or(filter: string): this {
    assert.equal(filter, `assigned_to.eq.${scope.userId},created_by.eq.${scope.userId}`,
      'these bounded fixtures require no pagination cursor expression');
    this.predicates.push(row => row.assigned_to === scope.userId || row.created_by === scope.userId);
    return this;
  }
  then<TResult1 = SelectResult, TResult2 = never>(
    resolve?: ((value: SelectResult) => TResult1 | PromiseLike<TResult1>) | null,
    reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    const rows = this.rows.filter(row => this.predicates.every(predicate => predicate(row)));
    rows.sort((left, right) => {
      for (const column of this.sortColumns) {
        const difference = column === 'sync_revision'
          ? Number(left[column]) - Number(right[column])
          : String(left[column]).localeCompare(String(right[column]));
        if (difference) return difference;
      }
      return 0;
    });
    return Promise.resolve({ data: structuredClone(rows.slice(this.first, this.first + this.count)), error: null }).then(resolve, reject);
  }
}

function controlledTransport() {
  const attempts: Record<string, unknown>[] = [];
  const committed = new Map<string, { args: Record<string, unknown>; response: unknown }>();
  const rows: Record<string, WireRow[]> = {};
  let revision = 100;
  let loseResponseFor: string | undefined;
  const client = {
    async rpc(name: string, args: Record<string, unknown> = {}) {
      if (name === 'sync_head') return {
        data: Math.max(revision - 1, ...Object.values(rows).flat().map(row => Number(row.sync_revision))), error: null,
      };
      assert.equal(name, 'sync_mutate');
      assert.ok(args.entity === 'leads' || args.entity === 'activities');
      const payload = args.payload as Record<string, unknown>;
      assert.equal(payload.organization_id, scope.organizationId);
      const id = String(args.mutation_id);
      attempts.push(structuredClone(args));
      let accepted = committed.get(id);
      if (accepted) {
        assert.deepEqual(args, accepted.args, 'response-loss replay preserves the complete request');
      } else {
        const record = args.operation === 'DELETE' ? null : {
          ...payload, sync_revision: revision++, updated_at: '2026-09-08T00:00:00.000Z',
        };
        accepted = {
          args: structuredClone(args),
          response: {
            data: {
              status: 'APPLIED',
              record,
            },
            error: null,
          },
        };
        committed.set(id, accepted);
        const table = String(args.entity);
        rows[table] = (rows[table] || []).filter(row => row.id !== payload.id);
        if (record) rows[table].push(record);
      }
      if (id === loseResponseFor) {
        loseResponseFor = undefined;
        throw new TypeError('Network response lost after controlled commit');
      }
      return structuredClone(accepted.response);
    },
    from(table: string) {
      return { select: (_columns: string) => new ControlledSelect(rows[table] || []) };
    },
  };
  return { client, rows, attempts, committed, loseNextResponse: (id: string) => { loseResponseFor = id; } };
}

test('F022: first-batch success preserves archived child work across reopen until its own ACK permits purge', async (t) => {
  const database = isolatedDatabase(t);
  let queue = new SyncQueue(database);
  let leads = new LeadRepository(database, queue);
  const lead = await leads.createLead({ businessName: 'F022 isolated archive', phone: '9876543210', address: 'Test address' });
  await leads.softDeleteLead(lead.id);
  const snapshots = await database.outbox.toArray();
  const create = snapshots.find(item => item.entityId === lead.id && item.operation === 'CREATE')!;
  const archive = snapshots.find(item => item.entityId === lead.id && item.operation === 'UPDATE')!;
  assert.equal(archive.predecessorId, create.id);
  const transport = controlledTransport();

  const first = await new SyncPush(queue, database).pushPending(transport.client as never);
  assert.equal(first.pushedCount, 2, 'ready CREATE and independent archive audit are acknowledged');
  assert.equal(first.failedCount, 0);
  assert.equal(transport.attempts.some(args => args.mutation_id === archive.id), false);
  const readyArchive = await database.outbox.get(archive.id);
  assert.equal(readyArchive?.status, 'PENDING', 'dependent archive was not part of the first ready batch');
  assert.equal(readyArchive?.predecessorId, undefined);
  assert.equal(readyArchive?.expectedRevision, 100);
  assert.deepEqual(readyArchive?.payload, archive.payload, 'original mutation snapshot remains intact');
  assert.equal((await database.leads.get(lead.id))?.deletedAt, archive.payload.deletedAt);
  assert.equal((await database.leads.get(lead.id))?.isSynced, 0);
  await assert.rejects(leads.hardDeleteLead(lead.id, confirmation), /Sync or recover/);

  database.close();
  await database.open();
  assert.deepEqual(await database.outbox.get(archive.id), readyArchive, 'acknowledgement metadata and pending payload persist');
  queue = new SyncQueue(database);
  leads = new LeadRepository(database, queue);
  assert.deepEqual((await queue.getPendingItems()).map(item => item.id), [archive.id]);

  // This explicit second push proves repairability and durability, not the
  // manager's automatic scheduling; actual runtime acceptance tests that path.
  const second = await new SyncPush(queue, database).pushPending(transport.client as never);
  assert.equal(second.pushedCount, 1);
  assert.equal(second.failedCount, 0);
  assert.equal((await database.outbox.get(archive.id))?.status, 'SYNCED');
  const canonical = await database.leads.get(lead.id);
  assert.equal(canonical?.isSynced, 1);
  assert.equal(canonical?.deletedAt, archive.payload.deletedAt);
  assert.equal(canonical?.serverRevision, 102);
  database.close();
  await database.open();
  assert.equal((await database.outbox.get(archive.id))?.status, 'SYNCED');
  assert.equal((await database.leads.get(lead.id))?.serverRevision, 102);
  await leads.hardDeleteLead(lead.id, confirmation);
  assert.equal(await database.leads.get(lead.id), undefined);
  const purge = (await database.outbox.toArray()).find(item => item.entityId === lead.id && item.operation === 'DELETE');
  assert.equal(purge?.expectedRevision, 102, 'purge captures the acknowledged archive revision');
  assert.equal((await database.activities.toArray()).filter(item => item.metadata.action === 'ARCHIVED').length, 1);
});

test('F022: lost archive response retains its identity across reopen and retry completes without changing local status manually', async (t) => {
  const database = isolatedDatabase(t);
  const queue = new SyncQueue(database);
  const leads = new LeadRepository(database, queue);
  const transport = controlledTransport();
  const push = new SyncPush(queue, database);
  const lead = await leads.createLead({ businessName: 'F022 isolated lost response', phone: '9876543210', address: 'Test address' });
  assert.equal((await push.pushPending(transport.client as never)).pushedCount, 1);
  await leads.softDeleteLead(lead.id);
  const archive = (await database.outbox.toArray()).find(item => item.entityId === lead.id && item.operation === 'UPDATE')!;
  transport.loseNextResponse(archive.id);
  const first = await push.pushPending(transport.client as never);
  assert.equal(first.failedCount, 1);
  const retained = await database.outbox.get(archive.id);
  assert.equal(retained?.status, 'FAILED');
  assert.deepEqual(retained?.payload, archive.payload);
  assert.equal(retained?.expectedRevision, archive.expectedRevision);
  await assert.rejects(leads.hardDeleteLead(lead.id, confirmation), /Sync or recover/);
  const uniqueCommits = transport.committed.size;

  database.close();
  await database.open();
  assert.deepEqual(await database.outbox.get(archive.id), retained);
  // Advance only observed time past the actual retry deadline. Never alter
  // mutation status, identity, payload, revision or retry metadata to pass.
  t.mock.method(Date, 'now', () => Date.parse(retained!.nextAttemptAt!) + 1);
  const retried = await new SyncPush(new SyncQueue(database), database).pushPending(transport.client as never);
  assert.equal(retried.failedCount, 0);
  assert.equal(retried.pushedCount, 1);
  assert.equal(transport.committed.size, uniqueCommits, 'same logical mutation has one controlled commit');
  assert.equal(transport.attempts.filter(args => args.mutation_id === archive.id).length, 2);
  assert.equal((await database.outbox.get(archive.id))?.status, 'SYNCED');
  assert.equal((await database.leads.get(lead.id))?.deletedAt, archive.payload.deletedAt);
  assert.equal((await database.leads.get(lead.id))?.isSynced, 1);
  database.close();
  await database.open();
  assert.equal((await database.outbox.get(archive.id))?.status, 'SYNCED');
});

async function savedHistory(database: SalesCRMDatabase, transport: ReturnType<typeof controlledTransport>, leadId: string) {
  const row = {
    id: randomUUID(), organization_id: scope.organizationId, lead_id: leadId,
    user_id: scope.userId, content: 'Previously synchronized business history', type: 'CUSTOM',
    author: 'Isolated fixture', created_at: '2026-09-07T00:00:00.000Z',
    updated_at: '2026-09-07T00:00:00.000Z', deleted_at: null, sync_revision: 1,
  };
  transport.rows.remarks = [...(transport.rows.remarks || []), row];
  await database.remarks.put(SyncPull.transformFromPgRecord('remarks', row) as never);
  return row;
}

function observeDatabaseHook(t: TestContext, database: SalesCRMDatabase) {
  const event = database.leads.hook('updating');
  const original = event.subscribers[0];
  assert.equal(typeof original, 'function');
  const inputs: Array<Record<string, unknown>> = [];
  // Dexie's public event subscribers API lets this isolated test record the
  // actual input before the unchanged application hook supplies default values.
  // The wrapper delegates once, preserving the original result and transaction.
  function observe(this: unknown, ...args: unknown[]) {
    inputs.push(structuredClone(args[0]) as Record<string, unknown>);
    return original.apply(this, args);
  }
  event.unsubscribe(original);
  event.subscribe(observe);
  t.after(() => { event.unsubscribe(observe); event.subscribe(original); });
  return inputs;
}

for (const role of ['ADMIN', 'AGENT'] as const) {
  test(`F022: ${role} full pull retains an authorized archive and old history, allowing restoration`, async (t) => {
    const database = isolatedDatabase(t, role);
    const queue = new SyncQueue(database);
    const leads = new LeadRepository(database, queue);
    const transport = controlledTransport();
    const push = new SyncPush(queue, database);
    const pull = new SyncPull(database);
    const lead = await leads.createLead({ businessName: 'F022 recoverable archive', phone: '9876543210', address: 'Test address' });
    assert.equal((await push.pushPending(transport.client as never)).failedCount, 0);
    const history = await savedHistory(database, transport, lead.id);
    await leads.softDeleteLead(lead.id);
    assert.equal((await push.pushPending(transport.client as never)).failedCount, 0);
    const archived = await database.leads.get(lead.id);
    assert.ok(archived?.deletedAt);
    assert.equal(archived.isSynced, 1, 'archive acknowledgement initially marks the canonical row synchronized');
    const expectedServerTime = transport.rows.leads[0].updated_at;
    assert.equal(archived.updatedAt, expectedServerTime);
    const hookInputs = observeDatabaseHook(t, database);
    const result = await pull.pullAllChanges(revisionCursor(100), transport.client as never);
    t.diagnostic(`F022 ${role} first archive pull raw updating-hook inputs: ${JSON.stringify(hookInputs)}`);

    assert.ok((await database.leads.get(lead.id))?.deletedAt, 'authorized archive survives a complete application pull');
    assert.equal((await database.leads.get(lead.id))?.isSynced, 1, 'authoritative pull must not make an acknowledged archive dirty');
    assert.equal((await database.leads.get(lead.id))?.updatedAt, expectedServerTime,
      'authoritative pull retains the server business timestamp');
    await pull.pullAllChanges(revisionCursor(100), transport.client as never);
    assert.equal((await database.leads.get(lead.id))?.isSynced, 1, 'repeated canonical data remains synchronized');
    assert.equal((await database.leads.get(lead.id))?.updatedAt, expectedServerTime);
    database.close();
    await database.open();
    assert.equal((await database.leads.get(lead.id))?.isSynced, 1, 'canonical synchronization state survives reopen');
    assert.equal((await database.leads.get(lead.id))?.updatedAt, expectedServerTime);
    assert.equal((await database.remarks.get(history.id))?.content, history.content,
      'history older than the incremental cursor is retained, not silently removed');
    assert.equal(await leads.getLeadById(lead.id), undefined, 'ordinary active-lead view still hides archive');
    assert.ok(await leads.getLeadById(lead.id, true), 'explicit recovery lookup can find archive');
    await leads.restoreLead(lead.id);
    assert.equal((await push.pushPending(transport.client as never)).failedCount, 0);
    const restored = await pull.pullAllChanges(result.newCursor, transport.client as never);
    assert.equal((await leads.getLeadById(lead.id))?.deletedAt, null);
    assert.equal((await database.remarks.get(history.id))?.content, history.content);

    await leads.softDeleteLead(lead.id);
    assert.equal((await push.pushPending(transport.client as never)).failedCount, 0);
    await pull.pullAllChanges(restored.newCursor, transport.client as never);
    if (role === 'ADMIN') {
      await leads.hardDeleteLead(lead.id, confirmation);
      assert.equal((await push.pushPending(transport.client as never)).failedCount, 0);
      assert.equal(await database.leads.get(lead.id), undefined);
      assert.equal(await database.remarks.get(history.id), undefined);
      assert.equal(transport.rows.leads.some(row => row.id === lead.id), false);
    } else {
      await assert.rejects(leads.hardDeleteLead(lead.id, confirmation), /Only administrators/);
      assert.ok(await database.leads.get(lead.id), 'agent cannot convert archive to permanent purge');
    }
  });
}

test('F022: agent visibility reconciliation retains an authorized archive outside the incremental window', async (t) => {
  const database = isolatedDatabase(t, 'AGENT');
  const queue = new SyncQueue(database);
  const leads = new LeadRepository(database, queue);
  const transport = controlledTransport();
  const push = new SyncPush(queue, database);
  const lead = await leads.createLead({ businessName: 'F022 existing archive', phone: '9876543210', address: 'Test address' });
  await push.pushPending(transport.client as never);
  const history = await savedHistory(database, transport, lead.id);
  await leads.softDeleteLead(lead.id);
  await push.pushPending(transport.client as never);
  const head = await transport.client.rpc('sync_head');
  const nextCursor = Number((head as { data: number }).data) + 1;
  // A later independent server event advances the head, so this pull contains
  // no version of the archived lead; only the visibility pass can remove it.
  transport.rows.activities.push({
    id: randomUUID(), organization_id: scope.organizationId, user_id: scope.userId,
    lead_id: null, activity_type: 'LEAD_UPDATED', metadata: {}, deleted_at: null,
    created_at: '2026-09-08T00:00:00.000Z', updated_at: '2026-09-08T00:00:00.000Z', sync_revision: nextCursor,
  });
  await new SyncPull(database).pullAllChanges(revisionCursor(nextCursor), transport.client as never);
  assert.ok((await database.leads.get(lead.id))?.deletedAt, 'archive visibility is distinct from active-list visibility');
  assert.equal((await database.remarks.get(history.id))?.content, history.content);
});

test('F022: actual assignment revocation still removes lead, history and unauthorized pending work', async (t) => {
  const database = isolatedDatabase(t, 'AGENT');
  const queue = new SyncQueue(database);
  const leads = new LeadRepository(database, queue);
  const transport = controlledTransport();
  const lead = await leads.createLead({ businessName: 'F022 revoked', phone: '9876543210', address: 'Test address' });
  await new SyncPush(queue, database).pushPending(transport.client as never);
  const history = await savedHistory(database, transport, lead.id);
  await leads.updateLead(lead.id, { businessName: 'Private pending edit' });
  const pending = (await database.outbox.toArray()).find(item => item.entityId === lead.id && item.operation === 'UPDATE')!;
  Object.assign(transport.rows.leads[0], { assigned_to: 'another-agent', created_by: 'another-admin', sync_revision: 200 });
  await new SyncPull(database).pullAllChanges(null, transport.client as never);
  assert.equal(await database.leads.get(lead.id), undefined);
  assert.equal(await database.remarks.get(history.id), undefined);
  assert.equal(await database.outbox.get(pending.id), undefined, 'revoked private work follows the existing access-removal policy');
});

test('F022: physical Realtime DELETE still prunes history and retains an unsynced mutation for review', async (t) => {
  const database = isolatedDatabase(t);
  const queue = new SyncQueue(database);
  const leads = new LeadRepository(database, queue);
  const transport = controlledTransport();
  const lead = await leads.createLead({ businessName: 'F022 physical delete', phone: '9876543210', address: 'Test address' });
  await new SyncPush(queue, database).pushPending(transport.client as never);
  const history = await savedHistory(database, transport, lead.id);
  const deletedRemote = structuredClone(transport.rows.leads[0]);
  await leads.updateLead(lead.id, { businessName: 'Retain this unsynced snapshot' });
  const pending = (await database.outbox.toArray()).find(item => item.entityId === lead.id && item.operation === 'UPDATE')!;
  RealtimeService.setCustomDatabase(database);
  await RealtimeService.handleIncomingPostgresChange('leads', 'DELETE', deletedRemote);
  assert.equal(await database.leads.get(lead.id), undefined);
  assert.equal(await database.remarks.get(history.id), undefined);
  const retained = await database.outbox.get(pending.id);
  assert.equal(retained?.status, 'DEAD_LETTER');
  assert.deepEqual(retained?.payload, pending.payload);
});

test('F022: a newer authoritative archive revision stays synchronized when the prior local revision was already synchronized', async (t) => {
  const database = isolatedDatabase(t);
  const queue = new SyncQueue(database);
  const leads = new LeadRepository(database, queue);
  const transport = controlledTransport();
  const lead = await leads.createLead({ businessName: 'F022 remote revision', phone: '9876543210', address: 'Test address' });
  await new SyncPush(queue, database).pushPending(transport.client as never);
  assert.equal((await database.leads.get(lead.id))?.isSynced, 1);
  const hookInputs = observeDatabaseHook(t, database);
  Object.assign(transport.rows.leads[0], {
    business_name: 'Authoritative remote archive', deleted_at: '2026-09-08T01:00:00.000Z',
    updated_at: '2026-09-08T01:00:00.000Z', sync_revision: 110,
  });
  await new SyncPull(database).pullAllChanges(revisionCursor(100), transport.client as never);
  t.diagnostic(`F022 changed remote revision raw updating-hook inputs: ${JSON.stringify(hookInputs)}`);
  const canonical = await database.leads.get(lead.id);
  assert.equal(canonical?.businessName, 'Authoritative remote archive');
  assert.equal(canonical?.serverRevision, 110);
  assert.equal(canonical?.isSynced, 1, 'a new canonical revision is not a local unsynchronized edit');
  assert.equal(canonical?.updatedAt, '2026-09-08T01:00:00.000Z');
  await leads.restoreLead(lead.id);
  assert.equal((await database.leads.get(lead.id))?.isSynced, 0, 'actual local restore still becomes dirty');
  const restore = (await database.outbox.toArray()).find(item => item.entityId === lead.id && item.operation === 'UPDATE');
  assert.equal(restore?.expectedRevision, 110);
});

test('F022: duplicate and changed Realtime snapshots remain canonical while a later local edit becomes dirty', async (t) => {
  const database = isolatedDatabase(t);
  const queue = new SyncQueue(database);
  const leads = new LeadRepository(database, queue);
  const transport = controlledTransport();
  const lead = await leads.createLead({ businessName: 'F022 duplicate event', phone: '9876543210', address: 'Test address' });
  await new SyncPush(queue, database).pushPending(transport.client as never);
  RealtimeService.setCustomDatabase(database);
  for (let attempt = 0; attempt < 2; attempt++) {
    await RealtimeService.handleIncomingPostgresChange('leads', 'UPDATE', transport.rows.leads[0]);
    assert.equal((await database.leads.get(lead.id))?.isSynced, 1);
    assert.equal((await database.leads.get(lead.id))?.updatedAt, transport.rows.leads[0].updated_at);
  }
  const changed = { ...transport.rows.leads[0], business_name: 'Remote newer name', sync_revision: 110 };
  await RealtimeService.handleIncomingPostgresChange('leads', 'UPDATE', changed);
  assert.equal((await database.leads.get(lead.id))?.isSynced, 1);
  assert.equal((await database.leads.get(lead.id))?.businessName, 'Remote newer name');
  await leads.updateLead(lead.id, { businessName: 'A real local edit' });
  const local = await database.leads.get(lead.id);
  assert.equal(local?.isSynced, 0, 'remote-write context must not leak into a later local transaction');
  assert.equal(local?.businessName, 'A real local edit');
  assert.notEqual(local?.updatedAt, changed.updated_at);
  const mutation = (await database.outbox.toArray()).find(item => item.entityId === lead.id && item.operation === 'UPDATE');
  assert.equal(mutation?.expectedRevision, 110);
});

test('F022: an archive event delivered before its RPC response does not make the later acknowledgement dirty', async (t) => {
  const database = isolatedDatabase(t);
  const queue = new SyncQueue(database);
  const leads = new LeadRepository(database, queue);
  const transport = controlledTransport();
  const lead = await leads.createLead({ businessName: 'F022 event before response', phone: '9876543210', address: 'Test address' });
  await new SyncPush(queue, database).pushPending(transport.client as never);
  await leads.softDeleteLead(lead.id);
  const archive = (await database.outbox.toArray()).find(item => item.entityId === lead.id && item.operation === 'UPDATE')!;
  RealtimeService.setCustomDatabase(database);
  const client = {
    async rpc(name: string, args: Record<string, unknown>) {
      const response = await transport.client.rpc(name, args);
      if (args.mutation_id === archive.id) {
        await RealtimeService.handleIncomingPostgresChange('leads', 'UPDATE', transport.rows.leads[0]);
        assert.equal((await database.leads.get(lead.id))?.isSynced, 1, 'event installed canonical archive before RPC response');
      }
      return response;
    },
  };
  const result = await new SyncPush(queue, database).pushPending(client as never);
  assert.equal(result.failedCount, 0);
  assert.equal((await database.outbox.get(archive.id))?.status, 'SYNCED');
  assert.equal((await database.leads.get(lead.id))?.isSynced, 1, 'the duplicate canonical ACK preserves synchronization metadata');
  assert.equal((await database.leads.get(lead.id))?.updatedAt, transport.rows.leads[0].updated_at);
});


test('F022: a failed offline agent CREATE survives authoritative visibility reconciliation', async (t) => {
  const database = isolatedDatabase(t, 'AGENT');
  const queue = new SyncQueue(database);
  const leads = new LeadRepository(database, queue);
  const transport = controlledTransport();
  const lead = await leads.createLead({ businessName: 'F022 pending create', phone: '9876543210', address: 'Test address' });
  const create = (await database.outbox.toArray()).find(item => item.entityId === lead.id && item.operation === 'CREATE')!;
  await queue.markFailed(create.id, 'offline', { retryable: true, classification: 'TRANSIENT_NETWORK' });

  await new SyncPull(database).pullAllChanges(null, transport.client as never);

  assert.equal((await database.leads.get(lead.id))?.businessName, 'F022 pending create');
  assert.equal((await database.outbox.get(create.id))?.status, 'FAILED');
});

test('F022: admin pull removes a lead that was hard-deleted while this device was offline', async (t) => {
  const database = isolatedDatabase(t, 'ADMIN');
  const queue = new SyncQueue(database);
  const leads = new LeadRepository(database, queue);
  const transport = controlledTransport();
  const lead = await leads.createLead({ businessName: 'F022 remote purge', phone: '9876543210', address: 'Test address' });
  await new SyncPush(queue, database).pushPending(transport.client as never);
  transport.rows.leads = [];

  await new SyncPull(database).pullAllChanges(null, transport.client as never);

  assert.equal(await database.leads.get(lead.id), undefined);
});

test('F022: newly reassigned lead backfills history older than the saved cursor', async (t) => {
  const database = isolatedDatabase(t, 'AGENT');
  const transport = controlledTransport();
  const leadId = randomUUID();
  const remarkId = randomUUID();
  transport.rows.leads = [{
    id: leadId, organization_id: scope.organizationId, assigned_to: scope.userId, created_by: 'admin-other',
    business_name: 'Reassigned lead', phone: '9876543210', address: 'Test address', status: 'NEW',
    created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-12T00:00:00.000Z', deleted_at: null, sync_revision: 200,
  }];
  transport.rows.remarks = [{
    id: remarkId, organization_id: scope.organizationId, lead_id: leadId, user_id: 'admin-other',
    content: 'Older history must follow assignment', type: 'CUSTOM', author: 'Admin',
    created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z', deleted_at: null, sync_revision: 10,
  }];

  await new SyncPull(database).pullAllChanges(revisionCursor(150), transport.client as never);

  assert.equal((await database.leads.get(leadId))?.businessName, 'Reassigned lead');
  assert.equal((await database.remarks.get(remarkId))?.content, 'Older history must follow assignment');
});

for (const failedRead of [1, 2]) {
  test(`F022: reassigned history survives restart after remarks read ${failedRead} fails`, async (t) => {
    const database = isolatedDatabase(t, 'AGENT');
    const transport = controlledTransport();
    const leadId = randomUUID(), remarkId = randomUUID();
    transport.rows.leads = [{
      id: leadId, organization_id: scope.organizationId, assigned_to: scope.userId, created_by: 'admin-other',
      business_name: 'Reassigned lead', phone: '9876543210', address: 'Test address', status: 'NEW',
      created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-12T00:00:00.000Z', sync_revision: 200,
    }];
    transport.rows.remarks = [{
      id: remarkId, organization_id: scope.organizationId, lead_id: leadId, user_id: 'admin-other',
      content: 'Retried history', type: 'CUSTOM', author: 'Admin',
      created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z', sync_revision: 10,
    }];
    let reads = 0;
    const flakyClient = {
      ...transport.client,
      from(table: string) {
        if (table === 'remarks' && ++reads === failedRead) throw new Error('Transient remarks failure');
        return transport.client.from(table);
      },
    };
    const cursor = revisionCursor(150);
    await assert.rejects(new SyncPull(database).pullAllChanges(cursor, flakyClient as never), /Transient remarks failure/);
    assert.ok(await database.leads.get(leadId), 'the interrupted pull already cached the lead');
    assert.equal(await database.remarks.get(remarkId), undefined);
    database.close();
    await database.open();

    const result = await new SyncPull(database).pullAllChanges(cursor, transport.client as never);
    assert.equal((await database.remarks.get(remarkId))?.content, 'Retried history');
    assert.equal(result.newCursor, revisionCursor(200));
  });
}
