// Standalone DOM + accessibility probe for the admin shell.
// NOT part of the committed test suite; evidence-only script for the audit.
import { chromium } from '@playwright/test';

const BASE = 'http://127.0.0.1:3000';
const ADMIN = {
  id: 'usr-admin-001',
  email: 'admin@amaratvkrishi.com',
  name: 'Admin Vikram',
  role: 'ADMIN',
  phone: '9876543211',
  organizationId: 'org-lucknow-1',
};

async function setupAuthMocks(page, user) {
  await page.route('**/auth/v1/token*', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'mock-jwt-token-12345',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh-token-12345',
        user: {
          id: user.id, aud: 'authenticated', role: 'authenticated',
          email: user.email, phone: user.phone || '',
          created_at: '2026-01-01T00:00:00Z',
          app_metadata: { provider: 'email' },
          user_metadata: { name: user.name },
        },
      }),
    });
  });
  await page.route('**/auth/v1/user*', async (route) => {
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ id: user.id, aud: 'authenticated', role: 'authenticated', email: user.email, phone: user.phone || '', created_at: '2026-01-01T00:00:00Z' }),
    });
  });
  await page.route('**/rest/v1/profiles*', async (route) => {
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{
        id: user.id, auth_user_id: user.id, organization_id: user.organizationId,
        name: user.name, email: user.email, phone: user.phone || '', role: user.role,
        status: 'ACTIVE', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      }]),
    });
  });
  await page.route('**/auth/v1/logout*', async (route) => {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });
}

const results = { consoleErrors: [], tabs: {}, a11y: {} };

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.on('console', (msg) => { if (msg.type() === 'error') results.consoleErrors.push(msg.text().slice(0, 200)); });
page.on('pageerror', (err) => results.consoleErrors.push('PAGEERROR: ' + String(err).slice(0, 200)));
page.on('requestfailed', (req) => results.consoleErrors.push('REQFAIL: ' + req.url().slice(0, 120) + ' ' + (req.failure() ? req.failure().errorText : '')));

await setupAuthMocks(page, ADMIN);
await page.goto(BASE);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload();
await page.waitForLoadState('domcontentloaded');
// Warm-up: give Vite cold-compile time, then verify the login form exists
try {
  await page.waitForSelector('input[type="email"]', { timeout: 60000 });
} catch (e) {
  const bodyText = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 400) : 'NO BODY');
  console.log('LOGIN FORM NOT FOUND. URL=' + page.url());
  console.log('BODY TEXT: ' + bodyText);
  console.log('CONSOLE ERRORS: ' + JSON.stringify(results.consoleErrors));
  await browser.close();
  process.exit(2);
}

// Login as admin
await page.locator('input[type="email"]').fill(ADMIN.email);
await page.locator('input[placeholder="Enter your password"]').fill('SecurePass123');
await page.locator('button[type="submit"]').click();

// Wait for admin shell nav
await page.waitForSelector('nav', { timeout: 15000 });
await page.waitForTimeout(1500);

const navLabels = await page.locator('nav button span').allTextContents();
results.navLabels = navLabels.map((t) => t.trim());

const tabs = ['Overview', 'Leads', 'Agents', 'Data', 'Reports', 'Settings'];
for (const tab of tabs) {
  const btn = page.locator('nav button', { hasText: tab });
  await btn.click();
  await page.waitForTimeout(1200);
  const mainText = (await page.locator('main').innerText().catch(() => '')).trim();
  const bodyLen = (await page.evaluate(() => document.body.innerText.length));
  results.tabs[tab] = {
    clicked: true,
    mainTextLength: mainText.length,
    bodyTextLength: bodyLen,
    firstChars: mainText.slice(0, 120).replace(/\s+/g, ' '),
    hasErrorText: /error|failed|crash|undefined is not/i.test(mainText.slice(0, 500)),
  };
}

// Accessibility probe across the current DOM (Settings tab active)
results.a11y = await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button'));
  const unnamedButtons = buttons.filter((b) => {
    const name = (b.getAttribute('aria-label') || b.innerText || b.title || '').trim();
    return name.length === 0;
  }).length;
  const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
  const unlabeledInputs = inputs.filter((i) => {
    if (i.type === 'hidden') return false;
    const id = i.id;
    const hasLabelFor = id && document.querySelector(`label[for="${CSS.escape(id)}"]`);
    const ariaLabel = i.getAttribute('aria-label') || i.getAttribute('aria-labelledby');
    const placeholder = i.getAttribute('placeholder');
    const wrapped = i.closest('label');
    return !hasLabelFor && !ariaLabel && !placeholder && !wrapped;
  }).length;
  const dialogs = Array.from(document.querySelectorAll('[role="dialog"], dialog'));
  const modalsMissingLabel = dialogs.filter((d) => !d.getAttribute('aria-label') && !d.getAttribute('aria-labelledby')).length;
  const positiveTabindex = Array.from(document.querySelectorAll('[tabindex]')).filter((el) => parseInt(el.getAttribute('tabindex'), 10) > 0).length;
  const images = Array.from(document.querySelectorAll('img'));
  const imagesNoAlt = images.filter((i) => !i.getAttribute('alt')).length;
  return {
    totalButtons: buttons.length,
    unnamedButtons,
    totalInputs: inputs.length,
    unlabeledInputs,
    dialogs: dialogs.length,
    modalsMissingLabel,
    positiveTabindex,
    totalImages: images.length,
    imagesNoAlt,
    htmlLang: document.documentElement.getAttribute('lang'),
  };
});

// Keyboard focus order check: press Tab 6 times from body and record focused elements
await page.keyboard.press('Tab');
const focusOrder = [];
for (let i = 0; i < 8; i++) {
  const tag = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return 'body';
    return `${el.tagName.toLowerCase()}${el.getAttribute('aria-label') ? '[' + el.getAttribute('aria-label') + ']' : ''}${el.innerText ? '(' + el.innerText.trim().slice(0, 20) + ')' : ''}`;
  });
  focusOrder.push(tag);
  await page.keyboard.press('Tab');
}
results.focusOrder = focusOrder;

await browser.close();
console.log(JSON.stringify(results, null, 2));
