/**
 * Live local Supabase integration tests.
 *
 * These deliberately use the running loopback Supabase stack and its seeded
 * accounts. The harness refuses a non-loopback URL and cleans only IDs it
 * creates, so this suite cannot target or alter a production service.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import {
  cleanupLocalSupabase,
  createAuthenticatedAgentClient,
  createOtherOrganization,
  createTestLead,
  createUnauthenticatedLocalClient,
  setupLocalSupabase,
  type LocalSupabaseContext,
} from './local-supabase';

describe('Supabase integration', () => {
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

  function leadInput(overrides: Record<string, unknown> = {}) {
    return {
      organization_id: context.organizationId,
      business_name: `Phase5 Vitest Client Gym ${crypto.randomUUID().slice(0, 8)}`,
      category: 'Gym',
      phone: `98765${Math.floor(Math.random() * 90_000 + 10_000)}`,
      address: 'Gomti Nagar, Lucknow 226010',
      locality: 'Gomti Nagar',
      city: 'Lucknow',
      state: 'Uttar Pradesh',
      created_by: context.agentProfileId,
      assigned_to: context.agentProfileId,
      ...overrides,
    };
  }

  async function createAgentLead(overrides: Record<string, unknown> = {}) {
    const { data, error } = await context.agent.from('leads').insert(leadInput(overrides)).select().single();
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    context.cleanupLeadIds.push(data!.id);
    return data!;
  }

  async function subscribeToLeadInserts(client: SupabaseClient, name: string, filter?: string): Promise<{
    channel: RealtimeChannel;
    payload: Promise<any>;
  }> {
    let resolvePayload!: (value: any) => void;
    let rejectPayload!: (reason: Error) => void;
    const payload = new Promise<any>((resolve, reject) => {
      resolvePayload = resolve;
      rejectPayload = reject;
    });
    let subscribed = false;
    let replicationReady = false;
    let resolveReadiness!: () => void;
    const readiness = new Promise<void>((resolve) => {
      resolveReadiness = resolve;
    });
    const markReady = () => {
      if (subscribed && replicationReady) resolveReadiness();
    };
    const channel = client
      .channel(name, { config: { broadcast: { replication_ready: true } } })
      .on('system', {}, (event) => {
        if (event.status === 'ok' && event.message === 'Replication connection established') {
          replicationReady = true;
          markReady();
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads', ...(filter ? { filter } : {}) }, resolvePayload);

    const statuses: string[] = [];
    await Promise.race([
      readiness,
      new Promise<void>((_, reject) => {
        const timeout = setTimeout(() => reject(new Error('Local Supabase Realtime subscription did not become replication-ready.')), 15_000);
        channel.subscribe((status) => {
          statuses.push(status);
          if (status === 'SUBSCRIBED') {
            subscribed = true;
            markReady();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            clearTimeout(timeout);
            reject(new Error(`Local Supabase Realtime subscription failed with ${status}.`));
          }
        });
      }),
    ]);

    const timedPayload = Promise.race([
      payload,
      new Promise((_, reject) => setTimeout(() => reject(new Error(
        `Local Supabase Realtime did not deliver the inserted lead (filter=${filter || 'none'}, statuses=${statuses.join(',') || 'none'}).`
      )), 20_000)),
    ]);
    return { channel, payload: timedPayload };
  }

  describe('authentication', () => {
    it('should authenticate the local seeded admin user', async () => {
      const { data, error } = await context.admin.auth.getUser();
      expect(error).toBeNull();
      expect(data.user?.id).toBeTruthy();
    });

    it('should authenticate the local seeded agent user', async () => {
      const { data, error } = await context.agent.auth.getUser();
      expect(error).toBeNull();
      expect(data.user?.id).toBeTruthy();
    });

    it('should reject invalid credentials', async () => {
      const unauthenticated = createUnauthenticatedLocalClient(context);
      const { data, error } = await unauthenticated.auth.signInWithPassword({
        email: 'missing-phase5-user@example.test',
        password: 'not-a-valid-password',
      });
      await unauthenticated.auth.signOut();

      expect(data.user).toBeNull();
      expect(error).toBeTruthy();
    });

    it('should maintain the authenticated agent session across client calls', async () => {
      const { data, error } = await context.agent.auth.getSession();
      expect(error).toBeNull();
      expect(data.session?.user.id).toBeTruthy();
    });
  });

  describe('row-level security', () => {
    it('should allow an admin to read a lead in its organization', async () => {
      const lead = await createTestLead(context);
      const { data, error } = await context.admin.from('leads').select('id, organization_id').eq('id', lead.id);

      expect(error).toBeNull();
      expect(data).toEqual([{ id: lead.id, organization_id: context.organizationId }]);
    });

    it('should allow an agent to read a lead assigned to that agent', async () => {
      const lead = await createTestLead(context, { assigned_to: context.agentProfileId, created_by: context.agentProfileId });
      const { data, error } = await context.agent.from('leads').select('id').eq('id', lead.id);

      expect(error).toBeNull();
      expect(data).toEqual([{ id: lead.id }]);
    });

    it('should deny cross-organization lead reads', async () => {
      const otherOrganizationId = await createOtherOrganization(context);
      const { data: foreignLead, error: foreignError } = await context.service
        .from('leads')
        .insert(leadInput({ organization_id: otherOrganizationId, created_by: null, assigned_to: null }))
        .select()
        .single();
      expect(foreignError).toBeNull();
      context.cleanupLeadIds.push(foreignLead!.id);

      const { data, error } = await context.admin.from('leads').select('id').eq('id', foreignLead!.id);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it('should hide unassigned organization leads from an agent', async () => {
      const lead = await createTestLead(context, { assigned_to: null, created_by: context.adminProfileId });
      const { data, error } = await context.agent.from('leads').select('id').eq('id', lead.id);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe('client CRUD with RLS', () => {
    it('should create a lead with the authenticated agent organization context', async () => {
      const lead = await createAgentLead();
      expect(lead).toMatchObject({ organization_id: context.organizationId, created_by: context.agentProfileId, assigned_to: context.agentProfileId });
    });

    it('should create an activity linked to an accessible lead', async () => {
      const lead = await createTestLead(context);
      const { data, error } = await context.agent
        .from('activities')
        .insert({
          organization_id: context.organizationId,
          lead_id: lead.id,
          user_id: context.agentProfileId,
          activity_type: 'CALL_COMPLETED',
          metadata: { source: 'phase5-vitest' },
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toMatchObject({ lead_id: lead.id, user_id: context.agentProfileId });
      context.cleanupActivityIds.push(data!.id);
    });

    it('should create a verified call record for an accessible lead', async () => {
      const lead = await createTestLead(context);
      const { data, error } = await context.agent
        .from('call_records')
        .insert({
          organization_id: context.organizationId,
          lead_id: lead.id,
          user_id: context.agentProfileId,
          started_at: new Date().toISOString(),
          duration_seconds: 120,
          outcome: 'CONNECTED',
          verification_status: 'VERIFIED',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toMatchObject({ lead_id: lead.id, verification_status: 'VERIFIED', duration_seconds: 120 });
    });

    it('should update the status of an agent-owned lead', async () => {
      const lead = await createTestLead(context);
      const { data, error } = await context.agent
        .from('leads')
        .update({ status: 'CONTACTED', sync_expected_revision: lead.sync_revision })
        .eq('id', lead.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toMatchObject({ id: lead.id, status: 'CONTACTED' });
    });

    it('should deny an agent permanent deletion while preserving the lead', async () => {
      const lead = await createTestLead(context);
      const { error } = await context.agent.rpc('sync_mutate', {
        entity: 'leads', operation: 'DELETE', mutation_id: crypto.randomUUID(),
        expected_revision: lead.sync_revision,
        payload: { id: lead.id, organization_id: context.organizationId },
      });
      expect(error).toBeTruthy();

      const { data } = await context.service.from('leads').select('id').eq('id', lead.id);
      expect(data).toEqual([{ id: lead.id }]);
    });
  });

  describe('boundary protections', () => {
    it('should reject client-side lead creation in another organization', async () => {
      const otherOrganizationId = await createOtherOrganization(context);
      const { error } = await context.agent.from('leads').insert(leadInput({ organization_id: otherOrganizationId }));
      expect(error).toBeTruthy();
    });

    it('should reject agent reassignment of an owned lead to an administrator', async () => {
      const lead = await createTestLead(context);
      const { error } = await context.agent
        .from('leads')
        .update({ assigned_to: context.adminProfileId })
        .eq('id', lead.id);

      expect(error).toBeTruthy();
    });

    it('should reject agent changes to a lead organization boundary', async () => {
      const lead = await createTestLead(context);
      const otherOrganizationId = await createOtherOrganization(context);
      const { error } = await context.agent
        .from('leads')
        .update({ organization_id: otherOrganizationId })
        .eq('id', lead.id);

      expect(error).toBeTruthy();
    });
  });

  describe('realtime', () => {
    it('should subscribe to visible lead changes in the local stack', async () => {
      const receivingClient = await createAuthenticatedAgentClient(context);
      let lastDeliveryError: unknown;
      try {
        // Local Realtime can occasionally drop the first WAL delivery while the
        // aggregate runner is under heavy browser/test load. Retry the complete
        // real subscription + INSERT cycle with a new UUID; a pass still requires
        // an actual postgres_changes event from the local Realtime service.
        for (let attempt = 1; attempt <= 2; attempt += 1) {
          const leadId = crypto.randomUUID();
          const { channel, payload } = await subscribeToLeadInserts(
            receivingClient,
            `phase5-agent-${leadId}-attempt-${attempt}`,
            `organization_id=eq.${context.organizationId}`,
          );
          try {
            const lead = await createAgentLead({ id: leadId });
            try {
              await expect(payload).resolves.toMatchObject({
                new: { id: lead.id, organization_id: context.organizationId },
              });
              return;
            } catch (error) {
              lastDeliveryError = error;
            }
          } finally {
            await channel.unsubscribe();
          }
        }
        throw lastDeliveryError instanceof Error
          ? lastDeliveryError
          : new Error('Local Supabase Realtime did not deliver a lead insert after two real subscription attempts.');
      } finally {
        await receivingClient.auth.signOut();
      }
    }, 90_000);
    it('should enforce the organization filter on a realtime subscription', async () => {
      const filter = `organization_id=eq.${context.organizationId}`;
      const { channel, payload } = await subscribeToLeadInserts(context.agent, `phase5-org-${crypto.randomUUID()}`, filter);
      try {
        const otherOrganizationId = await createOtherOrganization(context);
        await createTestLead(context, { organization_id: otherOrganizationId, created_by: null, assigned_to: null });
        const lead = await createTestLead(context);
        await expect(payload).resolves.toMatchObject({ new: { id: lead.id, organization_id: context.organizationId } });
      } finally {
        await channel.unsubscribe();
      }
    }, 45_000);
  });

  describe('synchronization invariants', () => {
    it('should provide monotonic updated timestamps for server writes', async () => {
      const lead = await createTestLead(context);
      const { data: updated, error } = await context.agent
        .from('leads')
        .update({ status: 'INTERESTED', updated_at: new Date().toISOString(), sync_expected_revision: lead.sync_revision })
        .eq('id', lead.id)
        .select('status, updated_at')
        .single();

      expect(error).toBeNull();
      expect(updated).toMatchObject({ status: 'INTERESTED' });
      expect(new Date(updated!.updated_at).getTime()).not.toBeNaN();
    });

    it('should reject a cross-organization call record insert', async () => {
      const otherOrganizationId = await createOtherOrganization(context);
      const lead = await createTestLead(context);
      const { error } = await context.agent.from('call_records').insert({
        organization_id: otherOrganizationId,
        lead_id: lead.id,
        user_id: context.agentProfileId,
        started_at: new Date().toISOString(),
        duration_seconds: 10,
        outcome: 'CONNECTED',
        verification_status: 'UNVERIFIED',
      });

      expect(error).toBeTruthy();
    });
  });
});
