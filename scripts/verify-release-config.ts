import { loadEnv } from 'vite';
import { pathToFileURL } from 'node:url';

export type ReleaseConfig = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  [key: string]: string | undefined;
};

export function validateReleaseConfig(env: ReleaseConfig): void {
  const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter((name) => !env[name]?.trim());
  if (missing.length) throw new Error(`Release configuration is incomplete: missing ${missing.join(', ')}`);

  const endpoint = new URL(env.VITE_SUPABASE_URL!);
  if (endpoint.protocol !== 'https:' || !endpoint.hostname.endsWith('.supabase.co')) {
    throw new Error('Release Supabase URL must be an HTTPS supabase.co endpoint.');
  }

  const leakedServiceRole = Object.entries(env).some(([key, value]) =>
    key.startsWith('VITE_') && /SERVICE_ROLE/i.test(key) && Boolean(value?.trim())
  );
  if (leakedServiceRole) throw new Error('Client release environment must not expose a service-role key.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = loadEnv('production', process.cwd(), '');
  validateReleaseConfig(env);
  console.log('Release configuration gate PASSED (required client values present; secret values not printed).');
}
