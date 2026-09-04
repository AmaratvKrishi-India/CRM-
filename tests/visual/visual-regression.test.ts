/**
 * Visual Regression Tests Configuration
 * Lost Pixel with Storybook integration and custom Playwright shots
 * Tests component snapshots across viewports
 */

// Lost Pixel configuration is in lost-pixel.config.ts at project root
// Storybook configuration is in .storybook/main.ts and .storybook/preview.ts

// This file documents the visual regression test structure and provides
// utility functions for component visual testing

import { test, expect } from '@playwright/test';
import { visualRegression } from './visual-regression-utils';

// ============================================================================
// Visual Regression Test Suite
// ============================================================================

test.describe('Visual Regression - Components', () => {
  // Button variants
  test('Button - Primary', async ({ page }) => {
    await page.goto('/iframe.html?id=components-button--primary');
    await expect(page.locator('[data-testid="button-primary"]')).toHaveScreenshot('button-primary.png');
  });

  test('Button - Secondary', async ({ page }) => {
    await page.goto('/iframe.html?id=components-button--secondary');
    await expect(page.locator('[data-testid="button-secondary"]')).toHaveScreenshot('button-secondary.png');
  });

  test('Button - Disabled', async ({ page }) => {
    await page.goto('/iframe.html?id=components-button--disabled');
    await expect(page.locator('[data-testid="button-disabled"]')).toHaveScreenshot('button-disabled.png');
  });

  test('Button - Loading', async ({ page }) => {
    await page.goto('/iframe.html?id=components-button--loading');
    await expect(page.locator('[data-testid="button-loading"]')).toHaveScreenshot('button-loading.png');
  });

  // Input variants
  test('Input - Default', async ({ page }) => {
    await page.goto('/iframe.html?id=components-input--default');
    await expect(page.locator('[data-testid="input-default"]')).toHaveScreenshot('input-default.png');
  });

  test('Input - Error', async ({ page }) => {
    await page.goto('/iframe.html?id=components-input--error');
    await expect(page.locator('[data-testid="input-error"]')).toHaveScreenshot('input-error.png');
  });

  test('Input - Disabled', async ({ page }) => {
    await page.goto('/iframe.html?id=components-input--disabled');
    await expect(page.locator('[data-testid="input-disabled"]')).toHaveScreenshot('input-disabled.png');
  });

  // Card components
  test('Card - Lead', async ({ page }) => {
    await page.goto('/iframe.html?id=components-leadcard--default');
    await expect(page.locator('[data-testid="lead-card"]')).toHaveScreenshot('card-lead.png');
  });

  test('Card - Call Record', async ({ page }) => {
    await page.goto('/iframe.html?id=components-callrecordcard--default');
    await expect(page.locator('[data-testid="call-record-card"]')).toHaveScreenshot('card-call-record.png');
  });

  // Modal components
  test('Modal - Confirm', async ({ page }) => {
    await page.goto('/iframe.html?id=components-modal--confirm');
    await expect(page.locator('[data-testid="modal-confirm"]')).toHaveScreenshot('modal-confirm.png');
  });

  test('Modal - Form', async ({ page }) => {
    await page.goto('/iframe.html?id=components-modal--form');
    await expect(page.locator('[data-testid="modal-form"]')).toHaveScreenshot('modal-form.png');
  });

  // Table components
  test('Table - Leads', async ({ page }) => {
    await page.goto('/iframe.html?id=components-leadstable--default');
    await expect(page.locator('[data-testid="leads-table"]')).toHaveScreenshot('table-leads.png');
  });

  // Layout components
  test('Header - Admin', async ({ page }) => {
    await page.goto('/iframe.html?id=components-header--admin');
    await expect(page.locator('[data-testid="header-admin"]')).toHaveScreenshot('header-admin.png');
  });

  test('Header - Agent', async ({ page }) => {
    await page.goto('/iframe.html?id=components-header--agent');
    await expect(page.locator('[data-testid="header-agent"]')).toHaveScreenshot('header-agent.png');
  });

  test('Sidebar - Navigation', async ({ page }) => {
    await page.goto('/iframe.html?id=components-sidebar--default');
    await expect(page.locator('[data-testid="sidebar-nav"]')).toHaveScreenshot('sidebar-nav.png');
  });
});

test.describe('Visual Regression - Pages', () => {
  // Login page
  test('Login Page', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('[data-testid="login-form"]');
    await expect(page).toHaveScreenshot('page-login.png', {
      fullPage: true,
      mask: [page.locator('[data-testid="offline-indicator"]')],
    });
  });

  // Dashboard pages
  test('Dashboard - Admin', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForSelector('[data-testid="admin-dashboard"]');
    await expect(page).toHaveScreenshot('page-admin-dashboard.png', {
      fullPage: true,
      mask: [
        page.locator('.realtime-indicator'),
        page.locator('.user-count'),
        page.locator('.revenue-value'),
      ],
    });
  });

  test('Dashboard - Agent', async ({ page }) => {
    await page.goto('/agent');
    await page.waitForSelector('[data-testid="agent-dashboard"]');
    await expect(page).toHaveScreenshot('page-agent-dashboard.png', {
      fullPage: true,
      mask: [page.locator('.lead-count'), page.locator('.realtime-indicator')],
    });
  });

  // Leads pages
  test('Leads List - Desktop', async ({ page }) => {
    await page.goto('/leads');
    await page.waitForSelector('[data-testid="leads-table"]');
    await expect(page).toHaveScreenshot('page-leads-desktop.png', {
      fullPage: true,
      mask: [
        page.locator('.phone-number'),
        page.locator('.email-address'),
      ],
    });
  });

  test('Leads List - Mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/leads');
    await page.waitForSelector('[data-testid="leads-list"]');
    await expect(page).toHaveScreenshot('page-leads-mobile.png', {
      fullPage: true,
      mask: [page.locator('.phone-number'), page.locator('.email-address')],
    });
  });

  // Calls pages
  test('Call Modal', async ({ page }) => {
    await page.goto('/calls/new');
    await page.waitForSelector('[data-testid="call-modal"]');
    await expect(page).toHaveScreenshot('page-call-modal.png', {
      mask: [page.locator('.call-duration')],
    });
  });

  // Settings pages
  test('Sync Status Page', async ({ page }) => {
    await page.goto('/settings/sync');
    await page.waitForSelector('[data-testid="sync-status"]');
    await expect(page).toHaveScreenshot('page-sync-status.png', {
      mask: [
        page.locator('.last-sync-time'),
        page.locator('.pending-count'),
      ],
    });
  });
});

test.describe('Visual Regression - Responsive', () => {
  const viewports = [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1280, height: 720 },
    { name: 'desktop-lg', width: 1920, height: 1080 },
  ];

  const pages = [
    { path: '/', name: 'home' },
    { path: '/login', name: 'login' },
    { path: '/leads', name: 'leads' },
    { path: '/calls', name: 'calls' },
    { path: '/settings', name: 'settings' },
  ];

  for (const viewport of viewports) {
    for (const page of pages) {
      test(`${page.name} - ${viewport.name}`, async ({ page: testPage }) => {
        await testPage.setViewportSize({ width: viewport.width, height: viewport.height });
        await testPage.goto(page.path);
        await testPage.waitForLoadState('networkidle');
        await expect(testPage).toHaveScreenshot(`${page.name}-${viewport.name}.png`, {
          fullPage: true,
        });
      });
    }
  }
});

test.describe('Visual Regression - Theme', () => {
  test('Light Theme - Dashboard', async ({ page }) => {
    await page.goto('/agent');
    await page.waitForSelector('[data-testid="agent-dashboard"]');
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    await expect(page).toHaveScreenshot('theme-light-dashboard.png', { fullPage: true });
  });

  test('Dark Theme - Dashboard', async ({ page }) => {
    await page.goto('/agent');
    await page.waitForSelector('[data-testid="agent-dashboard"]');
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await expect(page).toHaveScreenshot('theme-dark-dashboard.png', { fullPage: true });
  });

  test('Light Theme - Leads', async ({ page }) => {
    await page.goto('/leads');
    await page.waitForSelector('[data-testid="leads-table"]');
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    await expect(page).toHaveScreenshot('theme-light-leads.png', { fullPage: true });
  });

  test('Dark Theme - Leads', async ({ page }) => {
    await page.goto('/leads');
    await page.waitForSelector('[data-testid="leads-table"]');
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await expect(page).toHaveScreenshot('theme-dark-leads.png', { fullPage: true });
  });
});

test.describe('Visual Regression - States', () => {
  test('Loading State - Leads List', async ({ page }) => {
    await page.route('/rest/v1/leads*', route => route.fulfill({ status: 200, body: '[]', delay: 5000 }));
    await page.goto('/leads');
    await page.waitForSelector('[data-testid="loading-skeleton"]');
    await expect(page).toHaveScreenshot('state-loading-leads.png', { fullPage: true });
  });

  test('Empty State - Leads List', async ({ page }) => {
    await page.route('/rest/v1/leads*', route => route.fulfill({ status: 200, body: '[]' }));
    await page.goto('/leads');
    await page.waitForSelector('[data-testid="empty-state"]');
    await expect(page).toHaveScreenshot('state-empty-leads.png', { fullPage: true });
  });

  test('Error State - Sync Failed', async ({ page }) => {
    await page.route('/rest/v1/sync/*', route => route.fulfill({ status: 500 }));
    await page.goto('/settings/sync');
    await page.waitForSelector('[data-testid="sync-error"]');
    await expect(page).toHaveScreenshot('state-error-sync.png', { fullPage: true });
  });

  test('Offline Indicator', async ({ page }) => {
    await page.goto('/agent');
    await page.waitForSelector('[data-testid="agent-dashboard"]');
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      window.dispatchEvent(new Event('offline'));
    });
    await page.waitForSelector('[data-testid="offline-indicator"]');
    await expect(page).toHaveScreenshot('state-offline-indicator.png');
  });
});

// ============================================================================
// Visual Regression Utilities
// ============================================================================

export async function visualRegression(page: any, name: string, options: any = {}) {
  const {
    fullPage = false,
    mask = [],
    hide = [],
    threshold = 0.1,
    maxDiffPixels = 100,
  } = options;

  // Hide elements
  for (const selector of hide) {
    await page.locator(selector).evaluate(el => (el as HTMLElement).style.visibility = 'hidden');
  }

  // Mask elements (blur/cover)
  for (const selector of mask) {
    await page.locator(selector).evaluate(el => {
      (el as HTMLElement).style.filter = 'blur(10px)';
      (el as HTMLElement).style.backgroundColor = 'rgba(255,0,0,0.1)';
    });
  }

  // Take screenshot
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage,
    threshold,
    maxDiffPixels,
    animations: 'disabled',
  });

  // Restore
  for (const selector of hide) {
    await page.locator(selector).evaluate(el => (el as HTMLElement).style.visibility = 'visible');
  }
  for (const selector of mask) {
    await page.locator(selector).evaluate(el => {
      (el as HTMLElement).style.filter = '';
      (el as HTMLElement).style.backgroundColor = '';
    });
  }
}

export function generateVisualTestCases() {
  const components = [
    'Button', 'Input', 'Select', 'Checkbox', 'Radio', 'Switch',
    'Card', 'Modal', 'Dropdown', 'Tooltip', 'Toast', 'Avatar',
    'Table', 'Tabs', 'Accordion', 'Breadcrumb', 'Pagination',
  ];

  const variants = ['default', 'primary', 'secondary', 'disabled', 'error', 'loading'];
  const viewports = ['mobile', 'tablet', 'desktop', 'desktop-lg'];
  const themes = ['light', 'dark'];

  const testCases: string[] = [];

  for (const component of components) {
    for (const variant of variants) {
      for (const viewport of viewports) {
        for (const theme of themes) {
          testCases.push(`${component}-${variant}-${viewport}-${theme}`);
        }
      }
    }
  }

  return testCases;
}