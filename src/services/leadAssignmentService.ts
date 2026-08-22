/**
 * Lead Assignment & Reassignment Service (Phase 2I)
 * Manages multi-user lead ownership, pipeline reassignment, and immutable audit activity logging.
 * Strictly verifies Admin authorization and prevents assignment to inactive or invalid accounts.
 */

import { crmData } from '../db';
import { SalesCRMDatabase } from '../db/database';
import { LeadRepository } from '../db/repositories/leadRepository';
import { UserRepository } from '../db/repositories/userRepository';
import { ActivityRepository } from '../db/repositories/activityRepository';
import { BulkAssignmentAuditRepository } from '../db/repositories/bulkAssignmentAuditRepository';
import { SyncQueue } from './sync/syncQueue';
import { DeviceService } from './deviceService';
import { User, Lead, Activity } from '../db/types';

export interface AssignmentStats {
  totalLeads: number;
  unassignedCount: number;
  assignedCount: number;
  byAgent: Record<string, number>;
}

let customDb: SalesCRMDatabase | null = null;

export class LeadAssignmentService {
  /**
   * Sets custom database instance (for test isolation).
   */
  static setCustomDatabase(db: SalesCRMDatabase | null): void {
    customDb = db;
  }

  private static getLeadRepo(): LeadRepository {
    return customDb ? new LeadRepository(customDb) : crmData.leads;
  }

  private static getUserRepo(): UserRepository {
    return customDb ? new UserRepository(customDb) : crmData.users;
  }

  private static getActivityRepo(): ActivityRepository {
    return customDb ? new ActivityRepository(customDb) : crmData.activities;
  }

  private static getBulkAuditRepo(): BulkAssignmentAuditRepository {
    return customDb ? new BulkAssignmentAuditRepository(customDb) : crmData.bulkAssignmentAudits;
  }

  private static getSyncQueue(): SyncQueue {
    return customDb ? new SyncQueue(customDb) : crmData.syncQueue;
  }

  /**
   * Asserts that the actor is an authenticated ADMIN.
   */
  private static assertAdmin(actor: User | null): asserts actor is User {
    if (!actor) {
      throw new Error('Unauthorized: No authenticated user session.');
    }
    if (actor.role !== 'ADMIN') {
      throw new Error('Unauthorized: Only administrators are permitted to assign or reassign leads.');
    }
    if (actor.status !== 'ACTIVE') {
      throw new Error('Unauthorized: Inactive administrator account.');
    }
  }

  /**
   * Assigns or reassigns a lead to an active sales agent.
   * Generates an immutable LEAD_ASSIGNED or LEAD_REASSIGNED activity audit event.
   */
  static async assignLead(
    actor: User | null,
    leadId: string,
    targetAgentId: string
  ): Promise<{ lead: Lead; auditActivity: Activity }> {
    this.assertAdmin(actor);

    const leadRepo = this.getLeadRepo();
    const userRepo = this.getUserRepo();
    const activityRepo = this.getActivityRepo();
    const syncQueue = this.getSyncQueue();

    // 1. Validate Lead exists
    const lead = await leadRepo.getLeadById(leadId);
    if (!lead) {
      throw new Error(`Lead with ID "${leadId}" not found.`);
    }

    // 2. Validate Target Agent exists, is an AGENT, and is ACTIVE
    const targetAgent = await userRepo.getUserById(targetAgentId);
    if (!targetAgent) {
      throw new Error(`Target agent with ID "${targetAgentId}" not found.`);
    }

    if (targetAgent.role !== 'AGENT') {
      throw new Error('Leads can only be assigned to sales representatives with the AGENT role.');
    }

    if (targetAgent.status !== 'ACTIVE') {
      throw new Error(`Cannot assign lead to inactive agent "${targetAgent.name}".`);
    }

    const previousAssigneeId = lead.assignedTo || null;
    const isReassignment = !!previousAssigneeId && previousAssigneeId !== targetAgentId;

    // If already assigned to this agent, return existing
    if (previousAssigneeId === targetAgentId) {
      const existingActivities = await activityRepo.getActivitiesForLead(leadId);
      return { lead, auditActivity: existingActivities[0] || ({} as Activity) };
    }

    let previousAssigneeName: string | null = null;
    if (previousAssigneeId) {
      const prevUser = await userRepo.getUserById(previousAssigneeId);
      previousAssigneeName = prevUser ? prevUser.name : 'Unknown Agent';
    }

    // 3. Update Lead in Dexie
    const now = new Date().toISOString();
    const updatedLead = await leadRepo.updateLead(leadId, {
      assignedTo: targetAgentId,
      updatedBy: actor.id,
    });

    // 4. Append immutable activity audit record
    const deviceId = DeviceService.getDeviceId();
    const activityType = isReassignment ? 'LEAD_REASSIGNED' : 'LEAD_ASSIGNED';
    const auditActivity = await activityRepo.logActivity({
      leadId,
      userId: actor.id,
      deviceId,
      activityType,
      metadata: {
        leadId,
        leadName: lead.businessName,
        previousAssigneeId,
        previousAssigneeName,
        newAssigneeId: targetAgent.id,
        newAssigneeName: targetAgent.name,
        assignedByAdminId: actor.id,
        assignedByAdminName: actor.name,
        assignedAt: now,
      },
    });

    return { lead: updatedLead, auditActivity };
  }

  /**
   * Removes assignment from a lead (sets assignedTo to null).
   */
  static async unassignLead(
    actor: User | null,
    leadId: string
  ): Promise<{ lead: Lead; auditActivity: Activity }> {
    this.assertAdmin(actor);

    const leadRepo = this.getLeadRepo();
    const userRepo = this.getUserRepo();
    const activityRepo = this.getActivityRepo();
    const syncQueue = this.getSyncQueue();

    const lead = await leadRepo.getLeadById(leadId);
    if (!lead) {
      throw new Error(`Lead with ID "${leadId}" not found.`);
    }

    if (!lead.assignedTo) {
      return { lead, auditActivity: {} as Activity };
    }

    const previousAssigneeId = lead.assignedTo;
    const prevUser = await userRepo.getUserById(previousAssigneeId);
    const previousAssigneeName = prevUser ? prevUser.name : 'Unknown Agent';

    const now = new Date().toISOString();
    const updatedLead = await leadRepo.updateLead(leadId, {
      assignedTo: null,
      updatedBy: actor.id,
    });

    const deviceId = DeviceService.getDeviceId();
    const auditActivity = await activityRepo.logActivity({
      leadId,
      userId: actor.id,
      deviceId,
      activityType: 'LEAD_UNASSIGNED',
      metadata: {
        leadId,
        leadName: lead.businessName,
        previousAssigneeId,
        previousAssigneeName,
        unassignedByAdminId: actor.id,
        unassignedByAdminName: actor.name,
        unassignedAt: now,
      },
    });

    return { lead: updatedLead, auditActivity };
  }

  /**
   * Computes real assignment stats from local database.
   */
  static async getAssignmentStats(actor: User | null): Promise<AssignmentStats> {
    this.assertAdmin(actor);

    const leadRepo = this.getLeadRepo();
    const { leads } = await leadRepo.searchAndFilterLeads({ limit: 10000 });

    let unassignedCount = 0;
    let assignedCount = 0;
    const byAgent: Record<string, number> = {};

    for (const l of leads) {
      if (!l.assignedTo) {
        unassignedCount++;
      } else {
        assignedCount++;
        byAgent[l.assignedTo] = (byAgent[l.assignedTo] || 0) + 1;
      }
    }

    return {
      totalLeads: leads.length,
      unassignedCount,
      assignedCount,
      byAgent,
    };
  }

  /**
   * Assigns multiple leads to an active sales agent in a single atomic batch operation.
   * Creates individual immutable activity logs and a parent BulkAssignmentAudit record.
   */
  static async bulkAssignLeads(
    actor: User | null,
    leadIds: string[],
    targetAgentId: string,
    filterSnapshot?: Record<string, any>
  ): Promise<{
    successfulCount: number;
    failedCount: number;
    updatedLeadIds: string[];
    errors: string[];
  }> {
    this.assertAdmin(actor);

    if (!leadIds || leadIds.length === 0) {
      throw new Error('No leads selected for bulk assignment.');
    }

    const startedAt = new Date().toISOString();
    const userRepo = this.getUserRepo();
    const leadRepo = this.getLeadRepo();
    const activityRepo = this.getActivityRepo();
    const syncQueue = this.getSyncQueue();
    const bulkAuditRepo = this.getBulkAuditRepo();

    // 1. Validate Target Agent
    const targetAgent = await userRepo.getUserById(targetAgentId);
    if (!targetAgent) {
      throw new Error(`Target agent with ID "${targetAgentId}" not found.`);
    }

    if (targetAgent.role !== 'AGENT') {
      throw new Error('Leads can only be bulk assigned to sales representatives with the AGENT role.');
    }

    if (targetAgent.status !== 'ACTIVE') {
      throw new Error(`Cannot assign leads to inactive agent "${targetAgent.name}".`);
    }

    // 2. Validate Organization Boundary
    if (actor.organizationId && targetAgent.organizationId && actor.organizationId !== targetAgent.organizationId) {
      throw new Error('Unauthorized: Cross-organization assignment is strictly prohibited.');
    }

    const updatedLeadIds: string[] = [];
    const errors: string[] = [];
    const deviceId = DeviceService.getDeviceId();

    for (const leadId of leadIds) {
      try {
        const lead = await leadRepo.getLeadById(leadId);
        if (!lead) {
          errors.push(`Lead ${leadId} not found`);
          continue;
        }

        const previousAssigneeId = lead.assignedTo || null;
        if (previousAssigneeId === targetAgentId) {
          // Already assigned to target agent, count as success
          updatedLeadIds.push(leadId);
          continue;
        }

        let previousAssigneeName: string | null = null;
        if (previousAssigneeId) {
          const prevUser = await userRepo.getUserById(previousAssigneeId);
          previousAssigneeName = prevUser ? prevUser.name : 'Unknown Agent';
        }

        const now = new Date().toISOString();
        const updatedLead = await leadRepo.updateLead(leadId, {
          assignedTo: targetAgentId,
          updatedBy: actor.id,
        });

        // Activity log
        const activityType = previousAssigneeId ? 'LEAD_REASSIGNED' : 'LEAD_ASSIGNED';
        await activityRepo.logActivity({
          leadId,
          userId: actor.id,
          deviceId,
          activityType,
          metadata: {
            leadId,
            leadName: lead.businessName,
            previousAssigneeId,
            previousAssigneeName,
            newAssigneeId: targetAgent.id,
            newAssigneeName: targetAgent.name,
            assignedByAdminId: actor.id,
            assignedByAdminName: actor.name,
            assignedAt: now,
            bulkBatch: true,
          },
        });

        updatedLeadIds.push(leadId);
      } catch (err: unknown) {
        errors.push(err instanceof Error ? err.message : `Failed lead ${leadId}`);
      }
    }

    const completedAt = new Date().toISOString();
    const successfulCount = updatedLeadIds.length;
    const failedCount = leadIds.length - successfulCount;

    // Log parent BulkAssignmentAudit record
    try {
      await bulkAuditRepo.logAudit({
        organizationId: actor.organizationId || null,
        performedBy: actor.id,
        targetAgentId,
        selectedLeadCount: leadIds.length,
        successfulCount,
        failedCount,
        startedAt,
        completedAt,
        filterSnapshot,
        status: failedCount === 0 ? 'COMPLETED' : successfulCount > 0 ? 'PARTIAL' : 'FAILED',
        errorSummary: errors.length > 0 ? errors.slice(0, 5).join('; ') : null,
      });

      // Log parent system activity
      await activityRepo.logActivity({
        leadId: null,
        userId: actor.id,
        deviceId,
        activityType: 'BULK_ASSIGNMENT_EXECUTED',
        metadata: {
          targetAgentId,
          targetAgentName: targetAgent.name,
          selectedLeadCount: leadIds.length,
          successfulCount,
          failedCount,
          performedByAdminId: actor.id,
          performedByAdminName: actor.name,
          startedAt,
          completedAt,
        },
      });
    } catch (auditErr) {
      console.warn('Failed to write bulk assignment audit log:', auditErr);
    }

    return {
      successfulCount,
      failedCount,
      updatedLeadIds,
      errors,
    };
  }

  /**
   * Retrieves chronological assignment and sales history for a lead.
   */
  static async getLeadHistoryTimeline(leadId: string): Promise<Activity[]> {
    const activityRepo = this.getActivityRepo();
    return await activityRepo.getActivitiesForLead(leadId);
  }
}
