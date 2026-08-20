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

export type OutboxStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';

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
  lastError: string | null;
  status: OutboxStatus;
}

export interface SyncState {
  id: 'current';
  deviceId: string;
  organizationId: string | null;
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
