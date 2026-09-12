import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SalesCRMDatabase } from '../../src/db/database';
import { LeadRepository } from '../../src/db/repositories/leadRepository';
import { SyncQueue } from '../../src/services/sync/syncQueue';
import { SyncPush } from '../../src/services/sync/syncPush';
import { SyncPull } from '../../src/services/sync/syncPull';
import { cleanupLocalSupabase, setupLocalSupabase, createUnauthenticatedLocalClient, type LocalSupabaseContext } from './local-supabase';

describe('F040 actual outbox → local Supabase → second client pull', () => {
  let context: LocalSupabaseContext;
  const databases: SalesCRMDatabase[] = [];
  beforeAll(async () => { context = await setupLocalSupabase(); }, 30_000);
  afterEach(async () => {
    for (const db of databases.splice(0)) { db.close(); await db.delete(); }
    if (context) await cleanupLocalSupabase(context);
  });
  afterAll(async () => { if (context) { await context.admin.auth.signOut(); await context.agent.auth.signOut(); } });
  function device(role: 'ADMIN' | 'AGENT') {
    const db = new SalesCRMDatabase(`F040_${crypto.randomUUID()}`, {
      organizationId: context.organizationId,
      userId: role === 'ADMIN' ? context.adminProfileId : context.agentProfileId, role,
    });
    databases.push(db); const queue = new SyncQueue(db);
    return { db, queue, leads: new LeadRepository(db, queue), push: new SyncPush(queue, db), pull: new SyncPull(db) };
  }
  async function create(a: ReturnType<typeof device>) {
    const lead = await a.leads.createLead({ businessName: `F040 ${crypto.randomUUID()}`, phone: '9876543210', address: 'Lucknow', assignedTo: context.agentProfileId });
    context.cleanupLeadIds.push(lead.id);
    return lead;
  }
  async function push(a: ReturnType<typeof device>, client = context.admin) {
    const result = await a.push.pushPending(client);
    expect(result.errors).toEqual([]); expect(result.failedCount).toBe(0);
    const events = await a.db.activities.toArray();
    context.cleanupActivityIds.push(...events.map(row => row.id));
    expect((await a.db.outbox.toArray()).every(row => row.status === 'SYNCED')).toBe(true);
  }
  it('inserts, updates and deletes through actual application writers with incremental second-device pulls', async () => {
    const a = device('ADMIN'); const b = device('AGENT'); const lead = await create(a);
    expect(await b.db.leads.get(lead.id)).toBeUndefined();
    await push(a);
    expect((await context.service.from('leads').select('id').eq('id', lead.id).single()).data?.id).toBe(lead.id);
    let cursor = (await b.pull.pullAllChanges(null, context.agent)).newCursor;
    expect((await b.db.leads.get(lead.id))?.businessName).toBe(lead.businessName);
    await a.leads.updateLead(lead.id, { businessName: 'F040 updated by actual repository' });
    await push(a);
    cursor = (await b.pull.pullAllChanges(cursor, context.agent)).newCursor;
    expect((await b.db.leads.get(lead.id))?.businessName).toBe('F040 updated by actual repository');
    await a.leads.softDeleteLead(lead.id); await push(a);
    cursor = (await b.pull.pullAllChanges(cursor, context.agent)).newCursor;
    expect(await b.leads.getLeadById(lead.id)).toBeUndefined();
    await a.leads.hardDeleteLead(lead.id, { recoveryExportSaved: true, acknowledgePermanentDeletion: true });
    await push(a);
    await b.pull.pullAllChanges(cursor, context.agent);
    expect(await b.leads.getLeadById(lead.id)).toBeUndefined();
    expect((await context.service.from('leads').select('id').eq('id', lead.id)).data).toEqual([]);
  });
  it('a lost response retries the same committed mutation without another server row or revision', async () => {
    const a = device('ADMIN'); const b = device('AGENT'); const lead = await create(a);
    let loseResponse = true;
    const transport = new Proxy(context.admin, { get(target, property) {
      if (property === 'rpc') return async (...args: Parameters<SupabaseClient['rpc']>) => {
        const result = await target.rpc(...args);
        if (loseResponse && args[0] === 'sync_mutate' && !result.error) { loseResponse = false; throw new TypeError('simulated lost response after commit'); }
        return result;
      };
      const value = Reflect.get(target, property); return typeof value === 'function' ? value.bind(target) : value;
    } });
    expect((await a.push.pushPending(transport)).failedCount).toBe(1);
    const before = await context.service.from('leads').select('sync_revision').eq('id', lead.id).single();
    const item = (await a.db.outbox.toArray())[0];
    await a.db.outbox.update(item.id, { nextAttemptAt: null });
    await push(a, transport);
    const after = await context.service.from('leads').select('sync_revision').eq('id', lead.id).single();
    expect(after.data?.sync_revision).toBe(before.data?.sync_revision);
    expect((await a.db.outbox.toArray())[0].id).toBe(item.id);
    await b.pull.pullAllChanges(null, context.agent);
    expect(await b.db.leads.where('id').equals(lead.id).count()).toBe(1);
  });
  it('a second device stale write is retained while pull receives the server version despite a future client timestamp', async () => {
    const a = device('ADMIN'); const b = device('AGENT'); const lead = await create(a); await push(a);
    await b.pull.pullAllChanges(null, context.agent);
    await a.leads.updateLead(lead.id, { businessName: 'Server accepted newer revision' }); await push(a);
    await b.leads.updateLead(lead.id, { businessName: 'Retain rejected offline edit' });
    const pending = (await b.db.outbox.toArray())[0];
    await b.db.outbox.update(pending.id, { payload: { ...pending.payload, updatedAt: '2099-01-01T00:00:00.000Z' } });
    expect((await b.push.pushPending(context.agent)).failedCount).toBe(1);
    expect((await b.db.outbox.get(pending.id))?.status).toBe('DEAD_LETTER');
    await b.pull.pullAllChanges(null, context.agent);
    expect((await b.db.leads.get(lead.id))?.businessName).toBe('Server accepted newer revision');
    expect((await b.db.outbox.get(pending.id))?.payload.businessName).toBe('Retain rejected offline edit');
  });
  it('unauthenticated pull cannot populate the second device', async () => {
    const a = device('ADMIN'); const b = device('AGENT'); const lead = await create(a); await push(a);
    expect((await b.pull.pullAllChanges(null, createUnauthenticatedLocalClient(context))).pulledCount).toBe(0);
    expect(await b.db.leads.count()).toBe(0);
    expect((await context.service.from('leads').select('id').eq('id', lead.id).single()).data?.id).toBe(lead.id);
  });
});
