import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve('supabase/migrations/20260909000014_child_lead_rls_hardening.sql'),
  'utf8',
);

const policyBlock = (name: string): string => {
  const start = migration.indexOf(`"${name}"`);
  assert.ok(start >= 0, `missing ${name}`);
  const next = migration.indexOf('\n\nDROP POLICY', start + 1);
  return migration.slice(start, next < 0 ? migration.length : next);
};

test('F047 exposes an org-scoped parent lead authorization helper', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.can_access_lead_for_current_user\(p_lead_id uuid\)/);
  assert.match(migration, /l\.organization_id = public\.current_user_org_id\(\)/);
  assert.match(migration, /l\.assigned_to = public\.current_profile_id\(\)/);
  assert.match(migration, /l\.created_by = public\.current_profile_id\(\)/);
});

test('F047 child writes require current ownership and a visible parent lead', () => {
  for (const policy of [
    'call_records_insert_policy',
    'call_records_update_policy',
    'follow_ups_insert_policy',
    'follow_ups_update_policy',
    'remarks_insert_policy',
    'remarks_update_policy',
    'activities_insert_policy',
    'message_history_insert_policy',
    'message_history_update_policy',
  ]) {
    const block = policyBlock(policy);
    assert.match(block, /organization_id = public\.current_user_org_id\(\)/, policy);
    assert.match(block, /public\.is_org_admin\(\)/, policy);
    assert.match(block, /user_id = public\.current_profile_id\(\)/, policy);
    assert.match(block, /public\.can_access_lead_for_current_user\(lead_id\)/, policy);
  }
});
