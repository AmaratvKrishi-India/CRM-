import { defineConfig } from 'unlighthouse';

export default defineConfig({
  // Site to audit
  site: process.env.UNLIGHTHOUSE_URL || 'http://localhost:3000',

  // CI configuration
  ci: {
    // Fail on budget failures
    failOnBudget: true,
    // Upload artifacts
    upload: {
      enabled: true,
      bucket: process.env.UNLIGHTHOUSE_BUCKET,
    },
  },

  // Budget thresholds
  budgets: [
    {
      name: 'Performance',
      thresholds: {
        'categories:performance': 90,
        'categories:accessibility': 95,
        'categories:best-practices': 90,
        'categories:seo': 85,
        'categories:pwa': 80,
      },
    },
    {
      name: 'Core Web Vitals',
      thresholds: {
        'metrics:largest-contentful-paint': 2500,
        'metrics:cumulative-layout-shift': 0.1,
        'metrics:total-blocking-time': 200,
        'metrics:speed-index': 3000,
        'metrics:first-contentful-paint': 1800,
        'metrics:interaction-to-next-paint': 200,
      },
    },
  ],

  // Scanner configuration
  scanner: {
    // Number of routes to scan (0 = all)
    maxRoutes: 20,
    // Include/exclude patterns
    include: [
      '/',
      '/login',
      '/leads',
      '/calls',
      '/settings',
      '/admin',
      '/agent',
    ],
    exclude: [
      '/api/**',
      '/_next/**',
      '/static/**',
    ],
    // Device emulation
    device: 'desktop',
    // Authentication (if needed)
    // auth: { username: 'test', password: 'test' },
  },

  // Performance configuration
  performance: {
    // Number of runs per route
    runs: 3,
    // Throttling
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
    },
    // Skip warmup
    skipWarmup: false,
  },

  // Output configuration
  output: {
    // Report formats
    formats: ['html', 'json', 'csv'],
    // Output directory
    dir: '.unlighthouse',
    // Open report after generation
    open: false,
  },

  // Cache configuration
  cache: {
    enabled: true,
    dir: '.unlighthouse-cache',
  },

  // Debug
  debug: process.env.DEBUG === 'true',
});