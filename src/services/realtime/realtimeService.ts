/**
 * Realtime Service (Phase 2K)
 * Manages organization-scoped Supabase Realtime WebSocket subscriptions,
 * non-destructive local Dexie acceleration, deduplication, conflict resolution,
 * and live UI event dispatching.
 */

import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../supabaseClient';
import { SalesCRMDatabase, getDatabase } from '../../db/database';
import { SyncConflictResolver } from '../sync/syncConflictResolver';
import { SyncPull } from '../sync/syncPull';
import { SyncEngine } from '../sync/syncEngine';
import { User, Lead, CallRecord, Activity, FollowUp, Remark } from '../../db/types';
import {
  RealtimeConnectionStatus,
  RealtimeInAppNotification,
  RealtimeStatusListener,
  RealtimeActivityListener,
  RealtimeNotificationListener,
  RealtimeEntityListener,
} from './realtimeTypes';

export class RealtimeService {
  private static customDb: SalesCRMDatabase | null = null;
  private static customClient: SupabaseClient | null = null;
  private static syncEngineInstance: SyncEngine | null = null;

  private static currentChannel: RealtimeChannel | null = null;
  private static currentUser: User | null = null;
  private static currentStatus: RealtimeConnectionStatus = 'DISCONNECTED';
  private static lastReconnectedAt: string | null = null;

  // Listeners
  private static statusListeners: Set<RealtimeStatusListener> = new Set();
  private static activityListeners: Set<RealtimeActivityListener> = new Set();
  private static notificationListeners: Set<RealtimeNotificationListener> = new Set();
  private static entityListeners: Set<RealtimeEntityListener> = new Set();

  /**
   * Overrides database for testing.
   */
  static setCustomDatabase(db: SalesCRMDatabase | null): void {
    this.customDb = db;
  }

  /**
   * Overrides Supabase client for testing.
   */
  static setCustomClient(client: SupabaseClient | null): void {
    this.customClient = client;
  }

  /**
   * Sets SyncEngine instance for reconnect reconciliation.
   */
  static setSyncEngine(engine: SyncEngine | null): void {
    this.syncEngineInstance = engine;
  }

  private static getDb(): SalesCRMDatabase {
    return this.customDb || getDatabase();
  }

  private static getClient(): SupabaseClient | null {
    return this.customClient || getSupabaseClient();
  }

  /**
   * Returns current realtime connection status.
   */
  static getStatus(): RealtimeConnectionStatus {
    return this.currentStatus;
  }

  /**
   * Returns currently subscribed user.
   */
  static getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Subscribes to status change events.
   */
  static onStatusChange(listener: RealtimeStatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.currentStatus);
    return () => this.statusListeners.delete(listener);
  }

  /**
   * Subscribes to incoming activity events (for Admin live feed).
   */
  static onActivity(listener: RealtimeActivityListener): () => void {
    this.activityListeners.add(listener);
    return () => this.activityListeners.delete(listener);
  }

  /**
   * Subscribes to in-app notifications (for Agent lead/followup alerts).
   */
  static onNotification(listener: RealtimeNotificationListener): () => void {
    this.notificationListeners.add(listener);
    return () => this.notificationListeners.delete(listener);
  }

  /**
   * Subscribes to entity changes (for targeted list/detail refresh).
   */
  static onEntityChange(listener: RealtimeEntityListener): () => void {
    this.entityListeners.add(listener);
    return () => this.entityListeners.delete(listener);
  }

  /**
   * Updates and broadcasts current connection status.
   */
  static setConnectionStatus(status: RealtimeConnectionStatus): void {
    const prevStatus = this.currentStatus;
    this.currentStatus = status;

    if (
      status === 'SUBSCRIBED' &&
      (prevStatus === 'DISCONNECTED' || prevStatus === 'RECONNECTING' || prevStatus === 'ERROR')
    ) {
      this.lastReconnectedAt = new Date().toISOString();
      this.handleReconnectedReconciliation();
    }

    this.statusListeners.forEach((l) => {
      try {
        l(status);
      } catch (err) {
        console.warn('Realtime status listener error:', err);
      }
    });
  }

  /**
   * On reconnect, triggers sync pull to reconcile any changes missed while offline/disconnected.
   */
  private static async handleReconnectedReconciliation(): Promise<void> {
    try {
      if (this.syncEngineInstance) {
        await this.syncEngineInstance.triggerSync();
      } else {
        const pull = new SyncPull(this.getDb());
        const client = this.getClient();
        if (client) {
          await pull.pullAllChanges(null, client);
        }
      }
    } catch (err) {
      console.warn('Reconnection sync reconciliation error:', err);
    }
  }

  /**
   * Initializes organization-scoped Realtime subscriptions.
   */
  static async init(user: User | null): Promise<boolean> {
    if (!user || user.status !== 'ACTIVE') {
      this.unsubscribe();
      return false;
    }

    // If already subscribed for same user and active, do nothing
    if (this.currentUser?.id === user.id && this.currentStatus === 'SUBSCRIBED') {
      return true;
    }

    this.currentUser = user;
    this.setConnectionStatus('SUBSCRIBING');

    const client = this.getClient();
    if (!client) {
      this.setConnectionStatus('DISCONNECTED');
      return false;
    }

    // Clean up previous channel if any
    if (this.currentChannel) {
      await client.removeChannel(this.currentChannel);
      this.currentChannel = null;
    }

    const orgId = user.organizationId || 'default';
    const channelName = `org_${orgId}_${user.role.toLowerCase()}_${user.id.substring(0, 8)}`;

    try {
      const channel = client.channel(channelName);

      // Subscribe to organization-filtered postgres changes
      const tables = [
        'leads',
        'call_records',
        'activities',
        'remarks',
        'follow_ups',
        'message_history',
        'profiles',
        'import_audits',
      ];

      for (const table of tables) {
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: table,
            filter: `organization_id=eq.${orgId}`,
          },
          (payload) => {
            this.handleIncomingPostgresChange(table, payload.eventType, payload.new || payload.old);
          }
        );
      }

      channel.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          this.setConnectionStatus('SUBSCRIBED');
        } else if (status === 'CLOSED' || status === 'TIMED_OUT') {
          this.setConnectionStatus('DISCONNECTED');
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('Realtime channel error:', err);
          this.setConnectionStatus('ERROR');
        }
      });

      this.currentChannel = channel;
      return true;
    } catch (err) {
      console.warn('Failed to initialize Realtime channel:', err);
      this.setConnectionStatus('ERROR');
      return false;
    }
  }

  /**
   * Processes incoming postgres changes and non-destructively reconciles into local Dexie.
   */
  static async handleIncomingPostgresChange(
    table: string,
    eventType: 'INSERT' | 'UPDATE' | 'DELETE',
    row: any
  ): Promise<void> {
    if (!row || !row.id) return;

    try {
      const db = this.getDb();
      const transformed = SyncPull.transformFromPgRecord(table as any, row);

      switch (table) {
        case 'activities': {
          const existing = await db.activities.get(transformed.id);
          if (!existing) {
            await db.activities.put(transformed as any);
            const act = transformed as Activity;
            this.activityListeners.forEach((l) => l(act));

            // Check if in-app notification should be dispatched
            this.evaluateInAppNotification(act);
          }
          break;
        }

        case 'call_records': {
          const existing = await db.callRecords.get(transformed.id);
          const resolved = SyncConflictResolver.resolveCallRecord(existing, transformed as any);
          if (resolved.winner === 'REMOTE') {
            await db.callRecords.put(resolved.data as any);
          }
          break;
        }

        case 'leads': {
          const existing = await db.leads.get(transformed.id);
          const resolved = SyncConflictResolver.resolveMutable('leads', existing, transformed as any);
          if (resolved.winner === 'REMOTE') {
            await db.leads.put(resolved.data as any);
          }
          break;
        }

        case 'follow_ups': {
          const existing = await db.followUps.get(transformed.id);
          const resolved = SyncConflictResolver.resolveMutable('follow_ups', existing, transformed as any);
          if (resolved.winner === 'REMOTE') {
            await db.followUps.put(resolved.data as any);
          }
          break;
        }

        case 'remarks': {
          const existing = await db.remarks.get(transformed.id);
          const resolved = SyncConflictResolver.resolveMutable('remarks', existing, transformed as any);
          if (resolved.winner === 'REMOTE') {
            await db.remarks.put(resolved.data as any);
          }
          break;
        }

        case 'profiles': {
          const existing = await db.users.get(transformed.id);
          const resolved = SyncConflictResolver.resolveMutable('profiles', existing, transformed as any);
          if (resolved.winner === 'REMOTE') {
            await db.users.put(resolved.data as any);
          }
          break;
        }

        case 'import_audits': {
          const existing = await db.importAudits.get(transformed.id);
          if (!existing) {
            await db.importAudits.put(transformed as any);
          }
          break;
        }
      }

      // Notify generic entity listeners for UI refresh
      this.entityListeners.forEach((l) => {
        try {
          l(table, eventType, transformed);
        } catch (e) {
          console.warn('Entity listener error:', e);
        }
      });
    } catch (err) {
      console.warn(`Error processing realtime event for ${table}:`, err);
    }
  }

  /**
   * Generates lightweight in-app notifications for the active user.
   */
  private static evaluateInAppNotification(activity: Activity): void {
    if (!this.currentUser) return;
    const meta = activity.metadata || {};

    // Assignment alert for agent
    if (
      activity.activityType === 'LEAD_ASSIGNED' ||
      activity.activityType === 'LEAD_REASSIGNED'
    ) {
      if (meta.newAssigneeId === this.currentUser.id) {
        const notif: RealtimeInAppNotification = {
          id: `notif_${activity.id}`,
          type: 'ASSIGNMENT',
          title: 'New Lead Assigned',
          message: `Admin assigned "${meta.leadName || 'a lead'}" to you.`,
          timestamp: activity.createdAt,
          leadId: activity.leadId || undefined,
          actorName: meta.assignedByAdminName || 'Admin',
        };
        this.notificationListeners.forEach((l) => l(notif));
      } else if (meta.previousAssigneeId === this.currentUser.id) {
        const notif: RealtimeInAppNotification = {
          id: `notif_${activity.id}`,
          type: 'ASSIGNMENT',
          title: 'Lead Reassigned',
          message: `Lead "${meta.leadName || ''}" was reassigned by Admin.`,
          timestamp: activity.createdAt,
          leadId: activity.leadId || undefined,
          actorName: meta.assignedByAdminName || 'Admin',
        };
        this.notificationListeners.forEach((l) => l(notif));
      }
    }

    // Follow-up alert for agent
    if (activity.activityType === 'FOLLOW_UP_CREATED' && meta.assignedTo === this.currentUser.id) {
      const notif: RealtimeInAppNotification = {
        id: `notif_${activity.id}`,
        type: 'FOLLOW_UP',
        title: 'New Follow-Up Scheduled',
        message: `${meta.title || 'Follow-up'} scheduled for ${meta.scheduledAt ? new Date(meta.scheduledAt).toLocaleDateString() : 'soon'}.`,
        timestamp: activity.createdAt,
        leadId: activity.leadId || undefined,
        actorName: meta.createdByName || 'Sales Rep',
      };
      this.notificationListeners.forEach((l) => l(notif));
    }
  }

  /**
   * Cleans up channel subscriptions on logout or inactive session.
   */
  static async unsubscribe(): Promise<void> {
    this.currentUser = null;
    this.setConnectionStatus('DISCONNECTED');

    if (this.currentChannel) {
      const client = this.getClient();
      if (client) {
        try {
          await client.removeChannel(this.currentChannel);
        } catch (err) {
          console.warn('Error removing realtime channel:', err);
        }
      }
      this.currentChannel = null;
    }
  }

  /**
   * Clears all registered listeners.
   */
  static resetListeners(): void {
    this.statusListeners.clear();
    this.activityListeners.clear();
    this.notificationListeners.clear();
    this.entityListeners.clear();
  }
}
