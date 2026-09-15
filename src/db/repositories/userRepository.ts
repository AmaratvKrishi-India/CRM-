/**
 * User Repository (Phase 2B)
 * Handles local CRUD operations for User entities (ADMIN & AGENT).
 * Strictly avoids storing passwords or sensitive authentication secrets.
 */

import type { SalesCRMDatabase } from '../database';
import { SyncQueue } from '../../services/sync/syncQueue';
import type { User, UserRole, UserStatus } from '../types';

export class UserRepository {
  private syncQueue?: SyncQueue;

  constructor(private db: SalesCRMDatabase, syncQueue?: SyncQueue) {
    this.syncQueue = syncQueue;
  }

  private getSyncQueue(): SyncQueue {
    if (!this.syncQueue) {
      this.syncQueue = new SyncQueue(this.db);
    }
    return this.syncQueue;
  }

  private generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    throw new Error('Secure random UUID generation is unavailable in this runtime.');
  }

  /**
   * Creates a local User record without passwords.
   */
  async createUser(input: {
    id?: string;
    organizationId?: string | null;
    name: string;
    email: string;
    phone: string;
    role: UserRole;
    status?: UserStatus;
    createdBy?: string | null;
  }): Promise<User> {
    const scope = this.db.requireAccessScope();
    if (scope.role !== 'ADMIN') {
      throw new Error('Only administrators can create user profiles.');
    }
    const cleanEmail = input.email.trim().toLowerCase();
    const cleanPhone = input.phone.trim();
    const cleanName = input.name.trim();

    if (!cleanEmail) throw new Error('User email cannot be empty.');
    if (!cleanName) throw new Error('User name cannot be empty.');

    // Check duplicate email
    const existing = await this.getUserByEmail(cleanEmail);
    if (existing) {
      throw new Error(`A user with email "${cleanEmail}" already exists.`);
    }

    const now = new Date().toISOString();
    const userId = input.id || this.generateId();

    // Check duplicate ID if custom ID was passed
    if (input.id) {
      const existingId = await this.getUserById(input.id, true);
      if (existingId) {
        throw new Error(`A user with ID "${input.id}" already exists.`);
      }
    }

    const newUser: User = {
      id: userId,
      organizationId: scope.organizationId,
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      role: input.role,
      status: input.status || 'ACTIVE',
      createdAt: now,
      createdBy: input.createdBy || null,
      updatedAt: now,
      lastLoginAt: null,
      isSynced: 0,
      deletedAt: null,
    };

    // Data write + outbox enqueue are atomic: either both persist or neither.
    await this.db.transaction('rw', [this.db.users, this.db.outbox], async () => {
      await this.db.users.add(newUser);
      await this.getSyncQueue().enqueue({
        entityType: 'profiles',
        entityId: newUser.id,
        operation: 'CREATE',
        payload: newUser,
        userId: scope.userId,
        organizationId: scope.organizationId,
      });
    });

    return newUser;
  }

  /**
   * Directly saves or replaces a User record (used during sync / bootstrapping).
   */
  async putUser(user: User): Promise<void> {
    const scope = this.db.requireAccessScope();
    if (user.organizationId !== scope.organizationId) {
      throw new Error('Cannot cache a profile from another organization.');
    }
    if (scope.role === 'AGENT' && user.id !== scope.userId) {
      throw new Error('Agents may cache only their own profile.');
    }
    await this.db.users.put(user);
  }

  /**
   * Returns database reference.
   */
  getDatabase(): SalesCRMDatabase {
    this.db.requireAccessScope();
    return this.db;
  }

  /**
   * Retrieves user by UUID.
   */
  async getUserById(id: string, includeDeleted = false): Promise<User | undefined> {
    const scope = this.db.requireAccessScope();
    if (scope.role === 'AGENT' && id !== scope.userId) return undefined;
    const user = await this.db.users.get(id);
    if (!user) return undefined;
    if (user.organizationId !== scope.organizationId) return undefined;
    if (!includeDeleted && user.deletedAt !== null) return undefined;
    return user;
  }

  /**
   * Retrieves user by email.
   */
  async getUserByEmail(email: string, includeDeleted = false): Promise<User | undefined> {
    const scope = this.db.requireAccessScope();
    const cleanEmail = email.trim().toLowerCase();
    return await this.db.users
      .where('email')
      .equals(cleanEmail)
      .and(
        (u) =>
          u.organizationId === scope.organizationId &&
          (scope.role === 'ADMIN' || u.id === scope.userId) &&
          (includeDeleted || u.deletedAt === null)
      )
      .first();
  }

  /**
   * Returns all users filtered by status/role.
   */
  async getAllUsers(options: {
    includeDeleted?: boolean;
    role?: UserRole;
    status?: UserStatus;
  } = {}): Promise<User[]> {
    const scope = this.db.requireAccessScope();
    const { includeDeleted = false, role, status } = options;

    let collection = this.db.users.toCollection();
    collection = collection.filter(
      (user) => user.organizationId === scope.organizationId && (scope.role === 'ADMIN' || user.id === scope.userId)
    );

    if (!includeDeleted) {
      collection = collection.filter((u) => u.deletedAt === null);
    }
    if (role) {
      collection = collection.filter((u) => u.role === role);
    }
    if (status) {
      collection = collection.filter((u) => u.status === status);
    }

    return await collection.sortBy('name');
  }

  /**
   * Updates user metadata (name, phone, role, status).
   */
  async updateUser(id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User> {
    const scope = this.db.requireAccessScope();
    if (scope.role !== 'ADMIN') {
      throw new Error('Only administrators can update user profiles.');
    }
    const existing = await this.getUserById(id, true);
    if (!existing) throw new Error(`User with id ${id} not found.`);

    if (updates.email && updates.email.trim().toLowerCase() !== existing.email) {
      const cleanEmail = updates.email.trim().toLowerCase();
      const duplicate = await this.getUserByEmail(cleanEmail);
      if (duplicate && duplicate.id !== id) {
        throw new Error(`Another user with email "${cleanEmail}" already exists.`);
      }
      updates.email = cleanEmail;
    }

    const now = new Date().toISOString();
    let updated: User | undefined;
    // Data write + outbox enqueue are atomic: either both persist or neither.
    await this.db.transaction('rw', [this.db.users, this.db.outbox], async () => {
      await this.db.users.update(id, {
        ...updates,
        updatedAt: now,
        isSynced: 0,
      });
      updated = await this.db.users.get(id);
      if (updated) {
        await this.getSyncQueue().enqueue({
          entityType: 'profiles',
          entityId: updated.id,
          operation: 'UPDATE',
          payload: updated,
          userId: scope.userId,
          organizationId: scope.organizationId,
        });
      }
    });

    return updated!;
  }

  /**
   * Sets active/inactive status.
   */
  async setUserStatus(id: string, status: UserStatus): Promise<User> {
    return this.updateUser(id, { status });
  }

  /**
   * Updates last login timestamp.
   */
  async recordLogin(id: string): Promise<void> {
    const scope = this.db.requireAccessScope();
    if (id !== scope.userId) throw new Error('Cannot record a login for another user.');
    const now = new Date().toISOString();
    await this.db.users.update(id, {
      lastLoginAt: now,
      updatedAt: now,
      isSynced: 0,
    });
  }

  /**
   * Soft-deletes a user (sets deletedAt only — legacy compat).
   */
  async softDeleteUser(id: string): Promise<void> {
    const scope = this.db.requireAccessScope();
    if (scope.role !== 'ADMIN') throw new Error('Only administrators can delete users.');
    const user = await this.getUserById(id);
    if (!user) throw new Error(`User with id ${id} not found.`);
    const now = new Date().toISOString();
    // Data write + outbox enqueue are atomic: either both persist or neither.
    await this.db.transaction('rw', [this.db.users, this.db.outbox], async () => {
      await this.db.users.update(id, {
        deletedAt: now,
        updatedAt: now,
        isSynced: 0,
      });
      const updated = await this.db.users.get(id);
      if (updated) {
        await this.getSyncQueue().enqueue({
          entityType: 'profiles',
          entityId: updated.id,
          operation: 'UPDATE',
          payload: updated,
          userId: scope.userId,
          organizationId: scope.organizationId,
        });
      }
    });
  }

  /**
   * Permanently soft-deletes an agent: sets deletedAt + status INACTIVE.
   * All historical CRM records are preserved. Login is immediately blocked.
   */
  async deleteUser(id: string): Promise<User> {
    const scope = this.db.requireAccessScope();
    if (scope.role !== 'ADMIN') throw new Error('Only administrators can delete users.');
    const user = await this.getUserById(id, true);
    if (!user) throw new Error(`User with id ${id} not found.`);
    const now = new Date().toISOString();
    let updated: User | undefined;
    // Data write + outbox enqueue are atomic: either both persist or neither.
    await this.db.transaction('rw', [this.db.users, this.db.outbox], async () => {
      await this.db.users.update(id, {
        status: 'INACTIVE',
        deletedAt: now,
        updatedAt: now,
        isSynced: 0,
      });
      updated = await this.db.users.get(id);
      if (updated) {
        await this.getSyncQueue().enqueue({
          entityType: 'profiles',
          entityId: updated.id,
          operation: 'UPDATE',
          payload: updated,
          userId: scope.userId,
          organizationId: scope.organizationId,
        });
      }
    });

    return updated!;
  }

  /**
   * Returns only ACTIVE, non-deleted agents suitable for lead assignment.
   */
  async getActiveAgentsForAssignment(): Promise<User[]> {
    const scope = this.db.requireAccessScope();
    if (scope.role !== 'ADMIN') return [];
    return await this.db.users
      .toCollection()
      .filter((u) => u.organizationId === scope.organizationId && u.role === 'AGENT' && u.status === 'ACTIVE' && u.deletedAt === null)
      .sortBy('name');
  }
}
