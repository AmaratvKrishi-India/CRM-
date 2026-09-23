import { test, expect, type Browser, type Page } from '@playwright/test';
import {
  cleanupLocalSupabase,
  createOtherOrganization,
  createTestLead,
  setupLocalSupabase,
  type LocalSupabaseContext,
} from '../tests/integration/local-supabase';

const realSupabaseEnabled = process.env.PLAYWRIGHT_REAL_SUPABASE === '1';
const agentEmail = process.env.SUPABASE_TEST_AGENT_EMAIL || 'rahul@amaratvkrishi.com';
const agentPassword = process.env.SUPABASE_TEST_AGENT_PASSWORD || 'Agent@123';
const adminEmail = process.env.SUPABASE_TEST_ADMIN_EMAIL || 'admin@amaratvkrishi.com';
const adminPassword = process.env.SUPABASE_TEST_ADMIN_PASSWORD || 'Admin@123';
const initialName = `Realtime Client Lead ${crypto.randomUUID().slice(0, 8)}`;
const updatedName = `${initialName} Updated`;
const foreignName = `Foreign Organization Lead ${crypto.randomUUID().slice(0, 8)}`;

test.describe('CRM independent authenticated clients and realtime reconciliation', () => {
  test.skip(!realSupabaseEnabled, 'Run with npm run test:e2e:real so this suite cannot use mocked credentials.');
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  let local: LocalSupabaseContext;
  let leadId: string;
  let foreignLeadId: string | null = null;
  let otherOrganizationId: string | null = null;
  let adminPage: Page;
  let agentPage: Page;
  let adminBrowser: Browser;
  let agentBrowser: Browser;

  test.beforeAll(async ({ browser }) => {
    local = await setupLocalSupabase();
    const lead = await createTestLead(local, {
      business_name: initialName,
      phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      locality: 'Gomti Nagar',
      created_by: local.agentProfileId,
      assigned_to: local.agentProfileId,
    });
    leadId = lead.id;

    otherOrganizationId = await createOtherOrganization(local);
    const { data: foreignLead, error: foreignError } = await local.service
      .from('leads')
      .insert({
        organization_id: otherOrganizationId,
        business_name: foreignName,
        category: 'Gym',
        phone: `97${Math.floor(10000000 + Math.random() * 90000000)}`,
        address: 'Other organization address',
        locality: 'Other organization locality',
      })
      .select('id')
      .single();
    if (foreignError || !foreignLead) throw new Error('Unable to create the cross-organization fixture.');
    foreignLeadId = foreignLead.id;

    adminBrowser = await browser.browserType().launch();
    agentBrowser = await browser.browserType().launch();
    adminPage = await adminBrowser.newPage();
    agentPage = await agentBrowser.newPage();
  });

  test.afterAll(async () => {
    await adminBrowser?.close();
    await agentBrowser?.close();
    if (local && foreignLeadId) await local.service.from('leads').delete().eq('id', foreignLeadId);
    await cleanupLocalSupabase(local);
  });

  async function login(page: Page, email: string, password: string): Promise<void> {
    await page.goto('/', { timeout: 120_000 });
    await page.locator('#login-email').fill(email);
    await page.locator('#login-password').fill(password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    // Admin and agent shells use different roots. Their authenticated shell is
    // the readiness signal; the sync badge may legitimately remain Syncing or
    // Pending while the first pull is in flight.
    await expect(page.locator('[data-role="admin"], nav[aria-label="Sales sections"]').first()).toBeVisible({ timeout: 30_000 });
  }

  async function synchronize(page: Page): Promise<any> {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const result = await page.evaluate(async () => {
        const data = (window as unknown as { __crmData?: any }).__crmData;
        if (!data?.syncEngine) throw new Error('The development sync seam is unavailable.');
        return data.syncEngine.synchronizeNow();
      });
      if (result?.error !== 'Sync already in progress') return result;
      await page.waitForTimeout(250);
    }
    throw new Error('The independent browser sync engine remained busy.');
  }

  async function localLeadState(page: Page): Promise<any> {
    return page.evaluate(async (id) => {
      const data = (window as unknown as { __crmData?: any }).__crmData;
      if (!data) throw new Error('The development CRM data seam is unavailable.');
      const lead = await data.db.leads.get(id);
      const outbox = await data.db.outbox.where('entityId').equals(id).toArray();
      return { lead, outbox };
    }, leadId);
  }

  test('propagates an authorized PostgreSQL update to the other client and UI', async () => {
    await Promise.all([
      login(adminPage, adminEmail, adminPassword),
      login(agentPage, agentEmail, agentPassword),
    ]);

    await agentPage.getByRole('tab', { name: /Leads/i }).click();
    const initialSync = await synchronize(agentPage);
    expect(initialSync?.error ?? null).toBeNull();
    // The leads list is paginated. Search for the isolated fixture so the
    // assertion does not depend on unrelated local rows occupying page one.
    const leadsSearch = agentPage.locator('#leads-search');
    await leadsSearch.fill(initialName);
    await expect(agentPage.getByText(initialName, { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(agentPage.getByText(foreignName, { exact: true })).toHaveCount(0);
    // Give the independently authenticated Realtime channel a bounded window
    // to reach SUBSCRIBED before the server-side update is issued.
    await agentPage.waitForTimeout(2_000);

    const { error: updateError } = await local.service
      .from('leads')
      .update({ business_name: updatedName, updated_by: local.adminProfileId })
      .eq('id', leadId);
    expect(updateError).toBeNull();

    await expect(agentPage.getByText(updatedName, { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(agentPage.getByText(initialName, { exact: true })).toHaveCount(0);

    const localState = await agentPage.evaluate(async (id) => {
      const data = (window as unknown as { __crmData?: any }).__crmData;
      if (!data) throw new Error('The development CRM data seam is unavailable.');
      const lead = await data.db.leads.get(id);
      return { businessName: lead?.businessName, serverRevision: lead?.serverRevision, isSynced: lead?.isSynced };
    }, leadId);
    expect(localState).toMatchObject({ businessName: updatedName, isSynced: 1 });
    expect(localState.serverRevision).toBeGreaterThan(0);

    const { data: persisted, error: persistedError } = await local.service
      .from('leads')
      .select('business_name, organization_id, updated_by, sync_revision')
      .eq('id', leadId)
      .single();
    expect(persistedError).toBeNull();
    expect(persisted).toMatchObject({
      business_name: updatedName,
      organization_id: local.organizationId,
      updated_by: local.adminProfileId,
    });
    expect(persisted?.sync_revision).toBeGreaterThan(0);
  });

  test('reconciles concurrent offline edits from two authenticated browsers', async () => {
    await adminPage.getByRole('button', { name: /Sales Mode/ }).click();
    await expect(adminPage.getByRole('tab', { name: /Leads/i })).toBeVisible({ timeout: 15_000 });
    await Promise.all([synchronize(adminPage), synchronize(agentPage)]);

    const adminConflictName = `${initialName} Admin Conflict`;
    const agentConflictName = `${initialName} Agent Conflict`;
    await Promise.all([
      adminPage.context().setOffline(true),
      agentPage.context().setOffline(true),
    ]);
    await Promise.all([
      adminPage.evaluate(async ({ id, name }) => {
        const data = (window as unknown as { __crmData?: any }).__crmData;
        if (!data) throw new Error('The development CRM data seam is unavailable.');
        return data.leads.updateLead(id, { businessName: name });
      }, { id: leadId, name: adminConflictName }),
      agentPage.evaluate(async ({ id, name }) => {
        const data = (window as unknown as { __crmData?: any }).__crmData;
        if (!data) throw new Error('The development CRM data seam is unavailable.');
        return data.leads.updateLead(id, { businessName: name });
      }, { id: leadId, name: agentConflictName }),
    ]);

    const [adminOffline, agentOffline] = await Promise.all([
      localLeadState(adminPage),
      localLeadState(agentPage),
    ]);
    expect((adminOffline.lead as any).isSynced).toBe(0);
    expect((agentOffline.lead as any).isSynced).toBe(0);
    expect((adminOffline.outbox as any[]).some((item) => item.operation === 'UPDATE')).toBe(true);
    expect((agentOffline.outbox as any[]).some((item) => item.operation === 'UPDATE')).toBe(true);

    await Promise.all([
      adminPage.context().setOffline(false),
      agentPage.context().setOffline(false),
    ]);
    await agentPage.waitForTimeout(500);
    const [adminSync, agentSync] = await Promise.all([
      synchronize(adminPage),
      synchronize(agentPage),
    ]);
    expect((adminSync as any).error ?? null).toBeNull();
    expect((agentSync as any).error ?? null).toBeNull();
    expect((adminSync as any).conflictsCount + (agentSync as any).conflictsCount).toBeGreaterThan(0);

    // A second bounded cycle pulls the authoritative winner and proves that a
    // conflict/dead-letter does not leave either client in a false SYNCED state.
    await Promise.all([synchronize(adminPage), synchronize(agentPage)]);
    const { data: persisted, error: persistedError } = await local.service
      .from('leads')
      .select('business_name, organization_id, sync_revision')
      .eq('id', leadId)
      .single();
    expect(persistedError).toBeNull();
    expect([adminConflictName, agentConflictName]).toContain(persisted?.business_name);

    const [adminState, agentState] = await Promise.all([
      localLeadState(adminPage),
      localLeadState(agentPage),
    ]);
    expect((adminState.lead as any)).toMatchObject({ businessName: persisted?.business_name, isSynced: 1 });
    expect((agentState.lead as any)).toMatchObject({ businessName: persisted?.business_name, isSynced: 1 });
    expect((adminState.outbox as any[]).filter((item) => item.status === 'PENDING' || item.status === 'SYNCING')).toHaveLength(0);
    expect((agentState.outbox as any[]).filter((item) => item.status === 'PENDING' || item.status === 'SYNCING')).toHaveLength(0);
    expect(persisted?.sync_revision).toBeGreaterThan(0);
    await expect(agentPage.getByText(persisted?.business_name, { exact: true })).toBeVisible({ timeout: 15_000 });
  });

  test('recovers a missed realtime update after one browser reconnects', async () => {
    const reconnectName = `${initialName} Reconnected`;
    await agentPage.context().setOffline(true);
    const { error: updateError } = await local.service
      .from('leads')
      .update({ business_name: reconnectName, updated_by: local.adminProfileId })
      .eq('id', leadId);
    expect(updateError).toBeNull();

    await agentPage.context().setOffline(false);
    const syncResult = await synchronize(agentPage);
    expect(syncResult?.error ?? null).toBeNull();
    await expect(agentPage.getByText(reconnectName, { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(agentPage.getByText(updatedName, { exact: true })).toHaveCount(0);

    const state = await localLeadState(agentPage);
    expect((state.lead as any)).toMatchObject({ businessName: reconnectName, isSynced: 1 });
    expect((state.outbox as any[]).filter((item) => item.status === 'PENDING' || item.status === 'SYNCING')).toHaveLength(0);
  });
});
