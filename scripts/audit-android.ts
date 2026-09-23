#!/usr/bin/env tsx
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { androidSdkEnvironment } from './android-sdk';
import { runProcessWithWatchdog } from './process-watchdog';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = androidSdkEnvironment(process.env);
const npmBinDir = join(dirname(process.execPath), 'node_modules', 'npm', 'bin');

const androidDir = join(rootDir, 'android');
const gradleWrapper = join(androidDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');

const logFile = join(rootDir, 'test-results', 'android-audit-watchdog.log');

async function main(): Promise<void> {
  const build = process.platform === 'win32'
    ? { command: process.execPath, args: [join(npmBinDir, 'npm-cli.js'), 'run', 'build'] }
    : { command: 'npm', args: ['run', 'build'] };
  const sync = process.platform === 'win32'
    ? { command: process.execPath, args: [join(npmBinDir, 'npx-cli.js'), 'cap', 'sync', 'android'] }
    : { command: 'npx', args: ['cap', 'sync', 'android'] };
  const lint = process.platform === 'win32'
    ? { command: 'cmd.exe', args: ['/d', '/s', '/c', 'gradlew.bat lint'], cwd: androidDir }
    : { command: gradleWrapper, args: ['lint'], cwd: androidDir };

  const stages = [
    { label: 'Android audit: web build', ...build, cwd: rootDir, timeoutMs: 180_000 },
    { label: 'Android audit: Capacitor sync', ...sync, cwd: rootDir, timeoutMs: 120_000 },
    { label: 'Android audit: Gradle lint', ...lint, timeoutMs: 300_000 },
  ];

  for (const stage of stages) {
    const result = await runProcessWithWatchdog({
      ...stage,
      env,
      logFile,
      echoOutput: true,
    });
    if (result.status !== 'PASSED') {
      console.error(`${stage.label} ${result.status}: ${result.reason ?? 'no additional reason'}`);
      process.exitCode = 1;
      return;
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
