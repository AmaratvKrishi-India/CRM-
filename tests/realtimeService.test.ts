import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { SalesCRMDatabase } from '../src/db/database';
import { createCRMDataLayer } from '../src/db';
import { RealtimeService } from '../src/services/realtime/realtimeService';
import { User, Lead, CallRecord, Activity, FollowUp } from '../src/db/types';

describe('Phase 2K: Realtime Service & Non-Destructive Ingest', () => {
  let db: SalesCRMDatabase;
  let crm: ReturnType<typeof createCRMDataLayer>;
  let admin: User;
  let agentA: User;
  let agentB: User;
  let lead: Lead;

  // Mock Supabase client
  let mockChannel: any;
  let mockClient: any;
  let postgresChangeCallbacks: Record<string, (payload: any) => void> = {};
  let subscribeStatusCallback: ((status: string, err?: any) => void) | null = null;

  beforeEach(async () => {
    const testDbName = `test_realtime_${Math.random().toString(36).substring(7)}`;
    db = new SalesCRMDatabase(testDbName);
    crm = createCRMDataLayer(db);
    RealtimeService.setCustomDatabase(db);
    RealtimeService.resetListeners();
    await db.seedDefaults();

    postgresChangeCallbacks = {};
    subscribeStatusCallback = null;

    mockChannel = {
      on: vi.fn((type: string, filter: any, callback: any) => {
        if (filter && filter.table) {
          postgresChangeCallbacks[filter.table] = callback;
        }
        return mockChannel;
      }),
      subscribe: vi.fn((callback: any) => {
        subscribeStatusCallback = callback;
        if (callback) callback('SUBSCRIBED');
      }),
    };

    mockClient = {
      channel: vi.fn(() => mockChannel),
      removeChannel: vi.fn(async () => {}),
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            gt: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
    };

    RealtimeService.setCustomClient(mockClient);

    admin = await crm.users.createUser({
      id: 'admin-rt-1',
      name: 'Admin Vikram',
      email: 'admin@amaratvkrishi.com',
      phone: '9988776655',
      role: 'ADMIN',
      status: 'ACTIVE',
      organizationId: 'org-amaratv-1',
    });

    agentA = await crm.users.createUser({
      id: 'agent-rt-a',
      name: 'Agent Rahul',
      email: 'rahul@amaratvkrishi.com',
      phone: '9123456781',
      role: 'AGENT',
      status: 'ACTIVE',
      organizationId: 'org-amaratv-1',
      createdBy: admin.id,
    });

    agentB = await crm.users.createUser({
      id: 'agent-rt-b',
      name: 'Agent Amit',
      email: 'amit@amaratvkrishi.com',
      phone: '9123456782',
      role: 'AGENT',
      status: 'ACTIVE',
      organizationId: 'org-amaratv-1',
      createdBy: admin.id,
    });

    lead = await crm.leads.createLead({
      businessName: 'Gold Gym Mahanagar',
      phone: '9876543210',
      address: 'Mahanagar, Lucknow',
      assignedTo: agentA.id,
    });
  });

  afterEach(async () => {
    await RealtimeService.unsubscribe();
    RealtimeService.resetListeners();
    RealtimeService.setCustomDatabase(null);
    RealtimeService.setCustomClient(null);
    await db.delete();
    vi.restoreAllMocks();
  });

  describe('1. Subscription Lifecycle & Authentication Guard', () => {
    it('initializes and subscribes with organization isolation when authenticated active user logs in', async () => {
      let currentStatus = '';
      RealtimeService.onStatusChange((status) => {
        currentStatus = status;
      });

      const success = await RealtimeService.init(admin);
      expect(success).toBe(true);
      expect(currentStatus).toBe('SUBSCRIBED');
      expect(mockClient.channel).toHaveBeenCalledWith(
        expect.stringContaining('org_org-amaratv-1_admin')
      );
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({ filter: 'organization_id=eq.org-amaratv-1' }),
        expect.any(Function)
      );
    });

    it('rejects unauthenticated and inactive user sessions', async () => {
      const inactiveUser: User = { ...agentA, status: 'INACTIVE' };

      const unauthSuccess = await RealtimeService.init(null);
      expect(unauthSuccess).toBe(false);
      expect(RealtimeService.getStatus()).toBe('DISCONNECTED');

      const inactiveSuccess = await RealtimeService.init(inactiveUser);
      expect(inactiveSuccess).toBe(false);
      expect(RealtimeService.getStatus()).toBe('DISCONNECTED');
    });

    it('unsubscribes and cleans up channel upon logout', async () => {
      await RealtimeService.init(agentA);
      expect(RealtimeService.getStatus()).toBe('SUBSCRIBED');

      await RealtimeService.unsubscribe();
      expect(RealtimeService.getStatus()).toBe('DISCONNECTED');
      expect(RealtimeService.getCurrentUser()).toBeNull();
      expect(mockClient.removeChannel).toHaveBeenCalled();
    });
  });

  describe('2. Realtime Event Ingestion & Dexie Reconciliation', () => {
    it('reconciles incoming lead creation into local Dexie', async () => {
      await RealtimeService.init(admin);

      const remoteLeadRow = {
        id: 'lead-rt-new-1',
        organization_id: 'org-amaratv-1',
        business_name: 'Iron Pulse Fitness',
        contact_name: 'Rohit Singh',
        phone: '9888877777',
        address: 'Aliganj, Lucknow',
        locality: 'Aliganj',
        status: 'NEW',
        assigned_to: agentA.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: 1,
      };

      await RealtimeService.handleIncomingPostgresChange('leads', 'INSERT', remoteLeadRow);

      const savedLead = await db.leads.get('lead-rt-new-1');
      expect(savedLead).toBeDefined();
      expect(savedLead?.businessName).toBe('Iron Pulse Fitness');
      expect(savedLead?.assignedTo).toBe(agentA.id);
    });

    it('reconciles incoming activity and dispatches to live activity listeners', async () => {
      await RealtimeService.init(admin);

      let receivedActivity: Activity | null = null;
      RealtimeService.onActivity((act) => {
        receivedActivity = act;
      });

      const remoteActivityRow = {
        id: 'act-rt-1',
        organization_id: 'org-amaratv-1',
        lead_id: lead.id,
        user_id: agentA.id,
        activity_type: 'CALL_COMPLETED',
        metadata: {
          leadId: lead.id,
          leadName: 'Gold Gym Mahanagar',
          repName: 'Agent Rahul',
          outcome: 'CONNECTED',
          durationSeconds: 195,
          verificationStatus: 'VERIFIED',
        },
        created_at: new Date().toISOString(),
      };

      await RealtimeService.handleIncomingPostgresChange('activities', 'INSERT', remoteActivityRow);

      const savedActivity = await db.activities.get('act-rt-1');
      expect(savedActivity).toBeDefined();
      expect(receivedActivity).toBeDefined();
      expect((receivedActivity as any)?.activityType).toBe('CALL_COMPLETED');
      expect(((receivedActivity as any)?.metadata as any).verificationStatus).toBe('VERIFIED');
    });

    it('triggers in-app notification when lead is assigned to current agent', async () => {
      await RealtimeService.init(agentA);

      let receivedNotification: any = null;
      RealtimeService.onNotification((notif) => {
        receivedNotification = notif;
      });

      const remoteAssignmentRow = {
        id: 'act-assign-1',
        organization_id: 'org-amaratv-1',
        lead_id: lead.id,
        user_id: admin.id,
        activity_type: 'LEAD_ASSIGNED',
        metadata: {
          leadId: lead.id,
          leadName: 'Gold Gym Mahanagar',
          newAssigneeId: agentA.id,
          newAssigneeName: 'Agent Rahul',
          assignedByAdminName: 'Admin Vikram',
        },
        created_at: new Date().toISOString(),
      };

      await RealtimeService.handleIncomingPostgresChange('activities', 'INSERT', remoteAssignmentRow);

      expect(receivedNotification).toBeDefined();
      expect(receivedNotification.type).toBe('ASSIGNMENT');
      expect(receivedNotification.title).toBe('New Lead Assigned');
      expect(receivedNotification.message).toContain('Admin assigned "Gold Gym Mahanagar" to you.');
    });

    it('guarantees VERIFIED call duration is not overwritten by UNVERIFIED realtime payload', async () => {
      await RealtimeService.init(admin);

      // Pre-existing verified call record locally
      const localVerified: CallRecord = {
        id: 'call-conflict-rt',
        leadId: lead.id,
        userId: agentA.id,
        deviceId: 'dev-1',
        startedAt: '2026-08-20T10:00:00.000Z',
        answeredAt: null,
        endedAt: '2026-08-20T10:04:00.000Z',
        durationSeconds: 240,
        outcome: 'CONNECTED',
        remark: null,
        verificationStatus: 'VERIFIED',
        createdAt: '2026-08-20T10:04:00.000Z',
        updatedAt: '2026-08-20T10:04:00.000Z',
        isSynced: 1,
        deletedAt: null,
      };
      await db.callRecords.put(localVerified);

      // Incoming unverified payload
      const unverifiedRemoteRow = {
        id: 'call-conflict-rt',
        organization_id: 'org-amaratv-1',
        lead_id: lead.id,
        user_id: agentA.id,
        started_at: '2026-08-20T10:00:00.000Z',
        duration_seconds: 0,
        outcome: 'CONNECTED',
        verification_status: 'UNVERIFIED',
        updated_at: '2026-08-20T10:05:00.000Z', // Even if newer timestamp
      };

      await RealtimeService.handleIncomingPostgresChange('call_records', 'UPDATE', unverifiedRemoteRow);

      const recordInDb = await db.callRecords.get('call-conflict-rt');
      expect(recordInDb?.verificationStatus).toBe('VERIFIED');
      expect(recordInDb?.durationSeconds).toBe(240);
    });

    it('ignores duplicate realtime events idempotently', async () => {
      await RealtimeService.init(admin);

      const remoteActivityRow = {
        id: 'act-dup-1',
        organization_id: 'org-amaratv-1',
        lead_id: lead.id,
        user_id: agentA.id,
        activity_type: 'REMARK_ADDED',
        metadata: { remark: 'Initial Gym Visit Note' },
        created_at: new Date().toISOString(),
      };

      let activityCount = 0;
      RealtimeService.onActivity(() => {
        activityCount++;
      });

      // Deliver same event twice
      await RealtimeService.handleIncomingPostgresChange('activities', 'INSERT', remoteActivityRow);
      await RealtimeService.handleIncomingPostgresChange('activities', 'INSERT', remoteActivityRow);

      expect(activityCount).toBe(1);
      const allActs = await db.activities.where('id').equals('act-dup-1').toArray();
      expect(allActs.length).toBe(1);
    });
  });

  describe('3. Offline & Disconnect Safety', () => {
    it('preserves local Dexie data and sync outbox when realtime disconnects', async () => {
      await RealtimeService.init(admin);

      // Queue an outbox item
      await db.outbox.add({
        id: 'outbox-offline-test',
        organizationId: 'org-amaratv-1',
        entityType: 'leads',
        entityId: lead.id,
        operation: 'UPDATE',
        payload: { status: 'INTERESTED' },
        userId: admin.id,
        deviceId: 'dev-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        retryCount: 0,
        status: 'PENDING',
        lastError: null,
        lastAttemptAt: null,
      });

      // Realtime disconnects
      RealtimeService.setConnectionStatus('DISCONNECTED');
      expect(RealtimeService.getStatus()).toBe('DISCONNECTED');

      // Local lead and outbox items must remain completely intact
      const leadAfterDisconnect = await db.leads.get(lead.id);
      expect(leadAfterDisconnect).toBeDefined();

      const outboxAfterDisconnect = await db.outbox.get('outbox-offline-test');
      expect(outboxAfterDisconnect).toBeDefined();
      expect(outboxAfterDisconnect?.status).toBe('PENDING');
    });
  });
});
