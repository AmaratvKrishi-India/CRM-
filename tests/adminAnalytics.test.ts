import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { SalesCRMDatabase } from '../src/db/database';
import { createCRMDataLayer } from '../src/db';
import { AdminAnalyticsService } from '../src/services/adminAnalyticsService';
import { User, Lead, CallRecord } from '../src/db/types';

describe('Phase 2L: Admin Analytics Service & Aggregations', () => {
  let db: SalesCRMDatabase;
  let crm: ReturnType<typeof createCRMDataLayer>;
  let admin: User;
  let agentA: User;
  let agentB: User;
  let lead1: Lead;
  let lead2: Lead;

  beforeEach(async () => {
    const testDbName = `test_admin_analytics_${Math.random().toString(36).substring(7)}`;
    db = new SalesCRMDatabase(testDbName);
    crm = createCRMDataLayer(db);
    AdminAnalyticsService.setCustomDatabase(db);
    await db.seedDefaults();

    admin = await crm.users.createUser({
      id: 'admin-anal-1',
      name: 'Admin Vikram',
      email: 'admin@amaratvkrishi.com',
      phone: '9988776655',
      role: 'ADMIN',
      status: 'ACTIVE',
      organizationId: 'org-amaratv-1',
    });

    agentA = await crm.users.createUser({
      id: 'agent-anal-a',
      name: 'Agent Rahul',
      email: 'rahul@amaratvkrishi.com',
      phone: '9123456781',
      role: 'AGENT',
      status: 'ACTIVE',
      organizationId: 'org-amaratv-1',
      createdBy: admin.id,
    });

    agentB = await crm.users.createUser({
      id: 'agent-anal-b',
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
      status: 'INTERESTED',
      assignedTo: agentA.id,
    });

    lead2 = await crm.leads.createLead({
      businessName: 'Apollo Fitness Aliganj',
      phone: '9876543211',
      address: 'Aliganj, Lucknow',
      status: 'NEW',
      assignedTo: null, // Unassigned
    });
  });

  afterEach(async () => {
    AdminAnalyticsService.setCustomDatabase(null);
    await db.delete();
  });

  describe('1. Role Authorization Guard', () => {
    it('rejects access to organisation KPIs when caller is an AGENT', async () => {
      await expect(
        AdminAnalyticsService.getOrganisationKPIs(agentA)
      ).rejects.toThrow(/Unauthorized/i);
    });

    it('rejects access to agent performance list when caller is an AGENT', async () => {
      await expect(
        AdminAnalyticsService.getAgentPerformanceList(agentA)
      ).rejects.toThrow(/Unauthorized/i);
    });

    it('allows ADMIN to access organisation KPIs', async () => {
      const kpis = await AdminAnalyticsService.getOrganisationKPIs(admin);
      expect(kpis).toBeDefined();
      expect(kpis.leads.total).toBe(2);
      expect(kpis.leads.assigned).toBe(1);
      expect(kpis.leads.unassigned).toBe(1);
    });
  });

  describe('2. Pipeline Distribution & Aggregations', () => {
    it('computes accurate pipeline counts and percentages', async () => {
      const pipeline = await AdminAnalyticsService.getLeadPipelineSummary(admin);
      expect(pipeline.length).toBe(8);

      const newStage = pipeline.find((s) => s.status === 'NEW');
      const interestedStage = pipeline.find((s) => s.status === 'INTERESTED');

      expect(newStage?.count).toBe(1);
      expect(newStage?.percentage).toBe(50);

      expect(interestedStage?.count).toBe(1);
      expect(interestedStage?.percentage).toBe(50);
    });
  });

  describe('3. Call Talk-Time Invariant & Verified Duration Analytics', () => {
    it('calculates verified talk time and strictly excludes unverified calls from duration sum', async () => {
      // 2 verified calls: 180s and 120s -> total verified 300s, avg 150s
      await crm.callRecords.createCallRecord({
        leadId: lead1.id,
        userId: agentA.id,
        startedAt: new Date().toISOString(),
        durationSeconds: 180,
        outcome: 'CONNECTED',
        verificationStatus: 'VERIFIED',
      });

      await crm.callRecords.createCallRecord({
        leadId: lead1.id,
        userId: agentA.id,
        startedAt: new Date().toISOString(),
        durationSeconds: 120,
        outcome: 'CONNECTED',
        verificationStatus: 'VERIFIED',
      });

      // 1 unverified call: 0s talk time
      await crm.callRecords.createCallRecord({
        leadId: lead2.id,
        userId: agentB.id,
        startedAt: new Date().toISOString(),
        durationSeconds: 0,
        outcome: 'NO_ANSWER',
        verificationStatus: 'UNVERIFIED',
      });

      const kpis = await AdminAnalyticsService.getOrganisationKPIs(admin);
      expect(kpis.calls.total).toBe(3);
      expect(kpis.calls.verified).toBe(2);
      expect(kpis.calls.unverified).toBe(1);
      expect(kpis.calls.verifiedTalkTimeSeconds).toBe(300);
      expect(kpis.calls.averageVerifiedDurationSeconds).toBe(150);
    });
  });

  describe('4. Agent Performance Breakdown', () => {
    it('computes agent scorecard metrics with leads assigned, calls, and follow-ups', async () => {
      // Agent A calls lead1
      await crm.callRecords.createCallRecord({
        leadId: lead1.id,
        userId: agentA.id,
        startedAt: new Date().toISOString(),
        durationSeconds: 240,
        outcome: 'CONNECTED',
        verificationStatus: 'VERIFIED',
      });

      // Agent A schedules follow-up
      await crm.followUps.createFollowUp({
        leadId: lead1.id,
        userId: agentA.id,
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        title: 'Follow-up for protein demo',
      });

      const performance = await AdminAnalyticsService.getAgentPerformanceList(admin);
      expect(performance.length).toBe(2);

      const agentAPerf = performance.find((p) => p.agentId === agentA.id);
      expect(agentAPerf).toBeDefined();
      expect(agentAPerf?.leadsAssigned).toBe(1);
      expect(agentAPerf?.leadsWorked).toBe(1);
      expect(agentAPerf?.callsTotal).toBe(1);
      expect(agentAPerf?.callsVerified).toBe(1);
      expect(agentAPerf?.verifiedTalkTimeSeconds).toBe(240);
      expect(agentAPerf?.followUpsTotal).toBe(1);
    });
  });

  describe('5. Call History Filtering', () => {
    it('filters call records by agent, outcome, and verification status', async () => {
      await crm.callRecords.createCallRecord({
        leadId: lead1.id,
        userId: agentA.id,
        startedAt: '2026-08-20T10:00:00.000Z',
        durationSeconds: 120,
        outcome: 'CONNECTED',
        verificationStatus: 'VERIFIED',
      });

      await crm.callRecords.createCallRecord({
        leadId: lead2.id,
        userId: agentB.id,
        startedAt: '2026-08-20T11:00:00.000Z',
        durationSeconds: 0,
        outcome: 'BUSY',
        verificationStatus: 'UNVERIFIED',
      });

      const verifiedCalls = await AdminAnalyticsService.getAllCallRecords(admin, {
        verificationStatus: 'VERIFIED',
      });
      expect(verifiedCalls.length).toBe(1);
      expect(verifiedCalls[0].userId).toBe(agentA.id);
      expect(verifiedCalls[0].leadName).toBe('Gold Gym Mahanagar');

      const agentBCalls = await AdminAnalyticsService.getAllCallRecords(admin, {
        agentId: agentB.id,
      });
      expect(agentBCalls.length).toBe(1);
      expect(agentBCalls[0].outcome).toBe('BUSY');
    });
  });
});
