/**
 * Call Lifecycle & Duration Reconciliation Service (Phase 2J)
 * Manages native call state machine:
 * IDLE -> DIAL_INITIATED -> APP_BACKGROUND -> APP_FOREGROUND -> OUTCOME_PENDING -> COMPLETED / CANCELLED.
 * Enforces strict duration verification rules:
 * - Never fabricates call duration from app lifecycle elapsed time.
 * - Explicitly marks duration as UNVERIFIED under ACTION_DIAL.
 * - Prevents duplicate CallRecords and ghost calls across app restarts and multiple lifecycle triggers.
 */

import { crmData } from '../db';
import type { SalesCRMDatabase } from '../db/database';
import { CallRecordRepository } from '../db/repositories/callRecordRepository';
import { LeadRepository } from '../db/repositories/leadRepository';
import { ActivityRepository } from '../db/repositories/activityRepository';
import { SyncQueue } from './sync/syncQueue';
import { DeviceService } from './deviceService';
import { NativePlatformService } from './nativePlatform';
import { createUuid } from '../utils/id';
import type {
  User,
  Lead,
  CallOutcome,
  CallRecord,
  CallRecordStatus,
  CallVerificationStatus,
  Activity,
  LeadStatus,
} from '../db/types';

export type CallLifecycleState =
  | 'IDLE'
  | 'DIAL_INITIATED'
  | 'APP_BACKGROUND'
  | 'APP_FOREGROUND'
  | 'OUTCOME_PENDING'
  | 'COMPLETED'
  | 'CANCELLED';

export interface PendingDialAttempt {
  attemptId: string;
  leadId: string;
  leadName: string;
  leadPhone: string;
  userId: string;
  dialStartedAt: string;
  returnedAt: string | null;
  state: CallLifecycleState;
}

export interface CompleteCallInput {
  outcome: CallOutcome;
  quickRemark?: string | null;
  customNote?: string | null;
  updatedStatus?: LeadStatus;
  reportedDurationSeconds?: number | null;
  // Verification is only VERIFIED if provided by verified native telephony source
  verifiedDurationSeconds?: number | null;
}

const STORAGE_KEY = 'amaratv_pending_dial_attempt';

let customDb: SalesCRMDatabase | null = null;
let inMemoryAttempt: PendingDialAttempt | null = null;
let inMemoryScopeKey: string | null = null;

export class CallLifecycleService {
  /**
   * Sets custom database (used in test isolation).
   */
  static setCustomDatabase(db: SalesCRMDatabase | null): void {
    customDb = db;
  }

  private static getDb(): SalesCRMDatabase {
    return customDb || crmData.db;
  }

  private static getStorageKey(): string {
    const scope = this.getDb().requireAccessScope();
    return `${STORAGE_KEY}:${scope.organizationId}:${scope.userId}`;
  }

  private static assertActor(actor: User | null): asserts actor is User {
    if (!actor || actor.status !== 'ACTIVE') {
      throw new Error('Unauthorized: An active authenticated user session is required.');
    }
    const scope = this.getDb().requireAccessScope();
    if (actor.id !== scope.userId || actor.organizationId !== scope.organizationId || actor.role !== scope.role) {
      throw new Error('Unauthorized: User does not match the active data partition.');
    }
  }

  private static getCallRecordRepo(): CallRecordRepository {
    return customDb ? new CallRecordRepository(customDb) : crmData.callRecords;
  }

  private static getLeadRepo(): LeadRepository {
    return customDb ? new LeadRepository(customDb) : crmData.leads;
  }

  private static getActivityRepo(): ActivityRepository {
    return customDb ? new ActivityRepository(customDb) : crmData.activities;
  }

  private static getSyncQueue(): SyncQueue {
    return customDb ? new SyncQueue(customDb) : crmData.syncQueue;
  }


  /**
   * Loads current pending attempt from memory or storage.
   */
  static getPendingAttempt(): PendingDialAttempt | null {
    try {
      const storageKey = this.getStorageKey();
      if (inMemoryAttempt && inMemoryScopeKey === storageKey) return inMemoryAttempt;
      inMemoryAttempt = null;
      inMemoryScopeKey = storageKey;
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          inMemoryAttempt = JSON.parse(raw);
          return inMemoryAttempt;
        }
      }
    } catch {
      // Ignore storage read errors
    }
    return null;
  }

  private static savePendingAttempt(attempt: PendingDialAttempt | null): void {
    const storageKey = this.getStorageKey();
    inMemoryAttempt = attempt;
    inMemoryScopeKey = storageKey;
    try {
      if (typeof localStorage !== 'undefined') {
        if (attempt) {
          localStorage.setItem(storageKey, JSON.stringify(attempt));
        } else {
          localStorage.removeItem(storageKey);
        }
      }
    } catch {
      // Ignore storage write errors
    }
  }

  /**
   * 1. Initiates a phone dial attempt.
   * Creates a unique dialAttemptId, records initiation time, launches dialer,
   * and transitions state to DIAL_INITIATED.
   */
  static initiateDial(actor: User | null, lead: Lead): PendingDialAttempt {
    this.assertActor(actor);

    if (!lead.phone) {
      throw new Error('Cannot dial lead: No phone number present.');
    }

    const attemptId = createUuid();
    const now = new Date().toISOString();

    const attempt: PendingDialAttempt = {
      attemptId,
      leadId: lead.id,
      leadName: lead.businessName,
      leadPhone: lead.phone,
      userId: actor.id,
      dialStartedAt: now,
      returnedAt: null,
      state: 'DIAL_INITIATED',
    };

    this.savePendingAttempt(attempt);

    // Open native dialer (ACTION_DIAL)
    NativePlatformService.openDialer(lead.phone);

    return attempt;
  }

  /**
   * 2. App State Change Handler.
   * Handles app backgrounding when dialer opens, and foregrounding when user returns.
   * Returns the pending attempt if outcome resolution is required.
   */
  static handleAppStateChange(isActive: boolean): PendingDialAttempt | null {
    const attempt = this.getPendingAttempt();
    if (!attempt) return null;

    if (!isActive) {
      // App entered background (user went to phone app)
      if (attempt.state === 'DIAL_INITIATED') {
        attempt.state = 'APP_BACKGROUND';
        this.savePendingAttempt(attempt);
      }
      return null;
    }

    // App resumed to foreground
    if (attempt.state === 'DIAL_INITIATED' || attempt.state === 'APP_BACKGROUND') {
      const now = new Date().toISOString();
      attempt.returnedAt = now;
      attempt.state = 'OUTCOME_PENDING';
      this.savePendingAttempt(attempt);
      return attempt;
    }

    if (attempt.state === 'OUTCOME_PENDING') {
      return attempt;
    }

    return null;
  }

  /**
   * 3. Completes the call outcome workflow.
   * Creates exactly one CallRecord with idempotency, logs CallHistory,
   * enqueues sync mutation, and records append-only Activity.
   * Strictly preserves UNVERIFIED status under ACTION_DIAL.
   */
  static async completeCall(
    actor: User | null,
    input: CompleteCallInput
  ): Promise<{ callRecord: CallRecord; auditActivity: Activity }> {
    this.assertActor(actor);

    const attempt = this.getPendingAttempt();
    if (!attempt) {
      throw new Error('No active call attempt found to complete.');
    }

    const callRepo = this.getCallRecordRepo();
    const leadRepo = this.getLeadRepo();
    const activityRepo = this.getActivityRepo();

    const now = new Date().toISOString();
    const isConnected = input.outcome === 'CONNECTED';
    const callStatus: CallRecordStatus = isConnected ? 'CONNECTED' : 'NOT_CONNECTED';

    // Strict Verification Logic:
    // If verifiedDurationSeconds is genuinely provided by a verified native telecom source, use VERIFIED.
    // Otherwise, duration is 0 and status is strictly UNVERIFIED.
    const isVerified = typeof input.verifiedDurationSeconds === 'number' && input.verifiedDurationSeconds >= 0;
    const durationSeconds = isVerified ? Math.round(input.verifiedDurationSeconds!) : 0;
    const verificationStatus: CallVerificationStatus = isVerified ? 'VERIFIED' : 'UNVERIFIED';

    const reportedDurationSeconds =
      typeof input.reportedDurationSeconds === 'number'
        ? Math.max(0, Math.round(input.reportedDurationSeconds))
        : null;

    const deviceId = DeviceService.getDeviceId();
    const remarkContent = [input.quickRemark, input.customNote].filter(Boolean).join(' — ') || null;

    // Create CallRecord with dialAttemptId idempotency
    const callRecord = await callRepo.createCallRecord({
      id: attempt.attemptId,
      leadId: attempt.leadId,
      userId: actor.id, // Strictly derived from authenticated session
      deviceId,
      dialAttemptId: attempt.attemptId,
      startedAt: attempt.dialStartedAt,
      answeredAt: isConnected ? attempt.dialStartedAt : null,
      endedAt: attempt.returnedAt || now,
      durationSeconds,
      reportedDurationSeconds,
      outcome: input.outcome,
      callStatus,
      remark: remarkContent,
      verificationStatus,
    });

    // Update Lead stats: increment call count and last contacted time
    const lead = await leadRepo.getLeadById(attempt.leadId);
    if (lead) {
      const updatedCallCount = (lead.callCount || 0) + 1;
      const newStatus = input.updatedStatus || lead.status;
      await leadRepo.updateLead(attempt.leadId, {
        callCount: updatedCallCount,
        lastContactedAt: now,
        status: newStatus,
        updatedBy: actor.id,
      });
    }

    // Append immutable Activity event
    const auditActivity = await activityRepo.logActivity({
      leadId: attempt.leadId,
      userId: actor.id,
      deviceId,
      activityType: 'CALL_COMPLETED',
      metadata: {
        callRecordId: callRecord.id,
        attemptId: attempt.attemptId,
        outcome: input.outcome,
        callStatus,
        durationSeconds,
        reportedDurationSeconds,
        verificationStatus,
        remark: remarkContent,
        repId: actor.id,
        repName: actor.name,
        completedAt: now,
      },
    });

    // Reset lifecycle to IDLE and purge attempt from storage
    this.savePendingAttempt(null);

    return { callRecord, auditActivity };
  }

  /**
   * 4. Cancels or dismisses the active call attempt without saving a ghost record.
   */
  static cancelCall(): void {
    this.savePendingAttempt(null);
  }

  /**
   * Resets internal state for test isolation.
   */
  static resetForTesting(): void {
    inMemoryAttempt = null;
    inMemoryScopeKey = null;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(this.getStorageKey());
      }
    } catch {
      // Ignore
    }
  }
}
