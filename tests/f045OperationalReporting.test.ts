import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { reportOperationalError } from '../src/services/operationalReportingService';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('F045 safe operational reporting boundary', () => {
  it('never transmits credentials, personal data or raw exception text', async () => {
    let transmitted: unknown;
    const client = { rpc: (_name: string, payload: unknown) => {
      transmitted = payload;
      return { abortSignal: async () => ({ data: 'event-id', error: null }) };
    } } as unknown as SupabaseClient;
    const error = new Error('Network failed: password=fixture-secret access_token=fixture-token phone=9876543210 email=person@example.test');
    assert.equal(await reportOperationalError('sync_cycle', error, 2, client), true);
    assert.deepEqual(transmitted, { operation: 'sync_cycle', category: 'network', platform: 'web', build: '2.0.0', failure_count: 2 });
  });
  it('collector failure does not throw into the business operation', async () => {
    const client = { rpc: () => { throw new Error('collector offline'); } } as unknown as SupabaseClient;
    assert.equal(await reportOperationalError('render', new Error('private message'), 1, client), false);
  });
  it('does not claim successful ingestion after server rejection', async () => {
    const client = { rpc: () => ({ abortSignal: async () => ({ data: null, error: { code: '42501' } }) }) } as unknown as SupabaseClient;
    assert.equal(await reportOperationalError('sync_push', 'SYNC_CONFLICT', 1, client), false);
  });
});
