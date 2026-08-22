import 'fake-indexeddb/auto';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SalesCRMDatabase } from '../src/db/database.ts';
import { createCRMDataLayer } from '../src/db/index.ts';
import { LeadAssignmentService } from '../src/services/leadAssignmentService.ts';
import type { User } from '../src/db/types.ts';

describe('Real Dexie, Repository & Outbox Integration Tests (Stage 1 & 2)', () => {
  function getFreshTestDb(nameSuffix: string) {
    const dbName = `RealDexieTest_${Date.now()}_${nameSuffix}`;
    const testDb = new SalesCRMDatabase(dbName);
    const dataLayer = createCRMDataLayer(testDb);
    return { db: testDb, dataLayer, dbName };
  }

  it('1. Real Lead Creation: Persists to Dexie leads table AND creates real Dexie outbox item', async () => {
    const { db, dataLayer } = getFreshTestDb('lead_create');

    const lead = await dataLayer.leads.createLead({
      businessName: 'Iron Fitness Gym',
      phone: '9876543210',
      contactPerson: 'Vikram Singh',
      category: 'Gym',
      locality: 'Alambagh',
      pincode: '226005',
      address: 'Shop 12, Alambagh, Lucknow',
      status: 'NEW',
      organizationId: 'org-test-01',
      createdBy: 'user-agent-01',
      assignedTo: 'user-agent-01',
    });

    // 1. Verify saved in real Dexie table
    const storedLead = await db.leads.get(lead.id);
    assert.ok(storedLead, 'Lead must exist in Dexie leads table');
    assert.strictEqual(storedLead.businessName, 'Iron Fitness Gym');
    assert.strictEqual(storedLead.isSynced, 0);

    // 2. Verify real Outbox record created in Dexie outbox table
    const outboxItems = await db.outbox.where('entityId').equals(lead.id).toArray();
    assert.strictEqual(outboxItems.length, 1, 'Must create exactly 1 outbox record in Dexie');
    assert.strictEqual(outboxItems[0].entityType, 'leads');
    assert.strictEqual(outboxItems[0].operation, 'CREATE');
    assert.strictEqual(outboxItems[0].payload.businessName, 'Iron Fitness Gym');
    assert.strictEqual(outboxItems[0].status, 'PENDING');

    await db.close();
  });

  it('2. Real Lead Update: Updates Dexie record AND writes UPDATE mutation to outbox', async () => {
    const { db, dataLayer } = getFreshTestDb('lead_update');

    const lead = await dataLayer.leads.createLead({
      businessName: 'Fit Pulse Gym',
      phone: '9123456780',
      status: 'NEW',
      organizationId: 'org-test-01',
      createdBy: 'user-agent-01',
    });

    await dataLayer.leads.updateLead(lead.id, {
      status: 'INTERESTED',
      contactPerson: 'Rahul Sharma',
    });

    // Check Dexie table
    const updatedLead = await db.leads.get(lead.id);
    assert.strictEqual(updatedLead?.status, 'INTERESTED');
    assert.strictEqual(updatedLead?.contactPerson, 'Rahul Sharma');

    // Check Outbox items: should have CREATE and UPDATE
    const outboxItems = await db.outbox.where('entityId').equals(lead.id).toArray();
    assert.strictEqual(outboxItems.length, 2);
    const updateItem = outboxItems.find((i) => i.operation === 'UPDATE');
    assert.ok(updateItem, 'UPDATE mutation must exist in Dexie outbox');
    assert.strictEqual(updateItem.payload.status, 'INTERESTED');

    await db.close();
  });

  it('3. Real Follow-Up Lifecycle: Creates, completes, and writes mutations to outbox', async () => {
    const { db, dataLayer } = getFreshTestDb('followup_lifecycle');

    const lead = await dataLayer.leads.createLead({
      businessName: 'Powerhouse Gym',
      phone: '9888777666',
      status: 'NEW',
      organizationId: 'org-test-01',
      createdBy: 'user-agent-01',
    });

    // Create follow-up using scheduleFollowUp
    const followUp = await dataLayer.followUps.scheduleFollowUp({
      leadId: lead.id,
      userId: 'user-agent-01',
      title: 'Call for quote discussion',
      notes: 'Send protein price sheet',
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      priority: 'HIGH',
    });

    const storedFollowUp = await db.followUps.get(followUp.id);
    assert.ok(storedFollowUp);
    assert.strictEqual(storedFollowUp.status, 'PENDING');
    assert.strictEqual(storedFollowUp.title, 'Call for quote discussion');

    const createOutbox = await db.outbox.where('entityId').equals(followUp.id).toArray();
    assert.strictEqual(createOutbox.length, 1);
    assert.strictEqual(createOutbox[0].operation, 'CREATE');

    // Complete follow-up
    await dataLayer.followUps.completeFollowUp(followUp.id);
    const completedFollowUp = await db.followUps.get(followUp.id);
    assert.strictEqual(completedFollowUp?.status, 'COMPLETED');
    assert.ok(completedFollowUp?.completedAt !== null);

    const allFollowUpOutbox = await db.outbox.where('entityId').equals(followUp.id).toArray();
    assert.strictEqual(allFollowUpOutbox.length, 2);
    assert.ok(allFollowUpOutbox.some((i) => i.operation === 'UPDATE'));

    await db.close();
  });

  it('4. Real Call Records & Telephony Mutations in Dexie & Outbox', async () => {
    const { db, dataLayer } = getFreshTestDb('call_record');

    const lead = await dataLayer.leads.createLead({
      businessName: 'Muscle & Strength Gym',
      phone: '9777666555',
      status: 'NEW',
      organizationId: 'org-test-01',
      createdBy: 'user-agent-01',
    });

    const record = await dataLayer.callRecords.createCallRecord({
      leadId: lead.id,
      userId: 'user-agent-01',
      startedAt: new Date().toISOString(),
      durationSeconds: 45,
      verificationStatus: 'VERIFIED',
      outcome: 'CONNECTED',
      remark: 'Spoke with gym owner, requested product brochure',
      deviceId: 'device-01',
    });

    const storedRecord = await db.callRecords.get(record.id);
    assert.ok(storedRecord);
    assert.strictEqual(storedRecord.verificationStatus, 'VERIFIED');
    assert.strictEqual(storedRecord.durationSeconds, 45);

    const outboxRecord = await db.outbox.where('entityId').equals(record.id).first();
    assert.ok(outboxRecord);
    assert.strictEqual(outboxRecord.entityType, 'call_records');
    assert.strictEqual(outboxRecord.operation, 'CREATE');
    assert.strictEqual(outboxRecord.payload.verificationStatus, 'VERIFIED');

    await db.close();
  });

  it('5. Actual Persistence Across Application Restart (Dexie close & reopen)', async () => {
    const dbName = `PersistentDB_${Date.now()}`;
    const initialDb = new SalesCRMDatabase(dbName);
    const initialDataLayer = createCRMDataLayer(initialDb);

    // Write initial lead & remark
    const lead = await initialDataLayer.leads.createLead({
      businessName: 'Survival Fitness Hub',
      phone: '9988776655',
      status: 'NEW',
      organizationId: 'org-test-01',
      createdBy: 'user-agent-01',
    });

    await initialDataLayer.remarks.addRemark({
      leadId: lead.id,
      content: 'Visited location, modern gym with 300 members',
      author: 'Agent Vikram',
      type: 'GENERAL',
    });

    // Verify outbox has 3 items: 1 lead CREATE, 1 remark CREATE, 1 lead UPDATE
    const initialOutboxCount = await initialDb.outbox.count();
    assert.strictEqual(initialOutboxCount, 3);

    // Simulate complete application termination / teardown
    await initialDb.close();

    // Reopen database with exact same name
    const reopenedDb = new SalesCRMDatabase(dbName);
    const reopenedDataLayer = createCRMDataLayer(reopenedDb);

    // Assert records survived closure
    const recoveredLead = await reopenedDataLayer.leads.getLeadById(lead.id);
    assert.ok(recoveredLead, 'Lead must be recovered from persistent IndexedDB');
    assert.strictEqual(recoveredLead.businessName, 'Survival Fitness Hub');

    const recoveredRemarks = await reopenedDataLayer.remarks.getRemarksByLead(lead.id);
    assert.strictEqual(recoveredRemarks.length, 1);
    assert.strictEqual(recoveredRemarks[0].content, 'Visited location, modern gym with 300 members');

    const recoveredOutbox = await reopenedDb.outbox.toArray();
    assert.strictEqual(recoveredOutbox.length, 3, 'Pending outbox mutations must persist across restarts');

    await reopenedDb.close();
  });

  it('6. Bulk Lead Assignment Scaling at 1, 10, 50, and 100+ records in real Dexie', async () => {
    const { db, dataLayer } = getFreshTestDb('bulk_assignment_scale');
    LeadAssignmentService.setCustomDatabase(db);

    const adminUser: User = {
      id: 'admin-01',
      name: 'Operations Admin',
      email: 'admin@amaratv.com',
      role: 'ADMIN',
      status: 'ACTIVE',
      organizationId: 'org-01',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const agentUser: User = {
      id: 'agent-01',
      name: 'Sales Agent 1',
      email: 'agent1@amaratv.com',
      role: 'AGENT',
      status: 'ACTIVE',
      organizationId: 'org-01',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const agentUser2: User = {
      id: 'agent-02',
      name: 'Sales Agent 2',
      email: 'agent2@amaratv.com',
      role: 'AGENT',
      status: 'ACTIVE',
      organizationId: 'org-01',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.users.bulkAdd([adminUser, agentUser, agentUser2]);

    // Test Scale Batch 1: Single lead
    const lead1 = await dataLayer.leads.createLead({
      businessName: 'Batch Gym 1',
      phone: '9000000001',
      status: 'NEW',
      organizationId: 'org-01',
      createdBy: adminUser.id,
    });
    const res1 = await LeadAssignmentService.bulkAssignLeads(adminUser, [lead1.id], 'agent-01');
    assert.strictEqual(res1.successfulCount, 1);

    // Test Scale Batch 2: 10 leads
    const leadIds10: string[] = [];
    for (let i = 2; i <= 11; i++) {
      const l = await dataLayer.leads.createLead({
        businessName: `Batch Gym ${i}`,
        phone: `90000000${i.toString().padStart(2, '0')}`,
        status: 'NEW',
        organizationId: 'org-01',
        createdBy: adminUser.id,
      });
      leadIds10.push(l.id);
    }
    const res10 = await LeadAssignmentService.bulkAssignLeads(adminUser, leadIds10, 'agent-02');
    assert.strictEqual(res10.successfulCount, 10);

    // Test Scale Batch 3: 50 leads
    const leadIds50: string[] = [];
    for (let i = 12; i <= 61; i++) {
      const l = await dataLayer.leads.createLead({
        businessName: `Batch Gym ${i}`,
        phone: `9000000${i.toString().padStart(3, '0')}`,
        status: 'NEW',
        organizationId: 'org-01',
        createdBy: adminUser.id,
      });
      leadIds50.push(l.id);
    }
    const res50 = await LeadAssignmentService.bulkAssignLeads(adminUser, leadIds50, 'agent-01');
    assert.strictEqual(res50.successfulCount, 50);

    // Test Scale Batch 4: 100+ leads
    const leadIds100: string[] = [];
    for (let i = 62; i <= 161; i++) {
      const l = await dataLayer.leads.createLead({
        businessName: `Batch Gym ${i}`,
        phone: `900000${i.toString().padStart(4, '0')}`,
        status: 'NEW',
        organizationId: 'org-01',
        createdBy: adminUser.id,
      });
      leadIds100.push(l.id);
    }
    const res100 = await LeadAssignmentService.bulkAssignLeads(adminUser, leadIds100, 'agent-02');
    assert.strictEqual(res100.successfulCount, 100);

    // Verify Dexie storage for all 100 leads assigned to agent-02
    const assignedLeadsInDb = await db.leads.where('assignedTo').equals('agent-02').toArray();
    assert.strictEqual(assignedLeadsInDb.length, 110); // 10 from batch 2 + 100 from batch 4

    // Verify BulkAssignmentAudit record was created in Dexie
    const auditRecords = await db.bulkAssignmentAudits.toArray();
    assert.strictEqual(auditRecords.length, 4, 'Must create 4 bulk assignment audit records in Dexie');
    assert.ok(auditRecords.some((a) => a.selectedLeadCount === 100 && a.targetAgentId === 'agent-02'));

    LeadAssignmentService.setCustomDatabase(null);
    await db.close();
  });
});
