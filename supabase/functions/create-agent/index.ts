// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This code runs in the Supabase Edge Function environment with native Deno support.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const agentResponse = (profile: any) => ({
  id: profile.id,
  authUserId: profile.auth_user_id,
  organizationId: profile.organization_id,
  name: profile.name,
  email: profile.email,
  phone: profile.phone,
  role: profile.role,
  status: profile.status,
  createdBy: profile.created_by,
  createdAt: profile.created_at,
  updatedAt: profile.updated_at,
  serverRevision: profile.sync_revision,
});

const rollbackProvisionedAgent = async (supabaseAdmin: any, authUserId: string): Promise<string[]> => {
  const errors: string[] = [];

  try {
    const { error } = await supabaseAdmin.from('profiles').delete().eq('id', authUserId);
    if (error) errors.push(`profile: ${error.message || 'delete failed'}`);
  } catch (error: any) {
    errors.push(`profile: ${error?.message || 'delete rejected'}`);
  }

  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
    if (error) errors.push(`auth: ${error.message || 'delete failed'}`);
  } catch (error: any) {
    errors.push(`auth: ${error?.message || 'delete rejected'}`);
  }

  return errors;
};

const resolveAuditWrite = async (supabaseAdmin: any, auditId: string): Promise<'present' | 'absent' | 'unknown'> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('activities')
      .select('id')
      .eq('id', auditId)
      .maybeSingle();
    if (error) {
      console.error('Unable to resolve audit write state:', error);
      return 'unknown';
    }
    return data ? 'present' : 'absent';
  } catch (error) {
    console.error('Unable to resolve audit write state:', error);
    return 'unknown';
  }
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let supabaseAdmin: any = null;
  let provisionedAuthUserId: string | null = null;
  let activeAuditId: string | null = null;
  let activeProvisioningKey: string | null = null;
  let activeOrganizationId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: missing environment variables.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Authenticate Caller using the incoming Authorization Header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing Authorization header.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: { user: callerUser }, error: callerAuthError } = await callerClient.auth.getUser();
    if (callerAuthError || !callerUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or expired authentication session.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Privileged Admin Client (Used only server-side within this Edge Function)
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    // 3. Verify Caller Profile: Must be an ACTIVE ADMIN
    const { data: callerProfile, error: profileFetchError } = await supabaseAdmin
      .from('profiles')
      .select('id, organization_id, role, status, name')
      .eq('auth_user_id', callerUser.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (profileFetchError || !callerProfile) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Caller profile not found or database error.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (callerProfile.status !== 'ACTIVE') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Deactivated administrators cannot provision agents.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (callerProfile.role !== 'ADMIN') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Only administrators are authorized to provision agent accounts.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!callerProfile.organization_id) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Administrator does not belong to a valid organization.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Parse & Validate Payload
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON request body.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const { name, email, phone, password, idempotencyKey } = body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return new Response(
        JSON.stringify({ error: 'Invalid name: Full name must be at least 2 characters.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters in length.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!idempotencyKey || typeof idempotencyKey !== 'string' || !uuidRegex.test(idempotencyKey)) {
      return new Response(
        JSON.stringify({ error: 'A valid idempotency key is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const cleanPhone = phone ? String(phone).trim() : '';
    activeProvisioningKey = idempotencyKey;
    activeOrganizationId = callerProfile.organization_id;

    // 5. A completed request is replayed from durable server state. Reusing a
    // key for different non-secret identity input is rejected instead of
    // reinterpreted. Passwords are deliberately never persisted for comparison.
    const { data: keyedProfile, error: keyedProfileError } = await supabaseAdmin
      .from('profiles')
      .select('id, auth_user_id, organization_id, name, email, phone, role, status, created_by, created_at, updated_at, sync_revision, provisioning_completed_at')
      .eq('organization_id', callerProfile.organization_id)
      .eq('provisioning_key', idempotencyKey)
      .maybeSingle();

    if (keyedProfileError) {
      console.error('Idempotency lookup failed:', keyedProfileError);
      return new Response(
        JSON.stringify({ error: 'Unable to verify the provisioning request.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (keyedProfile) {
      if (keyedProfile.role !== 'AGENT'
        || keyedProfile.email.toLowerCase() !== normalizedEmail
        || keyedProfile.name.trim() !== name.trim()
        || (keyedProfile.phone || '').trim() !== cleanPhone) {
        return new Response(
          JSON.stringify({ error: 'Idempotency key was already used for a different request.' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (!keyedProfile.provisioning_completed_at) {
        return new Response(
          JSON.stringify({ error: 'Agent provisioning is still in progress. Retry this request shortly.' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ success: true, replayed: true, message: 'Agent already exists.', agent: agentResponse(keyedProfile) }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Check for Existing Profile with same Email in the Organization.
    const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
      .from('profiles')
      .select('id, auth_user_id, organization_id, name, email, phone, role, status, created_by, created_at, updated_at, sync_revision, provisioning_completed_at')
      .eq('organization_id', callerProfile.organization_id)
      .eq('email', normalizedEmail)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingProfileError) {
      console.error('Existing profile lookup failed:', existingProfileError);
      return new Response(
        JSON.stringify({ error: 'Unable to verify whether the agent email is already registered.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (existingProfile) {
      if (existingProfile.role === 'AGENT') {
        if (!existingProfile.provisioning_completed_at) {
          return new Response(
            JSON.stringify({ error: 'Agent provisioning is still in progress. Retry this request shortly.' }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({ success: true, replayed: true, message: 'Agent already exists.', agent: agentResponse(existingProfile) }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'An account with this email already exists in this organization.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Atomically reserve capacity using only the verified caller profile.
    // The database function serializes requests per organization, so this is
    // shared across Edge isolates and cannot be bypassed with client headers.
    const { data: rateDecision, error: rateLimitError } = await supabaseAdmin.rpc('reserve_agent_provisioning', {
      target_organization: callerProfile.organization_id,
      target_administrator: callerProfile.id,
    });

    if (rateLimitError || !rateDecision || typeof rateDecision.allowed !== 'boolean') {
      console.error('Agent provisioning rate-limit check failed:', rateLimitError);
      return new Response(
        JSON.stringify({ error: 'Agent provisioning is temporarily unavailable.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!rateDecision.allowed) {
      const retryAfter = Math.max(1, Number(rateDecision.retryAfterSeconds) || 1);
      return new Response(
        JSON.stringify({ error: 'Too many agent provisioning requests. Please retry later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) } }
      );
    }

    // 8. Step 1: Create Supabase Auth User with Admin API
    const { data: newAuthData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        name: name.trim(),
        phone: cleanPhone,
      },
    });

    if (createAuthError || !newAuthData?.user) {
      const errorMsg = createAuthError?.message || 'Failed to create authentication credentials.';
      if (errorMsg.toLowerCase().includes('already') || errorMsg.toLowerCase().includes('registered')) {
        return new Response(
          JSON.stringify({ error: 'An account with this email already exists in Supabase Auth.' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newAuthUserId = newAuthData.user.id;
    provisionedAuthUserId = newAuthUserId;

    // 9. Step 2: Insert into public.profiles
    // Note: organization_id is strictly inherited from callerProfile (client input is ignored)
    // Role is strictly forced to AGENT
    const profilePayload = {
      id: newAuthUserId,
      auth_user_id: newAuthUserId,
      organization_id: callerProfile.organization_id,
      name: name.trim(),
      email: normalizedEmail,
      phone: cleanPhone,
      role: 'AGENT',
      status: 'ACTIVE',
      created_by: callerProfile.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      provisioning_key: idempotencyKey,
      version: 1,
    };

    const { data: insertedProfile, error: profileInsertError } = await supabaseAdmin
      .from('profiles')
      .insert(profilePayload)
      .select()
      .single();

    // 10. Compensation / Rollback: If profile creation fails, remove any partial
    // profile and the created auth user. Each cleanup operation is isolated so a
    // rejected network request cannot skip the remaining compensation step.
    if (profileInsertError || !insertedProfile) {
      console.error('Profile creation failed; initiating rollback:', profileInsertError);
      const rollbackErrors = await rollbackProvisionedAgent(supabaseAdmin, newAuthUserId);

      if (rollbackErrors.length > 0) {
        console.error('Agent rollback was incomplete:', rollbackErrors);
        return new Response(
          JSON.stringify({ error: 'Agent provisioning failed and cleanup was incomplete. Manual remediation is required.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const duplicate = /already exists|duplicate|unique/i.test(profileInsertError?.message || '');
      return new Response(
        JSON.stringify({ error: duplicate
          ? 'An account with this email already exists in this organization.'
          : 'Failed to create agent profile. Auth identity and profile were rolled back.' }),
        { status: duplicate ? 409 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 11. Finalize the profile and immutable audit event in one database transaction.
    const auditId = crypto.randomUUID();
    activeAuditId = auditId;
    const auditMetadata = {
      agentId: insertedProfile.id,
      agentName: insertedProfile.name,
      agentEmail: insertedProfile.email,
      agentPhone: insertedProfile.phone,
      provisionedByAdmin: callerProfile.name,
    };
    const { data: finalizedProfile, error: finalizeError } = await supabaseAdmin.rpc('finalize_agent_provisioning', {
      target_organization: callerProfile.organization_id,
      target_profile: insertedProfile.id,
      target_provisioning_key: idempotencyKey,
      audit_id: auditId,
      administrator: callerProfile.id,
      audit_device_id: req.headers.get('x-device-id') || null,
      audit_metadata: auditMetadata,
    });

    if (finalizeError || !finalizedProfile) {
      const { data: resolvedProfile, error: resolveError } = await supabaseAdmin
        .from('profiles')
        .select('id, auth_user_id, organization_id, name, email, phone, role, status, created_by, created_at, updated_at, sync_revision, provisioning_completed_at')
        .eq('organization_id', callerProfile.organization_id)
        .eq('provisioning_key', idempotencyKey)
        .maybeSingle();
      if (resolveError) throw new Error('Unable to resolve provisioning finalization state safely.');
      if (resolvedProfile?.provisioning_completed_at) {
        return new Response(JSON.stringify({ success: true, replayed: true, message: 'Agent created successfully.', agent: agentResponse(resolvedProfile) }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const rollbackErrors = await rollbackProvisionedAgent(supabaseAdmin, newAuthUserId);
      if (rollbackErrors.length) throw new Error('Agent provisioning failed and cleanup was incomplete. Manual remediation is required.');
      return new Response(JSON.stringify({ error: 'Agent provisioning finalization failed. Auth identity and profile were rolled back.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 12. Return Sanitized Result (No passwords in response)
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Agent created successfully.',
        agent: agentResponse(finalizedProfile),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Unhandled Edge Function error:', err);

    if (supabaseAdmin && activeProvisioningKey && activeOrganizationId) {
      const { data: completedProfile, error: completedProfileError } = await supabaseAdmin
        .from('profiles')
        .select('id, auth_user_id, organization_id, name, email, phone, role, status, created_by, created_at, updated_at, sync_revision, provisioning_completed_at')
        .eq('organization_id', activeOrganizationId)
        .eq('provisioning_key', activeProvisioningKey)
        .maybeSingle();
      if (completedProfileError) {
        return new Response(JSON.stringify({ error: 'Agent provisioning state is uncertain. Manual reconciliation is required.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (completedProfile?.provisioning_completed_at) {
        return new Response(JSON.stringify({ success: true, replayed: true, message: 'Agent created successfully.', agent: agentResponse(completedProfile) }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    if (supabaseAdmin && provisionedAuthUserId) {
      if (activeAuditId) {
        const auditWriteState = await resolveAuditWrite(supabaseAdmin, activeAuditId);
        if (auditWriteState !== 'absent') {
          return new Response(
            JSON.stringify({ error: 'Agent provisioning could not be confirmed safely after an audit failure. Manual reconciliation is required.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      const rollbackErrors = await rollbackProvisionedAgent(supabaseAdmin, provisionedAuthUserId);
      if (rollbackErrors.length > 0) {
        console.error('Unhandled error rollback was incomplete:', rollbackErrors);
        return new Response(
          JSON.stringify({ error: 'Agent provisioning failed and cleanup was incomplete. Manual remediation is required.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error during agent provisioning.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
