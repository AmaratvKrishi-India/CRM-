import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  AlertCircle,
  Loader2,
  Tag,
  FileText,
  Bell,
} from 'lucide-react';
import { crmData } from '../../db';
import type { FollowUp, FollowUpPriority, Lead } from '../../db/types';
import { NativePlatformService } from '../../services/nativePlatform';
import { Modal } from '../common/Modal';
import { labelFor } from '../../lib/labels';

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

  if (!lead) return null;

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

  const labelClass = 'text-sm font-bold text-soft flex items-center gap-1.5';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={existingFollowUp ? 'Reschedule follow-up' : 'Schedule follow-up'}
      subtitle={`${lead.businessName} • ${lead.locality}`}
      closeOnBackdrop={false}
      maxWidthClassName="max-w-lg"
      headerIcon={
        <span className="w-9 h-9 rounded-xl bg-info-soft text-info-text flex items-center justify-center flex-shrink-0">
          <Calendar className="w-5 h-5" aria-hidden="true" />
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

        {/* Quick Date Presets */}
        <div className="space-y-1.5">
          <span className={labelClass}>
            <Clock className="w-4 h-4 text-info" aria-hidden="true" />
            <span id="fu-presets-label">Quick date presets</span>
          </span>

          <div className="grid grid-cols-4 gap-1.5" role="group" aria-labelledby="fu-presets-label">
            {[
              { label: 'Tomorrow', days: 1 },
              { label: 'In 2 days', days: 2 },
              { label: 'In 3 days', days: 3 },
              { label: 'Next week', days: 7 },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleApplyPreset(preset.days)}
                className="min-h-11 py-1.5 px-2 bg-inset hover:bg-info-soft hover:text-info-text text-soft border border-line rounded-xl text-xs font-semibold transition-colors text-center"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scheduled Date & Time Input */}
        <div className="space-y-1.5">
          <label htmlFor="fu-scheduled-at" className="text-sm font-bold text-soft flex items-center justify-between">
            <span>Date &amp; time</span>
            <span className="text-xs text-faint font-normal">Lucknow time (IST)</span>
          </label>
          <input
            id="fu-scheduled-at"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full min-h-11 text-sm bg-inset border border-line rounded-xl p-2.5 text-ink font-bold focus:outline-none focus:ring-2 focus:ring-focus-ring"
          />
        </div>

        {/* Follow-up Objective / Title */}
        <div className="space-y-1.5">
          <label htmlFor="fu-title" className={labelClass}>
            <Tag className="w-4 h-4 text-info" aria-hidden="true" />
            <span>Follow-up reason / title</span>
            <span className="text-danger" aria-hidden="true">*</span>
          </label>
          <input
            id="fu-title"
            type="text"
            required
            data-autofocus
            placeholder="e.g. Call to get sample feedback; visit gym for front-desk setup"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full min-h-11 text-sm bg-inset border border-line rounded-xl p-2.5 text-ink font-semibold placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-focus-ring"
          />
        </div>

        {/* Priority Chips */}
        <fieldset className="space-y-1.5">
          <legend className={labelClass}>Priority</legend>
          <div className="grid grid-cols-4 gap-1.5">
            {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as FollowUpPriority[]).map((p) => {
              const isSelected = priority === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  aria-pressed={isSelected}
                  className={`min-h-11 py-1.5 px-2 rounded-xl text-sm font-bold border transition-all ${
                    isSelected
                      ? p === 'URGENT'
                        ? 'bg-danger text-white border-danger shadow-xs'
                        : p === 'HIGH'
                        ? 'bg-warning text-white border-warning shadow-xs'
                        : 'bg-accent text-on-accent border-accent shadow-xs'
                      : 'bg-inset text-soft border-line hover:bg-inset-strong'
                  }`}
                >
                  {labelFor(p)}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Detailed Notes */}
        <div className="space-y-1.5">
          <label htmlFor="fu-notes" className={labelClass}>
            <FileText className="w-4 h-4 text-info" aria-hidden="true" />
            <span>Specific instructions / notes</span>
          </label>
          <textarea
            id="fu-notes"
            rows={2}
            placeholder="e.g. Spoke with trainer Vikram. Owner Manoj will be at gym after 6 PM..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full text-sm bg-inset border border-line rounded-xl p-2.5 text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-focus-ring"
          />
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-line flex flex-col gap-2">
          <button
            type="submit"
            disabled={isSubmitting || !title.trim() || !scheduledAt}
            className="w-full min-h-12 py-3 px-4 rounded-xl font-bold text-sm bg-accent hover:bg-accent-hover active:scale-[0.99] text-on-accent shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Bell className="w-4 h-4" aria-hidden="true" />
            )}
            <span>{existingFollowUp ? 'Save rescheduled follow-up' : 'Set follow-up reminder'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full min-h-11 py-2.5 px-4 rounded-xl font-medium text-sm text-soft hover:text-ink hover:bg-inset transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
};
