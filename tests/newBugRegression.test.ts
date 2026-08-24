import 'fake-indexeddb/auto';
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { SalesCRMDatabase } from '../src/db/database.ts';
import { RealtimeService } from '../src/services/realtime/realtimeService.ts';
import type { Lead, CallRecord } from '../src/db/types.ts';

function freshDb(name: string) {
  const db = new SalesCRMDatabase(`NewBugRegression_${Date.now()}_${name}`);
  return db;
}

function pgLeadRow(id: string, orgId: string): Record<string, any> {
  const now = new Date().toISOString();
  return {
    id,
    organization_id: orgId,
    business_name: 'Realtime Delete Gym',
    category: 'Gym',
    phone: '9811100010',
    phone_raw: '9811100010',
    phone_e164: '+919811100010',
    phone_type: 'mobile',
    alternate_phone: null,
    contact_person: null,
    address: '12 MG Road',
    locality: 'Hazratganj',
    pincode: '226001',
    city: 'Lucknow',
    state: 'Uttar Pradesh',
    website: null,
    rating: null,
    review_count: null,
    source: 'Field Sales',
    source_file: null,
    source_row: null,
    status: 'NEW',
    custom_notes: '',
    last_contacted_at: null,
    next_follow_up_at: null,
    call_count: 0,
    created_by: null,
    assigned_to: null,
    updated_by: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

function pgCallRow(id: string, leadId: string, orgId: string): Record<string, any> {
  const now = new Date().toISOString();
  return {
    id,
    organization_id: orgId,
    lead_id: leadId,
    user_id: null,
    device_id: null,
    dial_attempt_id: `dial_${id}`,
    started_at: now,
    answered_at: null,
    ended_at: now,
    duration_seconds: 0,
    reported_duration_seconds: null,
    outcome: 'NO_ANSWER',
    call_status: 'NOT_CONNECTED',
    remark: null,
    verification_status: 'UNVERIFIED',
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

describe('NEW-BUG-001: realtime DELETE events must remove local rows, not resurrect them', () => {
  it('leads: cloud DELETE event deletes the local lead (no resurrection)', async () => {
    const db = freshDb('nb1_leads');
    RealtimeService.setCustomDatabase(db);

    try {
      // Device B has the lead locally (previously synced from cloud).
      const row = pgLeadRow('lead-nb1', 'org-nb1');
      await RealtimeService.handleIncomingPostgresChange('leads', 'INSERT', row);
      assert.ok(await db.leads.get('lead-nb1'), 'lead exists locally before delete');

      // Device A hard-deletes the lead; cloud emits DELETE with full old row
      // (REPLICA IDENTITY FULL). Device B receives it over realtime.
      await RealtimeService.handleIncomingPostgresChange('leads', 'DELETE', row);

      const after = await db.leads.get('lead-nb1');
      assert.strictEqual(after, undefined, 'DELETE event must remove the local lead, not re-insert it');
    } finally {
      RealtimeService.setCustomDatabase(null);
      await db.close();
    }
  });

  it('call_records: cloud DELETE event deletes the local call record (FK cascade propagation)', async () => {
    const db = freshDb('nb1_calls');
    RealtimeService.setCustomDatabase(db);

    try {
      const callRow = pgCallRow('call-nb1', 'lead-nb1', 'org-nb1');
      await RealtimeService.handleIncomingPostgresChange('call_records', 'INSERT', callRow);
      assert.ok(await db.callRecords.get('call-nb1'), 'call record exists locally before delete');

      await RealtimeService.handleIncomingPostgresChange('call_records', 'DELETE', callRow);

      const after = await db.callRecords.get('call-nb1');
      assert.strictEqual(after, undefined, 'DELETE event must remove the local call record');
    } finally {
      RealtimeService.setCustomDatabase(null);
      await db.close();
    }
  });

  it('DELETE event for a row that never existed locally is a safe no-op', async () => {
    const db = freshDb('nb1_noop');
    RealtimeService.setCustomDatabase(db);

    try {
      const row = pgLeadRow('lead-nb1-ghost', 'org-nb1');
      await RealtimeService.handleIncomingPostgresChange('leads', 'DELETE', row);

      const after = await db.leads.get('lead-nb1-ghost');
      assert.strictEqual(after, undefined, 'DELETE of unknown row must not create it');
    } finally {
      RealtimeService.setCustomDatabase(null);
      await db.close();
    }
  });

  it('create -> delete -> recreate converges: INSERT after DELETE restores the row', async () => {
    const db = freshDb('nb1_recreate');
    RealtimeService.setCustomDatabase(db);

    try {
      const row = pgLeadRow('lead-nb1-re', 'org-nb1');
      await RealtimeService.handleIncomingPostgresChange('leads', 'INSERT', row);
      await RealtimeService.handleIncomingPostgresChange('leads', 'DELETE', row);
      assert.strictEqual(await db.leads.get('lead-nb1-re'), undefined, 'deleted');

      const recreated = { ...row, business_name: 'Recreated Gym', updated_at: new Date().toISOString() };
      await RealtimeService.handleIncomingPostgresChange('leads', 'INSERT', recreated);

      const after = await db.leads.get('lead-nb1-re');
      assert.ok(after, 'recreated lead present');
      assert.strictEqual(after.businessName, 'Recreated Gym');
    } finally {
      RealtimeService.setCustomDatabase(null);
      await db.close();
    }
  });

  it('UPDATE events still reconcile via LWW after the DELETE fix', async () => {
    const db = freshDb('nb1_update');
    RealtimeService.setCustomDatabase(db);

    try {
      const row = pgLeadRow('lead-nb1-upd', 'org-nb1');
      await RealtimeService.handleIncomingPostgresChange('leads', 'INSERT', row);

      const newer = { ...row, business_name: 'Updated Gym', updated_at: new Date(Date.now() + 60_000).toISOString() };
      await RealtimeService.handleIncomingPostgresChange('leads', 'UPDATE', newer);

      const after = await db.leads.get('lead-nb1-upd');
      assert.ok(after, 'lead still present after UPDATE');
      assert.strictEqual(after.businessName, 'Updated Gym');
    } finally {
      RealtimeService.setCustomDatabase(null);
      await db.close();
    }
  });
});
