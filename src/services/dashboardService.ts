/**
 * Dashboard Service
 * Computes live sales KPI metrics, pipeline counts, locality distribution, and unified recent activity.
 */

import type { SalesCRMDatabase } from '../db/database';
import type { Lead, LeadStatus } from '../db/types';
import type { EnrichedFollowUp } from '../db/repositories/followUpRepository';
import { canAccessLead } from '../db/accessScope';

export interface DashboardMetrics {
  totalLeads: number;
  notContacted: number;
  callsToday: number;
  whatsAppToday: number;
  interested: number;
  samplesRequested: number;
  followUpsToday: number;
  overdueFollowUps: number;
  customers: number;
}

export interface PipelineStageCount {
  status: LeadStatus;
  label: string;
  count: number;
  colorClass: string;
}

export interface LocalityBreakdown {
  locality: string;
  total: number;
  interested: number;
  customers: number;
}

export interface RecentActivityItem {
  id: string;
  leadId: string;
  businessName: string;
  locality: string;
  type: 'CALL' | 'REMARK' | 'WHATSAPP' | 'FOLLOW_UP_COMPLETED' | 'FOLLOW_UP_SCHEDULED';
  title: string;
  detail?: string | null;
  timestamp: string;
}

export interface FullDashboardData {
  metrics: DashboardMetrics;
  todayFollowUps: EnrichedFollowUp[];
  pipeline: PipelineStageCount[];
  localities: LocalityBreakdown[];
  recentActivities: RecentActivityItem[];
}

export class DashboardService {
  constructor(private db: SalesCRMDatabase) {}

  private getTodayRange(now = new Date()): { todayStart: string; todayEnd: string } {
    // Compute "today" in local time (IST on device). Using toISOString() would
    // bucket early-morning activity into the previous UTC day.
    return {
      todayStart: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(),
      todayEnd: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString(),
    };
  }

  private async getActiveLeads(): Promise<Lead[]> {
    const scope = this.db.requireAccessScope();
    return this.db.leads
      .filter((lead) => lead.deletedAt === null && canAccessLead(scope, lead))
      .toArray();
  }

  private buildLeadMap(leads: Lead[]): Map<string, Lead> {
    const leadMap = new Map<string, Lead>();
    for (const lead of leads) leadMap.set(lead.id, lead);
    return leadMap;
  }

  private async getFollowUpSummary(
    leadMap: Map<string, Lead>,
    todayStart: string,
    todayEnd: string,
  ): Promise<{ overdueCount: number; todayFollowUps: EnrichedFollowUp[] }> {
    const pendingFollowUps = await this.db.followUps
      .filter((item) => leadMap.has(item.leadId) && item.deletedAt === null && item.status === 'PENDING')
      .sortBy('scheduledAt');
    let overdueCount = 0;
    const todayFollowUps: EnrichedFollowUp[] = [];

    for (const item of pendingFollowUps) {
      const lead = leadMap.get(item.leadId);
      const enriched: EnrichedFollowUp = {
        ...item,
        lead: lead
          ? {
              id: lead.id,
              businessName: lead.businessName,
              locality: lead.locality,
              phone: lead.phone,
              phoneE164: lead.phoneE164,
              phoneType: lead.phoneType,
              status: lead.status,
            }
          : undefined,
      };
      if (item.scheduledAt < todayStart) {
        overdueCount++;
      } else if (item.scheduledAt <= todayEnd) {
        todayFollowUps.push(enriched);
      }
    }

    return { overdueCount, todayFollowUps };
  }

  private async getTodayActivityCounts(
    leadMap: Map<string, Lead>,
    todayStart: string,
    todayEnd: string,
  ): Promise<{ callsToday: number; whatsAppToday: number }> {
    const callsTodayList = await this.db.callRecords
      .filter(
        (call) =>
          leadMap.has(call.leadId) &&
          call.deletedAt === null &&
          Boolean(call.startedAt && call.startedAt >= todayStart && call.startedAt <= todayEnd),
      )
      .toArray();
    const messagesTodayList = await this.db.messageHistory
      .filter(
        (message) =>
          leadMap.has(message.leadId) &&
          message.deletedAt === null &&
          Boolean(message.sentAt && message.sentAt >= todayStart && message.sentAt <= todayEnd),
      )
      .toArray();
    return { callsToday: callsTodayList.length, whatsAppToday: messagesTodayList.length };
  }

  private aggregateLeads(leads: Lead[]): {
    statusCounts: Record<LeadStatus, number>;
    localities: LocalityBreakdown[];
  } {
    const statusCounts: Record<LeadStatus, number> = {
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
    const localityMap = new Map<string, { total: number; interested: number; customers: number }>();

    for (const lead of leads) {
      if (statusCounts[lead.status] !== undefined) statusCounts[lead.status]++;

      const locality = lead.locality || 'Other Lucknow';
      const current = localityMap.get(locality) || { total: 0, interested: 0, customers: 0 };
      current.total++;
      if (lead.status === 'INTERESTED' || lead.status === 'SAMPLE_REQUESTED') current.interested++;
      if (lead.status === 'CUSTOMER') current.customers++;
      localityMap.set(locality, current);
    }

    const localities = Array.from(localityMap.entries())
      .map(([locality, data]) => ({
        locality,
        total: data.total,
        interested: data.interested,
        customers: data.customers,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    return { statusCounts, localities };
  }

  private buildPipeline(statusCounts: Record<LeadStatus, number>): PipelineStageCount[] {
    return [
      { status: 'NEW', label: 'New Leads', count: statusCounts.NEW, colorClass: 'bg-blue-500 text-white' },
      { status: 'CONTACTED', label: 'Contacted', count: statusCounts.CONTACTED, colorClass: 'bg-purple-500 text-white' },
      { status: 'INTERESTED', label: 'Interested', count: statusCounts.INTERESTED, colorClass: 'bg-emerald-500 text-white' },
      { status: 'SAMPLE_REQUESTED', label: 'Sample Sent/Req', count: statusCounts.SAMPLE_REQUESTED, colorClass: 'bg-amber-500 text-white' },
      { status: 'FOLLOW_UP', label: 'Follow Up', count: statusCounts.FOLLOW_UP, colorClass: 'bg-indigo-500 text-white' },
      { status: 'NEGOTIATION', label: 'Negotiation', count: statusCounts.NEGOTIATION, colorClass: 'bg-teal-500 text-white' },
      { status: 'CUSTOMER', label: 'Customers (Closed)', count: statusCounts.CUSTOMER, colorClass: 'bg-emerald-700 text-white' },
      { status: 'NOT_INTERESTED', label: 'Not Interested', count: statusCounts.NOT_INTERESTED, colorClass: 'bg-slate-500 text-white' },
    ];
  }

  private buildMetrics(
    totalLeads: number,
    statusCounts: Record<LeadStatus, number>,
    todayFollowUps: EnrichedFollowUp[],
    overdueCount: number,
    callsToday: number,
    whatsAppToday: number,
  ): DashboardMetrics {
    return {
      totalLeads,
      notContacted: statusCounts.NEW,
      callsToday,
      whatsAppToday,
      interested: statusCounts.INTERESTED,
      samplesRequested: statusCounts.SAMPLE_REQUESTED,
      followUpsToday: todayFollowUps.length,
      overdueFollowUps: overdueCount,
      customers: statusCounts.CUSTOMER,
    };
  }

  private async getRecentActivities(leadMap: Map<string, Lead>): Promise<RecentActivityItem[]> {
    const [recentCalls, recentRemarks, recentMessages, recentFollowUps] = await Promise.all([
      this.db.callRecords
        .filter((call) => leadMap.has(call.leadId) && call.deletedAt === null)
        .reverse()
        .sortBy('startedAt')
        .then((records) => records.slice(0, 10)),
      this.db.remarks
        .filter((remark) => leadMap.has(remark.leadId) && remark.deletedAt === null)
        .reverse()
        .sortBy('createdAt')
        .then((records) => records.slice(0, 10)),
      this.db.messageHistory
        .filter((message) => leadMap.has(message.leadId) && message.deletedAt === null)
        .reverse()
        .sortBy('sentAt')
        .then((records) => records.slice(0, 10)),
      this.db.followUps
        .filter((followUp) => leadMap.has(followUp.leadId) && followUp.deletedAt === null && followUp.status === 'COMPLETED')
        .reverse()
        .sortBy('completedAt')
        .then((records) => records.slice(0, 10)),
    ]);
    const activities: RecentActivityItem[] = [
      ...recentCalls.map((call) => {
        const lead = leadMap.get(call.leadId);
        return {
          id: 'call-' + call.id,
          leadId: call.leadId,
          businessName: lead ? lead.businessName : 'Gym Contact',
          locality: lead ? lead.locality : 'Lucknow',
          type: 'CALL' as const,
          title: 'Call: ' + call.outcome,
          detail: call.remark,
          timestamp: call.startedAt,
        };
      }),
      ...recentRemarks.map((remark) => {
        const lead = leadMap.get(remark.leadId);
        return {
          id: 'rem-' + remark.id,
          leadId: remark.leadId,
          businessName: lead ? lead.businessName : 'Gym Contact',
          locality: lead ? lead.locality : 'Lucknow',
          type: 'REMARK' as const,
          title: 'Sales Remark',
          detail: remark.content,
          timestamp: remark.createdAt,
        };
      }),
      ...recentMessages.map((message) => {
        const lead = leadMap.get(message.leadId);
        return {
          id: 'msg-' + message.id,
          leadId: message.leadId,
          businessName: lead ? lead.businessName : 'Gym Contact',
          locality: lead ? lead.locality : 'Lucknow',
          type: 'WHATSAPP' as const,
          title: 'WhatsApp (' + message.sentStatus + ')',
          detail: message.messageContent ? message.messageContent.slice(0, 60) + '...' : null,
          timestamp: message.sentAt,
        };
      }),
      ...recentFollowUps.map((followUp) => {
        const lead = leadMap.get(followUp.leadId);
        return {
          id: 'fu-' + followUp.id,
          leadId: followUp.leadId,
          businessName: lead ? lead.businessName : 'Gym Contact',
          locality: lead ? lead.locality : 'Lucknow',
          type: 'FOLLOW_UP_COMPLETED' as const,
          title: 'Completed Follow-up: ' + followUp.title,
          detail: followUp.notes,
          timestamp: followUp.completedAt || followUp.updatedAt,
        };
      }),
    ];
    activities.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));
    return activities.slice(0, 15);
  }

  async getDashboardData(): Promise<FullDashboardData> {
    const { todayStart, todayEnd } = this.getTodayRange();
    const allLeads = await this.getActiveLeads();
    const leadMap = this.buildLeadMap(allLeads);
    const { overdueCount, todayFollowUps } = await this.getFollowUpSummary(leadMap, todayStart, todayEnd);
    const { callsToday, whatsAppToday } = await this.getTodayActivityCounts(leadMap, todayStart, todayEnd);
    const { statusCounts, localities } = this.aggregateLeads(allLeads);
    const pipeline = this.buildPipeline(statusCounts);
    const metrics = this.buildMetrics(
      allLeads.length,
      statusCounts,
      todayFollowUps,
      overdueCount,
      callsToday,
      whatsAppToday,
    );
    const recentActivities = await this.getRecentActivities(leadMap);

    return {
      metrics,
      todayFollowUps,
      pipeline,
      localities,
      recentActivities,
    };
  }
}
