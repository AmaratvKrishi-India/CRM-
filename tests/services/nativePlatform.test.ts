import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  native: false,
  capacitorShareAvailable: true,
  capacitorShare: vi.fn(),
  browserShare: vi.fn(),
  windowOpen: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => state.native,
    getPlatform: () => (state.native ? 'android' : 'web'),
  },
}));
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn() } }));
vi.mock('@capacitor/share', () => ({
  Share: {
    canShare: vi.fn(async () => ({ value: state.capacitorShareAvailable })),
    share: state.capacitorShare,
  },
}));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: { requestPermissions: vi.fn(), schedule: vi.fn() } }));

import { NativePlatformService } from '../../src/services/nativePlatform';

beforeEach(() => {
  vi.clearAllMocks();
  state.native = false;
  state.capacitorShareAvailable = true;
  window.open = state.windowOpen as typeof window.open;
  Object.defineProperty(navigator, 'share', {
    configurable: true,
    value: state.browserShare,
  });
});

describe('NativePlatformService handoff contracts', () => {
  it('opens the phone dialer with a tel intent', () => {
    NativePlatformService.openDialer('9876543210');

    expect(state.windowOpen).toHaveBeenCalledWith('tel:9876543210', '_system');
  });

  it('sanitizes WhatsApp recipients before opening the handoff URL', () => {
    NativePlatformService.openWhatsApp('+91 98765-43210', 'Hello from CRM');

    expect(state.windowOpen).toHaveBeenCalledWith(
      'https://wa.me/919876543210?text=Hello%20from%20CRM',
      '_system',
    );
  });

  it('uses the native share sheet when the platform supports it', async () => {
    state.native = true;
    const result = await NativePlatformService.share({ title: 'Catalogue', text: 'Sample offer' });

    expect(result).toBe(true);
    expect(state.capacitorShare).toHaveBeenCalledWith(expect.objectContaining({ title: 'Catalogue', text: 'Sample offer' }));
    expect(state.browserShare).not.toHaveBeenCalled();
  });

  it('uses the browser share fallback when native sharing is unavailable', async () => {
    const result = await NativePlatformService.share({ title: 'Catalogue', text: 'Sample offer', url: 'https://example.test' });

    expect(result).toBe(true);
    expect(state.browserShare).toHaveBeenCalledWith({
      title: 'Catalogue',
      text: 'Sample offer',
      url: 'https://example.test',
    });
  });

  it('returns false instead of throwing when no share surface exists', async () => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });

    await expect(NativePlatformService.share({ text: 'Sample offer' })).resolves.toBe(false);
  });
});
