import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Environment = Record<string, string>;

function readEnvironment(file: string): Environment {
  const text = readFileSync(resolve(process.cwd(), file), 'utf8');
  const values: Environment = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    values[line.slice(0, separator).trim()] = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return values;
}

function projectRef(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    const suffix = '.supabase.co';
    return host.endsWith(suffix) ? host.slice(0, -suffix.length) : null;
  } catch {
    return null;
  }
}

const staging = readEnvironment('.env.staging');
const production = readEnvironment('.env.production');
const stagingUrl = staging.VITE_SUPABASE_URL ?? '';
const productionUrl = production.VITE_SUPABASE_URL ?? '';
const stagingRef = projectRef(stagingUrl);
const productionRef = projectRef(productionUrl);

const errors: string[] = [];
if (staging.VITE_APP_ENV !== 'staging') errors.push('VITE_APP_ENV must equal staging.');
if (!stagingRef || !staging.VITE_SUPABASE_ANON_KEY) errors.push('Staging URL and anon key must be configured.');
if (stagingUrl.includes('your-project-ref') || staging.VITE_SUPABASE_ANON_KEY.includes('your_public_anon')) errors.push('Staging still contains template placeholders.');
if (!productionRef) errors.push('Production URL is invalid; cannot prove isolation.');
if (stagingRef && productionRef && stagingRef === productionRef) errors.push(`Staging project reference must differ from production (${productionRef}).`);
if ('SUPABASE_SERVICE_ROLE_KEY' in staging) errors.push('SUPABASE_SERVICE_ROLE_KEY must never be present in a Vite environment file.');

if (errors.length) {
  console.error('Staging configuration is unsafe or incomplete:\n- ' + errors.join('\n- '));
  process.exitCode = 1;
} else {
  console.log(`Staging configuration is isolated: ${stagingRef} != ${productionRef}.`);
}
