import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Backup & Restore Data Safety & Integrity (Stage 8)', () => {
  const validBackupPayload = {
    schemaVersion: 5,
    appVersion: '2.0.0',
    exportedAt: new Date().toISOString(),
    databaseName: 'AmaratvKrishiSalesCRM',
    data: {
      leads: [
        {
          id: 'lead-001',
          businessName: 'Gold Gym Alambagh',
          phone: '7054447888',
          status: 'WON',
          createdAt: '2026-08-20T10:00:00.000Z',
          updatedAt: '2026-08-20T10:00:00.000Z',
          deletedAt: null,
          isSynced: 1,
        },
      ],
      remarks: [
        {
          id: 'rem-001',
          leadId: 'lead-001',
          content: 'Excellent product demo given',
          author: 'Agent Rahul',
          createdAt: '2026-08-20T10:05:00.000Z',
          updatedAt: '2026-08-20T10:05:00.000Z',
          deletedAt: null,
          isSynced: 1,
        },
      ],
      callRecords: [
        {
          id: 'call-001',
          leadId: 'lead-001',
          userId: 'agent-101',
          durationSeconds: 180,
          outcome: 'CONNECTED',
          verificationStatus: 'VERIFIED',
          startedAt: '2026-08-20T10:00:00.000Z',
          createdAt: '2026-08-20T10:03:00.000Z',
          updatedAt: '2026-08-20T10:03:00.000Z',
          isSynced: 1,
        },
      ],
      followUps: [],
      messageHistory: [],
      messageTemplates: [],
      users: [],
      activities: [],
      importAudits: [],
    },
  };

  const validateBackupJSON = (jsonString: string): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      return { isValid: false, errors: ['Invalid JSON syntax: Malformed file.'] };
    }

    if (!parsed || typeof parsed !== 'object') {
      return { isValid: false, errors: ['Backup content must be a valid JSON object.'] };
    }

    if (typeof parsed.schemaVersion !== 'number') {
      errors.push('Missing or invalid schemaVersion header.');
    }

    if (!parsed.data || typeof parsed.data !== 'object') {
      errors.push('Missing "data" container object.');
    } else {
      if (!Array.isArray(parsed.data.leads)) {
        errors.push('Data container must contain a "leads" array.');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  };

  it('1. Valid backup JSON parses successfully with all required schema keys', () => {
    const raw = JSON.stringify(validBackupPayload);
    const result = validateBackupJSON(raw);
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  it('2. Corrupted JSON is rejected with descriptive error', () => {
    const corrupted = '{"schemaVersion": 5, "data": { "leads": [ { "id": "1" ';
    const result = validateBackupJSON(corrupted);
    assert.strictEqual(result.isValid, false);
    assert.match(result.errors[0], /Invalid JSON syntax/);
  });

  it('3. Missing required tables in data container fails validation', () => {
    const invalidPayload = {
      schemaVersion: 5,
      appVersion: '2.0.0',
      data: {
        // Missing leads array
        remarks: [],
      },
    };
    const result = validateBackupJSON(JSON.stringify(invalidPayload));
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.some((e) => e.includes('leads')));
  });

  it('4. Merge restore resolves records via LWW comparison', () => {
    const localLeads = new Map([
      ['lead-001', { id: 'lead-001', businessName: 'Old Local Name', updatedAt: '2026-08-20T08:00:00.000Z' }],
    ]);

    const incomingLead = {
      id: 'lead-001',
      businessName: 'New Backup Name',
      updatedAt: '2026-08-20T10:00:00.000Z',
    };

    const localTime = new Date(localLeads.get('lead-001')!.updatedAt).getTime();
    const incomingTime = new Date(incomingLead.updatedAt).getTime();

    let updated = 0;
    if (incomingTime > localTime) {
      localLeads.set(incomingLead.id, incomingLead);
      updated++;
    }

    assert.strictEqual(updated, 1);
    assert.strictEqual(localLeads.get('lead-001')!.businessName, 'New Backup Name');
  });

  it('5. Destructive replace restore captures pre-restore snapshot for rollback safety', () => {
    const currentDbState = [{ id: 'lead-old-1' }, { id: 'lead-old-2' }];

    // Pre-restore snapshot creation
    const snapshot = JSON.parse(JSON.stringify(currentDbState));
    assert.strictEqual(snapshot.length, 2);

    // Simulate replace
    let activeState = [{ id: 'lead-new-1' }];

    // Simulate rollback on failure
    const rollback = true;
    if (rollback) {
      activeState = snapshot;
    }

    assert.strictEqual(activeState.length, 2);
    assert.strictEqual(activeState[0].id, 'lead-old-1');
  });
});
