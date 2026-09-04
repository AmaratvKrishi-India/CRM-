import { chromium } from '@playwright/test';

const APP = 'https://crm-blush-omega.vercel.app';
const SB = 'https://lahvcodvgubplzfshare.supabase.co';

async function main() {
  // 1. Supabase reachable (GET, anon key from .env.staging)
  const env = (await import('node:fs')).readFileSync('.env.staging', 'utf8');
  const anon = env.split('\n').find((l) => l.startsWith('VITE_SUPABASE_ANON_KEY='))!.split('=').slice(1).join('=').trim();
  const rest = await fetch(`${SB}/rest/v1/`, { headers: { apikey: anon } });
  console.log(`SUPABASE_REST_ROOT: ${rest.status}`);

  // 2. RLS probe: unauthenticated SELECT must NOT return rows
  const rls = await fetch(`${SB}/rest/v1/leads?select=id&limit=1`, { headers: { apikey: anon } });
  const body = await rls.text();
  console.log(`RLS_UNAUTH_LEADS: ${rls.status} body=${body.slice(0, 120)}`);

  // 3. DOM check: app loads, login form present, no page errors
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(APP, { waitUntil: 'networkidle', timeout: 60000 });
  const email = await page.locator('input[type="email"]').count();
  const password = await page.locator('input[type="password"]').count();
  const signIn = await page.locator('button:has-text("Sign In")').count();
  const title = await page.title();
  console.log(`TITLE: ${title}`);
  console.log(`LOGIN_FORM: email=${email} password=${password} signIn=${signIn}`);
  console.log(`PAGE_ERRORS: ${errors.length === 0 ? 'NONE' : errors.join(' | ')}`);
  await browser.close();
}

main().catch((e) => { console.error('SMOKE_FAIL', e); process.exit(1); });
