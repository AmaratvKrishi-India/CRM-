import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { SalesCRMDatabase } from '../src/db/database';
import { ExcelParserService } from '../src/services/excelParser';

describe('Excel Parser & Ingestion Pipeline', () => {
  let db: SalesCRMDatabase;

  beforeEach(async () => {
    const testDbName = `test_parser_${Math.random().toString(36).substring(7)}`;
    db = new SalesCRMDatabase(testDbName);
    await db.seedDefaults();
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('1. Column Detection & Auto-Mapping', () => {
    it('detects standard and alternative header formats', () => {
      const headers = ['title', 'phone', 'address', 'categories/0'];
      const mapping = ExcelParserService.detectColumnMapping(headers);

      expect(mapping.businessName).toBe('title');
      expect(mapping.phone).toBe('phone');
      expect(mapping.address).toBe('address');
      expect(mapping.category).toBe('categories/0');
    });

    it('detects gym-specific naming headers', () => {
      const headers = ['Gym Name', 'Mobile Number', 'Full Address', 'Business Category', 'Owner', 'Website'];
      const mapping = ExcelParserService.detectColumnMapping(headers);

      expect(mapping.businessName).toBe('Gym Name');
      expect(mapping.phone).toBe('Mobile Number');
      expect(mapping.address).toBe('Full Address');
      expect(mapping.category).toBe('Business Category');
      expect(mapping.contactPerson).toBe('Owner');
      expect(mapping.website).toBe('Website');
    });
  });

  describe('2. Multi-Sheet & Validation Pipeline', () => {
    it('parses worksheet and classifies VALID, DUPLICATE, and INVALID records', async () => {
      // Pre-seed one lead in DB
      await db.leads.add({
        id: 'existing-1',
        businessName: 'Existing Fitness Club',
        category: 'Gym',
        phone: '9876543210',
        phoneRaw: '+91 98765 43210',
        phoneE164: '+919876543210',
        phoneType: 'mobile',
        alternatePhone: null,
        contactPerson: null,
        address: 'Alambagh, Lucknow',
        locality: 'Alambagh',
        pincode: '226005',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        website: null,
        rating: null,
        reviewCount: null,
        source: 'Seed',
        sourceFile: null,
        sourceRow: null,
        status: 'NEW',
        customNotes: '',
        lastContactedAt: null,
        nextFollowUpAt: null,
        callCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isSynced: 1,
        syncedAt: null,
        deletedAt: null,
      });

      // Construct a mock workbook
      const mockData = [
        ['title', 'phone', 'address', 'categories/0'],
        ['Gold Gym', '+91 91111 22222', 'Hazratganj, Lucknow 226001', 'Gym'], // Valid
        ['Duplicate Lead', '+91 98765 43210', 'Alambagh, Lucknow 226005', 'Gym'], // Duplicate of DB
        ['Invalid Lead', '', 'Gomti Nagar, Lucknow', 'Gym'], // Missing phone
        ['No Name Gym', '+91 92222 33333', 'Chowk, Lucknow', 'Gym'], // Valid
      ];
      // Intentionally make No Name Gym have empty title
      mockData[4][0] = '';

      const ws = XLSX.utils.aoa_to_sheet(mockData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'LeadsSheet');

      const result = await ExcelParserService.parseSheet(wb, 'LeadsSheet', db);

      expect(result.summary.total).toBe(4);
      expect(result.summary.valid).toBe(1); // Gold Gym
      expect(result.summary.duplicates).toBe(1); // Duplicate Lead
      expect(result.summary.invalid).toBe(2); // Missing phone & Missing title
    });
  });

  describe('3. Batch Import Execution & Non-Destructive Update', () => {
    it('imports valid leads and updates summary stats', async () => {
      const mockData = [
        ['title', 'phone', 'address', 'categories/0'],
        ['Alpha Gym', '+91 98765 00001', 'LDA Colony, Lucknow 226012', 'Gym'],
        ['Beta Fitness', '+91 98765 00002', 'Indira Nagar, Lucknow 226016', 'Fitness center'],
      ];
      const ws = XLSX.utils.aoa_to_sheet(mockData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data');

      const parseResult = await ExcelParserService.parseSheet(wb, 'Data', db);
      const importSummary = await ExcelParserService.importRecords({
        db,
        records: parseResult.records,
        sourceFile: 'test.xlsx',
      });

      expect(importSummary.imported).toBe(2);
      expect(importSummary.skippedDuplicates).toBe(0);

      const allDbLeads = await db.leads.toArray();
      expect(allDbLeads.length).toBe(2);
      const alphaGym = allDbLeads.find((l) => l.businessName === 'Alpha Gym');
      expect(alphaGym).toBeDefined();
      expect(alphaGym?.locality).toBe('LDA Colony');
      expect(alphaGym?.pincode).toBe('226012');
    });
  });

  describe('4. Real Dataset File Parsing Verification', () => {
    const realFilePath = 'C:\\Users\\PC\\Desktop\\dataset_crawler-google-places_2026-08-19_12-56-50-235 (1).xlsx';

    it('successfully parses the full 141-lead Lucknow gym dataset', async () => {
      if (!fs.existsSync(realFilePath)) {
        console.warn('Real file not found at path, skipping real file test.');
        return;
      }

      const fileBuffer = fs.readFileSync(realFilePath);
      const wb = XLSX.read(fileBuffer, { type: 'buffer' });

      expect(wb.SheetNames).toContain('Data');

      const result = await ExcelParserService.parseSheet(wb, 'Data', db, undefined, 'Lucknow_Gyms.xlsx');

      expect(result.summary.total).toBe(141);
      expect(result.summary.valid).toBe(141);
      expect(result.summary.invalid).toBe(0);
      expect(result.summary.duplicates).toBe(0);

      // Execute import
      let lastPercent = 0;
      const importSummary = await ExcelParserService.importRecords({
        db,
        records: result.records,
        sourceFile: 'Lucknow_Gyms.xlsx',
        onProgress: (p) => {
          lastPercent = p.percent;
        },
      });

      expect(lastPercent).toBe(100);
      expect(importSummary.imported).toBe(141);

      const inDbCount = await db.leads.count();
      expect(inDbCount).toBe(141);

      // If we parse the same workbook AGAIN against the now populated DB, it should flag all 141 as DUPLICATES!
      const secondParse = await ExcelParserService.parseSheet(wb, 'Data', db, undefined, 'Lucknow_Gyms.xlsx');
      expect(secondParse.summary.duplicates).toBe(141);
      expect(secondParse.summary.valid).toBe(0);
    });
  });
});
