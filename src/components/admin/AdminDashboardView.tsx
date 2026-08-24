/**
 * Admin Dashboard View (Phase 2L)
 * Executive Command Center displaying real-time organization KPIs, sales
 * pipeline visualizer, sales representative performance scorecards, and live
 * sales activity feed.
 * Rewritten for design tokens, button semantics on KPI/pipeline cards (F3),
 * and a visible error state with retry (F4).
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Users,
  PhoneCall,
  Calendar,
  Clock,
  AlertCircle,
  TrendingUp,
  ArrowRight,
  Filter,
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

const formatSeconds = (seconds: number) => {
  if (!seconds || seconds <= 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

/** Data-viz colour for each pipeline stage bar. */
const stageBarColor = (status: LeadStatus) => {
  if (status === 'CUSTOMER') return 'bg-success';
  if (status === 'NOT_INTERESTED' || status === 'DO_NOT_CONTACT' || status === 'WRONG_NUMBER')
    return 'bg-danger';
  if (status === 'INTERESTED' || status === 'SAMPLE_REQUESTED' || status === 'NEGOTIATION')
    return 'bg-accent';
  if (status === 'FOLLOW_UP') return 'bg-warning';
  return 'bg-info';
};

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
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modals
  const [selectedAgentDetailId, setSelectedAgentDetailId] = useState<string | null>(null);
  const [isCallHistoryOpen, setIsCallHistoryOpen] = useState<boolean>(false);

  const loadAgents = useCallback(async () => {
    try {
      const db = getDatabase();
      const agents = await db.users
        .filter((u) => u.role === 'AGENT' && u.deletedAt === null)
        .toArray();
      setAgentsList(agents);
    } catch (err) {
      console.warn('Failed to load agents for dashboard filter:', err);
    }
  }, []);

  const loadDashboardData = useCallback(async () => {
    setLoadError(null);
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
      setLoadError('Could not load dashboard analytics. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [currentUser, dateRange, selectedAgentId]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

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
  }, [loadDashboardData]);

  return (
    <div className="space-y-6 pb-8 font-sans">
      {/* 1. Header & Quick Action Card */}
      <div className="p-5 bg-surface rounded-3xl border border-accent/30 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-accent-text">
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              <span className="text-xs font-bold uppercase tracking-wider">Executive Overview</span>
            </div>
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="Amaratv Krishi Logo"
                className="w-10 h-10 object-contain bg-white rounded-xl p-1 shadow-md flex-shrink-0"
              />
              <div>
                <h2 className="text-xl font-black text-ink mt-0.5">Amaratv Krishi Field CRM</h2>
                <p className="text-xs text-soft">
                  Welcome, <span className="text-ink font-semibold">{currentUser?.name}</span>. Real-time territory sales command.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onEnterSalesMode}
              className="min-h-11 py-2.5 px-4 rounded-xl bg-accent hover:bg-accent-hover text-on-accent font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98"
            >
              <PhoneCall className="w-4 h-4" aria-hidden="true" />
              <span>Sales Mode</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => setIsCallHistoryOpen(true)}
              className="min-h-11 py-2.5 px-3.5 rounded-xl bg-inset hover:bg-inset-strong text-accent-text border border-accent/40 font-bold text-sm flex items-center justify-center gap-1.5 transition active:scale-98"
            >
              <Clock className="w-4 h-4" aria-hidden="true" />
              <span>Call History</span>
            </button>
          </div>
        </div>

        {/* Global Dashboard Filter Bar */}
        <div className="pt-2 border-t border-line flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-faint" aria-hidden="true" />
            <span className="text-sm text-soft font-semibold">Filters:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="dashboard-date-range" className="sr-only">
              Date range
            </label>
            <select
              id="dashboard-date-range"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DashboardDateRange)}
              className="min-h-11 bg-inset border border-line rounded-xl px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-focus-ring"
            >
              <option value="ALL_TIME">All Time</option>
              <option value="TODAY">Today</option>
              <option value="YESTERDAY">Yesterday</option>
              <option value="LAST_7_DAYS">Last 7 Days</option>
              <option value="LAST_30_DAYS">Last 30 Days</option>
            </select>

            <label htmlFor="dashboard-agent" className="sr-only">
              Representative
            </label>
            <select
              id="dashboard-agent"
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="min-h-11 bg-inset border border-line rounded-xl px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-focus-ring"
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

      {/* Load failure banner (F4) */}
      {loadError && (
        <div
          role="alert"
          className="p-4 bg-danger-soft border border-danger rounded-2xl flex items-start justify-between gap-3"
        >
          <div className="flex items-start gap-2 min-w-0">
            <AlertCircle className="w-5 h-5 text-danger-text flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-danger-text font-medium">{loadError}</p>
          </div>
          <button
            type="button"
            onClick={loadDashboardData}
            className="min-h-11 px-4 rounded-xl bg-danger hover:opacity-90 text-on-accent text-sm font-bold transition-colors flex-shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. Executive KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Leads */}
        <button
          type="button"
          onClick={() => onNavigateToLeads()}
          className="p-4 bg-surface border border-line hover:border-info rounded-2xl shadow-md transition-all active:scale-98 group text-left"
        >
          <div className="flex items-center justify-between text-xs text-soft mb-1">
            <span className="font-semibold uppercase tracking-wider">Total Leads</span>
            <UserPlus className="w-4 h-4 text-info" aria-hidden="true" />
          </div>
          <div className="text-2xl font-black text-ink group-hover:text-info transition">
            {kpis?.leads.total || 0}
          </div>
          <div className="text-xs text-soft mt-1 flex justify-between">
            <span>{kpis?.leads.assigned || 0} assigned</span>
            <span className="text-warning-text font-bold">{kpis?.leads.unassigned || 0} unassigned</span>
          </div>
        </button>

        {/* Calls */}
        <button
          type="button"
          onClick={() => setIsCallHistoryOpen(true)}
          className="p-4 bg-surface border border-line hover:border-success rounded-2xl shadow-md transition-all active:scale-98 group text-left"
        >
          <div className="flex items-center justify-between text-xs text-soft mb-1">
            <span className="font-semibold uppercase tracking-wider">Total Calls</span>
            <PhoneCall className="w-4 h-4 text-success-text" aria-hidden="true" />
          </div>
          <div className="text-2xl font-black text-ink group-hover:text-success-text transition">
            {kpis?.calls.total || 0}
          </div>
          <div className="text-xs text-soft mt-1 flex justify-between">
            <span className="text-success-text font-semibold">{kpis?.calls.verified || 0} verified</span>
            <span>{kpis?.calls.unverified || 0} unverified</span>
          </div>
        </button>

        {/* Verified Talk Time */}
        <div className="p-4 bg-surface border border-line rounded-2xl shadow-md">
          <div className="flex items-center justify-between text-xs text-soft mb-1">
            <span className="font-semibold uppercase tracking-wider">Verified Talk Time</span>
            <Clock className="w-4 h-4 text-accent-text" aria-hidden="true" />
          </div>
          <div className="text-2xl font-black text-accent-text">
            {formatSeconds(kpis?.calls.verifiedTalkTimeSeconds || 0)}
          </div>
          <div className="text-xs text-soft mt-1">
            Avg: {formatSeconds(kpis?.calls.averageVerifiedDurationSeconds || 0)} / verified call
          </div>
        </div>

        {/* Follow-ups */}
        <div className="p-4 bg-surface border border-line rounded-2xl shadow-md">
          <div className="flex items-center justify-between text-xs text-soft mb-1">
            <span className="font-semibold uppercase tracking-wider">Follow-ups</span>
            <Calendar className="w-4 h-4 text-warning-text" aria-hidden="true" />
          </div>
          <div className="text-2xl font-black text-ink">
            {(kpis?.followUps.today || 0) + (kpis?.followUps.upcoming || 0)}
          </div>
          <div className="text-xs text-soft mt-1 flex justify-between">
            <span className="text-warning-text font-bold">{kpis?.followUps.today || 0} today</span>
            {kpis?.followUps.overdue ? (
              <span className="text-danger-text font-bold">{kpis.followUps.overdue} overdue</span>
            ) : (
              <span className="text-success-text font-semibold">{kpis?.followUps.completed || 0} done</span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Lead Pipeline Visualizer */}
      <div className="p-5 bg-surface border border-line rounded-3xl shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent-text" aria-hidden="true" />
            <h3 className="font-bold text-sm text-ink uppercase tracking-wider">
              Sales Pipeline Stage Distribution
            </h3>
          </div>
          <span className="text-xs text-faint">Tap stage to view leads</span>
        </div>

        <div className="space-y-2.5">
          {pipeline.map((stage) => (
            <button
              key={stage.status}
              type="button"
              onClick={() => onNavigateToLeads(stage.status, selectedAgentId)}
              aria-label={`View ${stage.label} leads (${stage.count})`}
              className="w-full p-2.5 bg-inset hover:bg-inset-strong border border-line rounded-2xl transition group text-left"
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-bold text-ink group-hover:text-accent-text transition">
                  {stage.label}
                </span>
                <span className="font-black text-ink">
                  {stage.count}{' '}
                  <span className="text-xs text-faint font-normal">({stage.percentage}%)</span>
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 bg-inset-strong rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${stageBarColor(stage.status)}`}
                  style={{ width: `${Math.max(4, stage.percentage)}%` }}
                />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 4. Sales Representative Performance */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-accent-text" aria-hidden="true" />
            <h3 className="font-bold text-sm text-ink uppercase tracking-wider">
              Representative Performance Scorecards
            </h3>
          </div>

          <button
            type="button"
            onClick={onNavigateToAgents}
            className="min-h-11 text-sm text-accent-text hover:opacity-80 font-semibold flex items-center gap-1"
          >
            <span>Manage Accounts</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
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
        <AdminCallHistoryModal isOpen={true} onClose={() => setIsCallHistoryOpen(false)} />
      )}
    </div>
  );
};
