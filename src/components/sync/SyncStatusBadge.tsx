/**
 * Non-Intrusive Sync Status Badge (Phase 3)
 * Shows automatic sync state silently. Never asks user to sync.
 * Manual "Sync Now" button is a secondary optional action.
 *
 * UX remediation: design tokens (F1/F12), 44px touch target on the sync
 * button (F6), aria-label instead of hover-only title (F21), aria-live so
 * state changes are announced (F2/F17).
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
          icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />,
          label: 'Syncing…',
          colors: 'bg-info-soft text-info-text border-info',
        };
      case 'SYNCED':
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />,
          label: 'Synced',
          colors: 'bg-success-soft text-success-text border-success',
        };
      case 'OFFLINE':
        return {
          icon: <CloudOff className="w-3.5 h-3.5" aria-hidden="true" />,
          label: 'Offline — saved locally',
          colors: 'bg-warning-soft text-warning-text border-warning',
        };
      case 'PENDING':
        return {
          icon: <Cloud className="w-3.5 h-3.5" aria-hidden="true" />,
          label: 'Sync queued…',
          colors: 'bg-info-soft text-info-text border-info',
        };
      case 'AUTH_REQUIRED':
        return {
          icon: <Lock className="w-3.5 h-3.5" aria-hidden="true" />,
          label: 'Sign in to enable sync',
          colors: 'bg-accent-soft text-accent-text border-accent',
        };
      case 'ERROR':
      default:
        return {
          icon: <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />,
          label: 'Sync issue — retrying',
          colors: 'bg-danger-soft text-danger-text border-danger',
        };
    }
  };

  const { icon, label, colors } = getStatusConfig();

  const lastSyncText = syncState.lastSuccessfulSyncAt
    ? `Last synced: ${new Date(syncState.lastSuccessfulSyncAt).toLocaleTimeString()}`
    : syncState.lastSyncError
    ? `Error: ${syncState.lastSyncError}`
    : 'Waiting for first sync';

  return (
    <div className="flex items-center gap-1">
      {/* Status indicator (read-only) */}
      <div
        role="status"
        aria-label={`${label}. ${lastSyncText}`}
        className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border ${colors}`}
      >
        {icon}
        <span>{label}</span>
      </div>

      {/* Optional manual sync button — 44px touch target (F6) */}
      <button
        type="button"
        onClick={() => synchronizeNow()}
        disabled={isSyncing}
        aria-label="Sync Now"
        className="min-w-11 min-h-11 rounded-xl bg-inset hover:bg-inset-strong border border-line flex items-center justify-center text-soft hover:text-ink transition-all active:scale-90 disabled:opacity-40 disabled:cursor-default"
      >
        <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} aria-hidden="true" />
      </button>
    </div>
  );
};
