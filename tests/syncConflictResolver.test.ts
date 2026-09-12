import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SyncConflictResolver } from '../src/services/sync/syncConflictResolver.ts';

describe('Sync Conflict Resolver & Verified-Duration Protection (Stage 7)', () => {
  it('1. Mutable Entity (Lead): Remote newer wins LWW', () => {
    const localLead = {
      id: 'lead-101',
      businessName: 'Fit Plus Gym (Old)',
      status: 'NEW',
      updatedAt: '2026-08-20T10:00:00.000Z',
    };
    const remoteLead = {
      id: 'lead-101',
      businessName: 'Fit Plus Gym (Remote Update)',
      status: 'INTERESTED',
      updated_at: '2026-08-20T10:05:00.000Z',
    };

    const result = SyncConflictResolver.resolveMutable('leads', localLead, remoteLead);
    assert.strictEqual(result.winner, 'REMOTE');
    assert.strictEqual(result.data.businessName, 'Fit Plus Gym (Remote Update)');
    assert.ok(result.conflict !== undefined);
    assert.strictEqual(result.conflict?.resolution, 'REMOTE_WON');
  });

  it('2. Mutable Entity (Lead): higher observed server revision rejects an older event', () => {
    const localLead = {
      id: 'lead-101',
      businessName: 'Fit Plus Gym (Local Fresh)',
      serverRevision: 2,
      status: 'WON',
      updatedAt: '2026-08-20T10:15:00.000Z',
    };
    const remoteLead = {
      id: 'lead-101',
      businessName: 'Fit Plus Gym (Old Remote)',
      serverRevision: 1,
      status: 'INTERESTED',
      updated_at: '2026-08-20T10:05:00.000Z',
    };

    const result = SyncConflictResolver.resolveMutable('leads', localLead, remoteLead);
    assert.strictEqual(result.winner, 'LOCAL');
    assert.strictEqual(result.data.businessName, 'Fit Plus Gym (Local Fresh)');
  });

  it('3. Call Record: Remote VERIFIED duration strictly overrides Local UNVERIFIED duration', () => {
    const localCall = {
      id: 'call-777',
      durationSeconds: 0,
      verificationStatus: 'UNVERIFIED',
      updatedAt: '2026-08-20T10:00:00.000Z',
    };
    const remoteCall = {
      id: 'call-777',
      duration_seconds: 185,
      verification_status: 'VERIFIED',
      updated_at: '2026-08-20T10:01:00.000Z',
    };

    const result = SyncConflictResolver.resolveCallRecord(localCall, remoteCall);
    assert.strictEqual(result.winner, 'REMOTE');
    assert.strictEqual(result.data.duration_seconds, 185);
    assert.strictEqual(result.data.verification_status, 'VERIFIED');
  });

  it('4. Call Record: Local VERIFIED duration MUST NEVER be overwritten by Remote UNVERIFIED even with newer timestamp', () => {
    const localCall = {
      id: 'call-888',
      durationSeconds: 320,
      verificationStatus: 'VERIFIED',
      updatedAt: '2026-08-20T10:00:00.000Z',
    };
    // Remote payload is UNVERIFIED with newer timestamp (e.g. from web UI or fallback dialer)
    const remoteCall = {
      id: 'call-888',
      duration_seconds: 15,
      verification_status: 'UNVERIFIED',
      updated_at: '2026-08-20T10:30:00.000Z',
    };

    const result = SyncConflictResolver.resolveCallRecord(localCall, remoteCall);
    assert.strictEqual(result.winner, 'LOCAL', 'Verified duration protection must prioritize verified local record');
    assert.strictEqual(result.data.durationSeconds, 320);
    assert.strictEqual(result.data.verificationStatus, 'VERIFIED');
  });

  it('5. Call Record: When both are VERIFIED, newest timestamp wins LWW', () => {
    const localCall = {
      id: 'call-999',
      durationSeconds: 120,
      verificationStatus: 'VERIFIED',
      updatedAt: '2026-08-20T10:00:00.000Z',
    };
    const remoteCall = {
      id: 'call-999',
      duration_seconds: 125,
      verification_status: 'VERIFIED',
      updated_at: '2026-08-20T10:05:00.000Z',
    };

    const result = SyncConflictResolver.resolveCallRecord(localCall, remoteCall);
    assert.strictEqual(result.winner, 'REMOTE');
    assert.strictEqual(result.data.duration_seconds, 125);
  });

  it('6. Append-Only Entities: Idempotency preserves local identity on UUID match', () => {
    const localActivity = {
      id: 'act-111',
      activityType: 'CALL_LOGGED',
      deviceId: 'device-android-01',
    };
    const remoteActivity = {
      id: 'act-111',
      activityType: 'CALL_LOGGED',
      deviceId: 'device-android-01',
    };

    const result = SyncConflictResolver.resolveAppendOnly(localActivity, remoteActivity);
    assert.strictEqual(result.winner, 'LOCAL');
    assert.strictEqual(result.data.id, 'act-111');
  });

  it('7. Follow-Up & Remark LWW: Correctly merges updates across agents', () => {
    const localFollowUp = {
      id: 'fu-555',
      status: 'PENDING',
      scheduledAt: '2026-08-25T10:00:00.000Z',
      updatedAt: '2026-08-20T08:00:00.000Z',
    };
    const remoteFollowUp = {
      id: 'fu-555',
      status: 'COMPLETED',
      completed_at: '2026-08-20T12:00:00.000Z',
      updated_at: '2026-08-20T12:00:00.000Z',
    };

    const result = SyncConflictResolver.resolveMutable('follow_ups', localFollowUp, remoteFollowUp);
    assert.strictEqual(result.winner, 'REMOTE');
    assert.strictEqual(result.data.status, 'COMPLETED');
  });
});
