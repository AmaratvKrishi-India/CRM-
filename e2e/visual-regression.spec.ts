import { test, expect } from '@playwright/test';
import { setupAuthMocks, performLogin, MOCK_AGENT, MOCK_ADMIN } from './helpers/mockAuth';

test.describe('Visual Regression Tests', () => {
  test.describe.configure({ retries: 0 }); // Visual tests need deterministic runs

  test('login page matches baseline - desktop', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to fully render
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500); // Extra settle time for animations
    
    // Take screenshot and compare with baseline
    await expect(page).toHaveScreenshot('login-desktop.png', {
      fullPage: true,
      threshold: 0.2, // Allow 0.2% pixel difference
    });
  });

  test('login page matches baseline - mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot('login-mobile.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('dashboard matches baseline - desktop (agent)', async ({ page }) => {
    await page.goto('/');
    await setupAuthMocks(page, MOCK_AGENT, { forceOffline: true });
    await page.reload();
    await performLogin(page, MOCK_AGENT.email, 'ValidPassword123');
    
    // Wait for dashboard to load
    await expect(page.getByRole('tab', { name: /Dashboard/i })).toBeVisible({ timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot('dashboard-agent-desktop.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('dashboard matches baseline - mobile (agent)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await setupAuthMocks(page, MOCK_AGENT, { forceOffline: true });
    await page.reload();
    await performLogin(page, MOCK_AGENT.email, 'ValidPassword123');
    
    await expect(page.getByRole('tab', { name: /Dashboard/i })).toBeVisible({ timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot('dashboard-agent-mobile.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('leads list matches baseline - desktop', async ({ page }) => {
    await page.goto('/');
    await setupAuthMocks(page, MOCK_AGENT, { forceRealtimeOffline: true });
    await page.reload();
    await performLogin(page, MOCK_AGENT.email, 'ValidPassword123');
    
    await expect(page.getByRole('tab', { name: /Dashboard/i })).toBeVisible({ timeout: 10000 });
    
    // Navigate to Leads tab
    await page.getByRole('tab', { name: /Leads/i }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot('leads-list-desktop.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('leads list matches baseline - mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await setupAuthMocks(page, MOCK_AGENT);
    await page.reload();
    await performLogin(page, MOCK_AGENT.email, 'ValidPassword123');
    
    await expect(page.getByRole('tab', { name: /Dashboard/i })).toBeVisible({ timeout: 10000 });
    
    await page.getByRole('tab', { name: /Leads/i }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot('leads-list-mobile.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('create lead modal matches baseline', async ({ page }) => {
    await page.goto('/');
    await setupAuthMocks(page, MOCK_AGENT);
    await page.reload();
    await performLogin(page, MOCK_AGENT.email, 'ValidPassword123');
    
    await expect(page.getByRole('tab', { name: /Dashboard/i })).toBeVisible({ timeout: 10000 });
    await page.getByRole('tab', { name: /Leads/i }).click();
    
    // Open create lead modal
    const addLeadBtn = page.getByRole('button', { name: /Add Lead|New Lead/i }).first();
    await addLeadBtn.click();
    
    // Wait for modal animation
    await page.waitForTimeout(300);
    
    // Screenshot just the modal area
    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible();
    
    await expect(modal).toHaveScreenshot('create-lead-modal.png', {
      threshold: 0.2,
    });
  });

  test('theme toggle - night mode baseline', async ({ page }) => {
    await page.goto('/');
    await setupAuthMocks(page, MOCK_AGENT, { forceOffline: true });
    await page.reload();
    await performLogin(page, MOCK_AGENT.email, 'ValidPassword123');
    
    await expect(page.getByRole('tab', { name: /Dashboard/i })).toBeVisible({ timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    // Ensure we're in night mode (default)
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'night');
    
    await expect(page).toHaveScreenshot('theme-night.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('theme toggle - day mode baseline (via Settings tab)', async ({ page }) => {
    await page.goto('/');
    await setupAuthMocks(page, MOCK_ADMIN, { forceOffline: true });
    await page.reload();
    await performLogin(page, MOCK_ADMIN.email, 'ValidPassword123');
    
    await expect(page.getByRole('tab', { name: /Reports/i })).toBeVisible({ timeout: 10000 });
    
    await page.getByRole('button', { name: /Admin settings/i }).click();
    
    await expect(page.locator('#admin-panel-settings')).toBeVisible();
    await expect(page.getByText(/Administrator Account/i)).toBeVisible();
    
    await page.getByRole('button', { name: /Switch to Field Sales Mode/i }).click();
    
    await expect(page.getByRole('tab', { name: /Dashboard/i })).toBeVisible({ timeout: 10000 });
    
    const settingsBtn = page.locator('button[aria-label="Settings and pitch templates"]');
    await expect(settingsBtn).toBeVisible({ timeout: 10000 });
    await settingsBtn.click();
    
    await expect(page.getByRole('dialog', { name: /Settings & Pitch Templates/i })).toBeVisible();
    
    await page.getByRole('tab', { name: /Preferences/i }).click();
    
    await page.getByRole('button', { name: 'Day', exact: true }).click();
    await page.waitForTimeout(300);
    
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'day');
    
    await page.getByRole('button', { name: /Close Settings/i }).click();
    await expect(page.getByRole('dialog', { name: /Settings & Pitch Templates/i })).toBeHidden();
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot('theme-day.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('admin dashboard matches baseline', async ({ page }) => {
    await page.goto('/');
    await setupAuthMocks(page, MOCK_ADMIN, { forceOffline: true });
    await page.reload();
    await performLogin(page, MOCK_ADMIN.email, 'ValidPassword123');
    
    await expect(page.getByRole('tab', { name: /Reports/i })).toBeVisible({ timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot('admin-dashboard.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('follow-ups tab matches baseline', async ({ page }) => {
    await page.goto('/');
    await setupAuthMocks(page, MOCK_AGENT, { forceOffline: true });
    await page.reload();
    await performLogin(page, MOCK_AGENT.email, 'ValidPassword123');
    
    await expect(page.getByRole('tab', { name: /Dashboard/i })).toBeVisible({ timeout: 10000 });
    await page.getByRole('tab', { name: /Follow-ups/i }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot('followups-tab.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });
});
