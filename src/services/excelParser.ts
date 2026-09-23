/**
 * Excel Parser & Lead Ingestion Pipeline
 * Supports .xlsx / .csv parsing, auto-column mapping, Indian phone number normalisation,
 * address & PIN extraction, duplicate detection, and non-destructive batch importing.
 */

import readXlsxFile from 'read-excel-file/universal';
import Papa from 'papaparse';
import type { SalesCRMDatabase } from '../db/database';
import type { Lead, PhoneType } from '../db/types';
import {
  normalizePhoneNumber,
  parseAddress,
  cleanBusinessName,
} from '../db/services/leadNormalizer';
import { SyncQueue } from './sync/syncQueue';
import { ImportAuditRepository } from '../db/repositories/importAuditRepository';

import { createUuid } from '../utils/id';
export interface ColumnMapping {
  businessName: string;
  phone: string;
  address: string;
  category: string;
  alternatePhone?: string;
  contactPerson?: string;
  website?: string;
}

export const IMPORT_LIMITS = Object.freeze({
  maxFileSizeBytes: 10 * 1024 * 1024,
  maxRows: 10_000,
  maxColumns: 50,
  maxSheets: 20,
  maxCells: 500_000,
  maxUncompressedWorkbookBytes: 50 * 1024 * 1024,
  parseTimeoutMs: 10_000,
});

export type SpreadsheetImportErrorCode =
  | 'UNSUPPORTED_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'WORKBOOK_TOO_COMPLEX'
  | 'ROW_LIMIT_EXCEEDED'
  | 'COLUMN_LIMIT_EXCEEDED'
  | 'INVALID_FILE'
  | 'PARSER_TIMEOUT'
  | 'PARSER_ERROR';

export class SpreadsheetImportError extends Error {
  constructor(
    public readonly code: SpreadsheetImportErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'SpreadsheetImportError';
  }
}

export interface SpreadsheetSheet {
  name: string;
  rows: unknown[][];
}

export interface SpreadsheetWorkbook {
  format: 'xlsx' | 'csv' | 'rows';
  sheets: SpreadsheetSheet[];
}

export type RecordValidationStatus = 'VALID' | 'DUPLICATE' | 'INVALID';

export interface ParsedLeadRecord {
  tempId: string;
  sourceRow: number;
  originalData: Record<string, unknown>;
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

const getArrayBuffer = (data: ArrayBuffer | Uint8Array): ArrayBuffer => {
  if (data instanceof ArrayBuffer) return data;
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
};

const readUint16 = (bytes: Uint8Array, offset: number): number =>
  bytes[offset] | (bytes[offset + 1] << 8);

const readUint32 = (bytes: Uint8Array, offset: number): number =>
  (bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)) >>> 0;

const validateXlsxContainer = (data: ArrayBuffer): void => {
  const bytes = new Uint8Array(data);
  if (bytes.length < 22 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new SpreadsheetImportError('INVALID_FILE', 'The selected XLSX file is not a valid ZIP container.');
  }

  const eocdStart = Math.max(0, bytes.length - 22 - 65_535);
  let eocdOffset = -1;
  for (let offset = bytes.length - 22; offset >= eocdStart; offset--) {
    if (readUint32(bytes, offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) {
    throw new SpreadsheetImportError('INVALID_FILE', 'The selected XLSX file has no valid ZIP directory.');
  }

  const entryCount = readUint16(bytes, eocdOffset + 10);
  const centralDirectorySize = readUint32(bytes, eocdOffset + 12);
  const centralDirectoryOffset = readUint32(bytes, eocdOffset + 16);
  if (
    entryCount === 0xffff ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff ||
    entryCount > 2_000 ||
    centralDirectoryOffset + centralDirectorySize > bytes.length
  ) {
    throw new SpreadsheetImportError(
      'WORKBOOK_TOO_COMPLEX',
      'The selected workbook exceeds the supported ZIP structure limits.'
    );
  }

  let offset = centralDirectoryOffset;
  let uncompressedBytes = 0;
  for (let index = 0; index < entryCount; index++) {
    if (offset + 46 > bytes.length || readUint32(bytes, offset) !== 0x02014b50) {
      throw new SpreadsheetImportError('INVALID_FILE', 'The selected XLSX file has a malformed ZIP directory.');
    }
    const compressedSize = readUint32(bytes, offset + 20);
    const uncompressedSize = readUint32(bytes, offset + 24);
    const fileNameLength = readUint16(bytes, offset + 28);
    const extraLength = readUint16(bytes, offset + 30);
    const commentLength = readUint16(bytes, offset + 32);
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      throw new SpreadsheetImportError(
        'WORKBOOK_TOO_COMPLEX',
        'ZIP64 workbooks are not supported by the safe import path.'
      );
    }
    uncompressedBytes += uncompressedSize;
    if (uncompressedBytes > IMPORT_LIMITS.maxUncompressedWorkbookBytes) {
      throw new SpreadsheetImportError(
        'WORKBOOK_TOO_COMPLEX',
        `The workbook expands beyond the ${IMPORT_LIMITS.maxUncompressedWorkbookBytes / 1024 / 1024} MB safety limit.`
      );
    }
    offset += 46 + fileNameLength + extraLength + commentLength;
    if (offset > centralDirectoryOffset + centralDirectorySize) {
      throw new SpreadsheetImportError('INVALID_FILE', 'The selected XLSX file has an invalid ZIP directory.');
    }
  }
};

export const withTimeout = async <T>(work: Promise<T>, timeoutMs: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new SpreadsheetImportError('PARSER_TIMEOUT', 'Spreadsheet parsing exceeded the time limit.')),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const toSafeCell = (value: unknown): unknown => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' && value.length > 10_000) {
    throw new SpreadsheetImportError('WORKBOOK_TOO_COMPLEX', 'A spreadsheet cell exceeds the supported text limit.');
  }
  return value;
};

const normalizeRows = (rows: unknown[][], sheetName: string): SpreadsheetSheet => {
  if (rows.length > IMPORT_LIMITS.maxRows + 1) {
    throw new SpreadsheetImportError(
      'ROW_LIMIT_EXCEEDED',
      `The sheet exceeds the ${IMPORT_LIMITS.maxRows.toLocaleString()} row limit.`
    );
  }
  const normalizedRows = rows.map((row) => {
    if (row.length > IMPORT_LIMITS.maxColumns) {
      throw new SpreadsheetImportError(
        'COLUMN_LIMIT_EXCEEDED',
        `The sheet exceeds the ${IMPORT_LIMITS.maxColumns} column limit.`
      );
    }
    return row.map(toSafeCell);
  });
  const columnCount = normalizedRows.reduce((max, row) => Math.max(max, row.length), 0);
  if (normalizedRows.length * columnCount > IMPORT_LIMITS.maxCells) {
    throw new SpreadsheetImportError('WORKBOOK_TOO_COMPLEX', 'The sheet exceeds the supported cell limit.');
  }
  return { name: sheetName, rows: normalizedRows };
};

export class ExcelParserService {
  /**
   * Reads a bounded XLSX or CSV workbook and returns a format-neutral representation.
   */
  static async readWorkbook(
    data: ArrayBuffer | Uint8Array,
    fileName = 'leads.xlsx',
    options: { timeoutMs?: number } = {}
  ): Promise<SpreadsheetWorkbook> {
    const lowerName = fileName.toLowerCase();
    const format = lowerName.endsWith('.csv') ? 'csv' : lowerName.endsWith('.xlsx') ? 'xlsx' : null;
    if (!format) {
      throw new SpreadsheetImportError(
        'UNSUPPORTED_FILE_TYPE',
        'Unsupported spreadsheet type. Upload an .xlsx or .csv file.'
      );
    }

    const arrayBuffer = getArrayBuffer(data);
    if (arrayBuffer.byteLength > IMPORT_LIMITS.maxFileSizeBytes) {
      throw new SpreadsheetImportError(
        'FILE_TOO_LARGE',
        `The file exceeds the ${IMPORT_LIMITS.maxFileSizeBytes / 1024 / 1024} MB upload limit.`
      );
    }

    if (format === 'csv') {
      const rows: unknown[][] = [];
      const deadline = Date.now() + (options.timeoutMs ?? IMPORT_LIMITS.parseTimeoutMs);
      let parseError: SpreadsheetImportError | null = null;
      const csvText = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer);

      Papa.parse<string[]>(csvText, {
        skipEmptyLines: 'greedy',
        worker: false,
        step: (result, parser) => {
          if (Date.now() > deadline) {
            parseError = new SpreadsheetImportError('PARSER_TIMEOUT', 'CSV parsing exceeded the time limit.');
            parser.abort();
            return;
          }
          if (result.data.length > IMPORT_LIMITS.maxColumns) {
            parseError = new SpreadsheetImportError(
              'COLUMN_LIMIT_EXCEEDED',
              `The sheet exceeds the ${IMPORT_LIMITS.maxColumns} column limit.`
            );
            parser.abort();
            return;
          }
          rows.push(result.data.map(toSafeCell));
          if (rows.length > IMPORT_LIMITS.maxRows + 1) {
            parseError = new SpreadsheetImportError(
              'ROW_LIMIT_EXCEEDED',
              `The sheet exceeds the ${IMPORT_LIMITS.maxRows.toLocaleString()} row limit.`
            );
            parser.abort();
          }
        },
        complete: (result) => {
          if (result.errors.length > 0 && !parseError) {
            parseError = new SpreadsheetImportError(
              'PARSER_ERROR',
              'The CSV file could not be parsed safely.'
            );
          }
        },
        error: (error: Error) => {
          parseError = new SpreadsheetImportError('PARSER_ERROR', 'The CSV file could not be parsed safely.', {
            cause: error,
          });
        },
      });

      if (parseError) throw parseError;
      return { format, sheets: [normalizeRows(rows, 'Data')] };
    }

    validateXlsxContainer(arrayBuffer);
    try {
      const sheets = await withTimeout(
        readXlsxFile(arrayBuffer),
        options.timeoutMs ?? IMPORT_LIMITS.parseTimeoutMs
      );
      if (sheets.length === 0) {
        throw new SpreadsheetImportError('INVALID_FILE', 'The workbook contains no sheets.');
      }
      if (sheets.length > IMPORT_LIMITS.maxSheets) {
        throw new SpreadsheetImportError(
          'WORKBOOK_TOO_COMPLEX',
          `The workbook exceeds the ${IMPORT_LIMITS.maxSheets} sheet limit.`
        );
      }
      return {
        format,
        sheets: sheets.map((sheet) => normalizeRows(sheet.data as unknown[][], sheet.sheet)),
      };
    } catch (error) {
      if (error instanceof SpreadsheetImportError) throw error;
      throw new SpreadsheetImportError('INVALID_FILE', 'The XLSX file could not be parsed safely.', {
        cause: error,
      });
    }
  }

  static createWorkbookFromRows(
    records: ReadonlyArray<Record<string, unknown>>,
    sheetName = 'Data'
  ): SpreadsheetWorkbook {
    const headers = Array.from(new Set(records.flatMap((record) => Object.keys(record))));
    return {
      format: 'rows',
      sheets: [
        normalizeRows(
          [headers, ...records.map((record) => headers.map((header) => record[header] ?? ''))],
          sheetName
        ),
      ],
    };
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

  private static parseLeadRow(
    row: Record<string, unknown>,
    mapping: ColumnMapping,
    existingPhoneMap: Map<string, Lead>,
    seenBatchPhones: Set<string>,
    index: number,
  ): ParsedLeadRecord {
    const asText = (value: unknown): string => value === null || value === undefined ? '' : String(value);
    const rawTitle = asText(row[mapping.businessName]);
    const rawPhoneValue = row[mapping.phone];
    const rawPhone = typeof rawPhoneValue === 'number' || typeof rawPhoneValue === 'string' ? rawPhoneValue : null;
    const rawAddress = asText(row[mapping.address]);
    const rawCategory = asText(row[mapping.category]);
    const rawAltPhoneValue = mapping.alternatePhone ? row[mapping.alternatePhone] : undefined;
    const rawAltPhone = typeof rawAltPhoneValue === 'number' || typeof rawAltPhoneValue === 'string' ? rawAltPhoneValue : null;
    const rawContact = mapping.contactPerson ? asText(row[mapping.contactPerson]) : '';
    const rawWeb = mapping.website ? asText(row[mapping.website]) : '';

    const businessName = cleanBusinessName(rawTitle);
    const normPhone = normalizePhoneNumber(rawPhone);
    const parsedAddr = parseAddress(rawAddress);
    const normAlt = rawAltPhone ? normalizePhoneNumber(rawAltPhone) : null;
    const issues: string[] = [];
    if (!rawTitle.trim()) issues.push('Missing business name');
    if (!rawPhone || !String(rawPhone).trim()) issues.push('Missing phone number');
    else if (!normPhone.isValid) issues.push(`Invalid phone format: "${String(rawPhone)}"`);
    if (normPhone.type === 'landline') issues.push('Lucknow Landline (0522) - Calling supported, WhatsApp unavailable');

    let validationStatus: RecordValidationStatus = 'VALID';
    let existingLeadContext: ParsedLeadRecord['existingLead'];
    const hasBlockingIssue = issues.some((issue) => issue.startsWith('Missing') || issue.startsWith('Invalid'));
    if (hasBlockingIssue) {
      validationStatus = 'INVALID';
    } else if (normPhone.clean) {
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
      } else if (seenBatchPhones.has(normPhone.clean)) {
        validationStatus = 'DUPLICATE';
        issues.push('Duplicate phone: appears multiple times in this Excel file');
      } else {
        seenBatchPhones.add(normPhone.clean);
      }
    }

    return {
      tempId: `tmp_${index}_${Math.random().toString(36).substring(7)}`,
      sourceRow: index + 2,
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
      contactPerson: rawContact ? rawContact.trim() : null,
      address: parsedAddr.fullAddress,
      locality: parsedAddr.locality,
      pincode: parsedAddr.pincode,
      city: parsedAddr.city,
      state: parsedAddr.state,
      category: rawCategory.trim() || 'Gym',
      website: rawWeb ? rawWeb.trim() : null,
      existingLead: existingLeadContext,
    };
  }

  /**
   * Parses and validates a specific worksheet in the workbook against existing DB records.
   */
  static async parseSheet(
    workbook: SpreadsheetWorkbook,
    sheetName: string,
    db: SalesCRMDatabase,
    customMapping?: Partial<ColumnMapping>,
    fileName: string = 'leads.xlsx'
  ): Promise<ParseResult> {
    const sheet = workbook.sheets.find((candidate) => candidate.name === sheetName);
    if (!sheet) throw new Error(`Sheet "${sheetName}" not found in workbook.`);

    const nonEmptyRows = sheet.rows.filter((row) => row.some((cell) => cell !== ''));
    const headerRow = nonEmptyRows[0] || [];
    const headers = headerRow.map((header, index) => String(header || `Column ${index + 1}`).trim());
    const rawRows = nonEmptyRows.slice(1).map((row) => {
      const record = Object.create(null) as Record<string, unknown>;
      headers.forEach((header, index) => { record[header] = row[index] ?? ''; });
      return record;
    });

    if (rawRows.length === 0) {
      return {
        fileName,
        sheetNames: workbook.sheets.map((candidate) => candidate.name),
        selectedSheet: sheetName,
        availableColumns: [],
        detectedMapping: { businessName: '', phone: '', address: '', category: '' },
        records: [],
        summary: { total: 0, valid: 0, duplicates: 0, invalid: 0 },
      };
    }

    const detectedMapping: ColumnMapping = { ...this.detectColumnMapping(headers), ...customMapping };
    const existingLeads = await db.leads.filter((lead) => lead.deletedAt === null && Boolean(lead.phone)).toArray();
    const existingPhoneMap = new Map(existingLeads.map((lead) => [lead.phone, lead]));
    const seenBatchPhones = new Set<string>();
    const records = rawRows.map((row, index) =>
      this.parseLeadRow(row, detectedMapping, existingPhoneMap, seenBatchPhones, index)
    );
    const valid = records.filter((record) => record.validationStatus === 'VALID').length;
    const duplicates = records.filter((record) => record.validationStatus === 'DUPLICATE').length;
    const invalid = records.length - valid - duplicates;

    return {
      fileName,
      sheetNames: workbook.sheets.map((candidate) => candidate.name),
      selectedSheet: sheetName,
      availableColumns: headers,
      detectedMapping,
      records,
      summary: { total: records.length, valid, duplicates, invalid },
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

    const scope = db.requireAccessScope();
    if (userId && userId !== scope.userId) {
      throw new Error('Spreadsheet imports must run as the active signed-in user.');
    }
    const effectiveUserId = scope.userId;

    const startTime = Date.now();
    let imported = 0;
    let updated = 0;
    let skippedDuplicates = 0;
    let skippedInvalid = 0;


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
          id: createUuid(),
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
          createdBy: effectiveUserId,
          updatedBy: effectiveUserId,
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

    // Data writes + outbox enqueues + audit are atomic: either all persist or none.
    await db.transaction('rw', [db.leads, db.outbox, db.importAudits], async () => {
      if (newLeadsToInsert.length > 0) {
        await db.leads.bulkAdd(newLeadsToInsert);
      }
      for (const update of updatesToPerform) {
        await db.leads.update(update.id, update.changes);
      }

      const syncQueue = new SyncQueue(db);
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
    });

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
