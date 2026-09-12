import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SyncConflictResolver } from '../src/services/sync/syncConflictResolver.ts';

test('F003: future client time cannot beat a newer server revision', () => {
  const local = { id: 'x', serverRevision: 1, updatedAt: '2099-01-01T00:00:00Z', isSynced: 0 };
  const remote = { id: 'x', serverRevision: 2, updatedAt: '2026-01-01T00:00:00Z', isSynced: 1 };
  assert.equal(SyncConflictResolver.resolveMutable('leads', local, remote).winner, 'REMOTE');
});

test('F003: delayed older Realtime revision cannot replace a newer local server snapshot', () => {
  const local = { id: 'x', serverRevision: 2, updatedAt: '2000-01-01T00:00:00Z', isSynced: 1 };
  const remote = { id: 'x', serverRevision: 1, updatedAt: '2099-01-01T00:00:00Z', isSynced: 1 };
  assert.equal(SyncConflictResolver.resolveMutable('leads', local, remote).winner, 'LOCAL');
});

test('F003: same-revision refresh preserves an offline edit until CAS acknowledges it', () => {
  const local = { id: 'x', serverRevision: 2, updatedAt: '2000-01-01T00:00:00Z', isSynced: 0 };
  const remote = { id: 'x', serverRevision: 2, updatedAt: '2026-01-01T00:00:00Z', isSynced: 1 };
  assert.equal(SyncConflictResolver.resolveMutable('leads', local, remote).winner, 'LOCAL');
});
