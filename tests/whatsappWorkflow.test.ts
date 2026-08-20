import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { SalesCRMDatabase } from '../src/db/database';
import { createCRMDataLayer } from '../src/db';
import { renderMessageTemplate } from '../src/services/templateRenderer';
import { AttachmentService, MAX_ATTACHMENT_SIZE_BYTES } from '../src/services/attachmentService';
import { normalizePhoneNumber } from '../src/db/services/leadNormalizer';
import { Lead } from '../src/db/types';

describe('Milestone 3: WhatsApp Outreach & Catalogue Sharing Workflow', () => {
  let db: SalesCRMDatabase;
  let crm: ReturnType<typeof createCRMDataLayer>;

  beforeEach(async () => {
    const testDbName = `test_wa_${Math.random().toString(36).substring(7)}`;
    db = new SalesCRMDatabase(testDbName);
    crm = createCRMDataLayer(db);
    await db.seedDefaults();
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('1. Template Rendering & Variable Replacement', () => {
    it('replaces all known lead variables in template body', () => {
      const mockLead: Lead = {
        id: 'lead-1',
        businessName: 'Skywards Fitness Zone',
        category: 'Gym',
        phone: '7054447888',
        phoneRaw: '+91 70544 47888',
        phoneE164: '+917054447888',
        phoneType: 'mobile',
        alternatePhone: null,
        contactPerson: 'Manoj Sharma',
        address: 'LDA Colony, Lucknow',
        locality: 'LDA Colony',
        pincode: '226012',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        website: null,
        rating: null,
        reviewCount: null,
        source: 'Excel Seed',
        sourceFile: null,
        sourceRow: null,
        status: 'NEW',
        customNotes: '',
        lastContactedAt: null,
        nextFollowUpAt: '2026-08-25T10:00:00.000Z',
        callCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isSynced: 0,
        syncedAt: null,
        deletedAt: null,
      };

      const template = 'Namaste {{contactPersonOrSir}}, greetings for {{businessName}} in {{locality}}, {{city}}. Contact: {{phone}}. Follow up on {{followUpDate}}. Team: {{repName}}';
      const rendered = renderMessageTemplate(template, { lead: mockLead, repName: 'Aman (Sales Rep)' });

      expect(rendered).toContain('Namaste Manoj Sharma');
      expect(rendered).toContain('Skywards Fitness Zone');
      expect(rendered).toContain('LDA Colony');
      expect(rendered).toContain('Lucknow');
      expect(rendered).toContain('+917054447888');
      expect(rendered).toContain('2026-08-25');
      expect(rendered).toContain('Aman (Sales Rep)');
    });

    it('handles missing/null contactPerson gracefully with default fallback and no raw tags', () => {
      const mockLead: Lead = {
        id: 'lead-2',
        businessName: 'Optimum Fitness',
        category: 'Gym',
        phone: '9619887358',
        phoneRaw: '+91 96198 87358',
        phoneE164: '+919619887358',
        phoneType: 'mobile',
        alternatePhone: null,
        contactPerson: null, // Null contact person
        address: 'Wazirganj, Lucknow',
        locality: 'Wazirganj',
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
        nextFollowUpAt: null,
        callCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isSynced: 0,
        syncedAt: null,
        deletedAt: null,
      };

      const template = 'Namaste {{contactPersonOrSir}}, would love to send a sample to {{businessName}} at {{locality}}. Contact: {{contactPerson}}. Extra: {{unknownTag}}';
      const rendered = renderMessageTemplate(template, { lead: mockLead });

      expect(rendered).toContain('Namaste Gym Manager / Owner');
      expect(rendered).toContain('Optimum Fitness');
      expect(rendered).toContain('Wazirganj');
      expect(rendered).toContain('Sir/Madam');
      expect(rendered).not.toContain('{{');
      expect(rendered).not.toContain('}}');
    });
  });

  describe('2. WhatsApp Phone Eligibility & Landline Rejection', () => {
    it('confirms WhatsApp eligibility for mobile numbers (+91)', () => {
      const mobileResult = normalizePhoneNumber('+91 70544 47888');
      expect(mobileResult.canWhatsApp).toBe(true);
      expect(mobileResult.type).toBe('mobile');
      expect(mobileResult.e164).toBe('+917054447888');
    });

    it('rejects WhatsApp for Lucknow 0522 landline numbers', () => {
      const landlineResult = normalizePhoneNumber('+91 522 422 7316');
      expect(landlineResult.canWhatsApp).toBe(false);
      expect(landlineResult.type).toBe('landline');
      expect(landlineResult.clean).toBe('05224227316');
    });
  });

  describe('3. Message History Logging & Status Tracking', () => {
    it('creates a MessageHistory record with INITIATED status upon compose', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Trend Fitness',
        phone: '+91 73100 04343',
        address: 'Charbagh, Lucknow',
      });

      const messageContent = 'Namaste! Amaratv Krishi is happy to offer a sample batch for Trend Fitness.';
      const msgLog = await crm.messages.logMessage({
        leadId: lead.id,
        channel: 'WHATSAPP',
        recipientPhone: lead.phoneE164,
        messageContent,
        templateId: 'tpl-intro-gym',
        sentStatus: 'INITIATED',
      });

      expect(msgLog.id).toBeDefined();
      expect(msgLog.sentStatus).toBe('INITIATED');
      expect(msgLog.messageContent).toBe(messageContent);
      expect(msgLog.channel).toBe('WHATSAPP');

      // Verify lead lastContactedAt updated
      const refreshedLead = (await crm.leads.getLeadById(lead.id))!;
      expect(refreshedLead.lastContactedAt).toBeDefined();

      // Verify retrieval
      const history = await crm.messages.getMessageHistoryByLead(lead.id);
      expect(history.length).toBe(1);
      expect(history[0].sentStatus).toBe('INITIATED');
    });

    it('updates MessageHistory to FAILED when WhatsApp launch fails', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Charismaa Fitness',
        phone: '+91 93051 49690',
        address: 'Nishat Ganj, Lucknow',
      });

      const msgLog = await crm.messages.logMessage({
        leadId: lead.id,
        channel: 'WHATSAPP',
        recipientPhone: lead.phoneE164,
        messageContent: 'Pitch message',
        sentStatus: 'INITIATED',
      });

      expect(msgLog.sentStatus).toBe('INITIATED');

      // Simulate failure update
      await crm.messages.updateMessageStatus(msgLog.id, 'FAILED');

      const history = await crm.messages.getMessageHistoryByLead(lead.id);
      expect(history[0].sentStatus).toBe('FAILED');
    });
  });

  describe('4. Message Templates Management', () => {
    it('retrieves default Amaratv Krishi templates across all 5 required categories', async () => {
      const templates = await crm.templates.getAllTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(5);

      const categories = templates.map((t) => t.category);
      expect(categories).toContain('INTRO');
      expect(categories).toContain('SAMPLE_OFFER');
      expect(categories).toContain('PRICING');
      expect(categories).toContain('FOLLOW_UP');
      expect(categories).toContain('RE_ENGAGE');
    });
  });

  describe('5. Product Catalogue Attachment Validation', () => {
    it('validates supported PDF and image attachments', () => {
      const mockPdf = new File(['%PDF-1.4 sample content'], 'Amaratv_Protein_Flour_Catalogue.pdf', {
        type: 'application/pdf',
      });
      const validPdf = AttachmentService.validateFile(mockPdf);
      expect(validPdf.isValid).toBe(true);

      const mockImage = new File(['image bytes'], 'product_nutrition_label.jpg', {
        type: 'image/jpeg',
      });
      const validImage = AttachmentService.validateFile(mockImage);
      expect(validImage.isValid).toBe(true);
    });

    it('rejects unsupported file formats', () => {
      const mockExe = new File(['executable binary'], 'script.exe', {
        type: 'application/x-msdownload',
      });
      const invalidRes = AttachmentService.validateFile(mockExe);
      expect(invalidRes.isValid).toBe(false);
      expect(invalidRes.error).toContain('Unsupported file type');
    });

    it('rejects files larger than 25 MB WhatsApp limit', () => {
      // Mock large file object
      const largeFile = {
        name: 'huge_catalogue.pdf',
        size: MAX_ATTACHMENT_SIZE_BYTES + 1024,
        type: 'application/pdf',
      } as File;

      const res = AttachmentService.validateFile(largeFile);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('exceeds the 25 MB WhatsApp limit');
    });

    it('formats file sizes accurately', () => {
      expect(AttachmentService.formatFileSize(1024)).toBe('1.0 KB');
      expect(AttachmentService.formatFileSize(1572864)).toBe('1.5 MB');
    });
  });
});
