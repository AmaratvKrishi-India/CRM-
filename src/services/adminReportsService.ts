/**
 * Admin Reports Service (Phase 2M)
 * Comprehensive analytics and reporting engine for administrators.
 * Generates Lead, Call, Agent Productivity, Follow-up, WhatsApp, Import, and Activity reports.
 * Enforces strict ADMIN-only role authorization and zero-fake duration rules.
 */

import type { SalesCRMDatabase} from '../db/database';
import { getDatabase } from '../db/database';
import type { User, LeadStatus } from '../db/types';

const CSV_FORMULA_PREFIX = /^[\s]*[=+\-@]/;

/**
 * Serializes a value as a spreadsheet-safe CSV cell.
 *
 * Spreadsheet applications may evaluate cells beginning with formula
 * operators even when the value is quoted. Prefixing those values with a
 * single quote keeps the exported value as text while preserving the
 * original content for ordinary CSV consumers.
 */
export function sanitizeCsvCell(value: unknown): string {
  const stringValue = String(value ?? '');
  const safeValue = CSV_FORMULA_PREFIX.test(stringValue) ? `'${stringValue}` : stringValue;
  return `"${safeValue.replace(/"/g, '""')}"`;
}

export type ReportDatePreset =
  | 'TODAY'
  | 'YESTERDAY'
  | 'LAST_7_DAYS'
  | 'LAST_30_DAYS'
  | 'THIS_MONTH'
  | 'PREV_MONTH'
  | 'ALL_TIME'
  | 'CUSTOM';

export interface ReportFilterOptions {
  datePreset?: ReportDatePreset;
  startDate?: string | null;
  endDate?: string | null;
  agentId?: string; // 'ALL' | 'UNASSIGNED' | specific user ID
  locality?: string; // 'ALL' | specific locality
  leadStatus?: LeadStatus | 'ALL';
}

export interface LeadReportData {
  totalLeads: number;
  statusBreakdown: Record<LeadStatus, number>;
  unassignedLeads: number;
  assignedLeads: number;
  leadsCreatedByAgent: Array<{ agentId: string; agentName: string; count: number }>;
  leadsAssignedToAgent: Array<{ agentId: string; agentName: string; count: number }>;
  convertedCustomers: number;
  conversionPercentage: number;
}

export interface CallReportData {
  totalCalls: number;
  callsByAgent: Array<{ agentId: string; agentName: string; total: number; verified: number; unverified: number }>;
  callsByDay: Array<{ date: string; count: number; verifiedCount: number }>;
  callsByOutcome: Record<string, number>;
  verifiedCalls: number;
  unverifiedCalls: number;
  verifiedTalkTimeSeconds: number;
  averageVerifiedDurationSeconds: number;
  longestVerifiedDurationSeconds: number;
  talkTimeByAgent: Array<{ agentId: string; agentName: string; verifiedTalkTimeSeconds: number; avgVerifiedDurationSeconds: number }>;
}

export interface AgentProductivityItem {
  agentId: string;
  agentName: string;
  email: string;
  phone: string;
  status: string;
  lastLoginAt: string | null;
  lastActivityAt: string | null;
  leadsCreated: number;
  leadsAssigned: number;
  callsMade: number;
  verifiedCalls: number;
  unverifiedCalls: number;
  verifiedTalkTimeSeconds: number;
  averageVerifiedDurationSeconds: number;
  followUpsCreated: number;
  followUpsCompleted: number;
  whatsAppInitiated: number;
  samplesRequested: number;
  customersConverted: number;
  conversionRatePercentage: number;
}

export interface FollowUpReportData {
  totalFollowUps: number;
  today: number;
  upcoming: number;
  overdue: number;
  completed: number;
  cancelled: number;
  completionPercentage: number;
  overduePercentage: number;
  followUpsByAgent: Array<{ agentId: string; agentName: string; total: number; completed: number; overdue: number }>;
}

export interface WhatsAppReportData {
  totalInitiated: number;
  totalFailed: number;
  byAgent: Array<{ agentId: string; agentName: string; count: number }>;
  byDate: Array<{ date: string; count: number }>;
  templateUsage: Array<{ templateId: string; name: string; count: number }>;
  mostUsedTemplateName: string | null;
  landlinePreventedCount: number;
}

export interface ImportReportData {
  totalImports: number;
  totalLeadsImported: number;
  totalDuplicatesSkipped: number;
  totalInvalidRows: number;
  importsList: Array<{
    id: string;
    filename: string;
    uploadedByName: string;
    startedAt: string;
    completedAt: string | null;
    totalRows: number;
    imported: number;
    duplicates: number;
    invalid: number;
  }>;
}

export interface ActivityReportItem {
  id: string;
  activityType: string;
  actorName: string;
  leadName?: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export class AdminReportsService {
  private static customDb: SalesCRMDatabase | null = null;

  static setCustomDatabase(db: SalesCRMDatabase | null): void {
    this.customDb = db;
  }

  private static getDb(): SalesCRMDatabase {
    return this.customDb || getDatabase();
  }

  private static assertAdmin(actor: User | null): void {
    if (!actor || actor.role !== 'ADMIN' || actor.status !== 'ACTIVE') {
      throw new Error('Unauthorized: Only active administrators can access Analytics & Reports.');
    }
    const scope = this.getDb().requireAccessScope();
    if (actor.id !== scope.userId || actor.organizationId !== scope.organizationId || scope.role !== 'ADMIN') {
      throw new Error('Unauthorized: Administrator does not match the active data partition.');
    }
  }

  /**
   * Calculates Date range boundaries from preset.
   */
  static getDateBoundaries(
    preset: ReportDatePreset = 'ALL_TIME',
    startStr?: string | null,
    endStr?: string | null
  ): { start: Date | null; end: Date | null } {
    const now = new Date();

    if (preset === 'ALL_TIME') return { start: null, end: null };

    if (preset === 'CUSTOM') {
      return {
        start: startStr ? new Date(startStr) : null,
        end: endStr ? new Date(endStr) : null,
      };
    }

    if (preset === 'TODAY') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { start, end };
    }

    if (preset === 'YESTERDAY') {
      const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0);
      const end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
      return { start, end };
    }

    if (preset === 'LAST_7_DAYS') {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start, end: now };
    }

    if (preset === 'LAST_30_DAYS') {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { start, end: now };
    }

    if (preset === 'THIS_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { start, end: now };
    }

    if (preset === 'PREV_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start, end };
    }

    return { start: null, end: null };
  }

  private static isWithin(dateStr: string | null | undefined, start: Date | null, end: Date | null): boolean {
    if (!dateStr) return false;
    if (!start && !end) return true;
    const t = new Date(dateStr).getTime();
    if (start && t < start.getTime()) return false;
    if (end && t > end.getTime()) return false;
    return true;
  }

  /**
   * Generates Lead Report.
   */
  static async getLeadReport(actor: User | null, filters: ReportFilterOptions = {}): Promise<LeadReportData> {
    this.assertAdmin(actor);
    const db = this.getDb();
    const { start, end } = this.getDateBoundaries(filters.datePreset, filters.startDate, filters.endDate);

    let leads = await db.leads.filter((l) => l.deletedAt === null).toArray();
    const users = await db.users.toArray();
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    // Apply Locality Filter
    if (filters.locality && filters.locality !== 'ALL') {
      leads = leads.filter((l) => (l.locality || '').toLowerCase() === filters.locality!.toLowerCase());
    }

    // Apply Agent Filter
    if (filters.agentId && filters.agentId !== 'ALL') {
      if (filters.agentId === 'UNASSIGNED') {
        leads = leads.filter((l) => !l.assignedTo);
      } else {
        leads = leads.filter((l) => l.assignedTo === filters.agentId);
      }
    }

    // Apply Lead Status Filter
    if (filters.leadStatus && filters.leadStatus !== 'ALL') {
      leads = leads.filter((l) => l.status === filters.leadStatus);
    }

    // Apply Date Range
    leads = leads.filter((l) => this.isWithin(l.createdAt, start, end));

    const totalLeads = leads.length;
    const statusBreakdown: Record<LeadStatus, number> = {
      NEW: 0,
      CONTACTED: 0,
      INTERESTED: 0,
      SAMPLE_REQUESTED: 0,
      FOLLOW_UP: 0,
      NEGOTIATION: 0,
      CUSTOMER: 0,
      NOT_INTERESTED: 0,
      WRONG_NUMBER: 0,
      DO_NOT_CONTACT: 0,
    };

    let unassignedLeads = 0;
    let assignedLeads = 0;
    const createdMap = new Map<string, number>();
    const assignedMap = new Map<string, number>();

    for (const lead of leads) {
      if (statusBreakdown[lead.status] !== undefined) {
        statusBreakdown[lead.status]++;
      }

      if (lead.assignedTo) {
        assignedLeads++;
        assignedMap.set(lead.assignedTo, (assignedMap.get(lead.assignedTo) || 0) + 1);
      } else {
        unassignedLeads++;
      }

      if (lead.createdBy) {
        createdMap.set(lead.createdBy, (createdMap.get(lead.createdBy) || 0) + 1);
      }
    }

    const leadsCreatedByAgent = Array.from(createdMap.entries()).map(([agentId, count]) => ({
      agentId,
      agentName: userMap.get(agentId) || 'Unknown Rep',
      count,
    }));

    const leadsAssignedToAgent = Array.from(assignedMap.entries()).map(([agentId, count]) => ({
      agentId,
      agentName: userMap.get(agentId) || 'Unknown Rep',
      count,
    }));

    const convertedCustomers = statusBreakdown.CUSTOMER;
    const conversionPercentage = totalLeads > 0 ? Math.round((convertedCustomers / totalLeads) * 100) : 0;

    return {
      totalLeads,
      statusBreakdown,
      unassignedLeads,
      assignedLeads,
      leadsCreatedByAgent,
      leadsAssignedToAgent,
      convertedCustomers,
      conversionPercentage,
    };
  }

  /**
   * Generates Call Report (Zero Fake Talk Time Invariant).
   */
  static async getCallReport(actor: User | null, filters: ReportFilterOptions = {}): Promise<CallReportData> {
    this.assertAdmin(actor);
    const db = this.getDb();
    const { start, end } = this.getDateBoundaries(filters.datePreset, filters.startDate, filters.endDate);

    let calls = await db.callRecords.filter((c) => c.deletedAt === null).toArray();
    const users = await db.users.toArray();
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    if (filters.agentId && filters.agentId !== 'ALL') {
      calls = calls.filter((c) => c.userId === filters.agentId);
    }

    calls = calls.filter((c) => this.isWithin(c.startedAt || c.createdAt, start, end));

    let totalCalls = calls.length;
    let verifiedCalls = 0;
    let unverifiedCalls = 0;
    let verifiedTalkTimeSeconds = 0;
    let longestVerifiedDurationSeconds = 0;

    const outcomeMap: Record<string, number> = {};
    const agentStatsMap = new Map<string, { total: number; verified: number; unverified: number; talkTime: number }>();
    const dayStatsMap = new Map<string, { count: number; verifiedCount: number }>();

    for (const c of calls) {
      outcomeMap[c.outcome] = (outcomeMap[c.outcome] || 0) + 1;

      const agentStat = agentStatsMap.get(c.userId) || { total: 0, verified: 0, unverified: 0, talkTime: 0 };
      agentStat.total++;

      const dateKey = (c.startedAt || c.createdAt).substring(0, 10);
      const dayStat = dayStatsMap.get(dateKey) || { count: 0, verifiedCount: 0 };
      dayStat.count++;

      if (c.verificationStatus === 'VERIFIED') {
        verifiedCalls++;
        agentStat.verified++;
        dayStat.verifiedCount++;
        const dur = c.durationSeconds || 0;
        verifiedTalkTimeSeconds += dur;
        agentStat.talkTime += dur;
        if (dur > longestVerifiedDurationSeconds) {
          longestVerifiedDurationSeconds = dur;
        }
      } else {
        unverifiedCalls++;
        agentStat.unverified++;
      }

      agentStatsMap.set(c.userId, agentStat);
      dayStatsMap.set(dateKey, dayStat);
    }

    const averageVerifiedDurationSeconds =
      verifiedCalls > 0 ? Math.round(verifiedTalkTimeSeconds / verifiedCalls) : 0;

    const callsByAgent = Array.from(agentStatsMap.entries()).map(([agentId, stat]) => ({
      agentId,
      agentName: userMap.get(agentId) || 'Sales Rep',
      total: stat.total,
      verified: stat.verified,
      unverified: stat.unverified,
    }));

    const talkTimeByAgent = Array.from(agentStatsMap.entries()).map(([agentId, stat]) => ({
      agentId,
      agentName: userMap.get(agentId) || 'Sales Rep',
      verifiedTalkTimeSeconds: stat.talkTime,
      avgVerifiedDurationSeconds: stat.verified > 0 ? Math.round(stat.talkTime / stat.verified) : 0,
    }));

    const callsByDay = Array.from(dayStatsMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, stat]) => ({
        date,
        count: stat.count,
        verifiedCount: stat.verifiedCount,
      }));

    return {
      totalCalls,
      callsByAgent,
      callsByDay,
      callsByOutcome: outcomeMap,
      verifiedCalls,
      unverifiedCalls,
      verifiedTalkTimeSeconds,
      averageVerifiedDurationSeconds,
      longestVerifiedDurationSeconds,
      talkTimeByAgent,
    };
  }

  /**
   * Generates Agent Productivity Report.
   */
  static async getAgentProductivityReport(
    actor: User | null,
    filters: ReportFilterOptions = {}
  ): Promise<AgentProductivityItem[]> {
    this.assertAdmin(actor);
    const db = this.getDb();
    const { start, end } = this.getDateBoundaries(filters.datePreset, filters.startDate, filters.endDate);

    let agents = await db.users.filter((u) => u.role === 'AGENT' && u.deletedAt === null).toArray();
    if (filters.agentId && filters.agentId !== 'ALL' && filters.agentId !== 'UNASSIGNED') {
      agents = agents.filter((u) => u.id === filters.agentId);
    }

    const allLeads = await db.leads.filter((l) => l.deletedAt === null).toArray();
    const allCalls = await db.callRecords.filter((c) => c.deletedAt === null).toArray();
    const allFollowUps = await db.followUps.filter((f) => f.deletedAt === null).toArray();
    const allMessages = await db.messageHistory.toArray();
    const allActivities = await db.activities.filter((a) => a.deletedAt === null).toArray();

    return agents.map((agent) => {
      const createdLeads = allLeads.filter(
        (l) => l.createdBy === agent.id && this.isWithin(l.createdAt, start, end)
      );
      const assignedLeads = allLeads.filter((l) => l.assignedTo === agent.id);
      const convertedLeads = assignedLeads.filter((l) => l.status === 'CUSTOMER');
      const samplesRequested = assignedLeads.filter((l) => l.status === 'SAMPLE_REQUESTED');

      const agentCalls = allCalls.filter(
        (c) => c.userId === agent.id && this.isWithin(c.startedAt || c.createdAt, start, end)
      );
      const verifiedCalls = agentCalls.filter((c) => c.verificationStatus === 'VERIFIED');
      const unverifiedCalls = agentCalls.filter((c) => c.verificationStatus !== 'VERIFIED');
      const verifiedTalkTimeSeconds = verifiedCalls.reduce((acc, c) => acc + (c.durationSeconds || 0), 0);
      const averageVerifiedDurationSeconds =
        verifiedCalls.length > 0 ? Math.round(verifiedTalkTimeSeconds / verifiedCalls.length) : 0;

      const agentFollowUps = allFollowUps.filter(
        (f) => f.userId === agent.id && this.isWithin(f.scheduledAt || f.createdAt, start, end)
      );
      const followUpsCompleted = agentFollowUps.filter((f) => f.status === 'COMPLETED').length;

      const agentMessages = allMessages.filter(
        (m) => m.userId === agent.id && this.isWithin(m.sentAt || m.createdAt, start, end)
      );

      const agentActs = allActivities.filter((a) => a.userId === agent.id).reverse();
      const lastActivityAt = agentActs.length > 0 ? agentActs[0].createdAt : null;

      const totalAssigned = assignedLeads.length;
      const conversionRatePercentage = totalAssigned > 0 ? Math.round((convertedLeads.length / totalAssigned) * 100) : 0;

      return {
        agentId: agent.id,
        agentName: agent.name,
        email: agent.email,
        phone: agent.phone,
        status: agent.status,
        lastLoginAt: agent.lastLoginAt,
        lastActivityAt,
        leadsCreated: createdLeads.length,
        leadsAssigned: totalAssigned,
        callsMade: agentCalls.length,
        verifiedCalls: verifiedCalls.length,
        unverifiedCalls: unverifiedCalls.length,
        verifiedTalkTimeSeconds,
        averageVerifiedDurationSeconds,
        followUpsCreated: agentFollowUps.length,
        followUpsCompleted,
        whatsAppInitiated: agentMessages.length,
        samplesRequested: samplesRequested.length,
        customersConverted: convertedLeads.length,
        conversionRatePercentage,
      };
    });
  }

  /**
   * Generates Follow-up Report.
   */
  static async getFollowUpReport(actor: User | null, filters: ReportFilterOptions = {}): Promise<FollowUpReportData> {
    this.assertAdmin(actor);
    const db = this.getDb();
    const { start, end } = this.getDateBoundaries(filters.datePreset, filters.startDate, filters.endDate);

    let followUps = await db.followUps.filter((f) => f.deletedAt === null).toArray();
    const users = await db.users.toArray();
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    if (filters.agentId && filters.agentId !== 'ALL') {
      followUps = followUps.filter((f) => f.userId === filters.agentId);
    }

    followUps = followUps.filter((f) => this.isWithin(f.scheduledAt || f.createdAt, start, end));

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    let total = followUps.length;
    let today = 0;
    let upcoming = 0;
    let overdue = 0;
    let completed = 0;
    let cancelled = 0;

    const agentMap = new Map<string, { total: number; completed: number; overdue: number }>();

    for (const f of followUps) {
      const uId = f.userId || 'UNASSIGNED';
      const ag = agentMap.get(uId) || { total: 0, completed: 0, overdue: 0 };
      ag.total++;

      if (f.status === 'COMPLETED') {
        completed++;
        ag.completed++;
      } else if (f.status === 'CANCELLED') {
        cancelled++;
      } else if (f.status === 'PENDING') {
        const sch = new Date(f.scheduledAt).getTime();
        if (sch < todayStart.getTime()) {
          overdue++;
          ag.overdue++;
        } else if (sch >= todayStart.getTime() && sch <= todayEnd.getTime()) {
          today++;
        } else {
          upcoming++;
        }
      }

      agentMap.set(uId, ag);
    }

    const completionPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    const overduePercentage = total > 0 ? Math.round((overdue / total) * 100) : 0;

    const followUpsByAgent = Array.from(agentMap.entries()).map(([agentId, stat]) => ({
      agentId,
      agentName: userMap.get(agentId) || (agentId === 'UNASSIGNED' ? 'Unassigned' : 'Sales Rep'),
      total: stat.total,
      completed: stat.completed,
      overdue: stat.overdue,
    }));

    return {
      totalFollowUps: total,
      today,
      upcoming,
      overdue,
      completed,
      cancelled,
      completionPercentage,
      overduePercentage,
      followUpsByAgent,
    };
  }

  /**
   * Generates WhatsApp Report.
   */
  static async getWhatsAppReport(actor: User | null, filters: ReportFilterOptions = {}): Promise<WhatsAppReportData> {
    this.assertAdmin(actor);
    const db = this.getDb();
    const { start, end } = this.getDateBoundaries(filters.datePreset, filters.startDate, filters.endDate);

    let messages = await db.messageHistory.toArray();
    const templates = await db.messageTemplates.toArray();
    const users = await db.users.toArray();
    const templateMap = new Map(templates.map((t) => [t.id, t.title]));
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    if (filters.agentId && filters.agentId !== 'ALL') {
      messages = messages.filter((m) => m.userId === filters.agentId);
    }

    messages = messages.filter((m) => this.isWithin(m.sentAt || m.createdAt, start, end));

    let totalInitiated = 0;
    let totalFailed = 0;
    const agentMap = new Map<string, number>();
    const dateMap = new Map<string, number>();
    const templateUsageMap = new Map<string, number>();

    for (const m of messages) {
      if (m.sentStatus === 'FAILED') {
        totalFailed++;
      } else {
        totalInitiated++;
      }

      if (m.userId) {
        agentMap.set(m.userId, (agentMap.get(m.userId) || 0) + 1);
      }

      const dateKey = (m.sentAt || m.createdAt).substring(0, 10);
      dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1);

      if (m.templateId) {
        templateUsageMap.set(m.templateId, (templateUsageMap.get(m.templateId) || 0) + 1);
      }
    }

    const byAgent = Array.from(agentMap.entries()).map(([agentId, count]) => ({
      agentId,
      agentName: userMap.get(agentId) || 'Sales Rep',
      count,
    }));

    const byDate = Array.from(dateMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));

    const templateUsage = Array.from(templateUsageMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([templateId, count]) => ({
        templateId,
        name: templateMap.get(templateId) || 'Custom Template',
        count,
      }));

    const mostUsedTemplateName = templateUsage.length > 0 ? templateUsage[0].name : null;

    // Count landlines in leads database to estimate prevented WhatsApp messages
    const landlineCount = await db.leads.where('phoneType').equals('landline').count();

    return {
      totalInitiated,
      totalFailed,
      byAgent,
      byDate,
      templateUsage,
      mostUsedTemplateName,
      landlinePreventedCount: landlineCount,
    };
  }

  /**
   * Generates Spreadsheet Import Report.
   */
  static async getImportReport(actor: User | null, filters: ReportFilterOptions = {}): Promise<ImportReportData> {
    this.assertAdmin(actor);
    const db = this.getDb();
    const { start, end } = this.getDateBoundaries(filters.datePreset, filters.startDate, filters.endDate);

    let audits = await db.importAudits.toArray();
    const users = await db.users.toArray();
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    if (filters.agentId && filters.agentId !== 'ALL') {
      audits = audits.filter((a) => a.uploadedBy === filters.agentId);
    }

    audits = audits.filter((a) => this.isWithin(a.startedAt || a.createdAt, start, end));
    audits.sort((a, b) => new Date(b.startedAt || b.createdAt).getTime() - new Date(a.startedAt || a.createdAt).getTime());

    let totalLeadsImported = 0;
    let totalDuplicatesSkipped = 0;
    let totalInvalidRows = 0;

    const importsList = audits.map((a) => {
      totalLeadsImported += a.imported || 0;
      totalDuplicatesSkipped += a.duplicates || 0;
      totalInvalidRows += a.invalid || 0;

      return {
        id: a.id,
        filename: a.filename,
        uploadedByName: a.uploadedBy ? (userMap.get(a.uploadedBy) || 'Administrator') : 'Unknown/removed user',
        startedAt: a.startedAt,
        completedAt: a.completedAt,
        totalRows: a.totalRows,
        imported: a.imported,
        duplicates: a.duplicates,
        invalid: a.invalid,
      };
    });

    return {
      totalImports: audits.length,
      totalLeadsImported,
      totalDuplicatesSkipped,
      totalInvalidRows,
      importsList,
    };
  }

  /**
   * Generates Chronological Activity Stream Report.
   */
  static async getActivityReport(actor: User | null, filters: ReportFilterOptions = {}): Promise<ActivityReportItem[]> {
    this.assertAdmin(actor);
    const db = this.getDb();
    const { start, end } = this.getDateBoundaries(filters.datePreset, filters.startDate, filters.endDate);

    let activities = await db.activities.filter((a) => a.deletedAt === null).toArray();
    const users = await db.users.toArray();
    const leads = await db.leads.toArray();
    const userMap = new Map(users.map((u) => [u.id, u.name]));
    const leadMap = new Map(leads.map((l) => [l.id, l.businessName]));

    if (filters.agentId && filters.agentId !== 'ALL') {
      activities = activities.filter((a) => a.userId === filters.agentId);
    }

    activities = activities.filter((a) => this.isWithin(a.createdAt, start, end));
    activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return activities.slice(0, 150).map((a) => ({
      id: a.id,
      activityType: a.activityType,
      actorName: userMap.get(a.userId) || 'CRM User',
      leadName: a.leadId ? leadMap.get(a.leadId) || 'General' : undefined,
      createdAt: a.createdAt,
      metadata: a.metadata,
    }));
  }

  /**
   * Exports filtered CRM data to sanitized CSV. Never leaks passwords, tokens or service keys.
   */
  static async exportReportToCSV(
    actor: User | null,
    reportType: 'LEADS' | 'CALLS' | 'AGENTS' | 'FOLLOW_UPS' | 'ACTIVITIES',
    filters: ReportFilterOptions = {}
  ): Promise<string> {
    this.assertAdmin(actor);
    const db = this.getDb();
    const sanitize = sanitizeCsvCell;

    if (reportType === 'LEADS') {
      await this.getLeadReport(actor, filters);
      const leads = await db.leads.filter((l) => l.deletedAt === null).toArray();
      const users = await db.users.toArray();
      const userMap = new Map(users.map((u) => [u.id, u.name]));

      const headers = ['Lead ID', 'Gym/Business Name', 'Category', 'Phone', 'Locality', 'Status', 'Assigned Rep', 'Created At'];
      const rows = leads.map((l) => [
        sanitize(l.id),
        sanitize(l.businessName),
        sanitize(l.category),
        sanitize(l.phone),
        sanitize(l.locality),
        sanitize(l.status),
        sanitize(l.assignedTo ? userMap.get(l.assignedTo) || 'Assigned' : 'Unassigned'),
        sanitize(l.createdAt),
      ].join(','));

      return [headers.join(','), ...rows].join('\n');
    }

    if (reportType === 'CALLS') {
      const calls = await db.callRecords.filter((c) => c.deletedAt === null).toArray();
      const users = await db.users.toArray();
      const leads = await db.leads.toArray();
      const userMap = new Map(users.map((u) => [u.id, u.name]));
      const leadMap = new Map(leads.map((l) => [l.id, l.businessName]));

      const headers = ['Call ID', 'Lead Name', 'Agent Name', 'Started At', 'Duration Seconds', 'Outcome', 'Verification Status', 'Remark'];
      const rows = calls.map((c) => [
        sanitize(c.id),
        sanitize(leadMap.get(c.leadId) || 'Unknown Lead'),
        sanitize(userMap.get(c.userId) || 'Sales Rep'),
        sanitize(c.startedAt),
        sanitize(c.verificationStatus === 'VERIFIED' ? c.durationSeconds : 0),
        sanitize(c.outcome),
        sanitize(c.verificationStatus),
        sanitize(c.remark || ''),
      ].join(','));

      return [headers.join(','), ...rows].join('\n');
    }

    if (reportType === 'AGENTS') {
      const agentProd = await this.getAgentProductivityReport(actor, filters);
      const headers = ['Agent Name', 'Email', 'Phone', 'Status', 'Leads Assigned', 'Calls Made', 'Verified Calls', 'Verified Talk Time (s)', 'Follow-ups Completed', 'Conversion Rate %', 'Last Login'];
      const rows = agentProd.map((a) => [
        sanitize(a.agentName),
        sanitize(a.email),
        sanitize(a.phone),
        sanitize(a.status),
        sanitize(a.leadsAssigned),
        sanitize(a.callsMade),
        sanitize(a.verifiedCalls),
        sanitize(a.verifiedTalkTimeSeconds),
        sanitize(a.followUpsCompleted),
        sanitize(`${a.conversionRatePercentage}%`),
        sanitize(a.lastLoginAt || 'Never'),
      ].join(','));

      return [headers.join(','), ...rows].join('\n');
    }

    if (reportType === 'FOLLOW_UPS') {
      const followUps = await db.followUps.filter((f) => f.deletedAt === null).toArray();
      const users = await db.users.toArray();
      const leads = await db.leads.toArray();
      const userMap = new Map(users.map((u) => [u.id, u.name]));
      const leadMap = new Map(leads.map((l) => [l.id, l.businessName]));

      const headers = ['FollowUp ID', 'Lead Name', 'Agent', 'Scheduled At', 'Title', 'Priority', 'Status', 'Completed At'];
      const rows = followUps.map((f) => [
        sanitize(f.id),
        sanitize(leadMap.get(f.leadId) || 'Unknown Lead'),
        sanitize(f.userId ? userMap.get(f.userId) || 'Rep' : 'Unassigned'),
        sanitize(f.scheduledAt),
        sanitize(f.title),
        sanitize(f.priority),
        sanitize(f.status),
        sanitize(f.completedAt || ''),
      ].join(','));

      return [headers.join(','), ...rows].join('\n');
    }

    if (reportType === 'ACTIVITIES') {
      const activities = await this.getActivityReport(actor, filters);
      const headers = ['Activity ID', 'Event Type', 'Actor', 'Lead Name', 'Timestamp', 'Metadata'];
      const rows = activities.map((a) => [
        sanitize(a.id),
        sanitize(a.activityType),
        sanitize(a.actorName),
        sanitize(a.leadName || 'N/A'),
        sanitize(a.createdAt),
        sanitize(JSON.stringify(a.metadata || {})),
      ].join(','));

      return [headers.join(','), ...rows].join('\n');
    }

    return '';
  }
}
