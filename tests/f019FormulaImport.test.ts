import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { ExcelParserService } from '../src/services/excelParser.ts';
import { SalesCRMDatabase } from '../src/db/database.ts';

test('F019 cached external formula values import while uncached required cells produce actionable issues', async () => {
  const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('Leads');
  sheet.addRow(['Gym Name', 'Phone', 'Address']);
  sheet.addRow([{ formula: "'[Book1.xlsx]Sheet1'!A1", result: 'Cached Gym' }, '9876543210', 'Lucknow']);
  sheet.addRow([{ formula: "'[Book1.xlsx]Sheet1'!A2" }, '9876543211', 'Lucknow']);
  const db = new SalesCRMDatabase(`F019_${crypto.randomUUID()}`, { organizationId: 'org', userId: 'user', role: 'ADMIN' });
  try {
    const parsed = await ExcelParserService.readWorkbook(await workbook.xlsx.writeBuffer(), 'formula.xlsx');
    const result = await ExcelParserService.parseSheet(parsed, 'Leads', db);
    assert.equal(result.summary.valid, 1); assert.equal(result.summary.invalid, 1);
    assert.equal(result.records[0].businessName, 'Cached Gym');
    assert.match(JSON.stringify(result.records[1]), /Missing business name/);
    assert.equal(await db.leads.count(), 0, 'preview does not import either row');
  } finally { db.close(); await db.delete(); }
});
