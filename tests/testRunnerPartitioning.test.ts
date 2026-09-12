import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('unified and CI unit suites exclude integration tests', () => {
  const unified = readFileSync('scripts/run-all-tests.ts', 'utf8');
  const ci = readFileSync('scripts/ci-test-runner.ts', 'utf8');

  assert.match(
    unified,
    /name: 'unit-tests'[\s\S]*?--exclude[\s\S]*?tests\/integration\/\*\*/,
    'unified unit suite must exclude tests/integration/**'
  );
  assert.match(
    ci,
    /'unit':[^\n]*--exclude(?:=|\s+)tests\/integration\/\*\*/,
    'CI unit suite must exclude tests/integration/**'
  );
});

test('unified runner enables the quality gate by default', () => {
  const unified = readFileSync('scripts/run-all-tests.ts', 'utf8');

  assert.match(
    unified,
    /\.option\('--no-quality-gate',\s*'Skip quality gate evaluation'\)/,
    'the negated Commander option must keep its implicit true default'
  );
  assert.doesNotMatch(
    unified,
    /\.option\('--no-quality-gate',[\s\S]*?,\s*false\)/,
    'an explicit false default disables the quality gate on normal runs'
  );
});

test('required dependency security gate uses npm audit at high severity', () => {
  const unified = readFileSync('scripts/run-all-tests.ts', 'utf8');

  assert.match(
    unified,
    /name: 'security-tests'[\s\S]*?command: 'npm'[\s\S]*?args: \['audit', '--audit-level=high', '--json'\][\s\S]*?required: true/,
    'the required suite must use a deterministic dependency audit that runs on Windows'
  );
});

test('local Supabase integration files run serially', () => {
  const unified = readFileSync('scripts/run-all-tests.ts', 'utf8');

  assert.match(
    unified,
    /name: 'integration-tests'[\s\S]*?--no-file-parallelism/,
    'integration files share one local Supabase stack and must not race each other'
  );
});
