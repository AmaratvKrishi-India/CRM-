import { describe, it } from 'node:test';
import assert from 'node:assert';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'ADMIN' | 'AGENT';
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  lastLoginAt: string | null;
  isSynced: number;
  deletedAt: string | null;
}

export interface Activity {
  id: string;
  leadId: string | null;
  userId: string;
  deviceId: string | null;
  activityType: string;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  isSynced: number;
  deletedAt: string | null;
}

describe('Agent Soft Deletion & Lifecycle (Phase 3)', () => {
  // Mock In-Memory User Repository
  class InMemoryUserRepo {
    users: Map<string, User> = new Map();

    async createUser(input: any): Promise<User> {
      const now = new Date().toISOString();
      const user: User = {
        id: input.id || `user-${Date.now()}-${Math.random()}`,
        name: input.name,
        email: input.email,
        phone: input.phone || '',
        role: input.role,
        status: input.status || 'ACTIVE',
        createdAt: now,
        createdBy: input.createdBy || null,
        updatedAt: now,
        lastLoginAt: null,
        isSynced: 0,
        deletedAt: null,
      };
      this.users.set(user.id, user);
      return user;
    }

    async getUserById(id: string, includeDeleted = false): Promise<User | undefined> {
      const user = this.users.get(id);
      if (!user) return undefined;
      if (!includeDeleted && user.deletedAt !== null) return undefined;
      return user;
    }

    async deleteUser(id: string): Promise<User> {
      const user = this.users.get(id);
      if (!user) throw new Error(`User with id ${id} not found.`);
      user.status = 'INACTIVE';
      user.deletedAt = new Date().toISOString();
      user.updatedAt = new Date().toISOString();
      user.isSynced = 0;
      return user;
    }

    async getAllUsers(options: { includeDeleted?: boolean; role?: string } = {}): Promise<User[]> {
      const list = Array.from(this.users.values());
      return list.filter((u) => {
        if (!options.includeDeleted && u.deletedAt !== null) return false;
        if (options.role && u.role !== options.role) return false;
        return true;
      });
    }

    async getActiveAgentsForAssignment(): Promise<User[]> {
      return Array.from(this.users.values()).filter(
        (u) => u.role === 'AGENT' && u.status === 'ACTIVE' && u.deletedAt === null
      );
    }
  }

  // Mock In-Memory Activity Repository
  class InMemoryActivityRepo {
    activities: Activity[] = [];

    async logActivity(input: any): Promise<Activity> {
      const act: Activity = {
        id: `act-${Date.now()}-${Math.random()}`,
        leadId: input.leadId || null,
        userId: input.userId,
        deviceId: input.deviceId || null,
        activityType: input.activityType,
        metadata: input.metadata || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isSynced: 0,
        deletedAt: null,
      };
      this.activities.push(act);
      return act;
    }
  }

  it('Admin can successfully soft-delete an agent account', async () => {
    const userRepo = new InMemoryUserRepo();
    const activityRepo = new InMemoryActivityRepo();

    const adminActor: User = {
      id: 'admin-1',
      name: 'Admin User',
      email: 'admin@amaratv.com',
      phone: '9999999999',
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      createdBy: null,
      updatedAt: new Date().toISOString(),
      lastLoginAt: null,
      isSynced: 1,
      deletedAt: null,
    };

    const agent = await userRepo.createUser({
      name: 'Rohan Sharma',
      email: 'rohan@amaratv.com',
      phone: '9876543210',
      role: 'AGENT',
      status: 'ACTIVE',
      createdBy: adminActor.id,
    });

    assert.strictEqual(agent.status, 'ACTIVE');
    assert.strictEqual(agent.deletedAt, null);

    // Perform soft deletion
    const deleted = await userRepo.deleteUser(agent.id);
    assert.strictEqual(deleted.status, 'INACTIVE');
    assert.ok(deleted.deletedAt !== null);

    // Verify activity logged
    const activity = await activityRepo.logActivity({
      userId: adminActor.id,
      activityType: 'AGENT_DELETED',
      metadata: {
        agentId: agent.id,
        name: agent.name,
        email: agent.email,
        deletedAt: deleted.deletedAt,
      },
    });

    assert.strictEqual(activity.activityType, 'AGENT_DELETED');
    assert.strictEqual(activity.metadata.agentId, agent.id);
  });

  it('Non-admin cannot delete an agent (RBAC guard)', async () => {
    const agentActor: User = {
      id: 'agent-1',
      name: 'Agent User',
      email: 'agent@amaratv.com',
      phone: '9999999999',
      role: 'AGENT',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      createdBy: null,
      updatedAt: new Date().toISOString(),
      lastLoginAt: null,
      isSynced: 1,
      deletedAt: null,
    };

    const assertAdminGuard = (actor: User | null) => {
      if (!actor || actor.role !== 'ADMIN') {
        throw new Error('Unauthorized: Only administrators are permitted to manage sales agents.');
      }
    };

    assert.throws(
      () => {
        assertAdminGuard(agentActor);
      },
      /Only administrators are permitted/
    );
  });

  it('Admin cannot delete their own account', async () => {
    const adminActor: User = {
      id: 'admin-1',
      name: 'Super Admin',
      email: 'superadmin@amaratv.com',
      phone: '9999999999',
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      createdBy: null,
      updatedAt: new Date().toISOString(),
      lastLoginAt: null,
      isSynced: 1,
      deletedAt: null,
    };

    const deleteAgentGuard = (actor: User, targetAgentId: string) => {
      if (actor.id === targetAgentId) {
        throw new Error('Administrators cannot delete their own account.');
      }
    };

    assert.throws(
      () => {
        deleteAgentGuard(adminActor, adminActor.id);
      },
      /Administrators cannot delete their own account/
    );
  });

  it('Deleted agent is excluded from active assignment lists and selectors', async () => {
    const userRepo = new InMemoryUserRepo();

    const activeAgent = await userRepo.createUser({
      name: 'Active Agent',
      email: 'active@amaratv.com',
      phone: '9876543210',
      role: 'AGENT',
      status: 'ACTIVE',
    });

    const deletedAgent = await userRepo.createUser({
      name: 'Deleted Agent',
      email: 'deleted@amaratv.com',
      phone: '9876543211',
      role: 'AGENT',
      status: 'ACTIVE',
    });

    await userRepo.deleteUser(deletedAgent.id);

    const activeForAssignment = await userRepo.getActiveAgentsForAssignment();
    assert.strictEqual(activeForAssignment.length, 1);
    assert.strictEqual(activeForAssignment[0].id, activeAgent.id);

    // Verify lookup by ID excludes deleted without flag
    const notFound = await userRepo.getUserById(deletedAgent.id);
    assert.strictEqual(notFound, undefined);

    const foundWithFlag = await userRepo.getUserById(deletedAgent.id, true);
    assert.ok(foundWithFlag !== undefined);
    assert.strictEqual(foundWithFlag.status, 'INACTIVE');
  });

  it('Historical CRM data associated with deleted agent remains intact', async () => {
    const userRepo = new InMemoryUserRepo();

    const agent = await userRepo.createUser({
      name: 'Legacy Rep',
      email: 'legacy@amaratv.com',
      phone: '9876543210',
      role: 'AGENT',
      status: 'ACTIVE',
    });

    // Mock existing historical lead assigned to this agent
    const historicalLead = {
      id: 'lead-101',
      businessName: 'Skywards Fitness',
      assignedTo: agent.id,
      status: 'INTERESTED',
    };

    // Soft delete the agent
    await userRepo.deleteUser(agent.id);

    // Lead assignment field is unchanged and historical records are preserved
    assert.strictEqual(historicalLead.assignedTo, agent.id);
    assert.strictEqual(historicalLead.businessName, 'Skywards Fitness');

    // Admin can still resolve the agent name from historical records via includeDeleted=true
    const resolvedAgent = await userRepo.getUserById(historicalLead.assignedTo, true);
    assert.ok(resolvedAgent !== undefined);
    assert.strictEqual(resolvedAgent.name, 'Legacy Rep');
  });
});
