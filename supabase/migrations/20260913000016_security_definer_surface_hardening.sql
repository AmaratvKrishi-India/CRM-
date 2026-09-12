-- Reduce exposed SECURITY DEFINER surface without changing application RPCs.
BEGIN;

ALTER FUNCTION public.protect_profile_immutable_fields()
  SET search_path = public;

-- These functions exist only as trigger entrypoints. Runtime trigger execution
-- does not require API callers to hold EXECUTE on the trigger function itself.
REVOKE ALL ON FUNCTION public.assign_sync_revision() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_profile_immutable_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_lead_immutable_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_follow_up_agent_updates() FROM PUBLIC, anon, authenticated;

COMMIT;
