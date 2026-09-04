/**
 * Admin Analytics Service (Phase 2L)
 * Provides comprehensive organization-wide aggregation methods for the Admin CRM Dashboard,
 * pipeline metrics, agent performance scorecards, and call analytics.
 * Strictly verifies ADMIN role authorization and enforces the zero-fabricated talk time invariant.
 */

import type { SalesCRMDatabase} from '../db/database';
import { getDatabase } from '../db/database';
import type { User, Lead, CallRecord, LeadStatus } from '../db/types';

export type DashboardDateRange =
  | 'TODAY'
  | 'YESTERDAY'
  | 'LAST_7_DAYS'
  | 'LAST_30_DAYS'
  | 'ALL_TIME'
  | 'CUSTOM';

export interface DateFilterRange {
  startDate: string | null; // ISO Date String
  endDate: string | null; // ISO Date String
}

export interface OrganisationKPIs {
  leads: {
    total: number;
    new: number;
    assigned: number;
    unassigned: number;
  };
  calls: {
    total: number;
    today: number;
    thisWeek: number;
    verified: number;
    unverified: number;
    verifiedTalkTimeSeconds: number;
    averageVerifiedDurationSeconds: number;
  };
  followUps: {
    overdue: number;
    today: number;
    upcoming: number;
    completed: number;
  };
  whatsapp: {
    initiated: number;
    failed: number;
  };
  imports: {
    totalBatches: number;
    totalLeadsImported: number;
  };
}

export interface PipelineStageMetric {
  status: LeadStatus;
  label: string;
  count: number;
  percentage: number;
}

export interface AgentPerformanceSummary {
  agentId: string;
  agentName: string;
  email: string;
  phone: string;
  status: string;
  lastLoginAt: string | null;
  leadsAssigned: number;
  leadsWorked: number;
  callsTotal: number;
  callsVerified: number;
  callsUnverified: number;
  verifiedTalkTimeSeconds: number;
  averageVerifiedDurationSeconds: number;
  followUpsTotal: number;
  followUpsCompleted: number;
  followUpsOverdue: number;
  whatsappInitiated: number;
  lastActivityAt: string | null;
}

export interface CallRecordFilterParams {
  agentId?: string;
  leadId?: string;
  verificationStatus?: 'ALL' | 'VERIFIED' | 'UNVERIFIED';
  outcome?: string;
  dateRange?: DashboardDateRange;
  customRange?: DateFilterRange;
  limit?: number;
}

export class AdminAnalyticsService {
  private static customDb: SalesCRMDatabase | null = null;

  static setCustomDatabase(db: SalesCRMDatabase | null): void {
    this.customDb = db;
  }

  private static getDb(): SalesCRMDatabase {
    return this.customDb || getDatabase();
  }

  /**
   * Computes date boundaries for filtering.
   */
  static getDateBoundaries(
    range: DashboardDateRange,
    custom?: DateFilterRange
  ): { start: Date | null; end: Date | null } {
    const now = new Date();

    if (range === 'ALL_TIME') {
      return { start: null, end: null };
    }

    if (range === 'CUSTOM' && custom) {
      return {
        start: custom.startDate ? new Date(custom.startDate) : null,
        end: custom.endDate ? new Date(custom.endDate) : null,
      };
    }

    if (range === 'TODAY') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { start, end };
    }

    if (range === 'YESTERDAY') {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
      const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
      return { start, end };
    }

    if (range === 'LAST_7_DAYS') {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start, end: now };
    }

    if (range === 'LAST_30_DAYS') {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { start, end: now };
    }

    return { start: null, end: null };
  }

  private static isWithinDate(dateStr: string | null | undefined, start: Date | null, end: Date | null): boolean {
    if (!dateStr) return false;
    if (!start && !end) return true;
    const t = new Date(dateStr).getTime();
    if (start && t < start.getTime()) return false;
    if (end && t > end.getTime()) return false;
    return true;
  }

  private static assertAdmin(actor: User | null): void {
    if (!actor || actor.role !== 'ADMIN' || actor.status !== 'ACTIVE') {
      throw new Error('Unauthorized: Only active administrators can access organization analytics.');
    }
    const scope = this.getDb().requireAccessScope();
    if (actor.id !== scope.userId || actor.organizationId !== scope.organizationId || scope.role !== 'ADMIN') {
      throw new Error('Unauthorized: Administrator does not match the active data partition.');
    }
  }

  /**
   * Computes organization-wide executive KPIs.
   */
  static async getOrganisationKPIs(
    actor: User | null,
    range: DashboardDateRange = 'ALL_TIME',
    agentIdFilter?: string,
    customRange?: DateFilterRange
  ): Promise<OrganisationKPIs> {
    this.assertAdmin(actor);

    const db = this.getDb();
    const { start, end } = this.getDateBoundaries(range, customRange);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch collections
    let allLeads = await db.leads.filter((l) => l.deletedAt === null).toArray();
    let allCalls = await db.callRecords.filter((c) => c.deletedAt === null).toArray();
    let allFollowUps = await db.followUps.filter((f) => f.deletedAt === null).toArray();
    let allMessages = await db.messageHistory.toArray();
    let allImports = await db.importAudits.toArray();

    // Filter by agent if specified
    if (agentIdFilter && agentIdFilter !== 'ALL') {
      allLeads = allLeads.filter((l) => l.assignedTo === agentIdFilter);
      allCalls = allCalls.filter((c) => c.userId === agentIdFilter);
      allFollowUps = allFollowUps.filter((f) => f.userId === agentIdFilter);
      allMessages = allMessages.filter((m) => m.userId === agentIdFilter);
      allImports = allImports.filter((i) => i.uploadedBy === agentIdFilter);
    }

    // Filter by date range for leads, calls, messages
    const filteredCalls = allCalls.filter((c) => this.isWithinDate(c.startedAt || c.createdAt, start, end));
    const filteredMessages = allMessages.filter((m) => this.isWithinDate(m.sentAt || m.createdAt, start, end));

    // Compute Leads KPI
    const totalLeads = allLeads.length;
    const newLeads = allLeads.filter((l) => l.status === 'NEW').length;
    const assignedLeads = allLeads.filter((l) => l.assignedTo !== null && l.assignedTo !== '').length;
    const unassignedLeads = allLeads.filter((l) => !l.assignedTo).length;

    // Compute Calls KPI
    let totalCalls = filteredCalls.length;
    let verifiedCalls = 0;
    let unverifiedCalls = 0;
    let totalVerifiedTalkTimeSeconds = 0;
    let callsToday = 0;
    let callsThisWeek = 0;

    for (const c of allCalls) {
      const callTime = new Date(c.startedAt || c.createdAt).getTime();
      if (callTime >= todayStart.getTime()) callsToday++;
      if (callTime >= weekStart.getTime()) callsThisWeek++;
    }

    for (const c of filteredCalls) {
      if (c.verificationStatus === 'VERIFIED') {
        verifiedCalls++;
        totalVerifiedTalkTimeSeconds += c.durationSeconds || 0;
      } else {
        unverifiedCalls++;
      }
    }

    const averageVerifiedDurationSeconds =
      verifiedCalls > 0 ? Math.round(totalVerifiedTalkTimeSeconds / verifiedCalls) : 0;

    // Compute Follow-ups KPI
    let overdueFollowUps = 0;
    let todayFollowUps = 0;
    let upcomingFollowUps = 0;
    let completedFollowUps = 0;

    for (const f of allFollowUps) {
      if (f.status === 'COMPLETED') {
        completedFollowUps++;
      } else if (f.status === 'PENDING') {
        const schTime = new Date(f.scheduledAt).getTime();
        if (schTime < todayStart.getTime()) {
          overdueFollowUps++;
        } else if (schTime >= todayStart.getTime() && schTime <= todayStart.getTime() + 86400000) {
          todayFollowUps++;
        } else {
          upcomingFollowUps++;
        }
      }
    }

    // Compute WhatsApp KPI
    const whatsappInitiated = filteredMessages.filter((m) => m.sentStatus === 'SENT' || m.sentStatus === 'INITIATED').length;
    const whatsappFailed = filteredMessages.filter((m) => m.sentStatus === 'FAILED').length;

    // Compute Imports KPI
    const totalBatches = allImports.length;
    const totalLeadsImported = allImports.reduce((acc, i) => acc + (i.imported || i.totalRows || 0), 0);

    return {
      leads: {
        total: totalLeads,
        new: newLeads,
        assigned: assignedLeads,
        unassigned: unassignedLeads,
      },
      calls: {
        total: totalCalls,
        today: callsToday,
        thisWeek: callsThisWeek,
        verified: verifiedCalls,
        unverified: unverifiedCalls,
        verifiedTalkTimeSeconds: totalVerifiedTalkTimeSeconds,
        averageVerifiedDurationSeconds,
      },
      followUps: {
        overdue: overdueFollowUps,
        today: todayFollowUps,
        upcoming: upcomingFollowUps,
        completed: completedFollowUps,
      },
      whatsapp: {
        initiated: whatsappInitiated,
        failed: whatsappFailed,
      },
      imports: {
        totalBatches,
        totalLeadsImported,
      },
    };
  }

  /**
   * Computes Lead Pipeline stage distribution with counts and percentages.
   */
  static async getLeadPipelineSummary(
    actor: User | null,
    range: DashboardDateRange = 'ALL_TIME',
    agentIdFilter?: string,
    customRange?: DateFilterRange
  ): Promise<PipelineStageMetric[]> {
    this.assertAdmin(actor);

    const db = this.getDb();
    const { start, end } = this.getDateBoundaries(range, customRange);

    let leads = await db.leads.filter((l) => l.deletedAt === null).toArray();

    if (agentIdFilter && agentIdFilter !== 'ALL') {
      leads = leads.filter((l) => l.assignedTo === agentIdFilter);
    }

    leads = leads.filter((l) => this.isWithinDate(l.createdAt, start, end));
    const total = leads.length;

    const stages: Array<{ status: LeadStatus; label: string }> = [
      { status: 'NEW', label: 'New Leads' },
      { status: 'CONTACTED', label: 'Contacted' },
      { status: 'INTERESTED', label: 'Interested' },
      { status: 'SAMPLE_REQUESTED', label: 'Sample Requested' },
      { status: 'FOLLOW_UP', label: 'Follow-up' },
      { status: 'NEGOTIATION', label: 'Negotiation' },
      { status: 'CUSTOMER', label: 'Converted Customer' },
      { status: 'NOT_INTERESTED', label: 'Not Interested' },
    ];

    return stages.map((stage) => {
      const count = leads.filter((l) => l.status === stage.status).length;
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
      return {
        status: stage.status,
        label: stage.label,
        count,
        percentage,
      };
    });
  }

  /**
   * Computes agent-by-agent performance breakdown list.
   */
  static async getAgentPerformanceList(
    actor: User | null,
    range: DashboardDateRange = 'ALL_TIME',
    customRange?: DateFilterRange
  ): Promise<AgentPerformanceSummary[]> {
    this.assertAdmin(actor);

    const db = this.getDb();
    const { start, end } = this.getDateBoundaries(range, customRange);
    const agents = await db.users.filter((u) => u.role === 'AGENT' && u.deletedAt === null).toArray();
    const allLeads = await db.leads.filter((l) => l.deletedAt === null).toArray();
    const allCalls = await db.callRecords.filter((c) => c.deletedAt === null).toArray();
    const allFollowUps = await db.followUps.filter((f) => f.deletedAt === null).toArray();
    const allMessages = await db.messageHistory.toArray();
    const allActivities = await db.activities.filter((a) => a.deletedAt === null).toArray();

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    return agents.map((agent) => {
      const agentLeads = allLeads.filter((l) => l.assignedTo === agent.id);
      const agentCalls = allCalls.filter(
        (c) => c.userId === agent.id && this.isWithinDate(c.startedAt || c.createdAt, start, end)
      );
      const agentFollowUps = allFollowUps.filter(
        (f) => f.userId === agent.id && this.isWithinDate(f.scheduledAt || f.createdAt, start, end)
      );
      const agentMessages = allMessages.filter(
        (m) => m.userId === agent.id && this.isWithinDate(m.sentAt || m.createdAt, start, end)
      );
      const agentActs = allActivities.filter((a) => a.userId === agent.id).reverse();

      const verifiedCalls = agentCalls.filter((c) => c.verificationStatus === 'VERIFIED');
      const unverifiedCalls = agentCalls.filter((c) => c.verificationStatus !== 'VERIFIED');
      const verifiedTalkTimeSeconds = verifiedCalls.reduce((acc, c) => acc + (c.durationSeconds || 0), 0);
      const averageVerifiedDurationSeconds =
        verifiedCalls.length > 0 ? Math.round(verifiedTalkTimeSeconds / verifiedCalls.length) : 0;

      const overdueFollowUps = agentFollowUps.filter(
        (f) => f.status === 'PENDING' && new Date(f.scheduledAt).getTime() < todayStart.getTime()
      ).length;
      const completedFollowUps = agentFollowUps.filter((f) => f.status === 'COMPLETED').length;

      // Leads worked = assigned leads that have at least 1 call, follow-up, or remark
      const workedLeadIds = new Set([
        ...agentCalls.map((c) => c.leadId),
        ...agentFollowUps.map((f) => f.leadId),
      ]);
      const leadsWorked = agentLeads.filter((l) => workedLeadIds.has(l.id)).length;

      return {
        agentId: agent.id,
        agentName: agent.name,
        email: agent.email,
        phone: agent.phone,
        status: agent.status,
        lastLoginAt: agent.lastLoginAt,
        leadsAssigned: agentLeads.length,
        leadsWorked,
        callsTotal: agentCalls.length,
        callsVerified: verifiedCalls.length,
        callsUnverified: unverifiedCalls.length,
        verifiedTalkTimeSeconds,
        averageVerifiedDurationSeconds,
        followUpsTotal: agentFollowUps.length,
        followUpsCompleted: completedFollowUps,
        followUpsOverdue: overdueFollowUps,
        whatsappInitiated: agentMessages.length,
        lastActivityAt: agentActs.length > 0 ? agentActs[0].createdAt : null,
      };
    });
  }

  /**
   * Retrieves detailed performance and activity for a specific agent.
   */
  static async getAgentPerformanceDetail(
    actor: User | null,
    agentId: string,
    range: DashboardDateRange = 'ALL_TIME',
    customRange?: DateFilterRange
  ): Promise<{ summary: AgentPerformanceSummary; recentActivities: any[]; assignedLeads: Lead[] }> {
    this.assertAdmin(actor);

    const list = await this.getAgentPerformanceList(actor, range, customRange);
    const summary = list.find((a) => a.agentId === agentId);
    if (!summary) {
      throw new Error(`Agent with ID "${agentId}" not found.`);
    }

    const db = this.getDb();
    const assignedLeads = await db.leads
      .where('assignedTo')
      .equals(agentId)
      .and((l) => l.deletedAt === null)
      .toArray();

    const recentActivities = await db.activities
      .where('userId')
      .equals(agentId)
      .and((a) => a.deletedAt === null)
      .reverse()
      .sortBy('createdAt');

    return {
      summary,
      recentActivities: recentActivities.slice(0, 50),
      assignedLeads,
    };
  }

  /**
   * Retrieves filtered CallRecord entries for Admin Call History view.
   */
  static async getAllCallRecords(
    actor: User | null,
    params: CallRecordFilterParams = {}
  ): Promise<Array<CallRecord & { leadName?: string; agentName?: string }>> {
    this.assertAdmin(actor);

    const db = this.getDb();
    const { start, end } = this.getDateBoundaries(params.dateRange || 'ALL_TIME', params.customRange);

    let calls = await db.callRecords.filter((c) => c.deletedAt === null).toArray();

    if (params.agentId && params.agentId !== 'ALL') {
      calls = calls.filter((c) => c.userId === params.agentId);
    }
    if (params.leadId) {
      calls = calls.filter((c) => c.leadId === params.leadId);
    }
    if (params.verificationStatus && params.verificationStatus !== 'ALL') {
      calls = calls.filter((c) => c.verificationStatus === params.verificationStatus);
    }
    if (params.outcome && params.outcome !== 'ALL') {
      calls = calls.filter((c) => c.outcome === params.outcome);
    }

    calls = calls.filter((c) => this.isWithinDate(c.startedAt || c.createdAt, start, end));

    // Sort descending by startedAt
    calls.sort((a, b) => new Date(b.startedAt || b.createdAt).getTime() - new Date(a.startedAt || a.createdAt).getTime());

    if (params.limit) {
      calls = calls.slice(0, params.limit);
    }

    // Populate lead and agent names
    const leadsMap = new Map((await db.leads.toArray()).map((l) => [l.id, l.businessName]));
    const usersMap = new Map((await db.users.toArray()).map((u) => [u.id, u.name]));

    return calls.map((c) => ({
      ...c,
      leadName: leadsMap.get(c.leadId) || 'Unknown Lead',
      agentName: usersMap.get(c.userId) || 'Sales Rep',
    }));
  }
}
