import type { LeadStatus } from '../db/types';

export const leadStatusBadgeClass = (status: LeadStatus): string => {
  switch (status) {
    case 'NEW':
      return 'bg-info-soft text-info-text border-info/30';
    case 'CONTACTED':
      return 'bg-accent-soft text-accent-text border-accent/30';
    case 'INTERESTED':
      return 'bg-success-soft text-success-text border-success/30';
    case 'SAMPLE_REQUESTED':
      return 'bg-warning-soft text-warning-text border-warning/30';
    case 'CUSTOMER':
      return 'bg-success text-on-accent border-success';
    case 'WRONG_NUMBER':
    case 'DO_NOT_CONTACT':
      return 'bg-danger-soft text-danger-text border-danger/30';
    default:
      return 'bg-inset text-soft border-line';
  }
};
