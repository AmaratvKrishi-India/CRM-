import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { SalesCRMDatabase } from '../src/db/database';
import { LeadRepository } from '../src/db/repositories/leadRepository';
import { AgentManagementService } from '../src/services/agentManagementService';
import { AdminAnalyticsService } from '../src/services/adminAnalyticsService';
import { AdminReportsService } from '../src/services/adminReportsService';
import { LeadAssignmentService } from '../src/services/leadAssignmentService';
import { User, Lead } from '../src/db/types';

describe('Agent Capability Restrictions & Role Boundaries (Part 5)', () => {
  let db: SalesCRMDatabase;
  let leadRepo: LeadRepository;

  const mockAgent: User = {
    id: 'agent-123',
    organizationId: 'org-1',
    name: 'Field Sales Rep',
    email: 'rep@amaratvkrishi.com',
    phone: '7054447888',
    role: 'AGENT',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    createdBy: 'admin-1',
    updatedAt: new Date().toISOString(),
    lastLoginAt: null,
    isSynced: 1,
    deletedAt: null,
  };

  const mockAdmin: User = {
    id: 'admin-1',
    organizationId: 'org-1',
    name: 'Admin Boss',
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

  beforeEach(async () => {
    db = new SalesCRMDatabase(`test_agent_restrictions_${Date.now()}_${Math.random()}`);
    leadRepo = new LeadRepository(db);

    AgentManagementService.setCustomDatabase(db);
    AdminAnalyticsService.setCustomDatabase(db);
    AdminReportsService.setCustomDatabase(db);
    LeadAssignmentService.setCustomDatabase(db);

    await db.users.bulkAdd([mockAgent, mockAdmin]);

    // Seed leads: 3 assigned to Agent, 5 assigned to others/unassigned
    const leads: Lead[] = [
      {
        id: 'lead-1',
        businessName: 'My Assigned Gym 1',
        category: 'Gym',
        phone: '7054440001',
        phoneRaw: '7054440001',
        phoneE164: '+917054440001',
        phoneType: 'mobile',
        alternatePhone: null,
        contactPerson: null,
        address: 'Alambagh',
        locality: 'Alambagh',
        pincode: '226005',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        website: null,
        rating: null,
        reviewCount: null,
        source: 'Field',
        sourceFile: null,
        sourceRow: null,
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
        assignedTo: mockAgent.id,
      },
      {
        id: 'lead-2',
        businessName: 'My Assigned Gym 2',
        category: 'Gym',
        phone: '7054440002',
        phoneRaw: '7054440002',
        phoneE164: '+917054440002',
        phoneType: 'mobile',
        alternatePhone: null,
        contactPerson: null,
        address: 'Indira Nagar',
        locality: 'Indira Nagar',
        pincode: '226016',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        website: null,
        rating: null,
        reviewCount: null,
        source: 'Field',
        sourceFile: null,
        sourceRow: null,
        status: 'INTERESTED',
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
        assignedTo: mockAgent.id,
      },
      {
        id: 'lead-3',
        businessName: 'Unassigned Gym',
        category: 'Gym',
        phone: '7054440003',
        phoneRaw: '7054440003',
        phoneE164: '+917054440003',
        phoneType: 'mobile',
        alternatePhone: null,
        contactPerson: null,
        address: 'Hazratganj',
        locality: 'Hazratganj',
        pincode: '226001',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        website: null,
        rating: null,
        reviewCount: null,
        source: 'Excel',
        sourceFile: null,
        sourceRow: null,
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
        assignedTo: null,
      },
      {
        id: 'lead-4',
        businessName: 'Other Agent Gym',
        category: 'Gym',
        phone: '7054440004',
        phoneRaw: '7054440004',
        phoneE164: '+917054440004',
        phoneType: 'mobile',
        alternatePhone: null,
        contactPerson: null,
        address: 'Mahanagar',
        locality: 'Mahanagar',
        pincode: '226006',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        website: null,
        rating: null,
        reviewCount: null,
        source: 'Excel',
        sourceFile: null,
        sourceRow: null,
        status: 'CONTACTED',
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
        assignedTo: 'other-agent-999',
      },
    ];

    await db.leads.bulkAdd(leads);
  });

  afterEach(async () => {
    AgentManagementService.setCustomDatabase(null);
    AdminAnalyticsService.setCustomDatabase(null);
    AdminReportsService.setCustomDatabase(null);
    LeadAssignmentService.setCustomDatabase(null);
    await db.delete();
  });

  it('AGENT cannot access organization analytics KPIs', async () => {
    await expect(AdminAnalyticsService.getOrganisationKPIs(mockAgent)).rejects.toThrow(
      /Unauthorized: Only active administrators/
    );
  });

  it('AGENT cannot access executive dashboard summaries', async () => {
    await expect(AdminAnalyticsService.getLeadPipelineSummary(mockAgent)).rejects.toThrow(
      /Unauthorized: Only active administrators/
    );
  });

  it('AGENT cannot access agent performance listings', async () => {
    await expect(AdminAnalyticsService.getAgentPerformanceList(mockAgent)).rejects.toThrow(
      /Unauthorized: Only active administrators/
    );
  });

  it('AGENT cannot access organization reports', async () => {
    await expect(AdminReportsService.getLeadReport(mockAgent)).rejects.toThrow(
      /Unauthorized: Only active administrators/
    );
    await expect(AdminReportsService.getCallReport(mockAgent)).rejects.toThrow(
      /Unauthorized: Only active administrators/
    );
    await expect(AdminReportsService.getAgentProductivityReport(mockAgent)).rejects.toThrow(
      /Unauthorized: Only active administrators/
    );
  });

  it('AGENT cannot manage users (create, update, activate, deactivate)', async () => {
    await expect(AgentManagementService.getAgents(mockAgent)).rejects.toThrow(
      'Unauthorized: Only administrators are permitted'
    );

    await expect(
      AgentManagementService.createAgent(mockAgent, {
        name: 'New Rep',
        email: 'rep2@test.com',
        phone: '7054449999',
        password: 'password123',
      })
    ).rejects.toThrow('Unauthorized: Only administrators are permitted');

    await expect(
      AgentManagementService.deactivateAgent(mockAgent, 'some-agent-id')
    ).rejects.toThrow('Unauthorized: Only administrators are permitted');
  });

  it('AGENT cannot assign or reassign leads', async () => {
    await expect(
      LeadAssignmentService.assignLead(mockAgent, 'lead-1', mockAgent.id)
    ).rejects.toThrow('Unauthorized: Only administrators are permitted');

    await expect(
      LeadAssignmentService.unassignLead(mockAgent, 'lead-1')
    ).rejects.toThrow('Unauthorized: Only administrators are permitted');
  });

  it('Lead search filtered by assignedTo returns only the agent leads', async () => {
    const result = await leadRepo.searchAndFilterLeads({
      assignedTo: mockAgent.id,
    });

    expect(result.total).toBe(2);
    expect(result.leads.every((l) => l.assignedTo === mockAgent.id)).toBe(true);
  });

  it('Agent can create an individual field lead with createdBy and assignedTo set to self', async () => {
    const newLead = await leadRepo.createLead({
      businessName: 'Rawat Fitness Zone',
      phone: '7054448888',
      category: 'Gym',
      address: 'Telibagh, Lucknow',
      locality: 'Telibagh',
      status: 'NEW',
      customNotes: 'Field meeting with owner',
      source: 'Field Entry (Field Sales Rep)',
      createdBy: mockAgent.id,
      assignedTo: mockAgent.id,
      updatedBy: mockAgent.id,
    });

    expect(newLead.id).toBeDefined();
    expect(newLead.createdBy).toBe(mockAgent.id);
    expect(newLead.assignedTo).toBe(mockAgent.id);
    expect(newLead.businessName).toBe('Rawat Fitness Zone');
  });
});
