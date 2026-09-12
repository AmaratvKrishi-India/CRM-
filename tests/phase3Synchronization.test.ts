import 'fake-indexeddb/auto';
import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SalesCRMDatabase } from '../src/db/database.ts';
import { scopedDatabaseName, type AccessScope } from '../src/db/accessScope.ts';
import { createCRMDataLayer } from '../src/db/index.ts';
import { SyncEngine } from '../src/services/sync/syncEngine.ts';
import { SyncPush } from '../src/services/sync/syncPush.ts';
import { SyncConflictResolver } from '../src/services/sync/syncConflictResolver.ts';
import { SyncQueue } from '../src/services/sync/syncQueue.ts';
import { RealtimeService } from '../src/services/realtime/realtimeService.ts';
import { setCustomSupabaseClient } from '../src/services/supabaseClient.ts';
import { BackupService } from '../src/services/backupService.ts';

type Row = Record<string, unknown>;
type QueryResult = { data: Row[] | null; error: { message: string } | null };

const now = '2026-09-01T10:00:00.000Z';
const later = '2026-09-01T11:00:00.000Z';
const scopeA: AccessScope = { organizationId: 'org-sync-a', userId: 'agent-sync-a', role: 'AGENT' };
const scopeB: AccessScope = { organizationId: 'org-sync-b', userId: 'agent-sync-b', role: 'AGENT' };

class FakeSelectQuery implements PromiseLike<QueryResult> {
  private equals: Array<[string, unknown]> = [];
  private nulls: Array<[string, unknown]> = [];
  private lowerBound: Array<[string, string]> = [];
  private upperBound: Array<[string, number]> = [];
  private orFilter: string | null = null;
  private maxRows: number | null = null;
  private rangeBounds: [number, number] | null = null;
  private orders: string[] = [];

  constructor(
    private rows: Row[],
    private errorMessage: string | null,
    private ignoreFilters: boolean
  ) {}

  eq(column: string, value: unknown): this { this.equals.push([column, value]); return this; }
  is(column: string, value: unknown): this { this.nulls.push([column, value]); return this; }
  gte(column: string, value: string): this { this.lowerBound.push([column, value]); return this; }
  lte(column: string, value: number): this { this.upperBound.push([column, value]); return this; }
  or(filter: string): this { this.orFilter = filter; return this; }
  limit(value: number): this { this.maxRows = value; return this; }
  range(from: number, to: number): this { this.rangeBounds = [from, to]; return this; }
  order(column: string): this { this.orders.push(column); return this; }

  private evaluate(): QueryResult {
    if (this.errorMessage) return { data: null, error: { message: this.errorMessage } };
    let result = [...this.rows];
    if (!this.ignoreFilters) {
      for (const [column, value] of this.equals) result = result.filter((row) => row[column] === value);
      for (const [column, value] of this.nulls) result = result.filter((row) => row[column] === value);
      for (const [column, value] of this.lowerBound) {
        result = result.filter((row) => column === 'sync_revision' ? Number(row[column] || 0) >= Number(value) : String(row[column] || '') >= value);
      }
      for (const [column,value] of this.upperBound) result=result.filter(row=>Number(row[column] || 0)<=value);
      if (this.orFilter?.includes('assigned_to.eq.')) {
        const ids = [...this.orFilter.matchAll(/(?:assigned_to|created_by)\.eq\.([^,)]+)/g)].map((m) => m[1]);
        result = result.filter((row) => ids.includes(String(row.assigned_to)) || ids.includes(String(row.created_by)));
      }
    }
    result.sort((left, right) => {
      for (const column of this.orders) {
        const comparison = String(left[column] || '').localeCompare(String(right[column] || ''));
        if (comparison) return comparison;
      }
      return 0;
    });
    if (this.rangeBounds) result = result.slice(this.rangeBounds[0], this.rangeBounds[1] + 1);
    else if (this.maxRows !== null) result = result.slice(0, this.maxRows);
    return { data: result, error: null };
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.evaluate()).then(onfulfilled, onrejected);
  }
}

class FakeDeleteQuery implements PromiseLike<{ error: { message: string } | null }> {
  private filters: Array<[string, unknown]> = [];
  constructor(
    private table: string,
    private deletes: Row[],
    private errorMessage: string | null
  ) {}
  eq(column: string, value: unknown): this { this.filters.push([column, value]); return this; }
  then<TResult1 = { error: { message: string } | null }, TResult2 = never>(
    onfulfilled?: ((value: { error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    if (!this.errorMessage) this.deletes.push({ table: this.table, filters: this.filters });
    return Promise.resolve({ error: this.errorMessage ? { message: this.errorMessage } : null }).then(onfulfilled, onrejected);
  }
}

function fakeClient(options: {
  tables?: Record<string, Row[]>;
  errorTable?: string;
  ignoreFilters?: boolean;
  onUpsert?: (table: string, records: Row | Row[]) => Promise<void> | void;
  deleteError?: string;
} = {}) {
  const upserts: Row[] = [];
  const deletes: Row[] = [];
  const tables = options.tables || {};
  let revision = Math.max(0,...Object.values(tables).flat().map(row=>Number(row.sync_revision || 0)));
  const client = {
    async rpc(name: string, args: any = {}) {
      if (name === 'sync_head') return {data:revision,error:null};
      const table = args.entity, record = args.payload;
      if (args.operation === 'DELETE') {
        if(options.deleteError) return {data:null,error:{message:options.deleteError}};
        deletes.push({table,filters:[['id',record.id],['organization_id',record.organization_id]]});
        return {data:{status:'APPLIED',record:null},error:null};
      }
      if(args.operation === 'UPDATE' && args.expected_revision === null) return {data:{status:'CONFLICT',record:null},error:null};
      await options.onUpsert?.(table,record);
      upserts.push({table,records:record});
      const canonical={...record,sync_revision:++revision};
      tables[table]=[...(tables[table] || []).filter(row=>row.id!==record.id),canonical];
      return {data:{status:'APPLIED',record:canonical},error:null};
    },
    from(table: string) {
      return {
        select: (_columns: string) => new FakeSelectQuery(
          tables[table] || [],
          options.errorTable === table ? `forced ${table} failure` : null,
          options.ignoreFilters === true
        ),
        upsert: async (records: Row | Row[]) => {
          await options.onUpsert?.(table, records);
          upserts.push({ table, records });
          return { error: null };
        },
        delete: () => new FakeDeleteQuery(table, deletes, options.deleteError || null),
      };
    },
  } as unknown as SupabaseClient;
  return { client, upserts, deletes };
}

function leadRow(id: string, scope: AccessScope, overrides: Row = {}): Row {
  return {
    id,
    organization_id: scope.organizationId,
    business_name: `Lead ${id}`,
    phone: '9000000000',
    status: 'NEW',
    assigned_to: scope.userId,
    created_by: scope.userId,
    updated_by: scope.userId,
    created_at: now,
    updated_at: now,
    sync_revision: 0,
    deleted_at: null,
    ...overrides,
  };
}

async function openDb(scope: AccessScope, suffix: string) {
  const db = new SalesCRMDatabase(`${scopedDatabaseName(scope)}__${suffix}_${Date.now()}`, scope);
  await db.open();
  return db;
}

afterEach(async () => {
  setCustomSupabaseClient(null);
  RealtimeService.setCustomDatabase(null);
  RealtimeService.setCustomClient(null);
  RealtimeService.setSyncEngine(null);
  await RealtimeService.unsubscribe();
});

describe('Phase 3 account, cursor, outbox, and restart isolation', () => {
  it('preserves independent A/B/A cursors and pending mutations across restart', async () => {
    const dbA = await openDb(scopeA, 'cursor-a');
    const dataA = createCRMDataLayer(dbA);
    await dataA.syncStateRepo.updateSyncState({ lastPullCursor: 'cursor-a-100' });
    await dataA.syncQueue.enqueue({ entityType: 'leads', entityId: 'lead-a', operation: 'CREATE', payload: { id: 'lead-a' }, userId: scopeA.userId });
    const dbNameA = dbA.name;
    dataA.syncEngine.dispose();
    dbA.close();

    const dbB = await openDb(scopeB, 'cursor-b');
    const dataB = createCRMDataLayer(dbB);
    assert.equal((await dataB.syncStateRepo.getSyncState()).lastPullCursor, null);
    assert.equal((await dataB.syncQueue.getPendingItems()).length, 0);
    await dataB.syncStateRepo.updateSyncState({ lastPullCursor: 'cursor-b-200' });
    dataB.syncEngine.dispose();
    dbB.close();

    const reopenedA = new SalesCRMDatabase(dbNameA, scopeA);
    await reopenedA.open();
    const resumedA = createCRMDataLayer(reopenedA);
    assert.equal((await resumedA.syncStateRepo.getSyncState()).lastPullCursor, 'cursor-a-100');
    assert.equal((await resumedA.syncQueue.getPendingItems()).length, 1);
    resumedA.syncEngine.dispose();
    reopenedA.close();
  });

  it('pushes only the active account outbox and rejects missing organization context', async () => {
    assert.throws(() => SyncPush.transformToPgRecord('leads', { id: 'no-org' }), /organization context/i);
    const db = await openDb(scopeA, 'push-isolation');
    const data = createCRMDataLayer(db);
    await data.syncQueue.enqueue({ entityType: 'leads', entityId: 'lead-a', operation: 'CREATE', payload: { id: 'lead-a' }, userId: scopeA.userId });
    await db.outbox.add({
      id: 'foreign-mutation', organizationId: scopeB.organizationId, userId: scopeB.userId,
      deviceId: 'device-b', entityType: 'leads', entityId: 'lead-b', operation: 'CREATE',
      payload: { id: 'lead-b' }, createdAt: now, updatedAt: now, retryCount: 0,
      lastAttemptAt: null, nextAttemptAt: null, lastError: null, status: 'PENDING',
    });
    const server = fakeClient();
    const result = await data.syncPush.pushPending(server.client);
    assert.equal(result.pushedCount, 1);
    assert.equal(server.upserts.length, 1);
    assert.equal((await db.outbox.get('foreign-mutation'))?.status, 'PENDING');
    data.syncEngine.dispose();
    db.close();
  });

  it('cancels an in-flight old-account cycle and safely recovers its mutation on restart', async () => {
    const db = await openDb(scopeA, 'cancel');
    const data = createCRMDataLayer(db);
    data.syncEngine.dispose();
    await data.syncQueue.enqueue({ entityType: 'leads', entityId: 'lead-cancel', operation: 'CREATE', payload: { id: 'lead-cancel' }, userId: scopeA.userId });

    let releaseUpsert!: () => void;
    let signalStarted!: () => void;
    const started = new Promise<void>((resolve) => { signalStarted = resolve; });
    const release = new Promise<void>((resolve) => { releaseUpsert = resolve; });
    const delayed = fakeClient({ onUpsert: async () => { signalStarted(); await release; } });
    setCustomSupabaseClient(delayed.client);
    const engine = new SyncEngine(data.syncQueue, data.syncPush, data.syncPull, data.syncStateRepo, async () => scopeA);
    const first = engine.triggerSync();
    const concurrent = await engine.triggerSync();
    assert.equal(concurrent, null, 'single-flight rejects concurrent manual/background sync');
    await started;
    engine.dispose();
    releaseUpsert();
    const cancelled = await first;
    assert.match(cancelled?.error || '', /context|active/i);
    assert.equal((await db.outbox.where('entityId').equals('lead-cancel').first())?.status, 'SYNCING');

    const resumedServer = fakeClient();
    setCustomSupabaseClient(resumedServer.client);
    const resumed = new SyncEngine(data.syncQueue, data.syncPush, data.syncPull, data.syncStateRepo, async () => scopeA);
    const recovered = await resumed.triggerSync();
    assert.equal(recovered?.error, null);
    assert.equal(recovered?.pushedCount, 1);
    resumed.dispose();
    db.close();
  });

  it('does not start push or pull after server authorization is revoked', async () => {
    const db = await openDb(scopeA, 'revoked');
    const data = createCRMDataLayer(db);
    data.syncEngine.dispose();
    await data.syncQueue.enqueue({ entityType: 'leads', entityId: 'revoked-lead', operation: 'CREATE', payload: { id: 'revoked-lead' }, userId: scopeA.userId });
    const server = fakeClient();
    setCustomSupabaseClient(server.client);
    const engine = new SyncEngine(data.syncQueue, data.syncPush, data.syncPull, data.syncStateRepo, async () => null);
    const result = await engine.triggerSync();
    assert.match(result?.error || '', /authentication/i);
    assert.equal(server.upserts.length, 0);
    assert.equal((await data.syncQueue.getPendingItems()).length, 1);
    engine.dispose();
    db.close();
  });

  it('invalidates the sync context when the server changes the active role', async () => {
    const db = await openDb(scopeA, 'role-change');
    const data = createCRMDataLayer(db);
    data.syncEngine.dispose();
    await data.syncQueue.enqueue({ entityType: 'leads', entityId: 'role-lead', operation: 'UPDATE', payload: { id: 'role-lead' }, userId: scopeA.userId });
    const server = fakeClient();
    setCustomSupabaseClient(server.client);
    const changedScope: AccessScope = { ...scopeA, role: 'ADMIN' };
    const engine = new SyncEngine(data.syncQueue, data.syncPush, data.syncPull, data.syncStateRepo, async () => changedScope);
    const result = await engine.triggerSync();
    assert.match(result?.error || '', /authentication|context/i);
    assert.equal(server.upserts.length, 0);
    assert.equal((await data.syncQueue.getPendingItems()).length, 1);
    engine.dispose();
    db.close();
  });
});

describe('Phase 3 pull, assignment revocation, and realtime isolation', () => {
  it('recovers a missed realtime lead through scoped pull and rejects cross-organization rows', async () => {
    const db = await openDb(scopeA, 'pull');
    const data = createCRMDataLayer(db);
    const server = fakeClient({ tables: { leads: [leadRow('visible-a', scopeA), leadRow('foreign-b', scopeB)] }, ignoreFilters: true });
    await assert.rejects(data.syncPull.pullAllChanges(null, server.client), /revision-window row/);
    assert.equal(await db.leads.get('visible-a'), undefined, 'invalid response fails the whole page before applying');
    assert.equal(await db.leads.get('foreign-b'), undefined);
    data.syncEngine.dispose();
    db.close();
  });

  it('prunes a server-known reassigned lead graph and its pending mutations after authoritative pull', async () => {
    const db = await openDb(scopeA, 'assignment');
    const data = createCRMDataLayer(db);
    const tables: Record<string, Row[]> = { leads: [] };
    const server = fakeClient({ tables });
    const lead = await data.leads.createLead({ businessName: 'Revoked', phone: '9000000004', assignedTo: scopeA.userId });
    assert.equal((await data.syncPush.pushPending(server.client)).failedCount, 0, 'lead must be server-known before revocation');
    await data.remarks.addRemark({ leadId: lead.id, content: 'private history' });
    assert.ok((await db.outbox.where('entityId').equals(lead.id).count()) > 0, 'revoked lead has pending private work');
    Object.assign(tables.leads[0], { assigned_to: 'agent-other', created_by: 'admin-other' });
    await data.syncPull.pullAllChanges(null, server.client);
    assert.equal(await db.leads.get(lead.id), undefined);
    assert.equal(await db.remarks.where('leadId').equals(lead.id).count(), 0);
    assert.equal(await db.outbox.where('entityId').equals(lead.id).count(), 0);
    data.syncEngine.dispose();
    db.close();
  });

  it('realtime rejects another organization and prunes an assignment revoked from this agent', async () => {
    const db = await openDb(scopeA, 'realtime');
    const data = createCRMDataLayer(db);
    RealtimeService.setCustomDatabase(db);
    await RealtimeService.handleIncomingPostgresChange('leads', 'INSERT', leadRow('foreign', scopeB));
    assert.equal(await db.leads.get('foreign'), undefined);

    await RealtimeService.handleIncomingPostgresChange('leads', 'INSERT', leadRow('mine', scopeA));
    assert.ok(await db.leads.get('mine'));
    await RealtimeService.handleIncomingPostgresChange(
      'leads', 'UPDATE', leadRow('mine', scopeA, { assigned_to: 'agent-other', created_by: 'admin-other', updated_at: later })
    );
    assert.equal(await db.leads.get('mine'), undefined);
    data.syncEngine.dispose();
    db.close();
  });

  it('ignores callbacks from an unsubscribed realtime generation', async () => {
    const db = await openDb(scopeA, 'stale-rt');
    const data = createCRMDataLayer(db);
    let leadCallback: ((payload: { eventType: 'INSERT'; new: Row; old: Row }) => Promise<void> | void) | null = null;
    const channel = {
      on: (_kind: string, config: { table: string }, callback: typeof leadCallback) => {
        if (config.table === 'leads') leadCallback = callback;
        return channel;
      },
      subscribe: (callback: (status: string) => void) => { callback('SUBSCRIBED'); return channel; },
    };
    const client = {
      channel: () => channel,
      removeChannel: async () => ({ error: null }),
    } as unknown as SupabaseClient;
    RealtimeService.setCustomDatabase(db);
    RealtimeService.setCustomClient(client);
    await RealtimeService.init({
      id: scopeA.userId, organizationId: scopeA.organizationId, role: 'AGENT', status: 'ACTIVE',
      name: 'Agent A', email: 'a@example.com', phone: '', createdAt: now, updatedAt: now, deletedAt: null,
    });
    const staleCallback = leadCallback;
    assert.ok(staleCallback);
    await RealtimeService.unsubscribe();
    await staleCallback?.({ eventType: 'INSERT', new: leadRow('stale-event', scopeA), old: {} });
    assert.equal(await db.leads.get('stale-event'), undefined);
    data.syncEngine.dispose();
    db.close();
  });
});

describe('Phase 3 retry, conflicts, cursor safety, and restore interaction', () => {
  it('uses bounded retry metadata, dead-letters permanent failures, and supports inspected recovery', async () => {
    const db = await openDb(scopeA, 'dead-letter');
    const queue = new SyncQueue(db);
    const item = await queue.enqueue({ entityType: 'leads', entityId: 'retry-lead', operation: 'UPDATE', payload: { id: 'retry-lead' }, userId: scopeA.userId });
    await queue.markFailed(item.id, 'transient');
    const first = await db.outbox.get(item.id);
    assert.equal(first?.status, 'FAILED');
    assert.ok(first?.nextAttemptAt);
    for (let count = 1; count < SyncQueue.MAX_RETRY_COUNT; count++) await queue.markFailed(item.id, `failure-${count}`);
    const dead = await db.outbox.get(item.id);
    assert.equal(dead?.status, 'DEAD_LETTER');
    assert.equal(dead?.retryCount, SyncQueue.MAX_RETRY_COUNT);
    assert.equal(dead?.lastError, `failure-${SyncQueue.MAX_RETRY_COUNT - 1}`);
    await queue.retryDeadLetter(item.id);
    assert.equal((await db.outbox.get(item.id))?.status, 'PENDING');
    db.close();
  });

  it('keeps conflict outcomes deterministic for revisions, deletes, calls, and duplicates', () => {
    const local = { id: 'lead-1', serverRevision: 2, updatedAt: later, deletedAt: null };
    const olderRemote = { id: 'lead-1', serverRevision: 1, updatedAt: now, deletedAt: null };
    assert.equal(SyncConflictResolver.resolveMutable('leads', local, olderRemote).winner, 'LOCAL');
    assert.equal(SyncConflictResolver.resolveMutable('leads', local, { ...local }).winner, 'REMOTE');
    assert.equal(SyncConflictResolver.resolveMutable('leads', olderRemote, local).winner, 'REMOTE');
    assert.equal(SyncConflictResolver.resolveAppendOnly({ id: 'event-1' }, { id: 'event-1' }).winner, 'LOCAL');
    assert.equal(
      SyncConflictResolver.resolveAppendOnly({ id: 'event-1', deletedAt: null }, { id: 'event-1', deletedAt: later }).winner,
      'REMOTE'
    );
    assert.equal(
      SyncConflictResolver.resolveCallRecord(
        { id: 'call-1', verificationStatus: 'VERIFIED', updatedAt: now },
        { id: 'call-1', verificationStatus: 'UNVERIFIED', updatedAt: later }
      ).winner,
      'LOCAL'
    );
    assert.equal(
      SyncConflictResolver.resolveCallRecord(
        { id: 'call-2', verificationStatus: 'VERIFIED', updatedAt: now, deletedAt: null },
        { id: 'call-2', verificationStatus: 'UNVERIFIED', updatedAt: later, deletedAt: later }
      ).winner,
      'REMOTE'
    );
  });

  it('does not advance the cursor when a later pull table fails', async () => {
    const adminScope: AccessScope = { organizationId: 'org-partial', userId: 'admin-partial', role: 'ADMIN' };
    const db = await openDb(adminScope, 'partial');
    const data = createCRMDataLayer(db);
    data.syncEngine.dispose();
    const server = fakeClient({ tables: { leads: [leadRow('partial-lead', adminScope)] }, errorTable: 'call_records' });
    setCustomSupabaseClient(server.client);
    const engine = new SyncEngine(data.syncQueue, data.syncPush, data.syncPull, data.syncStateRepo, async () => adminScope);
    const result = await engine.triggerSync();
    assert.match(result?.error || '', /call_records/i);
    assert.equal((await data.syncStateRepo.getSyncState()).lastPullCursor, null);
    engine.dispose();
    db.close();
  });

  it('rejects restored outbox and cursor metadata from another account', async () => {
    const adminScope: AccessScope = { organizationId: 'org-backup-sync', userId: 'admin-backup-sync', role: 'ADMIN' };
    const db = await openDb(adminScope, 'backup');
    const backup = new BackupService(db);
    const payload = await backup.generateBackupPayload();
    payload.data.outbox = [{
      id: 'foreign-outbox', organizationId: 'other-org', userId: 'other-user', deviceId: null,
      entityType: 'leads', entityId: 'foreign-lead', operation: 'CREATE', payload: { id: 'foreign-lead' },
      createdAt: now, updatedAt: now, retryCount: 0, lastAttemptAt: null, nextAttemptAt: null,
      lastError: null, status: 'PENDING',
    }];
    const validation = backup.validateBackupPayload(payload);
    assert.equal(validation.isValid, false);
    assert.match(validation.errors.join(' '), /outbox mutation.*another synchronization context/i);
    db.close();
  });

  it('retains an unversioned legacy update for review instead of silently dropping it', async () => {
    const adminScope: AccessScope = { organizationId: 'org-stale', userId: 'admin-stale', role: 'ADMIN' };
    const db = await openDb(adminScope, 'stale');
    const data = createCRMDataLayer(db);
    await db.leads.put({
      id: 'stale-lead', businessName: 'Newer Local', phone: '9000000005', status: 'NEW',
      createdBy: adminScope.userId, updatedBy: adminScope.userId, createdAt: now, updatedAt: later,
      isSynced: 0, deletedAt: null,
    });
    await data.syncQueue.enqueue({
      entityType: 'leads', entityId: 'stale-lead', operation: 'UPDATE',
      payload: { id: 'stale-lead', updatedAt: now }, userId: adminScope.userId,
    });
    const server = fakeClient();
    const result = await data.syncPush.pushPending(server.client);
    assert.equal(result.pushedCount, 0);
    assert.equal(server.upserts.length, 0);
    assert.equal((await db.outbox.where('entityId').equals('stale-lead').first())?.status, 'DEAD_LETTER');
    data.syncEngine.dispose();
    db.close();
  });
});
