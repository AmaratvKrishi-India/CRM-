/**
 * Lead Activity & Assignment Timeline (Phase 2I)
 * Chronological visualization of all events for a lead:
 * Lead Created -> Assigned -> Reassigned -> Calls -> Follow-ups -> Remarks.
 */

import React, { useEffect, useState } from 'react';
import {
  UserCheck,
  UserPlus,
  PhoneCall,
  Calendar,
  MessageSquare,
  Clock,
  Sparkles,
  Loader2,
  Share2,
} from 'lucide-react';
import { LeadAssignmentService } from '../../services/leadAssignmentService';
import { Activity } from '../../db/types';

interface LeadTimelineViewProps {
  leadId: string;
}

export const LeadTimelineView: React.FC<LeadTimelineViewProps> = ({ leadId }) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTimeline();
  }, [leadId]);

  const loadTimeline = async () => {
    setLoading(true);
    try {
      const list = await LeadAssignmentService.getLeadHistoryTimeline(leadId);
      setActivities(list);
    } catch (err) {
      console.warn('Failed to load lead timeline:', err);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'LEAD_CREATED':
      case 'LEAD_IMPORTED':
        return <UserPlus className="w-3.5 h-3.5 text-blue-400" />;
      case 'LEAD_ASSIGNED':
      case 'LEAD_REASSIGNED':
        return <UserCheck className="w-3.5 h-3.5 text-purple-400" />;
      case 'LEAD_UNASSIGNED':
        return <Share2 className="w-3.5 h-3.5 text-amber-400" />;
      case 'CALL_STARTED':
      case 'CALL_COMPLETED':
      case 'CALL_OUTCOME_LOGGED':
        return <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />;
      case 'FOLLOW_UP_CREATED':
      case 'FOLLOW_UP_COMPLETED':
        return <Calendar className="w-3.5 h-3.5 text-amber-400" />;
      case 'REMARK_ADDED':
        return <MessageSquare className="w-3.5 h-3.5 text-sky-400" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const getActivityDescription = (activity: Activity) => {
    const meta = activity.metadata || {};
    switch (activity.activityType) {
      case 'LEAD_CREATED':
        return `Lead created by ${meta.createdByName || 'Sales Rep'}`;
      case 'LEAD_IMPORTED':
        return `Imported from ${meta.sourceFile || 'spreadsheet'}`;
      case 'LEAD_ASSIGNED':
        return `Assigned to ${meta.newAssigneeName || 'Agent'} by ${meta.assignedByAdminName || 'Admin'}`;
      case 'LEAD_REASSIGNED':
        return `Reassigned from ${meta.previousAssigneeName || 'Previous Agent'} to ${meta.newAssigneeName || 'New Agent'}`;
      case 'LEAD_UNASSIGNED':
        return `Assignment removed by ${meta.unassignedByAdminName || 'Admin'}`;
      case 'CALL_COMPLETED': {
        const isVerified = meta.verificationStatus === 'VERIFIED' && meta.durationSeconds > 0;
        const durationStr = isVerified
          ? `${Math.floor(meta.durationSeconds / 60)}m ${meta.durationSeconds % 60}s (VERIFIED)`
          : meta.reportedDurationSeconds
          ? `Reported: ${Math.floor(meta.reportedDurationSeconds / 60)}m ${meta.reportedDurationSeconds % 60}s (UNVERIFIED)`
          : 'Duration unavailable (UNVERIFIED)';
        return `Call logged (${meta.outcome || 'Completed'}) • ${durationStr}`;
      }
      case 'CALL_INITIATED':
        return `Call attempt initiated by ${meta.repName || 'Sales Rep'}`;
      case 'CALL_CANCELLED':
        return `Call cancelled without recording`;
      case 'FOLLOW_UP_CREATED':
        return `Follow-up scheduled for ${meta.scheduledAt ? new Date(meta.scheduledAt).toLocaleDateString() : 'soon'}`;
      case 'REMARK_ADDED':
        return `Remark added: "${meta.content || meta.remark || 'Notes'}"`;
      case 'STATUS_CHANGED':
        return `Status updated to ${meta.newStatus || meta.status}`;
      default:
        return activity.activityType.replace(/_/g, ' ');
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-slate-500">
        No recorded history yet.
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-700/60">
      {activities.map((act) => {
        const timeFormatted = new Date(act.createdAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });

        return (
          <div key={act.id} className="relative flex items-start gap-2.5 text-xs">
            <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center flex-shrink-0">
              {getActivityIcon(act.activityType)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-slate-200 font-medium leading-tight">
                {getActivityDescription(act)}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">{timeFormatted}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
