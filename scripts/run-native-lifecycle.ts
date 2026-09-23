import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium, type Browser, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { resolveAndroidSdkPath } from './android-sdk';
import { runProcessWithWatchdog } from './process-watchdog';
import { getLocalSupabaseEnv, type LocalSupabaseEnv } from '../tests/helpers/localSupabaseEnv';

const APP_PACKAGE = 'com.amaratvkrishi.salescrm';
const REPO_ROOT = process.cwd();
const APK = join(REPO_ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const CDP_PORT = 19322;
const AGENT_EMAIL = process.env.SUPABASE_TEST_AGENT_EMAIL || 'rahul@amaratvkrishi.com';
const AGENT_PASSWORD = process.env.SUPABASE_TEST_AGENT_PASSWORD || 'Agent@123';
const WATCHDOG_LOG = join(REPO_ROOT, 'test-results', 'native-lifecycle-watchdog.log');
const ARTIFACT = join(REPO_ROOT, 'test-results', 'native-lifecycle-android-2026-09-16.json');

type StepStatus = 'PASSED' | 'FAILED';
interface LifecycleStep {
  name: string;
  status: StepStatus;
  durationMs: number;
  detail?: string;
}

function adbPath(): string {
  const sdk = resolveAndroidSdkPath();
  const executable = join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
  if (!existsSync(executable)) throw new Error(`ADB executable was not found at ${executable}.`);
  return executable;
}

async function adb(device: string, args: string[], label: string, timeoutMs = 30_000): Promise<string> {
  const result = await runProcessWithWatchdog({
    label,
    command: adbPath(),
    args: ['-s', device, ...args],
    cwd: REPO_ROOT,
    env: process.env,
    timeoutMs,
    logFile: WATCHDOG_LOG,
  });
  if (result.status !== 'PASSED') {
    throw new Error(`${label} ${result.status}: ${result.reason ?? 'ADB operation failed'}\n${result.stdout}${result.stderr}`);
  }
  return result.stdout;
}

async function firstEmulator(): Promise<string> {
  const output = await runProcessWithWatchdog({
    label: 'Native lifecycle: ADB device probe',
    command: adbPath(),
    args: ['devices'],
    cwd: REPO_ROOT,
    env: process.env,
    timeoutMs: 30_000,
    logFile: WATCHDOG_LOG,
  });
  if (output.status !== 'PASSED') throw new Error(`INFRASTRUCTURE_LIMITATION: ADB device probe ${output.status}: ${output.reason ?? 'failed'}`);
  const device = output.stdout.split(/\r?\n/)
    .map(line => line.trim().match(/^(emulator-\S+)\s+device$/)?.[1])
    .find(Boolean);
  if (!device) throw new Error('INFRASTRUCTURE_LIMITATION: no booted Android emulator was detected.');
  return device;
}

async function waitForPid(device: string, timeoutMs = 60_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let last = '';
  while (Date.now() < deadline) {
    try {
      last = (await adb(device, ['shell', 'pidof', APP_PACKAGE], 'Native lifecycle: inspect app PID')).trim();
    } catch {
      // Android's pidof exits 1 while the package is not yet running. Keep
      // polling until the bounded startup deadline instead of failing early.
      last = '';
    }
    if (last) return last;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`App process did not start within ${timeoutMs}ms; last PID output was ${last || '<empty>'}.`);
}

async function waitForCdp(port: number, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'no DevTools response';
  while (Date.now() < deadline) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2_000);
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json`, { signal: controller.signal });
        if (response.ok && Array.isArray(await response.json())) return;
        lastError = `HTTP ${response.status}`;
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`WebView CDP did not become ready within ${timeoutMs}ms: ${lastError}.`);
}

async function connectWebView(device: string): Promise<{ browser: Browser; page: Page; pid: string }> {
  const pid = await waitForPid(device);
  await adb(device, ['forward', '--remove', `tcp:${CDP_PORT}`], 'Native lifecycle: clear owned CDP forward').catch(() => {});
  await adb(
    device,
    ['forward', `tcp:${CDP_PORT}`, `localabstract:webview_devtools_remote_${pid}`],
    'Native lifecycle: create owned CDP forward',
  );
  await waitForCdp(CDP_PORT);
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`, { timeout: 45_000 });
  const context = browser.contexts()[0];
  const page = context?.pages()[0];
  if (!page) {
    await browser.close().catch(() => {});
    throw new Error('WebView CDP connected without a page target.');
  }
  await page.waitForLoadState('domcontentloaded', { timeout: 60_000 });
  return { browser, page, pid };
}

async function launchAndConnect(device: string): Promise<{ browser: Browser; page: Page; pid: string }> {
  await adb(device, ['shell', 'am', 'start', '-n', `${APP_PACKAGE}/.MainActivity`], 'Native lifecycle: launch MainActivity');
  return connectWebView(device);
}

async function ensureReverse(device: string): Promise<boolean> {
  const existing = await adb(device, ['reverse', '--list'], 'Native lifecycle: inspect reverse mappings');
  if (existing.split(/\r?\n/).some(line => line.includes('tcp:15432 tcp:15432'))) return false;
  await adb(device, ['reverse', 'tcp:15432', 'tcp:15432'], 'Native lifecycle: create owned Supabase reverse mapping');
  return true;
}

async function removeReverse(device: string, owned: boolean): Promise<void> {
  if (!owned) return;
  await adb(device, ['reverse', '--remove', 'tcp:15432'], 'Native lifecycle cleanup: remove owned Supabase reverse mapping').catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
  });
}

async function setAirplaneMode(device: string, enabled: boolean): Promise<void> {
  await adb(
    device,
    ['shell', 'cmd', 'connectivity', 'airplane-mode', enabled ? 'enable' : 'disable'],
    `Native lifecycle: ${enabled ? 'enable' : 'disable'} Android airplane mode`,
  );
  const state = (await adb(device, ['shell', 'settings', 'get', 'global', 'airplane_mode_on'], 'Native lifecycle: verify airplane mode state')).trim();
  const expected = enabled ? '1' : '0';
  if (state !== expected) throw new Error(`Android airplane mode state was ${state || '<empty>'}; expected ${expected}.`);
}

async function waitForApiFromPage(page: Page, apiUrl: string, anonKey: string): Promise<void> {
  const deadline = Date.now() + 60_000;
  let last = 'no response';
  while (Date.now() < deadline) {
    try {
      const status = await page.evaluate(async ({ url, key }) => {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 5_000);
        try {
          return (await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, signal: controller.signal })).status;
        } finally {
          window.clearTimeout(timer);
        }
      }, { url: apiUrl, key: anonKey });
      if (status === 200) return;
      last = `HTTP ${status}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await page.waitForTimeout(500);
  }
  throw new Error(`Local Supabase auth endpoint was not reachable from the Android WebView: ${last}.`);
}

async function fillLoginField(page: Page, selector: string, value: string): Promise<void> {
  const field = page.locator(selector);
  await field.waitFor({ state: 'visible', timeout: 60_000 });
  try {
    await field.fill(value, { timeout: 15_000 });
    return;
  } catch (error) {
    const enabled = await field.isEnabled().catch(() => false);
    if (!enabled) throw error;
    // Capacitor/WebView can report a visible input as unstable while the
    // resumed renderer is settling. Use React-compatible native setters as a
    // bounded fallback, preserving the real form event path.
    await field.evaluate((element, nextValue) => {
      const input = element as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, nextValue);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  }
}

async function authStorageSummary(page: Page): Promise<{ localStorageKeys: string[]; sessionStorageKeys: string[] }> {
  return page.evaluate(() => ({
    localStorageKeys: Object.keys(localStorage).filter(key => /supabase|auth|session/i.test(key)),
    sessionStorageKeys: Object.keys(sessionStorage).filter(key => /supabase|auth|session/i.test(key)),
  })).catch(() => ({ localStorageKeys: [], sessionStorageKeys: [] }));
}

async function login(device: string, initial: { browser: Browser; page: Page; pid: string }, env: LocalSupabaseEnv): Promise<{ browser: Browser; page: Page; pid: string }> {
  let page = initial.page;
  await page.locator('#login-email').waitFor({ state: 'visible', timeout: 60_000 });
  await waitForApiFromPage(page, env.apiUrl, env.anonKey);
  await fillLoginField(page, '#login-email', AGENT_EMAIL);
  await fillLoginField(page, '#login-password', AGENT_PASSWORD);
  const [response] = await Promise.all([
    page.waitForResponse(candidate => candidate.request().method() === 'POST' && candidate.url().includes('/auth/v1/token?grant_type=password'), { timeout: 45_000 }),
    page.getByRole('button', { name: 'Sign In', exact: true }).click({ noWaitAfter: true }),
  ]);
  if (response.status() !== 200) {
    const responseBody = await response.text().catch(() => '');
    throw new Error(`Agent login returned HTTP ${response.status()}${responseBody ? `: ${responseBody.slice(0, 300)}` : '.'}`);
  }
  try {
    // The dashboard heading is rendered with responsive/role-adjacent text in
    // the Capacitor shell; the established multi-device test intentionally
    // uses a non-exact text match here.
    await page.getByText('Field Sales Dashboard').first().waitFor({ state: 'visible', timeout: 90_000 });
    return { browser: page.context().browser()!, page, pid: initial.pid };
  } catch (error) {
    if (String(error).includes('Target page, context or browser has been closed')) {
      const reconnected = await connectWebView(device);
      page = reconnected.page;
      await page.getByText('Field Sales Dashboard').first().waitFor({ state: 'visible', timeout: 90_000 });
      return reconnected;
    }
    const body = await page.locator('body').innerText().catch(() => '<body unavailable>');
    throw new Error(`CRM dashboard did not load after HTTP 200 login: ${error instanceof Error ? error.message : String(error)}; body=${body.slice(0, 600)}`);
  }
}

async function openLeadsTab(page: Page): Promise<void> {
  const leads = page.getByRole('tab', { name: /Leads/i }).first();
  await leads.waitFor({ state: 'visible', timeout: 60_000 });
  try {
    await leads.click({ timeout: 15_000 });
  } catch {
    // A resumed Capacitor WebView can keep the tab in a transiently unstable
    // layout while its local sync finishes. Re-check visibility, then use a
    // DOM-level click only after the bounded action timeout has elapsed.
    await leads.waitFor({ state: 'visible', timeout: 30_000 });
    await leads.evaluate((element) => (element as HTMLElement).click());
  }
}

async function openRemarkEditor(device: string, businessName: string, currentBrowser: Browser | null): Promise<{ browser: Browser; page: Page }> {
  let activeBrowser = currentBrowser;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const connected = activeBrowser?.isConnected() && activeBrowser.contexts()[0]?.pages()[0]
        ? { browser: activeBrowser, page: activeBrowser.contexts()[0].pages()[0] }
        : await connectWebView(device);
      activeBrowser = connected.browser;
      const page = connected.page;
      await page.getByText(businessName, { exact: true }).waitFor({ state: 'visible', timeout: 60_000 });
      await page.getByText(businessName, { exact: true }).click();
      await page.getByRole('tab', { name: /Remarks/i }).click();
      await page.getByRole('button', { name: 'Add note', exact: true }).click();
      await page.locator('#inline-remark').waitFor({ state: 'visible', timeout: 30_000 });
      return { browser: connected.browser, page };
    } catch (error) {
      if (attempt === 1 || !String(error).includes('Target page, context or browser has been closed')) throw error;
      await activeBrowser?.close().catch(() => {});
      activeBrowser = null;
    }
  }
  throw new Error('Unable to attach to Android WebView remark editor');
}

async function readLocalState(page: Page, dbName: string, businessName: string): Promise<{ lead: any; outboxCount: number }> {
  return page.evaluate(async ({ name, target }) => new Promise<{ lead: any; outboxCount: number }>((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('leads') || !db.objectStoreNames.contains('outbox')) {
        db.close();
        resolve({ lead: null, outboxCount: -1 });
        return;
      }
      const transaction = db.transaction(['leads', 'outbox'], 'readonly');
      const leadsRequest = transaction.objectStore('leads').getAll();
      const countRequest = transaction.objectStore('outbox').count();
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => {
        const lead = (leadsRequest.result as any[]).find(row => row.businessName === target) ?? null;
        db.close();
        resolve({ lead, outboxCount: countRequest.result });
      };
    };
  }), { name: dbName, target: businessName });
}

async function waitForLocalLead(page: Page, dbName: string, businessName: string, timeoutMs = 90_000): Promise<{ lead: any; outboxCount: number }> {
  const deadline = Date.now() + timeoutMs;
  let state = { lead: null, outboxCount: -1 };
  while (Date.now() < deadline) {
    state = await readLocalState(page, dbName, businessName);
    if (state.lead) return state;
    await page.waitForTimeout(500);
  }
  throw new Error(`Android local IndexedDB did not contain ${businessName}; last outbox count ${state.outboxCount}.`);
}

async function syncUntilDrained(page: Page, dbName: string, businessName: string, timeoutMs = 90_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let last = -1;
  while (Date.now() < deadline) {
    const state = await readLocalState(page, dbName, businessName);
    last = state.outboxCount;
    if (last === 0) return;
    const button = page.locator('button[title="Sync Now"]').first();
    if (await button.isEnabled().catch(() => false)) await button.click().catch(() => {});
    await page.waitForTimeout(500);
  }
  throw new Error(`Android outbox did not drain within ${timeoutMs}ms; last count ${last}.`);
}

async function runStep<T>(steps: LifecycleStep[], name: string, action: () => Promise<T>): Promise<T> {
  const started = Date.now();
  try {
    const detail = await action();
    const serializedDetail = typeof detail === 'string'
      ? detail
      : detail == null
        ? undefined
        : JSON.stringify(detail);
    steps.push({ name, status: 'PASSED', durationMs: Date.now() - started, detail: serializedDetail });
    return detail;
  } catch (error) {
    steps.push({ name, status: 'FAILED', durationMs: Date.now() - started, detail: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

async function main(): Promise<void> {
  mkdirSync(join(REPO_ROOT, 'test-results'), { recursive: true });
  const steps: LifecycleStep[] = [];
  const startedAt = new Date().toISOString();
  const env = getLocalSupabaseEnv();
  const service: SupabaseClient = createClient(env.apiUrl, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const device = process.env.NATIVE_LIFECYCLE_DEVICE || await runStep(steps, 'Select one booted emulator', firstEmulator) as string;
  const dbInfo = await service.from('profiles').select('id, organization_id').eq('email', AGENT_EMAIL).eq('status', 'ACTIVE').single();
  if (dbInfo.error || !dbInfo.data) throw new Error(`Local Supabase agent profile lookup failed: ${dbInfo.error?.message || 'missing profile'}.`);
  const userId = dbInfo.data.id as string;
  const organizationId = dbInfo.data.organization_id as string;
  const businessName = `Native lifecycle ${randomUUID().slice(0, 8)}`;
  const offlineRemark = `Native airplane-mode remark ${randomUUID().slice(0, 8)}`;
  const leadId = randomUUID();
  let browser: Browser | null = null;
  let reverseOwned = false;
  let reverseRemovedForOffline = false;
  let airplaneEnabled = false;
  let success = false;
  let backendLeadVerified = false;
  let backendRemarkVerified = false;

  try {
    if (!existsSync(APK)) throw new Error(`INFRASTRUCTURE_LIMITATION: local debug APK was not found at ${APK}.`);
    await runStep(steps, 'Create disposable local Supabase lead fixture', async () => {
      const inserted = await service.from('leads').insert({
        id: leadId,
        organization_id: organizationId,
        business_name: businessName,
        category: 'Gym',
        phone: '9876543210',
        address: 'Native lifecycle test address',
        locality: 'Alambagh',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        pincode: '226005',
        created_by: userId,
        assigned_to: userId,
        source: 'NATIVE_LIFECYCLE_TEST',
      });
      if (inserted.error) throw new Error(inserted.error.message);
    });
    await runStep(steps, 'Verify fixture exists in local PostgreSQL', async () => {
      const result = await service.from('leads').select('id, business_name, organization_id').eq('id', leadId).single();
      if (result.error || result.data?.business_name !== businessName) throw new Error(result.error?.message || 'fixture was not persisted');
      backendLeadVerified = true;
    });
    reverseOwned = await runStep(steps, 'Create owned local Supabase reverse mapping', () => ensureReverse(device)) as boolean;
    await runStep(steps, 'Clear app storage and launch native MainActivity', async () => {
      await adb(device, ['shell', 'am', 'force-stop', APP_PACKAGE], 'Native lifecycle: initial exact app force-stop');
      // Package-manager cleanup can exceed the ordinary ADB command budget on
      // a busy disposable emulator. Keep it bounded, but do not classify a
      // slow cleanup as an app lifecycle failure after only 30 seconds.
      await adb(device, ['shell', 'pm', 'clear', APP_PACKAGE], 'Native lifecycle: clear disposable app storage', 90_000);
      await adb(device, ['shell', 'am', 'start', '-n', `${APP_PACKAGE}/.MainActivity`], 'Native lifecycle: initial MainActivity launch');
    });
    const initial = await runStep(steps, 'Login and load CRM data on Android', async () => {
      let connected = await connectWebView(device);
      browser = connected.browser;
      connected = await login(device, connected, env);
      browser = connected.browser;
      await openLeadsTab(connected.page);
      const sync = connected.page.locator('button[title="Sync Now"]').first();
      if (await sync.isEnabled().catch(() => false)) await sync.click().catch(() => {});
      const dbName = `AmaratvSalesCRM__${organizationId}__${userId}`;
      await connected.page.getByText(businessName, { exact: true }).waitFor({ state: 'visible', timeout: 90_000 });
      const state = await waitForLocalLead(connected.page, dbName, businessName);
      if (!state.lead) throw new Error('lead was not written to Android IndexedDB');
      return JSON.stringify({
        pid: connected.pid,
        localSynced: state.lead.isSynced,
        outboxCount: state.outboxCount,
        authStorage: await authStorageSummary(connected.page),
      });
    }) as string;
    const dbName = `AmaratvSalesCRM__${organizationId}__${userId}`;

    await runStep(steps, 'Background and resume app', async () => {
      await adb(device, ['shell', 'input', 'keyevent', '3'], 'Native lifecycle: send Home key');
      await new Promise(resolve => setTimeout(resolve, 2_000));
      const resumed = await launchAndConnect(device);
      browser = resumed.browser;
      if (await resumed.page.locator('#login-email').count()) {
        const storage = await authStorageSummary(resumed.page);
        const body = (await resumed.page.locator('body').innerText().catch(() => '<body unavailable>')).slice(0, 500);
        throw new Error(`background/resume returned to login; authStorage=${JSON.stringify(storage)}; body=${body}`);
      }
      await openLeadsTab(resumed.page);
      await resumed.page.getByText(businessName, { exact: true }).waitFor({ state: 'visible', timeout: 60_000 });
    });

    await runStep(steps, 'Force-stop exact app process and verify it is gone', async () => {
      await adb(device, ['shell', 'am', 'force-stop', APP_PACKAGE], 'Native lifecycle: exact app process force-stop');
      await browser?.close().catch(() => {});
      browser = null;
      let pidAfterKill = '';
      try {
        pidAfterKill = (await adb(device, ['shell', 'pidof', APP_PACKAGE], 'Native lifecycle: verify exact app process stopped')).trim();
      } catch {
        // pidof exits 1 when the exact package has no process, which is the
        // expected result of the force-stop assertion.
        pidAfterKill = '';
      }
      if (pidAfterKill) throw new Error(`app PID remained after force-stop: ${pidAfterKill}`);
    });

    await runStep(steps, 'Restart app and prove session plus local state persisted', async () => {
      let restarted = await launchAndConnect(device);
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          browser = restarted.browser;
          const page = restarted.page;
          if (await page.locator('#login-email').count()) throw new Error('restart returned to login instead of restoring the local session');
          await openLeadsTab(page);
          await page.getByText(businessName, { exact: true }).waitFor({ state: 'visible', timeout: 60_000 });
          const state = await readLocalState(page, dbName, businessName);
          if (!state.lead) throw new Error('restarted app could not read the persisted IndexedDB lead');
          return JSON.stringify({ pid: restarted.pid, localLeadId: state.lead.id, outboxCount: state.outboxCount });
        } catch (error) {
          if (attempt === 1 || !String(error).includes('Target page, context or browser has been closed')) throw error;
          await restarted.browser.close().catch(() => {});
          restarted = await connectWebView(device);
        }
      }
      throw new Error('Unable to verify the restarted Android WebView session');
    });

    await runStep(steps, 'Disable native transport and queue an offline mutation', async () => {
      // The Android WebView may recycle its CDP target after a force-stop
      // restart while the native activity itself remains alive. Reattach to
      // the current activity before beginning the offline mutation.
      if (!browser?.isConnected() || !browser.contexts()[0]?.pages()[0]) {
        const reconnected = await connectWebView(device);
        browser = reconnected.browser;
      }
      const remarkEditor = await openRemarkEditor(device, businessName, browser);
      browser = remarkEditor.browser;
      const page = remarkEditor.page;
      await page.locator('#inline-remark').fill(offlineRemark);
      await setAirplaneMode(device, true);
      airplaneEnabled = true;
      if (reverseOwned) {
        await removeReverse(device, true);
        reverseOwned = false;
        reverseRemovedForOffline = true;
      }
      const nativeOnline = await page.evaluate(() => navigator.onLine).catch(() => null);
      await page.locator('#inline-remark').evaluate(input => {
        const form = input.closest('form');
        if (!(form instanceof HTMLFormElement)) throw new Error('offline remark form was not attached');
        form.requestSubmit();
      });
      await page.locator('#inline-remark').waitFor({ state: 'hidden', timeout: 30_000 });
      const state = await waitForLocalLead(page, dbName, businessName);
      if (state.outboxCount <= 0) throw new Error(`offline mutation did not remain queued; outbox count ${state.outboxCount}`);
      return JSON.stringify({ airplaneMode: true, reverseDetached: reverseRemovedForOffline, navigatorOnline: nativeOnline, outboxCount: state.outboxCount });
    });

    await runStep(steps, 'Restore native network, reconnect, and drain the outbox', async () => {
      if (reverseRemovedForOffline) {
        reverseOwned = await ensureReverse(device);
        reverseRemovedForOffline = false;
      }
      await setAirplaneMode(device, false);
      airplaneEnabled = false;
      // Toggling the emulator transport can recycle the WebView target. The
      // browser handle may remain allocated while its page is already closed,
      // so reconnect before touching the page used for the drain.
      const currentPage = browser?.contexts()[0]?.pages()[0];
      if (!browser?.isConnected() || !currentPage || currentPage.isClosed()) {
        const reconnected = await connectWebView(device);
        browser = reconnected.browser;
      }
      const page = browser.contexts()[0].pages()[0];
      await page.waitForTimeout(2_000);
      await syncUntilDrained(page, dbName, businessName);
      const state = await readLocalState(page, dbName, businessName);
      if (state.outboxCount !== 0) throw new Error(`outbox remained after reconnect: ${state.outboxCount}`);
    });

    await runStep(steps, 'Independently verify offline mutation in PostgreSQL', async () => {
      const deadline = Date.now() + 60_000;
      let result: { data: any[] | null; error: any } = { data: null, error: null };
      while (Date.now() < deadline) {
        result = await service.from('remarks').select('id, lead_id, content').eq('lead_id', leadId).eq('content', offlineRemark);
        if (!result.error && result.data?.some(row => row.content === offlineRemark)) {
          backendRemarkVerified = true;
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      throw new Error(result.error?.message || 'offline remark was not persisted in local PostgreSQL');
    });
    success = backendLeadVerified && backendRemarkVerified;
    console.log(`Native lifecycle PASSED on ${device}; initial=${initial}`);
  } catch (error) {
    console.error(`Native lifecycle ${String(error instanceof Error ? error.message : error)}`);
    if (!(error instanceof Error && error.message.includes('INFRASTRUCTURE_LIMITATION'))) {
      process.exitCode = 1;
    } else {
      process.exitCode = 2;
    }
  } finally {
    if (airplaneEnabled) await setAirplaneMode(device, false).catch(error => console.error(error));
    if (reverseRemovedForOffline) {
      reverseOwned = await ensureReverse(device).catch(error => {
        console.error(error);
        return false;
      });
    }
    const activeBrowser = browser as Browser | null;
    if (activeBrowser) await activeBrowser.close().catch(() => {});
    await adb(device, ['forward', '--remove', `tcp:${CDP_PORT}`], 'Native lifecycle cleanup: remove owned CDP forward').catch(() => {});
    await removeReverse(device, reverseOwned);
    try { await service.from('remarks').delete().eq('lead_id', leadId); } catch {}
    try { await service.from('activities').delete().eq('lead_id', leadId); } catch {}
    try { await service.from('leads').delete().eq('id', leadId); } catch {}
    const artifact = {
      generatedAt: new Date().toISOString(),
      startedAt,
      profile: 'native-lifecycle-android',
      environment: 'disposable local Supabase/PostgreSQL; one Android emulator; no production data',
      device,
      appPackage: APP_PACKAGE,
      status: success ? 'PASSED' : 'FAILED',
      backendLeadVerified,
      backendRemarkVerified,
      steps,
      watchdogLog: WATCHDOG_LOG,
    };
    writeFileSync(ARTIFACT, JSON.stringify(artifact, null, 2), 'utf8');
  }
}

main().catch(error => {
  console.error(`INFRASTRUCTURE_LIMITATION: native lifecycle runner failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
});
