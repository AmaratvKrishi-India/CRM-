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
      .eq('deleted_at', null)
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
    const { name, email, phone, password } = body;

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

    const normalizedEmail = email.trim().toLowerCase();
    const cleanPhone = phone ? String(phone).trim() : '';

    // 5. Check for Existing Profile with same Email in the Organization
    const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
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
      return new Response(
        JSON.stringify({ error: 'An account with this email already exists in this organization.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Step 1: Create Supabase Auth User with Admin API
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

    // 7. Step 2: Insert into public.profiles
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
      version: 1,
    };

    const { data: insertedProfile, error: profileInsertError } = await supabaseAdmin
      .from('profiles')
      .insert(profilePayload)
      .select()
      .single();

    // 8. Compensation / Rollback: If profile creation fails, remove any partial
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

    // 9. Step 3: Record Immutable Append-Only Audit Event
    // Passwords or secrets are NEVER included in activity metadata
    const auditId = crypto.randomUUID();
    activeAuditId = auditId;
    const auditActivity = {
      id: auditId,
      organization_id: callerProfile.organization_id,
      lead_id: null,
      user_id: callerProfile.id,
      device_id: req.headers.get('x-device-id') || null,
      activity_type: 'AGENT_CREATED',
      metadata: {
        agentId: insertedProfile.id,
        agentName: insertedProfile.name,
        agentEmail: insertedProfile.email,
        agentPhone: insertedProfile.phone,
        provisionedByAdmin: callerProfile.name,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
    };

    const { error: auditInsertError } = await supabaseAdmin.from('activities').insert(auditActivity);

    if (auditInsertError) {
      console.error('Audit activity creation failed; initiating rollback:', auditInsertError);
      // An insert can commit before its response fails. Resolve the audit row
      // first so compensation cannot leave an append-only event pointing at a
      // deleted agent.
      const auditWriteState = await resolveAuditWrite(supabaseAdmin, auditId);
      if (auditWriteState !== 'absent') {
        console.error('Audit write state is not safely absent; retaining agent for manual reconciliation:', auditWriteState);
        return new Response(
          JSON.stringify({ error: 'Agent provisioning could not be confirmed safely after an audit failure. Manual reconciliation is required.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const rollbackErrors = await rollbackProvisionedAgent(supabaseAdmin, newAuthUserId);

      if (rollbackErrors.length > 0) {
        console.error('Audit failure rollback was incomplete:', rollbackErrors);
        return new Response(
          JSON.stringify({ error: 'Agent provisioning failed and cleanup was incomplete. Manual remediation is required.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Agent provisioning failed because the audit record could not be created. Auth identity and profile were rolled back.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 10. Return Sanitized Result (No passwords in response)
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Agent created successfully.',
        agent: {
          id: insertedProfile.id,
          authUserId: insertedProfile.auth_user_id,
          organizationId: insertedProfile.organization_id,
          name: insertedProfile.name,
          email: insertedProfile.email,
          phone: insertedProfile.phone,
          role: insertedProfile.role,
          status: insertedProfile.status,
          createdBy: insertedProfile.created_by,
          createdAt: insertedProfile.created_at,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Unhandled Edge Function error:', err);

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
