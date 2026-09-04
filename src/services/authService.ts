/**
 * Authentication Service (Phase 2C)
 * Manages Supabase Auth credentials, session lifecycle, and application user profile mapping.
 * Strictly separates authentication (who you are) from authorization (roles & permissions).
 * Passwords are NEVER stored locally.
 */

import type { Session, User as SupabaseAuthUser } from '@supabase/supabase-js';
import { getSupabaseClient, getSupabaseConfig } from './supabaseClient';
import { activateCRMDataScope, crmData, lockCRMData } from '../db';
import { accessScopeFromUser, sameAccessScope } from '../db/accessScope';
import { UserRepository } from '../db/repositories/userRepository';
import type { SalesCRMDatabase } from '../db/database';
import type { User } from '../db/types';

export interface AuthResult {
  user: User;
  session: Session;
}

let customUserRepository: UserRepository | null = null;

interface RemoteProfileResult {
  user: User | null;
  error?: string;
}

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

    // Never leave the previous account's business data unlocked while a new
    // authentication attempt is in progress.
    if (!customUserRepository) await lockCRMData();

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

    // 2. Re-read authorization from the server. Cached role/status is never
    // trusted to unlock business data.
    const remote = await this.fetchRemoteProfile(data.user);
    const profile = remote.user;

    // 3. Check if user is provisioned
    if (!profile) {
      await this.signOut();
      throw new Error(remote.error || 'Your account has not been provisioned by an administrator.');
    }

    // 4. Check if account is active
    if (profile.status !== 'ACTIVE') {
      await this.signOut();
      throw new Error('Your account is inactive. Please contact your administrator.');
    }

    const scope = accessScopeFromUser(profile);
    if (customUserRepository) {
      const testScope = customUserRepository.getDatabase().requireAccessScope();
      if (!sameAccessScope(scope, testScope)) {
        await this.signOut();
        throw new Error('Verified profile does not match this local data partition.');
      }
    } else {
      await activateCRMDataScope(scope);
    }

    profile.lastLoginAt = new Date().toISOString();
    profile.isSynced = 1;
    await this.getUserRepo().putUser(profile);

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
    try {
      if (client) await client.auth.signOut();
    } catch (err) {
      console.warn('Supabase sign out warning:', err);
    } finally {
      await lockCRMData();
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
   * Resolves the profile authoritatively from Supabase and only then unlocks
   * the matching local account partition.
   */
  static async resolveUserProfile(authUser: SupabaseAuthUser): Promise<User | null> {
    const remote = await this.fetchRemoteProfile(authUser);
    if (!remote.user) {
      if (!customUserRepository) await lockCRMData();
      return null;
    }

    const scope = accessScopeFromUser(remote.user);
    if (customUserRepository) {
      const testScope = customUserRepository.getDatabase().requireAccessScope();
      if (!sameAccessScope(scope, testScope)) {
        throw new Error('Verified profile does not match the configured test data partition.');
      }
    } else {
      await activateCRMDataScope(scope);
    }

    await this.getUserRepo().putUser(remote.user);
    return remote.user;
  }

  /**
   * Fetches a user profile from the remote Supabase `profiles` table by auth_user_id,
   * then caches the verified profile in the matching local data partition.
   */
  private static async fetchRemoteProfile(authUser: SupabaseAuthUser): Promise<RemoteProfileResult> {
    const client = getSupabaseClient();
    if (!client) return { user: null, error: 'Authentication server is not configured.' };

    try {
      // Query remote profiles table by auth_user_id
      const { data: remoteProfile, error } = await client
        .from('profiles')
        .select('*')
        .eq('auth_user_id', authUser.id)
        .maybeSingle();

      if (error) {
        console.warn('Remote profile revalidation failed:', error.message);
        return { user: null, error: 'Unable to verify account access with the server.' };
      }
      if (!remoteProfile) {
        return { user: null, error: 'Account access has been revoked or is not provisioned.' };
      }

      if (
        !remoteProfile.id ||
        !remoteProfile.organization_id ||
        remoteProfile.deleted_at ||
        remoteProfile.status !== 'ACTIVE'
      ) {
        return { user: null, error: 'Account access has been revoked.' };
      }
      if (remoteProfile.role !== 'ADMIN' && remoteProfile.role !== 'AGENT') {
        return { user: null, error: 'Account role is invalid or has been revoked.' };
      }

      // Map remote snake_case columns to local camelCase User entity.
      // Role, status, organization and identity are never inferred locally.
      const localUser: User = {
        id: remoteProfile.id,
        organizationId: remoteProfile.organization_id,
        name: remoteProfile.name || authUser.email || 'Unknown',
        email: (remoteProfile.email || authUser.email || '').trim().toLowerCase(),
        phone: remoteProfile.phone || '',
        role: remoteProfile.role,
        status: remoteProfile.status,
        createdAt: remoteProfile.created_at || new Date().toISOString(),
        createdBy: remoteProfile.created_by || null,
        updatedAt: remoteProfile.updated_at || new Date().toISOString(),
        lastLoginAt: null,
        isSynced: 1,
        deletedAt: remoteProfile.deleted_at || null,
      };

      return { user: localUser };
    } catch (err: unknown) {
      console.warn('Failed to revalidate remote profile:', err instanceof Error ? err.message : err);
      return { user: null, error: 'Unable to verify account access with the server.' };
    }
  }

  /**
   * Validates and loads the currently authenticated profile.
   * If session is valid and profile is active, returns the User profile.
   * If inactive or unprovisioned, signs out and returns null.
   */
  static async validateAndLoadCurrentProfile(): Promise<{ user: User | null; error?: string }> {
    const client = getSupabaseClient();
    if (!client) {
      await lockCRMData();
      return { user: null, error: 'Authentication server is not configured.' };
    }

    // getUser() validates the token with the Auth server; getSession() alone
    // only reads locally cached credentials and is not sufficient for access.
    const { data, error: authError } = await client.auth.getUser();
    if (authError || !data.user) {
      await lockCRMData();
      return { user: null };
    }

    const remote = await this.fetchRemoteProfile(data.user);
    const profile = remote.user;
    if (!profile) {
      await this.signOut();
      return {
        user: null,
        error: remote.error || 'Your account has not been provisioned by an administrator.',
      };
    }

    if (profile.status !== 'ACTIVE') {
      await this.signOut();
      return {
        user: null,
        error: 'Your account is inactive. Please contact your administrator.',
      };
    }

    const scope = accessScopeFromUser(profile);
    if (customUserRepository) {
      const testScope = customUserRepository.getDatabase().requireAccessScope();
      if (!sameAccessScope(scope, testScope)) {
        await this.signOut();
        return { user: null, error: 'Verified profile does not match this local data partition.' };
      }
    } else {
      await activateCRMDataScope(scope);
    }
    await this.getUserRepo().putUser(profile);

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
    const { user } = await this.validateAndLoadCurrentProfile();
    return user !== null;
  }
}
