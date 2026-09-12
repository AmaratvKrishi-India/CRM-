import 'fake-indexeddb/auto';
import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { SalesCRMDatabase } from '../src/db/database.ts';
import { LeadRepository } from '../src/db/repositories/leadRepository.ts';
import { UserRepository } from '../src/db/repositories/userRepository.ts';
import { AgentManagementService } from '../src/services/agentManagementService.ts';
import { setCustomSupabaseClient } from '../src/services/supabaseClient.ts';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '../src/db/types.ts';
const databases: SalesCRMDatabase[] = [];
const confirmation = { recoveryExportSaved: true, acknowledgePermanentDeletion: true };
async function fixture(role: 'ADMIN' | 'AGENT' = 'ADMIN') {
  const db = new SalesCRMDatabase(`F018_${crypto.randomUUID()}`, { organizationId: 'org', userId: 'actor', role });
  databases.push(db); const leads = new LeadRepository(db);
  const lead = await leads.createLead({ businessName: 'Audit Gym', phone: '9876543210', address: 'Lucknow' });
  return { db, leads, lead };
}
afterEach(async () => { AgentManagementService.setCustomDatabase(null); setCustomSupabaseClient(null); for (const db of databases.splice(0)) { db.close(); await db.delete(); } });
test('F018 archive and restore each retain exactly one attributable event and outbox entry', async () => {
  const { db, leads, lead } = await fixture();
  await leads.softDeleteLead(lead.id); await leads.softDeleteLead(lead.id);
  await leads.restoreLead(lead.id); await leads.restoreLead(lead.id);
  const events = await db.activities.toArray();
  assert.deepEqual(events.map(row => row.metadata.action).sort(), ['ARCHIVED', 'RESTORED']);
  for (const event of events) {
    assert.equal(event.userId, 'actor'); assert.equal(event.leadId, null); assert.equal(event.metadata.leadId, lead.id);
    assert.equal(await db.outbox.where('entityId').equals(event.id).count(), 1);
  }
  assert.equal((await db.leads.get(lead.id))?.deletedAt, null);
});
test('F018 audit failure rolls back archive and both outbox mutations', async () => {
  const { db, leads, lead } = await fixture(); const before = await db.outbox.toArray();
  const fail = () => { throw new Error('audit storage failure'); };
  db.activities.hook('creating', fail);
  await assert.rejects(leads.softDeleteLead(lead.id), /audit storage failure/);
  db.activities.hook('creating').unsubscribe(fail);
  assert.equal((await db.leads.get(lead.id))?.deletedAt, null);
  assert.deepEqual(await db.outbox.toArray(), before); assert.equal(await db.activities.count(), 0);
});
test('F018 concurrent archive requests produce one retained transition', async () => {
  const { db, leads, lead } = await fixture();
  await Promise.all([leads.softDeleteLead(lead.id), leads.softDeleteLead(lead.id)]);
  assert.equal(await db.activities.count(), 1);
});
test('F022 purge requires admin, explicit recovery acknowledgement, archive and synced work', async () => {
  const { db, leads, lead } = await fixture();
  await assert.rejects(leads.hardDeleteLead(lead.id), /recovery export/);
  await assert.rejects(leads.hardDeleteLead(lead.id, confirmation), /Archive/);
  await leads.softDeleteLead(lead.id);
  await assert.rejects(leads.hardDeleteLead(lead.id, confirmation), /Sync or recover/);
  await db.outbox.toCollection().modify({ status: 'SYNCED' });
  await leads.hardDeleteLead(lead.id, confirmation);
  assert.equal(await db.leads.get(lead.id), undefined);
  const events = await db.activities.toArray();
  assert.deepEqual(events.map(row => row.metadata.action).sort(), ['ARCHIVED', 'PURGED']);
  const agent = await fixture('AGENT');
  await assert.rejects(agent.leads.hardDeleteLead(agent.lead.id, confirmation), /Only administrators/);
});
test('F022 purge audit failure retains all lead data', async () => {
  const { db, leads, lead } = await fixture(); await leads.softDeleteLead(lead.id);
  await db.outbox.toCollection().modify({ status: 'SYNCED' });
  const before = await db.outbox.toArray();
  const fail = () => { throw new Error('audit unavailable'); }; db.activities.hook('creating', fail);
  await assert.rejects(leads.hardDeleteLead(lead.id, confirmation), /audit unavailable/);
  db.activities.hook('creating').unsubscribe(fail);
  assert.ok(await db.leads.get(lead.id)); assert.deepEqual(await db.outbox.toArray(), before);
});
for (const action of ['update', 'activate', 'deactivate', 'delete'] as const) {
  test(`F018 successful agent ${action} records one attributable event`, async () => {
    const { db } = await fixture();
    const agent = await new UserRepository(db).createUser({ name: 'Agent', email: 'agent@example.test', phone: '', role: 'AGENT' });
    AgentManagementService.setCustomDatabase(db);
    // Node does not supply Vite's import.meta.env. Keep this local atomicity
    // test independent of configuration and the separately tested F003 RPC.
    setCustomSupabaseClient({ rpc: async () => ({ data: { status: 'APPLIED' }, error: null }) } as unknown as SupabaseClient);
    const actor = { id: 'actor', organizationId: 'org', role: 'ADMIN', status: 'ACTIVE' } as User;
    const run = { update: () => AgentManagementService.updateAgent(actor, agent.id, { name: 'Changed' }),
      activate: () => AgentManagementService.activateAgent(actor, agent.id),
      deactivate: () => AgentManagementService.deactivateAgent(actor, agent.id),
      delete: () => AgentManagementService.deleteAgent(actor, agent.id) };
    const result = await run[action]();
    assert.equal(await db.activities.count(), 1); assert.equal(result.auditActivity.userId, actor.id);
    assert.equal(result.auditActivity.metadata.agentId, agent.id);
    assert.equal(await db.outbox.where('entityId').equals(result.auditActivity.id).count(), 1);
  });
  test(`F018 ${action} agent and audit are atomic on audit failure`, async () => {
    const { db } = await fixture(); const users = new UserRepository(db);
    const agent = await users.createUser({ name: 'Agent', email: 'agent@example.test', phone: '', role: 'AGENT' });
    AgentManagementService.setCustomDatabase(db);
    const actor = { id: 'actor', organizationId: 'org', role: 'ADMIN', status: 'ACTIVE' } as User;
    const before = await db.outbox.toArray();
    const fail = () => { throw new Error('audit unavailable'); }; db.activities.hook('creating', fail);
    const run = { update: () => AgentManagementService.updateAgent(actor, agent.id, { name: 'Changed' }),
      activate: () => AgentManagementService.activateAgent(actor, agent.id),
      deactivate: () => AgentManagementService.deactivateAgent(actor, agent.id),
      delete: () => AgentManagementService.deleteAgent(actor, agent.id) };
    await assert.rejects(run[action](), /audit unavailable/);
    db.activities.hook('creating').unsubscribe(fail);
    assert.deepEqual(await db.users.get(agent.id), agent); assert.deepEqual(await db.outbox.toArray(), before);
  });
}
