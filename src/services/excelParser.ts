/**
 * Excel Parser & Lead Ingestion Pipeline
 * Supports .xlsx / .xls parsing, auto-column mapping, Indian phone number normalisation,
 * address & PIN extraction, duplicate detection, and non-destructive batch importing.
 */

import * as XLSX from 'xlsx';
import { SalesCRMDatabase } from '../db/database';
import { Lead, PhoneType } from '../db/types';
import {
  normalizePhoneNumber,
  parseAddress,
  cleanBusinessName,
} from '../db/services/leadNormalizer';
import { SyncQueue } from './sync/syncQueue';
import { ImportAuditRepository } from '../db/repositories/importAuditRepository';

export interface ColumnMapping {
  businessName: string;
  phone: string;
  address: string;
  category: string;
  alternatePhone?: string;
  contactPerson?: string;
  website?: string;
}

export type RecordValidationStatus = 'VALID' | 'DUPLICATE' | 'INVALID';

export interface ParsedLeadRecord {
  tempId: string;
  sourceRow: number;
  originalData: Record<string, any>;
  validationStatus: RecordValidationStatus;
  validationIssues: string[];

  // Cleaned / Normalized data
  businessName: string;
  phoneRaw: string;
  phoneClean: string;
  phoneE164: string;
  phoneType: PhoneType;
  canWhatsApp: boolean;
  alternatePhone: string | null;
  contactPerson: string | null;
  address: string;
  locality: string;
  pincode: string;
  city: string;
  state: string;
  category: string;
  website: string | null;

  // Duplicate context if applicable
  existingLead?: {
    id: string;
    businessName: string;
    status: string;
    callCount: number;
    lastContactedAt: string | null;
  };
}

export interface ParseResult {
  fileName: string;
  sheetNames: string[];
  selectedSheet: string;
  availableColumns: string[];
  detectedMapping: ColumnMapping;
  records: ParsedLeadRecord[];
  summary: {
    total: number;
    valid: number;
    duplicates: number;
    invalid: number;
  };
}

export interface ImportExecutionSummary {
  totalProcessed: number;
  imported: number;
  updated: number;
  skippedDuplicates: number;
  skippedInvalid: number;
  durationMs: number;
}

export class ExcelParserService {
  /**
   * Reads an Excel workbook from an ArrayBuffer or File and returns basic metadata.
   */
  static readWorkbook(data: ArrayBuffer | Uint8Array): XLSX.WorkBook {
    return XLSX.read(data, { type: 'array' });
  }

  /**
   * Detects the most appropriate column mapping from the sheet header row.
   */
  static detectColumnMapping(headers: string[]): ColumnMapping {
    const mapping: ColumnMapping = {
      businessName: '',
      phone: '',
      address: '',
      category: '',
      alternatePhone: '',
      contactPerson: '',
      website: '',
    };

    const findMatch = (patterns: RegExp[]): string => {
      for (const pattern of patterns) {
        const found = headers.find((h) => pattern.test(h.trim()));
        if (found) return found;
      }
      return '';
    };

    mapping.businessName = findMatch([
      /^title$/i,
      /^name$/i,
      /business\s*name/i,
      /gym\s*name/i,
      /centre\s*name/i,
      /^gym$/i,
      /^business$/i,
      /^centre$/i,
      /^center$/i,
      /gym/i,
      /company/i,
    ]) || headers[0] || '';

    mapping.phone = findMatch([
      /^phone$/i,
      /^mobile$/i,
      /^contact$/i,
      /^tel$/i,
      /phone\s*number/i,
      /mobile\s*number/i,
      /contact\s*number/i,
    ]) || headers[1] || '';

    mapping.address = findMatch([
      /^address$/i,
      /^location$/i,
      /^full\s*address$/i,
      /street/i,
      /address/i,
      /addr/i,
    ]) || headers[2] || '';

    mapping.category = findMatch([
      /^categories\/0$/i,
      /^category$/i,
      /business\s*category/i,
      /^type$/i,
      /categories/i,
      /category/i,
    ]) || headers[3] || '';

    mapping.alternatePhone = findMatch([
      /alt.*phone/i,
      /phone\s*2/i,
      /secondary\s*phone/i,
      /alt.*mobile/i,
    ]);

    mapping.contactPerson = findMatch([
      /contact\s*person/i,
      /^owner$/i,
      /^manager$/i,
      /^trainer$/i,
      /spoc/i,
      /proprietor/i,
    ]);

    mapping.website = findMatch([
      /^website$/i,
      /^url$/i,
      /^web$/i,
      /^link$/i,
    ]);

    return mapping;
  }

  /**
   * Parses and validates a specific worksheet in the workbook against existing DB records.
   */
  static async parseSheet(
    workbook: XLSX.WorkBook,
    sheetName: string,
    db: SalesCRMDatabase,
    customMapping?: Partial<ColumnMapping>,
    fileName: string = 'leads.xlsx'
  ): Promise<ParseResult> {
    const ws = workbook.Sheets[sheetName];
    if (!ws) {
      throw new Error(`Sheet "${sheetName}" not found in workbook.`);
    }

    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, {
      defval: '',
      blankrows: false,
    });

    if (rawRows.length === 0) {
      return {
        fileName,
        sheetNames: workbook.SheetNames,
        selectedSheet: sheetName,
        availableColumns: [],
        detectedMapping: { businessName: '', phone: '', address: '', category: '' },
        records: [],
        summary: { total: 0, valid: 0, duplicates: 0, invalid: 0 },
      };
    }

    const headers = Object.keys(rawRows[0]);
    const detectedMapping = {
      ...this.detectColumnMapping(headers),
      ...customMapping,
    };

    // Pre-fetch all active phone numbers from Dexie to perform high-speed deduplication
    const existingLeads = await db.leads
      .filter((l) => l.deletedAt === null && Boolean(l.phone))
      .toArray();

    const existingPhoneMap = new Map<string, Lead>();
    existingLeads.forEach((l) => existingPhoneMap.set(l.phone, l));

    const seenBatchPhones = new Set<string>();
    const parsedRecords: ParsedLeadRecord[] = [];

    let validCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const sourceRow = i + 2; // +1 for 0-index, +1 for header
      const issues: string[] = [];

      const rawTitle = row[detectedMapping.businessName];
      const rawPhone = row[detectedMapping.phone];
      const rawAddress = row[detectedMapping.address];
      const rawCategory = row[detectedMapping.category];
      const rawAltPhone = detectedMapping.alternatePhone ? row[detectedMapping.alternatePhone] : undefined;
      const rawContact = detectedMapping.contactPerson ? row[detectedMapping.contactPerson] : undefined;
      const rawWeb = detectedMapping.website ? row[detectedMapping.website] : undefined;

      const businessName = cleanBusinessName(rawTitle);
      const normPhone = normalizePhoneNumber(rawPhone);
      const parsedAddr = parseAddress(rawAddress);
      const normAlt = rawAltPhone ? normalizePhoneNumber(rawAltPhone) : null;

      if (!rawTitle || String(rawTitle).trim() === '') {
        issues.push('Missing business name');
      }

      if (!rawPhone || String(rawPhone).trim() === '') {
        issues.push('Missing phone number');
      } else if (!normPhone.isValid) {
        issues.push(`Invalid phone format: "${rawPhone}"`);
      }

      if (normPhone.type === 'landline') {
        issues.push('Lucknow Landline (0522) - Calling supported, WhatsApp unavailable');
      }

      let validationStatus: RecordValidationStatus = 'VALID';
      let existingLeadContext: ParsedLeadRecord['existingLead'] = undefined;

      if (issues.some((iss) => iss.startsWith('Missing') || iss.startsWith('Invalid'))) {
        validationStatus = 'INVALID';
        invalidCount++;
      } else if (normPhone.clean) {
        // Check for duplicates in DB or current batch
        const existingInDb = existingPhoneMap.get(normPhone.clean);
        if (existingInDb) {
          validationStatus = 'DUPLICATE';
          issues.push(`Duplicate phone: matches existing lead "${existingInDb.businessName}"`);
          existingLeadContext = {
            id: existingInDb.id,
            businessName: existingInDb.businessName,
            status: existingInDb.status,
            callCount: existingInDb.callCount,
            lastContactedAt: existingInDb.lastContactedAt,
          };
          duplicateCount++;
        } else if (seenBatchPhones.has(normPhone.clean)) {
          validationStatus = 'DUPLICATE';
          issues.push('Duplicate phone: appears multiple times in this Excel file');
          duplicateCount++;
        } else {
          seenBatchPhones.add(normPhone.clean);
          validCount++;
        }
      }

      parsedRecords.push({
        tempId: `tmp_${i}_${Math.random().toString(36).substring(7)}`,
        sourceRow,
        originalData: row,
        validationStatus,
        validationIssues: issues,
        businessName,
        phoneRaw: normPhone.raw || String(rawPhone || ''),
        phoneClean: normPhone.clean,
        phoneE164: normPhone.e164,
        phoneType: normPhone.type,
        canWhatsApp: normPhone.canWhatsApp,
        alternatePhone: normAlt?.clean || null,
        contactPerson: rawContact ? String(rawContact).trim() : null,
        address: parsedAddr.fullAddress,
        locality: parsedAddr.locality,
        pincode: parsedAddr.pincode,
        city: parsedAddr.city,
        state: parsedAddr.state,
        category: (rawCategory ? String(rawCategory).trim() : 'Gym') || 'Gym',
        website: rawWeb ? String(rawWeb).trim() : null,
        existingLead: existingLeadContext,
      });
    }

    return {
      fileName,
      sheetNames: workbook.SheetNames,
      selectedSheet: sheetName,
      availableColumns: headers,
      detectedMapping,
      records: parsedRecords,
      summary: {
        total: rawRows.length,
        valid: validCount,
        duplicates: duplicateCount,
        invalid: invalidCount,
      },
    };
  }

  /**
   * Commits validated lead records to the Dexie database with batching and progress updates.
   * Never overwrites existing history logs (call history, remarks, follow-ups, message logs).
   */
  static async importRecords(params: {
    db: SalesCRMDatabase;
    records: ParsedLeadRecord[];
    sourceFile: string;
    allowOverwriteDuplicates?: boolean;
    userId?: string | null;
    onProgress?: (progress: { current: number; total: number; percent: number }) => void;
  }): Promise<ImportExecutionSummary> {
    const {
      db,
      records,
      sourceFile,
      allowOverwriteDuplicates = false,
      userId = null,
      onProgress,
    } = params;

    const startTime = Date.now();
    let imported = 0;
    let updated = 0;
    let skippedDuplicates = 0;
    let skippedInvalid = 0;

    const generateUUID = (): string => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };

    const newLeadsToInsert: Lead[] = [];
    const updatesToPerform: Array<{ id: string; changes: Partial<Lead> }> = [];

    const now = new Date().toISOString();

    for (let i = 0; i < records.length; i++) {
      const rec = records[i];

      if (rec.validationStatus === 'INVALID') {
        skippedInvalid++;
      } else if (rec.validationStatus === 'DUPLICATE') {
        if (allowOverwriteDuplicates && rec.existingLead) {
          // Update existing lead contact info while strictly preserving history & status
          updatesToPerform.push({
            id: rec.existingLead.id,
            changes: {
              businessName: rec.businessName,
              address: rec.address,
              locality: rec.locality,
              pincode: rec.pincode,
              category: rec.category,
              website: rec.website,
              sourceFile,
              updatedAt: now,
              isSynced: 0,
            },
          });
          updated++;
        } else {
          skippedDuplicates++;
        }
      } else if (rec.validationStatus === 'VALID') {
        newLeadsToInsert.push({
          id: generateUUID(),
          businessName: rec.businessName,
          category: rec.category,
          phone: rec.phoneClean,
          phoneRaw: rec.phoneRaw,
          phoneE164: rec.phoneE164,
          phoneType: rec.phoneType,
          alternatePhone: rec.alternatePhone,
          contactPerson: rec.contactPerson,
          address: rec.address,
          locality: rec.locality,
          pincode: rec.pincode,
          city: rec.city,
          state: rec.state,
          website: rec.website,
          rating: null,
          reviewCount: null,
          source: `Excel Import: ${sourceFile}`,
          sourceFile,
          sourceRow: rec.sourceRow,
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
          createdBy: userId || null,
          updatedBy: userId || null,
        });
        imported++;
      }

      if (onProgress && (i % 20 === 0 || i === records.length - 1)) {
        onProgress({
          current: i + 1,
          total: records.length,
          percent: Math.round(((i + 1) / records.length) * 100),
        });
      }
    }

    // Perform database operations in a single transaction
    await db.transaction('rw', db.leads, async () => {
      if (newLeadsToInsert.length > 0) {
        await db.leads.bulkAdd(newLeadsToInsert);
      }
      for (const update of updatesToPerform) {
        await db.leads.update(update.id, update.changes);
      }
    });

    // Enqueue outbox items so imported/updated leads actually sync to the cloud,
    // and record an import audit row (which enqueues its own outbox item).
    try {
      const syncQueue = new SyncQueue(db);
      const effectiveUserId = userId || 'local-user';

      for (const lead of newLeadsToInsert) {
        await syncQueue.enqueue({
          entityType: 'leads',
          entityId: lead.id,
          operation: 'CREATE',
          payload: lead,
          userId: effectiveUserId,
        });
      }

      for (const update of updatesToPerform) {
        const updatedLead = await db.leads.get(update.id);
        if (updatedLead) {
          await syncQueue.enqueue({
            entityType: 'leads',
            entityId: updatedLead.id,
            operation: 'UPDATE',
            payload: updatedLead,
            userId: effectiveUserId,
          });
        }
      }

      const auditRepo = new ImportAuditRepository(db, syncQueue);
      await auditRepo.createAudit({
        uploadedBy: effectiveUserId,
        filename: sourceFile,
        source: `Excel Import: ${sourceFile}`,
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        totalRows: records.length,
        imported,
        updated,
        duplicates: skippedDuplicates,
        invalid: skippedInvalid,
      });
    } catch (err) {
      console.warn('Excel import: outbox enqueue / audit logging failed:', err);
    }

    const durationMs = Date.now() - startTime;

    return {
      totalProcessed: records.length,
      imported,
      updated,
      skippedDuplicates,
      skippedInvalid,
      durationMs,
    };
  }
}
