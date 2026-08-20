import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { SalesCRMDatabase } from '../src/db/database';
import { createCRMDataLayer } from '../src/db';
import { RealtimeService } from '../src/services/realtime/realtimeService';
import { Activity, Lead, User } from '../src/db/types';

describe('Phase 2K: Live Activity Feed Logic & Duration Formatting', () => {
  let db: SalesCRMDatabase;
  let crm: ReturnType<typeof createCRMDataLayer>;
  let admin: User;
  let agent: User;
  let lead: Lead;

  beforeEach(async () => {
    const testDbName = `test_live_feed_${Math.random().toString(36).substring(7)}`;
    db = new SalesCRMDatabase(testDbName);
    crm = createCRMDataLayer(db);
    RealtimeService.setCustomDatabase(db);
    RealtimeService.resetListeners();
    await db.seedDefaults();

    admin = await crm.users.createUser({
      id: 'admin-feed-1',
      name: 'Admin Vikram',
      email: 'admin@amaratvkrishi.com',
      phone: '9988776655',
      role: 'ADMIN',
      status: 'ACTIVE',
      organizationId: 'org-amaratv-1',
    });

    agent = await crm.users.createUser({
      id: 'agent-feed-1',
      name: 'Agent Rahul',
      email: 'rahul@amaratvkrishi.com',
      phone: '9123456781',
      role: 'AGENT',
      status: 'ACTIVE',
      organizationId: 'org-amaratv-1',
      createdBy: admin.id,
    });

    lead = await crm.leads.createLead({
      businessName: 'Gold Gym Mahanagar',
      phone: '9876543210',
      address: 'Mahanagar, Lucknow',
      assignedTo: agent.id,
    });
  });

  afterEach(async () => {
    RealtimeService.resetListeners();
    RealtimeService.setCustomDatabase(null);
    await db.delete();
    vi.restoreAllMocks();
  });

  it('correctly records and formats verified call activity with real talk duration', async () => {
    const verifiedCallActivity = await crm.activities.logActivity({
      leadId: lead.id,
      userId: agent.id,
      activityType: 'CALL_COMPLETED',
      metadata: {
        leadId: lead.id,
        leadName: 'Gold Gym Mahanagar',
        repName: 'Agent Rahul',
        outcome: 'CONNECTED',
        durationSeconds: 192, // 3m 12s
        verificationStatus: 'VERIFIED',
      },
    });

    const meta = verifiedCallActivity.metadata as any;
    expect(meta.verificationStatus).toBe('VERIFIED');
    expect(meta.durationSeconds).toBe(192);

    const isVerified = meta.verificationStatus === 'VERIFIED' && meta.durationSeconds > 0;
    const durStr = isVerified
      ? `${Math.floor(meta.durationSeconds / 60)}m ${meta.durationSeconds % 60}s • VERIFIED`
      : 'Duration unavailable • UNVERIFIED';

    expect(durStr).toBe('3m 12s • VERIFIED');
  });

  it('correctly records and formats unverified call activity with Duration unavailable', async () => {
    const unverifiedCallActivity = await crm.activities.logActivity({
      leadId: lead.id,
      userId: agent.id,
      activityType: 'CALL_COMPLETED',
      metadata: {
        leadId: lead.id,
        leadName: 'Gold Gym Mahanagar',
        repName: 'Agent Rahul',
        outcome: 'CONNECTED',
        durationSeconds: 0,
        verificationStatus: 'UNVERIFIED',
      },
    });

    const meta = unverifiedCallActivity.metadata as any;
    expect(meta.verificationStatus).toBe('UNVERIFIED');

    const isVerified = meta.verificationStatus === 'VERIFIED' && meta.durationSeconds > 0;
    const durStr = isVerified
      ? `${Math.floor(meta.durationSeconds / 60)}m ${meta.durationSeconds % 60}s • VERIFIED`
      : 'Duration unavailable • UNVERIFIED';

    expect(durStr).toBe('Duration unavailable • UNVERIFIED');
  });

  it('fetches activities chronologically in descending order for the live feed', async () => {
    await crm.activities.logActivity({
      leadId: lead.id,
      userId: agent.id,
      activityType: 'LEAD_CREATED',
      metadata: { businessName: 'Gold Gym Mahanagar', createdByName: 'Agent Rahul' },
    });

    await new Promise((r) => setTimeout(r, 15));

    await crm.activities.logActivity({
      leadId: lead.id,
      userId: admin.id,
      activityType: 'LEAD_ASSIGNED',
      metadata: { newAssigneeName: 'Agent Rahul', assignedByAdminName: 'Admin Vikram' },
    });

    const feed = await crm.activities.getRecentActivities();
    expect(feed.length).toBe(2);
    expect(feed[0].activityType).toBe('LEAD_ASSIGNED');
    expect(feed[1].activityType).toBe('LEAD_CREATED');
  });
});
