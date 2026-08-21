/**
 * Admin Dashboard View (Phase 2L)
 * Executive Command Center displaying real-time organization KPIs, sales pipeline visualizer,
 * sales representative performance scorecards, and live sales activity feed.
 */

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Users,
  PhoneCall,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  MessageSquare,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  Filter,
  BarChart3,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  AdminAnalyticsService,
  DashboardDateRange,
  OrganisationKPIs,
  PipelineStageMetric,
  AgentPerformanceSummary,
} from '../../services/adminAnalyticsService';
import { AgentPerformanceTable } from './AgentPerformanceTable';
import { AgentPerformanceDetail } from './AgentPerformanceDetail';
import { AdminCallHistoryModal } from './AdminCallHistoryModal';
import { LiveActivityFeed } from './LiveActivityFeed';
import { RealtimeService } from '../../services/realtime/realtimeService';
import { User, LeadStatus } from '../../db/types';
import { getDatabase } from '../../db/database';

interface AdminDashboardViewProps {
  onEnterSalesMode: () => void;
  onNavigateToLeads: (statusFilter?: LeadStatus, agentFilter?: string) => void;
  onNavigateToAgents: () => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  onEnterSalesMode,
  onNavigateToLeads,
  onNavigateToAgents,
}) => {
  const { currentUser } = useAuth();

  // Filters
  const [dateRange, setDateRange] = useState<DashboardDateRange>('ALL_TIME');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('ALL');
  const [agentsList, setAgentsList] = useState<User[]>([]);

  // State
  const [kpis, setKpis] = useState<OrganisationKPIs | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStageMetric[]>([]);
  const [agentPerformance, setAgentPerformance] = useState<AgentPerformanceSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals
  const [selectedAgentDetailId, setSelectedAgentDetailId] = useState<string | null>(null);
  const [isCallHistoryOpen, setIsCallHistoryOpen] = useState<boolean>(false);

  const loadAgents = async () => {
    try {
      const db = getDatabase();
      const agents = await db.users.filter((u) => u.role === 'AGENT' && u.deletedAt === null).toArray();
      setAgentsList(agents);
    } catch (err) {
      console.warn('Failed to load agents for dashboard filter:', err);
    }
  };

  const loadDashboardData = async () => {
    try {
      const [kpiData, pipelineData, agentData] = await Promise.all([
        AdminAnalyticsService.getOrganisationKPIs(currentUser, dateRange, selectedAgentId),
        AdminAnalyticsService.getLeadPipelineSummary(currentUser, dateRange, selectedAgentId),
        AdminAnalyticsService.getAgentPerformanceList(currentUser, dateRange),
      ]);

      setKpis(kpiData);
      setPipeline(pipelineData);
      setAgentPerformance(agentData);
    } catch (err) {
      console.warn('Failed to load dashboard analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    loadDashboardData();

    // Listen for incoming realtime activities / entity changes to do targeted KPI refreshes
    const unsubActivity = RealtimeService.onActivity(() => {
      loadDashboardData();
    });

    const unsubEntity = RealtimeService.onEntityChange(() => {
      loadDashboardData();
    });

    return () => {
      unsubActivity();
      unsubEntity();
    };
  }, [dateRange, selectedAgentId, currentUser]);

  const formatSeconds = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div className="space-y-6 pb-8 font-sans">
      {/* 1. Header & Quick Action Card */}
      <div className="p-5 bg-gradient-to-r from-purple-950/50 via-slate-900 to-slate-900 rounded-3xl border border-purple-500/20 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-purple-400">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Executive Overview</span>
            </div>
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Amaratv Krishi Logo" className="w-10 h-10 object-contain bg-white rounded-xl p-1 shadow-md shadow-emerald-500/10 flex-shrink-0" />
              <div>
                <h2 className="text-xl font-black text-white mt-0.5">Amaratv Krishi Field CRM</h2>
                <p className="text-xs text-slate-400">
                  Welcome, <span className="text-slate-200 font-semibold">{currentUser?.name}</span>. Real-time territory sales command.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onEnterSalesMode}
              className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-98"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Sales Mode</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setIsCallHistoryOpen(true)}
              className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-98"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Call History</span>
            </button>
          </div>
        </div>

        {/* Global Dashboard Filter Bar */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 font-semibold">Filters:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Date Range Selector */}
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DashboardDateRange)}
              className="bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
            >
              <option value="ALL_TIME">All Time</option>
              <option value="TODAY">Today</option>
              <option value="YESTERDAY">Yesterday</option>
              <option value="LAST_7_DAYS">Last 7 Days</option>
              <option value="LAST_30_DAYS">Last 30 Days</option>
            </select>

            {/* Agent Selector */}
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
            >
              <option value="ALL">All Representatives</option>
              {agentsList.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. Executive KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Leads */}
        <div
          onClick={() => onNavigateToLeads()}
          className="p-4 bg-slate-900 border border-slate-800 hover:border-blue-500/40 rounded-2xl shadow-md cursor-pointer transition-all active:scale-98 group"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Total Leads</span>
            <UserPlus className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white group-hover:text-blue-300 transition">
            {kpis?.leads.total || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
            <span>{kpis?.leads.assigned || 0} assigned</span>
            <span className="text-amber-400 font-bold">{kpis?.leads.unassigned || 0} unassigned</span>
          </div>
        </div>

        {/* Calls */}
        <div
          onClick={() => setIsCallHistoryOpen(true)}
          className="p-4 bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-2xl shadow-md cursor-pointer transition-all active:scale-98 group"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Total Calls</span>
            <PhoneCall className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white group-hover:text-emerald-300 transition">
            {kpis?.calls.total || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
            <span className="text-emerald-400 font-semibold">{kpis?.calls.verified || 0} verified</span>
            <span>{kpis?.calls.unverified || 0} unverified</span>
          </div>
        </div>

        {/* Verified Talk Time */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Verified Talk Time</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-300">
            {formatSeconds(kpis?.calls.verifiedTalkTimeSeconds || 0)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Avg: {formatSeconds(kpis?.calls.averageVerifiedDurationSeconds || 0)} / verified call
          </div>
        </div>

        {/* Follow-ups */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Follow-ups</span>
            <Calendar className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {(kpis?.followUps.today || 0) + (kpis?.followUps.upcoming || 0)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
            <span className="text-amber-400 font-bold">{kpis?.followUps.today || 0} today</span>
            {kpis?.followUps.overdue ? (
              <span className="text-rose-400 font-bold">{kpis.followUps.overdue} overdue</span>
            ) : (
              <span className="text-emerald-400 font-semibold">{kpis?.followUps.completed || 0} done</span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Lead Pipeline Visualizer */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            <h3 className="font-bold text-sm text-white uppercase tracking-wider">
              Sales Pipeline Stage Distribution
            </h3>
          </div>
          <span className="text-xs text-slate-400">Tap stage to view leads</span>
        </div>

        <div className="space-y-2.5">
          {pipeline.map((stage) => (
            <div
              key={stage.status}
              onClick={() => onNavigateToLeads(stage.status, selectedAgentId)}
              className="p-2.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 rounded-2xl cursor-pointer transition group"
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-bold text-slate-200 group-hover:text-purple-300 transition">
                  {stage.label}
                </span>
                <span className="font-black text-white">
                  {stage.count} <span className="text-[10px] text-slate-400 font-normal">({stage.percentage}%)</span>
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 bg-slate-700/60 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    stage.status === 'CUSTOMER'
                      ? 'bg-emerald-500'
                      : stage.status === 'NOT_INTERESTED' || stage.status === 'DO_NOT_CONTACT' || stage.status === 'WRONG_NUMBER'
                      ? 'bg-rose-500'
                      : stage.status === 'INTERESTED' || stage.status === 'SAMPLE_REQUESTED' || stage.status === 'NEGOTIATION'
                      ? 'bg-purple-500'
                      : stage.status === 'FOLLOW_UP'
                      ? 'bg-amber-500'
                      : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.max(4, stage.percentage)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Sales Representative Performance */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" />
            <h3 className="font-bold text-sm text-white uppercase tracking-wider">
              Representative Performance Scorecards
            </h3>
          </div>

          <button
            onClick={onNavigateToAgents}
            className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1"
          >
            <span>Manage Accounts</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <AgentPerformanceTable
          agents={agentPerformance}
          loading={loading}
          onSelectAgent={(agentId) => setSelectedAgentDetailId(agentId)}
        />
      </div>

      {/* 5. Live Sales Activity Feed */}
      <LiveActivityFeed limit={30} showFilters={true} />

      {/* Modals */}
      {selectedAgentDetailId && (
        <AgentPerformanceDetail
          agentId={selectedAgentDetailId}
          isOpen={true}
          dateRange={dateRange}
          onClose={() => setSelectedAgentDetailId(null)}
          onViewLeadsForAgent={(agId) => {
            setSelectedAgentDetailId(null);
            onNavigateToLeads(undefined, agId);
          }}
        />
      )}

      {isCallHistoryOpen && (
        <AdminCallHistoryModal
          isOpen={true}
          onClose={() => setIsCallHistoryOpen(false)}
        />
      )}
    </div>
  );
};
