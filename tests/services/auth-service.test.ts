/**
 * AuthService regression tests using a real isolated Dexie partition and an
 * explicit Supabase boundary stub. Passwords and tokens are never written to
 * localStorage by the application service.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SalesCRMDatabase } from '@/db/database';
import { adminScope, agentScope, createVitestDatabase, disposeVitestDatabase } from '../helpers/vitestDatabase';

const { getSupabaseClientMock, getSupabaseConfigMock } = vi.hoisted(() => ({
  getSupabaseClientMock: vi.fn(),
  getSupabaseConfigMock: vi.fn(),
}));

vi.mock('@/services/supabaseClient', () => ({
  getSupabaseClient: getSupabaseClientMock,
  getSupabaseConfig: getSupabaseConfigMock,
}));

import { AuthService } from '@/services/authService';

describe('AuthService', () => {
  let database: SalesCRMDatabase;

  const authUser = {
    id: agentScope.userId,
    email: 'agent-vitest@example.test',
  };

  const session = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: 4_000_000_000,
    user: authUser,
  };

  function activeProfile(overrides: Record<string, unknown> = {}) {
    return {
      id: agentScope.userId,
      auth_user_id: agentScope.userId,
      organization_id: agentScope.organizationId,
      name: 'Vitest Agent',
      email: authUser.email,
      phone: '9876543210',
      role: 'AGENT',
      status: 'ACTIVE',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
      deleted_at: null,
      ...overrides,
    };
  }

  function client(options: {
    signIn?: { data: any; error: any };
    session?: any;
    getUser?: { data: any; error?: any };
    profile?: { data: any; error: any };
    signOutError?: any;
    authUser?: any;
  } = {}) {
    const authenticatedUser = options.authUser || authUser;
    const activeSession = options.session === undefined
      ? { ...session, user: authenticatedUser }
      : options.session;
    const profile = options.profile || { data: activeProfile(), error: null };
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue(profile),
    };
    return {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue(options.signIn || { data: { user: authenticatedUser, session: activeSession }, error: null }),
        signOut: vi.fn().mockResolvedValue({ error: options.signOutError || null }),
        getSession: vi.fn().mockResolvedValue({ data: { session: activeSession }, error: null }),
        getUser: vi.fn().mockResolvedValue(options.getUser || { data: { user: authenticatedUser }, error: null }),
        onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      },
      from: vi.fn().mockReturnValue(query),
    } as any;
  }

  beforeEach(() => {
    database = createVitestDatabase('auth');
    AuthService.setCustomDatabase(database);
    getSupabaseConfigMock.mockReturnValue({ error: 'Authentication server is not configured.' });
  });

  afterEach(async () => {
    AuthService.setCustomDatabase(null);
    getSupabaseClientMock.mockReset();
    getSupabaseConfigMock.mockReset();
    await disposeVitestDatabase(database);
  });

  it('should sign in successfully with valid credentials', async () => {
    const supabase = client();
    getSupabaseClientMock.mockReturnValue(supabase);

    const result = await AuthService.signIn(' AGENT-VITEST@example.test ', 'valid-password');

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'agent-vitest@example.test', password: 'valid-password' });
    expect(result).toMatchObject({ user: { id: agentScope.userId, role: 'AGENT' }, session });
    expect(await database.users.get(agentScope.userId)).toMatchObject({ email: 'agent-vitest@example.test', isSynced: 1 });
  });

  it('should handle invalid credentials without exposing provider details', async () => {
    getSupabaseClientMock.mockReturnValue(client({
      signIn: { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } },
    }));

    await expect(AuthService.signIn(authUser.email, 'bad-password')).rejects.toThrow('Invalid email or password.');
  });

  it('should handle network errors with actionable messaging', async () => {
    getSupabaseClientMock.mockReturnValue(client({
      signIn: { data: { user: null, session: null }, error: { message: 'fetch failed' } },
    }));

    await expect(AuthService.signIn(authUser.email, 'valid-password')).rejects.toThrow('Network error');
  });

  it('should sign out and call the authentication provider', async () => {
    const supabase = client();
    getSupabaseClientMock.mockReturnValue(supabase);

    await expect(AuthService.signOut()).resolves.toBeUndefined();
    expect(supabase.auth.signOut).toHaveBeenCalledOnce();
  });

  it('should complete local lock-down when provider sign-out reports an error', async () => {
    const supabase = client({ signOutError: { message: 'temporary provider error' } });
    getSupabaseClientMock.mockReturnValue(supabase);

    await expect(AuthService.signOut()).resolves.toBeUndefined();
    expect(supabase.auth.signOut).toHaveBeenCalledOnce();
  });

  it('should return the current Supabase session', async () => {
    getSupabaseClientMock.mockReturnValue(client());
    await expect(AuthService.getCurrentSession()).resolves.toEqual(session);
  });

  it('should return null when no session is present', async () => {
    getSupabaseClientMock.mockReturnValue(client({ session: null }));
    await expect(AuthService.getCurrentSession()).resolves.toBeNull();
  });

  it('should revalidate an active profile from the server before loading it', async () => {
    const supabase = client();
    getSupabaseClientMock.mockReturnValue(supabase);

    const result = await AuthService.validateAndLoadCurrentProfile();

    expect(result.user).toMatchObject({ id: agentScope.userId, organizationId: agentScope.organizationId });
    expect(supabase.from).toHaveBeenCalledWith('profiles');
  });

  it('should require authentication when token validation fails', async () => {
    getSupabaseClientMock.mockReturnValue(client({ getUser: { data: { user: null }, error: { message: 'expired' } } }));
    await expect(AuthService.validateAndLoadCurrentProfile()).resolves.toEqual({ user: null });
  });

  it('should not store an application-managed session in localStorage', async () => {
    getSupabaseClientMock.mockReturnValue(client());
    await AuthService.signIn(authUser.email, 'valid-password');

    expect(window.localStorage.setItem).not.toHaveBeenCalled();
    expect(window.localStorage.getItem).not.toHaveBeenCalledWith('auth_session');
  });

  it('should not restore authorization from localStorage without server revalidation', async () => {
    window.localStorage.getItem.mockReturnValue(JSON.stringify({ user: { id: 'forged-user' } }));
    getSupabaseClientMock.mockReturnValue(client({ getUser: { data: { user: null }, error: { message: 'expired' } } }));

    await expect(AuthService.validateAndLoadCurrentProfile()).resolves.toEqual({ user: null });
  });

  it('should not persist passwords or application session data on sign out', async () => {
    const supabase = client();
    getSupabaseClientMock.mockReturnValue(supabase);

    await AuthService.signOut();

    expect(window.localStorage.removeItem).not.toHaveBeenCalledWith('auth_session');
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
  });

  it('should return the role supplied by the verified profile', async () => {
    await disposeVitestDatabase(database);
    database = createVitestDatabase('auth_admin', adminScope);
    AuthService.setCustomDatabase(database);
    const adminUser = { id: adminScope.userId, email: 'admin-vitest@example.test' };
    getSupabaseClientMock.mockReturnValue(client({
      authUser: adminUser,
      profile: {
        data: activeProfile({
          id: adminScope.userId,
          auth_user_id: adminScope.userId,
          email: adminUser.email,
          role: 'ADMIN',
        }),
        error: null,
      },
    }));
    const result = await AuthService.signIn(adminUser.email, 'valid-password');

    expect(result.user.role).toBe('ADMIN');
  });

  it('should retain the AGENT role for an agent profile', async () => {
    getSupabaseClientMock.mockReturnValue(client());
    const result = await AuthService.signIn(authUser.email, 'valid-password');

    expect(result.user.role).toBe('AGENT');
  });
});
