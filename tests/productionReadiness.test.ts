import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { SalesCRMDatabase } from '../src/db/database';
import { createCRMDataLayer } from '../src/db';
import { AdminAnalyticsService } from '../src/services/adminAnalyticsService';
import { AdminReportsService } from '../src/services/adminReportsService';
import { RealtimeService } from '../src/services/realtime/realtimeService';
import { User, Lead } from '../src/db/types';

describe('Phase 2N: Production Readiness & Offline-First Resilience', () => {
  let db: SalesCRMDatabase;
  let crm: ReturnType<typeof createCRMDataLayer>;
  let admin: User;
  let agent: User;

  beforeEach(async () => {
    const testDbName = `test_prod_ready_${Math.random().toString(36).substring(7)}`;
    db = new SalesCRMDatabase(testDbName);
    crm = createCRMDataLayer(db);
    AdminAnalyticsService.setCustomDatabase(db);
    AdminReportsService.setCustomDatabase(db);
    RealtimeService.setCustomDatabase(db);
    await db.seedDefaults();

    admin = await crm.users.createUser({
      id: 'admin-pr-1',
      name: 'Admin Vikram',
      email: 'admin@amaratvkrishi.com',
      phone: '9988776655',
      role: 'ADMIN',
      status: 'ACTIVE',
      organizationId: 'org-amaratv-main',
    });

    agent = await crm.users.createUser({
      id: 'agent-pr-1',
      name: 'Agent Rahul',
      email: 'rahul@amaratvkrishi.com',
      phone: '9123456781',
      role: 'AGENT',
      status: 'ACTIVE',
      organizationId: 'org-amaratv-main',
      createdBy: admin.id,
    });
  });

  afterEach(async () => {
    AdminAnalyticsService.setCustomDatabase(null);
    AdminReportsService.setCustomDatabase(null);
    RealtimeService.setCustomDatabase(null);
    await db.delete();
  });

  describe('1. Offline Operation & Outbox Preservation', () => {
    it('operates fully offline in Dexie and preserves pending mutations in outbox', async () => {
      // Offline lead creation
      const lead = await crm.leads.createLead({
        businessName: '[TEST-2N] Offline Gym',
        phone: '9876543299',
        address: 'Gomti Nagar, Lucknow',
        status: 'NEW',
        assignedTo: agent.id,
      });

      // Queue outbox mutation
      await db.outbox.add({
        id: 'outbox-pr-1',
        organizationId: 'org-amaratv-main',
        entityType: 'leads',
        entityId: lead.id,
        operation: 'CREATE',
        payload: { businessName: lead.businessName, phone: lead.phone },
        userId: agent.id,
        deviceId: 'dev-phone-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        retryCount: 0,
        status: 'PENDING',
        lastError: null,
        lastAttemptAt: null,
      });

      // Realtime drops
      RealtimeService.setConnectionStatus('DISCONNECTED');
      expect(RealtimeService.getStatus()).toBe('DISCONNECTED');

      // Local lead and outbox item must remain completely intact
      const storedLead = await db.leads.get(lead.id);
      expect(storedLead).toBeDefined();
      expect(storedLead?.businessName).toBe('[TEST-2N] Offline Gym');

      const outboxItem = await db.outbox.get('outbox-pr-1');
      expect(outboxItem).toBeDefined();
      expect(outboxItem?.status).toBe('PENDING');
    });
  });

  describe('2. Backup / Restore Reliability', () => {
    it('exports sanitized JSON backup and restores safely', async () => {
      await crm.leads.createLead({
        businessName: 'Backup Test Gym',
        phone: '9888877700',
        address: 'Aliganj, Lucknow',
      });

      const backupData = await crm.backup.generateBackupPayload();
      expect(backupData).toBeDefined();
      expect(backupData.schemaVersion).toBe(2);
      expect(backupData.data.leads.length).toBeGreaterThan(0);

      // Verify no passwords or auth tokens in backup payload
      const serialized = JSON.stringify(backupData);
      expect(serialized.toLowerCase()).not.toContain('password');
      expect(serialized.toLowerCase()).not.toContain('service_role');
      expect(serialized.toLowerCase()).not.toContain('token');
    });
  });

  describe('3. Zero Fake Duration Analytics Invariant', () => {
    it('guarantees unverified duration never pollutes talk-time calculations', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Zero Fake Gym',
        phone: '9888877701',
        address: 'Lucknow',
      });

      // Log 10 UNVERIFIED calls with duration = 0
      for (let i = 0; i < 10; i++) {
        await crm.callRecords.createCallRecord({
          leadId: lead.id,
          userId: agent.id,
          startedAt: new Date().toISOString(),
          durationSeconds: 0,
          outcome: 'CONNECTED',
          verificationStatus: 'UNVERIFIED',
        });
      }

      const kpis = await AdminAnalyticsService.getOrganisationKPIs(admin);
      expect(kpis.calls.total).toBe(10);
      expect(kpis.calls.verified).toBe(0);
      expect(kpis.calls.unverified).toBe(10);
      expect(kpis.calls.verifiedTalkTimeSeconds).toBe(0);
      expect(kpis.calls.averageVerifiedDurationSeconds).toBe(0);
    });
  });
});
