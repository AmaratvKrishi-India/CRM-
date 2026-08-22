-- ====================================================================
-- Amaratv Krishi Field Sales CRM — Deterministic Seed Data
-- ====================================================================

-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 0. Deterministic Auth Users & Identities (for Local Supabase Auth & RLS Testing)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  email_change_token_current,
  phone,
  phone_change,
  phone_change_token,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES 
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000010', 'authenticated', 'authenticated', 'admin@amaratvkrishi.com', crypt('Admin@123', gen_salt('bf')), NOW(), '', '', '', '', '', '+919999999999', '', '', '{"provider":"email","providers":["email"]}', '{"name":"System Administrator"}', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000011', 'authenticated', 'authenticated', 'rahul@amaratvkrishi.com', crypt('Agent@123', gen_salt('bf')), NOW(), '', '', '', '', '', '+919876543211', '', '', '{"provider":"email","providers":["email"]}', '{"name":"Rahul Verma"}', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000012', 'authenticated', 'authenticated', 'pooja@amaratvkrishi.com', crypt('Agent@123', gen_salt('bf')), NOW(), '', '', '', '', '', '+919876543212', '', '', '{"provider":"email","providers":["email"]}', '{"name":"Pooja Sharma"}', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET 
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = EXCLUDED.email_confirmed_at;



INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES 
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000010', '{"sub":"00000000-0000-0000-0000-000000000010","email":"admin@amaratvkrishi.com","email_verified":true,"phone_verified":false}', 'email', '00000000-0000-0000-0000-000000000010', NOW(), NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000011', '{"sub":"00000000-0000-0000-0000-000000000011","email":"rahul@amaratvkrishi.com","email_verified":true,"phone_verified":false}', 'email', '00000000-0000-0000-0000-000000000011', NOW(), NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000012', '{"sub":"00000000-0000-0000-0000-000000000012","email":"pooja@amaratvkrishi.com","email_verified":true,"phone_verified":false}', 'email', '00000000-0000-0000-0000-000000000012', NOW(), NOW(), NOW())
ON CONFLICT (provider, provider_id) DO UPDATE SET
  identity_data = EXCLUDED.identity_data,
  updated_at = EXCLUDED.updated_at;


-- 1. Test Organization
INSERT INTO public.organizations (id, name, created_at, updated_at)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Amaratv Krishi Lucknow Central', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 2. Test Profiles (Admin & Field Agents)
INSERT INTO public.profiles (id, auth_user_id, organization_id, name, email, phone, role, status, created_at, updated_at)
VALUES 
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'System Administrator', 'admin@amaratvkrishi.com', '+919999999999', 'ADMIN', 'ACTIVE', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Rahul Verma', 'rahul@amaratvkrishi.com', '+919876543211', 'AGENT', 'ACTIVE', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Pooja Sharma', 'pooja@amaratvkrishi.com', '+919876543212', 'AGENT', 'ACTIVE', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET 
  auth_user_id = EXCLUDED.auth_user_id,
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  status = EXCLUDED.status;

-- 3. Test Leads (Assigned and Unassigned)
INSERT INTO public.leads (id, organization_id, business_name, category, phone, phone_e164, phone_type, address, locality, city, state, status, created_by, assigned_to, created_at, updated_at)
VALUES 
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'Gold Gym Hazratganj', 'Gym', '9876543210', '+919876543210', 'mobile', 'Hazratganj Market, Lucknow', 'Hazratganj', 'Lucknow', 'Uttar Pradesh', 'NEW', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000011', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', 'FitHub Gomti Nagar', 'Fitness Center', '7054447888', '+917054447888', 'mobile', 'Vibhuti Khand, Gomti Nagar', 'Gomti Nagar', 'Lucknow', 'Uttar Pradesh', 'INTERESTED', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000012', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', 'Iron Paradise Alambagh', 'Gym', '8887776655', '+918887776655', 'mobile', 'Alambagh Main Road', 'Alambagh', 'Lucknow', 'Uttar Pradesh', 'NEW', '00000000-0000-0000-0000-000000000010', NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

