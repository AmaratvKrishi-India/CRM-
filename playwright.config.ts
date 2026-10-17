// @ts-expect-error Reviewed dependency-free guard shared with Node contract tests.
import { assertPreviewTestTarget } from './scripts/preview-test-guard.mjs';
import { execFileSync } from 'node:child_process';
import { defineConfig, devices } from '@playwright/test';

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL?.trim();
if (externalBaseURL) assertPreviewTestTarget(process.env);
const localBaseURL = 'http://127.0.0.1:4174';
const baseURL = externalBaseURL || localBaseURL;
const realSupabase = process.env.PLAYWRIGHT_REAL_SUPABASE === '1';

function isLoopbackUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
  } catch {
    return false;
  }
}

function parseStatusEnvironment(output: string): Record<string, string> {
  return Object.fromEntries(
    output.split(/\r?\n/).flatMap((line) => {
      const separator = line.indexOf('=');
      if (separator <= 0) return [];
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim().replace(/^(?:"|')|(?:"|')$/g, '');
      return [[key, value]];
    }),
  );
}

function localSupabaseEnvironment(): Record<string, string> {
  try {
    const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
    const args = process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npx supabase status -o env']
      : ['supabase', 'status', '-o', 'env'];
    return parseStatusEnvironment(execFileSync(command, args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }));
  } catch {
    return {};
  }
}

const localSupabase = realSupabase ? localSupabaseEnvironment() : {};
const configuredSupabaseUrl = process.env.VITE_SUPABASE_URL?.trim();
const configuredSupabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim();
const playwrightSupabaseUrl = realSupabase
  ? (configuredSupabaseUrl && isLoopbackUrl(configuredSupabaseUrl)
      ? configuredSupabaseUrl
      : localSupabase.API_URL || 'http://127.0.0.1:15432')
  : configuredSupabaseUrl || 'http://127.0.0.1:15432';
const playwrightSupabaseAnonKey = realSupabase
  ? (configuredSupabaseAnonKey || localSupabase.ANON_KEY || localSupabase.PUBLISHABLE_KEY || '')
  : configuredSupabaseAnonKey || 'playwright-test-anon-key';

const apiTestIgnore = process.env.E2E_API_BASE_URL ? [] : ['**/api.spec.ts'];
const standardProjectTestIgnore = [
  ...apiTestIgnore,
  '**/tablet-responsive.spec.ts',
];
// Playwright's `linux` suffix covers every Linux distribution. Keep the hosted
// Ubuntu 24.04 baselines separate from the local Codex Cloud distro so font
// rasterization differences do not mask real UI changes.
const snapshotPathTemplate = process.env.GITHUB_ACTIONS === 'true'
  ? '{testDir}/{testFilePath}-snapshots/{arg}-{projectName}-ubuntu24{ext}'
  : '{testDir}/{testFilePath}-snapshots/{arg}-{projectName}-{platform}{ext}';

/**
 * Playwright configuration for Amaratv Krishi Sales CRM.
 * Local runs always own a strict, dedicated Vite port so Playwright can never
 * silently attach to an unrelated application already listening on port 3000.
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  // Cold local Vite dependency optimization can take longer than the default
  // navigation window on the first page. Keep the bound finite while allowing
  // the disposable test server to warm predictably.
  timeout: 120_000,  expect: { timeout: 5_000 },
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
  snapshotPathTemplate,
  use: {
    baseURL,
    actionTimeout: 10_000,
    navigationTimeout: 120_000,
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
      testIgnore: apiTestIgnore,
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
          VITE_WINDOWS_CALLING_MOCK: '1',
          VITE_WINDOWS_CALLING_MOCK_SCOPES: 'org-lucknow-1:usr-agent-001',
          VITE_SUPABASE_URL: playwrightSupabaseUrl,
          VITE_SUPABASE_ANON_KEY: playwrightSupabaseAnonKey,
        },
      },
});
