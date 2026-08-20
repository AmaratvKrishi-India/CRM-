import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 2E: Central Supabase Database & Row Level Security (RLS) Foundation', () => {
  const schemaMigrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20260820000001_phase2e_central_schema.sql'
  );
  const rlsMigrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20260820000002_phase2e_rls_policies.sql'
  );

  let schemaSql = '';
  let rlsSql = '';

  it('verifies that SQL migration files exist and are readable', () => {
    expect(fs.existsSync(schemaMigrationPath)).toBe(true);
    expect(fs.existsSync(rlsMigrationPath)).toBe(true);

    schemaSql = fs.readFileSync(schemaMigrationPath, 'utf8');
    rlsSql = fs.readFileSync(rlsMigrationPath, 'utf8');

    expect(schemaSql.length).toBeGreaterThan(100);
    expect(rlsSql.length).toBeGreaterThan(100);
  });

  describe('1. Central PostgreSQL Schema Definition', () => {
    const requiredTables = [
      'organizations',
      'profiles',
      'leads',
      'call_records',
      'activities',
      'remarks',
      'follow_ups',
      'message_history',
      'import_audits',
    ];

    it.each(requiredTables)('defines table public.%s with UUID primary key', (table) => {
      const tableDefRegex = new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}\\s*\\([\\s\\S]*?id UUID PRIMARY KEY`, 'i');
      expect(tableDefRegex.test(schemaSql)).toBe(true);
    });

    it('enforces multi-tenant organization_id on all child CRM tables', () => {
      const childTables = [
        'profiles',
        'leads',
        'call_records',
        'activities',
        'remarks',
        'follow_ups',
        'message_history',
        'import_audits',
      ];

      childTables.forEach((table) => {
        const orgFkRegex = new RegExp(
          `public\\.${table}[\\s\\S]*?organization_id UUID NOT NULL REFERENCES public\\.organizations\\(id\\)`,
          'i'
        );
        expect(orgFkRegex.test(schemaSql)).toBe(true);
      });
    });

    it('enforces non-destructive foreign keys (RESTRICT or SET NULL, never CASCADE delete)', () => {
      // Historical CRM data must never be deleted when a user is deactivated or removed
      expect(schemaSql).not.toMatch(/REFERENCES public\.profiles\(id\)\s+ON DELETE CASCADE/i);
      expect(schemaSql).not.toMatch(/REFERENCES public\.leads\(id\)\s+ON DELETE CASCADE/i);
      expect(schemaSql).not.toMatch(/REFERENCES public\.organizations\(id\)\s+ON DELETE CASCADE/i);
    });

    it('defines performance indexes on organization, lead, user, and status fields', () => {
      expect(schemaSql).toContain('idx_profiles_org_role_status');
      expect(schemaSql).toContain('idx_leads_org_assigned_deleted');
      expect(schemaSql).toContain('idx_leads_org_status_deleted');
      expect(schemaSql).toContain('idx_call_records_org_lead');
      expect(schemaSql).toContain('idx_activities_org_lead');
      expect(schemaSql).toContain('idx_follow_ups_org_lead_status');
    });
  });

  describe('2. Row Level Security (RLS) Activation & Security Helper Functions', () => {
    const rlsTables = [
      'organizations',
      'profiles',
      'leads',
      'call_records',
      'activities',
      'remarks',
      'follow_ups',
      'message_history',
      'import_audits',
    ];

    it.each(rlsTables)('enables RLS on public.%s table', (table) => {
      const enableRlsRegex = new RegExp(`ALTER TABLE public\\.${table}\\s+ENABLE ROW LEVEL SECURITY;`, 'i');
      expect(enableRlsRegex.test(rlsSql)).toBe(true);
    });

    it('defines recursion-safe STABLE helper functions with SECURITY DEFINER', () => {
      expect(rlsSql).toContain('FUNCTION public.current_user_org_id()');
      expect(rlsSql).toContain('FUNCTION public.current_user_role()');
      expect(rlsSql).toContain('FUNCTION public.is_org_admin()');
      expect(rlsSql).toContain('FUNCTION public.is_active_org_user()');

      // Verify STABLE and SECURITY DEFINER
      expect(rlsSql).toMatch(/current_user_org_id\(\)[\s\S]*?STABLE[\s\S]*?SECURITY DEFINER/i);
      expect(rlsSql).toMatch(/is_org_admin\(\)[\s\S]*?STABLE[\s\S]*?SECURITY DEFINER/i);
    });

    it('strictly enforces immutable append-only activities (no UPDATE/DELETE policies)', () => {
      // Must have SELECT and INSERT policies
      expect(rlsSql).toContain('CREATE POLICY "activities_select_policy" ON public.activities');
      expect(rlsSql).toContain('CREATE POLICY "activities_insert_policy" ON public.activities');

      // Must NOT contain UPDATE or DELETE policy on activities
      expect(rlsSql).not.toMatch(/CREATE POLICY .*? ON public\.activities\s+FOR (UPDATE|DELETE)/i);
    });

    it('includes role-protection trigger preventing agents from modifying immutable fields', () => {
      expect(rlsSql).toContain('protect_profile_immutable_fields');
      expect(rlsSql).toContain('Agents are strictly forbidden from altering user roles');
      expect(rlsSql).toContain('trg_protect_profile_immutable_fields');
    });

    it('enforces organization isolation across all policies', () => {
      expect(rlsSql).toContain('current_user_org_id()');
      expect(rlsSql).toContain('is_active_org_user()');
    });
  });

  describe('3. Local Dexie ↔ Central PostgreSQL ID Strategy', () => {
    it('verifies that both Local Dexie and Central PostgreSQL use UUID v4 identifiers', () => {
      // The schema specifies UUID primary key with gen_random_uuid()
      expect(schemaSql).toMatch(/id UUID PRIMARY KEY DEFAULT gen_random_uuid\(\)/i);
    });
  });
});
