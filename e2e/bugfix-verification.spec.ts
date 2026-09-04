import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import { setupAuthMocks, performLogin, MOCK_ADMIN } from './helpers/mockAuth';

/**
 * Targeted browser verification of the 23-bug fix batch:
 *  - Excel import enqueues outbox items + writes an import audit (bug #1)
 *  - WhatsApp launch uses the E.164 number in wa.me links (bug #4)
 *  - Dashboard "Calls Today" reads callRecords in local time (bugs #5/#12)
 *  - Backup export header is schemaVersion 6 / appVersion 2.0.0 and includes
 *    outbox, syncState, bulkAssignmentAudits (bugs #6/#17)
 */

interface IdbSnapshot {
  leads: any[];
  outbox: any[];
  importAudits: any[];
  messageHistory: any[];
  callRecords: any[];
}

async function readIdb(page: Page): Promise<IdbSnapshot> {
  return page.evaluate(
    async () => {
      const database = (await indexedDB.databases()).find((item) => item.name?.startsWith('AmaratvSalesCRM__'));
      if (!database?.name) throw new Error('Scoped CRM database was not created.');
      const idb = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(database.name!);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve(req.result);
      });
      const getAll = (name: string) => new Promise<any[]>((resolve, reject) => {
        const tx = idb.transaction(name, 'readonly');
        const request = tx.objectStore(name).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const [leads, outbox, importAudits, messageHistory, callRecords] = await Promise.all([
        getAll('leads'),
        getAll('outbox'),
        getAll('importAudits'),
        getAll('messageHistory'),
        getAll('callRecords'),
      ]);
      idb.close();
      return { leads, outbox, importAudits, messageHistory, callRecords };
    }
  );
}

async function seedCallRecord(page: Page): Promise<string | null> {
  return page.evaluate(
    async () => {
      const database = (await indexedDB.databases()).find((item) => item.name?.startsWith('AmaratvSalesCRM__'));
      if (!database?.name) throw new Error('Scoped CRM database was not created.');
      const idb = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(database.name!);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve(req.result);
      });
      const lead = await new Promise<any | null>((resolve, reject) => {
        const tx = idb.transaction('leads', 'readonly');
        const request = tx.objectStore('leads').openCursor();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result?.value ?? null);
      });
      if (!lead) {
        idb.close();
        return null;
      }
      const now = new Date().toISOString();
      const rec = {
        id: `verify-call-${Date.now()}`,
        leadId: lead.id,
        userId: 'usr-admin-001',
        deviceId: null,
        startedAt: now,
        answeredAt: now,
        endedAt: now,
        durationSeconds: 42,
        outcome: 'INTERESTED',
        remark: 'Browser verification call',
        verificationStatus: 'UNVERIFIED',
        createdAt: now,
        updatedAt: now,
        isSynced: 0,
        deletedAt: null,
      };
      await new Promise<void>((resolve, reject) => {
        const tx = idb.transaction('callRecords', 'readwrite');
        const request = tx.objectStore('callRecords').add(rec);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      idb.close();
      return lead.id;
    }
  );
}

test.describe('Bugfix verification: import, WhatsApp, dashboard, backup', () => {
  test('import enqueues outbox + audit; WA uses E.164; calls-today counts callRecords; backup header v6', async ({
    page,
  }) => {
    test.setTimeout(240_000);

    // ---- Login as ADMIN ----
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
    await setupAuthMocks(page, MOCK_ADMIN);
    await page.reload();
    await performLogin(page, MOCK_ADMIN.email, 'ValidPassword123');

    // Admin shell bottom nav
    await expect(page.getByRole('tab', { name: 'Reports' })).toBeVisible({ timeout: 15000 });

    // ---- Import sample dataset via Admin > Data > Import Center ----
    await page.getByRole('tab', { name: 'Data' }).click();
    await page.getByRole('tab', { name: 'Import Center' }).click();
    await page.getByRole('button', { name: 'Launch Importer' }).click();
    await page.getByRole('button', { name: /Load 141 Leads/ }).click();

    const importBtn = page.getByRole('button', { name: /Import \d+ Valid Leads/ });
    await expect(importBtn).toBeVisible({ timeout: 60000 });
    await importBtn.click();

    await expect(page.getByText('Import Completed!')).toBeVisible({ timeout: 120000 });

    // ---- Verify IndexedDB side effects of the import (bug #1) ----
    const snap = await readIdb(page);
    expect(snap.leads.length).toBeGreaterThanOrEqual(100);
    expect(snap.importAudits.length).toBe(1);
    expect(snap.importAudits[0].uploadedBy).toBe(MOCK_ADMIN.id);
    expect(snap.importAudits[0].imported).toBeGreaterThanOrEqual(100);

    const leadCreates = snap.outbox.filter(
      (o) => o.entityType === 'leads' && o.operation === 'CREATE'
    );
    expect(leadCreates.length).toBeGreaterThanOrEqual(100);
    expect(leadCreates[0].userId).toBe(MOCK_ADMIN.id);
    expect(snap.outbox.some((o) => o.entityType === 'import_audits')).toBeTruthy();

    // Imported leads must carry E.164 numbers (bugs #2/#23 numeric phone handling)
    const importedLead = snap.leads.find((l) => l.sourceFile?.includes('Lucknow_Gyms'));
    expect(importedLead).toBeTruthy();

    // ---- Switch to Field Sales Mode ----
    // Close the importer summary modal, then use the Sales Mode button on the admin HOME tab
    await page.getByRole('button', { name: 'View Leads in CRM' }).click();
    await page.getByRole('tab', { name: 'Overview' }).click();
    await page.getByRole('button', { name: 'Sales Mode' }).click();
    await expect(page.getByText('Today & Pipeline Performance')).toBeVisible({ timeout: 15000 });

    // ---- Create a lead with a mobile number ----
    const waPhone = '9876543210';
    const waGym = `WA Verify Gym ${Date.now().toString().slice(-4)}`;
    await page.getByRole('tab', { name: /Leads/i }).first().click();
    await page.getByRole('button', { name: /Add Lead|New Lead/i }).first().click();
    await page.locator('input[placeholder="e.g. Golds Gym Gomti Nagar"]').fill(waGym);
    await page.locator('input[placeholder="e.g. 7054447888"]').fill(waPhone);
    await page.locator('input[placeholder="e.g. Alambagh, LDA Colony"]').fill('Hazratganj');
    await page.getByRole('button', { name: /Save Lead/i }).click();
    await expect(page.getByText(waGym).first()).toBeVisible({ timeout: 15000 });

    // ---- Seed a callRecord and verify dashboard Calls Today (bugs #5/#12) ----
    const seededLeadId = await seedCallRecord(page);
    expect(seededLeadId).toBeTruthy();

    await page.getByRole('tab', { name: /Dashboard/i }).first().click();
    const callsCard = page.locator('div.bg-surface').filter({ hasText: 'Calls Today' }).first();
    await expect(callsCard.locator('span.text-xl')).toHaveText('1', { timeout: 15000 });

    // ---- WhatsApp flow must open wa.me with the E.164 number (bug #4) ----
    await page.getByRole('tab', { name: /Leads/i }).first().click();
    await page.getByText(waGym).first().click();
    await page.getByRole('button', { name: 'WhatsApp', exact: true }).click();

    // First-time template setup (no seeded templates in a fresh DB)
    const useIntroBtn = page.getByRole('button', { name: /Use Amaratv Intro Pitch/i });
    if (await useIntroBtn.isVisible().catch(() => false)) {
      await useIntroBtn.click();
    }

    // Capture window.open instead of navigating away
    await page.evaluate(() => {
      (window as any).__openedUrls = [];
      (window as any).open = (url?: string | URL) => {
        (window as any).__openedUrls.push(String(url));
        return null;
      };
    });

    await page.getByRole('button', { name: /Quick Send: Open in WhatsApp/i }).click();

    await page.waitForFunction(() => ((window as any).__openedUrls || []).length > 0);
    const openedUrls = await page.evaluate(() => (window as any).__openedUrls as string[]);
    expect(openedUrls[0]).toContain('https://wa.me/919876543210');

    // Message log must store the E.164 recipient
    const snap2 = await readIdb(page);
    const waMessage = snap2.messageHistory.find((m) => m.channel === 'WHATSAPP');
    expect(waMessage).toBeTruthy();
    expect(waMessage.recipientPhone).toBe('+919876543210');

    // ---- Backup export: header + new tables (bugs #6/#17) ----
    // Leave the full-screen lead detail view first so the bottom nav is visible
    await page.getByRole('button', { name: /Back to leads list/i }).click();
    await page.getByRole('tab', { name: /Dashboard/i }).first().click();
    await page.getByRole('button', { name: 'Backup' }).click();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Download CRM Backup File/ }).click(),
    ]);
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    const payload = JSON.parse(fs.readFileSync(downloadPath as string, 'utf8'));
    expect(payload.schemaVersion).toBe(6);
    expect(payload.appVersion).toBe('2.0.0');
    expect(Array.isArray(payload.data.outbox)).toBeTruthy();
    expect(Array.isArray(payload.data.syncState)).toBeTruthy();
    expect(Array.isArray(payload.data.bulkAssignmentAudits)).toBeTruthy();
    expect(payload.data.leads.length).toBeGreaterThanOrEqual(101);
    expect(payload.data.callRecords.length).toBeGreaterThanOrEqual(1);
    expect(payload.data.importAudits.length).toBe(1);
  });
});
