import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { SalesCRMDatabase } from '../src/db/database';
import { createCRMDataLayer } from '../src/db';
import { BackupService, CRMBackupPayload } from '../src/services/backupService';

describe('Milestone 5A: Local Backup & Restore Workflow', () => {
  let db: SalesCRMDatabase;
  let crm: ReturnType<typeof createCRMDataLayer>;

  beforeEach(async () => {
    const testDbName = `test_backup_${Math.random().toString(36).substring(7)}`;
    db = new SalesCRMDatabase(testDbName);
    crm = createCRMDataLayer(db);
    await db.seedDefaults();
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('1. Backup Generation & Metadata', () => {
    it('exports a complete, valid JSON backup payload containing all entities', async () => {
      // 1. Create seed entities
      const lead = await crm.leads.createLead({
        businessName: 'Iron Paradise Gym',
        phone: '+91 99887 76655',
        address: 'Hazratganj, Lucknow',
      });

      const call = await crm.callHistory.logCall({
        leadId: lead.id,
        calledNumber: lead.phoneE164,
        outcome: 'CONNECTED',
        notes: 'Spoke with gym trainer',
        updateLeadStatus: 'CONTACTED',
      });

      const remark = await crm.remarks.addRemark({
        leadId: lead.id,
        content: 'Interested in sample kit',
        type: 'CUSTOM',
      });

      const followUp = await crm.followUps.scheduleFollowUp({
        leadId: lead.id,
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        title: 'Drop sample flour',
      });

      const message = await crm.messages.logMessage({
        leadId: lead.id,
        channel: 'WHATSAPP',
        recipientPhone: lead.phoneE164,
        messageContent: 'Intro pitch message',
        sentStatus: 'INITIATED',
      });

      // 2. Generate backup
      const backup = await crm.backup.generateBackupPayload();

      expect(backup.schemaVersion).toBe(2);
      expect(backup.appVersion).toBe('1.0.0');
      expect(backup.exportedAt).toBeDefined();
      expect(backup.databaseName).toBe(db.name);

      expect(backup.data.leads.length).toBe(1);
      expect(backup.data.leads[0].id).toBe(lead.id);
      expect(backup.data.callHistory.length).toBe(1);
      expect(backup.data.callHistory[0].id).toBe(call.id);
      expect(backup.data.remarks.length).toBe(1);
      expect(backup.data.remarks[0].id).toBe(remark.id);
      expect(backup.data.followUps.length).toBe(1);
      expect(backup.data.followUps[0].id).toBe(followUp.id);
      expect(backup.data.messageHistory.length).toBe(1);
      expect(backup.data.messageHistory[0].id).toBe(message.id);
      expect(backup.data.messageTemplates.length).toBeGreaterThanOrEqual(5);
    });

    it('generates standard backup filename with date-time format', () => {
      const fixedDate = new Date(2026, 7, 20, 14, 30); // Aug 20, 2026 14:30
      const filename = BackupService.generateBackupFilename(fixedDate);
      expect(filename).toBe('amaratv-crm-backup-2026-08-20-1430.json');
    });

    it('exports an empty database safely', async () => {
      await db.clearAllData();
      const backup = await crm.backup.generateBackupPayload();
      expect(backup.data.leads.length).toBe(0);
      expect(backup.data.callHistory.length).toBe(0);
      expect(backup.data.remarks.length).toBe(0);
      expect(backup.data.followUps.length).toBe(0);
      expect(backup.data.messageHistory.length).toBe(0);
      expect(backup.data.messageTemplates.length).toBe(0);
    });

    it('preserves soft-deleted records in export', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Closed Gym',
        phone: '+91 99999 11111',
        address: 'Alambagh, Lucknow',
      });

      await crm.leads.softDeleteLead(lead.id);

      const backup = await crm.backup.generateBackupPayload();
      const exportedLead = backup.data.leads.find((l) => l.id === lead.id);
      expect(exportedLead).toBeDefined();
      expect(exportedLead?.deletedAt).not.toBeNull();
    });
  });

  describe('2. Backup Validation & Rejection', () => {
    it('validates a compliant JSON backup payload', () => {
      const validPayload: CRMBackupPayload = {
        schemaVersion: 2,
        appVersion: '1.0.0',
        exportedAt: new Date().toISOString(),
        databaseName: 'AmaratvSalesCRM',
        data: {
          leads: [
            {
              id: 'l-1',
              businessName: 'Valid Gym',
              category: 'Gym',
              phone: '9999988888',
              phoneRaw: '+91 99999 88888',
              phoneE164: '+919999988888',
              phoneType: 'mobile',
              alternatePhone: null,
              contactPerson: null,
              address: 'LDA Colony, Lucknow',
              locality: 'LDA Colony',
              pincode: '226012',
              city: 'Lucknow',
              state: 'Uttar Pradesh',
              website: null,
              rating: null,
              reviewCount: null,
              source: 'Seed',
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

      const result = crm.backup.validateBackupPayload(validPayload);
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
      expect(result.summary.leadsCount).toBe(1);
    });

    it('rejects malformed JSON strings safely', () => {
      const result = crm.backup.validateBackupJson('this is not json {');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('JSON Syntax Error');
    });

    it('rejects backup with missing schemaVersion or missing data container', () => {
      const invalidPayload = { appVersion: '1.0.0' };
      const result = crm.backup.validateBackupPayload(invalidPayload);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('schemaVersion'))).toBe(true);
    });

    it('detects orphan child records referencing nonexistent leadId', () => {
      const orphanPayload: CRMBackupPayload = {
        schemaVersion: 2,
        appVersion: '1.0.0',
        exportedAt: new Date().toISOString(),
        databaseName: 'AmaratvSalesCRM',
        data: {
          leads: [
            {
              id: 'lead-real',
              businessName: 'Real Gym',
              category: 'Gym',
              phone: '9999988888',
              phoneRaw: '+91 99999 88888',
              phoneE164: '+919999988888',
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
              source: 'Seed',
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
          remarks: [
            {
              id: 'rem-orphan',
              leadId: 'lead-nonexistent', // Missing lead reference
              type: 'CUSTOM',
              content: 'Orphan note',
              author: 'Rep',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              isSynced: 0,
              deletedAt: null,
            },
          ],
          callHistory: [],
          followUps: [],
          messageHistory: [],
          messageTemplates: [],
        },
      };

      const result = crm.backup.validateBackupPayload(orphanPayload);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Orphan record'))).toBe(true);
    });
  });

  describe('3. Merge Restore Workflow (Non-Destructive)', () => {
    it('adds new records and skips identical existing records on merge', async () => {
      // 1. Create existing local lead
      const localLead = await crm.leads.createLead({
        businessName: 'Existing Local Gym',
        phone: '+91 91111 22222',
        address: 'Chowk, Lucknow',
      });

      // 2. Prepare backup with local lead + a new foreign lead
      const backupPayload: CRMBackupPayload = {
        schemaVersion: 2,
        appVersion: '1.0.0',
        exportedAt: new Date().toISOString(),
        databaseName: 'AmaratvSalesCRM',
        data: {
          leads: [
            (await crm.leads.getLeadById(localLead.id))!, // Identical
            {
              id: 'new-remote-lead',
              businessName: 'Incoming Remote Gym',
              category: 'Gym',
              phone: '9333344444',
              phoneRaw: '+91 93333 44444',
              phoneE164: '+919333344444',
              phoneType: 'mobile',
              alternatePhone: null,
              contactPerson: null,
              address: 'Gomti Nagar, Lucknow',
              locality: 'Gomti Nagar',
              pincode: '226010',
              city: 'Lucknow',
              state: 'Uttar Pradesh',
              website: null,
              rating: null,
              reviewCount: null,
              source: 'Backup',
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

      const result = await crm.backup.mergeRestore(backupPayload);

      expect(result.added).toBe(1); // new-remote-lead added
      expect(result.skipped).toBe(1); // localLead identical skipped
      expect(result.updated).toBe(0);

      // Verify both exist in local DB
      const totalLeads = await db.leads.count();
      expect(totalLeads).toBe(2);
    });

    it('updates existing record when incoming record has newer updatedAt (LWW)', async () => {
      const olderTime = new Date('2026-08-01T10:00:00.000Z').toISOString();
      const newerTime = new Date('2026-08-10T12:00:00.000Z').toISOString();

      const lead = await crm.leads.createLead({
        businessName: 'Original Gym Title',
        phone: '+91 95555 66666',
        address: 'Hazratganj, Lucknow',
      });

      // Force local lead to older timestamp
      await db.leads.update(lead.id, { updatedAt: olderTime });

      const incomingModifiedLead = {
        ...(await crm.leads.getLeadById(lead.id))!,
        businessName: 'Updated Gym Title from Backup',
        status: 'INTERESTED' as const,
        updatedAt: newerTime,
      };

      const backupPayload: CRMBackupPayload = {
        schemaVersion: 2,
        appVersion: '1.0.0',
        exportedAt: new Date().toISOString(),
        databaseName: 'AmaratvSalesCRM',
        data: {
          leads: [incomingModifiedLead],
          remarks: [],
          callHistory: [],
          followUps: [],
          messageHistory: [],
          messageTemplates: [],
        },
      };

      const result = await crm.backup.mergeRestore(backupPayload);
      expect(result.updated).toBe(1);

      const refreshed = (await crm.leads.getLeadById(lead.id))!;
      expect(refreshed.businessName).toBe('Updated Gym Title from Backup');
      expect(refreshed.status).toBe('INTERESTED');
    });
  });

  describe('4. Replace Restore Workflow (Destructive with Rollback)', () => {
    it('wipes existing database and replaces completely with backup contents', async () => {
      // 1. Create local lead
      await crm.leads.createLead({
        businessName: 'Old Lead to be Replaced',
        phone: '+91 97777 88888',
        address: 'Charbagh, Lucknow',
      });

      expect(await db.leads.count()).toBe(1);

      // 2. Backup with completely different lead
      const replacePayload: CRMBackupPayload = {
        schemaVersion: 2,
        appVersion: '1.0.0',
        exportedAt: new Date().toISOString(),
        databaseName: 'AmaratvSalesCRM',
        data: {
          leads: [
            {
              id: 'fresh-restored-lead',
              businessName: 'Fresh Restored Gym',
              category: 'Gym',
              phone: '9888877777',
              phoneRaw: '+91 98888 77777',
              phoneE164: '+919888877777',
              phoneType: 'mobile',
              alternatePhone: null,
              contactPerson: 'Vikram',
              address: 'Indira Nagar, Lucknow',
              locality: 'Indira Nagar',
              pincode: '226016',
              city: 'Lucknow',
              state: 'Uttar Pradesh',
              website: null,
              rating: null,
              reviewCount: null,
              source: 'Backup',
              sourceFile: null,
              sourceRow: null,
              status: 'INTERESTED',
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

      await crm.backup.replaceRestore(replacePayload);

      const leads = await db.leads.toArray();
      expect(leads.length).toBe(1);
      expect(leads[0].id).toBe('fresh-restored-lead');
      expect(leads[0].businessName).toBe('Fresh Restored Gym');
    });

    it('rejects invalid replace payload and does not modify database', async () => {
      const initialLead = await crm.leads.createLead({
        businessName: 'Safe Gym',
        phone: '+91 90000 11111',
        address: 'LDA Colony, Lucknow',
      });

      const corruptedPayload = {
        schemaVersion: 2,
        data: {
          leads: [{ invalidField: true }], // Missing id
        },
      } as any;

      await expect(crm.backup.replaceRestore(corruptedPayload)).rejects.toThrow();

      // Ensure initial lead was not deleted
      const leads = await db.leads.toArray();
      expect(leads.length).toBe(1);
      expect(leads[0].id).toBe(initialLead.id);
    });
  });
});
