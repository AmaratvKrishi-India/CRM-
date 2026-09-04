import 'fake-indexeddb/auto';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { SalesCRMDatabase } from '../src/db/database.ts';
import { createCRMDataLayer } from '../src/db/index.ts';
import { SyncQueue } from '../src/services/sync/syncQueue.ts';
import { SyncPush } from '../src/services/sync/syncPush.ts';
import { SyncPull } from '../src/services/sync/syncPull.ts';
import { SyncConflictResolver } from '../src/services/sync/syncConflictResolver.ts';
import { CallLifecycleService } from '../src/services/callLifecycleService.ts';
import { LeadAssignmentService } from '../src/services/leadAssignmentService.ts';
import { AgentManagementService } from '../src/services/agentManagementService.ts';
import { RealtimeService } from '../src/services/realtime/realtimeService.ts';
import { setCustomSupabaseClient } from '../src/services/supabaseClient.ts';
import type { Lead, User } from '../src/db/types.ts';

function freshDb(
  name: string,
  scope = { organizationId: 'org-bugfix-01', userId: 'admin-bugfix-01', role: 'ADMIN' as const }
) {
  const db = new SalesCRMDatabase(`BugfixRegression_${Date.now()}_${name}`, scope);
  const dataLayer = createCRMDataLayer(db);
  return { db, dataLayer };
}

const adminUser: User = {
  id: 'admin-bugfix-01',
  name: 'Bugfix Admin',
  email: 'admin-bugfix@amaratvkrishi.com',
  role: 'ADMIN',
  status: 'ACTIVE',
  organizationId: 'org-bugfix-01',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  isSynced: 1,
  deletedAt: null,
};

describe('BUG-1: call extended fields persist end-to-end', () => {
  async function runCall(input: Record<string, any>) {
    const { db, dataLayer } = freshDb('bug1', {
      organizationId: 'org-bugfix-01',
      userId: 'agent-bug1',
      role: 'AGENT',
    });
    CallLifecycleService.setCustomDatabase(db);
    const lead: Lead = {
      id: 'lead-bug1',
      businessName: 'Bug1 Gym',
      phone: '9811100001',
      status: 'NEW',
      locality: 'Hazratganj',
      isSynced: 1,
      deletedAt: null,
      assignedTo: 'agent-bug1',
      createdBy: 'agent-bug1',
      updatedBy: 'agent-bug1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.leads.add(lead);
    const agent: User = { ...adminUser, id: 'agent-bug1', role: 'AGENT', email: 'agent-bug1@amaratvkrishi.com' };
    await db.users.add(agent);

    const attempt = CallLifecycleService.initiateDial(agent, lead);
    const result = await CallLifecycleService.completeCall(agent, input);
    return { db, dataLayer, attempt, result };
  }

  it('reported-only call stores dialAttemptId, callStatus, reportedDurationSeconds in Dexie AND outbox payload', async () => {
    const { db, attempt, result } = await runCall({
      outcome: 'CONNECTED',
      quickRemark: 'Interested',
      reportedDurationSeconds: 120,
    });

    const stored = await db.callRecords.get(result.callRecord.id);
    assert.ok(stored, 'CallRecord persisted in Dexie');
    assert.strictEqual(stored.dialAttemptId, attempt.attemptId);
    assert.strictEqual(stored.callStatus, 'CONNECTED');
    assert.strictEqual(stored.reportedDurationSeconds, 120);
    assert.strictEqual(stored.durationSeconds, 0, 'verified duration stays 0 without telecom source');
    assert.strictEqual(stored.verificationStatus, 'UNVERIFIED');

    const outbox = await db.outbox.where('entityId').equals(result.callRecord.id).toArray();
    assert.strictEqual(outbox.length, 1);
    assert.strictEqual(outbox[0].payload.dialAttemptId, attempt.attemptId);
    assert.strictEqual(outbox[0].payload.callStatus, 'CONNECTED');
    assert.strictEqual(outbox[0].payload.reportedDurationSeconds, 120);

    // Push transform maps extended fields to snake_case columns
    const pg = SyncPush.transformToPgRecord('call_records', outbox[0].payload, 'org-bugfix-01');
    assert.strictEqual(pg.dial_attempt_id, attempt.attemptId);
    assert.strictEqual(pg.call_status, 'CONNECTED');
    assert.strictEqual(pg.reported_duration_seconds, 120);
    assert.strictEqual(pg.duration_seconds, 0);

    // Pull transform maps them back (round trip to a second client)
    const local = SyncPull.transformFromPgRecord('call_records', pg);
    assert.strictEqual(local.dialAttemptId, attempt.attemptId);
    assert.strictEqual(local.callStatus, 'CONNECTED');
    assert.strictEqual(local.reportedDurationSeconds, 120);

    CallLifecycleService.setCustomDatabase(null);
    await db.close();
  });

  it('verified call keeps verified duration distinct from reported duration', async () => {
    const { db, result } = await runCall({
      outcome: 'CONNECTED',
      verifiedDurationSeconds: 65,
      reportedDurationSeconds: 70,
    });
    const stored = await db.callRecords.get(result.callRecord.id);
    assert.strictEqual(stored.verificationStatus, 'VERIFIED');
    assert.strictEqual(stored.durationSeconds, 65);
    assert.strictEqual(stored.reportedDurationSeconds, 70);
    CallLifecycleService.setCustomDatabase(null);
    await db.close();
  });

  it('zero verified duration and missing duration both persist correctly', async () => {
    const zero = await runCall({ outcome: 'CONNECTED', verifiedDurationSeconds: 0 });
    const zeroStored = await zero.db.callRecords.get(zero.result.callRecord.id);
    assert.strictEqual(zeroStored.verificationStatus, 'VERIFIED');
    assert.strictEqual(zeroStored.durationSeconds, 0);
    assert.strictEqual(zeroStored.reportedDurationSeconds, null);
    CallLifecycleService.setCustomDatabase(null);
    await zero.db.close();

    const missing = await runCall({ outcome: 'NO_ANSWER' });
    const missingStored = await missing.db.callRecords.get(missing.result.callRecord.id);
    assert.strictEqual(missingStored.verificationStatus, 'UNVERIFIED');
    assert.strictEqual(missingStored.durationSeconds, 0);
    assert.strictEqual(missingStored.reportedDurationSeconds, null);
    assert.strictEqual(missingStored.callStatus, 'NOT_CONNECTED');
    CallLifecycleService.setCustomDatabase(null);
    await missing.db.close();
  });
});

describe('BUG-8: DELETE outbox operations are pushed as DELETE, never upsert', () => {
  function makeFakeClient(ops: any[], opts: { deleteError?: string } = {}) {
    return {
      from(table: string) {
        return {
          upsert: async (records: any) => {
            ops.push({ op: 'upsert', table, ids: (Array.isArray(records) ? records : [records]).map((r: any) => r.id) });
            return { error: null };
          },
          delete: () => {
            let recorded = false;
            const query: any = {
              eq: (col: string, val: string) => {
                if (col === 'id' && !recorded) {
                  ops.push({ op: 'delete', table, id: val });
                  recorded = true;
                }
                return query;
              },
              then: (resolve: (value: unknown) => void) =>
                resolve({ error: opts.deleteError ? { message: opts.deleteError } : null }),
            };
            return query;
          },
        };
      },
    };
  }

  it('hard delete produces DELETE outbox item; push deletes cloud row; retry is idempotent', async () => {
    const { db, dataLayer } = freshDb('bug8');
    const lead = await dataLayer.leads.createLead({
      businessName: 'Delete Me Gym',
      phone: '9811100008',
      status: 'NEW',
      organizationId: 'org-bugfix-01',
      createdBy: adminUser.id,
    });

    await dataLayer.leads.hardDeleteLead(lead.id);
    assert.strictEqual(await db.leads.get(lead.id), undefined, 'lead gone locally');

    const items = await db.outbox.where('entityId').equals(lead.id).sortBy('createdAt');
    const del = items.find((i) => i.operation === 'DELETE');
    assert.ok(del, 'DELETE outbox item exists');

    const ops: any[] = [];
    const push = new SyncPush(dataLayer.syncQueue, db);
    const res = await push.pushPending(makeFakeClient(ops) as any);
    assert.strictEqual(res.failedCount, 0, `push errors: ${res.errors.join('; ')}`);

    // CREATE must flush as upsert first, DELETE must execute as delete after
    assert.strictEqual(ops[0].op, 'upsert');
    assert.deepStrictEqual(ops[0].ids, [lead.id]);
    assert.strictEqual(ops[1].op, 'delete');
    assert.strictEqual(ops[1].id, lead.id);
    assert.strictEqual(ops.filter((o) => o.op === 'upsert').length, 1, 'DELETE never became an upsert');

    const after = await db.outbox.toArray();
    assert.ok(after.every((i) => i.status === 'SYNCED'), 'all items marked synced');

    // Retry: nothing pending, idempotent
    const res2 = await push.pushPending(makeFakeClient([]) as any);
    assert.strictEqual(res2.pushedCount, 0);

    await db.close();
  });

  it('failed DELETE is marked FAILED and retried, not dropped', async () => {
    const { db, dataLayer } = freshDb('bug8b');
    const lead = await dataLayer.leads.createLead({
      businessName: 'Retry Delete Gym',
      phone: '9811100009',
      status: 'NEW',
      organizationId: 'org-bugfix-01',
      createdBy: adminUser.id,
    });
    await dataLayer.leads.hardDeleteLead(lead.id);

    const push = new SyncPush(dataLayer.syncQueue, db);
    const res = await push.pushPending(makeFakeClient([], { deleteError: 'simulated 500' }) as any);
    assert.strictEqual(res.failedCount, 1);

    const failed = await db.outbox.where('operation').equals('DELETE').first();
    assert.strictEqual(failed.status, 'FAILED');

    // Retry succeeds (delete of missing row is a no-op success on the server)
    await db.outbox.update(failed.id, { nextAttemptAt: new Date(0).toISOString() });
    const res2 = await push.pushPending(makeFakeClient([]) as any);
    assert.strictEqual(res2.failedCount, 0);
    const synced = await db.outbox.where('operation').equals('DELETE').first();
    assert.strictEqual(synced.status, 'SYNCED');

    await db.close();
  });
});

describe('BUG-2: message_history realtime reconciliation', () => {
  it('INSERT event stores row locally; duplicate event does not duplicate', async () => {
    const { db } = freshDb('bug2');
    RealtimeService.setCustomDatabase(db);

    const row = {
      id: 'msg-rt-001',
      organization_id: 'org-bugfix-01',
      lead_id: 'lead-rt-001',
      user_id: null,
      template_id: null,
      channel: 'WHATSAPP',
      recipient_phone: '9811100002',
      message_content: 'Hello from realtime',
      sent_status: 'SENT',
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    await RealtimeService.handleIncomingPostgresChange('message_history', 'INSERT', row);
    const stored = await db.messageHistory.get('msg-rt-001');
    assert.ok(stored, 'message_history row reconciled into Dexie');
    assert.strictEqual(stored.recipientPhone, '9811100002');

    await RealtimeService.handleIncomingPostgresChange('message_history', 'INSERT', row);
    const count = await db.messageHistory.where('id').equals('msg-rt-001').count();
    assert.strictEqual(count, 1, 'no duplicate on repeated event');

    RealtimeService.setCustomDatabase(null);
    await db.close();
  });
});

describe('BUG-4: data write + outbox enqueue are atomic', () => {
  it('enqueue failure rolls back the data write (no partial offline mutation)', async () => {
    const { db, dataLayer } = freshDb('bug4');
    const originalEnqueue = SyncQueue.prototype.enqueue;

    try {
      SyncQueue.prototype.enqueue = async function () {
        throw new Error('simulated outbox failure');
      };

      await assert.rejects(
        () =>
          dataLayer.leads.createLead({
            businessName: 'Atomic Gym',
            phone: '9811100004',
            status: 'NEW',
            organizationId: 'org-bugfix-01',
          }),
        /simulated outbox failure/
      );

      const leadCount = await db.leads.count();
      assert.strictEqual(leadCount, 0, 'lead row must not persist when enqueue fails');
      const outboxCount = await db.outbox.count();
      assert.strictEqual(outboxCount, 0, 'outbox must be empty when enqueue fails');
    } finally {
      SyncQueue.prototype.enqueue = originalEnqueue;
    }

    // Success path: both persist
    const lead = await dataLayer.leads.createLead({
      businessName: 'Atomic Gym OK',
      phone: '9811100005',
      status: 'NEW',
      organizationId: 'org-bugfix-01',
    });
    assert.ok(await db.leads.get(lead.id));
    assert.strictEqual((await db.outbox.where('entityId').equals(lead.id).count()), 1);

    await db.close();
  });

  it('remark and activity repositories are also atomic', async () => {
    const { db, dataLayer } = freshDb('bug4b');
    const lead = await dataLayer.leads.createLead({
      businessName: 'Atomic Gym 2',
      phone: '9811100006',
      status: 'NEW',
      organizationId: 'org-bugfix-01',
    });

    const originalEnqueue = SyncQueue.prototype.enqueue;
    try {
      SyncQueue.prototype.enqueue = async function () {
        throw new Error('simulated outbox failure');
      };

      await assert.rejects(() => dataLayer.remarks.addRemark({ leadId: lead.id, content: 'note' }));
      assert.strictEqual(await db.remarks.count(), 0, 'remark must roll back');

      await assert.rejects(
        () => dataLayer.activities.logActivity({ userId: adminUser.id, activityType: 'CALL_LOGGED' })
      );
      assert.strictEqual(await db.activities.count(), 0, 'activity must roll back');
    } finally {
      SyncQueue.prototype.enqueue = originalEnqueue;
    }

    await db.close();
  });
});

describe('BUG-9: createAgent propagates server errors instead of creating orphan local agents', () => {
  async function setup() {
    const { db } = freshDb('bug9');
    AgentManagementService.setCustomDatabase(db);
    await db.users.add(adminUser);
    return db;
  }

  it('5xx/relay error propagates and no local agent is created', async () => {
    const db = await setup();
    const relayError = Object.assign(new Error('Relay Error'), {
      name: 'FunctionsRelayError',
      context: { status: 502 },
    });
    setCustomSupabaseClient({ functions: { invoke: async () => ({ data: null, error: relayError }) } } as any);

    await assert.rejects(
      () => AgentManagementService.createAgent(adminUser, { name: 'X', email: 'x@bugfix.com', password: 'secret123' }),
      /Agent provisioning failed.*502/
    );
    assert.strictEqual(await db.users.where('email').equals('x@bugfix.com').count(), 0, 'no orphan local agent');

    setCustomSupabaseClient(null);
    AgentManagementService.setCustomDatabase(null);
    await db.close();
  });

  it('genuine network-unreachable error does not create an orphan local agent', async () => {
    const db = await setup();
    const fetchError = Object.assign(new Error('fetch failed'), { name: 'FunctionsFetchError' });
    setCustomSupabaseClient({ functions: { invoke: async () => ({ data: null, error: fetchError }) } } as any);

    await assert.rejects(
      () => AgentManagementService.createAgent(adminUser, {
        name: 'Offline Agent',
        email: 'offline@bugfix.com',
        password: 'secret123',
      }),
      /server connection|failed on the server/i
    );
    assert.strictEqual(
      await db.users.where('email').equals('offline@bugfix.com').count(),
      0,
      'no local-only agent is created when offline'
    );

    setCustomSupabaseClient(null);
    AgentManagementService.setCustomDatabase(null);
    await db.close();
  });

  it('duplicate account error still propagates', async () => {
    const db = await setup();
    setCustomSupabaseClient({
      functions: { invoke: async () => ({ data: { error: 'User already exists' }, error: null }) },
    } as any);

    await assert.rejects(
      () => AgentManagementService.createAgent(adminUser, { name: 'Dup', email: 'dup@bugfix.com', password: 'secret123' }),
      /already exists/
    );
    assert.strictEqual(await db.users.where('email').equals('dup@bugfix.com').count(), 0);

    setCustomSupabaseClient(null);
    AgentManagementService.setCustomDatabase(null);
    await db.close();
  });
});

describe('BUG-3: assignLead/unassignLead return null instead of fake Activity', () => {
  it('no-op assign and unassign return auditActivity === null', async () => {
    const { db, dataLayer } = freshDb('bug3');
    LeadAssignmentService.setCustomDatabase(db);
    await db.users.add(adminUser);
    const agent: User = { ...adminUser, id: 'agent-bug3', role: 'AGENT', email: 'agent-bug3@amaratvkrishi.com' };
    await db.users.add(agent);

    const lead = await dataLayer.leads.createLead({
      businessName: 'Assign Gym',
      phone: '9811100003',
      status: 'NEW',
      organizationId: 'org-bugfix-01',
      createdBy: adminUser.id,
      assignedTo: agent.id,
    });

    // Already assigned to same agent: no new activity, must be null not {}
    const res = await LeadAssignmentService.assignLead(adminUser, lead.id, agent.id);
    assert.strictEqual(res.auditActivity, null);

    // Unassign, then unassign again: second call returns null
    await LeadAssignmentService.unassignLead(adminUser, lead.id);
    const res2 = await LeadAssignmentService.unassignLead(adminUser, lead.id);
    assert.strictEqual(res2.auditActivity, null);

    LeadAssignmentService.setCustomDatabase(null);
    await db.close();
  });
});

describe('BUG-5: LWW tie-break is deterministic (REMOTE wins) and recorded', () => {
  it('equal timestamps resolve to REMOTE with a recorded conflict', () => {
    const ts = '2026-08-20T10:00:00.000Z';
    const local = { id: 'lead-tie', businessName: 'Local', updatedAt: ts };
    const remote = { id: 'lead-tie', businessName: 'Remote', updated_at: ts };

    const res = SyncConflictResolver.resolveMutable('leads', local, remote);
    assert.strictEqual(res.winner, 'REMOTE');
    assert.strictEqual(res.data.businessName, 'Remote');
    assert.ok(res.conflict, 'tie must be recorded as a conflict');
    assert.strictEqual(res.conflict?.resolution, 'REMOTE_WON');
  });

  it('strictly newer local still wins', () => {
    const local = { id: 'lead-tie2', businessName: 'Local', updatedAt: '2026-08-20T10:01:00.000Z' };
    const remote = { id: 'lead-tie2', businessName: 'Remote', updated_at: '2026-08-20T10:00:00.000Z' };
    const res = SyncConflictResolver.resolveMutable('leads', local, remote);
    assert.strictEqual(res.winner, 'LOCAL');
  });
});

describe('BUG-7: searchAndFilterLeads uses compound indexes for single-value filters', () => {
  it('single status filter returns exactly the matching subset with correct total', async () => {
    const { db, dataLayer } = freshDb('bug7');
    const statuses = ['NEW', 'NEW', 'INTERESTED', 'INTERESTED', 'INTERESTED', 'CUSTOMER'] as const;
    for (let i = 0; i < statuses.length; i++) {
      await dataLayer.leads.createLead({
        businessName: `Index Gym ${i}`,
        phone: `98111000${20 + i}`,
        status: statuses[i],
        locality: i % 2 === 0 ? 'Gomti Nagar' : 'Alambagh',
        organizationId: 'org-bugfix-01',
      });
    }
    // One soft-deleted INTERESTED lead must be excluded
    const all = await db.leads.toArray();
    const victim = all.find((l) => l.status === 'INTERESTED' && l.locality === 'Gomti Nagar')!;
    await dataLayer.leads.softDeleteLead(victim.id);

    const res = await dataLayer.leads.searchAndFilterLeads({ status: 'INTERESTED' });
    assert.strictEqual(res.total, 2, 'soft-deleted lead excluded from indexed path');
    assert.ok(res.leads.every((l) => l.status === 'INTERESTED' && l.deletedAt === null));

    const byLocality = await dataLayer.leads.searchAndFilterLeads({ locality: 'Gomti Nagar' });
    // victim is a Gomti Nagar lead, so 3 created - 1 soft-deleted = 2
    assert.strictEqual(byLocality.total, 2);

    const all2 = await dataLayer.leads.searchAndFilterLeads({});
    assert.strictEqual(all2.total, 5);

    await db.close();
  });
});

describe('BUG-10: Sync Now button exposes an accessible name', () => {
  it('SyncStatusBadge button has aria-label', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'components', 'sync', 'SyncStatusBadge.tsx'),
      'utf8'
    );
    assert.ok(src.includes('aria-label="Sync Now"'), 'aria-label present on Sync Now button');
  });
});

describe('BUG-6: dead SyncHelper removed from the data layer', () => {
  it('data layer no longer exposes sync and the file is deleted', () => {
    const { db, dataLayer } = freshDb('bug6');
    assert.strictEqual('sync' in dataLayer, false, 'SyncHelper removed from data layer');
    assert.strictEqual(
      fs.existsSync(path.join(__dirname, '..', 'src', 'db', 'services', 'syncHelper.ts')),
      false,
      'syncHelper.ts deleted'
    );
    db.close();
  });
});
