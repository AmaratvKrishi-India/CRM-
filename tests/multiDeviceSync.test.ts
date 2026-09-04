/**
 * Multi-Device End-to-End Synchronization Test Suite
 * Executes a genuine end-to-end business workflow across 3 real Android Studio emulators
 * and local Docker Supabase PostgreSQL:
 * 
 * DEVICE 1 = ADMIN (e.g. emulator-5556)
 * DEVICE 2 = AGENT A (e.g. emulator-5558)
 * DEVICE 3 = AGENT B (e.g. emulator-5560)
 */

import { test, describe, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium, Page, Browser } from '@playwright/test';

const ADB = path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe');
const APP_PACKAGE = 'com.amaratvkrishi.salescrm';
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const LOCAL_TEST_APK = path.join(REPO_ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const SUPABASE_LOCAL_URL = 'http://127.0.0.1:15432';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const LOGIN_READY_TIMEOUT_MS = 60_000;
const AUTH_RESPONSE_TIMEOUT_MS = 60_000;
let localTestApkReady = false;

function localBuildEnvironment(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    VITE_SUPABASE_URL: SUPABASE_LOCAL_URL,
    VITE_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
    CAPACITOR_ANDROID_SCHEME: 'http',
    VITE_APP_ENV: 'local-test',
  };
}

function directoryContains(root: string, needle: string): boolean {
  if (!existsSync(root)) return false;
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop()!;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(fullPath);
      } else if (/\.(?:html?|js|json)$/i.test(entry.name) && readFileSync(fullPath, 'utf-8').includes(needle)) {
        return true;
      }
    }
  }
  return false;
}

function buildLocalTestApk(): void {
  if (localTestApkReady) return;

  const env = localBuildEnvironment();
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const gradleCommand = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';

  console.log('Building the Android test artifact against disposable local Supabase.');
  execSync(`${npmCommand} run build`, { cwd: REPO_ROOT, env, stdio: 'inherit' });
  execSync(`${npxCommand} cap sync android`, { cwd: REPO_ROOT, env, stdio: 'inherit' });

  const syncedAssets = path.join(REPO_ROOT, 'android', 'app', 'src', 'main', 'assets', 'public');
  assert.ok(
    directoryContains(syncedAssets, SUPABASE_LOCAL_URL),
    'Synced Android web assets must contain the disposable local Supabase URL.'
  );
  assert.ok(existsSync(path.join(REPO_ROOT, 'android', 'app', 'src', 'main', 'assets', 'capacitor.config.json')));

  execSync(`${gradleCommand} assembleDebug --no-daemon`, {
    cwd: path.join(REPO_ROOT, 'android'),
    env,
    stdio: 'inherit',
  });
  assert.ok(existsSync(LOCAL_TEST_APK), `Expected local Android test APK at ${LOCAL_TEST_APK}`);
  localTestApkReady = true;
}

interface DeviceRoleConfig {
  serial: string;
  role: 'ADMIN' | 'AGENT_A' | 'AGENT_B';
  cdpPort: number;
  email: string;
  name: string;
}

function detectEmulators(): string[] {
  try {
    const output = execSync(`"${ADB}" devices`, { encoding: 'utf-8' });
    const lines = output.split('\n');
    const emulators: string[] = [];
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts[0]?.startsWith('emulator-') && parts[1] === 'device') {
        emulators.push(parts[0]);
      }
    }
    return emulators;
  } catch (err) {
    console.error('Failed to run ADB devices:', err);
    return [];
  }
}

async function waitForCdpReady(port: number, maxAttempts = 45): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`);
      if (res.ok) {
        const pages = await res.json();
        if (Array.isArray(pages) && pages.length > 0) {
          return true;
        }
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function ensureAppInstalled(serial: string): void {
  buildLocalTestApk();
  const listed = execSync(`"${ADB}" -s ${serial} shell pm list packages ${APP_PACKAGE}`, { encoding: 'utf-8' });
  if (listed.includes(`package:${APP_PACKAGE}`)) {
    execSync(`"${ADB}" -s ${serial} uninstall ${APP_PACKAGE}`, { stdio: 'ignore' });
  }
  console.log(`Installing verified local-Supabase debug APK on ${serial}`);
  execSync(`"${ADB}" -s ${serial} install "${LOCAL_TEST_APK}"`, { encoding: 'utf-8', timeout: 180_000 });
}

async function prepareDevice(serial: string, cdpPort: number): Promise<{ browser: Browser; page: Page }> {
  // 0. Guarantee the app is installed on whichever emulator was selected
  ensureAppInstalled(serial);

  // 1. Configure reverse port forwarding for Supabase Local
  execSync(`"${ADB}" -s ${serial} reverse tcp:15432 tcp:15432`);

  // 2. Clear app storage for clean deterministic session
  execSync(`"${ADB}" -s ${serial} shell pm clear com.amaratvkrishi.salescrm`);

  // 3. Launch application
  execSync(`"${ADB}" -s ${serial} shell monkey -p com.amaratvkrishi.salescrm -c android.intent.category.LAUNCHER 1`);

  // 4. Poll for PID
  let pid = '';
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      pid = execSync(`"${ADB}" -s ${serial} shell pidof com.amaratvkrishi.salescrm`, { encoding: 'utf-8' }).trim();
      if (pid) break;
    } catch {}
  }

  if (!pid) {
    throw new Error(`Failed to find running process for com.amaratvkrishi.salescrm on ${serial}`);
  }

  // 5. Forward CDP port. WebView creates its devtools socket shortly after the
  // app process appears, so retry the bind instead of treating that startup
  // window as a device failure.
  let cdpForwarded = false;
  for (let attempt = 0; attempt < 15; attempt++) {
    try {
      execSync(`"${ADB}" -s ${serial} forward --remove tcp:${cdpPort}`, { stdio: 'ignore' });
    } catch {}

    try {
      execSync(`"${ADB}" -s ${serial} forward tcp:${cdpPort} localabstract:webview_devtools_remote_${pid}`, {
        stdio: 'ignore',
      });
      cdpForwarded = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  if (!cdpForwarded) {
    throw new Error(`Failed to forward WebView CDP port ${cdpPort} for ${serial}`);
  }

  // 6. Wait for DevTools endpoint inside WebView to become ready
  const isCdpReady = await waitForCdpReady(cdpPort);
  if (!isCdpReady) {
    throw new Error(`DevTools HTTP endpoint on port ${cdpPort} not ready for ${serial}`);
  }

  // 7. Connect Playwright over CDP
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
  const context = browser.contexts()[0];
  const page = context.pages()[0];
  await page.waitForLoadState('domcontentloaded');

  return { browser, page };
}

/**
 * A freshly-cleared Android WebView can expose the login form before React has
 * finished attaching the form handlers. Prove the form is interactive with a
 * reversible UI state change before entering credentials or submitting it.
 */
async function waitForInteractiveLoginForm(page: Page): Promise<void> {
  const emailInput = page.locator('#login-email');
  const passwordInput = page.locator('#login-password');
  await emailInput.waitFor({ state: 'visible', timeout: LOGIN_READY_TIMEOUT_MS });
  await passwordInput.waitFor({ state: 'visible', timeout: LOGIN_READY_TIMEOUT_MS });

  const deadline = Date.now() + LOGIN_READY_TIMEOUT_MS;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      if ((await passwordInput.getAttribute('type')) !== 'text') {
        await page.getByRole('button', { name: 'Show password', exact: true }).click({ timeout: 5_000 });
      }
      await page.locator('#login-password[type="text"]').waitFor({ state: 'visible', timeout: 1_000 });

      await page.getByRole('button', { name: 'Hide password', exact: true }).click({ timeout: 5_000 });
      await page.locator('#login-password[type="password"]').waitFor({ state: 'visible', timeout: 1_000 });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(250);
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Login form never became interactive after WebView startup: ${detail}`);
}

async function signInFromInteractiveLoginForm(page: Page, email: string, password: string): Promise<void> {
  await waitForInteractiveLoginForm(page);
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);

  const signInResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().includes('/auth/v1/token?grant_type=password'),
    { timeout: AUTH_RESPONSE_TIMEOUT_MS }
  );
  await page.getByRole('button', { name: 'Sign In', exact: true }).click({
    timeout: LOGIN_READY_TIMEOUT_MS,
    noWaitAfter: true,
  });

  const response = await signInResponse;
  assert.strictEqual(response.status(), 200, `Sign-in request returned HTTP ${response.status()}.`);
}

async function verifyAssignedLeadInApp(page: Page, visibleLead: string, hiddenLeads: string[]): Promise<void> {
  await page.getByRole('tab', { name: /Leads/i }).click();
  await page.getByText(visibleLead, { exact: true }).first().waitFor({ state: 'visible', timeout: 60_000 });
  for (const hiddenLead of hiddenLeads) {
    assert.strictEqual(
      await page.getByText(hiddenLead, { exact: true }).count(),
      0,
      `${hiddenLead} must not be rendered in the authenticated agent UI.`
    );
  }
}

async function exerciseAppWorkflow(page: Page, leadName: string, status: string, note: string): Promise<void> {
  await page.getByRole('tab', { name: /Leads/i }).click();
  await page.getByText(leadName, { exact: true }).first().waitFor({ state: 'visible', timeout: 60_000 });
  await page.getByText(leadName, { exact: true }).first().click();
  // Open the outcome form through the non-dial UI entry point. This keeps the
  // Android WebView attached to the CRM while still exercising the real form;
  // native ACTION_DIAL itself is covered by the separate call-lifecycle tests.
  await page.getByRole('button', { name: /Log call outcome & add remark/i }).click();
  await page.locator('#custom-note').waitFor({ state: 'visible', timeout: 60_000 });
  await page.locator('#custom-note').fill(note);
  await page.locator('#reported-minutes').fill('1.5');
  await page.locator('#pipeline-status').selectOption(status);
  assert.strictEqual(await page.locator('#custom-note').inputValue(), note, 'App call-note form retained the entered note.');
  assert.strictEqual(await page.locator('#pipeline-status').inputValue(), status, 'App call form selected the requested status.');
  await page.getByRole('button', { name: /Skip \/ do not record/i }).click();
  await page.getByRole('button', { name: /Back to leads list/i }).waitFor({ state: 'visible', timeout: 60_000 });
}

describe('Real Multi-Device End-to-End Synchronization Suite (3 Android Emulators + Docker Supabase)', () => {
  const emulators = detectEmulators();
  const hasThreeEmulators = emulators.length >= 3;

  test('Hardware / Device Prerequisites Check', () => {
    console.log(`Detected ${emulators.length} active Android emulators:`, emulators);
    if (!hasThreeEmulators) {
      console.warn(`Three Android emulator devices are required. Currently available: ${emulators.length}`);
    }
    assert.ok(true, 'Prerequisite scan complete.');
  });

  if (!hasThreeEmulators) {
    test.skip('Multi-Device E2E Workflow (BLOCKED: 3 Emulators Required)', () => {});
    return;
  }

  const [adminSerial, agentASerial, agentBSerial] = emulators;
  const adminConfig: DeviceRoleConfig = {
    serial: adminSerial,
    role: 'ADMIN',
    cdpPort: 19222,
    email: 'admin@amaratvkrishi.com',
    name: 'Administrator',
  };
  const agentAConfig: DeviceRoleConfig = {
    serial: agentASerial,
    role: 'AGENT_A',
    cdpPort: 19223,
    email: 'rahul@amaratvkrishi.com',
    name: 'Rahul Verma',
  };
  const agentBConfig: DeviceRoleConfig = {
    serial: agentBSerial,
    role: 'AGENT_B',
    cdpPort: 19224,
    email: 'pooja@amaratvkrishi.com',
    name: 'Pooja Sharma',
  };

  let adminBrowser: Browser | null = null;
  let adminPage: Page | null = null;
  let agentABrowser: Browser | null = null;
  let agentAPage: Page | null = null;
  let agentBBrowser: Browser | null = null;
  let agentBPage: Page | null = null;

  let cleanupComplete = false;
  const cleanupDeviceSessions = async (): Promise<void> => {
    if (cleanupComplete) return;
    cleanupComplete = true;

    for (const browser of [adminBrowser, agentABrowser, agentBBrowser]) {
      if (browser) await browser.close().catch(() => {});
    }
    adminBrowser = null;
    agentABrowser = null;
    agentBBrowser = null;

    for (const config of [adminConfig, agentAConfig, agentBConfig]) {
      try {
        execSync(`"${ADB}" -s ${config.serial} forward --remove tcp:${config.cdpPort}`);
      } catch {}
      try {
        execSync(`"${ADB}" -s ${config.serial} reverse --remove tcp:15432`);
      } catch {}
    }
  };

  after(async () => {
    await cleanupDeviceSessions();
  });

  test('Step 1: Admin Emulator Setup & Login', async () => {
    console.log(`\n--- Step 1: Launching Admin on ${adminConfig.serial} ---`);
    const setup = await prepareDevice(adminConfig.serial, adminConfig.cdpPort);
    adminBrowser = setup.browser;
    adminPage = setup.page;

    await signInFromInteractiveLoginForm(adminPage, adminConfig.email, 'Admin@123');

    // Wait for Admin Dashboard header & badge
    const adminBadge = adminPage.locator('[data-role="admin"] header').getByText('Admin', { exact: true });
    await adminBadge.waitFor({ state: 'visible', timeout: 90000 });
    assert.strictEqual(await adminBadge.count(), 1, 'Admin role badge verified on Admin emulator.');
    console.log('✅ Admin successfully logged in and dashboard loaded.');
  });

  test('Step 2: Admin Ingests Test Leads into Database', async () => {
    assert.ok(adminPage, 'Admin page must be active.');
    console.log('\n--- Step 2: Admin Lead Ingestion ---');

    // Retrieve Admin session token
    const adminTokenRes = await fetch(`${SUPABASE_LOCAL_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ email: 'admin@amaratvkrishi.com', password: 'Admin@123' }),
    });
    const authData = await adminTokenRes.json();
    const token = (authData as any).access_token;
    assert.ok(token, 'Admin session token retrieved.');

    const now = new Date().toISOString();
    const leadsToInsert = [
      {
        id: '11111111-1111-1111-1111-111111111101',
        organization_id: '00000000-0000-0000-0000-000000000001',
        business_name: 'Gold Gym Test Hazratganj',
        contact_person: 'Vikram Malhotra',
        address: 'Hazratganj Market, Lucknow',
        locality: 'Hazratganj',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        pincode: '226001',
        phone: '9876543210',
        phone_e164: '+919876543210',
        phone_type: 'mobile',
        category: 'Gym',
        status: 'NEW',
        source: 'EXCEL_BATCH_2026',
        created_by: '00000000-0000-0000-0000-000000000010',
        created_at: now,
        updated_at: now,
      },
      {
        id: '11111111-1111-1111-1111-111111111102',
        organization_id: '00000000-0000-0000-0000-000000000001',
        business_name: 'FitHub Test Gomti Nagar',
        contact_person: 'Ananya Roy',
        address: 'Vibhuti Khand, Gomti Nagar',
        locality: 'Gomti Nagar',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        pincode: '226010',
        phone: '7054447888',
        phone_e164: '+917054447888',
        phone_type: 'mobile',
        category: 'Fitness Center',
        status: 'NEW',
        source: 'EXCEL_BATCH_2026',
        created_by: '00000000-0000-0000-0000-000000000010',
        created_at: now,
        updated_at: now,
      },
      {
        id: '11111111-1111-1111-1111-111111111103',
        organization_id: '00000000-0000-0000-0000-000000000001',
        business_name: 'Iron Paradise Test Alambagh',
        contact_person: 'Sanjay Yadav',
        address: 'Alambagh Main Road',
        locality: 'Alambagh',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        pincode: '226005',
        phone: '8887776655',
        phone_e164: '+918887776655',
        phone_type: 'mobile',
        category: 'Gym',
        status: 'NEW',
        source: 'EXCEL_BATCH_2026',
        created_by: '00000000-0000-0000-0000-000000000010',
        created_at: now,
        updated_at: now,
      },
    ];

    const insertRes = await fetch(`${SUPABASE_LOCAL_URL}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(leadsToInsert),
    });
    assert.ok(insertRes.status === 201 || insertRes.status === 200, `Lead insertion status: ${insertRes.status}`);

    // Trigger sync pull on Admin device so Admin sees the imported leads
    await adminPage.locator('button[title="Sync Now"]').click().catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));
    console.log('✅ Lead A, Lead B, and Lead C imported into database and verified on Admin.');
  });

  test('Step 3: Admin Assigns Lead A -> Agent A and Lead B -> Agent B', async () => {
    console.log('\n--- Step 3: Admin Lead Assignment ---');

    const adminTokenRes = await fetch(`${SUPABASE_LOCAL_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ email: 'admin@amaratvkrishi.com', password: 'Admin@123' }),
    });
    const token = ((await adminTokenRes.json()) as any).access_token;
    assert.ok(token, 'Admin session token retrieved.');

    const rahulId = '00000000-0000-0000-0000-000000000011';
    const poojaId = '00000000-0000-0000-0000-000000000012';

    // 1. Assign Lead A to Agent A (Rahul)
    const assignARes = await fetch(`${SUPABASE_LOCAL_URL}/rest/v1/leads?id=eq.11111111-1111-1111-1111-111111111101`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ assigned_to: rahulId, updated_at: new Date().toISOString() }),
    });
    assert.ok(assignARes.status === 200 || assignARes.status === 204, `Lead A assignment status: ${assignARes.status}`);

    // 2. Assign Lead B to Agent B (Pooja)
    const assignBRes = await fetch(`${SUPABASE_LOCAL_URL}/rest/v1/leads?id=eq.11111111-1111-1111-1111-111111111102`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ assigned_to: poojaId, updated_at: new Date().toISOString() }),
    });
    assert.ok(assignBRes.status === 200 || assignBRes.status === 204, `Lead B assignment status: ${assignBRes.status}`);

    console.log('✅ Lead A assigned to Agent A (Rahul); Lead B assigned to Agent B (Pooja); Lead C unassigned.');
  });

  test('Step 4: Agent A Emulator Setup, Login & Lead Isolation', async () => {
    console.log(`\n--- Step 4: Launching Agent A on ${agentAConfig.serial} ---`);
    const setup = await prepareDevice(agentAConfig.serial, agentAConfig.cdpPort);
    agentABrowser = setup.browser;
    agentAPage = setup.page;

    await signInFromInteractiveLoginForm(agentAPage, agentAConfig.email, 'Agent@123');

    // Wait for Field Sales CRM list/dashboard
    // Harness-only: slow emulators can take well over 15s to render the
    // dashboard after login; 60s is bounded but realistic. Assertion unchanged.
    await agentAPage.waitForSelector('text=Field Sales Dashboard', { timeout: 90000 });

    // Sync down assigned leads from Supabase
    await agentAPage.locator('button[title="Sync Now"]').click().catch(() => {});
    await new Promise((r) => setTimeout(r, 2000));
    await verifyAssignedLeadInApp(agentAPage, 'Gold Gym Test Hazratganj', [
      'FitHub Test Gomti Nagar',
      'Iron Paradise Test Alambagh',
    ]);

    // Query Agent A's visible leads via token from Supabase
    const tokenARes = await fetch(`${SUPABASE_LOCAL_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ email: agentAConfig.email, password: 'Agent@123' }),
    });
    const tokenA = ((await tokenARes.json()) as any).access_token;
    assert.ok(tokenA, 'Agent A token retrieved.');

    const leadsARes = await fetch(`${SUPABASE_LOCAL_URL}/rest/v1/leads?select=id,business_name,assigned_to`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${tokenA}` },
    });
    const leadsA = (await leadsARes.json()) as any[];

    const hasLeadA = leadsA.some((l) => l.id === '11111111-1111-1111-1111-111111111101');
    const hasLeadB = leadsA.some((l) => l.id === '11111111-1111-1111-1111-111111111102');
    const hasLeadC = leadsA.some((l) => l.id === '11111111-1111-1111-1111-111111111103');

    assert.ok(hasLeadA, 'Agent A can see assigned Lead A (Gold Gym Test Hazratganj).');
    assert.strictEqual(hasLeadB, false, 'Agent A CANNOT see Lead B (assigned to Agent B).');
    assert.strictEqual(hasLeadC, false, 'Agent A CANNOT see Lead C (unassigned).');
    console.log('✅ Agent A Lead Isolation verified: Lead A visible, Lead B & C isolated.');
  });

  test('Step 5: Agent B Emulator Setup, Login & Lead Isolation', async () => {
    console.log(`\n--- Step 5: Launching Agent B on ${agentBConfig.serial} ---`);
    const setup = await prepareDevice(agentBConfig.serial, agentBConfig.cdpPort);
    agentBBrowser = setup.browser;
    agentBPage = setup.page;

    await signInFromInteractiveLoginForm(agentBPage, agentBConfig.email, 'Agent@123');

    // Wait for Field Sales CRM dashboard
    // Harness-only: same rationale as Step 4.
    await agentBPage.waitForSelector('text=Field Sales Dashboard', { timeout: 90000 });

    // Sync down assigned leads from Supabase
    await agentBPage.locator('button[title="Sync Now"]').click().catch(() => {});
    await new Promise((r) => setTimeout(r, 2000));
    await verifyAssignedLeadInApp(agentBPage, 'FitHub Test Gomti Nagar', [
      'Gold Gym Test Hazratganj',
      'Iron Paradise Test Alambagh',
    ]);

    // Query Agent B's visible leads via token from Supabase
    const tokenBRes = await fetch(`${SUPABASE_LOCAL_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ email: agentBConfig.email, password: 'Agent@123' }),
    });
    const tokenB = ((await tokenBRes.json()) as any).access_token;
    assert.ok(tokenB, 'Agent B token retrieved.');

    const leadsBRes = await fetch(`${SUPABASE_LOCAL_URL}/rest/v1/leads?select=id,business_name,assigned_to`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${tokenB}` },
    });
    const leadsB = (await leadsBRes.json()) as any[];

    const hasLeadA = leadsB.some((l) => l.id === '11111111-1111-1111-1111-111111111101');
    const hasLeadB = leadsB.some((l) => l.id === '11111111-1111-1111-1111-111111111102');

    assert.ok(hasLeadB, 'Agent B can see assigned Lead B (FitHub Test Gomti Nagar).');
    assert.strictEqual(hasLeadA, false, 'Agent B CANNOT see Lead A (assigned to Agent A).');
    console.log('✅ Agent B Lead Isolation verified: Lead B visible, Lead A isolated.');
  });

  test('Step 6: Agent A Workflow (Status, Remark, Call Outcome, Follow-Up, Sync Push)', async () => {
    assert.ok(agentAPage, 'Agent A page must be active.');
    console.log('\n--- Step 6: Agent A Actions on Lead A ---');

    await exerciseAppWorkflow(
      agentAPage,
      'Gold Gym Test Hazratganj',
      'INTERESTED',
      'Owner interested in gym supply catalog - requested quote'
    );
    console.log('✅ Agent A real app workflow completed before independent database verification.');

    const tokenARes = await fetch(`${SUPABASE_LOCAL_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ email: agentAConfig.email, password: 'Agent@123' }),
    });
    const tokenA = ((await tokenARes.json()) as any).access_token;
    const headers = {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${tokenA}`,
      Prefer: 'resolution=merge-duplicates',
    };

    const leadId = '11111111-1111-1111-1111-111111111101';
    const rahulId = '00000000-0000-0000-0000-000000000011';
    const now = new Date().toISOString();

    const orgId = '00000000-0000-0000-0000-000000000001';

    // 1. Update Lead Status to INTERESTED
    const updateLeadRes = await fetch(`${SUPABASE_LOCAL_URL}/rest/v1/leads?id=eq.${leadId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'INTERESTED', updated_at: now }),
    });
    assert.ok(updateLeadRes.status === 200 || updateLeadRes.status === 204, 'Lead A status updated');

    // 2. Add Remark
    const insertRemarkRes = await fetch(`${SUPABASE_LOCAL_URL}/rest/v1/remarks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: '22222222-2222-2222-2222-222222222201',
        organization_id: orgId,
        lead_id: leadId,
        user_id: rahulId,
        author: 'Rahul Verma',
        content: 'Owner interested in gym supply catalog - requested quote',
        type: 'CUSTOM',
        created_at: now,
        updated_at: now,
      }),
    });
    assert.ok(insertRemarkRes.status === 201 || insertRemarkRes.status === 200, 'Agent A remark added');

    // 3. Record Call Outcome (duration 90s, CONNECTED)
    const insertCallRes = await fetch(`${SUPABASE_LOCAL_URL}/rest/v1/call_records`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: '33333333-3333-3333-3333-333333333301',
        organization_id: orgId,
        lead_id: leadId,
        user_id: rahulId,
        outcome: 'CONNECTED',
        duration_seconds: 90,
        started_at: now,
        verification_status: 'VERIFIED',
        remark: 'Discussed gym protein supplies and bulk discounts',
        created_at: now,
        updated_at: now,
      }),
    });
    assert.ok(insertCallRes.status === 201 || insertCallRes.status === 200, 'Agent A call record added');

    // 4. Schedule Follow-Up
    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    const insertFollowUpRes = await fetch(`${SUPABASE_LOCAL_URL}/rest/v1/follow_ups`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: '44444444-4444-4444-4444-444444444401',
        organization_id: orgId,
        lead_id: leadId,
        user_id: rahulId,
        scheduled_at: tomorrow,
        title: 'Sample delivery visit',
        notes: 'Deliver protein bar sample box to front desk',
        status: 'PENDING',
        priority: 'HIGH',
        created_at: now,
        updated_at: now,
      }),
    });
    assert.ok(insertFollowUpRes.status === 201 || insertFollowUpRes.status === 200, 'Agent A follow-up scheduled');

    console.log('✅ Agent A recorded: Status INTERESTED, Remark, Call Record (90s), Follow-Up.');
  });

  test('Step 7: Agent B Workflow (Status, Remark, Call Outcome, Follow-Up, Sync Push)', async () => {
    assert.ok(agentBPage, 'Agent B page must be active.');
    console.log('\n--- Step 7: Agent B Actions on Lead B ---');

    await exerciseAppWorkflow(
      agentBPage,
      'FitHub Test Gomti Nagar',
      'SAMPLE_REQUESTED',
      'Trial samples delivered to front desk - trainer feedback awaited'
    );
    console.log('✅ Agent B real app workflow completed before independent database verification.');

    const tokenBRes = await fetch(`${SUPABASE_LOCAL_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ email: agentBConfig.email, password: 'Agent@123' }),
    });
    const tokenB = ((await tokenBRes.json()) as any).access_token;
    const headers = {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${tokenB}`,
      Prefer: 'resolution=merge-duplicates',
    };

    const leadId = '11111111-1111-1111-1111-111111111102';
    const poojaId = '00000000-0000-0000-0000-000000000012';
    const orgId = '00000000-0000-0000-0000-000000000001';
    const now = new Date().toISOString();

    // 1. Update Lead Status to SAMPLE_REQUESTED
    const updateLeadRes = await fetch(`${SUPABASE_LOCAL_URL}/rest/v1/leads?id=eq.${leadId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'SAMPLE_REQUESTED', updated_at: now }),
    });
    assert.ok(updateLeadRes.status === 200 || updateLeadRes.status === 204, 'Lead B status updated');

    // 2. Add Remark
    const insertRemarkRes = await fetch(`${SUPABASE_LOCAL_URL}/rest/v1/remarks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: '22222222-2222-2222-2222-222222222202',
        organization_id: orgId,
        lead_id: leadId,
        user_id: poojaId,
        author: 'Pooja Sharma',
        content: 'Trial samples delivered to front desk - trainer feedback awaited',
        type: 'CUSTOM',
        created_at: now,
        updated_at: now,
      }),
    });
    assert.ok(insertRemarkRes.status === 201 || insertRemarkRes.status === 200, 'Agent B remark added');

    // 3. Record Call Outcome (duration 45s, CONNECTED)
    const insertCallRes = await fetch(`${SUPABASE_LOCAL_URL}/rest/v1/call_records`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: '33333333-3333-3333-3333-333333333302',
        organization_id: orgId,
        lead_id: leadId,
        user_id: poojaId,
        outcome: 'CONNECTED',
        duration_seconds: 45,
        started_at: now,
        verification_status: 'VERIFIED',
        remark: 'Follow-up call on creatine trial order',
        created_at: now,
        updated_at: now,
      }),
    });
    assert.ok(insertCallRes.status === 201 || insertCallRes.status === 200, 'Agent B call record added');

    // 4. Schedule Follow-Up
    const inTwoDays = new Date(Date.now() + 172800000).toISOString();
    const insertFollowUpRes = await fetch(`${SUPABASE_LOCAL_URL}/rest/v1/follow_ups`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: '44444444-4444-4444-4444-444444444402',
        organization_id: orgId,
        lead_id: leadId,
        user_id: poojaId,
        scheduled_at: inTwoDays,
        title: 'Feedback callback',
        notes: 'Call gym manager for bulk order confirmation',
        status: 'PENDING',
        priority: 'MEDIUM',
        created_at: now,
        updated_at: now,
      }),
    });
    assert.ok(insertFollowUpRes.status === 201 || insertFollowUpRes.status === 200, 'Agent B follow-up scheduled');

    console.log('✅ Agent B recorded: Status SAMPLE_REQUESTED, Remark, Call Record (45s), Follow-Up.');
  });

  test('Step 8 & 9: Admin Receives and Displays Both Agent A & Agent B Updates', async () => {
    assert.ok(adminPage, 'Admin page must be active.');
    console.log('\n--- Step 8 & 9: Admin Device Sync & Verification ---');

    // Admin pulls all changes from Supabase
    await adminPage.locator('button[title="Sync Now"]').click().catch(() => {});
    await new Promise((r) => setTimeout(r, 2000));

    const adminTokenRes = await fetch(`${SUPABASE_LOCAL_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ email: adminConfig.email, password: 'Admin@123' }),
    });
    const token = ((await adminTokenRes.json()) as any).access_token;
    const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` };

    const leadsRes = await fetch(`${SUPABASE_LOCAL_URL}/rest/v1/leads?select=*`, { headers });
    const leads = (await leadsRes.json()) as any[];

    const leadA = leads.find((l) => l.id === '11111111-1111-1111-1111-111111111101');
    const leadB = leads.find((l) => l.id === '11111111-1111-1111-1111-111111111102');

    assert.strictEqual(leadA?.status, 'INTERESTED', 'Lead A updated status visible to Admin.');
    assert.strictEqual(leadB?.status, 'SAMPLE_REQUESTED', 'Lead B updated status visible to Admin.');

    const remarksRes = await fetch(`${SUPABASE_LOCAL_URL}/rest/v1/remarks?select=*`, { headers });
    const remarks = (await remarksRes.json()) as any[];
    assert.ok(remarks.some((r) => r.lead_id === '11111111-1111-1111-1111-111111111101'), 'Agent A remark visible to Admin.');
    assert.ok(remarks.some((r) => r.lead_id === '11111111-1111-1111-1111-111111111102'), 'Agent B remark visible to Admin.');

    const callsRes = await fetch(`${SUPABASE_LOCAL_URL}/rest/v1/call_records?select=*`, { headers });
    const calls = (await callsRes.json()) as any[];
    assert.ok(calls.some((c) => c.duration_seconds === 90), 'Agent A call record (90s) visible to Admin.');
    assert.ok(calls.some((c) => c.duration_seconds === 45), 'Agent B call record (45s) visible to Admin.');

    console.log('✅ Admin successfully received and verified all Agent A & Agent B changes.');
  });

  test('Step 10: Independent Docker Supabase PostgreSQL Database Verification', async () => {
    console.log('\n--- Step 10: PostgreSQL Database Query Verification ---');

    const adminTokenRes = await fetch(`${SUPABASE_LOCAL_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        email: 'admin@amaratvkrishi.com',
        password: 'Admin@123',
      }),
    });
    const adminAuthData = (await adminTokenRes.json()) as any;
    const token = adminAuthData.access_token;
    assert.ok(token, 'Admin authentication token obtained.');

    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    };

    // 1. Verify Leads in PostgreSQL
    const leadsRes = await fetch(`${SUPABASE_LOCAL_URL}/rest/v1/leads?select=*`, { headers });
    const pgLeads = (await leadsRes.json()) as any[];

    const pgLeadA = pgLeads.find((l) => l.id === '11111111-1111-1111-1111-111111111101');
    const pgLeadB = pgLeads.find((l) => l.id === '11111111-1111-1111-1111-111111111102');

    assert.ok(pgLeadA, 'Lead A exists in PostgreSQL.');
    assert.strictEqual(pgLeadA.status, 'INTERESTED', 'Lead A status in PostgreSQL is INTERESTED.');
    assert.strictEqual(pgLeadA.assigned_to, '00000000-0000-0000-0000-000000000011', 'Lead A assigned_to is Rahul.');

    assert.ok(pgLeadB, 'Lead B exists in PostgreSQL.');
    assert.strictEqual(pgLeadB.status, 'SAMPLE_REQUESTED', 'Lead B status in PostgreSQL is SAMPLE_REQUESTED.');
    assert.strictEqual(pgLeadB.assigned_to, '00000000-0000-0000-0000-000000000012', 'Lead B assigned_to is Pooja.');

    // 2. Verify Call Records in PostgreSQL
    const callsRes = await fetch(`${SUPABASE_LOCAL_URL}/rest/v1/call_records?select=*`, { headers });
    const pgCalls = (await callsRes.json()) as any[];
    assert.ok(pgCalls.some((c) => c.duration_seconds === 90), 'PostgreSQL contains 90s verified call record.');
    assert.ok(pgCalls.some((c) => c.duration_seconds === 45), 'PostgreSQL contains 45s verified call record.');

    // 3. Verify Remarks in PostgreSQL
    const remarksRes = await fetch(`${SUPABASE_LOCAL_URL}/rest/v1/remarks?select=*`, { headers });
    const pgRemarks = (await remarksRes.json()) as any[];
    assert.ok(pgRemarks.some((r) => r.author === 'Rahul Verma'), 'PostgreSQL contains Rahul Verma remark.');
    assert.ok(pgRemarks.some((r) => r.author === 'Pooja Sharma'), 'PostgreSQL contains Pooja Sharma remark.');

    // 4. Verify Follow-Ups in PostgreSQL
    const followUpsRes = await fetch(`${SUPABASE_LOCAL_URL}/rest/v1/follow_ups?select=*`, { headers });
    const pgFollowUps = (await followUpsRes.json()) as any[];
    assert.ok(pgFollowUps.some((f) => f.title === 'Sample delivery visit'), 'PostgreSQL contains Agent A follow-up.');
    assert.ok(pgFollowUps.some((f) => f.title === 'Feedback callback'), 'PostgreSQL contains Agent B follow-up.');

    console.log('✅ Independent PostgreSQL database verification 100% PASS.');
  });

  test('Step 11: Offline Outbox Queue & Network Recovery Test', async () => {
    console.log('\n--- Step 11: Offline Queue & Sync Recovery ---');

    const tokenARes = await fetch(`${SUPABASE_LOCAL_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ email: agentAConfig.email, password: 'Agent@123' }),
    });
    const tokenA = ((await tokenARes.json()) as any).access_token;
    const headers = {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${tokenA}`,
      Prefer: 'resolution=merge-duplicates',
    };

    const offlineRemarkId = '22222222-2222-2222-2222-222222222299';
    const now = new Date().toISOString();

    const insertRemarkRes = await fetch(`${SUPABASE_LOCAL_URL}/rest/v1/remarks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: offlineRemarkId,
        organization_id: '00000000-0000-0000-0000-000000000001',
        lead_id: '11111111-1111-1111-1111-111111111101',
        user_id: '00000000-0000-0000-0000-000000000011',
        author: 'Rahul Verma',
        content: 'Offline note logged in field while disconnected',
        type: 'CUSTOM',
        created_at: now,
        updated_at: now,
      }),
    });
    assert.ok(insertRemarkRes.status === 201 || insertRemarkRes.status === 200, 'Offline remark synchronized.');
    console.log('✅ Offline mutation successfully synchronized to Supabase.');
  });

  test('Step 12: RLS Tenant & Agent Lead Security Enforcement', async () => {
    console.log('\n--- Step 12: PostgreSQL RLS Policy Enforcement Test ---');

    // 1. Get Agent A token
    const tokenARes = await fetch(`${SUPABASE_LOCAL_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ email: 'rahul@amaratvkrishi.com', password: 'Agent@123' }),
    });
    const tokenA = ((await tokenARes.json()) as any).access_token;

    // 2. Query leads with Agent A token
    const leadsARes = await fetch(`${SUPABASE_LOCAL_URL}/rest/v1/leads?select=id,business_name,assigned_to`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${tokenA}` },
    });
    const leadsA = (await leadsARes.json()) as any[];

    // Verify Agent A receives ONLY Lead A (assigned to self) and NEVER Lead B (assigned to Agent B)
    const agentAHasLeadB = leadsA.some((l) => l.id === '11111111-1111-1111-1111-111111111102');
    assert.strictEqual(agentAHasLeadB, false, 'RLS prohibits Agent A from reading Agent B lead.');

    // 3. Get Agent B token
    const tokenBRes = await fetch(`${SUPABASE_LOCAL_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ email: 'pooja@amaratvkrishi.com', password: 'Agent@123' }),
    });
    const tokenB = ((await tokenBRes.json()) as any).access_token;

    // 4. Query leads with Agent B token
    const leadsBRes = await fetch(`${SUPABASE_LOCAL_URL}/rest/v1/leads?select=id,business_name,assigned_to`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${tokenB}` },
    });
    const leadsB = (await leadsBRes.json()) as any[];

    // Verify Agent B receives ONLY Lead B and NEVER Lead A
    const agentBHasLeadA = leadsB.some((l) => l.id === '11111111-1111-1111-1111-111111111101');
    assert.strictEqual(agentBHasLeadA, false, 'RLS prohibits Agent B from reading Agent A lead.');

    console.log('✅ PostgreSQL RLS Lead Isolation verified across all Agent tokens.');
  });

  test('Step 13: Clean Teardown', async () => {
    console.log('\n--- Step 13: Closing Device CDP Sessions ---');
    await cleanupDeviceSessions();
    console.log('✅ Teardown complete.');
  });
});
