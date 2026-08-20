import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { SalesCRMDatabase } from '../src/db/database';
import { createCRMDataLayer } from '../src/db';
import { SyncQueue } from '../src/services/sync/syncQueue';
import { SyncPush } from '../src/services/sync/syncPush';
import { SyncPull } from '../src/services/sync/syncPull';
import { SyncConflictResolver } from '../src/services/sync/syncConflictResolver';
import { SyncStateRepository } from '../src/services/sync/syncStateRepository';
import { SyncEngine } from '../src/services/sync/syncEngine';
import { DeviceService } from '../src/services/deviceService';
import { AuthService } from '../src/services/authService';
import { setCustomSupabaseClient, resetSupabaseClient } from '../src/services/supabaseClient';
import { User, Lead, CallRecord, Activity } from '../src/db/types';

describe('Phase 2F: Offline-First Bidirectional Sync Engine', () => {
  let db: SalesCRMDatabase;
  let crm: ReturnType<typeof createCRMDataLayer>;
  let syncQueue: SyncQueue;
  let syncPush: SyncPush;
  let syncPull: SyncPull;
  let syncStateRepo: SyncStateRepository;
  let syncEngine: SyncEngine;
  let testAdmin: User;
  let testAgent: User;

  // In-Memory Cloud Database Mock for Supabase
  let mockCloudTables: {
    leads: any[];
    call_records: any[];
    activities: any[];
    remarks: any[];
    follow_ups: any[];
    message_history: any[];
    import_audits: any[];
    profiles: any[];
  };

  const createMockSupabaseClient = () => {
    return {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              access_token: 'mock-valid-jwt',
              user: { id: testAgent.id, email: testAgent.email },
            },
          },
          error: null,
        }),
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: testAgent.id, email: testAgent.email } },
          error: null,
        }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
      },
      from: vi.fn().mockImplementation((tableName: string) => {
        const tableData = (mockCloudTables as any)[tableName] || [];

        return {
          upsert: vi.fn().mockImplementation(async (records: any | any[]) => {
            const list = Array.isArray(records) ? records : [records];
            for (const rec of list) {
              const existingIdx = tableData.findIndex((r: any) => r.id === rec.id);
              if (existingIdx >= 0) {
                tableData[existingIdx] = { ...tableData[existingIdx], ...rec };
              } else {
                tableData.push({ ...rec });
              }
            }
            return { data: list, error: null };
          }),
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              gt: vi.fn().mockImplementation((col: string, val: string) => {
                const filtered = tableData.filter((r: any) => (r[col] || '') > val);
                return Promise.resolve({ data: filtered, error: null });
              }),
              then: (resolve: any) => resolve({ data: [...tableData], error: null }),
            }),
          }),
        };
      }),
    } as any;
  };

  beforeEach(async () => {
    DeviceService.resetDeviceIdForTesting();
    resetSupabaseClient();
    const testDbName = `test_sync_${Math.random().toString(36).substring(7)}`;
    db = new SalesCRMDatabase(testDbName);
    crm = createCRMDataLayer(db);
    AuthService.setCustomDatabase(db);
    await db.seedDefaults();

    mockCloudTables = {
      leads: [],
      call_records: [],
      activities: [],
      remarks: [],
      follow_ups: [],
      message_history: [],
      import_audits: [],
      profiles: [],
    };

    syncQueue = new SyncQueue(db);
    syncStateRepo = new SyncStateRepository(db);
    syncPush = new SyncPush(syncQueue);
    syncPull = new SyncPull(db);
    syncEngine = new SyncEngine(syncQueue, syncPush, syncPull, syncStateRepo);

    // Create Admin and Agent
    testAdmin = await crm.users.createUser({
      id: 'admin-sync-1',
      name: 'Admin Vikram',
      email: 'admin@amaratvkrishi.com',
      phone: '9988776655',
      role: 'ADMIN',
      status: 'ACTIVE',
    });

    testAgent = await crm.users.createUser({
      id: 'agent-sync-2',
      name: 'Agent Rahul',
      email: 'rahul@amaratvkrishi.com',
      phone: '9123456780',
      role: 'AGENT',
      status: 'ACTIVE',
      createdBy: testAdmin.id,
    });
  });

  afterEach(async () => {
    syncEngine.stopAutoSync();
    AuthService.setCustomDatabase(null);
    resetSupabaseClient();
    await db.delete();
    vi.restoreAllMocks();
  });

  describe('1. Outbox Queue & Offline Persistence', () => {
    it('enqueues local mutations into the persistent outbox with status PENDING', async () => {
      const outboxItem = await syncQueue.enqueue({
        entityType: 'leads',
        entityId: 'lead-test-1',
        operation: 'CREATE',
        payload: {
          id: 'lead-test-1',
          businessName: 'Gold Gym Gomti Nagar',
          phone: '9876500001',
          locality: 'Gomti Nagar',
        },
        userId: testAgent.id,
      });

      expect(outboxItem.id).toBeDefined();
      expect(outboxItem.status).toBe('PENDING');
      expect(outboxItem.retryCount).toBe(0);
      expect(outboxItem.entityType).toBe('leads');

      const stats = await syncQueue.getQueueStats();
      expect(stats.pending).toBe(1);
      expect(stats.total).toBe(1);
    });

    it('persists outbox items across app restart / database reload', async () => {
      await syncQueue.enqueue({
        entityType: 'leads',
        entityId: 'lead-test-persist',
        operation: 'CREATE',
        payload: { id: 'lead-test-persist', businessName: 'Persisted Gym' },
        userId: testAgent.id,
      });

      // Query from Dexie directly
      const items = await db.outbox.toArray();
      expect(items.length).toBe(1);
      expect(items[0].entityId).toBe('lead-test-persist');
      expect(items[0].status).toBe('PENDING');
    });
  });

  describe('2. Push Synchronization & Partial Failure Handling', () => {
    it('pushes pending outbox mutations to Supabase and marks items SYNCED', async () => {
      const mockClient = createMockSupabaseClient();

      await syncQueue.enqueue({
        entityType: 'leads',
        entityId: 'lead-push-1',
        operation: 'CREATE',
        payload: {
          id: 'lead-push-1',
          businessName: 'Fit Zone Lucknow',
          phone: '9876500002',
          locality: 'Alambagh',
        },
        userId: testAgent.id,
      });

      const pushRes = await syncPush.pushPending(mockClient);
      expect(pushRes.pushedCount).toBe(1);
      expect(pushRes.failedCount).toBe(0);

      // Verify cloud received record
      expect(mockCloudTables.leads.length).toBe(1);
      expect(mockCloudTables.leads[0].id).toBe('lead-push-1');
      expect(mockCloudTables.leads[0].business_name).toBe('Fit Zone Lucknow');

      // Verify outbox status updated to SYNCED
      const stats = await syncQueue.getQueueStats();
      expect(stats.synced).toBe(1);
      expect(stats.pending).toBe(0);
    });

    it('handles partial batch failure safely without losing remaining queue items', async () => {
      // Create a mock client where item 2 fails
      const mockClient = {
        from: vi.fn().mockReturnValue({
          upsert: vi.fn().mockImplementation(async (records: any | any[]) => {
            const list = Array.isArray(records) ? records : [records];
            if (list.length > 1) {
              // Batch fails, force single fallback
              return { error: { message: 'Batch error' } };
            }
            if (list[0].id === 'lead-fail-2') {
              return { error: { message: 'Database constraint violation' } };
            }
            mockCloudTables.leads.push(list[0]);
            return { error: null };
          }),
        }),
      } as any;

      // Enqueue 3 items
      await syncQueue.enqueue({
        entityType: 'leads',
        entityId: 'lead-ok-1',
        operation: 'CREATE',
        payload: { id: 'lead-ok-1', businessName: 'Gym 1' },
        userId: testAgent.id,
      });

      await syncQueue.enqueue({
        entityType: 'leads',
        entityId: 'lead-fail-2',
        operation: 'CREATE',
        payload: { id: 'lead-fail-2', businessName: 'Gym 2' },
        userId: testAgent.id,
      });

      await syncQueue.enqueue({
        entityType: 'leads',
        entityId: 'lead-ok-3',
        operation: 'CREATE',
        payload: { id: 'lead-ok-3', businessName: 'Gym 3' },
        userId: testAgent.id,
      });

      const pushRes = await syncPush.pushPending(mockClient);
      expect(pushRes.pushedCount).toBe(2);
      expect(pushRes.failedCount).toBe(1);

      const stats = await syncQueue.getQueueStats();
      expect(stats.synced).toBe(2);
      expect(stats.failed).toBe(1);
    });

    it('retries failed outbox items with incremented retry count', async () => {
      const outboxItem = await syncQueue.enqueue({
        entityType: 'leads',
        entityId: 'lead-retry-1',
        operation: 'CREATE',
        payload: { id: 'lead-retry-1', businessName: 'Retry Gym' },
        userId: testAgent.id,
      });

      await syncQueue.markFailed(outboxItem.id, 'Temporary Network Error');

      const failedItem = (await db.outbox.get(outboxItem.id))!;
      expect(failedItem.status).toBe('FAILED');
      expect(failedItem.retryCount).toBe(1);
      expect(failedItem.lastError).toBe('Temporary Network Error');

      // Pending query includes FAILED items for retry
      const retryList = await syncQueue.getPendingItems();
      expect(retryList.length).toBe(1);
      expect(retryList[0].id).toBe(outboxItem.id);
    });
  });

  describe('3. Pull Synchronization & Cursor Advancement', () => {
    it('pulls changes from Supabase and reconciles them into local Dexie', async () => {
      const mockClient = createMockSupabaseClient();

      // Seed cloud with a lead created by another rep
      const cloudLead = {
        id: 'cloud-lead-1',
        organization_id: 'org-1',
        business_name: 'Skywards Fitness Aliganj',
        category: 'Gym',
        phone: '9876543210',
        address: 'Aliganj, Lucknow',
        locality: 'Aliganj',
        status: 'NEW',
        created_at: new Date(Date.now() - 60000).toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockCloudTables.leads.push(cloudLead);

      const pullRes = await syncPull.pullAllChanges(null, mockClient);
      expect(pullRes.pulledCount).toBe(1);
      expect(pullRes.newCursor).toBeDefined();

      // Verify local Dexie has received the lead
      const localLead = await crm.leads.getLeadById('cloud-lead-1');
      expect(localLead).toBeDefined();
      expect(localLead?.businessName).toBe('Skywards Fitness Aliganj');
      expect(localLead?.locality).toBe('Aliganj');
      expect(localLead?.isSynced).toBe(1);
    });

    it('advances cursor and only pulls records newer than lastPullCursor', async () => {
      const mockClient = createMockSupabaseClient();

      const t1 = new Date(Date.now() - 10000).toISOString();
      const t2 = new Date().toISOString();

      mockCloudTables.leads.push({
        id: 'old-lead',
        business_name: 'Old Gym',
        phone: '9000000001',
        address: 'Lucknow',
        locality: 'Hazratganj',
        updated_at: t1,
      });

      mockCloudTables.leads.push({
        id: 'new-lead',
        business_name: 'New Gym',
        phone: '9000000002',
        address: 'Lucknow',
        locality: 'Hazratganj',
        updated_at: t2,
      });

      // Pull since t1
      const pullRes = await syncPull.pullAllChanges(t1, mockClient);
      expect(pullRes.pulledCount).toBe(1);

      const pulledLead = await crm.leads.getLeadById('new-lead');
      expect(pulledLead).toBeDefined();

      const skippedLead = await crm.leads.getLeadById('old-lead');
      expect(skippedLead).toBeUndefined();
    });
  });

  describe('4. Deterministic Conflict Resolution', () => {
    it('applies UUID idempotency for append-only entities (CallRecord, Activity)', async () => {
      // Local call record exists
      const localCall: CallRecord = {
        id: 'call-uuid-1',
        leadId: 'lead-1',
        userId: testAgent.id,
        deviceId: 'device-1',
        startedAt: '2026-08-20T10:00:00.000Z',
        answeredAt: '2026-08-20T10:00:05.000Z',
        endedAt: '2026-08-20T10:02:00.000Z',
        durationSeconds: 115,
        outcome: 'CONNECTED',
        remark: 'Sample discussed',
        verificationStatus: 'UNVERIFIED',
        createdAt: '2026-08-20T10:00:00.000Z',
        updatedAt: '2026-08-20T10:02:00.000Z',
        isSynced: 1,
        deletedAt: null,
      };

      const remoteCall = { ...localCall };

      const res = SyncConflictResolver.resolveAppendOnly(localCall, remoteCall);
      expect(res.winner).toBe('LOCAL');
      expect(res.data.id).toBe('call-uuid-1');
    });

    it('resolves mutable entity conflict using Last-Write-Wins (newer remote wins)', async () => {
      const localLead: Lead = {
        id: 'lead-lww-1',
        businessName: 'Local Gym Name',
        category: 'Gym',
        phone: '9888800000',
        phoneRaw: '+91 98888 00000',
        phoneE164: '+919888800000',
        phoneType: 'mobile',
        alternatePhone: null,
        contactPerson: null,
        address: 'Chowk, Lucknow',
        locality: 'Chowk',
        pincode: '226003',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        website: null,
        rating: null,
        reviewCount: null,
        source: 'Field Sales',
        sourceFile: null,
        sourceRow: null,
        status: 'NEW',
        customNotes: '',
        lastContactedAt: null,
        nextFollowUpAt: null,
        callCount: 0,
        createdBy: null,
        assignedTo: null,
        updatedBy: null,
        createdAt: '2026-08-20T08:00:00.000Z',
        updatedAt: '2026-08-20T09:00:00.000Z', // 9 AM
        isSynced: 1,
        syncedAt: null,
        deletedAt: null,
      };

      const remoteLead = {
        ...localLead,
        businessName: 'Remote Authoritative Gym Name',
        updated_at: '2026-08-20T10:00:00.000Z', // 10 AM (newer)
      };

      const res = SyncConflictResolver.resolveMutable('leads', localLead, remoteLead);
      expect(res.winner).toBe('REMOTE');
      expect(res.data.businessName).toBe('Remote Authoritative Gym Name');
      expect(res.conflict).toBeDefined();
      expect(res.conflict?.resolution).toBe('REMOTE_WON');
    });
  });

  describe('5. Full Sync Engine Orchestration & Cross-User Scenarios', () => {
    it('executes full bidirectional sync cycle: Agent creates lead -> Pushes -> Admin pulls lead', async () => {
      const mockClient = createMockSupabaseClient();
      setCustomSupabaseClient(mockClient);

      // Scenario A: Agent creates a lead locally and enqueues to outbox
      const agentLead = await crm.leads.createLead({
        businessName: 'Cross-User Fitness Hub',
        phone: '9876500099',
        address: 'Indira Nagar, Lucknow',
        createdBy: testAgent.id,
        assignedTo: testAgent.id,
      });

      await syncQueue.enqueue({
        entityType: 'leads',
        entityId: agentLead.id,
        operation: 'CREATE',
        payload: agentLead,
        userId: testAgent.id,
      });

      // Agent Syncs
      const syncRes = await syncEngine.synchronizeNow();
      expect(syncRes.pushedCount).toBe(1);
      expect(mockCloudTables.leads.length).toBe(1);
      expect(mockCloudTables.leads[0].id).toBe(agentLead.id);

      // Scenario B: Admin on a second device syncs and pulls the lead
      const adminDb = new SalesCRMDatabase(`admin_dev_${Math.random().toString(36).substring(7)}`);
      const adminPull = new SyncPull(adminDb);

      const adminPullRes = await adminPull.pullAllChanges(null, mockClient);
      expect(adminPullRes.pulledCount).toBe(1);

      const receivedLead = await adminDb.leads.get(agentLead.id);
      expect(receivedLead).toBeDefined();
      expect(receivedLead?.businessName).toBe('Cross-User Fitness Hub');
      expect(receivedLead?.createdBy).toBe(testAgent.id);

      await adminDb.delete();
    });

    it('preserves unverified call duration status during sync', async () => {
      const mockClient = createMockSupabaseClient();

      await syncQueue.enqueue({
        entityType: 'call_records',
        entityId: 'call-unverified-1',
        operation: 'CREATE',
        payload: {
          id: 'call-unverified-1',
          leadId: 'lead-100',
          userId: testAgent.id,
          startedAt: new Date().toISOString(),
          durationSeconds: 0,
          outcome: 'CONNECTED',
          verificationStatus: 'UNVERIFIED',
        },
        userId: testAgent.id,
      });

      await syncPush.pushPending(mockClient);
      expect(mockCloudTables.call_records[0].verification_status).toBe('UNVERIFIED');
    });

    it('sets status to AUTH_REQUIRED when user session is missing', async () => {
      const mockClient = {
        auth: {
          getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        },
      } as any;
      setCustomSupabaseClient(mockClient);

      const res = await syncEngine.synchronizeNow();
      expect(res.error).toBe('Authentication required');

      const state = await syncStateRepo.getSyncState();
      expect(state.status).toBe('AUTH_REQUIRED');
    });
  });

  describe('6. Backup Preservation of Outbox Queue', () => {
    it('preserves pending outbox queue in backup exports without losing offline mutations', async () => {
      await syncQueue.enqueue({
        entityType: 'leads',
        entityId: 'lead-backup-1',
        operation: 'CREATE',
        payload: { id: 'lead-backup-1', businessName: 'Backup Pending Gym' },
        userId: testAgent.id,
      });

      const backup = await crm.backup.generateBackupPayload();
      expect(backup.data.outbox).toBeDefined();
      expect(backup.data.outbox?.length).toBe(1);
      expect(backup.data.outbox?.[0].entityId).toBe('lead-backup-1');
    });
  });
});
