/**
 * Sync conflict resolver regression tests.
 *
 * The prior suite targeted the removed instance-based ConflictResolver API.
 * These cases retain its coverage intent against the current deterministic
 * resolver: server tie-breaking for mutable data, append-only idempotency,
 * and verified-call precedence.
 */

import { describe, expect, it } from 'vitest';
import { SyncConflictResolver } from '@/services/sync/syncConflictResolver';

describe('SyncConflictResolver', () => {
  describe('resolveMutable', () => {
    it('should apply REMOTE-wins for UPDATE operations', () => {
      const local = { id: 'lead-1', businessName: 'Local Gym', updatedAt: '2024-01-01T00:00:00Z' };
      const remote = { id: 'lead-1', businessName: 'Remote Gym', updatedAt: '2024-01-02T00:00:00Z' };

      const resolved = SyncConflictResolver.resolveMutable('leads', local, remote);

      expect(resolved.winner).toBe('REMOTE');
      expect(resolved.data).toEqual(remote);
      expect(resolved.conflict?.resolution).toBe('REMOTE_WON');
    });

    it('should use server revisions for DELETE versus UPDATE conflicts', () => {
      const local = {
        id: 'lead-1',
        businessName: 'Deleted locally',
        serverRevision: 2,
        deletedAt: '2024-01-03T00:00:00Z',
        updatedAt: '2024-01-03T00:00:00Z',
      };
      const remote = { id: 'lead-1', serverRevision: 1, businessName: 'Remote update', updatedAt: '2024-01-02T00:00:00Z' };

      const resolved = SyncConflictResolver.resolveMutable('leads', local, remote);

      expect(resolved.winner).toBe('LOCAL');
      expect(resolved.data).toEqual(local);
    });

    it('should replace a mutable record atomically instead of merging fields', () => {
      const local = {
        id: 'lead-1',
        businessName: 'Local Gym',
        phone: '9876543210',
        address: 'Local address',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      const remote = {
        id: 'lead-1',
        businessName: 'Remote Gym',
        locality: 'Gomti Nagar',
        updatedAt: '2024-01-02T00:00:00Z',
      };

      const resolved = SyncConflictResolver.resolveMutable('leads', local, remote);

      expect(resolved.winner).toBe('REMOTE');
      expect(resolved.data).toEqual(remote);
      expect(resolved.data).not.toHaveProperty('phone');
    });

    it('should prefer higher locally observed server revision for delayed events', () => {
      const local = { id: 'lead-1', serverRevision: 2, businessName: 'Local Gym', updatedAt: '2024-01-01T12:00:00Z' };
      const remote = { id: 'lead-1', serverRevision: 1, businessName: 'Remote Gym', updatedAt: '2024-01-01T10:00:00Z' };

      const resolved = SyncConflictResolver.resolveMutable('leads', local, remote);

      expect(resolved.winner).toBe('LOCAL');
      expect(resolved.data).toEqual(local);
    });

    it('should replace an unversioned cache with a versioned server record and record the conflict', () => {
      const local = {
        id: 'lead-unversioned', businessName: 'Cached Gym', isSynced: 1, updatedAt: '2024-01-03T00:00:00Z',
      };
      const remote = {
        id: 'lead-unversioned', businessName: 'Canonical Gym', serverRevision: 1, updatedAt: '2024-01-01T00:00:00Z',
      };

      const resolved = SyncConflictResolver.resolveMutable('leads', local, remote);

      expect(resolved.winner).toBe('REMOTE');
      expect(resolved.data).toEqual(remote);
      expect(resolved.conflict?.entityType).toBe('leads');
    });

    it('should not treat an unversioned dirty cache as newer than an unversioned remote record', () => {
      const local = { id: 'lead-unversioned-dirty', businessName: 'Pending Gym', isSynced: 0 };
      const remote = { id: 'lead-unversioned-dirty', businessName: 'Server Gym' };

      const resolved = SyncConflictResolver.resolveMutable('leads', local, remote);

      expect(resolved.winner).toBe('REMOTE');
      expect(resolved.data).toEqual(remote);
    });

    it('should preserve a dirty same-revision local edit but replace a clean same-revision cache', () => {
      const remote = { id: 'lead-same-revision', serverRevision: 4, businessName: 'Server Gym', isSynced: 1 };
      const pending = { ...remote, businessName: 'Pending Local Gym', isSynced: 0 };
      const pendingResult = SyncConflictResolver.resolveMutable('leads', pending, remote);

      expect(pendingResult.winner).toBe('LOCAL');
      expect(pendingResult.data).toEqual(pending);

      const clean = { ...remote, businessName: 'Stale Cache Gym' };
      const cleanResult = SyncConflictResolver.resolveMutable('leads', clean, remote);

      expect(cleanResult.winner).toBe('REMOTE');
      expect(cleanResult.data).toEqual(remote);
      expect(cleanResult.conflict?.entityType).toBe('leads');
    });

    it('should reject a dirty local snapshot when the remote server revision is higher', () => {
      const local = { id: 'lead-dirty-older', serverRevision: 1, businessName: 'Pending Gym', isSynced: 0 };
      const remote = { id: 'lead-dirty-older', serverRevision: 2, businessName: 'Canonical Gym', isSynced: 1 };

      const resolved = SyncConflictResolver.resolveMutable('leads', local, remote);

      expect(resolved.winner).toBe('REMOTE');
      expect(resolved.data).toEqual(remote);
    });
  });

  describe('resolveCallRecord', () => {
    it('should apply VERIFIED-duration-wins', () => {
      const local = {
        id: 'call-1', durationSeconds: 100, verificationStatus: 'UNVERIFIED', updatedAt: '2024-01-02T00:00:00Z',
      };
      const remote = {
        id: 'call-1', durationSeconds: 120, verificationStatus: 'VERIFIED', updatedAt: '2024-01-01T00:00:00Z',
      };

      const resolved = SyncConflictResolver.resolveCallRecord(local, remote);

      expect(resolved.winner).toBe('REMOTE');
      expect(resolved.data).toEqual(remote);
    });

    it('should keep local if both UNVERIFIED and its server revision is newer', () => {
      const local = {
        id: 'call-1', serverRevision: 2, durationSeconds: 150, verificationStatus: 'UNVERIFIED', updatedAt: '2024-01-02T00:00:00Z',
      };
      const remote = {
        id: 'call-1', serverRevision: 1, durationSeconds: 120, verificationStatus: 'UNVERIFIED', updatedAt: '2024-01-01T00:00:00Z',
      };

      const resolved = SyncConflictResolver.resolveCallRecord(local, remote);

      expect(resolved.winner).toBe('LOCAL');
      expect(resolved.data).toEqual(local);
    });

    it('should apply versioned ordering before verified-duration precedence', () => {
      const local = {
        id: 'call-versioned', serverRevision: 3, durationSeconds: 15, verificationStatus: 'UNVERIFIED',
      };
      const remote = {
        id: 'call-versioned', serverRevision: 2, durationSeconds: 300, verification_status: 'VERIFIED',
      };

      const resolved = SyncConflictResolver.resolveCallRecord(local, remote);

      expect(resolved.winner).toBe('LOCAL');
      expect(resolved.data).toEqual(local);
    });

    it('should preserve call_records conflict identity when a newer versioned remote wins', () => {
      const local = {
        id: 'call-versioned-remote', serverRevision: 1, durationSeconds: 15, verificationStatus: 'UNVERIFIED',
      };
      const remote = {
        id: 'call-versioned-remote', serverRevision: 2, durationSeconds: 300, verification_status: 'VERIFIED',
      };

      const resolved = SyncConflictResolver.resolveCallRecord(local, remote);

      expect(resolved.winner).toBe('REMOTE');
      expect(resolved.conflict?.entityType).toBe('call_records');
    });

    it('should prefer VERIFIED even with lower duration', () => {
      const local = {
        id: 'call-1', durationSeconds: 200, verificationStatus: 'UNVERIFIED', updatedAt: '2024-01-02T00:00:00Z',
      };
      const remote = {
        id: 'call-1', durationSeconds: 100, verificationStatus: 'VERIFIED', updatedAt: '2024-01-01T00:00:00Z',
      };

      const resolved = SyncConflictResolver.resolveCallRecord(local, remote);

      expect(resolved.winner).toBe('REMOTE');
      expect(resolved.data).toEqual(remote);
    });

    it('should handle a non-verified failure status as unverified', () => {
      const local = {
        id: 'call-1', durationSeconds: 0, verificationStatus: 'FAILED', updatedAt: '2024-01-02T00:00:00Z',
      };
      const remote = {
        id: 'call-1', durationSeconds: 120, verificationStatus: 'VERIFIED', updatedAt: '2024-01-01T00:00:00Z',
      };

      const resolved = SyncConflictResolver.resolveCallRecord(local, remote);

      expect(resolved.winner).toBe('REMOTE');
      expect(resolved.data.verificationStatus).toBe('VERIFIED');
    });

    it('should honor snake_case verification fields when both calls are unverified', () => {
      const local = {
        id: 'call-snake-case', duration_seconds: 20, verification_status: 'UNVERIFIED', updated_at: '2024-01-01T00:00:00Z',
      };
      const remote = {
        id: 'call-snake-case', duration_seconds: 30, verification_status: 'UNVERIFIED', updated_at: '2024-01-02T00:00:00Z',
      };

      const resolved = SyncConflictResolver.resolveCallRecord(local, remote);

      expect(resolved.winner).toBe('REMOTE');
      expect(resolved.data).toEqual(remote);
      expect(resolved.conflict?.entityType).toBe('call_records');
    });

    it('should use canonical ordering when a local camelCase tombstone is present', () => {
      const local = {
        id: 'call-local-delete', deletedAt: '2024-01-03T00:00:00Z', verificationStatus: 'VERIFIED',
      };
      const remote = {
        id: 'call-local-delete', verification_status: 'UNVERIFIED',
      };

      const resolved = SyncConflictResolver.resolveCallRecord(local, remote);

      expect(resolved.winner).toBe('REMOTE');
      expect(resolved.conflict?.entityType).toBe('call_records');
    });

    it('should use canonical ordering when only a remote snake_case tombstone is present', () => {
      const local = {
        id: 'call-remote-delete', verificationStatus: 'VERIFIED',
      };
      const remote = {
        id: 'call-remote-delete', deleted_at: '2024-01-03T00:00:00Z', verification_status: 'UNVERIFIED',
      };

      const resolved = SyncConflictResolver.resolveCallRecord(local, remote);

      expect(resolved.winner).toBe('REMOTE');
      expect(resolved.conflict?.entityType).toBe('call_records');
    });

    it('should use timestamp LWW for call metadata when verification levels match', () => {
      const local = {
        id: 'call-1', direction: 'OUTBOUND', remark: 'Local note', verificationStatus: 'VERIFIED', updatedAt: '2024-01-01T00:00:00Z',
      };
      const remote = {
        id: 'call-1', direction: 'INBOUND', recordingUrl: 'remote-url', verificationStatus: 'VERIFIED', updatedAt: '2024-01-02T00:00:00Z',
      };

      const resolved = SyncConflictResolver.resolveCallRecord(local, remote);

      expect(resolved.winner).toBe('REMOTE');
      expect(resolved.data).toEqual(remote);
      expect(resolved.conflict?.entityType).toBe('call_records');
    });
  });

  describe('entity-specific routing', () => {
    it('should apply REMOTE-wins for lead fields when the server record is newer', () => {
      const local = { id: 'lead-1', businessName: 'Local', status: 'NEW', updatedAt: '2024-01-01T00:00:00Z' };
      const remote = { id: 'lead-1', businessName: 'Remote', status: 'CONTACTED', updatedAt: '2024-01-02T00:00:00Z' };

      const resolved = SyncConflictResolver.resolveMutable('leads', local, remote);

      expect(resolved.data).toEqual(remote);
    });

    it('should preserve assignedTo from the newer remote lead', () => {
      const local = { id: 'lead-1', assignedTo: 'agent-1', updatedAt: '2024-01-01T00:00:00Z' };
      const remote = { id: 'lead-1', assignedTo: 'agent-2', updatedAt: '2024-01-02T00:00:00Z' };

      const resolved = SyncConflictResolver.resolveMutable('leads', local, remote);

      expect(resolved.data.assignedTo).toBe('agent-2');
    });

    it('should retain a local append-only activity when its UUID already exists', () => {
      const local = { id: 'activity-1', activityType: 'CALL_COMPLETED', metadata: { source: 'device' } };
      const remote = { id: 'activity-1', activityType: 'CALL_COMPLETED', metadata: { source: 'server' } };

      const resolved = SyncConflictResolver.resolveAppendOnly(local, remote);

      expect(resolved.winner).toBe('LOCAL');
      expect(resolved.data).toEqual(local);
    });
  });

  describe('edge cases', () => {
    it('should accept null values from the newer server record', () => {
      const local = { id: 'lead-1', contactPerson: 'Local contact', updatedAt: '2024-01-01T00:00:00Z' };
      const remote = { id: 'lead-1', contactPerson: null, updatedAt: '2024-01-02T00:00:00Z' };

      const resolved = SyncConflictResolver.resolveMutable('leads', local, remote);

      expect(resolved.data.contactPerson).toBeNull();
    });

    it('should choose the remote record when no local record exists', () => {
      const remote = { id: 'lead-1', businessName: 'Remote', updatedAt: '2024-01-02T00:00:00Z' };

      const resolved = SyncConflictResolver.resolveMutable('leads', undefined, remote);

      expect(resolved.winner).toBe('REMOTE');
      expect(resolved.data).toEqual(remote);
    });

    it('should replace array fields atomically when the remote record is newer', () => {
      const local = { id: 'lead-1', tags: ['local'], updatedAt: '2024-01-01T00:00:00Z' };
      const remote = { id: 'lead-1', tags: ['remote'], updatedAt: '2024-01-02T00:00:00Z' };

      const resolved = SyncConflictResolver.resolveMutable('leads', local, remote);

      expect(resolved.data.tags).toEqual(['remote']);
    });
  });

  describe('mutation-strength regression coverage', () => {
    it('returns remote append-only records when absent locally and honors tombstones', () => {
      const remote = { id: 'activity-new', deletedAt: null };
      expect(SyncConflictResolver.resolveAppendOnly(undefined, remote)).toEqual({ winner: 'REMOTE', data: remote });

      const local = { id: 'activity-deleted', payload: 'local' };
      const camelTombstone = { id: 'activity-deleted', deletedAt: '2026-09-14T00:00:00Z' };
      const snakeTombstone = { id: 'activity-deleted', deleted_at: '2026-09-14T00:00:00Z' };
      expect(SyncConflictResolver.resolveAppendOnly(local, camelTombstone)).toEqual({ winner: 'REMOTE', data: camelTombstone });
      expect(SyncConflictResolver.resolveAppendOnly(local, snakeTombstone)).toEqual({ winner: 'REMOTE', data: snakeTombstone });
    });

    it('uses revision rules for every mutable tie state and records complete remote-win metadata', () => {
      const localOnlyRevision = { id: 'lead-r', serverRevision: 3, isSynced: 1 };
      expect(SyncConflictResolver.resolveMutable('leads', localOnlyRevision, { id: 'lead-r' }).winner).toBe('LOCAL');

      const pending = { id: 'lead-p', serverRevision: 4, isSynced: 0 };
      expect(SyncConflictResolver.resolveMutable('leads', pending, { id: 'lead-p', serverRevision: 4 }).winner).toBe('LOCAL');

      const synced = { id: 'lead-s', serverRevision: 4, isSynced: 1, value: 'local' };
      const remote = { id: 'lead-s', serverRevision: 4, value: 'remote' };
      const result = SyncConflictResolver.resolveMutable('leads', synced, remote);
      expect(result.winner).toBe('REMOTE');
      expect(result.data).toBe(remote);
      expect(result.conflict).toMatchObject({
        entityType: 'leads',
        entityId: 'lead-s',
        localData: synced,
        remoteData: remote,
        resolution: 'REMOTE_WON',
      });
      expect(result.conflict?.id).toMatch(/^conflict_leads_lead-s_\d+$/);
      expect(Number.isNaN(Date.parse(result.conflict?.resolvedAt ?? ''))).toBe(false);
    });

    it('covers call-record absence, versioned routing, deletion routing, and both verification directions', () => {
      const remoteOnly = { id: 'call-new', verificationStatus: 'UNVERIFIED' };
      expect(SyncConflictResolver.resolveCallRecord(undefined, remoteOnly)).toEqual({ winner: 'REMOTE', data: remoteOnly });

      const versionedLocal = { id: 'call-v', serverRevision: 5, verificationStatus: 'UNVERIFIED' };
      const versionedRemote = { id: 'call-v', serverRevision: 6, verificationStatus: 'UNVERIFIED' };
      expect(SyncConflictResolver.resolveCallRecord(versionedLocal, versionedRemote).data).toBe(versionedRemote);

      const deletedLocal = { id: 'call-d1', serverRevision: 7, deletedAt: '2026-09-14T00:00:00Z', verificationStatus: 'VERIFIED' };
      const liveRemote = { id: 'call-d1', serverRevision: 6, verificationStatus: 'UNVERIFIED' };
      expect(SyncConflictResolver.resolveCallRecord(deletedLocal, liveRemote).winner).toBe('LOCAL');

      const liveLocal = { id: 'call-d2', serverRevision: 6, verificationStatus: 'VERIFIED' };
      const deletedRemote = { id: 'call-d2', serverRevision: 7, deleted_at: '2026-09-14T00:00:00Z', verificationStatus: 'UNVERIFIED' };
      expect(SyncConflictResolver.resolveCallRecord(liveLocal, deletedRemote).winner).toBe('REMOTE');

      const verifiedLocal = { id: 'call-local', verificationStatus: 'VERIFIED', durationSeconds: 90 };
      const unverifiedRemote = { id: 'call-local', verification_status: 'UNVERIFIED', durationSeconds: 180 };
      expect(SyncConflictResolver.resolveCallRecord(verifiedLocal, unverifiedRemote)).toEqual({ winner: 'LOCAL', data: verifiedLocal });
    });

    it('records complete conflict metadata when remote verification wins', () => {
      const local = { id: 'call-meta', verification_status: 'FAILED', durationSeconds: 0 };
      const remote = { id: 'call-meta', verification_status: 'VERIFIED', durationSeconds: 42 };
      const result = SyncConflictResolver.resolveCallRecord(local, remote);
      expect(result.winner).toBe('REMOTE');
      expect(result.data).toBe(remote);
      expect(result.conflict).toMatchObject({
        entityType: 'call_records',
        entityId: 'call-meta',
        localData: local,
        remoteData: remote,
        resolution: 'REMOTE_WON',
      });
      expect(result.conflict?.id).toMatch(/^conflict_call_records_call-meta_\d+$/);
      expect(Number.isNaN(Date.parse(result.conflict?.resolvedAt ?? ''))).toBe(false);
    });
  });

});
