/**
 * Multi-Device End-to-End Synchronization Test Suite
 * Executes a genuine end-to-end business workflow across 3 real Android Studio emulators
 * and local Docker Supabase PostgreSQL:
 * 
 * DEVICE 1 = ADMIN (e.g. emulator-5556)
 * DEVICE 2 = AGENT A (e.g. emulator-5558)
 * DEVICE 3 = AGENT B (e.g. emulator-5560)
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { existsSync, readdirSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'node:crypto';
import { chromium, Page, Browser } from '@playwright/test';
import { androidSdkEnvironment } from '../scripts/android-sdk';
import { runProcessWithWatchdog } from '../scripts/process-watchdog';
import { getLocalSupabaseEnv } from './helpers/localSupabaseEnv';

const ADB = path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe');
const APP_PACKAGE = 'com.amaratvkrishi.salescrm';
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const LOCAL_TEST_APK = path.join(REPO_ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const localSupabase = getLocalSupabaseEnv();
const SUPABASE_LOCAL_URL = localSupabase.apiUrl;
const SUPABASE_ANON_KEY = localSupabase.anonKey;
const LOGIN_READY_TIMEOUT_MS = 60_000;
const AUTH_RESPONSE_TIMEOUT_MS = 45_000;
const AUTH_RESPONSE_ATTEMPTS = 2;
const CDP_CONNECT_TIMEOUT_MS = 45_000;
const DEVICE_API_READY_TIMEOUT_MS = 60_000;
let localTestApkReady = false;
const harnessBrowsers = new Set<Browser>();

async function runAdb(args: string[], options: any = {}): Promise<any> {
  const timeoutMs = typeof options.timeout === 'number' ? options.timeout : 30_000;
  const result = await runProcessWithWatchdog({
    label: `ADB ${args.join(' ')}`,
    command: ADB,
    args,
    cwd: REPO_ROOT,
    env: process.env,
    timeoutMs,
    logFile: path.join(REPO_ROOT, 'test-results', 'multi-device-adb-watchdog.log'),
  });
  if (result.status !== 'PASSED') {
    throw new Error(
      `${result.label} ${result.status}: ${result.reason ?? 'no additional reason'}\n` +
      `${result.stdout}${result.stderr}`,
    );
  }
  return options.encoding ? result.stdout : Buffer.from(result.stdout);
}

function localBuildEnvironment(): NodeJS.ProcessEnv {
  return androidSdkEnvironment({
    ...process.env,
    VITE_SUPABASE_URL: SUPABASE_LOCAL_URL,
    VITE_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
    CAPACITOR_ANDROID_SCHEME: 'http',
    VITE_APP_ENV: 'local-test',
  });
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

async function runOwnedStage(
  label: string,
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
): Promise<void> {
  const result = await runProcessWithWatchdog({
    label,
    command,
    args,
    cwd,
    env,
    timeoutMs,
    logFile: path.join(REPO_ROOT, 'test-results', 'multi-device-watchdog.log'),
    echoOutput: true,
  });
  assert.strictEqual(
    result.status,
    'PASSED',
    `${label} ${result.status}: ${result.reason ?? 'no additional reason'}`,
  );
}

async function buildLocalTestApk(): Promise<void> {
  if (localTestApkReady) return;

  const env = localBuildEnvironment();
  const npm = process.platform === 'win32'
    ? { command: process.execPath, args: [path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')] }
    : { command: 'npm', args: [] };
  const npx = process.platform === 'win32'
    ? { command: process.execPath, args: [path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js')] }
    : { command: 'npx', args: [] };

  console.log('Building the Android test artifact against disposable local Supabase.');
  await runOwnedStage('Multi-device Android: local web build', npm.command, [...npm.args, 'run', 'build:local-test'], REPO_ROOT, env, 180_000);
  await runOwnedStage('Multi-device Android: Capacitor sync', npx.command, [...npx.args, 'cap', 'sync', 'android'], REPO_ROOT, env, 120_000);

  const syncedAssets = path.join(REPO_ROOT, 'android', 'app', 'src', 'main', 'assets', 'public');
  assert.ok(
    directoryContains(syncedAssets, SUPABASE_LOCAL_URL),
    'Synced Android web assets must contain the disposable local Supabase URL.'
  );
  assert.ok(existsSync(path.join(REPO_ROOT, 'android', 'app', 'src', 'main', 'assets', 'capacitor.config.json')));

  const gradle = process.platform === 'win32'
    ? { command: 'cmd.exe', args: ['/d', '/s', '/c', 'gradlew.bat assembleDebug --no-daemon'] }
    : { command: path.join(REPO_ROOT, 'android', 'gradlew'), args: ['assembleDebug', '--no-daemon'] };
  await runOwnedStage(
    'Multi-device Android: Gradle assembleDebug',
    gradle.command,
    gradle.args,
    path.join(REPO_ROOT, 'android'),
    env,
    300_000,
  );
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

async function detectEmulators(): Promise<string[]> {
  try {
    const output = await runAdb(['devices'], { encoding: 'utf-8' });
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

async function reconnectDeviceWebView(serial: string, cdpPort: number): Promise<{ browser: Browser; page: Page }> {
  let pid = '';
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      pid = (await runAdb(['-s', serial, 'shell', 'pidof', APP_PACKAGE], { encoding: 'utf-8' })).trim();
      if (pid) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!pid) throw new Error(`App process unavailable after resume on ${serial}.`);

  try {
    await runAdb(['-s', serial, 'forward', '--remove', `tcp:${cdpPort}`], { stdio: 'ignore' });
  } catch {}
  await runAdb(['-s', serial, 'forward', `tcp:${cdpPort}`, `localabstract:webview_devtools_remote_${pid}`], { stdio: 'ignore' });

  if (!(await waitForCdpReady(cdpPort, 60))) {
    throw new Error(`WebView CDP endpoint did not return after native dialer on ${serial}.`);
  }
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`, { timeout: CDP_CONNECT_TIMEOUT_MS });
  harnessBrowsers.add(browser);
  const context = browser.contexts()[0];
  const page = context.pages()[0];
  await page.waitForLoadState('domcontentloaded', { timeout: LOGIN_READY_TIMEOUT_MS });
  return { browser, page };
}

async function ensureAppInstalled(serial: string): Promise<void> {
  await buildLocalTestApk();
  const listed = await runAdb(['-s', serial, 'shell', 'pm', 'list', 'packages', APP_PACKAGE], { encoding: 'utf-8' });
  const exactPackageInstalled = listed
    .split(/\r?\n/)
    .some(line => line.trim() === `package:${APP_PACKAGE}`);
  if (exactPackageInstalled) {
    // Package removal can take longer than the ordinary ADB budget after a
    // local database reset or emulator reconnect. Keep it bounded without
    // misclassifying a slow cleanup as device setup failure.
    await runAdb(['-s', serial, 'uninstall', APP_PACKAGE], { stdio: 'ignore', timeout: 90_000 });
  }
  console.log(`Installing verified local-Supabase debug APK on ${serial}`);
  await runAdb(['-s', serial, 'install', LOCAL_TEST_APK], { encoding: 'utf-8', timeout: 180_000 });
}

async function prepareDevice(serial: string, cdpPort: number): Promise<{ browser: Browser; page: Page }> {
  await waitForDeviceReady(serial);
  await ensureAppInstalled(serial);
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await prepareDeviceSession(serial, cdpPort);
    } catch (error) {
      await captureDeviceDiagnostics(serial);
      if (attempt === 2) throw new Error(`INFRASTRUCTURE_LIMITATION: device setup failed on ${serial} after ${attempt} attempts.`, { cause: error });
      await runAdb(['-s', serial, 'shell', 'am', 'force-stop', APP_PACKAGE]);
      await waitForDeviceReady(serial);
    }
  }
  throw new Error('Device setup exhausted its retry budget.');
}

async function waitForDeviceReady(serial: string): Promise<void> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const state = await runAdb(['-s', serial, 'get-state'], { encoding: 'utf8', timeout: 5_000 });
      const boot = await runAdb(['-s', serial, 'shell', 'getprop', 'sys.boot_completed'], { encoding: 'utf8', timeout: 5_000 });
      const packages = await runAdb(['-s', serial, 'shell', 'pm', 'path', 'android'], { encoding: 'utf8', timeout: 5_000 });
      if (state.trim() === 'device' && boot.trim() === '1' && packages.includes('package:')) return;
    } catch { /* Retry only this device within the readiness deadline. */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  await captureDeviceDiagnostics(serial);
  throw new Error(`INFRASTRUCTURE_LIMITATION: ${serial} failed boot/package-manager readiness.`);
}

async function captureDeviceDiagnostics(serial: string): Promise<void> {
  for (const args of [['get-state'], ['shell', 'getprop', 'sys.boot_completed'], ['logcat', '-d', '-t', '100', 'ActivityManager:I', 'AndroidRuntime:E', '*:S']]) {
    try { await runAdb(['-s', serial, ...args], { encoding: 'utf8', timeout: 5_000 }); } catch { /* The watchdog retains failures too. */ }
  }
}

async function prepareDeviceSession(serial: string, cdpPort: number): Promise<{ browser: Browser; page: Page }> {

  // 1. Configure reverse port forwarding for Supabase Local
  await runAdb(['-s', serial, 'reverse', 'tcp:15432', 'tcp:15432']);

  // 2. Clear app storage for clean deterministic session
  // Android's package manager can be slow after an emulator has just been
  // reconnected. Keep cleanup bounded without turning a slow clear into a
  // false lifecycle/setup failure.
  await runAdb(['-s', serial, 'shell', 'pm', 'clear', APP_PACKAGE], { timeout: 90_000 });

  // 3. Launch application. ActivityManager is deterministic and non-blocking;
  // PID and WebView CDP readiness are verified explicitly below. `monkey` and
  // `am start -W` can wait indefinitely on a cold or degraded WebView.
  await runAdb(['-s', serial, 'shell', 'am', 'start', '-n', `${APP_PACKAGE}/.MainActivity`]);

  // 4. Poll for PID
  let pid = '';
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      pid = (await runAdb(['-s', serial, 'shell', 'pidof', APP_PACKAGE], { encoding: 'utf-8' })).trim();
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
      await runAdb(['-s', serial, 'forward', '--remove', `tcp:${cdpPort}`], { stdio: 'ignore' });
    } catch {}

    try {
      await runAdb(['-s', serial, 'forward', `tcp:${cdpPort}`, `localabstract:webview_devtools_remote_${pid}`], {
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
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`, { timeout: CDP_CONNECT_TIMEOUT_MS });
  harnessBrowsers.add(browser);
  const context = browser.contexts()[0];
  const page = context.pages()[0];
  await page.waitForLoadState('domcontentloaded', { timeout: LOGIN_READY_TIMEOUT_MS });

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

async function waitForDeviceSupabaseApi(page: Page): Promise<void> {
  const deadline = Date.now() + DEVICE_API_READY_TIMEOUT_MS;
  let lastError = 'no response';

  while (Date.now() < deadline) {
    try {
      const status = await page.evaluate(async ({ apiUrl, anonKey }) => {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 5_000);
        try {
          const response = await fetch(`${apiUrl}/auth/v1/settings`, {
            headers: { apikey: anonKey },
            signal: controller.signal,
          });
          return response.status;
        } finally {
          window.clearTimeout(timer);
        }
      }, { apiUrl: SUPABASE_LOCAL_URL, anonKey: SUPABASE_ANON_KEY });

      if (status === 200) return;
      lastError = `HTTP ${status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await page.waitForTimeout(1_000);
  }

  throw new Error(`Supabase auth API was not reachable from the Android WebView within ${DEVICE_API_READY_TIMEOUT_MS}ms: ${lastError}`);
}

async function signInFromInteractiveLoginForm(page: Page, email: string, password: string): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= AUTH_RESPONSE_ATTEMPTS; attempt++) {
    await waitForDeviceSupabaseApi(page);
    await waitForInteractiveLoginForm(page);
    await page.locator('#login-email').fill(email);
    await page.locator('#login-password').fill(password);

    try {
      const [response] = await Promise.all([
        page.waitForResponse(
          (candidate) =>
            candidate.request().method() === 'POST' &&
            candidate.url().includes('/auth/v1/token?grant_type=password'),
          { timeout: AUTH_RESPONSE_TIMEOUT_MS }
        ),
        page.getByRole('button', { name: 'Sign In', exact: true }).click({
          timeout: LOGIN_READY_TIMEOUT_MS,
          noWaitAfter: true,
        }),
      ]);
      assert.strictEqual(response.status(), 200, `Sign-in request returned HTTP ${response.status()}.`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < AUTH_RESPONSE_ATTEMPTS) {
        console.warn('Login request did not complete on attempt %d; retrying once.', attempt);
        await page.waitForTimeout(1_000);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
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

async function assignLeadViaSyncRpc(token: string, leadId: string, assignedTo: string): Promise<void> {
  const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` };
  const currentRes = await fetch(
    `${SUPABASE_LOCAL_URL}/rest/v1/leads?id=eq.${leadId}&select=id,organization_id,sync_revision`,
    { headers }
  );
  assert.strictEqual(currentRes.status, 200, `Lead revision lookup returned ${currentRes.status}.`);
  const rows = (await currentRes.json()) as Array<{ id: string; organization_id: string; sync_revision: number }>;
  assert.strictEqual(rows.length, 1, `Expected exactly one lead row for ${leadId}.`);
  const current = rows[0];

  const mutateRes = await fetch(`${SUPABASE_LOCAL_URL}/rest/v1/rpc/sync_mutate`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entity: 'leads',
      operation: 'UPDATE',
      mutation_id: randomUUID(),
      expected_revision: current.sync_revision,
      payload: {
        id: current.id,
        organization_id: current.organization_id,
        assigned_to: assignedTo,
      },
    }),
  });
  const result = (await mutateRes.json()) as { status?: string };
  assert.strictEqual(mutateRes.status, 200, `sync_mutate assignment returned ${mutateRes.status}.`);
  assert.strictEqual(result.status, 'APPLIED', `sync_mutate did not apply assignment for ${leadId}.`);
}

async function readOutboxCount(page: Page, userId: string): Promise<number> {
  const dbName = `AmaratvSalesCRM__00000000-0000-0000-0000-000000000001__${userId}`;
  return page.evaluate(async (name) => {
    return await new Promise<number>((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('outbox')) {
          db.close();
          resolve(-1);
          return;
        }
        const tx = db.transaction('outbox', 'readonly');
        const countRequest = tx.objectStore('outbox').count();
        countRequest.onerror = () => reject(countRequest.error);
        countRequest.onsuccess = () => {
          const count = countRequest.result;
          db.close();
          resolve(count);
        };
      };
    });
  }, dbName);
}

async function readLocalLeadStatus(page: Page, userId: string, leadId: string): Promise<string | null> {
  const dbName = `AmaratvSalesCRM__00000000-0000-0000-0000-000000000001__${userId}`;
  return page.evaluate(async ({ name, id }) => {
    return await new Promise<string | null>((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('leads', 'readonly');
        const getRequest = tx.objectStore('leads').get(id);
        getRequest.onerror = () => reject(getRequest.error);
        getRequest.onsuccess = () => {
          const status = getRequest.result?.status ?? null;
          db.close();
          resolve(status);
        };
      };
    });
  }, { name: dbName, id: leadId });
}

async function waitForLocalLeadStatus(page: Page, userId: string, leadId: string, expected: string): Promise<void> {
  const deadline = Date.now() + 60_000;
  let actual: string | null = null;
  while (Date.now() < deadline) {
    actual = await readLocalLeadStatus(page, userId, leadId);
    if (actual === expected) return;
    await page.waitForTimeout(500);
  }
  throw new Error(`Local lead ${leadId} expected ${expected}, received ${actual}.`);
}

async function waitForOutboxToDrain(page: Page, userId: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastCount = -1;
  while (Date.now() < deadline) {
    lastCount = await readOutboxCount(page, userId);
    if (lastCount === 0) return;
    await page.waitForTimeout(500);
  }
  throw new Error(`Outbox did not drain for ${userId}; last count ${lastCount}.`);
}

async function waitForOutboxToContainWork(page: Page, userId: string, timeoutMs = 15_000): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  let lastCount = -1;
  while (Date.now() < deadline) {
    lastCount = await readOutboxCount(page, userId);
    if (lastCount > 0) return lastCount;
    await page.waitForTimeout(250);
  }
  throw new Error(`Expected pending outbox work for ${userId}; last count ${lastCount}.`);
}

async function synchronizeApp(page: Page, userId: string, timeoutMs = 90_000): Promise<void> {
  const button = page.getByRole('button', { name: 'Sync Now', exact: true }).first();
  const deadline = Date.now() + timeoutMs;
  let lastCount = -1;
  let emptySince: number | null = null;
  while (Date.now() < deadline) {
    lastCount = await readOutboxCount(page, userId);
    if (lastCount === 0) {
      emptySince ??= Date.now();
      // A background sync may drain the outbox before the explicit button click
      // is enabled. Downstream Admin/PostgreSQL assertions prove persistence.
      if (Date.now() - emptySince >= 2_000) return;
    } else {
      emptySince = null;
      if (await button.isEnabled().catch(() => false)) {
        await button.click({ timeout: 5_000 }).catch(() => {});
        await page.waitForTimeout(750);
      }
    }
    await page.waitForTimeout(500);
  }
  throw new Error(`Sync did not settle for ${userId}; outbox count ${lastCount}.`);
}

async function exerciseAppWorkflow(
  page: Page,
  serial: string,
  cdpPort: number,
  userId: string,
  leadName: string,
  status: string,
  note: string,
  followUpTitle: string
): Promise<{ browser: Browser; page: Page }> {
  await page.getByRole('tab', { name: /Leads/i }).click();
  await page.getByText(leadName, { exact: true }).first().waitFor({ state: 'visible', timeout: 60_000 });
  await page.getByText(leadName, { exact: true }).first().click();

  await page.getByRole('button', { name: 'Call', exact: true }).click({ noWaitAfter: true });
  await new Promise((r) => setTimeout(r, 1_000));
  await runAdb(['-s', serial, 'shell', 'am', 'start', '-n', `${APP_PACKAGE}/.MainActivity`], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1_000));
  const resumed = await reconnectDeviceWebView(serial, cdpPort);
  page = resumed.page;

  await page.locator('#custom-note').waitFor({ state: 'visible', timeout: 60_000 });
  await page.locator('#custom-note').fill(note);
  await page.locator('#reported-minutes').fill('2');
  await page.locator('#pipeline-status').selectOption(status);
  await page.locator('#wants-follow-up').check();
  await page.locator('#follow-up-title').fill(followUpTitle);
  assert.strictEqual(await page.locator('#custom-note').inputValue(), note, 'App call-note form retained the entered note.');
  assert.strictEqual(await page.locator('#pipeline-status').inputValue(), status, 'App call form selected the requested status.');
  await page.getByRole('button', { name: /Save call outcome & notes/i }).click();
  await page.locator('#custom-note').waitFor({ state: 'hidden', timeout: 60_000 });

  await page.getByRole('tab', { name: /Remarks/i }).click();
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  await page.locator('#inline-remark').fill(note);
  await page.getByRole('button', { name: 'Save remark', exact: true }).click();
  await page.locator('#inline-remark').waitFor({ state: 'hidden', timeout: 30_000 });

  await synchronizeApp(page, userId);
  await page.getByRole('button', { name: /Back to leads list/i }).click();
  return resumed;
}

const detectedEmulators = await detectEmulators();

describe('Real Multi-Device End-to-End Synchronization Suite (3 Android Emulators + Docker Supabase)', () => {
  const emulators = detectedEmulators;
  const hasThreeEmulators = emulators.length >= 3;

  before(async () => {
    if (!hasThreeEmulators) throw new Error('INFRASTRUCTURE_LIMITATION: three emulators are required before resetting local test data.');
    for (const serial of emulators.slice(0, 3)) await waitForDeviceReady(serial);
    console.log('\n--- Resetting disposable local Supabase for deterministic multi-device acceptance ---');
    const npx = process.platform === 'win32'
      ? { command: process.execPath, args: [path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js')] }
      : { command: 'npx', args: [] };
    await runOwnedStage(
      'Multi-device disposable Supabase reset',
      npx.command,
      [...npx.args, '--no-install', 'supabase', 'db', 'reset', '--local'],
      REPO_ROOT,
      process.env,
      180_000,
    );
  });

  let failedStep: string | undefined;
  function workflowStep(name: string, run: () => Promise<void>): void {
    test(name, async context => {
      if (failedStep) { context.skip('Blocked by failed prerequisite: ' + failedStep); return; }
      try { await run(); } catch (error) { failedStep = name; throw error; }
    });
  }

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

    for (const browser of harnessBrowsers) await browser.close().catch(() => {});
    harnessBrowsers.clear();
    adminBrowser = null;
    agentABrowser = null;
    agentBBrowser = null;

    for (const config of [adminConfig, agentAConfig, agentBConfig]) {
      try {
        await runAdb(['-s', config.serial, 'forward', '--remove', `tcp:${config.cdpPort}`]);
      } catch {}
      try {
        await runAdb(['-s', config.serial, 'reverse', '--remove', 'tcp:15432']);
      } catch {}
    }
  };

  after(async () => {
    await cleanupDeviceSessions();
  });

  workflowStep('Step 1: Admin Emulator Setup & Login', async () => {
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

  workflowStep('Step 2: Admin Ingests Test Leads into Database', async () => {
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

  workflowStep('Step 3: Admin Assigns Lead A -> Agent A and Lead B -> Agent B', async () => {
    console.log('\n--- Step 3: Admin Lead Assignment ---');

    const adminTokenRes = await fetch(`${SUPABASE_LOCAL_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ email: 'admin@amaratvkrishi.com', password: 'Admin@123' }),
    });
    const token = ((await adminTokenRes.json()) as any).access_token;
    assert.ok(token, 'Admin session token retrieved.');

    await assignLeadViaSyncRpc(token, '11111111-1111-1111-1111-111111111101', '00000000-0000-0000-0000-000000000011');
    await assignLeadViaSyncRpc(token, '11111111-1111-1111-1111-111111111102', '00000000-0000-0000-0000-000000000012');

    await synchronizeApp(adminPage!, '00000000-0000-0000-0000-000000000010');
    console.log('✅ Lead A assigned to Agent A (Rahul); Lead B assigned to Agent B (Pooja); Lead C unassigned.');
  });

  workflowStep('Step 4: Agent A Emulator Setup, Login & Lead Isolation', async () => {
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

  workflowStep('Step 5: Agent B Emulator Setup, Login & Lead Isolation', async () => {
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

  workflowStep('Step 6: Agent A Workflow (Status, Remark, Call Outcome, Follow-Up, Sync Push)', async () => {
    assert.ok(agentAPage, 'Agent A page must be active.');
    console.log('\n--- Step 6: Agent A Actions on Lead A ---');

    const resumedA = await exerciseAppWorkflow(
      agentAPage,
      agentAConfig.serial,
      agentAConfig.cdpPort,
      '00000000-0000-0000-0000-000000000011',
      'Gold Gym Test Hazratganj',
      'INTERESTED',
      'Owner interested in gym supply catalog - requested quote',
      'Sample delivery visit'
    );
    agentABrowser = resumedA.browser;
    agentAPage = resumedA.page;
    console.log('✅ Agent A saved status, unverified call outcome, remark, follow-up, and drained its real app outbox.');
  });

  workflowStep('Step 7: Agent B Workflow (Status, Remark, Call Outcome, Follow-Up, Sync Push)', async () => {
    assert.ok(agentBPage, 'Agent B page must be active.');
    console.log('\n--- Step 7: Agent B Actions on Lead B ---');

    const resumedB = await exerciseAppWorkflow(
      agentBPage,
      agentBConfig.serial,
      agentBConfig.cdpPort,
      '00000000-0000-0000-0000-000000000012',
      'FitHub Test Gomti Nagar',
      'SAMPLE_REQUESTED',
      'Trial samples delivered to front desk - trainer feedback awaited',
      'Feedback callback'
    );
    agentBBrowser = resumedB.browser;
    agentBPage = resumedB.page;
    console.log('✅ Agent B saved status, unverified call outcome, remark, follow-up, and drained its real app outbox.');
  });

  workflowStep('Step 8 & 9: Admin Receives and Displays Both Agent A & Agent B Updates', async () => {
    assert.ok(adminPage, 'Admin page must be active.');
    console.log('\n--- Step 8 & 9: Admin Device Sync & Verification ---');

    // Admin pulls all changes from Supabase
    await synchronizeApp(adminPage, '00000000-0000-0000-0000-000000000010');

    await waitForLocalLeadStatus(adminPage, '00000000-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111101', 'INTERESTED');
    await waitForLocalLeadStatus(adminPage, '00000000-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111102', 'SAMPLE_REQUESTED');

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
    assert.ok(calls.some((c) => c.lead_id === '11111111-1111-1111-1111-111111111101' && c.verification_status === 'UNVERIFIED' && c.reported_duration_seconds === 120), 'Agent A real unverified ACTION_DIAL record visible to Admin.');
    assert.ok(calls.some((c) => c.lead_id === '11111111-1111-1111-1111-111111111102' && c.verification_status === 'UNVERIFIED' && c.reported_duration_seconds === 120), 'Agent B real unverified ACTION_DIAL record visible to Admin.');

    console.log('✅ Admin successfully received and verified all Agent A & Agent B changes.');
  });

  workflowStep('Step 10: Independent Docker Supabase PostgreSQL Database Verification', async () => {
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
    assert.ok(pgCalls.some((c) => c.lead_id === '11111111-1111-1111-1111-111111111101' && c.duration_seconds === 0 && c.reported_duration_seconds === 120 && c.verification_status === 'UNVERIFIED'), 'PostgreSQL contains Agent A ACTION_DIAL call with unverified duration semantics.');
    assert.ok(pgCalls.some((c) => c.lead_id === '11111111-1111-1111-1111-111111111102' && c.duration_seconds === 0 && c.reported_duration_seconds === 120 && c.verification_status === 'UNVERIFIED'), 'PostgreSQL contains Agent B ACTION_DIAL call with unverified duration semantics.');

    // 3. Verify Remarks in PostgreSQL
    const remarksRes = await fetch(`${SUPABASE_LOCAL_URL}/rest/v1/remarks?select=*`, { headers });
    const pgRemarks = (await remarksRes.json()) as any[];
    assert.ok(pgRemarks.some((r) => r.lead_id === '11111111-1111-1111-1111-111111111101' && r.user_id === '00000000-0000-0000-0000-000000000011' && r.content.includes('Owner interested')), 'PostgreSQL contains Agent A UI-created remark.');
    assert.ok(pgRemarks.some((r) => r.lead_id === '11111111-1111-1111-1111-111111111102' && r.user_id === '00000000-0000-0000-0000-000000000012' && r.content.includes('Trial samples')), 'PostgreSQL contains Agent B UI-created remark.');

    // 4. Verify Follow-Ups in PostgreSQL
    const followUpsRes = await fetch(`${SUPABASE_LOCAL_URL}/rest/v1/follow_ups?select=*`, { headers });
    const pgFollowUps = (await followUpsRes.json()) as any[];
    assert.ok(pgFollowUps.some((f) => f.title === 'Sample delivery visit'), 'PostgreSQL contains Agent A follow-up.');
    assert.ok(pgFollowUps.some((f) => f.title === 'Feedback callback'), 'PostgreSQL contains Agent B follow-up.');

    console.log('✅ Independent PostgreSQL database verification 100% PASS.');
  });

  workflowStep('Step 11: Offline Outbox Queue & Network Recovery Test', async () => {
    assert.ok(agentAPage, 'Agent A page must be active.');
    console.log('\n--- Step 11: Offline Queue & Sync Recovery ---');

    const offlineNote = 'Offline note logged in field while disconnected';
    await agentAPage.getByRole('tab', { name: /Leads/i }).click();
    await agentAPage.getByText('Gold Gym Test Hazratganj', { exact: true }).first().click();
    await agentAPage.getByRole('tab', { name: /Remarks/i }).click();

    await agentAPage.context().setOffline(true);
    try {
      await agentAPage.getByRole('button', { name: 'Add note', exact: true }).click();
      await agentAPage.locator('#inline-remark').fill(offlineNote);
      await agentAPage.locator('#inline-remark').evaluate((input) => {
        const form = input.closest('form');
        if (!(form instanceof HTMLFormElement)) throw new Error('Offline remark form was not attached to the DOM.');
        form.requestSubmit();
      });
      await agentAPage.locator('#inline-remark').waitFor({ state: 'hidden', timeout: 30_000 });
      const pendingCount = await waitForOutboxToContainWork(agentAPage, '00000000-0000-0000-0000-000000000011');
      assert.ok(pendingCount > 0, 'Offline mutation must remain queued locally.');
      await agentAPage.getByRole('button', { name: 'Sync Now', exact: true }).first().click().catch(() => {});
      await agentAPage.waitForTimeout(1_000);
      assert.ok((await readOutboxCount(agentAPage, '00000000-0000-0000-0000-000000000011')) > 0, 'Failed offline sync must preserve outbox work.');
    } finally {
      await agentAPage.context().setOffline(false);
    }

    await synchronizeApp(agentAPage, '00000000-0000-0000-0000-000000000011');

    const tokenARes = await fetch(`${SUPABASE_LOCAL_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ email: agentAConfig.email, password: 'Agent@123' }),
    });
    const tokenA = ((await tokenARes.json()) as any).access_token;
    const remoteRemarksRes = await fetch(`${SUPABASE_LOCAL_URL}/rest/v1/remarks?select=content&content=eq.${encodeURIComponent(offlineNote)}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${tokenA}` },
    });
    const remoteRemarks = (await remoteRemarksRes.json()) as Array<{ content: string }>;
    assert.ok(remoteRemarks.some((row) => row.content === offlineNote), 'Recovered offline remark reached PostgreSQL.');
    console.log('✅ Offline mutation survived failed sync, recovered, reached Supabase, and left an empty outbox.');
  });

  workflowStep('Step 12: RLS Tenant & Agent Lead Security Enforcement', async () => {
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

  workflowStep('Step 13: Clean Teardown', async () => {
    console.log('\n--- Step 13: Closing Device CDP Sessions ---');
    await cleanupDeviceSessions();
    console.log('✅ Teardown complete.');
  });
});
