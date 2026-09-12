import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  cleanupLocalSupabase,
  createOtherOrganization,
  createTestLead,
  setupLocalSupabase,
  type LocalSupabaseContext,
} from './local-supabase';

describe('F047 authenticated child-record parent-lead authorization', () => {
  let context: LocalSupabaseContext;

  beforeAll(async () => {
    context = await setupLocalSupabase();
  }, 30_000);

  afterEach(async () => {
    await cleanupLocalSupabase(context);
  });

  afterAll(async () => {
    if (!context) return;
    await context.admin.auth.signOut();
    await context.agent.auth.signOut();
  });

  async function createOtherOrgLead(organizationId: string) {
    const { data, error } = await context.service
      .from('leads')
      .insert({
        organization_id: organizationId,
        business_name: `F047 Other Org ${crypto.randomUUID().slice(0, 8)}`,
        category: 'Gym',
        phone: `98765${Math.floor(Math.random() * 90_000 + 10_000)}`,
        address: 'Other organization fixture',
        locality: 'Other',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        created_by: null,
        assigned_to: null,
      })
      .select('id')
      .single();
    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    context.cleanupLeadIds.push(data!.id);
    return data!.id;
  }

  function childPayload(table: string, leadId: string, organizationId = context.organizationId) {
    const id = crypto.randomUUID();
    const base = {
      id,
      organization_id: organizationId,
      lead_id: leadId,
      user_id: context.agentProfileId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (table === 'call_records') {
      return { ...base, started_at: new Date().toISOString(), outcome: 'NO_ANSWER', duration_seconds: 0 };
    }
    if (table === 'activities') return { ...base, activity_type: 'LEAD_UPDATED', metadata: {} };
    if (table === 'remarks') return { ...base, content: 'F047 fixture', type: 'CUSTOM', author: 'Agent' };
    if (table === 'follow_ups') {
      return { ...base, scheduled_at: new Date(Date.now() + 86_400_000).toISOString(), title: 'F047 fixture' };
    }
    return {
      ...base,
      channel: 'WHATSAPP',
      recipient_phone: '+919876543210',
      message_content: 'F047 fixture',
      sent_status: 'SENT',
      sent_at: new Date().toISOString(),
    };
  }

  it('enforces the same parent boundary for direct inserts and sync_mutate', async () => {
    const visibleLead = await createTestLead(context);
    const inaccessibleLead = await createTestLead(context, {
      created_by: context.adminProfileId,
      assigned_to: context.adminProfileId,
    });
    const otherOrganizationId = await createOtherOrganization(context);
    const crossOrganizationLead = await createOtherOrgLead(otherOrganizationId);

    for (const table of ['call_records', 'activities', 'remarks', 'follow_ups', 'message_history']) {
      const visible = await context.agent.from(table).insert(childPayload(table, visibleLead.id)).select('id').single();
      expect(visible.error, `${table} visible lead`).toBeNull();

      const inaccessible = await context.agent
        .from(table)
        .insert(childPayload(table, inaccessibleLead.id))
        .select('id')
        .single();
      expect(inaccessible.error, `${table} inaccessible lead`).toBeTruthy();

      const crossOrganization = await context.agent
        .from(table)
        .insert(childPayload(table, crossOrganizationLead, otherOrganizationId))
        .select('id')
        .single();
      expect(crossOrganization.error, `${table} cross-organization lead`).toBeTruthy();
    }

    const adminWrite = await context.admin
      .from('remarks')
      .insert({
        ...childPayload('remarks', inaccessibleLead.id),
        user_id: context.adminProfileId,
      })
      .select('id')
      .single();
    expect(adminWrite.error).toBeNull();

    const syncPayload = childPayload('call_records', inaccessibleLead.id);
    const deniedSync = await context.agent.rpc('sync_mutate', {
      entity: 'call_records',
      operation: 'CREATE',
      mutation_id: crypto.randomUUID(),
      expected_revision: 0,
      payload: syncPayload,
    });
    expect(deniedSync.error).toBeTruthy();

    const allowedSync = await context.agent.rpc('sync_mutate', {
      entity: 'call_records',
      operation: 'CREATE',
      mutation_id: crypto.randomUUID(),
      expected_revision: 0,
      payload: childPayload('call_records', visibleLead.id),
    });
    expect(allowedSync.error).toBeNull();
  }, 30_000);
});
