import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { SalesCRMDatabase } from '../src/db/database';
import { createCRMDataLayer } from '../src/db';
import { AgentManagementService } from '../src/services/agentManagementService';
import { AuthService } from '../src/services/authService';
import {
  setCustomSupabaseClient,
  resetSupabaseClient,
} from '../src/services/supabaseClient';
import { DeviceService } from '../src/services/deviceService';
import { User } from '../src/db/types';

describe('Phase 2D: Admin Agent Management, Role Protection & Audit Logging', () => {
  let db: SalesCRMDatabase;
  let crm: ReturnType<typeof createCRMDataLayer>;
  let adminUser: User;
  let agentUser: User;

  beforeEach(async () => {
    DeviceService.resetDeviceIdForTesting();
    resetSupabaseClient();
    const testDbName = `test_agent_mgmt_${Math.random().toString(36).substring(7)}`;
    db = new SalesCRMDatabase(testDbName);
    crm = createCRMDataLayer(db);
    AgentManagementService.setCustomDatabase(db);
    AuthService.setCustomDatabase(db);
    await db.seedDefaults();

    // Create test Admin
    adminUser = await crm.users.createUser({
      id: 'admin-actor-1',
      name: 'Vikram Singh (Admin)',
      email: 'admin@amaratvkrishi.com',
      phone: '9988776655',
      role: 'ADMIN',
      status: 'ACTIVE',
    });

    // Create test Agent
    agentUser = await crm.users.createUser({
      id: 'agent-actor-2',
      name: 'Rahul Sharma (Agent)',
      email: 'rahul@amaratvkrishi.com',
      phone: '9123456780',
      role: 'AGENT',
      status: 'ACTIVE',
      createdBy: adminUser.id,
    });
  });

  afterEach(async () => {
    AgentManagementService.setCustomDatabase(null);
    AuthService.setCustomDatabase(null);
    resetSupabaseClient();
    await db.delete();
    vi.restoreAllMocks();
  });

  describe('1. Access Control & Role Boundary', () => {
    it('allows ADMIN to list sales agents', async () => {
      const agents = await AgentManagementService.getAgents(adminUser);
      expect(agents.length).toBe(1);
      expect(agents[0].id).toBe(agentUser.id);
      expect(agents[0].role).toBe('AGENT');
    });

    it('strictly denies AGENT from accessing agent management', async () => {
      await expect(
        AgentManagementService.getAgents(agentUser)
      ).rejects.toThrow(/Unauthorized: Only administrators are permitted/);

      await expect(
        AgentManagementService.getAllUsers(agentUser)
      ).rejects.toThrow(/Unauthorized/);
    });

    it('strictly denies unauthenticated calls (null actor)', async () => {
      await expect(
        AgentManagementService.getAgents(null)
      ).rejects.toThrow(/Unauthorized: No authenticated user session/);
    });

    it('denies INACTIVE admin from performing agent actions', async () => {
      const inactiveAdmin: User = { ...adminUser, status: 'INACTIVE' };
      await expect(
        AgentManagementService.getAgents(inactiveAdmin)
      ).rejects.toThrow(/Unauthorized: Inactive administrator account/);
    });
  });

  describe('2. Agent Creation & Role Immutability', () => {
    it('creates an AGENT account with valid data and logs AGENT_CREATED audit event', async () => {
      const { agent, auditActivity } = await AgentManagementService.createAgent(adminUser, {
        name: 'Amit Patel',
        email: 'amit@amaratvkrishi.com',
        phone: '9876500020',
        status: 'ACTIVE',
      });

      expect(agent.id).toBeDefined();
      expect(agent.name).toBe('Amit Patel');
      expect(agent.email).toBe('amit@amaratvkrishi.com');
      expect(agent.role).toBe('AGENT'); // Strictly AGENT
      expect(agent.status).toBe('ACTIVE');
      expect(agent.createdBy).toBe(adminUser.id);

      // Verify Audit Log
      expect(auditActivity.activityType).toBe('AGENT_CREATED');
      expect(auditActivity.userId).toBe(adminUser.id); // Actor is Admin
      expect(auditActivity.deviceId).toBeDefined();
      expect(auditActivity.metadata.agentId).toBe(agent.id);

      // Verify no password stored in DB
      const stored = await db.users.get(agent.id);
      expect((stored as any).password).toBeUndefined();
      expect((stored as any).passwordHash).toBeUndefined();
    });

    it('rejects duplicate email addresses', async () => {
      await expect(
        AgentManagementService.createAgent(adminUser, {
          name: 'Duplicate Agent',
          email: 'rahul@amaratvkrishi.com', // Already exists
        })
      ).rejects.toThrow(/already exists/);
    });

    it('rejects empty name and invalid email format', async () => {
      await expect(
        AgentManagementService.createAgent(adminUser, {
          name: '   ',
          email: 'valid@amaratvkrishi.com',
        })
      ).rejects.toThrow(/full name is required/);

      await expect(
        AgentManagementService.createAgent(adminUser, {
          name: 'Valid Name',
          email: 'not-an-email',
        })
      ).rejects.toThrow(/valid email address/);
    });

    it('denies AGENT from creating other agents', async () => {
      await expect(
        AgentManagementService.createAgent(agentUser, {
          name: 'Rogue Agent',
          email: 'rogue@amaratvkrishi.com',
        })
      ).rejects.toThrow(/Unauthorized/);
    });
  });

  describe('3. Agent Activation & Deactivation', () => {
    it('deactivates an active agent and logs AGENT_DEACTIVATED audit event', async () => {
      const { agent, auditActivity } = await AgentManagementService.deactivateAgent(
        adminUser,
        agentUser.id
      );

      expect(agent.status).toBe('INACTIVE');
      expect(auditActivity.activityType).toBe('AGENT_DEACTIVATED');
      expect(auditActivity.userId).toBe(adminUser.id);
      expect(auditActivity.metadata.agentId).toBe(agentUser.id);

      // Verify retrieved user is INACTIVE
      const retrieved = await crm.users.getUserById(agentUser.id);
      expect(retrieved?.status).toBe('INACTIVE');
    });

    it('activates an inactive agent and logs AGENT_ACTIVATED audit event', async () => {
      // First deactivate
      await AgentManagementService.deactivateAgent(adminUser, agentUser.id);

      // Then activate
      const { agent, auditActivity } = await AgentManagementService.activateAgent(
        adminUser,
        agentUser.id
      );

      expect(agent.status).toBe('ACTIVE');
      expect(auditActivity.activityType).toBe('AGENT_ACTIVATED');
      expect(auditActivity.userId).toBe(adminUser.id);
    });

    it('prevents an administrator from deactivating themselves', async () => {
      await expect(
        AgentManagementService.deactivateAgent(adminUser, adminUser.id)
      ).rejects.toThrow(/cannot deactivate their own account/);
    });

    it('denies AGENT from deactivating or activating accounts', async () => {
      await expect(
        AgentManagementService.deactivateAgent(agentUser, agentUser.id)
      ).rejects.toThrow(/Unauthorized/);

      await expect(
        AgentManagementService.activateAgent(agentUser, agentUser.id)
      ).rejects.toThrow(/Unauthorized/);
    });
  });

  describe('4. Agent Profile Editing & Immutability', () => {
    it('updates basic profile (name, phone, status) and logs AGENT_UPDATED audit event', async () => {
      const { agent, auditActivity } = await AgentManagementService.updateAgent(
        adminUser,
        agentUser.id,
        {
          name: 'Rahul V. Sharma',
          phone: '9123459999',
        }
      );

      expect(agent.name).toBe('Rahul V. Sharma');
      expect(agent.phone).toBe('9123459999');
      expect(agent.role).toBe('AGENT'); // Remains AGENT
      expect(auditActivity.activityType).toBe('AGENT_UPDATED');
      expect(auditActivity.userId).toBe(adminUser.id);
    });

    it('rejects editing non-agent/admin accounts through Agent Management', async () => {
      await expect(
        AgentManagementService.updateAgent(adminUser, adminUser.id, {
          name: 'Hacked Admin Name',
        })
      ).rejects.toThrow(/Cannot edit administrator accounts/);
    });
  });

  describe('5. Data Preservation on Deactivation', () => {
    it('guarantees deactivating an agent does not delete any CRM leads, calls, or remarks', async () => {
      // 1. Create a lead assigned to/created by this agent
      const lead = await crm.leads.createLead({
        businessName: 'Deactivated Rep Gym',
        phone: '9876540001',
        address: 'Indira Nagar, Lucknow',
        createdBy: agentUser.id,
        assignedTo: agentUser.id,
      });

      const remark = await crm.remarks.addRemark({
        leadId: lead.id,
        content: 'Remark by agent before deactivation',
        author: agentUser.name,
      });

      const call = await crm.callHistory.logCall({
        leadId: lead.id,
        calledNumber: lead.phoneE164,
        outcome: 'CONNECTED',
      });

      // 2. Admin deactivates the agent
      await AgentManagementService.deactivateAgent(adminUser, agentUser.id);

      // 3. Verify CRM records still exist untouched
      const leadAfter = await crm.leads.getLeadById(lead.id);
      expect(leadAfter).toBeDefined();
      expect(leadAfter?.createdBy).toBe(agentUser.id);
      expect(leadAfter?.assignedTo).toBe(agentUser.id);

      const remarksAfter = await crm.remarks.getRemarksByLead(lead.id);
      expect(remarksAfter.length).toBe(1);
      expect(remarksAfter[0].id).toBe(remark.id);

      const callsAfter = await crm.callHistory.getCallHistoryByLead(lead.id);
      expect(callsAfter.length).toBe(1);
      expect(callsAfter[0].id).toBe(call.id);
    });
  });

  describe('6. Security Invariant: Service-Role Key Absent', () => {
    it('verifies service-role key is never present on frontend client or storage', () => {
      expect((import.meta.env as any).VITE_SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
      expect((import.meta.env as any).SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    });
  });
});
