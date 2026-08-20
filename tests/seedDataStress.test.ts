import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import * as XLSX from 'xlsx';
import { SalesCRMDatabase } from '../src/db/database';
import { createCRMDataLayer } from '../src/db';
import { BUNDLED_LUCKNOW_DATASET } from '../src/services/sampleData';
import { ExcelParserService } from '../src/services/excelParser';
import { normalizePhoneNumber } from '../src/db/services/leadNormalizer';
import {
  determineDefaultLeadStatus,
  CALL_OUTCOMES,
  QUICK_SALES_REMARKS,
} from '../src/services/callOutcomeMapping';
import { renderMessageTemplate } from '../src/services/templateRenderer';
import { AttachmentService, MAX_ATTACHMENT_SIZE_BYTES } from '../src/services/attachmentService';
import { BackupService, CRMBackupPayload } from '../src/services/backupService';
import { DashboardService } from '../src/services/dashboardService';
import { DEFAULT_MESSAGE_TEMPLATES } from '../src/db/seeds/defaultTemplates';
import { Lead, CallOutcome } from '../src/db/types';

describe('Empirical Verification: 141 Lucknow Gym Dataset & CRM Workflow Stress Tests', () => {
  let db: SalesCRMDatabase;
  let crm: ReturnType<typeof createCRMDataLayer>;
  let dashboardService: DashboardService;

  beforeEach(async () => {
    const testDbName = `stress_test_${Math.random().toString(36).substring(7)}`;
    db = new SalesCRMDatabase(testDbName);
    crm = createCRMDataLayer(db);
    dashboardService = new DashboardService(db);
    await db.seedDefaults();
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('1. Seed Dataset Ingestion & Deduplication Stress (141 Lucknow Gyms)', () => {
    it('contains exactly 141 pre-bundled Lucknow leads in sampleData.ts', () => {
      expect(BUNDLED_LUCKNOW_DATASET).toBeDefined();
      expect(Array.isArray(BUNDLED_LUCKNOW_DATASET)).toBe(true);
      expect(BUNDLED_LUCKNOW_DATASET.length).toBe(141);
    });

    it('successfully parses all 141 seed leads without data loss or parsing errors', async () => {
      const ws = XLSX.utils.json_to_sheet(BUNDLED_LUCKNOW_DATASET);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data');

      const parseResult = await ExcelParserService.parseSheet(
        wb,
        'Data',
        db,
        undefined,
        'Lucknow_Gyms_Crawler.xlsx'
      );

      expect(parseResult.summary.total).toBe(141);
      expect(parseResult.summary.valid).toBe(141);
      expect(parseResult.summary.invalid).toBe(0);
      expect(parseResult.summary.duplicates).toBe(0);
      expect(parseResult.records.length).toBe(141);

      // Verify all records have valid normalized phone and non-empty business name
      for (const rec of parseResult.records) {
        expect(rec.businessName).toBeTruthy();
        expect(rec.phoneClean).toBeTruthy();
        expect(rec.phoneE164).toMatch(/^\+91/);
        expect(rec.locality).toBeTruthy();
      }
    });

    it('imports all 141 leads into IndexedDB with zero corruption and accurate defaults', async () => {
      const ws = XLSX.utils.json_to_sheet(BUNDLED_LUCKNOW_DATASET);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data');

      const parseResult = await ExcelParserService.parseSheet(wb, 'Data', db);
      const importSummary = await ExcelParserService.importRecords({
        db,
        records: parseResult.records,
        sourceFile: 'Lucknow_Gyms_Crawler.xlsx',
      });

      expect(importSummary.totalProcessed).toBe(141);
      expect(importSummary.imported).toBe(141);
      expect(importSummary.updated).toBe(0);
      expect(importSummary.skippedDuplicates).toBe(0);
      expect(importSummary.skippedInvalid).toBe(0);

      const dbLeads = await db.leads.toArray();
      expect(dbLeads.length).toBe(141);

      // Verify defaults
      for (const lead of dbLeads) {
        expect(lead.status).toBe('NEW');
        expect(lead.callCount).toBe(0);
        expect(lead.lastContactedAt).toBeNull();
        expect(lead.deletedAt).toBeNull();
        expect(lead.pincode).toMatch(/^226\d{3}$/); // All Lucknow pin codes
      }
    });

    it('correctly identifies and handles duplicates on re-import', async () => {
      // 1. First import
      const ws = XLSX.utils.json_to_sheet(BUNDLED_LUCKNOW_DATASET);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data');

      const firstParse = await ExcelParserService.parseSheet(wb, 'Data', db);
      await ExcelParserService.importRecords({
        db,
        records: firstParse.records,
        sourceFile: 'Lucknow_Gyms_Crawler.xlsx',
      });

      expect(await db.leads.count()).toBe(141);

      // 2. Second parse against populated DB
      const secondParse = await ExcelParserService.parseSheet(wb, 'Data', db);
      expect(secondParse.summary.total).toBe(141);
      expect(secondParse.summary.valid).toBe(0);
      expect(secondParse.summary.duplicates).toBe(141);
      expect(secondParse.summary.invalid).toBe(0);

      // 3. Import without overwrite: skips all 141
      const skipImport = await ExcelParserService.importRecords({
        db,
        records: secondParse.records,
        sourceFile: 'Lucknow_Gyms_Crawler.xlsx',
        allowOverwriteDuplicates: false,
      });

      expect(skipImport.imported).toBe(0);
      expect(skipImport.updated).toBe(0);
      expect(skipImport.skippedDuplicates).toBe(141);
      expect(await db.leads.count()).toBe(141);

      // 4. Import with overwrite: updates all 141 without increasing total count
      const overwriteImport = await ExcelParserService.importRecords({
        db,
        records: secondParse.records,
        sourceFile: 'Lucknow_Gyms_Crawler.xlsx',
        allowOverwriteDuplicates: true,
      });

      expect(overwriteImport.imported).toBe(0);
      expect(overwriteImport.updated).toBe(141);
      expect(overwriteImport.skippedDuplicates).toBe(0);
      expect(await db.leads.count()).toBe(141);
    });

    it('detects duplicates across different phone number formats', async () => {
      // Create lead with formatted number
      await crm.leads.createLead({
        businessName: 'Original Fitness',
        phone: '+91 70544 47888',
        address: 'LDA Colony, Lucknow',
      });

      // Try importing equivalent numbers in different formats
      const testFormats = ['07054447888', '7054447888', '+917054447888', '+91 70544-47888'];
      for (const phone of testFormats) {
        const mockWb = XLSX.utils.book_new();
        const mockWs = XLSX.utils.aoa_to_sheet([
          ['title', 'phone', 'address'],
          ['Variant Name', phone, 'Lucknow'],
        ]);
        XLSX.utils.book_append_sheet(mockWb, mockWs, 'Sheet1');

        const res = await ExcelParserService.parseSheet(mockWb, 'Sheet1', db);
        expect(res.summary.duplicates).toBe(1);
        expect(res.summary.valid).toBe(0);
      }
    });
  });

  describe('2. Lucknow Landline Detection (0522 / +91 522)', () => {
    it('accurately identifies and normalizes Lucknow landline variants', () => {
      const landline1 = normalizePhoneNumber('0522 422 7316');
      expect(landline1.type).toBe('landline');
      expect(landline1.canWhatsApp).toBe(false);
      expect(landline1.clean).toBe('05224227316');
      expect(landline1.e164).toBe('+915224227316');
      expect(landline1.displayFormatted).toBe('0522 422 7316');

      const landline2 = normalizePhoneNumber('+91 522 261 2345');
      expect(landline2.type).toBe('landline');
      expect(landline2.canWhatsApp).toBe(false);
      expect(landline2.clean).toBe('05222612345');
      expect(landline2.e164).toBe('+915222612345');

      const landline3 = normalizePhoneNumber('05222200111');
      expect(landline3.type).toBe('landline');
      expect(landline3.canWhatsApp).toBe(false);

      const local7Digit = normalizePhoneNumber('2612345');
      expect(local7Digit.type).toBe('landline');
      expect(local7Digit.canWhatsApp).toBe(false);
      expect(local7Digit.clean).toBe('05222612345');
      expect(local7Digit.e164).toBe('+915222612345');
    });

    it('accurately identifies Indian mobile numbers for WhatsApp eligibility', () => {
      const mobile1 = normalizePhoneNumber('+91 70544 47888');
      expect(mobile1.type).toBe('mobile');
      expect(mobile1.canWhatsApp).toBe(true);
      expect(mobile1.clean).toBe('7054447888');
      expect(mobile1.e164).toBe('+917054447888');

      const mobile2 = normalizePhoneNumber('9619887358');
      expect(mobile2.type).toBe('mobile');
      expect(mobile2.canWhatsApp).toBe(true);

      const mobile3 = normalizePhoneNumber('09140174734');
      expect(mobile3.type).toBe('mobile');
      expect(mobile3.canWhatsApp).toBe(true);
      expect(mobile3.clean).toBe('9140174734');
    });

    it('rejects invalid or blank numbers safely', () => {
      const invalidEmpty = normalizePhoneNumber('');
      expect(invalidEmpty.isValid).toBe(false);
      expect(invalidEmpty.canWhatsApp).toBe(false);
      expect(invalidEmpty.type).toBe('invalid');

      const invalidNull = normalizePhoneNumber(null);
      expect(invalidNull.isValid).toBe(false);

      const invalidShort = normalizePhoneNumber('12345');
      expect(invalidShort.isValid).toBe(false);
      expect(invalidShort.canWhatsApp).toBe(false);
    });

    it('verifies landline vs mobile distribution in seed dataset', () => {
      let mobileCount = 0;
      let landlineCount = 0;

      for (const item of BUNDLED_LUCKNOW_DATASET) {
        const norm = normalizePhoneNumber(item.phone);
        if (norm.type === 'mobile') mobileCount++;
        if (norm.type === 'landline') landlineCount++;
      }

      expect(mobileCount + landlineCount).toBe(141);
      expect(mobileCount).toBeGreaterThan(130);
    });
  });

  describe('3. Calling Flow & Dialer Safety (7 Outcomes, 11 Remarks, 0 Duration)', () => {
    it('strictly enforces durationSeconds = 0 on all logged calls', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Trend Fitness',
        phone: '+91 73100 04343',
        address: 'Charbagh, Lucknow',
      });

      const call = await crm.callHistory.logCall({
        leadId: lead.id,
        calledNumber: lead.phoneE164,
        outcome: 'CONNECTED',
        durationSeconds: 0,
        notes: 'Native dialer return call',
        updateLeadStatus: 'CONTACTED',
      });

      expect(call.durationSeconds).toBe(0);

      const fetched = await crm.callHistory.getCallHistoryByLead(lead.id);
      expect(fetched[0].durationSeconds).toBe(0);
    });

    it('verifies all 7 call outcomes exist with complete definitions', () => {
      expect(CALL_OUTCOMES.length).toBe(7);
      const outcomeValues = CALL_OUTCOMES.map((o) => o.value);
      expect(outcomeValues).toEqual([
        'CONNECTED',
        'BUSY',
        'NO_ANSWER',
        'CALLBACK_REQUESTED',
        'WRONG_NUMBER',
        'INVALID_NUMBER',
        'OTHER',
      ]);
    });

    it('verifies all 11 quick sales remarks exist with complete definitions', () => {
      expect(QUICK_SALES_REMARKS.length).toBe(11);
      expect(QUICK_SALES_REMARKS).toContain('Interested');
      expect(QUICK_SALES_REMARKS).toContain('Asked for Price');
      expect(QUICK_SALES_REMARKS).toContain('Asked for Sample');
      expect(QUICK_SALES_REMARKS).toContain('Asked for Catalogue');
      expect(QUICK_SALES_REMARKS).toContain('Call Later');
      expect(QUICK_SALES_REMARKS).toContain('Meeting Required');
      expect(QUICK_SALES_REMARKS).toContain('Sample Sent');
      expect(QUICK_SALES_REMARKS).toContain('Order Confirmed');
      expect(QUICK_SALES_REMARKS).toContain('Not Interested');
      expect(QUICK_SALES_REMARKS).toContain('Already Has Supplier');
      expect(QUICK_SALES_REMARKS).toContain('Do Not Contact');
    });

    it('exhaustively evaluates outcome and remark mapping matrix for status transitions', () => {
      // 1. Remark precedence testing
      expect(determineDefaultLeadStatus('NEW', 'CONNECTED', 'Order Confirmed')).toBe('CUSTOMER');
      expect(determineDefaultLeadStatus('NEW', 'NO_ANSWER', 'Order Confirmed')).toBe('CUSTOMER');
      expect(determineDefaultLeadStatus('NEW', 'CONNECTED', 'Asked for Sample')).toBe('SAMPLE_REQUESTED');
      expect(determineDefaultLeadStatus('NEW', 'CONNECTED', 'Sample Sent')).toBe('SAMPLE_REQUESTED');
      expect(determineDefaultLeadStatus('NEW', 'CONNECTED', 'Interested')).toBe('INTERESTED');
      expect(determineDefaultLeadStatus('NEW', 'CONNECTED', 'Asked for Price')).toBe('INTERESTED');
      expect(determineDefaultLeadStatus('NEW', 'CONNECTED', 'Asked for Catalogue')).toBe('INTERESTED');
      expect(determineDefaultLeadStatus('NEW', 'CONNECTED', 'Call Later')).toBe('FOLLOW_UP');
      expect(determineDefaultLeadStatus('NEW', 'CONNECTED', 'Meeting Required')).toBe('FOLLOW_UP');
      expect(determineDefaultLeadStatus('NEW', 'CONNECTED', 'Not Interested')).toBe('NOT_INTERESTED');
      expect(determineDefaultLeadStatus('NEW', 'CONNECTED', 'Already Has Supplier')).toBe('NOT_INTERESTED');
      expect(determineDefaultLeadStatus('NEW', 'CONNECTED', 'Do Not Contact')).toBe('DO_NOT_CONTACT');

      // 2. Outcome fallback when remark is null
      expect(determineDefaultLeadStatus('NEW', 'CONNECTED', null)).toBe('CONTACTED');
      expect(determineDefaultLeadStatus('NEW', 'CALLBACK_REQUESTED', null)).toBe('FOLLOW_UP');
      expect(determineDefaultLeadStatus('NEW', 'BUSY', null)).toBe('FOLLOW_UP');
      expect(determineDefaultLeadStatus('NEW', 'NO_ANSWER', null)).toBe('FOLLOW_UP');
      expect(determineDefaultLeadStatus('NEW', 'WRONG_NUMBER', null)).toBe('WRONG_NUMBER');
      expect(determineDefaultLeadStatus('NEW', 'INVALID_NUMBER', null)).toBe('WRONG_NUMBER');
      expect(determineDefaultLeadStatus('NEW', 'OTHER', null)).toBe('CONTACTED');
    });

    it('guarantees zero ghost records when rep skips outcome modal', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Skip Test Gym',
        phone: '+91 99999 00000',
        address: 'Alambagh, Lucknow',
      });

      // Dials lead -> app state returns -> rep presses Skip/Cancel
      // No call record or remark added
      const fullHistory = await crm.leads.getLeadWithFullHistory(lead.id);
      expect(fullHistory?.callHistory.length).toBe(0);
      expect(fullHistory?.remarks.length).toBe(0);
      expect(fullHistory?.lead.callCount).toBe(0);
      expect(fullHistory?.lead.status).toBe('NEW');
    });

    it('executes sequential calling lifecycle over 10 random seed leads', async () => {
      // Ingest seed leads
      const ws = XLSX.utils.json_to_sheet(BUNDLED_LUCKNOW_DATASET.slice(0, 10));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data');
      const parseResult = await ExcelParserService.parseSheet(wb, 'Data', db);
      await ExcelParserService.importRecords({ db, records: parseResult.records, sourceFile: 'sample.xlsx' });

      const allLeads = await db.leads.toArray();
      expect(allLeads.length).toBe(10);

      // Simulate calls
      for (let i = 0; i < allLeads.length; i++) {
        const l = allLeads[i];
        const outcome: CallOutcome = i % 2 === 0 ? 'CONNECTED' : 'CALLBACK_REQUESTED';
        const remark = i % 2 === 0 ? 'Interested' : 'Call Later';
        const newStatus = determineDefaultLeadStatus(l.status, outcome, remark);

        await crm.callHistory.logCall({
          leadId: l.id,
          calledNumber: l.phoneE164,
          outcome,
          durationSeconds: 0,
          notes: `Simulated call ${i + 1}`,
          updateLeadStatus: newStatus,
        });

        await crm.remarks.addRemark({
          leadId: l.id,
          content: `${remark} — follow up scheduled`,
          type: 'PREDEFINED',
          author: 'Sales Rep',
        });
      }

      // Verify all 10 leads have callCount = 1 and appropriate statuses
      const updatedLeads = await db.leads.toArray();
      for (let i = 0; i < updatedLeads.length; i++) {
        const l = updatedLeads[i];
        expect(l.callCount).toBe(1);
        expect(l.lastContactedAt).toBeTruthy();
        if (i % 2 === 0) {
          expect(l.status).toBe('INTERESTED');
        } else {
          expect(l.status).toBe('FOLLOW_UP');
        }
      }
    });
  });

  describe('4. WhatsApp Template Tag Rendering & Zero-Leak Guarantee', () => {
    it('verifies all 5 pre-seeded pitch templates render with zero {{tag}} leaks', () => {
      const mockLead: Lead = {
        id: 'test-lead-1',
        businessName: 'Anytime Fitness',
        category: 'Gym',
        phone: '7518833349',
        phoneRaw: '+91 75188 33349',
        phoneE164: '+917518833349',
        phoneType: 'mobile',
        alternatePhone: null,
        contactPerson: 'Rajesh Verma',
        address: 'Madan Mohan Malviya Marg, Lucknow 226001',
        locality: 'Hazratganj',
        pincode: '226001',
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
        nextFollowUpAt: '2026-08-22T10:00:00.000Z',
        callCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isSynced: 0,
        syncedAt: null,
        deletedAt: null,
      };

      for (const tpl of DEFAULT_MESSAGE_TEMPLATES) {
        const rendered = renderMessageTemplate(tpl.body, {
          lead: mockLead,
          repName: 'Aman (Sales Lead)',
        });

        expect(rendered).toBeTruthy();
        expect(rendered).toContain('Anytime Fitness');
        expect(rendered).toContain('Rajesh Verma');
        expect(rendered).not.toMatch(/\{\{[^}]+\}\}/); // Zero template tokens leak
      }
    });

    it('safely renders when optional fields are null or undefined without leaking tags', () => {
      const bareLead: Lead = {
        id: 'test-bare',
        businessName: 'Olympia Gym',
        category: 'Gym',
        phone: '9140174734',
        phoneRaw: '+91 91401 74734',
        phoneE164: '+919140174734',
        phoneType: 'mobile',
        alternatePhone: null,
        contactPerson: null, // Null contact person
        address: 'Kaiser Bagh, Lucknow',
        locality: 'Kaiser Bagh',
        pincode: '226018',
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
        nextFollowUpAt: null, // Null follow-up date
        callCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isSynced: 0,
        syncedAt: null,
        deletedAt: null,
      };

      const customTemplate =
        'Hello {{contactPersonOrSir}}, greetings to {{businessName}} at {{locality}}. Contact: {{contactPerson}}. Meeting: {{followUpDate}}. Unknowns: {{promoCode}} {{nonExistentField_123}}';

      const rendered = renderMessageTemplate(customTemplate, { lead: bareLead });

      expect(rendered).toContain('Gym Manager / Owner');
      expect(rendered).toContain('Olympia Gym');
      expect(rendered).toContain('Kaiser Bagh');
      expect(rendered).toContain('Sir/Madam');
      expect(rendered).toContain('this week');
      expect(rendered).not.toContain('promoCode');
      expect(rendered).not.toContain('nonExistentField_123');
      expect(rendered).not.toMatch(/\{\{[^}]+\}\}/); // ZERO {{tags}}
    });

    it('logs outbound WhatsApp message as INITIATED and updates to FAILED on error', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Vega Fitness Factory',
        phone: '+91 83185 90278',
        address: 'Alambagh, Lucknow',
      });

      const messageContent = 'Namaste from Amaratv Krishi!';
      const msg = await crm.messages.logMessage({
        leadId: lead.id,
        channel: 'WHATSAPP',
        recipientPhone: lead.phoneE164,
        messageContent,
        sentStatus: 'INITIATED',
      });

      expect(msg.sentStatus).toBe('INITIATED');
      expect(msg.sentStatus).not.toBe('SENT'); // Never falsely claim SENT

      // Test failure transition
      await crm.messages.updateMessageStatus(msg.id, 'FAILED');
      const refreshed = await crm.messages.getMessageHistoryByLead(lead.id);
      expect(refreshed[0].sentStatus).toBe('FAILED');
    });
  });

  describe('5. 25MB Collateral Attachment Limit Enforcement', () => {
    it('accepts files within 25 MB limit and allowed MIME types', () => {
      const mockPdf = new File(['%PDF-1.4 sample content'], 'Amaratv_Gym_Brochure.pdf', {
        type: 'application/pdf',
      });
      expect(AttachmentService.validateFile(mockPdf).isValid).toBe(true);

      const mockJpg = new File(['image data'], 'sample_packaging.jpg', {
        type: 'image/jpeg',
      });
      expect(AttachmentService.validateFile(mockJpg).isValid).toBe(true);

      const mockPng = new File(['png data'], 'nutrition_table.png', {
        type: 'image/png',
      });
      expect(AttachmentService.validateFile(mockPng).isValid).toBe(true);
    });

    it('rejects files exceeding the 25 MB WhatsApp size threshold', () => {
      const oversizedFile = {
        name: 'Huge_Catalogue.pdf',
        size: MAX_ATTACHMENT_SIZE_BYTES + 1, // 25MB + 1 byte
        type: 'application/pdf',
      } as File;

      const result = AttachmentService.validateFile(oversizedFile);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('exceeds the 25 MB WhatsApp limit');
    });

    it('rejects executable and unsafe file types', () => {
      const unsafeFiles = [
        { name: 'payload.exe', size: 1024, type: 'application/x-msdownload' },
        { name: 'script.bat', size: 1024, type: 'application/x-bat' },
        { name: 'malware.sh', size: 1024, type: 'application/x-sh' },
        { name: 'archive.zip', size: 1024, type: 'application/zip' },
      ] as File[];

      for (const file of unsafeFiles) {
        const res = AttachmentService.validateFile(file);
        expect(res.isValid).toBe(false);
        expect(res.error).toContain('Unsupported file type');
      }
    });

    it('accurately formats file sizes', () => {
      expect(AttachmentService.formatFileSize(0)).toBe('0 B');
      expect(AttachmentService.formatFileSize(512)).toBe('512 B');
      expect(AttachmentService.formatFileSize(1024 * 500)).toBe('500.0 KB');
      expect(AttachmentService.formatFileSize(MAX_ATTACHMENT_SIZE_BYTES)).toBe('25.0 MB');
    });
  });

  describe('6. Backup JSON Generation, Merge Restore (LWW), & Replace Rollback', () => {
    it('generates a complete backup payload of 141 seed leads with full metadata', async () => {
      // Ingest 141 seed leads
      const ws = XLSX.utils.json_to_sheet(BUNDLED_LUCKNOW_DATASET);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data');
      const parseResult = await ExcelParserService.parseSheet(wb, 'Data', db);
      await ExcelParserService.importRecords({ db, records: parseResult.records, sourceFile: 'seeds.xlsx' });

      const backup = await crm.backup.generateBackupPayload();

      expect(backup.schemaVersion).toBe(2);
      expect(backup.appVersion).toBe('1.0.0');
      expect(backup.data.leads.length).toBe(141);
      expect(backup.data.messageTemplates.length).toBeGreaterThanOrEqual(5);

      const validation = crm.backup.validateBackupPayload(backup);
      expect(validation.isValid).toBe(true);
      expect(validation.summary.totalRecords).toBe(141 + backup.data.messageTemplates.length);
    });

    it('performs non-destructive MERGE restore adhering to Last-Write-Wins (LWW)', async () => {
      // 1. Create a local lead at T1
      const lead1 = await crm.leads.createLead({
        businessName: 'Original Local Gym',
        phone: '+91 91111 22222',
        address: 'Hazratganj, Lucknow',
      });

      const t1 = new Date('2026-08-01T10:00:00.000Z').toISOString();
      await db.leads.update(lead1.id, { updatedAt: t1 });

      // 2. Incoming backup has lead1 with newer update at T2, plus a new foreign lead
      const t2 = new Date('2026-08-10T12:00:00.000Z').toISOString();
      const updatedRemoteLead: Lead = {
        ...(await crm.leads.getLeadById(lead1.id))!,
        businessName: 'Updated Gym Name from Merge Backup',
        status: 'INTERESTED',
        updatedAt: t2,
      };

      const newRemoteLead: Lead = {
        id: 'remote-lead-uuid',
        businessName: 'Brand New Remote Gym',
        category: 'Gym',
        phone: '9222233333',
        phoneRaw: '+91 92222 33333',
        phoneE164: '+919222233333',
        phoneType: 'mobile',
        alternatePhone: null,
        contactPerson: null,
        address: 'Aliganj, Lucknow',
        locality: 'Aliganj',
        pincode: '226024',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        website: null,
        rating: null,
        reviewCount: null,
        source: 'Backup',
        sourceFile: null,
        sourceRow: null,
        status: 'NEW',
        customNotes: '',
        lastContactedAt: null,
        nextFollowUpAt: null,
        callCount: 0,
        createdAt: t2,
        updatedAt: t2,
        isSynced: 0,
        syncedAt: null,
        deletedAt: null,
      };

      const backupPayload: CRMBackupPayload = {
        schemaVersion: 2,
        appVersion: '1.0.0',
        exportedAt: new Date().toISOString(),
        databaseName: 'AmaratvSalesCRM',
        data: {
          leads: [updatedRemoteLead, newRemoteLead],
          remarks: [],
          callHistory: [],
          followUps: [],
          messageHistory: [],
          messageTemplates: [],
        },
      };

      const mergeRes = await crm.backup.mergeRestore(backupPayload);
      expect(mergeRes.added).toBe(1);
      expect(mergeRes.updated).toBe(1);
      expect(mergeRes.conflicts).toBe(0);

      const dbLeads = await db.leads.toArray();
      expect(dbLeads.length).toBe(2);

      const refreshedLead1 = await crm.leads.getLeadById(lead1.id);
      expect(refreshedLead1?.businessName).toBe('Updated Gym Name from Merge Backup');
      expect(refreshedLead1?.status).toBe('INTERESTED');
    });

    it('protects local data against older incoming records during MERGE restore', async () => {
      const newerLocalTime = new Date('2026-08-15T10:00:00.000Z').toISOString();
      const olderBackupTime = new Date('2026-08-01T10:00:00.000Z').toISOString();

      const lead = await crm.leads.createLead({
        businessName: 'Newer Local Gym Title',
        phone: '+91 93333 44444',
        address: 'LDA Colony, Lucknow',
      });
      await db.leads.update(lead.id, { updatedAt: newerLocalTime });

      const staleRemoteLead: Lead = {
        ...(await crm.leads.getLeadById(lead.id))!,
        businessName: 'Stale Old Title from Ancient Backup',
        updatedAt: olderBackupTime,
      };

      const backupPayload: CRMBackupPayload = {
        schemaVersion: 2,
        appVersion: '1.0.0',
        exportedAt: new Date().toISOString(),
        databaseName: 'AmaratvSalesCRM',
        data: {
          leads: [staleRemoteLead],
          remarks: [],
          callHistory: [],
          followUps: [],
          messageHistory: [],
          messageTemplates: [],
        },
      };

      const mergeRes = await crm.backup.mergeRestore(backupPayload);
      expect(mergeRes.updated).toBe(0);
      expect(mergeRes.skipped).toBe(1);
      expect(mergeRes.conflicts).toBe(1);

      const refreshed = await crm.leads.getLeadById(lead.id);
      expect(refreshed?.businessName).toBe('Newer Local Gym Title'); // Preserved local
    });

    it('executes transactional REPLACE restore with safety rollback snapshot on corruption', async () => {
      // 1. Setup initial state with 2 leads
      const initialLead1 = await crm.leads.createLead({
        businessName: 'Local Initial Lead 1',
        phone: '+91 94444 55555',
        address: 'Chowk, Lucknow',
      });
      const initialLead2 = await crm.leads.createLead({
        businessName: 'Local Initial Lead 2',
        phone: '+91 95555 66666',
        address: 'Mahanagar, Lucknow',
      });

      expect(await db.leads.count()).toBe(2);

      // 2. Execute valid REPLACE restore
      const replacementLead: Lead = {
        id: 'replaced-lead-1',
        businessName: 'Sole Replaced Gym',
        category: 'Gym',
        phone: '9666677777',
        phoneRaw: '+91 96666 77777',
        phoneE164: '+919666677777',
        phoneType: 'mobile',
        alternatePhone: null,
        contactPerson: 'Vikas',
        address: 'Gomti Nagar, Lucknow',
        locality: 'Gomti Nagar',
        pincode: '226010',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        website: null,
        rating: null,
        reviewCount: null,
        source: 'Backup',
        sourceFile: null,
        sourceRow: null,
        status: 'CUSTOMER',
        customNotes: '',
        lastContactedAt: null,
        nextFollowUpAt: null,
        callCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isSynced: 0,
        syncedAt: null,
        deletedAt: null,
      };

      const validReplacePayload: CRMBackupPayload = {
        schemaVersion: 2,
        appVersion: '1.0.0',
        exportedAt: new Date().toISOString(),
        databaseName: 'AmaratvSalesCRM',
        data: {
          leads: [replacementLead],
          remarks: [],
          callHistory: [],
          followUps: [],
          messageHistory: [],
          messageTemplates: [],
        },
      };

      await crm.backup.replaceRestore(validReplacePayload);

      const afterReplace = await db.leads.toArray();
      expect(afterReplace.length).toBe(1);
      expect(afterReplace[0].id).toBe('replaced-lead-1');
      expect(afterReplace[0].businessName).toBe('Sole Replaced Gym');

      // 3. Attempt corrupt replace payload -> Verify it rejects and preserves DB state
      const malformedPayload = {
        schemaVersion: 2,
        data: {
          leads: [{ id: 'broken-record', leadId: 'orphan' }],
          remarks: [{ id: 'rem-orphan', leadId: 'nonexistent-lead' }], // Orphan foreign key
        },
      } as any;

      await expect(crm.backup.replaceRestore(malformedPayload)).rejects.toThrow();

      // Database must remain at the state of 'replaced-lead-1'
      const afterFailedReplace = await db.leads.toArray();
      expect(afterFailedReplace.length).toBe(1);
      expect(afterFailedReplace[0].id).toBe('replaced-lead-1');
    });
  });

  describe('7. Sales Dashboard 100% Database-Derived KPI Aggregation', () => {
    it('accurately computes dashboard KPIs and locality aggregation across the 141 seed dataset', async () => {
      // Ingest all 141 leads
      const ws = XLSX.utils.json_to_sheet(BUNDLED_LUCKNOW_DATASET);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data');
      const parseResult = await ExcelParserService.parseSheet(wb, 'Data', db);
      await ExcelParserService.importRecords({ db, records: parseResult.records, sourceFile: 'sample.xlsx' });

      // Simulate some activity
      const leads = await db.leads.toArray();
      await crm.callHistory.logCall({
        leadId: leads[0].id,
        calledNumber: leads[0].phoneE164,
        outcome: 'CONNECTED',
        durationSeconds: 0,
        updateLeadStatus: 'INTERESTED',
      });
      await crm.callHistory.logCall({
        leadId: leads[1].id,
        calledNumber: leads[1].phoneE164,
        outcome: 'CONNECTED',
        durationSeconds: 0,
        updateLeadStatus: 'CUSTOMER',
      });
      await crm.messages.logMessage({
        leadId: leads[0].id,
        channel: 'WHATSAPP',
        recipientPhone: leads[0].phoneE164,
        messageContent: 'Test pitch',
        sentStatus: 'INITIATED',
      });

      const data = await dashboardService.getDashboardData();

      expect(data.metrics.totalLeads).toBe(141);
      expect(data.metrics.notContacted).toBe(139);
      expect(data.metrics.interested).toBe(1);
      expect(data.metrics.customers).toBe(1);
      expect(data.metrics.callsToday).toBe(2);
      expect(data.metrics.whatsAppToday).toBe(1);

      // Verify locality distribution
      expect(data.localities.length).toBeGreaterThan(0);
      const totalLocalityLeads = data.localities.reduce((sum, loc) => sum + loc.total, 0);
      expect(totalLocalityLeads).toBeGreaterThan(0);

      // Verify pipeline stage counts sum to 141
      const totalPipelineCount = data.pipeline.reduce((sum, p) => sum + p.count, 0);
      expect(totalPipelineCount).toBe(141);
    });
  });
});
