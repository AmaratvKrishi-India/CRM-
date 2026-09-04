import { defineConfig } from 'lost-pixel';

export default defineConfig({
  // Project Configuration
  project: 'amaratvkrishi-sales-crm',
  apiKey: process.env.LOST_PIXEL_API_KEY, // Optional: for cloud features

  // Test Discovery
  testFiles: [
    'src/**/*.stories.tsx',
    'src/**/*.stories.ts',
    'src/**/*.test.visual.tsx',
    'src/**/*.test.visual.ts'
  ],

  // Storybook Integration
  storybook: {
    configDir: '.storybook',
    buildDir: 'storybook-static',
    url: 'http://localhost:6006',
    include: ['src/**/*.stories.tsx'],
    exclude: ['**/*.test.stories.tsx']
  },

  // Custom Shots (Playwright-based)
  customShots: [
    {
      name: 'Login Page',
      path: '/login',
      target: 'desktop',
      waitFor: '[data-testid="login-form"]',
      hideSelectors: ['.loading-spinner', '[data-testid="offline-indicator"]'],
      maskSelectors: ['[data-testid="user-avatar"]', '.timestamp'],
      viewport: { width: 1280, height: 720 }
    },
    {
      name: 'Dashboard - Admin',
      path: '/admin',
      target: 'desktop',
      waitFor: '[data-testid="admin-dashboard"]',
      hideSelectors: ['.realtime-indicator'],
      maskSelectors: ['.user-count', '.revenue-value'],
      viewport: { width: 1920, height: 1080 }
    },
    {
      name: 'Dashboard - Agent',
      path: '/agent',
      target: 'mobile',
      waitFor: '[data-testid="agent-dashboard"]',
      hideSelectors: ['.realtime-indicator'],
      maskSelectors: ['.lead-count'],
      viewport: { width: 390, height: 844 }
    },
    {
      name: 'Leads List',
      path: '/leads',
      target: 'desktop',
      waitFor: '[data-testid="leads-table"]',
      maskSelectors: ['.phone-number', '.email-address'],
      viewport: { width: 1280, height: 720 }
    },
    {
      name: 'Leads List - Mobile',
      path: '/leads',
      target: 'mobile',
      waitFor: '[data-testid="leads-list"]',
      maskSelectors: ['.phone-number', '.email-address'],
      viewport: { width: 390, height: 844 }
    },
    {
      name: 'Call Modal',
      path: '/calls/new',
      target: 'mobile',
      waitFor: '[data-testid="call-modal"]',
      maskSelectors: ['.call-duration'],
      viewport: { width: 390, height: 844 }
    },
    {
      name: 'Sync Status',
      path: '/settings/sync',
      target: 'mobile',
      waitFor: '[data-testid="sync-status"]',
      maskSelectors: ['.last-sync-time', '.pending-count'],
      viewport: { width: 390, height: 844 }
    }
  ],

  // Viewports for Responsive Testing
  viewports: [
    { name: 'mobile', width: 390, height: 844, deviceScaleFactor: 3, isMobile: true },
    { name: 'tablet', width: 768, height: 1024, deviceScaleFactor: 2, isMobile: true },
    { name: 'desktop', width: 1280, height: 720, deviceScaleFactor: 1, isMobile: false },
    { name: 'desktop-lg', width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false }
  ],

  // Image Comparison Settings
  image: {
    // Pixelmatch options
    pixelmatch: {
      threshold: 0.1,        // Sensitivity (0-1), lower = more sensitive
      includeAA: true,       // Include anti-aliasing
      alpha: 0.3,            // Alpha channel threshold
      diffColor: '#ff0000',  // Diff highlight color
      diffColorAlt: '#00ff00' // Alternative diff color
    },
    // SSIM options (structural similarity)
    ssim: {
      enabled: true,
      threshold: 0.95        // SSIM threshold (0-1), higher = more similar required
    },
    // Blur options for minor rendering differences
    blur: {
      enabled: false,
      radius: 1
    }
  },

  // Flaky Test Handling
  flaky: {
    retries: 2,
    retryDelay: 1000
  },

  // Parallel Execution
  parallelism: 4,

  // Baseline Management
  baseline: {
    branch: 'main',
    autoUpdate: false,  // Require manual approval for baseline updates
    storage: 'local'    // 'local' | 's3' | 'gcs' | 'azure'
  },

  // Reporting
  report: {
    formats: ['html', 'json', 'junit'],
    outputDir: './test-results/lost-pixel',
    html: {
      open: false,
      title: 'Amaratv Krishi - Visual Regression Report'
    },
    junit: {
      outputFile: './test-results/lost-pixel/junit.xml'
    }
  },

  // CI Integration
  ci: {
    // GitHub Actions / GitLab CI / CircleCI detection
    buildCommand: 'npm run build',
    testCommand: 'npm run test:visual',
    updateCommand: 'npm run test:visual:update',
    // Only run on PRs against main
    onlyOnBranches: ['main', 'develop'],
    // Skip on draft PRs
    skipDraftPRs: true,
    // Fail on visual changes
    failOnDiff: true,
    // Require approval for baseline updates
    requireApproval: true
  },

  // Platform-specific settings
  platforms: {
    desktop: {
      browser: 'chromium',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    },
    mobile: {
      browser: 'chromium',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true
    }
  },

  // Ignore Patterns
  ignore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/coverage/**',
    '**/test-results/**',
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.bench.ts'
  ],

  // Debugging
  debug: process.env.DEBUG === 'true',
  verbose: process.env.VERBOSE === 'true'
});