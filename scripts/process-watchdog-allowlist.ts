import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveAndroidSdkPath } from './android-sdk';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));

export function validateProcessCommand(command: string, args: string[], cwd = repositoryRoot): void {
  if (args.some(arg => typeof arg !== 'string' || /[\0\r\n]/.test(arg))) {
    throw new Error('Watchdog rejected invalid process arguments.');
  }
  if (command === process.execPath) {
    const entrypoints = [
      join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
      join(dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js'),
      join(repositoryRoot, 'node_modules/playwright/cli.js'),
      join(repositoryRoot, 'node_modules/tsx/dist/cli.mjs'),
      join(repositoryRoot, 'tests/fixtures/watchdog-process.cjs'),
    ];
    if (!args[0] || !entrypoints.includes(resolve(cwd, args[0]))) {
      throw new Error('Watchdog rejected unapproved Node entrypoint.');
    }
    return;
  }
  if (command === 'npm' || command === 'npx') {
    const first = args[0] === '--no-install' ? args[1] : args[0];
    const allowed = command === 'npm' ? ['run', 'audit'] : ['tsc', 'eslint', 'vitest', 'playwright', 'tsx', 'supabase', 'cap'];
    if (!allowed.includes(first)) throw new Error('Watchdog rejected unapproved package command.');
    return;
  }
  if (command === 'cmd.exe' && process.platform === 'win32') {
    const invocation = args[3] || '';
    const maestro = process.env.MAESTRO_BIN;
    const maestroPrefix = maestro ? [`call "${maestro}" `, `"${maestro}" `] : ['maestro '];
    const approved = /^gradlew\.bat (?:lint|assembleDebug|assembleRelease)(?: --no-daemon)?$/.test(invocation) ||
      maestroPrefix.some(prefix => invocation.startsWith(prefix) && /^(?:test |--version$)/.test(invocation.slice(prefix.length)));
    if (args.length !== 4 || args.slice(0, 3).join(' ') !== '/d /s /c' ||
        /[&|<>^%!\r\n\0]/.test(invocation) || !approved) {
      throw new Error('Watchdog rejected unapproved Windows wrapper invocation.');
    }
    return;
  }
  if (command === join(repositoryRoot, 'android', 'gradlew') ||
      command === (process.env.MAESTRO_BIN || 'maestro')) return;
  let adb: string | undefined;
  try { adb = join(resolveAndroidSdkPath(), 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb'); } catch { /* Not installed. */ }
  if (command === adb) return;
  throw new Error('Watchdog rejected executable outside the test-tool allowlist.');
}
