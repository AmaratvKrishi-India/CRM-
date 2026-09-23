-- Finding-002 remediation: child-row SELECT access must follow current parent-lead visibility.
-- Preserve administrator organization-wide reads and personal non-lead activities.
-- Do not retain lead history solely because the revoked agent authored the child row.

DROP POLICY IF EXISTS "call_records_select_policy" ON public.call_records;
CREATE POLICY "call_records_select_policy" ON public.call_records
    FOR SELECT
    USING (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR public.can_access_lead_for_current_user(lead_id)
        )
    );

DROP POLICY IF EXISTS "follow_ups_select_policy" ON public.follow_ups;
CREATE POLICY "follow_ups_select_policy" ON public.follow_ups
    FOR SELECT
    USING (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR public.can_access_lead_for_current_user(lead_id)
        )
    );

DROP POLICY IF EXISTS "remarks_select_policy" ON public.remarks;
CREATE POLICY "remarks_select_policy" ON public.remarks
    FOR SELECT
    USING (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR public.can_access_lead_for_current_user(lead_id)
        )
    );

DROP POLICY IF EXISTS "message_history_select_policy" ON public.message_history;
CREATE POLICY "message_history_select_policy" ON public.message_history
    FOR SELECT
    USING (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR public.can_access_lead_for_current_user(lead_id)
        )
    );

DROP POLICY IF EXISTS "activities_select_policy" ON public.activities;
CREATE POLICY "activities_select_policy" ON public.activities
    FOR SELECT
    USING (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR (
                lead_id IS NULL
                AND user_id = public.current_profile_id()
            )
            OR (
                lead_id IS NOT NULL
                AND public.can_access_lead_for_current_user(lead_id)
            )
        )
    );
