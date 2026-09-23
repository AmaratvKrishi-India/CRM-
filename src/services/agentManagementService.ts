/**
 * Admin Agent Management Service (Phase 2D & 2H)
 * Enforces ADMIN-only authorization, AGENT provisioning, status transitions,
 * role immutability, Edge Function cloud provisioning, and immutable audit activity logging.
 * Strictly avoids storing passwords locally.
 */

import { crmData } from '../db';
import type { SalesCRMDatabase } from '../db/database';
import { UserRepository } from '../db/repositories/userRepository';
import { ActivityRepository } from '../db/repositories/activityRepository';
import { DeviceService } from './deviceService';
import { getSupabaseClient } from './supabaseClient';
import { SyncPush } from './sync/syncPush';
import type { User, UserStatus, Activity } from '../db/types';
import { validateEmail, validateMinLength, validateRequired } from '../utils/validation';

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
    const scope = (customDb || crmData.db).requireAccessScope();
    if (actor.id !== scope.userId || actor.organizationId !== scope.organizationId || scope.role !== 'ADMIN') {
      throw new Error('Unauthorized: Administrator does not match the active data partition.');
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
  private static validateCreateAgentInput(input: CreateAgentInput): {
    cleanName: string;
    cleanEmail: string;
    cleanPhone: string;
    password: string;
  } {
    const cleanName = (input.name || '').trim();
    const cleanEmail = (input.email || '').trim().toLowerCase();
    const cleanPhone = (input.phone || '').trim();
    const password = input.password || '';

    const checks = [
      validateRequired(cleanName, 'Agent full name is required.'),
      validateRequired(cleanEmail, 'Agent email is required.'),
      validateEmail(cleanEmail, 'Please enter a valid email address.'),
      validateRequired(password, 'A temporary password is required to provision an agent account.'),
      validateMinLength(password, 6, 'Password must be at least 6 characters in length.'),
    ];
    const failed = checks.find((result) => !result.valid);
    if (failed && !failed.valid) throw new Error(failed.error);
    return { cleanName, cleanEmail, cleanPhone, password };
  }

  private static async invokeCreateAgent(input: {
    cleanName: string;
    cleanEmail: string;
    cleanPhone: string;
    password: string;
  }): Promise<Partial<User>> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Agent provisioning requires a configured authentication server and an internet connection.');
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error('Agent provisioning requires an internet connection. No local account was created.');
    }

    let edgeData: { error?: string; agent?: Partial<User> } | null;
    try {
      const result = await supabase.functions.invoke('create-agent', {
        body: {
          name: input.cleanName,
          email: input.cleanEmail,
          phone: input.cleanPhone,
          password: input.password,
          idempotencyKey: crypto.randomUUID(),
        },
      });
      edgeData = result.data;
      if (result.error) {
        const status = (result.error as { context?: { status?: number } }).context?.status;
        const detail = status ? ` (HTTP ${status})` : '';
        throw new Error(
          `Agent provisioning failed on the server${detail}: ${result.error.message || 'unknown error'}. No local account was created. Please retry.`
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';
      if (message.includes('Agent provisioning failed')) throw err;
      throw new Error(
        `Agent provisioning requires a working server connection: ${message}. No local account was created. Please retry.`
      );
    }

    if (edgeData?.error) {
      throw new Error(`Agent provisioning failed on the server: ${edgeData.error}. No local account was created.`);
    }
    if (!edgeData?.agent) {
      throw new Error('Agent provisioning returned an incomplete server profile. No local account was created.');
    }
    return edgeData.agent;
  }

  private static validateRemoteAgent(actor: User, remoteAgent: Partial<User>, cleanEmail: string): void {
    if (!remoteAgent.id || !remoteAgent.organizationId) {
      throw new Error('Agent provisioning returned an incomplete server profile. No local account was created.');
    }
    if (remoteAgent.organizationId !== actor.organizationId) {
      throw new Error('Agent provisioning returned a profile from another organization. No local account was created.');
    }
    if (remoteAgent.role !== 'AGENT') {
      throw new Error('Agent provisioning returned an invalid account role. No local account was created.');
    }
    if ((remoteAgent.email || '').trim().toLowerCase() !== cleanEmail) {
      throw new Error('Agent provisioning returned a mismatched account email. No local account was created.');
    }
    if (remoteAgent.status !== 'ACTIVE' && remoteAgent.status !== 'INACTIVE') {
      throw new Error('Agent provisioning returned an invalid account status. No local account was created.');
    }
  }

  private static buildAgent(
    actor: User,
    remoteAgent: Partial<User>,
    cleanName: string,
    cleanEmail: string,
    cleanPhone: string,
  ): User {
    const createdAt = remoteAgent.createdAt || new Date().toISOString();
    return {
      id: remoteAgent.id!,
      serverRevision: typeof remoteAgent.serverRevision === 'number' ? remoteAgent.serverRevision : undefined,
      organizationId: remoteAgent.organizationId!,
      name: (remoteAgent.name || cleanName).trim(),
      email: cleanEmail,
      phone: (remoteAgent.phone || cleanPhone).trim(),
      role: 'AGENT',
      status: remoteAgent.status!,
      createdAt,
      createdBy: remoteAgent.createdBy || actor.id,
      updatedAt: remoteAgent.updatedAt || createdAt,
      lastLoginAt: null,
      isSynced: 1,
      deletedAt: null,
    };
  }

  private static async logAgentCreated(actor: User, agent: User): Promise<Activity> {
    return this.getActivityRepo().logActivity({
      leadId: null,
      userId: actor.id,
      deviceId: DeviceService.getDeviceId(),
      activityType: 'AGENT_CREATED',
      metadata: {
        agentId: agent.id,
        name: agent.name,
        email: agent.email,
        initialStatus: agent.status,
      },
    });
  }

  /**
   * Creates a new sales agent (role is strictly forced to AGENT).
   * Calls secure Supabase Edge Function 'create-agent' if connected to cloud.
   * Passwords are NEVER persisted locally in Dexie, localStorage, or activity logs.
   */
  static async createAgent(
    actor: User | null,
    input: CreateAgentInput
  ): Promise<{ agent: User; auditActivity: Activity }> {
    this.assertAdmin(actor);
    const sanitized = this.validateCreateAgentInput(input);
    const userRepo = this.getUserRepo();
    if (await userRepo.getUserByEmail(sanitized.cleanEmail)) {
      throw new Error(`An account with email "${sanitized.cleanEmail}" already exists.`);
    }

    const remoteAgent = await this.invokeCreateAgent(sanitized);
    this.validateRemoteAgent(actor, remoteAgent, sanitized.cleanEmail);
    const agent = this.buildAgent(
      actor,
      remoteAgent,
      sanitized.cleanName,
      sanitized.cleanEmail,
      sanitized.cleanPhone,
    );
    await userRepo.putUser(agent);
    const auditActivity = await this.logAgentCreated(actor, agent);
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
    delete sanitizedUpdates.role;

    const database = userRepo.getDatabase();
    return database.transaction('rw', [database.users, database.activities, database.outbox], async () => {
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
    });
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

    const database = userRepo.getDatabase();
    return database.transaction('rw', [database.users, database.activities, database.outbox], async () => {
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
    });
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

    const database = userRepo.getDatabase();
    return database.transaction('rw', [database.users, database.activities, database.outbox], async () => {
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
    });
  }

  /**
   * Permanently soft-deletes an agent.
   * NON-DESTRUCTIVE: all historical CRM records (leads, calls, remarks, follow-ups)
   * are fully preserved for audit and reporting.
   * The agent's login is immediately blocked via status=INACTIVE + deletedAt timestamp.
   */
  static async deleteAgent(
    actor: User | null,
    agentId: string
  ): Promise<{ agent: User; auditActivity: Activity }> {
    this.assertAdmin(actor);

    if (actor.id === agentId) {
      throw new Error('Administrators cannot delete their own account.');
    }

    const userRepo = this.getUserRepo();
    const target = await userRepo.getUserById(agentId, true); // include deleted for idempotency
    if (!target) {
      throw new Error(`Agent with ID "${agentId}" not found.`);
    }

    if (target.role !== 'AGENT') {
      throw new Error('Only AGENT accounts can be deleted through this interface.');
    }

    if (target.deletedAt !== null) {
      throw new Error(`Agent "${target.name}" has already been deleted.`);
    }

    const database = userRepo.getDatabase();
    const { deletedAgent, auditActivity } = await database.transaction(
      'rw', [database.users, database.activities, database.outbox], async () => {
        const deletedAgent = await userRepo.deleteUser(agentId);
        // 3. Log immutable AGENT_DELETED audit activity
        const activityRepo = this.getActivityRepo();
        const deviceId = DeviceService.getDeviceId();
        const auditActivity = await activityRepo.logActivity({
          leadId: null,
          userId: actor.id,
          deviceId,
          activityType: 'AGENT_DELETED',
          metadata: {
            agentId: target.id,
            name: target.name,
            email: target.email,
            deletedAt: deletedAgent.deletedAt,
            performedBy: actor.id,
          },
        });

        return { deletedAgent, auditActivity };
      }
    );

    // 2. If Supabase is available, mark deleted in cloud profiles table
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const item = (await userRepo.getDatabase().outbox.where('entityId').equals(agentId).toArray())
          .filter(entry => entry.entityType === 'profiles' && entry.status === 'PENDING')
          .sort((a,b) => (b.sequence || 0) - (a.sequence || 0))[0];
        if (item && !item.predecessorId) {
          // Use the durable operation's UUID/base; the normal outbox retry
          // acknowledges this exact mutation if the immediate response is lost.
          const { data, error } = await supabase.rpc('sync_mutate', {
            entity: 'profiles', operation: 'UPDATE', mutation_id: item.id,
            expected_revision: item.expectedRevision ?? null,
            payload: SyncPush.transformToPgRecord('profiles', item.payload, item.organizationId),
          });
          if (error || data?.status !== 'APPLIED') throw new Error(error?.message || 'SYNC_CONFLICT: profile edit retained.');
        }
      } catch (err: unknown) {
        // Non-fatal: sync will pick this up on next outbox push
        console.warn('Cloud profile delete update failed (will sync later):', err instanceof Error ? err.message : String(err));
      }
    }

    return { agent: deletedAgent, auditActivity };
  }
}
