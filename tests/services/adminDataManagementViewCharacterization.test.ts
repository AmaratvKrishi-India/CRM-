import { createElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  user: { id: 'admin-1', name: 'Admin', organizationId: 'org-1', role: 'ADMIN', status: 'ACTIVE' },
  leads: [] as unknown[],
  search: vi.fn(),
  getDistinctLocalities: vi.fn(),
  getAgents: vi.fn(),
  getAuditHistory: vi.fn(),
  restoreLead: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ currentUser: state.user }),
}));

vi.mock('../../src/db', () => ({
  crmData: {
    db: {
      leads: { toArray: () => Promise.resolve(state.leads) },
      callRecords: { toArray: () => Promise.resolve([]) },
      outbox: { toArray: () => Promise.resolve([]) },
    },
    leads: {
      searchAndFilterLeads: state.search,
      getDistinctLocalities: state.getDistinctLocalities,
      restoreLead: state.restoreLead,
    },
    importAudits: { getAuditHistory: state.getAuditHistory },
    syncStateRepo: { getSyncState: vi.fn().mockResolvedValue(null) },
  },
}));

vi.mock('../../src/services/agentManagementService', () => ({
  AgentManagementService: { getAgents: state.getAgents },
}));

vi.mock('../../src/services/leadAssignmentService', () => ({
  LeadAssignmentService: { getAssignmentStats: vi.fn().mockResolvedValue({ totalLeads: 0, assignedCount: 0, unassignedCount: 0 }) },
}));

vi.mock('../../src/components/import/ExcelImporter', () => ({ ExcelImporter: () => null }));
vi.mock('../../src/components/common/Modal', () => ({ Modal: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('../../src/components/common/Toast', () => ({ useToast: () => ({ showToast: state.showToast }) }));
vi.mock('../../src/lib/labels', () => ({ labelFor: (value: string) => value }));
vi.mock('../../src/lib/useDebouncedValue', () => ({ useDebouncedValue: (value: string) => value }));

import { AdminDataManagementView } from '../../src/components/admin/data/AdminDataManagementView';

const archivedLead = {
  id: 'archived-1',
  businessName: 'Archived Gym',
  locality: 'Gomti Nagar',
  phone: '9876543210',
  deletedAt: '2026-09-18T10:00:00.000Z',
  status: 'NEW',
} as never;

beforeEach(() => {
  vi.clearAllMocks();
  state.leads = [archivedLead];
  state.search.mockResolvedValue({ leads: [], total: 0 });
  state.getDistinctLocalities.mockResolvedValue([]);
  state.getAgents.mockResolvedValue([]);
  state.getAuditHistory.mockResolvedValue([]);
  state.restoreLead.mockImplementation(async (id: string) => {
    expect(id).toBe('archived-1');
    state.leads = [];
  });
});

describe('AdminDataManagementView recovery surface', () => {
  it('shows archived leads and restores them through the audited repository path', async () => {
    render(createElement(AdminDataManagementView));

    fireEvent.click(await screen.findByRole('tab', { name: /Data Cleanup/i }));
    expect(await screen.findByText('Archived leads (1)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Restore archived lead Archived Gym' }));

    await waitFor(() => expect(state.restoreLead).toHaveBeenCalledWith('archived-1'));
    expect(await screen.findByText('Archived Gym restored successfully.')).toBeTruthy();
  });
});
