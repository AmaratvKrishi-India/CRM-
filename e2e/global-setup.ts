import { chromium, expect, type FullConfig } from '@playwright/test';

export default async function warmApplication(config: FullConfig): Promise<void> {
  if (process.env.PLAYWRIGHT_BASE_URL) {
    // Hosted E2E may write only after inspecting the actual served Preview build.
    // No bypass, account or customer record is used by this preflight.
    const origin = new URL(process.env.PLAYWRIGHT_BASE_URL).origin;
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext({ serviceWorkers: 'block' });
      await context.route('**/*', route => {
        const request = route.request();
        return ['GET', 'HEAD'].includes(request.method()) && new URL(request.url()).origin === origin ? route.continue() : route.abort();
      });
      const page = await context.newPage();
      const scripts: Promise<string>[] = [];
      page.on('response', response => { if (new URL(response.url()).origin === origin && new URL(response.url()).pathname.endsWith('.js')) scripts.push(response.text()); });
      try { await page.goto(origin, { waitUntil: 'networkidle' }); }
      catch { throw new Error('BLOCKED: Preview access or deployment protection; no hosted E2E writes authorized.'); }
      const bundle = (await Promise.all(scripts)).join('\n');
      if (!bundle.includes('https://dhoinifpzijqyobcamlv.supabase.co') || bundle.includes('https://lahvcodvgubplzfshare.supabase.co') || /sb_secret_/.test(bundle)) throw new Error('Preview backend preflight denied: expected approved Staging build.');
      const claims = [...bundle.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)].map(([key]) => JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()));
      if (!claims.some(claim => claim.role === 'anon' && claim.ref === 'dhoinifpzijqyobcamlv') || claims.some(claim => claim.role === 'service_role' || claim.ref === 'lahvcodvgubplzfshare')) throw new Error('Preview backend key scope denied.');
      await context.close();
    } finally { await browser.close(); }
    return;
  }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(String(config.projects[0].use.baseURL), { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeEnabled({ timeout: 120_000 });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
  } finally {
    await browser.close();
  }
}
