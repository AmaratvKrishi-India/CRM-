import 'fake-indexeddb/auto';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { determineDefaultLeadStatus } from '../src/services/callOutcomeMapping.ts';
import { CallLifecycleService } from '../src/services/callLifecycleService.ts';
import { SalesCRMDatabase } from '../src/db/database.ts';
import { createCRMDataLayer } from '../src/db/index.ts';
import type { Lead, User } from '../src/db/types.ts';

describe('Real Telephony Lifecycle & Outcome Mapping Tests (Stage 7)', () => {
  describe('determineDefaultLeadStatus Pure Logic', () => {
    it('1. Order Confirmed remark maps to CUSTOMER status', () => {
      const status = determineDefaultLeadStatus('INTERESTED', 'CONNECTED', 'Order Confirmed');
      assert.strictEqual(status, 'CUSTOMER');
    });

    it('2. Asked for Sample maps to SAMPLE_REQUESTED status', () => {
      const status = determineDefaultLeadStatus('NEW', 'CONNECTED', 'Asked for Sample');
      assert.strictEqual(status, 'SAMPLE_REQUESTED');
    });

    it('3. Interested / Price Inquiry maps to INTERESTED status', () => {
      const status1 = determineDefaultLeadStatus('NEW', 'CONNECTED', 'Interested');
      assert.strictEqual(status1, 'INTERESTED');

      const status2 = determineDefaultLeadStatus('NEW', 'CONNECTED', 'Asked for Price');
      assert.strictEqual(status2, 'INTERESTED');
    });

    it('4. Call Later / Meeting Required maps to FOLLOW_UP status', () => {
      const status = determineDefaultLeadStatus('NEW', 'CONNECTED', 'Call Later');
      assert.strictEqual(status, 'FOLLOW_UP');
    });

    it('5. Wrong Number / Invalid Number outcomes map correctly', () => {
      const statusWrong = determineDefaultLeadStatus('NEW', 'WRONG_NUMBER', null);
      assert.strictEqual(statusWrong, 'WRONG_NUMBER');

      const statusInvalid = determineDefaultLeadStatus('NEW', 'INVALID_NUMBER', null);
      assert.strictEqual(statusInvalid, 'WRONG_NUMBER');
    });
  });

  describe('CallLifecycleService Telephony Invariants', () => {
    it('1. Enforces UNVERIFIED status under ACTION_DIAL to prevent fabricated talk time', async () => {
      const db = new SalesCRMDatabase(`CallLifeTest_${Date.now()}`);
      const dataLayer = createCRMDataLayer(db);
      CallLifecycleService.setCustomDatabase(db);

      const testLead: Lead = {
        id: 'lead-dial-001',
        businessName: 'Dynamic Fitness',
        phone: '9876543210',
        status: 'NEW',
        locality: 'Alambagh',
        isSynced: 1,
        deletedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.leads.add(testLead);

      const testUser: User = {
        id: 'user-01',
        name: 'Agent Rohit',
        email: 'rohit@amaratv.com',
        role: 'AGENT',
        status: 'ACTIVE',
        organizationId: 'org-01',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Initiate dial with (actor, lead)
      const attempt = CallLifecycleService.initiateDial(testUser, testLead);
      assert.ok(attempt);
      assert.strictEqual(attempt.leadId, 'lead-dial-001');

      // Complete call with reported duration and calculated status transition
      const result = await CallLifecycleService.completeCall(testUser, {
        outcome: 'CONNECTED',
        quickRemark: 'Interested',
        customNote: 'Good conversation with gym owner',
        updatedStatus: determineDefaultLeadStatus('NEW', 'CONNECTED', 'Interested'),
        reportedDurationSeconds: 120, // 2 minutes reported by rep
      });

      assert.ok(result);
      assert.strictEqual(result.callRecord.outcome, 'CONNECTED');
      // CRITICAL TELEPHONY INVARIANT: ACTION_DIAL duration is 0 and UNVERIFIED
      assert.strictEqual(result.callRecord.verificationStatus, 'UNVERIFIED');
      assert.strictEqual(result.callRecord.durationSeconds, 0);
      assert.strictEqual(result.callRecord.reportedDurationSeconds, 120);

      // Verify Lead status was automatically updated to INTERESTED
      const updatedLead = await db.leads.get(testLead.id);
      assert.strictEqual(updatedLead?.status, 'INTERESTED');

      CallLifecycleService.setCustomDatabase(null);
      await db.close();
    });
  });
});
