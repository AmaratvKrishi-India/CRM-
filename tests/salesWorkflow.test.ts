import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { SalesCRMDatabase } from '../src/db/database';
import { createCRMDataLayer } from '../src/db';
import {
  determineDefaultLeadStatus,
  QUICK_SALES_REMARKS,
  CALL_OUTCOMES,
} from '../src/services/callOutcomeMapping';
import { CallOutcome, LeadStatus } from '../src/db/types';

describe('Milestone 2: Sales Calling & Outcome Workflow', () => {
  let db: SalesCRMDatabase;
  let crm: ReturnType<typeof createCRMDataLayer>;

  beforeEach(async () => {
    const testDbName = `test_workflow_${Math.random().toString(36).substring(7)}`;
    db = new SalesCRMDatabase(testDbName);
    crm = createCRMDataLayer(db);
    await db.seedDefaults();
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('1. Call Outcome & Status Mapping Rules', () => {
    it('maps high-intent sales remarks to appropriate LeadStatus', () => {
      expect(determineDefaultLeadStatus('NEW', 'CONNECTED', 'Order Confirmed')).toBe('CUSTOMER');
      expect(determineDefaultLeadStatus('NEW', 'CONNECTED', 'Asked for Sample')).toBe('SAMPLE_REQUESTED');
      expect(determineDefaultLeadStatus('NEW', 'CONNECTED', 'Sample Sent')).toBe('SAMPLE_REQUESTED');
      expect(determineDefaultLeadStatus('NEW', 'CONNECTED', 'Interested')).toBe('INTERESTED');
      expect(determineDefaultLeadStatus('NEW', 'CONNECTED', 'Asked for Price')).toBe('INTERESTED');
      expect(determineDefaultLeadStatus('NEW', 'CONNECTED', 'Asked for Catalogue')).toBe('INTERESTED');
      expect(determineDefaultLeadStatus('NEW', 'CONNECTED', 'Call Later')).toBe('FOLLOW_UP');
      expect(determineDefaultLeadStatus('NEW', 'CONNECTED', 'Meeting Required')).toBe('FOLLOW_UP');
      expect(determineDefaultLeadStatus('NEW', 'CONNECTED', 'Not Interested')).toBe('NOT_INTERESTED');
      expect(determineDefaultLeadStatus('NEW', 'CONNECTED', 'Already Has Supplier')).toBe('NOT_INTERESTED');
      expect(determineDefaultLeadStatus('NEW', 'CONNECTED', 'Do Not Contact')).toBe('DO_NOT_CONTACT');
    });

    it('maps call outcomes to sensible fallback statuses when no remark is selected', () => {
      expect(determineDefaultLeadStatus('NEW', 'CONNECTED', null)).toBe('CONTACTED');
      expect(determineDefaultLeadStatus('NEW', 'CALLBACK_REQUESTED', null)).toBe('FOLLOW_UP');
      expect(determineDefaultLeadStatus('NEW', 'BUSY', null)).toBe('FOLLOW_UP');
      expect(determineDefaultLeadStatus('NEW', 'NO_ANSWER', null)).toBe('FOLLOW_UP');
      expect(determineDefaultLeadStatus('NEW', 'WRONG_NUMBER', null)).toBe('WRONG_NUMBER');
      expect(determineDefaultLeadStatus('NEW', 'INVALID_NUMBER', null)).toBe('WRONG_NUMBER');
      expect(determineDefaultLeadStatus('NEW', 'OTHER', null)).toBe('CONTACTED');
    });

    it('preserves existing advanced status on CONNECTED if already past NEW', () => {
      expect(determineDefaultLeadStatus('INTERESTED', 'CONNECTED', null)).toBe('INTERESTED');
      expect(determineDefaultLeadStatus('SAMPLE_REQUESTED', 'BUSY', null)).toBe('SAMPLE_REQUESTED');
    });
  });

  describe('2. Complete Calling & Outcome Logging Workflow', () => {
    it('records call history, saves remark, increments call count, and transitions lead status', async () => {
      // 1. Create initial lead
      const lead = await crm.leads.createLead({
        businessName: 'Skywards Fitness Zone',
        phone: '+91 70544 47888',
        address: 'LDA Colony, Lucknow',
        category: 'Gym',
      });

      expect(lead.status).toBe('NEW');
      expect(lead.callCount).toBe(0);
      expect(lead.lastContactedAt).toBeNull();

      // 2. Rep calls and records explicit outcome: CONNECTED + Asked for Sample
      const outcome: CallOutcome = 'CONNECTED';
      const quickRemark = 'Asked for Sample';
      const customNote = 'Spoke with gym owner Manoj. Wants 1kg protein flour sample.';
      const updatedStatus = determineDefaultLeadStatus(lead.status, outcome, quickRemark);

      expect(updatedStatus).toBe('SAMPLE_REQUESTED');

      // 3. Save call history
      const callRecord = await crm.callHistory.logCall({
        leadId: lead.id,
        calledNumber: lead.phoneE164,
        outcome,
        durationSeconds: 0,
        notes: customNote,
        updateLeadStatus: updatedStatus,
      });

      expect(callRecord.outcome).toBe('CONNECTED');
      expect(callRecord.notes).toBe(customNote);

      // 4. Save remark
      const remarkRecord = await crm.remarks.addRemark({
        leadId: lead.id,
        content: `${quickRemark} — ${customNote}`,
        type: 'PREDEFINED',
        author: 'Sales Rep',
      });

      expect(remarkRecord.content).toContain('Asked for Sample');

      // 5. Verify updated Lead state
      const updatedLead = (await crm.leads.getLeadById(lead.id))!;
      expect(updatedLead.status).toBe('SAMPLE_REQUESTED');
      expect(updatedLead.callCount).toBe(1);
      expect(updatedLead.lastContactedAt).toBeDefined();

      // 6. Verify getLeadWithFullHistory returns history in newest-first order
      const fullHistory = (await crm.leads.getLeadWithFullHistory(lead.id))!;
      expect(fullHistory.callHistory.length).toBe(1);
      expect(fullHistory.callHistory[0].id).toBe(callRecord.id);
      expect(fullHistory.remarks.length).toBe(1);
      expect(fullHistory.remarks[0].id).toBe(remarkRecord.id);
    });

    it('records nothing when user skips/cancels call outcome', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Omega Fitness',
        phone: '+91 99999 88888',
        address: 'Alambagh, Lucknow',
      });

      // User dials, then cancels/skips
      // No callHistory or remarks are created
      const fullHistory = (await crm.leads.getLeadWithFullHistory(lead.id))!;
      expect(fullHistory.callHistory.length).toBe(0);
      expect(fullHistory.remarks.length).toBe(0);

      const refreshedLead = (await crm.leads.getLeadById(lead.id))!;
      expect(refreshedLead.status).toBe('NEW');
      expect(refreshedLead.callCount).toBe(0);
    });
  });
});
