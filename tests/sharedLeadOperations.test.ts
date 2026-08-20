import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { SalesCRMDatabase } from '../src/db/database';
import { createCRMDataLayer } from '../src/db';
import { LeadAssignmentService } from '../src/services/leadAssignmentService';
import { AgentManagementService } from '../src/services/agentManagementService';
import { AuthService } from '../src/services/authService';
import { DeviceService } from '../src/services/deviceService';
import { User, Lead } from '../src/db/types';

describe('Phase 2I: Shared Lead Operations, Assignment & Reassignment', () => {
  let db: SalesCRMDatabase;
  let crm: ReturnType<typeof createCRMDataLayer>;
  let admin: User;
  let agentA: User;
  let agentB: User;
  let inactiveAgent: User;

  beforeEach(async () => {
    DeviceService.resetDeviceIdForTesting();
    const testDbName = `test_shared_lead_${Math.random().toString(36).substring(7)}`;
    db = new SalesCRMDatabase(testDbName);
    crm = createCRMDataLayer(db);
    LeadAssignmentService.setCustomDatabase(db);
    AgentManagementService.setCustomDatabase(db);
    AuthService.setCustomDatabase(db);
    await db.seedDefaults();

    // Create Admin
    admin = await crm.users.createUser({
      id: 'admin-lead-op-1',
      name: 'Admin Vikram',
      email: 'admin@amaratvkrishi.com',
      phone: '9988776655',
      role: 'ADMIN',
      status: 'ACTIVE',
    });

    // Create Active Agents
    agentA = await crm.users.createUser({
      id: 'agent-lead-op-a',
      name: 'Agent Rahul',
      email: 'rahul@amaratvkrishi.com',
      phone: '9123456781',
      role: 'AGENT',
      status: 'ACTIVE',
      createdBy: admin.id,
    });

    agentB = await crm.users.createUser({
      id: 'agent-lead-op-b',
      name: 'Agent Amit',
      email: 'amit@amaratvkrishi.com',
      phone: '9123456782',
      role: 'AGENT',
      status: 'ACTIVE',
      createdBy: admin.id,
    });

    // Create Inactive Agent
    inactiveAgent = await crm.users.createUser({
      id: 'agent-lead-op-inactive',
      name: 'Agent Suresh',
      email: 'suresh@amaratvkrishi.com',
      phone: '9123456783',
      role: 'AGENT',
      status: 'INACTIVE',
      createdBy: admin.id,
    });
  });

  afterEach(async () => {
    LeadAssignmentService.setCustomDatabase(null);
    AgentManagementService.setCustomDatabase(null);
    AuthService.setCustomDatabase(null);
    await db.delete();
    vi.restoreAllMocks();
  });

  describe('1. Lead Assignment & Authorization Guards', () => {
    it('allows Admin to assign an unassigned lead to an active agent', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Skywards Fitness Gomti Nagar',
        phone: '9876543201',
        address: 'Gomti Nagar, Lucknow',
        createdBy: admin.id,
      });

      const { lead: assignedLead, auditActivity } = await LeadAssignmentService.assignLead(
        admin,
        lead.id,
        agentA.id
      );

      expect(assignedLead.assignedTo).toBe(agentA.id);
      expect(assignedLead.updatedBy).toBe(admin.id);

      // Verify activity audit event
      expect(auditActivity.activityType).toBe('LEAD_ASSIGNED');
      expect(auditActivity.userId).toBe(admin.id);
      expect(auditActivity.metadata.newAssigneeId).toBe(agentA.id);
      expect(auditActivity.metadata.newAssigneeName).toBe('Agent Rahul');
      expect(auditActivity.metadata.previousAssigneeId).toBeNull();
    });

    it('allows Admin to reassign a lead from Agent A to Agent B', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Gold Gym Alambagh',
        phone: '9876543202',
        address: 'Alambagh, Lucknow',
        createdBy: admin.id,
        assignedTo: agentA.id,
      });

      const { lead: reassignedLead, auditActivity } = await LeadAssignmentService.assignLead(
        admin,
        lead.id,
        agentB.id
      );

      expect(reassignedLead.assignedTo).toBe(agentB.id);

      // Verify reassignment activity audit
      expect(auditActivity.activityType).toBe('LEAD_REASSIGNED');
      expect(auditActivity.metadata.previousAssigneeId).toBe(agentA.id);
      expect(auditActivity.metadata.previousAssigneeName).toBe('Agent Rahul');
      expect(auditActivity.metadata.newAssigneeId).toBe(agentB.id);
      expect(auditActivity.metadata.newAssigneeName).toBe('Agent Amit');
    });

    it('rejects lead assignment when caller is an AGENT', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Fit Zone Chowk',
        phone: '9876543203',
        address: 'Chowk, Lucknow',
      });

      await expect(
        LeadAssignmentService.assignLead(agentA, lead.id, agentB.id)
      ).rejects.toThrow(/Only administrators are permitted to assign or reassign leads/i);
    });

    it('rejects assignment to an INACTIVE agent', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Anytime Fitness Indira Nagar',
        phone: '9876543204',
        address: 'Indira Nagar, Lucknow',
      });

      await expect(
        LeadAssignmentService.assignLead(admin, lead.id, inactiveAgent.id)
      ).rejects.toThrow(/Cannot assign lead to inactive agent/i);
    });

    it('allows Admin to unassign a lead', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Cult Fit Mahanagar',
        phone: '9876543205',
        address: 'Mahanagar, Lucknow',
        assignedTo: agentA.id,
      });

      const { lead: unassignedLead, auditActivity } = await LeadAssignmentService.unassignLead(
        admin,
        lead.id
      );

      expect(unassignedLead.assignedTo).toBeNull();
      expect(auditActivity.activityType).toBe('LEAD_UNASSIGNED');
      expect(auditActivity.metadata.previousAssigneeId).toBe(agentA.id);
    });
  });

  describe('2. Assignment Queuing & Outbox Sync', () => {
    it('queues assignment mutations into the persistent outbox for cloud sync', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Muscle Factory Aliganj',
        phone: '9876543206',
        address: 'Aliganj, Lucknow',
      });

      await LeadAssignmentService.assignLead(admin, lead.id, agentA.id);

      const outboxItems = await db.outbox.where('entityType').equals('leads').toArray();
      expect(outboxItems.length).toBeGreaterThan(0);

      const lastMutation = outboxItems[outboxItems.length - 1];
      expect(lastMutation.entityId).toBe(lead.id);
      expect(lastMutation.operation).toBe('UPDATE');
      expect(lastMutation.payload.assignedTo).toBe(agentA.id);
    });
  });

  describe('3. Timeline & Activity History', () => {
    it('maintains chronological history of creation, assignment, and sales events', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Iron Paradise Hazratganj',
        phone: '9876543207',
        address: 'Hazratganj, Lucknow',
        createdBy: agentA.id,
      });

      // Log creation activity
      await crm.activities.logActivity({
        leadId: lead.id,
        userId: agentA.id,
        deviceId: 'dev-1',
        activityType: 'LEAD_CREATED',
        metadata: { leadId: lead.id, createdByName: 'Agent Rahul' },
      });

      // Admin assigns lead to Agent B
      await LeadAssignmentService.assignLead(admin, lead.id, agentB.id);

      // Log a call completed activity
      await crm.activities.logActivity({
        leadId: lead.id,
        userId: agentB.id,
        deviceId: 'dev-2',
        activityType: 'CALL_COMPLETED',
        metadata: { leadId: lead.id, outcome: 'CONNECTED' },
      });

      const timeline = await LeadAssignmentService.getLeadHistoryTimeline(lead.id);
      expect(timeline.length).toBe(3);
      const types = timeline.map((t) => t.activityType);
      expect(types).toContain('LEAD_CREATED');
      expect(types).toContain('LEAD_ASSIGNED');
      expect(types).toContain('CALL_COMPLETED');
    });
  });

  describe('4. Search, Filtering & Assignment Counters', () => {
    it('computes accurate assignment metrics (total, unassigned, assigned, byAgent)', async () => {
      await crm.leads.createLead({ businessName: 'Gym 1', phone: '9000000001', address: 'Lucknow', assignedTo: agentA.id });
      await crm.leads.createLead({ businessName: 'Gym 2', phone: '9000000002', address: 'Lucknow', assignedTo: agentA.id });
      await crm.leads.createLead({ businessName: 'Gym 3', phone: '9000000003', address: 'Lucknow', assignedTo: agentB.id });
      await crm.leads.createLead({ businessName: 'Gym 4', phone: '9000000004', address: 'Lucknow', assignedTo: null });

      const stats = await LeadAssignmentService.getAssignmentStats(admin);
      expect(stats.totalLeads).toBe(4);
      expect(stats.assignedCount).toBe(3);
      expect(stats.unassignedCount).toBe(1);
      expect(stats.byAgent[agentA.id]).toBe(2);
      expect(stats.byAgent[agentB.id]).toBe(1);
    });

    it('filters leads by specific agent, unassigned, and assigned status', async () => {
      await crm.leads.createLead({ businessName: 'Alpha Gym', phone: '9100000001', address: 'Lucknow', assignedTo: agentA.id });
      await crm.leads.createLead({ businessName: 'Beta Gym', phone: '9100000002', address: 'Lucknow', assignedTo: agentB.id });
      await crm.leads.createLead({ businessName: 'Gamma Gym', phone: '9100000003', address: 'Lucknow', assignedTo: null });

      // Filter by agentA
      const resA = await crm.leads.searchAndFilterLeads({ assignedTo: agentA.id });
      expect(resA.total).toBe(1);
      expect(resA.leads[0].businessName).toBe('Alpha Gym');

      // Filter by UNASSIGNED
      const resUnassigned = await crm.leads.searchAndFilterLeads({ assignedTo: 'UNASSIGNED' });
      expect(resUnassigned.total).toBe(1);
      expect(resUnassigned.leads[0].businessName).toBe('Gamma Gym');

      // Filter by ASSIGNED
      const resAssigned = await crm.leads.searchAndFilterLeads({ assignedTo: 'ASSIGNED' });
      expect(resAssigned.total).toBe(2);
    });
  });

  describe('5. Admin Sales Mode Operations', () => {
    it('allows Admin to log calls, follow-ups, and remarks in sales mode', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Apex Fitness Alambagh',
        phone: '9888877771',
        address: 'Alambagh, Lucknow',
      });

      // Admin logs call
      const call = await crm.callRecords.createCallRecord({
        leadId: lead.id,
        userId: admin.id,
        startedAt: new Date().toISOString(),
        durationSeconds: 120,
        outcome: 'CONNECTED',
        remark: 'Admin discussed bulk protein flour supply',
        verificationStatus: 'UNVERIFIED',
      });

      // Admin adds remark
      const remark = await crm.remarks.addRemark({
        leadId: lead.id,
        content: 'Gym manager interested in 25kg sample',
        type: 'CUSTOM',
        author: admin.name,
      });

      // Admin schedules follow-up
      const followUp = await crm.followUps.scheduleFollowUp({
        leadId: lead.id,
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        title: 'Deliver 25kg sample bag',
        priority: 'HIGH',
      });

      expect(call.durationSeconds).toBe(120);
      expect(remark.content).toBe('Gym manager interested in 25kg sample');
      expect(followUp.title).toBe('Deliver 25kg sample bag');
    });
  });
});
