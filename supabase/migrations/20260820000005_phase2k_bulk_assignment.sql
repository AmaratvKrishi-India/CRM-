-- ====================================================================
-- PHASE 2K MIGRATION: BULK LEAD ASSIGNMENT AUDITS & AGENT ACCESS POLICIES
-- Adds centralized bulk assignment auditing, indexes, and RLS policies.
-- ====================================================================

-- 1. Create bulk_assignment_audits table
CREATE TABLE IF NOT EXISTS public.bulk_assignment_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  performed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  target_agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  selected_lead_count INT NOT NULL DEFAULT 0,
  successful_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  filter_snapshot JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'PARTIAL', 'FAILED')),
  error_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  version INT NOT NULL DEFAULT 1
);

-- 2. Indexes for fast multi-tenant queries
CREATE INDEX IF NOT EXISTS idx_bulk_assign_org_target_started 
  ON public.bulk_assignment_audits(organization_id, target_agent_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_bulk_assign_org_performed 
  ON public.bulk_assignment_audits(organization_id, performed_by, started_at DESC);

-- 3. Row-Level Security (RLS)
ALTER TABLE public.bulk_assignment_audits ENABLE ROW LEVEL SECURITY;

-- Admins can view and create bulk assignment audits within their organization
DROP POLICY IF EXISTS bulk_assignment_audits_select_policy ON public.bulk_assignment_audits;
CREATE POLICY bulk_assignment_audits_select_policy ON public.bulk_assignment_audits
  FOR SELECT
  USING (
    organization_id = public.current_user_org_id()
    AND public.is_org_admin()
  );

DROP POLICY IF EXISTS bulk_assignment_audits_insert_policy ON public.bulk_assignment_audits;
CREATE POLICY bulk_assignment_audits_insert_policy ON public.bulk_assignment_audits
  FOR INSERT
  WITH CHECK (
    organization_id = public.current_user_org_id()
    AND public.is_org_admin()
  );

-- 4. Enable Realtime & Replica Identity
ALTER TABLE public.bulk_assignment_audits REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'bulk_assignment_audits'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bulk_assignment_audits;
  END IF;
END $$;
