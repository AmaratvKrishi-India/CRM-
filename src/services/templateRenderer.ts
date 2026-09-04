/**
 * Reusable Template Rendering Service
 * Safely replaces dynamic placeholders with Lead properties.
 * Guarantees zero raw unresolved {{tags}} in output.
 */

import type { Lead } from '../db/types';

export interface RenderContext {
  lead: Lead;
  repName?: string;
}

/**
 * Renders a message template string with lead context.
 */
export function renderMessageTemplate(templateBody: string, context: RenderContext): string {
  if (!templateBody) return '';

  const { lead, repName = 'Amaratv Krishi Team' } = context;

  const contactOrSir = lead.contactPerson && lead.contactPerson.trim() !== ''
    ? lead.contactPerson.trim()
    : 'Gym Manager / Owner';

  const contactPerson = lead.contactPerson && lead.contactPerson.trim() !== ''
    ? lead.contactPerson.trim()
    : 'Sir/Madam';

  const businessName = lead.businessName && lead.businessName.trim() !== ''
    ? lead.businessName.trim()
    : 'Your Centre';

  const locality = lead.locality && lead.locality.trim() !== ''
    ? lead.locality.trim()
    : 'Lucknow';

  const city = lead.city && lead.city.trim() !== ''
    ? lead.city.trim()
    : 'Lucknow';

  const phone = lead.phoneE164 || lead.phone || '';

  const followUpDate = lead.nextFollowUpAt
    ? lead.nextFollowUpAt.slice(0, 10)
    : 'this week';

  let rendered = templateBody;

  rendered = rendered.replace(/\{\{businessName\}\}/g, businessName);
  rendered = rendered.replace(/\{\{contactPersonOrSir\}\}/g, contactOrSir);
  rendered = rendered.replace(/\{\{contactPerson\}\}/g, contactPerson);
  rendered = rendered.replace(/\{\{locality\}\}/g, locality);
  rendered = rendered.replace(/\{\{city\}\}/g, city);
  rendered = rendered.replace(/\{\{phone\}\}/g, phone);
  rendered = rendered.replace(/\{\{followUpDate\}\}/g, followUpDate);
  rendered = rendered.replace(/\{\{repName\}\}/g, repName);

  // Safety Pass: Remove any other unresolved {{tag}} patterns so raw code is never shown
  rendered = rendered.replace(/\{\{[a-zA-Z0-9_-]+\}\}/g, '');

  return rendered.trim();
}
