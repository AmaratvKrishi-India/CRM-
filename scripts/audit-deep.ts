#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';

const suites = [
  'audit:security',
  'audit:dependencies',
  'audit:osv',
  'audit:secrets',
  'audit:gitleaks',
  'audit:trivy',
  'audit:deadcode',
  'audit:architecture',
  'audit:database',
  'audit:mutation',
  'audit:android',
  'audit:accessibility',
  'audit:performance',
  'audit:release',
];

function npmCommand(args: string[]) {
  if (process.platform === 'win32') {
    const cli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
    return { command: process.execPath, args: [cli, ...args] };
  }
  return { command: 'npm', args };
}

const results: Array<{ suite: string; status: number }> = [];
for (const suite of suites) {
  console.log(`\n===== ${suite} =====`);
  const cmd = npmCommand(['run', suite]);
  const result = spawnSync(cmd.command, cmd.args, { stdio: 'inherit', shell: false });
  results.push({ suite, status: result.status ?? 1 });
}

console.log('\n===== audit summary =====');
for (const result of results) {
  console.log(`${result.status === 0 ? 'PASS' : 'FAIL'} ${result.suite}`);
}
const failed = results.filter((result) => result.status !== 0);
process.exitCode = failed.length === 0 ? 0 : 1;
