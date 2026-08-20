/**
 * Agent Performance Table Component (Phase 2L)
 * Displays sales representative productivity cards/rows with verified talk times,
 * call volumes, and lead engagement statistics.
 */

import React from 'react';
import {
  Users,
  PhoneCall,
  Clock,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Award,
} from 'lucide-react';
import { AgentPerformanceSummary } from '../../services/adminAnalyticsService';

interface AgentPerformanceTableProps {
  agents: AgentPerformanceSummary[];
  loading?: boolean;
  onSelectAgent: (agentId: string) => void;
}

export const AgentPerformanceTable: React.FC<AgentPerformanceTableProps> = ({
  agents,
  loading = false,
  onSelectAgent,
}) => {
  const formatSeconds = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  if (loading) {
    return (
      <div className="py-8 text-center text-xs text-slate-400">
        <Users className="w-5 h-5 animate-pulse mx-auto mb-2 text-purple-400" />
        Loading sales agent performance...
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-slate-500 bg-slate-900/50 rounded-2xl border border-slate-800">
        No sales representatives found. Provision agents to view performance.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {agents.map((agent, idx) => (
        <div
          key={agent.agentId}
          onClick={() => onSelectAgent(agent.agentId)}
          className="p-4 bg-slate-900 border border-slate-800 hover:border-purple-500/40 rounded-2xl shadow-md transition-all active:scale-99 cursor-pointer group"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold text-sm border border-purple-500/20 shrink-0">
                {idx === 0 ? <Award className="w-4 h-4 text-amber-400" /> : agent.agentName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="font-bold text-sm text-white group-hover:text-purple-300 transition truncate">
                    {agent.agentName}
                  </h4>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                      agent.status === 'ACTIVE'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {agent.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">{agent.phone || agent.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-slate-400 group-hover:text-white transition">
              <span className="text-xs font-semibold hidden sm:inline">Details</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>

          {/* Metric Grid */}
          <div className="grid grid-cols-3 gap-2 pt-3 text-center">
            {/* Leads */}
            <div className="p-2 bg-slate-800/50 rounded-xl border border-slate-700/40">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Leads</span>
              <div className="flex items-center justify-center gap-1">
                <span className="text-sm font-black text-white">{agent.leadsAssigned}</span>
                <span className="text-[10px] text-slate-400">({agent.leadsWorked} wk)</span>
              </div>
            </div>

            {/* Calls */}
            <div className="p-2 bg-slate-800/50 rounded-xl border border-slate-700/40">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Calls</span>
              <div className="flex items-center justify-center gap-1">
                <PhoneCall className="w-3 h-3 text-emerald-400" />
                <span className="text-sm font-black text-white">{agent.callsTotal}</span>
                {agent.callsVerified > 0 && (
                  <span className="text-[10px] text-emerald-400 font-bold" title="Verified Calls">
                    ✓{agent.callsVerified}
                  </span>
                )}
              </div>
            </div>

            {/* Verified Talk Time */}
            <div className="p-2 bg-slate-800/50 rounded-xl border border-slate-700/40">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Talk Time</span>
              <div className="flex items-center justify-center gap-1">
                <Clock className="w-3 h-3 text-purple-400" />
                <span className="text-xs font-bold text-purple-300">
                  {formatSeconds(agent.verifiedTalkTimeSeconds)}
                </span>
              </div>
            </div>
          </div>

          {/* Sub-row with follow-up stats & last activity */}
          <div className="mt-2.5 pt-2 border-t border-slate-800/50 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-amber-400" />
                <span>Follow-ups: {agent.followUpsCompleted}/{agent.followUpsTotal}</span>
              </span>
              {agent.followUpsOverdue > 0 && (
                <span className="text-rose-400 font-bold">
                  ({agent.followUpsOverdue} overdue)
                </span>
              )}
            </div>

            <span>
              {agent.lastActivityAt
                ? `Active ${new Date(agent.lastActivityAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'No recent activity'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
