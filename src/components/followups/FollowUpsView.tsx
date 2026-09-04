import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  PhoneCall,
  MessageSquare,
  ChevronRight,
  MapPin,
  Tag,
  RefreshCw,
} from 'lucide-react';
import { crmData } from '../../db';
import type {
  EnrichedFollowUp,
  GroupedFollowUps,
} from '../../db/repositories/followUpRepository';
import { FollowUpModal } from './FollowUpModal';
import type { Lead } from '../../db/types';
import { SyncStatusBadge } from '../sync/SyncStatusBadge';
import { useToast } from '../common/Toast';
import { labelFor } from '../../lib/labels';

interface FollowUpsViewProps {
  onCallLead: (lead: Lead) => void;
  onOpenWhatsApp: (lead: Lead) => void;
  onOpenLead: (leadId: string) => void;
}

type SectionId = 'ALL' | 'OVERDUE' | 'TODAY' | 'UPCOMING';

/** F19 — skeleton matching the card list layout. */
const FollowUpsSkeleton: React.FC = () => (
  <div className="space-y-3 animate-pulse" aria-hidden="true">
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="bg-surface rounded-2xl border border-line p-4 space-y-3">
        <div className="h-4 w-40 rounded bg-inset" />
        <div className="h-3 w-56 rounded bg-inset" />
        <div className="h-8 w-full rounded-lg bg-inset" />
      </div>
    ))}
  </div>
);

export const FollowUpsView: React.FC<FollowUpsViewProps> = ({
  onCallLead,
  onOpenWhatsApp,
  onOpenLead,
}) => {
  const { showToast } = useToast();
  const [data, setData] = useState<GroupedFollowUps>({ overdue: [], today: [], upcoming: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>('ALL');
  const tabRefs = useRef<Record<SectionId, HTMLButtonElement | null>>({
    ALL: null,
    OVERDUE: null,
    TODAY: null,
    UPCOMING: null,
  });

  // Reschedule / Edit Modal State
  const [selectedFollowUp, setSelectedFollowUp] = useState<EnrichedFollowUp | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const grouped = await crmData.followUps.getGroupedPendingFollowUps();
      setData(grouped);
    } catch (err) {
      console.error('Failed to load follow-ups:', err);
      // F4 — never leave the screen blank on failure.
      setLoadError('Could not load your follow-ups.');
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
      showToast({
        message: 'Could not mark the follow-up as done. Please try again.',
        tone: 'error',
        action: { label: 'Retry', onClick: () => void handleComplete(id) },
      });
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
        return 'bg-danger-soft text-danger-text border-danger/30';
      case 'HIGH':
        return 'bg-warning-soft text-warning-text border-warning/30';
      case 'LOW':
        return 'bg-inset text-soft border-line';
      default:
        return 'bg-info-soft text-info-text border-info/30';
    }
  };

  // F14 — arrow-key navigation across the filter tabs.
  const handleTabKeyDown = (e: React.KeyboardEvent, id: SectionId) => {
    const order: SectionId[] = ['ALL', 'OVERDUE', 'TODAY', 'UPCOMING'];
    const idx = order.indexOf(id);
    let next: SectionId | null = null;
    if (e.key === 'ArrowRight') next = order[(idx + 1) % order.length];
    else if (e.key === 'ArrowLeft') next = order[(idx - 1 + order.length) % order.length];
    else if (e.key === 'Home') next = order[0];
    else if (e.key === 'End') next = order[order.length - 1];
    if (next) {
      e.preventDefault();
      setActiveSection(next);
      tabRefs.current[next]?.focus();
    }
  };

  const renderFollowUpCard = (item: EnrichedFollowUp, isOverdue = false) => {
    const lead = item.lead;
    const isMobile = lead?.phoneType === 'mobile';

    return (
      <div
        key={item.id}
        className={`bg-surface rounded-2xl border p-4 shadow-xs space-y-3 transition-all ${
          isOverdue ? 'border-danger/40 bg-danger-soft/40' : 'border-line hover:border-line-strong'
        }`}
      >
        {/* Top Title & Header — F3: real button instead of clickable div */}
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => onOpenLead(item.leadId)}
            aria-label={`Open lead ${lead?.businessName || 'Gym Lead'}`}
            className="flex-1 min-w-0 text-left group rounded-lg"
          >
            <span className="flex items-center gap-1">
              <span className="text-sm font-bold text-ink group-hover:text-accent-text truncate transition-colors">
                {lead?.businessName || 'Gym Lead'}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-faint group-hover:text-accent-text flex-shrink-0" aria-hidden="true" />
            </span>

            <span className="flex items-center gap-1 text-sm text-soft mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-faint" aria-hidden="true" />
              <span>{lead?.locality || 'Lucknow'}</span>
              {lead?.status && (
                <span className="text-xs bg-inset px-1.5 py-0.5 rounded font-medium text-soft ml-1">
                  {labelFor(lead.status)}
                </span>
              )}
            </span>
          </button>

          <span
            className={`text-xs font-bold px-2 py-1 rounded-full border ${getPriorityBadgeClass(
              item.priority
            )} flex-shrink-0`}
          >
            {labelFor(item.priority)}
          </span>
        </div>

        {/* Reason / Title */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Tag className="w-3.5 h-3.5 text-accent-text flex-shrink-0" aria-hidden="true" />
            <span>{item.title}</span>
          </div>

          {item.notes && (
            <p className="text-sm text-soft bg-inset p-2 rounded-lg border border-line line-clamp-2">
              {item.notes}
            </p>
          )}
        </div>

        {/* Scheduled Time Banner */}
        <div className="flex items-center justify-between gap-2 text-sm pt-2 border-t border-line flex-wrap">
          <div
            className={`flex items-center gap-1.5 font-bold ${
              isOverdue ? 'text-danger-text' : 'text-ink'
            }`}
          >
            {isOverdue ? (
              <AlertTriangle className="w-4 h-4 text-danger" aria-hidden="true" />
            ) : (
              <Clock className="w-4 h-4 text-info" aria-hidden="true" />
            )}
            <span>{formatDateTime(item.scheduledAt)}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleReschedule(item)}
              className="min-h-11 text-sm font-semibold text-soft hover:text-ink bg-inset hover:bg-inset-strong px-3 rounded-lg transition-colors"
            >
              Reschedule
            </button>
            <button
              type="button"
              onClick={() => handleComplete(item.id)}
              className="min-h-11 text-sm font-bold text-success-text bg-success-soft hover:bg-success/20 border border-success/30 px-3 rounded-lg transition-colors flex items-center gap-1"
            >
              <CheckCircle2 className="w-4 h-4 text-success" aria-hidden="true" />
              <span>Done</span>
            </button>
          </div>
        </div>

        {/* Quick Communication Bar */}
        {lead && (
          <div className="pt-2 border-t border-line flex items-center justify-between gap-2">
            <span className="font-mono text-sm font-bold text-ink truncate">
              {lead.phoneE164 || lead.phone}
            </span>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {isMobile ? (
                <button
                  type="button"
                  onClick={() => onOpenWhatsApp(lead as Lead)}
                  aria-label={`Send WhatsApp message to ${lead.businessName || 'lead'}`}
                  className="min-h-11 py-1 px-3 bg-accent hover:bg-accent-hover text-on-accent rounded-lg text-sm font-bold flex items-center gap-1 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" aria-hidden="true" />
                  <span>WhatsApp</span>
                </button>
              ) : (
                <span className="text-xs text-faint bg-inset border border-line px-2 py-1 rounded-lg">
                  WhatsApp not available
                </span>
              )}

              <button
                type="button"
                onClick={() => onCallLead(lead as Lead)}
                aria-label={`Call ${lead.businessName || 'lead'}`}
                className="min-h-11 py-1 px-3 bg-ink hover:opacity-90 text-app rounded-lg text-sm font-bold flex items-center gap-1 transition-colors"
              >
                <PhoneCall className="w-4 h-4 text-success" aria-hidden="true" />
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

  const tabs: { id: SectionId; label: string }[] = [
    { id: 'ALL', label: `All (${totalAll})` },
    { id: 'OVERDUE', label: `Overdue (${totalOverdue})` },
    { id: 'TODAY', label: `Today (${totalToday})` },
    { id: 'UPCOMING', label: `Upcoming (${totalUpcoming})` },
  ];

  return (
    <div className="min-h-screen bg-app flex flex-col pb-20">
      {/* Header */}
      <div className="bg-surface text-ink px-4 py-4 sticky top-0 z-30 shadow-md border-b border-line">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base font-bold tracking-tight truncate">Sales Follow-ups</h1>
            <p className="text-sm text-soft truncate">Scheduled calls &amp; sample visits</p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* F18 — sync status on data-entry surfaces */}
            <SyncStatusBadge />
            <span className="text-sm font-bold text-success-text bg-success-soft px-2.5 py-1 rounded-full border border-success/30">
              {totalAll} pending
            </span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-2xl w-full mx-auto p-4 flex-1 flex flex-col space-y-4">
        {/* Filter Pills — F14: tablist semantics + arrow keys */}
        <div
          role="tablist"
          aria-label="Filter follow-ups"
          className="flex items-center gap-2 overflow-x-auto pb-1"
        >
          {tabs.map((tab) => {
            const isSelected = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[tab.id] = el;
                }}
                type="button"
                role="tab"
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => setActiveSection(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, tab.id)}
                className={`min-h-11 py-1.5 px-3 rounded-xl font-bold text-sm whitespace-nowrap transition-colors ${
                  isSelected
                    ? 'bg-accent text-on-accent shadow-xs'
                    : 'bg-surface text-soft border border-line hover:bg-inset'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <FollowUpsSkeleton />
        ) : loadError ? (
          <div className="bg-surface rounded-2xl border border-danger/40 p-8 text-center my-auto space-y-3" role="alert">
            <AlertTriangle className="w-10 h-10 text-danger mx-auto" aria-hidden="true" />
            <h2 className="text-base font-bold text-ink">{loadError}</h2>
            <p className="text-sm text-soft max-w-xs mx-auto">
              Check your connection and try again. Your scheduled follow-ups are still saved on this device.
            </p>
            <button
              type="button"
              onClick={() => void loadData()}
              className="min-h-11 inline-flex items-center gap-2 px-4 rounded-xl bg-accent hover:bg-accent-hover text-on-accent text-sm font-bold transition-colors"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : totalAll === 0 ? (
          <div className="bg-surface rounded-2xl border border-line p-8 text-center my-auto space-y-3">
            <CheckCircle2 className="w-10 h-10 text-success mx-auto" aria-hidden="true" />
            <h2 className="text-base font-bold text-ink">All caught up!</h2>
            <p className="text-sm text-soft max-w-xs mx-auto">
              No pending follow-ups right now. Open any lead to schedule calls, sample drop-offs, or pricing negotiations.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* SECTION 1: OVERDUE */}
            {(activeSection === 'ALL' || activeSection === 'OVERDUE') && totalOverdue > 0 && (
              <section aria-label={`Overdue follow-ups (${totalOverdue})`} className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-sm font-bold text-danger-text">
                  <AlertTriangle className="w-4 h-4 text-danger" aria-hidden="true" />
                  <span>Overdue ({totalOverdue})</span>
                </div>
                <div className="space-y-2.5">
                  {data.overdue.map((item) => renderFollowUpCard(item, true))}
                </div>
              </section>
            )}

            {/* SECTION 2: TODAY */}
            {(activeSection === 'ALL' || activeSection === 'TODAY') && totalToday > 0 && (
              <section aria-label={`Scheduled for today (${totalToday})`} className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-sm font-bold text-success-text">
                  <Calendar className="w-4 h-4 text-success" aria-hidden="true" />
                  <span>Scheduled for today ({totalToday})</span>
                </div>
                <div className="space-y-2.5">
                  {data.today.map((item) => renderFollowUpCard(item, false))}
                </div>
              </section>
            )}

            {/* SECTION 3: UPCOMING */}
            {(activeSection === 'ALL' || activeSection === 'UPCOMING') && totalUpcoming > 0 && (
              <section aria-label={`Upcoming follow-ups (${totalUpcoming})`} className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-sm font-bold text-ink">
                  <Clock className="w-4 h-4 text-info" aria-hidden="true" />
                  <span>Upcoming follow-ups ({totalUpcoming})</span>
                </div>
                <div className="space-y-2.5">
                  {data.upcoming.map((item) => renderFollowUpCard(item, false))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Reschedule Modal */}
      {selectedFollowUp && (
        <FollowUpModal
          isOpen={isModalOpen}
          lead={selectedFollowUp.lead as Lead}
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
