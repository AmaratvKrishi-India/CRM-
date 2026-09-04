import 'fake-indexeddb/auto';
import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../src/services/authService.ts';
import { AgentManagementService } from '../src/services/agentManagementService.ts';
import { setCustomSupabaseClient } from '../src/services/supabaseClient.ts';
import { activateCRMDataScope, crmData, lockCRMData } from '../src/db/index.ts';
import { SalesCRMDatabase } from '../src/db/database.ts';
import type { User } from '../src/db/types.ts';

const now = '2026-09-01T00:00:00.000Z';

function authClient(authUser: { id: string; email: string }, getProfile: () => any) {
  const query: any = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: getProfile(), error: null }),
  };
  return {
    auth: {
      getUser: async () => ({ data: { user: authUser }, error: null }),
      getSession: async () => ({ data: { session: { user: authUser } } }),
      signOut: async () => ({ error: null }),
    },
    from: () => query,
  } as any;
}

function remoteProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'profile-phase2',
    auth_user_id: 'auth-phase2',
    organization_id: 'org-phase2',
    name: 'Phase Two User',
    email: 'phase2@example.com',
    phone: '',
    role: 'ADMIN',
    status: 'ACTIVE',
    created_at: now,
    updated_at: now,
    deleted_at: null,
    ...overrides,
  };
}

const admin: User = {
  id: 'admin-provision',
  organizationId: 'org-provision',
  name: 'Provisioning Admin',
  email: 'admin@example.com',
  phone: '',
  role: 'ADMIN',
  status: 'ACTIVE',
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};

afterEach(async () => {
  AuthService.setCustomDatabase(null);
  AgentManagementService.setCustomDatabase(null);
  setCustomSupabaseClient(null);
  await lockCRMData();
});

describe('Phase 2 authoritative authentication', () => {
  it('applies a server role demotion and prunes records no longer visible to the agent', async () => {
    let profile = remoteProfile();
    setCustomSupabaseClient(authClient({ id: 'auth-phase2', email: 'phase2@example.com' }, () => profile));

    const first = await AuthService.validateAndLoadCurrentProfile();
    assert.equal(first.user?.role, 'ADMIN');
    await crmData.db.leads.add({
      id: 'admin-only-lead',
      organizationId: 'org-phase2',
      businessName: 'Admin Only Lead',
      phone: '9000000001',
      status: 'NEW',
      assignedTo: 'another-agent',
      createdBy: 'another-agent',
      updatedBy: 'another-agent',
      createdAt: now,
      updatedAt: now,
      isSynced: 1,
      deletedAt: null,
    });

    profile = remoteProfile({ role: 'AGENT' });
    const demoted = await AuthService.validateAndLoadCurrentProfile();

    assert.equal(demoted.user?.role, 'AGENT');
    assert.equal(crmData.db.accessScope?.role, 'AGENT');
    assert.equal(await crmData.db.leads.get('admin-only-lead'), undefined);
  });

  it('locks local data immediately when the server deactivates the profile', async () => {
    let profile = remoteProfile();
    setCustomSupabaseClient(authClient({ id: 'auth-phase2', email: 'phase2@example.com' }, () => profile));
    assert.ok((await AuthService.validateAndLoadCurrentProfile()).user);

    profile = remoteProfile({ status: 'INACTIVE' });
    const revoked = await AuthService.validateAndLoadCurrentProfile();

    assert.equal(revoked.user, null);
    assert.match(revoked.error || '', /revoked|inactive/i);
    assert.throws(() => crmData.db.requireAccessScope(), /locked/i);
  });

  it('rejects an unknown server role instead of coercing it to AGENT', async () => {
    setCustomSupabaseClient(
      authClient(
        { id: 'auth-phase2', email: 'phase2@example.com' },
        () => remoteProfile({ role: 'SUPERVISOR' })
      )
    );

    const result = await AuthService.validateAndLoadCurrentProfile();
    assert.equal(result.user, null);
    assert.match(result.error || '', /role|revoked/i);
    assert.throws(() => crmData.db.requireAccessScope(), /locked/i);
  });

  it('switches account partitions only after the new server profile is verified', async () => {
    setCustomSupabaseClient(
      authClient(
        { id: 'auth-account-a', email: 'a@example.com' },
        () => remoteProfile({
          id: 'account-a',
          auth_user_id: 'auth-account-a',
          organization_id: 'org-account-a',
          email: 'a@example.com',
        })
      )
    );
    assert.equal((await AuthService.validateAndLoadCurrentProfile()).user?.id, 'account-a');
    await crmData.db.leads.add({
      id: 'account-a-private',
      organizationId: 'org-account-a',
      businessName: 'Account A Private',
      phone: '9000000003',
      status: 'NEW',
      createdBy: 'account-a',
      updatedBy: 'account-a',
      createdAt: now,
      updatedAt: now,
      isSynced: 1,
      deletedAt: null,
    });

    setCustomSupabaseClient(
      authClient(
        { id: 'auth-account-b', email: 'b@example.com' },
        () => remoteProfile({
          id: 'account-b',
          auth_user_id: 'auth-account-b',
          organization_id: 'org-account-b',
          email: 'b@example.com',
        })
      )
    );
    const switched = await AuthService.validateAndLoadCurrentProfile();

    assert.equal(switched.user?.id, 'account-b');
    assert.equal(crmData.db.accessScope?.organizationId, 'org-account-b');
    assert.equal(await crmData.db.leads.get('account-a-private'), undefined);
  });

  it('locks the active local partition on logout even if the server sign-out fails', async () => {
    await activateCRMDataScope({
      organizationId: 'org-logout',
      userId: 'user-logout',
      role: 'AGENT',
    });
    setCustomSupabaseClient({
      auth: { signOut: async () => { throw new Error('network unavailable'); } },
    } as any);

    await AuthService.signOut();
    assert.throws(() => crmData.db.requireAccessScope(), /locked/i);
  });
});

describe('Phase 2 online-only agent provisioning', () => {
  async function setupDb(name: string) {
    const db = new SalesCRMDatabase(`Phase2Provision_${Date.now()}_${name}`, {
      organizationId: 'org-provision',
      userId: admin.id,
      role: 'ADMIN',
    });
    await db.open();
    await db.users.add(admin);
    AgentManagementService.setCustomDatabase(db);
    return db;
  }

  it('caches the exact server-created profile and its returned organization', async () => {
    const db = await setupDb('success');
    setCustomSupabaseClient({
      functions: {
        invoke: async () => ({
          error: null,
          data: {
            success: true,
            agent: {
              id: 'server-agent-1',
              organizationId: 'org-provision',
              name: 'Server Agent',
              email: 'server.agent@example.com',
              phone: '9000000002',
              role: 'AGENT',
              status: 'ACTIVE',
              createdBy: admin.id,
              createdAt: now,
            },
          },
        }),
      },
    } as any);

    const { agent } = await AgentManagementService.createAgent(admin, {
      name: 'Server Agent',
      email: 'server.agent@example.com',
      phone: '9000000002',
      password: 'secret123',
    });

    assert.equal(agent.id, 'server-agent-1');
    assert.equal(agent.organizationId, 'org-provision');
    assert.equal(agent.isSynced, 1);
    assert.equal(await db.outbox.where('entityType').equals('profiles').count(), 0);
    await db.close();
  });

  it('does not create a local profile when the provisioning server is unreachable', async () => {
    const db = await setupDb('offline');
    const fetchError = Object.assign(new Error('fetch failed'), { name: 'FunctionsFetchError' });
    setCustomSupabaseClient({
      functions: { invoke: async () => ({ data: null, error: fetchError }) },
    } as any);

    await assert.rejects(
      () => AgentManagementService.createAgent(admin, {
        name: 'Offline Agent',
        email: 'offline@example.com',
        password: 'secret123',
      }),
      /requires a working server connection|failed on the server/i
    );
    assert.equal(await db.users.where('email').equals('offline@example.com').count(), 0);
    await db.close();
  });

  it('rejects a server profile from another organization without caching it', async () => {
    const db = await setupDb('wrong-org');
    setCustomSupabaseClient({
      functions: {
        invoke: async () => ({
          error: null,
          data: {
            agent: {
              id: 'cross-org-agent',
              organizationId: 'other-org',
              name: 'Cross Org',
              email: 'cross@example.com',
              role: 'AGENT',
              status: 'ACTIVE',
              createdAt: now,
            },
          },
        }),
      },
    } as any);

    await assert.rejects(
      () => AgentManagementService.createAgent(admin, {
        name: 'Cross Org',
        email: 'cross@example.com',
        password: 'secret123',
      }),
      /another organization/i
    );
    assert.equal(await db.users.get('cross-org-agent'), undefined);
    await db.close();
  });
});
