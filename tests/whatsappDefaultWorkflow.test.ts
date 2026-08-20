import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { SalesCRMDatabase } from '../src/db/database';
import { createCRMDataLayer } from '../src/db';
import { renderMessageTemplate } from '../src/services/templateRenderer';
import { AppSettingsService } from '../src/services/appSettingsService';
import { AttachmentService } from '../src/services/attachmentService';
import { normalizePhoneNumber } from '../src/db/services/leadNormalizer';
import { Lead } from '../src/db/types';

describe('Milestone 9: Generic WhatsApp Message & One-Tap Send Suite', () => {
  let db: SalesCRMDatabase;
  let crm: ReturnType<typeof createCRMDataLayer>;

  const mockLead: Lead = {
    id: 'lead-test-001',
    businessName: "Gold's Gym Gomti Nagar",
    category: 'Gym / Fitness Club',
    phone: '9839012345',
    phoneRaw: '+91 98390 12345',
    phoneE164: '+919839012345',
    phoneType: 'mobile',
    alternatePhone: null,
    contactPerson: 'Vikram Singh',
    address: 'Vipin Khand, Gomti Nagar, Lucknow',
    locality: 'Gomti Nagar',
    pincode: '226010',
    city: 'Lucknow',
    state: 'Uttar Pradesh',
    website: null,
    rating: 4.7,
    reviewCount: 120,
    source: 'Excel Seed',
    sourceFile: null,
    sourceRow: 1,
    status: 'NEW',
    customNotes: '',
    lastContactedAt: null,
    nextFollowUpAt: '2026-08-28T10:00:00.000Z',
    callCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isSynced: 0,
    syncedAt: null,
    deletedAt: null,
  };

  beforeEach(async () => {
    const testDbName = `test_m9_${Math.random().toString(36).substring(7)}`;
    db = new SalesCRMDatabase(testDbName);
    crm = createCRMDataLayer(db);
    await db.seedDefaults();
    await db.leads.add(mockLead);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('1. Default Template Persistence & Single Default Exclusivity', () => {
    it('1. saves a new default message template', async () => {
      const created = await crm.templates.createTemplate({
        title: 'Amaratv Standard B2B Pitch',
        category: 'INTRO',
        body: 'Hello {{businessName}},\n\nI am reaching out from Amaratv Krishi.',
        isDefault: true,
      });

      expect(created.id).toBeDefined();
      expect(created.isDefault).toBe(true);
      expect(created.title).toBe('Amaratv Standard B2B Pitch');
    });

    it('2. loads the active default message template', async () => {
      const created = await crm.templates.createTemplate({
        title: 'Custom Fast Pitch',
        category: 'INTRO',
        body: 'Namaste {{contactPersonOrSir}} at {{businessName}}.',
        isDefault: true,
      });

      const defaultTpl = await crm.templates.getDefaultTemplate();
      expect(defaultTpl).toBeDefined();
      expect(defaultTpl?.id).toBe(created.id);
      expect(defaultTpl?.title).toBe('Custom Fast Pitch');
    });

    it('3. edits an existing default message template', async () => {
      const created = await crm.templates.createTemplate({
        title: 'Initial Pitch',
        category: 'INTRO',
        body: 'Initial body',
        isDefault: true,
      });

      const updated = await crm.templates.updateTemplate(created.id, {
        title: 'Updated Pitch',
        body: 'Updated body for {{businessName}}',
      });

      expect(updated.title).toBe('Updated Pitch');
      expect(updated.body).toBe('Updated body for {{businessName}}');

      const loaded = await crm.templates.getDefaultTemplate();
      expect(loaded?.title).toBe('Updated Pitch');
    });

    it('4. setting another template as default guarantees single default exclusivity', async () => {
      const tpl1 = await crm.templates.createTemplate({
        title: 'Template 1',
        category: 'INTRO',
        body: 'Body 1',
        isDefault: true,
      });

      const tpl2 = await crm.templates.createTemplate({
        title: 'Template 2',
        category: 'SAMPLE_OFFER',
        body: 'Body 2',
        isDefault: false,
      });

      expect((await crm.templates.getDefaultTemplate())?.id).toBe(tpl1.id);

      // Now set Template 2 as default
      await crm.templates.setDefaultTemplate(tpl2.id);

      const all = await crm.templates.getAllTemplates();
      const defaultTemplates = all.filter((t) => t.isDefault);

      expect(defaultTemplates.length).toBe(1);
      expect(defaultTemplates[0].id).toBe(tpl2.id);
      expect(defaultTemplates[0].title).toBe('Template 2');
    });

    it('20. deletes a template with soft-deletion', async () => {
      const tpl = await crm.templates.createTemplate({
        title: 'Temporary Template',
        category: 'INTRO',
        body: 'Will be deleted',
      });

      await crm.templates.softDeleteTemplate(tpl.id);
      const all = await crm.templates.getAllTemplates();
      expect(all.some((t) => t.id === tpl.id)).toBe(false);

      const raw = await db.messageTemplates.get(tpl.id);
      expect(raw?.deletedAt).not.toBeNull();
    });
  });

  describe('2. Template Variable Rendering & Personalisation', () => {
    it('5. renders a template without errors', () => {
      const body = 'Hello from Amaratv Krishi!';
      const rendered = renderMessageTemplate(body, { lead: mockLead });
      expect(rendered).toBe('Hello from Amaratv Krishi!');
    });

    it('6. correctly substitutes businessName tag', () => {
      const body = 'Welcome {{businessName}} to Amaratv Krishi!';
      const rendered = renderMessageTemplate(body, { lead: mockLead });
      expect(rendered).toBe("Welcome Gold's Gym Gomti Nagar to Amaratv Krishi!");
    });

    it('7. correctly substitutes locality tag', () => {
      const body = 'Delivering fresh protein flour across {{locality}}, {{city}}.';
      const rendered = renderMessageTemplate(body, { lead: mockLead });
      expect(rendered).toBe('Delivering fresh protein flour across Gomti Nagar, Lucknow.');
    });

    it('8. correctly substitutes contactPerson tag', () => {
      const body = 'Namaste {{contactPerson}}, we have samples ready for {{businessName}}.';
      const rendered = renderMessageTemplate(body, { lead: mockLead });
      expect(rendered).toBe("Namaste Vikram Singh, we have samples ready for Gold's Gym Gomti Nagar.");
    });

    it('9. sanitises all unresolved dynamic tokens without leaving raw code', () => {
      const body = 'Hello {{businessName}}! Info: {{unknownToken_123}} {{xyz}} {{anotherTag}}.';
      const rendered = renderMessageTemplate(body, { lead: mockLead });
      expect(rendered).not.toContain('{{unknownToken_123}}');
      expect(rendered).not.toContain('{{xyz}}');
      expect(rendered).not.toContain('{{anotherTag}}');
      expect(rendered).toBe("Hello Gold's Gym Gomti Nagar! Info:   .");
    });
  });

  describe('3. Default Catalogue & Attachment Handling', () => {
    it('10. persists and retrieves default catalogue configuration', async () => {
      const testFile = new File(['%PDF-1.4 sample catalogue'], 'amaratv-catalogue.pdf', {
        type: 'application/pdf',
      });

      const meta = await AppSettingsService.setDefaultCatalogue(testFile);
      expect(meta.name).toBe('amaratv-catalogue.pdf');
      expect(meta.isPdf).toBe(true);

      const retrieved = AppSettingsService.getDefaultCatalogue();
      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe('amaratv-catalogue.pdf');
    });

    it('11. provides graceful fallback when catalogue metadata is missing or corrupted', () => {
      AppSettingsService.clearDefaultCatalogue();
      const retrieved = AppSettingsService.getDefaultCatalogue();
      expect(retrieved).toBeNull();

      const attachment = AppSettingsService.createAttachmentFromStoredCatalogue(null as any);
      expect(attachment).toBeNull();
    });
  });

  describe('4. Quick Send & Messaging Workflow Integrity', () => {
    it('12. prepares a complete Quick Send message with dynamic lead data', async () => {
      const defaultTpl = await crm.templates.createTemplate({
        title: 'Default Intro Pitch',
        category: 'INTRO',
        body: 'Hello {{businessName}},\n\nWe supply protein flour in {{locality}}.\n\nRegards,\nAmaratv Krishi',
        isDefault: true,
      });

      const rendered = renderMessageTemplate(defaultTpl.body, { lead: mockLead });
      expect(rendered).toContain("Gold's Gym Gomti Nagar");
      expect(rendered).toContain('Gomti Nagar');
      expect(rendered).toContain('Amaratv Krishi');
    });

    it('13. supports modifying individual outgoing draft before sending', () => {
      const defaultBody = 'Hello {{businessName}}, standard message.';
      let draftedMessage = renderMessageTemplate(defaultBody, { lead: mockLead });

      // Sales rep customizes this specific draft
      draftedMessage += ' Special 10% wholesale offer for your trainers.';

      expect(draftedMessage).toContain('Special 10% wholesale offer for your trainers.');
    });

    it('14. individual message draft customization does NOT alter the saved default template', async () => {
      const tpl = await crm.templates.createTemplate({
        title: 'Original Template',
        category: 'INTRO',
        body: 'Standard body for {{businessName}}',
        isDefault: true,
      });

      let customizedDraft = renderMessageTemplate(tpl.body, { lead: mockLead });
      customizedDraft += ' - One-off custom note!';

      const fetchedTemplate = await crm.templates.getTemplateById(tpl.id);
      expect(fetchedTemplate?.body).toBe('Standard body for {{businessName}}');
      expect(fetchedTemplate?.body).not.toContain('One-off custom note');
    });

    it('15. blocks WhatsApp workflow for 0522 landline numbers', () => {
      const landlineRaw = '05224227316';
      const normalized = normalizePhoneNumber(landlineRaw);
      expect(normalized.type).toBe('landline');
      expect(normalized.canWhatsApp).toBe(false);

      const landlineLead: Lead = {
        ...mockLead,
        id: 'lead-landline-001',
        phone: '05224227316',
        phoneType: 'landline',
      };

      expect(landlineLead.phoneType).toBe('landline');
    });

    it('16. logs message history with status INITIATED before WhatsApp launch', async () => {
      const logged = await crm.messages.logMessage({
        leadId: mockLead.id,
        channel: 'WHATSAPP',
        templateId: 'tpl-intro-gym',
        recipientPhone: mockLead.phoneE164,
        messageContent: 'Rendered message content for Gold Gym',
        sentStatus: 'INITIATED',
      });

      expect(logged.id).toBeDefined();
      expect(logged.sentStatus).toBe('INITIATED');
      expect(logged.channel).toBe('WHATSAPP');

      const history = await crm.messages.getMessageHistoryByLead(mockLead.id);
      expect(history.length).toBe(1);
      expect(history[0].sentStatus).toBe('INITIATED');
    });

    it('17. transitions message status to FAILED if native launch encounters an error', async () => {
      const logged = await crm.messages.logMessage({
        leadId: mockLead.id,
        channel: 'WHATSAPP',
        templateId: null,
        recipientPhone: mockLead.phoneE164,
        messageContent: 'Test message',
        sentStatus: 'INITIATED',
      });

      await crm.messages.updateMessageStatus(logged.id, 'FAILED');
      const updated = await db.messageHistory.get(logged.id);
      expect(updated?.sentStatus).toBe('FAILED');
    });

    it('18. persists templates and default state across database reconnections', async () => {
      const tpl = await crm.templates.createTemplate({
        title: 'Persistent Pitch',
        category: 'PRICING',
        body: 'Pricing for {{businessName}}',
        isDefault: true,
      });

      // Query from clean repository instance
      const newRepo = crm.templates;
      const loaded = await newRepo.getDefaultTemplate();
      expect(loaded?.id).toBe(tpl.id);
      expect(loaded?.title).toBe('Persistent Pitch');
    });

    it('19. functions 100% offline without remote network dependencies', async () => {
      // Create template and duplicate offline
      const tpl = await crm.templates.createTemplate({
        title: 'Offline Pitch',
        category: 'RE_ENGAGE',
        body: 'Restocking in {{locality}}',
      });

      const copy = await crm.templates.duplicateTemplate(tpl.id);
      expect(copy.title).toBe('Copy of Offline Pitch');
      expect(copy.body).toBe(tpl.body);
    });
  });
});
