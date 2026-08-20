import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { SalesCRMDatabase } from '../src/db/database';
import { LeadAssignmentService } from '../src/services/leadAssignmentService';
import { User, Lead } from '../src/db/types';

describe('Bulk Lead Assignment Service (Phase 2K)', () => {
  let db: SalesCRMDatabase;

  const mockAdmin: User = {
    id: 'admin-uuid-1',
    organizationId: 'org-uuid-1',
    name: 'Admin User',
    email: 'admin@amaratvkrishi.com',
    phone: '9999999999',
    role: 'ADMIN',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    createdBy: null,
    updatedAt: new Date().toISOString(),
    lastLoginAt: null,
    isSynced: 1,
    deletedAt: null,
  };

  const mockAgent1: User = {
    id: 'agent-uuid-1',
    organizationId: 'org-uuid-1',
    name: 'Rahul Sharma',
    email: 'rahul@amaratvkrishi.com',
    phone: '7054447888',
    role: 'AGENT',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    createdBy: 'admin-uuid-1',
    updatedAt: new Date().toISOString(),
    lastLoginAt: null,
    isSynced: 1,
    deletedAt: null,
  };

  const mockAgent2: User = {
    id: 'agent-uuid-2',
    organizationId: 'org-uuid-1',
    name: 'Pooja Verma',
    email: 'pooja@amaratvkrishi.com',
    phone: '7054447999',
    role: 'AGENT',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    createdBy: 'admin-uuid-1',
    updatedAt: new Date().toISOString(),
    lastLoginAt: null,
    isSynced: 1,
    deletedAt: null,
  };

  const mockInactiveAgent: User = {
    id: 'agent-uuid-inactive',
    organizationId: 'org-uuid-1',
    name: 'Inactive Agent',
    email: 'inactive@amaratvkrishi.com',
    phone: '7054447000',
    role: 'AGENT',
    status: 'INACTIVE',
    createdAt: new Date().toISOString(),
    createdBy: 'admin-uuid-1',
    updatedAt: new Date().toISOString(),
    lastLoginAt: null,
    isSynced: 1,
    deletedAt: null,
  };

  const mockCrossOrgAgent: User = {
    id: 'agent-uuid-cross-org',
    organizationId: 'org-uuid-other',
    name: 'Cross Org Rep',
    email: 'cross@other.com',
    phone: '7054447111',
    role: 'AGENT',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    createdBy: null,
    updatedAt: new Date().toISOString(),
    lastLoginAt: null,
    isSynced: 1,
    deletedAt: null,
  };

  beforeEach(async () => {
    db = new SalesCRMDatabase(`test_bulk_assign_${Date.now()}_${Math.random()}`);
    LeadAssignmentService.setCustomDatabase(db);

    // Seed users
    await db.users.bulkAdd([mockAdmin, mockAgent1, mockAgent2, mockInactiveAgent, mockCrossOrgAgent]);

    // Seed 10 sample leads
    const sampleLeads: Lead[] = Array.from({ length: 10 }).map((_, i) => ({
      id: `lead-bulk-${i + 1}`,
      businessName: `Fitness Gym ${i + 1}`,
      category: 'Gym',
      phone: `705444780${i}`,
      phoneRaw: `705444780${i}`,
      phoneE164: `+91705444780${i}`,
      phoneType: 'mobile',
      alternatePhone: null,
      contactPerson: `Owner ${i + 1}`,
      address: `Gomti Nagar Sector ${i + 1}, Lucknow`,
      locality: 'Gomti Nagar',
      pincode: '226010',
      city: 'Lucknow',
      state: 'Uttar Pradesh',
      website: null,
      rating: 4.5,
      reviewCount: 20,
      source: 'Excel Batch',
      sourceFile: 'gyms.xlsx',
      sourceRow: i + 1,
      status: 'NEW',
      customNotes: '',
      lastContactedAt: null,
      nextFollowUpAt: null,
      callCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isSynced: 1,
      syncedAt: null,
      deletedAt: null,
      createdBy: mockAdmin.id,
      assignedTo: i < 5 ? null : mockAgent2.id, // 5 unassigned, 5 assigned to Agent 2
      updatedBy: mockAdmin.id,
    }));

    await db.leads.bulkAdd(sampleLeads);
  });

  afterEach(async () => {
    LeadAssignmentService.setCustomDatabase(null);
    await db.delete();
  });

  it('allows Admin to bulk assign 10 leads to active agent', async () => {
    const leadIds = Array.from({ length: 10 }).map((_, i) => `lead-bulk-${i + 1}`);

    const result = await LeadAssignmentService.bulkAssignLeads(
      mockAdmin,
      leadIds,
      mockAgent1.id,
      { filter: 'Gomti Nagar' }
    );

    expect(result.successfulCount).toBe(10);
    expect(result.failedCount).toBe(0);
    expect(result.errors).toHaveLength(0);

    // Verify all leads updated in database
    for (const id of leadIds) {
      const lead = await db.leads.get(id);
      expect(lead?.assignedTo).toBe(mockAgent1.id);
      expect(lead?.updatedBy).toBe(mockAdmin.id);
    }

    // Verify Activity logs created
    const activities = await db.activities.toArray();
    expect(activities.length).toBeGreaterThanOrEqual(10);

    const reassignedActivities = activities.filter((a) => a.activityType === 'LEAD_REASSIGNED');
    const assignedActivities = activities.filter((a) => a.activityType === 'LEAD_ASSIGNED');
    expect(reassignedActivities.length).toBe(5); // 5 were previously assigned to Agent 2
    expect(assignedActivities.length).toBe(5); // 5 were previously unassigned

    // Verify parent BULK_ASSIGNMENT_EXECUTED activity
    const bulkActivity = activities.find((a) => a.activityType === 'BULK_ASSIGNMENT_EXECUTED');
    expect(bulkActivity).toBeDefined();
    expect(bulkActivity?.metadata.successfulCount).toBe(10);

    // Verify parent BulkAssignmentAudit record
    const audits = await db.bulkAssignmentAudits.toArray();
    expect(audits).toHaveLength(1);
    expect(audits[0].targetAgentId).toBe(mockAgent1.id);
    expect(audits[0].selectedLeadCount).toBe(10);
    expect(audits[0].successfulCount).toBe(10);
    expect(audits[0].status).toBe('COMPLETED');
  });

  it('denies non-admin (AGENT) from executing bulk assignment', async () => {
    const leadIds = ['lead-bulk-1', 'lead-bulk-2'];

    await expect(
      LeadAssignmentService.bulkAssignLeads(mockAgent1, leadIds, mockAgent2.id)
    ).rejects.toThrow('Unauthorized: Only administrators are permitted');
  });

  it('denies unauthenticated actor from executing bulk assignment', async () => {
    const leadIds = ['lead-bulk-1'];

    await expect(
      LeadAssignmentService.bulkAssignLeads(null, leadIds, mockAgent1.id)
    ).rejects.toThrow('Unauthorized: No authenticated user session');
  });

  it('rejects bulk assignment to inactive agent', async () => {
    const leadIds = ['lead-bulk-1', 'lead-bulk-2'];

    await expect(
      LeadAssignmentService.bulkAssignLeads(mockAdmin, leadIds, mockInactiveAgent.id)
    ).rejects.toThrow(/Cannot assign leads to inactive agent/);
  });

  it('rejects cross-organization bulk assignment', async () => {
    const leadIds = ['lead-bulk-1'];

    await expect(
      LeadAssignmentService.bulkAssignLeads(mockAdmin, leadIds, mockCrossOrgAgent.id)
    ).rejects.toThrow(/Cross-organization assignment is strictly prohibited/);
  });

  it('rejects empty lead selection', async () => {
    await expect(
      LeadAssignmentService.bulkAssignLeads(mockAdmin, [], mockAgent1.id)
    ).rejects.toThrow('No leads selected for bulk assignment.');
  });
});
