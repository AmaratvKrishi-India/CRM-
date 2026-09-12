import { execFileSync } from 'node:child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

interface LocalSupabaseConnection {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
}

export interface LocalSupabaseContext {
  apiUrl: string;
  anonKey: string;
  service: SupabaseClient;
  admin: SupabaseClient;
  agent: SupabaseClient;
  organizationId: string;
  adminProfileId: string;
  agentProfileId: string;
  cleanupLeadIds: string[];
  cleanupActivityIds: string[];
  cleanupOrganizationIds: string[];
}

function isLoopbackUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
  } catch {
    return false;
  }
}

function parseEnvironment(output: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of output.split(/\r?\n/)) {
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    values[key] = value.replace(/^(?:"|')|(?:"|')$/g, '');
  }
  return values;
}

function localConnection(): LocalSupabaseConnection {
  let output: string;
  try {
    const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
    const args = process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npx supabase status -o env']
      : ['supabase', 'status', '-o', 'env'];
    output = execFileSync(command, args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    throw new Error('Local Supabase is required for this integration suite. Start the local stack before running Vitest.');
  }

  const environment = parseEnvironment(output);
  const apiUrl = environment.API_URL;
  const anonKey = environment.ANON_KEY || environment.PUBLISHABLE_KEY;
  const serviceRoleKey = environment.SERVICE_ROLE_KEY;
  if (!apiUrl || !anonKey || !serviceRoleKey || !isLoopbackUrl(apiUrl)) {
    throw new Error('Local Supabase test configuration is missing or does not point to loopback. Refusing to run against a remote service.');
  }

  return { apiUrl, anonKey, serviceRoleKey };
}

function browserClient(apiUrl: string, key: string): SupabaseClient {
  return createClient(apiUrl, key, {
    auth: {
      // Keep independently authenticated test clients from sharing browser
      // storage or a GoTrue singleton while the suite runs in parallel.
      storageKey: `vitest-local-supabase-${crypto.randomUUID()}`,
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function signInSeedUser(client: SupabaseClient, email: string, password: string): Promise<string> {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user || !data.session) {
    throw new Error('Local Supabase seed account authentication failed. Reset or start the local stack with its seed data.');
  }
  // Supabase auth-state listeners update Realtime asynchronously. Await the
  // token handoff here so a freshly authenticated secondary client cannot
  // subscribe before its Realtime socket has the user's JWT.
  await client.realtime.setAuth(data.session.access_token);
  return data.user.id;
}

async function profileFor(service: SupabaseClient, authUserId: string) {
  const { data, error } = await service
    .from('profiles')
    .select('id, organization_id, role, status')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (error || !data || data.status !== 'ACTIVE') {
    throw new Error('Local Supabase seed profile is unavailable or inactive.');
  }
  return data as { id: string; organization_id: string; role: 'ADMIN' | 'AGENT'; status: 'ACTIVE' };
}

export async function setupLocalSupabase(): Promise<LocalSupabaseContext> {
  const connection = localConnection();
  const service = browserClient(connection.apiUrl, connection.serviceRoleKey);
  const admin = browserClient(connection.apiUrl, connection.anonKey);
  const agent = browserClient(connection.apiUrl, connection.anonKey);

  const adminAuthId = await signInSeedUser(
    admin,
    process.env.SUPABASE_TEST_ADMIN_EMAIL || 'admin@amaratvkrishi.com',
    process.env.SUPABASE_TEST_ADMIN_PASSWORD || 'Admin@123',
  );
  const agentAuthId = await signInSeedUser(
    agent,
    process.env.SUPABASE_TEST_AGENT_EMAIL || 'rahul@amaratvkrishi.com',
    process.env.SUPABASE_TEST_AGENT_PASSWORD || 'Agent@123',
  );
  const [adminProfile, agentProfile] = await Promise.all([
    profileFor(service, adminAuthId),
    profileFor(service, agentAuthId),
  ]);
  if (adminProfile.organization_id !== agentProfile.organization_id || adminProfile.role !== 'ADMIN' || agentProfile.role !== 'AGENT') {
    throw new Error('Local Supabase seed data does not provide the expected active admin and agent in one organization.');
  }

  return {
    apiUrl: connection.apiUrl,
    anonKey: connection.anonKey,
    service,
    admin,
    agent,
    organizationId: adminProfile.organization_id,
    adminProfileId: adminProfile.id,
    agentProfileId: agentProfile.id,
    cleanupLeadIds: [],
    cleanupActivityIds: [],
    cleanupOrganizationIds: [],
  };
}

export async function createAuthenticatedAgentClient(context: LocalSupabaseContext): Promise<SupabaseClient> {
  const client = browserClient(context.apiUrl, context.anonKey);
  await signInSeedUser(
    client,
    process.env.SUPABASE_TEST_AGENT_EMAIL || 'rahul@amaratvkrishi.com',
    process.env.SUPABASE_TEST_AGENT_PASSWORD || 'Agent@123',
  );
  return client;
}

export function createUnauthenticatedLocalClient(context: LocalSupabaseContext): SupabaseClient {
  return browserClient(context.apiUrl, context.anonKey);
}

export async function createTestLead(
  context: LocalSupabaseContext,
  overrides: Record<string, unknown> = {},
): Promise<any> {
  const unique = crypto.randomUUID().slice(0, 8);
  const { data, error } = await context.service
    .from('leads')
    .insert({
      organization_id: context.organizationId,
      business_name: `Phase5 Vitest Gym ${unique}`,
      category: 'Gym',
      phone: `98765${Math.floor(Math.random() * 90_000 + 10_000)}`,
      address: 'Alambagh, Lucknow 226005',
      locality: 'Alambagh',
      city: 'Lucknow',
      state: 'Uttar Pradesh',
      created_by: context.agentProfileId,
      assigned_to: context.agentProfileId,
      ...overrides,
    })
    .select()
    .single();
  if (error || !data) throw new Error('Unable to create isolated local Supabase lead fixture.');
  context.cleanupLeadIds.push(data.id);
  return data;
}

export async function createOtherOrganization(context: LocalSupabaseContext): Promise<string> {
  const { data, error } = await context.service
    .from('organizations')
    .insert({ name: `Phase5 Vitest Other Org ${crypto.randomUUID().slice(0, 8)}` })
    .select('id')
    .single();
  if (error || !data) throw new Error('Unable to create isolated second-organization fixture.');
  context.cleanupOrganizationIds.push(data.id);
  return data.id;
}

export async function cleanupLocalSupabase(context: LocalSupabaseContext): Promise<void> {
  if (context.cleanupActivityIds.length > 0) {
    await context.service.from('activities').delete().in('id', context.cleanupActivityIds);
  }
  if (context.cleanupLeadIds.length > 0) {
    await context.service.from('leads').delete().in('id', context.cleanupLeadIds);
  }
  if (context.cleanupOrganizationIds.length > 0) {
    await context.service.from('organizations').delete().in('id', context.cleanupOrganizationIds);
  }
  context.cleanupActivityIds.length = 0;
  context.cleanupLeadIds.length = 0;
  context.cleanupOrganizationIds.length = 0;
}
