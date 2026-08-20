/**
 * Bulk Lead Assignment Modal (Phase 2K)
 * Enterprise mobile-first modal for batch assigning selected leads to active sales representatives.
 * Features breakdown preview, active agent safety validation, confirmation, and progress reporting.
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  X,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Building2,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { crmData } from '../../db';
import { LeadAssignmentService } from '../../services/leadAssignmentService';
import { AgentManagementService } from '../../services/agentManagementService';
import { Lead, User } from '../../db/types';

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
  const [selectedLeads, setSelectedLeads] = useState<Lead[]>([]);
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

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/70 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150 font-sans">
      <div className="bg-slate-900 w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-700 overflow-hidden max-h-[92vh] flex flex-col text-white">
        {/* Top Header */}
        <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center flex-shrink-0 border border-purple-500/30">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Bulk Lead Assignment</h3>
              <p className="text-[11px] text-slate-400">
                Assign <strong className="text-purple-300">{selectedLeadIds.length}</strong> selected leads in batch
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-2xl text-xs text-rose-300 font-medium">
              {errorMessage}
            </div>
          )}

          {executionResult ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/30">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">Assignment Completed!</h4>
              <p className="text-xs text-slate-300">
                Successfully assigned <strong className="text-emerald-400">{executionResult.successful}</strong> leads to{' '}
                {targetAgent?.name}.
              </p>
            </div>
          ) : (
            <>
              {/* Selection Breakdown Card */}
              <div className="p-3.5 bg-slate-800/80 border border-slate-700 rounded-2xl space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Batch Breakdown
                </span>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-700/50">
                    <span className="text-[10px] text-slate-400 block">Total</span>
                    <strong className="text-white text-sm font-black">{selectedLeadIds.length}</strong>
                  </div>
                  <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20">
                    <span className="text-[10px] text-amber-300 block">Unassigned</span>
                    <strong className="text-amber-400 text-sm font-black">{unassignedCount}</strong>
                  </div>
                  <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                    <span className="text-[10px] text-blue-300 block">Reassigned</span>
                    <strong className="text-blue-400 text-sm font-black">{reassignedCount}</strong>
                  </div>
                </div>
              </div>

              {/* Target Agent Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Assign To Sales Representative *
                </label>

                {agents.length === 0 ? (
                  <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 text-xs text-amber-400">
                    No active sales representatives found. Provision an agent first.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {agents.map((agent) => (
                      <label
                        key={agent.id}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                          targetAgentId === agent.id
                            ? 'bg-purple-600/20 border-purple-500 text-white shadow-md shadow-purple-600/10'
                            : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="radio"
                            name="targetAgent"
                            value={agent.id}
                            checked={targetAgentId === agent.id}
                            onChange={(e) => setTargetAgentId(e.target.value)}
                            className="accent-purple-500"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">{agent.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono truncate">{agent.email}</p>
                          </div>
                        </div>

                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 text-[10px] font-semibold border border-emerald-500/20 shrink-0">
                          ACTIVE
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Confirmation Warning when Reassigning */}
              {isConfirming && targetAgent && (
                <div className="p-3.5 bg-amber-500/15 border border-amber-500/40 rounded-2xl space-y-2 animate-in fade-in">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-200">
                      <p className="font-bold">Confirm Bulk Lead Reassignment</p>
                      <p className="text-[11px] text-amber-300/90 mt-0.5 leading-relaxed">
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
        </div>

        {/* Footer Buttons */}
        {!executionResult && (
          <div className="p-4 bg-slate-800/80 border-t border-slate-700 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isExecuting}
              className="flex-1 py-2.5 rounded-xl border border-slate-600 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            {!isConfirming ? (
              <button
                type="button"
                onClick={() => setIsConfirming(true)}
                disabled={!targetAgentId || agents.length === 0}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition-all shadow-md shadow-purple-600/20 flex items-center justify-center gap-1.5 active:scale-98 disabled:opacity-50"
              >
                <span>Preview & Confirm</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleExecuteBulkAssign}
                disabled={isExecuting}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 active:scale-98 disabled:opacity-50"
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Assigning Leads...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Assignment</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
