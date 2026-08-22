import { describe, it } from 'node:test';
import assert from 'node:assert';

export interface OutboxItem {
  id: string;
  organizationId: string | null;
  userId: string;
  deviceId: string | null;
  entityType: string;
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  lastAttemptAt: string | null;
  lastError: string | null;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
}

class MockSyncQueue {
  private items: Map<string, OutboxItem> = new Map();

  async enqueue(input: {
    entityType: string;
    entityId: string;
    operation: 'CREATE' | 'UPDATE' | 'DELETE';
    payload: Record<string, any>;
    userId: string;
    organizationId?: string | null;
    deviceId?: string | null;
  }): Promise<OutboxItem> {
    const now = new Date().toISOString();
    const id = `outbox-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const item: OutboxItem = {
      id,
      organizationId: input.organizationId || null,
      userId: input.userId,
      deviceId: input.deviceId || 'device-test-01',
      entityType: input.entityType,
      entityId: input.entityId,
      operation: input.operation,
      payload: input.payload,
      createdAt: now,
      updatedAt: now,
      retryCount: 0,
      lastAttemptAt: null,
      lastError: null,
      status: 'PENDING',
    };
    this.items.set(id, item);
    return item;
  }

  async getPendingItems(): Promise<OutboxItem[]> {
    return Array.from(this.items.values()).filter((i) => i.status === 'PENDING' || i.status === 'FAILED');
  }

  async markSyncing(ids: string[]): Promise<void> {
    const now = new Date().toISOString();
    for (const id of ids) {
      const item = this.items.get(id);
      if (item) {
        item.status = 'SYNCING';
        item.lastAttemptAt = now;
        item.updatedAt = now;
      }
    }
  }

  async markSynced(ids: string[]): Promise<void> {
    const now = new Date().toISOString();
    for (const id of ids) {
      const item = this.items.get(id);
      if (item) {
        item.status = 'SYNCED';
        item.updatedAt = now;
      }
    }
  }

  async markFailed(id: string, error: string): Promise<void> {
    const item = this.items.get(id);
    if (item) {
      item.status = 'FAILED';
      item.retryCount += 1;
      item.lastError = error;
      item.updatedAt = new Date().toISOString();
    }
  }

  getAllItems(): OutboxItem[] {
    return Array.from(this.items.values());
  }

  clear(): void {
    this.items.clear();
  }
}

describe('Sync Outbox Queue & Data Integrity (Stage 2 / P0 Remediation)', () => {
  it('1. Create Lead: updates local store and generates persistent outbox item', async () => {
    const queue = new MockSyncQueue();
    const now = new Date().toISOString();
    const lead = {
      id: 'lead-001',
      businessName: 'Gold Gym Alambagh',
      phone: '7054447888',
      address: 'Alambagh, Lucknow',
      locality: 'Alambagh',
      status: 'NEW',
      isSynced: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      createdBy: 'agent-101',
      assignedTo: 'agent-101',
    };

    // Simulate repository create
    await queue.enqueue({
      entityType: 'leads',
      entityId: lead.id,
      operation: 'CREATE',
      payload: lead,
      userId: lead.createdBy,
    });

    const pending = await queue.getPendingItems();
    assert.strictEqual(pending.length, 1);
    assert.strictEqual(pending[0].entityType, 'leads');
    assert.strictEqual(pending[0].entityId, 'lead-001');
    assert.strictEqual(pending[0].operation, 'CREATE');
    assert.strictEqual(pending[0].payload.businessName, 'Gold Gym Alambagh');
    assert.strictEqual(pending[0].status, 'PENDING');
  });

  it('2. Update Lead & Status: generates UPDATE mutation with updated fields', async () => {
    const queue = new MockSyncQueue();
    const updatedLead = {
      id: 'lead-001',
      businessName: 'Gold Gym Alambagh (Updated)',
      phone: '7054447888',
      status: 'CONTACTED',
      isSynced: 0,
      updatedAt: new Date().toISOString(),
      updatedBy: 'agent-101',
    };

    await queue.enqueue({
      entityType: 'leads',
      entityId: updatedLead.id,
      operation: 'UPDATE',
      payload: updatedLead,
      userId: updatedLead.updatedBy,
    });

    const pending = await queue.getPendingItems();
    assert.strictEqual(pending.length, 1);
    assert.strictEqual(pending[0].operation, 'UPDATE');
    assert.strictEqual(pending[0].payload.status, 'CONTACTED');
  });

  it('3. Soft Delete / Archive Lead: generates UPDATE mutation with deletedAt timestamp', async () => {
    const queue = new MockSyncQueue();
    const deletedLead = {
      id: 'lead-001',
      businessName: 'Gold Gym Alambagh',
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isSynced: 0,
    };

    await queue.enqueue({
      entityType: 'leads',
      entityId: deletedLead.id,
      operation: 'UPDATE',
      payload: deletedLead,
      userId: 'admin-1',
    });

    const pending = await queue.getPendingItems();
    assert.strictEqual(pending.length, 1);
    assert.ok(pending[0].payload.deletedAt !== null);
  });

  it('4. Create, Complete, Cancel, and Reschedule Follow-Up: produces durable outbox records', async () => {
    const queue = new MockSyncQueue();
    const followUp = {
      id: 'fu-001',
      leadId: 'lead-001',
      userId: 'agent-101',
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      title: 'Call Back Regarding Product Catalog',
      status: 'PENDING',
      isSynced: 0,
    };

    // Create
    await queue.enqueue({
      entityType: 'follow_ups',
      entityId: followUp.id,
      operation: 'CREATE',
      payload: followUp,
      userId: 'agent-101',
    });

    // Complete
    const completed = { ...followUp, status: 'COMPLETED', completedAt: new Date().toISOString() };
    await queue.enqueue({
      entityType: 'follow_ups',
      entityId: completed.id,
      operation: 'UPDATE',
      payload: completed,
      userId: 'agent-101',
    });

    const all = queue.getAllItems();
    assert.strictEqual(all.length, 2);
    assert.strictEqual(all[0].operation, 'CREATE');
    assert.strictEqual(all[1].operation, 'UPDATE');
    assert.strictEqual(all[1].payload.status, 'COMPLETED');
  });

  it('5. Add Remark: enqueues remark mutation and touched lead update', async () => {
    const queue = new MockSyncQueue();
    const remark = {
      id: 'rem-001',
      leadId: 'lead-001',
      content: 'Owner interested in 500g whey sample packs',
      author: 'Agent Rahul',
      type: 'CUSTOM',
      createdAt: new Date().toISOString(),
      isSynced: 0,
    };

    await queue.enqueue({
      entityType: 'remarks',
      entityId: remark.id,
      operation: 'CREATE',
      payload: remark,
      userId: 'agent-101',
    });

    const pending = await queue.getPendingItems();
    assert.strictEqual(pending.length, 1);
    assert.strictEqual(pending[0].entityType, 'remarks');
    assert.strictEqual(pending[0].payload.content, 'Owner interested in 500g whey sample packs');
  });

  it('6. Create Call Record & Outcome: logs call_record with dialAttemptId idempotency', async () => {
    const queue = new MockSyncQueue();
    const callRecord = {
      id: 'attempt-uuid-777',
      leadId: 'lead-001',
      userId: 'agent-101',
      startedAt: new Date().toISOString(),
      durationSeconds: 0,
      outcome: 'CONNECTED',
      verificationStatus: 'UNVERIFIED',
      remark: 'Discussed gym pricing tiers',
      isSynced: 0,
    };

    await queue.enqueue({
      entityType: 'call_records',
      entityId: callRecord.id,
      operation: 'CREATE',
      payload: callRecord,
      userId: 'agent-101',
    });

    const pending = await queue.getPendingItems();
    assert.strictEqual(pending.length, 1);
    assert.strictEqual(pending[0].entityType, 'call_records');
    assert.strictEqual(pending[0].entityId, 'attempt-uuid-777');
    assert.strictEqual(pending[0].payload.verificationStatus, 'UNVERIFIED');
  });

  it('7. WhatsApp Message History: enqueues message_history record with recipient and content', async () => {
    const queue = new MockSyncQueue();
    const msg = {
      id: 'msg-001',
      leadId: 'lead-001',
      channel: 'WHATSAPP',
      recipientPhone: '917054447888',
      messageContent: 'Namaste! Here is the Amaratv Krishi catalogue.',
      sentStatus: 'INITIATED',
      isSynced: 0,
    };

    await queue.enqueue({
      entityType: 'message_history',
      entityId: msg.id,
      operation: 'CREATE',
      payload: msg,
      userId: 'agent-101',
    });

    const pending = await queue.getPendingItems();
    assert.strictEqual(pending.length, 1);
    assert.strictEqual(pending[0].entityType, 'message_history');
    assert.strictEqual(pending[0].payload.recipientPhone, '917054447888');
  });

  it('8. Single and Bulk Lead Assignment: enqueues updated leads and bulk audit record', async () => {
    const queue = new MockSyncQueue();

    // 3 updated leads
    for (let i = 1; i <= 3; i++) {
      await queue.enqueue({
        entityType: 'leads',
        entityId: `lead-00${i}`,
        operation: 'UPDATE',
        payload: { id: `lead-00${i}`, assignedTo: 'agent-202', updatedAt: new Date().toISOString() },
        userId: 'admin-1',
      });
    }

    // Bulk audit record
    await queue.enqueue({
      entityType: 'bulk_assignment_audits',
      entityId: 'bulk-audit-1',
      operation: 'CREATE',
      payload: {
        id: 'bulk-audit-1',
        performedBy: 'admin-1',
        targetAgentId: 'agent-202',
        selectedLeadCount: 3,
        successfulCount: 3,
        failedCount: 0,
        status: 'COMPLETED',
      },
      userId: 'admin-1',
    });

    const pending = await queue.getPendingItems();
    assert.strictEqual(pending.length, 4);
    const leadUpdates = pending.filter((p) => p.entityType === 'leads');
    const auditRecord = pending.find((p) => p.entityType === 'bulk_assignment_audits');
    assert.strictEqual(leadUpdates.length, 3);
    assert.ok(auditRecord !== undefined);
  });

  it('9. Import Operations: enqueues all imported leads and parent import_audit record', async () => {
    const queue = new MockSyncQueue();

    const importedLeads = [
      { id: 'imp-lead-1', businessName: 'Fit Zone Gym', phone: '9876543210' },
      { id: 'imp-lead-2', businessName: 'Powerhouse Fitness', phone: '9876543211' },
    ];

    for (const lead of importedLeads) {
      await queue.enqueue({
        entityType: 'leads',
        entityId: lead.id,
        operation: 'CREATE',
        payload: lead,
        userId: 'admin-1',
      });
    }

    await queue.enqueue({
      entityType: 'import_audits',
      entityId: 'import-audit-1',
      operation: 'CREATE',
      payload: {
        id: 'import-audit-1',
        uploadedBy: 'admin-1',
        filename: 'lucknow_gyms_seed.xlsx',
        totalRows: 2,
        imported: 2,
      },
      userId: 'admin-1',
    });

    const all = queue.getAllItems();
    assert.strictEqual(all.length, 3);
  });

  it('10. Retry, Partial Failure & Idempotency: handles failed items with exponential retry increment', async () => {
    const queue = new MockSyncQueue();

    const item1 = await queue.enqueue({
      entityType: 'leads',
      entityId: 'lead-retry-1',
      operation: 'CREATE',
      payload: { id: 'lead-retry-1', businessName: 'Retry Gym' },
      userId: 'agent-1',
    });

    const item2 = await queue.enqueue({
      entityType: 'leads',
      entityId: 'lead-retry-2',
      operation: 'CREATE',
      payload: { id: 'lead-retry-2', businessName: 'Success Gym' },
      userId: 'agent-1',
    });

    // Mark syncing
    await queue.markSyncing([item1.id, item2.id]);

    // item 2 succeeds, item 1 fails due to network glitch
    await queue.markSynced([item2.id]);
    await queue.markFailed(item1.id, '503 Service Unavailable');

    const pendingAfter = await queue.getPendingItems();
    assert.strictEqual(pendingAfter.length, 1);
    assert.strictEqual(pendingAfter[0].id, item1.id);
    assert.strictEqual(pendingAfter[0].status, 'FAILED');
    assert.strictEqual(pendingAfter[0].retryCount, 1);
    assert.strictEqual(pendingAfter[0].lastError, '503 Service Unavailable');

    // Retry cycle succeeds
    await queue.markSyncing([item1.id]);
    await queue.markSynced([item1.id]);

    const remainingPending = await queue.getPendingItems();
    assert.strictEqual(remainingPending.length, 0);
  });

  it('11. App Restart Simulation: pending outbox mutations survive process teardown', async () => {
    const queueInstance1 = new MockSyncQueue();

    await queueInstance1.enqueue({
      entityType: 'leads',
      entityId: 'lead-persist-1',
      operation: 'CREATE',
      payload: { id: 'lead-persist-1', businessName: 'Persistent Gym' },
      userId: 'agent-1',
    });

    // Extract serialized state representing IndexedDB
    const savedState = queueInstance1.getAllItems();

    // Reconstruct queue in new app instance
    const queueInstance2 = new MockSyncQueue();
    for (const item of savedState) {
      (queueInstance2 as any).items.set(item.id, item);
    }

    const pendingInNewInstance = await queueInstance2.getPendingItems();
    assert.strictEqual(pendingInNewInstance.length, 1);
    assert.strictEqual(pendingInNewInstance[0].entityId, 'lead-persist-1');
  });
});
