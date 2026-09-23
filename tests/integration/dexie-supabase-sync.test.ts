/**
 * Dexie-to-Supabase synchronization integration regression tests.
 *
 * The retired suite referenced a removed BackgroundSyncManager and old remote
 * schema. It now tests the current durable outbox + engine boundary locally;
 * tests/integration/supabase-sync.test.ts covers the live local Supabase stack.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SalesCRMDatabase } from '@/db/database';
import { SyncQueue } from '@/services/sync/syncQueue';
import { SyncEngine } from '@/services/sync/syncEngine';
import { SyncConflictResolver } from '@/services/sync/syncConflictResolver';
import { agentScope, createVitestDatabase, disposeVitestDatabase } from '../helpers/vitestDatabase';

const { getSupabaseClientMock } = vi.hoisted(() => ({ getSupabaseClientMock: vi.fn() }));

vi.mock('@/services/supabaseClient', () => ({
  getSupabaseClient: getSupabaseClientMock,
}));

describe('Dexie to Supabase synchronization integration', () => {
  let database: SalesCRMDatabase;
  let queue: SyncQueue;
  const engines: SyncEngine[] = [];

  beforeEach(() => {
    database = createVitestDatabase('dexie_sync');
    queue = new SyncQueue(database);
    getSupabaseClientMock.mockReturnValue({});
  });

  afterEach(async () => {
    engines.splice(0).forEach((engine) => engine.dispose());
    getSupabaseClientMock.mockReset();
    (navigator as any).onLine = true;
    vi.useRealTimers();
    await disposeVitestDatabase(database);
  });

  async function enqueue(operation: 'CREATE' | 'UPDATE' | 'DELETE' = 'CREATE', entityId = crypto.randomUUID()) {
    return queue.enqueue({
      entityType: 'leads',
      entityId,
      operation,
      payload: { id: entityId, businessName: 'Integration Gym' },
      userId: agentScope.userId,
      organizationId: agentScope.organizationId,
      deviceId: 'vitest-device',
    });
  }

  function createEngine(options: {
    push?: (client: unknown) => Promise<{ pushedCount: number; failedCount: number }>;
    cursor?: string | null;
    pull?: { pulledCount: number; conflicts: unknown[]; newCursor?: string | null };
  } = {}) {
    const state: any = {
      id: 'state-1', organizationId: agentScope.organizationId, userId: agentScope.userId, deviceId: 'vitest-device',
      status: 'PENDING', lastPushAt: null, lastPullAt: null, lastPullCursor: options.cursor || null,
      lastSuccessfulSyncAt: null, lastSyncError: null,
    };
    const push = {
      pushPending: vi.fn(async (client: unknown) => options.push
        ? options.push(client)
        : { pushedCount: 0, failedCount: 0 }),
    };
    const pull = {
      pullAllChanges: vi.fn(async () => options.pull || { pulledCount: 0, conflicts: [], newCursor: null }),
    };
    const stateRepo = {
      getAccessScope: () => agentScope,
      getSyncState: async () => ({ ...state }),
      setStatus: async (status: string, error: string | null = null) => { state.status = status; state.lastSyncError = error; },
      updateSyncState: async (updates: Record<string, unknown>) => Object.assign(state, updates),
    };
    const engine = new SyncEngine(queue, push as any, pull as any, stateRepo as any, async () => agentScope);
    engines.push(engine);
    return { engine, push, pull, state };
  }

  it('should queue operations when offline', async () => {
    (navigator as any).onLine = false;
    const item = await enqueue();
    const { engine } = createEngine();

    await expect(engine.synchronizeNow()).resolves.toMatchObject({ error: 'Device is offline' });
    expect(await database.outbox.get(item.id)).toMatchObject({ status: 'PENDING' });
  });

  it('should process queued operations when online', async () => {
    const item = await enqueue();
    const { engine } = createEngine({
      push: async () => {
        const pending = await queue.getPendingItems();
        await queue.markSynced(pending.map((entry) => entry.id));
        return { pushedCount: pending.length, failedCount: 0 };
      },
    });

    await expect(engine.synchronizeNow()).resolves.toMatchObject({ pushedCount: 1, failedCount: 0 });
    expect(await database.outbox.get(item.id)).toBeUndefined();
  });

  it('should drain causally released outbox operations in one synchronization cycle', async () => {
    const first = await enqueue('CREATE');
    await enqueue('UPDATE', first.entityId);
    const push = vi.fn(async () => {
      const pending = await queue.getPendingItems();
      await queue.markSynced(pending.map((entry) => entry.id));
      return { pushedCount: pending.length, failedCount: 0 };
    });
    const { engine } = createEngine({ push });

    await expect(engine.synchronizeNow()).resolves.toMatchObject({ pushedCount: 2, failedCount: 0 });
    expect(push).toHaveBeenCalledTimes(2);
    expect(await queue.getPendingItems()).toHaveLength(0);
  });

  it('should retain failed operations for later retry', async () => {
    const item = await enqueue();
    const { engine, state } = createEngine({
      push: async () => {
        await queue.markFailed(item.id, 'temporary remote failure');
        return { pushedCount: 0, failedCount: 1 };
      },
    });

    await expect(engine.synchronizeNow()).resolves.toMatchObject({ failedCount: 1 });
    expect(await database.outbox.get(item.id)).toMatchObject({ status: 'FAILED', retryCount: 1 });
    expect(state.status).toBe('PENDING');
  });

  it('should resolve concurrent mutable updates with server timestamp precedence', () => {
    const local = { id: 'lead-1', businessName: 'Local', updatedAt: '2024-01-01T00:00:00.000Z' };
    const remote = { id: 'lead-1', businessName: 'Server', updatedAt: '2024-01-02T00:00:00.000Z' };

    expect(SyncConflictResolver.resolveMutable('leads', local, remote)).toMatchObject({ winner: 'REMOTE', data: remote });
  });

  it('should apply VERIFIED-duration-wins for call records', () => {
    const local = { id: 'call-1', durationSeconds: 300, verificationStatus: 'UNVERIFIED', updatedAt: '2024-01-02T00:00:00.000Z' };
    const remote = { id: 'call-1', durationSeconds: 90, verificationStatus: 'VERIFIED', updatedAt: '2024-01-01T00:00:00.000Z' };

    expect(SyncConflictResolver.resolveCallRecord(local, remote)).toMatchObject({ winner: 'REMOTE', data: remote });
  });

  it('should start a background synchronization interval', async () => {
    vi.useFakeTimers();
    const { engine, push } = createEngine();
    engine.startAutoSync(1_000);
    await vi.runOnlyPendingTimersAsync();
    engine.stopAutoSync();

    expect(push.pushPending).toHaveBeenCalled();
  });

  it('should synchronize periodically while the engine remains active', async () => {
    vi.useFakeTimers();
    const { engine, push } = createEngine();
    engine.startAutoSync(1_000);
    await vi.advanceTimersByTimeAsync(2_100);
    engine.stopAutoSync();

    expect(push.pushPending.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('should not sync when the device is offline', async () => {
    (navigator as any).onLine = false;
    const { engine, push } = createEngine();

    await engine.synchronizeNow();
    expect(push.pushPending).not.toHaveBeenCalled();
  });

  it('should track the pull cursor returned by the server', async () => {
    const { engine, state } = createEngine({ pull: { pulledCount: 1, conflicts: [], newCursor: 'cursor-next' } });
    await engine.synchronizeNow();

    expect(state.lastPullCursor).toBe('cursor-next');
  });

  it('should provide the prior cursor for incremental synchronization', async () => {
    const { engine, pull } = createEngine({ cursor: 'cursor-before' });
    await engine.synchronizeNow();

    expect(pull.pullAllChanges).toHaveBeenCalledWith('cursor-before', expect.anything(), expect.any(Function));
  });

  it('should persist the last successful sync time', async () => {
    const { engine, state } = createEngine();
    await engine.synchronizeNow();

    expect(state.lastSuccessfulSyncAt).toEqual(expect.any(String));
  });

  it('should reject concurrent engine cycles without duplicating a push', async () => {
    let release: (() => void) | undefined;
    const { engine, push } = createEngine({
      push: async () => new Promise((resolve) => { release = () => resolve({ pushedCount: 0, failedCount: 0 }); }),
    });

    const first = engine.triggerSync();
    await vi.waitFor(() => expect(push.pushPending).toHaveBeenCalledOnce());
    await expect(engine.triggerSync()).resolves.toBeNull();
    release?.();
    await first;
  });

  it('should use exponential retry scheduling for failed outbox items', async () => {
    const item = await enqueue();
    const before = Date.now();
    await queue.markFailed(item.id, 'network failure');
    const failed = await database.outbox.get(item.id);

    expect(failed).toMatchObject({ status: 'FAILED', retryCount: 1, lastError: 'network failure' });
    expect(new Date(failed!.nextAttemptAt!).getTime()).toBeGreaterThanOrEqual(before + SyncQueue.RETRY_BASE_MS);
  });
});
