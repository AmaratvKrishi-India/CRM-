/**
 * Create Lead Modal
 * Allows sales agents and admins to create an individual field lead directly.
 * Automatically attributes createdBy and assignedTo to the creator.
 */

import React, { useState } from 'react';
import { Building2, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { crmData } from '../../db';
import type { Lead, LeadStatus } from '../../db/types';
import { Modal } from '../common/Modal';
import { labelFor } from '../../lib/labels';

interface CreateLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeadCreated: (lead: Lead) => void;
}

const STATUS_OPTIONS: LeadStatus[] = [
  'NEW',
  'CONTACTED',
  'INTERESTED',
  'SAMPLE_REQUESTED',
  'CUSTOMER',
];

export const CreateLeadModal: React.FC<CreateLeadModalProps> = ({
  isOpen,
  onClose,
  onLeadCreated,
}) => {
  const { currentUser } = useAuth();

  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [locality, setLocality] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [category, setCategory] = useState('Gym');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<LeadStatus>('NEW');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = businessName.trim();
    const cleanPhone = phone.trim();
    const cleanLocality = locality.trim() || 'Lucknow';

    if (!cleanName) {
      setErrorMessage('Business / gym name is required.');
      return;
    }

    if (!cleanPhone) {
      setErrorMessage('Phone number is required.');
      return;
    }

    setLoading(true);

    try {
      if (!currentUser) {
        throw new Error('Your session is no longer active. Please sign in again.');
      }
      const userId = currentUser.id;

      const newLead = await crmData.leads.createLead({
        businessName: cleanName,
        phone: cleanPhone,
        locality: cleanLocality,
        contactPerson: contactPerson.trim() || null,
        category: category.trim() || 'Gym',
        address: address.trim() || `${cleanLocality}, Lucknow, Uttar Pradesh`,
        status,
        customNotes: notes.trim(),
        source: currentUser?.role === 'AGENT' ? `Field Entry (${currentUser.name})` : 'Admin Manual Entry',
        createdBy: userId,
        assignedTo: userId,
        updatedBy: userId,
      });

      // Log activity
      await crmData.activities.logActivity({
        leadId: newLead.id,
        userId,
        activityType: 'LEAD_CREATED',
        metadata: {
          businessName: newLead.businessName,
          phone: newLead.phone,
          locality: newLead.locality,
          source: newLead.source,
          assignedTo: userId,
        },
      });

      onLeadCreated(newLead);
      onClose();
    } catch (err: unknown) {
      console.error('Failed to create lead:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create lead. Please check details.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full min-h-12 bg-inset border border-line rounded-xl px-3 py-2 text-base text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-focus-ring';
  const labelClass = 'block text-sm font-semibold text-soft mb-1';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add lead"
      subtitle="Save a new lead to your pipeline"
      closeOnBackdrop={false}
      maxWidthClassName="max-w-lg"
      headerIcon={
        <span className="w-9 h-9 rounded-xl bg-accent-soft text-accent-text flex items-center justify-center flex-shrink-0">
          <Building2 className="w-5 h-5" aria-hidden="true" />
        </span>
      }
    >
      {/* Form Content */}
      <form id="create-lead-form" onSubmit={handleSubmit} className="space-y-3.5">
        {errorMessage && (
          <div role="alert" className="p-3 bg-danger-soft border border-danger/30 rounded-xl text-sm text-danger-text font-medium">
            {errorMessage}
          </div>
        )}

        <div>
          <label htmlFor="create-business-name" className={labelClass}>
            Business / gym name *
          </label>
          <input
            id="create-business-name"
            type="text"
            required
            data-autofocus
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Business or gym name"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="create-phone" className={labelClass}>
              Phone number *
            </label>
            <input
              id="create-phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 7054447888"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="create-locality" className={labelClass}>
              Locality / area
            </label>
            <input
              id="create-locality"
              type="text"
              value={locality}
              onChange={(e) => setLocality(e.target.value)}
              placeholder="e.g. Alambagh"
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="create-contact-person" className={labelClass}>
              Contact person
            </label>
            <input
              id="create-contact-person"
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="e.g. Amit Verma"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="create-category" className={labelClass}>
              Category
            </label>
            <input
              id="create-category"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Fitness center"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label htmlFor="create-address" className={labelClass}>
            Address
          </label>
          <input
            id="create-address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street / landmark (optional)"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="create-status" className={labelClass}>
            Initial pipeline status
          </label>
          <select
            id="create-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as LeadStatus)}
            className={`${inputClass} font-semibold`}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {labelFor(s)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="create-notes" className={labelClass}>
            Field notes / remarks
          </label>
          <textarea
            id="create-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Initial observations, owner timing, requirements..."
            rows={2}
            className={`${inputClass} resize-none`}
          />
        </div>

        {/* Footer Buttons */}
        <div className="pt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-11 rounded-xl border border-line text-sm font-bold text-soft hover:bg-inset transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            id="save-create-lead-button"
            disabled={loading}
            className="flex-1 min-h-11 rounded-xl bg-accent hover:bg-accent-hover text-on-accent text-sm font-bold transition-colors shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>Creating…</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                <span>Save lead</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
