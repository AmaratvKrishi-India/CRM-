-- F003 runtime correction: deterministic application conflicts are HTTP 409.
-- SQLSTATE 40001 is a retryable serialization failure in PostgREST transports.
-- Preserve all revision, tenant and conditional-write checks; only classify the error correctly.
BEGIN;
CREATE OR REPLACE FUNCTION public.assign_sync_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  org uuid;
  rev bigint;
  untrusted boolean := current_setting('role', true) IN ('anon', 'authenticated');
BEGIN
  org := CASE WHEN TG_OP = 'DELETE' THEN OLD.organization_id ELSE NEW.organization_id END;
  IF TG_OP = 'INSERT' AND untrusted AND EXISTS(SELECT 1 FROM public.sync_deleted_keys k
      WHERE k.organization_id=org AND k.entity=TG_TABLE_NAME AND k.entity_id=NEW.id) THEN
    RAISE EXCEPTION 'SYNC_CONFLICT: deleted UUID cannot be replayed' USING ERRCODE='PT409';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'Sync organization is immutable' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' AND untrusted AND pg_trigger_depth() = 1 AND
     (NEW.sync_expected_revision IS NULL OR NEW.sync_expected_revision <> OLD.sync_revision) THEN
    RAISE EXCEPTION 'SYNC_CONFLICT: expected server revision required; upgrade legacy client'
      USING ERRCODE = 'PT409';
  END IF;
  IF TG_OP = 'DELETE' AND untrusted AND pg_trigger_depth() = 1 AND
     current_setting('crm.sync_delete_guard', true) IS DISTINCT FROM
       (TG_TABLE_NAME || ':' || OLD.id || ':' || OLD.sync_revision) THEN
    RAISE EXCEPTION 'SYNC_CONFLICT: conditional delete required' USING ERRCODE = 'PT409';
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
COMMIT;

