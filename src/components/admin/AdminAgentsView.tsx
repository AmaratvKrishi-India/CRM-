/**
 * Admin Agents View (Phase 2D)
 * Mobile-first screen to list, search, filter, and manage sales representatives.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AgentManagementService } from '../../services/agentManagementService';
import { AgentCard } from './AgentCard';
import { CreateAgentModal } from './CreateAgentModal';
import { EditAgentModal } from './EditAgentModal';
import { ConfirmStatusModal } from './ConfirmStatusModal';
import { User, UserStatus } from '../../db/types';

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

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const list = await AgentManagementService.getAgents(currentUser);
      setAgents(list);
    } catch (err) {
      console.warn('Failed to load agents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, [currentUser]);

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
    <div className="space-y-4 pb-20">
      {/* Top Banner / Actions */}
      <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700/80 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            <span>Sales Representatives</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage operational sales accounts and field permissions
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex-shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Provision New Agent</span>
        </button>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-3 gap-2">
        <div
          onClick={() => setStatusFilter('ALL')}
          className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${
            statusFilter === 'ALL'
              ? 'bg-blue-950/40 border-blue-500/50 shadow-sm'
              : 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600'
          }`}
        >
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</p>
          <p className="text-lg font-black text-white mt-0.5">{agents.length}</p>
        </div>

        <div
          onClick={() => setStatusFilter('ACTIVE')}
          className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${
            statusFilter === 'ACTIVE'
              ? 'bg-emerald-950/40 border-emerald-500/50 shadow-sm'
              : 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600'
          }`}
        >
          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Active</p>
          <p className="text-lg font-black text-emerald-300 mt-0.5">{activeCount}</p>
        </div>

        <div
          onClick={() => setStatusFilter('INACTIVE')}
          className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${
            statusFilter === 'INACTIVE'
              ? 'bg-rose-950/40 border-rose-500/50 shadow-sm'
              : 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600'
          }`}
        >
          <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Inactive</p>
          <p className="text-lg font-black text-rose-300 mt-0.5">{inactiveCount}</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, email or phone..."
          className="w-full bg-slate-800/90 border border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
        />
      </div>

      {/* Agents List */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          <p className="text-xs">Loading agents...</p>
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="py-12 text-center bg-slate-800/40 rounded-2xl border border-slate-700/50 p-6 space-y-3">
          <Users className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">No sales agents found</p>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            {searchQuery
              ? 'No agents matched your search query. Try adjusting filters.'
              : 'No sales representatives have been provisioned yet.'}
          </p>
          {!searchQuery && (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="py-2 px-4 rounded-xl bg-blue-600 text-white font-bold text-xs mt-2"
            >
              Provision First Agent
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAgents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onEdit={(a) => setEditingAgent(a)}
              onToggleStatus={(a) => setStatusConfirmAgent(a)}
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
    </div>
  );
};
