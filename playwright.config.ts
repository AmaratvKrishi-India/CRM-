import { defineConfig, devices } from '@playwright/test';

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL?.trim();
const localBaseURL = 'http://127.0.0.1:4174';
const baseURL = externalBaseURL || localBaseURL;
const playwrightSupabaseUrl = process.env.VITE_SUPABASE_URL?.trim() || 'http://127.0.0.1:15432';
const playwrightSupabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim() || 'playwright-test-anon-key';

const apiTestIgnore = process.env.E2E_API_BASE_URL ? [] : ['**/api.spec.ts'];
const visualTestIgnore = process.env.CI && process.platform !== 'win32'
  ? ['**/visual-regression.spec.ts']
  : [];
const standardProjectTestIgnore = [
  ...apiTestIgnore,
  ...visualTestIgnore,
  '**/tablet-responsive.spec.ts',
];

/**
 * Playwright configuration for Amaratv Krishi Sales CRM.
 * Local runs always own a strict, dedicated Vite port so Playwright can never
 * silently attach to an unrelated application already listening on port 3000.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  timeout: 30_000,  expect: { timeout: 5_000 },
  reporter: process.env.CI
    ? [
        ['line'],
        ['html', { open: 'never', outputFolder: 'playwright-report' }],
        ['junit', { outputFile: 'test-results/playwright-junit.xml' }],
      ]
    : [
        ['list'],
        ['html', { open: 'never', outputFolder: 'playwright-report' }],
      ],
  outputDir: 'test-results/playwright',
  use: {
    baseURL,
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      testIgnore: standardProjectTestIgnore,
      use: { ...devices['Desktop Chrome'] },
    },    {
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
      name: 'Tablet',
      testMatch: '**/tablet-responsive.spec.ts',
      testIgnore: [...apiTestIgnore, ...visualTestIgnore],
      use: {
        viewport: { width: 1024, height: 768 },
        deviceScaleFactor: 1,        isMobile: false,
        hasTouch: true,
      },
    },
  ],

  webServer: externalBaseURL
    ? undefined
    : {
        command: 'npm run dev -- --host 127.0.0.1 --port 4174 --strictPort',
        url: localBaseURL,
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
          ...process.env,
          VITE_SUPABASE_URL: playwrightSupabaseUrl,
          VITE_SUPABASE_ANON_KEY: playwrightSupabaseAnonKey,
        },
      },
});
