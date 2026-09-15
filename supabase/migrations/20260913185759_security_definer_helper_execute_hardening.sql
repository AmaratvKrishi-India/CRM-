-- Restrict SECURITY DEFINER helper RPC exposure while preserving RLS-required calls.
BEGIN;

-- These helpers are used internally by RLS/sync. Anonymous callers are not part
-- of the application access model, and default PUBLIC execute made them RPCs.
REVOKE ALL ON FUNCTION public.current_profile_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_user_org_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_org_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_active_org_user() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_lead_for_current_user(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sync_head() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sync_was_deleted(text, uuid) FROM PUBLIC, anon;

-- Explicit least-privilege grants required by existing authenticated RLS/sync.
GRANT EXECUTE ON FUNCTION public.current_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_org_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_lead_for_current_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_head() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_was_deleted(text, uuid) TO authenticated;

COMMIT;
