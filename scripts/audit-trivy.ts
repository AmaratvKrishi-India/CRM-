#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scanRoot = join(root, 'test-results', 'audit-trivy-input');
rmSync(scanRoot, { recursive: true, force: true });
mkdirSync(scanRoot, { recursive: true });

const inputs = [
  'package.json',
  'package-lock.json',
  'vercel.json',
  'supabase/config.toml',
  'android/app/src/main/AndroidManifest.xml',
  '.github/workflows',
];

for (const input of inputs) {
  const source = join(root, input);
  if (!existsSync(source)) continue;
  const destination = join(scanRoot, input);
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true });
  console.log(`Included ${relative(root, source)}`);
}

const dockerPath = scanRoot.replace(/\\/g, '/');
const args = [
  'run', '--rm',
  '-v', 'crm-trivy-cache:/root/.cache/trivy',
  '-v', `${dockerPath}:/scan:ro`,
  'aquasec/trivy:0.74.0',
  'fs', '--scanners', 'vuln,misconfig', '--include-dev-deps', '/scan',
];

const result = spawnSync('docker', args, {
  cwd: root,
  stdio: 'inherit',
  shell: false,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
