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

    // Theme toggle button should offer to switch to Day mode
    const themeBtn = page.getByRole('button', { name: /day/i });
    await expect(themeBtn).toBeVisible();
  });

  test('toggles theme to DAY mode and updates DOM attributes', async ({ page }) => {
    const themeBtn = page.getByRole('button', { name: /day/i });
    await themeBtn.click();

    // Attribute on <html> should now be 'day'
    const htmlElement = page.locator('html');
    await expect(htmlElement).toHaveAttribute('data-theme', 'day');

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
});
