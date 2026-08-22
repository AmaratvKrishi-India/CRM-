import { describe, it } from 'node:test';
import assert from 'node:assert';
import { renderMessageTemplate } from '../src/services/templateRenderer.ts';
import type { Lead } from '../src/db/types.ts';

describe('Real WhatsApp Message Template Renderer Tests (Stage 8)', () => {
  const baseLead: Lead = {
    id: 'lead-tpl-001',
    businessName: 'Gold Standard Gym',
    contactPerson: 'Mr. Arvind Verma',
    phone: '9876543210',
    phoneE164: '+919876543210',
    locality: 'Hazratganj',
    city: 'Lucknow',
    nextFollowUpAt: '2026-08-25T10:00:00.000Z',
    status: 'INTERESTED',
    isSynced: 1,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('1. Correctly substitutes all standard placeholder tags', () => {
    const template = 'Hello {{contactPerson}}, this is {{repName}} from Amaratv Krishi. Following up with {{businessName}} in {{locality}}, {{city}} on {{followUpDate}}. Call {{phone}}.';
    const result = renderMessageTemplate(template, { lead: baseLead, repName: 'Priya Sharma' });

    assert.strictEqual(
      result,
      'Hello Mr. Arvind Verma, this is Priya Sharma from Amaratv Krishi. Following up with Gold Standard Gym in Hazratganj, Lucknow on 2026-08-25. Call +919876543210.'
    );
  });

  it('2. Fallback hierarchy when contact person is missing', () => {
    const emptyContactLead: Lead = {
      ...baseLead,
      contactPerson: undefined,
    };

    const template1 = 'Dear {{contactPersonOrSir}}, special offer for {{businessName}}!';
    const result1 = renderMessageTemplate(template1, { lead: emptyContactLead });
    assert.strictEqual(result1, 'Dear Gym Manager / Owner, special offer for Gold Standard Gym!');

    const template2 = 'Dear {{contactPerson}}, we visited your centre.';
    const result2 = renderMessageTemplate(template2, { lead: emptyContactLead });
    assert.strictEqual(result2, 'Dear Sir/Madam, we visited your centre.');
  });

  it('3. Safety Invariant: Strips unsupported / unknown {{tags}} from final output', () => {
    const template = 'Hi {{businessName}}! Your coupon {{couponCode}} expires soon. Special token: {{unknown_promo_tag}}.';
    const result = renderMessageTemplate(template, { lead: baseLead });

    assert.strictEqual(result, 'Hi Gold Standard Gym! Your coupon  expires soon. Special token: .');
    assert.ok(!result.includes('{{'));
    assert.ok(!result.includes('}}'));
  });
});
