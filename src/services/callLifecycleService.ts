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
import { NativeDialerProvider } from './calling/nativeDialerProvider';
import { normalizeIndiaMobile } from './calling/callProvider';
import type { CallProviderEvent } from './calling/callProvider';
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
  provider?: 'windows-mock';
  providerObservation?: Pick<CallProviderEvent, 'state' | 'observedAt' | 'sequence' | 'provenance'>;
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
    void new NativeDialerProvider().requestDial({ attemptId, actor, lead, manualConsent: true });

    return attempt;
  }

  /** Prepare a manual mock attempt; no dialer or background queue is invoked. */
  static async beginWindowsMock(actor: User | null, leadId: string): Promise<PendingDialAttempt> {
    this.assertActor(actor);
    const db = this.getDb();
    const lead = await db.requireAccessibleLead(leadId);
    this.assertActor(actor); // Account may change during the read.
    if (db !== this.getDb()) throw new Error('Session changed. Retry manually.');
    if (lead.deletedAt || lead.status === 'DO_NOT_CONTACT') throw new Error('This lead must not be contacted.');
    normalizeIndiaMobile(lead.phone);
    if (this.getPendingAttempt()) throw new Error('Finish or dismiss the pending call first.');
    const attempt: PendingDialAttempt = {
      attemptId: createUuid(), leadId: lead.id, leadName: lead.businessName, leadPhone: lead.phone,
      userId: actor.id, dialStartedAt: new Date().toISOString(), returnedAt: null,
      state: 'DIAL_INITIATED', provider: 'windows-mock',
    };
    this.savePendingAttempt(attempt);
    return attempt;
  }

  static recoverWindowsMock(): PendingDialAttempt | null {
    const attempt = this.getPendingAttempt();
    if (attempt?.provider !== 'windows-mock') return null;
    attempt.state = 'OUTCOME_PENDING';
    attempt.returnedAt ||= new Date().toISOString();
    this.savePendingAttempt(attempt);
    return attempt; // Interrupted attempt only; never reconnect or redial after refresh.
  }

  static observeWindowsMock(event: CallProviderEvent): PendingDialAttempt | null {
    const attempt = this.getPendingAttempt();
    if (!attempt || attempt.provider !== 'windows-mock' || event.provenance !== 'mock' ||
        event.carrierVerified !== false || event.attemptId !== attempt.attemptId ||
        event.sequence <= (attempt.providerObservation?.sequence ?? 0)) return null;
    attempt.providerObservation = { state: event.state, observedAt: event.observedAt, sequence: event.sequence, provenance: 'mock' };
    if (event.state === 'ended' || event.state === 'error') {
      attempt.state = 'OUTCOME_PENDING';
      attempt.returnedAt = new Date().toISOString();
    }
    this.savePendingAttempt(attempt);
    return attempt;
  }

  private static async completeWindowsMock(actor: User, input: CompleteCallInput, attempt: PendingDialAttempt): Promise<{ callRecord: CallRecord; auditActivity: Activity }> {
    const db = this.getDb();
    if (attempt.state !== 'OUTCOME_PENDING') throw new Error('End the mock attempt before saving an outcome.');
    const result = await db.transaction('rw', [db.callRecords, db.leads, db.activities, db.outbox], async () => {
      this.assertActor(actor);
      const callRepo = new CallRecordRepository(db);
      const leadRepo = new LeadRepository(db);
      const activityRepo = new ActivityRepository(db);
      const existing = await callRepo.getCallRecordById(attempt.attemptId);
      const auditId = attempt.attemptId; // Separate table, same UUID: deterministic and server-compatible.
      if (existing) {
        const auditActivity = await db.activities.get(auditId);
        if (!auditActivity) throw new Error('Incomplete mock call audit.');
        return { callRecord: existing, auditActivity };
      }
      const remark = [input.quickRemark, input.customNote].filter(Boolean).join(' — ') || null;
      const callRecord = await callRepo.createCallRecord({
        id: attempt.attemptId, dialAttemptId: attempt.attemptId, leadId: attempt.leadId, userId: actor.id,
        deviceId: DeviceService.getDeviceId(), startedAt: attempt.dialStartedAt, endedAt: attempt.returnedAt,
        answeredAt: null, durationSeconds: 0, reportedDurationSeconds: null,
        verificationStatus: 'UNVERIFIED', callStatus: 'DIAL_ATTEMPT', outcome: input.outcome,
        remark: `[MOCK — no carrier call]${remark ? ' ' + remark : ''}`,
      });
      const lead = await db.requireAccessibleLead(attempt.leadId);
      await leadRepo.updateLead(lead.id, { callCount: (lead.callCount || 0) + 1, updatedBy: actor.id });
      // Mock outcomes never change real contact/status statistics or claim an answered call.
      const auditActivity = await activityRepo.logActivity({
        id: auditId, leadId: lead.id, userId: actor.id, deviceId: DeviceService.getDeviceId(), activityType: 'CALL_COMPLETED',
        metadata: { callRecordId: callRecord.id, attemptId: attempt.attemptId, provenance: 'mock',
          carrierVerified: false, durationSeconds: 0, verificationStatus: 'UNVERIFIED',
          outcome: input.outcome, observation: attempt.providerObservation || null },
      });
      return { callRecord, auditActivity };
    });
    if (this.getPendingAttempt()?.attemptId === attempt.attemptId) this.savePendingAttempt(null);
    return result;
  }

  /**
   * 2. App State Change Handler.
   * Handles app backgrounding when dialer opens, and foregrounding when user returns.
   * Returns the pending attempt if outcome resolution is required.
   */
  static handleAppStateChange(isActive: boolean): PendingDialAttempt | null {
    const attempt = this.getPendingAttempt();
    if (!attempt || attempt.provider === 'windows-mock') return null;

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

    if (attempt.provider === 'windows-mock') return this.completeWindowsMock(actor, input, attempt);

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
