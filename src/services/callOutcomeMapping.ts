/**
 * Call Outcome & Sales Remark Mapping Logic
 * Determines sensible default LeadStatus transitions based on rep-selected call outcomes and remarks.
 */

import { CallOutcome, LeadStatus } from '../db/types';

export const QUICK_SALES_REMARKS = [
  'Interested',
  'Asked for Price',
  'Asked for Sample',
  'Asked for Catalogue',
  'Call Later',
  'Meeting Required',
  'Sample Sent',
  'Order Confirmed',
  'Not Interested',
  'Already Has Supplier',
  'Do Not Contact',
] as const;

export type QuickSalesRemark = (typeof QUICK_SALES_REMARKS)[number];

export const CALL_OUTCOMES: Array<{ value: CallOutcome; label: string; description: string }> = [
  { value: 'CONNECTED', label: 'Connected', description: 'Spoke with gym owner / decision maker / trainer' },
  { value: 'BUSY', label: 'Busy', description: 'Line was busy or call waiting' },
  { value: 'NO_ANSWER', label: 'No Answer', description: 'Ringing but not answered' },
  { value: 'CALLBACK_REQUESTED', label: 'Callback Requested', description: 'Asked to call back at a later time' },
  { value: 'WRONG_NUMBER', label: 'Wrong Number', description: 'Incorrect number or individual personal line' },
  { value: 'INVALID_NUMBER', label: 'Invalid Number', description: 'Out of service / disconnected number' },
  { value: 'OTHER', label: 'Other', description: 'Other call outcome' },
];

/**
 * Calculates a sensible default LeadStatus based on the current lead status, selected outcome, and remark.
 */
export function determineDefaultLeadStatus(
  currentStatus: LeadStatus,
  outcome: CallOutcome,
  quickRemark?: string | null
): LeadStatus {
  // If remark has a strong business intent, it takes precedence
  if (quickRemark) {
    switch (quickRemark) {
      case 'Order Confirmed':
        return 'CUSTOMER';
      case 'Asked for Sample':
      case 'Sample Sent':
        return 'SAMPLE_REQUESTED';
      case 'Interested':
      case 'Asked for Price':
      case 'Asked for Catalogue':
        return 'INTERESTED';
      case 'Call Later':
      case 'Meeting Required':
        return 'FOLLOW_UP';
      case 'Not Interested':
      case 'Already Has Supplier':
        return 'NOT_INTERESTED';
      case 'Do Not Contact':
        return 'DO_NOT_CONTACT';
    }
  }

  // Outcome-based fallback mappings
  switch (outcome) {
    case 'CONNECTED':
      return currentStatus === 'NEW' ? 'CONTACTED' : currentStatus;
    case 'CALLBACK_REQUESTED':
    case 'BUSY':
    case 'NO_ANSWER':
      return currentStatus === 'NEW' ? 'FOLLOW_UP' : currentStatus;
    case 'WRONG_NUMBER':
    case 'INVALID_NUMBER':
      return 'WRONG_NUMBER';
    case 'OTHER':
    default:
      return currentStatus === 'NEW' ? 'CONTACTED' : currentStatus;
  }
}
