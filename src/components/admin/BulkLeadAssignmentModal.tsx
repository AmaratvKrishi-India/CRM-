/**
 * Bulk Lead Assignment Modal (Phase 2K)
 * Enterprise mobile-first modal for batch assigning selected leads to active sales representatives.
 * Features breakdown preview, active agent safety validation, confirmation, and progress reporting.
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { crmData } from '../../db';
import { LeadAssignmentService } from '../../services/leadAssignmentService';
import { AgentManagementService } from '../../services/agentManagementService';
import type { Lead, User } from '../../db/types';
import { Modal } from '../common/Modal';
import { labelFor } from '../../lib/labels';

interface BulkLeadAssignmentModalProps {
  isOpen: boolean;
  selectedLeadIds: string[];
  onClose: () => void;
  onAssignmentComplete: () => void;
}

export const BulkLeadAssignmentModal: React.FC<BulkLeadAssignmentModalProps> = ({
  isOpen,
  selectedLeadIds,
  onClose,
  onAssignmentComplete,
}) => {
  const { currentUser } = useAuth();

  const [agents, setAgents] = useState<User[]>([]);
  const [targetAgentId, setTargetAgentId] = useState<string>('');
  const [, setSelectedLeads] = useState<Lead[]>([]);
  const [unassignedCount, setUnassignedCount] = useState<number>(0);
  const [reassignedCount, setReassignedCount] = useState<number>(0);

  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<{
    successful: number;
    failed: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && currentUser) {
      loadModalData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedLeadIds, currentUser]);

  const loadModalData = async () => {
    try {
      // 1. Load active agents
      const agentList = await AgentManagementService.getAgents(currentUser);
      const activeOnly = agentList.filter((a) => a.status === 'ACTIVE');
      setAgents(activeOnly);

      if (activeOnly.length > 0 && !targetAgentId) {
        setTargetAgentId(activeOnly[0].id);
      }

      // 2. Load selected leads details
      const leadsData: Lead[] = [];
      let unassigned = 0;
      let reassigned = 0;

      for (const id of selectedLeadIds) {
        const lead = await crmData.leads.getLeadById(id);
        if (lead) {
          leadsData.push(lead);
          if (lead.assignedTo) {
            reassigned++;
          } else {
            unassigned++;
          }
        }
      }

      setSelectedLeads(leadsData);
      setUnassignedCount(unassigned);
      setReassignedCount(reassigned);
      setIsConfirming(false);
      setExecutionResult(null);
      setErrorMessage(null);
    } catch (err: unknown) {
      console.error('Failed to load bulk assignment modal data:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load details.');
    }
  };

  const targetAgent = agents.find((a) => a.id === targetAgentId);

  const handleExecuteBulkAssign = async () => {
    if (!targetAgentId || !targetAgent) {
      setErrorMessage('Please select a target sales representative.');
      return;
    }

    setIsExecuting(true);
    setErrorMessage(null);

    try {
      const result = await LeadAssignmentService.bulkAssignLeads(
        currentUser,
        selectedLeadIds,
        targetAgentId,
        {
          selectedCount: selectedLeadIds.length,
          unassignedBreakdown: unassignedCount,
          reassignedBreakdown: reassignedCount,
        }
      );

      setExecutionResult({
        successful: result.successfulCount,
        failed: result.failedCount,
      });

      setTimeout(() => {
        onAssignmentComplete();
        onClose();
      }, 1500);
    } catch (err: unknown) {
      console.error('Bulk assignment failed:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Bulk assignment failed.');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Bulk Lead Assignment"
      subtitle={`Assign ${selectedLeadIds.length} selected leads in batch`}
      maxWidthClassName="max-w-lg"
      closeOnBackdrop={false}
      headerIcon={
        <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent-text flex items-center justify-center flex-shrink-0 border border-accent">
          <Users className="w-5 h-5" aria-hidden="true" />
        </div>
      }
    >
      <div className="space-y-4">
        {errorMessage && (
          <div
            role="alert"
            className="p-3 bg-danger-soft border border-danger rounded-2xl text-sm text-danger-text font-medium"
          >
            {errorMessage}
          </div>
        )}

        {executionResult ? (
          <div className="py-8 text-center space-y-3" role="status">
            <div className="w-12 h-12 bg-success-soft text-success-text rounded-2xl flex items-center justify-center mx-auto border border-success">
              <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
            </div>
            <h4 className="text-base font-bold text-ink">Assignment Completed!</h4>
            <p className="text-sm text-soft">
              Successfully assigned <strong className="text-success-text">{executionResult.successful}</strong> leads to{' '}
              {targetAgent?.name}.
            </p>
          </div>
        ) : (
          <>
            {/* Selection Breakdown Card */}
            <div className="p-3.5 bg-inset border border-line rounded-2xl space-y-2">
              <span className="text-xs font-bold text-faint uppercase tracking-wide block">
                Batch Breakdown
              </span>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-surface rounded-xl border border-line">
                  <span className="text-xs text-faint block">Total</span>
                  <strong className="text-ink text-base font-black">{selectedLeadIds.length}</strong>
                </div>
                <div className="p-2 bg-warning-soft rounded-xl border border-warning">
                  <span className="text-xs text-warning-text block">Unassigned</span>
                  <strong className="text-warning-text text-base font-black">{unassignedCount}</strong>
                </div>
                <div className="p-2 bg-info-soft rounded-xl border border-info">
                  <span className="text-xs text-info-text block">Reassigned</span>
                  <strong className="text-info-text text-base font-black">{reassignedCount}</strong>
                </div>
              </div>
            </div>

            {/* Target Agent Selector */}
            <div className="space-y-1.5">
              <span className="block text-xs font-bold text-soft" id="bulk-target-agent-label">
                Assign To Sales Representative *
              </span>

              {agents.length === 0 ? (
                <div className="p-3 bg-inset rounded-xl border border-line text-sm text-warning-text">
                  No active sales representatives found. Provision an agent first.
                </div>
              ) : (
                <div
                  className="space-y-1.5 max-h-48 overflow-y-auto pr-1"
                  role="radiogroup"
                  aria-labelledby="bulk-target-agent-label"
                >
                  {agents.map((agent) => (
                    <label
                      key={agent.id}
                      className={`min-h-11 flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        targetAgentId === agent.id
                          ? 'bg-accent-soft border-accent text-ink shadow-md'
                          : 'bg-surface border-line text-soft hover:border-line-strong'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="radio"
                          name="targetAgent"
                          value={agent.id}
                          checked={targetAgentId === agent.id}
                          onChange={(e) => setTargetAgentId(e.target.value)}
                          className="accent-[var(--accent)]"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">{agent.name}</p>
                          <p className="text-xs text-faint font-mono truncate">{agent.email}</p>
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded-md bg-success-soft text-success-text text-xs font-semibold border border-success shrink-0">
                        {labelFor(agent.status)}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Confirmation Warning when Reassigning */}
            {isConfirming && targetAgent && (
              <div className="p-3.5 bg-warning-soft border border-warning rounded-2xl space-y-2 animate-in fade-in">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning-text shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="text-sm text-warning-text">
                    <p className="font-bold">Confirm Bulk Lead Reassignment</p>
                    <p className="text-xs mt-0.5 leading-relaxed">
                      You are assigning <strong>{selectedLeadIds.length}</strong> leads to{' '}
                      <strong>{targetAgent.name}</strong>.
                      {reassignedCount > 0 && (
                        <span>
                          {' '}
                          (<strong>{reassignedCount}</strong> leads will be reassigned from other agents).
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Footer Buttons */}
        {!executionResult && (
          <div className="pt-3 border-t border-line flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isExecuting}
              className="min-h-11 flex-1 py-2.5 rounded-xl border border-line-strong text-sm font-bold text-soft hover:bg-inset transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            {!isConfirming ? (
              <button
                type="button"
                onClick={() => setIsConfirming(true)}
                disabled={!targetAgentId || agents.length === 0}
                className="min-h-11 flex-1 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-sm font-bold text-on-accent transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-98 disabled:opacity-50"
              >
                <span>Preview & Confirm</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleExecuteBulkAssign}
                disabled={isExecuting}
                className="min-h-11 flex-1 py-2.5 rounded-xl bg-success hover:opacity-90 text-sm font-bold text-on-accent transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-98 disabled:opacity-50"
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>Assigning Leads...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                    <span>Confirm Assignment</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
