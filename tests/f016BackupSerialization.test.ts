import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  serializeBackupPayload,
  type CRMBackupPayload,
} from '../src/services/backupService.ts';

function payloadWithLeads(count: number): CRMBackupPayload {
  return {
    schemaVersion: 6,
    appVersion: '2.0.0',
    exportedAt: '2026-09-06T00:00:00.000Z',
    databaseName: 'F016',
    organizationId: 'org-current',
    userId: 'user-current',
    data: {
      leads: Array.from({ length: count }, (_, index) => ({
        id: `lead-${index}`,
        businessName: `Business ${index}`,
        phone: `98765${String(index).padStart(5, '0')}`,
        status: 'NEW',
        createdAt: '2026-09-06T00:00:00.000Z',
        updatedAt: '2026-09-06T00:00:00.000Z',
        isSynced: 1,
        deletedAt: null,
        organizationId: 'org-current',
        createdBy: 'user-current',
      })),
      remarks: [],
      callHistory: [],
      followUps: [],
      messageHistory: [],
      messageTemplates: [],
      users: [],
      activities: [],
      callRecords: [],
      importAudits: [],
      outbox: [],
      bulkAssignmentAudits: [],
      syncState: [],
    },
  } as CRMBackupPayload;
}

describe('F016 cooperative backup serialization', () => {
  test('preserves the complete backup payload across a JSON round trip', async () => {
    const payload = payloadWithLeads(205);
    const serialized = await serializeBackupPayload(payload, {
      yieldAfterRecords: 25,
      scheduler: async () => {},
    });

    assert.deepEqual(JSON.parse(serialized), payload);
  });

  test('yields repeatedly while serializing a representative large collection', async () => {
    let yields = 0;
    await serializeBackupPayload(payloadWithLeads(1_000), {
      yieldAfterRecords: 100,
      scheduler: async () => { yields++; },
    });

    assert.equal(yields, 10);
  });

  test('allows timers to run before a large export finishes', async () => {
    let timerRan = false;
    const timer = new Promise<void>((resolve) => {
      setTimeout(() => {
        timerRan = true;
        resolve();
      }, 0);
    });

    const serialization = serializeBackupPayload(payloadWithLeads(2_000), {
      yieldAfterRecords: 50,
    });
    await timer;
    assert.equal(timerRan, true);
    await serialization;
  });

  test('omits undefined optional collections like native JSON.stringify', async () => {
    const payload = payloadWithLeads(1);
    payload.data.users = undefined;
    const serialized = await serializeBackupPayload(payload, {
      scheduler: async () => {},
    });

    assert.deepEqual(JSON.parse(serialized), JSON.parse(JSON.stringify(payload)));
  });
});
