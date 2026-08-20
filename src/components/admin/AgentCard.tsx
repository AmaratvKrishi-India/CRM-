/**
 * Mobile-First Sales Agent Card (Phase 2D)
 * Displays agent details, status, timestamps, and action buttons.
 */

import React from 'react';
import {
  User as UserIcon,
  Mail,
  Phone,
  Calendar,
  Clock,
  Edit2,
  UserX,
  UserCheck,
  Shield,
} from 'lucide-react';
import { User } from '../../db/types';

interface AgentCardProps {
  agent: User;
  onEdit: (agent: User) => void;
  onToggleStatus: (agent: User) => void;
}

export const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  onEdit,
  onToggleStatus,
}) => {
  const isAgentActive = agent.status === 'ACTIVE';

  const formatDateTime = (isoString?: string | null) => {
    if (!isoString) return 'Never';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div
      className={`p-4 rounded-2xl border transition-all duration-200 ${
        isAgentActive
          ? 'bg-slate-800/80 border-slate-700/80 hover:border-slate-600 shadow-md'
          : 'bg-slate-850/60 border-rose-900/30 opacity-80'
      }`}
    >
      {/* Header with Name, Role & Status Badges */}
      <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-700/50">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm ${
              isAgentActive
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
            }`}
          >
            {agent.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{agent.name}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="px-1.5 py-0.5 rounded-md bg-blue-500/15 text-blue-300 font-bold text-[9px] uppercase tracking-wider border border-blue-500/20">
                {agent.role}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded-md font-bold text-[9px] uppercase tracking-wider border ${
                  isAgentActive
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20'
                    : 'bg-rose-500/15 text-rose-300 border-rose-500/20'
                }`}
              >
                {agent.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Body Contact & Timestamps */}
      <div className="py-2.5 space-y-1.5 text-xs text-slate-300">
        <div className="flex items-center gap-2 text-slate-300 truncate">
          <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="truncate">{agent.email}</span>
        </div>

        {agent.phone && (
          <div className="flex items-center gap-2 text-slate-300">
            <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span>{agent.phone}</span>
          </div>
        )}

        <div className="pt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 border-t border-slate-700/40">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3 text-slate-500" />
            <span>Created: {formatDateTime(agent.createdAt)}</span>
          </div>

          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>Last Login: {formatDateTime(agent.lastLoginAt)}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-2.5 border-t border-slate-700/50 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => onEdit(agent)}
          className="py-1.5 px-3 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-600/60 transition-all active:scale-95"
        >
          <Edit2 className="w-3.5 h-3.5 text-slate-400" />
          <span>Edit</span>
        </button>

        {isAgentActive ? (
          <button
            type="button"
            onClick={() => onToggleStatus(agent)}
            className="py-1.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold flex items-center gap-1.5 border border-rose-500/30 transition-all active:scale-95"
          >
            <UserX className="w-3.5 h-3.5 text-rose-400" />
            <span>Deactivate</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onToggleStatus(agent)}
            className="py-1.5 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 border border-emerald-500/30 transition-all active:scale-95"
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Activate</span>
          </button>
        )}
      </div>
    </div>
  );
};
