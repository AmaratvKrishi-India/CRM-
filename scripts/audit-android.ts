#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { androidSdkEnvironment } from './android-sdk';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = androidSdkEnvironment(process.env);
const npmBinDir = join(dirname(process.execPath), 'node_modules', 'npm', 'bin');

const build = process.platform === 'win32'
  ? spawnSync(process.execPath, [join(npmBinDir, 'npm-cli.js'), 'run', 'build'], { cwd: rootDir, env, stdio: 'inherit', shell: false })
  : spawnSync('npm', ['run', 'build'], { cwd: rootDir, env, stdio: 'inherit', shell: false });
if (build.status !== 0) process.exit(build.status ?? 1);

const sync = process.platform === 'win32'
  ? spawnSync(process.execPath, [join(npmBinDir, 'npx-cli.js'), 'cap', 'sync', 'android'], { cwd: rootDir, env, stdio: 'inherit', shell: false })
  : spawnSync('npx', ['cap', 'sync', 'android'], { cwd: rootDir, env, stdio: 'inherit', shell: false });
if (sync.status !== 0) process.exit(sync.status ?? 1);

const androidDir = join(rootDir, 'android');
const gradleWrapper = join(androidDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
const lint = process.platform === 'win32'
  ? spawnSync('cmd.exe', ['/d', '/s', '/c', `${gradleWrapper} lint`], { cwd: androidDir, env, stdio: 'inherit', shell: false })
  : spawnSync(gradleWrapper, ['lint'], { cwd: androidDir, env, stdio: 'inherit', shell: false });
if (lint.status !== 0) process.exit(lint.status ?? 1);
