-- ====================================================================
-- PHASE 2J MIGRATION: CALL DURATION & VERIFICATION PERFORMANCE INDEXES
-- Optimizes query performance for agent verified talk-time analytics,
-- call-duration aggregations, and chronological lead call history.
-- ====================================================================

-- Composite index for agent call duration and verification analytics
CREATE INDEX IF NOT EXISTS idx_call_records_org_user_verif_started 
ON public.call_records(organization_id, user_id, verification_status, started_at DESC);

-- Composite index for chronological lead call records
CREATE INDEX IF NOT EXISTS idx_call_records_org_lead_started 
ON public.call_records(organization_id, lead_id, started_at DESC);
