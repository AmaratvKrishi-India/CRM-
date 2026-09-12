-- F003: additive, server-authoritative ordering. Apply before the v1 sync client.
-- Existing rows start at revision zero and are included by the initial scan.
BEGIN;
CREATE TABLE public.sync_revision_heads (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision BETWEEN 0 AND 9007199254740991)
);
ALTER TABLE public.sync_revision_heads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sync_revision_heads FROM PUBLIC, anon, authenticated;

-- Remember deleted identities without storing business data. A lost CREATE
-- response replayed after a hard delete must never recreate that old UUID.
CREATE TABLE public.sync_deleted_keys (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity text NOT NULL,
  entity_id uuid NOT NULL,
  PRIMARY KEY(organization_id,entity,entity_id)
);
ALTER TABLE public.sync_deleted_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sync_deleted_keys FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.sync_was_deleted(entity text, entity_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT EXISTS(SELECT 1 FROM public.sync_deleted_keys k
    WHERE k.organization_id=public.current_user_org_id() AND k.entity=$1 AND k.entity_id=$2);
$$;
REVOKE ALL ON FUNCTION public.sync_was_deleted(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_was_deleted(text,uuid) TO authenticated;

CREATE FUNCTION public.sync_head() RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT coalesce((SELECT revision FROM public.sync_revision_heads
    WHERE organization_id = public.current_user_org_id()), 0);
$$;
REVOKE ALL ON FUNCTION public.sync_head() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_head() TO authenticated;

-- Only this trigger can allocate a revision. The counter's row lock is held
-- until commit, so a lower revision cannot become visible after a higher one.
CREATE FUNCTION public.assign_sync_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  org uuid;
  rev bigint;
  untrusted boolean := current_setting('role', true) IN ('anon', 'authenticated');
BEGIN
  org := CASE WHEN TG_OP = 'DELETE' THEN OLD.organization_id ELSE NEW.organization_id END;
  IF TG_OP = 'INSERT' AND untrusted AND EXISTS(SELECT 1 FROM public.sync_deleted_keys k
      WHERE k.organization_id=org AND k.entity=TG_TABLE_NAME AND k.entity_id=NEW.id) THEN
    RAISE EXCEPTION 'SYNC_CONFLICT: deleted UUID cannot be replayed' USING ERRCODE='40001';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'Sync organization is immutable' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' AND untrusted AND pg_trigger_depth() = 1 AND
     (NEW.sync_expected_revision IS NULL OR NEW.sync_expected_revision <> OLD.sync_revision) THEN
    RAISE EXCEPTION 'SYNC_CONFLICT: expected server revision required; upgrade legacy client'
      USING ERRCODE = '40001';
  END IF;
  IF TG_OP = 'DELETE' AND untrusted AND pg_trigger_depth() = 1 AND
     current_setting('crm.sync_delete_guard', true) IS DISTINCT FROM
       (TG_TABLE_NAME || ':' || OLD.id || ':' || OLD.sync_revision) THEN
    RAISE EXCEPTION 'SYNC_CONFLICT: conditional delete required' USING ERRCODE = '40001';
  END IF;
  INSERT INTO public.sync_revision_heads(organization_id, revision) VALUES (org, 1)
    ON CONFLICT (organization_id) DO UPDATE
      SET revision = sync_revision_heads.revision + 1
    RETURNING revision INTO rev;
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.sync_deleted_keys VALUES (org,TG_TABLE_NAME,OLD.id) ON CONFLICT DO NOTHING;
    RETURN OLD;
  END IF;
  NEW.sync_revision := rev;
  NEW.sync_expected_revision := NULL;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_sync_revision() FROM PUBLIC;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['leads','call_records','activities','remarks','follow_ups',
    'message_history','import_audits','profiles','bulk_assignment_audits'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN sync_revision bigint NOT NULL DEFAULT 0,
      ADD COLUMN sync_expected_revision bigint, ADD COLUMN sync_mutation_id uuid,
      ADD COLUMN sync_mutation_hash text', t);
    EXECUTE format('CREATE INDEX %I ON public.%I (organization_id, sync_revision, id)',
      'idx_' || t || '_sync_revision', t);
    EXECUTE format('CREATE TRIGGER trg_sync_revision BEFORE INSERT OR UPDATE OR DELETE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION public.assign_sync_revision()', t);
  END LOOP;
END $$;

-- Invoker privileges are essential: all original table RLS policies/triggers
-- still run as the authenticated caller. Dynamic identifiers are allowlisted.
CREATE FUNCTION public.sync_mutate(
  entity text, operation text, mutation_id uuid, expected_revision bigint, payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public AS $$
DECLARE
  org uuid := public.current_user_org_id();
  current_row jsonb;
  result_row jsonb;
  row_id uuid;
  request_hash text;
  cols text;
  vals text;
  assignments text;
BEGIN
  IF org IS NULL OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Active authenticated profile required' USING ERRCODE = '42501';
  END IF;
  IF entity IS NULL OR entity <> ALL(ARRAY['leads','call_records','activities','remarks','follow_ups',
    'message_history','import_audits','profiles','bulk_assignment_audits']) OR
    operation IS NULL OR operation <> ALL(ARRAY['CREATE','UPDATE','DELETE']) OR
    mutation_id IS NULL OR jsonb_typeof(payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid sync envelope' USING ERRCODE = '22023';
  END IF;
  row_id := (payload->>'id')::uuid;
  IF row_id IS NULL OR (payload->>'organization_id')::uuid IS DISTINCT FROM org THEN
    RAISE EXCEPTION 'Mutation organization mismatch' USING ERRCODE = '42501';
  END IF;
  IF expected_revision < 0 OR expected_revision > 9007199254740991 OR
     payload ?| ARRAY['sync_revision','sync_expected_revision','sync_mutation_id','sync_mutation_hash'] THEN
    RAISE EXCEPTION 'Invalid revision metadata' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(payload) k WHERE NOT EXISTS (
    SELECT 1 FROM pg_attribute a WHERE a.attrelid = format('public.%I',entity)::regclass
      AND a.attname = k AND a.attnum > 0 AND NOT a.attisdropped)) THEN
    RAISE EXCEPTION 'Unknown mutation field' USING ERRCODE = '22023';
  END IF;
  request_hash := md5(jsonb_build_object('operation',operation,'payload',payload)::text);
  -- Serialize even absent-row CREATE retries. Hash collision only adds contention.
  PERFORM pg_advisory_xact_lock(hashtextextended(entity || ':' || row_id, 0));
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1 AND organization_id=$2',entity)
    INTO current_row USING row_id, org;
  IF current_row IS NULL AND operation='CREATE' AND public.sync_was_deleted(entity,row_id) THEN
    RETURN jsonb_build_object('status','CONFLICT','record',NULL);
  END IF;
  IF current_row IS NOT NULL AND current_row->>'sync_mutation_id' = mutation_id::text THEN
    IF current_row->>'sync_mutation_hash' IS DISTINCT FROM request_hash THEN
      RAISE EXCEPTION 'Mutation UUID reused with different data' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('status','APPLIED','record',current_row);
  END IF;
  IF operation = 'DELETE' AND current_row IS NULL AND expected_revision IS NOT NULL THEN
    RETURN jsonb_build_object('status','APPLIED','record',NULL);
  END IF;
  IF (current_row IS NULL AND (operation <> 'CREATE' OR expected_revision IS DISTINCT FROM 0)) OR
     (current_row IS NOT NULL AND (operation = 'CREATE' OR expected_revision IS NULL OR
       expected_revision <> (current_row->>'sync_revision')::bigint)) THEN
    RETURN jsonb_build_object('status','CONFLICT','record',current_row);
  END IF;
  IF operation = 'DELETE' THEN
    PERFORM set_config('crm.sync_delete_guard',entity || ':' || row_id || ':' || expected_revision,true);
    EXECUTE format('DELETE FROM public.%I WHERE id=$1 AND organization_id=$2 RETURNING to_jsonb(%I.*)',entity,entity)
      INTO result_row USING row_id,org;
    PERFORM set_config('crm.sync_delete_guard','',true);
    IF result_row IS NULL THEN RAISE EXCEPTION 'Mutation denied by RLS' USING ERRCODE='42501'; END IF;
    RETURN jsonb_build_object('status','APPLIED','record',NULL);
  END IF;
  -- Preserve verified call duration; other fields still use revision/CAS order.
  IF entity = 'call_records' AND current_row->>'verification_status' = 'VERIFIED'
     AND payload->>'verification_status' IS DISTINCT FROM 'VERIFIED' THEN
    payload := payload || jsonb_build_object('verification_status','VERIFIED',
      'duration_seconds',current_row->'duration_seconds');
  END IF;
  payload := payload || jsonb_build_object('sync_expected_revision',expected_revision,
    'sync_mutation_id',mutation_id,'sync_mutation_hash',request_hash);
  SELECT string_agg(format('%I',key),',' ORDER BY key),
    string_agg(format('r.%I',key),',' ORDER BY key),
    string_agg(format('%I=r.%I',key,key),',' ORDER BY key)
    INTO cols,vals,assignments FROM jsonb_object_keys(payload) key;
  IF operation = 'CREATE' THEN
    EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1) r
      RETURNING to_jsonb(%I.*)',entity,cols,vals,entity,entity) INTO result_row USING payload;
  ELSE
    EXECUTE format('UPDATE public.%I t SET %s FROM jsonb_populate_record(NULL::public.%I,$1) r
      WHERE t.id=$2 AND t.organization_id=$3 RETURNING to_jsonb(t)',entity,assignments,entity)
      INTO result_row USING payload,row_id,org;
  END IF;
  IF result_row IS NULL THEN RAISE EXCEPTION 'Mutation denied by RLS' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('status','APPLIED','record',result_row);
END;
$$;
REVOKE ALL ON FUNCTION public.sync_mutate(text,text,uuid,bigint,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_mutate(text,text,uuid,bigint,jsonb) TO authenticated;
COMMIT;
