import { defineConfig, devices } from '@playwright/test';

const apiTestIgnore = process.env.E2E_API_BASE_URL ? [] : ['**/api.spec.ts'];
const standardProjectTestIgnore = [...apiTestIgnore, '**/tablet-responsive.spec.ts'];

/**
 * Playwright configuration for Amaratv Krishi Sales CRM
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  testIgnore: apiTestIgnore,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  /* Configure projects for major browsers and mobile viewports */
  projects: [
    {
      name: 'chromium',
      testIgnore: standardProjectTestIgnore,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      testIgnore: standardProjectTestIgnore,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testIgnore: standardProjectTestIgnore,
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      testIgnore: standardProjectTestIgnore,
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'Mobile Safari',
      testIgnore: standardProjectTestIgnore,
      use: { ...devices['iPhone 15'] },
    },
    {
      // Dedicated tablet gate: keep tablet coverage explicit and independent
      // from the desktop/mobile cross-browser matrix.
      name: 'Tablet',
      testMatch: '**/tablet-responsive.spec.ts',
      testIgnore: apiTestIgnore,
      use: {
        viewport: { width: 1024, height: 768 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: true,
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 3000',
    url: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
