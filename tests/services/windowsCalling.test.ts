import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeIndiaMobile } from '../../src/services/calling/callProvider';
import { WindowsJioProvider, LOCAL_JIO_ENABLED, safeMockBackend, windowsMockAllowed } from '../../src/services/calling/windowsJioProvider';
import { NativePlatformService } from '../../src/services/nativePlatform';
import { CallLifecycleService } from '../../src/services/callLifecycleService';
import { SalesCRMDatabase } from '../../src/db/database';
import type { Lead, User } from '../../src/db/types';

const actor = {id:'test-user',organizationId:'test-org',role:'AGENT',status:'ACTIVE',deletedAt:null,name:'Synthetic'} as User;
const lead = {id:'test-lead',phone:'9000000001',businessName:'Synthetic Pilot',status:'NEW',deletedAt:null,assignedTo:actor.id,createdBy:actor.id,callCount:0,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),isSynced:1} as Lead;
let provider: WindowsJioProvider;
let db: SalesCRMDatabase;
const code = 'a'.repeat(64);
const response = (body: unknown) => new Response(JSON.stringify(body),{status:200});

beforeEach(() => {
  vi.stubEnv('VITE_WINDOWS_CALLING_MOCK','1');
  vi.stubEnv('VITE_WINDOWS_CALLING_MOCK_SCOPES','test-org:test-user');
  vi.stubEnv('VITE_SUPABASE_URL','http://127.0.0.1:15432');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY','synthetic');
  vi.spyOn(NativePlatformService,'isNative').mockReturnValue(false);
  vi.stubGlobal('navigator',{userAgent:'Windows NT 10.0',onLine:true});
  provider=new WindowsJioProvider();
});
afterEach(async () => { await provider.disconnect(); if(db) { CallLifecycleService.resetForTesting(); CallLifecycleService.setCustomDatabase(null); await db.delete(); } vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

async function paired() {
  vi.stubGlobal('fetch',vi.fn(async (url: string) => response(url.endsWith('/pair') ? {token:code,expiresAt:Date.now()+600000,mode:'mock'} : {})));
  await provider.pair(actor,code,true);
}
async function database() {
  db=new SalesCRMDatabase(`mock-${crypto.randomUUID()}`,{userId:actor.id,organizationId:actor.organizationId!,role:actor.role});
  CallLifecycleService.setCustomDatabase(db); CallLifecycleService.resetForTesting(); await db.leads.add(lead);
}

describe('Windows provider policy and session boundary', () => {
  it('does not require randomUUID to load a disabled provider on older WebViews', () => { vi.stubGlobal('crypto', {}); expect(() => new WindowsJioProvider()).not.toThrow(); });
  it('keeps real calling hard disabled and mock default off', () => { expect(LOCAL_JIO_ENABLED).toBe(false); vi.stubEnv('VITE_WINDOWS_CALLING_MOCK',''); expect(windowsMockAllowed(actor)).toBe(false); });
  it('requires active allowed user and organization, Windows and web platform', () => {
    expect(windowsMockAllowed(actor)).toBe(true);
    for(const user of [null,{...actor,id:'other'},{...actor,organizationId:'other'},{...actor,status:'INACTIVE'} as User]) expect(windowsMockAllowed(user)).toBe(false);
    vi.mocked(NativePlatformService.isNative).mockReturnValue(true); expect(windowsMockAllowed(actor)).toBe(false);
  });
  it('fails closed for Production endpoints, service-role and non-scoped hosted keys', () => {
    expect(safeMockBackend('https://lahvcodvgubplzfshare.supabase.co','public')).toBe(false);
    expect(safeMockBackend('https://dhoinifpzijqyobcamlv.supabase.co','sb_secret_example')).toBe(false);
    expect(safeMockBackend('https://dhoinifpzijqyobcamlv.supabase.co','unverified')).toBe(false);
    const jwt=(claim: unknown) => 'eyJ.'+btoa(JSON.stringify(claim))+'.synthetic';
    expect(safeMockBackend('https://dhoinifpzijqyobcamlv.supabase.co',jwt({role:'anon',ref:'dhoinifpzijqyobcamlv'}))).toBe(true);
    expect(safeMockBackend('http://localhost:1234',jwt({role:'service_role'}))).toBe(false);
    expect(safeMockBackend('http://localhost:1234',jwt({role:'anon',ref:'lahvcodvgubplzfshare'}))).toBe(false);
  });
  it('normalizes India mobile without accepting URI injection', () => { expect(normalizeIndiaMobile('+91 (90000)-00001')).toBe('+919000000001'); for(const phone of ['tel:9000000001','9000000001\n','12345']) expect(()=>normalizeIndiaMobile(phone)).toThrow(); });
  it('does not contact companion before pairing and explicit consent', async () => {
    const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
    await expect(provider.pair(actor,code,false)).rejects.toThrow();
    await expect(provider.requestDial({attemptId:'one',lead,actor,manualConsent:true})).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('binds the paired actor and excludes cross-tenant calls', async () => { await paired(); expect(provider.isEnabled({...actor,organizationId:'other'})).toBe(false); await expect(provider.requestDial({actor:{...actor,id:'other'},lead,attemptId:'one',manualConsent:true})).rejects.toThrow(); });
  it('rejects DNC and offline without queueing a request', async () => {
    await paired(); vi.mocked(fetch).mockClear();
    await expect(provider.requestDial({actor,lead:{...lead,status:'DO_NOT_CONTACT'},attemptId:'one',manualConsent:true})).rejects.toThrow();
    vi.stubGlobal('navigator',{userAgent:'Windows NT 10.0',onLine:false});
    await expect(provider.requestDial({actor,lead,attemptId:'two',manualConsent:true})).rejects.toThrow(); expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects double clicks before network resolution; filters stale and unrelated events', async () => {
    await paired();const events: unknown[]=[];provider.subscribe(event=>events.push(event));
    let release!: (value: Response)=>void;
    vi.mocked(fetch).mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
    const first=provider.requestDial({actor,lead,attemptId:'one',manualConsent:true});
    await expect(provider.requestDial({actor,lead,attemptId:'two',manualConsent:true})).rejects.toThrow();
    vi.mocked(fetch).mockImplementationOnce(async()=>response({event:{attemptId:'other',state:'connected',sequence:2,observedAt:Date.now(),provenance:'mock',carrierVerified:false}}));
    release(response({nonce:'synthetic'}));await first;expect(events).toEqual([]);expect(provider.status).toBe('connecting');
  });
  it('drops stale, regressing and falsely verified events without fabricating call facts', async () => {
    await paired();const observed: string[]=[];provider.subscribe(event=>observed.push(event.state));
    const event={attemptId:'one',state:'ringing',sequence:2,observedAt:Date.now(),provenance:'mock',carrierVerified:false};
    vi.mocked(fetch).mockImplementationOnce(async()=>response({nonce:'synthetic'}));
    vi.mocked(fetch).mockImplementationOnce(async()=>response({event}));
    await provider.requestDial({actor,lead,attemptId:'one',manualConsent:true});
    // Test parser contract directly without waiting for periodic IO.
    const accept=(raw: unknown)=>(provider as unknown as {acceptEvent(raw: unknown):void}).acceptEvent(raw);
    accept({...event,state:'connected',sequence:3,observedAt:Date.now()-31000});
    accept({...event,state:'connected',sequence:3,carrierVerified:true});
    accept({...event,state:'connecting',sequence:4});
    accept({...event,sequence:1});
    expect(observed).toEqual(['ringing']);
    accept({...event,state:'ended',sequence:5});expect(observed).toEqual(['ringing','ended']);expect(provider.isActive()).toBe(false);
  });
  it('logout during intent exchange prevents dial command', async () => {
    await paired();let release!: (value:Response)=>void;
    vi.mocked(fetch).mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
    const request=provider.requestDial({actor,lead,attemptId:'one',manualConsent:true});
    await provider.disconnect(); release(response({nonce:'synthetic'}));await expect(request).rejects.toThrow();
    expect(vi.mocked(fetch).mock.calls.some(([url])=>String(url).endsWith('/dial'))).toBe(false);
  });
  it('unreachable companion provides explicit failure without native fallback', async () => { vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('unreachable'))); await expect(provider.pair(actor,code,true)).rejects.toThrow(); expect(provider.isEnabled(actor)).toBe(false); });
});

describe('Mock lifecycle retains unverified facts and existing scoped history', () => {
  it('blocks inaccessible and DNC leads using current database state', async () => { await database();await db.leads.update(lead.id,{status:'DO_NOT_CONTACT'});await expect(CallLifecycleService.beginWindowsMock(actor,lead.id)).rejects.toThrow(); await db.leads.update(lead.id,{status:'NEW',assignedTo:'other',createdBy:'other'});await expect(CallLifecycleService.beginWindowsMock(actor,lead.id)).rejects.toThrow(); });
  it('no ghost record on canceled attempt and no native resume reaction', async () => { await database();await CallLifecycleService.beginWindowsMock(actor,lead.id);expect(CallLifecycleService.handleAppStateChange(true)).toBeNull();CallLifecycleService.cancelCall();expect(await db.callRecords.count()).toBe(0); });
  it('cannot complete an active attempt or infer duration from foreground time', async () => { await database();await CallLifecycleService.beginWindowsMock(actor,lead.id);await expect(CallLifecycleService.completeCall(actor,{outcome:'CONNECTED',verifiedDurationSeconds:50})).rejects.toThrow();expect(await db.callRecords.count()).toBe(0); });
  it('atomically saves one idempotent unverified record and append-only provenance', async () => {
    await database();const attempt=await CallLifecycleService.beginWindowsMock(actor,lead.id);
    CallLifecycleService.observeWindowsMock({attemptId:attempt.attemptId,state:'ended',sequence:4,observedAt:Date.now(),provenance:'mock',carrierVerified:false});
    const [first,second]=await Promise.all([1,2].map(()=>CallLifecycleService.completeCall(actor,{outcome:'CONNECTED',customNote:'Synthetic note',verifiedDurationSeconds:50,reportedDurationSeconds:60})));
    expect(first.callRecord.id).toBe(second.callRecord.id); expect(await db.callRecords.count()).toBe(1);
    expect(first.callRecord).toMatchObject({verificationStatus:'UNVERIFIED',durationSeconds:0,answeredAt:null,callStatus:'DIAL_ATTEMPT',reportedDurationSeconds:null});
    expect(first.callRecord.remark).toContain('Synthetic note');expect(await db.activities.count()).toBe(1);
    expect(first.auditActivity.metadata).toMatchObject({provenance:'mock',carrierVerified:false});
    const updated=await db.leads.get(lead.id);expect(updated?.callCount).toBe(1);expect(updated?.lastContactedAt).toBeUndefined();
  });
  it('ignores unrelated events and cross-user completion', async () => { await database();const attempt=await CallLifecycleService.beginWindowsMock(actor,lead.id);expect(CallLifecycleService.observeWindowsMock({attemptId:'other',state:'ended',sequence:1,observedAt:Date.now(),provenance:'mock',carrierVerified:false})).toBeNull();await expect(CallLifecycleService.completeCall({...actor,id:'other'},{outcome:'OTHER'})).rejects.toThrow();expect(CallLifecycleService.getPendingAttempt()?.attemptId).toBe(attempt.attemptId); });
});
