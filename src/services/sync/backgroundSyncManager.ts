/**
 * Background Sync Manager (Phase 3)
 * Central singleton that manages the full automatic sync lifecycle.
 * Triggers sync on: startup, login, network reconnect, app resume, periodic interval.
 * NEVER asks the user to sync. Sync is silent and automatic.
 *
 * Android/WebView limitations: JavaScript does not run continuously after the
 * app is fully killed by the OS. This manager handles all foreground and
 * visibility-change triggers reliably. For persistent background delivery,
 * a native WorkManager service would be needed (not implemented to avoid
 * unnecessary permissions).
 */

import { App as CapacitorApp } from '@capacitor/app';
import { crmData } from '../../db';
import type { SyncEngine } from './syncEngine';
import type { User } from '../../db/types';

// Exponential backoff config
const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 32000;
const MAX_RETRY_ATTEMPTS = 6;
const AUTO_SYNC_INTERVAL_MS = 60_000; // 60 seconds

class BackgroundSyncManagerClass {
  private currentUser: User | null = null;
  private autoIntervalId: ReturnType<typeof setInterval> | null = null;
  private backoffRetryId: ReturnType<typeof setTimeout> | null = null;
  private retryCount = 0;
  private isInitialized = false;
  private currentEngine: SyncEngine | null = null;
  private generation = 0;

  // Capacitor listener handle
  private appStateListener: (() => void) | null = null;

  /**
   * Call this immediately after a successful login.
   * Starts auto-sync, registers all lifecycle listeners.
   */
  async init(user: User): Promise<void> {
    if (
      this.isInitialized &&
      this.currentUser?.id === user.id &&
      this.currentUser.organizationId === user.organizationId &&
      this.currentUser.role === user.role
    ) return;
    if (this.isInitialized) this.stop();

    this.currentUser = user;
    this.currentEngine = crmData.syncEngine;
    this.isInitialized = true;
    this.retryCount = 0;
    this.generation++;

    // Immediate initial sync on login
    this.triggerSilentSync();

    // Periodic interval sync (foreground only)
    this.startInterval();

    // Visibility change (browser tab / Android resume via WebView)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    // Focus event (re-enters after screen lock or app switch)
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', this.handleFocus);
      window.addEventListener('online', this.handleOnline);
    }

    // Capacitor App State Change (Android lifecycle — foreground/background)
    try {
      const handle = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          this.triggerSilentSync();
        }
      });
      this.appStateListener = () => handle.remove();
    } catch {
      // Non-Capacitor environment (web preview)
    }
  }

  /**
   * Call this on logout. Stops all listeners and sync intervals.
   */
  stop(): void {
    this.generation++;
    this.currentUser = null;
    this.isInitialized = false;
    this.retryCount = 0;

    this.stopInterval();
    this.cancelBackoffRetry();

    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', this.handleFocus);
      window.removeEventListener('online', this.handleOnline);
    }

    this.appStateListener?.();
    this.appStateListener = null;

    this.currentEngine?.dispose();
    this.currentEngine = null;
  }

  /**
   * Triggers a silent background sync. If sync fails, schedules exponential backoff retry.
   */
  async triggerSilentSync(): Promise<void> {
    if (!this.currentUser || !this.currentEngine) return;
    const generation = this.generation;
    const engine = this.currentEngine;

    try {
      const result = await engine.triggerSync();
      if (generation !== this.generation || engine !== this.currentEngine) return;

      if (result && result.error) {
        this.scheduleBackoffRetry();
      } else {
        // Success: reset backoff
        this.retryCount = 0;
        this.cancelBackoffRetry();
      }
    } catch {
      if (generation !== this.generation || engine !== this.currentEngine) return;
      this.scheduleBackoffRetry();
    }
  }

  private startInterval(): void {
    this.stopInterval();
    // Single periodic trigger: this manager owns the interval so that failures
    // can be retried with exponential backoff. Running syncEngine.startAutoSync()
    // here as well would fire two overlapping sync loops per minute.
    this.autoIntervalId = setInterval(() => {
      this.triggerSilentSync();
    }, AUTO_SYNC_INTERVAL_MS);
  }

  private stopInterval(): void {
    if (this.autoIntervalId !== null) {
      clearInterval(this.autoIntervalId);
      this.autoIntervalId = null;
    }
    // Defensive: ensure no engine-owned interval is left running.
    this.currentEngine?.stopAutoSync();
  }

  private scheduleBackoffRetry(): void {
    if (this.retryCount >= MAX_RETRY_ATTEMPTS) return;

    this.cancelBackoffRetry();
    const delayMs = Math.min(BACKOFF_BASE_MS * Math.pow(2, this.retryCount), BACKOFF_MAX_MS);
    this.retryCount++;

    this.backoffRetryId = setTimeout(() => {
      this.triggerSilentSync();
    }, delayMs);
  }

  private cancelBackoffRetry(): void {
    if (this.backoffRetryId !== null) {
      clearTimeout(this.backoffRetryId);
      this.backoffRetryId = null;
    }
  }

  // Arrow functions to preserve `this` context in event listeners
  private handleVisibilityChange = (): void => {
    if (typeof document !== 'undefined' && !document.hidden) {
      this.triggerSilentSync();
    }
  };

  private handleFocus = (): void => {
    this.triggerSilentSync();
  };

  private handleOnline = (): void => {
    this.retryCount = 0;
    this.triggerSilentSync();
  };
}

// Export global singleton
export const BackgroundSyncManager = new BackgroundSyncManagerClass();
