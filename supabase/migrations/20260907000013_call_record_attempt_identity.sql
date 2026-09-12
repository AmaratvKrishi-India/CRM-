-- A dial_attempt_id is the application-level identity of one dial attempt.
-- Distinct local record UUIDs must not create duplicate server call records
-- when two devices retry the same attempt.
BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS idx_call_records_org_dial_attempt
  ON public.call_records (organization_id, dial_attempt_id)
  WHERE dial_attempt_id IS NOT NULL;
COMMIT;
