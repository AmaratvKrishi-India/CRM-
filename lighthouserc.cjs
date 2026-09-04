module.exports = {
  ci: {
    collect: {
      numberOfRuns: 3,
      startServerCommand: 'npm run preview -- --port 3000',
      url: [
        'http://localhost:3000/',
      ],
      settings: {
        headless: true,
        preset: 'desktop',
        staticDistDir: './dist',
        chromeFlags: '--no-sandbox --disable-dev-shm-usage',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
        'categories:pwa': ['off'],
        'first-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 4000 }],
        'interactive': ['warn', { maxNumericValue: 5000 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }],
        'redirects': ['off'],
        'render-blocking-resources': ['off'],
        'uses-rel-preload': ['off'],
        'uses-text-compression': ['off'],
        'server-response-time': ['off'],
        'bootup-time': ['off'],
        'mainthread-work-breakdown': ['off'],
        'third-party-summary': ['off'],
        'network-rtt': ['off'],
        'network-server-latency': ['off'],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
    server: {
      command: 'npm run preview -- --port 3000',
      port: 3000,
      readyPattern: 'ready',
    },
  },
};