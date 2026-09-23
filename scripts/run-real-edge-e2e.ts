import { spawn, type ChildProcess } from 'node:child_process';
import { dirname, join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import {
  cleanupLocalSupabase,
  setupLocalSupabase,
  type LocalSupabaseContext,
} from '../tests/integration/local-supabase';
import { stopOwnedProcessTree } from './process-watchdog';

const FUNCTION_NAME = 'create-agent';

function assertLoopback(value: string): void {
  const hostname = new URL(value).hostname.toLowerCase();
  if (!['127.0.0.1', 'localhost', '::1'].includes(hostname)) {
    throw new Error('Real Edge Function tests require a loopback Supabase URL.');
  }
}

async function functionIsReady(apiUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(`${apiUrl}/functions/v1/${FUNCTION_NAME}`, { method: 'OPTIONS', signal: controller.signal });
    return response.status === 200;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function startFunctionServer(apiUrl: string): Promise<ChildProcess | null> {
  if (await functionIsReady(apiUrl)) return null;

  const npxCli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js');
  const command = process.platform === 'win32' ? process.execPath : 'npx';
  const args = process.platform === 'win32'
    ? [npxCli, '--no-install', 'supabase', 'functions', 'serve', FUNCTION_NAME]
    : ['supabase', 'functions', 'serve', FUNCTION_NAME];
  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: ['ignore', 'ignore', 'pipe'],
    shell: false,
    windowsHide: true,
    detached: process.platform !== 'win32',
  });
  let stderr = '';
  child.stderr?.on('data', (chunk) => {
    stderr = `${stderr}${chunk.toString()}`.slice(-2_000);
  });

  for (let attempt = 0; attempt < 180; attempt += 1) {
    if (await functionIsReady(apiUrl)) return child;
    if (child.exitCode !== null) {
      throw new Error(`Local Edge Function server exited before readiness: ${stderr.trim() || 'unknown error'}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const snapshot = stopOwnedProcessTree(child.pid);
  throw new Error(`Local Edge Function server did not become ready: ${stderr.trim() || 'timeout'}; process=${JSON.stringify(snapshot)}`);
}

async function invoke(
  context: LocalSupabaseContext,
  accessToken: string | null,
  payload: Record<string, unknown>,
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {
    apikey: context.anonKey,
    'Content-Type': 'application/json',
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const response = await fetch(`${context.apiUrl}/functions/v1/${FUNCTION_NAME}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let body: any = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return { status: response.status, body };
}

async function sessionToken(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getSession();
  if (error || !data.session?.access_token) throw new Error('Seed session token is unavailable.');
  return data.session.access_token;
}

async function main(): Promise<void> {
  let context: LocalSupabaseContext | undefined;
  let server: ChildProcess | null = null;
  let createdAuthUserId: string | null = null;
  let createdProfileId: string | null = null;
  let createdEmail: string | null = null;

  try {
    context = await setupLocalSupabase();
    assertLoopback(context.apiUrl);
    server = await startFunctionServer(context.apiUrl);

    const adminToken = await sessionToken(context.admin);
    const idempotencyKey = randomUUID();
    createdEmail = `edge-real-${randomUUID().slice(0, 8)}@example.test`;
    const payload = {
      name: 'Real Edge Test Agent',
      email: createdEmail,
      phone: '',
      password: `Edge-${randomUUID()}-A9!`,
      idempotencyKey,
    };

    const created = await invoke(context, adminToken, payload);
    if (created.status !== 200 || created.body?.success !== true || !created.body.agent?.id) {
      throw new Error(`Real create-agent request failed with HTTP ${created.status}.`);
    }
    if (JSON.stringify(created.body).includes(payload.password)) {
      throw new Error('create-agent response leaked the provisioning password.');
    }
    createdAuthUserId = created.body.agent.authUserId;
    createdProfileId = created.body.agent.id;
    if (created.body.agent.role !== 'AGENT' || created.body.agent.organizationId !== context.organizationId) {
      throw new Error('create-agent returned an invalid role or organization.');
    }

    const replay = await invoke(context, adminToken, payload);
    if (replay.status !== 200 || replay.body?.replayed !== true || replay.body.agent?.id !== createdProfileId) {
      throw new Error('create-agent idempotent replay did not return the original agent.');
    }

    const changedReplay = await invoke(context, adminToken, { ...payload, name: 'Changed Identity' });
    if (changedReplay.status !== 409) throw new Error('Idempotency-key reuse was not rejected.');

    const unauthenticated = await invoke(context, null, payload);
    if (unauthenticated.status !== 401) throw new Error('Unauthenticated create-agent request was not rejected.');

    const agentToken = await sessionToken(context.agent);
    const nonAdmin = await invoke(context, agentToken, {
      ...payload,
      email: `edge-nonadmin-${randomUUID().slice(0, 8)}@example.test`,
      idempotencyKey: randomUUID(),
    });
    if (nonAdmin.status !== 403) throw new Error('Non-admin create-agent request was not rejected.');

    const { data: profile, error: profileError } = await context.service
      .from('profiles')
      .select('id, auth_user_id, organization_id, role, status, provisioning_completed_at')
      .eq('id', createdProfileId)
      .single();
    if (profileError || !profile || profile.auth_user_id !== createdAuthUserId
      || profile.organization_id !== context.organizationId || profile.role !== 'AGENT'
      || profile.status !== 'ACTIVE' || !profile.provisioning_completed_at) {
      throw new Error('The Edge Function did not persist a finalized agent profile.');
    }

    const { data: activities, error: activityError } = await context.service
      .from('activities')
      .select('id, metadata, activity_type, user_id, organization_id')
      .eq('organization_id', context.organizationId)
      .eq('activity_type', 'AGENT_CREATED');
    const audit = activities?.find((activity: any) => activity.metadata?.agentId === createdProfileId);
    if (activityError || !audit || audit.user_id !== context.adminProfileId) {
      throw new Error('The Edge Function did not persist the expected AGENT_CREATED audit.');
    }

    console.log('Real create-agent Edge Function: PASS');
    console.log('Verified: admin auth, provisioning, sanitized response, replay/idempotency, non-admin rejection, persistence, audit.');
  } finally {
    if (server) stopOwnedProcessTree(server.pid);
    if (context && createdProfileId) {
      await context.service.from('activities').delete().eq('activity_type', 'AGENT_CREATED').contains('metadata', { agentId: createdProfileId });
      await context.service.from('profiles').delete().eq('id', createdProfileId);
    }
    if (context && createdAuthUserId) await context.service.auth.admin.deleteUser(createdAuthUserId);
    if (context) await cleanupLocalSupabase(context);
    // Keep the name in memory for diagnostics without ever printing credentials.
    void createdEmail;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Real Edge Function test failed.');
  process.exitCode = 1;
});
