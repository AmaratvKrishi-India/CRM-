#!/usr/bin/env tsx
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const root = process.cwd();
const scanRoot = mkdtempSync(join(tmpdir(), 'crm-gitleaks-'));

try {
  const tracked = execFileSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).split('\0').filter(Boolean);

  let copied = 0;
  for (const relativePath of tracked) {
    const source = join(root, relativePath);
    if (!existsSync(source)) continue;
    const destination = join(scanRoot, relativePath);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
    copied++;
  }
  console.log(`Prepared ${copied} tracked files for Gitleaks.`);

  const volumeArg = `${scanRoot}:/repo:ro`;
  const result = spawnSync(
    'docker',
    [
      'run', '--rm', '-v', volumeArg,
      'ghcr.io/gitleaks/gitleaks:v8.30.1',
      'dir', '--redact', '--no-banner', '--verbose', '--timeout', '300', '/repo',
    ],
    { cwd: root, stdio: 'inherit', shell: false }
  );

  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(scanRoot, { recursive: true, force: true });
}
