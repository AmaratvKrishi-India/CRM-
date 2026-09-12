import 'fake-indexeddb/auto';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { SalesCRMDatabase } from '../src/db/database.ts';
import { SyncQueue } from '../src/services/sync/syncQueue.ts';
import { SyncPush } from '../src/services/sync/syncPush.ts';
import { SyncPull } from '../src/services/sync/syncPull.ts';
import { revisionCursor } from '../src/services/sync/syncTypes.ts';
import { RealtimeService } from '../src/services/realtime/realtimeService.ts';
import { AgentManagementService } from '../src/services/agentManagementService.ts';
import { setCustomSupabaseClient } from '../src/services/supabaseClient.ts';
import { createOrderingDatabase,org,otherOrg,actor,agent,agentAuthId,quote } from './helpers/f003Postgres.ts';

let pg: ReturnType<typeof createOrderingDatabase>;
const localDbs: SalesCRMDatabase[] = [];
before(() => {pg=createOrderingDatabase();});
after(async () => {for(const db of localDbs) await db.delete(); pg?.close();});
const local = () => {
  const db = new SalesCRMDatabase('F003_'+randomUUID(),{organizationId:org,userId:actor,role:'ADMIN'});
  localDbs.push(db);return db;
};
function wire(extra: Record<string,unknown> = {}) {
  return {id:randomUUID(),organization_id:org,business_name:'Original',phone:'9876543210',address:'A',locality:'L',
    created_by:actor,assigned_to:actor,updated_at:'2099-01-01T00:00:00Z',...extra};
}
async function mutate(payload: Record<string,unknown>, expected: number|null,operation='UPDATE',id=randomUUID(),user?:string) {
  return pg.client(user).rpc('sync_mutate',{entity:'leads',operation,mutation_id:id,expected_revision:expected,payload});
}
async function created() {
  const result=await mutate(wire(),0,'CREATE');assert.equal(result.error,null);return result.data.record;
}
async function edit(db: SalesCRMDatabase,row: Record<string,any>, name: string, timestamp: string) {
  const payload={...SyncPull.transformFromPgRecord('leads',row),businessName:name,updatedAt:timestamp,isSynced:0};
  await db.leads.put(payload as any);
  return new SyncQueue(db).enqueue({entityType:'leads',entityId:row.id,operation:'UPDATE',payload,userId:actor,organizationId:org});
}

test('F003 SQL: normal sequential edits use returned server revisions',async()=>{
  const row=await created();
  const r=await mutate({id:row.id,organization_id:org,business_name:'Second'},row.sync_revision);
  assert.equal(r.error,null);assert.equal(r.data.status,'APPLIED');
  assert.ok(r.data.record.sync_revision>row.sync_revision);
  assert.ok(new Date(r.data.record.updated_at).getUTCFullYear()<2099);
});
test('F003 SQL: two writers, future and past clocks, stale and equal-time edits cannot win CAS',async()=>{
  for(const timestamp of ['2099-01-01T00:00:00Z','1900-01-01T00:00:00Z','2026-09-05T12:00:00Z']) {
    const row=await created();
    const a=await mutate({id:row.id,organization_id:org,business_name:'Winner',updated_at:timestamp},row.sync_revision);
    const b=await mutate({id:row.id,organization_id:org,business_name:'Stale',updated_at:timestamp},row.sync_revision);
    assert.equal(a.data.status,'APPLIED');assert.equal(b.data.status,'CONFLICT');
    assert.equal(b.data.record.business_name,'Winner');
  }
});
test('F003 SQL: identical UUID retry is idempotent and changed replay is rejected',async()=>{
  const row=await created(),id=randomUUID(),payload={id:row.id,organization_id:org,business_name:'Once'};
  const first=await mutate(payload,row.sync_revision,'UPDATE',id);
  const retry=await mutate(payload,row.sync_revision,'UPDATE',id);
  assert.deepEqual(retry.data,first.data);
  assert.ok((await mutate({...payload,business_name:'Different'},row.sync_revision,'UPDATE',id)).error);
  await mutate({...payload,business_name:'Later'},first.data.record.sync_revision);
  assert.equal((await mutate(payload,row.sync_revision,'UPDATE',id)).data.status,'CONFLICT');
});
test('F003 SQL: legacy blind updates and caller-chosen revision metadata fail safely',async()=>{
  const row=await created();
  assert.throws(()=>pg.query(`UPDATE leads SET business_name='Legacy' WHERE id=${quote(row.id)} RETURNING to_jsonb(leads)`),/SYNC_CONFLICT/);
  assert.equal((await mutate({id:row.id,organization_id:org,business_name:'Legacy'},null)).data.status,'CONFLICT');
  assert.ok((await mutate({id:row.id,organization_id:org,sync_revision:999999},row.sync_revision)).error);
});
test('F003 SQL: tenant and agent RLS still reject unauthorized mutations',async()=>{
  const row=await created();
  assert.ok((await mutate({id:row.id,organization_id:otherOrg,business_name:'Foreign'},row.sync_revision)).error);
  const agentResult=await mutate({id:row.id,organization_id:org,business_name:'Not mine'},row.sync_revision,'UPDATE',randomUUID(),agentAuthId);
  assert.equal(agentResult.data.status,'CONFLICT');assert.equal(agentResult.data.record,null);
  const agentCreate=await mutate(wire({created_by:agent,assigned_to:agent}),0,'CREATE',randomUUID(),agentAuthId);
  assert.equal(agentCreate.data.status,'APPLIED');
});
test('F003: offline reconnect pushes through actual PostgreSQL and canonical response replaces client date',async()=>{
  const db=local(),row=await created();
  const item=await edit(db,row,'Offline valid','1900-01-01T00:00:00Z');
  const result=await new SyncPush(new SyncQueue(db),db).pushPending(pg.client() as any);
  assert.equal(result.failedCount,0);assert.equal(result.pushedCount,1);
  assert.equal((await db.leads.get(row.id))!.businessName,'Offline valid');
  assert.notEqual((await db.leads.get(row.id))!.updatedAt,'1900-01-01T00:00:00Z');
  assert.equal((await db.outbox.get(item.id))!.status,'SYNCED');
});
test('F003: stale future-clock edit is retained; actual pull converges both local clients',async()=>{
  const a=local(),b=local(),row=await created();
  const rejected=await edit(a,row,'Stale future','2099-01-01T00:00:00Z');
  await edit(b,row,'New valid','1900-01-01T00:00:00Z');
  assert.equal((await new SyncPush(new SyncQueue(b),b).pushPending(pg.client() as any)).pushedCount,1);
  assert.equal((await new SyncPush(new SyncQueue(a),a).pushPending(pg.client() as any)).failedCount,1);
  const pending=await a.outbox.get(rejected.id);
  assert.equal(pending!.status,'DEAD_LETTER');assert.equal(pending!.payload.businessName,'Stale future');
  assert.equal(pending!.conflictRemote!.business_name,'New valid');
  await new SyncPull(a).pullAllChanges(null,pg.client() as any);
  assert.equal((await a.leads.get(row.id))!.businessName,'New valid');
  await new SyncQueue(a).purgeSyncedItems();assert.ok(await a.outbox.get(rejected.id));
});
test('F003: lost response replays actual mutation once without losing pending payload',async()=>{
  const db=local(),row=await created();await edit(db,row,'Lost response','2099-01-01T00:00:00Z');
  const transport=pg.client(),broken={...transport,rpc:async(...args:Parameters<typeof transport.rpc>)=>{
    await transport.rpc(...args);throw new Error('simulated lost response');
  }};
  assert.equal((await new SyncPush(new SyncQueue(db),db).pushPending(broken as any)).failedCount,1);
  const head=pg.query('SELECT sync_head()');
  await db.outbox.toCollection().modify({nextAttemptAt:null});
  assert.equal((await new SyncPush(new SyncQueue(db),db).pushPending(transport as any)).pushedCount,1);
  assert.equal(pg.query('SELECT sync_head()'),head);
});
test('F003: causal offline edits advance base only after predecessor ACK despite reversed clocks',async()=>{
  const db=local(),row=await created();
  await edit(db,row,'First','2099-01-01T00:00:00Z');
  await edit(db,row,'Second','1900-01-01T00:00:00Z');
  const push=new SyncPush(new SyncQueue(db),db);
  assert.equal((await push.pushPending(pg.client() as any)).pushedCount,1);
  assert.equal((await db.leads.get(row.id))!.businessName,'Second');
  assert.equal((await push.pushPending(pg.client() as any)).pushedCount,1);
  assert.equal(pg.query(`SELECT to_jsonb(leads) FROM leads WHERE id=${quote(row.id)}`).business_name,'Second');
});
test('F003: revision-window pull ignores future timestamps and includes later commits on next run',async()=>{
  const db=local(),row=await created(),pull=new SyncPull(db);
  const head=pg.query('SELECT sync_head()');
  const newer=await created();
  const bounded=await pull.pullEntityChanges(pg.client() as any,'leads',null,undefined,head);
  assert.ok(bounded.records.some(r=>r.id===row.id));assert.ok(!bounded.records.some(r=>r.id===newer.id));
  const result=await pull.pullAllChanges(revisionCursor(head),pg.client() as any);
  assert.ok(await db.leads.get(newer.id));assert.match(result.newCursor!,/^revision:1:/);
  const legacy=await pull.pullAllChanges('2099-01-01T00:00:00Z',pg.client() as any);
  assert.ok(legacy.pulledCount>0);
});
test('F003 SQL: conditional delete rejects stale base, then deletes idempotently',async()=>{
  const row=await created(),p={id:row.id,organization_id:org};
  const changed=await mutate({...p,business_name:'New'},row.sync_revision);
  assert.equal((await mutate(p,row.sync_revision,'DELETE')).data.status,'CONFLICT');
  const id=randomUUID();
  assert.equal((await mutate(p,changed.data.record.sync_revision,'DELETE',id)).data.status,'APPLIED');
  assert.equal((await mutate(p,changed.data.record.sync_revision,'DELETE',id)).data.status,'APPLIED');
});

test('F003 SQL: retry of a lost CREATE response after deletion cannot resurrect the UUID',async()=>{
  const payload=wire(),id=randomUUID();
  const first=await mutate(payload,0,'CREATE',id);
  assert.equal(first.data.status,'APPLIED');
  await mutate({id:payload.id,organization_id:org},first.data.record.sync_revision,'DELETE');
  const retry=await mutate(payload,0,'CREATE',id);
  assert.equal(retry.data.status,'CONFLICT');
  assert.equal(pg.query(`SELECT count(*) FROM leads WHERE id=${quote(payload.id)}`),0);
});

test('F003 SQL: counter allocation is commit-ordered, not sequence allocation order',async()=>{
  const oldHead=pg.query('SELECT sync_head()');
  const pending=pg.heldTransaction(`BEGIN;
    INSERT INTO leads(id,organization_id,business_name,phone,address,locality,created_by,assigned_to)
    VALUES (${quote(randomUUID())},${quote(org)},'Held','9876543210','A','L',${quote(actor)},${quote(actor)}) RETURNING sync_revision;
    SELECT pg_sleep(1); COMMIT;`);
  await pending.started;
  assert.equal(pg.query('SELECT sync_head()'),oldHead,'head excludes uncommitted revision');
  const later=await created(); // waits for held organization's counter lock
  await pending.done;
  assert.equal(later.sync_revision,oldHead+2);
  assert.equal(pg.query('SELECT sync_head()'),oldHead+2);
});

test('F003: more than 500 rows sharing migration revision zero are not skipped',async()=>{
  // Existing profiles predate the additive migration and carry zero.
  const result=await new SyncPull(local()).pullEntityChanges(pg.client() as any,'profiles',null);
  assert.equal(result.records.filter(r=>r.sync_revision===0).length,2);
  const legacy=await new SyncPull(local()).pullEntityChanges(pg.client() as any,'leads',null);
  assert.equal(legacy.records.filter(r=>r.sync_revision===0).length,501);
  // New real rows exercise keyset paging across the 500-row boundary.
  pg.raw(`INSERT INTO leads(organization_id,business_name,phone,address,locality,created_by,assigned_to)
    SELECT ${quote(org)},'Page '||n,'9000000000','A','L',${quote(actor)},${quote(actor)} FROM generate_series(1,501) n;`);
  const rows=await new SyncPull(local()).pullEntityChanges(pg.client() as any,'leads',null);
  assert.equal(rows.records.filter(r=>r.business_name.startsWith('Page ')).length,501);
  assert.equal(new Set(rows.records.map(r=>r.id)).size,rows.records.length);
});

test('F003 SQL: append-only retry, verified duration, and deletion cascades preserve behavior',async()=>{
  const lead=await created(),client=pg.client();
  const activity={id:randomUUID(),organization_id:org,lead_id:lead.id,user_id:actor,activity_type:'LEAD_CREATED'};
  const args={entity:'activities',operation:'CREATE',mutation_id:randomUUID(),expected_revision:0,payload:activity};
  const first=await client.rpc('sync_mutate',args);assert.equal(first.error,null);
  assert.deepEqual((await client.rpc('sync_mutate',args)).data,first.data);
  const call={id:randomUUID(),organization_id:org,lead_id:lead.id,user_id:actor,started_at:new Date().toISOString(),outcome:'CONNECTED',duration_seconds:120,verification_status:'VERIFIED'};
  const c=await client.rpc('sync_mutate',{entity:'call_records',operation:'CREATE',mutation_id:randomUUID(),expected_revision:0,payload:call});
  assert.equal(c.error,null);
  const downgrade=await client.rpc('sync_mutate',{entity:'call_records',operation:'UPDATE',mutation_id:randomUUID(),expected_revision:c.data.record.sync_revision,payload:{...call,duration_seconds:0,verification_status:'UNVERIFIED'}});
  assert.equal(downgrade.error,null);assert.equal(downgrade.data.record.duration_seconds,120);
  const deletion=await mutate({id:lead.id,organization_id:org},lead.sync_revision,'DELETE');assert.equal(deletion.error,null);
  assert.equal(pg.query(`SELECT count(*) FROM call_records WHERE id=${quote(call.id)}`),0);
  assert.equal(pg.query(`SELECT to_jsonb(activities) FROM activities WHERE id=${quote(activity.id)}`).lead_id,null);
});

test('F003: delayed Realtime delete cannot remove a newer revision and conflicts survive server deletion',async()=>{
  const db=local(),row=await created();
  const update=await mutate({id:row.id,organization_id:org,business_name:'Newer'},row.sync_revision);
  RealtimeService.setCustomDatabase(db);
  try {
    await RealtimeService.handleIncomingPostgresChange('leads','INSERT',update.data.record);
    await RealtimeService.handleIncomingPostgresChange('leads','DELETE',row);
    assert.equal((await db.leads.get(row.id))!.businessName,'Newer');
    const item=await edit(db,update.data.record,'Pending edit','2099-01-01T00:00:00Z');
    await RealtimeService.handleIncomingPostgresChange('leads','DELETE',update.data.record);
    assert.equal(await db.leads.get(row.id),undefined);
    assert.equal((await db.outbox.get(item.id))!.payload.businessName,'Pending edit');
    assert.equal((await db.outbox.get(item.id))!.status,'DEAD_LETTER');
  } finally {RealtimeService.setCustomDatabase(null);}
});

test('F003: simultaneous Realtime callbacks cannot roll back the stored revision',async()=>{
  const db=local(),row=await created();
  const second=await mutate({id:row.id,organization_id:org,business_name:'Revision 2'},row.sync_revision);
  const third=await mutate({id:row.id,organization_id:org,business_name:'Revision 3'},second.data.record.sync_revision);
  RealtimeService.setCustomDatabase(db);
  try {
    await Promise.all([
      RealtimeService.handleIncomingPostgresChange('leads','UPDATE',third.data.record),
      RealtimeService.handleIncomingPostgresChange('leads','UPDATE',second.data.record),
    ]);
    assert.equal((await db.leads.get(row.id))!.serverRevision,third.data.record.sync_revision);
  } finally {RealtimeService.setCustomDatabase(null);}
});

test('F003: malformed ACK never discards the unaccepted outbox payload',async()=>{
  const db=local(),row=await created(),item=await edit(db,row,'Pending','2099-01-01T00:00:00Z');
  const malformed={rpc:async()=>({data:{status:'APPLIED',record:null},error:null})};
  assert.equal((await new SyncPush(new SyncQueue(db),db).pushPending(malformed as any)).failedCount,1);
  assert.equal((await db.outbox.get(item.id))!.status,'FAILED');
  assert.equal((await db.outbox.get(item.id))!.payload.businessName,'Pending');
});

test('F003: immediate profile deletion and queued replay share one conditional mutation',async()=>{
  const db=local();
  const profiles=await new SyncPull(db).pullEntityChanges(pg.client() as any,'profiles',null);
  for(const row of profiles.records) await db.users.put(SyncPull.transformFromPgRecord('profiles',row) as any);
  AgentManagementService.setCustomDatabase(db);setCustomSupabaseClient(pg.client() as any);
  try {
    await AgentManagementService.deleteAgent((await db.users.get(actor))!,agent);
    const remote=pg.query(`SELECT to_jsonb(profiles) FROM profiles WHERE id=${quote(agent)}`);
    assert.equal(remote.status,'INACTIVE');
    const result=await new SyncPush(new SyncQueue(db),db).pushPending(pg.client() as any);
    assert.equal(result.failedCount,0);
    assert.equal(pg.query(`SELECT to_jsonb(profiles) FROM profiles WHERE id=${quote(agent)}`).sync_revision,remote.sync_revision);
  } finally {AgentManagementService.setCustomDatabase(null);setCustomSupabaseClient(null);}
});
