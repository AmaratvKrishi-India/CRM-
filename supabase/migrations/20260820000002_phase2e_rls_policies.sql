-- ====================================================================
-- Amaratv Krishi Field Sales CRM — Row Level Security (RLS) Foundation (Phase 2E)
-- PostgreSQL / Supabase Migration
-- Multi-Tenant Organization Isolation & Role-Based Permissions
-- ====================================================================

-- ====================================================================
-- 1. SECURITY HELPER FUNCTIONS (Avoid RLS Recursion)
-- ====================================================================

-- Returns the active organization ID for the authenticated Supabase user
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT organization_id 
    FROM public.profiles 
    WHERE auth_user_id = auth.uid() 
      AND status = 'ACTIVE' 
      AND deleted_at IS NULL 
    LIMIT 1;
$$;

-- Returns the role of the authenticated Supabase user ('ADMIN' or 'AGENT')
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role 
    FROM public.profiles 
    WHERE auth_user_id = auth.uid() 
      AND status = 'ACTIVE' 
      AND deleted_at IS NULL 
    LIMIT 1;
$$;

-- Returns TRUE if current user is an active ADMIN in their organization
CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT (public.current_user_role() = 'ADMIN');
$$;

-- Returns TRUE if current user is an active member of an organization
CREATE OR REPLACE FUNCTION public.is_active_org_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT (public.current_user_org_id() IS NOT NULL);
$$;

-- ====================================================================
-- 2. ENABLE ROW LEVEL SECURITY ON ALL CRM TABLES
-- ====================================================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_audits ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- 3. ORGANIZATIONS POLICIES
-- ====================================================================
CREATE POLICY "org_select_policy" ON public.organizations
    FOR SELECT
    USING (id = public.current_user_org_id());

CREATE POLICY "org_update_policy" ON public.organizations
    FOR UPDATE
    USING (id = public.current_user_org_id() AND public.is_org_admin())
    WITH CHECK (id = public.current_user_org_id() AND public.is_org_admin());

-- ====================================================================
-- 4. PROFILES POLICIES
-- ====================================================================
-- Active members can view other profiles within their organization
CREATE POLICY "profiles_select_policy" ON public.profiles
    FOR SELECT
    USING (organization_id = public.current_user_org_id());

-- Only ADMINs can provision new user profiles
CREATE POLICY "profiles_insert_policy" ON public.profiles
    FOR INSERT
    WITH CHECK (
        organization_id = public.current_user_org_id() 
        AND public.is_org_admin()
    );

-- ADMINs can update profiles; AGENTs can only update their own non-privileged record
CREATE POLICY "profiles_update_policy" ON public.profiles
    FOR UPDATE
    USING (
        organization_id = public.current_user_org_id() 
        AND (public.is_org_admin() OR auth_user_id = auth.uid())
    )
    WITH CHECK (
        organization_id = public.current_user_org_id() 
        AND (public.is_org_admin() OR auth_user_id = auth.uid())
    );

-- Trigger to prevent AGENTs from escalating their role or modifying organization
CREATE OR REPLACE FUNCTION public.protect_profile_immutable_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT public.is_org_admin() THEN
        IF NEW.role <> OLD.role THEN
            RAISE EXCEPTION 'Agents are strictly forbidden from altering user roles.';
        END IF;
        IF NEW.organization_id <> OLD.organization_id THEN
            RAISE EXCEPTION 'Users cannot alter their organization assignment.';
        END IF;
        IF NEW.status <> OLD.status THEN
            RAISE EXCEPTION 'Agents cannot alter user activation status.';
        END IF;
        IF NEW.auth_user_id <> OLD.auth_user_id THEN
            RAISE EXCEPTION 'Authentication identity mapping cannot be changed.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_immutable_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_immutable_fields
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_immutable_fields();

-- ====================================================================
-- 5. LEADS POLICIES
-- ====================================================================
CREATE POLICY "leads_select_policy" ON public.leads
    FOR SELECT
    USING (organization_id = public.current_user_org_id());

CREATE POLICY "leads_insert_policy" ON public.leads
    FOR INSERT
    WITH CHECK (
        organization_id = public.current_user_org_id() 
        AND public.is_active_org_user()
    );

CREATE POLICY "leads_update_policy" ON public.leads
    FOR UPDATE
    USING (
        organization_id = public.current_user_org_id() 
        AND public.is_active_org_user()
    )
    WITH CHECK (
        organization_id = public.current_user_org_id() 
        AND public.is_active_org_user()
    );

-- ====================================================================
-- 6. CALL RECORDS POLICIES
-- ====================================================================
CREATE POLICY "call_records_select_policy" ON public.call_records
    FOR SELECT
    USING (organization_id = public.current_user_org_id());

CREATE POLICY "call_records_insert_policy" ON public.call_records
    FOR INSERT
    WITH CHECK (
        organization_id = public.current_user_org_id() 
        AND public.is_active_org_user()
    );

CREATE POLICY "call_records_update_policy" ON public.call_records
    FOR UPDATE
    USING (
        organization_id = public.current_user_org_id() 
        AND public.is_active_org_user()
    )
    WITH CHECK (
        organization_id = public.current_user_org_id() 
        AND public.is_active_org_user()
    );

-- ====================================================================
-- 7. ACTIVITIES POLICIES (Append-Only Immutable Event Stream)
-- ====================================================================
CREATE POLICY "activities_select_policy" ON public.activities
    FOR SELECT
    USING (organization_id = public.current_user_org_id());

CREATE POLICY "activities_insert_policy" ON public.activities
    FOR INSERT
    WITH CHECK (
        organization_id = public.current_user_org_id() 
        AND public.is_active_org_user()
    );

-- Note: No UPDATE or DELETE policies on activities - strictly append-only!

-- ====================================================================
-- 8. REMARKS POLICIES
-- ====================================================================
CREATE POLICY "remarks_select_policy" ON public.remarks
    FOR SELECT
    USING (organization_id = public.current_user_org_id());

CREATE POLICY "remarks_insert_policy" ON public.remarks
    FOR INSERT
    WITH CHECK (
        organization_id = public.current_user_org_id() 
        AND public.is_active_org_user()
    );

CREATE POLICY "remarks_update_policy" ON public.remarks
    FOR UPDATE
    USING (
        organization_id = public.current_user_org_id() 
        AND public.is_active_org_user()
    )
    WITH CHECK (
        organization_id = public.current_user_org_id() 
        AND public.is_active_org_user()
    );

-- ====================================================================
-- 9. FOLLOW-UPS POLICIES
-- ====================================================================
CREATE POLICY "follow_ups_select_policy" ON public.follow_ups
    FOR SELECT
    USING (organization_id = public.current_user_org_id());

CREATE POLICY "follow_ups_insert_policy" ON public.follow_ups
    FOR INSERT
    WITH CHECK (
        organization_id = public.current_user_org_id() 
        AND public.is_active_org_user()
    );

CREATE POLICY "follow_ups_update_policy" ON public.follow_ups
    FOR UPDATE
    USING (
        organization_id = public.current_user_org_id() 
        AND public.is_active_org_user()
    )
    WITH CHECK (
        organization_id = public.current_user_org_id() 
        AND public.is_active_org_user()
    );

-- ====================================================================
-- 10. MESSAGE HISTORY POLICIES
-- ====================================================================
CREATE POLICY "message_history_select_policy" ON public.message_history
    FOR SELECT
    USING (organization_id = public.current_user_org_id());

CREATE POLICY "message_history_insert_policy" ON public.message_history
    FOR INSERT
    WITH CHECK (
        organization_id = public.current_user_org_id() 
        AND public.is_active_org_user()
    );

CREATE POLICY "message_history_update_policy" ON public.message_history
    FOR UPDATE
    USING (
        organization_id = public.current_user_org_id() 
        AND public.is_active_org_user()
    )
    WITH CHECK (
        organization_id = public.current_user_org_id() 
        AND public.is_active_org_user()
    );

-- ====================================================================
-- 11. IMPORT AUDITS POLICIES
-- ====================================================================
CREATE POLICY "import_audits_select_policy" ON public.import_audits
    FOR SELECT
    USING (organization_id = public.current_user_org_id());

CREATE POLICY "import_audits_insert_policy" ON public.import_audits
    FOR INSERT
    WITH CHECK (
        organization_id = public.current_user_org_id() 
        AND public.is_active_org_user()
    );
