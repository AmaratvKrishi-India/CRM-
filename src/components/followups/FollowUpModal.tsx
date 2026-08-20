import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Tag,
  FileText,
  Bell,
} from 'lucide-react';
import { crmData } from '../../db';
import { FollowUp, FollowUpPriority, Lead } from '../../db/types';
import { NativePlatformService } from '../../services/nativePlatform';

interface FollowUpModalProps {
  isOpen: boolean;
  lead: Lead | null;
  existingFollowUp?: FollowUp | null;
  initialTitle?: string;
  onClose: () => void;
  onSaved: () => void;
}

export const FollowUpModal: React.FC<FollowUpModalProps> = ({
  isOpen,
  lead,
  existingFollowUp,
  initialTitle,
  onClose,
  onSaved,
}) => {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<FollowUpPriority>('MEDIUM');
  const [scheduledAt, setScheduledAt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper to format ISO to datetime-local string
  const formatForInput = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`;
  };

  const getPresetDate = (daysAhead: number, hours = 10, minutes = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    d.setHours(hours, minutes, 0, 0);
    return d;
  };

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (existingFollowUp) {
        setTitle(existingFollowUp.title);
        setNotes(existingFollowUp.notes || '');
        setPriority(existingFollowUp.priority);
        setScheduledAt(formatForInput(new Date(existingFollowUp.scheduledAt)));
      } else {
        setTitle(initialTitle || 'Follow-up regarding Amaratv Krishi sample & pricing');
        setNotes('');
        setPriority('MEDIUM');
        // Default to Tomorrow at 10:00 AM
        setScheduledAt(formatForInput(getPresetDate(1, 10, 0)));
      }
    }
  }, [isOpen, existingFollowUp, initialTitle]);

  if (!isOpen || !lead) return null;

  const handleApplyPreset = (daysAhead: number) => {
    const d = getPresetDate(daysAhead, 10, 0);
    setScheduledAt(formatForInput(d));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please enter a follow-up title / objective.');
      return;
    }
    if (!scheduledAt) {
      setError('Please select a scheduled date and time.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const isoDate = new Date(scheduledAt).toISOString();

    try {
      let savedFollowUp: FollowUp;

      if (existingFollowUp) {
        savedFollowUp = await crmData.followUps.rescheduleFollowUp({
          id: existingFollowUp.id,
          newScheduledAt: isoDate,
          newTitle: title.trim(),
          newNotes: notes.trim() || null,
          newPriority: priority,
        });
      } else {
        savedFollowUp = await crmData.followUps.scheduleFollowUp({
          leadId: lead.id,
          scheduledAt: isoDate,
          title: title.trim(),
          notes: notes.trim() || null,
          priority,
        });
      }

      // Schedule local Android push reminder
      const targetDate = new Date(isoDate);
      if (targetDate.getTime() > Date.now()) {
        const hashId = Math.abs(
          savedFollowUp.id.split('').reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)
        ) % 100000;

        await NativePlatformService.scheduleNotification({
          id: hashId,
          title: `Follow-up: ${lead.businessName}`,
          body: `${title.trim()} (${lead.locality || 'Lucknow'})`,
          scheduledAt: targetDate,
          extra: { leadId: lead.id, followUpId: savedFollowUp.id },
        });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to schedule follow up:', err);
      setError(err.message || 'Failed to schedule follow up.');
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
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm truncate">
                {existingFollowUp ? 'Reschedule Follow-up' : 'Schedule Follow-up'}
              </h3>
              <p className="text-[11px] text-slate-400 font-mono truncate">
                {lead.businessName} • {lead.locality}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
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

          {/* Quick Date Presets */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-tight flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>Quick Date Presets</span>
            </label>

            <div className="grid grid-cols-4 gap-1.5">
              {[
                { label: 'Tomorrow', days: 1 },
                { label: 'In 2 Days', days: 2 },
                { label: 'In 3 Days', days: 3 },
                { label: 'Next Week', days: 7 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleApplyPreset(preset.days)}
                  className="py-1.5 px-2 bg-slate-50 hover:bg-blue-50 hover:text-blue-800 text-slate-700 border border-slate-200 rounded-xl text-[11px] font-semibold transition-colors text-center"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Scheduled Date & Time Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-tight flex items-center justify-between">
              <span>Date & Time</span>
              <span className="text-[10px] text-slate-400 font-normal">Lucknow Time (IST)</span>
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-bold focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Follow-up Objective / Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-tight flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-blue-600" />
              <span>Follow-up Reason / Title</span>
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Call to get sample feedback; Visit gym for front-desk setup"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Priority Chips */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-tight">
              Priority
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as FollowUpPriority[]).map((p) => {
                const isSelected = priority === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all ${
                      isSelected
                        ? p === 'URGENT'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : p === 'HIGH'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detailed Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-tight flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>Specific Instructions / Notes</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Spoke with trainer Vikram. Owner Manoj will be at gym after 6 PM..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || !scheduledAt}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
              <span>{existingFollowUp ? 'Save Rescheduled Follow-up' : 'Set Follow-up Reminder'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl font-medium text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
