import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

test('F038 ADR-0001 states the implemented revision protocol and references existing files', () => {
  const adr = readFileSync('docs/decisions/0001-account-scoped-offline-first-sync.md', 'utf8');
  for (const section of ['Context', 'Decision', 'Alternatives Considered', 'Consequences', 'Operational and Recovery Implications']) {
    assert.ok(adr.includes(`## ${section}`), section);
  }
  for (const term of ['sync_mutate', 'expected revision', 'CONFLICT', 'Realtime', 'account']) assert.ok(adr.includes(term), term);
  for (const match of adr.matchAll(/`((?:src|supabase|docs)\/[^`]+\.(?:ts|md|sql))`/g)) assert.ok(existsSync(match[1]), match[1]);
});
test('F039 contribution guide commands and relative links resolve', () => {
  const path = 'CONTRIBUTING.md'; const guide = readFileSync(path, 'utf8');
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  for (const match of guide.matchAll(/npm run ([\w:-]+)/g)) assert.ok(pkg.scripts[match[1]], match[1]);
  for (const match of guide.matchAll(/\]\(([^)]+)\)/g)) assert.ok(existsSync(resolve(dirname(path), match[1])), match[1]);
});
test('current documentation authorities agree on release status and resolve', () => {
  const gatesPath = 'GATES.md';
  const statePath = 'docs/project-knowledge/16_CURRENT_STATE.md';
  const signoffPath = 'docs/project-knowledge/FINAL_RELEASE_SIGNOFF_2026-09-09.md';
  const gates = readFileSync(gatesPath, 'utf8');
  const state = readFileSync(statePath, 'utf8');
  assert.match(gates, /NOT RELEASE-APPROVED/);
  assert.match(state, /NOT RELEASE-APPROVED/);
  assert.ok(existsSync(signoffPath));
  assert.ok(gates.includes('FINAL_RELEASE_SIGNOFF_2026-09-09.md'));
  assert.doesNotMatch(gates, /FINAL_LOCAL_REMEDIATION_2026-09-06/);
});
