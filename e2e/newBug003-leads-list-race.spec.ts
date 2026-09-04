import { test, expect, Page } from '@playwright/test';
import { setupAuthMocks, performLogin, MOCK_AGENT, MOCK_ADMIN } from './helpers/mockAuth';

/**
 * NEW-BUG-003 — MinimalLeadsList "Load More" stale-append race.
 * loadMore() appends its page onto the list with no stale-result guard. If the
 * status/locality/search filter changes while the page query is in flight, the
 * new filter's loadLeads replaces the list, then the stale page resolves and is
 * appended on top -> the visible list mixes rows from two different filters.
 *
 * NEW-BUG-004 — AdminLeadsView stale-search overwrite (same race family).
 * loadData() has no stale-result guard and the search input has no debounce.
 * A slow earlier query can resolve after a faster later one and overwrite the
 * list with stale rows.
 *
 * Both races are reproduced DETERMINISTICALLY (no timing luck, no screenshots):
 * a dev-only test seam (window.__crmData, src/db/index.ts) lets the spec wrap
 * searchAndFilterLeads and HOLD the stale query until the newer query has
 * rendered, then release it and assert list purity.
 */

const AGENT_ID = MOCK_AGENT.id; // usr-agent-001

function buildLead(prefix: string, i: number, status: 'NEW' | 'CUSTOMER') {
  const now = new Date().toISOString();
  const phone = `9${String(100000000 + i).slice(-9)}`;
  return {
    id: `race-${prefix}-${i}`,
    businessName: `${prefix} ${String(i).padStart(4, '0')}`,
    category: 'Gym',
    phone,
    phoneRaw: `+91 ${phone}`,
    phoneE164: `+91${phone}`,
    phoneType: 'mobile',
    alternatePhone: null,
    contactPerson: null,
    address: `${i} Race Street`,
    locality: 'Gomti Nagar',
    pincode: '226010',
    city: 'Lucknow',
    state: 'Uttar Pradesh',
    website: null,
    rating: null,
    reviewCount: null,
    source: 'Race Seed',
    sourceFile: null,
    sourceRow: null,
    status,
    customNotes: '',
    lastContactedAt: null,
    nextFollowUpAt: null,
    callCount: 0,
    createdAt: now,
    // Stagger updatedAt so desc sorting is stable and page contents are predictable.
    updatedAt: new Date(Date.now() - i * 1000).toISOString(),
    isSynced: 1,
    syncedAt: now,
    deletedAt: null,
    createdBy: 'usr-admin-001',
    assignedTo: AGENT_ID,
    updatedBy: 'usr-admin-001',
    version: 1,
  };
}

async function waitForLeadsStore(page: Page): Promise<void> {
  await page.waitForFunction(
    async () => {
      const databases = await indexedDB.databases();
      for (const database of databases) {
        if (!database.name?.startsWith('AmaratvSalesCRM__')) continue;
        const req = indexedDB.open(database.name);
        const hasLeads = await new Promise<boolean>((resolve, reject) => {
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const has = Array.from(req.result.objectStoreNames).includes('leads');
            req.result.close();
            resolve(has);
          };
        });
        if (hasLeads) return true;
      }
      return false;
    },
    { timeout: 30000 }
  );
}

async function seedLeads(page: Page, leads: unknown[]): Promise<void> {
  await page.evaluate(
    async (rows) => {
      const database = (await indexedDB.databases()).find((item) => item.name?.startsWith('AmaratvSalesCRM__'));
      if (!database?.name) throw new Error('Scoped CRM database was not created.');
      const idb = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(database.name!);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve(req.result);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = idb.transaction('leads', 'readwrite');
        const store = tx.objectStore('leads');
        for (const lead of rows) store.put(lead);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      idb.close();
    },
    leads
  );
}

/** Wrap searchAndFilterLeads and hold every pagination call (offset > 0). */
async function installOffsetGate(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as any;
    const data = w.__crmData;
    if (!data) throw new Error('dev test seam window.__crmData missing');
    if (data.__raceGated) return;
    data.__raceGated = true;
    const orig = data.leads.searchAndFilterLeads.bind(data.leads);
    w.__raceGate = { heldParams: [] as any[], release: null as null | (() => void) };
    data.leads.searchAndFilterLeads = async (params: any) => {
      const result = await orig(params);
      if (params && typeof params.offset === 'number' && params.offset > 0) {
        w.__raceGate.heldParams.push(params);
        await new Promise<void>((resolve) => {
          w.__raceGate.release = resolve;
        });
      }
      return result;
    };
  });
}

/** Wrap searchAndFilterLeads and hold every call whose searchTerm matches. */
async function installSearchGate(page: Page, heldTerm: string): Promise<void> {
  await page.evaluate(
    (term) => {
      const w = window as any;
      const data = w.__crmData;
      if (!data) throw new Error('dev test seam window.__crmData missing');
      if (data.__raceGated) return;
      data.__raceGated = true;
      const orig = data.leads.searchAndFilterLeads.bind(data.leads);
      w.__raceGate = { heldParams: [] as any[], release: null as null | (() => void) };
      data.leads.searchAndFilterLeads = async (params: any) => {
        const result = await orig(params);
        if (params && params.searchTerm === term) {
          w.__raceGate.heldParams.push(params);
          await new Promise<void>((resolve) => {
            w.__raceGate.release = resolve;
          });
        }
        return result;
      };
    },
    heldTerm
  );
}

async function releaseGate(page: Page): Promise<void> {
  await page.evaluate(() => {
    const g = (window as any).__raceGate;
    if (g && typeof g.release === 'function') g.release();
  });
}

async function freshLogin(page: Page, user: typeof MOCK_AGENT): Promise<void> {
  await page.goto('/');
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    if (window.indexedDB && (window.indexedDB as any).databases) {
      const dbs = await (window.indexedDB as any).databases();
      for (const dbInfo of dbs) {
        if (dbInfo.name) window.indexedDB.deleteDatabase(dbInfo.name);
      }
    }
  });
  await setupAuthMocks(page, user);
  await page.reload();
  await performLogin(page, user.email, 'ValidPassword123');
}

test.describe('NEW-BUG-003/004: leads list stale-result races', () => {
  test('agent: filter change mid-loadMore must not append stale rows', async ({ page }) => {
    test.setTimeout(240_000);

    await freshLogin(page, MOCK_AGENT);
    const leadsTab = page.getByRole('tab', { name: 'Leads', exact: true });
    await expect(leadsTab).toBeVisible({ timeout: 30000 });

    // 200 NEW + 3 CUSTOMER, all assigned to the agent. CUSTOMER rows sort oldest
    // so the NEW filter's first page is 150 pure NEW rows.
    await waitForLeadsStore(page);
    await seedLeads(page, [
      ...Array.from({ length: 200 }, (_, i) => buildLead('Race NEW Gym', i, 'NEW')),
      ...Array.from({ length: 3 }, (_, i) =>
        buildLead('Race CUST Gym', 5000 + i, 'CUSTOMER')
      ),
    ]);

    await leadsTab.click();
    const loadMoreBtn = page.getByRole('button', { name: /Load More/ });
    await expect(loadMoreBtn).toBeVisible({ timeout: 30000 });
    await expect(page.locator('h2', { hasText: 'Race NEW Gym' })).toHaveCount(150, {
      timeout: 30000,
    });
    await expect(page.locator('h2', { hasText: 'Race CUST Gym' })).toHaveCount(0);

    // Gate pagination queries, then trigger the race.
    await installOffsetGate(page);
    await loadMoreBtn.click();
    await page.waitForFunction(
      () => (window as any).__raceGate?.heldParams?.length === 1,
      undefined,
      { timeout: 15000 }
    );

    // Filter flips while the page query is in flight; the fast CUSTOMER query
    // resolves and renders first.
    const statusGroup = page.getByRole('group', { name: 'Filter by status' });
    await statusGroup.getByRole('button', { name: 'Customer', exact: true }).click();
    await expect(page.locator('h2', { hasText: 'Race CUST Gym' })).toHaveCount(3, {
      timeout: 30000,
    });

    // Release the stale NEW page. With no guard it is appended onto the
    // CUSTOMER list; with the fix it must be discarded.
    await releaseGate(page);
    await expect(page.locator('h2', { hasText: 'Race CUST Gym' })).toHaveCount(3, {
      timeout: 30000,
    });
    await expect(page.locator('h2', { hasText: 'Race NEW Gym' })).toHaveCount(0, {
      timeout: 30000,
    });
  });

  test('admin: stale search result must not overwrite newer search', async ({ page }) => {
    test.setTimeout(240_000);

    await freshLogin(page, MOCK_ADMIN);
    await expect(page.getByRole('tab', { name: 'Reports' })).toBeVisible({ timeout: 30000 });

    await waitForLeadsStore(page);
    await seedLeads(page, [
      ...Array.from({ length: 40 }, (_, i) => buildLead('Gatekeep Alpha Gym', i, 'NEW')),
      ...Array.from({ length: 3 }, (_, i) => buildLead('Gatekeep Beta Gym', 5000 + i, 'NEW')),
    ]);

    await page.getByRole('tab', { name: 'Leads', exact: true }).click();
    await expect(page.locator('h3', { hasText: 'Gatekeep Alpha Gym' })).toHaveCount(40, {
      timeout: 30000,
    });

    // Hold the 'Alpha' search result, then search 'Beta' which resolves fast.
    await installSearchGate(page, 'Alpha');
    const searchInput = page.locator('#admin-leads-search');
    await searchInput.fill('Alpha');
    await page.waitForFunction(
      () => (window as any).__raceGate?.heldParams?.length === 1,
      undefined,
      { timeout: 15000 }
    );
    await searchInput.fill('Beta');
    await expect(page.locator('h3', { hasText: 'Gatekeep Beta Gym' })).toHaveCount(3, {
      timeout: 30000,
    });

    // Release the stale 'Alpha' page: it must not replace the 'Beta' results.
    await releaseGate(page);
    await expect(page.locator('h3', { hasText: 'Gatekeep Beta Gym' })).toHaveCount(3, {
      timeout: 30000,
    });
    await expect(page.locator('h3', { hasText: 'Gatekeep Alpha Gym' })).toHaveCount(0, {
      timeout: 30000,
    });
  });
});
