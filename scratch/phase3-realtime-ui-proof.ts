import { execFileSync } from 'node:child_process';
import { chromium, type Browser, type Page } from '@playwright/test';

const ADB = 'C:\\Users\\PC\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';
const APP_ID = 'com.amaratvkrishi.salescrm';
const ORG_ID = '00000000-0000-0000-0000-000000000001';
const ADMIN_ID = '00000000-0000-0000-0000-000000000010';
const RAHUL_ID = '00000000-0000-0000-0000-000000000011';
const POOJA_ID = '00000000-0000-0000-0000-000000000012';
const LEAD_ID = '11111111-1111-1111-1111-111111111103';
const LEAD_NAME = 'Iron Paradise Test Alambagh';

interface DeviceSession {
  serial: string;
  port: number;
  userId: string;
  browser: Browser;
  page: Page;
  leadFrames: Array<{ observedAt: string; payload: string }>;
  leadRestGets: number;
}

function adb(serial: string, ...args: string[]): string {
  return execFileSync(ADB, ['-s', serial, ...args], {
    encoding: 'utf8',
    timeout: 120_000,
    windowsHide: true,
  }).trim();
}

async function waitForCdp(port: number): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json`);
      const pages = response.ok ? await response.json() : [];
      if (Array.isArray(pages) && pages.length > 0) return;
    } catch {
      // WebView DevTools starts asynchronously after app launch.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`CDP endpoint ${port} did not become ready`);
}

async function prepare(serial: string, port: number, userId: string): Promise<DeviceSession> {
  adb(serial, 'reverse', 'tcp:15432', 'tcp:15432');
  adb(serial, 'shell', 'pm', 'clear', APP_ID);
  adb(serial, 'shell', 'monkey', '-p', APP_ID, '-c', 'android.intent.category.LAUNCHER', '1');

  let pid = '';
  const pidDeadline = Date.now() + 30_000;
  while (!pid && Date.now() < pidDeadline) {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    try {
      pid = adb(serial, 'shell', 'pidof', APP_ID);
    } catch {
      // Process is still starting.
    }
  }
  if (!pid) throw new Error(`${serial}: CRM PID unavailable`);

  try {
    adb(serial, 'forward', '--remove', `tcp:${port}`);
  } catch {
    // A stale forward is optional.
  }
  adb(serial, 'forward', `tcp:${port}`, `localabstract:webview_devtools_remote_${pid}`);
  await waitForCdp(port);

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const context = browser.contexts()[0];
  const page = context.pages()[0];
  await page.waitForLoadState('domcontentloaded');
  const leadFrames: Array<{ observedAt: string; payload: string }> = [];
  let leadRestGets = 0;
  page.on('websocket', (socket) => {
    socket.on('framereceived', (event) => {
      const payload = String(event.payload);
      if (payload.includes(LEAD_ID)) {
        leadFrames.push({ observedAt: new Date().toISOString(), payload: payload.slice(0, 500) });
      }
    });
  });
  page.on('request', (request) => {
    if (request.method() === 'GET' && /\/rest\/v1\/leads(?:\?|$)/.test(request.url())) leadRestGets++;
  });
  const endpointProof = await page.evaluate(async () => {
    const entry = Array.from(document.scripts)
      .map((script) => script.src)
      .find((source) => /\/assets\/index-[^/]+\.js$/.test(source));
    if (!entry) return { local: false, production: false, entry: null };
    const bundle = await fetch(entry).then((response) => response.text());
    return {
      local: bundle.includes('http://127.0.0.1:15432'),
      production: bundle.includes('lahvcodvgubplzfshare.supabase.co'),
      entry,
    };
  });
  if (!endpointProof.local || endpointProof.production) {
    await browser.close();
    throw new Error(`${serial}: installed bundle is not local-only (${JSON.stringify(endpointProof)})`);
  }
  return {
    serial,
    port,
    userId,
    browser,
    page,
    leadFrames,
    get leadRestGets() {
      return leadRestGets;
    },
    set leadRestGets(value: number) {
      leadRestGets = value;
    },
  };
}

async function login(session: DeviceSession, email: string, password: string, expectedSelector: string): Promise<void> {
  const { page } = session;
  await page.locator('#login-email').waitFor({ state: 'visible', timeout: 60_000 });
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  adb(session.serial, 'shell', 'input', 'keyevent', 'KEYCODE_BACK');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click({ force: true, noWaitAfter: true });
  await page.locator(expectedSelector).waitFor({ state: 'visible', timeout: 90_000 });
}

async function readLocalLead(session: DeviceSession): Promise<Record<string, unknown> | null> {
  const dbName = `AmaratvSalesCRM__${ORG_ID}__${session.userId}`;
  return session.page.evaluate(
    ({ name, leadId }) =>
      new Promise<Record<string, unknown> | null>((resolve, reject) => {
        const open = indexedDB.open(name);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const database = open.result;
          if (!database.objectStoreNames.contains('leads')) {
            database.close();
            resolve(null);
            return;
          }
          const request = database.transaction('leads', 'readonly').objectStore('leads').get(leadId);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            database.close();
            resolve((request.result as Record<string, unknown> | undefined) ?? null);
          };
        };
      }),
    { name: dbName, leadId: LEAD_ID }
  );
}

async function waitForLocalAssignment(
  session: DeviceSession,
  expectedAssignee: string,
  timeoutMs = 60_000
): Promise<{ observedAt: string; lead: Record<string, unknown> }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const lead = await readLocalLead(session);
    if (lead?.assignedTo === expectedAssignee) {
      return { observedAt: new Date().toISOString(), lead };
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${session.serial}: ${LEAD_NAME} was not received with assignee ${expectedAssignee}`);
}

async function openAdminLead(admin: DeviceSession): Promise<void> {
  const { page } = admin;
  await page.locator('#admin-tab-leads').click();
  await page.locator('#admin-leads-search').waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('#admin-leads-search').fill(LEAD_NAME);
  await page.getByText(LEAD_NAME, { exact: true }).waitFor({ state: 'visible', timeout: 30_000 });
}

async function assignThroughUi(admin: DeviceSession, agentName: string): Promise<string> {
  const { page } = admin;
  const action = page.getByRole('button', { name: new RegExp(`^(Assign|Reassign) ${LEAD_NAME}$`) });
  await action.click();
  const modal = page.getByRole('dialog');
  await modal.getByRole('option', { name: new RegExp(agentName) }).click();
  const submit = modal.getByRole('button', { name: /^(Assign Lead|Reassign Lead)$/ });
  await submit.click();
  await modal.waitFor({ state: 'hidden', timeout: 30_000 });
  await page.getByRole('button', { name: 'Sync Now' }).click();
  return new Date().toISOString();
}

async function restoreUnassigned(admin: DeviceSession): Promise<string> {
  const { page } = admin;
  await openAdminLead(admin);
  const action = page.getByRole('button', { name: `Reassign ${LEAD_NAME}` });
  await action.click();
  const modal = page.getByRole('dialog');
  await modal.getByRole('button', { name: 'Unassign', exact: true }).click();
  await modal.waitFor({ state: 'hidden', timeout: 30_000 });
  await page.getByRole('button', { name: 'Sync Now' }).click();
  return new Date().toISOString();
}

const sessions: DeviceSession[] = [];
let admin: DeviceSession | null = null;
let touched = false;

try {
  admin = await prepare('emulator-5554', 19322, ADMIN_ID);
  const agentA = await prepare('emulator-5556', 19323, RAHUL_ID);
  const agentB = await prepare('emulator-5558', 19324, POOJA_ID);
  sessions.push(admin, agentA, agentB);

  await Promise.all([
    login(admin, 'admin@amaratvkrishi.com', 'Admin@123', '#admin-tab-home'),
    login(agentA, 'rahul@amaratvkrishi.com', 'Agent@123', '#app-tab-DASHBOARD'),
    login(agentB, 'pooja@amaratvkrishi.com', 'Agent@123', '#app-tab-DASHBOARD'),
  ]);

  await Promise.all([
    agentA.page.locator('#app-tab-LEADS').click(),
    agentB.page.locator('#app-tab-LEADS').click(),
  ]);
  await Promise.all([
    agentA.page.locator('#leads-search').waitFor({ state: 'visible', timeout: 30_000 }),
    agentB.page.locator('#leads-search').waitFor({ state: 'visible', timeout: 30_000 }),
  ]);

  // Let all three authenticated Realtime channels settle before the admin action.
  await new Promise((resolve) => setTimeout(resolve, 4_000));
  agentA.leadFrames.length = 0;
  agentB.leadFrames.length = 0;
  agentA.leadRestGets = 0;
  agentB.leadRestGets = 0;
  const initialA = await readLocalLead(agentA);
  const initialB = await readLocalLead(agentB);
  if (initialA || initialB) {
    throw new Error('Controlled lead must be absent from both agent caches before assignment');
  }

  await openAdminLead(admin);
  const assignedATimestamp = await assignThroughUi(admin, 'Rahul Verma');
  touched = true;
  const receivedA = await waitForLocalAssignment(agentA, RAHUL_ID);
  const agentAFrames = [...agentA.leadFrames];
  const agentARestGetsAtReceipt = agentA.leadRestGets;
  if (agentAFrames.length === 0 || agentARestGetsAtReceipt !== 0) {
    throw new Error('Agent A receipt lacks isolated Realtime WebSocket evidence');
  }
  const unauthorizedB = await readLocalLead(agentB);
  if (unauthorizedB) throw new Error('Agent B received Agent A assignment');

  const assignedBTimestamp = await assignThroughUi(admin, 'Pooja Sharma');
  const receivedB = await waitForLocalAssignment(agentB, POOJA_ID);
  const agentBFrames = [...agentB.leadFrames];
  const agentBRestGetsAtReceipt = agentB.leadRestGets;
  if (agentBFrames.length === 0 || agentBRestGetsAtReceipt !== 0) {
    throw new Error('Agent B receipt lacks isolated Realtime WebSocket evidence');
  }

  // Agent A should not retain a row after it is reassigned out of its scope.
  const revokeDeadline = Date.now() + 90_000;
  let revokedA: Record<string, unknown> | null = await readLocalLead(agentA);
  while (revokedA && Date.now() < revokeDeadline) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    revokedA = await readLocalLead(agentA);
  }
  const agentARevokedAfterReassignment = revokedA === null;

  const restoredAt = await restoreUnassigned(admin);
  touched = false;

  console.log(
    JSON.stringify(
      {
        result: agentARevokedAfterReassignment ? 'PASS' : 'PARTIAL',
        leadId: LEAD_ID,
        leadName: LEAD_NAME,
        adminDevice: admin.serial,
        agentADevice: agentA.serial,
        agentBDevice: agentB.serial,
        initialAgentA: initialA,
        initialAgentB: initialB,
        adminAssignedAgentAAt: assignedATimestamp,
        agentAReceivedAt: receivedA.observedAt,
        agentALatencyMs: Date.parse(receivedA.observedAt) - Date.parse(assignedATimestamp),
        agentARealtimeFrames: agentAFrames,
        agentARestLeadGetsAtReceipt: agentARestGetsAtReceipt,
        unauthorizedAgentBAfterAgentAAssignment: unauthorizedB,
        adminReassignedAgentBAt: assignedBTimestamp,
        agentBReceivedAt: receivedB.observedAt,
        agentBLatencyMs: Date.parse(receivedB.observedAt) - Date.parse(assignedBTimestamp),
        agentBRealtimeFrames: agentBFrames,
        agentBRestLeadGetsAtReceipt: agentBRestGetsAtReceipt,
        agentARevokedAfterReassignment,
        restoredUnassignedThroughUiAt: restoredAt,
      },
      null,
      2
    )
  );
} finally {
  if (touched && admin) {
    try {
      const restoredAt = await restoreUnassigned(admin);
      console.error(`Recovery: controlled lead restored to unassigned through UI at ${restoredAt}`);
    } catch (error) {
      console.error('Recovery failed; controlled lead may still be assigned:', error);
    }
  }
  await Promise.all(sessions.map((session) => session.browser.close().catch(() => undefined)));
}
