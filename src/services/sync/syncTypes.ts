/**
 * Offline Sync Engine Type Definitions (Phase 2F)
 * Defines Outbox queue items, sync states, push/pull payloads, and conflict records.
 */

export type SyncEntityType =
  | 'leads'
  | 'call_records'
  | 'activities'
  | 'remarks'
  | 'follow_ups'
  | 'message_history'
  | 'import_audits'
  | 'profiles'
  | 'bulk_assignment_audits';

export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';

export type OutboxStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'DEAD_LETTER';

export type SyncEngineStatus =
  | 'SYNCED'
  | 'SYNCING'
  | 'OFFLINE'
  | 'PENDING'
  | 'ERROR'
  | 'AUTH_REQUIRED';

export interface OutboxItem {
  id: string; // UUID primary key
  organizationId: string | null;
  userId: string;
  deviceId: string | null;
  entityType: SyncEntityType;
  entityId: string; // UUID of the target entity
  operation: SyncOperation;
  payload: Record<string, any>;
  createdAt: string; // ISO DateTime
  updatedAt: string; // ISO DateTime
  retryCount: number;
  lastAttemptAt: string | null;
  nextAttemptAt?: string | null;
  lastError: string | null;
  status: OutboxStatus;
}

/** Throws when a sync run no longer belongs to the active account generation. */
export type SyncRunGuard = () => void;

export class SyncCancelledError extends Error {
  constructor(message = 'Synchronization context is no longer active.') {
    super(message);
    this.name = 'SyncCancelledError';
  }
}

export interface SyncState {
  id: string;
  deviceId: string;
  organizationId: string;
  userId: string;
  lastSuccessfulSyncAt: string | null;
  lastPullCursor: string | null;
  lastPushAt: string | null;
  lastPullAt: string | null;
  lastSyncError: string | null;
  status: SyncEngineStatus;
}

export interface SyncConflict {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  localData: Record<string, any>;
  remoteData: Record<string, any>;
  resolution: 'LOCAL_WON' | 'REMOTE_WON' | 'MERGED';
  resolvedAt: string;
}

export interface SyncResult {
  pushedCount: number;
  pulledCount: number;
  failedCount: number;
  conflictsCount: number;
  durationMs: number;
  error?: string | null;
}
