import 'fake-indexeddb/auto';
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { SalesCRMDatabase } from '../src/db/database.ts';
import { createCRMDataLayer } from '../src/db/index.ts';
import { BackupService } from '../src/services/backupService.ts';
import { SyncPush } from '../src/services/sync/syncPush.ts';
import type { SyncState } from '../src/services/sync/syncTypes.ts';

function freshDb(name: string) {
  const db = new SalesCRMDatabase(`NewBug002_${Date.now()}_${name}`, {
    organizationId: 'org-nb2',
    userId: 'admin-nb2',
    role: 'ADMIN',
  });
  const dataLayer = createCRMDataLayer(db);
  const backupService = new BackupService(db);
  return { db, dataLayer, backupService };
}

function makeFakeClient(ops: any[]) {
  return {
    from(table: string) {
      return {
        upsert: async (records: any) => {
          ops.push({
            op: 'upsert',
            table,
            ids: (Array.isArray(records) ? records : [records]).map((r: any) => r.id),
          });
          return { error: null };
        },
        delete: () => ({
          eq: async (_col: string, val: string) => {
            ops.push({ op: 'delete', table, id: val });
            return { error: null };
          },
        }),
      };
    },
  };
}

describe('NEW-BUG-002: merge restore must not drop outbox / syncState / bulk-assignment audits', () => {
  it('unsynced mutations survive merge restore and still push to cloud (outbox restored)', async () => {
    // Device A: offline mutation, never synced.
    const a = freshDb('nb2_device_a');
    const lead = await a.dataLayer.leads.createLead({
      businessName: 'Offline First Gym',
      phone: '9811100020',
      status: 'NEW',
      organizationId: 'org-nb2',
      createdBy: 'admin-nb2',
    });
    const pendingBefore = await a.db.outbox.where('status').equals('PENDING').count();
    assert.ok(pendingBefore >= 1, 'device A has pending outbox items before export');

    const payload = await a.backupService.generateBackupPayload();
    assert.ok(payload.data.outbox && payload.data.outbox.length >= 1, 'backup contains outbox items');

    // Device B: fresh database, merge restore via the UI-recommended path.
    const b = freshDb('nb2_device_b');
    await b.backupService.mergeRestore(payload);

    const restoredLead = await b.db.leads.get(lead.id);
    assert.ok(restoredLead, 'lead record merged into device B');

    const restoredOutbox = await b.db.outbox.where('entityId').equals(lead.id).toArray();
    assert.ok(
      restoredOutbox.length >= 1,
      'outbox items for the unsynced lead must survive merge restore (push is outbox-driven)'
    );

    // Device B reconnects: the mutation must actually reach the cloud.
    const ops: any[] = [];
    const push = new SyncPush(b.dataLayer.syncQueue, b.db);
    const res = await push.pushPending(makeFakeClient(ops) as any);
    assert.strictEqual(res.failedCount, 0, `push errors: ${res.errors.join('; ')}`);
    const leadUpserts = ops.filter(
      (o) => o.op === 'upsert' && o.table === 'leads' && o.ids.includes(lead.id)
    );
    assert.ok(
      leadUpserts.length >= 1,
      'unsynced lead mutation must be pushed to cloud after merge restore'
    );

    await a.db.close();
    await b.db.close();
  });

  it('pull cursor (syncState) survives merge restore so incremental pull continues', async () => {
    const a = freshDb('nb2_cursor_a');
    const cursorState: SyncState = {
      id: 'org-nb2:admin-nb2',
      deviceId: 'device-A',
      organizationId: 'org-nb2',
      userId: 'admin-nb2',
      lastSuccessfulSyncAt: '2026-08-20T10:00:00.000Z',
      lastPullCursor: '2026-08-20T10:00:00.000Z',
      lastPushAt: '2026-08-20T10:00:00.000Z',
      lastPullAt: '2026-08-20T10:00:00.000Z',
      lastSyncError: null,
      status: 'SYNCED',
    };
    await a.db.syncState.put(cursorState);

    const payload = await a.backupService.generateBackupPayload();
    assert.ok(payload.data.syncState && payload.data.syncState.length === 1, 'backup contains syncState');

    const b = freshDb('nb2_cursor_b');
    await b.backupService.mergeRestore(payload);

    const state = await b.db.syncState.get('org-nb2:admin-nb2');
    assert.ok(state, 'syncState row restored on device B');
    assert.strictEqual(state!.lastPullCursor, '2026-08-20T10:00:00.000Z', 'pull cursor preserved');

    await a.db.close();
    await b.db.close();
  });

  it('bulk assignment audits survive merge restore', async () => {
    const a = freshDb('nb2_baa_a');
    const now = new Date().toISOString();
    await a.db.bulkAssignmentAudits.add({
      id: 'baa-nb2-001',
      organizationId: 'org-nb2',
      performedBy: 'admin-nb2',
      targetAgentId: 'agent-nb2',
      selectedLeadCount: 10,
      successfulCount: 10,
      failedCount: 0,
      startedAt: now,
      completedAt: now,
      filterSnapshot: { status: 'NEW' },
      status: 'COMPLETED',
      errorSummary: null,
      createdAt: now,
      updatedAt: now,
      isSynced: 0,
      deletedAt: null,
    });

    const payload = await a.backupService.generateBackupPayload();
    assert.ok(
      payload.data.bulkAssignmentAudits && payload.data.bulkAssignmentAudits.length === 1,
      'backup contains bulk assignment audits'
    );

    const b = freshDb('nb2_baa_b');
    await b.backupService.mergeRestore(payload);

    const restored = await b.db.bulkAssignmentAudits.get('baa-nb2-001');
    assert.ok(restored, 'bulk assignment audit must survive merge restore');

    await a.db.close();
    await b.db.close();
  });

  it('merge restore is idempotent for outbox items (no duplicates on re-restore)', async () => {
    const a = freshDb('nb2_idem_a');
    await a.dataLayer.leads.createLead({
      businessName: 'Idempotent Gym',
      phone: '9811100021',
      status: 'NEW',
      organizationId: 'org-nb2',
      createdBy: 'admin-nb2',
    });
    const payload = await a.backupService.generateBackupPayload();

    const b = freshDb('nb2_idem_b');
    await b.backupService.mergeRestore(payload);
    const count1 = await b.db.outbox.count();
    assert.ok(count1 >= 1, 'outbox restored on first merge');

    await b.backupService.mergeRestore(payload);
    const count2 = await b.db.outbox.count();
    assert.strictEqual(count2, count1, 're-restoring the same backup must not duplicate outbox items');

    await a.db.close();
    await b.db.close();
  });

  it('merge restore keeps strictly-newer local outbox state (LWW, no clobber)', async () => {
    const a = freshDb('nb2_lww_a');
    const lead = await a.dataLayer.leads.createLead({
      businessName: 'LWW Gym',
      phone: '9811100022',
      status: 'NEW',
      organizationId: 'org-nb2',
      createdBy: 'admin-nb2',
    });
    const payload = await a.backupService.generateBackupPayload();

    const b = freshDb('nb2_lww_b');
    await b.backupService.mergeRestore(payload);

    // Device B then has a failed push attempt: local outbox state advances.
    const items = await b.db.outbox.toArray();
    const leadItem = items.find((i) => i.entityId === lead.id && i.operation === 'CREATE');
    assert.ok(leadItem, 'restored CREATE outbox item exists');
    await b.db.outbox.update(leadItem!.id, {
      retryCount: 3,
      status: 'FAILED',
      lastError: 'network down',
      updatedAt: new Date(Date.now() + 60_000).toISOString(),
    });

    // Re-restoring the older backup must not clobber the newer local state.
    await b.backupService.mergeRestore(payload);
    const after = await b.db.outbox.get(leadItem!.id);
    assert.strictEqual(after!.retryCount, 3, 'newer local retryCount preserved');
    assert.strictEqual(after!.status, 'FAILED', 'newer local status preserved');

    await a.db.close();
    await b.db.close();
  });
});
