import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

test('current lead edit flow targets the named lead instead of a volatile list index', () => {
  const flow = read('e2e/maestro/current/leads/edit.yaml');
  assert.doesNotMatch(flow, /id:\s*"lead-item-0"/);
  assert.match(flow, /tapOn:\s*\n\s*text:\s*"\.\*Gold Gym Hazratganj\.\*"/);
});

test('lead edit flows reveal Contacted by scrolling toward the preceding native select option', () => {
  for (const path of ['e2e/maestro/current/leads/edit.yaml', 'e2e/maestro/leads/edit.yaml']) {
    const flow = read(path);
    assert.match(
      flow,
      /scrollUntilVisible:\s*\n\s*element:\s*"Contacted"\s*\n\s*direction:\s*DOWN/,
      path
    );
  }
});

test('offline conflict flow targets its uniquely named lead instead of volatile list indices', () => {
  const flow = read('e2e/maestro/sync/conflict.yaml');
  assert.doesNotMatch(flow, /id:\s*"lead-item-0"/);
  assert.ok((flow.match(/text:\s*"\.\*Legacy Maestro Conflict \$\{MAESTRO_RUN_TAG\} Gym(?: LOCAL)?\.\*"/g) ?? []).length >= 2);
});

test('admin agent flow waits for provisioning modal closure before using the search input', () => {
  const flow = read('e2e/maestro/admin/agents.yaml');
  assert.match(flow, /notVisible:\s*\n\s*id:\s*"agent-name"/);
  assert.match(flow, /id:\s*"agent-password"[\s\S]*?inputText:\s*\$\{MAESTRO_PROVISIONED_AGENT_PASSWORD\}[\s\S]*?id:\s*"agent-confirm-password"[\s\S]*?inputText:\s*\$\{MAESTRO_PROVISIONED_AGENT_PASSWORD\}/);
  assert.match(flow, /inputText:\s*\$\{MAESTRO_PROVISIONED_AGENT_PASSWORD\}[\s\S]*?hideKeyboard[\s\S]*?scrollUntilVisible:[\s\S]*?id:\s*"agent-confirm-password"/);
  assert.match(flow, /id:\s*"admin-agents-search"/);
  assert.match(flow, /id:\s*"agent-edit-\$\{MAESTRO_PROVISIONED_AGENT_EMAIL\}"/);
  assert.match(flow, /id:\s*"agent-deactivate-\$\{MAESTRO_PROVISIONED_AGENT_EMAIL\}"/);
  const source = read('src/components/admin/AdminAgentsView.tsx');
  assert.match(source, /id="admin-agents-search"/);
  const card = read('src/components/admin/AgentCard.tsx');
  assert.match(card, /id=\{`agent-edit-\$\{agent\.email\}`\}/);
  assert.match(card, /id=\{`agent-deactivate-\$\{agent\.email\}`\}/);
  assert.match(read('src/components/auth/LoginScreen.tsx'), /id="login-submit-button"/);
  assert.match(flow, /id:\s*"login-submit-button"/);
});

test('Maestro starts the local create-agent function only for provisioning flows', () => {
  const source = read('scripts/run-maestro.ts');
  assert.match(source, /flowRequiresCreateAgentServer/);
  assert.match(source, /functions\/v1\/\$\{CREATE_AGENT_FUNCTION\}/);
  assert.match(source, /loopback local API URL/);
  assert.match(source, /stopCreateAgentServer\(createAgentServer\)/);
});

test('admin import flow no longer depends on the stale duplicate-dialog branch', () => {
  const flow = read('e2e/maestro/admin/import.yaml');
  assert.doesNotMatch(flow, /Duplicate Leads Detected|Resolve & Import Duplicates|Skip Duplicates/);
  assert.match(flow, /id:\s*"import-preview-search"/);
  assert.match(flow, /Import 140 Valid Leads/);
});

test('lead assignment flow validates assignee name independently of layout text concatenation', () => {
  const flow = read('e2e/maestro/leads/assign.yaml');
  assert.match(flow, /assertVisible:\s*"Assigned:\.\*"/);
  assert.match(flow, /assertVisible:\s*"Rahul Verma"/);
});
