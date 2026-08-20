/**
 * Lead Assignment Modal (Phase 2I)
 * Mobile-first modal enabling Administrators to assign, reassign, or unassign leads to active sales representatives.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  UserCheck,
  UserX,
  Users,
  Shield,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { LeadAssignmentService } from '../../services/leadAssignmentService';
import { AgentManagementService } from '../../services/agentManagementService';
import { Lead, User } from '../../db/types';

interface LeadAssignmentModalProps {
  isOpen: boolean;
  lead: Lead | null;
  onClose: () => void;
  onAssignmentComplete: (updatedLead: Lead) => void;
}

export const LeadAssignmentModal: React.FC<LeadAssignmentModalProps> = ({
  isOpen,
  lead,
  onClose,
  onAssignmentComplete,
}) => {
  const { currentUser } = useAuth();
  const [agents, setAgents] = useState<User[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && lead) {
      setSelectedAgentId(lead.assignedTo || null);
      loadActiveAgents();
    }
  }, [isOpen, lead]);

  const loadActiveAgents = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const allAgents = await AgentManagementService.getAgents(currentUser);
      // Filter for ACTIVE agents only
      setAgents(allAgents.filter((a) => a.status === 'ACTIVE'));
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load sales agents.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !lead) return null;

  const currentAssignee = agents.find((a) => a.id === lead.assignedTo);

  const handleAssign = async () => {
    if (!selectedAgentId) return;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const { lead: updatedLead } = await LeadAssignmentService.assignLead(
        currentUser,
        lead.id,
        selectedAgentId
      );
      onAssignmentComplete(updatedLead);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update lead assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnassign = async () => {
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const { lead: updatedLead } = await LeadAssignmentService.unassignLead(
        currentUser,
        lead.id
      );
      onAssignmentComplete(updatedLead);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to remove assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white truncate">Assign / Reassign Lead</h2>
              <p className="text-xs text-slate-400 truncate">{lead.businessName}</p>
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
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {/* Current Assignee Banner */}
          <div className="p-3 bg-slate-800/80 border border-slate-700/60 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">
                {currentAssignee ? currentAssignee.name.charAt(0) : '?'}
              </div>
              <div>
                <p className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider">Current Assignee</p>
                <p className="text-xs font-bold text-white">
                  {currentAssignee ? currentAssignee.name : 'Unassigned'}
                </p>
              </div>
            </div>
            {lead.assignedTo && (
              <button
                type="button"
                onClick={handleUnassign}
                disabled={submitting}
                className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold border border-rose-500/30 transition-all active:scale-95"
              >
                Unassign
              </button>
            )}
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Agent Selection List */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              Select Active Sales Agent ({agents.length})
            </label>

            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-purple-400 mx-auto" />
                <p className="text-xs text-slate-400 mt-2">Loading active agents...</p>
              </div>
            ) : agents.length === 0 ? (
              <div className="p-6 text-center bg-slate-800/40 rounded-2xl border border-slate-700/50">
                <Users className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-xs font-bold text-slate-300 mt-2">No Active Agents Found</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Please create or activate an agent first.</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {agents.map((agent) => {
                  const isSelected = selectedAgentId === agent.id;
                  const isCurrent = lead.assignedTo === agent.id;

                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => setSelectedAgentId(agent.id)}
                      className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-purple-600/20 border-purple-500/60 text-white shadow-sm'
                          : 'bg-slate-800/60 border-slate-700/50 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-slate-700 flex items-center justify-center font-bold text-xs text-white flex-shrink-0">
                          {agent.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{agent.name}</p>
                          <p className="text-[11px] text-slate-400 truncate">{agent.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-[10px] font-bold border border-blue-500/30">
                            Current
                          </span>
                        )}
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-purple-400 flex-shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-800/60 border-t border-slate-700/80 flex items-center justify-end gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleAssign}
            disabled={submitting || !selectedAgentId || selectedAgentId === lead.assignedTo}
            className="py-2.5 px-5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Updating...</span>
              </>
            ) : (
              <>
                <UserCheck className="w-4 h-4" />
                <span>{lead.assignedTo ? 'Reassign Lead' : 'Assign Lead'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
