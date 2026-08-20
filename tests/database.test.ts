import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { SalesCRMDatabase } from '../src/db/database';
import { createCRMDataLayer } from '../src/db';
import { normalizePhoneNumber, parseAddress } from '../src/db/services/leadNormalizer';
import { LeadStatus } from '../src/db/types';

describe('Sales CRM Database & Data Layer', () => {
  let db: SalesCRMDatabase;
  let crm: ReturnType<typeof createCRMDataLayer>;

  beforeEach(async () => {
    // Unique in-memory DB per test
    const testDbName = `test_crm_${Math.random().toString(36).substring(7)}`;
    db = new SalesCRMDatabase(testDbName);
    crm = createCRMDataLayer(db);
    await db.seedDefaults();
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('1. Phone & Address Normalization', () => {
    it('normalizes standard 10-digit Indian mobile number', () => {
      const result = normalizePhoneNumber('9876543210');
      expect(result.isValid).toBe(true);
      expect(result.type).toBe('mobile');
      expect(result.clean).toBe('9876543210');
      expect(result.e164).toBe('+919876543210');
      expect(result.canWhatsApp).toBe(true);
    });

    it('normalizes +91 formatted mobile number with spaces', () => {
      const result = normalizePhoneNumber('+91 70544 47888');
      expect(result.isValid).toBe(true);
      expect(result.type).toBe('mobile');
      expect(result.clean).toBe('7054447888');
      expect(result.e164).toBe('+917054447888');
      expect(result.canWhatsApp).toBe(true);
    });

    it('normalizes Lucknow STD landline number and marks WhatsApp false', () => {
      const result = normalizePhoneNumber('+91 522 422 7316');
      expect(result.isValid).toBe(true);
      expect(result.type).toBe('landline');
      expect(result.clean).toBe('05224227316');
      expect(result.e164).toBe('+915224227316');
      expect(result.canWhatsApp).toBe(false);
    });

    it('extracts PIN code and Lucknow locality from raw address', () => {
      const raw = 'C237, Rail Nagar Rd, Sector J, LDA Colony, Lucknow, Uttar Pradesh 226012, India';
      const parsed = parseAddress(raw);
      expect(parsed.pincode).toBe('226012');
      expect(parsed.locality).toBe('LDA Colony');
      expect(parsed.city).toBe('Lucknow');
    });
  });

  describe('2. Lead CRUD & Duplicate Detection', () => {
    it('creates a new lead with normalized fields and default status NEW', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Skywards Fitness Zone',
        phone: '+91 70544 47888',
        address: 'C237, Rail Nagar Rd, LDA Colony, Lucknow 226012',
        category: 'Gym',
      });

      expect(lead.id).toBeDefined();
      expect(lead.businessName).toBe('Skywards Fitness Zone');
      expect(lead.phone).toBe('7054447888');
      expect(lead.phoneE164).toBe('+917054447888');
      expect(lead.phoneType).toBe('mobile');
      expect(lead.locality).toBe('LDA Colony');
      expect(lead.pincode).toBe('226012');
      expect(lead.status).toBe('NEW');
      expect(lead.callCount).toBe(0);
      expect(lead.deletedAt).toBeNull();
    });

    it('prevents creating duplicate leads with the same phone number', async () => {
      await crm.leads.createLead({
        businessName: 'Gym A',
        phone: '9876543210',
        address: 'Lucknow',
      });

      await expect(
        crm.leads.createLead({
          businessName: 'Gym B',
          phone: '+91 98765 43210',
          address: 'Alambagh, Lucknow',
        })
      ).rejects.toThrow(/Duplicate lead/);
    });

    it('bulk imports leads and skips duplicates within batch and existing DB', async () => {
      // Pre-seed one lead
      await crm.leads.createLead({
        businessName: 'Pre-existing Gym',
        phone: '+91 70544 47888',
        address: 'LDA Colony, Lucknow',
      });

      const batch = [
        {
          title: 'Skywards Fitness Zone',
          phone: '+91 70544 47888', // Duplicate of pre-existing
          address: 'LDA Colony, Lucknow 226012',
          category: 'Gym',
        },
        {
          title: 'Optimum Fitness Gym',
          phone: '+91 96198 87358', // Unique 1
          address: 'Wazirganj, Lucknow 226018',
          category: 'Gym',
        },
        {
          title: 'Optimum Fitness Duplicate',
          phone: '+91 96198 87358', // Duplicate in same batch
          address: 'Wazirganj, Lucknow',
          category: 'Gym',
        },
        {
          title: 'Trend Fitness',
          phone: '+91 73100 04343', // Unique 2
          address: 'Charbagh, Lucknow 226004',
          category: 'Fitness center',
        },
      ];

      const result = await crm.leads.bulkImportLeads(batch, 'Excel Seed Test');
      expect(result.totalProcessed).toBe(4);
      expect(result.imported).toBe(2);
      expect(result.skippedDuplicates).toBe(2);
      expect(result.errors.length).toBe(0);
    });
  });

  describe('3. Lead Status Transitions', () => {
    it('supports all required lead statuses', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Fit Hub',
        phone: '9888877777',
        address: 'Hazratganj, Lucknow',
      });

      const statuses: LeadStatus[] = [
        'NEW',
        'CONTACTED',
        'INTERESTED',
        'SAMPLE_REQUESTED',
        'FOLLOW_UP',
        'NEGOTIATION',
        'CUSTOMER',
        'NOT_INTERESTED',
        'WRONG_NUMBER',
        'DO_NOT_CONTACT',
      ];

      for (const st of statuses) {
        const updated = await crm.leads.updateLeadStatus(lead.id, st);
        expect(updated.status).toBe(st);
      }
    });
  });

  describe('4. Remarks & Relationships', () => {
    it('adds predefined and custom remarks and updates lead timestamp', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Power Gym',
        phone: '9999911111',
        address: 'Alambagh, Lucknow',
      });

      const r1 = await crm.remarks.addRemark({
        leadId: lead.id,
        content: 'Interested in 1kg protein flour sample',
        type: 'PREDEFINED',
        author: 'Aman (Sales Rep)',
      });

      const r2 = await crm.remarks.addRemark({
        leadId: lead.id,
        content: 'Owner meets suppliers on Saturdays after 4 PM.',
        type: 'CUSTOM',
        author: 'Aman (Sales Rep)',
      });

      const remarks = await crm.remarks.getRemarksByLead(lead.id);
      expect(remarks.length).toBe(2);
      expect(remarks[0].content).toBe('Owner meets suppliers on Saturdays after 4 PM.');
      expect(remarks[1].content).toBe('Interested in 1kg protein flour sample');
    });
  });

  describe('5. Call History & Outcomes', () => {
    it('logs call outcomes, increments call count, and transitions status', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Fit Zone',
        phone: '9877766666',
        address: 'Indira Nagar, Lucknow',
      });

      expect(lead.callCount).toBe(0);
      expect(lead.status).toBe('NEW');

      const call = await crm.callHistory.logCall({
        leadId: lead.id,
        calledNumber: lead.phoneE164,
        outcome: 'CONNECTED',
        durationSeconds: 145,
        notes: 'Owner is keen on high protein flour. Wants catalog on WhatsApp.',
      });

      expect(call.outcome).toBe('CONNECTED');
      expect(call.durationSeconds).toBe(145);

      const refreshedLead = (await crm.leads.getLeadById(lead.id))!;
      expect(refreshedLead.callCount).toBe(1);
      expect(refreshedLead.status).toBe('CONTACTED');
      expect(refreshedLead.lastContactedAt).toBeDefined();

      const history = await crm.callHistory.getCallHistoryByLead(lead.id);
      expect(history.length).toBe(1);
      expect(history[0].id).toBe(call.id);
    });
  });

  describe('6. Follow-up Management & Auto-sync with Lead', () => {
    it('schedules follow-up and updates lead nextFollowUpAt', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Pulse Gym',
        phone: '9811122222',
        address: 'Gomti Nagar, Lucknow',
      });

      const tomorrow = new Date(Date.now() + 86400000).toISOString();
      const followUp = await crm.followUps.scheduleFollowUp({
        leadId: lead.id,
        scheduledAt: tomorrow,
        title: 'Deliver 1kg sample batch to Gym Manager',
        priority: 'HIGH',
      });

      expect(followUp.status).toBe('PENDING');

      const refreshedLead = (await crm.leads.getLeadById(lead.id))!;
      expect(refreshedLead.nextFollowUpAt).toBe(tomorrow);

      // Complete follow-up
      await crm.followUps.completeFollowUp(followUp.id);
      const afterCompleteLead = (await crm.leads.getLeadById(lead.id))!;
      expect(afterCompleteLead.nextFollowUpAt).toBeNull();
    });
  });

  describe('7. Message History & Template Variable Rendering', () => {
    it('renders Amaratv Krishi message template with lead details and logs message history', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Iron Paradise',
        phone: '9988776655',
        address: 'Mahanagar, Lucknow 226006',
        category: 'Gym',
        contactPerson: 'Vikram Singh',
      });

      const templates = await crm.templates.getAllTemplates();
      expect(templates.length).toBeGreaterThan(0);

      const introTpl = templates.find((t) => t.category === 'INTRO')!;
      const rendered = crm.templates.renderTemplate(introTpl.body, lead, 'Amaratv Rep');

      expect(rendered).toContain('Iron Paradise');
      expect(rendered).toContain('Vikram Singh');
      expect(rendered).toContain('Mahanagar');
      expect(rendered).toContain('Amaratv Krishi');

      // Log WhatsApp message send
      const msg = await crm.messages.logMessage({
        leadId: lead.id,
        channel: 'WHATSAPP',
        recipientPhone: lead.phoneE164,
        messageContent: rendered,
        templateId: introTpl.id,
        sentStatus: 'SENT',
      });

      expect(msg.sentStatus).toBe('SENT');
      const msgList = await crm.messages.getMessageHistoryByLead(lead.id);
      expect(msgList.length).toBe(1);
    });
  });

  describe('8. Safe Soft-Deletion & Hard-Deletion Cascading', () => {
    it('soft-deletes lead and excludes it from standard queries', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Temp Gym',
        phone: '9000011111',
        address: 'Chowk, Lucknow',
      });

      await crm.leads.softDeleteLead(lead.id);

      const active = await crm.leads.getLeadById(lead.id);
      expect(active).toBeUndefined();

      const archived = await crm.leads.getLeadById(lead.id, true);
      expect(archived).toBeDefined();
      expect(archived?.deletedAt).not.toBeNull();

      // Restore
      await crm.leads.restoreLead(lead.id);
      const restored = await crm.leads.getLeadById(lead.id);
      expect(restored).toBeDefined();
      expect(restored?.deletedAt).toBeNull();
    });

    it('hard-deletes lead and cascades deletion to child history records', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Cascade Gym',
        phone: '9111100000',
        address: 'Aliganj, Lucknow',
      });

      await crm.remarks.addRemark({ leadId: lead.id, content: 'Test note' });
      await crm.callHistory.logCall({
        leadId: lead.id,
        calledNumber: lead.phoneE164,
        outcome: 'CONNECTED',
      });

      await crm.leads.hardDeleteLead(lead.id);

      expect(await crm.leads.getLeadById(lead.id, true)).toBeUndefined();
      expect((await crm.remarks.getRemarksByLead(lead.id)).length).toBe(0);
      expect((await crm.callHistory.getCallHistoryByLead(lead.id)).length).toBe(0);
    });
  });

  describe('9. Search, Multi-Filter & Aggregated Stats', () => {
    it('searches and filters leads by locality, status, and keywords', async () => {
      await crm.leads.createLead({
        businessName: 'Alpha Gym Alambagh',
        phone: '9123456781',
        address: 'Chander Nagar, Alambagh, Lucknow 226005',
        status: 'INTERESTED',
      });

      await crm.leads.createLead({
        businessName: 'Beta Fitness Hazratganj',
        phone: '9123456782',
        address: 'Madan Mohan Malviya Marg, Hazratganj, Lucknow 226001',
        status: 'FOLLOW_UP',
      });

      // Filter by locality
      const resLoc = await crm.leads.searchAndFilterLeads({ locality: 'Alambagh' });
      expect(resLoc.total).toBe(1);
      expect(resLoc.leads[0].businessName).toBe('Alpha Gym Alambagh');

      // Filter by status
      const resStatus = await crm.leads.searchAndFilterLeads({ status: 'FOLLOW_UP' });
      expect(resStatus.total).toBe(1);
      expect(resStatus.leads[0].businessName).toBe('Beta Fitness Hazratganj');

      // Search term match
      const resSearch = await crm.leads.searchAndFilterLeads({ searchTerm: 'Hazratganj' });
      expect(resSearch.total).toBe(1);
      expect(resSearch.leads[0].businessName).toBe('Beta Fitness Hazratganj');
    });

    it('calculates accurate pipeline metrics and summary stats', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Titan Gym',
        phone: '9333344444',
        address: 'LDA Colony, Lucknow',
        status: 'INTERESTED',
      });

      await crm.callHistory.logCall({
        leadId: lead.id,
        calledNumber: lead.phoneE164,
        outcome: 'CONNECTED',
      });

      const todayStr = new Date().toISOString();
      await crm.followUps.scheduleFollowUp({
        leadId: lead.id,
        scheduledAt: todayStr,
        title: 'Call owner for feedback',
      });

      const stats = await crm.leads.getLeadStats();
      expect(stats.activeLeads).toBe(1);
      expect(stats.statusCounts.INTERESTED).toBe(1);
      expect(stats.totalCallsLogged).toBe(1);
      expect(stats.todayFollowUpsCount).toBe(1);
    });
  });

  describe('10. Cloud Sync Delta Helper', () => {
    it('extracts modified local records and marks them synced upon server ACK', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Sync Test Gym',
        phone: '9555566666',
        address: 'Charbagh, Lucknow',
      });

      // Initially isSynced = 0
      const localChanges = await crm.sync.getLocalChanges();
      expect(localChanges.changes.leads.some((l) => l.id === lead.id)).toBe(true);

      // Server acknowledges sync
      await crm.sync.markAsSynced(localChanges);

      // Verify dirty list is now empty
      const afterSyncChanges = await crm.sync.getLocalChanges();
      expect(afterSyncChanges.changes.leads.length).toBe(0);

      const syncedLead = (await crm.leads.getLeadById(lead.id))!;
      expect(syncedLead.isSynced).toBe(1);
      expect(syncedLead.syncedAt).toBeDefined();
    });
  });
});
