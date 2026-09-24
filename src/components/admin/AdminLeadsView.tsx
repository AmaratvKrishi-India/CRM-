/**
 * Admin Leads Management View (Phase 2K)
 * Comprehensive Lead screen for Administrators:
 * - Search & multi-criteria filtering (by Agent, Unassigned, Assigned, Locality, Status).
 * - Multi-Select Checkboxes with "Select All Filtered" and "Clear".
 * - One-tap Bulk Lead Assignment Modal.
 * - Real KPI counters (Total, Unassigned, Assigned).
 * - Individual Lead Assignment & Reassignment modal.
 * Rewritten for design tokens + accessible filter pills (F1/F2/F3).
 */

import React, { useCallback, useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { crmData } from '../../db';
import type { AssignmentStats } from '../../services/leadAssignmentService';
import { LeadAssignmentService } from '../../services/leadAssignmentService';
import { AgentManagementService } from '../../services/agentManagementService';
import { LeadAssignmentModal } from '../leads/LeadAssignmentModal';
import { BulkLeadAssignmentModal } from './BulkLeadAssignmentModal';
import type { Lead, User, LeadFilterParams, LeadStatus } from '../../db/types';
import { labelFor } from '../../lib/labels';
import { useDebouncedValue } from '../../lib/useDebouncedValue';

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
  // NEW-BUG-004 — debounce the search so we don't fire a full loadData per
  // keystroke (each keystroke previously triggered agents + stats + leads queries).
  const debouncedSearch = useDebouncedValue(searchTerm, 250);
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>('ALL'); // 'ALL' | 'UNASSIGNED' | 'ASSIGNED' | agentId
  const [selectedStatus] = useState<LeadStatus | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);

  // NEW-BUG-004 — request-sequence guard: a slow earlier loadData must not
  // overwrite the list after a newer loadData has already rendered.
  const requestSeq = useRef(0);

  // Single Assignment Modal
  const [selectedLeadForAssignment, setSelectedLeadForAssignment] = useState<Lead | null>(null);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);

  // Bulk Selection State
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentUser) return;
    const seq = ++requestSeq.current;
    setLoading(true);

    try {
      // 1. Load active agents
      const agentList = await AgentManagementService.getAgents(currentUser);
      if (seq !== requestSeq.current) return; // stale result — a newer load started
      setAgents(agentList);

      // 2. Load assignment stats
      const assignmentStats = await LeadAssignmentService.getAssignmentStats(currentUser);
      if (seq !== requestSeq.current) return;
      setStats(assignmentStats);

      // 3. Search and filter leads
      const filterParams: LeadFilterParams = {
        searchTerm: debouncedSearch.trim() || undefined,
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
      if (seq !== requestSeq.current) return;
      setLeads(fetchedLeads);
    } catch (err: unknown) {
      console.warn('Error loading admin leads view:', err);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [currentUser, selectedAgentFilter, selectedStatus, debouncedSearch]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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

  const allSelected = selectedLeadIds.length > 0 && selectedLeadIds.length === leads.length;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-app text-ink font-sans">
      {/* Top Filter & Metric Row */}
      <div className="p-4 bg-inset border-b border-line space-y-3">
        {/* KPI Counter Cards */}
        <div className="grid grid-cols-2 min-[440px]:grid-cols-3 gap-2">
          <div className="p-3 bg-surface border border-line rounded-2xl">
            <p className="text-sm text-soft font-semibold leading-snug">Total leads</p>
            <p className="text-lg font-black text-ink mt-0.5">{stats.totalLeads}</p>
          </div>
          <div className="p-3 bg-accent-soft border border-accent rounded-2xl">
            <p className="text-sm text-accent-text font-semibold leading-snug">Assigned</p>
            <p className="text-lg font-black text-accent-text mt-0.5">{stats.assignedCount}</p>
          </div>
          <div className="col-span-2 min-[440px]:col-span-1 p-3 bg-warning-soft border border-warning rounded-2xl">
            <p className="text-sm text-warning-text font-semibold leading-snug">Unassigned</p>
            <p className="text-lg font-black text-warning-text mt-0.5">{stats.unassignedCount}</p>
          </div>
        </div>

        {/* Search Bar */}
        <div>
          <label htmlFor="admin-leads-search" className="sr-only">
            Search leads by business, phone, or locality
          </label>
          <div className="relative">
            <Search
              className="w-4 h-4 text-faint absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="admin-leads-search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search leads..."
              className="w-full min-h-11 bg-surface border border-line rounded-xl pl-10 pr-4 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-focus-ring"
            />
          </div>
        </div>

        <div className="sm:hidden">
          <label htmlFor="admin-assignee-filter" className="block text-sm font-semibold text-soft mb-1.5">Assigned to</label>
          <select
            id="admin-assignee-filter"
            value={selectedAgentFilter}
            onChange={(event) => setSelectedAgentFilter(event.target.value)}
            className="w-full min-h-12 px-3 rounded-xl bg-surface border border-line text-base text-ink focus:outline-none focus:ring-2 focus:ring-focus-ring"
          >
            <option value="ALL">All leads ({stats.totalLeads})</option>
            <option value="UNASSIGNED">Unassigned ({stats.unassignedCount})</option>
            {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name} ({stats.byAgent[agent.id] || 0})</option>)}
          </select>
        </div>

        {/* Desktop assignee filters */}
        <div
          role="group"
          aria-label="Filter leads by assignee"
          className="hidden sm:flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none"
        >
          <button
            type="button"
            onClick={() => setSelectedAgentFilter('ALL')}
            aria-pressed={selectedAgentFilter === 'ALL'}
            className={`min-h-11 px-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
              selectedAgentFilter === 'ALL'
                ? 'bg-accent text-on-accent shadow-md'
                : 'bg-surface text-soft hover:text-ink border border-line'
            }`}
          >
            All Leads ({stats.totalLeads})
          </button>

          <button
            type="button"
            onClick={() => setSelectedAgentFilter('UNASSIGNED')}
            aria-pressed={selectedAgentFilter === 'UNASSIGNED'}
            className={`min-h-11 px-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
              selectedAgentFilter === 'UNASSIGNED'
                ? 'bg-warning text-on-accent shadow-md'
                : 'bg-surface text-soft hover:text-ink border border-line'
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
                aria-pressed={isSelected}
                className={`min-h-11 px-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-info text-on-accent shadow-md'
                    : 'bg-surface text-soft hover:text-ink border border-line'
                }`}
              >
                <span>{agent.name}</span>
                <span className="px-1.5 py-0.5 rounded-md bg-black/20 text-xs">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bulk Selection Actions Bar */}
      <div className="bg-inset border-b border-line px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSelectAllFiltered}
            aria-pressed={allSelected}
            className="min-h-11 flex items-center gap-1.5 text-soft hover:text-ink text-sm font-semibold transition-colors"
          >
            {allSelected ? (
              <CheckSquare className="w-4 h-4 text-accent-text" aria-hidden="true" />
            ) : (
              <Square className="w-4 h-4 text-faint" aria-hidden="true" />
            )}
            <span>
              {selectedLeadIds.length > 0 ? `${selectedLeadIds.length} Selected` : 'Select All Filtered'}
            </span>
          </button>

          {selectedLeadIds.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedLeadIds([])}
              className="min-h-11 text-xs text-soft hover:text-danger-text underline transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {selectedLeadIds.length > 0 && (
          <button
            type="button"
            onClick={() => setIsBulkModalOpen(true)}
            className="min-h-11 px-3.5 rounded-xl bg-accent hover:bg-accent-hover text-on-accent text-sm font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5"
          >
            <Users className="w-4 h-4" aria-hidden="true" />
            <span>Bulk Assign ({selectedLeadIds.length})</span>
          </button>
        )}
      </div>

      {/* Lead List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {loading ? (
          <div className="py-12 text-center space-y-2" role="status">
            <Loader2 className="w-6 h-6 animate-spin text-accent-text mx-auto" aria-hidden="true" />
            <p className="text-sm text-soft">Loading organization leads...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="py-12 text-center bg-inset rounded-2xl border border-line">
            <Building2 className="w-8 h-8 text-faint mx-auto" aria-hidden="true" />
            <p className="text-sm font-bold text-ink mt-2">No Leads Matched</p>
            <p className="text-xs text-soft mt-0.5">Try adjusting search or agent filter.</p>
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
                    ? 'bg-accent-soft border-accent shadow-md'
                    : 'bg-surface border-line hover:border-line-strong'
                }`}
              >
                {/* Selection Checkbox */}
                <button
                  type="button"
                  onClick={() => handleToggleSelectLead(lead.id)}
                  aria-pressed={isSelected}
                  aria-label={`Select ${lead.businessName}`}
                  className="w-11 h-11 flex items-center justify-center text-soft hover:text-accent-text transition-colors shrink-0"
                >
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5 text-accent-text" aria-hidden="true" />
                  ) : (
                    <Square className="w-5 h-5 text-faint" aria-hidden="true" />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-ink truncate">{lead.businessName}</h3>
                    <span className="px-1.5 py-0.5 rounded-md bg-inset text-soft font-semibold text-xs">
                      {labelFor(lead.status)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-soft mt-1">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-faint" aria-hidden="true" />
                      {lead.phone}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-faint" aria-hidden="true" />
                      {lead.locality}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-1.5">
                    {assignee ? (
                      <span className="px-2 py-0.5 rounded-md bg-info-soft text-info text-xs font-semibold flex items-center gap-1 border border-info">
                        <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                        Assigned: {assignee.name}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-warning-soft text-warning-text text-xs font-semibold flex items-center gap-1 border border-warning">
                        <UserX className="w-3.5 h-3.5" aria-hidden="true" />
                        Unassigned
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenAssignModal(lead)}
                  aria-label={`${lead.assignedTo ? 'Reassign' : 'Assign'} ${lead.businessName}`}
                  className="min-h-11 px-3 rounded-xl bg-accent-soft hover:opacity-80 text-accent-text border border-accent text-sm font-bold transition-all active:scale-95 flex-shrink-0"
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
