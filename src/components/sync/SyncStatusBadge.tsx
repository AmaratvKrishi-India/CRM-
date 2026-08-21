/**
 * Non-Intrusive Sync Status Badge (Phase 3)
 * Shows automatic sync state silently. Never asks user to sync.
 * Manual "Sync Now" button is a secondary optional action.
 */

import React from 'react';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  AlertCircle,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import { useSync } from '../../services/sync/useSync';

export const SyncStatusBadge: React.FC = () => {
  const { syncState, isSyncing, synchronizeNow } = useSync();

  if (!syncState) return null;

  const status = syncState.status;

  const getStatusConfig = () => {
    switch (status) {
      case 'SYNCING':
        return {
          icon: <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />,
          label: 'Syncing\u2026',
          bgColor: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
        };
      case 'SYNCED':
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
          label: 'Synced',
          bgColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        };
      case 'OFFLINE':
        return {
          icon: <CloudOff className="w-3.5 h-3.5 text-amber-400" />,
          label: 'Offline \u2014 saved locally',
          bgColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        };
      case 'PENDING':
        return {
          icon: <Cloud className="w-3.5 h-3.5 text-blue-400" />,
          label: 'Sync queued\u2026',
          bgColor: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
        };
      case 'AUTH_REQUIRED':
        return {
          icon: <Lock className="w-3.5 h-3.5 text-purple-400" />,
          label: 'Sign in to enable sync',
          bgColor: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
        };
      case 'ERROR':
      default:
        return {
          icon: <AlertCircle className="w-3.5 h-3.5 text-rose-400" />,
          label: 'Sync issue \u2014 retrying',
          bgColor: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
        };
    }
  };

  const { icon, label, bgColor } = getStatusConfig();

  const lastSyncText = syncState.lastSuccessfulSyncAt
    ? `Last synced: ${new Date(syncState.lastSuccessfulSyncAt).toLocaleTimeString()}`
    : syncState.lastSyncError
    ? `Error: ${syncState.lastSyncError}`
    : 'Waiting for first sync';

  return (
    <div className="flex items-center gap-1.5">
      {/* Status indicator (read-only) */}
      <div
        title={lastSyncText}
        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 border ${bgColor}`}
      >
        {icon}
        <span>{label}</span>
      </div>

      {/* Optional manual sync button */}
      <button
        type="button"
        onClick={() => synchronizeNow()}
        disabled={isSyncing}
        title="Sync Now"
        className="w-6 h-6 rounded-full bg-slate-700/60 hover:bg-slate-700 border border-slate-600/50 flex items-center justify-center text-slate-400 hover:text-white transition-all active:scale-90 disabled:opacity-40 disabled:cursor-default"
      >
        <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
};
