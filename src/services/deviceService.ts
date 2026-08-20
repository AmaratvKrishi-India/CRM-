/**
 * Local Device Identity Service
 * Provides a stable, non-invasive unique device identifier for local records,
 * activity logging, and sync attribution.
 * Does NOT access IMEI, MAC addresses, serial numbers, or hardware identifiers.
 */

const DEVICE_ID_STORAGE_KEY = 'amaratv_crm_device_id';

export class DeviceService {
  private static cachedDeviceId: string | null = null;

  /**
   * Retrieves or generates a persistent local device UUID.
   */
  static getDeviceId(): string {
    if (this.cachedDeviceId) {
      return this.cachedDeviceId;
    }

    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
        if (stored && stored.trim()) {
          this.cachedDeviceId = stored.trim();
          return this.cachedDeviceId;
        }
      }
    } catch {
      // localStorage may throw in restricted sandboxes
    }

    const newId = this.generateUuid();
    this.cachedDeviceId = newId;

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(DEVICE_ID_STORAGE_KEY, newId);
      }
    } catch {
      // Ignore storage write failures
    }

    return newId;
  }

  /**
   * Generates a standard UUID v4 string.
   */
  private static generateUuid(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Resets cached and stored device ID (used strictly in test environments).
   */
  static resetDeviceIdForTesting(): void {
    this.cachedDeviceId = null;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(DEVICE_ID_STORAGE_KEY);
      }
    } catch {
      // Ignore
    }
  }
}
