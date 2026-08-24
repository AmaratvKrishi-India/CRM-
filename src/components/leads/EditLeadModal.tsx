/**
 * F20 — Lead edit flow.
 * Same validation as CreateLeadModal; persists via crmData.leads.updateLead,
 * which re-normalizes the phone and rejects duplicate numbers.
 */

import React, { useState } from 'react';
import { PencilLine, CheckCircle2, Loader2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { useAuth } from '../../context/AuthContext';
import { crmData } from '../../db';
import { Lead, LeadStatus } from '../../db/types';
import { labelFor } from '../../lib/labels';

const STATUS_OPTIONS: LeadStatus[] = [
  'NEW',
  'CONTACTED',
  'INTERESTED',
  'SAMPLE_REQUESTED',
  'FOLLOW_UP',
  'NEGOTIATION',
  'CUSTOMER',
  'NOT_INTERESTED',
  'WRONG_NUMBER',
  'DO_NOT_CONTACT',
];

interface EditLeadModalProps {
  isOpen: boolean;
  lead: Lead;
  onClose: () => void;
  onLeadUpdated: (lead: Lead) => void;
}

export const EditLeadModal: React.FC<EditLeadModalProps> = ({
  isOpen,
  lead,
  onClose,
  onLeadUpdated,
}) => {
  const { currentUser } = useAuth();

  const [businessName, setBusinessName] = useState(lead.businessName);
  const [phone, setPhone] = useState(lead.phoneRaw || lead.phone);
  const [locality, setLocality] = useState(lead.locality);
  const [contactPerson, setContactPerson] = useState(lead.contactPerson || '');
  const [category, setCategory] = useState(lead.category);
  const [address, setAddress] = useState(lead.address);
  const [pincode, setPincode] = useState(lead.pincode);
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [notes, setNotes] = useState(lead.customNotes);
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
    if (pincode.trim() && !/^\d{6}$/.test(pincode.trim())) {
      setErrorMessage('PIN code must be exactly 6 digits.');
      return;
    }

    setLoading(true);
    try {
      const updated = await crmData.leads.updateLead(lead.id, {
        businessName: cleanName,
        phone: cleanPhone,
        locality: cleanLocality,
        contactPerson: contactPerson.trim() || null,
        category: category.trim() || 'Gym',
        address: address.trim(),
        pincode: pincode.trim(),
        status,
        customNotes: notes.trim(),
        updatedBy: currentUser?.id || lead.updatedBy || null,
      });
      onLeadUpdated(updated);
      onClose();
    } catch (err: unknown) {
      console.error('Failed to update lead:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to save changes. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full bg-inset border border-line rounded-xl px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-focus-ring';
  const labelClass = 'block text-sm font-bold text-soft mb-1';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit lead"
      subtitle={lead.businessName}
      closeOnBackdrop={false}
      maxWidthClassName="max-w-lg"
      headerIcon={
        <span className="w-9 h-9 rounded-xl bg-accent-soft text-accent-text flex items-center justify-center flex-shrink-0">
          <PencilLine className="w-5 h-5" aria-hidden="true" />
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {errorMessage && (
          <div role="alert" className="p-3 bg-danger-soft border border-danger/30 rounded-xl text-sm text-danger-text font-medium">
            {errorMessage}
          </div>
        )}

        <div>
          <label htmlFor="edit-business-name" className={labelClass}>
            Business / gym name *
          </label>
          <input
            id="edit-business-name"
            type="text"
            required
            data-autofocus
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label htmlFor="edit-phone" className={labelClass}>
              Phone number *
            </label>
            <input
              id="edit-phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="edit-locality" className={labelClass}>
              Locality / area
            </label>
            <input
              id="edit-locality"
              type="text"
              value={locality}
              onChange={(e) => setLocality(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label htmlFor="edit-contact-person" className={labelClass}>
              Contact person
            </label>
            <input
              id="edit-contact-person"
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="edit-category" className={labelClass}>
              Category
            </label>
            <input
              id="edit-category"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-[1fr_120px] gap-2.5">
          <div>
            <label htmlFor="edit-address" className={labelClass}>
              Address
            </label>
            <input
              id="edit-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="edit-pincode" className={labelClass}>
              PIN code
            </label>
            <input
              id="edit-pincode"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label htmlFor="edit-status" className={labelClass}>
            Pipeline status
          </label>
          <select
            id="edit-status"
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
          <label htmlFor="edit-notes" className={labelClass}>
            Notes
          </label>
          <textarea
            id="edit-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={`${inputClass} resize-none`}
          />
        </div>

        <div className="pt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-11 rounded-xl border border-line text-sm font-bold text-soft hover:bg-inset transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 min-h-11 rounded-xl bg-accent hover:bg-accent-hover text-on-accent text-sm font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>Saving…</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                <span>Save changes</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
