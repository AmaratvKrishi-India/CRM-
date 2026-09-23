#!/usr/bin/env tsx
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const root = process.cwd();
const scanRoot = mkdtempSync(join(tmpdir(), 'crm-gitleaks-'));

try {
  const tracked = execFileSync('git', ['ls-files', '--stage', '-z'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).split('\0').filter(Boolean);

  let copied = 0;
  let skippedNonRegular = 0;
  let skippedMissing = 0;
  for (const entry of tracked) {
    const tab = entry.indexOf('\t');
    if (tab < 0) continue;
    const metadata = entry.slice(0, tab).trim().split(/\s+/);
    const mode = metadata[0] || '';
    const relativePath = entry.slice(tab + 1);

    // Only regular tracked blobs can be copied into the disposable scan tree.
    // Gitlinks/submodules (mode 160000), symlinks, and other special entries
    // are represented by Git metadata rather than regular file bytes.
    if (!/^100\d{3}$/.test(mode)) {
      skippedNonRegular++;
      continue;
    }

    const source = join(root, relativePath);
    if (!existsSync(source)) {
      skippedMissing++;
      continue;
    }
    const destination = join(scanRoot, relativePath);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
    copied++;
  }
  console.log(
    `Prepared ${copied} regular tracked files for Gitleaks (skipped ${skippedNonRegular} non-regular entries and ${skippedMissing} missing working-tree files).`
  );

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
