import { test, expect, type Page } from '@playwright/test';
import { setupAuthMocks, performLogin, MOCK_AGENT, MOCK_ADMIN } from './helpers/mockAuth';
import { injectAxe, getViolations } from 'axe-playwright';

async function expectNoAccessibilityViolations(page: Page, surface: string): Promise<void> {
  // Axe must inspect the stable rendered state. WebKit can sample colors during
  // the 200-300ms entrance/fade animation and report a false low-contrast frame.
  await page.waitForTimeout(350);
  const violations = await getViolations(page);
  console.log(`${surface} accessibility violations:`, violations.length);
  violations.forEach((v) => console.log(`  - ${v.id}: ${v.help} (${v.impact})`));
  expect(violations, `${surface} must have no axe violations`).toEqual([]);
}

test.describe('Accessibility Tests', () => {
  test('login page accessibility check', async ({ page }) => {
    await setupAuthMocks(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await expect(page.getByRole('button', { name: 'Sign In', exact: true }).or(page.getByRole('tab', { name: /Dashboard|Reports/i }).first())).toBeVisible();
    await injectAxe(page);
    
    await expectNoAccessibilityViolations(page, 'Login page');
  });

  test('login page accessibility check - mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await setupAuthMocks(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await expect(page.getByRole('button', { name: 'Sign In', exact: true }).or(page.getByRole('tab', { name: /Dashboard|Reports/i }).first())).toBeVisible();
    await injectAxe(page);
    
    await expectNoAccessibilityViolations(page, 'Login page (mobile)');
  });

  test('agent dashboard accessibility check', async ({ page }) => {
    await setupAuthMocks(page, MOCK_AGENT);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await performLogin(page, MOCK_AGENT.email, 'ValidPassword123');
    
    await expect(page.getByRole('tab', { name: /Dashboard/i })).toBeVisible({ timeout: 10000 });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await expect(page.getByRole('button', { name: 'Sign In', exact: true }).or(page.getByRole('tab', { name: /Dashboard|Reports/i }).first())).toBeVisible();
    await injectAxe(page);
    
    await expectNoAccessibilityViolations(page, 'Agent dashboard');
  });

  test('agent dashboard accessibility check - mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupAuthMocks(page, MOCK_AGENT);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await performLogin(page, MOCK_AGENT.email, 'ValidPassword123');
    
    await expect(page.getByRole('tab', { name: /Dashboard/i })).toBeVisible({ timeout: 10000 });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await expect(page.getByRole('button', { name: 'Sign In', exact: true }).or(page.getByRole('tab', { name: /Dashboard|Reports/i }).first())).toBeVisible();
    await injectAxe(page);
    
    await expectNoAccessibilityViolations(page, 'Agent dashboard (mobile)');
  });

  test('leads list accessibility check', async ({ page }) => {
    await setupAuthMocks(page, MOCK_AGENT);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await performLogin(page, MOCK_AGENT.email, 'ValidPassword123');
    
    await expect(page.getByRole('tab', { name: /Dashboard/i })).toBeVisible({ timeout: 10000 });
    await page.getByRole('tab', { name: /Leads/i }).click();
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await expect(page.getByRole('button', { name: 'Sign In', exact: true }).or(page.getByRole('tab', { name: /Dashboard|Reports/i }).first())).toBeVisible();
    await injectAxe(page);
    
    await expectNoAccessibilityViolations(page, 'Leads list');
  });

  test('create lead modal accessibility check', async ({ page }) => {
    await setupAuthMocks(page, MOCK_AGENT);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await performLogin(page, MOCK_AGENT.email, 'ValidPassword123');
    
    await expect(page.getByRole('tab', { name: /Dashboard/i })).toBeVisible({ timeout: 10000 });
    await page.getByRole('tab', { name: /Leads/i }).click();
    
    const addLeadBtn = page.getByRole('button', { name: /Add Lead|New Lead/i }).first();
    await addLeadBtn.click();
    
    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page.getByRole('button', { name: 'Sign In', exact: true }).or(page.getByRole('tab', { name: /Dashboard|Reports/i }).first())).toBeVisible();
    await injectAxe(page);
    
    await expectNoAccessibilityViolations(page, 'Create lead modal');
  });

  test('admin dashboard accessibility check', async ({ page }) => {
    await setupAuthMocks(page, MOCK_ADMIN);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await performLogin(page, MOCK_ADMIN.email, 'ValidPassword123');
    
    await expect(page.getByRole('tab', { name: /Reports/i })).toBeVisible({ timeout: 15000 });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await expect(page.getByRole('button', { name: 'Sign In', exact: true }).or(page.getByRole('tab', { name: /Dashboard|Reports/i }).first())).toBeVisible();
    await injectAxe(page);
    
    await expectNoAccessibilityViolations(page, 'Admin dashboard');
  });

  test('follow-ups tab accessibility check', async ({ page }) => {
    await setupAuthMocks(page, MOCK_AGENT);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await performLogin(page, MOCK_AGENT.email, 'ValidPassword123');
    
    await expect(page.getByRole('tab', { name: /Dashboard/i })).toBeVisible({ timeout: 10000 });
    await page.getByRole('tab', { name: /Follow-ups/i }).click();
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await expect(page.getByRole('button', { name: 'Sign In', exact: true }).or(page.getByRole('tab', { name: /Dashboard|Reports/i }).first())).toBeVisible();
    await injectAxe(page);
    
    await expectNoAccessibilityViolations(page, 'Follow-ups tab');
  });

  test('Settings modal accessibility check (admin)', async ({ page }) => {
    await setupAuthMocks(page, MOCK_ADMIN);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await performLogin(page, MOCK_ADMIN.email, 'ValidPassword123');
    
    await expect(page.getByRole('tab', { name: /Reports/i })).toBeVisible({ timeout: 15000 });
    
    await page.getByRole('button', { name: /Admin settings/i }).click();
    await expect(page.locator('#admin-panel-settings')).toBeVisible();
    
    await page.getByRole('button', { name: /Switch to Field Sales Mode/i }).click();
    await expect(page.getByRole('tab', { name: /Dashboard/i })).toBeVisible({ timeout: 10000 });
    
    const settingsBtn = page.locator('button[aria-label="Settings and pitch templates"]');
    await expect(settingsBtn).toBeVisible({ timeout: 10000 });
    await settingsBtn.click();
    
    await expect(page.getByRole('dialog', { name: /Settings & Pitch Templates/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In', exact: true }).or(page.getByRole('tab', { name: /Dashboard|Reports/i }).first())).toBeVisible();
    await injectAxe(page);
    
    await expectNoAccessibilityViolations(page, 'Settings modal');
  });

  test('Settings modal Preferences tab accessibility check', async ({ page }) => {
    await setupAuthMocks(page, MOCK_ADMIN);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await performLogin(page, MOCK_ADMIN.email, 'ValidPassword123');
    
    await expect(page.getByRole('tab', { name: /Reports/i })).toBeVisible({ timeout: 15000 });
    
    await page.getByRole('button', { name: /Admin settings/i }).click();
    await expect(page.locator('#admin-panel-settings')).toBeVisible();
    
    await page.getByRole('button', { name: /Switch to Field Sales Mode/i }).click();
    await expect(page.getByRole('tab', { name: /Dashboard/i })).toBeVisible({ timeout: 10000 });
    
    const settingsBtn = page.locator('button[aria-label="Settings and pitch templates"]');
    await expect(settingsBtn).toBeVisible({ timeout: 10000 });
    await settingsBtn.click();
    
    await expect(page.getByRole('dialog', { name: /Settings & Pitch Templates/i })).toBeVisible();
    await page.getByRole('tab', { name: /Preferences/i }).click();
    await expect(page.getByRole('button', { name: 'Sign In', exact: true }).or(page.getByRole('tab', { name: /Dashboard|Reports/i }).first())).toBeVisible();
    await injectAxe(page);
    
    await expectNoAccessibilityViolations(page, 'Settings modal Preferences tab');
  });

  test('WhatsApp modal accessibility check', async ({ page }) => {
    await setupAuthMocks(page, MOCK_AGENT);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await performLogin(page, MOCK_AGENT.email, 'ValidPassword123');
    
    await expect(page.getByRole('tab', { name: /Dashboard/i })).toBeVisible({ timeout: 10000 });
    await page.getByRole('tab', { name: /Leads/i }).click();
    
    const addLeadBtn = page.getByRole('button', { name: /Add Lead|New Lead/i }).first();
    await addLeadBtn.click();
    
    const nameInput = page.getByLabel('Business / gym name *');
    const phoneInput = page.locator('input[placeholder="e.g. 7054447888"]');
    const localityInput = page.getByLabel('Locality / area');
    
    await nameInput.fill('Test Gym');
    await phoneInput.fill('9876543210');
    await localityInput.fill('Gomti Nagar');
    await page.getByRole('button', { name: /Save Lead/i }).click();
    await expect(page.getByText('Test Gym')).toBeVisible({ timeout: 10000 });
    
    const leadRow = page.locator('div:has-text("Test Gym")').last();
    const whatsappBtn = leadRow.locator('button[title*="WhatsApp"], button:has-text("WA"), button:has(svg.lucide-message-square)').first();
    
    if (await whatsappBtn.isVisible()) {
      await whatsappBtn.click();
      await expect(page.getByText(/WhatsApp|Catalogue|Message Template/i).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sign In', exact: true }).or(page.getByRole('tab', { name: /Dashboard|Reports/i }).first())).toBeVisible();
    await injectAxe(page);
      
      await expectNoAccessibilityViolations(page, 'WhatsApp modal');
    }
  });
});
