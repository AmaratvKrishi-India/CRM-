import React, { useState, useEffect } from 'react';
import {
  PhoneCall,
  X,
  CheckCircle2,
  Tag,
  FileText,
  TrendingUp,
  AlertCircle,
  Loader2,
  Calendar,
  Clock,
} from 'lucide-react';
import { CallOutcome, FollowUpPriority, Lead, LeadStatus } from '../../db/types';
import {
  CALL_OUTCOMES,
  QUICK_SALES_REMARKS,
  determineDefaultLeadStatus,
} from '../../services/callOutcomeMapping';

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
      setFollowUpTitle('');
      setError(null);
    }
  }, [isOpen, lead]);

  if (!isOpen || !lead) return null;

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
      const scheduledIso = followUpDateInput
        ? new Date(followUpDateInput).toISOString()
        : getPresetDateISO(followUpDays);

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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm truncate">{lead.businessName}</h3>
              <p className="text-[11px] text-slate-400 font-mono truncate">
                {lead.phoneE164} • {lead.locality}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Call Outcome Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-tight flex items-center gap-1.5">
              <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
              <span>Call Outcome</span>
              <span className="text-rose-500">*</span>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {CALL_OUTCOMES.map((item) => {
                const isSelected = outcome === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => handleOutcomeChange(item.value)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-semibold border text-left transition-all ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="truncate">{item.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Quick Sales Remarks */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-tight flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-emerald-600" />
              <span>Quick Remark (Optional)</span>
            </label>

            <div className="flex flex-wrap gap-1.5">
              {QUICK_SALES_REMARKS.map((remark) => {
                const isSelected = quickRemark === remark;
                return (
                  <button
                    key={remark}
                    type="button"
                    onClick={() => handleQuickRemarkToggle(remark)}
                    className={`py-1.5 px-2.5 rounded-lg text-xs font-medium border transition-all ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-emerald-50/60 text-emerald-900 border-emerald-200 hover:bg-emerald-100/60'
                    }`}
                  >
                    {remark}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Call Duration & Verification Status */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-tight flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Call Duration</span>
              </label>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 text-[10px] font-bold border border-amber-500/20">
                Unverified (ACTION_DIAL)
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Automatic Talk Time:</span>
              <span className="text-slate-700 font-semibold italic">Duration unavailable</span>
            </div>

            <div className="pt-1.5 border-t border-slate-200/70 flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500">Reported Talk Time (Optional mins):</span>
              <input
                type="number"
                min="0"
                max="120"
                step="1"
                placeholder="e.g. 3"
                value={reportedMinutes}
                onChange={(e) => setReportedMinutes(e.target.value)}
                className="w-20 text-xs bg-white border border-slate-200 rounded-lg p-1.5 text-slate-800 font-semibold text-right focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* 4. Custom Remark Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-tight flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              <span>Sales Notes / Observation</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Owner interested in 500g sample. Spoke with head trainer Vikram..."
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>

          {/* 4. Quick Follow-up Section */}
          <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-blue-900 uppercase tracking-tight flex items-center gap-1.5 cursor-pointer">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Schedule Next Follow-up?</span>
              </label>
              <input
                type="checkbox"
                checked={wantsFollowUp}
                onChange={(e) => setWantsFollowUp(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
              />
            </div>

            {wantsFollowUp && (
              <div className="space-y-2 pt-1 border-t border-blue-200/60 animate-in fade-in">
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { label: 'Tomorrow', days: 1 },
                    { label: '2 Days', days: 2 },
                    { label: '3 Days', days: 3 },
                    { label: '1 Week', days: 7 },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setFollowUpDays(p.days);
                        setFollowUpDateInput('');
                      }}
                      className={`py-1 px-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                        followUpDays === p.days && !followUpDateInput
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  placeholder="Follow-up reason (e.g. Call for sample feedback)"
                  value={followUpTitle}
                  onChange={(e) => setFollowUpTitle(e.target.value)}
                  className="w-full text-xs bg-white border border-blue-200 rounded-lg p-2 text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          {/* 5. Updated Pipeline Status */}
          <div className="space-y-1.5 pt-1 border-t border-slate-100">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-tight flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                <span>Lead Pipeline Status</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Auto-suggested</span>
            </label>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as LeadStatus)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {ALL_STATUSES.map((st) => (
                <option key={st.value} value={st.value}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>Save Call Outcome & Notes</span>
            </button>

            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl font-medium text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            >
              Skip / Do Not Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
