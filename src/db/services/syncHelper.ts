/**
 * SyncHelper Service
 * Architecture-ready module for future bidirectional cloud synchronization.
 * Extracts dirty local changes and applies incoming remote server changes using
 * Last-Write-Wins (LWW) conflict resolution based on ISO timestamps.
 */

import { SalesCRMDatabase } from '../database';
import {
  Lead,
  Remark,
  CallHistory,
  FollowUp,
  MessageHistory,
  MessageTemplate,
  User,
  Activity,
  CallRecord,
  ImportAudit,
} from '../types';

export interface SyncPayload {
  lastSyncTimestamp: string;
  changes: {
    leads: Lead[];
    remarks: Remark[];
    callHistory: CallHistory[];
    followUps: FollowUp[];
    messageHistory: MessageHistory[];
    messageTemplates: MessageTemplate[];
    users?: User[];
    activities?: Activity[];
    callRecords?: CallRecord[];
    importAudits?: ImportAudit[];
  };
}

export interface InboundSyncPayload {
  serverTimestamp: string;
  changes: {
    leads?: Lead[];
    remarks?: Remark[];
    callHistory?: CallHistory[];
    followUps?: FollowUp[];
    messageHistory?: MessageHistory[];
    messageTemplates?: MessageTemplate[];
    users?: User[];
    activities?: Activity[];
    callRecords?: CallRecord[];
    importAudits?: ImportAudit[];
  };
}

export class SyncHelper {
  constructor(private db: SalesCRMDatabase) {}

  /**
   * Collects all local records created or modified since the last cloud sync.
   */
  async getLocalChanges(): Promise<SyncPayload> {
    const [
      leads,
      remarks,
      callHistory,
      followUps,
      messageHistory,
      messageTemplates,
      users,
      activities,
      callRecords,
      importAudits,
    ] = await Promise.all([
      this.db.leads.where('isSynced').equals(0).toArray(),
      this.db.remarks.where('isSynced').equals(0).toArray(),
      this.db.callHistory.where('isSynced').equals(0).toArray(),
      this.db.followUps.where('isSynced').equals(0).toArray(),
      this.db.messageHistory.where('isSynced').equals(0).toArray(),
      this.db.messageTemplates.where('isSynced').equals(0).toArray(),
      this.db.users.where('isSynced').equals(0).toArray(),
      this.db.activities.where('isSynced').equals(0).toArray(),
      this.db.callRecords.where('isSynced').equals(0).toArray(),
      this.db.importAudits.where('isSynced').equals(0).toArray(),
    ]);

    return {
      lastSyncTimestamp: new Date().toISOString(),
      changes: {
        leads,
        remarks,
        callHistory,
        followUps,
        messageHistory,
        messageTemplates,
        users,
        activities,
        callRecords,
        importAudits,
      },
    };
  }

  /**
   * Marks local records as synced after successful upload to cloud API.
   */
  async markAsSynced(syncedPayload: SyncPayload): Promise<void> {
    const now = new Date().toISOString();

    await this.db.transaction('rw', this.db.tables, async () => {
      const updateSyncFlag = async (tableName: keyof SalesCRMDatabase, ids: string[] | undefined) => {
        if (!ids || ids.length === 0) return;
        const table = this.db[tableName] as any;
        if (!table) return;
        for (const id of ids) {
          await table.update(id, { isSynced: 1, syncedAt: now });
        }
      };

      await Promise.all([
        updateSyncFlag('leads', syncedPayload.changes.leads.map((l) => l.id)),
        updateSyncFlag('remarks', syncedPayload.changes.remarks.map((r) => r.id)),
        updateSyncFlag('callHistory', syncedPayload.changes.callHistory.map((c) => c.id)),
        updateSyncFlag('followUps', syncedPayload.changes.followUps.map((f) => f.id)),
        updateSyncFlag('messageHistory', syncedPayload.changes.messageHistory.map((m) => m.id)),
        updateSyncFlag('messageTemplates', syncedPayload.changes.messageTemplates.map((t) => t.id)),
        updateSyncFlag('users', syncedPayload.changes.users?.map((u) => u.id)),
        updateSyncFlag('activities', syncedPayload.changes.activities?.map((a) => a.id)),
        updateSyncFlag('callRecords', syncedPayload.changes.callRecords?.map((c) => c.id)),
        updateSyncFlag('importAudits', syncedPayload.changes.importAudits?.map((i) => i.id)),
      ]);
    });
  }

  /**
   * Ingests remote changes from the cloud server.
   * Resolves conflicts using Last-Write-Wins (LWW) on `updatedAt`.
   */
  async applyInboundChanges(inbound: InboundSyncPayload): Promise<{ appliedCount: number }> {
    let count = 0;

    await this.db.transaction('rw', this.db.tables, async () => {
      const applyTable = async (tableName: keyof SalesCRMDatabase, incomingRecords?: any[]) => {
        if (!incomingRecords || incomingRecords.length === 0) return;
        const table = this.db[tableName] as any;
        if (!table) return;

        for (const remoteItem of incomingRecords) {
          const localItem = await table.get(remoteItem.id);

          if (!localItem) {
            // New record from server
            await table.add({ ...remoteItem, isSynced: 1, syncedAt: inbound.serverTimestamp });
            count++;
          } else {
            // Conflict check: only apply if remote updatedAt > local updatedAt
            const remoteTime = new Date(remoteItem.updatedAt || 0).getTime();
            const localTime = new Date(localItem.updatedAt || 0).getTime();

            if (remoteTime >= localTime) {
              await table.put({ ...remoteItem, isSynced: 1, syncedAt: inbound.serverTimestamp });
              count++;
            }
          }
        }
      };

      await Promise.all([
        applyTable('leads', inbound.changes.leads),
        applyTable('remarks', inbound.changes.remarks),
        applyTable('callHistory', inbound.changes.callHistory),
        applyTable('followUps', inbound.changes.followUps),
        applyTable('messageHistory', inbound.changes.messageHistory),
        applyTable('messageTemplates', inbound.changes.messageTemplates),
        applyTable('users', inbound.changes.users),
        applyTable('activities', inbound.changes.activities),
        applyTable('callRecords', inbound.changes.callRecords),
        applyTable('importAudits', inbound.changes.importAudits),
      ]);
    });

    return { appliedCount: count };
  }
}
