/**
 * Lead Repository
 * Handles all database operations for Lead entities including normalization,
 * duplicate prevention, indexing, multi-criteria filtering, and cascading soft/hard delete.
 */

import { SalesCRMDatabase } from '../database';
import { SyncQueue } from '../../services/sync/syncQueue';
import {
  Lead,
  LeadStatus,
  LeadFilterParams,
  LeadStats,
  Remark,
  CallHistory,
  FollowUp,
  MessageHistory,
} from '../types';
import {
  normalizePhoneNumber,
  parseAddress,
  cleanBusinessName,
} from '../services/leadNormalizer';

export interface LeadWithHistory {
  lead: Lead;
  remarks: Remark[];
  callHistory: CallHistory[];
  followUps: FollowUp[];
  messageHistory: MessageHistory[];
}

export interface BulkImportResult {
  totalProcessed: number;
  imported: number;
  skippedDuplicates: number;
  errors: Array<{ row: number; reason: string }>;
  importedLeadIds: string[];
}

export interface RawLeadImportInput {
  title?: string;
  phone?: string;
  address?: string;
  category?: string;
  alternatePhone?: string;
  website?: string;
  sourceFile?: string;
  sourceRow?: number;
}

export class LeadRepository {
  private syncQueue?: SyncQueue;

  constructor(private db: SalesCRMDatabase, syncQueue?: SyncQueue) {
    this.syncQueue = syncQueue;
  }

  private getSyncQueue(): SyncQueue {
    if (!this.syncQueue) {
      this.syncQueue = new SyncQueue(this.db);
    }
    return this.syncQueue;
  }

  /**
   * Generates a UUID v4 string (browser/Node compatible).
   */
  private generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Checks if a lead with the given normalized phone already exists in the database.
   */
  async findByPhone(phoneClean: string): Promise<Lead | undefined> {
    if (!phoneClean) return undefined;
    return await this.db.leads
      .where('phone')
      .equals(phoneClean)
      .and((lead) => lead.deletedAt === null)
      .first();
  }

  /**
   * Creates a new Lead with automatic phone and address normalization and duplicate checking.
   */
  async createLead(input: {
    businessName: string;
    phone: string;
    address: string;
    locality?: string | null;
    category?: string;
    alternatePhone?: string | null;
    contactPerson?: string | null;
    website?: string | null;
    rating?: number | null;
    reviewCount?: number | null;
    source?: string;
    sourceFile?: string | null;
    sourceRow?: number | null;
    status?: LeadStatus;
    customNotes?: string;
    createdBy?: string | null;
    assignedTo?: string | null;
    updatedBy?: string | null;
  }): Promise<Lead> {
    const normPhone = normalizePhoneNumber(input.phone);
    const parsedAddr = parseAddress(input.address);
    const cleanedName = cleanBusinessName(input.businessName);

    // Duplicate Check by normalized primary phone
    if (normPhone.clean) {
      const existing = await this.findByPhone(normPhone.clean);
      if (existing) {
        throw new Error(
          `Duplicate lead: A lead with phone number ${normPhone.displayFormatted} already exists (${existing.businessName}).`
        );
      }
    }

    const now = new Date().toISOString();
    const newLead: Lead = {
      id: this.generateId(),
      businessName: cleanedName,
      category: (input.category || 'Gym').trim(),
      phone: normPhone.clean,
      phoneRaw: normPhone.raw || input.phone,
      phoneE164: normPhone.e164,
      phoneType: normPhone.type,
      alternatePhone: input.alternatePhone ? normalizePhoneNumber(input.alternatePhone).clean : null,
      contactPerson: input.contactPerson ? input.contactPerson.trim() : null,
      address: parsedAddr.fullAddress,
      locality: input.locality || parsedAddr.locality,
      pincode: parsedAddr.pincode,
      city: parsedAddr.city,
      state: parsedAddr.state,
      website: input.website ? input.website.trim() : null,
      rating: input.rating !== undefined ? input.rating : null,
      reviewCount: input.reviewCount !== undefined ? input.reviewCount : null,
      source: input.source || 'Manual Entry',
      sourceFile: input.sourceFile || null,
      sourceRow: input.sourceRow || null,
      status: input.status || 'NEW',
      customNotes: input.customNotes ? input.customNotes.trim() : '',
      lastContactedAt: null,
      nextFollowUpAt: null,
      callCount: 0,
      createdAt: now,
      updatedAt: now,
      isSynced: 0,
      syncedAt: null,
      deletedAt: null,
      createdBy: input.createdBy !== undefined ? input.createdBy : null,
      assignedTo: input.assignedTo !== undefined ? input.assignedTo : null,
      updatedBy: input.updatedBy !== undefined ? input.updatedBy : input.createdBy || null,
    };

    await this.db.leads.add(newLead);
    try {
      await this.getSyncQueue().enqueue({
        entityType: 'leads',
        entityId: newLead.id,
        operation: 'CREATE',
        payload: newLead,
        userId: newLead.createdBy || 'local-user',
      });
    } catch (err) {
      console.warn('Outbox enqueue failed for createLead:', err);
    }
    return newLead;
  }

  /**
   * Bulk imports raw lead objects (e.g. parsed from Excel sheet) in a single database transaction.
   * Performs deduplication against existing records and skips duplicate rows within the batch.
   */
  async bulkImportLeads(
    rawLeads: RawLeadImportInput[],
    sourceName: string = 'Excel Seed',
    options: {
      createdBy?: string | null;
      assignedTo?: string | null;
    } = {}
  ): Promise<BulkImportResult> {
    const result: BulkImportResult = {
      totalProcessed: rawLeads.length,
      imported: 0,
      skippedDuplicates: 0,
      errors: [],
      importedLeadIds: [],
    };

    const seenBatchPhones = new Set<string>();
    const leadsToInsert: Lead[] = [];

    // Pre-fetch all active phone numbers to minimize index queries
    const existingActiveLeads = await this.db.leads
      .filter((l) => l.deletedAt === null && Boolean(l.phone))
      .toArray();
    const existingPhones = new Set(existingActiveLeads.map((l) => l.phone));

    const now = new Date().toISOString();

    for (let i = 0; i < rawLeads.length; i++) {
      const row = rawLeads[i];
      const rowNum = row.sourceRow || i + 2;

      if (!row.title || !row.phone) {
        result.errors.push({
          row: rowNum,
          reason: 'Missing required business name or phone number.',
        });
        continue;
      }

      const normPhone = normalizePhoneNumber(row.phone);
      const parsedAddr = parseAddress(row.address);
      const cleanedName = cleanBusinessName(row.title);

      if (!normPhone.clean) {
        result.errors.push({
          row: rowNum,
          reason: `Invalid phone number format: "${row.phone}".`,
        });
        continue;
      }

      // Check duplicates in existing DB or current batch
      if (existingPhones.has(normPhone.clean) || seenBatchPhones.has(normPhone.clean)) {
        result.skippedDuplicates++;
        continue;
      }

      seenBatchPhones.add(normPhone.clean);

      const leadId = this.generateId();
      const lead: Lead = {
        id: leadId,
        businessName: cleanedName,
        category: (row.category || 'Gym').trim(),
        phone: normPhone.clean,
        phoneRaw: normPhone.raw || row.phone,
        phoneE164: normPhone.e164,
        phoneType: normPhone.type,
        alternatePhone: row.alternatePhone ? normalizePhoneNumber(row.alternatePhone).clean : null,
        contactPerson: null,
        address: parsedAddr.fullAddress,
        locality: parsedAddr.locality,
        pincode: parsedAddr.pincode,
        city: parsedAddr.city,
        state: parsedAddr.state,
        website: row.website ? row.website.trim() : null,
        rating: null,
        reviewCount: null,
        source: sourceName,
        sourceFile: row.sourceFile || null,
        sourceRow: rowNum,
        status: 'NEW',
        customNotes: '',
        lastContactedAt: null,
        nextFollowUpAt: null,
        callCount: 0,
        createdAt: now,
        updatedAt: now,
        isSynced: 0,
        syncedAt: null,
        deletedAt: null,
        createdBy: options.createdBy !== undefined ? options.createdBy : null,
        assignedTo: options.assignedTo !== undefined ? options.assignedTo : null,
        updatedBy: options.createdBy || null,
      };

      leadsToInsert.push(lead);
      result.importedLeadIds.push(leadId);
    }

    if (leadsToInsert.length > 0) {
      await this.db.leads.bulkAdd(leadsToInsert);
      result.imported = leadsToInsert.length;
      try {
        const queue = this.getSyncQueue();
        for (const lead of leadsToInsert) {
          await queue.enqueue({
            entityType: 'leads',
            entityId: lead.id,
            operation: 'CREATE',
            payload: lead,
            userId: lead.createdBy || 'local-user',
          });
        }
      } catch (err) {
        console.warn('Outbox enqueue failed for bulkImportLeads:', err);
      }
    }

    return result;
  }

  /**
   * Retrieves a single lead by its ID (ignoring soft-deleted by default).
   */
  async getLeadById(id: string, includeDeleted = false): Promise<Lead | undefined> {
    const lead = await this.db.leads.get(id);
    if (!lead) return undefined;
    if (!includeDeleted && lead.deletedAt !== null) return undefined;
    return lead;
  }

  /**
   * Retrieves a lead along with all historical relations (Remarks, Calls, Follow-ups, Messages).
   */
  async getLeadWithFullHistory(id: string): Promise<LeadWithHistory | undefined> {
    const lead = await this.getLeadById(id);
    if (!lead) return undefined;

    const [remarks, callHistory, followUps, messageHistory] = await Promise.all([
      this.db.remarks
        .where('leadId')
        .equals(id)
        .and((r) => r.deletedAt === null)
        .reverse()
        .sortBy('createdAt'),
      this.db.callHistory
        .where('leadId')
        .equals(id)
        .and((c) => c.deletedAt === null)
        .reverse()
        .sortBy('startedAt'),
      this.db.followUps
        .where('leadId')
        .equals(id)
        .and((f) => f.deletedAt === null)
        .reverse()
        .sortBy('scheduledAt'),
      this.db.messageHistory
        .where('leadId')
        .equals(id)
        .and((m) => m.deletedAt === null)
        .reverse()
        .sortBy('sentAt'),
    ]);

    return {
      lead,
      remarks,
      callHistory,
      followUps,
      messageHistory,
    };
  }

  /**
   * Updates lead fields.
   */
  async updateLead(id: string, updates: Partial<Omit<Lead, 'id' | 'createdAt'>>): Promise<Lead> {
    const existing = await this.getLeadById(id);
    if (!existing) throw new Error(`Lead with id ${id} not found.`);

    // If phone is updated, check duplicate
    if (updates.phone && updates.phone !== existing.phone) {
      const norm = normalizePhoneNumber(updates.phone);
      const duplicate = await this.findByPhone(norm.clean);
      if (duplicate && duplicate.id !== id) {
        throw new Error(`Another lead with phone number ${norm.displayFormatted} already exists.`);
      }
      updates.phone = norm.clean;
      updates.phoneE164 = norm.e164;
      updates.phoneType = norm.type;
    }

    const now = new Date().toISOString();
    const updatePayload = {
      ...updates,
      updatedAt: now,
      isSynced: 0,
    };

    await this.db.leads.update(id, updatePayload);
    const updated = await this.db.leads.get(id);
    if (updated) {
      try {
        await this.getSyncQueue().enqueue({
          entityType: 'leads',
          entityId: updated.id,
          operation: 'UPDATE',
          payload: updated,
          userId: updated.updatedBy || updated.createdBy || 'local-user',
        });
      } catch (err) {
        console.warn('Outbox enqueue failed for updateLead:', err);
      }
    }
    return updated!;
  }

  /**
   * Updates lead status.
   */
  async updateLeadStatus(id: string, newStatus: LeadStatus): Promise<Lead> {
    return this.updateLead(id, { status: newStatus });
  }

  /**
   * Searches and filters leads with pagination, multi-status filter, locality filter, and text search.
   */
  async searchAndFilterLeads(params: LeadFilterParams = {}): Promise<{ leads: Lead[]; total: number }> {
    const {
      searchTerm,
      status,
      locality,
      category,
      hasFollowUp,
      followUpDueBefore,
      includeDeleted = false,
      limit = 50,
      offset = 0,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
    } = params;

    let collection = this.db.leads.toCollection();

    // Soft delete filter
    if (!includeDeleted) {
      collection = collection.filter((l) => l.deletedAt === null);
    }

    // Status filter
    if (status) {
      const statuses = Array.isArray(status) ? status : [status];
      if (statuses.length > 0) {
        collection = collection.filter((l) => statuses.includes(l.status));
      }
    }

    // Locality filter
    if (locality) {
      const localities = Array.isArray(locality) ? locality : [locality];
      if (localities.length > 0) {
        collection = collection.filter((l) => localities.includes(l.locality));
      }
    }

    // Category filter
    if (category) {
      const categories = Array.isArray(category) ? category : [category];
      if (categories.length > 0) {
        collection = collection.filter((l) => categories.includes(l.category));
      }
    }

    // Follow-up filters
    if (hasFollowUp !== undefined) {
      collection = collection.filter((l) => (hasFollowUp ? l.nextFollowUpAt !== null : l.nextFollowUpAt === null));
    }

    if (followUpDueBefore) {
      collection = collection.filter((l) => l.nextFollowUpAt !== null && l.nextFollowUpAt <= followUpDueBefore);
    }

    // Phase 2 Ownership filters
    if (params.assignedTo !== undefined) {
      if (params.assignedTo === null || params.assignedTo === 'UNASSIGNED') {
        collection = collection.filter((l) => !l.assignedTo);
      } else if (params.assignedTo === 'ASSIGNED') {
        collection = collection.filter((l) => !!l.assignedTo);
      } else {
        collection = collection.filter((l) => l.assignedTo === params.assignedTo);
      }
    }

    if (params.createdBy !== undefined) {
      collection = collection.filter((l) => l.createdBy === params.createdBy);
    }

    // Search term filter across business name, phone, locality, contact person, address
    if (searchTerm && searchTerm.trim() !== '') {
      const term = searchTerm.trim().toLowerCase();
      const termDigits = term.replace(/\D/g, '');
      collection = collection.filter((l) => {
        const nameMatch = l.businessName.toLowerCase().includes(term);
        const localityMatch = l.locality.toLowerCase().includes(term);
        const contactMatch = l.contactPerson ? l.contactPerson.toLowerCase().includes(term) : false;
        const addressMatch = l.address.toLowerCase().includes(term);
        const phoneMatch = termDigits ? l.phone.includes(termDigits) : l.phone.includes(term);
        return nameMatch || localityMatch || contactMatch || addressMatch || phoneMatch;
      });
    }

    const allMatched = await collection.toArray();
    const total = allMatched.length;

    // Sorting
    allMatched.sort((a, b) => {
      let valA = a[sortBy] ?? '';
      let valB = b[sortBy] ?? '';

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Pagination
    const paginated = allMatched.slice(offset, offset + limit);

    return {
      leads: paginated,
      total,
    };
  }

  /**
   * Retrieves unique localities for filter chips.
   */
  async getDistinctLocalities(): Promise<string[]> {
    const activeLeads = await this.db.leads
      .filter((l) => l.deletedAt === null && Boolean(l.locality))
      .toArray();
    const set = new Set(activeLeads.map((l) => l.locality));
    return Array.from(set).sort();
  }

  /**
   * Retrieves unique categories for filter chips.
   */
  async getDistinctCategories(): Promise<string[]> {
    const activeLeads = await this.db.leads
      .filter((l) => l.deletedAt === null && Boolean(l.category))
      .toArray();
    const set = new Set(activeLeads.map((l) => l.category));
    return Array.from(set).sort();
  }

  /**
   * Soft-deletes a lead (marks deletedAt timestamp).
   */
  async softDeleteLead(id: string): Promise<void> {
    const lead = await this.getLeadById(id);
    if (!lead) throw new Error(`Lead with id ${id} not found.`);
    const now = new Date().toISOString();
    await this.db.leads.update(id, {
      deletedAt: now,
      updatedAt: now,
      isSynced: 0,
    });
    const updated = await this.db.leads.get(id);
    if (updated) {
      try {
        await this.getSyncQueue().enqueue({
          entityType: 'leads',
          entityId: updated.id,
          operation: 'UPDATE',
          payload: updated,
          userId: updated.updatedBy || updated.createdBy || 'local-user',
        });
      } catch (err) {
        console.warn('Outbox enqueue failed for softDeleteLead:', err);
      }
    }
  }

  /**
   * Restores a soft-deleted lead.
   */
  async restoreLead(id: string): Promise<void> {
    const lead = await this.getLeadById(id, true);
    if (!lead) throw new Error(`Lead with id ${id} not found.`);
    const now = new Date().toISOString();
    await this.db.leads.update(id, {
      deletedAt: null,
      updatedAt: now,
      isSynced: 0,
    });
    const updated = await this.db.leads.get(id);
    if (updated) {
      try {
        await this.getSyncQueue().enqueue({
          entityType: 'leads',
          entityId: updated.id,
          operation: 'UPDATE',
          payload: updated,
          userId: updated.updatedBy || updated.createdBy || 'local-user',
        });
      } catch (err) {
        console.warn('Outbox enqueue failed for restoreLead:', err);
      }
    }
  }

  /**
   * Hard-deletes a lead and cascades deletion to all child records (Remarks, Calls, Follow-ups, Messages).
   */
  async hardDeleteLead(id: string): Promise<void> {
    await this.db.transaction('rw', [
      this.db.leads,
      this.db.remarks,
      this.db.callHistory,
      this.db.followUps,
      this.db.messageHistory,
    ], async () => {
      await Promise.all([
        this.db.leads.delete(id),
        this.db.remarks.where('leadId').equals(id).delete(),
        this.db.callHistory.where('leadId').equals(id).delete(),
        this.db.followUps.where('leadId').equals(id).delete(),
        this.db.messageHistory.where('leadId').equals(id).delete(),
      ]);
    });
  }

  /**
   * Calculates dashboard summary statistics.
   */
  async getLeadStats(): Promise<LeadStats> {
    const allLeads = await this.db.leads.toArray();
    const activeLeads = allLeads.filter((l) => l.deletedAt === null);

    const initialStatusCounts: Record<LeadStatus, number> = {
      NEW: 0,
      CONTACTED: 0,
      INTERESTED: 0,
      SAMPLE_REQUESTED: 0,
      FOLLOW_UP: 0,
      NEGOTIATION: 0,
      CUSTOMER: 0,
      NOT_INTERESTED: 0,
      WRONG_NUMBER: 0,
      DO_NOT_CONTACT: 0,
    };

    const statusCounts = activeLeads.reduce((acc, lead) => {
      acc[lead.status] = (acc[lead.status] || 0) + 1;
      return acc;
    }, initialStatusCounts);

    const todayStr = new Date().toISOString().slice(0, 10);

    const [pendingFollowUps, todayFollowUps, totalCalls] = await Promise.all([
      this.db.followUps
        .filter((f) => f.deletedAt === null && f.status === 'PENDING')
        .count(),
      this.db.followUps
        .filter(
          (f) =>
            f.deletedAt === null &&
            f.status === 'PENDING' &&
            f.scheduledAt.startsWith(todayStr)
        )
        .count(),
      this.db.callHistory
        .filter((c) => c.deletedAt === null)
        .count(),
    ]);

    return {
      totalLeads: allLeads.length,
      activeLeads: activeLeads.length,
      statusCounts,
      totalCallsLogged: totalCalls,
      pendingFollowUpsCount: pendingFollowUps,
      todayFollowUpsCount: todayFollowUps,
    };
  }
}
