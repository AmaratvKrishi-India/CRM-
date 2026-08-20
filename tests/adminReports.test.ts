import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { SalesCRMDatabase } from '../src/db/database';
import { createCRMDataLayer } from '../src/db';
import { AdminReportsService } from '../src/services/adminReportsService';
import { User, Lead } from '../src/db/types';

describe('Phase 2M: Admin Reports Service & Aggregations', () => {
  let db: SalesCRMDatabase;
  let crm: ReturnType<typeof createCRMDataLayer>;
  let admin: User;
  let agentA: User;
  let agentB: User;
  let lead1: Lead;
  let lead2: Lead;

  beforeEach(async () => {
    const testDbName = `test_admin_reports_${Math.random().toString(36).substring(7)}`;
    db = new SalesCRMDatabase(testDbName);
    crm = createCRMDataLayer(db);
    AdminReportsService.setCustomDatabase(db);
    await db.seedDefaults();

    admin = await crm.users.createUser({
      id: 'admin-rep-1',
      name: 'Admin Vikram',
      email: 'admin@amaratvkrishi.com',
      phone: '9988776655',
      role: 'ADMIN',
      status: 'ACTIVE',
      organizationId: 'org-amaratv-1',
    });

    agentA = await crm.users.createUser({
      id: 'agent-rep-a',
      name: 'Agent Rahul',
      email: 'rahul@amaratvkrishi.com',
      phone: '9123456781',
      role: 'AGENT',
      status: 'ACTIVE',
      organizationId: 'org-amaratv-1',
      createdBy: admin.id,
    });

    agentB = await crm.users.createUser({
      id: 'agent-rep-b',
      name: 'Agent Amit',
      email: 'amit@amaratvkrishi.com',
      phone: '9123456782',
      role: 'AGENT',
      status: 'ACTIVE',
      organizationId: 'org-amaratv-1',
      createdBy: admin.id,
    });

    lead1 = await crm.leads.createLead({
      businessName: 'Gold Gym Mahanagar',
      phone: '9876543210',
      address: 'Mahanagar, Lucknow',
      locality: 'Mahanagar',
      status: 'CUSTOMER',
      assignedTo: agentA.id,
      createdBy: agentA.id,
    });

    lead2 = await crm.leads.createLead({
      businessName: 'Apollo Fitness Aliganj',
      phone: '9876543211',
      address: 'Aliganj, Lucknow',
      locality: 'Aliganj',
      status: 'NEW',
      assignedTo: null,
      createdBy: admin.id,
    });
  });

  afterEach(async () => {
    AdminReportsService.setCustomDatabase(null);
    await db.delete();
  });

  describe('1. Security & Role Authorization Guard', () => {
    it('rejects access to all report methods when caller is an AGENT', async () => {
      await expect(AdminReportsService.getLeadReport(agentA)).rejects.toThrow(/Unauthorized/i);
      await expect(AdminReportsService.getCallReport(agentA)).rejects.toThrow(/Unauthorized/i);
      await expect(AdminReportsService.getAgentProductivityReport(agentA)).rejects.toThrow(/Unauthorized/i);
      await expect(AdminReportsService.getFollowUpReport(agentA)).rejects.toThrow(/Unauthorized/i);
      await expect(AdminReportsService.getWhatsAppReport(agentA)).rejects.toThrow(/Unauthorized/i);
      await expect(AdminReportsService.getImportReport(agentA)).rejects.toThrow(/Unauthorized/i);
      await expect(AdminReportsService.getActivityReport(agentA)).rejects.toThrow(/Unauthorized/i);
      await expect(AdminReportsService.exportReportToCSV(agentA, 'LEADS')).rejects.toThrow(/Unauthorized/i);
    });

    it('permits access to all report methods when caller is an ADMIN', async () => {
      const leadRep = await AdminReportsService.getLeadReport(admin);
      expect(leadRep).toBeDefined();
      expect(leadRep.totalLeads).toBe(2);
      expect(leadRep.convertedCustomers).toBe(1);
      expect(leadRep.conversionPercentage).toBe(50);
    });
  });

  describe('2. Call Report & Talk-Time Invariant', () => {
    it('computes call statistics and strictly excludes unverified duration from talk time', async () => {
      // Agent A: 200s verified call
      await crm.callRecords.createCallRecord({
        leadId: lead1.id,
        userId: agentA.id,
        startedAt: new Date().toISOString(),
        durationSeconds: 200,
        outcome: 'CONNECTED',
        verificationStatus: 'VERIFIED',
      });

      // Agent B: 0s unverified call
      await crm.callRecords.createCallRecord({
        leadId: lead2.id,
        userId: agentB.id,
        startedAt: new Date().toISOString(),
        durationSeconds: 0,
        outcome: 'NO_ANSWER',
        verificationStatus: 'UNVERIFIED',
      });

      const callRep = await AdminReportsService.getCallReport(admin);
      expect(callRep.totalCalls).toBe(2);
      expect(callRep.verifiedCalls).toBe(1);
      expect(callRep.unverifiedCalls).toBe(1);
      expect(callRep.verifiedTalkTimeSeconds).toBe(200);
      expect(callRep.averageVerifiedDurationSeconds).toBe(200);
      expect(callRep.longestVerifiedDurationSeconds).toBe(200);
    });
  });

  describe('3. Agent Productivity Report', () => {
    it('accurately calculates productivity metrics across agents', async () => {
      await crm.callRecords.createCallRecord({
        leadId: lead1.id,
        userId: agentA.id,
        startedAt: new Date().toISOString(),
        durationSeconds: 150,
        outcome: 'CONNECTED',
        verificationStatus: 'VERIFIED',
      });

      const prodRep = await AdminReportsService.getAgentProductivityReport(admin);
      expect(prodRep.length).toBe(2);

      const agentAStats = prodRep.find((a) => a.agentId === agentA.id);
      expect(agentAStats).toBeDefined();
      expect(agentAStats?.leadsCreated).toBe(1);
      expect(agentAStats?.leadsAssigned).toBe(1);
      expect(agentAStats?.callsMade).toBe(1);
      expect(agentAStats?.verifiedCalls).toBe(1);
      expect(agentAStats?.verifiedTalkTimeSeconds).toBe(150);
      expect(agentAStats?.customersConverted).toBe(1);
      expect(agentAStats?.conversionRatePercentage).toBe(100);
    });
  });

  describe('4. Locality & Date Filtering', () => {
    it('filters lead reports accurately by locality', async () => {
      const mahanagarOnly = await AdminReportsService.getLeadReport(admin, {
        locality: 'Mahanagar',
      });
      expect(mahanagarOnly.totalLeads).toBe(1);
      expect(mahanagarOnly.assignedLeads).toBe(1);

      const aliganjOnly = await AdminReportsService.getLeadReport(admin, {
        locality: 'Aliganj',
      });
      expect(aliganjOnly.totalLeads).toBe(1);
      expect(aliganjOnly.unassignedLeads).toBe(1);
    });
  });

  describe('5. Empty Organisation & Division Safety', () => {
    it('handles empty database safely without division by zero errors', async () => {
      await db.leads.clear();
      await db.callRecords.clear();
      await db.users.clear();

      // Create only admin
      await crm.users.createUser({
        id: 'admin-empty',
        name: 'Admin Empty',
        email: 'empty@amaratvkrishi.com',
        phone: '9988776600',
        role: 'ADMIN',
      });
      const emptyAdmin = (await db.users.get('admin-empty'))!;

      const leadRep = await AdminReportsService.getLeadReport(emptyAdmin);
      expect(leadRep.totalLeads).toBe(0);
      expect(leadRep.conversionPercentage).toBe(0);

      const callRep = await AdminReportsService.getCallReport(emptyAdmin);
      expect(callRep.totalCalls).toBe(0);
      expect(callRep.averageVerifiedDurationSeconds).toBe(0);

      const fuRep = await AdminReportsService.getFollowUpReport(emptyAdmin);
      expect(fuRep.totalFollowUps).toBe(0);
      expect(fuRep.completionPercentage).toBe(0);
    });
  });
});
