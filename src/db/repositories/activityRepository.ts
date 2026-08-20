/**
 * Activity Repository (Phase 2B)
 * Manages the append-only immutable event log for all lead operations.
 */

import { SalesCRMDatabase } from '../database';
import { Activity, ActivityType } from '../types';

export class ActivityRepository {
  constructor(private db: SalesCRMDatabase) {}

  private generateId(): string {
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
   * Appends an immutable activity record.
   */
  async logActivity(input: {
    id?: string;
    leadId?: string | null;
    userId: string;
    activityType: ActivityType;
    metadata?: Record<string, any>;
    deviceId?: string | null;
  }): Promise<Activity> {
    const now = new Date().toISOString();
    const activity: Activity = {
      id: input.id || this.generateId(),
      leadId: input.leadId || null,
      userId: input.userId,
      deviceId: input.deviceId || null,
      activityType: input.activityType,
      metadata: input.metadata || {},
      createdAt: now,
      updatedAt: now,
      isSynced: 0,
      deletedAt: null,
    };

    await this.db.activities.add(activity);
    return activity;
  }

  /**
   * Retrieves all activities for a given lead, sorted newest to oldest.
   */
  async getActivitiesForLead(leadId: string): Promise<Activity[]> {
    return await this.db.activities
      .where('leadId')
      .equals(leadId)
      .and((a) => a.deletedAt === null)
      .reverse()
      .sortBy('createdAt');
  }

  /**
   * Retrieves all activities performed by a specific user.
   */
  async getActivitiesByUser(userId: string, limit = 100): Promise<Activity[]> {
    const activities = await this.db.activities
      .where('userId')
      .equals(userId)
      .and((a) => a.deletedAt === null)
      .reverse()
      .sortBy('createdAt');

    return activities.slice(0, limit);
  }

  /**
   * Retrieves the latest system-wide activities.
   */
  async getRecentActivities(limit = 50): Promise<Activity[]> {
    const activities = await this.db.activities
      .filter((a) => a.deletedAt === null)
      .reverse()
      .sortBy('createdAt');

    return activities.slice(0, limit);
  }
}
