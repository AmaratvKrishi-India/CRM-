import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { SalesCRMDatabase } from '../src/db/database';
import { createCRMDataLayer } from '../src/db';
import { AgentManagementService } from '../src/services/agentManagementService';
import { AuthService } from '../src/services/authService';
import { DeviceService } from '../src/services/deviceService';
import { setCustomSupabaseClient, resetSupabaseClient } from '../src/services/supabaseClient';
import { User, Lead, CallRecord } from '../src/db/types';

describe('Phase 2H: Secure Admin-Controlled Agent Provisioning & Edge Function Integration', () => {
  let db: SalesCRMDatabase;
  let crm: ReturnType<typeof createCRMDataLayer>;
  let activeAdmin: User;
  let inactiveAdmin: User;
  let activeAgent: User;

  // In-Memory Cloud Store for Supabase Mock
  let mockAuthUsers: Array<{ id: string; email: string; password?: string }>;
  let mockProfiles: Array<any>;
  let mockActivities: Array<any>;

  const createMockSupabaseClient = () => {
    return {
      auth: {
        admin: {
          createUser: vi.fn().mockImplementation(async ({ email, password, user_metadata }) => {
            const exists = mockAuthUsers.find((u) => u.email === email);
            if (exists) {
              return { data: null, error: { message: 'User already registered' } };
            }
            const newUser = { id: `auth-${Math.random().toString(36).substring(7)}`, email, password };
            mockAuthUsers.push(newUser);
            return { data: { user: newUser }, error: null };
          }),
          deleteUser: vi.fn().mockImplementation(async (userId) => {
            mockAuthUsers = mockAuthUsers.filter((u) => u.id !== userId);
            return { data: {}, error: null };
          }),
        },
        signInWithPassword: vi.fn().mockImplementation(async ({ email }) => {
          const u = mockAuthUsers.find((user) => user.email === email);
          if (!u) {
            return { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } };
          }
          return {
            data: {
              user: { id: u.id, email: u.email },
              session: { access_token: 'mock-jwt-token', user: { id: u.id, email: u.email } },
            },
            error: null,
          };
        }),
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              access_token: 'mock-admin-token',
              user: { id: activeAdmin.id, email: activeAdmin.email },
            },
          },
          error: null,
        }),
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: activeAdmin.id, email: activeAdmin.email } },
          error: null,
        }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockImplementation(async () => {
              if (table === 'profiles') {
                return { data: mockProfiles[0] || null, error: null };
              }
              return { data: null, error: null };
            }),
          }),
          insert: vi.fn().mockImplementation(async (payload) => {
            if (table === 'profiles') {
              mockProfiles.push(payload);
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: payload, error: null }),
                }),
              };
            }
            if (table === 'activities') {
              mockActivities.push(payload);
              return { error: null };
            }
            return { error: null };
          }),
        };
      }),
      functions: {
        invoke: vi.fn().mockImplementation(async (funcName, { body }) => {
          if (funcName === 'create-agent') {
            const { name, email, phone, password } = body;
            if (!password || password.length < 6) {
              return { data: { error: 'Password must be at least 6 characters in length.' }, error: null };
            }
            const exists = mockAuthUsers.find((u) => u.email === email.toLowerCase());
            if (exists) {
              return { data: { error: 'An account with this email already exists in Supabase Auth.' }, error: null };
            }

            const newId = `auth-agent-${Math.random().toString(36).substring(7)}`;
            const newAuthUser = { id: newId, email: email.toLowerCase(), password };
            mockAuthUsers.push(newAuthUser);

            const profile = {
              id: newId,
              authUserId: newId,
              organizationId: 'org-amaratv-krishi',
              name,
              email: email.toLowerCase(),
              phone: phone || '',
              role: 'AGENT',
              status: 'ACTIVE',
              createdBy: activeAdmin.id,
              createdAt: new Date().toISOString(),
            };
            mockProfiles.push(profile);

            return {
              data: {
                success: true,
                message: 'Agent created successfully.',
                agent: profile,
              },
              error: null,
            };
          }
          return { data: null, error: { message: 'Unknown function' } };
        }),
      },
    } as any;
  };

  beforeEach(async () => {
    DeviceService.resetDeviceIdForTesting();
    resetSupabaseClient();
    const testDbName = `test_prov_${Math.random().toString(36).substring(7)}`;
    db = new SalesCRMDatabase(testDbName);
    crm = createCRMDataLayer(db);
    AgentManagementService.setCustomDatabase(db);
    AuthService.setCustomDatabase(db);
    await db.seedDefaults();

    mockAuthUsers = [];
    mockProfiles = [];
    mockActivities = [];

    // Seed test admin & agent
    activeAdmin = await crm.users.createUser({
      id: 'admin-prov-1',
      name: 'Admin Vikram',
      email: 'admin@amaratvkrishi.com',
      phone: '9988776655',
      role: 'ADMIN',
      status: 'ACTIVE',
    });

    inactiveAdmin = await crm.users.createUser({
      id: 'admin-prov-inactive',
      name: 'Inactive Admin',
      email: 'inactive-admin@amaratvkrishi.com',
      phone: '9988776600',
      role: 'ADMIN',
      status: 'INACTIVE',
    });

    activeAgent = await crm.users.createUser({
      id: 'agent-prov-1',
      name: 'Agent Rahul',
      email: 'rahul@amaratvkrishi.com',
      phone: '9123456780',
      role: 'AGENT',
      status: 'ACTIVE',
      createdBy: activeAdmin.id,
    });
  });

  afterEach(async () => {
    AgentManagementService.setCustomDatabase(null);
    AuthService.setCustomDatabase(null);
    resetSupabaseClient();
    await db.delete();
    vi.restoreAllMocks();
  });

  describe('1. Admin Authorization & Caller Validation', () => {
    it('rejects unauthenticated provisioning requests', async () => {
      await expect(
        AgentManagementService.createAgent(null, {
          name: 'Test Agent',
          email: 'test@amaratvkrishi.com',
          password: 'Password123!',
        })
      ).rejects.toThrow(/Unauthorized: No authenticated user session/i);
    });

    it('rejects agent provisioning when caller has role AGENT', async () => {
      await expect(
        AgentManagementService.createAgent(activeAgent, {
          name: 'New Agent',
          email: 'agent2@amaratvkrishi.com',
          password: 'Password123!',
        })
      ).rejects.toThrow(/Only administrators are permitted to manage sales agents/i);
    });

    it('rejects provisioning when administrator account is INACTIVE', async () => {
      await expect(
        AgentManagementService.createAgent(inactiveAdmin, {
          name: 'New Agent',
          email: 'agent3@amaratvkrishi.com',
          password: 'Password123!',
        })
      ).rejects.toThrow(/Inactive administrator account/i);
    });
  });

  describe('2. Input Validation & Role Immutability', () => {
    it('rejects invalid email formats', async () => {
      await expect(
        AgentManagementService.createAgent(activeAdmin, {
          name: 'Invalid Email Agent',
          email: 'invalid-email-string',
          password: 'Password123!',
        })
      ).rejects.toThrow(/Please enter a valid email address/i);
    });

    it('rejects empty name', async () => {
      await expect(
        AgentManagementService.createAgent(activeAdmin, {
          name: '   ',
          email: 'valid@amaratvkrishi.com',
          password: 'Password123!',
        })
      ).rejects.toThrow(/Agent full name is required/i);
    });

    it('rejects passwords shorter than 6 characters', async () => {
      await expect(
        AgentManagementService.createAgent(activeAdmin, {
          name: 'Short Password Agent',
          email: 'shortpass@amaratvkrishi.com',
          password: '123',
        })
      ).rejects.toThrow(/Password must be at least 6 characters/i);
    });

    it('strictly forces role to AGENT and sets createdBy to Admin profile', async () => {
      const { agent } = await AgentManagementService.createAgent(activeAdmin, {
        name: 'Pooja Verma',
        email: 'pooja@amaratvkrishi.com',
        phone: '9876543210',
        password: 'SecurePassword123!',
      });

      expect(agent.role).toBe('AGENT');
      expect(agent.createdBy).toBe(activeAdmin.id);
      expect(agent.status).toBe('ACTIVE');
    }, 15000);

    it('rejects duplicate email creation in local repository', async () => {
      await AgentManagementService.createAgent(activeAdmin, {
        name: 'First Rep',
        email: 'duplicate@amaratvkrishi.com',
        password: 'Password123!',
      });

      await expect(
        AgentManagementService.createAgent(activeAdmin, {
          name: 'Second Rep',
          email: 'duplicate@amaratvkrishi.com',
          password: 'Password123!',
        })
      ).rejects.toThrow(/already exists/i);
    }, 15000);
  });

  describe('3. Edge Function Cloud Provisioning & Audit Activity Logging', () => {
    it('invokes create-agent Edge Function and synchronizes newly created agent', async () => {
      const mockClient = createMockSupabaseClient();
      setCustomSupabaseClient(mockClient);

      const { agent, auditActivity } = await AgentManagementService.createAgent(activeAdmin, {
        name: 'Aman Srivastava',
        email: 'aman@amaratvkrishi.com',
        phone: '9876500000',
        password: 'Password123!',
      });

      expect(mockClient.functions.invoke).toHaveBeenCalledWith('create-agent', {
        body: {
          name: 'Aman Srivastava',
          email: 'aman@amaratvkrishi.com',
          phone: '9876500000',
          password: 'Password123!',
        },
      });

      expect(agent.name).toBe('Aman Srivastava');
      expect(agent.email).toBe('aman@amaratvkrishi.com');
      expect(agent.role).toBe('AGENT');

      // Verify audit activity log
      expect(auditActivity.activityType).toBe('AGENT_CREATED');
      expect(auditActivity.userId).toBe(activeAdmin.id);
      expect(auditActivity.metadata.agentId).toBe(agent.id);
      expect(auditActivity.metadata.name).toBe('Aman Srivastava');
    });

    it('guarantees passwords NEVER enter local Dexie database or activity metadata', async () => {
      const rawPassword = 'SecretSuperPassword999!';
      const { agent, auditActivity } = await AgentManagementService.createAgent(activeAdmin, {
        name: 'Safe Agent',
        email: 'safe@amaratvkrishi.com',
        password: rawPassword,
      });

      // Inspect local Dexie user entity
      const savedUser = (await db.users.get(agent.id)) as any;
      expect(savedUser).toBeDefined();
      expect(savedUser.password).toBeUndefined();
      expect(JSON.stringify(savedUser)).not.toContain(rawPassword);

      // Inspect activity metadata
      expect(JSON.stringify(auditActivity)).not.toContain(rawPassword);

      // Inspect entire Dexie database export
      const backup = await crm.backup.generateBackupPayload();
      expect(JSON.stringify(backup)).not.toContain(rawPassword);
    });
  });

  describe('4. Data Safety, Non-Destructive Integrity & CRM Access', () => {
    it('preserves existing leads and call records during agent provisioning', async () => {
      // Create existing lead & call record
      const existingLead = await crm.leads.createLead({
        businessName: 'Existing Fitness Zone',
        phone: '9900000001',
        address: 'Mahanagar, Lucknow',
      });

      const existingCall = await crm.callRecords.createCallRecord({
        leadId: existingLead.id,
        userId: activeAdmin.id,
        startedAt: new Date().toISOString(),
        durationSeconds: 60,
        outcome: 'CONNECTED',
        verificationStatus: 'UNVERIFIED',
      });

      // Provision new agent
      await AgentManagementService.createAgent(activeAdmin, {
        name: 'New Agent',
        email: 'newagent@amaratvkrishi.com',
        password: 'Password123!',
      });

      // Verify existing CRM records remain untouched
      const leadAfter = await crm.leads.getLeadById(existingLead.id);
      expect(leadAfter?.businessName).toBe('Existing Fitness Zone');

      const callAfter = await crm.callRecords.getCallRecordById(existingCall.id);
      expect(callAfter?.durationSeconds).toBe(60);
    });

    it('verifies that newly provisioned AGENT can authenticate and resolve AGENT role', async () => {
      const mockClient = createMockSupabaseClient();
      setCustomSupabaseClient(mockClient);

      // Provision agent
      const { agent } = await AgentManagementService.createAgent(activeAdmin, {
        name: 'Rohan Gupta',
        email: 'rohan@amaratvkrishi.com',
        password: 'Password123!',
      });

      // Agent signs in
      const signInResult = await AuthService.signIn('rohan@amaratvkrishi.com', 'Password123!');
      expect(signInResult.user.role).toBe('AGENT');
      expect(signInResult.user.status).toBe('ACTIVE');
    });

    it('rejects authentication if an agent is subsequently deactivated', async () => {
      const mockClient = createMockSupabaseClient();
      setCustomSupabaseClient(mockClient);

      const { agent } = await AgentManagementService.createAgent(activeAdmin, {
        name: 'Deactivated Rep',
        email: 'deact@amaratvkrishi.com',
        password: 'Password123!',
      });

      // Admin deactivates agent
      await AgentManagementService.deactivateAgent(activeAdmin, agent.id);

      const updatedAgent = await crm.users.getUserById(agent.id);
      expect(updatedAgent?.status).toBe('INACTIVE');

      await expect(
        AuthService.signIn('deact@amaratvkrishi.com', 'Password123!')
      ).rejects.toThrow(/inactive|deactivated/i);
    });
  });
});
