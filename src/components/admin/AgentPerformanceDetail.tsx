/**
 * Agent Performance Detail Component (Phase 2L)
 * Displays deep-dive productivity scorecards, verified call durations, assigned leads,
 * and recent sales activity for an individual sales representative.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  User as UserIcon,
  Phone,
  Mail,
  Calendar,
  Clock,
  PhoneCall,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  FileSpreadsheet,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { NativePlatformService } from '../../services/nativePlatform';
import {
  AdminAnalyticsService,
  AgentPerformanceSummary,
  DashboardDateRange,
} from '../../services/adminAnalyticsService';
import { Lead } from '../../db/types';

interface AgentPerformanceDetailProps {
  agentId: string;
  isOpen: boolean;
  dateRange?: DashboardDateRange;
  onClose: () => void;
  onViewLeadsForAgent: (agentId: string) => void;
}

export const AgentPerformanceDetail: React.FC<AgentPerformanceDetailProps> = ({
  agentId,
  isOpen,
  dateRange = 'ALL_TIME',
  onClose,
  onViewLeadsForAgent,
}) => {
  const { currentUser } = useAuth();
  const [summary, setSummary] = useState<AgentPerformanceSummary | null>(null);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [assignedLeads, setAssignedLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen || !agentId) return;

    const fetchDetail = async () => {
      setLoading(true);
      try {
        const res = await AdminAnalyticsService.getAgentPerformanceDetail(
          currentUser,
          agentId,
          dateRange
        );
        setSummary(res.summary);
        setRecentActivities(res.recentActivities);
        setAssignedLeads(res.assignedLeads);
      } catch (err) {
        console.warn('Failed to fetch agent performance detail:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [isOpen, agentId, dateRange, currentUser]);

  if (!isOpen) return null;

  const formatSeconds = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const handleCallAgent = () => {
    if (summary?.phone) {
      NativePlatformService.openDialer(summary.phone);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans text-white">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold text-base shrink-0">
              {summary?.agentName?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white truncate">
                  {summary?.agentName || 'Sales Agent'}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    summary?.status === 'ACTIVE'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {summary?.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate">{summary?.email}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Loading sales representative analytics...
            </div>
          ) : !summary ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Representative details could not be found.
            </div>
          ) : (
            <>
              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleCallAgent}
                  className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition active:scale-98"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call Agent ({summary.phone || 'N/A'})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onViewLeadsForAgent(agentId);
                  }}
                  className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition active:scale-98"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>View Assigned Leads ({assignedLeads.length})</span>
                </button>
              </div>

              {/* Performance Metric Scorecard Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {/* Calls */}
                <div className="p-3 bg-slate-800/60 rounded-2xl border border-slate-700/50">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                    <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Total Calls</span>
                  </div>
                  <div className="text-lg font-black text-white">{summary.callsTotal}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    <span className="text-emerald-400 font-bold">{summary.callsVerified} verified</span> •{' '}
                    <span>{summary.callsUnverified} unverified</span>
                  </div>
                </div>

                {/* Talk Time */}
                <div className="p-3 bg-slate-800/60 rounded-2xl border border-slate-700/50">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                    <Clock className="w-3.5 h-3.5 text-purple-400" />
                    <span>Verified Talk Time</span>
                  </div>
                  <div className="text-lg font-black text-purple-300">
                    {formatSeconds(summary.verifiedTalkTimeSeconds)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Avg: {formatSeconds(summary.averageVerifiedDurationSeconds)}
                  </div>
                </div>

                {/* Leads Worked */}
                <div className="p-3 bg-slate-800/60 rounded-2xl border border-slate-700/50">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                    <UserIcon className="w-3.5 h-3.5 text-blue-400" />
                    <span>Leads Assigned</span>
                  </div>
                  <div className="text-lg font-black text-white">{summary.leadsAssigned}</div>
                  <div className="text-[11px] text-blue-400 mt-0.5 font-medium">
                    {summary.leadsWorked} leads worked
                  </div>
                </div>

                {/* Follow-ups */}
                <div className="p-3 bg-slate-800/60 rounded-2xl border border-slate-700/50">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    <span>Follow-ups</span>
                  </div>
                  <div className="text-lg font-black text-white">{summary.followUpsTotal}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {summary.followUpsCompleted} completed •{' '}
                    {summary.followUpsOverdue > 0 && (
                      <span className="text-rose-400 font-bold">{summary.followUpsOverdue} overdue</span>
                    )}
                  </div>
                </div>

                {/* WhatsApp */}
                <div className="p-3 bg-slate-800/60 rounded-2xl border border-slate-700/50">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                    <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                    <span>WhatsApp Pitch</span>
                  </div>
                  <div className="text-lg font-black text-white">{summary.whatsappInitiated}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Messages initiated</div>
                </div>

                {/* Account Details */}
                <div className="p-3 bg-slate-800/60 rounded-2xl border border-slate-700/50">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                    <span>Last Login</span>
                  </div>
                  <div className="text-xs font-bold text-slate-300">
                    {summary.lastLoginAt ? new Date(summary.lastLoginAt).toLocaleDateString() : 'Never'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 truncate">{summary.phone}</div>
                </div>
              </div>

              {/* Recent Activity Stream for this Agent */}
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Recent Representative Activity
                </h4>

                <div className="bg-slate-800/40 rounded-2xl border border-slate-800 p-3 divide-y divide-slate-800/60 max-h-56 overflow-y-auto">
                  {recentActivities.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4">No recent activity recorded.</p>
                  ) : (
                    recentActivities.map((act) => (
                      <div key={act.id} className="py-2 text-xs flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-200">
                            {act.activityType.replace(/_/g, ' ')}
                          </span>
                          {act.metadata?.leadName && (
                            <p className="text-[11px] text-slate-400 truncate">
                              Lead: {act.metadata.leadName}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 shrink-0">
                          {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
