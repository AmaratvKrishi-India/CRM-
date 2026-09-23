/**
 * Native Platform Service Layer
 * Abstracts Capacitor native Android plugins behind a clean, testable TypeScript API.
 * Provides graceful fallbacks when running in web / development environments.
 */

import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Share } from '@capacitor/share';
import { LocalNotifications } from '@capacitor/local-notifications';

export interface ShareOptions {
  title?: string;
  text?: string;
  url?: string;
  dialogTitle?: string;
  files?: string[];
}

export interface NotificationScheduleOptions {
  id: number;
  title: string;
  body: string;
  scheduledAt: Date;
  extra?: Record<string, unknown>;
}

export class NativePlatformService {
  /**
   * Returns true if running inside a native mobile container (Android/iOS).
   */
  static isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Returns current platform: 'android' | 'ios' | 'web'.
   */
  static getPlatform(): string {
    return Capacitor.getPlatform();
  }

  /**
   * Triggers the Android phone dialer (Intent.ACTION_DIAL).
   * Does NOT place silent calls; opens the native dialer for user confirmation.
   */
  static openDialer(phoneNumber: string): void {
    const cleanNumber = phoneNumber.trim();
    if (!cleanNumber) return;
    const url = `tel:${encodeURIComponent(cleanNumber)}`;
    if (typeof window !== 'undefined' && window.open) {
      window.open(url, '_system');
    }
  }

  /**
   * Sanitizes phone numbers for WhatsApp wa.me URLs (strictly digits only).
   * Strips '+', spaces, hyphens, brackets, and any non-digit characters.
   */
  static sanitizeWhatsAppPhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  /**
   * Opens WhatsApp with prefilled message text.
   * Prompts user in WhatsApp; does NOT send messages automatically.
   */
  static openWhatsApp(phoneDigits: string, text: string): void {
    const cleanDigits = this.sanitizeWhatsAppPhone(phoneDigits);
    if (!cleanDigits) return;
    const encodedText = encodeURIComponent(text);
    const url = `https://wa.me/${cleanDigits}?text=${encodedText}`;
    if (typeof window !== 'undefined' && window.open) {
      window.open(url, '_system');
    }
  }

  /**
   * Shares text, URLs, or local files (e.g. PDF catalogues) using the native Android Share sheet.
   */
  static async share(options: ShareOptions): Promise<boolean> {
    try {
      if (this.isNative()) {
        const canShare = await Share.canShare();
        if (canShare.value) {
          await Share.share({
            title: options.title,
            text: options.text,
            url: options.url,
            dialogTitle: options.dialogTitle || 'Share with Lead',
            files: options.files,
          });
          return true;
        }
      }

      // Web fallback
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: options.title,
          text: options.text,
          url: options.url,
        });
        return true;
      }

      return false;
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.warn('Native share failed or was cancelled:', err.message);
      }
      return false;
    }
  }

  /**
   * Subscribes to app state changes (active / background / resumed).
   * Used to detect when the rep returns from a phone call to trigger the outcome logging modal.
   */
  static addAppStateListener(callback: (isActive: boolean) => void): () => void {
    if (this.isNative()) {
      const listenerPromise = App.addListener('appStateChange', (state) => {
        callback(state.isActive);
      });
      return () => {
        listenerPromise.then((handle) => handle.remove());
      };
    }

    // Web visibility fallback
    const handleVisibilityChange = () => {
      callback(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }

  /**
   * Requests permission and schedules a local follow-up push reminder.
   */
  static async scheduleNotification(options: NotificationScheduleOptions): Promise<boolean> {
    try {
      if (this.isNative()) {
        const perm = await LocalNotifications.requestPermissions();
        if (perm.display !== 'granted') return false;

        await LocalNotifications.schedule({
          notifications: [
            {
              id: options.id,
              title: options.title,
              body: options.body,
              schedule: { at: options.scheduledAt },
              extra: options.extra,
            },
          ],
        });
        return true;
      }
      return false;
    } catch (err) {
      console.warn('Failed to schedule local notification:', err);
      return false;
    }
  }
}
