-- ====================================================================
-- PHASE 2K MIGRATION: SUPABASE REALTIME PUBLICATION & REPLICA IDENTITY
-- Ensures all CRM core tables are included in the supabase_realtime publication
-- and configured for instant cross-device event streaming.
-- ====================================================================

-- Enable replica identity full for real-time update payloads
ALTER TABLE public.leads REPLICA IDENTITY FULL;
ALTER TABLE public.call_records REPLICA IDENTITY FULL;
ALTER TABLE public.activities REPLICA IDENTITY FULL;
ALTER TABLE public.remarks REPLICA IDENTITY FULL;
ALTER TABLE public.follow_ups REPLICA IDENTITY FULL;
ALTER TABLE public.message_history REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.import_audits REPLICA IDENTITY FULL;

-- Add tables to the supabase_realtime publication (if not already published)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'leads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'call_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.call_records;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'activities'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'remarks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.remarks;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'follow_ups'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.follow_ups;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'message_history'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_history;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'import_audits'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.import_audits;
  END IF;
END $$;
