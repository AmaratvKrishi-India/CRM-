import { isSyncEntityType, remoteSyncRecord, syncTable } from '../sync/syncRecords';
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
import { accessScopeFromUser, canAccessLead, sameAccessScope, type AccessScope } from '../../db/accessScope';
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

function metadataText(metadata: Record<string, unknown>, key: string, fallback = ''): string {
  const value = metadata[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
}

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
  private static notifyEntityListeners(table: string, eventType: 'INSERT' | 'UPDATE' | 'DELETE', record: Record<string, unknown>): void {
    this.entityListeners.forEach((listener) => {
      try {
        listener(table, eventType, record);
      } catch (error) {
        console.warn('Entity listener error:', error);
      }
    });
  }

  private static async isAuthorizedRecord(
    db: SalesCRMDatabase,
    scope: AccessScope,
    table: Parameters<typeof syncTable>[1],
    transformed: Record<string, unknown>,
  ): Promise<boolean> {
    if (scope.role === 'ADMIN') return true;
    if (table === 'leads') return canAccessLead(scope, transformed as unknown as Lead);
    if (table === 'profiles') return transformed.id === scope.userId;
    if (table === 'import_audits') return transformed.uploadedBy === scope.userId;
    if (table === 'bulk_assignment_audits') return false;
    if (typeof transformed.leadId === 'string') {
      const lead = await db.leads.get(transformed.leadId);
      return !!lead && canAccessLead(scope, lead);
    }
    return table === 'activities' && transformed.userId === scope.userId;
  }

  private static async applyDeleteEvent(
    db: SalesCRMDatabase,
    scope: AccessScope,
    table: Parameters<typeof syncTable>[1],
    row: Record<string, unknown>,
  ): Promise<void> {
    const tableRef = syncTable(db, table);
    const existing = await tableRef.get(String(row.id));
    if (serverRevision(existing) !== undefined && serverRevision(row) !== undefined &&
        serverRevision(existing)! > serverRevision(row)!) return;
    if (table === 'leads') await pruneLeadData(db, [String(row.id)], scope, true);
    else await tableRef.delete(String(row.id));
  }

  private static async applyUpsertEvent(
    db: SalesCRMDatabase,
    scope: AccessScope,
    table: Parameters<typeof syncTable>[1],
    row: Record<string, unknown>,
  ): Promise<void> {
    switch (table) {
      case 'activities': {
        const record = SyncPull.transformFromPgRecord('activities', row);
        if (!(await db.activities.get(record.id))) {
          await db.activities.put(record);
          const activity = record as Activity;
          this.activityListeners.forEach((listener) => listener(activity));
          this.evaluateInAppNotification(activity);
        }
        return;
      }
      case 'call_records': {
        const record = SyncPull.transformFromPgRecord('call_records', row);
        const resolved = SyncConflictResolver.resolveCallRecord(await db.callRecords.get(record.id), record);
        if (resolved.winner === 'REMOTE') await db.callRecords.put(resolved.data);
        return;
      }
      case 'profiles': {
        const record = SyncPull.transformFromPgRecord('profiles', row);
        if (record.id === scope.userId && this.currentUser &&
            (record.status !== this.currentUser.status || record.role !== this.currentUser.role)) {
          void this.syncEngineInstance?.triggerSync();
          return;
        }
        const resolved = SyncConflictResolver.resolveMutable('profiles', await db.users.get(record.id), record);
        if (resolved.winner === 'REMOTE') await db.users.put(resolved.data);
        return;
      }
      case 'import_audits': {
        const record = SyncPull.transformFromPgRecord('import_audits', row);
        if (!(await db.importAudits.get(record.id))) await db.importAudits.put(record);
        return;
      }
      case 'message_history': {
        const record = SyncPull.transformFromPgRecord('message_history', row);
        if (!(await db.messageHistory.get(record.id))) await db.messageHistory.put(record);
        return;
      }
      case 'bulk_assignment_audits': {
        const record = SyncPull.transformFromPgRecord('bulk_assignment_audits', row);
        if (!(await db.bulkAssignmentAudits.get(record.id))) await db.bulkAssignmentAudits.put(record);
        return;
      }
      default: {
        const record = SyncPull.transformFromPgRecord(table, row);
        const tableRef = syncTable(db, table);
        const resolved = SyncConflictResolver.resolveMutable(table, await tableRef.get(record.id), record);
        if (resolved.winner === 'REMOTE') await tableRef.put(resolved.data);
      }
    }
  }

  /** Processes incoming postgres changes and reconciles them into local Dexie. */
  static async handleIncomingPostgresChange(
    table: string,
    eventType: 'INSERT' | 'UPDATE' | 'DELETE',
    input: unknown,
    expectedGeneration: number = this.subscriptionGeneration
  ): Promise<void> {
    if (!isSyncEntityType(table) || expectedGeneration !== this.subscriptionGeneration) return;

    try {
      const row = remoteSyncRecord(input);
      const db = this.getDb();
      await db.transaction('rw', db.tables, async () => {
        const scope = db.requireAccessScope();
        db.markRemoteSyncWrites();
        if (this.currentUser && !sameAccessScope(accessScopeFromUser(this.currentUser), scope)) return;
        if (row.organization_id !== scope.organizationId) return;

        const tableRef = syncTable(db, table);
        const current = await tableRef.get(row.id);
        if (serverRevision(current) !== undefined && serverRevision(row) !== undefined &&
            serverRevision(current)! > serverRevision(row)!) return;

        const transformed = SyncPull.transformFromPgRecord(table, row);
        if (!(await this.isAuthorizedRecord(db, scope, table, transformed))) {
          if (table === 'leads') await pruneLeadData(db, [row.id], scope);
          return;
        }

        if (eventType === 'DELETE') await this.applyDeleteEvent(db, scope, table, row);
        else await this.applyUpsertEvent(db, scope, table, row);

        this.notifyEntityListeners(table, eventType, transformed);
      });
    } catch (err) {
      console.warn('Error processing realtime event for table %s:', table, err);
    }
  }

  /**
   * Generates lightweight in-app notifications for the active user.
   */
  private static assignmentNotification(activity: Activity, user: User): RealtimeInAppNotification | null {
    if (activity.activityType !== 'LEAD_ASSIGNED' && activity.activityType !== 'LEAD_REASSIGNED') return null;
    const meta = activity.metadata || {};
    const base = {
      id: `notif_${activity.id}`,
      type: 'ASSIGNMENT' as const,
      timestamp: activity.createdAt,
      leadId: activity.leadId || undefined,
      actorName: String(meta.assignedByAdminName ?? '') || 'Admin',
    };
    if (metadataText(meta, 'newAssigneeId') === user.id) {
      return {
        ...base,
        title: 'New Lead Assigned',
        message: `Admin assigned "${String(meta.leadName ?? '') || 'a lead'}" to you.`,
      };
    }
    if (metadataText(meta, 'previousAssigneeId') === user.id) {
      return {
        ...base,
        title: 'Lead Reassigned',
        message: `Lead "${String(meta.leadName ?? '') || ''}" was reassigned by Admin.`,
      };
    }
    return null;
  }

  private static followUpNotification(activity: Activity, user: User): RealtimeInAppNotification | null {
    const meta = activity.metadata || {};
    if (activity.activityType !== 'FOLLOW_UP_CREATED' || metadataText(meta, 'assignedTo') !== user.id) return null;
    const scheduledAt = String(meta.scheduledAt ?? '');
    return {
      id: `notif_${activity.id}`,
      type: 'FOLLOW_UP',
      title: 'New Follow-Up Scheduled',
      message: `${String(meta.title ?? '') || 'Follow-up'} scheduled for ${scheduledAt ? new Date(scheduledAt).toLocaleDateString() : 'soon'}.`,
      timestamp: activity.createdAt,
      leadId: activity.leadId || undefined,
      actorName: String(meta.createdByName ?? '') || 'Sales Rep',
    };
  }

  /** Generates lightweight in-app notifications for the active user. */
  private static evaluateInAppNotification(activity: Activity): void {
    if (!this.currentUser) return;
    const notification = this.assignmentNotification(activity, this.currentUser)
      || this.followUpNotification(activity, this.currentUser);
    if (notification) this.notificationListeners.forEach((listener) => listener(notification));
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
