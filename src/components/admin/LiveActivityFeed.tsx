/**
 * Live Activity Feed Component (Phase 2K)
 * Real-time event ticker for CRM administrators. Displays live connection
 * indicators, real-time sales actions, and verified vs unverified call
 * durations.
 * Rewritten for design tokens + aria-live announcements (F1/F2/F11).
 */

import React, { useState, useEffect } from 'react';
import {
  Activity as ActivityIcon,
  PhoneCall,
  UserCheck,
  UserPlus,
  Calendar,
  MessageSquare,
  FileSpreadsheet,
  Clock,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import type { Activity, ActivityType } from '../../db/types';
import { getDatabase } from '../../db/database';
import { RealtimeService } from '../../services/realtime/realtimeService';
import type { RealtimeConnectionStatus } from '../../services/realtime/realtimeTypes';

interface LiveActivityFeedProps {
  limit?: number;
  showFilters?: boolean;
}

const FILTER_TABS = ['ALL', 'CALLS', 'ASSIGNMENTS', 'FOLLOW_UPS', 'LEADS'] as const;

export const LiveActivityFeed: React.FC<LiveActivityFeedProps> = ({
  limit = 50,
  showFilters = true,
}) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [connStatus, setConnStatus] = useState<RealtimeConnectionStatus>(RealtimeService.getStatus());
  const [filterType, setFilterType] = useState<string>('ALL');
  const [newActivityCount, setNewActivityCount] = useState<number>(0);

  const loadActivities = async () => {
    try {
      const db = getDatabase();
      const all = await db.activities
        .filter((a: Activity) => a.deletedAt === null)
        .reverse()
        .sortBy('createdAt');
      setActivities(all.slice(0, limit));
      setNewActivityCount(0);
    } catch (err) {
      console.warn('Failed to load live activities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();

    // Subscribe to realtime status
    const unsubStatus = RealtimeService.onStatusChange((status) => {
      setConnStatus(status);
    });

    // Subscribe to incoming realtime activities
    const unsubActivity = RealtimeService.onActivity((newAct) => {
      setActivities((prev) => {
        // Prevent duplicates
        if (prev.some((a) => a.id === newAct.id)) return prev;
        return [newAct, ...prev.slice(0, limit - 1)];
      });
      setNewActivityCount((c) => c + 1);
    });

    return () => {
      unsubStatus();
      unsubActivity();
    };
  }, [limit]);

  const getActivityIcon = (type: ActivityType | string) => {
    switch (type) {
      case 'CALL_STARTED':
      case 'CALL_INITIATED':
      case 'CALL_COMPLETED':
      case 'CALL_OUTCOME_LOGGED':
        return <PhoneCall className="w-4 h-4 text-success-text" aria-hidden="true" />;
      case 'LEAD_ASSIGNED':
      case 'LEAD_REASSIGNED':
      case 'LEAD_UNASSIGNED':
        return <UserCheck className="w-4 h-4 text-accent-text" aria-hidden="true" />;
      case 'LEAD_CREATED':
      case 'LEAD_IMPORTED':
        return <UserPlus className="w-4 h-4 text-info" aria-hidden="true" />;
      case 'FOLLOW_UP_CREATED':
      case 'FOLLOW_UP_COMPLETED':
      case 'FOLLOW_UP_CANCELLED':
      case 'FOLLOW_UP_RESCHEDULED':
        return <Calendar className="w-4 h-4 text-warning-text" aria-hidden="true" />;
      case 'REMARK_ADDED':
        return <MessageSquare className="w-4 h-4 text-info" aria-hidden="true" />;
      case 'IMPORT_COMPLETED':
        return <FileSpreadsheet className="w-4 h-4 text-accent-text" aria-hidden="true" />;
      default:
        return <ActivityIcon className="w-4 h-4 text-soft" aria-hidden="true" />;
    }
  };

  const renderActivityDescription = (act: Activity) => {
    const meta = act.metadata || {};
    switch (act.activityType) {
      case 'CALL_COMPLETED': {
        const isVerified = meta.verificationStatus === 'VERIFIED' && meta.durationSeconds > 0;
        const durStr = isVerified
          ? `${Math.floor(meta.durationSeconds / 60)}m ${meta.durationSeconds % 60}s • Verified`
          : meta.reportedDurationSeconds
          ? `Reported ${Math.floor(meta.reportedDurationSeconds / 60)}m ${meta.reportedDurationSeconds % 60}s • Unverified`
          : 'Duration unavailable • Unverified';

        return (
          <div>
            <span className="font-semibold text-ink">{meta.repName || 'Rep'}</span> called{' '}
            <span className="font-semibold text-ink">{meta.leadName || 'Lead'}</span>
            <div className="text-xs text-soft mt-0.5">
              Outcome: <span className="text-ink font-medium">{meta.outcome || 'Completed'}</span> • {durStr}
            </div>
          </div>
        );
      }

      case 'LEAD_ASSIGNED':
        return (
          <div>
            <span className="font-semibold text-ink">{meta.assignedByAdminName || 'Admin'}</span> assigned{' '}
            <span className="font-semibold text-ink">{meta.leadName || 'Lead'}</span> to{' '}
            <span className="text-accent-text font-semibold">{meta.newAssigneeName || 'Agent'}</span>
          </div>
        );

      case 'LEAD_REASSIGNED':
        return (
          <div>
            <span className="font-semibold text-ink">{meta.assignedByAdminName || 'Admin'}</span> reassigned{' '}
            <span className="font-semibold text-ink">{meta.leadName || 'Lead'}</span> from{' '}
            <span className="text-soft">{meta.previousAssigneeName || 'Previous Agent'}</span> to{' '}
            <span className="text-accent-text font-semibold">{meta.newAssigneeName || 'New Agent'}</span>
          </div>
        );

      case 'LEAD_UNASSIGNED':
        return (
          <div>
            <span className="font-semibold text-ink">{meta.unassignedByAdminName || 'Admin'}</span> unassigned{' '}
            <span className="font-semibold text-ink">{meta.leadName || 'Lead'}</span>
          </div>
        );

      case 'LEAD_CREATED':
        return (
          <div>
            New lead created:{' '}
            <span className="font-semibold text-ink">{meta.businessName || meta.leadName || 'New Lead'}</span> by{' '}
            <span className="text-info font-medium">{meta.createdByName || 'Sales Rep'}</span>
          </div>
        );

      case 'LEAD_IMPORTED':
        return (
          <div>
            <span className="font-semibold text-ink">{meta.uploadedByName || 'User'}</span> imported{' '}
            <span className="text-info font-bold">{meta.totalRows || 'new'}</span> leads from spreadsheet
          </div>
        );

      case 'FOLLOW_UP_CREATED':
        return (
          <div>
            <span className="font-semibold text-ink">{meta.createdByName || 'Rep'}</span> scheduled follow-up for{' '}
            <span className="font-semibold text-ink">{meta.leadName || 'Lead'}</span> on{' '}
            <span className="text-warning-text font-medium">
              {meta.scheduledAt ? new Date(meta.scheduledAt).toLocaleDateString() : 'soon'}
            </span>
          </div>
        );

      case 'REMARK_ADDED':
        return (
          <div>
            <span className="font-semibold text-ink">{meta.author || 'Rep'}</span> added remark for{' '}
            <span className="font-semibold text-ink">{meta.leadName || 'Lead'}</span>: &ldquo;{meta.content || meta.remark}&rdquo;
          </div>
        );

      default:
        return (
          <div>
            <span className="font-semibold text-ink">{act.activityType.replace(/_/g, ' ')}</span>
          </div>
        );
    }
  };

  const filteredActivities = activities.filter((act) => {
    if (filterType === 'ALL') return true;
    if (filterType === 'CALLS') return act.activityType.startsWith('CALL_');
    if (filterType === 'ASSIGNMENTS')
      return act.activityType.startsWith('LEAD_ASSIGN') || act.activityType.startsWith('LEAD_REASSIGN');
    if (filterType === 'FOLLOW_UPS') return act.activityType.startsWith('FOLLOW_UP');
    if (filterType === 'LEADS') return act.activityType === 'LEAD_CREATED' || act.activityType === 'LEAD_IMPORTED';
    return true;
  });

  return (
    <div className="bg-surface border border-line rounded-2xl p-4 shadow-xl">
      {/* Header with Live indicator */}
      <div className="flex items-center justify-between pb-3 border-b border-line">
        <div className="flex items-center gap-2">
          <ActivityIcon className="w-5 h-5 text-success-text" aria-hidden="true" />
          <h3 className="font-bold text-ink text-base">Live Activity Feed</h3>
          {newActivityCount > 0 && (
            <span className="bg-success-soft text-success-text text-xs font-black px-2 py-0.5 rounded-full border border-success">
              +{newActivityCount} new
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Realtime Connection Badge */}
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-inset border border-line"
          >
            {connStatus === 'SUBSCRIBED' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" aria-hidden="true" />
                <span className="text-success-text">Live</span>
              </>
            ) : connStatus === 'SUBSCRIBING' || connStatus === 'RECONNECTING' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-warning-text animate-spin" aria-hidden="true" />
                <span className="text-warning-text">Connecting</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-faint" aria-hidden="true" />
                <span className="text-soft">Offline</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={loadActivities}
            aria-label="Refresh feed"
            className="w-11 h-11 flex items-center justify-center text-soft hover:text-ink bg-inset rounded-xl hover:bg-inset-strong transition"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      {showFilters && (
        <div
          role="group"
          aria-label="Filter activity by type"
          className="flex gap-1.5 overflow-x-auto py-2.5 scrollbar-none border-b border-line"
        >
          {FILTER_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilterType(tab)}
              aria-pressed={filterType === tab}
              className={`min-h-11 px-3 rounded-xl text-sm font-semibold transition ${
                filterType === tab
                  ? 'bg-accent text-on-accent shadow-sm'
                  : 'bg-inset text-soft hover:text-ink'
              }`}
            >
              {tab === 'ALL' ? 'All Activity' : tab.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      )}

      {/* Activity List */}
      <div aria-live="polite" className="mt-3 divide-y divide-line max-h-96 overflow-y-auto pr-1">
        {loading ? (
          <div className="py-8 text-center text-sm text-soft" role="status">
            <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-success-text" aria-hidden="true" />
            Loading real-time activity...
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="py-8 text-center text-sm text-faint">No activities recorded yet.</div>
        ) : (
          filteredActivities.map((act) => {
            const timeStr = new Date(act.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
            const dateStr = new Date(act.createdAt).toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
            });

            return (
              <div
                key={act.id}
                className="py-2.5 flex items-start gap-3 text-sm hover:bg-inset px-1 rounded-lg transition"
              >
                <div className="p-2 rounded-xl bg-inset border border-line mt-0.5 shrink-0">
                  {getActivityIcon(act.activityType)}
                </div>

                <div className="flex-1 min-w-0">
                  {renderActivityDescription(act)}
                  <div className="flex items-center gap-1.5 text-xs text-faint mt-1">
                    <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>
                      {dateStr}, {timeStr}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
