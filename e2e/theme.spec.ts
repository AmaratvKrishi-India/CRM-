import { test, expect } from '@playwright/test';

test.describe('Theme & Dark/Light Mode Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
  });

  test('defaults to NIGHT mode with dark attributes', async ({ page }) => {
    const htmlElement = page.locator('html');
    await expect(htmlElement).toHaveAttribute('data-theme', 'night');

    // Computed styles must actually render dark (not just the attribute)
    const nightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(nightBg).not.toBe('rgba(0, 0, 0, 0)');

    // Theme toggle button should offer to switch to Day mode
    const themeBtn = page.getByRole('button', { name: /day/i });
    await expect(themeBtn).toBeVisible();
  });

  test('toggles theme to DAY mode and updates DOM attributes', async ({ page }) => {
    // Capture the night background before switching
    const nightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    const themeBtn = page.getByRole('button', { name: /day/i });
    await themeBtn.click();

    // Attribute on <html> should now be 'day'
    const htmlElement = page.locator('html');
    await expect(htmlElement).toHaveAttribute('data-theme', 'day');

    // Computed background must actually change between themes
    const dayBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(dayBg).not.toBe(nightBg);

    // Stored theme in localStorage should be 'DAY'
    const storedTheme = await page.evaluate(() => localStorage.getItem('amaratv_crm_theme_v1'));
    expect(storedTheme).toBe('DAY');

    // Button should now show Night switch option
    await expect(page.getByRole('button', { name: /night/i })).toBeVisible();
  });

  test('persists DAY theme preference across browser reload', async ({ page }) => {
    // Switch to DAY
    const themeBtn = page.getByRole('button', { name: /day/i });
    await themeBtn.click();

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'day');

    // Reload page
    await page.reload();

    // Verify still in DAY mode
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'day');
    await expect(page.getByRole('button', { name: /night/i })).toBeVisible();
  });

  test('toggles back to NIGHT mode from DAY mode', async ({ page }) => {
    // Switch to DAY then back to NIGHT
    await page.getByRole('button', { name: /day/i }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'day');

    await page.getByRole('button', { name: /night/i }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');

    const storedTheme = await page.evaluate(() => localStorage.getItem('amaratv_crm_theme_v1'));
    expect(storedTheme).toBe('NIGHT');
  });

  test('computed styles differ between NIGHT and DAY themes', async ({ page }) => {
    const capture = () =>
      page.evaluate(() => {
        const body = getComputedStyle(document.body);
        const root = getComputedStyle(document.documentElement);
        return { bodyBg: body.backgroundColor, bodyColor: body.color, rootBg: root.backgroundColor };
      });

    const night = await capture();

    await page.getByRole('button', { name: /day/i }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'day');
    const day = await capture();

    // At least the background must genuinely differ once tokens resolve
    expect(day.bodyBg).not.toBe(night.bodyBg);
  });
});
