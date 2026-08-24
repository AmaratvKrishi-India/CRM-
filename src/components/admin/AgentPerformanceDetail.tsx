/**
 * Agent Performance Detail Component (Phase 2L)
 * Displays deep-dive productivity scorecards, verified call durations,
 * assigned leads, and recent sales activity for an individual sales
 * representative.
 * Rewritten for the shared accessible Modal + design tokens (F1/F2/F5).
 */

import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Phone,
  Calendar,
  Clock,
  PhoneCall,
  MessageSquare,
  ArrowUpRight,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { NativePlatformService } from '../../services/nativePlatform';
import {
  AdminAnalyticsService,
  AgentPerformanceSummary,
  DashboardDateRange,
} from '../../services/adminAnalyticsService';
import { Lead } from '../../db/types';
import { Modal } from '../common/Modal';

interface AgentPerformanceDetailProps {
  agentId: string;
  isOpen: boolean;
  dateRange?: DashboardDateRange;
  onClose: () => void;
  onViewLeadsForAgent: (agentId: string) => void;
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

  const handleCallAgent = () => {
    if (summary?.phone) {
      NativePlatformService.openDialer(summary.phone);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={summary?.agentName || 'Sales Agent'}
      subtitle={summary?.email}
      maxWidthClassName="max-w-xl"
      headerIcon={
        <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent-text border border-accent/30 flex items-center justify-center font-bold text-base shrink-0">
          {summary?.agentName?.charAt(0).toUpperCase() || 'A'}
        </div>
      }
    >
      {loading ? (
        <div className="py-12 flex flex-col items-center gap-2 text-sm text-soft" role="status">
          <Loader2 className="w-5 h-5 animate-spin text-accent-text" aria-hidden="true" />
          <span>Loading sales representative analytics...</span>
        </div>
      ) : !summary ? (
        <div className="py-12 text-center text-sm text-faint">
          Representative details could not be found.
        </div>
      ) : (
        <div className="space-y-5">
          {/* Status + Quick Actions */}
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                summary.status === 'ACTIVE'
                  ? 'bg-success-soft text-success-text border border-success'
                  : 'bg-danger-soft text-danger-text border border-danger'
              }`}
            >
              {summary.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleCallAgent}
              className="min-h-11 py-2.5 px-3 bg-accent hover:bg-accent-hover text-on-accent rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md transition active:scale-98"
            >
              <Phone className="w-4 h-4" aria-hidden="true" />
              <span>Call Agent ({summary.phone || 'N/A'})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onViewLeadsForAgent(agentId);
              }}
              className="min-h-11 py-2.5 px-3 bg-inset hover:bg-inset-strong text-accent-text border border-accent/40 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition active:scale-98"
            >
              <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
              <span>View Assigned Leads ({assignedLeads.length})</span>
            </button>
          </div>

          {/* Performance Metric Scorecard Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {/* Calls */}
            <div className="p-3 bg-inset rounded-2xl border border-line">
              <div className="flex items-center gap-1.5 text-xs text-soft mb-1">
                <PhoneCall className="w-3.5 h-3.5 text-success-text" aria-hidden="true" />
                <span>Total Calls</span>
              </div>
              <div className="text-lg font-black text-ink">{summary.callsTotal}</div>
              <div className="text-xs text-soft mt-0.5">
                <span className="text-success-text font-bold">{summary.callsVerified} verified</span> •{' '}
                <span>{summary.callsUnverified} unverified</span>
              </div>
            </div>

            {/* Talk Time */}
            <div className="p-3 bg-inset rounded-2xl border border-line">
              <div className="flex items-center gap-1.5 text-xs text-soft mb-1">
                <Clock className="w-3.5 h-3.5 text-accent-text" aria-hidden="true" />
                <span>Verified Talk Time</span>
              </div>
              <div className="text-lg font-black text-accent-text">
                {formatSeconds(summary.verifiedTalkTimeSeconds)}
              </div>
              <div className="text-xs text-soft mt-0.5">
                Avg: {formatSeconds(summary.averageVerifiedDurationSeconds)}
              </div>
            </div>

            {/* Leads Worked */}
            <div className="p-3 bg-inset rounded-2xl border border-line">
              <div className="flex items-center gap-1.5 text-xs text-soft mb-1">
                <UserIcon className="w-3.5 h-3.5 text-info" aria-hidden="true" />
                <span>Leads Assigned</span>
              </div>
              <div className="text-lg font-black text-ink">{summary.leadsAssigned}</div>
              <div className="text-xs text-info mt-0.5 font-medium">
                {summary.leadsWorked} leads worked
              </div>
            </div>

            {/* Follow-ups */}
            <div className="p-3 bg-inset rounded-2xl border border-line">
              <div className="flex items-center gap-1.5 text-xs text-soft mb-1">
                <Calendar className="w-3.5 h-3.5 text-warning-text" aria-hidden="true" />
                <span>Follow-ups</span>
              </div>
              <div className="text-lg font-black text-ink">{summary.followUpsTotal}</div>
              <div className="text-xs text-soft mt-0.5">
                {summary.followUpsCompleted} completed
                {summary.followUpsOverdue > 0 && (
                  <>
                    {' '}• <span className="text-danger-text font-bold">{summary.followUpsOverdue} overdue</span>
                  </>
                )}
              </div>
            </div>

            {/* WhatsApp */}
            <div className="p-3 bg-inset rounded-2xl border border-line">
              <div className="flex items-center gap-1.5 text-xs text-soft mb-1">
                <MessageSquare className="w-3.5 h-3.5 text-info" aria-hidden="true" />
                <span>WhatsApp Pitch</span>
              </div>
              <div className="text-lg font-black text-ink">{summary.whatsappInitiated}</div>
              <div className="text-xs text-soft mt-0.5">Messages initiated</div>
            </div>

            {/* Account Details */}
            <div className="p-3 bg-inset rounded-2xl border border-line">
              <div className="flex items-center gap-1.5 text-xs text-soft mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-soft" aria-hidden="true" />
                <span>Last Login</span>
              </div>
              <div className="text-xs font-bold text-ink">
                {summary.lastLoginAt ? new Date(summary.lastLoginAt).toLocaleDateString() : 'Never'}
              </div>
              <div className="text-xs text-faint mt-1 truncate">{summary.phone}</div>
            </div>
          </div>

          {/* Recent Activity Stream for this Agent */}
          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-soft">
              Recent Representative Activity
            </h4>

            <div className="bg-inset rounded-2xl border border-line p-3 divide-y divide-line max-h-56 overflow-y-auto">
              {recentActivities.length === 0 ? (
                <p className="text-sm text-faint text-center py-4">No recent activity recorded.</p>
              ) : (
                recentActivities.map((act) => (
                  <div key={act.id} className="py-2 text-xs flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <span className="font-semibold text-ink">
                        {act.activityType.replace(/_/g, ' ')}
                      </span>
                      {act.metadata?.leadName && (
                        <p className="text-xs text-soft truncate">Lead: {act.metadata.leadName}</p>
                      )}
                    </div>
                    <span className="text-xs text-faint shrink-0">
                      {new Date(act.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
