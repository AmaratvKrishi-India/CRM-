/**
 * F15 — Human-readable labels for technical enum values.
 * Presentation-layer mapping only; database values are unchanged.
 */

const LABELS: Record<string, string> = {
  // LeadStatus
  NEW: 'New',
  CONTACTED: 'Contacted',
  INTERESTED: 'Interested',
  SAMPLE_REQUESTED: 'Sample Requested',
  FOLLOW_UP: 'Follow-up',
  NEGOTIATION: 'Negotiation',
  CUSTOMER: 'Customer',
  NOT_INTERESTED: 'Not Interested',
  WRONG_NUMBER: 'Wrong Number',
  DO_NOT_CONTACT: 'Do Not Contact',
  // CallOutcome
  CONNECTED: 'Connected',
  BUSY: 'Busy',
  NO_ANSWER: 'No Answer',
  CALLBACK_REQUESTED: 'Callback Requested',
  INVALID_NUMBER: 'Invalid Number',
  OTHER: 'Other',
  // FollowUpPriority
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
  // FollowUpStatus
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  MISSED: 'Missed',
  CANCELLED: 'Cancelled',
  // MessageStatus
  INITIATED: 'Preparing',
  SENT: 'Sent',
  FAILED: 'Failed',
  // MessageChannel
  WHATSAPP: 'WhatsApp',
  SMS: 'SMS',
  // Roles / misc
  ADMIN: 'Admin',
  AGENT: 'Agent',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  VERIFIED: 'Verified',
  UNVERIFIED: 'Unverified',
};

/** Map a technical enum value to a human-readable label (falls back to title case). */
export function labelFor(value: string | null | undefined): string {
  if (!value) return '';
  if (LABELS[value]) return LABELS[value];
  // Fallback: SNAKE_CASE -> Title Case
  return value
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
