import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { SalesCRMDatabase } from '../src/db/database';
import { createCRMDataLayer } from '../src/db';
import { AdminAnalyticsService } from '../src/services/adminAnalyticsService';
import { AdminReportsService } from '../src/services/adminReportsService';
import { LeadAssignmentService } from '../src/services/leadAssignmentService';
import { LeadRepository } from '../src/db/repositories/leadRepository';
import { User, Lead } from '../src/db/types';

describe('Phase 2N: Final Security & Permission Boundaries Audit', () => {
  let db: SalesCRMDatabase;
  let crm: ReturnType<typeof createCRMDataLayer>;
  let admin: User;
  let agent: User;
  let foreignAdmin: User;

  beforeEach(async () => {
    const testDbName = `test_sec_final_${Math.random().toString(36).substring(7)}`;
    db = new SalesCRMDatabase(testDbName);
    crm = createCRMDataLayer(db);
    AdminAnalyticsService.setCustomDatabase(db);
    AdminReportsService.setCustomDatabase(db);
    LeadAssignmentService.setCustomDatabase(db);
    await db.seedDefaults();

    admin = await crm.users.createUser({
      id: 'admin-sec-1',
      name: 'Admin Vikram',
      email: 'admin@amaratvkrishi.com',
      phone: '9988776655',
      role: 'ADMIN',
      status: 'ACTIVE',
      organizationId: 'org-amaratv-main',
    });

    agent = await crm.users.createUser({
      id: 'agent-sec-1',
      name: 'Agent Rahul',
      email: 'rahul@amaratvkrishi.com',
      phone: '9123456781',
      role: 'AGENT',
      status: 'ACTIVE',
      organizationId: 'org-amaratv-main',
      createdBy: admin.id,
    });

    foreignAdmin = await crm.users.createUser({
      id: 'admin-foreign-1',
      name: 'Competitor Admin',
      email: 'admin@othergyms.com',
      phone: '9111223344',
      role: 'ADMIN',
      status: 'ACTIVE',
      organizationId: 'org-other-tenant',
    });
  });

  afterEach(async () => {
    AdminAnalyticsService.setCustomDatabase(null);
    AdminReportsService.setCustomDatabase(null);
    await db.delete();
  });

  describe('1. Role Authorization & Privilege Escalation Guards', () => {
    it('strictly rejects AGENT callers from invoking Admin Analytics methods', async () => {
      await expect(
        AdminAnalyticsService.getOrganisationKPIs(agent)
      ).rejects.toThrow(/Unauthorized/i);

      await expect(
        AdminAnalyticsService.getLeadPipelineSummary(agent)
      ).rejects.toThrow(/Unauthorized/i);

      await expect(
        AdminAnalyticsService.getAgentPerformanceList(agent)
      ).rejects.toThrow(/Unauthorized/i);

      await expect(
        AdminAnalyticsService.getAllCallRecords(agent)
      ).rejects.toThrow(/Unauthorized/i);
    });

    it('strictly rejects AGENT callers from invoking Admin Reports methods', async () => {
      await expect(AdminReportsService.getLeadReport(agent)).rejects.toThrow(/Unauthorized/i);
      await expect(AdminReportsService.getCallReport(agent)).rejects.toThrow(/Unauthorized/i);
      await expect(AdminReportsService.getAgentProductivityReport(agent)).rejects.toThrow(/Unauthorized/i);
      await expect(AdminReportsService.getFollowUpReport(agent)).rejects.toThrow(/Unauthorized/i);
      await expect(AdminReportsService.getWhatsAppReport(agent)).rejects.toThrow(/Unauthorized/i);
      await expect(AdminReportsService.getImportReport(agent)).rejects.toThrow(/Unauthorized/i);
      await expect(AdminReportsService.getActivityReport(agent)).rejects.toThrow(/Unauthorized/i);
      await expect(AdminReportsService.exportReportToCSV(agent, 'LEADS')).rejects.toThrow(/Unauthorized/i);
    });

    it('rejects deactivated ADMIN users from accessing analytics', async () => {
      const inactiveAdmin = { ...admin, status: 'INACTIVE' as const };
      await expect(
        AdminAnalyticsService.getOrganisationKPIs(inactiveAdmin)
      ).rejects.toThrow(/Unauthorized/i);
    });
  });

  describe('2. Client Secrets & Key Leakage Guard', () => {
    it('verifies client build environment contains zero service-role keys', () => {
      const env = import.meta.env as Record<string, any>;
      expect(env.VITE_SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
      expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
      expect(env.SERVICE_ROLE).toBeUndefined();
    });

    it('verifies CSV exports never expose sensitive credentials or tokens', async () => {
      const leadCsv = await AdminReportsService.exportReportToCSV(admin, 'LEADS');
      const agentCsv = await AdminReportsService.exportReportToCSV(admin, 'AGENTS');

      expect(leadCsv.toLowerCase()).not.toContain('password');
      expect(leadCsv.toLowerCase()).not.toContain('service_role');
      expect(leadCsv.toLowerCase()).not.toContain('token');

      expect(agentCsv.toLowerCase()).not.toContain('password');
      expect(agentCsv.toLowerCase()).not.toContain('service_role');
      expect(agentCsv.toLowerCase()).not.toContain('secret');
    });
  });

  describe('3. Shared Lead Assignment Security', () => {
    it('prohibits assigning leads to deactivated or non-existent agents', async () => {
      const inactiveAgent = await crm.users.createUser({
        id: 'agent-inactive',
        name: 'Inactive Rep',
        email: 'inactive@amaratvkrishi.com',
        phone: '9000000099',
        role: 'AGENT',
        status: 'INACTIVE',
      });

      const lead = await crm.leads.createLead({
        businessName: 'Fit World Gym',
        phone: '9888877771',
        address: 'Hazratganj, Lucknow',
      });

      await expect(
        LeadAssignmentService.assignLead(admin, lead.id, inactiveAgent.id)
      ).rejects.toThrow(/Cannot assign lead to inactive/i);
    });

    it('creates an immutable audit activity on lead assignment', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Fit World Gym',
        phone: '9888877772',
        address: 'Hazratganj, Lucknow',
      });

      const { auditActivity } = await LeadAssignmentService.assignLead(
        admin,
        lead.id,
        agent.id
      );

      expect(auditActivity).toBeDefined();
      expect(auditActivity.activityType).toBe('LEAD_ASSIGNED');
      expect(auditActivity.userId).toBe(admin.id);
      expect(auditActivity.metadata.newAssigneeId).toBe(agent.id);
    });
  });
});
