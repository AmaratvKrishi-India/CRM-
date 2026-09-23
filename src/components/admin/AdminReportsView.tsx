/**
 * Admin Reports View (Phase 2M)
 * Comprehensive Analytics & Reporting command center for administrators.
 * Supports Lead Reports, Call Volume & Verified Talk Time, Agent Productivity,
 * Follow-up Completion, WhatsApp Engagement, Import Audits, and sanitized CSV Exports.
 * Rewritten for design tokens + accessible tablist (F1/F2/F14/F15).
 */

import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  BarChart3,
  Users,
  PhoneCall,
  Calendar,
  MessageSquare,
  FileSpreadsheet,
  Activity as ActivityIcon,
  Clock,
  TrendingUp,
  Award,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Flame,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type {
  ReportFilterOptions,
  LeadReportData,
  CallReportData,
  AgentProductivityItem,
  FollowUpReportData,
  WhatsAppReportData,
  ImportReportData,
  ActivityReportItem} from '../../services/adminReportsService';
import {
  AdminReportsService
} from '../../services/adminReportsService';
import { ReportKpiCard } from './reports/ReportKpiCard';
import { ReportFilterBar } from './reports/ReportFilterBar';
import { RealtimeService } from '../../services/realtime/realtimeService';
import type { User } from '../../db/types';
import { getDatabase } from '../../db/database';
import { labelFor } from '../../lib/labels';

export type ReportTab =
  | 'LEADS'
  | 'CALLS'
  | 'PRODUCTIVITY'
  | 'FOLLOW_UPS'
  | 'WHATSAPP'
  | 'IMPORTS'
  | 'ACTIVITY';

const TAB_ORDER: ReportTab[] = [
  'LEADS',
  'CALLS',
  'PRODUCTIVITY',
  'FOLLOW_UPS',
  'WHATSAPP',
  'IMPORTS',
  'ACTIVITY',
];

const TAB_META: Record<ReportTab, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  LEADS: { label: 'Leads', icon: TrendingUp },
  CALLS: { label: 'Calls', icon: PhoneCall },
  PRODUCTIVITY: { label: 'Productivity', icon: Award },
  FOLLOW_UPS: { label: 'Follow-ups', icon: Calendar },
  WHATSAPP: { label: 'WhatsApp', icon: MessageSquare },
  IMPORTS: { label: 'Imports', icon: FileSpreadsheet },
  ACTIVITY: { label: 'Activity Log', icon: ActivityIcon },
};

const formatSeconds = (seconds: number) => {
  if (!seconds || seconds <= 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const LeadReportSection: React.FC<{ active: boolean; report: LeadReportData | null }> = ({ active, report }) => {
  if (!active || !report) return null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ReportKpiCard title="Total Leads" value={report.totalLeads} subtitle={`${report.assignedLeads} Assigned`} icon={TrendingUp} color="blue" />
        <ReportKpiCard title="Converted Customers" value={report.convertedCustomers} subtitle={`${report.conversionPercentage}% Conversion Rate`} icon={Award} color="emerald" />
        <ReportKpiCard title="New Leads" value={report.statusBreakdown.NEW} subtitle="Awaiting first contact" icon={Flame} color="purple" />
        <ReportKpiCard title="Unassigned Leads" value={report.unassignedLeads} subtitle="Territory pool" icon={Users} color="amber" />
      </div>
      <div className="p-4 bg-surface border border-line rounded-2xl shadow-md space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-soft">Lead Status Distribution</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(report.statusBreakdown).map(([status, count]) => (
            <div key={status} className="p-2.5 bg-inset rounded-xl border border-line text-center">
              <span className="text-xs uppercase font-bold text-soft block truncate">{labelFor(status)}</span>
              <span className="text-base font-black text-ink">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const CallReportSection: React.FC<{ active: boolean; report: CallReportData | null }> = ({ active, report }) => {
  if (!active || !report) return null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ReportKpiCard title="Total Calls" value={report.totalCalls} subtitle={`${report.verifiedCalls} Verified`} icon={PhoneCall} color="emerald" />
        <ReportKpiCard title="Verified Talk Time" value={formatSeconds(report.verifiedTalkTimeSeconds)} subtitle="Zero fake duration" icon={Clock} color="purple" />
        <ReportKpiCard title="Avg Verified Duration" value={formatSeconds(report.averageVerifiedDurationSeconds)} subtitle="Per verified connection" icon={CheckCircle2} color="blue" />
        <ReportKpiCard title="Longest Call" value={formatSeconds(report.longestVerifiedDurationSeconds)} subtitle="Top duration" icon={Award} color="amber" />
      </div>
      <div className="p-4 bg-surface border border-line rounded-2xl shadow-md space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-soft">Call Outcome Distribution</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(report.callsByOutcome).map(([outcome, count]) => (
            <div key={outcome} className="p-2.5 bg-inset rounded-xl border border-line text-center">
              <span className="text-xs uppercase font-bold text-soft block truncate">{labelFor(outcome)}</span>
              <span className="text-base font-black text-ink">{count}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="p-4 bg-surface border border-line rounded-2xl shadow-md space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-soft">Verified Talk Time by Sales Representative</h3>
        <div className="space-y-2">
          {report.talkTimeByAgent.map((stat) => (
            <div key={stat.agentId} className="p-3 bg-inset rounded-xl flex items-center justify-between text-sm">
              <div>
                <span className="font-bold text-ink block">{stat.agentName}</span>
                <span className="text-xs text-soft">Avg: {formatSeconds(stat.avgVerifiedDurationSeconds)}</span>
              </div>
              <span className="font-black text-accent-text text-sm">{formatSeconds(stat.verifiedTalkTimeSeconds)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const FollowUpReportSection: React.FC<{ active: boolean; report: FollowUpReportData | null }> = ({ active, report }) => {
  if (!active || !report) return null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ReportKpiCard
          title="Total Follow-ups"
          value={report.totalFollowUps}
          subtitle={`${report.completionPercentage}% Completed`}
          icon={Calendar}
          color="blue"
        />
        <ReportKpiCard
          title="Completed"
          value={report.completed}
          subtitle="Successfully concluded"
          icon={CheckCircle2}
          color="emerald"
        />
        <ReportKpiCard
          title="Today's Reminders"
          value={report.today}
          subtitle="Action required"
          icon={Flame}
          color="amber"
        />
        <ReportKpiCard
          title="Overdue"
          value={report.overdue}
          subtitle={`${report.overduePercentage}% Overdue`}
          icon={AlertCircle}
          color="rose"
        />
      </div>
    </div>
  );
};

const WhatsAppReportSection: React.FC<{ active: boolean; report: WhatsAppReportData | null }> = ({ active, report }) => {
  if (!active || !report) return null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <ReportKpiCard
          title="WhatsApp Initiated"
          value={report.totalInitiated}
          subtitle="Templates dispatched"
          icon={MessageSquare}
          color="emerald"
        />
        <ReportKpiCard
          title="Landlines Guarded"
          value={report.landlinePreventedCount}
          subtitle="0522 guard protected"
          icon={ShieldCheck}
          color="blue"
        />
        <ReportKpiCard
          title="Top Template"
          value={report.mostUsedTemplateName || 'None'}
          subtitle="Most utilized pitch"
          icon={Award}
          color="purple"
        />
      </div>
    </div>
  );
};

export const AdminReportsView: React.FC = () => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<ReportTab>('LEADS');
  const tabRefs = useRef<Partial<Record<ReportTab, HTMLButtonElement | null>>>({});
  const [filters, setFilters] = useState<ReportFilterOptions>({
    datePreset: 'ALL_TIME',
    agentId: 'ALL',
    locality: 'ALL',
  });

  const [agents, setAgents] = useState<User[]>([]);
  const [localities, setLocalities] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [exportLoading, setExportLoading] = useState<boolean>(false);

  // Report States
  const [leadReport, setLeadReport] = useState<LeadReportData | null>(null);
  const [callReport, setCallReport] = useState<CallReportData | null>(null);
  const [productivityReport, setProductivityReport] = useState<AgentProductivityItem[]>([]);
  const [followUpReport, setFollowUpReport] = useState<FollowUpReportData | null>(null);
  const [whatsAppReport, setWhatsAppReport] = useState<WhatsAppReportData | null>(null);
  const [importReport, setImportReport] = useState<ImportReportData | null>(null);
  const [activityReport, setActivityReport] = useState<ActivityReportItem[]>([]);

  // Roving-tabindex keyboard support for the report tablist (F14).
  const handleTabKeyDown = (e: React.KeyboardEvent, id: ReportTab) => {
    const idx = TAB_ORDER.indexOf(id);
    let next: ReportTab | null = null;
    if (e.key === 'ArrowRight') next = TAB_ORDER[(idx + 1) % TAB_ORDER.length];
    else if (e.key === 'ArrowLeft') next = TAB_ORDER[(idx - 1 + TAB_ORDER.length) % TAB_ORDER.length];
    else if (e.key === 'Home') next = TAB_ORDER[0];
    else if (e.key === 'End') next = TAB_ORDER[TAB_ORDER.length - 1];
    if (next) {
      e.preventDefault();
      setActiveTab(next);
      tabRefs.current[next]?.focus();
    }
  };

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const db = getDatabase();
        const allAgents = await db.users
          .filter((u) => u.role === 'AGENT' && u.deletedAt === null)
          .toArray();
        setAgents(allAgents);

        const allLeads = await db.leads.filter((l) => l.deletedAt === null).toArray();
        const uniqueLocs = Array.from(
          new Set(allLeads.map((l) => l.locality).filter((loc): loc is string => Boolean(loc)))
        ).sort();
        setLocalities(uniqueLocs);
      } catch (err) {
        console.warn('Failed to load report metadata:', err);
      }
    };

    loadMetadata();
  }, []);

  const loadActiveReportData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'LEADS') {
        const data = await AdminReportsService.getLeadReport(currentUser, filters);
        setLeadReport(data);
      } else if (activeTab === 'CALLS') {
        const data = await AdminReportsService.getCallReport(currentUser, filters);
        setCallReport(data);
      } else if (activeTab === 'PRODUCTIVITY') {
        const data = await AdminReportsService.getAgentProductivityReport(currentUser, filters);
        setProductivityReport(data);
      } else if (activeTab === 'FOLLOW_UPS') {
        const data = await AdminReportsService.getFollowUpReport(currentUser, filters);
        setFollowUpReport(data);
      } else if (activeTab === 'WHATSAPP') {
        const data = await AdminReportsService.getWhatsAppReport(currentUser, filters);
        setWhatsAppReport(data);
      } else if (activeTab === 'IMPORTS') {
        const data = await AdminReportsService.getImportReport(currentUser, filters);
        setImportReport(data);
      } else if (activeTab === 'ACTIVITY') {
        const data = await AdminReportsService.getActivityReport(currentUser, filters);
        setActivityReport(data);
      }
    } catch (err) {
      console.warn('Failed to load report tab %s:', activeTab, err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, filters, currentUser]);

  useEffect(() => {
    loadActiveReportData();

    // Listen for realtime events to do non-disruptive refresh
    const unsubActivity = RealtimeService.onActivity(() => {
      loadActiveReportData();
    });
    const unsubEntity = RealtimeService.onEntityChange(() => {
      loadActiveReportData();
    });

    return () => {
      unsubActivity();
      unsubEntity();
    };
  }, [loadActiveReportData]);

  const handleExportCSV = async () => {
    setExportLoading(true);
    try {
      let exportType: 'LEADS' | 'CALLS' | 'AGENTS' | 'FOLLOW_UPS' | 'ACTIVITIES' = 'LEADS';
      if (activeTab === 'CALLS') exportType = 'CALLS';
      else if (activeTab === 'PRODUCTIVITY') exportType = 'AGENTS';
      else if (activeTab === 'FOLLOW_UPS') exportType = 'FOLLOW_UPS';
      else if (activeTab === 'ACTIVITY') exportType = 'ACTIVITIES';

      const csvContent = await AdminReportsService.exportReportToCSV(currentUser, exportType, filters);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `amaratv_report_${activeTab.toLowerCase()}_${new Date().toISOString().substring(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('CSV Export failed:', err);
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="space-y-5 pb-12 font-sans text-ink">
      {/* Header */}
      <div className="p-5 bg-surface rounded-3xl border border-accent/30 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-accent-text">
            <BarChart3 className="w-4 h-4" aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-wider">Territory Reports</span>
          </div>
          <h2 className="text-xl font-black text-ink mt-0.5">Analytics &amp; Reporting</h2>
          <p className="text-xs text-soft">
            Organization intelligence, verified talk times, and sales conversion ratios.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-success-soft text-success-text border border-success font-bold text-xs flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" aria-hidden="true" />
            <span>Dexie Indexed Aggregation</span>
          </span>
        </div>
      </div>

      {/* Report Category Navigation Tabs */}
      <div
        role="tablist"
        aria-label="Report categories"
        className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none"
      >
        {TAB_ORDER.map((tabId) => {
          const { label, icon: Icon } = TAB_META[tabId];
          const isActive = activeTab === tabId;
          return (
            <button
              key={tabId}
              ref={(el) => {
                tabRefs.current[tabId] = el;
              }}
              type="button"
              role="tab"
              id={`report-tab-${tabId.toLowerCase()}`}
              aria-selected={isActive}
              aria-controls={`report-panel-${tabId.toLowerCase()}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(tabId)}
              onKeyDown={(e) => handleTabKeyDown(e, tabId)}
              className={`min-h-11 py-2 px-3 rounded-xl font-bold text-sm flex items-center gap-1.5 whitespace-nowrap transition-all active:scale-95 ${
                isActive
                  ? 'bg-accent text-on-accent shadow-md'
                  : 'bg-surface border border-line text-soft hover:text-ink hover:bg-inset'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      <ReportFilterBar
        filters={filters}
        agents={agents}
        localities={localities}
        onFilterChange={(newF) => setFilters((prev) => ({ ...prev, ...newF }))}
        onExportCSV={handleExportCSV}
        exportLoading={exportLoading}
      />

      {/* Report Content Body */}
      {loading ? (
        <div className="py-16 text-center text-sm text-soft" role="status">
          <Clock className="w-6 h-6 animate-pulse mx-auto mb-2 text-accent-text" aria-hidden="true" />
          Computing report metrics from Dexie database...
        </div>
      ) : (
        <div
          role="tabpanel"
          id={`report-panel-${activeTab.toLowerCase()}`}
          aria-labelledby={`report-tab-${activeTab.toLowerCase()}`}
        >
          {/* 1. LEAD REPORT */}
          <LeadReportSection active={activeTab === 'LEADS'} report={leadReport} />

          {/* 2. CALL REPORT */}
          <CallReportSection active={activeTab === 'CALLS'} report={callReport} />

          {/* 3. AGENT PRODUCTIVITY REPORT */}
          {activeTab === 'PRODUCTIVITY' && (
            <div className="space-y-3">
              {productivityReport.length === 0 ? (
                <div className="py-12 text-center text-sm text-faint">
                  No agent productivity records found.
                </div>
              ) : (
                productivityReport.map((agent) => (
                  <div
                    key={agent.agentId}
                    className="p-4 bg-surface border border-line rounded-2xl shadow-md space-y-3"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-line">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-accent-soft text-accent-text flex items-center justify-center font-bold text-xs">
                          {agent.agentName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-ink">{agent.agentName}</h4>
                          <p className="text-xs text-soft">{agent.email}</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-accent-soft text-accent-text text-xs font-bold">
                        {agent.conversionRatePercentage}% Converted
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                      <div className="p-2 bg-inset rounded-xl">
                        <span className="text-xs uppercase font-bold text-soft block">Assigned</span>
                        <span className="text-sm font-black text-ink">{agent.leadsAssigned}</span>
                      </div>
                      <div className="p-2 bg-inset rounded-xl">
                        <span className="text-xs uppercase font-bold text-soft block">Calls</span>
                        <span className="text-sm font-black text-ink">
                          {agent.callsMade} (✓{agent.verifiedCalls})
                        </span>
                      </div>
                      <div className="p-2 bg-inset rounded-xl">
                        <span className="text-xs uppercase font-bold text-soft block">Talk Time</span>
                        <span className="text-sm font-black text-accent-text">
                          {formatSeconds(agent.verifiedTalkTimeSeconds)}
                        </span>
                      </div>
                      <div className="p-2 bg-inset rounded-xl">
                        <span className="text-xs uppercase font-bold text-soft block">Follow-ups</span>
                        <span className="text-sm font-black text-success-text">{agent.followUpsCompleted}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 4. FOLLOW-UP REPORT */}
          <FollowUpReportSection active={activeTab === 'FOLLOW_UPS'} report={followUpReport} />

          {/* 5. WHATSAPP REPORT */}
          <WhatsAppReportSection active={activeTab === 'WHATSAPP'} report={whatsAppReport} />

          {/* 6. IMPORT REPORT */}
          {activeTab === 'IMPORTS' && importReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <ReportKpiCard
                  title="Import Batches"
                  value={importReport.totalImports}
                  subtitle="Excel / CSV files"
                  icon={FileSpreadsheet}
                  color="purple"
                />
                <ReportKpiCard
                  title="Leads Ingested"
                  value={importReport.totalLeadsImported}
                  subtitle="Database rows"
                  icon={TrendingUp}
                  color="emerald"
                />
                <ReportKpiCard
                  title="Duplicates Handled"
                  value={importReport.totalDuplicatesSkipped}
                  subtitle="Idempotently skipped"
                  icon={ShieldCheck}
                  color="amber"
                />
              </div>

              {/* Import List */}
              <div className="p-4 bg-surface border border-line rounded-2xl shadow-md space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-soft">
                  Spreadsheet Ingestion Audit History
                </h3>
                {importReport.importsList.length === 0 ? (
                  <p className="text-sm text-faint text-center py-4">No import audit records recorded.</p>
                ) : (
                  importReport.importsList.map((imp) => (
                    <div
                      key={imp.id}
                      className="p-3 bg-inset rounded-xl flex items-center justify-between text-sm"
                    >
                      <div>
                        <span className="font-bold text-ink block">{imp.filename}</span>
                        <span className="text-xs text-soft">By {imp.uploadedByName}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-success-text">+{imp.imported} leads</span>
                        <span className="text-xs text-faint block">
                          {imp.completedAt ? new Date(imp.completedAt).toLocaleDateString() : 'In progress'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 7. ACTIVITY AUDIT STREAM */}
          {activeTab === 'ACTIVITY' && (
            <div className="p-4 bg-surface border border-line rounded-2xl shadow-md space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-soft">
                Chronological CRM Activity Stream
              </h3>
              {activityReport.length === 0 ? (
                <p className="text-sm text-faint text-center py-4">
                  No activity records match the filter.
                </p>
              ) : (
                activityReport.map((act) => (
                  <div
                    key={act.id}
                    className="py-2.5 border-b border-line last:border-0 flex items-start justify-between gap-3 text-sm"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-accent-text">{act.actorName}</span>
                        <span className="px-1.5 py-0.5 rounded text-xs font-bold uppercase bg-inset text-soft">
                          {act.activityType.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {act.leadName && <p className="text-xs text-soft mt-0.5">Lead: {act.leadName}</p>}
                    </div>
                    <span className="text-xs text-faint shrink-0">
                      {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
