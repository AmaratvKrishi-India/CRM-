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

    it('should use timestamp LWW for DELETE versus UPDATE conflicts', () => {
      const local = {
        id: 'lead-1',
        businessName: 'Deleted locally',
        deletedAt: '2024-01-03T00:00:00Z',
        updatedAt: '2024-01-03T00:00:00Z',
      };
      const remote = { id: 'lead-1', businessName: 'Remote update', updatedAt: '2024-01-02T00:00:00Z' };

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

    it('should prefer newer local updatedAt for conflicting fields', () => {
      const local = { id: 'lead-1', businessName: 'Local Gym', updatedAt: '2024-01-01T12:00:00Z' };
      const remote = { id: 'lead-1', businessName: 'Remote Gym', updatedAt: '2024-01-01T10:00:00Z' };

      const resolved = SyncConflictResolver.resolveMutable('leads', local, remote);

      expect(resolved.winner).toBe('LOCAL');
      expect(resolved.data).toEqual(local);
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

    it('should keep local if both UNVERIFIED and it is newer', () => {
      const local = {
        id: 'call-1', durationSeconds: 150, verificationStatus: 'UNVERIFIED', updatedAt: '2024-01-02T00:00:00Z',
      };
      const remote = {
        id: 'call-1', durationSeconds: 120, verificationStatus: 'UNVERIFIED', updatedAt: '2024-01-01T00:00:00Z',
      };

      const resolved = SyncConflictResolver.resolveCallRecord(local, remote);

      expect(resolved.winner).toBe('LOCAL');
      expect(resolved.data).toEqual(local);
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
});
