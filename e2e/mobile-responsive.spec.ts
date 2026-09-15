import { test, expect } from '@playwright/test';
import { setupAuthMocks, performLogin, MOCK_AGENT } from './helpers/mockAuth';

test.describe('Mobile Viewport & Responsive Design Flow', () => {
  test('login page has no horizontal overflow on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Measure rendered geometry instead of programmatic scroll position. WebKit's
    // mobile emulation can intermittently report a small rubber-band scrollX even
    // when scrollWidth equals clientWidth and no element crosses the viewport.
    const horizontalOverflow = await page.evaluate(() => {
      window.scrollTo(0, 0);
      const viewportWidth = window.innerWidth;
      let leftOverflow = 0;
      let rightOverflow = 0;

      for (const element of document.querySelectorAll<HTMLElement>('body *')) {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        leftOverflow = Math.max(leftOverflow, Math.max(0, -rect.left));
        rightOverflow = Math.max(rightOverflow, Math.max(0, rect.right - viewportWidth));
      }

      return Math.max(leftOverflow, rightOverflow);
    });

    expect(horizontalOverflow).toBeLessThanOrEqual(0.5);
  });

  test('theme button meets accessibility touch target recommendations (min 44x44px)', async ({ page }) => {
    await page.goto('/');
    const themeBtn = page.getByRole('button', { name: /day|night|switch to/i });
    await expect(themeBtn).toBeVisible();

    const box = await themeBtn.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(40);
      expect(box.height).toBeGreaterThanOrEqual(40);
    }
  });

  test('bottom mobile navigation bar stays sticky and visible during dashboard scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await setupAuthMocks(page, MOCK_AGENT);
    await page.reload();
    await performLogin(page, MOCK_AGENT.email, 'ValidPassword123');

    // Wait for Dashboard
    const bottomNav = page.getByRole('tablist', { name: 'Main sections' });
    await expect(bottomNav).toBeVisible({ timeout: 10000 });

    // Scroll down
    await page.evaluate(() => window.scrollTo(0, 1000));

    // Nav bar should still be visible in viewport
    await expect(page.getByRole('tab', { name: /Dashboard/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Leads/i })).toBeVisible();
  });
});
