import { expect, test } from '@playwright/test';

test.describe('F023 bundled Content Security Policy', () => {
  test('loads application styles, permits required style mutations, and blocks inline scripts', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#root')).not.toBeEmpty();

    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(csp).toContain("script-src 'self'");

    const styles = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.color = 'rgb(1, 2, 3)';
      document.body.appendChild(probe);
      const result = {
        bodyFont: getComputedStyle(document.body).fontFamily,
        probeColor: getComputedStyle(probe).color,
      };
      probe.remove();
      return result;
    });
    expect(styles.bodyFont).toContain('Inter');
    expect(styles.probeColor).toBe('rgb(1, 2, 3)');

    await page.evaluate(() => {
      delete (window as Window & { __f023InlineExecuted?: boolean }).__f023InlineExecuted;
      const script = document.createElement('script');
      script.textContent = 'window.__f023InlineExecuted = true';
      document.head.appendChild(script);
    });
    await page.waitForTimeout(100);
    await expect
      .poll(() => page.evaluate(() => (window as Window & { __f023InlineExecuted?: boolean }).__f023InlineExecuted))
      .toBeUndefined();
  });
});
