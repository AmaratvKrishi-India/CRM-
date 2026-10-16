// Public, unauthenticated smoke only. Never submit a form or query CRM records.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const origin = 'https://crm-amaratv-krishi.vercel.app';
const project = 'lahvcodvgubplzfshare';
const report = {
  target: origin,
  authenticated: false,
  submittedForms: false,
  queriedCustomerRecords: false,
  viewports: [],
};
const proxyServer = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const browser = await chromium.launch({
  headless: true,
  ...(proxyServer ? { proxy: { server: proxyServer } } : {}),
});
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
    const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
    try {
      // Fresh context has no stored session. Deny every write and every backend
      // request; this check exercises the released login UI and static assets.
      await context.route('**/*', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (!['GET', 'HEAD'].includes(request.method()) || url.origin !== origin) {
          await route.abort('blockedbyclient');
          return;
        }
        await route.continue();
      });
      const page = await context.newPage();
      const errors = [];
      const failedAssets = [];
      const scripts = [];
      const scriptReads = [];
      page.on('pageerror', () => errors.push('uncaught-page-error'));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push('console-error');
      });
      page.on('requestfailed', (request) => {
        const url = new URL(request.url());
        if (url.origin === origin) failedAssets.push({ path: url.pathname, status: 'network-failure' });
      });
      page.on('response', (response) => {
        const url = new URL(response.url());
        if (url.origin !== origin) return;
        if (response.status() >= 400) failedAssets.push({ path: url.pathname, status: response.status() });
        if (url.pathname.endsWith('.js')) {
          scriptReads.push(response.text().then((body) => scripts.push(body)));
        }
      });
      const response = await page.goto(origin, { waitUntil: 'networkidle', timeout: 60_000 });
      assert.equal(response?.status(), 200, 'Production HTTPS must return 200');
      assert.equal(new URL(page.url()).origin, origin, 'Unexpected authentication/protection redirect');
      await assert.doesNotReject(() => page.locator('input[type="email"]').waitFor({ state: 'visible' }), 'Login email field unavailable');
      await assert.doesNotReject(() => page.locator('input[type="password"]').waitFor({ state: 'visible' }), 'Login password field unavailable');
      assert.match(await page.title(), /Amaratv Krishi/i, 'Expected CRM title');
      const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      assert.equal(horizontalOverflow, false, 'Login has horizontal overflow');
      assert.equal(await page.locator('input[type="password"]').inputValue(), '', 'Fresh context must have no password');
      await Promise.all(scriptReads);
      assert(scripts.length > 0, 'No released JavaScript was inspected');
      const bundle = scripts.join('\n');
      assert(bundle.includes(`https://${project}.supabase.co`), 'Released bundle lacks Production Supabase URL');
      assert(!bundle.includes('dhoinifpzijqyobcamlv.supabase.co'), 'Staging endpoint in Production bundle');
      assert(!bundle.includes('offline-test-only-placeholder-do-not-authenticate'), 'Synthetic release key in Production bundle');
      assert(!/sb_secret_[A-Za-z0-9_-]+/.test(bundle), 'Secret Supabase key found in public assets');
      const claims = [...bundle.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)].flatMap(([token]) => {
        try { return [JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())]; }
        catch { return []; }
      });
      assert(!claims.some((claim) => claim.role === 'service_role'), 'Service-role token found in public assets');
      assert(claims.some((claim) => claim.role === 'anon' && claim.ref === project), 'Expected Production public anon key not found');
      assert.deepEqual(failedAssets, [], 'Required app/assets returned HTTP errors');
      assert.deepEqual(errors, [], 'Browser reported critical errors');
      report.viewports.push({ ...viewport, httpsStatus: response.status(), loginVisible: true, assetsLoaded: true, criticalErrors: 0, horizontalOverflow });
    } finally {
      await context.close();
    }
  }
  report.result = 'passed';
} catch (error) {
  report.result = 'failed';
  // Assertions contain fixed descriptions, never response bodies or tokens.
  report.failure = error instanceof assert.AssertionError ? error.message.split('\n')[0] : 'Browser navigation or asset inspection could not complete';
  process.exitCode = 1;
} finally {
  await browser.close();
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/production-readonly-smoke.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
