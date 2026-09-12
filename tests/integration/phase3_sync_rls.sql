\set ON_ERROR_STOP on

BEGIN;

INSERT INTO auth.users (id, email, role, aud, created_at, updated_at)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'admin-a@phase3.local', 'authenticated', 'authenticated', now(), now()),
  ('10000000-0000-0000-0000-000000000002', 'agent-a@phase3.local', 'authenticated', 'authenticated', now(), now()),
  ('10000000-0000-0000-0000-000000000003', 'agent-a2@phase3.local', 'authenticated', 'authenticated', now(), now()),
  ('20000000-0000-0000-0000-000000000001', 'admin-b@phase3.local', 'authenticated', 'authenticated', now(), now());

INSERT INTO public.organizations (id, name)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Phase 3 Org A'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Phase 3 Org B');

INSERT INTO public.profiles (id, auth_user_id, organization_id, name, email, role)
VALUES
  ('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Admin A', 'admin-a@phase3.local', 'ADMIN'),
  ('a0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Agent A', 'agent-a@phase3.local', 'AGENT'),
  ('a0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'Agent A2', 'agent-a2@phase3.local', 'AGENT'),
  ('b0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Admin B', 'admin-b@phase3.local', 'ADMIN');

INSERT INTO public.leads (id, organization_id, business_name, phone, address, locality, created_by, assigned_to)
VALUES
  ('aa000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Assigned A', '111', 'A', 'A', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002'),
  ('aa000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Admin-only A', '112', 'A', 'A', 'a0000000-0000-0000-0000-000000000001', NULL),
  ('bb000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Org B', '211', 'B', 'B', 'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001');

INSERT INTO public.call_records (id, organization_id, lead_id, user_id, started_at, outcome)
VALUES
  ('ca000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', now(), 'NO_ANSWER'),
  ('cb000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'bb000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', now(), 'NO_ANSWER');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);

DO $$
BEGIN
  IF (SELECT count(*) FROM public.leads) <> 1 THEN
    RAISE EXCEPTION 'Agent A lead visibility is not assignment-scoped';
  END IF;
  IF EXISTS (SELECT 1 FROM public.leads WHERE organization_id = 'bbbbbbbb-0000-0000-0000-000000000001') THEN
    RAISE EXCEPTION 'Agent A can see Org B leads';
  END IF;
  IF (SELECT count(*) FROM public.call_records) <> 1 THEN
    RAISE EXCEPTION 'Agent A child-record visibility is not lead-scoped';
  END IF;
END $$;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.leads (organization_id, business_name, phone, address, locality, created_by)
    VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 'Forbidden', '999', 'X', 'X', 'a0000000-0000-0000-0000-000000000002');
    RAISE EXCEPTION 'Cross-organization insert unexpectedly succeeded';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END $$;

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

DO $$
BEGIN
  IF (SELECT count(*) FROM public.leads) <> 2 THEN
    RAISE EXCEPTION 'Admin A cannot see all Org A leads';
  END IF;
  IF EXISTS (SELECT 1 FROM public.leads WHERE organization_id = 'bbbbbbbb-0000-0000-0000-000000000001') THEN
    RAISE EXCEPTION 'Admin A can see Org B leads';
  END IF;
END $$;

UPDATE public.leads
SET assigned_to = 'a0000000-0000-0000-0000-000000000003', updated_at = now(),
    sync_expected_revision = sync_revision
WHERE id = 'aa000000-0000-0000-0000-000000000001';

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.leads WHERE id = 'aa000000-0000-0000-0000-000000000001') THEN
    RAISE EXCEPTION 'Reassigned lead remains visible to revoked agent';
  END IF;
  IF EXISTS (SELECT 1 FROM public.call_records WHERE lead_id = 'aa000000-0000-0000-0000-000000000001') THEN
    RAISE EXCEPTION 'Child record remains visible after assignment revocation';
  END IF;
END $$;

RESET ROLE;
ROLLBACK;

SELECT 'PHASE3_RLS_PASS' AS result;
