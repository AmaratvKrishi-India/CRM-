/**
 * Agent Performance Table Component (Phase 2L)
 * Displays sales representative productivity cards/rows with verified talk
 * times, call volumes, and lead engagement statistics.
 * Rewritten for design tokens + button semantics on rows (F3).
 */

import React from 'react';
import {
  Users,
  PhoneCall,
  Clock,
  Calendar,
  ChevronRight,
  Award,
} from 'lucide-react';
import { AgentPerformanceSummary } from '../../services/adminAnalyticsService';

interface AgentPerformanceTableProps {
  agents: AgentPerformanceSummary[];
  loading?: boolean;
  onSelectAgent: (agentId: string) => void;
}

const formatSeconds = (seconds: number) => {
  if (!seconds || seconds <= 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

export const AgentPerformanceTable: React.FC<AgentPerformanceTableProps> = ({
  agents,
  loading = false,
  onSelectAgent,
}) => {
  if (loading) {
    return (
      <div className="py-8 text-center text-sm text-soft" role="status">
        <Users className="w-5 h-5 animate-pulse mx-auto mb-2 text-accent-text" aria-hidden="true" />
        Loading sales agent performance...
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-faint bg-inset rounded-2xl border border-line">
        No sales representatives found. Provision agents to view performance.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {agents.map((agent, idx) => (
        <button
          key={agent.agentId}
          type="button"
          onClick={() => onSelectAgent(agent.agentId)}
          aria-label={`View performance details for ${agent.agentName}`}
          className="w-full p-4 bg-surface border border-line hover:border-accent/50 rounded-2xl shadow-md transition-all active:scale-99 group text-left"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent-text flex items-center justify-center font-bold text-sm border border-accent/30 shrink-0">
                {idx === 0 ? (
                  <Award className="w-4 h-4 text-warning-text" aria-hidden="true" />
                ) : (
                  agent.agentName.charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="font-bold text-sm text-ink group-hover:text-accent-text transition truncate">
                    {agent.agentName}
                  </h4>
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                      agent.status === 'ACTIVE'
                        ? 'bg-success-soft text-success-text border border-success'
                        : 'bg-danger-soft text-danger-text border border-danger'
                    }`}
                  >
                    {agent.status}
                  </span>
                </div>
                <p className="text-xs text-soft truncate">{agent.phone || agent.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-soft group-hover:text-ink transition">
              <span className="text-xs font-semibold hidden sm:inline">Details</span>
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>

          {/* Metric Grid */}
          <div className="grid grid-cols-3 gap-2 pt-3 text-center">
            {/* Leads */}
            <div className="p-2 bg-inset rounded-xl border border-line">
              <span className="text-xs uppercase font-bold text-soft block mb-0.5">Leads</span>
              <div className="flex items-center justify-center gap-1">
                <span className="text-sm font-black text-ink">{agent.leadsAssigned}</span>
                <span className="text-xs text-soft">({agent.leadsWorked} wk)</span>
              </div>
            </div>

            {/* Calls */}
            <div className="p-2 bg-inset rounded-xl border border-line">
              <span className="text-xs uppercase font-bold text-soft block mb-0.5">Calls</span>
              <div className="flex items-center justify-center gap-1">
                <PhoneCall className="w-3.5 h-3.5 text-success-text" aria-hidden="true" />
                <span className="text-sm font-black text-ink">{agent.callsTotal}</span>
                {agent.callsVerified > 0 && (
                  <span
                    className="text-xs text-success-text font-bold"
                    aria-label={`Verified Calls: ${agent.callsVerified}`}
                  >
                    ✓{agent.callsVerified}
                  </span>
                )}
              </div>
            </div>

            {/* Verified Talk Time */}
            <div className="p-2 bg-inset rounded-xl border border-line">
              <span className="text-xs uppercase font-bold text-soft block mb-0.5">Talk Time</span>
              <div className="flex items-center justify-center gap-1">
                <Clock className="w-3.5 h-3.5 text-accent-text" aria-hidden="true" />
                <span className="text-xs font-bold text-accent-text">
                  {formatSeconds(agent.verifiedTalkTimeSeconds)}
                </span>
              </div>
            </div>
          </div>

          {/* Sub-row with follow-up stats & last activity */}
          <div className="mt-2.5 pt-2 border-t border-line flex items-center justify-between text-xs text-soft">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-warning-text" aria-hidden="true" />
                <span>
                  Follow-ups: {agent.followUpsCompleted}/{agent.followUpsTotal}
                </span>
              </span>
              {agent.followUpsOverdue > 0 && (
                <span className="text-danger-text font-bold">({agent.followUpsOverdue} overdue)</span>
              )}
            </div>

            <span>
              {agent.lastActivityAt
                ? `Active ${new Date(agent.lastActivityAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : 'No recent activity'}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
};
