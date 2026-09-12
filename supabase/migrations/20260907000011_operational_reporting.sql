-- F045: approved application-owned diagnostics; no arbitrary messages or payloads.
BEGIN;
CREATE TABLE public.operational_error_readers (
  auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE
);
ALTER TABLE public.operational_error_readers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.operational_error_readers FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.operational_error_readers TO service_role;

CREATE TABLE public.operational_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  operation text NOT NULL CHECK (operation IN ('sync_push','sync_cycle','render','unhandled_error','unhandled_rejection')),
  category text NOT NULL CHECK (category IN ('network','timeout','authentication','authorization','validation','conflict','unexpected')),
  platform text NOT NULL CHECK (platform IN ('android','ios','web')),
  build text NOT NULL CHECK (build ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  failure_count integer NOT NULL CHECK (failure_count BETWEEN 1 AND 1000)
);
CREATE INDEX operational_errors_expiry ON public.operational_errors(occurred_at);
CREATE INDEX operational_errors_scope_time ON public.operational_errors(organization_id,profile_id,occurred_at);
ALTER TABLE public.operational_errors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.operational_errors FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.operational_errors TO authenticated;
GRANT ALL ON public.operational_errors TO service_role;

CREATE FUNCTION public.can_read_operational_errors(target_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS (SELECT 1 FROM public.operational_error_readers r
 WHERE r.auth_user_id=auth.uid() AND (r.organization_id IS NULL OR r.organization_id=target_org))
 AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_user_id=auth.uid() AND p.status='ACTIVE' AND p.deleted_at IS NULL)
$$;
REVOKE ALL ON FUNCTION public.can_read_operational_errors(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_read_operational_errors(uuid) TO authenticated;
CREATE POLICY operational_errors_read ON public.operational_errors FOR SELECT TO authenticated
 USING (occurred_at > now()-interval '90 days' AND public.can_read_operational_errors(organization_id));

CREATE FUNCTION public.report_operational_error(
 operation text, category text, platform text, build text, failure_count integer DEFAULT 1
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE profile public.profiles%ROWTYPE; event_id uuid;
BEGIN
 SELECT * INTO profile FROM public.profiles p WHERE p.auth_user_id=auth.uid() AND p.status='ACTIVE' AND p.deleted_at IS NULL;
 IF profile.id IS NULL THEN RAISE EXCEPTION 'Active authenticated profile required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('operational:'||profile.id,0));
 IF (SELECT count(*) FROM public.operational_errors e WHERE e.profile_id=profile.id AND e.occurred_at>clock_timestamp()-interval '1 minute') >= 30 THEN
   RETURN NULL;
 END IF;
 INSERT INTO public.operational_errors(organization_id,profile_id,operation,category,platform,build,failure_count)
 VALUES(profile.organization_id,profile.id,operation,category,platform,build,failure_count) RETURNING id INTO event_id;
 RETURN event_id;
END $$;
REVOKE ALL ON FUNCTION public.report_operational_error(text,text,text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.report_operational_error(text,text,text,text,integer) TO authenticated;

CREATE FUNCTION public.expire_operational_errors() RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE removed bigint;
BEGIN
 DELETE FROM public.operational_errors WHERE occurred_at<=clock_timestamp()-interval '90 days';
 GET DIAGNOSTICS removed=ROW_COUNT; RETURN removed;
END $$;
REVOKE ALL ON FUNCTION public.expire_operational_errors() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.expire_operational_errors() TO service_role;
-- pg_cron is database-scoped. Disposable local test databases are not the
-- configured cron database, so they retain the callable expiry routine while
-- skipping scheduler setup. The staging project runs this branch.
DO $$
BEGIN
  IF current_database() = coalesce(current_setting('cron.database_name', true), 'postgres') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'crm-operational-errors-90-day-expiry') THEN
      PERFORM cron.schedule('crm-operational-errors-90-day-expiry','* * * * *','SELECT public.expire_operational_errors()');
    END IF;
  END IF;
END $$;
COMMIT;
