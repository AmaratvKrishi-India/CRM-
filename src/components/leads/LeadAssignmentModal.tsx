/**
 * Lead Assignment Modal (Phase 2I)
 * Mobile-first modal enabling Administrators to assign, reassign, or unassign leads to active sales representatives.
 */

import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Users,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { LeadAssignmentService } from '../../services/leadAssignmentService';
import { AgentManagementService } from '../../services/agentManagementService';
import type { Lead, User } from '../../db/types';
import { Modal } from '../common/Modal';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  if (!lead) return null;

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign / Reassign Lead"
      subtitle={lead.businessName}
      maxWidthClassName="max-w-md"
      closeOnBackdrop={false}
      headerIcon={
        <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent-text border border-accent flex items-center justify-center shrink-0">
          <UserCheck className="w-5 h-5" aria-hidden="true" />
        </div>
      }
    >
      <div className="space-y-4">
        {/* Current Assignee Banner */}
        <div className="p-3 bg-inset border border-line rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-info-soft text-info-text flex items-center justify-center text-xs font-bold">
              {currentAssignee ? currentAssignee.name.charAt(0) : '?'}
            </div>
            <div>
              <p className="text-xs text-faint uppercase font-semibold tracking-wide">Current Assignee</p>
              <p className="text-sm font-bold text-ink">
                {currentAssignee ? currentAssignee.name : 'Unassigned'}
              </p>
            </div>
          </div>
          {lead.assignedTo && (
            <button
              type="button"
              onClick={handleUnassign}
              disabled={submitting}
              className="min-h-11 px-3 py-1 rounded-lg bg-danger-soft hover:bg-danger/20 text-danger-text text-sm font-semibold border border-danger transition-all active:scale-95"
            >
              Unassign
            </button>
          )}
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="p-3 bg-danger-soft border border-danger rounded-2xl text-sm text-danger-text flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Agent Selection List */}
        <div className="space-y-2">
          <span className="block text-xs font-bold text-soft uppercase tracking-wide" id="agent-select-label">
            Select Active Sales Agent ({agents.length})
          </span>

          {loading ? (
            <div className="p-8 text-center" role="status">
              <Loader2 className="w-6 h-6 animate-spin text-accent-text mx-auto" aria-hidden="true" />
              <p className="text-sm text-soft mt-2">Loading active agents...</p>
            </div>
          ) : agents.length === 0 ? (
            <div className="p-6 text-center bg-inset rounded-2xl border border-line">
              <Users className="w-8 h-8 text-faint mx-auto" aria-hidden="true" />
              <p className="text-sm font-bold text-ink mt-2">No Active Agents Found</p>
              <p className="text-xs text-soft mt-0.5">Please create or activate an agent first.</p>
            </div>
          ) : (
            <div
              className="space-y-1.5 max-h-60 overflow-y-auto pr-1"
              role="listbox"
              aria-labelledby="agent-select-label"
            >
              {agents.map((agent) => {
                const isSelected = selectedAgentId === agent.id;
                const isCurrent = lead.assignedTo === agent.id;

                return (
                  <button
                    key={agent.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => setSelectedAgentId(agent.id)}
                    className={`min-h-11 w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-accent-soft border-accent text-ink shadow-sm'
                        : 'bg-surface border-line text-soft hover:bg-inset'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-inset-strong flex items-center justify-center font-bold text-xs text-ink flex-shrink-0">
                        {agent.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-ink truncate">{agent.name}</p>
                        <p className="text-xs text-faint truncate">{agent.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isCurrent && (
                        <span className="px-2 py-0.5 rounded-md bg-info-soft text-info-text text-xs font-bold border border-info">
                          Current
                        </span>
                      )}
                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-accent-text flex-shrink-0" aria-hidden="true" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-line flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="min-h-11 py-2.5 px-4 rounded-xl bg-inset hover:bg-inset-strong text-ink text-sm font-bold border border-line transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleAssign}
            disabled={submitting || !selectedAgentId || selectedAgentId === lead.assignedTo}
            className="min-h-11 py-2.5 px-5 rounded-xl bg-accent hover:bg-accent-hover text-on-accent text-sm font-bold shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>Updating...</span>
              </>
            ) : (
              <>
                <UserCheck className="w-4 h-4" aria-hidden="true" />
                <span>{lead.assignedTo ? 'Reassign Lead' : 'Assign Lead'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
