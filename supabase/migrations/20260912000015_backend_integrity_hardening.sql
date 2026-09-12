-- Backend integrity hardening: assignment ownership, follow-up completion,
-- and durable agent-provisioning finalization.
BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS provisioning_completed_at TIMESTAMPTZ;

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
      RAISE EXCEPTION 'Agents are strictly forbidden from modifying lead assignment.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
-- Existing agents predate the completion marker and are already durable.
UPDATE public.profiles
SET provisioning_completed_at = COALESCE(provisioning_completed_at, created_at, NOW())
WHERE role = 'AGENT' AND provisioning_completed_at IS NULL;

DROP POLICY IF EXISTS "follow_ups_update_policy" ON public.follow_ups;
CREATE POLICY "follow_ups_update_policy" ON public.follow_ups
  FOR UPDATE
  USING (
    organization_id = public.current_user_org_id()
    AND (
      public.is_org_admin()
      OR public.can_access_lead_for_current_user(lead_id)
    )
  )
  WITH CHECK (
    organization_id = public.current_user_org_id()
    AND (
      public.is_org_admin()
      OR public.can_access_lead_for_current_user(lead_id)
    )
  );

CREATE OR REPLACE FUNCTION public.protect_follow_up_agent_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$BEGIN
  IF public.is_org_admin() OR OLD.user_id = public.current_profile_id() THEN
    RETURN NEW;
  END IF;

  IF NOT public.can_access_lead_for_current_user(OLD.lead_id) THEN
    RAISE EXCEPTION 'Agent cannot update a follow-up for an inaccessible lead.';
  END IF;
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.lead_id IS DISTINCT FROM OLD.lead_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
    OR NEW.title IS DISTINCT FROM OLD.title
    OR NEW.notes IS DISTINCT FROM OLD.notes
    OR NEW.priority IS DISTINCT FROM OLD.priority
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    RAISE EXCEPTION 'Agent may only complete an admin-created follow-up.';
  END IF;
  IF NEW.status IS DISTINCT FROM 'COMPLETED' OR NEW.completed_at IS NULL THEN
    RAISE EXCEPTION 'Agent may only complete an admin-created follow-up.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_follow_up_agent_updates ON public.follow_ups;
CREATE TRIGGER trg_protect_follow_up_agent_updates
  BEFORE UPDATE ON public.follow_ups
  FOR EACH ROW EXECUTE FUNCTION public.protect_follow_up_agent_updates();
CREATE OR REPLACE FUNCTION public.finalize_agent_provisioning(
  target_organization UUID,
  target_profile UUID,
  target_provisioning_key UUID,
  audit_id UUID,
  administrator UUID,
  audit_device_id TEXT,
  audit_metadata JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.profiles
  WHERE id = target_profile
    AND organization_id = target_organization
    AND provisioning_key = target_provisioning_key
    AND role = 'AGENT'
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provisioning profile not found';
  END IF;

  IF p.provisioning_completed_at IS NOT NULL THEN
    RETURN to_jsonb(p);
  END IF;

  INSERT INTO public.activities(
    id, organization_id, lead_id, user_id, device_id,
    activity_type, metadata, created_at, updated_at, version
  ) VALUES (
    audit_id, target_organization, NULL, administrator, audit_device_id,
    'AGENT_CREATED', COALESCE(audit_metadata, '{}'::jsonb), NOW(), NOW(), 1
  );
  UPDATE public.profiles
  SET provisioning_completed_at = NOW(), updated_at = NOW()
  WHERE id = target_profile
  RETURNING * INTO p;

  RETURN to_jsonb(p);
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_agent_provisioning(UUID, UUID, UUID, UUID, UUID, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_agent_provisioning(UUID, UUID, UUID, UUID, UUID, TEXT, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.finalize_agent_provisioning(UUID, UUID, UUID, UUID, UUID, TEXT, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_agent_provisioning(UUID, UUID, UUID, UUID, UUID, TEXT, JSONB) TO service_role;

COMMIT;
