-- ====================================================================
-- Migration 20260820000007
-- BUG-1: call_records extended lifecycle fields
-- BUG-8: cloud-side support for hard DELETE of leads
--
-- Additive and backward-compatible: all new columns are nullable.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. BUG-1: extended call fields
-- dial_attempt_id links the record to its lifecycle dial attempt,
-- reported_duration_seconds stores the user-reported (UNVERIFIED)
-- duration distinct from duration_seconds (verified), and call_status
-- stores the high-level lifecycle status.
-- --------------------------------------------------------------------
ALTER TABLE public.call_records
    ADD COLUMN IF NOT EXISTS dial_attempt_id UUID,
    ADD COLUMN IF NOT EXISTS reported_duration_seconds INT,
    ADD COLUMN IF NOT EXISTS call_status TEXT;

ALTER TABLE public.call_records
    DROP CONSTRAINT IF EXISTS call_records_call_status_check;
ALTER TABLE public.call_records
    ADD CONSTRAINT call_records_call_status_check
    CHECK (call_status IN ('DIAL_ATTEMPT', 'CONNECTED', 'NOT_CONNECTED', 'CANCELLED', 'UNKNOWN'));

-- --------------------------------------------------------------------
-- 2. BUG-8: hard-delete cascade for lead children
-- leadRepository.hardDeleteLead cascades deletion to all child records
-- locally. The cloud FKs used ON DELETE RESTRICT, which made the
-- corresponding cloud DELETE of the lead fail whenever child rows
-- still existed. Align the cloud with the local cascade semantics so
-- a hard-deleted lead never leaves orphaned children and never gets
-- stuck in the outbox. activities already uses ON DELETE SET NULL.
-- --------------------------------------------------------------------
ALTER TABLE public.call_records
    DROP CONSTRAINT IF EXISTS call_records_lead_id_fkey;
ALTER TABLE public.call_records
    ADD CONSTRAINT call_records_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;

ALTER TABLE public.remarks
    DROP CONSTRAINT IF EXISTS remarks_lead_id_fkey;
ALTER TABLE public.remarks
    ADD CONSTRAINT remarks_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;

ALTER TABLE public.follow_ups
    DROP CONSTRAINT IF EXISTS follow_ups_lead_id_fkey;
ALTER TABLE public.follow_ups
    ADD CONSTRAINT follow_ups_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;

ALTER TABLE public.message_history
    DROP CONSTRAINT IF EXISTS message_history_lead_id_fkey;
ALTER TABLE public.message_history
    ADD CONSTRAINT message_history_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;

-- --------------------------------------------------------------------
-- 3. BUG-8: DELETE policy for leads
-- Mirrors leads_update_policy (migration 20260820000006): org-scoped,
-- ADMINs may delete any org lead; AGENTs only leads they created or
-- that are assigned to them. No other table exposes DELETE to clients.
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "leads_delete_policy" ON public.leads;
CREATE POLICY "leads_delete_policy" ON public.leads
    FOR DELETE
    USING (
        organization_id = public.current_user_org_id()
        AND (
            public.is_org_admin()
            OR assigned_to = public.current_profile_id()
            OR created_by = public.current_profile_id()
        )
    );
