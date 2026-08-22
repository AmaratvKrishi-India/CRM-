-- ====================================================================
-- Amaratv Krishi Field Sales CRM — Row Level Security (RLS) Remediation (Phase 2)
-- Migration: 20260820000006_rls_agent_lead_isolation.sql
-- Strictly enforces Agent-level lead isolation and RBAC constraints.
--
-- Security Rules:
-- 1. ADMINs can view and manage all records within their organization.
-- 2. AGENTs can only view/update leads assigned to them or created by them.
-- 3. Unassigned organization leads remain Admin-controlled and invisible to Agents.
-- 4. AGENTs cannot alter organization_id, created_by, or reassign leads.
-- 5. Child records (calls, follow-ups, remarks, messages, activities) follow
--    strict Agent-level isolation.
-- 6. Import and Bulk Assignment Audits are strictly Admin-only.
-- ====================================================================

-- 1. SECURITY HELPER FUNCTION FOR PROFILE RESOLUTION
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id 
    FROM public.profiles 
    WHERE auth_user_id = auth.uid() 
      AND status = 'ACTIVE' 
      AND deleted_at IS NULL 
    LIMIT 1;
$$;

-- ====================================================================
-- 2. LEADS POLICIES (Agent Isolation & Admin Organization Access)
-- ====================================================================
DROP POLICY IF EXISTS "leads_select_policy" ON public.leads;
CREATE POLICY "leads_select_policy" ON public.leads
    FOR SELECT
    USING (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR assigned_to = public.current_profile_id()
            OR created_by = public.current_profile_id()
        )
    );

DROP POLICY IF EXISTS "leads_insert_policy" ON public.leads;
CREATE POLICY "leads_insert_policy" ON public.leads
    FOR INSERT
    WITH CHECK (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR (
                created_by = public.current_profile_id()
                AND (assigned_to = public.current_profile_id() OR assigned_to IS NULL)
            )
        )
    );

DROP POLICY IF EXISTS "leads_update_policy" ON public.leads;
CREATE POLICY "leads_update_policy" ON public.leads
    FOR UPDATE
    USING (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR assigned_to = public.current_profile_id()
            OR created_by = public.current_profile_id()
        )
    )
    WITH CHECK (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR assigned_to = public.current_profile_id()
            OR created_by = public.current_profile_id()
        )
    );

-- Trigger to protect immutable lead fields from Agent tampering
CREATE OR REPLACE FUNCTION public.protect_lead_immutable_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_org_admin() THEN
        IF NEW.organization_id <> OLD.organization_id THEN
            RAISE EXCEPTION 'Agents are strictly forbidden from modifying lead organization boundary.';
        END IF;
        IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
            RAISE EXCEPTION 'Agents are strictly forbidden from modifying lead creator.';
        END IF;
        IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
            IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to <> public.current_profile_id() THEN
                RAISE EXCEPTION 'Agents are not permitted to reassign leads to other sales agents.';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_lead_immutable_fields ON public.leads;
CREATE TRIGGER trg_protect_lead_immutable_fields
    BEFORE UPDATE ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_lead_immutable_fields();

-- ====================================================================
-- 3. CALL RECORDS POLICIES
-- ====================================================================
DROP POLICY IF EXISTS "call_records_select_policy" ON public.call_records;
CREATE POLICY "call_records_select_policy" ON public.call_records
    FOR SELECT
    USING (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR user_id = public.current_profile_id()
            OR lead_id IN (
                SELECT l.id FROM public.leads l 
                WHERE l.organization_id = public.current_user_org_id()
                  AND (l.assigned_to = public.current_profile_id() OR l.created_by = public.current_profile_id())
            )
        )
    );

DROP POLICY IF EXISTS "call_records_insert_policy" ON public.call_records;
CREATE POLICY "call_records_insert_policy" ON public.call_records
    FOR INSERT
    WITH CHECK (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR user_id = public.current_profile_id()
        )
    );

DROP POLICY IF EXISTS "call_records_update_policy" ON public.call_records;
CREATE POLICY "call_records_update_policy" ON public.call_records
    FOR UPDATE
    USING (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR user_id = public.current_profile_id()
        )
    )
    WITH CHECK (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR user_id = public.current_profile_id()
        )
    );

-- ====================================================================
-- 4. FOLLOW-UPS POLICIES
-- ====================================================================
DROP POLICY IF EXISTS "follow_ups_select_policy" ON public.follow_ups;
CREATE POLICY "follow_ups_select_policy" ON public.follow_ups
    FOR SELECT
    USING (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR user_id = public.current_profile_id()
            OR lead_id IN (
                SELECT l.id FROM public.leads l 
                WHERE l.organization_id = public.current_user_org_id()
                  AND (l.assigned_to = public.current_profile_id() OR l.created_by = public.current_profile_id())
            )
        )
    );

DROP POLICY IF EXISTS "follow_ups_insert_policy" ON public.follow_ups;
CREATE POLICY "follow_ups_insert_policy" ON public.follow_ups
    FOR INSERT
    WITH CHECK (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR user_id = public.current_profile_id()
            OR lead_id IN (
                SELECT l.id FROM public.leads l 
                WHERE l.organization_id = public.current_user_org_id()
                  AND (l.assigned_to = public.current_profile_id() OR l.created_by = public.current_profile_id())
            )
        )
    );

DROP POLICY IF EXISTS "follow_ups_update_policy" ON public.follow_ups;
CREATE POLICY "follow_ups_update_policy" ON public.follow_ups
    FOR UPDATE
    USING (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR user_id = public.current_profile_id()
            OR lead_id IN (
                SELECT l.id FROM public.leads l 
                WHERE l.organization_id = public.current_user_org_id()
                  AND (l.assigned_to = public.current_profile_id() OR l.created_by = public.current_profile_id())
            )
        )
    )
    WITH CHECK (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR user_id = public.current_profile_id()
            OR lead_id IN (
                SELECT l.id FROM public.leads l 
                WHERE l.organization_id = public.current_user_org_id()
                  AND (l.assigned_to = public.current_profile_id() OR l.created_by = public.current_profile_id())
            )
        )
    );

-- ====================================================================
-- 5. REMARKS POLICIES
-- ====================================================================
DROP POLICY IF EXISTS "remarks_select_policy" ON public.remarks;
CREATE POLICY "remarks_select_policy" ON public.remarks
    FOR SELECT
    USING (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR user_id = public.current_profile_id()
            OR lead_id IN (
                SELECT l.id FROM public.leads l 
                WHERE l.organization_id = public.current_user_org_id()
                  AND (l.assigned_to = public.current_profile_id() OR l.created_by = public.current_profile_id())
            )
        )
    );

DROP POLICY IF EXISTS "remarks_insert_policy" ON public.remarks;
CREATE POLICY "remarks_insert_policy" ON public.remarks
    FOR INSERT
    WITH CHECK (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR user_id = public.current_profile_id()
            OR lead_id IN (
                SELECT l.id FROM public.leads l 
                WHERE l.organization_id = public.current_user_org_id()
                  AND (l.assigned_to = public.current_profile_id() OR l.created_by = public.current_profile_id())
            )
        )
    );

DROP POLICY IF EXISTS "remarks_update_policy" ON public.remarks;
CREATE POLICY "remarks_update_policy" ON public.remarks
    FOR UPDATE
    USING (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR user_id = public.current_profile_id()
            OR lead_id IN (
                SELECT l.id FROM public.leads l 
                WHERE l.organization_id = public.current_user_org_id()
                  AND (l.assigned_to = public.current_profile_id() OR l.created_by = public.current_profile_id())
            )
        )
    )
    WITH CHECK (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR user_id = public.current_profile_id()
            OR lead_id IN (
                SELECT l.id FROM public.leads l 
                WHERE l.organization_id = public.current_user_org_id()
                  AND (l.assigned_to = public.current_profile_id() OR l.created_by = public.current_profile_id())
            )
        )
    );

-- ====================================================================
-- 6. ACTIVITIES POLICIES (Append-Only Event Stream)
-- ====================================================================
DROP POLICY IF EXISTS "activities_select_policy" ON public.activities;
CREATE POLICY "activities_select_policy" ON public.activities
    FOR SELECT
    USING (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR user_id = public.current_profile_id()
            OR lead_id IN (
                SELECT l.id FROM public.leads l 
                WHERE l.organization_id = public.current_user_org_id()
                  AND (l.assigned_to = public.current_profile_id() OR l.created_by = public.current_profile_id())
            )
        )
    );

DROP POLICY IF EXISTS "activities_insert_policy" ON public.activities;
CREATE POLICY "activities_insert_policy" ON public.activities
    FOR INSERT
    WITH CHECK (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR user_id = public.current_profile_id()
        )
    );

-- ====================================================================
-- 7. MESSAGE HISTORY POLICIES
-- ====================================================================
DROP POLICY IF EXISTS "message_history_select_policy" ON public.message_history;
CREATE POLICY "message_history_select_policy" ON public.message_history
    FOR SELECT
    USING (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR user_id = public.current_profile_id()
            OR lead_id IN (
                SELECT l.id FROM public.leads l 
                WHERE l.organization_id = public.current_user_org_id()
                  AND (l.assigned_to = public.current_profile_id() OR l.created_by = public.current_profile_id())
            )
        )
    );

DROP POLICY IF EXISTS "message_history_insert_policy" ON public.message_history;
CREATE POLICY "message_history_insert_policy" ON public.message_history
    FOR INSERT
    WITH CHECK (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR user_id = public.current_profile_id()
        )
    );

DROP POLICY IF EXISTS "message_history_update_policy" ON public.message_history;
CREATE POLICY "message_history_update_policy" ON public.message_history
    FOR UPDATE
    USING (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR user_id = public.current_profile_id()
        )
    )
    WITH CHECK (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR user_id = public.current_profile_id()
        )
    );

-- ====================================================================
-- 8. IMPORT AUDITS POLICIES (Admin Only)
-- ====================================================================
DROP POLICY IF EXISTS "import_audits_select_policy" ON public.import_audits;
CREATE POLICY "import_audits_select_policy" ON public.import_audits
    FOR SELECT
    USING (
        organization_id = public.current_user_org_id()
        AND public.is_org_admin()
    );

DROP POLICY IF EXISTS "import_audits_insert_policy" ON public.import_audits;
CREATE POLICY "import_audits_insert_policy" ON public.import_audits
    FOR INSERT
    WITH CHECK (
        organization_id = public.current_user_org_id()
        AND public.is_org_admin()
    );
