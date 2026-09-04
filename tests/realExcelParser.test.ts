import 'fake-indexeddb/auto';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import ExcelJS from 'exceljs';
import {
  ExcelParserService,
  IMPORT_LIMITS,
  SpreadsheetImportError,
  withTimeout,
} from '../src/services/excelParser.ts';
import { SalesCRMDatabase } from '../src/db/database.ts';

const createXlsxBuffer = async (rows: Array<Record<string, unknown>>, sheetName = 'Leads') => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  worksheet.addRow(headers);
  rows.forEach((row) => worksheet.addRow(headers.map((header) => row[header] ?? '')));
  return workbook.xlsx.writeBuffer();
};

const assertImportError = async (
  operation: Promise<unknown>,
  code: SpreadsheetImportError['code']
) => {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof SpreadsheetImportError);
    assert.strictEqual(error.code, code);
    return true;
  });
};

describe('Real Excel Parser & Lead Ingestion Tests (Stage 9)', () => {
  it('1. Auto-detects standard CRM column headers', () => {
    const headers = ['Gym Name', 'Mobile Number', 'Address', 'Category', 'Contact Person'];
    const mapping = ExcelParserService.detectColumnMapping(headers);

    assert.strictEqual(mapping.businessName, 'Gym Name');
    assert.strictEqual(mapping.phone, 'Mobile Number');
    assert.strictEqual(mapping.address, 'Address');
    assert.strictEqual(mapping.category, 'Category');
    assert.strictEqual(mapping.contactPerson, 'Contact Person');
  });

  it('2. Parses XLSX binary buffer and classifies valid vs in-batch duplicate records', async () => {
    const db = new SalesCRMDatabase(`ExcelTest_${Date.now()}`, {
      organizationId: 'org-01',
      userId: 'user-01',
      role: 'AGENT',
    });

    // Create in-memory workbook with XLSX
    const data = [
      { 'Gym Name': 'Olympia Fitness', 'Mobile': '9876543210', 'Address': 'Alambagh, Lucknow 226005', 'Category': 'Gym' },
      { 'Gym Name': 'Olympia Fitness Copy', 'Mobile': '9876543210', 'Address': 'Same phone in batch', 'Category': 'Gym' },
      { 'Gym Name': 'Alpha Gym', 'Mobile': '9123456789', 'Address': 'Gomti Nagar, Lucknow', 'Category': 'Gym' },
    ];

    const buffer = await createXlsxBuffer(data);

    const workbook = await ExcelParserService.readWorkbook(buffer, 'leads.xlsx');
    const parseResult = await ExcelParserService.parseSheet(workbook, 'Leads', db);

    assert.strictEqual(parseResult.summary.total, 3);
    assert.strictEqual(parseResult.summary.valid, 2);
    assert.strictEqual(parseResult.summary.duplicates, 1);

    const dupRecord = parseResult.records.find((r) => r.sourceRow === 3);
    assert.strictEqual(dupRecord?.validationStatus, 'DUPLICATE');

    await db.close();
  });

  it('3. Imports records into real Dexie database with SKIP duplicate strategy', async () => {
    const db = new SalesCRMDatabase(`ExcelImportTest_${Date.now()}`, {
      organizationId: 'org-01',
      userId: 'user-01',
      role: 'AGENT',
    });

    const data = [
      { 'Gym Name': 'Fitness Point 1', 'Mobile': '9991112221', 'Address': 'Chowk, Lucknow', 'Category': 'Gym' },
      { 'Gym Name': 'Fitness Point 2', 'Mobile': '9991112222', 'Address': 'Mahanagar, Lucknow', 'Category': 'Gym' },
    ];

    const buffer = await createXlsxBuffer(data);

    const workbook = await ExcelParserService.readWorkbook(buffer, 'leads.xlsx');
    const parseResult = await ExcelParserService.parseSheet(workbook, 'Leads', db);

    const importResult = await ExcelParserService.importRecords({
      db,
      records: parseResult.records,
      sourceFile: 'test_leads.xlsx',
      allowOverwriteDuplicates: false,
      userId: 'user-01',
    });

    assert.strictEqual(importResult.imported, 2);
    assert.strictEqual(importResult.totalProcessed, 2);

    // Verify stored in Dexie leads table
    const storedLeads = await db.leads.toArray();
    assert.strictEqual(storedLeads.length, 2);

    await db.close();
  });

  it('4. Parses CSV input and preserves quoted cells', async () => {
    const csv = new TextEncoder().encode(
      'Gym Name,Mobile,Address,Category\n"Alpha, Fitness",9876543210,"Gomti Nagar, Lucknow",Gym\n'
    );
    const workbook = await ExcelParserService.readWorkbook(csv, 'leads.csv');
    const db = new SalesCRMDatabase(`CsvImportTest_${Date.now()}`, {
      organizationId: 'org-01',
      userId: 'user-01',
      role: 'AGENT',
    });
    const result = await ExcelParserService.parseSheet(workbook, 'Data', db);
    assert.strictEqual(result.records[0]?.businessName, 'Alpha, Fitness');
    assert.strictEqual(result.summary.valid, 1);
    await db.close();
  });

  it('5. Safely handles empty, malformed, oversized, and unexpected files', async () => {
    const db = new SalesCRMDatabase(`ImportSafetyTest_${Date.now()}`, {
      organizationId: 'org-01',
      userId: 'user-01',
      role: 'AGENT',
    });
    const emptyWorkbook = ExcelParserService.createWorkbookFromRows([], 'Data');
    const emptyResult = await ExcelParserService.parseSheet(emptyWorkbook, 'Data', db);
    assert.deepStrictEqual(emptyResult.summary, { total: 0, valid: 0, duplicates: 0, invalid: 0 });
    await assertImportError(
      ExcelParserService.readWorkbook(new TextEncoder().encode('not a workbook'), 'malformed.xlsx'),
      'INVALID_FILE'
    );
    await assertImportError(
      ExcelParserService.readWorkbook(new Uint8Array(IMPORT_LIMITS.maxFileSizeBytes + 1), 'oversized.xlsx'),
      'FILE_TOO_LARGE'
    );
    await assertImportError(
      ExcelParserService.readWorkbook(new TextEncoder().encode('legacy'), 'legacy.xls'),
      'UNSUPPORTED_FILE_TYPE'
    );
    await db.close();
  });

  it('6. Rejects excessive rows and columns before import', async () => {
    const tooManyRows = Array.from({ length: IMPORT_LIMITS.maxRows + 1 }, (_, index) => ({
      'Gym Name': `Gym ${index}`,
      Mobile: `987654${String(index).padStart(4, '0')}`,
      Address: 'Lucknow',
      Category: 'Gym',
    }));
    await assert.rejects(
      Promise.resolve().then(() => ExcelParserService.createWorkbookFromRows(tooManyRows)),
      (error: unknown) => error instanceof SpreadsheetImportError && error.code === 'ROW_LIMIT_EXCEEDED'
    );

    const tooManyColumns = {
      'Gym Name': 'Gym',
      Mobile: '9876543210',
      Address: 'Lucknow',
      Category: 'Gym',
      ...Object.fromEntries(Array.from({ length: IMPORT_LIMITS.maxColumns }, (_, index) => [`Extra ${index}`, 'x'])),
    };
    await assert.rejects(
      Promise.resolve().then(() => ExcelParserService.createWorkbookFromRows([tooManyColumns])),
      (error: unknown) => error instanceof SpreadsheetImportError && error.code === 'COLUMN_LIMIT_EXCEEDED'
    );
  });

  it('7. Converts parser timeout into a safe failure', async () => {
    await assertImportError(
      withTimeout(new Promise<never>(() => undefined), 1),
      'PARSER_TIMEOUT'
    );
  });
});
