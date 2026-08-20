import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { SalesCRMDatabase } from '../src/db/database';
import { createCRMDataLayer } from '../src/db';
import { CallLifecycleService } from '../src/services/callLifecycleService';
import { AgentManagementService } from '../src/services/agentManagementService';
import { LeadAssignmentService } from '../src/services/leadAssignmentService';
import { AuthService } from '../src/services/authService';
import { DeviceService } from '../src/services/deviceService';
import { NativePlatformService } from '../src/services/nativePlatform';
import { SyncConflictResolver } from '../src/services/sync/syncConflictResolver';
import { User, Lead, CallRecord } from '../src/db/types';

describe('Phase 2J: Verified Call Duration & Call Lifecycle Tracking', () => {
  let db: SalesCRMDatabase;
  let crm: ReturnType<typeof createCRMDataLayer>;
  let admin: User;
  let agentA: User;
  let agentB: User;
  let lead: Lead;

  beforeEach(async () => {
    DeviceService.resetDeviceIdForTesting();
    CallLifecycleService.resetForTesting();
    const testDbName = `test_call_lifecycle_${Math.random().toString(36).substring(7)}`;
    db = new SalesCRMDatabase(testDbName);
    crm = createCRMDataLayer(db);
    CallLifecycleService.setCustomDatabase(db);
    AgentManagementService.setCustomDatabase(db);
    LeadAssignmentService.setCustomDatabase(db);
    AuthService.setCustomDatabase(db);
    await db.seedDefaults();

    // Mock native dialer trigger
    vi.spyOn(NativePlatformService, 'openDialer').mockImplementation(() => {});

    // Create test admin and agent
    admin = await crm.users.createUser({
      id: 'admin-call-1',
      name: 'Admin Vikram',
      email: 'admin@amaratvkrishi.com',
      phone: '9988776655',
      role: 'ADMIN',
      status: 'ACTIVE',
    });

    agentA = await crm.users.createUser({
      id: 'agent-call-a',
      name: 'Agent Rahul',
      email: 'rahul@amaratvkrishi.com',
      phone: '9123456781',
      role: 'AGENT',
      status: 'ACTIVE',
      createdBy: admin.id,
    });

    agentB = await crm.users.createUser({
      id: 'agent-call-b',
      name: 'Agent Amit',
      email: 'amit@amaratvkrishi.com',
      phone: '9123456782',
      role: 'AGENT',
      status: 'ACTIVE',
      createdBy: admin.id,
    });

    lead = await crm.leads.createLead({
      businessName: 'Gold Gym Mahanagar',
      phone: '9876543210',
      address: 'Mahanagar, Lucknow',
      assignedTo: agentA.id,
    });
  });

  afterEach(async () => {
    CallLifecycleService.setCustomDatabase(null);
    AgentManagementService.setCustomDatabase(null);
    LeadAssignmentService.setCustomDatabase(null);
    AuthService.setCustomDatabase(null);
    CallLifecycleService.resetForTesting();
    await db.delete();
    vi.restoreAllMocks();
  });

  describe('1. Call Initiation & Lifecycle State Transitions', () => {
    it('creates a pending dial attempt and launches native dialer without fake duration', () => {
      const attempt = CallLifecycleService.initiateDial(agentA, lead);

      expect(attempt).toBeDefined();
      expect(attempt.leadId).toBe(lead.id);
      expect(attempt.userId).toBe(agentA.id);
      expect(attempt.state).toBe('DIAL_INITIATED');
      expect(attempt.returnedAt).toBeNull();
      expect(NativePlatformService.openDialer).toHaveBeenCalledWith('9876543210');
    });

    it('rejects unauthenticated dial attempts', () => {
      expect(() => {
        CallLifecycleService.initiateDial(null, lead);
      }).toThrow(/Unauthorized/i);
    });

    it('transitions through background and foreground states on app lifecycle change', () => {
      CallLifecycleService.initiateDial(agentA, lead);

      // App backgrounded (user in phone dialer)
      const bgResult = CallLifecycleService.handleAppStateChange(false);
      expect(bgResult).toBeNull();
      expect(CallLifecycleService.getPendingAttempt()?.state).toBe('APP_BACKGROUND');

      // App resumed (user returns to CRM)
      const fgResult = CallLifecycleService.handleAppStateChange(true);
      expect(fgResult).toBeDefined();
      expect(fgResult?.state).toBe('OUTCOME_PENDING');
      expect(fgResult?.returnedAt).not.toBeNull();
    });
  });

  describe('2. Duration Verification & Accuracy Safeguards', () => {
    it('guarantees standard ACTION_DIAL calls are strictly UNVERIFIED with durationSeconds = 0', async () => {
      CallLifecycleService.initiateDial(agentA, lead);
      CallLifecycleService.handleAppStateChange(false);
      CallLifecycleService.handleAppStateChange(true);

      const { callRecord, auditActivity } = await CallLifecycleService.completeCall(agentA, {
        outcome: 'CONNECTED',
        quickRemark: 'Interested in 25kg sample',
        updatedStatus: 'INTERESTED',
      });

      expect(callRecord.verificationStatus).toBe('UNVERIFIED');
      expect(callRecord.durationSeconds).toBe(0);
      expect(callRecord.outcome).toBe('CONNECTED');
      expect(callRecord.userId).toBe(agentA.id);

      // Check Activity Log
      expect(auditActivity.activityType).toBe('CALL_COMPLETED');
      expect(auditActivity.metadata.verificationStatus).toBe('UNVERIFIED');
      expect(auditActivity.metadata.durationSeconds).toBe(0);
    });

    it('records user-reported duration explicitly as UNVERIFIED without fabricating verified talk time', async () => {
      CallLifecycleService.initiateDial(agentA, lead);
      CallLifecycleService.handleAppStateChange(true);

      const { callRecord } = await CallLifecycleService.completeCall(agentA, {
        outcome: 'CONNECTED',
        reportedDurationSeconds: 180, // User reports ~3 mins
      });

      expect(callRecord.verificationStatus).toBe('UNVERIFIED');
      expect(callRecord.durationSeconds).toBe(0); // Automatic duration remains 0 / unverified
      expect((callRecord as any).reportedDurationSeconds).toBe(180);
    });

    it('marks call VERIFIED only when genuine verified telephony duration is supplied', async () => {
      CallLifecycleService.initiateDial(agentA, lead);
      CallLifecycleService.handleAppStateChange(true);

      const { callRecord } = await CallLifecycleService.completeCall(agentA, {
        outcome: 'CONNECTED',
        verifiedDurationSeconds: 245, // Genuine native telecom source
      });

      expect(callRecord.verificationStatus).toBe('VERIFIED');
      expect(callRecord.durationSeconds).toBe(245);
    });
  });

  describe('3. Outcome Handling, Ghost Call Prevention & Idempotency', () => {
    it('sets callStatus = NOT_CONNECTED for busy / unanswered outcomes', async () => {
      CallLifecycleService.initiateDial(agentA, lead);
      CallLifecycleService.handleAppStateChange(true);

      const { callRecord } = await CallLifecycleService.completeCall(agentA, {
        outcome: 'BUSY',
      });

      expect(callRecord.outcome).toBe('BUSY');
      expect((callRecord as any).callStatus).toBe('NOT_CONNECTED');
    });

    it('does NOT create a ghost CallRecord when the user cancels or dismisses the outcome modal', async () => {
      CallLifecycleService.initiateDial(agentA, lead);
      CallLifecycleService.handleAppStateChange(true);

      // User dismisses modal without saving
      CallLifecycleService.cancelCall();

      const savedRecords = await db.callRecords.toArray();
      expect(savedRecords.length).toBe(0);
      expect(CallLifecycleService.getPendingAttempt()).toBeNull();
    });

    it('prevents duplicate CallRecords when duplicate lifecycle events fire', async () => {
      CallLifecycleService.initiateDial(agentA, lead);

      // Multiple foreground events
      CallLifecycleService.handleAppStateChange(true);
      CallLifecycleService.handleAppStateChange(true);

      const attempt = CallLifecycleService.getPendingAttempt();
      expect(attempt?.attemptId).toBeDefined();

      await CallLifecycleService.completeCall(agentA, {
        outcome: 'CONNECTED',
      });

      const records = await db.callRecords.where('leadId').equals(lead.id).toArray();
      expect(records.length).toBe(1);
    });

    it('records distinct CallRecords for multiple consecutive calls to the same lead', async () => {
      // Call 1
      CallLifecycleService.initiateDial(agentA, lead);
      CallLifecycleService.handleAppStateChange(true);
      await CallLifecycleService.completeCall(agentA, { outcome: 'NO_ANSWER' });

      // Call 2
      CallLifecycleService.initiateDial(agentA, lead);
      CallLifecycleService.handleAppStateChange(true);
      await CallLifecycleService.completeCall(agentA, { outcome: 'CONNECTED' });

      const records = await db.callRecords.where('leadId').equals(lead.id).toArray();
      expect(records.length).toBe(2);
      expect(records[0].id).not.toBe(records[1].id);
      const outcomes = records.map((r) => r.outcome);
      expect(outcomes).toContain('NO_ANSWER');
      expect(outcomes).toContain('CONNECTED');

      // Check Lead call count
      const updatedLead = await crm.leads.getLeadById(lead.id);
      expect(updatedLead?.callCount).toBe(2);
    });
  });

  describe('4. Multi-User Calling & Sync Outbox Integration', () => {
    it('records Admin userId when Admin places call and logs to central history', async () => {
      CallLifecycleService.initiateDial(admin, lead);
      CallLifecycleService.handleAppStateChange(true);

      const { callRecord, auditActivity } = await CallLifecycleService.completeCall(admin, {
        outcome: 'CONNECTED',
        quickRemark: 'Admin follow-up for sample',
      });

      expect(callRecord.userId).toBe(admin.id);
      expect(auditActivity.userId).toBe(admin.id);
      expect(auditActivity.metadata.repName).toBe('Admin Vikram');
    });

    it('enqueues call record creation into the sync outbox', async () => {
      CallLifecycleService.initiateDial(agentA, lead);
      CallLifecycleService.handleAppStateChange(true);

      const { callRecord } = await CallLifecycleService.completeCall(agentA, {
        outcome: 'CONNECTED',
      });

      const outboxItem = await db.outbox.where('entityId').equals(callRecord.id).first();
      expect(outboxItem).toBeDefined();
      expect(outboxItem?.entityType).toBe('call_records');
      expect(outboxItem?.operation).toBe('CREATE');
      expect(outboxItem?.payload.userId).toBe(agentA.id);
    });

    it('preserves historical call records after lead reassignment and agent deactivation', async () => {
      // Agent A calls lead
      CallLifecycleService.initiateDial(agentA, lead);
      CallLifecycleService.handleAppStateChange(true);
      const { callRecord } = await CallLifecycleService.completeCall(agentA, { outcome: 'CONNECTED' });

      // Admin reassigns lead to Agent B
      await LeadAssignmentService.assignLead(admin, lead.id, agentB.id);

      // Admin deactivates Agent A
      await AgentManagementService.deactivateAgent(admin, agentA.id);

      // Historical call record must still exist and attribute to Agent A
      const savedCall = await db.callRecords.get(callRecord.id);
      expect(savedCall).toBeDefined();
      expect(savedCall?.userId).toBe(agentA.id);
      expect(savedCall?.outcome).toBe('CONNECTED');
    });
  });

  describe('5. Sync Conflict Resolution & Admin Analytics Foundation', () => {
    it('guarantees VERIFIED call duration strictly wins over UNVERIFIED duration in conflict resolution', () => {
      const localUnverified: CallRecord = {
        id: 'call-conf-1',
        leadId: lead.id,
        userId: agentA.id,
        deviceId: 'dev-1',
        startedAt: '2026-08-20T10:00:00.000Z',
        answeredAt: null,
        endedAt: '2026-08-20T10:05:00.000Z',
        durationSeconds: 0,
        outcome: 'CONNECTED',
        remark: null,
        verificationStatus: 'UNVERIFIED',
        createdAt: '2026-08-20T10:05:00.000Z',
        updatedAt: '2026-08-20T10:05:00.000Z',
        isSynced: 1,
        deletedAt: null,
      };

      const remoteVerified: CallRecord = {
        ...localUnverified,
        durationSeconds: 183,
        verificationStatus: 'VERIFIED',
        updatedAt: '2026-08-20T10:04:00.000Z', // Even if remote timestamp is slightly older
      };

      const res = SyncConflictResolver.resolveCallRecord(localUnverified, remoteVerified);
      expect(res.winner).toBe('REMOTE');
      expect(res.data.durationSeconds).toBe(183);
      expect(res.data.verificationStatus).toBe('VERIFIED');
    });

    it('computes verified talk time and excludes unverified calls from talk time total', async () => {
      // 3 verified calls: 120s, 180s, 60s -> Total verified: 360s, avg: 120s
      await crm.callRecords.createCallRecord({
        leadId: lead.id,
        userId: agentA.id,
        startedAt: new Date().toISOString(),
        durationSeconds: 120,
        outcome: 'CONNECTED',
        verificationStatus: 'VERIFIED',
      });

      await crm.callRecords.createCallRecord({
        leadId: lead.id,
        userId: agentA.id,
        startedAt: new Date().toISOString(),
        durationSeconds: 180,
        outcome: 'CONNECTED',
        verificationStatus: 'VERIFIED',
      });

      await crm.callRecords.createCallRecord({
        leadId: lead.id,
        userId: agentA.id,
        startedAt: new Date().toISOString(),
        durationSeconds: 60,
        outcome: 'CONNECTED',
        verificationStatus: 'VERIFIED',
      });

      // 2 unverified calls: durationSeconds = 0
      await crm.callRecords.createCallRecord({
        leadId: lead.id,
        userId: agentA.id,
        startedAt: new Date().toISOString(),
        durationSeconds: 0,
        outcome: 'CONNECTED',
        verificationStatus: 'UNVERIFIED',
      });

      await crm.callRecords.createCallRecord({
        leadId: lead.id,
        userId: agentA.id,
        startedAt: new Date().toISOString(),
        durationSeconds: 0,
        outcome: 'BUSY',
        verificationStatus: 'UNVERIFIED',
      });

      const counts = await crm.callRecords.getCallCountForAgent(agentA.id);
      expect(counts.total).toBe(5);
      expect(counts.verified).toBe(3);
      expect(counts.unverified).toBe(2);

      const verifiedTalkTime = await crm.callRecords.getVerifiedTalkTimeForAgent(agentA.id);
      expect(verifiedTalkTime).toBe(360); // 120 + 180 + 60

      const avgDuration = await crm.callRecords.getAverageVerifiedCallDuration(agentA.id);
      expect(avgDuration).toBe(120);

      const orgSummary = await crm.callRecords.getOrganisationCallSummary();
      expect(orgSummary.totalCalls).toBe(5);
      expect(orgSummary.verifiedCalls).toBe(3);
      expect(orgSummary.unverifiedCalls).toBe(2);
      expect(orgSummary.totalVerifiedTalkTimeSeconds).toBe(360);
      expect(orgSummary.averageVerifiedDurationSeconds).toBe(120);
    });
  });
});
