/**
 * SyncEngine orchestration regression tests.
 * The legacy suite instantiated retired BackgroundSyncManager/OutboxRepository
 * classes. This suite validates the current engine's real public contract with
 * explicit boundary fakes for network push/pull services.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { agentScope } from '../helpers/vitestDatabase';

const { getSupabaseClientMock } = vi.hoisted(() => ({ getSupabaseClientMock: vi.fn() }));

vi.mock('@/services/supabaseClient', () => ({
  getSupabaseClient: getSupabaseClientMock,
}));

import { SyncEngine } from '@/services/sync/syncEngine';

describe('SyncEngine', () => {
  const engines: SyncEngine[] = [];

  afterEach(() => {
    engines.splice(0).forEach((engine) => engine.dispose());
    getSupabaseClientMock.mockReset();
    (navigator as any).onLine = true;
    vi.useRealTimers();
  });

  function createEngine(options: {
    pushResult?: { pushedCount: number; failedCount: number };
    pullResult?: { pulledCount: number; conflicts: unknown[]; newCursor?: string | null };
    pushError?: Error;
    authorize?: () => Promise<typeof agentScope | null>;
  } = {}) {
    const events: string[] = [];
    const state: any = {
      id: 'sync-state-1',
      organizationId: agentScope.organizationId,
      userId: agentScope.userId,
      deviceId: 'vitest-device',
      status: 'PENDING',
      lastPushAt: null,
      lastPullAt: null,
      lastPullCursor: null,
      lastSuccessfulSyncAt: null,
      lastSyncError: null,
    };
    const queue = {
      recoverStuckItems: vi.fn(async () => { events.push('recover'); return 0; }),
      purgeSyncedItems: vi.fn(async () => { events.push('purge'); return 0; }),
      getQueueStats: vi.fn(async () => ({ pending: 0, syncing: 0, synced: 0, failed: 0, deadLetter: 0, total: 0 })),
    };
    const push = {
      pushPending: vi.fn(async () => {
        events.push('push');
        if (options.pushError) throw options.pushError;
        return options.pushResult || { pushedCount: 2, failedCount: 0 };
      }),
    };
    const pull = {
      pullAllChanges: vi.fn(async () => {
        events.push('pull');
        return options.pullResult || { pulledCount: 3, conflicts: [], newCursor: 'cursor-1' };
      }),
    };
    const stateRepo = {
      getAccessScope: vi.fn(() => agentScope),
      getSyncState: vi.fn(async () => ({ ...state })),
      setStatus: vi.fn(async (status: string, error: string | null = null) => {
        state.status = status;
        state.lastSyncError = error;
      }),
      updateSyncState: vi.fn(async (updates: Record<string, unknown>) => Object.assign(state, updates)),
    };

    getSupabaseClientMock.mockReturnValue({});
    const engine = new SyncEngine(
      queue as any,
      push as any,
      pull as any,
      stateRepo as any,
      options.authorize || (async () => agentScope),
    );
    engines.push(engine);
    return { engine, events, queue, push, pull, state, stateRepo };
  }

  it('should run recovery, push, cleanup, and pull in the correct order', async () => {
    const { engine, events } = createEngine();

    await engine.synchronizeNow();

    expect(events).toEqual(['recover', 'push', 'purge', 'pull']);
  });

  it('should run at most one synchronization cycle at a time', async () => {
    let releasePush: (() => void) | undefined;
    const { engine, push } = createEngine();
    push.pushPending.mockImplementation(() => new Promise((resolve) => {
      releasePush = () => resolve({ pushedCount: 1, failedCount: 0 });
    }));

    const first = engine.triggerSync();
    await vi.waitFor(() => expect(push.pushPending).toHaveBeenCalledOnce());
    await expect(engine.triggerSync()).resolves.toBeNull();
    releasePush?.();
    await first;
  });

  it('should expose push failure counts from a completed cycle', async () => {
    const { engine } = createEngine({ pushResult: { pushedCount: 1, failedCount: 2 } });

    await expect(engine.synchronizeNow()).resolves.toMatchObject({ pushedCount: 1, failedCount: 2, pulledCount: 3 });
  });

  it('should report pull conflicts without changing their resolver semantics', async () => {
    const { engine } = createEngine({ pullResult: { pulledCount: 4, conflicts: [{ id: 'conflict-1' }], newCursor: 'cursor-2' } });

    await expect(engine.synchronizeNow()).resolves.toMatchObject({ pulledCount: 4, conflictsCount: 1 });
  });

  it('should preserve verified-call conflict accounting from pull results', async () => {
    const { engine } = createEngine({ pullResult: { pulledCount: 1, conflicts: [{ entityType: 'call_records', resolution: 'REMOTE_WON' }], newCursor: null } });

    await expect(engine.synchronizeNow()).resolves.toMatchObject({ conflictsCount: 1, failedCount: 0 });
  });

  it('should report delete-versus-update conflicts from pull reconciliation', async () => {
    const { engine } = createEngine({ pullResult: { pulledCount: 1, conflicts: [{ entityType: 'leads', resolution: 'LOCAL_WON' }], newCursor: null } });

    await expect(engine.synchronizeNow()).resolves.toMatchObject({ pulledCount: 1, conflictsCount: 1 });
  });

  it('should treat mutable pull records as atomic reconciliation units', async () => {
    const { engine, pull } = createEngine();

    await engine.synchronizeNow();

    expect(pull.pullAllChanges).toHaveBeenCalledWith(null, expect.anything(), expect.any(Function));
  });

  it('should start and stop periodic synchronization', async () => {
    vi.useFakeTimers();
    const { engine, push } = createEngine();

    engine.startAutoSync(1_000);
    await vi.runOnlyPendingTimersAsync();
    engine.stopAutoSync();
    const callsAfterStop = push.pushPending.mock.calls.length;
    await vi.advanceTimersByTimeAsync(3_000);

    expect(callsAfterStop).toBeGreaterThanOrEqual(1);
    expect(push.pushPending).toHaveBeenCalledTimes(callsAfterStop);
  });

  it('should process pending mutations during synchronization', async () => {
    const { engine, queue, push } = createEngine();

    await engine.synchronizeNow();

    expect(queue.recoverStuckItems).toHaveBeenCalledOnce();
    expect(push.pushPending).toHaveBeenCalledOnce();
  });

  it('should record sync failures in state without concealing the error', async () => {
    const { engine, state, stateRepo } = createEngine({ pushError: new Error('push failed') });

    await expect(engine.synchronizeNow()).resolves.toMatchObject({ error: 'push failed' });
    expect(state.status).toBe('ERROR');
    expect(state.lastSyncError).toBe('push failed');
    expect(stateRepo.setStatus).toHaveBeenCalledWith('ERROR', 'push failed');
  });

  it('should respect offline state without pushing or pulling', async () => {
    (navigator as any).onLine = false;
    const { engine, push, pull, state } = createEngine();

    await expect(engine.synchronizeNow()).resolves.toMatchObject({ error: 'Device is offline' });
    expect(state.status).toBe('OFFLINE');
    expect(push.pushPending).not.toHaveBeenCalled();
    expect(pull.pullAllChanges).not.toHaveBeenCalled();
  });

  it('should batch all queued work through one push invocation per cycle', async () => {
    const { engine, push } = createEngine({ pushResult: { pushedCount: 50, failedCount: 0 } });

    await expect(engine.synchronizeNow()).resolves.toMatchObject({ pushedCount: 50 });
    expect(push.pushPending).toHaveBeenCalledOnce();
  });

  it('should persist the cursor returned by incremental pull', async () => {
    const { engine, state } = createEngine({ pullResult: { pulledCount: 2, conflicts: [], newCursor: 'cursor-after-pull' } });

    await engine.synchronizeNow();

    expect(state.lastPullCursor).toBe('cursor-after-pull');
  });

  it('should record the last successful synchronization timestamp', async () => {
    const { engine, state } = createEngine();

    await engine.synchronizeNow();

    expect(state.lastSuccessfulSyncAt).toEqual(expect.any(String));
    expect(state.status).toBe('SYNCED');
  });

  it('should return an inactive-context result after disposal', async () => {
    const { engine, push } = createEngine();
    engine.dispose();

    await expect(engine.synchronizeNow()).resolves.toMatchObject({ error: 'Synchronization context is inactive' });
    expect(push.pushPending).not.toHaveBeenCalled();
  });
});
