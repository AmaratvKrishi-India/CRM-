/** Real Dexie regression coverage for CallRecordRepository. */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CallRecordRepository } from '@/db/repositories/callRecordRepository';
import { LeadRepository } from '@/db/repositories/leadRepository';
import { SyncConflictResolver } from '@/services/sync/syncConflictResolver';
import type { SalesCRMDatabase } from '@/db/database';
import { agentScope, createVitestDatabase, disposeVitestDatabase } from '../../helpers/vitestDatabase';

describe('CallRecordRepository', () => {
  let database: SalesCRMDatabase;
  let leads: LeadRepository;
  let calls: CallRecordRepository;
  let leadId: string;

  beforeEach(async () => {
    database = createVitestDatabase('call_records');
    leads = new LeadRepository(database);
    calls = new CallRecordRepository(database);
    leadId = (await leads.createLead({
      businessName: 'Call Test Gym',
      phone: '9876543210',
      address: 'Alambagh, Lucknow 226005',
    })).id;
  });

  afterEach(async () => {
    await disposeVitestDatabase(database);
  });

  async function createCall(overrides: Partial<Parameters<CallRecordRepository['createCallRecord']>[0]> = {}) {
    return calls.createCallRecord({
      leadId,
      userId: agentScope.userId,
      startedAt: '2024-01-15T10:00:00.000Z',
      durationSeconds: 60,
      outcome: 'CONNECTED',
      ...overrides,
    });
  }

  it('should create a call record with a dial attempt ID', async () => {
    const record = await createCall({ dialAttemptId: 'dial-attempt-001' });

    expect(record).toMatchObject({ leadId, userId: agentScope.userId, dialAttemptId: 'dial-attempt-001', outcome: 'CONNECTED' });
    expect(await database.callRecords.get(record.id)).toMatchObject({ id: record.id, dialAttemptId: 'dial-attempt-001' });
  });

  it('should default verification status to UNVERIFIED', async () => {
    const record = await createCall();
    expect(record.verificationStatus).toBe('UNVERIFIED');
  });

  it('should persist an explicitly verified duration and status', async () => {
    const record = await createCall({ durationSeconds: 180, verificationStatus: 'VERIFIED' });
    expect(await database.callRecords.get(record.id)).toMatchObject({ durationSeconds: 180, verificationStatus: 'VERIFIED' });
  });

  it('should preserve verified call data when it is reloaded', async () => {
    const record = await createCall({ durationSeconds: 180, verificationStatus: 'VERIFIED' });
    const reloaded = await calls.getCallRecordById(record.id);

    expect(reloaded).toMatchObject({ id: record.id, durationSeconds: 180, verificationStatus: 'VERIFIED' });
  });

  it('should apply VERIFIED-duration-wins during synchronization', () => {
    const local = { id: 'call-1', durationSeconds: 240, verificationStatus: 'UNVERIFIED', updatedAt: '2024-01-02T00:00:00.000Z' };
    const remote = { id: 'call-1', durationSeconds: 120, verificationStatus: 'VERIFIED', updatedAt: '2024-01-01T00:00:00.000Z' };

    const result = SyncConflictResolver.resolveCallRecord(local, remote);

    expect(result).toMatchObject({ winner: 'REMOTE', data: remote });
  });

  it('should return calls for a lead ordered by most recent start time', async () => {
    await createCall({ startedAt: '2024-01-15T09:00:00.000Z' });
    await createCall({ startedAt: '2024-01-15T11:00:00.000Z' });

    const records = await calls.getCallsForLead(leadId);

    expect(records.map((record) => record.startedAt)).toEqual([
      '2024-01-15T11:00:00.000Z',
      '2024-01-15T09:00:00.000Z',
    ]);
  });

  it('should return calls made by the requested agent', async () => {
    await createCall();
    const records = await calls.getCallsForAgent(agentScope.userId);

    expect(records).toHaveLength(1);
    expect(records[0].userId).toBe(agentScope.userId);
  });

  it('should distinguish verified from unverified calls in agent counts', async () => {
    await createCall({ verificationStatus: 'VERIFIED' });
    await createCall({ startedAt: '2024-01-15T11:00:00.000Z' });

    await expect(calls.getCallCountForAgent(agentScope.userId)).resolves.toEqual({ total: 2, verified: 1, unverified: 1 });
  });

  it('should calculate verified duration statistics only from verified calls', async () => {
    await createCall({ durationSeconds: 120, verificationStatus: 'VERIFIED' });
    await createCall({ startedAt: '2024-01-15T11:00:00.000Z', durationSeconds: 60, verificationStatus: 'VERIFIED' });
    await createCall({ startedAt: '2024-01-15T12:00:00.000Z', durationSeconds: 900, verificationStatus: 'UNVERIFIED' });

    await expect(calls.getVerifiedTalkTimeForAgent(agentScope.userId)).resolves.toBe(180);
    await expect(calls.getAverageVerifiedCallDuration(agentScope.userId)).resolves.toBe(90);
  });
});
