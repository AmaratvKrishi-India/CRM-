/**
 * Admin Agents View (Phase 2D)
 * Mobile-first screen to list, search, filter, and manage sales representatives.
 * Rewritten for design tokens + button semantics on stat filters (F1/F2/F3).
 */

import React, { useCallback, useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AgentManagementService } from '../../services/agentManagementService';
import { AgentCard } from './AgentCard';
import { CreateAgentModal } from './CreateAgentModal';
import { EditAgentModal } from './EditAgentModal';
import { ConfirmStatusModal } from './ConfirmStatusModal';
import { DeleteAgentModal } from './DeleteAgentModal';
import type { User, UserStatus } from '../../db/types';

export const AdminAgentsView: React.FC = () => {
  const { currentUser } = useAuth();

  const [agents, setAgents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | UserStatus>('ALL');

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<User | null>(null);
  const [statusConfirmAgent, setStatusConfirmAgent] = useState<User | null>(null);
  const [deleteTargetAgent, setDeleteTargetAgent] = useState<User | null>(null);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const list = await AgentManagementService.getAgents(currentUser);
      setAgents(list);
    } catch (err) {
      console.warn('Failed to load agents:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Filtered Agents
  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      // Status Filter
      if (statusFilter !== 'ALL' && agent.status !== statusFilter) {
        return false;
      }
      // Search Query
      if (searchQuery.trim() !== '') {
        const query = searchQuery.trim().toLowerCase();
        const matchesName = agent.name.toLowerCase().includes(query);
        const matchesEmail = agent.email.toLowerCase().includes(query);
        const matchesPhone = agent.phone ? agent.phone.includes(query) : false;
        return matchesName || matchesEmail || matchesPhone;
      }
      return true;
    });
  }, [agents, statusFilter, searchQuery]);

  const activeCount = useMemo(() => agents.filter((a) => a.status === 'ACTIVE').length, [agents]);
  const inactiveCount = useMemo(() => agents.filter((a) => a.status === 'INACTIVE').length, [agents]);

  return (
    <div className="ui-screen space-y-4 pb-20">
      {/* Top Banner / Actions */}
      <div className="ui-card p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-ink flex items-center gap-2">
            <Users className="w-5 h-5 text-accent-text" aria-hidden="true" />
            <span>Sales Representatives</span>
          </h2>
          <p className="text-xs text-soft mt-0.5">
            Manage operational sales accounts and field permissions
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="ui-button-primary py-2.5 px-4 text-sm flex items-center justify-center gap-2 hover:bg-accent-hover active:scale-[0.98] flex-shrink-0"
        >
          <UserPlus className="w-4 h-4" aria-hidden="true" />
          <span>Provision New Agent</span>
        </button>
      </div>

      {/* KPI Stats Row (also status filters) */}
      <div role="group" aria-label="Filter agents by status" className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter('ALL')}
          aria-pressed={statusFilter === 'ALL'}
          className={`p-3 rounded-xl border text-center transition-all ${
            statusFilter === 'ALL'
              ? 'bg-accent-soft border-accent text-accent-text'
              : 'bg-surface border-line hover:border-line-strong'
          }`}
        >
          <p className="text-xs font-bold text-soft uppercase tracking-wider">Total</p>
          <p className="text-lg font-black text-ink mt-0.5">{agents.length}</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('ACTIVE')}
          aria-pressed={statusFilter === 'ACTIVE'}
          className={`p-3 rounded-xl border text-center transition-all ${
            statusFilter === 'ACTIVE'
              ? 'bg-success-soft border-success shadow-sm'
              : 'bg-surface border-line hover:border-line-strong'
          }`}
        >
          <p className="text-xs font-bold text-success-text uppercase tracking-wider">Active</p>
          <p className="text-lg font-black text-success-text mt-0.5">{activeCount}</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('INACTIVE')}
          aria-pressed={statusFilter === 'INACTIVE'}
          className={`p-3 rounded-xl border text-center transition-all ${
            statusFilter === 'INACTIVE'
              ? 'bg-danger-soft border-danger shadow-sm'
              : 'bg-surface border-line hover:border-line-strong'
          }`}
        >
          <p className="text-xs font-bold text-danger-text uppercase tracking-wider">Inactive</p>
          <p className="text-lg font-black text-danger-text mt-0.5">{inactiveCount}</p>
        </button>
      </div>

      {/* Search Bar */}
      <div>
        <label htmlFor="admin-agents-search" className="sr-only">
          Search agents by name, email or phone
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-faint">
            <Search className="w-4 h-4" aria-hidden="true" />
          </div>
          <input
            id="admin-agents-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email or phone..."
            className="w-full min-h-11 bg-inset border border-line rounded-xl pl-10 pr-3.5 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-focus-ring transition-all"
          />
        </div>
      </div>

      {/* Agents List */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-soft space-y-2" role="status">
          <Loader2 className="w-6 h-6 animate-spin text-accent-text" aria-hidden="true" />
          <p className="text-sm">Loading agents...</p>
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="ui-empty py-10 text-center p-6 space-y-3">
          <Users className="w-10 h-10 text-faint mx-auto" aria-hidden="true" />
          <p className="text-sm font-semibold text-ink">No sales agents found</p>
          <p className="text-sm text-faint max-w-xs mx-auto">
            {searchQuery
              ? 'No agents matched your search query. Try adjusting filters.'
              : 'No sales representatives have been provisioned yet.'}
          </p>
          {!searchQuery && (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="min-h-11 py-2 px-4 rounded-xl bg-accent hover:bg-accent-hover text-on-accent font-bold text-sm mt-2"
            >
              Provision First Agent
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredAgents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onEdit={(a) => setEditingAgent(a)}
              onToggleStatus={(a) => setStatusConfirmAgent(a)}
              onDelete={(a) => setDeleteTargetAgent(a)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <CreateAgentModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onAgentCreated={() => {
          fetchAgents();
        }}
      />

      <EditAgentModal
        agent={editingAgent}
        isOpen={editingAgent !== null}
        onClose={() => setEditingAgent(null)}
        onAgentUpdated={() => {
          fetchAgents();
        }}
      />

      <ConfirmStatusModal
        agent={statusConfirmAgent}
        isOpen={statusConfirmAgent !== null}
        onClose={() => setStatusConfirmAgent(null)}
        onStatusChanged={() => {
          fetchAgents();
        }}
      />

      <DeleteAgentModal
        agent={deleteTargetAgent}
        isOpen={deleteTargetAgent !== null}
        onClose={() => setDeleteTargetAgent(null)}
        onAgentDeleted={() => {
          fetchAgents();
        }}
      />
    </div>
  );
};
