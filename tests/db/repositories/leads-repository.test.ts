/** Real Dexie regression coverage for LeadRepository. */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LeadRepository } from '@/db/repositories/leadRepository';
import type { SalesCRMDatabase } from '@/db/database';
import { agentScope, createVitestDatabase, disposeVitestDatabase } from '../../helpers/vitestDatabase';

describe('LeadRepository', () => {
  let database: SalesCRMDatabase;
  let leads: LeadRepository;
  let phoneSequence = 0;

  beforeEach(() => {
    database = createVitestDatabase('leads');
    leads = new LeadRepository(database);
    phoneSequence = 0;
  });

  afterEach(async () => {
    await disposeVitestDatabase(database);
  });

  async function createLead(overrides: Record<string, unknown> = {}) {
    phoneSequence += 1;
    return leads.createLead({
      businessName: `Test Fitness ${phoneSequence}`,
      phone: `987650${String(phoneSequence).padStart(4, '0')}`,
      address: 'Alambagh, Lucknow 226005',
      ...overrides,
    });
  }

  it('should create a new lead', async () => {
    const lead = await createLead({ businessName: 'Iron Fitness Gym' });
    expect(lead).toMatchObject({ businessName: 'Iron Fitness Gym', status: 'NEW', createdBy: agentScope.userId });
    expect(await database.leads.get(lead.id)).toMatchObject({ id: lead.id, isSynced: 0 });
  });

  it('should generate a UUID for a new lead', async () => {
    const lead = await createLead();
    expect(lead.id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('should set NEW as the default status', async () => {
    expect((await createLead()).status).toBe('NEW');
  });

  it('should return a lead by id', async () => {
    const created = await createLead();
    await expect(leads.getLeadById(created.id)).resolves.toMatchObject({ id: created.id });
  });

  it('should return undefined for a non-existent lead', async () => {
    await expect(leads.getLeadById('missing-lead')).resolves.toBeUndefined();
  });

  it('should return leads in the active account partition', async () => {
    await createLead();
    await createLead();
    const result = await leads.searchAndFilterLeads();

    expect(result.total).toBe(2);
    expect(result.leads.every((lead) => lead.createdBy === agentScope.userId)).toBe(true);
  });

  it('should return an empty list when the active partition has no leads', async () => {
    await expect(leads.searchAndFilterLeads()).resolves.toEqual({ leads: [], total: 0 });
  });

  it('should assign an agent-created lead to the signed-in agent', async () => {
    const lead = await createLead({ assignedTo: 'another-agent' });
    expect(lead.assignedTo).toBe(agentScope.userId);
  });

  it('should update editable lead fields', async () => {
    const created = await createLead();
    const updated = await leads.updateLead(created.id, { businessName: 'Updated Fitness', status: 'INTERESTED' });

    expect(updated).toMatchObject({ businessName: 'Updated Fitness', status: 'INTERESTED', updatedBy: agentScope.userId });
  });

  it('should mark an update unsynced and enqueue an UPDATE mutation', async () => {
    const created = await createLead();
    await leads.updateLead(created.id, { status: 'CONTACTED' });
    const outbox = await database.outbox.where('entityId').equals(created.id).toArray();

    expect(await database.leads.get(created.id)).toMatchObject({ isSynced: 0, updatedBy: agentScope.userId });
    // `toArray()` does not promise an ordering for an entityId index. FIFO is
    // covered through SyncQueue.getPendingItems; this repository test verifies
    // that both durable mutations were created for the lead.
    expect(outbox.map((item) => item.operation).sort()).toEqual(['CREATE', 'UPDATE']);
  });

  it('should reject updates for a non-existent lead', async () => {
    await expect(leads.updateLead('missing-lead', { status: 'CONTACTED' })).rejects.toThrow('not found');
  });

  it('should soft-delete a lead by id', async () => {
    const created = await createLead();
    await leads.softDeleteLead(created.id);

    expect(await leads.getLeadById(created.id)).toBeUndefined();
    expect(await leads.getLeadById(created.id, true)).toMatchObject({ id: created.id, deletedAt: expect.any(String) });
  });

  it('should reject soft deletion for a non-existent lead', async () => {
    await expect(leads.softDeleteLead('missing-lead')).rejects.toThrow('not found');
  });

  it('should search leads by business name', async () => {
    await createLead({ businessName: 'Alpha Strength' });
    await createLead({ businessName: 'Beta Yoga' });

    const result = await leads.searchAndFilterLeads({ searchTerm: 'strength' });
    expect(result.leads.map((lead) => lead.businessName)).toEqual(['Alpha Strength']);
  });

  it('should search leads by normalized phone digits', async () => {
    const created = await createLead({ phone: '+91 98765 40001' });
    const result = await leads.searchAndFilterLeads({ searchTerm: '9876540001' });

    expect(result.leads).toHaveLength(1);
    expect(result.leads[0].id).toBe(created.id);
  });

  it('should calculate lead totals for the active partition', async () => {
    await createLead({ status: 'NEW' });
    await createLead({ status: 'CONTACTED' });

    const stats = await leads.getLeadStats();
    expect(stats).toMatchObject({ totalLeads: 2, activeLeads: 2 });
    expect(stats.statusCounts).toMatchObject({ NEW: 1, CONTACTED: 1 });
  });

  it('should bulk-import valid leads and create durable outbox mutations', async () => {
    const result = await leads.bulkImportLeads([
      { title: 'Import Gym One', phone: '9876541001', address: 'Alambagh, Lucknow 226005' },
      { title: 'Import Gym Two', phone: '9876541002', address: 'Gomti Nagar, Lucknow 226010' },
    ]);

    expect(result).toMatchObject({ totalProcessed: 2, imported: 2, skippedDuplicates: 0, errors: [] });
    expect(await database.outbox.count()).toBe(2);
  });

  it('should reject duplicate phone numbers', async () => {
    await createLead({ phone: '9876542001' });
    await expect(createLead({ phone: '+91 98765 42001' })).rejects.toThrow('Duplicate lead');
  });

  it('should filter leads by status', async () => {
    await createLead({ status: 'NEW' });
    await createLead({ status: 'CONTACTED' });
    await createLead({ status: 'INTERESTED' });

    const result = await leads.searchAndFilterLeads({ status: ['CONTACTED', 'INTERESTED'], sortOrder: 'asc' });
    expect(result.leads.map((lead) => lead.status)).toEqual(['CONTACTED', 'INTERESTED']);
  });

  it('should preserve total counts while returning a sorted page window', async () => {
    await createLead({ businessName: 'Zulu Fitness' });
    await createLead({ businessName: 'Alpha Fitness' });
    await createLead({ businessName: 'Bravo Fitness' });

    const result = await leads.searchAndFilterLeads({
      sortBy: 'businessName',
      sortOrder: 'asc',
      offset: 1,
      limit: 1,
    });

    expect(result.total).toBe(3);
    expect(result.leads.map((lead) => lead.businessName)).toEqual(['Bravo Fitness']);
  });
});
