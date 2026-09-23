import 'fake-indexeddb/auto';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SalesCRMDatabase } from '../src/db/database.ts';
import { DashboardService } from '../src/services/dashboardService.ts';
import type { AccessScope } from '../src/db/accessScope.ts';
import type { CallRecord, FollowUp, Lead, MessageHistory, Remark } from '../src/db/types.ts';

const scope: AccessScope = {
  organizationId: 'org-dashboard-characterization',
  userId: 'agent-dashboard',
  role: 'AGENT',
};

function localTime(hour: number, minute = 0): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute).toISOString();
}

function priorDay(hour = 12): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, hour).toISOString();
}

function baseLead(id: string, status: Lead['status'], locality: string, assignedTo = scope.userId): Lead {  const now = new Date().toISOString();
  return {
    id,
    businessName: `Business ${id}`,
    category: 'Gym',
    phone: '9876543210',
    phoneRaw: '9876543210',
    phoneE164: '+919876543210',
    phoneType: 'mobile',
    alternatePhone: null,
    contactPerson: null,
    address: 'Lucknow',
    locality,
    pincode: '226001',
    city: 'Lucknow',
    state: 'Uttar Pradesh',
    website: null,
    rating: null,
    reviewCount: null,
    source: 'Dashboard characterization',
    sourceFile: null,
    sourceRow: null,
    status,
    customNotes: '',
    lastContactedAt: null,
    nextFollowUpAt: null,
    callCount: 0,    createdAt: now,
    updatedAt: now,
    isSynced: 1,
    syncedAt: now,
    deletedAt: null,
    createdBy: assignedTo,
    assignedTo,
    updatedBy: assignedTo,
  };
}

function followUp(id: string, leadId: string, scheduledAt: string, status: FollowUp['status']): FollowUp {
  const now = new Date().toISOString();
  return {
    id,
    leadId,
    userId: scope.userId,
    scheduledAt,
    title: `Follow-up ${id}`,
    notes: `Notes ${id}`,
    priority: 'MEDIUM',
    status,
    completedAt: status === 'COMPLETED' ? scheduledAt : null,
    createdAt: now,
    updatedAt: now,
    isSynced: 1,
    deletedAt: null,
  };
}
function callRecord(id: string, leadId: string, startedAt: string): CallRecord {
  return {
    id,
    leadId,
    userId: scope.userId,
    deviceId: 'dashboard-test-device',
    startedAt,
    answeredAt: startedAt,
    endedAt: startedAt,
    durationSeconds: 60,
    outcome: 'CONNECTED',
    remark: `Call ${id}`,
    verificationStatus: 'VERIFIED',
    createdAt: startedAt,
    updatedAt: startedAt,
    isSynced: 1,
    deletedAt: null,
  };
}

function message(id: string, leadId: string, sentAt: string): MessageHistory {
  return {
    id,
    leadId,
    userId: scope.userId,
    channel: 'WHATSAPP',
    templateId: null,
    recipientPhone: '+919876543210',    messageContent: `Message ${id}`,
    sentStatus: 'SENT',
    sentAt,
    createdAt: sentAt,
    updatedAt: sentAt,
    isSynced: 1,
    deletedAt: null,
  };
}

function remark(id: string, leadId: string, createdAt: string): Remark {
  return {
    id,
    leadId,
    userId: scope.userId,
    type: 'CUSTOM',
    content: `Remark ${id}`,
    author: scope.userId,
    createdAt,
    updatedAt: createdAt,
    isSynced: 1,
    deletedAt: null,
  };
}

describe('DashboardService characterization', () => {
  it('preserves scoped metrics, follow-up bucketing, aggregations, and recent activity ordering', async () => {
    const db = new SalesCRMDatabase(`DashboardCharacterization_${Date.now()}`, scope);
    const service = new DashboardService(db);    try {
      await db.open();
      await db.leads.bulkPut([
        baseLead('lead-new', 'NEW', 'Hazratganj'),
        baseLead('lead-interested', 'INTERESTED', 'Hazratganj'),
        baseLead('lead-sample', 'SAMPLE_REQUESTED', 'Gomti Nagar'),
        baseLead('lead-customer', 'CUSTOMER', 'Gomti Nagar'),
        baseLead('lead-other-agent', 'CUSTOMER', 'Aliganj', 'agent-other'),
        { ...baseLead('lead-deleted', 'CUSTOMER', 'Aliganj'), deletedAt: localTime(1) },
      ]);

      await db.followUps.bulkPut([
        followUp('fu-overdue', 'lead-new', priorDay(12), 'PENDING'),
        followUp('fu-today', 'lead-interested', localTime(14), 'PENDING'),
        followUp('fu-complete', 'lead-customer', localTime(15), 'COMPLETED'),
        followUp('fu-hidden', 'lead-other-agent', localTime(16), 'PENDING'),
      ]);
      await db.callRecords.bulkPut([
        callRecord('call-today', 'lead-new', localTime(10)),
        callRecord('call-old', 'lead-new', priorDay(10)),
        callRecord('call-hidden', 'lead-other-agent', localTime(11)),
      ]);
      await db.messageHistory.bulkPut([
        message('msg-today', 'lead-interested', localTime(11)),
        message('msg-old', 'lead-interested', priorDay(11)),
      ]);      await db.remarks.bulkPut([
        remark('rem-newer', 'lead-sample', localTime(16)),
        remark('rem-older', 'lead-sample', localTime(9)),
      ]);

      const result = await service.getDashboardData();

      assert.deepEqual(result.metrics, {
        totalLeads: 4,
        notContacted: 1,
        callsToday: 1,
        whatsAppToday: 1,
        interested: 1,
        samplesRequested: 1,
        followUpsToday: 1,
        overdueFollowUps: 1,
        customers: 1,
      });
      assert.deepEqual(result.todayFollowUps.map((item) => item.id), ['fu-today']);
      assert.equal(result.todayFollowUps[0]?.lead?.businessName, 'Business lead-interested');
      assert.deepEqual(
        result.pipeline.map(({ status, count }) => [status, count]),
        [['NEW', 1], ['CONTACTED', 0], ['INTERESTED', 1], ['SAMPLE_REQUESTED', 1], ['FOLLOW_UP', 0], ['NEGOTIATION', 0], ['CUSTOMER', 1], ['NOT_INTERESTED', 0]],
      );
      const localities = [...result.localities].sort((a, b) => a.locality.localeCompare(b.locality));
      assert.deepEqual(localities.map(({ locality, total }) => [locality, total]), [
        ['Gomti Nagar', 2],
        ['Hazratganj', 2],
      ]);
      assert.equal(localities[0]?.interested, 1);
      assert.equal(localities[0]?.customers, 1);
      assert.equal(localities[1]?.interested, 1);
      assert.deepEqual(
        result.recentActivities.map((item) => item.id).slice(0, 4),
        ['rem-rem-newer', 'fu-fu-complete', 'msg-msg-today', 'call-call-today'],
      );
      assert.ok(result.recentActivities.every((item) => item.leadId !== 'lead-other-agent'));
    } finally {
      await db.delete();
    }
  });
});
