/**
 * Live Activity Feed Component (Phase 2K)
 * Real-time event ticker for CRM administrators. Displays live connection indicators,
 * real-time sales actions, and verified vs unverified call durations.
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
  Wifi,
  WifiOff,
  RefreshCw,
  Filter,
} from 'lucide-react';
import { Activity, ActivityType } from '../../db/types';
import { getDatabase } from '../../db/database';
import { RealtimeService } from '../../services/realtime/realtimeService';
import { RealtimeConnectionStatus } from '../../services/realtime/realtimeTypes';

interface LiveActivityFeedProps {
  limit?: number;
  showFilters?: boolean;
}

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
        return <PhoneCall className="w-4 h-4 text-emerald-400" />;
      case 'LEAD_ASSIGNED':
      case 'LEAD_REASSIGNED':
      case 'LEAD_UNASSIGNED':
        return <UserCheck className="w-4 h-4 text-purple-400" />;
      case 'LEAD_CREATED':
      case 'LEAD_IMPORTED':
        return <UserPlus className="w-4 h-4 text-blue-400" />;
      case 'FOLLOW_UP_CREATED':
      case 'FOLLOW_UP_COMPLETED':
      case 'FOLLOW_UP_CANCELLED':
      case 'FOLLOW_UP_RESCHEDULED':
        return <Calendar className="w-4 h-4 text-amber-400" />;
      case 'REMARK_ADDED':
        return <MessageSquare className="w-4 h-4 text-sky-400" />;
      case 'IMPORT_COMPLETED':
        return <FileSpreadsheet className="w-4 h-4 text-indigo-400" />;
      default:
        return <ActivityIcon className="w-4 h-4 text-slate-400" />;
    }
  };

  const renderActivityDescription = (act: Activity) => {
    const meta = act.metadata || {};
    switch (act.activityType) {
      case 'CALL_COMPLETED': {
        const isVerified = meta.verificationStatus === 'VERIFIED' && meta.durationSeconds > 0;
        const durStr = isVerified
          ? `${Math.floor(meta.durationSeconds / 60)}m ${meta.durationSeconds % 60}s • VERIFIED`
          : meta.reportedDurationSeconds
          ? `Reported ${Math.floor(meta.reportedDurationSeconds / 60)}m ${meta.reportedDurationSeconds % 60}s • UNVERIFIED`
          : 'Duration unavailable • UNVERIFIED';

        return (
          <div>
            <span className="font-semibold text-slate-200">{meta.repName || 'Rep'}</span> called{' '}
            <span className="font-semibold text-slate-200">{meta.leadName || 'Lead'}</span>
            <div className="text-xs text-slate-400 mt-0.5">
              Outcome: <span className="text-slate-300 font-medium">{meta.outcome || 'Completed'}</span> • {durStr}
            </div>
          </div>
        );
      }

      case 'LEAD_ASSIGNED':
        return (
          <div>
            <span className="font-semibold text-slate-200">{meta.assignedByAdminName || 'Admin'}</span> assigned{' '}
            <span className="font-semibold text-slate-200">{meta.leadName || 'Lead'}</span> to{' '}
            <span className="text-purple-400 font-semibold">{meta.newAssigneeName || 'Agent'}</span>
          </div>
        );

      case 'LEAD_REASSIGNED':
        return (
          <div>
            <span className="font-semibold text-slate-200">{meta.assignedByAdminName || 'Admin'}</span> reassigned{' '}
            <span className="font-semibold text-slate-200">{meta.leadName || 'Lead'}</span> from{' '}
            <span className="text-slate-400">{meta.previousAssigneeName || 'Previous Agent'}</span> to{' '}
            <span className="text-purple-400 font-semibold">{meta.newAssigneeName || 'New Agent'}</span>
          </div>
        );

      case 'LEAD_UNASSIGNED':
        return (
          <div>
            <span className="font-semibold text-slate-200">{meta.unassignedByAdminName || 'Admin'}</span> unassigned{' '}
            <span className="font-semibold text-slate-200">{meta.leadName || 'Lead'}</span>
          </div>
        );

      case 'LEAD_CREATED':
        return (
          <div>
            New lead created: <span className="font-semibold text-slate-200">{meta.businessName || meta.leadName || 'New Lead'}</span> by{' '}
            <span className="text-blue-400 font-medium">{meta.createdByName || 'Sales Rep'}</span>
          </div>
        );

      case 'LEAD_IMPORTED':
        return (
          <div>
            <span className="font-semibold text-slate-200">{meta.uploadedByName || 'User'}</span> imported{' '}
            <span className="text-blue-400 font-bold">{meta.totalRows || 'new'}</span> leads from spreadsheet
          </div>
        );

      case 'FOLLOW_UP_CREATED':
        return (
          <div>
            <span className="font-semibold text-slate-200">{meta.createdByName || 'Rep'}</span> scheduled follow-up for{' '}
            <span className="font-semibold text-slate-200">{meta.leadName || 'Lead'}</span> on{' '}
            <span className="text-amber-400 font-medium">
              {meta.scheduledAt ? new Date(meta.scheduledAt).toLocaleDateString() : 'soon'}
            </span>
          </div>
        );

      case 'REMARK_ADDED':
        return (
          <div>
            <span className="font-semibold text-slate-200">{meta.author || 'Rep'}</span> added remark for{' '}
            <span className="font-semibold text-slate-200">{meta.leadName || 'Lead'}</span>: &ldquo;{meta.content || meta.remark}&rdquo;
          </div>
        );

      default:
        return (
          <div>
            <span className="font-semibold text-slate-200">{act.activityType.replace(/_/g, ' ')}</span>
          </div>
        );
    }
  };

  const filteredActivities = activities.filter((act) => {
    if (filterType === 'ALL') return true;
    if (filterType === 'CALLS') return act.activityType.startsWith('CALL_');
    if (filterType === 'ASSIGNMENTS') return act.activityType.startsWith('LEAD_ASSIGN') || act.activityType.startsWith('LEAD_REASSIGN');
    if (filterType === 'FOLLOW_UPS') return act.activityType.startsWith('FOLLOW_UP');
    if (filterType === 'LEADS') return act.activityType === 'LEAD_CREATED' || act.activityType === 'LEAD_IMPORTED';
    return true;
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
      {/* Header with Live indicator */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <ActivityIcon className="w-5 h-5 text-emerald-400" />
          <h3 className="font-bold text-white text-base">Live Activity Feed</h3>
          {newActivityCount > 0 && (
            <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-500/30">
              +{newActivityCount} new
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Realtime Connection Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800/80 border border-slate-700">
            {connStatus === 'SUBSCRIBED' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400">Live</span>
              </>
            ) : connStatus === 'SUBSCRIBING' || connStatus === 'RECONNECTING' ? (
              <>
                <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
                <span className="text-amber-400">Connecting</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-slate-500" />
                <span className="text-slate-400">Offline</span>
              </>
            )}
          </div>

          <button
            onClick={loadActivities}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition"
            title="Refresh feed"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      {showFilters && (
        <div className="flex gap-1.5 overflow-x-auto py-2.5 scrollbar-none border-b border-slate-800/60 text-xs">
          {['ALL', 'CALLS', 'ASSIGNMENTS', 'FOLLOW_UPS', 'LEADS'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterType(tab)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                filterType === tab
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab === 'ALL' ? 'All Activity' : tab.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      )}

      {/* Activity List */}
      <div className="mt-3 divide-y divide-slate-800/60 max-h-96 overflow-y-auto pr-1">
        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">
            <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-emerald-400" />
            Loading real-time activity...
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No activities recorded yet.
          </div>
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
              <div key={act.id} className="py-2.5 flex items-start gap-3 text-sm hover:bg-slate-800/30 px-1 rounded-lg transition">
                <div className="p-2 rounded-xl bg-slate-800 border border-slate-700/50 mt-0.5 shrink-0">
                  {getActivityIcon(act.activityType)}
                </div>

                <div className="flex-1 min-w-0">
                  {renderActivityDescription(act)}
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1">
                    <Clock className="w-3 h-3" />
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
