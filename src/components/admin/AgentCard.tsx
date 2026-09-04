/**
 * Mobile-First Sales Agent Card (Phase 2D)
 * Displays agent details, status, timestamps, and action buttons.
 * Rewritten for design tokens + accessible action buttons (F1/F2/F21).
 */

import React from 'react';
import {
  Mail,
  Phone,
  Calendar,
  Clock,
  Edit2,
  UserX,
  UserCheck,
  Trash2,
} from 'lucide-react';
import type { User } from '../../db/types';

interface AgentCardProps {
  agent: User;
  onEdit: (agent: User) => void;
  onToggleStatus: (agent: User) => void;
  onDelete: (agent: User) => void;
}

export const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  onEdit,
  onToggleStatus,
  onDelete,
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
          ? 'bg-surface border-line hover:border-line-strong shadow-md'
          : 'bg-inset border-danger/30 opacity-80'
      }`}
    >
      {/* Header with Name, Role & Status Badges */}
      <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-line">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm ${
              isAgentActive
                ? 'bg-success-soft text-success-text border border-success'
                : 'bg-danger-soft text-danger-text border border-danger'
            }`}
            aria-hidden="true"
          >
            {agent.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-ink truncate">{agent.name}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="px-1.5 py-0.5 rounded-md bg-info-soft text-info font-bold text-xs uppercase tracking-wider border border-info">
                {agent.role}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded-md font-bold text-xs uppercase tracking-wider border ${
                  isAgentActive
                    ? 'bg-success-soft text-success-text border-success'
                    : 'bg-danger-soft text-danger-text border-danger'
                }`}
              >
                {agent.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Body Contact & Timestamps */}
      <div className="py-2.5 space-y-1.5 text-sm text-soft">
        <div className="flex items-center gap-2 truncate">
          <Mail className="w-4 h-4 text-faint flex-shrink-0" aria-hidden="true" />
          <span className="truncate">{agent.email}</span>
        </div>

        {agent.phone && (
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-faint flex-shrink-0" aria-hidden="true" />
            <span>{agent.phone}</span>
          </div>
        )}

        <div className="pt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-faint border-t border-line">
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Created: {formatDateTime(agent.createdAt)}</span>
          </div>

          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Last Login: {formatDateTime(agent.lastLoginAt)}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-2.5 border-t border-line flex items-center justify-between gap-2">
        {/* Left: Deleted badge if applicable */}
        {agent.deletedAt ? (
          <span className="px-2 py-0.5 rounded-lg bg-inset text-faint font-bold text-xs uppercase tracking-wider border border-line">
            Deleted
          </span>
        ) : (
          <div />
        )}

        {/* Right: Action buttons */}
        <div className="flex items-center gap-2">
          {!agent.deletedAt && (
            <button
              type="button"
              onClick={() => onEdit(agent)}
              aria-label={`Edit ${agent.name}`}
              className="min-h-11 py-1.5 px-3 rounded-xl bg-inset hover:bg-inset-strong text-ink text-sm font-semibold flex items-center gap-1.5 border border-line transition-all active:scale-95"
            >
              <Edit2 className="w-4 h-4 text-soft" aria-hidden="true" />
              <span>Edit</span>
            </button>
          )}

          {!agent.deletedAt &&
            (isAgentActive ? (
              <button
                type="button"
                onClick={() => onToggleStatus(agent)}
                aria-label={`Deactivate ${agent.name}`}
                className="min-h-11 py-1.5 px-3 rounded-xl bg-danger-soft hover:opacity-80 text-danger-text text-sm font-semibold flex items-center gap-1.5 border border-danger transition-all active:scale-95"
              >
                <UserX className="w-4 h-4" aria-hidden="true" />
                <span>Deactivate</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onToggleStatus(agent)}
                aria-label={`Activate ${agent.name}`}
                className="min-h-11 py-1.5 px-3 rounded-xl bg-success-soft hover:opacity-80 text-success-text text-sm font-semibold flex items-center gap-1.5 border border-success transition-all active:scale-95"
              >
                <UserCheck className="w-4 h-4" aria-hidden="true" />
                <span>Activate</span>
              </button>
            ))}

          {!agent.deletedAt && (
            <button
              type="button"
              onClick={() => onDelete(agent)}
              aria-label={`Permanently delete ${agent.name}`}
              className="min-h-11 w-11 flex items-center justify-center rounded-xl bg-inset hover:bg-danger-soft text-faint hover:text-danger-text border border-line hover:border-danger transition-all active:scale-95"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
