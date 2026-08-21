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
  X,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AgentManagementService } from '../../services/agentManagementService';
import { User } from '../../db/types';

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

  if (!isOpen || !agent) return null;

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
    } catch (err: any) {
      setErrorMessage(err.message || 'Deletion failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-rose-900/50 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-rose-950/40 border-b border-rose-900/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border bg-rose-500/20 text-rose-400 border-rose-500/30">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Delete Agent Account</h2>
              <p className="text-xs text-rose-300/80">{agent.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-4">
          {isDeleted ? (
            <div className="py-6 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <p className="text-sm font-bold text-white">Agent Deleted</p>
              <p className="text-xs text-slate-400">
                {agent.name}&apos;s account has been deleted. All historical records are preserved.
              </p>
            </div>
          ) : (
            <>
              {errorMessage && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl space-y-2">
                <p className="font-bold flex items-center gap-1.5 text-rose-300 text-xs">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>This action is permanent</span>
                </p>
                <ul className="text-[11px] text-rose-200/80 space-y-1 leading-relaxed">
                  <li>x {agent.name} ({agent.email}) will be immediately blocked from logging in.</li>
                  <li>x They cannot be assigned new leads.</li>
                  <li>All historical leads, calls, remarks, and follow-ups are fully preserved.</li>
                  <li>Their name will still appear on historical records for audit.</li>
                </ul>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Type <span className="font-bold text-white">{agent.name}</span> to confirm deletion:
                </label>
                <input
                  type="text"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder={agent.name}
                  autoFocus
                  className="w-full bg-slate-800 border border-slate-700 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500/30 transition-all"
                />
                {confirmName.length > 0 && !isNameMatch && (
                  <p className="text-[10px] text-rose-400">Name does not match. Type the exact agent name.</p>
                )}
                {isNameMatch && (
                  <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Name confirmed
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSubmitting || !isNameMatch}
                  className="py-2.5 px-5 rounded-xl text-white text-xs font-bold shadow-lg transition-all flex items-center gap-2 bg-rose-700 hover:bg-rose-600 shadow-rose-700/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Delete Agent</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
