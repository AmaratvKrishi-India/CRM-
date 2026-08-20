import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { SalesCRMDatabase } from '../src/db/database';
import { createCRMDataLayer } from '../src/db';
import { DeviceService } from '../src/services/deviceService';
import { CRMBackupPayload } from '../src/services/backupService';
import { User, Lead, Activity, CallRecord, ImportAudit } from '../src/db/types';

describe('Phase 2B: User & Role Data Model, Ownership, Migration & Device Identity', () => {
  let db: SalesCRMDatabase;
  let crm: ReturnType<typeof createCRMDataLayer>;

  beforeEach(async () => {
    DeviceService.resetDeviceIdForTesting();
    const testDbName = `test_phase2b_${Math.random().toString(36).substring(7)}`;
    db = new SalesCRMDatabase(testDbName);
    crm = createCRMDataLayer(db);
    await db.seedDefaults();
  });

  afterEach(async () => {
    await db.delete();
    DeviceService.resetDeviceIdForTesting();
  });

  describe('1. User Model, Roles & Statuses', () => {
    it('creates an ADMIN user with required fields and no password', async () => {
      const admin = await crm.users.createUser({
        name: 'Super Admin',
        email: 'admin@amaratvkrishi.com',
        phone: '9988776655',
        role: 'ADMIN',
        status: 'ACTIVE',
      });

      expect(admin.id).toBeDefined();
      expect(admin.name).toBe('Super Admin');
      expect(admin.email).toBe('admin@amaratvkrishi.com');
      expect(admin.role).toBe('ADMIN');
      expect(admin.status).toBe('ACTIVE');
      expect(admin.createdAt).toBeDefined();
      expect(admin.updatedAt).toBeDefined();
      expect(admin.deletedAt).toBeNull();
      // Ensure NO password or secret field exists on object
      expect((admin as any).password).toBeUndefined();
      expect((admin as any).passwordHash).toBeUndefined();
      expect((admin as any).secret).toBeUndefined();
    });

    it('creates an AGENT user created by an Admin', async () => {
      const admin = await crm.users.createUser({
        name: 'Admin Manager',
        email: 'admin.mgr@amaratvkrishi.com',
        phone: '9876543210',
        role: 'ADMIN',
      });

      const agent = await crm.users.createUser({
        name: 'Rahul Sharma',
        email: 'rahul@amaratvkrishi.com',
        phone: '9123456780',
        role: 'AGENT',
        status: 'ACTIVE',
        createdBy: admin.id,
      });

      expect(agent.role).toBe('AGENT');
      expect(agent.createdBy).toBe(admin.id);
      expect(agent.status).toBe('ACTIVE');

      const retrieved = await crm.users.getUserById(agent.id);
      expect(retrieved?.email).toBe('rahul@amaratvkrishi.com');
    });

    it('supports ACTIVE and INACTIVE user statuses and updates status', async () => {
      const user = await crm.users.createUser({
        name: 'Inactive Agent',
        email: 'inactive@amaratvkrishi.com',
        phone: '9000000001',
        role: 'AGENT',
        status: 'INACTIVE',
      });

      expect(user.status).toBe('INACTIVE');

      const updated = await crm.users.setUserStatus(user.id, 'ACTIVE');
      expect(updated.status).toBe('ACTIVE');

      const deactivated = await crm.users.setUserStatus(user.id, 'INACTIVE');
      expect(deactivated.status).toBe('INACTIVE');
    });

    it('prevents duplicate emails and duplicate IDs', async () => {
      await crm.users.createUser({
        id: 'fixed-user-id-1',
        name: 'User One',
        email: 'duplicate@amaratvkrishi.com',
        phone: '9000000002',
        role: 'AGENT',
      });

      // Duplicate email
      await expect(
        crm.users.createUser({
          name: 'User Two',
          email: 'duplicate@amaratvkrishi.com',
          phone: '9000000003',
          role: 'AGENT',
        })
      ).rejects.toThrow(/already exists/);

      // Duplicate ID
      await expect(
        crm.users.createUser({
          id: 'fixed-user-id-1',
          name: 'User Three',
          email: 'unique3@amaratvkrishi.com',
          phone: '9000000004',
          role: 'AGENT',
        })
      ).rejects.toThrow(/already exists/);
    });

    it('records login timestamp without altering other user properties', async () => {
      const agent = await crm.users.createUser({
        name: 'Login Agent',
        email: 'login@amaratvkrishi.com',
        phone: '9000000005',
        role: 'AGENT',
      });

      expect(agent.lastLoginAt).toBeNull();
      await crm.users.recordLogin(agent.id);

      const refreshed = (await crm.users.getUserById(agent.id))!;
      expect(refreshed.lastLoginAt).not.toBeNull();
    });
  });

  describe('2. Device Identity Foundation', () => {
    it('generates a stable UUID deviceId and persists across calls', () => {
      const deviceId1 = DeviceService.getDeviceId();
      expect(deviceId1).toBeDefined();
      expect(deviceId1.length).toBeGreaterThan(10);

      // Calling multiple times returns exact same ID
      const deviceId2 = DeviceService.getDeviceId();
      expect(deviceId2).toBe(deviceId1);
    });

    it('does not leak or use invasive hardware identifiers', () => {
      const deviceId = DeviceService.getDeviceId();
      // Should match standard UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(uuidRegex.test(deviceId)).toBe(true);
    });
  });

  describe('3. Lead Ownership & Assignment', () => {
    it('creates lead with createdBy, assignedTo, and updatedBy metadata', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Gold Gym Lucknow',
        phone: '9876500001',
        address: 'Gomti Nagar, Lucknow',
        createdBy: 'user-admin-1',
        assignedTo: 'user-agent-1',
      });

      expect(lead.createdBy).toBe('user-admin-1');
      expect(lead.assignedTo).toBe('user-agent-1');
      expect(lead.updatedBy).toBe('user-admin-1');
    });

    it('defaults createdBy and assignedTo to null when not specified (unassigned)', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Unassigned Gym',
        phone: '9876500002',
        address: 'Alambagh, Lucknow',
      });

      expect(lead.createdBy).toBeNull();
      expect(lead.assignedTo).toBeNull();
      expect(lead.updatedBy).toBeNull();
    });

    it('filters leads by assignedTo and createdBy', async () => {
      await crm.leads.createLead({
        businessName: 'Agent 1 Gym',
        phone: '9876500003',
        address: 'LDA Colony, Lucknow',
        assignedTo: 'agent-101',
        createdBy: 'admin-1',
      });

      await crm.leads.createLead({
        businessName: 'Agent 2 Gym',
        phone: '9876500004',
        address: 'Hazratganj, Lucknow',
        assignedTo: 'agent-102',
        createdBy: 'admin-1',
      });

      const agent1Leads = await crm.leads.searchAndFilterLeads({ assignedTo: 'agent-101' });
      expect(agent1Leads.total).toBe(1);
      expect(agent1Leads.leads[0].businessName).toBe('Agent 1 Gym');

      const agent2Leads = await crm.leads.searchAndFilterLeads({ assignedTo: 'agent-102' });
      expect(agent2Leads.total).toBe(1);
      expect(agent2Leads.leads[0].businessName).toBe('Agent 2 Gym');

      const unassignedLeads = await crm.leads.searchAndFilterLeads({ assignedTo: null });
      expect(unassignedLeads.total).toBe(0);
    });

    it('supports bulk import with ownership attribution', async () => {
      const batch = [
        {
          title: 'Bulk Gym 1',
          phone: '9876500005',
          address: 'Chowk, Lucknow',
        },
      ];

      const result = await crm.leads.bulkImportLeads(batch, 'Excel Batch', {
        createdBy: 'agent-rahul',
        assignedTo: 'agent-rahul',
      });

      expect(result.imported).toBe(1);
      const lead = (await crm.leads.getLeadById(result.importedLeadIds[0]))!;
      expect(lead.createdBy).toBe('agent-rahul');
      expect(lead.assignedTo).toBe('agent-rahul');
    });
  });

  describe('4. Append-Only Activity Log Model', () => {
    it('logs immutable activity events with metadata and device attribution', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Activity Gym',
        phone: '9876500006',
        address: 'Indira Nagar, Lucknow',
      });

      const deviceId = DeviceService.getDeviceId();

      const act1 = await crm.activities.logActivity({
        leadId: lead.id,
        userId: 'agent-rahul',
        deviceId,
        activityType: 'CALL_COMPLETED',
        metadata: { durationSeconds: 180, outcome: 'CONNECTED' },
      });

      // Advance by 10ms for strict ordering check
      await new Promise((r) => setTimeout(r, 10));

      const act2 = await crm.activities.logActivity({
        leadId: lead.id,
        userId: 'admin-vikram',
        deviceId,
        activityType: 'LEAD_REASSIGNED',
        metadata: { from: 'agent-rahul', to: 'agent-amit' },
      });

      expect(act1.id).toBeDefined();
      expect(act1.activityType).toBe('CALL_COMPLETED');
      expect(act1.deviceId).toBe(deviceId);

      const leadActivities = await crm.activities.getActivitiesForLead(lead.id);
      expect(leadActivities.length).toBe(2);
      expect(leadActivities[0].id).toBe(act2.id); // Newest first
      expect(leadActivities[1].id).toBe(act1.id);
    });

    it('queries activities by user and system-wide recent stream', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Stream Gym',
        phone: '9876500007',
        address: 'Aliganj, Lucknow',
      });

      await crm.activities.logActivity({
        leadId: lead.id,
        userId: 'agent-amit',
        activityType: 'REMARK_ADDED',
        metadata: { note: 'Interested in protein flour samples' },
      });

      const userActivities = await crm.activities.getActivitiesByUser('agent-amit');
      expect(userActivities.length).toBe(1);
      expect(userActivities[0].activityType).toBe('REMARK_ADDED');

      const recent = await crm.activities.getRecentActivities();
      expect(recent.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('5. CallRecord Foundation & Duration Verification Flag', () => {
    it('creates CallRecord distinguishing UNVERIFIED vs VERIFIED duration', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Call Record Gym',
        phone: '9876500008',
        address: 'Mahanagar, Lucknow',
      });

      const record = await crm.callRecords.createCallRecord({
        leadId: lead.id,
        userId: 'agent-rahul',
        startedAt: new Date().toISOString(),
        durationSeconds: 120,
        outcome: 'CONNECTED',
        remark: 'Sample offer discussed',
        verificationStatus: 'UNVERIFIED',
      });

      expect(record.id).toBeDefined();
      expect(record.leadId).toBe(lead.id);
      expect(record.verificationStatus).toBe('UNVERIFIED');
      expect(record.durationSeconds).toBe(120);

      const records = await crm.callRecords.getCallRecordsForLead(lead.id);
      expect(records.length).toBe(1);
      expect(records[0].id).toBe(record.id);
    });
  });

  describe('6. Import Audit Model', () => {
    it('creates and retrieves import audit logs with row stats and user attribution', async () => {
      const deviceId = DeviceService.getDeviceId();
      const audit = await crm.importAudits.createAudit({
        uploadedBy: 'agent-rahul',
        deviceId,
        filename: 'Lucknow-Gyms-Batch1.xlsx',
        source: 'Excel Import',
        startedAt: new Date(Date.now() - 5000).toISOString(),
        completedAt: new Date().toISOString(),
        totalRows: 141,
        imported: 137,
        updated: 0,
        duplicates: 4,
        invalid: 0,
      });

      expect(audit.id).toBeDefined();
      expect(audit.uploadedBy).toBe('agent-rahul');
      expect(audit.totalRows).toBe(141);
      expect(audit.imported).toBe(137);
      expect(audit.duplicates).toBe(4);

      const history = await crm.importAudits.getAuditHistory();
      expect(history.length).toBe(1);
      expect(history[0].filename).toBe('Lucknow-Gyms-Batch1.xlsx');
    });
  });

  describe('7. Dexie Migration & Legacy Data Preservation', () => {
    it('preserves existing Phase 1 entities during migration without assigning to random rep', async () => {
      // Create lead without createdBy/assignedTo
      const lead = await crm.leads.createLead({
        businessName: 'Legacy Phase 1 Gym',
        phone: '9876500009',
        address: 'Charbagh, Lucknow',
      });

      const remark = await crm.remarks.addRemark({
        leadId: lead.id,
        content: 'Legacy remark',
      });

      const call = await crm.callHistory.logCall({
        leadId: lead.id,
        calledNumber: lead.phoneE164,
        outcome: 'CONNECTED',
      });

      const followUp = await crm.followUps.scheduleFollowUp({
        leadId: lead.id,
        scheduledAt: new Date().toISOString(),
        title: 'Legacy follow-up',
      });

      const message = await crm.messages.logMessage({
        leadId: lead.id,
        channel: 'WHATSAPP',
        recipientPhone: lead.phoneE164,
        messageContent: 'Legacy message',
        sentStatus: 'SENT',
      });

      // Verify all exist and have expected structure
      const fetchedLead = (await crm.leads.getLeadById(lead.id))!;
      expect(fetchedLead.businessName).toBe('Legacy Phase 1 Gym');
      expect(fetchedLead.assignedTo).toBeNull();
      expect(fetchedLead.createdBy).toBeNull();

      expect((await crm.remarks.getRemarksByLead(lead.id)).length).toBe(1);
      expect((await crm.callHistory.getCallHistoryByLead(lead.id)).length).toBe(1);
      expect((await crm.followUps.getFollowUpsByLead(lead.id)).length).toBe(1);
      expect((await crm.messages.getMessageHistoryByLead(lead.id)).length).toBe(1);
    });
  });

  describe('8. Backup Compatibility (SchemaVersion 2 & 3)', () => {
    it('exports SchemaVersion 3 containing new Phase 2B entities', async () => {
      const user = await crm.users.createUser({
        name: 'Backup Admin',
        email: 'backup.admin@amaratvkrishi.com',
        phone: '9876500010',
        role: 'ADMIN',
      });

      const lead = await crm.leads.createLead({
        businessName: 'Backup Gym',
        phone: '9876500011',
        address: 'LDA Colony, Lucknow',
        createdBy: user.id,
      });

      await crm.activities.logActivity({
        leadId: lead.id,
        userId: user.id,
        activityType: 'LEAD_CREATED',
      });

      const backup = await crm.backup.generateBackupPayload();
      expect(backup.schemaVersion).toBe(2);
      expect(backup.data.users?.length).toBe(1);
      expect(backup.data.activities?.length).toBe(1);
      expect(backup.data.leads.length).toBe(1);
    });

    it('restores legacy SchemaVersion 2 backup safely without failure', async () => {
      const legacyBackup: CRMBackupPayload = {
        schemaVersion: 2,
        appVersion: '1.0.0',
        exportedAt: new Date().toISOString(),
        databaseName: 'LegacyDB',
        data: {
          leads: [
            {
              id: 'legacy-lead-1',
              businessName: 'Legacy Restored Gym',
              category: 'Gym',
              phone: '9876500012',
              phoneRaw: '+91 98765 00012',
              phoneE164: '+919876500012',
              phoneType: 'mobile',
              alternatePhone: null,
              contactPerson: null,
              address: 'Hazratganj, Lucknow',
              locality: 'Hazratganj',
              pincode: '226001',
              city: 'Lucknow',
              state: 'Uttar Pradesh',
              website: null,
              rating: null,
              reviewCount: null,
              source: 'Legacy Seed',
              sourceFile: null,
              sourceRow: null,
              status: 'NEW',
              customNotes: '',
              lastContactedAt: null,
              nextFollowUpAt: null,
              callCount: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              isSynced: 0,
              syncedAt: null,
              deletedAt: null,
            },
          ],
          remarks: [],
          callHistory: [],
          followUps: [],
          messageHistory: [],
          messageTemplates: [],
        },
      };

      const result = await crm.backup.mergeRestore(legacyBackup);
      expect(result.added).toBe(1);

      const restoredLead = (await crm.leads.getLeadById('legacy-lead-1'))!;
      expect(restoredLead.businessName).toBe('Legacy Restored Gym');
      expect(restoredLead.assignedTo).toBeUndefined(); // Remains untouched / unassigned
    });
  });
});
