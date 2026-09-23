import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';

export interface LocalSupabaseEnv {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  jwtSecret: string;
}

let cached: LocalSupabaseEnv | undefined;

function parseEnv(output: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of output.split(/\r?\n/)) {
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const raw = line.slice(separator + 1).trim();
    values[key] = raw.replace(/^['"]|['"]$/g, '');
  }
  return values;
}
export function getLocalSupabaseEnv(): LocalSupabaseEnv {
  if (cached) return cached;
  const npxArgs = ['--no-install', 'supabase', 'status', '-o', 'env'];
  const executable = process.platform === 'win32' ? process.execPath : 'npx';
  const args = process.platform === 'win32'
    ? [join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js'), ...npxArgs]
    : npxArgs;
  const output = execFileSync(executable, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30_000,
    windowsHide: true,
  });
  const values = parseEnv(output);
  const required = ['API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY', 'JWT_SECRET'] as const;
  for (const name of required) {
    if (!values[name]) throw new Error(`Local Supabase status did not provide ${name}.`);
  }
  cached = {
    apiUrl: values.API_URL,
    anonKey: values.ANON_KEY,
    serviceRoleKey: values.SERVICE_ROLE_KEY,
    jwtSecret: values.JWT_SECRET,
  };
  return cached;
}
