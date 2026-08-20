import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { SalesCRMDatabase } from '../src/db/database';
import { createCRMDataLayer } from '../src/db';
import { Lead } from '../src/db/types';

describe('Milestone 4: Follow-ups, Reminders & Sales Dashboard Workflow', () => {
  let db: SalesCRMDatabase;
  let crm: ReturnType<typeof createCRMDataLayer>;

  beforeEach(async () => {
    const testDbName = `test_followup_${Math.random().toString(36).substring(7)}`;
    db = new SalesCRMDatabase(testDbName);
    crm = createCRMDataLayer(db);
    await db.seedDefaults();
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('1. Follow-up Creation & Lead Sync', () => {
    it('creates a follow-up and syncs nextFollowUpAt on the Lead entity', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Gomti Fitness Hub',
        phone: '+91 98765 43210',
        address: 'Gomti Nagar, Lucknow',
      });

      expect(lead.nextFollowUpAt).toBeNull();

      const scheduledDate = new Date(Date.now() + 86400000).toISOString(); // Tomorrow
      const followUp = await crm.followUps.scheduleFollowUp({
        leadId: lead.id,
        scheduledAt: scheduledDate,
        title: 'Deliver 1kg sample & meet owner',
        notes: 'Owner is available after 5 PM',
        priority: 'HIGH',
      });

      expect(followUp.id).toBeDefined();
      expect(followUp.status).toBe('PENDING');
      expect(followUp.priority).toBe('HIGH');

      const updatedLead = (await crm.leads.getLeadById(lead.id))!;
      expect(updatedLead.nextFollowUpAt).toBe(scheduledDate);
    });
  });

  describe('2. Follow-up Completion, Cancellation & Rescheduling', () => {
    it('marks follow-up as COMPLETED and clears/recalculates nextFollowUpAt', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Hazratganj Health Zone',
        phone: '+91 98765 11111',
        address: 'Hazratganj, Lucknow',
      });

      const fu = await crm.followUps.scheduleFollowUp({
        leadId: lead.id,
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        title: 'Follow up on wholesale price',
      });

      const completed = await crm.followUps.completeFollowUp(fu.id);
      expect(completed.status).toBe('COMPLETED');
      expect(completed.completedAt).toBeDefined();

      const refreshedLead = (await crm.leads.getLeadById(lead.id))!;
      expect(refreshedLead.nextFollowUpAt).toBeNull();
    });

    it('cancels follow-up and clears nextFollowUpAt', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Mahanagar Gym Club',
        phone: '+91 98765 22222',
        address: 'Mahanagar, Lucknow',
      });

      const fu = await crm.followUps.scheduleFollowUp({
        leadId: lead.id,
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        title: 'Trial pitch call',
      });

      const cancelled = await crm.followUps.cancelFollowUp(fu.id);
      expect(cancelled.status).toBe('CANCELLED');

      const refreshedLead = (await crm.leads.getLeadById(lead.id))!;
      expect(refreshedLead.nextFollowUpAt).toBeNull();
    });

    it('reschedules follow-up to a new timestamp', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Indira Nagar Iron Gym',
        phone: '+91 98765 33333',
        address: 'Indira Nagar, Lucknow',
      });

      const initialDate = new Date(Date.now() + 86400000).toISOString();
      const fu = await crm.followUps.scheduleFollowUp({
        leadId: lead.id,
        scheduledAt: initialDate,
        title: 'Initial call',
        priority: 'MEDIUM',
      });

      const newDate = new Date(Date.now() + 172800000).toISOString(); // In 2 days
      const rescheduled = await crm.followUps.rescheduleFollowUp({
        id: fu.id,
        newScheduledAt: newDate,
        newTitle: 'Rescheduled: Meeting with head trainer',
        newPriority: 'URGENT',
      });

      expect(rescheduled.scheduledAt).toBe(newDate);
      expect(rescheduled.title).toContain('Rescheduled: Meeting');
      expect(rescheduled.priority).toBe('URGENT');

      const refreshedLead = (await crm.leads.getLeadById(lead.id))!;
      expect(refreshedLead.nextFollowUpAt).toBe(newDate);
    });
  });

  describe('3. Grouped Categorization (Overdue, Today, Upcoming)', () => {
    it('categorizes follow-ups correctly into overdue, today, and upcoming', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Alambagh Power Gym',
        phone: '+91 98765 44444',
        address: 'Alambagh, Lucknow',
      });

      const pastDate = new Date(Date.now() - 86400000 * 2).toISOString(); // 2 days ago
      const now = new Date();
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0, 0).toISOString(); // Today 2 PM
      const futureDate = new Date(Date.now() + 86400000 * 5).toISOString(); // In 5 days

      await crm.followUps.scheduleFollowUp({
        leadId: lead.id,
        scheduledAt: pastDate,
        title: 'Overdue follow-up',
      });

      await crm.followUps.scheduleFollowUp({
        leadId: lead.id,
        scheduledAt: todayDate,
        title: 'Today follow-up',
      });

      await crm.followUps.scheduleFollowUp({
        leadId: lead.id,
        scheduledAt: futureDate,
        title: 'Upcoming follow-up',
      });

      const grouped = await crm.followUps.getGroupedPendingFollowUps();
      expect(grouped.overdue.length).toBe(1);
      expect(grouped.overdue[0].title).toBe('Overdue follow-up');
      expect(grouped.today.length).toBe(1);
      expect(grouped.today[0].title).toBe('Today follow-up');
      expect(grouped.upcoming.length).toBe(1);
      expect(grouped.upcoming[0].title).toBe('Upcoming follow-up');
    });
  });

  describe('4. Sales Dashboard KPI & Pipeline Computation', () => {
    it('computes real-time dashboard metrics, pipeline counts, and recent activity', async () => {
      // 1. Seed Leads in different pipeline stages
      const lead1 = await crm.leads.createLead({
        businessName: 'Gym Alpha',
        phone: '+91 91111 00001',
        address: 'Gomti Nagar, Lucknow',
      });

      const lead2 = await crm.leads.createLead({
        businessName: 'Gym Beta',
        phone: '+91 91111 00002',
        address: 'Hazratganj, Lucknow',
      });

      // Transition lead2 to INTERESTED via call outcome
      await crm.callHistory.logCall({
        leadId: lead2.id,
        calledNumber: lead2.phoneE164,
        outcome: 'CONNECTED',
        notes: 'Owner interested in pricing',
        updateLeadStatus: 'INTERESTED',
      });

      // Schedule follow-up for today on lead2
      const now = new Date();
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 0, 0).toISOString();
      await crm.followUps.scheduleFollowUp({
        leadId: lead2.id,
        scheduledAt: todayDate,
        title: 'Share bulk pricing catalogue',
      });

      // Fetch dashboard data
      const dashboard = await crm.dashboard.getDashboardData();

      expect(dashboard.metrics.totalLeads).toBe(2);
      expect(dashboard.metrics.notContacted).toBe(1); // lead1 is NEW
      expect(dashboard.metrics.interested).toBe(1); // lead2 is INTERESTED
      expect(dashboard.metrics.callsToday).toBe(1);
      expect(dashboard.metrics.followUpsToday).toBe(1);

      // Verify pipeline counts
      const newStage = dashboard.pipeline.find((p) => p.status === 'NEW');
      const interestedStage = dashboard.pipeline.find((p) => p.status === 'INTERESTED');
      expect(newStage?.count).toBe(1);
      expect(interestedStage?.count).toBe(1);

      // Verify locality breakdown
      expect(dashboard.localities.length).toBeGreaterThanOrEqual(2);

      // Verify recent activity stream
      expect(dashboard.recentActivities.length).toBeGreaterThanOrEqual(1);
      expect(dashboard.recentActivities[0].businessName).toBe('Gym Beta');
    });
  });
});
