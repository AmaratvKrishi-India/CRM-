BEGIN;

-- Supabase default function grants include anon. Mutations are for signed-in
-- clients; keep service_role access for trusted operational tooling.
REVOKE ALL ON FUNCTION public.sync_mutate(text, text, uuid, bigint, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_mutate(text, text, uuid, bigint, jsonb)
  TO authenticated, service_role;

COMMIT;
