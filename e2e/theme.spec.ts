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

  test('defaults to DAY mode with light attributes', async ({ page }) => {
    const htmlElement = page.locator('html');
    await expect(htmlElement).toHaveAttribute('data-theme', 'day');

    const dayBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(dayBg).not.toBe('rgba(0, 0, 0, 0)');

    const themeBtn = page.getByRole('button', { name: /night/i });
    await expect(themeBtn).toBeVisible();
  });

  test('toggles theme to NIGHT mode and updates DOM attributes', async ({ page }) => {
    const dayBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    const themeBtn = page.getByRole('button', { name: /night/i });
    await themeBtn.click();

    const htmlElement = page.locator('html');
    await expect(htmlElement).toHaveAttribute('data-theme', 'night');

    const nightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(nightBg).not.toBe(dayBg);

    const storedTheme = await page.evaluate(() => localStorage.getItem('amaratv_crm_theme_v1'));
    expect(storedTheme).toBe('NIGHT');

    await expect(page.getByRole('button', { name: /day/i })).toBeVisible();
  });

  test('persists DAY theme preference across browser reload', async ({ page }) => {
    await page.getByRole('button', { name: /night/i }).click();
    await page.getByRole('button', { name: /day/i }).click();

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'day');

    // Reload page
    await page.reload();

    // Verify still in DAY mode
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'day');
    await expect(page.getByRole('button', { name: /night/i })).toBeVisible();
  });

  test('toggles back to DAY mode from NIGHT mode', async ({ page }) => {
    await page.getByRole('button', { name: /night/i }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');

    await page.getByRole('button', { name: /day/i }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'day');

    const storedTheme = await page.evaluate(() => localStorage.getItem('amaratv_crm_theme_v1'));
    expect(storedTheme).toBe('DAY');
  });

  test('computed styles differ between NIGHT and DAY themes', async ({ page }) => {
    const capture = () =>
      page.evaluate(() => {
        const body = getComputedStyle(document.body);
        const root = getComputedStyle(document.documentElement);
        return { bodyBg: body.backgroundColor, bodyColor: body.color, rootBg: root.backgroundColor };
      });

    const day = await capture();

    await page.getByRole('button', { name: /night/i }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
    const night = await capture();

    expect(day.bodyBg).not.toBe(night.bodyBg);
  });
});
