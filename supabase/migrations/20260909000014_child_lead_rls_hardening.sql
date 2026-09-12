-- F047: child records must reference a lead visible to the mutating profile.
-- This migration is intentionally forward-only.  Existing read policies remain
-- unchanged; only child INSERT/UPDATE authorization is tightened.

CREATE OR REPLACE FUNCTION public.can_access_lead_for_current_user(p_lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.leads l
    WHERE l.id = p_lead_id
      AND l.organization_id = public.current_user_org_id()
      AND (
        l.assigned_to = public.current_profile_id()
        OR l.created_by = public.current_profile_id()
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_lead_for_current_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_lead_for_current_user(uuid) TO authenticated;

DROP POLICY IF EXISTS "call_records_insert_policy" ON public.call_records;
CREATE POLICY "call_records_insert_policy" ON public.call_records
    FOR INSERT
    WITH CHECK (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR (
                user_id = public.current_profile_id()
                AND public.can_access_lead_for_current_user(lead_id)
            )
        )
    );

DROP POLICY IF EXISTS "call_records_update_policy" ON public.call_records;
CREATE POLICY "call_records_update_policy" ON public.call_records
    FOR UPDATE
    USING (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR (
                user_id = public.current_profile_id()
                AND public.can_access_lead_for_current_user(lead_id)
            )
        )
    )
    WITH CHECK (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR (
                user_id = public.current_profile_id()
                AND public.can_access_lead_for_current_user(lead_id)
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
            OR (
                user_id = public.current_profile_id()
                AND public.can_access_lead_for_current_user(lead_id)
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
            OR (
                user_id = public.current_profile_id()
                AND public.can_access_lead_for_current_user(lead_id)
            )
        )
    )
    WITH CHECK (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR (
                user_id = public.current_profile_id()
                AND public.can_access_lead_for_current_user(lead_id)
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
            OR (
                user_id = public.current_profile_id()
                AND public.can_access_lead_for_current_user(lead_id)
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
            OR (
                user_id = public.current_profile_id()
                AND public.can_access_lead_for_current_user(lead_id)
            )
        )
    )
    WITH CHECK (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR (
                user_id = public.current_profile_id()
                AND public.can_access_lead_for_current_user(lead_id)
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
            OR (
                user_id = public.current_profile_id()
                AND (
                    lead_id IS NULL
                    OR public.can_access_lead_for_current_user(lead_id)
                )
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
            OR (
                user_id = public.current_profile_id()
                AND public.can_access_lead_for_current_user(lead_id)
            )
        )
    );

DROP POLICY IF EXISTS "message_history_update_policy" ON public.message_history;
CREATE POLICY "message_history_update_policy" ON public.message_history
    FOR UPDATE
    USING (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR (
                user_id = public.current_profile_id()
                AND public.can_access_lead_for_current_user(lead_id)
            )
        )
    )
    WITH CHECK (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR (
                user_id = public.current_profile_id()
                AND public.can_access_lead_for_current_user(lead_id)
            )
        )
    );
