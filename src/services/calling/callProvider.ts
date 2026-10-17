import type { Lead, User } from '../../db/types';

export type CallProviderStatus = 'unavailable' | 'unconfigured' | 'ready' | 'connecting' | 'ringing' | 'connected' | 'ended' | 'error';
export interface DialIntent {
  attemptId: string;
  lead: Lead;
  actor: User;
  manualConsent: true;
}
export interface CallProviderEvent {
  attemptId?: string;
  state: CallProviderStatus;
  sequence: number;
  observedAt: number;
  provenance: 'mock' | 'native-dialer';
  carrierVerified: false;
}
export interface CallProvider {
  readonly platform: 'native' | 'windows';
  requestDial(intent: DialIntent): Promise<void>;
  hangup(attemptId: string): Promise<void>;
  subscribe(listener: (event: CallProviderEvent) => void): () => void;
}
export function normalizeIndiaMobile(value: string): string {
  if (typeof value !== 'string' || value.length > 32 || !/^[+\d ()-]+$/.test(value)) throw new Error('Enter a valid Indian mobile number.');
  const match = /^(?:\+91|91)?([6-9]\d{9})$/.exec(value.replace(/[ ()-]/g, ''));
  if (!match) throw new Error('Enter a valid Indian mobile number.');
  return `+91${match[1]}`;
}
