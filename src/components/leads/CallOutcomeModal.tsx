import React, { useState, useEffect } from 'react';
import {
  PhoneCall,
  CheckCircle2,
  Tag,
  FileText,
  TrendingUp,
  AlertCircle,
  Loader2,
  Calendar,
  Clock,
} from 'lucide-react';
import type { CallOutcome, FollowUpPriority, Lead, LeadStatus } from '../../db/types';
import {
  CALL_OUTCOMES,
  QUICK_SALES_REMARKS,
  determineDefaultLeadStatus,
} from '../../services/callOutcomeMapping';
import { Modal } from '../common/Modal';

interface CallOutcomeModalProps {
  isOpen: boolean;
  lead: Lead | null;
  onSave: (data: {
    outcome: CallOutcome;
    quickRemark: string | null;
    customNote: string;
    updatedStatus: LeadStatus;
    reportedDurationSeconds?: number | null;
    followUp?: {
      scheduledAt: string;
      title: string;
      notes?: string;
      priority?: FollowUpPriority;
    };
  }) => Promise<void>;
  onCancel: () => void;
}

const ALL_STATUSES: Array<{ value: LeadStatus; label: string }> = [
  { value: 'NEW', label: 'New Lead' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'INTERESTED', label: 'Interested' },
  { value: 'SAMPLE_REQUESTED', label: 'Sample Requested' },
  { value: 'FOLLOW_UP', label: 'Follow Up' },
  { value: 'NEGOTIATION', label: 'Negotiation' },
  { value: 'CUSTOMER', label: 'Customer (Closed)' },
  { value: 'NOT_INTERESTED', label: 'Not Interested' },
  { value: 'WRONG_NUMBER', label: 'Wrong Number' },
  { value: 'DO_NOT_CONTACT', label: 'Do Not Contact' },
];

export const CallOutcomeModal: React.FC<CallOutcomeModalProps> = ({
  isOpen,
  lead,
  onSave,
  onCancel,
}) => {
  const [outcome, setOutcome] = useState<CallOutcome>('CONNECTED');
  const [quickRemark, setQuickRemark] = useState<string | null>(null);
  const [customNote, setCustomNote] = useState('');
  const [status, setStatus] = useState<LeadStatus>('CONTACTED');
  const [reportedMinutes, setReportedMinutes] = useState<string>('');

  // Follow-up scheduling state
  const [wantsFollowUp, setWantsFollowUp] = useState(false);
  const [followUpDays, setFollowUpDays] = useState<number>(1);
  const [followUpDateInput, setFollowUpDateInput] = useState('');
  const [followUpTitle, setFollowUpTitle] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getPresetDateISO = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    d.setHours(10, 0, 0, 0);
    return d.toISOString();
  };

  // Initialize or reset form when modal opens
  useEffect(() => {
    if (lead) {
      const initialOutcome: CallOutcome = 'CONNECTED';
      const initialStatus = determineDefaultLeadStatus(lead.status, initialOutcome, null);
      setOutcome(initialOutcome);
      setQuickRemark(null);
      setCustomNote('');
      setStatus(initialStatus);
      setReportedMinutes('');
      setWantsFollowUp(false);
      setFollowUpDays(1);
      setFollowUpDateInput('');
      setFollowUpTitle('');
      setError(null);
    }
  }, [isOpen, lead]);

  if (!lead) return null;

  const handleOutcomeChange = (newOutcome: CallOutcome) => {
    setOutcome(newOutcome);
    const recommendedStatus = determineDefaultLeadStatus(lead.status, newOutcome, quickRemark);
    setStatus(recommendedStatus);
    if (newOutcome === 'CALLBACK_REQUESTED' || newOutcome === 'BUSY') {
      setWantsFollowUp(true);
      setFollowUpTitle(`Call back ${lead.businessName}`);
    }
  };

  const handleQuickRemarkToggle = (remark: string) => {
    const nextRemark = quickRemark === remark ? null : remark;
    setQuickRemark(nextRemark);
    const recommendedStatus = determineDefaultLeadStatus(lead.status, outcome, nextRemark);
    setStatus(recommendedStatus);

    if (nextRemark === 'Call Later' || nextRemark === 'Meeting Required' || nextRemark === 'Asked for Sample') {
      setWantsFollowUp(true);
      setFollowUpTitle(`${nextRemark} — ${lead.businessName}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    let followUpData:
      | {
          scheduledAt: string;
          title: string;
          notes?: string;
          priority?: FollowUpPriority;
        }
      | undefined;

    if (wantsFollowUp) {
      let scheduledIso: string;
      if (followUpDateInput) {
        // Date-only input parses as UTC midnight; pin to 10:00 local.
        const d = new Date(`${followUpDateInput}T10:00:00`);
        if (isNaN(d.getTime())) {
          setError('Please pick a valid follow-up date.');
          setIsSubmitting(false);
          return;
        }
        scheduledIso = d.toISOString();
      } else {
        scheduledIso = getPresetDateISO(followUpDays);
      }

      followUpData = {
        scheduledAt: scheduledIso,
        title: followUpTitle.trim() || `Follow-up with ${lead.businessName}`,
        notes: customNote.trim() || undefined,
        priority: 'MEDIUM',
      };
    }

    const parsedMinutes = parseFloat(reportedMinutes);
    const reportedSeconds = !isNaN(parsedMinutes) && parsedMinutes > 0 ? Math.round(parsedMinutes * 60) : null;

    try {
      await onSave({
        outcome,
        quickRemark,
        customNote: customNote.trim(),
        updatedStatus: status,
        reportedDurationSeconds: reportedSeconds,
        followUp: followUpData,
      });
    } catch (err: any) {
      console.error('Failed to save call outcome:', err);
      setError(err.message || 'Failed to save call outcome.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sectionLabelClass = 'text-sm font-bold text-soft flex items-center gap-1.5';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={lead.businessName}
      subtitle={`${lead.phoneE164} • ${lead.locality}`}
      closeOnBackdrop={false}
      maxWidthClassName="max-w-lg"
      headerIcon={
        <span className="w-9 h-9 rounded-xl bg-accent-soft text-accent-text flex items-center justify-center flex-shrink-0">
          <PhoneCall className="w-5 h-5" aria-hidden="true" />
        </span>
      }
    >
      {/* Form Body */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" className="p-3 bg-danger-soft border border-danger/30 rounded-xl text-sm text-danger-text flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-danger flex-shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Call Outcome Selection */}
        <fieldset className="space-y-1.5">
          <legend className={sectionLabelClass}>
            <PhoneCall className="w-4 h-4 text-accent-text" aria-hidden="true" />
            <span>Call outcome</span>
            <span className="text-danger" aria-hidden="true">*</span>
          </legend>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {CALL_OUTCOMES.map((item) => {
              const isSelected = outcome === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => handleOutcomeChange(item.value)}
                  aria-pressed={isSelected}
                  className={`min-h-11 py-2 px-2.5 rounded-xl text-sm font-semibold border text-left transition-all ${
                    isSelected
                      ? 'bg-accent text-on-accent border-accent shadow-xs'
                      : 'bg-inset text-soft border-line hover:bg-inset-strong'
                  }`}
                >
                  <span className="truncate block">{item.label}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* 2. Quick Sales Remarks */}
        <fieldset className="space-y-1.5">
          <legend className={sectionLabelClass}>
            <Tag className="w-4 h-4 text-accent-text" aria-hidden="true" />
            <span>Quick remark (optional)</span>
          </legend>

          <div className="flex flex-wrap gap-1.5">
            {QUICK_SALES_REMARKS.map((remark) => {
              const isSelected = quickRemark === remark;
              return (
                <button
                  key={remark}
                  type="button"
                  onClick={() => handleQuickRemarkToggle(remark)}
                  aria-pressed={isSelected}
                  className={`min-h-11 py-1.5 px-2.5 rounded-lg text-sm font-medium border transition-all ${
                    isSelected
                      ? 'bg-accent text-on-accent border-accent shadow-xs'
                      : 'bg-accent-soft/60 text-accent-text border-accent/30 hover:bg-accent-soft'
                  }`}
                >
                  {remark}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* 3. Call Duration & Verification Status */}
        <div className="p-3 bg-inset rounded-2xl border border-line space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="reported-minutes" className={`${sectionLabelClass}`}>
              <Clock className="w-4 h-4 text-faint" aria-hidden="true" />
              <span>Call duration</span>
            </label>
            <span className="px-2 py-0.5 rounded-md bg-warning-soft text-warning-text text-xs font-bold border border-warning/30">
              Unverified (ACTION_DIAL)
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-soft font-medium">Automatic talk time:</span>
            <span className="text-soft font-semibold italic">Duration unavailable</span>
          </div>

          <div className="pt-1.5 border-t border-line flex items-center justify-between gap-2">
            <span className="text-sm text-soft">Reported talk time (optional, mins):</span>
            <input
              id="reported-minutes"
              type="number"
              min="0"
              max="120"
              step="1"
              placeholder="e.g. 3"
              value={reportedMinutes}
              onChange={(e) => setReportedMinutes(e.target.value)}
              className="w-24 min-h-11 text-sm bg-surface border border-line rounded-lg p-1.5 text-ink font-semibold text-right focus:outline-none focus:ring-2 focus:ring-focus-ring"
            />
          </div>
        </div>

        {/* 4. Custom Remark Notes */}
        <div className="space-y-1.5">
          <label htmlFor="custom-note" className={sectionLabelClass}>
            <FileText className="w-4 h-4 text-accent-text" aria-hidden="true" />
            <span>Sales notes / observation</span>
          </label>
          <textarea
            id="custom-note"
            rows={2}
            placeholder="e.g. Owner interested in 500g sample. Spoke with head trainer Vikram..."
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            className="w-full text-sm bg-inset border border-line rounded-xl p-2.5 text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-focus-ring font-medium"
          />
        </div>

        {/* 5. Quick Follow-up Section */}
        <div className="p-3 bg-info-soft/60 rounded-2xl border border-info/30 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="wants-follow-up" className="text-sm font-bold text-info-text flex items-center gap-1.5 cursor-pointer">
              <Calendar className="w-4 h-4" aria-hidden="true" />
              <span>Schedule next follow-up?</span>
            </label>
            <input
              id="wants-follow-up"
              type="checkbox"
              checked={wantsFollowUp}
              onChange={(e) => setWantsFollowUp(e.target.checked)}
              className="w-5 h-5 rounded accent-current"
            />
          </div>

          {wantsFollowUp && (
            <div className="space-y-2 pt-1 border-t border-info/20 animate-in fade-in">
              <div className="grid grid-cols-4 gap-1" role="group" aria-label="Quick follow-up date presets">
                {[
                  { label: 'Tomorrow', days: 1 },
                  { label: '2 days', days: 2 },
                  { label: '3 days', days: 3 },
                  { label: '1 week', days: 7 },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setFollowUpDays(p.days);
                      setFollowUpDateInput('');
                    }}
                    aria-pressed={followUpDays === p.days && !followUpDateInput}
                    className={`min-h-11 py-1 px-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      followUpDays === p.days && !followUpDateInput
                        ? 'bg-accent text-on-accent border-accent'
                        : 'bg-surface text-soft border-line hover:bg-inset'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* F5 audit gap — the custom date was never exposed; now it is. */}
              <div>
                <label htmlFor="follow-up-date" className="block text-sm font-semibold text-soft mb-1">
                  Or pick a specific date
                </label>
                <input
                  id="follow-up-date"
                  type="date"
                  value={followUpDateInput}
                  onChange={(e) => setFollowUpDateInput(e.target.value)}
                  className="w-full min-h-11 text-sm bg-surface border border-line rounded-lg p-2 text-ink focus:outline-none focus:ring-2 focus:ring-focus-ring"
                />
              </div>

              <div>
                <label htmlFor="follow-up-title" className="block text-sm font-semibold text-soft mb-1">
                  Follow-up reason
                </label>
                <input
                  id="follow-up-title"
                  type="text"
                  placeholder="e.g. Call for sample feedback"
                  value={followUpTitle}
                  onChange={(e) => setFollowUpTitle(e.target.value)}
                  className="w-full min-h-11 text-sm bg-surface border border-line rounded-lg p-2 text-ink font-semibold placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-focus-ring"
                />
              </div>
            </div>
          )}
        </div>

        {/* 6. Updated Pipeline Status */}
        <div className="space-y-1.5 pt-1 border-t border-line">
          <label htmlFor="pipeline-status" className="text-sm font-bold text-soft flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-accent-text" aria-hidden="true" />
              <span>Lead pipeline status</span>
            </span>
            <span className="text-xs text-faint font-normal">Auto-suggested</span>
          </label>

          <select
            id="pipeline-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as LeadStatus)}
            className="w-full min-h-11 text-sm bg-inset border border-line rounded-xl p-2.5 font-bold text-ink focus:outline-none focus:ring-2 focus:ring-focus-ring"
          >
            {ALL_STATUSES.map((st) => (
              <option key={st.value} value={st.value}>
                {st.label}
              </option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="pt-2 border-t border-line flex flex-col gap-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full min-h-12 py-3 px-4 rounded-xl font-bold text-sm bg-accent hover:bg-accent-hover active:scale-[0.99] text-on-accent shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            )}
            <span>Save call outcome &amp; notes</span>
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="w-full min-h-11 py-2.5 px-4 rounded-xl font-medium text-sm text-soft hover:text-ink hover:bg-inset transition-colors"
          >
            Skip / do not record
          </button>
        </div>
      </form>
    </Modal>
  );
};
