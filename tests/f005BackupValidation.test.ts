import 'fake-indexeddb/auto';
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { SalesCRMDatabase } from '../src/db/database.ts';
import { BackupService, type CRMBackupPayload } from '../src/services/backupService.ts';

const open: SalesCRMDatabase[] = [];
const now = '2026-09-06T00:00:00.000Z';

function setup(label: string) {
  const db = new SalesCRMDatabase(`F005_${label}_${Date.now()}_${Math.random()}`, {
    organizationId: 'org-current', userId: 'user-current', role: 'ADMIN',
  });
  open.push(db);
  return { db, service: new BackupService(db) };
}

async function emptyPayload(service: BackupService): Promise<CRMBackupPayload> {
  return service.generateBackupPayload();
}

function lead(id = 'lead-valid') {
  return {
    id, businessName: 'Valid Gym', phone: '9876500000', status: 'NEW' as const,
    createdAt: now, updatedAt: now, isSynced: 1 as const, deletedAt: null,
    organizationId: 'org-current', createdBy: 'user-current',
    extraFutureField: { safely: 'preserved' },
  };
}

afterEach(async () => {
  while (open.length) {
    const db = open.pop()!;
    db.close();
    await db.delete();
  }
});

describe('F005 backup shape, scope, and atomicity', () => {
  test('1 valid current backup restores successfully', async () => {
    const { db, service } = setup('valid');
    const payload = await emptyPayload(service);
    payload.data.leads = [lead() as never];
    await service.mergeRestore(payload);
    assert.equal((await db.leads.get('lead-valid'))?.businessName, 'Valid Gym');
  });

  test('2 malformed JSON is rejected safely', () => {
    const { service } = setup('json');
    const result = service.validateBackupJson('{"schemaVersion":6');
    assert.equal(result.isValid, false);
    assert.match(result.errors[0], /JSON Syntax Error/);
  });

  test('3 missing backup envelope is rejected', () => {
    const { service } = setup('envelope');
    assert.equal(service.validateBackupPayload({ data: {} }).isValid, false);
  });

  test('4 invalid data structure is rejected', async () => {
    const { service } = setup('structure');
    const payload = await emptyPayload(service) as unknown as { data: unknown };
    payload.data = [];
    assert.equal(service.validateBackupPayload(payload).isValid, false);
  });

  test('5 unsupported collection is rejected', async () => {
    const { service } = setup('collection');
    const payload = await emptyPayload(service) as CRMBackupPayload & { data: CRMBackupPayload['data'] & { permissions: unknown[] } };
    payload.data.permissions = [];
    assert.match(service.validateBackupPayload(payload).errors.join(' '), /Unsupported backup collection/);
  });

  test('6 invalid field type is rejected', async () => {
    const { service } = setup('field-type');
    const payload = await emptyPayload(service);
    payload.data.leads = [{ ...lead(), businessName: 42 } as never];
    assert.match(service.validateBackupPayload(payload).errors.join(' '), /businessName/);
  });

  test('7 missing required field is rejected', async () => {
    const { service } = setup('required');
    const payload = await emptyPayload(service);
    const malformed = { ...lead() } as Record<string, unknown>;
    delete malformed.phone;
    payload.data.leads = [malformed as never];
    assert.match(service.validateBackupPayload(payload).errors.join(' '), /phone/);
  });

  test('8 malformed nested object is rejected', async () => {
    const { service } = setup('nested');
    const payload = await emptyPayload(service);
    payload.data.activities = [{ id: 'a', leadId: null, userId: 'user-current', deviceId: null,
      activityType: 'LEAD_CREATED', metadata: [], createdAt: now, updatedAt: now,
      isSynced: 1, deletedAt: null } as never];
    assert.match(service.validateBackupPayload(payload).errors.join(' '), /metadata/);
  });

  test('9 malformed collection array is rejected', async () => {
    const { service } = setup('array');
    const payload = await emptyPayload(service) as unknown as { data: Record<string, unknown> };
    payload.data.remarks = {};
    assert.match(service.validateBackupPayload(payload).errors.join(' '), /remarks.*array/);
  });

  test('10 prohibited null is rejected', async () => {
    const { service } = setup('null');
    const payload = await emptyPayload(service);
    payload.data.leads = [{ ...lead(), businessName: null } as never];
    assert.match(service.validateBackupPayload(payload).errors.join(' '), /businessName/);
  });

  test('11 invalid empty identifier is rejected', async () => {
    const { service } = setup('id');
    const payload = await emptyPayload(service);
    payload.data.leads = [lead('') as never];
    assert.match(service.validateBackupPayload(payload).errors.join(' '), /id/);
  });

  test('12 backup header cannot change trusted scope', async () => {
    const { service } = setup('header-scope');
    const payload = await emptyPayload(service);
    payload.organizationId = 'org-other';
    payload.userId = 'user-other';
    assert.match(service.validateBackupPayload(payload).errors.join(' '), /different organization or signed-in user/);
  });

  test('13 cross-organization record cannot be injected', async () => {
    const { db, service } = setup('record-scope');
    const payload = await emptyPayload(service);
    payload.data.leads = [{ ...lead(), organizationId: 'org-other' } as never];
    await assert.rejects(service.mergeRestore(payload), /Invalid backup payload/);
    assert.equal(await db.leads.count(), 0);
  });

  test('14 protected profile authorization fields cannot override local state', async () => {
    const { db, service } = setup('profile');
    await db.users.put({ id: 'user-current', organizationId: 'org-current', name: 'Trusted', email: 't@example.test',
      phone: '1', role: 'ADMIN', status: 'ACTIVE', createdAt: now, createdBy: null, updatedAt: now,
      lastLoginAt: null, isSynced: 1, deletedAt: null });
    const payload = await emptyPayload(service);
    payload.data.users = [{ ...(await db.users.get('user-current'))!, role: 'AGENT', status: 'INACTIVE' }];
    await service.mergeRestore(payload);
    assert.deepEqual((await db.users.get('user-current'))?.role, 'ADMIN');
    assert.deepEqual((await db.users.get('user-current'))?.status, 'ACTIVE');
  });

  test('14b provisioned users may retain an intentionally blank phone number', async () => {
    const { service } = setup('blank-user-phone');
    const payload = await emptyPayload(service);
    payload.data.users = [{
      id: 'user-current', organizationId: 'org-current', name: 'No Phone', email: 'no-phone@example.test',
      phone: '', role: 'AGENT', status: 'ACTIVE', createdAt: now, createdBy: 'user-current',
      updatedAt: now, lastLoginAt: null, isSynced: 1, deletedAt: null,
    }];
    assert.equal(service.validateBackupPayload(payload).isValid, true);
  });

  test('15 mixed valid and invalid records cause no partial write', async () => {
    const { db, service } = setup('mixed');
    const payload = await emptyPayload(service);
    payload.data.leads = [lead('good') as never, { ...lead('bad'), phone: false } as never];
    await assert.rejects(service.mergeRestore(payload), /Invalid backup payload/);
    assert.equal(await db.leads.count(), 0);
  });

  test('16 merge failure rolls back earlier writes', async () => {
    const { db, service } = setup('rollback');
    await db.leads.put({ ...lead('existing'), businessName: 'Existing' } as never);
    const payload = await emptyPayload(service);
    payload.data.leads = [lead('new-before-failure') as never];
    payload.data.remarks = [{ id: 'remark-fails', leadId: 'new-before-failure', content: 'x', author: 'a',
      type: 'CUSTOM', createdAt: now, updatedAt: now, isSynced: 1, deletedAt: null }];
    const originalAdd = db.remarks.add.bind(db.remarks);
    db.remarks.add = (() => { throw new Error('simulated merge failure'); }) as typeof db.remarks.add;
    await assert.rejects(service.mergeRestore(payload), /simulated merge failure/);
    db.remarks.add = originalAdd;
    assert.equal(await db.leads.get('new-before-failure'), undefined);
    assert.equal((await db.leads.get('existing'))?.businessName, 'Existing');
  });

  test('17 legacy unscoped backup remains safely rejected', async () => {
    const { service } = setup('legacy');
    const payload = await emptyPayload(service);
    payload.schemaVersion = 5;
    assert.match(service.validateBackupPayload(payload).errors.join(' '), /Legacy unscoped backups/);
  });

  test('18 valid relationships are preserved', async () => {
    const { db, service } = setup('relations');
    const payload = await emptyPayload(service);
    payload.data.leads = [lead() as never];
    payload.data.remarks = [{ id: 'remark', leadId: 'lead-valid', content: 'Safe', author: 'Admin',
      type: 'CUSTOM', createdAt: now, updatedAt: now, isSynced: 1, deletedAt: null }];
    await service.mergeRestore(payload);
    assert.equal((await db.remarks.get('remark'))?.leadId, 'lead-valid');
  });

  test('19 unknown record fields are accepted and preserved for compatibility', async () => {
    const { db, service } = setup('unknown-field');
    const payload = await emptyPayload(service);
    payload.data.leads = [lead() as never];
    assert.equal(service.validateBackupPayload(payload).isValid, true);
    await service.mergeRestore(payload);
    assert.deepEqual((await db.leads.get('lead-valid') as unknown as Record<string, unknown>).extraFutureField, { safely: 'preserved' });
  });

  test('20 repeated restore is deterministic and idempotent', async () => {
    const { db, service } = setup('repeat');
    const payload = await emptyPayload(service);
    payload.data.leads = [lead() as never];
    assert.equal((await service.mergeRestore(payload)).added, 1);
    assert.equal((await service.mergeRestore(payload)).skipped, 1);
    assert.equal(await db.leads.count(), 1);
  });

  test('21 server-retained import audits may have nullable actor and completion fields', async () => {
    const { service } = setup('nullable-import-audit');
    const payload = await emptyPayload(service);
    payload.data.importAudits = [{
      id: 'audit-nullable', uploadedBy: null, deviceId: null,
      filename: 'historical-import.csv', source: 'Excel Import',
      startedAt: now, completedAt: null, totalRows: 0, imported: 0,
      updated: 0, duplicates: 0, invalid: 0, createdAt: now,
      updatedAt: now, isSynced: 1,
    }];
    const validation = service.validateBackupPayload(payload);
    assert.equal(validation.isValid, true, validation.errors.join('\n'));
  });

  test('22 restore file-size guard accepts the boundary and rejects one byte over it', () => {
    const validateRestoreFileSize = (BackupService as unknown as {
      validateRestoreFileSize?: (sizeBytes: number) => string | null;
    }).validateRestoreFileSize;

    assert.equal(
      typeof validateRestoreFileSize,
      'function',
      'BackupService must expose an early restore file-size guard',
    );

    const maxBytes = 25 * 1024 * 1024;
    assert.equal(validateRestoreFileSize!(maxBytes), null);
    assert.match(validateRestoreFileSize!(maxBytes + 1) ?? '', /25 MB/i);
  });
});
