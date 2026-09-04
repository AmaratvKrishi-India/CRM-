import { test, expect, type Page } from '@playwright/test';
import { setupAuthMocks, performLogin, MOCK_AGENT, MOCK_ADMIN, type MockUserConfig } from './helpers/mockAuth';

async function resetBrowserState(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    if (window.indexedDB?.databases) {
      const databases = await window.indexedDB.databases();
      for (const database of databases) {
        if (database.name) window.indexedDB.deleteDatabase(database.name);
      }
    }
  });
}

async function loginAs(page: Page, user: MockUserConfig): Promise<void> {
  await setupAuthMocks(page, user);
  await page.reload();
  await performLogin(page, user.email, 'ValidPassword123');
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'Tablet surface must not introduce horizontal page overflow').toBeLessThanOrEqual(1);
}

test.describe('Dedicated Tablet Release Gate', () => {
  test('agent tablet workflow covers dashboard, leads, detail, call notes, and follow-ups', async ({ page }) => {
    await resetBrowserState(page);
    await loginAs(page, MOCK_AGENT);

    await expect(page.getByRole('tab', { name: /Dashboard/i })).toBeVisible({ timeout: 10000 });
    await expectNoHorizontalOverflow(page);

    await page.getByRole('tab', { name: /Leads/i }).click();
    const leadName = `Tablet Gym ${Date.now().toString().slice(-6)}`;
    await page.getByRole('button', { name: /Add Lead|New Lead/i }).first().click();
    await page.locator('#create-business-name').fill(leadName);
    await page.locator('#create-phone').fill(`9${Date.now().toString().slice(-9)}`);
    await page.locator('#create-locality').fill('Gomti Nagar');
    await page.getByRole('button', { name: /Save Lead/i }).click();
    await expect(page.getByText(leadName)).toBeVisible({ timeout: 10000 });
    await expectNoHorizontalOverflow(page);

    await page.getByText(leadName).first().click();
    await expect(page.getByRole('button', { name: /Log call outcome & add remark/i })).toBeVisible();
    await page.getByRole('button', { name: /Log call outcome & add remark/i }).click();
    await page.locator('#custom-note').fill('Tablet release-gate note');
    await page.locator('#pipeline-status').selectOption('INTERESTED');
    await expect(page.locator('#custom-note')).toHaveValue('Tablet release-gate note');
    await expect(page.locator('#pipeline-status')).toHaveValue('INTERESTED');
    await page.getByRole('button', { name: /Skip \/ do not record/i }).click();

    await page.getByRole('button', { name: /Schedule follow-up/i }).first().click();
    await page.locator('#fu-title').fill('Tablet follow-up verification');
    await page.getByRole('button', { name: /Set follow-up reminder/i }).click();
    await expect(page.getByText(leadName).first()).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /Back to leads list/i }).click();
    await page.getByRole('tab', { name: /Follow-ups/i }).click();
    await expect(page.getByRole('heading', { name: /Sales Follow-ups/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('admin tablet boundary exposes agent management and keeps admin controls out of agent UI', async ({ page }) => {
    await resetBrowserState(page);
    await loginAs(page, MOCK_ADMIN);

    await expect(page.getByRole('tab', { name: /Reports/i })).toBeVisible({ timeout: 15000 });
    await page.getByRole('tab', { name: /Agents/i }).click();
    await expect(page.getByRole('button', { name: /Provision New Agent/i })).toBeVisible();
    await page.getByRole('button', { name: /Provision New Agent/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: /Close/i }).first().click();

    await page.getByRole('button', { name: /Sign out/i }).first().click();
    await expect(page.locator('#login-email')).toBeVisible();

    await resetBrowserState(page);
    await loginAs(page, MOCK_AGENT);
    await expect(page.getByRole('tab', { name: /Dashboard/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('tab', { name: /Reports/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Provision New Agent/i })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });
});
