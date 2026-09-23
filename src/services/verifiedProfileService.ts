import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
import { accessScopeFromUser, type AccessScope } from '../db/accessScope';
import type { User } from '../db/types';
import { getSupabaseClient } from './supabaseClient';

export interface RemoteProfileResult {
  user: User | null;
  error?: string;
}

/** Reads authorization from Supabase and maps it to the local User contract. */
export async function fetchVerifiedProfile(authUser: SupabaseAuthUser): Promise<RemoteProfileResult> {
  const client = getSupabaseClient();
  if (!client) return { user: null, error: 'Authentication server is not configured.' };

  try {
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
    if (!remoteProfile.id || !remoteProfile.organization_id || remoteProfile.deleted_at || remoteProfile.status !== 'ACTIVE') {
      return { user: null, error: 'Account access has been revoked.' };
    }
    if (remoteProfile.role !== 'ADMIN' && remoteProfile.role !== 'AGENT') {
      return { user: null, error: 'Account role is invalid or has been revoked.' };
    }

    return {
      user: {
        id: remoteProfile.id,
        serverRevision: typeof remoteProfile.sync_revision === 'number' ? remoteProfile.sync_revision : undefined,
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
      },
    };
  } catch (err: unknown) {
    console.warn('Failed to revalidate remote profile:', err instanceof Error ? err.message : err);
    return { user: null, error: 'Unable to verify account access with the server.' };
  }
}

/** Returns the currently authenticated account's server-verified local access boundary. */
export async function getVerifiedCurrentAccessScope(): Promise<AccessScope | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return null;
    const { user } = await fetchVerifiedProfile(data.user);
    return user ? accessScopeFromUser(user) : null;
  } catch {
    return null;
  }
}
