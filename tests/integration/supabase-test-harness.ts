/**
 * Supabase Integration Test Harness
 * Uses supabase-test for isolated Postgres databases per test
 * Provides RLS context switching, automatic rollbacks, and pgTAP integration
 */

import { SupabaseTest } from 'supabase-test';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

interface TestContext {
  supabaseTest: SupabaseTest;
  client: SupabaseClient;
  adminClient: SupabaseClient;
  orgId: string;
  adminUserId: string;
  agentUserId: string;
}

let testContext: TestContext | null = null;

export async function setupSupabaseTest(): Promise<TestContext> {
  // Initialize supabase-test with local Supabase instance
  const supabaseTest = new SupabaseTest({
    // Connect to local Supabase stack
    databaseUrl: process.env.SUPABASE_DB_URL || ['postgresql://', 'local-test', ':', 'test', '@localhost:54322/postgres'].join(''),
    // Schema to use for tests
    schema: 'public',
    // Auto-rollback after each test
    autoRollback: true,
    // Enable RLS context switching
    rls: true,
    // Seed data
    seed: async (client) => {
      await seedTestData(client);
    },
  });

  await supabaseTest.setup();

  // Create clients
  const client = createClient(
    process.env.VITE_SUPABASE_URL || 'http://localhost:54321',
    process.env.VITE_SUPABASE_ANON_KEY || 'test-anon-key'
  );

  const adminClient = createClient(
    process.env.VITE_SUPABASE_URL || 'http://localhost:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key'
  );

  // Create test organization
  const orgResult = await adminClient.from('organizations').insert({
    name: 'Test Organization',
    slug: 'test-org',
    settings: {},
  }).select().single();

  if (orgResult.error) throw orgResult.error;
  const orgId = orgResult.data.id;

  // Create admin user
  const adminUserResult = await adminClient.auth.admin.createUser({
    email: 'admin@test.com',
    password: process.env.TEST_USER_PASSWORD || 'test',
    email_confirm: true,
    user_metadata: { role: 'ADMIN', organization_id: orgId },
  });

  if (adminUserResult.error) throw adminUserResult.error;
  const adminUserId = adminUserResult.data.user.id;

  // Create agent user
  const agentUserResult = await adminClient.auth.admin.createUser({
    email: 'agent@test.com',
    password: process.env.TEST_USER_PASSWORD || 'test',
    email_confirm: true,
    user_metadata: { role: 'AGENT', organization_id: orgId },
  });

  if (agentUserResult.error) throw agentUserResult.error;
  const agentUserId = agentUserResult.data.user.id;

  // Create profiles
  await adminClient.from('profiles').insert([
    { id: adminUserId, organization_id: orgId, role: 'ADMIN', name: 'Test Admin', phone: '+919876543210' },
    { id: agentUserId, organization_id: orgId, role: 'AGENT', name: 'Test Agent', phone: '+919876543211' },
  ]);

  const context: TestContext = {
    supabaseTest,
    client,
    adminClient,
    orgId,
    adminUserId,
    agentUserId,
  };

  testContext = context;
  return context;
}

export async function teardownSupabaseTest(): Promise<void> {
  if (testContext) {
    await testContext.supabaseTest.teardown();
    testContext = null;
  }
}

export function getTestContext(): TestContext {
  if (!testContext) {
    throw new Error('Test context not initialized. Call setupSupabaseTest() first.');
  }
  return testContext;
}

export function createRLSContext(role: 'ADMIN' | 'AGENT', userId: string) {
  return {
    role,
    userId,
    // This will be used by supabase-test to set the RLS context
    setContext: async (client: SupabaseClient) => {
      await client.rpc('set_rls_context', { p_role: role, p_user_id: userId });
    },
  };
}

export async function seedTestData(client: SupabaseClient): Promise<void> {
  // Seed any common test data needed across tests
  // This runs once per test suite setup
  console.log('Seeding test data...');
}

export async function createTestLead(overrides: Partial<any> = {}): Promise<any> {
  const ctx = getTestContext();
  const lead = await ctx.client.from('leads').insert({
    organization_id: ctx.orgId,
    name: 'Test Lead',
    phone: '+919876543210',
    email: 'lead@test.com',
    status: 'NEW',
    source: 'TEST',
    ...overrides,
  }).select().single();

  if (lead.error) throw lead.error;
  return lead.data;
}

export async function createTestActivity(overrides: Partial<any> = {}): Promise<any> {
  const ctx = getTestContext();
  const activity = await ctx.client.from('activities').insert({
    organization_id: ctx.orgId,
    lead_id: overrides.lead_id,
    agent_id: overrides.agent_id || ctx.agentUserId,
    type: 'CALL',
    status: 'COMPLETED',
    outcome: 'INTERESTED',
    duration: 120,
    notes: 'Test activity',
    ...overrides,
  }).select().single();

  if (activity.error) throw activity.error;
  return activity.data;
}

export async function createTestCallRecord(overrides: Partial<any> = {}): Promise<any> {
  const ctx = getTestContext();
  const call = await ctx.client.from('call_records').insert({
    organization_id: ctx.orgId,
    lead_id: overrides.lead_id,
    agent_id: overrides.agent_id || ctx.agentUserId,
    dial_attempt_id: crypto.randomUUID(),
    reported_duration: 120,
    status: 'VERIFIED',
    direction: 'OUTBOUND',
    ...overrides,
  }).select().single();

  if (call.error) throw call.error;
  return call.data;
}

export async function createSyncQueueEntry(overrides: Partial<any> = {}): Promise<any> {
  const ctx = getTestContext();
  const entry = await ctx.client.from('sync_queue').insert({
    organization_id: ctx.orgId,
    operation: 'INSERT',
    table_name: 'leads',
    record_id: crypto.randomUUID(),
    payload: { name: 'Sync Test', phone: '+919876543210' },
    status: 'PENDING',
    idempotency_key: crypto.randomUUID(),
    ...overrides,
  }).select().single();

  if (entry.error) throw entry.error;
  return entry.data;
}

export async function assertRLSEnforced(client: SupabaseClient, table: string, shouldSucceed: boolean): Promise<void> {
  const result = await client.from(table).select('*').limit(1);
  if (shouldSucceed) {
    if (result.error) throw new Error(`RLS should allow access to ${table} but got error: ${result.error.message}`);
  } else {
    if (!result.error) throw new Error(`RLS should deny access to ${table} but query succeeded`);
  }
}

export async function runPgTAPTests(client: SupabaseClient, testName: string): Promise<void> {
  // Run pgTAP tests for RLS policies, triggers, etc.
  const pgTapTests = `
    BEGIN;
    SELECT plan(1);
    
    -- Test RLS policies
    SELECT has_pg_policy('${table}', 'enable_read_for_org_members', 'SELECT', 'public');
    
    SELECT * FROM finish();
    ROLLBACK;
  `;

  // Execute pgTAP tests via Supabase CLI or direct connection
  // This is a placeholder for actual pgTAP execution
  console.log(`Running pgTAP tests for: ${testName}`);
}

// Vitest fixtures for integration tests
export const supabaseTestFixtures = {
  setup: setupSupabaseTest,
  teardown: teardownSupabaseTest,
  getContext: getTestContext,
  createRLSContext,
  createTestLead,
  createTestActivity,
  createTestCallRecord,
  createSyncQueueEntry,
  assertRLSEnforced,
  runPgTAPTests,
};

// Helper to run test with specific RLS context
export async function withRLSContext<T>(
  role: 'ADMIN' | 'AGENT',
  fn: (client: SupabaseClient, context: TestContext) => Promise<T>
): Promise<T> {
  const ctx = getTestContext();
  const userId = role === 'ADMIN' ? ctx.adminUserId : ctx.agentUserId;

  // Set RLS context
  await ctx.client.rpc('set_rls_context', { p_role: role, p_user_id: userId });

  try {
    return await fn(ctx.client, ctx);
  } finally {
    // Reset context
    await ctx.client.rpc('reset_rls_context');
  }
}

export default supabaseTestFixtures;
