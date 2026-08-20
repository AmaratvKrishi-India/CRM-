/**
 * Admin Reports View (Phase 2M)
 * Comprehensive Analytics & Reporting command center for administrators.
 * Supports Lead Reports, Call Volume & Verified Talk Time, Agent Productivity,
 * Follow-up Completion, WhatsApp Engagement, Import Audits, and sanitized CSV Exports.
 */

import React, { useState, useEffect } from 'react';
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
  Download,
  Flame,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  AdminReportsService,
  ReportFilterOptions,
  LeadReportData,
  CallReportData,
  AgentProductivityItem,
  FollowUpReportData,
  WhatsAppReportData,
  ImportReportData,
  ActivityReportItem,
} from '../../services/adminReportsService';
import { ReportKpiCard } from './reports/ReportKpiCard';
import { ReportFilterBar } from './reports/ReportFilterBar';
import { RealtimeService } from '../../services/realtime/realtimeService';
import { User, LeadStatus } from '../../db/types';
import { getDatabase } from '../../db/database';

export type ReportTab =
  | 'LEADS'
  | 'CALLS'
  | 'PRODUCTIVITY'
  | 'FOLLOW_UPS'
  | 'WHATSAPP'
  | 'IMPORTS'
  | 'ACTIVITY';

export const AdminReportsView: React.FC = () => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<ReportTab>('LEADS');
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

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const db = getDatabase();
        const allAgents = await db.users.filter((u) => u.role === 'AGENT' && u.deletedAt === null).toArray();
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

  const loadActiveReportData = async () => {
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
      console.warn(`Failed to load ${activeTab} report:`, err);
    } finally {
      setLoading(false);
    }
  };

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
  }, [activeTab, filters, currentUser]);

  const formatSeconds = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

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
      link.setAttribute('download', `amaratv_report_${activeTab.toLowerCase()}_${new Date().toISOString().substring(0, 10)}.csv`);
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
    <div className="space-y-5 pb-12 font-sans text-white">
      {/* Header */}
      <div className="p-5 bg-gradient-to-r from-purple-950/50 via-slate-900 to-slate-900 rounded-3xl border border-purple-500/20 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-purple-400">
            <BarChart3 className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Territory Reports</span>
          </div>
          <h2 className="text-xl font-black text-white mt-0.5">Analytics & Reporting</h2>
          <p className="text-xs text-slate-400">
            Organization intelligence, verified talk times, and sales conversion ratios.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-xs flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Dexie Indexed Aggregation</span>
          </span>
        </div>
      </div>

      {/* Report Category Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'LEADS', label: 'Leads', icon: TrendingUp },
          { id: 'CALLS', label: 'Calls', icon: PhoneCall },
          { id: 'PRODUCTIVITY', label: 'Productivity', icon: Award },
          { id: 'FOLLOW_UPS', label: 'Follow-ups', icon: Calendar },
          { id: 'WHATSAPP', label: 'WhatsApp', icon: MessageSquare },
          { id: 'IMPORTS', label: 'Imports', icon: FileSpreadsheet },
          { id: 'ACTIVITY', label: 'Activity Log', icon: ActivityIcon },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as ReportTab)}
              className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center gap-1.5 whitespace-nowrap transition-all active:scale-95 ${
                isActive
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
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
        <div className="py-16 text-center text-xs text-slate-400">
          <Clock className="w-6 h-6 animate-pulse mx-auto mb-2 text-purple-400" />
          Computing report metrics from Dexie database...
        </div>
      ) : (
        <>
          {/* 1. LEAD REPORT */}
          {activeTab === 'LEADS' && leadReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <ReportKpiCard
                  title="Total Leads"
                  value={leadReport.totalLeads}
                  subtitle={`${leadReport.assignedLeads} Assigned`}
                  icon={TrendingUp}
                  color="blue"
                />
                <ReportKpiCard
                  title="Converted Customers"
                  value={leadReport.convertedCustomers}
                  subtitle={`${leadReport.conversionPercentage}% Conversion Rate`}
                  icon={Award}
                  color="emerald"
                />
                <ReportKpiCard
                  title="New Leads"
                  value={leadReport.statusBreakdown.NEW}
                  subtitle="Awaiting first contact"
                  icon={Flame}
                  color="purple"
                />
                <ReportKpiCard
                  title="Unassigned Leads"
                  value={leadReport.unassignedLeads}
                  subtitle="Territory pool"
                  icon={Users}
                  color="amber"
                />
              </div>

              {/* Status Breakdown Table */}
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-md space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Lead Status Distribution
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(leadReport.statusBreakdown).map(([status, count]) => (
                    <div key={status} className="p-2.5 bg-slate-800/60 rounded-xl border border-slate-700/40 text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block truncate">
                        {status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-base font-black text-white">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 2. CALL REPORT */}
          {activeTab === 'CALLS' && callReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <ReportKpiCard
                  title="Total Calls"
                  value={callReport.totalCalls}
                  subtitle={`${callReport.verifiedCalls} Verified`}
                  icon={PhoneCall}
                  color="emerald"
                />
                <ReportKpiCard
                  title="Verified Talk Time"
                  value={formatSeconds(callReport.verifiedTalkTimeSeconds)}
                  subtitle="Zero fake duration"
                  icon={Clock}
                  color="purple"
                />
                <ReportKpiCard
                  title="Avg Verified Duration"
                  value={formatSeconds(callReport.averageVerifiedDurationSeconds)}
                  subtitle="Per verified connection"
                  icon={CheckCircle2}
                  color="blue"
                />
                <ReportKpiCard
                  title="Longest Call"
                  value={formatSeconds(callReport.longestVerifiedDurationSeconds)}
                  subtitle="Top duration"
                  icon={Award}
                  color="amber"
                />
              </div>

              {/* Outcome Breakdown */}
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-md space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Call Outcome Distribution
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(callReport.callsByOutcome).map(([outcome, count]) => (
                    <div key={outcome} className="p-2.5 bg-slate-800/60 rounded-xl border border-slate-700/40 text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block truncate">
                        {outcome.replace(/_/g, ' ')}
                      </span>
                      <span className="text-base font-black text-white">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Talk Time by Agent */}
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-md space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Verified Talk Time by Sales Representative
                </h3>
                <div className="space-y-2">
                  {callReport.talkTimeByAgent.map((stat) => (
                    <div key={stat.agentId} className="p-3 bg-slate-800/50 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-white block">{stat.agentName}</span>
                        <span className="text-[11px] text-slate-400">
                          Avg: {formatSeconds(stat.avgVerifiedDurationSeconds)}
                        </span>
                      </div>
                      <span className="font-black text-purple-300 text-sm">
                        {formatSeconds(stat.verifiedTalkTimeSeconds)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 3. AGENT PRODUCTIVITY REPORT */}
          {activeTab === 'PRODUCTIVITY' && (
            <div className="space-y-3">
              {productivityReport.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">No agent productivity records found.</div>
              ) : (
                productivityReport.map((agent) => (
                  <div key={agent.agentId} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-md space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs">
                          {agent.agentName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-white">{agent.agentName}</h4>
                          <p className="text-[11px] text-slate-400">{agent.email}</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold">
                        {agent.conversionRatePercentage}% Converted
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                      <div className="p-2 bg-slate-800/50 rounded-xl">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Assigned</span>
                        <span className="text-sm font-black text-white">{agent.leadsAssigned}</span>
                      </div>
                      <div className="p-2 bg-slate-800/50 rounded-xl">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Calls</span>
                        <span className="text-sm font-black text-white">{agent.callsMade} (✓{agent.verifiedCalls})</span>
                      </div>
                      <div className="p-2 bg-slate-800/50 rounded-xl">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Talk Time</span>
                        <span className="text-sm font-black text-purple-300">
                          {formatSeconds(agent.verifiedTalkTimeSeconds)}
                        </span>
                      </div>
                      <div className="p-2 bg-slate-800/50 rounded-xl">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Follow-ups</span>
                        <span className="text-sm font-black text-emerald-400">{agent.followUpsCompleted}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 4. FOLLOW-UP REPORT */}
          {activeTab === 'FOLLOW_UPS' && followUpReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <ReportKpiCard
                  title="Total Follow-ups"
                  value={followUpReport.totalFollowUps}
                  subtitle={`${followUpReport.completionPercentage}% Completed`}
                  icon={Calendar}
                  color="blue"
                />
                <ReportKpiCard
                  title="Completed"
                  value={followUpReport.completed}
                  subtitle="Successfully concluded"
                  icon={CheckCircle2}
                  color="emerald"
                />
                <ReportKpiCard
                  title="Today's Reminders"
                  value={followUpReport.today}
                  subtitle="Action required"
                  icon={Flame}
                  color="amber"
                />
                <ReportKpiCard
                  title="Overdue"
                  value={followUpReport.overdue}
                  subtitle={`${followUpReport.overduePercentage}% Overdue`}
                  icon={AlertCircle}
                  color="rose"
                />
              </div>
            </div>
          )}

          {/* 5. WHATSAPP REPORT */}
          {activeTab === 'WHATSAPP' && whatsAppReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <ReportKpiCard
                  title="WhatsApp Initiated"
                  value={whatsAppReport.totalInitiated}
                  subtitle="Templates dispatched"
                  icon={MessageSquare}
                  color="emerald"
                />
                <ReportKpiCard
                  title="Landlines Guarded"
                  value={whatsAppReport.landlinePreventedCount}
                  subtitle="0522 guard protected"
                  icon={ShieldCheck}
                  color="blue"
                />
                <ReportKpiCard
                  title="Top Template"
                  value={whatsAppReport.mostUsedTemplateName || 'None'}
                  subtitle="Most utilized pitch"
                  icon={Award}
                  color="purple"
                />
              </div>
            </div>
          )}

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
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-md space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Spreadsheet Ingestion Audit History
                </h3>
                {importReport.importsList.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">No import audit records recorded.</p>
                ) : (
                  importReport.importsList.map((imp) => (
                    <div key={imp.id} className="p-3 bg-slate-800/50 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-white block">{imp.filename}</span>
                        <span className="text-[11px] text-slate-400">By {imp.uploadedByName}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-emerald-400">+{imp.imported} leads</span>
                        <span className="text-[10px] text-slate-500 block">
                          {new Date(imp.completedAt).toLocaleDateString()}
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
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-md space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Chronological CRM Activity Stream
              </h3>
              {activityReport.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No activity records match the filter.</p>
              ) : (
                activityReport.map((act) => (
                  <div key={act.id} className="py-2.5 border-b border-slate-800/60 last:border-0 flex items-start justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-purple-300">{act.actorName}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                          {act.activityType.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {act.leadName && <p className="text-[11px] text-slate-400 mt-0.5">Lead: {act.leadName}</p>}
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
