-- F002: durable, concurrency-safe create-agent abuse control.
-- Policy is database-configurable without trusting request headers or body fields.

CREATE TABLE IF NOT EXISTS public.agent_provisioning_policy (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  window_seconds INTEGER NOT NULL DEFAULT 300 CHECK (window_seconds BETWEEN 60 AND 86400),
  per_admin_limit INTEGER NOT NULL DEFAULT 10 CHECK (per_admin_limit BETWEEN 1 AND 1000),
  per_organization_limit INTEGER NOT NULL DEFAULT 25 CHECK (per_organization_limit BETWEEN 1 AND 10000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.agent_provisioning_policy(singleton)
VALUES (TRUE)
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.agent_provisioning_rate_limits (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  administrator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count > 0),
  PRIMARY KEY (organization_id, administrator_id, window_started_at)
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS provisioning_key UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_org_provisioning_key
  ON public.profiles(organization_id, provisioning_key)
  WHERE provisioning_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_provisioning_rate_org_window
  ON public.agent_provisioning_rate_limits(organization_id, window_started_at);

ALTER TABLE public.agent_provisioning_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_provisioning_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agent_provisioning_policy FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.agent_provisioning_rate_limits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reserve_agent_provisioning(
  target_organization UUID,
  target_administrator UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  policy public.agent_provisioning_policy%ROWTYPE;
  current_window TIMESTAMPTZ;
  admin_count INTEGER;
  organization_count INTEGER;
  retry_after_seconds INTEGER;
BEGIN
  IF target_organization IS NULL OR target_administrator IS NULL THEN
    RAISE EXCEPTION 'Trusted organization and administrator are required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = target_administrator
      AND organization_id = target_organization
      AND role = 'ADMIN'
      AND status = 'ACTIVE'
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Trusted administrator context is invalid';
  END IF;

  SELECT * INTO STRICT policy FROM public.agent_provisioning_policy WHERE singleton = TRUE;
  current_window := date_bin(
    make_interval(secs => policy.window_seconds),
    clock_timestamp(),
    TIMESTAMPTZ '2000-01-01 00:00:00+00'
  );
  retry_after_seconds := GREATEST(1, CEIL(EXTRACT(EPOCH FROM
    current_window + make_interval(secs => policy.window_seconds) - clock_timestamp()))::INTEGER);

  -- One trusted organization is the contention boundary. This makes the two
  -- counters below one atomic decision even across distributed Edge isolates.
  PERFORM pg_advisory_xact_lock(hashtextextended(target_organization::TEXT, 0));

  SELECT COALESCE(SUM(request_count), 0)::INTEGER INTO organization_count
  FROM public.agent_provisioning_rate_limits
  WHERE organization_id = target_organization AND window_started_at = current_window;

  SELECT COALESCE(request_count, 0) INTO admin_count
  FROM public.agent_provisioning_rate_limits
  WHERE organization_id = target_organization
    AND administrator_id = target_administrator
    AND window_started_at = current_window;

  IF admin_count >= policy.per_admin_limit OR organization_count >= policy.per_organization_limit THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'retryAfterSeconds', retry_after_seconds,
      'adminCount', admin_count,
      'organizationCount', organization_count
    );
  END IF;

  INSERT INTO public.agent_provisioning_rate_limits(
    organization_id, administrator_id, window_started_at, request_count
  ) VALUES (target_organization, target_administrator, current_window, 1)
  ON CONFLICT (organization_id, administrator_id, window_started_at)
  DO UPDATE SET request_count = public.agent_provisioning_rate_limits.request_count + 1
  RETURNING request_count INTO admin_count;

  DELETE FROM public.agent_provisioning_rate_limits
  WHERE window_started_at < current_window - make_interval(secs => policy.window_seconds * 2);

  RETURN jsonb_build_object(
    'allowed', TRUE,
    'retryAfterSeconds', 0,
    'adminCount', admin_count,
    'organizationCount', organization_count + 1
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_agent_provisioning(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_agent_provisioning(UUID, UUID) TO service_role;
