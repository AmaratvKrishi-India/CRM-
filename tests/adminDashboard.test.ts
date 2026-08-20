import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { SalesCRMDatabase } from '../src/db/database';
import { createCRMDataLayer } from '../src/db';
import { AdminAnalyticsService } from '../src/services/adminAnalyticsService';
import { User } from '../src/db/types';

describe('Phase 2L: Admin Dashboard Edge Cases & Date Filtering', () => {
  let db: SalesCRMDatabase;
  let crm: ReturnType<typeof createCRMDataLayer>;
  let admin: User;

  beforeEach(async () => {
    const testDbName = `test_admin_dash_${Math.random().toString(36).substring(7)}`;
    db = new SalesCRMDatabase(testDbName);
    crm = createCRMDataLayer(db);
    AdminAnalyticsService.setCustomDatabase(db);
    await db.seedDefaults();

    admin = await crm.users.createUser({
      id: 'admin-dash-1',
      name: 'Admin Vikram',
      email: 'admin@amaratvkrishi.com',
      phone: '9988776655',
      role: 'ADMIN',
      status: 'ACTIVE',
      organizationId: 'org-amaratv-1',
    });
  });

  afterEach(async () => {
    AdminAnalyticsService.setCustomDatabase(null);
    await db.delete();
  });

  it('handles completely empty organisation gracefully with 0 counts and no division by zero errors', async () => {
    const kpis = await AdminAnalyticsService.getOrganisationKPIs(admin);
    expect(kpis.leads.total).toBe(0);
    expect(kpis.leads.new).toBe(0);
    expect(kpis.calls.total).toBe(0);
    expect(kpis.calls.verifiedTalkTimeSeconds).toBe(0);
    expect(kpis.calls.averageVerifiedDurationSeconds).toBe(0);
    expect(kpis.followUps.today).toBe(0);

    const pipeline = await AdminAnalyticsService.getLeadPipelineSummary(admin);
    expect(pipeline.length).toBe(8);
    expect(pipeline[0].count).toBe(0);
    expect(pipeline[0].percentage).toBe(0);

    const agents = await AdminAnalyticsService.getAgentPerformanceList(admin);
    expect(agents.length).toBe(0);
  });

  it('computes correct date filter boundaries for TODAY, YESTERDAY, LAST_7_DAYS, LAST_30_DAYS', () => {
    const today = AdminAnalyticsService.getDateBoundaries('TODAY');
    expect(today.start).toBeDefined();
    expect(today.end).toBeDefined();
    expect(today.start!.getHours()).toBe(0);
    expect(today.end!.getHours()).toBe(23);

    const last7 = AdminAnalyticsService.getDateBoundaries('LAST_7_DAYS');
    expect(last7.start).toBeDefined();
    expect(last7.end).toBeDefined();
    const diffDays = Math.round((last7.end!.getTime() - last7.start!.getTime()) / (1000 * 3600 * 24));
    expect(diffDays).toBe(7);

    const allTime = AdminAnalyticsService.getDateBoundaries('ALL_TIME');
    expect(allTime.start).toBeNull();
    expect(allTime.end).toBeNull();
  });

  it('computes follow-up overdue and today status correctly based on timestamp boundaries', async () => {
    const lead = await crm.leads.createLead({
      businessName: 'Fit Plus Gym',
      phone: '9000000001',
      address: 'Lucknow',
    });

    const now = Date.now();
    // 1 Overdue follow-up (yesterday)
    await crm.followUps.createFollowUp({
      leadId: lead.id,
      userId: admin.id,
      scheduledAt: new Date(now - 86400000).toISOString(),
      title: 'Overdue Sample Demo',
    });

    // 1 Completed follow-up
    const completedFu = await crm.followUps.createFollowUp({
      leadId: lead.id,
      userId: admin.id,
      scheduledAt: new Date(now - 3600000).toISOString(),
      title: 'Completed Call',
    });
    await crm.followUps.completeFollowUp(completedFu.id);

    const kpis = await AdminAnalyticsService.getOrganisationKPIs(admin);
    expect(kpis.followUps.overdue).toBe(1);
    expect(kpis.followUps.completed).toBe(1);
  });
});
