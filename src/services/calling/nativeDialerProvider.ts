import { NativePlatformService } from '../nativePlatform';
import type { CallProvider, CallProviderEvent, DialIntent } from './callProvider';

export class NativeDialerProvider implements CallProvider {
  readonly platform = 'native' as const;
  requestDial(intent: DialIntent): Promise<void> { NativePlatformService.openDialer(intent.lead.phone); return Promise.resolve(); }
  async hangup(): Promise<void> { throw new Error('End the call in the phone dialer.'); }
  subscribe(_listener: (event: CallProviderEvent) => void): () => void { return () => {}; }
}
