import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const harnessPath = path.resolve(here, 'multiDeviceSync.test.ts');
const source = fs.readFileSync(harnessPath, 'utf8');

test('F056 multi-device assignments use the revision-safe sync RPC', () => {
  assert.match(source, /\/rest\/v1\/rpc\/sync_mutate/);
  assert.doesNotMatch(source, /method:\s*'PATCH'/);
});

test('F056 agent workflow saves through the real application UI', () => {
  assert.match(source, /getByRole\('button', \{ name: 'Call', exact: true \}\)/);
  assert.match(source, /Save call outcome & notes/);
  assert.match(source, /Save remark/);
  assert.ok(!source.includes('Skip / do not record'));
});

test('F056 harness verifies local outbox drainage after sync', () => {
  assert.match(source, /waitForOutboxToDrain/);
  assert.match(source, /objectStore\('outbox'\)/);
});

test('F056 emulator login retries a missing request without accepting a non-200 response', () => {
  assert.match(source, /AUTH_RESPONSE_ATTEMPTS\s*=\s*2/);
  assert.match(source, /for \(let attempt = 1; attempt <= AUTH_RESPONSE_ATTEMPTS; attempt\+\+\)/);
  assert.match(source, /assert\.strictEqual\(response\.status\(\), 200/);
});
