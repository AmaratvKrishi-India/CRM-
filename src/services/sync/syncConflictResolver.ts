/**
 * Sync Conflict Resolver (Phase 2F & 2J)
 * Implements deterministic conflict resolution rules between local Dexie and remote Supabase records:
 * 1. Append-Only Entities (Activity, MessageHistory, ImportAudit): UUID Idempotency.
 * 2. Call Records: VERIFIED duration strictly wins over UNVERIFIED duration.
 * 3. Mutable entities: server revision order; client dates are business metadata only.
 */

import { serverRevision, type SyncEntityType, type SyncConflict } from './syncTypes';

export interface ResolutionResult<T = unknown> {
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
    // A server tombstone is authoritative for append-only records; retaining
    // the local copy would resurrect it on a later replay.
    if ((remote as { deletedAt?: string | null; deleted_at?: string | null }).deletedAt ||
        (remote as { deletedAt?: string | null; deleted_at?: string | null }).deleted_at) {
      return { winner: 'REMOTE', data: remote };
    }
    // Record already exists locally with same UUID; keep local to preserve device-local metadata
    return { winner: 'LOCAL', data: local };
  }

  /**
   * Server revision order. An equal-revision refresh preserves a pending local
   * edit until conditional push acknowledges it. A higher server revision wins;
   * the rejected edit remains in the outbox for explicit recovery.
   */
  static resolveMutable<T extends { id: string; updatedAt?: string; updated_at?: string }>(
    entityType: SyncEntityType,
    local: T | undefined,
    remote: T
  ): ResolutionResult<T> {
    if (!local) {
      return { winner: 'REMOTE', data: remote };
    }

    const localRevision = serverRevision(local);
    const remoteRevision = serverRevision(remote);
    if (localRevision !== undefined && remoteRevision === undefined) return { winner: 'LOCAL', data: local };
    // Never infer ordering from a client's date. Unversioned cache is replaced
    // by server state; its queued snapshots remain available for conflict recovery.
    if (localRevision !== undefined && remoteRevision !== undefined &&
        (localRevision > remoteRevision ||
         (localRevision === remoteRevision && (local as { isSynced?: number }).isSynced === 0))) {
      return { winner: 'LOCAL', data: local };
    }
    {
      // Canonical server record, including upgrades from unversioned cache.
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

  }

  /**
   * Resolves CallRecord entity conflicts:
   * VERIFIED duration strictly wins over UNVERIFIED duration.
   * Versioned records use server revision order. Legacy duration precedence is
   * retained for unversioned data; equal verification uses canonical remote state.
   */
  static resolveCallRecord<T extends { id: string; verificationStatus?: string; verification_status?: string; updatedAt?: string; updated_at?: string }>(
    local: T | undefined,
    remote: T
  ): ResolutionResult<T> {
    if (!local) {
      return { winner: 'REMOTE', data: remote };
    }

    // Versioned server state determines the complete canonical record. The
    // server mutation path separately preserves verified duration invariants.
    if (serverRevision(remote) !== undefined) return this.resolveMutable('call_records', local, remote);

    // Deletion/update conflicts use canonical ordering. Duration
    // verification only decides between two live call records.
    const localDeleted = (local as { deletedAt?: string | null; deleted_at?: string | null }).deletedAt ||
      (local as { deletedAt?: string | null; deleted_at?: string | null }).deleted_at;
    const remoteDeleted = (remote as { deletedAt?: string | null; deleted_at?: string | null }).deletedAt ||
      (remote as { deletedAt?: string | null; deleted_at?: string | null }).deleted_at;
    if (localDeleted || remoteDeleted) {
      return this.resolveMutable('call_records', local, remote);
    }

    const localVerified = (local.verificationStatus || local.verification_status) === 'VERIFIED';
    const remoteVerified = (remote.verification_status || remote.verificationStatus) === 'VERIFIED';

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

    // Both verified or both unverified: canonical ordering, never client time.
    return this.resolveMutable('call_records', local, remote);
  }
}
