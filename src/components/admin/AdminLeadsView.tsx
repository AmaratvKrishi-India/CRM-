/**
 * Admin Leads Management View (Phase 2K)
 * Comprehensive Lead screen for Administrators:
 * - Search & multi-criteria filtering (by Agent, Unassigned, Assigned, Locality, Status).
 * - Multi-Select Checkboxes with "Select All Filtered" and "Clear".
 * - One-tap Bulk Lead Assignment Modal.
 * - Real KPI counters (Total, Unassigned, Assigned).
 * - Individual Lead Assignment & Reassignment modal.
 */

import React, { useState, useEffect } from 'react';
import {
  Search,
  UserCheck,
  UserX,
  Users,
  Building2,
  Phone,
  MapPin,
  Loader2,
  CheckSquare,
  Square,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { crmData } from '../../db';
import { LeadAssignmentService, AssignmentStats } from '../../services/leadAssignmentService';
import { AgentManagementService } from '../../services/agentManagementService';
import { LeadAssignmentModal } from '../leads/LeadAssignmentModal';
import { BulkLeadAssignmentModal } from './BulkLeadAssignmentModal';
import { Lead, User } from '../../db/types';

export const AdminLeadsView: React.FC = () => {
  const { currentUser } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [stats, setStats] = useState<AssignmentStats>({
    totalLeads: 0,
    unassignedCount: 0,
    assignedCount: 0,
    byAgent: {},
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>('ALL'); // 'ALL' | 'UNASSIGNED' | 'ASSIGNED' | agentId
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);

  // Single Assignment Modal
  const [selectedLeadForAssignment, setSelectedLeadForAssignment] = useState<Lead | null>(null);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);

  // Bulk Selection State
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, [currentUser, selectedAgentFilter, selectedStatus, searchTerm]);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);

    try {
      // 1. Load active agents
      const agentList = await AgentManagementService.getAgents(currentUser);
      setAgents(agentList);

      // 2. Load assignment stats
      const assignmentStats = await LeadAssignmentService.getAssignmentStats(currentUser);
      setStats(assignmentStats);

      // 3. Search and filter leads
      const filterParams: {
        searchTerm?: string;
        assignedTo?: string;
        status?: any;
        limit?: number;
      } = {
        searchTerm: searchTerm.trim() || undefined,
        limit: 150,
      };

      if (selectedAgentFilter === 'UNASSIGNED') {
        filterParams.assignedTo = 'UNASSIGNED';
      } else if (selectedAgentFilter === 'ASSIGNED') {
        filterParams.assignedTo = 'ASSIGNED';
      } else if (selectedAgentFilter !== 'ALL') {
        filterParams.assignedTo = selectedAgentFilter;
      }

      if (selectedStatus !== 'ALL') {
        filterParams.status = selectedStatus;
      }

      const { leads: fetchedLeads } = await crmData.leads.searchAndFilterLeads(filterParams);
      setLeads(fetchedLeads);
    } catch (err: unknown) {
      console.warn('Error loading admin leads view:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelectLead = (leadId: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]
    );
  };

  const handleSelectAllFiltered = () => {
    if (selectedLeadIds.length === leads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(leads.map((l) => l.id));
    }
  };

  const handleOpenAssignModal = (lead: Lead) => {
    setSelectedLeadForAssignment(lead);
    setIsAssignmentModalOpen(true);
  };

  const handleAssignmentComplete = (updatedLead: Lead) => {
    setLeads((prev) => prev.map((l) => (l.id === updatedLead.id ? updatedLead : l)));
    loadData();
  };

  const handleBulkAssignmentComplete = () => {
    setSelectedLeadIds([]);
    loadData();
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-900 text-white font-sans">
      {/* Top Filter & Metric Row */}
      <div className="p-4 bg-slate-800/60 border-b border-slate-700/80 space-y-3">
        {/* KPI Counter Cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 bg-slate-800/90 border border-slate-700/80 rounded-2xl">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Leads</p>
            <p className="text-lg font-black text-white mt-0.5">{stats.totalLeads}</p>
          </div>
          <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-2xl">
            <p className="text-[10px] text-purple-300 font-bold uppercase tracking-wider">Assigned</p>
            <p className="text-lg font-black text-purple-400 mt-0.5">{stats.assignedCount}</p>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
            <p className="text-[10px] text-amber-300 font-bold uppercase tracking-wider">Unassigned</p>
            <p className="text-lg font-black text-amber-400 mt-0.5">{stats.unassignedCount}</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search leads by business, phone, or locality..."
            className="w-full bg-slate-800 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Horizontal Agent Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedAgentFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedAgentFilter === 'ALL'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
            }`}
          >
            All Leads ({stats.totalLeads})
          </button>

          <button
            type="button"
            onClick={() => setSelectedAgentFilter('UNASSIGNED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedAgentFilter === 'UNASSIGNED'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
            }`}
          >
            Unassigned ({stats.unassignedCount})
          </button>

          {agents.map((agent) => {
            const count = stats.byAgent[agent.id] || 0;
            const isSelected = selectedAgentFilter === agent.id;

            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => setSelectedAgentFilter(agent.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                }`}
              >
                <span>{agent.name}</span>
                <span className="px-1.5 py-0.2 rounded-md bg-black/20 text-[10px]">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bulk Selection Actions Bar */}
      <div className="bg-slate-800/90 border-b border-slate-700 px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSelectAllFiltered}
            className="flex items-center gap-1.5 text-slate-300 hover:text-white font-semibold transition-colors"
          >
            {selectedLeadIds.length > 0 && selectedLeadIds.length === leads.length ? (
              <CheckSquare className="w-4 h-4 text-purple-400" />
            ) : (
              <Square className="w-4 h-4 text-slate-500" />
            )}
            <span>
              {selectedLeadIds.length > 0
                ? `${selectedLeadIds.length} Selected`
                : 'Select All Filtered'}
            </span>
          </button>

          {selectedLeadIds.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedLeadIds([])}
              className="text-[11px] text-slate-400 hover:text-rose-400 underline transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {selectedLeadIds.length > 0 && (
          <button
            type="button"
            onClick={() => setIsBulkModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-600/20 active:scale-95 flex items-center gap-1.5"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Bulk Assign ({selectedLeadIds.length})</span>
          </button>
        )}
      </div>

      {/* Lead List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {loading ? (
          <div className="py-12 text-center space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-purple-400 mx-auto" />
            <p className="text-xs text-slate-400">Loading organization leads...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="py-12 text-center bg-slate-800/40 rounded-2xl border border-slate-700/50">
            <Building2 className="w-8 h-8 text-slate-500 mx-auto" />
            <p className="text-xs font-bold text-slate-300 mt-2">No Leads Matched</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Try adjusting search or agent filter.</p>
          </div>
        ) : (
          leads.map((lead) => {
            const assignee = agents.find((a) => a.id === lead.assignedTo);
            const isSelected = selectedLeadIds.includes(lead.id);

            return (
              <div
                key={lead.id}
                className={`p-3.5 rounded-2xl flex items-center justify-between gap-3 transition-all border ${
                  isSelected
                    ? 'bg-purple-900/20 border-purple-500/60 shadow-md shadow-purple-600/10'
                    : 'bg-slate-800/80 border-slate-700/70 hover:border-slate-600'
                }`}
              >
                {/* Selection Checkbox */}
                <button
                  type="button"
                  onClick={() => handleToggleSelectLead(lead.id)}
                  className="p-1 text-slate-400 hover:text-purple-400 transition-colors shrink-0"
                >
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5 text-purple-400" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-500" />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-white truncate">{lead.businessName}</h3>
                    <span className="px-1.5 py-0.5 rounded-md bg-slate-700 text-slate-300 font-semibold text-[10px]">
                      {lead.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-500" />
                      {lead.phone}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      {lead.locality}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-1.5">
                    {assignee ? (
                      <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 text-[10px] font-semibold flex items-center gap-1 border border-blue-500/20">
                        <UserCheck className="w-3 h-3" />
                        Assigned: {assignee.name}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 text-[10px] font-semibold flex items-center gap-1 border border-amber-500/20">
                        <UserX className="w-3 h-3" />
                        Unassigned
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenAssignModal(lead)}
                  className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 hover:text-white border border-purple-500/40 text-xs font-bold transition-all active:scale-95 flex-shrink-0"
                >
                  {lead.assignedTo ? 'Reassign' : 'Assign'}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Individual Assignment Modal */}
      <LeadAssignmentModal
        isOpen={isAssignmentModalOpen}
        lead={selectedLeadForAssignment}
        onClose={() => {
          setIsAssignmentModalOpen(false);
          setSelectedLeadForAssignment(null);
        }}
        onAssignmentComplete={handleAssignmentComplete}
      />

      {/* Bulk Assignment Modal */}
      <BulkLeadAssignmentModal
        isOpen={isBulkModalOpen}
        selectedLeadIds={selectedLeadIds}
        onClose={() => setIsBulkModalOpen(false)}
        onAssignmentComplete={handleBulkAssignmentComplete}
      />
    </div>
  );
};
