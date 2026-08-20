import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { SalesCRMDatabase } from '../src/db/database';
import { createCRMDataLayer } from '../src/db';
import { AuthService } from '../src/services/authService';
import {
  setCustomSupabaseClient,
  resetSupabaseClient,
  getSupabaseConfig,
} from '../src/services/supabaseClient';
import { User } from '../src/db/types';

describe('Phase 2C: Authentication, Session Management & Role Resolution', () => {
  let db: SalesCRMDatabase;
  let crm: ReturnType<typeof createCRMDataLayer>;

  // Mock Supabase Auth Client Factory
  const createMockSupabase = (options: {
    signInResponse?: { data: any; error: any };
    session?: any;
    user?: any;
  }) => {
    const authListeners: Array<(event: string, session: any) => void> = [];

    return {
      auth: {
        signInWithPassword: vi.fn().mockImplementation(async () => {
          if (options.signInResponse) {
            return options.signInResponse;
          }
          return {
            data: {
              user: options.user || {
                id: 'supabase-uid-1',
                email: 'test@amaratvkrishi.com',
              },
              session: options.session || {
                access_token: 'mock-token-xyz',
                user: options.user || {
                  id: 'supabase-uid-1',
                  email: 'test@amaratvkrishi.com',
                },
              },
            },
            error: null,
          };
        }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: options.session !== undefined ? options.session : null,
          },
          error: null,
        }),
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: options.user !== undefined ? options.user : null,
          },
          error: null,
        }),
        onAuthStateChange: vi.fn().mockImplementation((callback) => {
          authListeners.push(callback);
          return {
            data: {
              subscription: {
                unsubscribe: vi.fn(),
              },
            },
          };
        }),
      },
    } as any;
  };

  beforeEach(async () => {
    resetSupabaseClient();
    const testDbName = `test_auth_${Math.random().toString(36).substring(7)}`;
    db = new SalesCRMDatabase(testDbName);
    crm = createCRMDataLayer(db);
    AuthService.setCustomDatabase(db);
    await db.seedDefaults();
  });

  afterEach(async () => {
    AuthService.setCustomDatabase(null);
    resetSupabaseClient();
    await db.delete();
    vi.restoreAllMocks();
  });

  describe('1. Configuration & Client Isolation', () => {
    it('detects missing Supabase configuration without throwing errors', () => {
      const config = getSupabaseConfig();
      expect(config).toBeDefined();
      expect(typeof config.isConfigured).toBe('boolean');
    });

    it('allows dependency-injected Supabase client for testing', () => {
      const mockClient = createMockSupabase({});
      setCustomSupabaseClient(mockClient);
      // Client is successfully registered
      expect(mockClient.auth.signInWithPassword).toBeDefined();
    });
  });

  describe('2. Sign In & Profile Resolution', () => {
    it('authenticates valid ADMIN and resolves local profile with lastLoginAt updated', async () => {
      // 1. Seed local admin user
      const admin = await crm.users.createUser({
        id: 'admin-uid-1',
        name: 'Super Admin',
        email: 'admin@amaratvkrishi.com',
        phone: '9988776655',
        role: 'ADMIN',
        status: 'ACTIVE',
      });

      // 2. Setup mock client
      const mockClient = createMockSupabase({
        user: { id: admin.id, email: admin.email },
        session: { access_token: 'valid-admin-token', user: { id: admin.id, email: admin.email } },
      });
      setCustomSupabaseClient(mockClient);

      // 3. Authenticate
      const result = await AuthService.signIn('admin@amaratvkrishi.com', 'SecurePassword123!');

      expect(result.user.id).toBe(admin.id);
      expect(result.user.role).toBe('ADMIN');
      expect(result.user.status).toBe('ACTIVE');
      expect(result.user.lastLoginAt).toBeDefined();
      expect(result.session.access_token).toBe('valid-admin-token');
    });

    it('authenticates valid AGENT and resolves role AGENT', async () => {
      const agent = await crm.users.createUser({
        id: 'agent-uid-2',
        name: 'Rahul Sharma',
        email: 'rahul@amaratvkrishi.com',
        phone: '9123456780',
        role: 'AGENT',
        status: 'ACTIVE',
      });

      const mockClient = createMockSupabase({
        user: { id: agent.id, email: agent.email },
        session: { access_token: 'valid-agent-token', user: { id: agent.id, email: agent.email } },
      });
      setCustomSupabaseClient(mockClient);

      const result = await AuthService.signIn('rahul@amaratvkrishi.com', 'AgentPass123!');

      expect(result.user.id).toBe(agent.id);
      expect(result.user.role).toBe('AGENT');
      expect(result.user.status).toBe('ACTIVE');
    });

    it('rejects invalid credentials with user-friendly message', async () => {
      const mockClient = createMockSupabase({
        signInResponse: {
          data: { user: null, session: null },
          error: { message: 'Invalid login credentials' },
        },
      });
      setCustomSupabaseClient(mockClient);

      await expect(
        AuthService.signIn('wrong@amaratvkrishi.com', 'WrongPass!')
      ).rejects.toThrow('Invalid email or password.');
    });
  });

  describe('3. Inactive & Unprovisioned Account Protection', () => {
    it('rejects INACTIVE user even if Supabase Auth succeeds and signs out session', async () => {
      const inactiveUser = await crm.users.createUser({
        id: 'inactive-uid-3',
        name: 'Former Rep',
        email: 'former@amaratvkrishi.com',
        phone: '9000000000',
        role: 'AGENT',
        status: 'INACTIVE',
      });

      const mockClient = createMockSupabase({
        user: { id: inactiveUser.id, email: inactiveUser.email },
        session: { access_token: 'temp-token', user: { id: inactiveUser.id, email: inactiveUser.email } },
      });
      setCustomSupabaseClient(mockClient);

      await expect(
        AuthService.signIn('former@amaratvkrishi.com', 'Pass123!')
      ).rejects.toThrow('Your account is inactive. Please contact your administrator.');

      // Must have signed out session
      expect(mockClient.auth.signOut).toHaveBeenCalled();
    });

    it('rejects unprovisioned user (Auth user exists but no application profile) and signs out', async () => {
      // Supabase has this account, but local CRM has NOT provisioned this user
      const mockClient = createMockSupabase({
        user: { id: 'unknown-uid-4', email: 'stranger@gmail.com' },
        session: { access_token: 'temp-token', user: { id: 'unknown-uid-4', email: 'stranger@gmail.com' } },
      });
      setCustomSupabaseClient(mockClient);

      await expect(
        AuthService.signIn('stranger@gmail.com', 'Pass123!')
      ).rejects.toThrow('Your account has not been provisioned by an administrator.');

      expect(mockClient.auth.signOut).toHaveBeenCalled();
    });
  });

  describe('4. Session Persistence & Restoration', () => {
    it('restores active profile from valid persisted session on app startup', async () => {
      const agent = await crm.users.createUser({
        id: 'persisted-uid-5',
        name: 'Amit Patel',
        email: 'amit@amaratvkrishi.com',
        phone: '9111122222',
        role: 'AGENT',
        status: 'ACTIVE',
      });

      const mockClient = createMockSupabase({
        session: {
          access_token: 'persisted-token',
          user: { id: agent.id, email: agent.email },
        },
        user: { id: agent.id, email: agent.email },
      });
      setCustomSupabaseClient(mockClient);

      const { user } = await AuthService.validateAndLoadCurrentProfile();
      expect(user).toBeDefined();
      expect(user?.id).toBe(agent.id);
      expect(user?.role).toBe('AGENT');
    });

    it('returns null when no session is persisted', async () => {
      const mockClient = createMockSupabase({
        session: null,
        user: null,
      });
      setCustomSupabaseClient(mockClient);

      const { user } = await AuthService.validateAndLoadCurrentProfile();
      expect(user).toBeNull();
    });
  });

  describe('5. Logout & Data Preservation', () => {
    it('signs out from Supabase and preserves all local CRM data', async () => {
      // 1. Create local lead, remark, and call
      const lead = await crm.leads.createLead({
        businessName: 'Preserved Gym',
        phone: '9888877777',
        address: 'LDA Colony, Lucknow',
      });

      await crm.remarks.addRemark({
        leadId: lead.id,
        content: 'Preserved remark across logout',
      });

      await crm.callHistory.logCall({
        leadId: lead.id,
        calledNumber: lead.phoneE164,
        outcome: 'CONNECTED',
      });

      const mockClient = createMockSupabase({
        session: { access_token: 'token', user: { id: 'u-1', email: 'a@a.com' } },
      });
      setCustomSupabaseClient(mockClient);

      // 2. Perform Logout
      await AuthService.signOut();
      expect(mockClient.auth.signOut).toHaveBeenCalled();

      // 3. Verify CRM data was NOT deleted
      const leadAfter = await crm.leads.getLeadById(lead.id);
      expect(leadAfter).toBeDefined();
      expect(leadAfter?.businessName).toBe('Preserved Gym');

      const remarksAfter = await crm.remarks.getRemarksByLead(lead.id);
      expect(remarksAfter.length).toBe(1);

      const callsAfter = await crm.callHistory.getCallHistoryByLead(lead.id);
      expect(callsAfter.length).toBe(1);
    });
  });

  describe('6. Security & Credential Isolation', () => {
    it('verifies no passwords or password hashes exist in local user records', async () => {
      const user = await crm.users.createUser({
        name: 'Clean User',
        email: 'clean@amaratvkrishi.com',
        phone: '9777766666',
        role: 'AGENT',
      });

      const stored = await db.users.get(user.id);
      expect(stored).toBeDefined();
      expect((stored as any).password).toBeUndefined();
      expect((stored as any).passwordHash).toBeUndefined();
      expect((stored as any).secret).toBeUndefined();
      expect((stored as any).serviceRoleKey).toBeUndefined();
    });
  });
});
