import { createUuid } from '../../utils/id';
import type { User } from '../../db/types';
import { NativePlatformService } from '../nativePlatform';
import { normalizeIndiaMobile } from './callProvider';
import type { CallProvider, CallProviderEvent, CallProviderStatus, DialIntent } from './callProvider';

const ENDPOINT = 'http://127.0.0.1:48765';
export const LOCAL_JIO_ENABLED = false; // Security review gate: cannot be enabled by environment or local storage.

export function safeMockBackend(url: string, key: string): boolean {
  try {
    const parsed = new URL(url);
    const local = ['127.0.0.1', 'localhost'].includes(parsed.hostname) && parsed.protocol === 'http:';
    const staging = parsed.origin === 'https://dhoinifpzijqyobcamlv.supabase.co';
    if ((!local && !staging) || /lahvcodvgubplzfshare|sb_secret_/.test(key)) return false;
    if (key.startsWith('eyJ')) {
      const claim = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return claim.role === 'anon' && claim.ref !== 'lahvcodvgubplzfshare' && (local || claim.ref === 'dhoinifpzijqyobcamlv');
    }
    return local; // Hosted Preview requires a scoped legacy public key whose ref can be checked.
  } catch { return false; }
}
export function windowsMockAllowed(actor: User | null): boolean {
  const scopes = String(import.meta.env.VITE_WINDOWS_CALLING_MOCK_SCOPES || '').split(',');
  return import.meta.env.VITE_WINDOWS_CALLING_MOCK === '1' && !NativePlatformService.isNative() &&
    /Windows NT/.test(navigator.userAgent) && !!actor && actor.status === 'ACTIVE' && !actor.deletedAt &&
    !!actor.organizationId && scopes.includes(`${actor.organizationId}:${actor.id}`) &&
    safeMockBackend(String(import.meta.env.VITE_SUPABASE_URL || ''), String(import.meta.env.VITE_SUPABASE_ANON_KEY || ''));
}

/** Short-lived, tab-only pairing. Refresh/logout requires fresh local pairing. Never stores credentials. */
export class WindowsJioProvider implements CallProvider {
  readonly platform = 'windows' as const;
  private token: string | null = null;
  private deviceId = createUuid();
  private sessionId = createUuid();
  private actor: User | null = null;
  private enabled = false;
  private selectedScope: string | null = null;
  private generation = 0;
  private activeAttempt: string | null = null;
  private sequence = 0;
  private listeners = new Set<(event: CallProviderEvent) => void>();
  status: CallProviderStatus = 'unconfigured';
  private poll: ReturnType<typeof setInterval> | null = null;
  private polling = false;
  private expiresAt = 0;

  isEnabled(actor: User): boolean { return this.enabled && this.actor?.id === actor.id && this.actor.organizationId === actor.organizationId; }
  isSelected(actor: User): boolean { return this.selectedScope === `${actor.organizationId}:${actor.id}`; }
  isActive(): boolean { return this.activeAttempt !== null; }
  async pair(actor: User, code: string, consent: boolean): Promise<void> {
    if (!consent || !windowsMockAllowed(actor) || !navigator.onLine || !/^[a-f0-9]{64}$/.test(code)) throw new Error('Mock pairing requires an allowed Windows test account, online access and local consent.');
    await this.disconnect();
    const generation = ++this.generation;
    const data = await this.post('/pair', { userId: actor.id, organizationId: actor.organizationId, role: actor.role }, { 'X-CRM-Pairing': code });
    if (generation !== this.generation) return;
    if (data.mode !== 'mock' || typeof data.token !== 'string' || !/^[a-f0-9]{64}$/.test(data.token) || typeof data.expiresAt !== 'number') throw new Error('Companion pairing response was invalid.');
    this.token = data.token;
    this.expiresAt = data.expiresAt;
    this.actor = actor;
    this.enabled = true;
    this.selectedScope = `${actor.organizationId}:${actor.id}`;
    this.status = 'ready';
    this.poll = setInterval(() => void this.check(), 300);
  }
  private async post(path: string, body: Record<string, unknown>, headers: Record<string, string> = {}): Promise<Record<string, unknown>> {
    const response = await fetch(`${ENDPOINT}${path}`, {
      method: 'POST', mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}), ...headers },
      body: JSON.stringify({ ...body, deviceId: this.deviceId, sessionId: this.sessionId }),
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) throw new Error('Companion denied the request. Check pairing and local call policy, then retry manually.');
    return response.json();
  }
  private acceptEvent(raw: unknown): void {
    if (!raw || typeof raw !== 'object') return;
    const event = raw as CallProviderEvent;
    if (event.provenance !== 'mock' || event.carrierVerified !== false || event.attemptId !== this.activeAttempt ||
        !Number.isSafeInteger(event.sequence) || event.sequence <= this.sequence || !Number.isFinite(event.observedAt) ||
        Math.abs(Date.now() - event.observedAt) > 30000 || !['connecting', 'ringing', 'connected', 'ended', 'error'].includes(event.state)) return;
    const order = ['connecting', 'ringing', 'connected', 'ended'];
    if (event.state !== 'error' && order.indexOf(event.state) < order.indexOf(this.status)) return;
    this.sequence = event.sequence;
    this.status = event.state;
    if (event.state === 'ended' || event.state === 'error') this.activeAttempt = null;
    this.listeners.forEach(listener => listener({ ...event }));
  }
  private async check(): Promise<void> {
    if (this.polling || !this.token) return;
    const generation = this.generation;
    this.polling = true;
    try {
      if (!navigator.onLine || Date.now() >= this.expiresAt) throw new Error('Session unavailable');
      const data = await this.post('/status', {});
      if (generation === this.generation) this.acceptEvent(data.event);
    } catch { if (generation === this.generation) { this.failActive(); await this.disconnect(false); } }
    finally { this.polling = false; }
  }
  async requestDial(intent: DialIntent): Promise<void> {
    if (!this.isEnabled(intent.actor) || !windowsMockAllowed(intent.actor) || !navigator.onLine || !intent.manualConsent || this.activeAttempt || Date.now() >= this.expiresAt) throw new Error('Windows calling is unavailable. Reconnect in Settings and retry manually.');
    if (intent.lead.deletedAt || intent.lead.status === 'DO_NOT_CONTACT') throw new Error('This lead must not be contacted.');
    const number = normalizeIndiaMobile(intent.lead.phone);
    const generation = this.generation;
    this.activeAttempt = intent.attemptId; // Acquire before any await (double click).
    this.status = 'connecting';
    try {
      const grant = await this.post('/intent', { attemptId: intent.attemptId, leadId: intent.lead.id, number, doNotContact: false, manualConsent: true });
      if (generation !== this.generation || !this.enabled) throw new Error('Session changed.');
      const data = await this.post('/dial', { nonce: grant.nonce, attemptId: intent.attemptId });
      if (generation !== this.generation) throw new Error('Session changed.');
      this.acceptEvent(data.event);
    } catch (error) { if (generation === this.generation) this.failActive(); throw error; }
  }
  async hangup(attemptId: string): Promise<void> {
    if (attemptId !== this.activeAttempt) return;
    const generation = this.generation;
    try { const data = await this.post('/hangup', { attemptId }); if (generation === this.generation) this.acceptEvent(data.event); }
    catch { if (generation === this.generation) { this.failActive(); await this.disconnect(false); } }
  }
  private failActive(): void {
    const attemptId = this.activeAttempt;
    this.activeAttempt = null; this.status = 'error';
    if (attemptId) this.listeners.forEach(listener => listener({ attemptId, state: 'error', sequence: ++this.sequence, observedAt: Date.now(), provenance: 'mock', carrierVerified: false }));
  }
  async disconnect(resetSelection = true): Promise<void> {
    ++this.generation;
    this.failActive();
    if (resetSelection) this.selectedScope = null;
    const request = this.token ? this.post('/unpair', {}).catch(() => {}) : Promise.resolve();
    if (this.poll) clearInterval(this.poll);
    this.poll = null; this.token = null; this.actor = null; this.enabled = false; this.activeAttempt = null;
    this.status = 'unconfigured'; this.sequence = 0;
    this.listeners.forEach(listener => listener({ state: 'unconfigured', sequence: 0, observedAt: Date.now(), provenance: 'mock', carrierVerified: false }));
    await request;
  }
  subscribe(listener: (event: CallProviderEvent) => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
}
export const windowsJioProvider = new WindowsJioProvider();
