import { test, expect, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import { readFile } from 'node:fs/promises';
import {
  cleanupLocalSupabase,
  setupLocalSupabase,
  type LocalSupabaseContext,
} from '../tests/integration/local-supabase';

const realSupabaseEnabled = process.env.PLAYWRIGHT_REAL_SUPABASE === '1';
const testEmail = `playwright-${crypto.randomUUID()}@example.test`;
const testPassword = `Pw-${crypto.randomUUID()}-A9!`;
const testBusinessName = `Playwright Real CRM ${crypto.randomUUID().slice(0, 8)}`;
const testPhone = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
const updatedBusinessName = `${testBusinessName} Updated`;
const visualUpdatedBusinessName = `${updatedBusinessName} Visual`;
const remarkText = `Real browser remark ${crypto.randomUUID().slice(0, 8)}`;
const followUpTitle = `Real browser follow-up ${crypto.randomUUID().slice(0, 8)}`;
const importBusinessName = `Real browser imported ${crypto.randomUUID().slice(0, 8)}`;
const importPhone = `8${Math.floor(100000000 + Math.random() * 900000000)}`;
const importFileName = `real-browser-import-${crypto.randomUUID().slice(0, 8)}.csv`;
const xlsxImportBusinessName = `Real browser XLSX ${crypto.randomUUID().slice(0, 8)}`;
const xlsxImportPhone = `7${Math.floor(100000000 + Math.random() * 900000000)}`;
const xlsxImportFileName = `real-browser-import-${crypto.randomUUID().slice(0, 8)}.xlsx`;
const archivePrimaryBusinessName = `Real browser archive primary ${crypto.randomUUID().slice(0, 8)}`;
const archiveDuplicateBusinessName = `Real browser archive duplicate ${crypto.randomUUID().slice(0, 8)}`;
const archivePhone = `6${Math.floor(100000000 + Math.random() * 900000000)}`;

test.describe('CRM real browser to Supabase state transitions', () => {
  test.skip(!realSupabaseEnabled, 'Run with npm run test:e2e:real so this suite cannot use mocked credentials.');
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  let local: LocalSupabaseContext;
  let testAuthUserId: string | null = null;
  let testProfileId: string | null = null;
  let testLeadId: string | null = null;
  let importedLeadId: string | null = null;
  let xlsxImportedLeadId: string | null = null;
  let archivePrimaryLeadId: string | null = null;
  let archiveDuplicateLeadId: string | null = null;
  let archiveTargetLeadId: string | null = null;

  test.beforeAll(async () => {
    local = await setupLocalSupabase();

    const { data: authUser, error: authError } = await local.service.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (authError || !authUser.user) {
      throw new Error('Unable to create the isolated local Supabase browser test account.');
    }
    testAuthUserId = authUser.user.id;

    const { data: profile, error: profileError } = await local.service
      .from('profiles')
      .insert({
        auth_user_id: testAuthUserId,
        organization_id: local.organizationId,
        name: 'Playwright Real CRM Agent',
        email: testEmail,
        phone: '',
        role: 'AGENT',
        status: 'ACTIVE',
        created_by: local.adminProfileId,
      })
      .select('id')
      .single();
    if (profileError || !profile) {
      throw new Error('Unable to create the isolated local Supabase browser test profile.');
    }
    testProfileId = profile.id;
  });

  test.afterAll(async () => {
    if (!local) return;
    const cleanupLeadIds = Array.from(new Set([
      testLeadId,
      importedLeadId,
      xlsxImportedLeadId,
      archivePrimaryLeadId,
      archiveDuplicateLeadId,
    ].filter((id): id is string => Boolean(id))));
    for (const leadId of cleanupLeadIds) {
      await local.service.from('call_records').delete().eq('lead_id', leadId);
      await local.service.from('follow_ups').delete().eq('lead_id', leadId);
      await local.service.from('remarks').delete().eq('lead_id', leadId);
      await local.service.from('message_history').delete().eq('lead_id', leadId);
      await local.service.from('activities').delete().eq('lead_id', leadId);
      await local.service.from('leads').delete().eq('id', leadId);
    }
    await local.service.from('import_audits').delete().eq('filename', importFileName);
    await local.service.from('import_audits').delete().eq('filename', xlsxImportFileName);
    if (testProfileId) {
      await local.service.from('profiles').delete().eq('id', testProfileId);
    }
    if (testAuthUserId) {
      await local.service.auth.admin.deleteUser(testAuthUserId);
    }
    await cleanupLocalSupabase(local);
  });

  async function clearBrowserState(page: Page): Promise<void> {
    await page.goto('/', { timeout: 120_000 });
    await page.evaluate(async () => {
      localStorage.clear();
      sessionStorage.clear();
      if (window.indexedDB?.databases) {
        const databases = await window.indexedDB.databases();
        await Promise.all(databases.flatMap((database) => (
          database.name ? [new Promise<void>((resolve) => {
            const request = window.indexedDB.deleteDatabase(database.name!);
            request.onsuccess = request.onerror = request.onblocked = () => resolve();
          })] : []
        )));
      }
    });
    // Delete the app's scoped IndexedDB while the page is mounted, then leave
    // the origin before reopening it. Reloading the live Dexie connection can
    // be aborted by Chromium while the database-close event is still settling.
    await page.goto('about:blank', { waitUntil: 'commit' });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  }

  async function localLeadState(page: Page, leadId: string) {
    return page.evaluate(async (id) => {
      const data = (window as unknown as {
        __crmData?: {
          db: {
            leads: { get: (key: string) => Promise<unknown> };
            outbox: { where: (index: string) => { equals: (value: string) => { toArray: () => Promise<unknown[]> } } };
          };
        };
      }).__crmData;
      if (!data) throw new Error('The development CRM data seam is unavailable.');
      const [lead, outbox] = await Promise.all([
        data.db.leads.get(id),
        data.db.outbox.where('entityId').equals(id).toArray(),
      ]);
      return { lead, outbox };
    }, leadId);
  }

  async function triggerSync(page: Page) {
    return page.evaluate(async () => {
      const data = (window as unknown as {
        __crmData?: { syncEngine?: { synchronizeNow: () => Promise<unknown> } };
      }).__crmData;
      if (!data?.syncEngine) throw new Error('The development sync seam is unavailable.');
      return data.syncEngine.synchronizeNow();
    });
  }

  async function waitForSyncSettled(page: Page) {
    return page.evaluate(async () => {
      const data = (window as unknown as {
        __crmData?: { syncEngine?: { getSyncState: () => Promise<{ status: string; lastSyncError: string | null }> } };
      }).__crmData;
      if (!data?.syncEngine) throw new Error('The development sync seam is unavailable.');
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const state = await data.syncEngine.getSyncState();
        if (state.status !== 'SYNCING') return state;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      return data.syncEngine.getSyncState();
    });
  }

  async function triggerSyncWhenAvailable(page: Page) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const result = await triggerSync(page) as any;
      if (result.error !== 'Sync already in progress') return result;
      await page.waitForTimeout(250);
    }
    throw new Error('The browser sync engine remained busy after reconnect.');
  }

  async function ensureTestLeadFixture(): Promise<void> {
    if (testLeadId) return;
    const { data, error } = await local.service
      .from('leads')
      .insert({
        organization_id: local.organizationId,
        business_name: updatedBusinessName,
        category: 'Gym',
        phone: testPhone,
        address: 'Gomti Nagar, Lucknow',
        locality: 'Gomti Nagar',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        created_by: testProfileId,
        assigned_to: testProfileId,
      })
      .select('id')
      .single();
    if (error || !data) throw new Error('Unable to create the isolated real-browser lead fixture.');
    testLeadId = data.id;
  }

  async function ensureArchiveFixture(): Promise<void> {
    if (archivePrimaryLeadId && archiveDuplicateLeadId) return;
    const { data, error } = await local.service
      .from('leads')
      .insert([
        {
          organization_id: local.organizationId,
          business_name: archivePrimaryBusinessName,
          category: 'Gym',
          phone: archivePhone,
          address: 'Hazratganj, Lucknow',
          locality: 'Hazratganj',
          city: 'Lucknow',
          state: 'Uttar Pradesh',
          created_by: local.adminProfileId,
          assigned_to: testProfileId,
        },
        {
          organization_id: local.organizationId,
          business_name: archiveDuplicateBusinessName,
          category: 'Gym',
          phone: archivePhone,
          address: 'Hazratganj, Lucknow',
          locality: 'Hazratganj',
          city: 'Lucknow',
          state: 'Uttar Pradesh',
          created_by: local.adminProfileId,
          assigned_to: testProfileId,
        },
      ])
      .select('id, business_name');
    if (error || !data || data.length !== 2) {
      throw new Error('Unable to create the isolated duplicate archive fixture.');
    }
    archivePrimaryLeadId = data.find((lead) => lead.business_name === archivePrimaryBusinessName)?.id ?? null;
    archiveDuplicateLeadId = data.find((lead) => lead.business_name === archiveDuplicateBusinessName)?.id ?? null;
    if (!archivePrimaryLeadId || !archiveDuplicateLeadId) {
      throw new Error('The duplicate archive fixture returned unexpected lead identities.');
    }
  }

  async function signInAdmin(page: Page): Promise<void> {
    await clearBrowserState(page);
    await page.locator('#login-email').fill(process.env.SUPABASE_TEST_ADMIN_EMAIL || 'admin@amaratvkrishi.com');
    await page.locator('#login-password').fill(process.env.SUPABASE_TEST_ADMIN_PASSWORD || 'Admin@123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByRole('tab', { name: 'Reports' })).toBeVisible({ timeout: 20_000 });
    const initialSync = await triggerSyncWhenAvailable(page);
    expect((initialSync as any).error ?? null).toBeNull();
    expect((await waitForSyncSettled(page)).status).toBe('SYNCED');
  }

  test('creates offline, syncs, updates through the CRM data layer, and proves final local and PostgreSQL state', async ({ page, context }) => {
    await clearBrowserState(page);

    await page.getByLabel('Email / Login ID').fill(testEmail);
    await page.locator('#login-password').fill(testPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByRole('tab', { name: /Dashboard/i })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('tab', { name: /Leads/i }).click();
    await page.getByRole('button', { name: /Add Lead|New Lead/i }).first().click();
    await page.locator('input[placeholder="e.g. Golds Gym Gomti Nagar"]').fill(testBusinessName);
    await page.locator('input[placeholder="e.g. 7054447888"]').fill(testPhone);
    await page.locator('input[placeholder="e.g. Alambagh, LDA Colony"]').fill('Gomti Nagar');

    await context.setOffline(true);
    await page.getByRole('button', { name: /Save Lead/i }).click();
    await expect(page.getByText(testBusinessName)).toBeVisible({ timeout: 10_000 });

    const pendingLead = await page.evaluate(async (name) => {
      const data = (window as unknown as { __crmData?: any }).__crmData;
      if (!data) throw new Error('The development CRM data seam is unavailable.');
      const result = await data.leads.searchAndFilterLeads({ searchTerm: name });
      const lead = result.leads[0];
      if (!lead) throw new Error('The offline lead was not written to the local database.');
      const outbox = await data.db.outbox.where('entityId').equals(lead.id).toArray();
      return { lead, outbox };
    }, testBusinessName);
    const leadId = pendingLead.lead.id as string;
    testLeadId = leadId;
    expect(pendingLead.lead.isSynced).toBe(0);
    expect(pendingLead.outbox.some((item: any) => item.entityType === 'leads' && item.operation === 'CREATE')).toBe(true);

    await context.setOffline(false);
    // Do not treat the transient SYNCED badge as proof that the reconnect
    // cycle has pushed this specific outbox item. Start an explicit bounded
    // cycle after transport recovery, then assert its terminal state.
    const syncResult = await triggerSyncWhenAvailable(page);
    expect((syncResult as any).error ?? null).toBeNull();
    expect((syncResult as any).failedCount ?? 0).toBe(0);
    const settledAfterPush = await waitForSyncSettled(page);
    expect(settledAfterPush.status).toBe('SYNCED');
    expect(settledAfterPush.lastSyncError).toBeNull();

    const { data: persistedLead, error: persistedLeadError } = await local.service
      .from('leads')
      .select('id, organization_id, business_name, phone, locality, created_by, assigned_to, version, sync_revision, deleted_at')
      .eq('id', leadId)
      .single();
    expect(persistedLeadError).toBeNull();
    expect(persistedLead).toMatchObject({
      id: leadId,
      organization_id: local.organizationId,
      business_name: testBusinessName,
      phone: testPhone,
      locality: 'Gomti Nagar',
      created_by: testProfileId,
      assigned_to: testProfileId,
      deleted_at: null,
    });
    expect(persistedLead?.version).toBeGreaterThan(0);

    const { data: persistedActivity, error: activityError } = await local.service
      .from('activities')
      .select('lead_id, user_id, activity_type')
      .eq('lead_id', leadId)
      .eq('activity_type', 'LEAD_CREATED')
      .maybeSingle();
    expect(activityError).toBeNull();
    expect(persistedActivity).toMatchObject({
      lead_id: leadId,
      user_id: testProfileId,
      activity_type: 'LEAD_CREATED',
    });

    const reconciled = await localLeadState(page, leadId);
    expect((reconciled.lead as any).isSynced).toBe(1);
    expect((reconciled.lead as any).serverRevision).toBeGreaterThan(0);
    expect((reconciled.outbox as any[]).some((item) => item.entityType === 'leads' && item.operation === 'CREATE')).toBe(false);

    const localUpdate = await page.evaluate(async ({ id, name, userId }) => {
      const data = (window as unknown as { __crmData?: any }).__crmData;
      if (!data) throw new Error('The development CRM data seam is unavailable.');
      return data.leads.updateLead(id, { businessName: name, updatedBy: userId });
    }, { id: leadId, name: updatedBusinessName, userId: testProfileId });
    expect(localUpdate.businessName).toBe(updatedBusinessName);

    const updateSync = await triggerSyncWhenAvailable(page);
    expect((updateSync as any).error ?? null).toBeNull();
    await waitForSyncSettled(page);

    const { data: updatedLead, error: updateError } = await local.service
      .from('leads')
      .select('business_name, version, sync_revision, updated_by')
      .eq('id', leadId)
      .single();
    expect(updateError).toBeNull();
    expect(updatedLead).toMatchObject({ business_name: updatedBusinessName, updated_by: testProfileId });
    expect(updatedLead?.sync_revision).toBeGreaterThan(persistedLead?.sync_revision ?? 0);
  });

  test('proves real browser list, detail history, edit validation, and child records end to end', async ({ page }) => {
    await ensureTestLeadFixture();
    await clearBrowserState(page);
    await page.locator('#login-email').fill(testEmail);
    await page.locator('#login-password').fill(testPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByRole('tab', { name: /Dashboard/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('tab', { name: /Leads/i }).click();
    await expect(page.locator('#leads-search')).toBeVisible({ timeout: 15_000 });

    // Read/search/filter coverage starts from the backend-persisted lead.
    await page.locator('#leads-search').fill(updatedBusinessName);
    await expect(page.getByText(updatedBusinessName, { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await expect(page.getByText(updatedBusinessName, { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.locator('#leads-locality').selectOption('Gomti Nagar');
    await expect(page.getByText(updatedBusinessName, { exact: true })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: new RegExp(`^${updatedBusinessName}`) }).first().click();
    await expect(page.getByRole('heading', { name: updatedBusinessName, exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('tab', { name: /Calls \(/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Remarks \(/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Follow-ups \(/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /WhatsApp \(/ })).toBeVisible();

    // Remark UI -> local outbox -> server row -> refreshed detail.
    await page.getByRole('tab', { name: /Remarks \(/ }).click();
    await page.getByRole('button', { name: 'Add note', exact: true }).click();
    await page.locator('#inline-remark').fill(remarkText);
    await page.getByRole('button', { name: 'Save remark', exact: true }).click();
    await expect(page.getByText(remarkText, { exact: true })).toBeVisible({ timeout: 15_000 });

    // Follow-up UI -> local lead projection and follow-up row.
    await page.getByRole('tab', { name: /Follow-ups \(/ }).click();
    await page.getByRole('button', { name: 'Schedule', exact: true }).click();
    await page.locator('#fu-title').fill(followUpTitle);
    await page.locator('#fu-notes').fill('Verify the sample feedback in the next call.');
    await page.getByRole('button', { name: 'Set follow-up reminder', exact: true }).click();
    await expect(page.getByText(followUpTitle, { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    // Call lifecycle UI -> native tel: handoff -> call record, remark, lead
    // status, and audit activity. The disposable browser captures the handoff
    // instead of opening an external phone application.
    await page.evaluate(() => {
      const browserWindow = window as unknown as { __realDialUrl?: string; open: typeof window.open };
      browserWindow.open = ((url?: string | URL) => {
        browserWindow.__realDialUrl = String(url ?? '');
        return null;
      }) as typeof window.open;
    });
    await page.getByRole('button', { name: 'Call', exact: true }).click();
    await expect.poll(async () => page.evaluate(() => (
      window as unknown as { __realDialUrl?: string }
    ).__realDialUrl || '')).toBe(`tel:${testPhone}`);
    await expect(page.getByRole('button', { name: 'Save call outcome & notes', exact: true })).toBeVisible();
    await page.locator('#reported-minutes').fill('3');
    await page.locator('#custom-note').fill('Connected through the real browser call-outcome workflow.');
    await page.getByRole('button', { name: 'Save call outcome & notes', exact: true }).click();
    await expect(page.getByRole('heading', { name: updatedBusinessName, exact: true }).first()).toBeVisible({ timeout: 15_000 });

    // Drain the call/remark activity chain before starting the independent edit
    // assertion. This makes the causal outbox ordering observable instead of
    // allowing a second UI mutation to race the first sync cycle.
    const callSync = await triggerSyncWhenAvailable(page);
    expect((callSync as any).error ?? null).toBeNull();
    expect((await waitForSyncSettled(page)).status).toBe('SYNCED');

    // Edit validation must block malformed PINs before the repository is called.
    await page.getByRole('button', { name: `Edit lead ${updatedBusinessName}`, exact: true }).click();
    await page.locator('#edit-pincode').fill('123');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('PIN code must be exactly 6 digits.');
    await page.locator('#edit-pincode').fill('226010');
    await page.locator('#edit-business-name').fill(visualUpdatedBusinessName);
    await page.locator('#edit-status').selectOption('INTERESTED');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByRole('heading', { name: visualUpdatedBusinessName, exact: true })).toBeVisible({ timeout: 15_000 });
    await expect.poll(async () => {
      const state = await localLeadState(page, testLeadId!);
      return (state.lead as any)?.businessName;
    }, { timeout: 15_000 }).toBe(visualUpdatedBusinessName);
    const syncResult = await triggerSyncWhenAvailable(page);
    expect((syncResult as any).error ?? null).toBeNull();
    const settled = await waitForSyncSettled(page);
    expect(settled.status).toBe('SYNCED');

    const { data: persisted, error: persistedError } = await local.service
      .from('leads')
      .select('business_name, status, pincode, version, sync_revision')
      .eq('id', testLeadId)
      .single();
    expect(persistedError).toBeNull();
    expect(persisted).toMatchObject({
      business_name: visualUpdatedBusinessName,
      status: 'INTERESTED',
      pincode: '226010',
    });
    expect(persisted?.version).toBeGreaterThan(0);
    expect(persisted?.sync_revision).toBeGreaterThan(0);

    const [remarkResult, callResult, followUpResult] = await Promise.all([
      local.service.from('remarks').select('lead_id, content, type').eq('lead_id', testLeadId).eq('content', remarkText).maybeSingle(),
      local.service.from('call_records').select('lead_id, outcome, reported_duration_seconds').eq('lead_id', testLeadId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      local.service.from('follow_ups').select('lead_id, title, status').eq('lead_id', testLeadId).eq('title', followUpTitle).maybeSingle(),
    ]);
    expect(remarkResult.error).toBeNull();
    expect(remarkResult.data).toMatchObject({ lead_id: testLeadId, content: remarkText, type: 'CUSTOM' });
    expect(callResult.error).toBeNull();
    expect(callResult.data).toMatchObject({ lead_id: testLeadId, outcome: 'CONNECTED', reported_duration_seconds: 180 });
    expect(followUpResult.error).toBeNull();
    expect(followUpResult.data).toMatchObject({ lead_id: testLeadId, title: followUpTitle, status: 'PENDING' });

    const localState = await localLeadState(page, testLeadId!);
    expect((localState.lead as any).isSynced).toBe(1);
    expect((localState.outbox as any[])).toHaveLength(0);
  });

  test('archives a duplicate and restores it through the admin recovery UI', async ({ browser }) => {
    await ensureArchiveFixture();
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    try {
      await signInAdmin(adminPage);
      await adminPage.getByRole('tab', { name: 'Data' }).click();
      await adminPage.getByRole('tab', { name: 'Data Cleanup' }).click();
      // Seed data already contains unrelated duplicate clusters. Anchor the
      // assertion to this test's synthetic cluster instead of assuming it is
      // the only duplicate in the disposable organization.
      await expect(
        adminPage.getByRole('button', { name: /^Archive duplicate lead (Real browser archive primary|Real browser archive duplicate)/ }),
      ).toBeVisible({ timeout: 30_000 });

      const archiveButton = adminPage.getByRole('button', {
        name: /^Archive duplicate lead (Real browser archive primary|Real browser archive duplicate)/,
      }).first();
      await expect(archiveButton).toBeVisible();
      const archiveLabel = await archiveButton.getAttribute('aria-label');
      archiveTargetLeadId = archiveLabel?.includes(archivePrimaryBusinessName)
        ? archivePrimaryLeadId
        : archiveDuplicateLeadId;
      expect(archiveTargetLeadId).toBeTruthy();
      await archiveButton.click();
      await expect(adminPage.locator('#data-panel-CLEANUP').getByText(
        'Duplicate lead archived successfully.',
        { exact: true },
      )).toBeVisible();

      await adminPage.getByRole('tab', { name: 'Lead Explorer' }).click();
      await adminPage.locator('#data-explorer-search').fill(archiveLabel?.replace('Archive duplicate lead ', '') || '');
      await expect(adminPage.getByText('No Leads Found', { exact: true })).toBeVisible({ timeout: 15_000 });

      const archiveSync = await triggerSyncWhenAvailable(adminPage);
      expect((archiveSync as any).error ?? null).toBeNull();
      expect((await waitForSyncSettled(adminPage)).status).toBe('SYNCED');

      const { data: archivedLead, error: archiveError } = await local.service
        .from('leads')
        .select('id, organization_id, deleted_at')
        .eq('id', archiveTargetLeadId)
        .single();
      expect(archiveError).toBeNull();
      expect(archivedLead).toMatchObject({ id: archiveTargetLeadId, organization_id: local.organizationId });
      expect(archivedLead?.deleted_at).not.toBeNull();
      const locallyArchived = await localLeadState(adminPage, archiveTargetLeadId!);
      expect((locallyArchived.lead as any).deletedAt).not.toBeNull();
      expect((locallyArchived.outbox as any[])).toHaveLength(0);

      // Restore through the admin recovery surface, not a test-only data seam.
      const archivedBusinessName = archiveLabel?.replace('Archive duplicate lead ', '') || '';
      await adminPage.getByRole('tab', { name: 'Data Cleanup' }).click();
      const restoreButton = adminPage.getByRole('button', {
        name: `Restore archived lead ${archivedBusinessName}`,
      });
      await expect(restoreButton).toBeVisible({ timeout: 15_000 });
      await restoreButton.click();
      await expect(adminPage.getByRole('status').filter({ hasText: `${archivedBusinessName} restored successfully.` })).toBeVisible();
      const restoreSync = await triggerSyncWhenAvailable(adminPage);
      expect((restoreSync as any).error ?? null).toBeNull();
      expect((await waitForSyncSettled(adminPage)).status).toBe('SYNCED');

      const { data: restoredLead, error: restoreError } = await local.service
        .from('leads')
        .select('id, deleted_at')
        .eq('id', archiveTargetLeadId)
        .single();
      expect(restoreError).toBeNull();
      expect(restoredLead).toMatchObject({ id: archiveTargetLeadId, deleted_at: null });
      const locallyRestored = await localLeadState(adminPage, archiveTargetLeadId!);
      expect((locallyRestored.lead as any).deletedAt).toBeNull();
      expect((locallyRestored.outbox as any[])).toHaveLength(0);
    } finally {
      await adminContext.close();
    }
  });

  test('opens the WhatsApp handoff, logs message history, and reconciles it to PostgreSQL', async ({ page }) => {
    await ensureTestLeadFixture();
    await clearBrowserState(page);
    await page.locator('#login-email').fill(testEmail);
    await page.locator('#login-password').fill(testPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByRole('tab', { name: /Dashboard/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('tab', { name: /Leads/i }).click();
    await expect(page.locator('#leads-search')).toBeVisible({ timeout: 15_000 });
    await page.locator('#leads-search').fill(visualUpdatedBusinessName);
    await page.getByRole('button', { name: new RegExp(`^${visualUpdatedBusinessName}`) }).first().click();
    await expect(page.getByRole('heading', { name: visualUpdatedBusinessName, exact: true })).toBeVisible({ timeout: 15_000 });

    // The browser cannot deliver to WhatsApp, so capture the production wa.me
    // handoff while still exercising the real message-history write path.
    await page.evaluate(() => {
      const browserWindow = window as unknown as { __realWhatsAppUrl?: string; open: typeof window.open };
      browserWindow.open = ((url?: string | URL) => {
        browserWindow.__realWhatsAppUrl = String(url ?? '');
        return null;
      }) as typeof window.open;
    });
    await page.getByRole('button', { name: 'WhatsApp', exact: true }).click();
    await expect(page.getByRole('button', { name: /Quick send: open in WhatsApp/i })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Quick send: open in WhatsApp/i }).click();

    await expect.poll(async () => page.evaluate(() => (
      window as unknown as { __realWhatsAppUrl?: string }
    ).__realWhatsAppUrl || ''), { timeout: 15_000 }).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);

    const localMessage = await page.evaluate(async (leadId) => {
      const data = (window as unknown as { __crmData?: any }).__crmData;
      if (!data) throw new Error('The development CRM data seam is unavailable.');
      const rows = await data.db.messageHistory.where('leadId').equals(leadId).toArray();
      return rows.sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt)))[0] ?? null;
    }, testLeadId);
    expect(localMessage).toMatchObject({
      leadId: testLeadId,
      channel: 'WHATSAPP',
      sentStatus: 'SENT',
    });
    expect(localMessage.messageContent).toContain(visualUpdatedBusinessName);
    expect(localMessage.recipientPhone).toMatch(/\d{10,}/);

    const messageSync = await triggerSyncWhenAvailable(page);
    expect((messageSync as any).error ?? null).toBeNull();
    expect((await waitForSyncSettled(page)).status).toBe('SYNCED');

    const { data: persistedMessage, error: messageError } = await local.service
      .from('message_history')
      .select('lead_id, channel, recipient_phone, message_content, sent_status')
      .eq('lead_id', testLeadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    expect(messageError).toBeNull();
    expect(persistedMessage).toMatchObject({
      lead_id: testLeadId,
      channel: 'WHATSAPP',
      sent_status: 'SENT',
    });
    expect(persistedMessage?.recipient_phone).toMatch(/\d{10,}/);
    expect(persistedMessage?.message_content).toContain(visualUpdatedBusinessName);

    const reconciled = await localLeadState(page, testLeadId!);
    expect((reconciled.outbox as any[])).toHaveLength(0);
  });

  test('exports an account-scoped backup through the admin UI', async ({ page }) => {
    await signInAdmin(page);
    await page.getByRole('button', { name: /Sales Mode/ }).click();
    await expect(page.getByRole('tab', { name: /Dashboard/i })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('tab', { name: /Dashboard/i }).click();
    await page.getByRole('button', { name: 'Backup', exact: true }).click();

    const dialog = page.getByRole('dialog', { name: 'CRM Backup & Restore' });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      dialog.getByRole('button', { name: /Download CRM Backup File/ }).click(),
    ]);
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    const payload = JSON.parse(await readFile(downloadPath as string, 'utf8')) as {
      schemaVersion: number;
      appVersion: string;
      organizationId: string;
      userId: string;
      data: Record<string, unknown>;
    };
    expect(payload).toMatchObject({
      schemaVersion: 6,
      appVersion: '2.0.0',
      organizationId: local.organizationId,
    });
    expect(payload.userId).toBeTruthy();
    for (const collection of [
      'leads', 'remarks', 'callHistory', 'followUps', 'messageHistory',
      'messageTemplates', 'activities', 'callRecords', 'importAudits',
      'outbox', 'syncState', 'bulkAssignmentAudits',
    ]) {
      expect(Array.isArray(payload.data[collection])).toBe(true);
    }
  });

  test('imports a real CSV with mapping, invalid and duplicate rows, and verifies audit persistence', async ({ browser }) => {
    await ensureTestLeadFixture();
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    try {
      await adminPage.goto('/', { timeout: 120_000 });
      await adminPage.locator('#login-email').fill(process.env.SUPABASE_TEST_ADMIN_EMAIL || 'admin@amaratvkrishi.com');
      await adminPage.locator('#login-password').fill(process.env.SUPABASE_TEST_ADMIN_PASSWORD || 'Admin@123');
      await adminPage.getByRole('button', { name: 'Sign In' }).click();
      await expect(adminPage.getByRole('button', { name: /Sales Mode/ })).toBeVisible({ timeout: 20_000 });
      await adminPage.getByRole('button', { name: /Sales Mode/ }).click();
      await adminPage.getByRole('button', { name: 'Import Data', exact: true }).click();
      await expect(adminPage.getByText('Excel Lead Importer', { exact: true })).toBeVisible({ timeout: 15_000 });

      const csv = [
        'Business Name,Phone,Address,Category,Contact Person',
        `${importBusinessName},${importPhone},Gomti Nagar Lucknow,Gym,Import Owner`,
        'Malformed Row,,Alambagh Lucknow,Gym,',
        `Duplicate Existing,${testPhone},Gomti Nagar Lucknow,Gym,Existing Owner`,
      ].join('\n');
      await adminPage.locator('input[type="file"]').setInputFiles({
        name: importFileName,
        mimeType: 'text/csv',
        buffer: Buffer.from(csv, 'utf8'),
      });

      await expect(adminPage.getByRole('button', { name: /Resolve Dups \(1\)/ })).toBeVisible({ timeout: 15_000 });
      await expect(adminPage.getByRole('button', { name: 'Import 1 Valid Leads', exact: true })).toBeVisible();
      await expect(adminPage.getByText(/Invalid/i).first()).toBeVisible();
      await adminPage.getByRole('button', { name: 'Import 1 Valid Leads', exact: true }).click();
      await expect(adminPage.getByText('Import Completed!', { exact: true })).toBeVisible({ timeout: 30_000 });

      const syncResult = await triggerSyncWhenAvailable(adminPage);
      expect((syncResult as any).error ?? null).toBeNull();
      expect((await waitForSyncSettled(adminPage)).status).toBe('SYNCED');

      const { data: importedLead, error: importedError } = await local.service
        .from('leads')
        .select('id, organization_id, business_name, phone, created_by, source_file')
        .eq('business_name', importBusinessName)
        .single();
      expect(importedError).toBeNull();
      expect(importedLead).toMatchObject({
        organization_id: local.organizationId,
        business_name: importBusinessName,
        phone: importPhone,
        created_by: local.adminProfileId,
        source_file: importFileName,
      });
      importedLeadId = importedLead?.id ?? null;

      const { data: audit, error: auditError } = await local.service
        .from('import_audits')
        .select('organization_id, uploaded_by, filename, total_rows, imported, duplicates, invalid')
        .eq('filename', importFileName)
        .single();
      expect(auditError).toBeNull();
      expect(audit).toMatchObject({
        organization_id: local.organizationId,
        uploaded_by: local.adminProfileId,
        filename: importFileName,
        total_rows: 3,
        imported: 1,
        duplicates: 1,
        invalid: 1,
      });
    } finally {
      await adminContext.close();
    }
  });

  test('imports a real XLSX through the admin UI and verifies mapping, persistence, sync, and audit', async ({ browser }) => {
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    try {
      await signInAdmin(adminPage);
      await adminPage.getByRole('tab', { name: 'Data' }).click();
      await adminPage.getByRole('tab', { name: 'Import Center' }).click();
      await adminPage.getByRole('button', { name: 'Launch Importer' }).click();
      await expect(adminPage.getByRole('button', { name: 'Browse Files', exact: true }))
        .toBeVisible({ timeout: 15_000 });

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Leads');
      worksheet.addRow(['Gym Name', 'Mobile Number', 'Address', 'Category', 'Contact Person']);
      worksheet.addRow([xlsxImportBusinessName, xlsxImportPhone, 'Alambagh, Lucknow 226005', 'Gym', 'XLSX Owner']);
      const buffer = await workbook.xlsx.writeBuffer();
      await adminPage.locator('input[type="file"]').setInputFiles({
        name: xlsxImportFileName,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: Buffer.from(buffer),
      });

      await expect(adminPage.getByText(xlsxImportBusinessName, { exact: true })).toBeVisible({ timeout: 20_000 });
      await expect(adminPage.getByRole('button', { name: 'Import 1 Valid Leads', exact: true })).toBeVisible();
      await adminPage.getByRole('button', { name: 'Import 1 Valid Leads', exact: true }).click();
      await expect(adminPage.getByText('Import Completed!', { exact: true })).toBeVisible({ timeout: 30_000 });

      const syncResult = await triggerSyncWhenAvailable(adminPage);
      expect((syncResult as any).error ?? null).toBeNull();
      expect((await waitForSyncSettled(adminPage)).status).toBe('SYNCED');

      const { data: importedLead, error: importedError } = await local.service
        .from('leads')
        .select('id, organization_id, business_name, phone, created_by, source_file')
        .eq('business_name', xlsxImportBusinessName)
        .single();
      expect(importedError).toBeNull();
      expect(importedLead).toMatchObject({
        organization_id: local.organizationId,
        business_name: xlsxImportBusinessName,
        phone: xlsxImportPhone,
        created_by: local.adminProfileId,
        source_file: xlsxImportFileName,
      });
      xlsxImportedLeadId = importedLead?.id ?? null;

      const { data: audit, error: auditError } = await local.service
        .from('import_audits')
        .select('organization_id, uploaded_by, filename, total_rows, imported, duplicates, invalid')
        .eq('filename', xlsxImportFileName)
        .single();
      expect(auditError).toBeNull();
      expect(audit).toMatchObject({
        organization_id: local.organizationId,
        uploaded_by: local.adminProfileId,
        filename: xlsxImportFileName,
        total_rows: 1,
        imported: 1,
        duplicates: 0,
        invalid: 0,
      });
    } finally {
      await adminContext.close();
    }
  });

  test('rejects a malformed XLSX in the real browser before creating import state', async ({ browser }) => {
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    try {
      await signInAdmin(adminPage);
      await adminPage.getByRole('tab', { name: 'Data' }).click();
      await adminPage.getByRole('tab', { name: 'Import Center' }).click();
      await adminPage.getByRole('button', { name: 'Launch Importer' }).click();
      await expect(adminPage.getByRole('button', { name: 'Browse Files', exact: true }))
        .toBeVisible({ timeout: 15_000 });

      await adminPage.locator('input[type="file"]').setInputFiles({
        name: `malformed-${crypto.randomUUID().slice(0, 8)}.xlsx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: Buffer.from('this is not a ZIP-backed XLSX workbook', 'utf8'),
      });

      await expect(adminPage.getByRole('alert')).toContainText('not a valid ZIP container', { timeout: 15_000 });
      await expect(adminPage.getByText('Excel Lead Importer', { exact: true }).first()).toBeVisible();
      await expect(adminPage.getByText('Import Completed!', { exact: true })).toHaveCount(0);
    } finally {
      await adminContext.close();
    }
  });
});
