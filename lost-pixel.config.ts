// Lost Pixel 3.x configuration. Generate-only mode is intentional: this repo
// had no approved visual baseline, so the audit must not create one silently.
export default {
  browser: 'chromium',
  browserLaunchOptions: {
    chromium: {
      executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      headless: true,
    },
  },
  storybookShots: {
    storybookUrl: 'http://127.0.0.1:6006',
    waitForSelector: '[data-testid="audit-accessibility-smoke"]',
    breakpoints: [390, 1280],
  },
  generateOnly: true,
  imagePathCurrent: '.lostpixel/current',
  shotConcurrency: 1,
  timeouts: {
    fetchStories: 30_000,
    loadState: 30_000,
    networkRequests: 30_000,
  },
  waitForFirstRequest: 100,
  waitForLastRequest: 300,
  flakynessRetries: 0,
  waitBetweenFlakynessRetries: 0,
};
