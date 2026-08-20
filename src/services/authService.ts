/**
 * Authentication Service (Phase 2C)
 * Manages Supabase Auth credentials, session lifecycle, and application user profile mapping.
 * Strictly separates authentication (who you are) from authorization (roles & permissions).
 * Passwords are NEVER stored locally.
 */

import { Session, User as SupabaseAuthUser } from '@supabase/supabase-js';
import { getSupabaseClient, getSupabaseConfig } from './supabaseClient';
import { crmData } from '../db';
import { UserRepository } from '../db/repositories/userRepository';
import { SalesCRMDatabase } from '../db/database';
import { User } from '../db/types';

export interface AuthResult {
  user: User;
  session: Session;
}

let customUserRepository: UserRepository | null = null;

export class AuthService {
  /**
   * Sets custom database/user repository (for test isolation).
   */
  static setCustomDatabase(customDb: SalesCRMDatabase | null): void {
    if (customDb) {
      customUserRepository = new UserRepository(customDb);
    } else {
      customUserRepository = null;
    }
  }

  private static getUserRepo(): UserRepository {
    return customUserRepository || crmData.users;
  }

  /**
   * Signs in a user with email and password via Supabase Auth.
   * Matches the authenticated account with the local/central User profile.
   * Rejects inactive or unprovisioned users.
   */
  static async signIn(email: string, password: string): Promise<AuthResult> {
    const client = getSupabaseClient();
    if (!client) {
      const config = getSupabaseConfig();
      throw new Error(config.error || 'Authentication server is not configured.');
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      throw new Error('Please enter both email and password.');
    }

    // 1. Authenticate with Supabase
    const { data, error } = await client.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      if (error.message.toLowerCase().includes('invalid login credentials')) {
        throw new Error('Invalid email or password.');
      }
      if (error.message.toLowerCase().includes('fetch') || error.message.toLowerCase().includes('network')) {
        throw new Error('Network error. Please check your internet connection and try again.');
      }
      throw new Error(error.message || 'Authentication failed.');
    }

    if (!data.session || !data.user) {
      throw new Error('Authentication failed: No active session received.');
    }

    // 2. Look up application User profile
    const profile = await this.resolveUserProfile(data.user);

    // 3. Check if user is provisioned
    if (!profile) {
      await client.auth.signOut();
      throw new Error('Your account has not been provisioned by an administrator.');
    }

    // 4. Check if account is active
    if (profile.status !== 'ACTIVE') {
      await client.auth.signOut();
      throw new Error('Your account is inactive. Please contact your administrator.');
    }

    // 5. Record login timestamp
    const repo = this.getUserRepo();
    await repo.recordLogin(profile.id);
    profile.lastLoginAt = new Date().toISOString();

    return {
      user: profile,
      session: data.session,
    };
  }

  /**
   * Signs out the currently authenticated user and clears session tokens.
   * Does NOT touch local CRM leads, calls, remarks, or backups.
   */
  static async signOut(): Promise<void> {
    const client = getSupabaseClient();
    if (client) {
      try {
        await client.auth.signOut();
      } catch (err) {
        console.warn('Supabase sign out warning:', err);
      }
    }
  }

  /**
   * Retrieves the current Supabase session.
   */
  static async getCurrentSession(): Promise<Session | null> {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
      const { data } = await client.auth.getSession();
      return data.session;
    } catch {
      return null;
    }
  }

  /**
   * Retrieves the current Supabase Auth user.
   */
  static async getCurrentAuthUser(): Promise<SupabaseAuthUser | null> {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
      const { data } = await client.auth.getUser();
      return data.user;
    } catch {
      return null;
    }
  }

  /**
   * Resolves the corresponding local User profile for a Supabase Auth user.
   * If no local profile exists, attempts to fetch from remote Supabase `profiles` table
   * and bootstrap it into the local Dexie database (first-login on a fresh device).
   */
  static async resolveUserProfile(authUser: SupabaseAuthUser): Promise<User | null> {
    const repo = this.getUserRepo();

    // 1. Try matching by Supabase Auth UID
    let profile = await repo.getUserById(authUser.id);

    // 2. Fallback to matching by normalized email
    if (!profile && authUser.email) {
      profile = await repo.getUserByEmail(authUser.email);
    }

    // 3. If still not found locally, try fetching from remote Supabase `profiles` table
    if (!profile) {
      profile = (await this.fetchAndBootstrapRemoteProfile(authUser)) ?? undefined;
    }

    return profile || null;
  }

  /**
   * Fetches a user profile from the remote Supabase `profiles` table by auth_user_id,
   * then creates a corresponding local Dexie record so subsequent logins work offline.
   */
  private static async fetchAndBootstrapRemoteProfile(authUser: SupabaseAuthUser): Promise<User | null> {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
      // Query remote profiles table by auth_user_id
      const { data: remoteProfile, error } = await client
        .from('profiles')
        .select('*')
        .eq('auth_user_id', authUser.id)
        .maybeSingle();

      if (error || !remoteProfile) {
        console.warn('Remote profile lookup failed or not found:', error?.message);
        return null;
      }

      // Map remote snake_case columns to local camelCase User entity
      const localUser: User = {
        id: remoteProfile.id,
        organizationId: remoteProfile.organization_id || null,
        name: remoteProfile.name || authUser.email || 'Unknown',
        email: (remoteProfile.email || authUser.email || '').trim().toLowerCase(),
        phone: remoteProfile.phone || '',
        role: remoteProfile.role || 'AGENT',
        status: remoteProfile.status || 'ACTIVE',
        createdAt: remoteProfile.created_at || new Date().toISOString(),
        createdBy: remoteProfile.created_by || null,
        updatedAt: remoteProfile.updated_at || new Date().toISOString(),
        lastLoginAt: null,
        isSynced: 1,
        deletedAt: remoteProfile.deleted_at || null,
      };

      // Save into local Dexie database
      const repo = this.getUserRepo();
      try {
        await repo.createUser({
          id: localUser.id,
          organizationId: localUser.organizationId,
          name: localUser.name,
          email: localUser.email,
          phone: localUser.phone,
          role: localUser.role,
          status: localUser.status,
          createdBy: localUser.createdBy,
        });
      } catch (_createErr: unknown) {
        // If createUser fails (e.g. duplicate), try direct put
        await repo.putUser(localUser);
      }

      console.log(`Bootstrapped remote profile into local Dexie: ${localUser.email} (${localUser.role})`);
      return localUser;
    } catch (err: unknown) {
      console.warn('Failed to bootstrap remote profile:', err instanceof Error ? err.message : err);
      return null;
    }
  }

  /**
   * Validates and loads the currently authenticated profile.
   * If session is valid and profile is active, returns the User profile.
   * If inactive or unprovisioned, signs out and returns null.
   */
  static async validateAndLoadCurrentProfile(): Promise<{ user: User | null; error?: string }> {
    const session = await this.getCurrentSession();
    if (!session || !session.user) {
      return { user: null };
    }

    const profile = await this.resolveUserProfile(session.user);
    if (!profile) {
      await this.signOut();
      return {
        user: null,
        error: 'Your account has not been provisioned by an administrator.',
      };
    }

    if (profile.status !== 'ACTIVE') {
      await this.signOut();
      return {
        user: null,
        error: 'Your account is inactive. Please contact your administrator.',
      };
    }

    return { user: profile };
  }

  /**
   * Subscribes to Supabase authentication state changes.
   */
  static onAuthStateChange(
    callback: (event: string, session: Session | null) => void
  ): { unsubscribe: () => void } {
    const client = getSupabaseClient();
    if (!client) {
      return { unsubscribe: () => {} };
    }

    const { data } = client.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });

    return {
      unsubscribe: () => {
        data.subscription.unsubscribe();
      },
    };
  }

  /**
   * Returns true if there is an active valid session.
   */
  static async isAuthenticated(): Promise<boolean> {
    const session = await this.getCurrentSession();
    return session !== null;
  }
}
