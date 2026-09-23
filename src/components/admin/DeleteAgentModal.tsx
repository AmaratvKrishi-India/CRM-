/**
 * Delete Agent Modal (Phase 3)
 * Admin-only modal to permanently soft-delete a sales agent account.
 * Requires explicit name confirmation. All historical CRM data is preserved.
 */

import React, { useState } from 'react';
import {
  Trash2,
  AlertTriangle,
  Loader2,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AgentManagementService } from '../../services/agentManagementService';
import type { User } from '../../db/types';
import { Modal } from '../common/Modal';

interface DeleteAgentModalProps {
  agent: User | null;
  isOpen: boolean;
  onClose: () => void;
  onAgentDeleted: () => void;
}

export const DeleteAgentModal: React.FC<DeleteAgentModalProps> = ({
  agent,
  isOpen,
  onClose,
  onAgentDeleted,
}) => {
  const { currentUser } = useAuth();
  const [confirmName, setConfirmName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeleted, setIsDeleted] = useState(false);

  if (!agent) return null;

  const isNameMatch = confirmName.trim().toLowerCase() === agent.name.trim().toLowerCase();

  const handleClose = () => {
    setConfirmName('');
    setErrorMessage(null);
    setIsDeleted(false);
    onClose();
  };

  const handleDelete = async () => {
    if (!isNameMatch) return;
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await AgentManagementService.deleteAgent(currentUser, agent.id);
      setIsDeleted(true);
      setTimeout(() => {
        onAgentDeleted();
        handleClose();
      }, 1500);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Deletion failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Delete Agent Account"
      subtitle={agent.name}
      maxWidthClassName="max-w-md"
      closeOnBackdrop={false}
      closeOnEscape={!isSubmitting}
      headerIcon={
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border bg-danger-soft text-danger-text border-danger">
          <Trash2 className="w-5 h-5" aria-hidden="true" />
        </div>
      }
    >
      <div className="space-y-4">
        {isDeleted ? (
          <div className="py-6 flex flex-col items-center justify-center text-center gap-3" role="status">
            <div className="w-12 h-12 rounded-2xl bg-success-soft border border-success flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-success-text" aria-hidden="true" />
            </div>
            <p className="text-sm font-bold text-ink">Agent Deleted</p>
            <p className="text-xs text-soft">
              {agent.name}&apos;s account has been deleted. All historical records are preserved.
            </p>
          </div>
        ) : (
          <>
            {errorMessage && (
              <div
                role="alert"
                className="p-3 bg-danger-soft border border-danger rounded-2xl text-sm text-danger-text flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="p-3.5 bg-danger-soft border border-danger rounded-2xl space-y-2">
              <p className="font-bold flex items-center gap-1.5 text-danger-text text-sm">
                <ShieldAlert className="w-4 h-4" aria-hidden="true" />
                <span>This action is permanent</span>
              </p>
              <ul className="text-xs text-danger-text space-y-1 leading-relaxed list-disc pl-4">
                <li>{agent.name} ({agent.email}) will be immediately blocked from logging in.</li>
                <li>They cannot be assigned new leads.</li>
                <li>All historical leads, calls, remarks, and follow-ups are fully preserved.</li>
                <li>Their name will still appear on historical records for audit.</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="delete-agent-confirm" className="text-sm font-semibold text-soft">
                Type <span className="font-bold text-ink">{agent.name}</span> to confirm deletion:
              </label>
              <input
                id="delete-agent-confirm"
                type="text"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={agent.name}
                data-autofocus
                className="w-full bg-inset border border-line focus:border-danger rounded-xl px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-focus-ring transition-all"
              />
              {confirmName.length > 0 && !isNameMatch && (
                <p className="text-xs text-danger-text">Name does not match. Type the exact agent name.</p>
              )}
              {isNameMatch && (
                <p className="text-xs text-success-text flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Name confirmed
                </p>
              )}
            </div>

            <div className="pt-2 border-t border-line flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="min-h-11 py-2.5 px-4 rounded-xl bg-inset hover:bg-inset-strong text-ink text-sm font-bold border border-line transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting || !isNameMatch}
                className="min-h-11 py-2.5 px-5 rounded-xl text-white text-sm font-bold shadow-lg transition-all flex items-center gap-2 bg-danger hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                    <span>Delete Agent</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
