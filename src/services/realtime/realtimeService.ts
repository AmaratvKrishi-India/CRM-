/**
 * Realtime Service (Phase 2K)
 * Manages organization-scoped Supabase Realtime WebSocket subscriptions,
 * non-destructive local Dexie acceleration, deduplication, conflict resolution,
 * and live UI event dispatching.
 */

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../supabaseClient';
import type { SalesCRMDatabase} from '../../db/database';
import { getDatabase } from '../../db/database';
import { SyncConflictResolver } from '../sync/syncConflictResolver';
import { SyncPull } from '../sync/syncPull';
import { serverRevision } from '../sync/syncTypes';
import type { SyncEngine } from '../sync/syncEngine';
import { accessScopeFromUser, canAccessLead, sameAccessScope } from '../../db/accessScope';
import { pruneLeadData } from '../../db/pruning';
import type { User, Lead, Activity} from '../../db/types';
import type {
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
  private static subscriptionGeneration = 0;

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

    if (!user.organizationId) {
      await this.unsubscribe();
      return false;
    }
    const requestedScope = accessScopeFromUser(user);
    try {
      this.getDb().requireAccessScope(requestedScope);
    } catch {
      await this.unsubscribe();
      return false;
    }

    // If already subscribed for the exact same account context, do nothing.
    if (
      this.currentUser &&
      sameAccessScope(accessScopeFromUser(this.currentUser), requestedScope) &&
      this.currentStatus === 'SUBSCRIBED'
    ) {
      return true;
    }

    const generation = ++this.subscriptionGeneration;
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

    const orgId = user.organizationId;
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
        'bulk_assignment_audits',
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
            if (generation !== this.subscriptionGeneration) return;
            return this.handleIncomingPostgresChange(
              table,
              payload.eventType,
              payload.new || payload.old,
              generation
            );
          }
        );
      }

      channel.subscribe((status, err) => {
        if (generation !== this.subscriptionGeneration) return;
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
    row: any,
    expectedGeneration: number = this.subscriptionGeneration
  ): Promise<void> {
    if (!row || !row.id) return;
    if (expectedGeneration !== this.subscriptionGeneration) return;

    try {
      const db = this.getDb();
      await db.transaction('rw', db.tables, async () => {
      const scope = db.requireAccessScope();
      db.markRemoteSyncWrites();
      if (this.currentUser && !sameAccessScope(accessScopeFromUser(this.currentUser), scope)) return;
      if (row.organization_id !== scope.organizationId) return;
      const names: Record<string, string> = { leads:'leads',call_records:'callRecords',activities:'activities',
        remarks:'remarks',follow_ups:'followUps',message_history:'messageHistory',profiles:'users',
        import_audits:'importAudits',bulk_assignment_audits:'bulkAssignmentAudits' };
      const current = names[table] ? await db.table(names[table]).get(row.id) : undefined;
      if (serverRevision(current) !== undefined && serverRevision(row) !== undefined &&
          serverRevision(current)! > serverRevision(row)!) return;

      const transformed = SyncPull.transformFromPgRecord(table as any, row);
      const leadId = transformed.leadId;
      let authorized = scope.role === 'ADMIN';
      if (scope.role === 'AGENT') {
        if (table === 'leads') authorized = canAccessLead(scope, transformed as Lead);
        else if (table === 'profiles') authorized = transformed.id === scope.userId;
        else if (table === 'import_audits') authorized = transformed.uploadedBy === scope.userId;
        else if (table === 'bulk_assignment_audits') authorized = false;
        else if (typeof leadId === 'string') {
          const lead = await db.leads.get(leadId);
          authorized = !!lead && canAccessLead(scope, lead);
        } else {
          authorized = table === 'activities' && transformed.userId === scope.userId;
        }
      }

      if (!authorized) {
        if (table === 'leads') await pruneLeadData(db, [row.id], scope);
        return;
      }

      // DELETE events (REPLICA IDENTITY FULL carries the full old row):
      // remove the local row. Without this branch the upsert path below
      // would re-insert the deleted row on every other device. Pull sync
      // only fetches rows that still exist in the cloud, so realtime is
      // the only mechanism that can propagate hard deletes — it must
      // delete, not resurrect. Dexie delete of an unknown id is a no-op.
      if (eventType === 'DELETE') {
        const deleteTableMap: Record<string, any> = {
          leads: db.leads,
          call_records: db.callRecords,
          activities: db.activities,
          remarks: db.remarks,
          follow_ups: db.followUps,
          message_history: db.messageHistory,
          profiles: db.users,
          import_audits: db.importAudits,
        };
        const deleteTable = deleteTableMap[table];
        const existing = deleteTable ? await deleteTable.get(row.id) : undefined;
        // A delayed delete for an older incarnation must not remove a newer
        // authoritative row already delivered by pull or Realtime.
        if (serverRevision(existing) !== undefined && serverRevision(row) !== undefined &&
            serverRevision(existing)! > serverRevision(row)!) return;
        if (table === 'leads') {
          await pruneLeadData(db, [row.id], scope, true);
        } else if (deleteTable) {
          await deleteTable.delete(row.id);
        }

        // Notify generic entity listeners so the UI refreshes.
        this.entityListeners.forEach((l) => {
          try {
            l(table, eventType, transformed);
          } catch (e) {
            console.warn('Entity listener error:', e);
          }
        });
        return;
      }

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
          if (transformed.id === scope.userId && this.currentUser && (
            transformed.status !== this.currentUser.status || transformed.role !== this.currentUser.role
          )) {
            // Recalculate the database/sync context through server-authoritative
            // authentication; never mutate the active role in place.
            void this.syncEngineInstance?.triggerSync();
            break;
          }
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

        case 'message_history': {
          // Append-only entity: insert-if-absent, same pattern as import_audits.
          const existing = await db.messageHistory.get(transformed.id);
          if (!existing) {
            await db.messageHistory.put(transformed as any);
          }
          break;
        }

        case 'bulk_assignment_audits': {
          const existing = await db.bulkAssignmentAudits.get(transformed.id);
          if (!existing) await db.bulkAssignmentAudits.put(transformed as any);
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
      });
    } catch (err) {
      console.warn('Error processing realtime event for table %s:', table, err);
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
    this.subscriptionGeneration++;
    this.currentUser = null;
    this.syncEngineInstance = null;
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
