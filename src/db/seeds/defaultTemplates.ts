/**
 * Default Message Templates & Predefined Sales Remarks for Amaratv Krishi
 */

import type { MessageTemplate } from '../types';

export const DEFAULT_MESSAGE_TEMPLATES: Omit<MessageTemplate, 'createdAt' | 'updatedAt' | 'isSynced' | 'deletedAt'>[] = [
  {
    id: 'tpl-intro-gym',
    title: 'Amaratv Krishi - Intro Pitch (Gym Owners & Trainers)',
    category: 'INTRO',
    isDefault: true,
    body: `Namaste {{contactPersonOrSir}},

Greetings from *Amaratv Krishi* (Lucknow) - *From Our Fields to Your Home*.

We supply 100% natural, farm-fresh high-protein flour & health nutrition blends specifically crafted for fitness enthusiasts and gym members at {{businessName}}.

Would love to share a free sample kit for your trainers and members to test. Can we drop by {{locality}} this week?

Best regards,
Amaratv Krishi Sales Team
Lucknow | +91-XXXXXXXXXX`,
  },
  {
    id: 'tpl-sample-offer',
    title: 'Free 1kg Protein Flour Sample Offer',
    category: 'SAMPLE_OFFER',
    isDefault: true,
    body: `Hello {{contactPersonOrSir}},

As discussed over the phone, Amaratv Krishi is excited to provide a *Complimentary 1kg Sample Batch* of our high-protein flour for {{businessName}} in {{locality}}.

Please confirm the best time to deliver the sample pack today or tomorrow.

Warm regards,
Amaratv Krishi Lucknow`,
  },
  {
    id: 'tpl-followup-call',
    title: 'Post-Call Follow-up & Product Details',
    category: 'FOLLOW_UP',
    isDefault: true,
    body: `Namaste {{contactPersonOrSir}},

Thank you for your time on the call regarding Amaratv Krishi natural protein products for {{businessName}}.

Attached is our product catalogue and nutritional breakdown sheet. Looking forward to connecting again on {{followUpDate}}.

Regards,
Amaratv Krishi Lucknow`,
  },
  {
    id: 'tpl-pricing-bulk',
    title: 'Gym & Wellness Centre Bulk Pricing',
    category: 'PRICING',
    isDefault: true,
    body: `Hello {{contactPersonOrSir}},

Here is our special gym-partner pricing tier for Amaratv Krishi protein flour:
- 100% Preservative-Free & Natural
- High Digestibility & Protein Content
- Attractive margins for gym front-desk & member sales

Let us know your estimated monthly requirement for {{businessName}}.

Best regards,
Amaratv Krishi`,
  },
  {
    id: 'tpl-reengage',
    title: 'Re-engagement - New Harvest & Fresh Stock',
    category: 'RE_ENGAGE',
    isDefault: true,
    body: `Namaste {{contactPersonOrSir}},

Checking in from Amaratv Krishi! We have fresh batch supplies ready for delivery across {{locality}}, Lucknow.

Would {{businessName}} be interested in restocking or trying our latest blend?

Best regards,
Amaratv Krishi`,
  },
];

export const PREDEFINED_REMARK_OPTIONS = [
  'Interested in 1kg sample batch',
  'Wants gym front-desk retail placement',
  'Requested callback in evening (after 5 PM)',
  'Spoke with trainer; owner will decide',
  'Asked for wholesale price list & margin sheet',
  'Currently using commercial whey; open to natural alternatives',
  'Sample delivered; follow up for feedback in 3 days',
  'Price sensitive; requested volume discount',
  'Not interested at this moment',
  'Gym permanently closed / relocated',
  'Wrong number / individual personal line',
];
