/**
 * Confirm Status Modal (Phase 2D)
 * Requires explicit administrator confirmation to activate or deactivate an agent.
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  UserX,
  UserCheck,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AgentManagementService } from '../../services/agentManagementService';
import { User } from '../../db/types';
import { Modal } from '../common/Modal';

interface ConfirmStatusModalProps {
  agent: User | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChanged: (updatedAgent: User) => void;
}

export const ConfirmStatusModal: React.FC<ConfirmStatusModalProps> = ({
  agent,
  isOpen,
  onClose,
  onStatusChanged,
}) => {
  const { currentUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!agent) return null;

  const isDeactivating = agent.status === 'ACTIVE';

  const handleConfirm = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      if (isDeactivating) {
        const { agent: updated } = await AgentManagementService.deactivateAgent(
          currentUser,
          agent.id
        );
        onStatusChanged(updated);
      } else {
        const { agent: updated } = await AgentManagementService.activateAgent(
          currentUser,
          agent.id
        );
        onStatusChanged(updated);
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Action failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isDeactivating ? 'Deactivate Agent' : 'Activate Agent'}
      subtitle={agent.name}
      maxWidthClassName="max-w-md"
      closeOnBackdrop={false}
      headerIcon={
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${
            isDeactivating
              ? 'bg-danger-soft text-danger-text border-danger'
              : 'bg-success-soft text-success-text border-success'
          }`}
        >
          {isDeactivating ? (
            <UserX className="w-5 h-5" aria-hidden="true" />
          ) : (
            <UserCheck className="w-5 h-5" aria-hidden="true" />
          )}
        </div>
      }
    >
      <div className="space-y-4 text-sm text-soft">
        {errorMessage && (
          <div
            role="alert"
            className="p-3 bg-danger-soft border border-danger rounded-2xl text-sm text-danger-text flex items-start gap-2"
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        {isDeactivating ? (
          <div className="space-y-3">
            <p className="leading-relaxed">
              Are you sure you want to deactivate <strong className="text-ink">{agent.name}</strong> ({agent.email})?
            </p>
            <div className="p-3 bg-danger-soft border border-danger rounded-2xl text-danger-text text-sm space-y-1">
              <p className="font-bold flex items-center gap-1">
                <ShieldAlert className="w-4 h-4" aria-hidden="true" />
                <span>Access Restriction</span>
              </p>
              <p className="text-xs leading-relaxed">
                They will immediately be blocked from entering the Sales CRM on their next session check.
              </p>
            </div>
            <p className="text-xs text-faint">
              All existing lead records, call histories, remarks, and follow-ups previously made by this agent will remain completely preserved in the database.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="leading-relaxed">
              Activate <strong className="text-ink">{agent.name}</strong> ({agent.email})?
            </p>
            <p className="text-xs text-faint">
              This will grant them operational access to the Field Sales CRM upon logging into their account.
            </p>
          </div>
        )}

        {/* Action Buttons */}
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
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className={`min-h-11 py-2.5 px-5 rounded-xl text-on-accent text-sm font-bold shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 ${
              isDeactivating ? 'bg-danger hover:opacity-90' : 'bg-accent hover:bg-accent-hover'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>Processing...</span>
              </>
            ) : isDeactivating ? (
              <>
                <UserX className="w-4 h-4" aria-hidden="true" />
                <span>Deactivate Account</span>
              </>
            ) : (
              <>
                <UserCheck className="w-4 h-4" aria-hidden="true" />
                <span>Activate Account</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
