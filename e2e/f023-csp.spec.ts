import { expect, test } from '@playwright/test';

test.describe('F023 bundled Content Security Policy', () => {
  test('loads application styles, permits required style mutations, and blocks inline scripts', async ({ page }) => {
    const violations: string[] = [];
    page.on('console', (message) => {
      if (message.text().includes('Content Security Policy')) violations.push(message.text());
    });

    await page.goto('/');
    await expect(page.locator('#root')).not.toBeEmpty();

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
    expect(violations.some((message) => message.includes("script-src 'self'"))).toBe(true);
  });
});
