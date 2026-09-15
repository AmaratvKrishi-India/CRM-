#!/usr/bin/env tsx
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const python = process.env.PYTHON || 'python';
const code = "import os,sysconfig; s=sysconfig.get_path('scripts', scheme='nt_user' if os.name=='nt' else 'posix_user'); print(s or '')";
const probe = spawnSync(python, ['-c', code], { encoding: 'utf8', shell: false });
const scriptsDir = probe.status === 0 ? probe.stdout.trim() : '';
const candidates = process.platform === 'win32'
  ? [process.env.SEMGREP_BIN, scriptsDir && join(scriptsDir, 'pysemgrep.exe'), scriptsDir && join(scriptsDir, 'semgrep.exe')]
  : [process.env.SEMGREP_BIN, scriptsDir && join(scriptsDir, 'semgrep'), 'semgrep'];
const executable = candidates.find((candidate) => candidate && (candidate === 'semgrep' || existsSync(candidate)));
if (!executable) throw new Error('Semgrep executable not found. Install Semgrep or set SEMGREP_BIN.');

const args = ['scan', '--config', 'p/default', '--config', 'p/typescript', '--config', 'p/react', '--exclude', 'node_modules', '--exclude', 'dist', '--exclude', 'coverage', '--exclude', 'test-results', '--exclude', 'graft', '--exclude', 'android/app/build', 'src', 'scripts', 'tests', 'supabase/functions'];
const result = spawnSync(executable, args, { stdio: 'inherit', shell: false });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
