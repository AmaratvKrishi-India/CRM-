/**
 * Edit Agent Modal (Phase 2D)
 * Admin-only form to edit an existing Sales Agent profile.
 * User ID and Role remain strictly immutable.
 */

import React, { useState, useEffect } from 'react';
import {
  Edit2,
  User as UserIcon,
  Phone,
  Loader2,
  AlertCircle,
  Check,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AgentManagementService } from '../../services/agentManagementService';
import type { User, UserStatus } from '../../db/types';
import { Modal } from '../common/Modal';
import { labelFor } from '../../lib/labels';

interface EditAgentModalProps {
  agent: User | null;
  isOpen: boolean;
  onClose: () => void;
  onAgentUpdated: (updatedAgent: User) => void;
}

export const EditAgentModal: React.FC<EditAgentModalProps> = ({
  agent,
  isOpen,
  onClose,
  onAgentUpdated,
}) => {
  const { currentUser } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<UserStatus>('ACTIVE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setPhone(agent.phone || '');
      setStatus(agent.status);
      setErrorMessage(null);
    }
  }, [agent, isOpen]);

  if (!agent) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMessage('Agent name cannot be empty.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { agent: updated } = await AgentManagementService.updateAgent(
        currentUser,
        agent.id,
        {
          name: cleanName,
          phone: phone.trim(),
          status,
        }
      );

      onAgentUpdated(updated);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update agent profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'w-full bg-inset border border-line rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-focus-ring focus:border-transparent transition-all';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Agent Profile"
      subtitle={agent.email}
      maxWidthClassName="max-w-md"
      closeOnBackdrop={false}
      headerIcon={
        <div className="w-9 h-9 rounded-xl bg-inset text-soft border border-line-strong flex items-center justify-center flex-shrink-0">
          <Edit2 className="w-4 h-4" aria-hidden="true" />
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div
            role="alert"
            className="p-3 bg-danger-soft border border-danger rounded-2xl text-sm text-danger-text flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Read-Only Account Identity Info */}
        <div className="p-3 bg-inset rounded-2xl border border-line space-y-1.5 text-sm text-faint">
          <div className="flex items-center justify-between">
            <span>Email:</span>
            <span className="font-semibold text-soft">{agent.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Role:</span>
            <span className="font-bold text-info-text">{labelFor(agent.role)} (Immutable)</span>
          </div>
        </div>

        {/* Full Name */}
        <div className="space-y-1.5">
          <label htmlFor="edit-agent-name" className="block text-xs font-bold text-soft uppercase tracking-wide">
            Agent Full Name *
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-faint">
              <UserIcon className="w-4 h-4" aria-hidden="true" />
            </div>
            <input
              id="edit-agent-name"
              data-autofocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              className={inputClass}
              required
            />
          </div>
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <label htmlFor="edit-agent-phone" className="block text-xs font-bold text-soft uppercase tracking-wide">
            Phone Number
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-faint">
              <Phone className="w-4 h-4" aria-hidden="true" />
            </div>
            <input
              id="edit-agent-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isSubmitting}
              className={inputClass}
            />
          </div>
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <span className="block text-xs font-bold text-soft uppercase tracking-wide" id="edit-agent-status-label">
            Account Status
          </span>
          <div
            className="grid grid-cols-2 gap-2"
            role="group"
            aria-labelledby="edit-agent-status-label"
          >
            <button
              type="button"
              onClick={() => setStatus('ACTIVE')}
              aria-pressed={status === 'ACTIVE'}
              className={`min-h-11 py-2 px-3 rounded-xl border text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                status === 'ACTIVE'
                  ? 'bg-success-soft border-success text-success-text'
                  : 'bg-inset border-line text-faint hover:text-soft'
              }`}
            >
              {status === 'ACTIVE' && <Check className="w-4 h-4" aria-hidden="true" />}
              <span>{labelFor('ACTIVE')}</span>
            </button>

            <button
              type="button"
              onClick={() => setStatus('INACTIVE')}
              aria-pressed={status === 'INACTIVE'}
              className={`min-h-11 py-2 px-3 rounded-xl border text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                status === 'INACTIVE'
                  ? 'bg-danger-soft border-danger text-danger-text'
                  : 'bg-inset border-line text-faint hover:text-soft'
              }`}
            >
              {status === 'INACTIVE' && <Check className="w-4 h-4" aria-hidden="true" />}
              <span>{labelFor('INACTIVE')}</span>
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-line flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-11 py-2.5 px-4 rounded-xl bg-inset hover:bg-inset-strong text-ink text-sm font-bold border border-line transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-11 py-2.5 px-5 rounded-xl bg-accent hover:bg-accent-hover text-on-accent text-sm font-bold shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" aria-hidden="true" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
