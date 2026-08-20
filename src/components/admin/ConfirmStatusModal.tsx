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
  X,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AgentManagementService } from '../../services/agentManagementService';
import { User } from '../../db/types';

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

  if (!isOpen || !agent) return null;

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
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                isDeactivating
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              }`}
            >
              {isDeactivating ? <UserX className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {isDeactivating ? 'Deactivate Agent' : 'Activate Agent'}
              </h2>
              <p className="text-xs text-slate-400">{agent.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 text-xs sm:text-sm text-slate-300">
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isDeactivating ? (
            <div className="space-y-3">
              <p className="leading-relaxed">
                Are you sure you want to deactivate <strong>{agent.name}</strong> ({agent.email})?
              </p>
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-200 text-xs space-y-1">
                <p className="font-bold flex items-center gap-1 text-rose-300">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Access Restriction</span>
                </p>
                <p className="text-[11px] leading-relaxed">
                  They will immediately be blocked from entering the Sales CRM on their next session check.
                </p>
              </div>
              <p className="text-[11px] text-slate-400">
                All existing lead records, call histories, remarks, and follow-ups previously made by this agent will remain completely preserved in the database.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="leading-relaxed">
                Activate <strong>{agent.name}</strong> ({agent.email})?
              </p>
              <p className="text-[11px] text-slate-400">
                This will grant them operational access to the Field Sales CRM upon logging into their account.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting}
              className={`py-2.5 px-5 rounded-xl text-white text-xs font-bold shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 ${
                isDeactivating
                  ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : isDeactivating ? (
                <>
                  <UserX className="w-4 h-4" />
                  <span>Deactivate Account</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>Activate Account</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
