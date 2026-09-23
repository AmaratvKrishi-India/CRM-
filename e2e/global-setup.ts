import { chromium, expect, type FullConfig } from '@playwright/test';

export default async function warmApplication(config: FullConfig): Promise<void> {
  if (process.env.PLAYWRIGHT_BASE_URL) return;
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
