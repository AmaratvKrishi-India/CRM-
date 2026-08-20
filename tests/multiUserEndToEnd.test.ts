import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { SalesCRMDatabase } from '../src/db/database';
import { createCRMDataLayer } from '../src/db';
import { AdminAnalyticsService } from '../src/services/adminAnalyticsService';
import { AdminReportsService } from '../src/services/adminReportsService';
import { LeadAssignmentService } from '../src/services/leadAssignmentService';
import { SyncConflictResolver } from '../src/services/sync/syncConflictResolver';
import { User, Lead, CallRecord } from '../src/db/types';

describe('Phase 2N: Multi-User Collaboration & Synchronization E2E', () => {
  let db: SalesCRMDatabase;
  let crm: ReturnType<typeof createCRMDataLayer>;
  let admin: User;
  let agentA: User;
  let agentB: User;

  beforeEach(async () => {
    const testDbName = `test_multi_user_${Math.random().toString(36).substring(7)}`;
    db = new SalesCRMDatabase(testDbName);
    crm = createCRMDataLayer(db);
    AdminAnalyticsService.setCustomDatabase(db);
    AdminReportsService.setCustomDatabase(db);
    LeadAssignmentService.setCustomDatabase(db);
    await db.seedDefaults();

    // 1. Provision Admin
    admin = await crm.users.createUser({
      id: 'admin-mu-1',
      name: 'Admin Vikram',
      email: 'admin@amaratvkrishi.com',
      phone: '9988776655',
      role: 'ADMIN',
      status: 'ACTIVE',
      organizationId: 'org-amaratv-1',
    });

    // 2. Admin provisions Agent A
    agentA = await crm.users.createUser({
      id: 'agent-mu-a',
      name: 'Agent Rahul',
      email: 'rahul@amaratvkrishi.com',
      phone: '9123456781',
      role: 'AGENT',
      status: 'ACTIVE',
      organizationId: 'org-amaratv-1',
      createdBy: admin.id,
    });

    // 3. Admin provisions Agent B
    agentB = await crm.users.createUser({
      id: 'agent-mu-b',
      name: 'Agent Priya',
      email: 'priya@amaratvkrishi.com',
      phone: '9123456782',
      role: 'AGENT',
      status: 'ACTIVE',
      organizationId: 'org-amaratv-1',
      createdBy: admin.id,
    });
  });

  afterEach(async () => {
    AdminAnalyticsService.setCustomDatabase(null);
    AdminReportsService.setCustomDatabase(null);
    await db.delete();
  });

  it('executes full multi-user collaborative lead lifecycle from creation to assignment to call logging', async () => {
    // Step 1: Agent A creates a lead
    const lead = await crm.leads.createLead({
      businessName: '[TEST-2N] Gold Gym Mahanagar',
      phone: '9876543210',
      address: 'Mahanagar, Lucknow',
      locality: 'Mahanagar',
      status: 'NEW',
      createdBy: agentA.id,
      assignedTo: agentA.id,
    });

    expect(lead.createdBy).toBe(agentA.id);
    expect(lead.assignedTo).toBe(agentA.id);

    // Step 2: Admin reassigns the lead from Agent A to Agent B
    const { lead: reassignedLead } = await LeadAssignmentService.assignLead(
      admin,
      lead.id,
      agentB.id
    );

    expect(reassignedLead.assignedTo).toBe(agentB.id);

    // Verify reassignment activity log
    const activities = await db.activities.where('leadId').equals(lead.id).toArray();
    const reassignAct = activities.find((a) => a.activityType === 'LEAD_REASSIGNED');
    expect(reassignAct).toBeDefined();
    expect(reassignAct?.userId).toBe(admin.id);
    expect((reassignAct?.metadata as any).previousAssigneeId).toBe(agentA.id);
    expect((reassignAct?.metadata as any).newAssigneeId).toBe(agentB.id);

    // Step 3: Agent B performs a call with verified 180s talk time
    const callRecord = await crm.callRecords.createCallRecord({
      leadId: lead.id,
      userId: agentB.id,
      startedAt: new Date().toISOString(),
      durationSeconds: 180,
      outcome: 'CONNECTED',
      verificationStatus: 'VERIFIED',
      remark: 'Gym owner requested product catalog on WhatsApp',
    });

    expect(callRecord.durationSeconds).toBe(180);
    expect(callRecord.verificationStatus).toBe('VERIFIED');
    expect(callRecord.userId).toBe(agentB.id);

    // Step 4: Agent B schedules a follow-up
    const followUp = await crm.followUps.createFollowUp({
      leadId: lead.id,
      userId: agentB.id,
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      title: 'Deliver 1kg protein flour sample',
    });

    expect(followUp.userId).toBe(agentB.id);

    // Step 5: Admin Analytics reflects verified attribution
    const kpis = await AdminAnalyticsService.getOrganisationKPIs(admin);
    expect(kpis.leads.total).toBe(1);
    expect(kpis.leads.assigned).toBe(1);
    expect(kpis.calls.total).toBe(1);
    expect(kpis.calls.verified).toBe(1);
    expect(kpis.calls.verifiedTalkTimeSeconds).toBe(180);
    expect(kpis.calls.averageVerifiedDurationSeconds).toBe(180);

    const agentList = await AdminAnalyticsService.getAgentPerformanceList(admin);
    const agentBPerf = agentList.find((a) => a.agentId === agentB.id);
    expect(agentBPerf?.leadsAssigned).toBe(1);
    expect(agentBPerf?.callsTotal).toBe(1);
    expect(agentBPerf?.verifiedTalkTimeSeconds).toBe(180);

    const agentAPerf = agentList.find((a) => a.agentId === agentA.id);
    expect(agentAPerf?.leadsAssigned).toBe(0);
    expect(agentAPerf?.callsTotal).toBe(0);
  });

  it('reconciles concurrent edits safely using conflict resolution rules', () => {
    // Conflict resolution on mutable Lead
    const localLead = {
      id: 'lead-conflict-1',
      status: 'SAMPLE_REQUESTED',
      updatedAt: '2026-08-20T10:00:00.000Z',
    };
    const remoteLead = {
      id: 'lead-conflict-1',
      status: 'INTERESTED',
      updatedAt: '2026-08-20T10:05:00.000Z', // Remote is newer
    };

    const resolvedLead = SyncConflictResolver.resolveMutable('leads', localLead as any, remoteLead as any);
    expect(resolvedLead.winner).toBe('REMOTE');
    expect(resolvedLead.data.status).toBe('INTERESTED');

    // Conflict resolution on Call Record: VERIFIED wins over UNVERIFIED
    const localVerifiedCall = {
      id: 'call-conf-1',
      durationSeconds: 300,
      verificationStatus: 'VERIFIED',
      updatedAt: '2026-08-20T10:00:00.000Z',
    };
    const remoteUnverifiedCall = {
      id: 'call-conf-1',
      durationSeconds: 0,
      verificationStatus: 'UNVERIFIED',
      updatedAt: '2026-08-20T10:10:00.000Z', // Even if newer
    };

    const resolvedCall = SyncConflictResolver.resolveCallRecord(localVerifiedCall as any, remoteUnverifiedCall as any);
    expect(resolvedCall.winner).toBe('LOCAL');
    expect(resolvedCall.data.durationSeconds).toBe(300);
    expect(resolvedCall.data.verificationStatus).toBe('VERIFIED');
  });
});
