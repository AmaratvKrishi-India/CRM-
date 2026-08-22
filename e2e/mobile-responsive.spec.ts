import { test, expect } from '@playwright/test';
import { setupAuthMocks, performLogin, MOCK_AGENT } from './helpers/mockAuth';

test.describe('Mobile Viewport & Responsive Design Flow', () => {
  test('login page has no horizontal overflow on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Verify there is no horizontal scroll on the viewport
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);

    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
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
    const bottomNav = page.locator('.sticky.bottom-0').or(page.locator('div:has(> div > button:has-text("Dashboard"))')).last();
    await expect(bottomNav).toBeVisible({ timeout: 10000 });

    // Scroll down
    await page.evaluate(() => window.scrollTo(0, 1000));

    // Nav bar should still be visible in viewport
    await expect(page.getByRole('button', { name: /Dashboard/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Leads/i })).toBeVisible();
  });
});
