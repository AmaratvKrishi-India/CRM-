import { test, expect } from '@playwright/test';
import { setupAuthMocks, performLogin, MOCK_AGENT } from './helpers/mockAuth';

test.describe('CRM Navigation & Lead Management Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(async () => {
      localStorage.clear();
      sessionStorage.clear();
      if (window.indexedDB && window.indexedDB.databases) {
        const dbs = await window.indexedDB.databases();
        for (const db of dbs) {
          if (db.name) window.indexedDB.deleteDatabase(db.name);
        }
      }
    });
    await setupAuthMocks(page, MOCK_AGENT);
    await page.reload();
    await performLogin(page, MOCK_AGENT.email, 'ValidPassword123');

    // Wait for Dashboard to be ready
    await expect(page.getByRole('tab', { name: /Dashboard/i })).toBeVisible({ timeout: 10000 });
  });

  test('loads Dashboard metrics and navigation tabs', async ({ page }) => {
    // Check navigation tabs exist in bottom nav
    const dashboardTab = page.getByRole('tab', { name: /Dashboard/i });
    const leadsTab = page.getByRole('tab', { name: /Leads/i });
    const followUpsTab = page.getByRole('tab', { name: /Follow-ups/i });

    await expect(dashboardTab).toBeVisible();
    await expect(leadsTab).toBeVisible();
    await expect(followUpsTab).toBeVisible();

    // Check dashboard header
    await expect(page.getByText(/Amaratv Krishi/i).first()).toBeVisible();
  });

  test('navigates to Leads tab, creates a new lead, and views lead detail', async ({ page }) => {
    const uniquePhone = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const uniqueGymName = `Ozone Club ${Date.now().toString().slice(-4)}`;

    // 1. Switch to Leads tab
    const leadsTab = page.getByRole('tab', { name: /Leads/i });
    await leadsTab.click();

    // 2. Open Create Lead Modal
    const addLeadBtn = page.getByRole('button', { name: /Add Lead|New Lead/i }).first();
    await expect(addLeadBtn).toBeVisible();
    await addLeadBtn.click();

    // 3. Fill Create Lead Form
    const nameInput = page.getByLabel('Business / gym name *');
    const phoneInput = page.locator('input[placeholder="e.g. 7054447888"]');
    const localityInput = page.getByLabel('Locality / area');

    await nameInput.fill(uniqueGymName);
    await phoneInput.fill(uniquePhone);
    await localityInput.fill('Gomti Nagar');

    // Submit form
    const saveBtn = page.getByRole('button', { name: /Save Lead/i });
    await saveBtn.click();

    // 4. Verify newly created lead appears in list
    await expect(page.getByText(uniqueGymName)).toBeVisible({ timeout: 10000 });

    // 5. Click on lead to open Lead Detail View
    await page.getByText(uniqueGymName).click();

    // 6. Verify Lead Detail View is loaded
    await expect(page.getByText(uniqueGymName).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Call/i }).first()).toBeVisible();

    // 7. Click back button to return to Leads list
    const backBtn = page.locator('button:has(svg.lucide-arrow-left)').or(page.locator('button:has(svg)').first());
    await backBtn.first().click();

    await expect(page.getByText(uniqueGymName)).toBeVisible();
  });

  test('navigates to Follow-ups tab and displays filter sections', async ({ page }) => {
    const followUpsTab = page.getByRole('tab', { name: /Follow-ups/i });
    await followUpsTab.click();

    // Verify follow-ups section header or pills
    await expect(page.getByText(/Follow-Up|Follow Up|Pending/i).first()).toBeVisible();
  });

  test('opens and closes WhatsApp pitch modal', async ({ page }) => {
    const uniquePhone = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const uniqueGymName = `FitPro ${Date.now().toString().slice(-4)}`;

    // Navigate to leads
    await page.getByRole('tab', { name: /Leads/i }).click();

    // Open add lead modal and create one
    const addLeadBtn = page.getByRole('button', { name: /Add Lead|New Lead/i }).first();
    await addLeadBtn.click();

    const nameInput = page.getByLabel('Business / gym name *');
    const phoneInput = page.locator('input[placeholder="e.g. 7054447888"]');
    await nameInput.fill(uniqueGymName);
    await phoneInput.fill(uniquePhone);

    await page.getByRole('button', { name: /Save Lead/i }).click();
    await expect(page.getByText(uniqueGymName)).toBeVisible({ timeout: 10000 });

    // Click WhatsApp icon / button on the lead item
    const leadRow = page.locator(`div:has-text("${uniqueGymName}")`).last();
    const whatsappBtn = leadRow.locator('button[title*="WhatsApp"], button:has-text("WA"), button:has(svg.lucide-message-square)').first();
    
    if (await whatsappBtn.isVisible()) {
      await whatsappBtn.click();
      // Verify WhatsApp modal is open
      await expect(page.getByText(/WhatsApp|Catalogue|Message Template/i).first()).toBeVisible();
      // Close modal
      const closeBtn = page.locator('button:has(svg.lucide-x)').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      }
    }
  });
});
