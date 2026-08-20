/**
 * Non-Intrusive Sync Status Badge (Phase 2F)
 * Displays current offline-first sync state and provides one-tap manual sync trigger.
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
          label: 'Syncing...',
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
          label: 'Offline (Local)',
          bgColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        };
      case 'PENDING':
        return {
          icon: <Cloud className="w-3.5 h-3.5 text-blue-400" />,
          label: 'Pending Sync',
          bgColor: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
        };
      case 'AUTH_REQUIRED':
        return {
          icon: <Lock className="w-3.5 h-3.5 text-purple-400" />,
          label: 'Sign In to Sync',
          bgColor: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
        };
      case 'ERROR':
      default:
        return {
          icon: <AlertCircle className="w-3.5 h-3.5 text-rose-400" />,
          label: 'Sync Alert',
          bgColor: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
        };
    }
  };

  const { icon, label, bgColor } = getStatusConfig();

  return (
    <button
      type="button"
      onClick={() => synchronizeNow()}
      disabled={isSyncing}
      title={syncState.lastSyncError ? `Error: ${syncState.lastSyncError}` : `Last sync: ${syncState.lastSuccessfulSyncAt || 'Never'}`}
      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 border transition-all active:scale-95 cursor-pointer disabled:cursor-default ${bgColor}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
};
