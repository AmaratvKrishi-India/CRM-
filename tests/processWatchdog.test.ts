import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runProcessWithWatchdog, watchdogSuiteLogPath } from '../scripts/process-watchdog';

test('watchdog log names cannot escape their fixed directory', () => {
  for (const name of ['../outside', 'a/b', 'a\\b', 'C:outside', '', '..']) {
    assert.throws(() => watchdogSuiteLogPath(name), /Invalid watchdog suite name/);
  }
  assert.match(watchdogSuiteLogPath('unit-tests'), /unit-tests\.log$/);
});

test('process watchdog returns PASSED for an owned process that exits cleanly', async () => {
  const result = await runProcessWithWatchdog({
    label: 'watchdog success test',
    command: process.execPath,
    args: ['tests/fixtures/watchdog-process.cjs'],
    timeoutMs: 5_000,
  });

  assert.equal(result.status, 'PASSED');
  assert.equal(result.timedOut, false);
  assert.match(result.stdout, /watchdog-ok/);
  assert.ok(result.pid);
});

test('process watchdog reaps a child that outlives its owned launcher', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'crm-watchdog-'));
  const marker = join(directory, 'orphan-marker.txt');
  try {
    const result = await runProcessWithWatchdog({
      label: 'watchdog orphan reaping test',
      command: process.execPath,
      args: ['tests/fixtures/watchdog-process.cjs', 'spawn-child', marker],
      timeoutMs: 5_000,
      logFile: 'test-results/watchdog/orphan-reaping-inner.log',
    });

    assert.equal(result.status, 'PASSED');
    assert.match(result.stdout, /child-pid=\d+/);
    await new Promise(resolve => setTimeout(resolve, 750));
    assert.equal(existsSync(marker), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('process watchdog returns TIMEOUT and records a process snapshot', async () => {
  const result = await runProcessWithWatchdog({
    label: 'watchdog timeout test',
    command: process.execPath,
    args: ['tests/fixtures/watchdog-process.cjs', 'wait'],
    timeoutMs: 250,
  });

  assert.equal(result.status, 'TIMEOUT');
  assert.equal(result.timedOut, true);
  assert.match(result.reason ?? '', /watchdog timeout/i);
  assert.ok(result.snapshots.length >= 2);
  assert.match(result.snapshots[1].cleanupAction, /taskkill|SIGTERM/);
});

test('watchdog rejects unapproved executables and executable arguments before spawn', async () => {
  for (const [command, args] of [
    ['unapproved-tool', []],
    [process.execPath, ['-e', 'process.exit(0)']],
    [process.execPath, ['../untrusted.js']],
    ['cmd.exe', ['/d', '/s', '/c', 'gradlew.bat lint & echo injected']],
  ] as const) {
    const result = await runProcessWithWatchdog({ label: 'rejected command', command, args: [...args], timeoutMs: 1000 });
    assert.equal(result.status, 'ERROR');
    assert.equal(result.pid, undefined);
    assert.match(result.reason ?? '', /rejected/);
  }
});
