import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Phone,
  PhoneCall,
  MessageSquare,
  MapPin,
  Clock,
  Calendar,
  User,
  FileText,
  CheckCircle2,
  AlertCircle,
  Plus,
  PencilLine,
  AlertTriangle,
} from 'lucide-react';
import { crmData } from '../../db';
import type {
  Lead,
  CallOutcome,
  CallRecord,
  Remark,
  MessageHistory,
  FollowUp,
} from '../../db/types';
import type { LeadWithHistory } from '../../db/repositories/leadRepository';
import { FollowUpModal } from '../followups/FollowUpModal';
import { EditLeadModal } from './EditLeadModal';
import { Modal } from '../common/Modal';
import { SyncStatusBadge } from '../sync/SyncStatusBadge';
import { useToast } from '../common/Toast';
import { labelFor } from '../../lib/labels';
import { leadStatusBadgeClass } from '../../lib/leadStatusStyles';

interface LeadDetailViewProps {
  leadId: string;
  onBack: () => void;
  onCallLead: (lead: Lead) => void;
  onOpenOutcomeModal: (lead: Lead) => void;
  onOpenWhatsApp: (lead: Lead) => void;
}

type TabId = 'CALLS' | 'REMARKS' | 'FOLLOW_UPS' | 'MESSAGES';

const TAB_ORDER: TabId[] = ['CALLS', 'REMARKS', 'FOLLOW_UPS', 'MESSAGES'];

const getOutcomeBadgeClass = (outcome: CallOutcome): string => {
  switch (outcome) {
    case 'CONNECTED':
      return 'bg-success-soft text-success-text border-success/30';
    case 'CALLBACK_REQUESTED':
      return 'bg-info-soft text-info-text border-info/30';
    case 'BUSY':
    case 'NO_ANSWER':
      return 'bg-warning-soft text-warning-text border-warning/30';
    case 'WRONG_NUMBER':
    case 'INVALID_NUMBER':
      return 'bg-danger-soft text-danger-text border-danger/30';
    default:
      return 'bg-inset text-soft border-line';
  }
};

const formatTimestamp = (isoString?: string | null): string => {
  if (!isoString) return 'Never';
  return new Date(isoString).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const nextHistoryTab = (current: TabId, key: string): TabId | null => {
  const index = TAB_ORDER.indexOf(current);
  if (key === 'ArrowRight') return TAB_ORDER[(index + 1) % TAB_ORDER.length];
  if (key === 'ArrowLeft') return TAB_ORDER[(index - 1 + TAB_ORDER.length) % TAB_ORDER.length];
  if (key === 'Home') return TAB_ORDER[0];
  if (key === 'End') return TAB_ORDER[TAB_ORDER.length - 1];
  return null;
};

const tabButtonClass = (selected: boolean): string =>
  `min-h-11 py-1.5 px-2.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-1 whitespace-nowrap ${
    selected ? 'bg-accent text-on-accent' : 'text-soft hover:bg-inset'
  }`;

interface LeadProfileCardProps {
  lead: Lead;
  followUps?: FollowUp[];
  onEdit: () => void;
  onCancelFollowUp: (followUp: FollowUp) => void;
  onRescheduleFollowUp: (followUp: FollowUp | null) => void;
  onCompleteFollowUp: (id: string) => void;
  onCallLead: (lead: Lead) => void;
  onOpenWhatsApp: (lead: Lead) => void;
  onOpenOutcomeModal: (lead: Lead) => void;
}

const LeadProfileCard: React.FC<LeadProfileCardProps> = ({
  lead,
  followUps,
  onEdit,
  onCancelFollowUp,
  onRescheduleFollowUp,
  onCompleteFollowUp,
  onCallLead,
  onOpenWhatsApp,
  onOpenOutcomeModal,
}) => {
  const isCallable = lead.phoneType !== 'invalid' && Boolean(lead.phone);
  const isMobile = lead.phoneType === 'mobile';
  const isLandline = lead.phoneType === 'landline';
  const nextPendingFollowUp = followUps
    ?.filter((followUp) => followUp.status === 'PENDING')
    .sort((a, b) => (a.scheduledAt > b.scheduledAt ? 1 : -1))[0];

  return (
    <div className="bg-surface rounded-2xl border border-line p-4 shadow-xs space-y-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-lg font-bold text-ink leading-tight">{lead.businessName}</h1>
          <span className="text-xs bg-inset text-soft px-2 py-0.5 rounded font-medium">
            {lead.category}
          </span>
          <button
            type="button"
            onClick={onEdit}
            aria-label={'Edit lead ' + lead.businessName}
            id="edit-lead-button"
            className="min-h-11 min-w-11 -my-2 px-2 inline-flex items-center justify-center gap-1 rounded-lg text-sm font-semibold text-accent-text hover:bg-accent-soft transition-colors"
          >
            <PencilLine className="w-4 h-4" aria-hidden="true" />
            <span>Edit</span>
          </button>
        </div>
        {lead.contactPerson && (
          <div className="flex items-center gap-1.5 text-sm text-soft font-medium">
            <User className="w-4 h-4 text-faint" aria-hidden="true" />
            <span>Contact: {lead.contactPerson}</span>
          </div>
        )}
      </div>

      <div className="space-y-1.5 text-sm text-soft pt-2 border-t border-line">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-mono font-bold text-ink">
            <Phone className="w-4 h-4 text-success" aria-hidden="true" />
            <span>{lead.phoneE164}</span>
            {isLandline && (
              <span className="text-xs text-info-text bg-info-soft px-1.5 py-0.5 rounded border border-info/30 font-normal">
                Lucknow landline (0522)
              </span>
            )}
          </div>
        </div>
        <div className="flex items-start gap-1.5 text-soft">
          <MapPin className="w-4 h-4 text-faint flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="leading-snug">
            <span className="font-medium text-ink">{lead.locality}</span>
            {lead.pincode && <span> (PIN: {lead.pincode})</span>}
            <p className="text-sm text-faint mt-0.5">{lead.address}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-line text-center text-sm">
        <div className="bg-inset rounded-xl p-2 border border-line">
          <span className="text-xs text-faint font-semibold block">Calls</span>
          <span className="font-bold text-ink text-base">{lead.callCount}</span>
        </div>
        <div className="bg-inset rounded-xl p-2 border border-line">
          <span className="text-xs text-faint font-semibold block">Last spoke</span>
          <span className="font-medium text-soft text-xs truncate block">
            {lead.lastContactedAt ? formatTimestamp(lead.lastContactedAt).split(',')[0] : 'Never'}
          </span>
        </div>
        <div className="bg-inset rounded-xl p-2 border border-line">
          <span className="text-xs text-faint font-semibold block">Follow-up</span>
          <span className="font-medium text-soft text-xs truncate block">
            {lead.nextFollowUpAt ? lead.nextFollowUpAt.slice(0, 10) : 'None'}
          </span>
        </div>
      </div>

      <div className="pt-2 border-t border-line">
        {nextPendingFollowUp ? (
          <div className="bg-info-soft/60 border border-info/30 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-info-text flex items-center gap-1.5">
                <Calendar className="w-4 h-4" aria-hidden="true" />
                <span>Next follow-up</span>
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-info-soft text-info-text border border-info/30">
                {labelFor(nextPendingFollowUp.priority)}
              </span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-ink">{nextPendingFollowUp.title}</h4>
              <div className="flex items-center gap-1.5 text-sm text-soft mt-0.5">
                <Clock className="w-4 h-4 text-info" aria-hidden="true" />
                <span className="font-bold text-info-text">
                  {formatTimestamp(nextPendingFollowUp.scheduledAt)}
                </span>
              </div>
              {nextPendingFollowUp.notes && (
                <p className="text-sm text-soft mt-1">{nextPendingFollowUp.notes}</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-info/20">
              <button
                type="button"
                onClick={() => onCancelFollowUp(nextPendingFollowUp)}
                className="min-h-11 px-2 text-sm text-soft hover:text-danger-text rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onRescheduleFollowUp(nextPendingFollowUp)}
                className="min-h-11 text-sm font-semibold text-soft bg-surface border border-line hover:bg-inset px-3 rounded-lg transition-colors"
              >
                Reschedule
              </button>
              <button
                type="button"
                onClick={() => onCompleteFollowUp(nextPendingFollowUp.id)}
                className="min-h-11 text-sm font-bold text-on-accent bg-accent hover:bg-accent-hover px-3 rounded-lg transition-colors flex items-center gap-1 shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                <span>Complete</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-inset border border-line rounded-xl p-2.5 flex items-center justify-between gap-2">
            <span className="text-sm text-soft font-medium">No follow-up reminder set</span>
            <button
              type="button"
              onClick={() => onRescheduleFollowUp(null)}
              className="min-h-11 text-sm font-bold text-accent-text bg-accent-soft hover:bg-accent/20 border border-accent/30 px-3 rounded-lg flex items-center gap-1 transition-colors"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Schedule follow-up</span>
            </button>
          </div>
        )}
      </div>

      <div className="pt-2 flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onCallLead(lead)}
            disabled={!isCallable}
            id="call-button"
            className="min-h-12 py-3 px-3 rounded-xl bg-ink hover:opacity-90 disabled:opacity-40 text-app font-bold text-sm shadow-md active:scale-[0.99] transition-all flex items-center justify-center gap-2"
          >
            <PhoneCall className="w-4 h-4 text-success" aria-hidden="true" />
            <span>Call</span>
          </button>
          {isMobile ? (
            <button
              type="button"
              onClick={() => onOpenWhatsApp(lead)}
              className="min-h-12 py-3 px-3 rounded-xl bg-accent hover:bg-accent-hover active:scale-[0.99] text-on-accent font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-4 h-4" aria-hidden="true" />
              <span>WhatsApp</span>
            </button>
          ) : (
            <button
              type="button"
              disabled
              aria-label="WhatsApp unavailable — landline number"
              className="min-h-12 py-3 px-2 rounded-xl bg-inset border border-line text-faint text-sm font-semibold flex items-center justify-center text-center cursor-not-allowed leading-tight"
            >
              <span>WhatsApp unavailable — landline</span>
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => onOpenOutcomeModal(lead)}
          className="w-full min-h-12 py-2.5 px-3 rounded-xl border border-line bg-inset hover:bg-inset-strong text-soft font-semibold text-sm transition-colors flex items-center justify-center gap-1.5"
        >
          <CheckCircle2 className="w-4 h-4 text-success" aria-hidden="true" />
          <span>Log call outcome &amp; add remark</span>
        </button>
      </div>
    </div>
  );
};

interface LeadHistoryTabsProps {
  activeTab: TabId;
  callCount: number;
  remarkCount: number;
  followUpCount: number;
  messageCount: number;
  tabRefs: React.MutableRefObject<Record<TabId, HTMLButtonElement | null>>;
  onSelectTab: (tab: TabId) => void;
  onKeyDown: (event: React.KeyboardEvent, tab: TabId) => void;
  onAddRemark: () => void;
  onScheduleFollowUp: () => void;
}

const LeadHistoryTabs: React.FC<LeadHistoryTabsProps> = ({
  activeTab,
  callCount,
  remarkCount,
  followUpCount,
  messageCount,
  tabRefs,
  onSelectTab,
  onKeyDown,
  onAddRemark,
  onScheduleFollowUp,
}) => (
  <div className="flex items-center justify-between gap-2 border-b border-line pb-1">
    <div role="tablist" aria-label="Lead history" className="flex items-center gap-1.5 overflow-x-auto">
      <button
        ref={(element) => { tabRefs.current.CALLS = element; }}
        type="button"
        role="tab"
        aria-selected={activeTab === 'CALLS'}
        tabIndex={activeTab === 'CALLS' ? 0 : -1}
        onClick={() => onSelectTab('CALLS')}
        onKeyDown={(event) => onKeyDown(event, 'CALLS')}
        className={tabButtonClass(activeTab === 'CALLS')}
      >
        <PhoneCall className="w-4 h-4" aria-hidden="true" />
        <span>Calls ({callCount})</span>
      </button>
      <button
        ref={(element) => { tabRefs.current.REMARKS = element; }}
        type="button"
        role="tab"
        aria-selected={activeTab === 'REMARKS'}
        tabIndex={activeTab === 'REMARKS' ? 0 : -1}
        onClick={() => onSelectTab('REMARKS')}
        onKeyDown={(event) => onKeyDown(event, 'REMARKS')}
        className={tabButtonClass(activeTab === 'REMARKS')}
      >
        <FileText className="w-4 h-4" aria-hidden="true" />
        <span>Remarks ({remarkCount})</span>
      </button>
      <button
        ref={(element) => { tabRefs.current.FOLLOW_UPS = element; }}
        type="button"
        role="tab"
        aria-selected={activeTab === 'FOLLOW_UPS'}
        tabIndex={activeTab === 'FOLLOW_UPS' ? 0 : -1}
        onClick={() => onSelectTab('FOLLOW_UPS')}
        onKeyDown={(event) => onKeyDown(event, 'FOLLOW_UPS')}
        className={tabButtonClass(activeTab === 'FOLLOW_UPS')}
      >
        <Calendar className="w-4 h-4" aria-hidden="true" />
        <span>Follow-ups ({followUpCount})</span>
      </button>
      <button
        ref={(element) => { tabRefs.current.MESSAGES = element; }}
        type="button"
        role="tab"
        aria-selected={activeTab === 'MESSAGES'}
        tabIndex={activeTab === 'MESSAGES' ? 0 : -1}
        onClick={() => onSelectTab('MESSAGES')}
        onKeyDown={(event) => onKeyDown(event, 'MESSAGES')}
        className={tabButtonClass(activeTab === 'MESSAGES')}
      >
        <MessageSquare className="w-4 h-4" aria-hidden="true" />
        <span>WhatsApp ({messageCount})</span>
      </button>
    </div>
    {activeTab === 'REMARKS' && (
      <button
        type="button"
        onClick={onAddRemark}
        className="min-h-11 text-sm font-semibold text-success-text bg-success-soft hover:bg-success/20 border border-success/30 px-2.5 rounded-lg flex items-center gap-1 transition-colors flex-shrink-0"
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
        <span>Add note</span>
      </button>
    )}
    {activeTab === 'FOLLOW_UPS' && (
      <button
        type="button"
        onClick={onScheduleFollowUp}
        className="min-h-11 text-sm font-semibold text-accent-text bg-accent-soft hover:bg-accent/20 border border-accent/30 px-2.5 rounded-lg flex items-center gap-1 transition-colors flex-shrink-0"
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
        <span>Schedule</span>
      </button>
    )}
  </div>
);

const CallHistoryPanel: React.FC<{ active: boolean; calls: CallRecord[] }> = ({ active, calls }) => {
  if (!active) return null;
  return (
    <div className="space-y-2" role="tabpanel" aria-label="Call history">
      {calls.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-line p-8 text-center space-y-2">
          <PhoneCall className="w-8 h-8 text-faint mx-auto" aria-hidden="true" />
          <h4 className="text-sm font-bold text-ink">No call history yet</h4>
          <p className="text-sm text-faint max-w-xs mx-auto">
            Tap "Call" to dial this gym, then record your call outcome.
          </p>
        </div>
      ) : (
        calls.map((call) => (
          <div key={call.id} className="bg-surface rounded-xl border border-line p-3 shadow-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className={'text-xs font-bold px-2 py-0.5 rounded-full border ' + getOutcomeBadgeClass(call.outcome)}>
                {labelFor(call.outcome)}
              </span>
              <span className="text-xs text-faint flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{formatTimestamp(call.startedAt)}</span>
              </span>
            </div>
            {call.remark && (
              <p className="text-sm text-soft bg-inset p-2 rounded-lg border border-line">{call.remark}</p>
            )}
          </div>
        ))
      )}
    </div>
  );
};

const RemarksPanel: React.FC<{ active: boolean; remarks: Remark[] }> = ({ active, remarks }) => {
  if (!active) return null;
  return (
    <div className="space-y-2" role="tabpanel" aria-label="Remarks">
      {remarks.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-line p-8 text-center space-y-2">
          <FileText className="w-8 h-8 text-faint mx-auto" aria-hidden="true" />
          <h4 className="text-sm font-bold text-ink">No remarks recorded yet</h4>
          <p className="text-sm text-faint max-w-xs mx-auto">
            Log customer requirements, sample requests, and meeting notes.
          </p>
        </div>
      ) : (
        remarks.map((remark) => (
          <div key={remark.id} className="bg-surface rounded-xl border border-line p-3 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-xs text-faint">
              <span className="font-semibold text-soft">{remark.author}</span>
              <span>{formatTimestamp(remark.createdAt)}</span>
            </div>
            <p className="text-sm text-ink leading-relaxed font-medium">{remark.content}</p>
          </div>
        ))
      )}
    </div>
  );
};

interface FollowUpsPanelProps {
  active: boolean;
  followUps?: FollowUp[];
  onReschedule: (followUp: FollowUp) => void;
  onComplete: (id: string) => void;
}

const FollowUpsPanel: React.FC<FollowUpsPanelProps> = ({ active, followUps, onReschedule, onComplete }) => {
  if (!active) return null;
  return (
    <div className="space-y-2" role="tabpanel" aria-label="Follow-ups">
      {!followUps || followUps.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-line p-8 text-center space-y-2">
          <Calendar className="w-8 h-8 text-faint mx-auto" aria-hidden="true" />
          <h4 className="text-sm font-bold text-ink">No follow-ups logged</h4>
          <p className="text-sm text-faint max-w-xs mx-auto">
            Schedule callbacks, sample deliveries, or owner meetings.
          </p>
        </div>
      ) : (
        followUps.map((followUp) => (
          <div key={followUp.id} className="bg-surface rounded-xl border border-line p-3 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span
                className={'text-xs font-bold px-2 py-0.5 rounded-full border ' +
                  (followUp.status === 'COMPLETED'
                    ? 'bg-success-soft text-success-text border-success/30'
                    : followUp.status === 'CANCELLED'
                      ? 'bg-inset text-faint border-line'
                      : 'bg-info-soft text-info-text border-info/30')}
              >
                {labelFor(followUp.status)}
              </span>
              <span className="text-xs text-faint flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{formatTimestamp(followUp.scheduledAt)}</span>
              </span>
            </div>
            <h5 className="text-sm font-bold text-ink">{followUp.title}</h5>
            {followUp.notes && (
              <p className="text-sm text-soft bg-inset p-2 rounded-lg border border-line">{followUp.notes}</p>
            )}
            {followUp.status === 'PENDING' && (
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-line">
                <button
                  type="button"
                  onClick={() => onReschedule(followUp)}
                  className="min-h-11 px-2 text-sm text-soft hover:text-ink font-semibold rounded-lg"
                >
                  Reschedule
                </button>
                <button
                  type="button"
                  onClick={() => onComplete(followUp.id)}
                  className="min-h-11 text-sm font-bold text-success-text bg-success-soft hover:bg-success/20 px-3 rounded-lg transition-colors flex items-center gap-1"
                >
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  <span>Done</span>
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

const MessagesPanel: React.FC<{ active: boolean; messages?: MessageHistory[] }> = ({ active, messages }) => {
  if (!active) return null;
  return (
    <div className="space-y-2" role="tabpanel" aria-label="WhatsApp messages">
      {!messages || messages.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-line p-8 text-center space-y-2">
          <MessageSquare className="w-8 h-8 text-faint mx-auto" aria-hidden="true" />
          <h4 className="text-sm font-bold text-ink">No WhatsApp messages logged</h4>
          <p className="text-sm text-faint max-w-xs mx-auto">
            Tap "WhatsApp" above to send pitch templates and catalogues.
          </p>
        </div>
      ) : (
        messages.map((message) => (
          <div key={message.id} className="bg-surface rounded-xl border border-line p-3 shadow-xs space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span
                className={'text-xs font-bold px-2 py-0.5 rounded-full border ' +
                  (message.sentStatus === 'INITIATED'
                    ? 'bg-info-soft text-info-text border-info/30'
                    : message.sentStatus === 'SENT'
                      ? 'bg-success-soft text-success-text border-success/30'
                      : 'bg-danger-soft text-danger-text border-danger/30')}
              >
                {labelFor(message.sentStatus)}
              </span>
              <span className="text-xs text-faint flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{formatTimestamp(message.sentAt)}</span>
              </span>
            </div>
            <p className="text-sm text-soft bg-inset p-2 rounded-lg border border-line whitespace-pre-wrap font-mono">
              {message.messageContent}
            </p>
          </div>
        ))
      )}
    </div>
  );
};

export const LeadDetailView: React.FC<LeadDetailViewProps> = ({
  leadId,
  onBack,
  onCallLead,
  onOpenOutcomeModal,
  onOpenWhatsApp,
}) => {
  const { showToast } = useToast();
  const [data, setData] = useState<LeadWithHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('CALLS');
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({
    CALLS: null,
    REMARKS: null,
    FOLLOW_UPS: null,
    MESSAGES: null,
  });

  // Quick Inline Remark State
  const [showAddRemark, setShowAddRemark] = useState(false);
  const [newRemarkText, setNewRemarkText] = useState('');
  const [savingRemark, setSavingRemark] = useState(false);

  // Follow-up Modal State
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [selectedFollowUpToReschedule, setSelectedFollowUpToReschedule] = useState<FollowUp | null>(null);

  // F13 — in-app confirmation replaces window.confirm
  const [followUpToCancel, setFollowUpToCancel] = useState<FollowUp | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // F20 — lead edit flow
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const fetchLeadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const historyData = await crmData.leads.getLeadWithFullHistory(leadId);
      if (!historyData) {
        throw new Error('Lead not found.');
      }
      setData(historyData);
    } catch (err: unknown) {
      console.error('Failed to load lead details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load lead details.');
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    fetchLeadData();
  }, [fetchLeadData]);

  const handleSaveInlineRemark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRemarkText.trim() || !data) return;
    setSavingRemark(true);
    try {
      await crmData.remarks.addRemark({
        leadId: data.lead.id,
        content: newRemarkText.trim(),
        type: 'CUSTOM',
        author: 'Sales Rep',
      });
      setNewRemarkText('');
      setShowAddRemark(false);
      await fetchLeadData();
    } catch (err: unknown) {
      console.error('Failed to add remark:', err);
      // F4 — surface the failure; keep the draft so work is not lost.
      showToast({
        message: 'Could not save the remark. Please try again.',
        tone: 'error',
        action: { label: 'Retry', onClick: () => void handleSaveInlineRemark(e) },
      });
    } finally {
      setSavingRemark(false);
    }
  };

  const handleCompleteFollowUp = async (id: string) => {
    try {
      await crmData.followUps.completeFollowUp(id);
      await fetchLeadData();
    } catch (err) {
      console.error('Failed to complete follow up:', err);
      showToast({
        message: 'Could not mark the follow-up as done. Please try again.',
        tone: 'error',
        action: { label: 'Retry', onClick: () => void handleCompleteFollowUp(id) },
      });
    }
  };

  const handleConfirmCancelFollowUp = async () => {
    if (!followUpToCancel) return;
    const id = followUpToCancel.id;
    setCancelling(true);
    try {
      await crmData.followUps.cancelFollowUp(id);
      setFollowUpToCancel(null);
      await fetchLeadData();
    } catch (err) {
      console.error('Failed to cancel follow up:', err);
      showToast({
        message: 'Could not cancel the follow-up. Please try again.',
        tone: 'error',
        action: { label: 'Retry', onClick: () => void handleConfirmCancelFollowUp() },
      });
    } finally {
      setCancelling(false);
    }
  };

  // F14 — arrow-key navigation across history tabs.
  const handleTabKeyDown = (e: React.KeyboardEvent, id: TabId) => {
    const next = nextHistoryTab(id, e.key);
    if (!next) return;
    e.preventDefault();
    setActiveTab(next);
    tabRefs.current[next]?.focus();
  };

  if (loading) {
    return (
      <div id="lead-detail" className="min-h-screen bg-app flex flex-col pb-20">
        <div className="bg-surface px-4 py-3 sticky top-0 z-30 border-b border-line">
          <div className="max-w-2xl mx-auto">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to leads list"
              id="back-button"
              className="min-h-11 px-2 -ml-2 text-soft hover:text-ink rounded-xl hover:bg-inset transition-colors flex items-center gap-1 text-sm font-semibold"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>Back</span>
            </button>
          </div>
        </div>
        <div className="max-w-2xl w-full mx-auto p-4 space-y-3 animate-pulse" aria-hidden="true">
          <div className="bg-surface rounded-2xl border border-line p-4 space-y-3">
            <div className="h-5 w-48 rounded bg-inset" />
            <div className="h-4 w-64 rounded bg-inset" />
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-inset" />
              ))}
            </div>
            <div className="h-12 rounded-xl bg-inset" />
          </div>
          <div className="h-10 w-full rounded-xl bg-inset" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-app flex flex-col items-center justify-center p-4">
        <div className="bg-surface rounded-2xl border border-line p-6 max-w-sm w-full text-center space-y-4 shadow-sm" role="alert">
          <AlertCircle className="w-10 h-10 text-danger mx-auto" aria-hidden="true" />
          <h3 className="text-base font-bold text-ink">Lead profile error</h3>
          <p className="text-sm text-soft">{error || 'Lead not found.'}</p>
          <button
            type="button"
            onClick={onBack}
            className="w-full min-h-11 bg-accent hover:bg-accent-hover text-on-accent rounded-xl text-sm font-semibold transition-colors"
          >
            Return to leads list
          </button>
        </div>
      </div>
    );
  }

  const { lead, callHistory, remarks, messageHistory, followUps } = data;

  return (
    <div id="lead-detail" className="min-h-screen bg-app flex flex-col pb-20">
      {/* Sticky Header Bar */}
      <div className="bg-surface text-ink px-4 py-3 sticky top-0 z-30 shadow-md border-b border-line">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to leads list"
            id="back-button"
            className="min-h-11 px-2 -ml-2 text-soft hover:text-ink rounded-xl hover:bg-inset transition-colors flex items-center gap-1 text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2 min-w-0">
            {/* F18 — sync status on data-entry surfaces */}
            <SyncStatusBadge />
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full border ${leadStatusBadgeClass(
                lead.status
              )}`}
            >
              {labelFor(lead.status)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl w-full mx-auto p-4 flex-1 flex flex-col space-y-3">
        {/* Lead Profile Header Card */}
        <LeadProfileCard
          lead={lead}
          followUps={followUps}
          onEdit={() => setIsEditModalOpen(true)}
          onCancelFollowUp={setFollowUpToCancel}
          onRescheduleFollowUp={(followUp) => {
            setSelectedFollowUpToReschedule(followUp);
            setIsFollowUpModalOpen(true);
          }}
          onCompleteFollowUp={handleCompleteFollowUp}
          onCallLead={onCallLead}
          onOpenWhatsApp={onOpenWhatsApp}
          onOpenOutcomeModal={onOpenOutcomeModal}
        />

        {/* History Tabs Navigation  F14: tablist semantics + arrow keys */}
        <LeadHistoryTabs
          activeTab={activeTab}
          callCount={callHistory.length}
          remarkCount={remarks.length}
          followUpCount={followUps?.length ?? 0}
          messageCount={messageHistory?.length ?? 0}
          tabRefs={tabRefs}
          onSelectTab={setActiveTab}
          onKeyDown={handleTabKeyDown}
          onAddRemark={() => setShowAddRemark(true)}
          onScheduleFollowUp={() => {
            setSelectedFollowUpToReschedule(null);
            setIsFollowUpModalOpen(true);
          }}
        />

        {/* Inline Add Note Form */}
        {showAddRemark && (
          <form
            onSubmit={handleSaveInlineRemark}
            className="bg-surface rounded-xl border border-accent/30 p-3 shadow-xs space-y-2 animate-in fade-in"
          >
            <div className="flex items-center justify-between">
              <label htmlFor="inline-remark" className="text-sm font-bold text-ink">
                Add sales remark
              </label>
              <button
                type="button"
                onClick={() => setShowAddRemark(false)}
                className="min-h-11 px-2 text-soft hover:text-ink text-sm rounded-lg"
              >
                Cancel
              </button>
            </div>
            <textarea
              id="inline-remark"
              rows={2}
              placeholder="Type sales remark or observation..."
              value={newRemarkText}
              onChange={(e) => setNewRemarkText(e.target.value)}
              className="w-full text-sm bg-inset border border-line rounded-lg p-2.5 text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-focus-ring font-medium"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="submit"
                disabled={savingRemark || !newRemarkText.trim()}
                className="min-h-11 px-4 bg-accent hover:bg-accent-hover text-on-accent text-sm font-bold rounded-lg disabled:opacity-50 transition-colors"
              >
                {savingRemark ? 'Saving…' : 'Save remark'}
              </button>
            </div>
          </form>
        )}

        <CallHistoryPanel active={activeTab === 'CALLS'} calls={callHistory} />
        <RemarksPanel active={activeTab === 'REMARKS'} remarks={remarks} />
        <FollowUpsPanel
          active={activeTab === 'FOLLOW_UPS'}
          followUps={followUps}
          onReschedule={(followUp) => {
            setSelectedFollowUpToReschedule(followUp);
            setIsFollowUpModalOpen(true);
          }}
          onComplete={handleCompleteFollowUp}
        />
        <MessagesPanel active={activeTab === 'MESSAGES'} messages={messageHistory} />

      </div>

      {/* F13 — in-app cancel confirmation naming the specific follow-up */}
      <Modal
        isOpen={followUpToCancel !== null}
        onClose={() => setFollowUpToCancel(null)}
        title="Cancel this follow-up?"
        subtitle={
          followUpToCancel
            ? `"${followUpToCancel.title}" scheduled for ${formatTimestamp(followUpToCancel.scheduledAt)}`
            : undefined
        }
        closeOnBackdrop={false}
        headerIcon={
          <span className="w-9 h-9 rounded-xl bg-danger-soft text-danger flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          </span>
        }
      >
        <p className="text-sm text-soft">
          The reminder will be removed from your follow-up list. This cannot be undone.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFollowUpToCancel(null)}
            className="flex-1 min-h-11 rounded-xl border border-line text-sm font-bold text-soft hover:bg-inset transition-colors"
          >
            Keep it
          </button>
          <button
            type="button"
            onClick={() => void handleConfirmCancelFollowUp()}
            disabled={cancelling}
            className="flex-1 min-h-11 rounded-xl bg-danger text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {cancelling ? 'Cancelling…' : 'Cancel follow-up'}
          </button>
        </div>
      </Modal>

      {/* F20 — lead edit modal */}
      {isEditModalOpen && (
        <EditLeadModal
          isOpen={isEditModalOpen}
          lead={lead}
          onClose={() => setIsEditModalOpen(false)}
          onLeadUpdated={() => void fetchLeadData()}
        />
      )}

      {/* Follow-up Scheduling / Reschedule Modal */}
      <FollowUpModal
        isOpen={isFollowUpModalOpen}
        lead={lead}
        existingFollowUp={selectedFollowUpToReschedule}
        onClose={() => {
          setIsFollowUpModalOpen(false);
          setSelectedFollowUpToReschedule(null);
        }}
        onSaved={fetchLeadData}
      />
    </div>
  );
};
