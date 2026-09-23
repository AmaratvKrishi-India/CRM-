/**
 * Call Record Repository (Phase 2B & 2J)
 * Provides local foundation for detailed call logging, verified vs unverified duration tracking,
 * and Admin analytics aggregation methods.
 */

import type { SalesCRMDatabase } from '../database';
import { SyncQueue } from '../../services/sync/syncQueue';
import type { CallOutcome, CallRecord, CallRecordStatus, CallVerificationStatus } from '../types';

import { createUuid } from '../../utils/id';

export interface AgentCallMetrics {
  total: number;
  verified: number;
  unverified: number;
  verifiedTalkTimeSeconds: number;
  averageVerifiedDurationSeconds: number;
}

export interface OrganisationCallSummary {
  totalCalls: number;
  verifiedCalls: number;
  unverifiedCalls: number;
  totalVerifiedTalkTimeSeconds: number;
  averageVerifiedDurationSeconds: number;
  agentMetrics: Record<string, AgentCallMetrics>;
}

export class CallRecordRepository {
  constructor(private db: SalesCRMDatabase, private syncQueue?: SyncQueue) {}

  private getSyncQueue(): SyncQueue {
    return (this.syncQueue ??= new SyncQueue(this.db));
  }

  /**
   * Logs a CallRecord entry.
   */
  async createCallRecord(input: {
    id?: string;
    leadId: string;
    userId: string;
    deviceId?: string | null;
    dialAttemptId?: string | null;
    startedAt: string;
    answeredAt?: string | null;
    endedAt?: string | null;
    durationSeconds?: number;
    reportedDurationSeconds?: number | null;
    outcome: CallOutcome;
    callStatus?: CallRecordStatus;
    remark?: string | null;
    verificationStatus?: CallVerificationStatus;
  }): Promise<CallRecord> {
    const scope = this.db.requireAccessScope();
    await this.db.requireAccessibleLead(input.leadId, scope);
    if (input.userId !== scope.userId) {
      throw new Error('Call records must be attributed to the signed-in user.');
    }
    const now = new Date().toISOString();
    const record: CallRecord = {
      id: input.id || createUuid(),
      leadId: input.leadId,
      userId: input.userId,
      deviceId: input.deviceId || null,
      dialAttemptId: input.dialAttemptId || null,
      startedAt: input.startedAt,
      answeredAt: input.answeredAt || null,
      endedAt: input.endedAt || null,
      durationSeconds: Math.max(0, input.durationSeconds || 0),
      reportedDurationSeconds:
        typeof input.reportedDurationSeconds === 'number' ? input.reportedDurationSeconds : null,
      outcome: input.outcome,
      callStatus: input.callStatus,
      remark: input.remark || null,
      verificationStatus: input.verificationStatus || 'UNVERIFIED',
      createdAt: now,
      updatedAt: now,
      isSynced: 0,
      deletedAt: null,
    };

    // Data write + outbox enqueue are atomic: either both persist or neither.
    await this.db.transaction('rw', [this.db.callRecords, this.db.outbox], async () => {
      await this.db.callRecords.add(record);
      await this.getSyncQueue().enqueue({
        entityType: 'call_records',
        entityId: record.id,
        operation: 'CREATE',
        payload: record,
        userId: scope.userId,
        organizationId: scope.organizationId,
      });
    });

    return record;
  }

  /**
   * Retrieves call records for a specific lead.
   */
  async getCallsForLead(leadId: string): Promise<CallRecord[]> {
    await this.db.requireAccessibleLead(leadId);
    return await this.db.callRecords
      .where('leadId')
      .equals(leadId)
      .and((c) => c.deletedAt === null)
      .reverse()
      .sortBy('startedAt');
  }

  /**
   * Alias for getCallsForLead.
   */
  async getCallRecordsForLead(leadId: string): Promise<CallRecord[]> {
    return this.getCallsForLead(leadId);
  }

  /**
   * Retrieves call records logged by a specific agent/user.
   */
  async getCallsForAgent(agentId: string, limit = 1000): Promise<CallRecord[]> {
    const scope = this.db.requireAccessScope();
    if (scope.role === 'AGENT' && agentId !== scope.userId) {
      return [];
    }
    const records = await this.db.callRecords
      .where('userId')
      .equals(agentId)
      .and((c) => c.deletedAt === null)
      .reverse()
      .sortBy('startedAt');

    return records.slice(0, limit);
  }

  /**
   * Alias for getCallsForAgent.
   */
  async getCallRecordsByUser(userId: string, limit = 100): Promise<CallRecord[]> {
    return this.getCallsForAgent(userId, limit);
  }

  /**
   * Retrieves a single call record by ID.
   */
  async getCallRecordById(id: string): Promise<CallRecord | undefined> {
    this.db.requireAccessScope();
    const record = await this.db.callRecords.get(id);
    if (!record) return undefined;
    try {
      await this.db.requireAccessibleLead(record.leadId);
      return record.deletedAt === null ? record : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Computes total verified talk time (in seconds) for a specific agent.
   * UNVERIFIED calls contribute 0 seconds to talk time.
   */
  async getVerifiedTalkTimeForAgent(agentId: string): Promise<number> {
    const calls = await this.getCallsForAgent(agentId);
    return calls.reduce((acc, c) => {
      if (c.verificationStatus === 'VERIFIED') {
        return acc + (c.durationSeconds || 0);
      }
      return acc;
    }, 0);
  }

  /**
   * Computes total, verified, and unverified call counts for a specific agent.
   */
  async getCallCountForAgent(agentId: string): Promise<{ total: number; verified: number; unverified: number }> {
    const calls = await this.getCallsForAgent(agentId);
    let verified = 0;
    let unverified = 0;

    for (const c of calls) {
      if (c.verificationStatus === 'VERIFIED') {
        verified++;
      } else {
        unverified++;
      }
    }

    return {
      total: calls.length,
      verified,
      unverified,
    };
  }

  /**
   * Computes average duration (in seconds) among VERIFIED calls only.
   */
  async getAverageVerifiedCallDuration(agentId: string): Promise<number> {
    const calls = await this.getCallsForAgent(agentId);
    const verifiedCalls = calls.filter((c) => c.verificationStatus === 'VERIFIED');
    if (verifiedCalls.length === 0) return 0;

    const totalSeconds = verifiedCalls.reduce((acc, c) => acc + (c.durationSeconds || 0), 0);
    return Math.round(totalSeconds / verifiedCalls.length);
  }

  /**
   * Computes organization-wide call analytics summary.
   * Only verified durations contribute to total talk time.
   */
  async getOrganisationCallSummary(): Promise<OrganisationCallSummary> {
    const scope = this.db.requireAccessScope();
    const accessibleLeadIds = new Set(
      (await this.db.leads.toArray())
        .filter((lead) => scope.role === 'ADMIN' || lead.assignedTo === scope.userId || lead.createdBy === scope.userId)
        .map((lead) => lead.id)
    );
    const allCalls = await this.db.callRecords
      .filter((c) => c.deletedAt === null && accessibleLeadIds.has(c.leadId))
      .toArray();

    let totalCalls = allCalls.length;
    let verifiedCalls = 0;
    let unverifiedCalls = 0;
    let totalVerifiedTalkTimeSeconds = 0;
    const agentMap: Record<string, { total: number; verified: number; unverified: number; verifiedTalkTime: number }> = {};

    for (const c of allCalls) {
      const uId = c.userId || 'unknown';
      if (!agentMap[uId]) {
        agentMap[uId] = { total: 0, verified: 0, unverified: 0, verifiedTalkTime: 0 };
      }
      agentMap[uId].total++;

      if (c.verificationStatus === 'VERIFIED') {
        verifiedCalls++;
        const dur = c.durationSeconds || 0;
        totalVerifiedTalkTimeSeconds += dur;
        agentMap[uId].verified++;
        agentMap[uId].verifiedTalkTime += dur;
      } else {
        unverifiedCalls++;
        agentMap[uId].unverified++;
      }
    }

    const agentMetrics: Record<string, AgentCallMetrics> = {};
    for (const [agentId, stat] of Object.entries(agentMap)) {
      agentMetrics[agentId] = {
        total: stat.total,
        verified: stat.verified,
        unverified: stat.unverified,
        verifiedTalkTimeSeconds: stat.verifiedTalkTime,
        averageVerifiedDurationSeconds: stat.verified > 0 ? Math.round(stat.verifiedTalkTime / stat.verified) : 0,
      };
    }

    const averageVerifiedDurationSeconds =
      verifiedCalls > 0 ? Math.round(totalVerifiedTalkTimeSeconds / verifiedCalls) : 0;

    return {
      totalCalls,
      verifiedCalls,
      unverifiedCalls,
      totalVerifiedTalkTimeSeconds,
      averageVerifiedDurationSeconds,
      agentMetrics,
    };
  }
}
