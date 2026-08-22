/**
 * Dashboard Service
 * Computes live sales KPI metrics, pipeline counts, locality distribution, and unified recent activity.
 */

import { SalesCRMDatabase } from '../db/database';
import { LeadStatus } from '../db/types';
import { EnrichedFollowUp } from '../db/repositories/followUpRepository';

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

  async getDashboardData(): Promise<FullDashboardData> {
    const now = new Date();
    // Compute "today" in local time (IST on device). Using toISOString() would
    // bucket early-morning activity into the previous UTC day.
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

    // 1. Fetch active leads
    const allLeads = await this.db.leads
      .filter((l) => l.deletedAt === null)
      .toArray();

    const leadMap = new Map<string, (typeof allLeads)[0]>();
    for (const lead of allLeads) {
      leadMap.set(lead.id, lead);
    }

    // 2. Fetch pending follow-ups
    const pendingFollowUps = await this.db.followUps
      .filter((f) => f.deletedAt === null && f.status === 'PENDING')
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

    // 3. Fetch Calls & Messages logged today
    const callsTodayList = await this.db.callRecords
      .filter((c) => c.deletedAt === null && Boolean(c.startedAt && c.startedAt >= todayStart && c.startedAt <= todayEnd))
      .toArray();

    const messagesTodayList = await this.db.messageHistory
      .filter((m) => m.deletedAt === null && Boolean(m.sentAt && m.sentAt >= todayStart && m.sentAt <= todayEnd))
      .toArray();

    // 4. Compute pipeline stage distribution
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

    // Locality aggregation
    const localityMap = new Map<string, { total: number; interested: number; customers: number }>();

    for (const lead of allLeads) {
      if (statusCounts[lead.status] !== undefined) {
        statusCounts[lead.status]++;
      }

      const locName = lead.locality || 'Other Lucknow';
      const currentLoc = localityMap.get(locName) || { total: 0, interested: 0, customers: 0 };
      currentLoc.total++;
      if (lead.status === 'INTERESTED' || lead.status === 'SAMPLE_REQUESTED') {
        currentLoc.interested++;
      }
      if (lead.status === 'CUSTOMER') {
        currentLoc.customers++;
      }
      localityMap.set(locName, currentLoc);
    }

    const localities: LocalityBreakdown[] = Array.from(localityMap.entries())
      .map(([locality, data]) => ({
        locality,
        total: data.total,
        interested: data.interested,
        customers: data.customers,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8); // Top 8 localities

    const pipeline: PipelineStageCount[] = [
      { status: 'NEW', label: 'New Leads', count: statusCounts.NEW, colorClass: 'bg-blue-500 text-white' },
      { status: 'CONTACTED', label: 'Contacted', count: statusCounts.CONTACTED, colorClass: 'bg-purple-500 text-white' },
      { status: 'INTERESTED', label: 'Interested', count: statusCounts.INTERESTED, colorClass: 'bg-emerald-500 text-white' },
      { status: 'SAMPLE_REQUESTED', label: 'Sample Sent/Req', count: statusCounts.SAMPLE_REQUESTED, colorClass: 'bg-amber-500 text-white' },
      { status: 'FOLLOW_UP', label: 'Follow Up', count: statusCounts.FOLLOW_UP, colorClass: 'bg-indigo-500 text-white' },
      { status: 'NEGOTIATION', label: 'Negotiation', count: statusCounts.NEGOTIATION, colorClass: 'bg-teal-500 text-white' },
      { status: 'CUSTOMER', label: 'Customers (Closed)', count: statusCounts.CUSTOMER, colorClass: 'bg-emerald-700 text-white' },
      { status: 'NOT_INTERESTED', label: 'Not Interested', count: statusCounts.NOT_INTERESTED, colorClass: 'bg-slate-500 text-white' },
    ];

    const metrics: DashboardMetrics = {
      totalLeads: allLeads.length,
      notContacted: statusCounts.NEW,
      callsToday: callsTodayList.length,
      whatsAppToday: messagesTodayList.length,
      interested: statusCounts.INTERESTED,
      samplesRequested: statusCounts.SAMPLE_REQUESTED,
      followUpsToday: todayFollowUps.length,
      overdueFollowUps: overdueCount,
      customers: statusCounts.CUSTOMER,
    };

    // 5. Derive Recent Activity Feed
    const [recentCalls, recentRemarks, recentMessages, recentFollowUps] = await Promise.all([
      this.db.callRecords
        .filter((c) => c.deletedAt === null)
        .reverse()
        .sortBy('startedAt')
        .then((res) => res.slice(0, 10)),
      this.db.remarks
        .filter((r) => r.deletedAt === null)
        .reverse()
        .sortBy('createdAt')
        .then((res) => res.slice(0, 10)),
      this.db.messageHistory
        .filter((m) => m.deletedAt === null)
        .reverse()
        .sortBy('sentAt')
        .then((res) => res.slice(0, 10)),
      this.db.followUps
        .filter((f) => f.deletedAt === null && f.status === 'COMPLETED')
        .reverse()
        .sortBy('completedAt')
        .then((res) => res.slice(0, 10)),
    ]);

    const activities: RecentActivityItem[] = [];

    for (const call of recentCalls) {
      const lead = leadMap.get(call.leadId);
      activities.push({
        id: `call-${call.id}`,
        leadId: call.leadId,
        businessName: lead ? lead.businessName : 'Gym Contact',
        locality: lead ? lead.locality : 'Lucknow',
        type: 'CALL',
        title: `Call: ${call.outcome}`,
        detail: call.remark,
        timestamp: call.startedAt,
      });
    }

    for (const rem of recentRemarks) {
      const lead = leadMap.get(rem.leadId);
      activities.push({
        id: `rem-${rem.id}`,
        leadId: rem.leadId,
        businessName: lead ? lead.businessName : 'Gym Contact',
        locality: lead ? lead.locality : 'Lucknow',
        type: 'REMARK',
        title: `Sales Remark`,
        detail: rem.content,
        timestamp: rem.createdAt,
      });
    }

    for (const msg of recentMessages) {
      const lead = leadMap.get(msg.leadId);
      activities.push({
        id: `msg-${msg.id}`,
        leadId: msg.leadId,
        businessName: lead ? lead.businessName : 'Gym Contact',
        locality: lead ? lead.locality : 'Lucknow',
        type: 'WHATSAPP',
        title: `WhatsApp (${msg.sentStatus})`,
        detail: msg.messageContent ? msg.messageContent.slice(0, 60) + '...' : null,
        timestamp: msg.sentAt,
      });
    }

    for (const fu of recentFollowUps) {
      const lead = leadMap.get(fu.leadId);
      activities.push({
        id: `fu-${fu.id}`,
        leadId: fu.leadId,
        businessName: lead ? lead.businessName : 'Gym Contact',
        locality: lead ? lead.locality : 'Lucknow',
        type: 'FOLLOW_UP_COMPLETED',
        title: `Completed Follow-up: ${fu.title}`,
        detail: fu.notes,
        timestamp: fu.completedAt || fu.updatedAt,
      });
    }

    activities.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));
    const recentActivities = activities.slice(0, 15);

    return {
      metrics,
      todayFollowUps,
      pipeline,
      localities,
      recentActivities,
    };
  }
}
