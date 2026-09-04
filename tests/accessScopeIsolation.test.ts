import 'fake-indexeddb/auto';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SalesCRMDatabase } from '../src/db/database.ts';
import { createCRMDataLayer, pruneInaccessibleLocalData } from '../src/db/index.ts';
import { scopedDatabaseName, type AccessScope } from '../src/db/accessScope.ts';
import { BackupService } from '../src/services/backupService.ts';
import type { Lead } from '../src/db/types.ts';

const orgId = 'org-phase1-isolation';
const agentAScope: AccessScope = { organizationId: orgId, userId: 'agent-a', role: 'AGENT' };
const agentBScope: AccessScope = { organizationId: orgId, userId: 'agent-b', role: 'AGENT' };

function makeLead(id: string, assignedTo: string): Lead {
  const now = new Date().toISOString();
  return {
    id,
    businessName: `Business ${id}`,
    category: 'Gym',
    phone: id === 'lead-a' ? '9876543210' : '9876543211',
    phoneRaw: id === 'lead-a' ? '9876543210' : '9876543211',
    phoneE164: id === 'lead-a' ? '+919876543210' : '+919876543211',
    phoneType: 'mobile',
    alternatePhone: null,
    contactPerson: null,
    address: 'Lucknow',
    locality: 'Lucknow',
    pincode: '226001',
    city: 'Lucknow',
    state: 'Uttar Pradesh',
    website: null,
    rating: null,
    reviewCount: null,
    source: 'Isolation test',
    sourceFile: null,
    sourceRow: null,
    status: 'NEW',
    customNotes: '',
    lastContactedAt: null,
    nextFollowUpAt: null,
    callCount: 0,
    createdAt: now,
    updatedAt: now,
    isSynced: 1,
    syncedAt: now,
    deletedAt: null,
    createdBy: assignedTo,
    assignedTo,
    updatedBy: assignedTo,
  };
}

describe('Phase 1 local access-scope isolation', () => {
  it('keeps account partitions physically separate even for the same record id', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const scopeA = { ...agentAScope, organizationId: `${orgId}-${suffix}` };
    const scopeB = { ...agentBScope, organizationId: `${orgId}-${suffix}` };
    const dbA = new SalesCRMDatabase(scopedDatabaseName(scopeA), scopeA);
    const dbB = new SalesCRMDatabase(scopedDatabaseName(scopeB), scopeB);

    try {
      await dbA.open();
      await dbB.open();
      await dbA.leads.put(makeLead('lead-a', scopeA.userId));

      assert.ok(await createCRMDataLayer(dbA).leads.getLeadById('lead-a'));
      assert.equal(await createCRMDataLayer(dbB).leads.getLeadById('lead-a'), undefined);
      assert.notEqual(dbA.name, dbB.name);
    } finally {
      await dbA.delete();
      await dbB.delete();
    }
  });

  it('rejects locked repositories and hides stale records assigned to another agent', async () => {
    const locked = new SalesCRMDatabase(`LockedPhase1_${Date.now()}`);
    await assert.rejects(() => createCRMDataLayer(locked).leads.getLeadById('anything'), /locked/i);
    locked.close();

    const db = new SalesCRMDatabase(`ScopedPhase1_${Date.now()}`, agentAScope);
    const data = createCRMDataLayer(db);
    try {
      await db.open();
      await db.leads.bulkPut([makeLead('lead-a', 'agent-a'), makeLead('lead-b', 'agent-b')]);

      assert.equal(await data.leads.getLeadById('lead-b'), undefined);
      const result = await data.leads.searchAndFilterLeads();
      assert.deepEqual(result.leads.map((lead) => lead.id), ['lead-a']);
      assert.equal((await data.dashboard.getDashboardData()).metrics.totalLeads, 1);
      await assert.rejects(
        () => data.remarks.addRemark({ leadId: 'lead-b', content: 'must not write' }),
        /not found/i
      );
    } finally {
      await db.delete();
    }
  });

  it('prunes revoked rows and refuses a backup from another account', async () => {
    const db = new SalesCRMDatabase(`PrunePhase1_${Date.now()}`, agentAScope);
    try {
      await db.open();
      await db.leads.bulkPut([makeLead('lead-a', 'agent-a'), makeLead('lead-b', 'agent-b')]);
      await pruneInaccessibleLocalData(db, agentAScope);
      assert.deepEqual((await db.leads.toArray()).map((lead) => lead.id), ['lead-a']);

      const backup = await new BackupService(db).generateBackupPayload();
      assert.equal(backup.organizationId, agentAScope.organizationId);
      assert.equal(backup.userId, agentAScope.userId);
      await assert.rejects(
        () => new BackupService(db).mergeRestore({ ...backup, userId: agentBScope.userId }),
        /different organization or signed-in user/i
      );
    } finally {
      await db.delete();
    }
  });
});

