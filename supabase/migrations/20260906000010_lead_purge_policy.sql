-- F022: ordinary deletion is reversible UPDATE (archive). Permanent DELETE is
-- restricted to an active organization admin. Archive/recovery acknowledgement
-- is enforced by the internal local API, preserving the conditional-delete RPC.
BEGIN;
DROP POLICY IF EXISTS leads_delete_policy ON public.leads;
CREATE POLICY leads_delete_policy ON public.leads FOR DELETE TO authenticated
  USING (organization_id = public.current_user_org_id() AND public.is_org_admin());
COMMIT;
