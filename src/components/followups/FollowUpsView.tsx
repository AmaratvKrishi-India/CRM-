import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  PhoneCall,
  MessageSquare,
  RotateCcw,
  Plus,
  Loader2,
  ChevronRight,
  User,
  MapPin,
  Tag,
} from 'lucide-react';
import { crmData } from '../../db';
import {
  EnrichedFollowUp,
  GroupedFollowUps,
} from '../../db/repositories/followUpRepository';
import { FollowUpModal } from './FollowUpModal';
import { Lead } from '../../db/types';

interface FollowUpsViewProps {
  onCallLead: (lead: Lead) => void;
  onOpenWhatsApp: (lead: Lead) => void;
  onOpenLead: (leadId: string) => void;
}

export const FollowUpsView: React.FC<FollowUpsViewProps> = ({
  onCallLead,
  onOpenWhatsApp,
  onOpenLead,
}) => {
  const [data, setData] = useState<GroupedFollowUps>({ overdue: [], today: [], upcoming: [] });
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'ALL' | 'OVERDUE' | 'TODAY' | 'UPCOMING'>('ALL');

  // Reschedule / Edit Modal State
  const [selectedFollowUp, setSelectedFollowUp] = useState<EnrichedFollowUp | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const grouped = await crmData.followUps.getGroupedPendingFollowUps();
      setData(grouped);
    } catch (err) {
      console.error('Failed to load follow-ups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleComplete = async (id: string) => {
    try {
      await crmData.followUps.completeFollowUp(id);
      await loadData();
    } catch (err) {
      console.error('Failed to complete follow up:', err);
    }
  };

  const handleReschedule = (item: EnrichedFollowUp) => {
    setSelectedFollowUp(item);
    setIsModalOpen(true);
  };

  const formatDateTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'HIGH':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'LOW':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const renderFollowUpCard = (item: EnrichedFollowUp, isOverdue = false) => {
    const lead = item.lead;
    const isMobile = lead?.phoneType === 'mobile';

    return (
      <div
        key={item.id}
        className={`bg-white rounded-2xl border p-4 shadow-xs space-y-3 transition-all ${
          isOverdue ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        {/* Top Title & Header */}
        <div className="flex items-start justify-between gap-2">
          <div
            onClick={() => onOpenLead(item.leadId)}
            className="flex-1 min-w-0 cursor-pointer group"
          >
            <div className="flex items-center gap-1">
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 truncate transition-colors">
                {lead?.businessName || 'Gym Lead'}
              </h3>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 flex-shrink-0" />
            </div>

            <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
              <MapPin className="w-3 h-3 text-slate-400" />
              <span>{lead?.locality || 'Lucknow'}</span>
              {lead?.status && (
                <span className="text-[10px] bg-slate-100 px-1.5 py-0.2 rounded font-medium text-slate-700 ml-1">
                  {lead.status}
                </span>
              )}
            </div>
          </div>

          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getPriorityBadgeClass(
              item.priority
            )} flex-shrink-0`}
          >
            {item.priority}
          </span>
        </div>

        {/* Reason / Title */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
            <Tag className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
            <span>{item.title}</span>
          </div>

          {item.notes && (
            <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 line-clamp-2">
              {item.notes}
            </p>
          )}
        </div>

        {/* Scheduled Time Banner */}
        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
          <div
            className={`flex items-center gap-1.5 font-bold ${
              isOverdue ? 'text-rose-700 font-semibold' : 'text-slate-700'
            }`}
          >
            {isOverdue ? (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            ) : (
              <Clock className="w-3.5 h-3.5 text-blue-600" />
            )}
            <span>{formatDateTime(item.scheduledAt)}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleReschedule(item)}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg transition-colors"
            >
              Reschedule
            </button>
            <button
              type="button"
              onClick={() => handleComplete(item.id)}
              className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Done</span>
            </button>
          </div>
        </div>

        {/* Quick Communication Bar */}
        {lead && (
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
            <span className="font-mono text-xs font-bold text-slate-800 truncate">
              {lead.phoneE164 || lead.phone}
            </span>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {isMobile ? (
                <button
                  type="button"
                  onClick={() => onOpenWhatsApp(lead as any)}
                  className="py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                >
                  <MessageSquare className="w-3 h-3" />
                  <span>WhatsApp</span>
                </button>
              ) : (
                <span className="text-[10px] text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-1 rounded-lg">
                  WA N/A
                </span>
              )}

              <button
                type="button"
                onClick={() => onCallLead(lead as any)}
                className="py-1 px-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
              >
                <PhoneCall className="w-3 h-3 text-emerald-400" />
                <span>Call</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const totalOverdue = data.overdue.length;
  const totalToday = data.today.length;
  const totalUpcoming = data.upcoming.length;
  const totalAll = totalOverdue + totalToday + totalUpcoming;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-20">
      {/* Header */}
      <div className="bg-slate-900 text-white px-4 py-4 sticky top-0 z-30 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold tracking-tight">Sales Follow-ups</h1>
            <p className="text-[11px] text-slate-400">Scheduled Gym Calls & Sample Visits</p>
          </div>

          <div className="text-right">
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full">
              {totalAll} Pending
            </span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-2xl w-full mx-auto p-4 flex-1 flex flex-col space-y-4">
        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'ALL', label: `All (${totalAll})` },
            { id: 'OVERDUE', label: `Overdue (${totalOverdue})`, count: totalOverdue, isDanger: true },
            { id: 'TODAY', label: `Today (${totalToday})`, count: totalToday, isSuccess: true },
            { id: 'UPCOMING', label: `Upcoming (${totalUpcoming})` },
          ].map((tab) => {
            const isSelected = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSection(tab.id as any)}
                className={`py-1.5 px-3 rounded-xl font-bold text-xs whitespace-nowrap transition-colors ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="py-16 text-center space-y-2">
            <Loader2 className="w-7 h-7 animate-spin text-emerald-600 mx-auto" />
            <p className="text-xs text-slate-500 font-medium">Loading follow-ups...</p>
          </div>
        ) : totalAll === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center my-auto space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">All Caught Up!</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              No pending follow-ups right now. Open any lead to schedule calls, sample drop-offs, or pricing negotiations.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* SECTION 1: OVERDUE */}
            {(activeSection === 'ALL' || activeSection === 'OVERDUE') && totalOverdue > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 uppercase tracking-tight">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Overdue ({totalOverdue})</span>
                </div>
                <div className="space-y-2.5">
                  {data.overdue.map((item) => renderFollowUpCard(item, true))}
                </div>
              </div>
            )}

            {/* SECTION 2: TODAY */}
            {(activeSection === 'ALL' || activeSection === 'TODAY') && totalToday > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-tight">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <span>Scheduled For Today ({totalToday})</span>
                </div>
                <div className="space-y-2.5">
                  {data.today.map((item) => renderFollowUpCard(item, false))}
                </div>
              </div>
            )}

            {/* SECTION 3: UPCOMING */}
            {(activeSection === 'ALL' || activeSection === 'UPCOMING') && totalUpcoming > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-tight">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>Upcoming Follow-ups ({totalUpcoming})</span>
                </div>
                <div className="space-y-2.5">
                  {data.upcoming.map((item) => renderFollowUpCard(item, false))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reschedule Modal */}
      {selectedFollowUp && (
        <FollowUpModal
          isOpen={isModalOpen}
          lead={selectedFollowUp.lead as any}
          existingFollowUp={selectedFollowUp}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedFollowUp(null);
          }}
          onSaved={loadData}
        />
      )}
    </div>
  );
};
