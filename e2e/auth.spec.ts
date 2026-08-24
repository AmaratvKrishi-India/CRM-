import { test, expect } from '@playwright/test';
import { setupAuthMocks, performLogin, MOCK_AGENT } from './helpers/mockAuth';

test.describe('Login & Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage and IndexedDB before each test for clean isolation
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
  });

  test('renders login screen with branding, logos, and UI elements', async ({ page }) => {
    // Brand headings & titles
    await expect(page.getByRole('heading', { name: /Amaratv Krishi/i })).toBeVisible();
    await expect(page.getByText(/Field Sales CRM • Lucknow/i)).toBeVisible();
    await expect(page.getByAltText(/Amaratv Krishi Logo/i)).toBeVisible();

    // Form fields and buttons
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('placeholder', 'e.g. rahul@amaratvkrishi.com');

    const passwordInput = page.locator('input[placeholder="Enter your password"]');
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('type', 'password');

    const signInBtn = page.getByRole('button', { name: /Sign In/i });
    await expect(signInBtn).toBeVisible();
    await expect(signInBtn).toBeEnabled();

    // Admin provisioning notice & offline-first footer
    await expect(page.getByText(/Accounts are managed & provisioned by Administrators/i)).toBeVisible();
    await expect(page.getByText(/Amaratv Krishi CRM v2.0 • Offline-First Sales Engine/i)).toBeVisible();
  });

  test('toggles password visibility between masked and plaintext', async ({ page }) => {
    const passwordInput = page.locator('input[placeholder="Enter your password"]');
    await passwordInput.fill('SecretPassword123');

    // Initially masked
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click toggle button
    const toggleBtn = passwordInput.locator('..').locator('button');
    await toggleBtn.click();

    // Now unmasked
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Click toggle button again
    await toggleBtn.click();

    // Masked again
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('displays error alert on invalid login credentials', async ({ page }) => {
    await setupAuthMocks(page, MOCK_AGENT);

    await performLogin(page, 'rahul@amaratvkrishi.com', 'WrongPassword');

    // Expect error alert banner to appear
    await expect(page.getByText(/Invalid login credentials|Invalid email or password/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test('successfully signs in agent and transitions into CRM Dashboard', async ({ page }) => {
    await setupAuthMocks(page, MOCK_AGENT);

    await performLogin(page, MOCK_AGENT.email, 'ValidPassword123');

    // Should load CRM content and bottom nav
    await expect(page.getByRole('tab', { name: /Dashboard/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('tab', { name: /Leads/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Follow-ups/i })).toBeVisible();
  });
});
