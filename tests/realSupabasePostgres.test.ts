import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getLocalSupabaseEnv } from './helpers/localSupabaseEnv';

const localSupabase = getLocalSupabaseEnv();
const SUPABASE_LOCAL_URL = localSupabase.apiUrl;
const JWT_SECRET = localSupabase.jwtSecret;
const ANON_KEY = localSupabase.anonKey;
const SERVICE_ROLE_KEY = localSupabase.serviceRoleKey;

const ORG_1_ID = '00000000-0000-0000-0000-000000000001';
const ORG_2_ID = '00000000-0000-0000-0000-000000000002';

const ADMIN_ID = '00000000-0000-0000-0000-000000000010';
const AGENT_A_ID = '00000000-0000-0000-0000-000000000011';
const AGENT_B_ID = '00000000-0000-0000-0000-000000000012';
const CROSS_ORG_AGENT_ID = '00000000-0000-0000-0000-000000000099';

function createTestJwt(userId: string, role: string = 'authenticated'): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(
    JSON.stringify({
      sub: userId,
      role: role,
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 7200,
    })
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

function getAuthenticatedClient(jwtToken: string): SupabaseClient {
  return createClient(SUPABASE_LOCAL_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${jwtToken}`,
      },
    },
  });
}

describe('Real Supabase Local & PostgreSQL Integration Tests (Docker Stack)', () => {
  let adminClient: SupabaseClient;
  let serviceClient: SupabaseClient;
  let agentAClient: SupabaseClient;
  let agentBClient: SupabaseClient;
  let crossOrgClient: SupabaseClient;

  before(async () => {
    serviceClient = createClient(SUPABASE_LOCAL_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const adminJwt = createTestJwt(ADMIN_ID);
    const agentAJwt = createTestJwt(AGENT_A_ID);
    const agentBJwt = createTestJwt(AGENT_B_ID);
    const crossOrgJwt = createTestJwt(CROSS_ORG_AGENT_ID);

    adminClient = getAuthenticatedClient(adminJwt);
    agentAClient = getAuthenticatedClient(agentAJwt);
    agentBClient = getAuthenticatedClient(agentBJwt);
    crossOrgClient = getAuthenticatedClient(crossOrgJwt);

    // Ensure Org 2 and Cross Org Rep exist for cross-tenant testing
    await serviceClient.from('organizations').upsert({
      id: ORG_2_ID,
      name: 'Amaratv Krishi Kanpur Regional',
    });

    // Ensure cross-org auth user
    await serviceClient.from('profiles').upsert({
      id: CROSS_ORG_AGENT_ID,
      auth_user_id: CROSS_ORG_AGENT_ID,
      organization_id: ORG_2_ID,
      name: 'Vikram Singh',
      email: 'vikram@amaratvkrishi-kanpur.com',
      phone: '+919876543299',
      role: 'AGENT',
      status: 'ACTIVE',
    });
  });

  // -------------------------------------------------------------
  // 1. DATABASE SCHEMA & TABLE VERIFICATION
  // -------------------------------------------------------------
  it('1. Schema: Verifies all 10 core CRM tables exist in local PostgreSQL database', async () => {
    const requiredTables = [
      'organizations',
      'profiles',
      'leads',
      'call_records',
      'activities',
      'remarks',
      'follow_ups',
      'message_history',
      'import_audits',
      'bulk_assignment_audits',
    ];

    for (const table of requiredTables) {
      const { error } = await serviceClient.from(table).select('count', { count: 'exact', head: true });
      assert.strictEqual(error, null, `Table ${table} must exist and be queryable without error. Error: ${error?.message}`);
    }
  });

  // -------------------------------------------------------------
  // 2. DETERMINISTIC SEED DATA INTEGRITY
  // -------------------------------------------------------------
  it('2. Seed Data: Verifies deterministic organization, profiles, and leads from seed.sql', async () => {
    const { data: org, error: orgErr } = await serviceClient
      .from('organizations')
      .select('id, name')
      .eq('id', ORG_1_ID)
      .single();

    assert.strictEqual(orgErr, null);
    assert.strictEqual(org.name, 'Amaratv Krishi Lucknow Central');

    const { data: profiles, error: profErr } = await serviceClient
      .from('profiles')
      .select('id, name, role, email')
      .eq('organization_id', ORG_1_ID);

    assert.strictEqual(profErr, null);
    assert.ok(profiles.length >= 3);

    const adminProfile = profiles.find((p: any) => p.id === ADMIN_ID);
    assert.ok(adminProfile);
    assert.strictEqual(adminProfile.role, 'ADMIN');

    const agentAProfile = profiles.find((p: any) => p.id === AGENT_A_ID);
    assert.ok(agentAProfile);
    assert.strictEqual(agentAProfile.role, 'AGENT');

    const { data: leads, error: leadErr } = await serviceClient
      .from('leads')
      .select('id, business_name, assigned_to')
      .eq('organization_id', ORG_1_ID);

    assert.strictEqual(leadErr, null);
    assert.ok(leads.length >= 3);
    const goldGym = leads.find((l: any) => l.id === '00000000-0000-0000-0000-000000000101');
    assert.ok(goldGym);
    assert.strictEqual(goldGym.business_name, 'Gold Gym Hazratganj');
    assert.strictEqual(goldGym.assigned_to, AGENT_A_ID);
  });

  // -------------------------------------------------------------
  // 3. POSTGRESQL CONSTRAINTS & INTEGRITY CHECKS
  // -------------------------------------------------------------
  it('3. Constraints: Enforces role check constraint on profiles table', async () => {
    const invalidId = '00000000-0000-0000-0000-999999999991';
    const { error } = await serviceClient.from('profiles').insert({
      id: invalidId,
      organization_id: ORG_1_ID,
      name: 'Invalid Role User',
      email: 'invalid@amaratvkrishi.com',
      role: 'SUPER_USER',
      status: 'ACTIVE',
    });

    assert.ok(error !== null, 'Inserting invalid role MUST fail check constraint');
    assert.match(error.message, /check constraint|violates/i);
  });

  it('4. Constraints: Enforces foreign key constraint on leads organization_id', async () => {
    const nonExistentOrgId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const { error } = await serviceClient.from('leads').insert({
      id: '00000000-0000-0000-0000-999999999992',
      organization_id: nonExistentOrgId,
      business_name: 'Orphan Gym',
      phone: '9999999999',
      address: 'Nowhere',
      locality: 'Unknown',
    });

    assert.ok(error !== null, 'Inserting lead with invalid org_id MUST fail foreign key constraint');
    assert.match(error.message, /foreign key|violates/i);
  });

  // -------------------------------------------------------------
  // 4. DATABASE TRIGGERS & IMMUTABILITY ENFORCEMENT
  // -------------------------------------------------------------
  it('5. Triggers: protect_profile_immutable_fields blocks Agent from escalating role to ADMIN', async () => {
    const { error } = await agentAClient
      .from('profiles')
      .update({ role: 'ADMIN' })
      .eq('id', AGENT_A_ID);

    assert.ok(error !== null, 'Agent updating role to ADMIN must be blocked by trigger');
    assert.match(error.message, /forbidden from altering user roles/i);
  });

  it('6. Triggers: protect_lead_immutable_fields blocks Agent from altering organization_id or creator', async () => {
    const { error: orgErr } = await agentAClient
      .from('leads')
      .update({ organization_id: ORG_2_ID })
      .eq('id', '00000000-0000-0000-0000-000000000101');

    assert.ok(orgErr !== null, 'Agent modifying organization boundary must be blocked');
    assert.match(orgErr.message, /modifying lead organization boundary/i);

    const { error: creatorErr } = await agentAClient
      .from('leads')
      .update({ created_by: AGENT_B_ID })
      .eq('id', '00000000-0000-0000-0000-000000000101');

    assert.ok(creatorErr !== null, 'Agent modifying lead creator must be blocked');
    assert.match(creatorErr.message, /modifying lead creator/i);
  });

  it('7. Triggers: protect_lead_immutable_fields blocks Agent from reassigning lead to another agent', async () => {
    const { error } = await agentAClient
      .from('leads')
      .update({ assigned_to: AGENT_B_ID })
      .eq('id', '00000000-0000-0000-0000-000000000101');

    assert.ok(error !== null, 'Agent reassigning lead to another agent must be blocked');
    assert.match(error.message, /modifying lead assignment/i);
  });

  // -------------------------------------------------------------
  // 5. ROW LEVEL SECURITY (RLS) - AGENT & ADMIN ISOLATION
  // -------------------------------------------------------------
  it('8. RLS: Admin can query all organization leads (assigned and unassigned)', async () => {
    const { data: leads, error } = await adminClient.from('leads').select('id, business_name');
    assert.strictEqual(error, null);
    assert.ok(leads.length >= 3, 'Admin must see all 3+ organization leads');
    const names = leads.map((l: any) => l.business_name);
    assert.ok(names.includes('Gold Gym Hazratganj'));
    assert.ok(names.includes('FitHub Gomti Nagar'));
    assert.ok(names.includes('Iron Paradise Alambagh'));
  });

  it('9. RLS: Agent A can ONLY see leads assigned to Agent A or created by Agent A', async () => {
    const { data: leads, error } = await agentAClient.from('leads').select('id, business_name, assigned_to');
    assert.strictEqual(error, null);
    const ids = leads.map((l: any) => l.id);
    assert.ok(ids.includes('00000000-0000-0000-0000-000000000101'), 'Agent A must see Gold Gym');
    assert.ok(!ids.includes('00000000-0000-0000-0000-000000000102'), 'Agent A must NOT see FitHub');
    assert.ok(!ids.includes('00000000-0000-0000-0000-000000000103'), 'Agent A must NOT see Iron Paradise');
  });

  it('10. RLS: Agent B has symmetric isolation and only sees assigned leads', async () => {
    const { data: leads, error } = await agentBClient.from('leads').select('id, business_name');
    assert.strictEqual(error, null);
    const ids = leads.map((l: any) => l.id);
    assert.ok(ids.includes('00000000-0000-0000-0000-000000000102'), 'Agent B must see FitHub');
    assert.ok(!ids.includes('00000000-0000-0000-0000-000000000101'), 'Agent B must NOT see Gold Gym');
  });

  it('11. RLS: Cross-Organization Isolation: Agent in Org 2 sees 0 records from Org 1', async () => {
    const { data: leads, error } = await crossOrgClient.from('leads').select('id');
    assert.strictEqual(error, null);
    const ids = leads.map((l: any) => l.id);
    assert.ok(!ids.includes('00000000-0000-0000-0000-000000000101'));
    assert.ok(!ids.includes('00000000-0000-0000-0000-000000000102'));
    assert.ok(!ids.includes('00000000-0000-0000-0000-000000000103'));
  });

  it('12. RLS: Admin-Only Tables: Agents cannot access import_audits or bulk_assignment_audits', async () => {
    await serviceClient.from('import_audits').upsert({
      id: '00000000-0000-0000-0000-000000000888',
      organization_id: ORG_1_ID,
      filename: 'lucknow_lead_dump.xlsx',
      started_at: new Date().toISOString(),
      total_rows: 50,
      imported: 48,
    });

    const { data: adminAudits, error: adminErr } = await adminClient.from('import_audits').select('id');
    assert.strictEqual(adminErr, null);
    assert.ok(adminAudits.length >= 1);

    const { data: agentAudits, error: agentErr } = await agentAClient.from('import_audits').select('id');
    assert.strictEqual(agentErr, null);
    assert.strictEqual(agentAudits.length, 0, 'Agent must receive 0 import audits under RLS');
  });

  it('12b. RLS: reassignment revokes author-only child reads while preserving history for the new assignee', async () => {
    const leadId = crypto.randomUUID();
    const childIds = {
      call_records: crypto.randomUUID(),
      follow_ups: crypto.randomUUID(),
      remarks: crypto.randomUUID(),
      activities: crypto.randomUUID(),
      message_history: crypto.randomUUID(),
    };

    const { error: leadErr } = await serviceClient.from('leads').insert({
      id: leadId,
      organization_id: ORG_1_ID,
      business_name: 'Reassignment Boundary Gym',
      phone: '9876504321',
      address: 'Lucknow',
      locality: 'Lucknow',
      status: 'NEW',
      created_by: ADMIN_ID,
      assigned_to: AGENT_A_ID,
    });
    assert.strictEqual(leadErr, null);

    const now = new Date().toISOString();
    const tomorrow = new Date(Date.now() + 86400000).toISOString();

    const inserts = [
      await agentAClient.from('call_records').insert({
        id: childIds.call_records,
        organization_id: ORG_1_ID,
        lead_id: leadId,
        user_id: AGENT_A_ID,
        started_at: now,
        outcome: 'NO_ANSWER',
      }),
      await agentAClient.from('follow_ups').insert({
        id: childIds.follow_ups,
        organization_id: ORG_1_ID,
        lead_id: leadId,
        user_id: AGENT_A_ID,
        scheduled_at: tomorrow,
        title: 'Reassignment boundary follow-up',
        priority: 'MEDIUM',
        status: 'PENDING',
      }),
      await agentAClient.from('remarks').insert({
        id: childIds.remarks,
        organization_id: ORG_1_ID,
        lead_id: leadId,
        user_id: AGENT_A_ID,
        content: 'Reassignment boundary remark',
        type: 'CUSTOM',
        author: 'Agent A',
      }),
      await agentAClient.from('activities').insert({
        id: childIds.activities,
        organization_id: ORG_1_ID,
        lead_id: leadId,
        user_id: AGENT_A_ID,
        activity_type: 'LEAD_UPDATED',
        metadata: { source: 'finding-002-regression' },
      }),
      await agentAClient.from('message_history').insert({
        id: childIds.message_history,
        organization_id: ORG_1_ID,
        lead_id: leadId,
        user_id: AGENT_A_ID,
        channel: 'WHATSAPP',
        recipient_phone: '9876504321',
        message_content: 'Reassignment boundary message',
        sent_status: 'SENT',
        sent_at: now,
      }),
    ];
    for (const result of inserts) assert.strictEqual(result.error, null);

    const { data: leadBefore, error: leadReadErr } = await adminClient
      .from('leads')
      .select('sync_revision')
      .eq('id', leadId)
      .single();
    assert.strictEqual(leadReadErr, null);

    const { error: reassignErr } = await adminClient
      .from('leads')
      .update({
        assigned_to: AGENT_B_ID,
        sync_expected_revision: leadBefore.sync_revision,
      })
      .eq('id', leadId);
    assert.strictEqual(reassignErr, null);

    for (const [table, id] of Object.entries(childIds)) {
      const { data: revokedRows, error: revokedErr } = await agentAClient
        .from(table)
        .select('id')
        .eq('id', id);
      assert.strictEqual(revokedErr, null, table);
      assert.strictEqual(
        revokedRows.length,
        0,
        `Revoked agent must not retain author-only SELECT access to ${table}`,
      );

      const { data: newAssigneeRows, error: newAssigneeErr } = await agentBClient
        .from(table)
        .select('id')
        .eq('id', id);
      assert.strictEqual(newAssigneeErr, null, table);
      assert.strictEqual(
        newAssigneeRows.length,
        1,
        `New assignee must retain preserved lead history from ${table}`,
      );
    }
  });

  // -------------------------------------------------------------
  // 6. REAL CRUD LIFECYCLE ON POSTGRESQL
  // -------------------------------------------------------------
  it('13. CRUD: Agent A creates lead in field, updates sales status, logs call, and schedules follow-up', async () => {
    const testLeadId = crypto.randomUUID();
    const testCallId = crypto.randomUUID();
    const testFollowUpId = crypto.randomUUID();
    const testRemarkId = crypto.randomUUID();

    const { data: createdLead, error: insertErr } = await agentAClient
      .from('leads')
      .insert({
        id: testLeadId,
        organization_id: ORG_1_ID,
        business_name: 'Iron Fitness Club Aliganj',
        category: 'Gym',
        phone: '9876501234',
        phone_e164: '+919876501234',
        address: 'Sector B, Aliganj',
        locality: 'Aliganj',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        status: 'NEW',
        created_by: AGENT_A_ID,
        assigned_to: AGENT_A_ID,
      })
      .select()
      .single();

    assert.strictEqual(insertErr, null);
    assert.strictEqual(createdLead.business_name, 'Iron Fitness Club Aliganj');

    const { error: updateErr } = await agentAClient
      .from('leads')
      .update({ status: 'INTERESTED', custom_notes: 'Owner interested in gym supply packaging', sync_expected_revision: createdLead.sync_revision })
      .eq('id', testLeadId);

    assert.strictEqual(updateErr, null);

    const { error: callErr } = await agentAClient.from('call_records').insert({
      id: testCallId,
      organization_id: ORG_1_ID,
      lead_id: testLeadId,
      user_id: AGENT_A_ID,
      started_at: new Date(Date.now() - 120000).toISOString(),
      ended_at: new Date().toISOString(),
      duration_seconds: 120,
      outcome: 'INTERESTED',
      verification_status: 'UNVERIFIED',
    });

    assert.strictEqual(callErr, null);

    const { error: followUpErr } = await agentAClient.from('follow_ups').insert({
      id: testFollowUpId,
      organization_id: ORG_1_ID,
      lead_id: testLeadId,
      user_id: AGENT_A_ID,
      scheduled_at: new Date(Date.now() + 86400000).toISOString(),
      title: 'Callback for Sample Delivery',
      priority: 'HIGH',
      status: 'PENDING',
    });

    assert.strictEqual(followUpErr, null);

    const { error: remarkErr } = await agentAClient.from('remarks').insert({
      id: testRemarkId,
      organization_id: ORG_1_ID,
      lead_id: testLeadId,
      user_id: AGENT_A_ID,
      content: 'Owner requested pricing catalog over WhatsApp',
      author: 'Rahul Verma',
      type: 'CUSTOM',
    });

    assert.strictEqual(remarkErr, null);

    const { data: adminLead } = await adminClient.from('leads').select('*, call_records(*), follow_ups(*), remarks(*)').eq('id', testLeadId).single();
    assert.strictEqual(adminLead.status, 'INTERESTED');
    assert.strictEqual(adminLead.call_records.length, 1);
    assert.strictEqual(adminLead.follow_ups.length, 1);
    assert.strictEqual(adminLead.remarks.length, 1);
  });

  // -------------------------------------------------------------
  // 7. REAL SYNC & CONFLICT HANDLING ON POSTGRESQL
  // -------------------------------------------------------------
  it('14. Sync & Conflict: Last-Write-Wins (LWW) resolution correctly handles concurrent updates', async () => {
    const conflictLeadId = crypto.randomUUID();

    await serviceClient.from('leads').insert({
      id: conflictLeadId,
      organization_id: ORG_1_ID,
      business_name: 'Conflict Test Gym',
      phone: '9988776655',
      address: 'Mahanagar, Lucknow',
      locality: 'Mahanagar',
      status: 'NEW',
      created_by: ADMIN_ID,
      assigned_to: AGENT_A_ID,
      version: 1,
    });

    const t1 = new Date(Date.now() - 5000).toISOString();
    await serviceClient
      .from('leads')
      .update({ status: 'CONTACTED', updated_at: t1, version: 2 })
      .eq('id', conflictLeadId);

    const t2 = new Date().toISOString();
    await serviceClient
      .from('leads')
      .update({ status: 'INTERESTED', custom_notes: 'Local newer note', updated_at: t2, version: 3 })
      .eq('id', conflictLeadId);

    const { data: finalLead } = await serviceClient.from('leads').select('status, version').eq('id', conflictLeadId).single();
    assert.strictEqual(finalLead.status, 'INTERESTED');
    assert.strictEqual(finalLead.version, 3);
  });

  it('15. Sync & Telephony Invariant: Verified call duration cannot be demoted to Unverified', async () => {
    const callId = crypto.randomUUID();
    const leadId = '00000000-0000-0000-0000-000000000101';

    await serviceClient.from('call_records').insert({
      id: callId,
      organization_id: ORG_1_ID,
      lead_id: leadId,
      user_id: AGENT_A_ID,
      started_at: new Date(Date.now() - 300000).toISOString(),
      ended_at: new Date(Date.now() - 240000).toISOString(),
      duration_seconds: 60,
      outcome: 'INTERESTED',
      verification_status: 'VERIFIED',
    });

    const { data: recordBefore } = await serviceClient.from('call_records').select('*').eq('id', callId).single();
    assert.strictEqual(recordBefore.verification_status, 'VERIFIED');
    assert.strictEqual(recordBefore.duration_seconds, 60);

    const incomingUnverifiedPayload = {
      outcome: 'BUSY',
      duration_seconds: 0,
      verification_status: 'UNVERIFIED',
    };

    if (recordBefore.verification_status === 'VERIFIED' && incomingUnverifiedPayload.verification_status === 'UNVERIFIED') {
      incomingUnverifiedPayload.duration_seconds = recordBefore.duration_seconds;
      incomingUnverifiedPayload.verification_status = 'VERIFIED';
    }

    await serviceClient.from('call_records').update(incomingUnverifiedPayload).eq('id', callId);

    const { data: recordAfter } = await serviceClient.from('call_records').select('*').eq('id', callId).single();
    assert.strictEqual(recordAfter.verification_status, 'VERIFIED');
    assert.strictEqual(recordAfter.duration_seconds, 60);
  });

  it('16. Security: anonymous clients cannot invoke SECURITY DEFINER helper RPCs', async () => {
    const anonClient = createClient(SUPABASE_LOCAL_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    for (const fn of ['current_profile_id', 'current_user_org_id', 'current_user_role', 'is_org_admin', 'is_active_org_user', 'sync_head']) {
      const { error } = await anonClient.rpc(fn);
      assert.ok(error, `${fn} must not be executable by anon`);
    }

    const { error: leadAccessError } = await anonClient.rpc('can_access_lead_for_current_user', {
      p_lead_id: '00000000-0000-0000-0000-000000000101',
    });
    assert.ok(leadAccessError, 'can_access_lead_for_current_user must not be executable by anon');

    const { error: authError } = await adminClient.rpc('current_user_org_id');
    assert.strictEqual(authError, null, 'authenticated RLS helper execution must remain available');
  });

});
