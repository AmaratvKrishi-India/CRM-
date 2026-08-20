/**
 * Admin Agent Management Service (Phase 2D & 2H)
 * Enforces ADMIN-only authorization, AGENT provisioning, status transitions,
 * role immutability, Edge Function cloud provisioning, and immutable audit activity logging.
 * Strictly avoids storing passwords locally.
 */

import { crmData } from '../db';
import { SalesCRMDatabase } from '../db/database';
import { UserRepository } from '../db/repositories/userRepository';
import { ActivityRepository } from '../db/repositories/activityRepository';
import { DeviceService } from './deviceService';
import { getSupabaseClient } from './supabaseClient';
import { User, UserStatus, Activity } from '../db/types';

export interface CreateAgentInput {
  name: string;
  email: string;
  phone?: string;
  password?: string;
  status?: UserStatus;
}

export interface UpdateAgentInput {
  name?: string;
  phone?: string;
  status?: UserStatus;
}

let customDb: SalesCRMDatabase | null = null;

export class AgentManagementService {
  /**
   * Sets custom database instance (used for test isolation).
   */
  static setCustomDatabase(db: SalesCRMDatabase | null): void {
    customDb = db;
  }

  private static getUserRepo(): UserRepository {
    return customDb ? new UserRepository(customDb) : crmData.users;
  }

  private static getActivityRepo(): ActivityRepository {
    return customDb ? new ActivityRepository(customDb) : crmData.activities;
  }

  /**
   * Asserts that the actor is an authenticated ADMIN.
   */
  private static assertAdmin(actor: User | null): asserts actor is User {
    if (!actor) {
      throw new Error('Unauthorized: No authenticated user session.');
    }
    if (actor.role !== 'ADMIN') {
      throw new Error('Unauthorized: Only administrators are permitted to manage sales agents.');
    }
    if (actor.status !== 'ACTIVE') {
      throw new Error('Unauthorized: Inactive administrator account.');
    }
  }

  /**
   * Lists all sales agents.
   */
  static async getAgents(actor: User | null): Promise<User[]> {
    this.assertAdmin(actor);
    const repo = this.getUserRepo();
    return await repo.getAllUsers({ role: 'AGENT' });
  }

  /**
   * Lists all users (Admins & Agents).
   */
  static async getAllUsers(actor: User | null): Promise<User[]> {
    this.assertAdmin(actor);
    const repo = this.getUserRepo();
    return await repo.getAllUsers();
  }

  /**
   * Retrieves an agent by ID.
   */
  static async getAgentById(actor: User | null, agentId: string): Promise<User | undefined> {
    this.assertAdmin(actor);
    const repo = this.getUserRepo();
    return await repo.getUserById(agentId);
  }

  /**
   * Creates a new sales agent (role is strictly forced to AGENT).
   * Calls secure Supabase Edge Function 'create-agent' if connected to cloud.
   * Generates an immutable AGENT_CREATED audit log attributed to the actor.
   * Passwords are NEVER persisted locally in Dexie, localStorage, or activity logs.
   */
  static async createAgent(
    actor: User | null,
    input: CreateAgentInput
  ): Promise<{ agent: User; auditActivity: Activity }> {
    this.assertAdmin(actor);

    const cleanName = (input.name || '').trim();
    const cleanEmail = (input.email || '').trim().toLowerCase();
    const cleanPhone = (input.phone || '').trim();
    const rawPassword = input.password;

    if (!cleanName) {
      throw new Error('Agent full name is required.');
    }

    if (!cleanEmail) {
      throw new Error('Agent email is required.');
    }

    // Email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      throw new Error('Please enter a valid email address.');
    }

    if (rawPassword && rawPassword.length < 6) {
      throw new Error('Password must be at least 6 characters in length.');
    }

    const userRepo = this.getUserRepo();
    const existing = await userRepo.getUserByEmail(cleanEmail);
    if (existing) {
      throw new Error(`An account with email "${cleanEmail}" already exists.`);
    }

    let cloudAgentId: string | undefined;

    // 1. If Supabase client is configured and password was provided, invoke the Edge Function
    const supabase = getSupabaseClient();
    if (supabase && rawPassword) {
      try {
        const { data: edgeData, error: edgeError } = await supabase.functions.invoke('create-agent', {
          body: {
            name: cleanName,
            email: cleanEmail,
            phone: cleanPhone,
            password: rawPassword,
          },
        });

        if (edgeError) {
          throw new Error(edgeError.message || 'Failed to create agent via Edge Function.');
        }

        if (edgeData && edgeData.error) {
          throw new Error(edgeData.error);
        }

        if (edgeData && edgeData.agent && edgeData.agent.id) {
          cloudAgentId = edgeData.agent.id;
        }
      } catch (err: any) {
        // If Edge function returns an error (e.g. email conflict), throw directly
        if (err.message && (err.message.includes('already exists') || err.message.includes('Unauthorized') || err.message.includes('Forbidden'))) {
          throw err;
        }
        // In local/offline or test environment, log warning and proceed with local creation
        console.warn('Edge function invoke skipped or unavailable:', err.message);
      }
    }

    // 2. Create local Agent profile in Dexie (NEVER storing password)
    const agent = await userRepo.createUser({
      id: cloudAgentId,
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      role: 'AGENT', // Strictly forced to AGENT
      status: input.status || 'ACTIVE',
      createdBy: actor.id,
    });

    // 3. Append immutable audit activity (NEVER storing password)
    const activityRepo = this.getActivityRepo();
    const deviceId = DeviceService.getDeviceId();
    const auditActivity = await activityRepo.logActivity({
      leadId: null,
      userId: actor.id, // Actor is the Admin
      deviceId,
      activityType: 'AGENT_CREATED',
      metadata: {
        agentId: agent.id,
        name: agent.name,
        email: agent.email,
        initialStatus: agent.status,
      },
    });

    return { agent, auditActivity };
  }

  /**
   * Updates an agent profile (name, phone, status only).
   * User ID and Role are immutable.
   */
  static async updateAgent(
    actor: User | null,
    agentId: string,
    updates: UpdateAgentInput
  ): Promise<{ agent: User; auditActivity: Activity }> {
    this.assertAdmin(actor);

    const userRepo = this.getUserRepo();
    const target = await userRepo.getUserById(agentId);
    if (!target) {
      throw new Error(`Agent with ID "${agentId}" not found.`);
    }

    if (target.role !== 'AGENT') {
      throw new Error('Cannot edit administrator accounts through Agent Management.');
    }

    const sanitizedUpdates: Partial<Omit<User, 'id' | 'createdAt'>> = {};
    if (updates.name !== undefined) {
      const cleanName = updates.name.trim();
      if (!cleanName) throw new Error('Agent name cannot be empty.');
      sanitizedUpdates.name = cleanName;
    }

    if (updates.phone !== undefined) {
      sanitizedUpdates.phone = updates.phone.trim();
    }

    if (updates.status !== undefined) {
      sanitizedUpdates.status = updates.status;
    }

    // Prevent any role changes
    delete (sanitizedUpdates as any).role;
    delete (sanitizedUpdates as any).id;

    const updatedAgent = await userRepo.updateUser(agentId, sanitizedUpdates);

    // Append audit activity
    const activityRepo = this.getActivityRepo();
    const deviceId = DeviceService.getDeviceId();
    const auditActivity = await activityRepo.logActivity({
      leadId: null,
      userId: actor.id,
      deviceId,
      activityType: 'AGENT_UPDATED',
      metadata: {
        agentId: target.id,
        email: target.email,
        appliedUpdates: sanitizedUpdates,
      },
    });

    return { agent: updatedAgent, auditActivity };
  }

  /**
   * Activates an agent account.
   */
  static async activateAgent(
    actor: User | null,
    agentId: string
  ): Promise<{ agent: User; auditActivity: Activity }> {
    this.assertAdmin(actor);

    const userRepo = this.getUserRepo();
    const target = await userRepo.getUserById(agentId);
    if (!target) {
      throw new Error(`Agent with ID "${agentId}" not found.`);
    }

    if (target.role !== 'AGENT') {
      throw new Error('Cannot activate non-agent accounts through this interface.');
    }

    const updatedAgent = await userRepo.setUserStatus(agentId, 'ACTIVE');

    const activityRepo = this.getActivityRepo();
    const deviceId = DeviceService.getDeviceId();
    const auditActivity = await activityRepo.logActivity({
      leadId: null,
      userId: actor.id,
      deviceId,
      activityType: 'AGENT_ACTIVATED',
      metadata: {
        agentId: target.id,
        email: target.email,
      },
    });

    return { agent: updatedAgent, auditActivity };
  }

  /**
   * Deactivates an agent account.
   * Does NOT delete the agent or any CRM data.
   */
  static async deactivateAgent(
    actor: User | null,
    agentId: string
  ): Promise<{ agent: User; auditActivity: Activity }> {
    this.assertAdmin(actor);

    if (actor.id === agentId) {
      throw new Error('Administrators cannot deactivate their own account.');
    }

    const userRepo = this.getUserRepo();
    const target = await userRepo.getUserById(agentId);
    if (!target) {
      throw new Error(`Agent with ID "${agentId}" not found.`);
    }

    if (target.role !== 'AGENT') {
      throw new Error('Cannot deactivate non-agent accounts through this interface.');
    }

    const updatedAgent = await userRepo.setUserStatus(agentId, 'INACTIVE');

    const activityRepo = this.getActivityRepo();
    const deviceId = DeviceService.getDeviceId();
    const auditActivity = await activityRepo.logActivity({
      leadId: null,
      userId: actor.id,
      deviceId,
      activityType: 'AGENT_DEACTIVATED',
      metadata: {
        agentId: target.id,
        email: target.email,
      },
    });

    return { agent: updatedAgent, auditActivity };
  }
}
