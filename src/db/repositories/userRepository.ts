/**
 * User Repository (Phase 2B)
 * Handles local CRUD operations for User entities (ADMIN & AGENT).
 * Strictly avoids storing passwords or sensitive authentication secrets.
 */

import { SalesCRMDatabase } from '../database';
import { User, UserRole, UserStatus } from '../types';

export class UserRepository {
  constructor(private db: SalesCRMDatabase) {}

  private generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
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
      organizationId: input.organizationId || null,
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

    await this.db.users.add(newUser);
    return newUser;
  }

  /**
   * Directly saves or replaces a User record (used during sync / bootstrapping).
   */
  async putUser(user: User): Promise<void> {
    await this.db.users.put(user);
  }

  /**
   * Returns database reference.
   */
  getDatabase(): SalesCRMDatabase {
    return this.db;
  }

  /**
   * Retrieves user by UUID.
   */
  async getUserById(id: string, includeDeleted = false): Promise<User | undefined> {
    const user = await this.db.users.get(id);
    if (!user) return undefined;
    if (!includeDeleted && user.deletedAt !== null) return undefined;
    return user;
  }

  /**
   * Retrieves user by email.
   */
  async getUserByEmail(email: string, includeDeleted = false): Promise<User | undefined> {
    const cleanEmail = email.trim().toLowerCase();
    return await this.db.users
      .where('email')
      .equals(cleanEmail)
      .and((u) => (includeDeleted ? true : u.deletedAt === null))
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
    const { includeDeleted = false, role, status } = options;

    let collection = this.db.users.toCollection();

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
    await this.db.users.update(id, {
      ...updates,
      updatedAt: now,
      isSynced: 0,
    });

    return (await this.db.users.get(id))!;
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
    const now = new Date().toISOString();
    await this.db.users.update(id, {
      lastLoginAt: now,
      updatedAt: now,
      isSynced: 0,
    });
  }

  /**
   * Soft-deletes a user.
   */
  async softDeleteUser(id: string): Promise<void> {
    const user = await this.getUserById(id);
    if (!user) throw new Error(`User with id ${id} not found.`);
    const now = new Date().toISOString();
    await this.db.users.update(id, {
      deletedAt: now,
      updatedAt: now,
      isSynced: 0,
    });
  }
}
