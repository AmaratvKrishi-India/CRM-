import 'fake-indexeddb/auto';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SalesCRMDatabase } from '../src/db/database.ts';
import { BackupService } from '../src/services/backupService.ts';
import { createCRMDataLayer } from '../src/db/index.ts';

describe('Real Backup & Restore Service Integration Tests (Stage 8)', () => {
  function getTestDb(suffix: string) {
    const db = new SalesCRMDatabase(`BackupTest_${Date.now()}_${suffix}`);
    const dataLayer = createCRMDataLayer(db);
    const backupService = new BackupService(db);
    return { db, dataLayer, backupService };
  }

  it('1. Generates and validates full JSON backup payload from real Dexie database', async () => {
    const { db, dataLayer, backupService } = getTestDb('generate_validate');

    // Add initial data
    const lead = await dataLayer.leads.createLead({
      businessName: 'Apex Fitness Center',
      phone: '9876500001',
      status: 'NEW',
      organizationId: 'org-01',
      createdBy: 'admin-01',
    });

    await dataLayer.remarks.addRemark({
      leadId: lead.id,
      content: 'Initial inquiry via Instagram',
      author: 'Admin',
      type: 'GENERAL',
    });

    const payload = await backupService.generateBackupPayload();
    assert.strictEqual(payload.schemaVersion, 2);
    assert.ok(payload.data.leads.length >= 1);
    assert.ok(payload.data.remarks.length >= 1);

    const validation = backupService.validateBackupPayload(payload);
    assert.strictEqual(validation.isValid, true);
    assert.strictEqual(validation.errors.length, 0);
    assert.ok(validation.summary.totalRecords >= 2);

    await db.close();
  });

  it('2. Merge Restore applies Last-Write-Wins across real Dexie entities', async () => {
    const { db, dataLayer, backupService } = getTestDb('merge_restore');

    // Initial local lead
    const lead = await dataLayer.leads.createLead({
      businessName: 'Fit Zone Gym',
      phone: '9876500002',
      status: 'NEW',
      organizationId: 'org-01',
      createdBy: 'admin-01',
    });

    // Create backup with a newer update to that same lead
    const newerUpdatedAt = new Date(Date.now() + 50000).toISOString();
    const backupPayload = {
      schemaVersion: 2,
      appVersion: '2.0.0',
      exportedAt: newerUpdatedAt,
      databaseName: 'RemoteExport',
      data: {
        leads: [
          {
            ...lead,
            businessName: 'Fit Zone Gym & Spa (Merged Remote)',
            status: 'CUSTOMER' as const,
            updatedAt: newerUpdatedAt,
          },
        ],
        remarks: [],
        callHistory: [],
        followUps: [],
        messageHistory: [],
        messageTemplates: [],
      },
    };

    const restoreResult = await backupService.mergeRestore(backupPayload);
    assert.strictEqual(restoreResult.updated, 1);

    const updatedLead = await db.leads.get(lead.id);
    assert.strictEqual(updatedLead?.businessName, 'Fit Zone Gym & Spa (Merged Remote)');
    assert.strictEqual(updatedLead?.status, 'CUSTOMER');

    await db.close();
  });

  it('3. Destructive Replace Restore replaces existing dataset with backup dataset', async () => {
    const { db, dataLayer, backupService } = getTestDb('replace_restore');

    // Add local lead
    const originalLead = await dataLayer.leads.createLead({
      businessName: 'Original Gold Gym',
      phone: '9876500003',
      status: 'NEW',
      organizationId: 'org-01',
      createdBy: 'admin-01',
    });

    const newLeadId = 'new-lead-from-backup-001';
    const replacePayload = {
      schemaVersion: 2,
      appVersion: '2.0.0',
      exportedAt: new Date().toISOString(),
      databaseName: 'CleanState',
      data: {
        leads: [
          {
            id: newLeadId,
            phone: '9111122222',
            businessName: 'Titanium Gym',
            status: 'NEW' as const,
            locality: 'Gomti Nagar',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isSynced: 1 as const,
            deletedAt: null,
          },
        ],
        remarks: [],
        callHistory: [],
        followUps: [],
        messageHistory: [],
        messageTemplates: [],
      },
    };

    await backupService.replaceRestore(replacePayload);

    // Old lead is gone, replaced by new lead
    const oldCheck = await db.leads.get(originalLead.id);
    assert.strictEqual(oldCheck, undefined);

    const newCheck = await db.leads.get(newLeadId);
    assert.ok(newCheck);
    assert.strictEqual(newCheck.businessName, 'Titanium Gym');

    await db.close();
  });
});
