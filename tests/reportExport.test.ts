import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { SalesCRMDatabase } from '../src/db/database';
import { createCRMDataLayer } from '../src/db';
import { AdminReportsService } from '../src/services/adminReportsService';
import { User, Lead } from '../src/db/types';

describe('Phase 2M: Sanitized CSV Report Export', () => {
  let db: SalesCRMDatabase;
  let crm: ReturnType<typeof createCRMDataLayer>;
  let admin: User;
  let agent: User;
  let lead: Lead;

  beforeEach(async () => {
    const testDbName = `test_report_export_${Math.random().toString(36).substring(7)}`;
    db = new SalesCRMDatabase(testDbName);
    crm = createCRMDataLayer(db);
    AdminReportsService.setCustomDatabase(db);
    await db.seedDefaults();

    admin = await crm.users.createUser({
      id: 'admin-exp-1',
      name: 'Admin Vikram',
      email: 'admin@amaratvkrishi.com',
      phone: '9988776655',
      role: 'ADMIN',
      status: 'ACTIVE',
      organizationId: 'org-amaratv-1',
    });

    agent = await crm.users.createUser({
      id: 'agent-exp-1',
      name: 'Agent Rahul',
      email: 'rahul@amaratvkrishi.com',
      phone: '9123456781',
      role: 'AGENT',
      status: 'ACTIVE',
      organizationId: 'org-amaratv-1',
      createdBy: admin.id,
    });

    lead = await crm.leads.createLead({
      businessName: 'Gold Gym Mahanagar',
      phone: '9876543210',
      address: 'Mahanagar, Lucknow',
      locality: 'Mahanagar',
      status: 'INTERESTED',
      assignedTo: agent.id,
      createdBy: agent.id,
    });
  });

  afterEach(async () => {
    AdminReportsService.setCustomDatabase(null);
    await db.delete();
  });

  it('generates sanitized CSV export for LEADS with proper header columns', async () => {
    const csv = await AdminReportsService.exportReportToCSV(admin, 'LEADS');
    expect(csv).toBeDefined();

    const lines = csv.split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines[0]).toBe('Lead ID,Gym/Business Name,Category,Phone,Locality,Status,Assigned Rep,Created At');
    expect(lines[1]).toContain('Gold Gym Mahanagar');
    expect(lines[1]).toContain('Mahanagar');
    expect(lines[1]).toContain('Agent Rahul');
  });

  it('generates sanitized CSV export for CALLS excluding fake unverified durations', async () => {
    await crm.callRecords.createCallRecord({
      leadId: lead.id,
      userId: agent.id,
      startedAt: '2026-08-20T10:00:00.000Z',
      durationSeconds: 240,
      outcome: 'CONNECTED',
      verificationStatus: 'VERIFIED',
      remark: 'Great conversation with gym owner',
    });

    const csv = await AdminReportsService.exportReportToCSV(admin, 'CALLS');
    expect(csv).toBeDefined();

    const lines = csv.split('\n');
    expect(lines[0]).toBe('Call ID,Lead Name,Agent Name,Started At,Duration Seconds,Outcome,Verification Status,Remark');
    expect(lines[1]).toContain('Gold Gym Mahanagar');
    expect(lines[1]).toContain('Agent Rahul');
    expect(lines[1]).toContain('240');
    expect(lines[1]).toContain('VERIFIED');
  });

  it('generates sanitized CSV export for AGENTS performance scorecard', async () => {
    const csv = await AdminReportsService.exportReportToCSV(admin, 'AGENTS');
    expect(csv).toBeDefined();

    const lines = csv.split('\n');
    expect(lines[0]).toBe('Agent Name,Email,Phone,Status,Leads Assigned,Calls Made,Verified Calls,Verified Talk Time (s),Follow-ups Completed,Conversion Rate %,Last Login');
    expect(lines[1]).toContain('Agent Rahul');
    expect(lines[1]).toContain('rahul@amaratvkrishi.com');
  });

  it('strictly excludes passwords, auth tokens, and service keys from CSV output', async () => {
    const csvLeads = await AdminReportsService.exportReportToCSV(admin, 'LEADS');
    const csvAgents = await AdminReportsService.exportReportToCSV(admin, 'AGENTS');

    expect(csvLeads).not.toContain('password');
    expect(csvLeads).not.toContain('service_role');
    expect(csvLeads).not.toContain('token');

    expect(csvAgents).not.toContain('password');
    expect(csvAgents).not.toContain('service_role');
    expect(csvAgents).not.toContain('secret');
  });
});
