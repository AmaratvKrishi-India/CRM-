import 'fake-indexeddb/auto';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as XLSX from 'xlsx';
import { ExcelParserService } from '../src/services/excelParser.ts';
import { SalesCRMDatabase } from '../src/db/database.ts';

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
    const db = new SalesCRMDatabase(`ExcelTest_${Date.now()}`);

    // Create in-memory workbook with XLSX
    const data = [
      { 'Gym Name': 'Olympia Fitness', 'Mobile': '9876543210', 'Address': 'Alambagh, Lucknow 226005', 'Category': 'Gym' },
      { 'Gym Name': 'Olympia Fitness Copy', 'Mobile': '9876543210', 'Address': 'Same phone in batch', 'Category': 'Gym' },
      { 'Gym Name': 'Alpha Gym', 'Mobile': '9123456789', 'Address': 'Gomti Nagar, Lucknow', 'Category': 'Gym' },
    ];

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const workbook = ExcelParserService.readWorkbook(buffer);
    const parseResult = await ExcelParserService.parseSheet(workbook, 'Leads', db);

    assert.strictEqual(parseResult.summary.total, 3);
    assert.strictEqual(parseResult.summary.valid, 2);
    assert.strictEqual(parseResult.summary.duplicates, 1);

    const dupRecord = parseResult.records.find((r) => r.sourceRow === 3);
    assert.strictEqual(dupRecord?.validationStatus, 'DUPLICATE');

    await db.close();
  });

  it('3. Imports records into real Dexie database with SKIP duplicate strategy', async () => {
    const db = new SalesCRMDatabase(`ExcelImportTest_${Date.now()}`);

    const data = [
      { 'Gym Name': 'Fitness Point 1', 'Mobile': '9991112221', 'Address': 'Chowk, Lucknow', 'Category': 'Gym' },
      { 'Gym Name': 'Fitness Point 2', 'Mobile': '9991112222', 'Address': 'Mahanagar, Lucknow', 'Category': 'Gym' },
    ];

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const workbook = ExcelParserService.readWorkbook(buffer);
    const parseResult = await ExcelParserService.parseSheet(workbook, 'Leads', db);

    const importResult = await ExcelParserService.importRecords({
      db,
      records: parseResult.records,
      sourceFile: 'test_leads.xlsx',
      allowOverwriteDuplicates: false,
    });

    assert.strictEqual(importResult.imported, 2);
    assert.strictEqual(importResult.totalProcessed, 2);

    // Verify stored in Dexie leads table
    const storedLeads = await db.leads.toArray();
    assert.strictEqual(storedLeads.length, 2);

    await db.close();
  });
});
