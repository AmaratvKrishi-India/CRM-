-- ====================================================================
-- Amaratv Krishi Field Sales CRM — Central Database Schema (Phase 2E)
-- PostgreSQL / Supabase Migration
-- Offline-First, Multi-Tenant / Organization Architecture
-- ====================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================================
-- 1. ORGANIZATIONS TABLE
-- Multi-tenant boundary isolating CRM records per company
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ====================================================================
-- 2. PROFILES TABLE
-- Central application user profile linked to Supabase auth.users
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'AGENT')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    version INT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ
);

-- Unique email per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_org_email 
ON public.profiles(organization_id, LOWER(email)) 
WHERE deleted_at IS NULL;

-- ====================================================================
-- 3. LEADS TABLE
-- Central gym, fitness, and wellness lead entities
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    business_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Gym',
    phone TEXT NOT NULL,
    phone_raw TEXT,
    phone_e164 TEXT,
    phone_type TEXT DEFAULT 'mobile',
    alternate_phone TEXT,
    contact_person TEXT,
    address TEXT NOT NULL,
    locality TEXT NOT NULL,
    pincode TEXT,
    city TEXT NOT NULL DEFAULT 'Lucknow',
    state TEXT NOT NULL DEFAULT 'Uttar Pradesh',
    website TEXT,
    rating NUMERIC(3, 2),
    review_count INT,
    source TEXT NOT NULL DEFAULT 'Field Sales',
    source_file TEXT,
    source_row INT,
    status TEXT NOT NULL DEFAULT 'NEW',
    custom_notes TEXT DEFAULT '',
    last_contacted_at TIMESTAMPTZ,
    next_follow_up_at TIMESTAMPTZ,
    call_count INT NOT NULL DEFAULT 0,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version INT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ
);

-- ====================================================================
-- 4. CALL RECORDS TABLE
-- Call attempts, outcomes, and verified talk durations
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.call_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    device_id TEXT,
    started_at TIMESTAMPTZ NOT NULL,
    answered_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INT NOT NULL DEFAULT 0,
    outcome TEXT NOT NULL,
    remark TEXT,
    verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED' CHECK (verification_status IN ('UNVERIFIED', 'VERIFIED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version INT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ
);

-- ====================================================================
-- 5. ACTIVITIES TABLE
-- Append-only immutable sales operations event stream
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    device_id TEXT,
    activity_type TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version INT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ
);

-- ====================================================================
-- 6. REMARKS TABLE
-- Lead notes and predefined pitch remarks
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.remarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'CUSTOM',
    author TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- ====================================================================
-- 7. FOLLOW-UPS TABLE
-- Scheduled callbacks, visits, and sales reminders
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.follow_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    title TEXT NOT NULL,
    notes TEXT,
    priority TEXT NOT NULL DEFAULT 'MEDIUM',
    status TEXT NOT NULL DEFAULT 'PENDING',
    completed_at TIMESTAMPTZ,
    outcome_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- ====================================================================
-- 8. MESSAGE HISTORY TABLE
-- WhatsApp pitch dispatch history
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.message_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    template_id TEXT,
    channel TEXT NOT NULL DEFAULT 'WHATSAPP',
    recipient_phone TEXT NOT NULL,
    message_content TEXT NOT NULL,
    sent_status TEXT NOT NULL DEFAULT 'INITIATED',
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- ====================================================================
-- 9. IMPORT AUDITS TABLE
-- Spreadsheet and bulk lead import audit history
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.import_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    device_id TEXT,
    filename TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'Excel Import',
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    total_rows INT NOT NULL DEFAULT 0,
    imported INT NOT NULL DEFAULT 0,
    updated INT NOT NULL DEFAULT 0,
    duplicates INT NOT NULL DEFAULT 0,
    invalid INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ====================================================================
-- INDEXES FOR PERFORMANCE & QUERY OPTIMIZATION
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_org_role_status ON public.profiles(organization_id, role, status);
CREATE INDEX IF NOT EXISTS idx_leads_org_assigned_deleted ON public.leads(organization_id, assigned_to, deleted_at);
CREATE INDEX IF NOT EXISTS idx_leads_org_status_deleted ON public.leads(organization_id, status, deleted_at);
CREATE INDEX IF NOT EXISTS idx_leads_org_locality_deleted ON public.leads(organization_id, locality, deleted_at);
CREATE INDEX IF NOT EXISTS idx_call_records_org_lead ON public.call_records(organization_id, lead_id);
CREATE INDEX IF NOT EXISTS idx_call_records_org_user ON public.call_records(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_activities_org_lead ON public.activities(organization_id, lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_org_user ON public.activities(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_remarks_org_lead ON public.remarks(organization_id, lead_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_org_lead_status ON public.follow_ups(organization_id, lead_id, status);
CREATE INDEX IF NOT EXISTS idx_message_history_org_lead ON public.message_history(organization_id, lead_id);
CREATE INDEX IF NOT EXISTS idx_import_audits_org_user ON public.import_audits(organization_id, uploaded_by);
