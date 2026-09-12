module.exports = {
  url: 'http://127.0.0.1:4175/',
  previewPort: 4175,
  thresholds: {
    performance: 0.9,
    accessibility: 0.9,
    'best-practices': 0.9,
    seo: 0.9,
  },
  metricBudgets: {
    'first-contentful-paint': 2500,
    'largest-contentful-paint': 4000,
    interactive: 5000,
    'cumulative-layout-shift': 0.1,
    'total-blocking-time': 300,
  },
  chromeFlags: '--headless --no-sandbox --disable-dev-shm-usage',
};
