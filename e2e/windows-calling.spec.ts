import { test, expect, type Page } from '@playwright/test';
import { setupAuthMocks, performLogin, MOCK_AGENT as BASE_AGENT } from './helpers/mockAuth';
// @ts-expect-error Dependency-free Node companion is an independently packaged JS module.
import { createCompanion } from '../companion/server.mjs';
import { injectAxe, getViolations } from 'axe-playwright';

const MOCK_AGENT = { ...BASE_AGENT, id: 'usr-voip-mock-only', email: 'voip-fixture@example.test' };
const origin = 'http://127.0.0.1:4174';
test.describe('Windows mock companion and CRM history', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36' });
  let companion: ReturnType<typeof createCompanion>;
  test.beforeEach(async ({ page }) => {
    companion=createCompanion({origin,userId:MOCK_AGENT.id,organizationId:MOCK_AGENT.organizationId,role:MOCK_AGENT.role});
    await companion.listen();
    await setupAuthMocks(page,MOCK_AGENT);
    await page.goto('/');await performLogin(page,MOCK_AGENT.email,'ValidPassword123');
    await expect(page.getByRole('button',{name:'Windows mock calling settings'})).toBeVisible();
  });
  test.afterEach(async () => { await companion?.close(); });
  async function pair(page: Page) {
    await page.getByRole('button',{name:'Windows mock calling settings'}).click();
    await page.getByLabel('One-time code from your local companion').fill(companion.pairingCode);
    await page.getByRole('checkbox',{name:/Enable simulated calling/}).check();
    await page.getByRole('button',{name:'Enable mock calling',exact:true}).click();
    await expect(page.getByText('Mock companion connected. No real call can be placed.')).toBeVisible();
    await page.getByRole('dialog').getByRole('button',{name:/Close/i}).first().click();
  }
  async function addLead(page: Page) {
    await page.getByRole('tab',{name:'Leads',exact:true}).click();
    await page.getByRole('button',{name:/Add Lead|New Lead/i}).first().click();
    await page.getByLabel('Business / gym name *').fill('Synthetic VoIP Pilot');
    await page.locator('input[placeholder="e.g. 7054447888"]').fill('9000000001');
    await page.getByRole('button',{name:/Save Lead/i}).click();
    await page.getByText('Synthetic VoIP Pilot',{exact:true}).first().click();
  }
  test('explicit pair -> lead click -> actual HTTP mock companion -> manual outcome -> unverified history',async ({page}) => {
    await pair(page);await addLead(page);
    await page.getByRole('button',{name:'Call',exact:true}).click();
    await expect(page.getByRole('dialog').getByText('Call outcome',{exact:true})).toBeVisible();
    await expect(page.getByText(/Mock call: ended/)).toBeVisible();
    await page.getByRole('button',{name:'Save call outcome & notes'}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const record=await page.evaluate(async()=>{
      const name=(await indexedDB.databases()).find(db=>db.name?.startsWith('AmaratvSalesCRM__'))!.name!;
      return new Promise<Record<string,unknown>>((resolve,reject)=>{
        const open=indexedDB.open(name);open.onerror=()=>reject(open.error);open.onsuccess=()=>{
          const database=open.result;const get=database.transaction('callRecords').objectStore('callRecords').getAll();
          get.onsuccess=()=>{database.close();resolve(get.result[0]);};get.onerror=()=>reject(get.error);
        };
      });
    });
    expect(record).toMatchObject({durationSeconds:0,answeredAt:null,verificationStatus:'UNVERIFIED',callStatus:'DIAL_ATTEMPT'});
    expect(record.remark).toContain('[MOCK');
  });
  test('denied pairing remains disabled, responsive settings has no accessibility violations',async ({page})=>{
    await page.setViewportSize({width:390,height:844});
    await page.getByRole('button',{name:'Windows mock calling settings'}).click();
    await page.getByLabel('One-time code from your local companion').fill('b'.repeat(64));
    await page.getByRole('checkbox',{name:/Enable simulated calling/}).check();
    await page.getByRole('button',{name:'Enable mock calling',exact:true}).click();
    await expect(page.getByText(/Connection denied or unavailable/)).toBeVisible();
    await injectAxe(page);await page.waitForTimeout(350);expect(await getViolations(page)).toEqual([]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false);
  });
  test('refresh interrupts the mock attempt without redial and asks for manual outcome',async ({page})=>{
    await pair(page);await addLead(page);await page.getByRole('button',{name:'Call',exact:true}).click();
    await page.reload();await expect(page.getByRole('dialog').getByText('Call outcome',{exact:true})).toBeVisible();
    await expect(page.getByText(/Mock call: error/)).toBeVisible();
    await page.getByRole('button',{name:'Skip / do not record'}).last().click();
    await page.getByRole('button',{name:'Windows mock calling settings'}).click();
    await expect(page.getByText(/Companion not paired/)).toBeVisible();
  });
});

test('Android browser keeps Windows pilot hidden',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(navigator,'userAgent',{value:'Mozilla/5.0 (Linux; Android 14) Chrome/140.0.0.0 Mobile'}));
  await setupAuthMocks(page,MOCK_AGENT);await page.goto('/');await performLogin(page,MOCK_AGENT.email,'ValidPassword123');
  await expect(page.getByRole('tab',{name:/Dashboard/i})).toBeVisible();
  await expect(page.getByRole('button',{name:'Windows mock calling settings'})).toHaveCount(0);
});
