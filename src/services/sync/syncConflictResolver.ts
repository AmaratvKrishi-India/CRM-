/**
 * Sync Conflict Resolver (Phase 2F & 2J)
 * Implements deterministic conflict resolution rules between local Dexie and remote Supabase records:
 * 1. Append-Only Entities (Activity, MessageHistory, ImportAudit): UUID Idempotency.
 * 2. Call Records: VERIFIED duration strictly wins over UNVERIFIED duration.
 * 3. Mutable Entities (Lead, FollowUp, Remark, Profile): Timestamp / Version Last-Write-Wins (LWW).
 */

import { SyncEntityType, SyncConflict } from './syncTypes';

export interface ResolutionResult<T = any> {
  winner: 'LOCAL' | 'REMOTE';
  data: T;
  conflict?: SyncConflict;
}

export class SyncConflictResolver {
  /**
   * Resolves append-only entity synchronization (idempotent UUID matching).
   */
  static resolveAppendOnly<T extends { id: string }>(
    local: T | undefined,
    remote: T
  ): ResolutionResult<T> {
    if (!local) {
      return { winner: 'REMOTE', data: remote };
    }
    // Record already exists locally with same UUID; keep local to preserve device-local metadata
    return { winner: 'LOCAL', data: local };
  }

  /**
   * Resolves mutable entity conflicts using Last-Write-Wins (LWW) timestamp comparisons.
   */
  static resolveMutable<T extends { id: string; updatedAt?: string; updated_at?: string }>(
    entityType: SyncEntityType,
    local: T | undefined,
    remote: T
  ): ResolutionResult<T> {
    if (!local) {
      return { winner: 'REMOTE', data: remote };
    }

    const localTime = new Date(local.updatedAt || (local as any).updated_at || 0).getTime();
    const remoteTime = new Date((remote as any).updated_at || remote.updatedAt || 0).getTime();

    if (remoteTime > localTime) {
      // Remote is newer
      const conflict: SyncConflict = {
        id: `conflict_${entityType}_${local.id}_${Date.now()}`,
        entityType,
        entityId: local.id,
        localData: local,
        remoteData: remote,
        resolution: 'REMOTE_WON',
        resolvedAt: new Date().toISOString(),
      };
      return { winner: 'REMOTE', data: remote, conflict };
    }

    // Local is newer or equal
    return { winner: 'LOCAL', data: local };
  }

  /**
   * Resolves CallRecord entity conflicts:
   * VERIFIED duration strictly wins over UNVERIFIED duration.
   * If verification levels match, timestamp Last-Write-Wins (LWW) is used.
   */
  static resolveCallRecord<T extends { id: string; verificationStatus?: string; verification_status?: string; updatedAt?: string; updated_at?: string }>(
    local: T | undefined,
    remote: T
  ): ResolutionResult<T> {
    if (!local) {
      return { winner: 'REMOTE', data: remote };
    }

    const localVerified = (local.verificationStatus || (local as any).verification_status) === 'VERIFIED';
    const remoteVerified = ((remote as any).verification_status || remote.verificationStatus) === 'VERIFIED';

    if (remoteVerified && !localVerified) {
      // Remote is verified, local is unverified: remote strictly wins
      const conflict: SyncConflict = {
        id: `conflict_call_records_${local.id}_${Date.now()}`,
        entityType: 'call_records',
        entityId: local.id,
        localData: local,
        remoteData: remote,
        resolution: 'REMOTE_WON',
        resolvedAt: new Date().toISOString(),
      };
      return { winner: 'REMOTE', data: remote, conflict };
    }

    if (localVerified && !remoteVerified) {
      // Local is verified, remote is unverified: local strictly wins
      return { winner: 'LOCAL', data: local };
    }

    // Both verified or both unverified: fallback to timestamp LWW
    return this.resolveMutable('call_records', local, remote);
  }
}
