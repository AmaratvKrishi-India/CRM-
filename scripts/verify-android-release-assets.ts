import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv } from 'vite';
import { validateReleaseConfig } from './verify-release-config';

function filesUnder(root: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) out.push(...filesUnder(path));
    else out.push(path);
  }
  return out;
}

const env = loadEnv('production', process.cwd(), '');
validateReleaseConfig(env);
const root = join(process.cwd(), 'android', 'app', 'src', 'main', 'assets', 'public');
const js = filesUnder(root).filter((path) => path.endsWith('.js'));
if (!js.length) throw new Error('Android packaged web assets contain no JavaScript bundles.');
const text = js.map((path) => readFileSync(path, 'utf8')).join('\n');
for (const name of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const) {
  const value = env[name]!;
  if (!text.includes(value)) throw new Error(`Android packaged assets are missing required marker: ${name}`);
}
console.log('Android release asset gate PASSED (required client markers embedded; values not printed).');
