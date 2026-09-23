import { createElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  user: { id: 'admin-1', organizationId: 'org-1', role: 'ADMIN', status: 'ACTIVE', name: 'Admin' },
  agents: [{ id: 'agent-1', name: 'Agent One', role: 'AGENT', deletedAt: null }],
  kpis: {
    leads: { total: 12, assigned: 10, unassigned: 2 },
    calls: { total: 8, verified: 6, unverified: 2, verifiedTalkTimeSeconds: 3600, averageVerifiedDurationSeconds: 600 },
    followUps: { today: 3, upcoming: 4, overdue: 1, completed: 2 },
  },
  pipeline: [
    { status: 'NEW', label: 'New', count: 5, percentage: 50 },
    { status: 'INTERESTED', label: 'Interested', count: 3, percentage: 30 },
    { status: 'FOLLOW_UP', label: 'Follow Up', count: 2, percentage: 20 },
    { status: 'CUSTOMER', label: 'Customer', count: 1, percentage: 10 },
    { status: 'NOT_INTERESTED', label: 'Not Interested', count: 1, percentage: 10 },
  ],
  performance: [],
  getKpis: vi.fn(),
  getPipeline: vi.fn(),
  getPerformance: vi.fn(),
}));

vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ currentUser: state.user }) }));vi.mock('../../src/services/adminAnalyticsService', () => ({
  AdminAnalyticsService: {
    getOrganisationKPIs: state.getKpis,
    getLeadPipelineSummary: state.getPipeline,
    getAgentPerformanceList: state.getPerformance,
  },
}));
vi.mock('../../src/db/database', () => ({
  getDatabase: () => ({
    users: {
      filter: () => ({ toArray: async () => state.agents }),
    },
  }),
}));
vi.mock('../../src/services/realtime/realtimeService', () => ({
  RealtimeService: {
    onActivity: () => () => {},
    onEntityChange: () => () => {},
  },
}));
vi.mock('../../src/components/admin/AgentPerformanceTable', () => ({ AgentPerformanceTable: () => null }));
vi.mock('../../src/components/admin/AgentPerformanceDetail', () => ({ AgentPerformanceDetail: () => null }));
vi.mock('../../src/components/admin/AdminCallHistoryModal', () => ({ AdminCallHistoryModal: () => null }));
vi.mock('../../src/components/admin/LiveActivityFeed', () => ({ LiveActivityFeed: () => null }));

import { AdminDashboardView } from '../../src/components/admin/AdminDashboardView';beforeEach(() => {
  vi.clearAllMocks();
  state.getKpis.mockResolvedValue(state.kpis);
  state.getPipeline.mockResolvedValue(state.pipeline);
  state.getPerformance.mockResolvedValue(state.performance);
});

describe('AdminDashboardView characterization', () => {
  it('preserves lead navigation and the selected representative filter', async () => {
    const onNavigateToLeads = vi.fn();
    const view = render(createElement(AdminDashboardView, {
      onEnterSalesMode: vi.fn(),
      onNavigateToLeads,
      onNavigateToAgents: vi.fn(),
    }));

    await waitFor(() => expect(state.getKpis).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: /Total Leads/i }));
    expect(onNavigateToLeads).toHaveBeenCalledWith();

    await screen.findByRole('option', { name: 'Agent One' });
    fireEvent.change(screen.getByLabelText('Representative'), { target: { value: 'agent-1' } });
    await waitFor(() => expect(state.getKpis).toHaveBeenLastCalledWith(state.user, 'ALL_TIME', 'agent-1'));

    fireEvent.click(screen.getByRole('button', { name: 'View New leads (5)' }));    expect(onNavigateToLeads).toHaveBeenLastCalledWith('NEW', 'agent-1');
    expect(screen.getByRole('button', { name: 'Show all 5 pipeline stages' })).toBeTruthy();
    view.unmount();
  });

  it('renders the loaded KPI values and follow-up state', async () => {
    const view = render(createElement(AdminDashboardView, {
      onEnterSalesMode: vi.fn(),
      onNavigateToLeads: vi.fn(),
      onNavigateToAgents: vi.fn(),
    }));

    await waitFor(() => expect(state.getKpis).toHaveBeenCalledTimes(1));
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('1h 0m')).toBeTruthy();
    expect(screen.getByText(/Avg: 10m/)).toBeTruthy();
    expect(screen.getByText('1 overdue')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Total Calls/i })).toBeTruthy();
    view.unmount();
  });

  it('renders completed follow-ups when nothing is overdue', async () => {
    state.getKpis.mockResolvedValueOnce({
      ...state.kpis,
      followUps: { ...state.kpis.followUps, overdue: 0, completed: 2 },
    });
    const view = render(createElement(AdminDashboardView, {
      onEnterSalesMode: vi.fn(),
      onNavigateToLeads: vi.fn(),
      onNavigateToAgents: vi.fn(),
    }));

    await waitFor(() => expect(state.getKpis).toHaveBeenCalledTimes(1));
    expect(screen.getByText('2 done')).toBeTruthy();
    view.unmount();
  });

  it('shows the load failure and retries without changing filter state', async () => {
    state.getKpis.mockRejectedValueOnce(new Error('offline'));
    const view = render(createElement(AdminDashboardView, {
      onEnterSalesMode: vi.fn(),
      onNavigateToLeads: vi.fn(),
      onNavigateToAgents: vi.fn(),
    }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Could not load dashboard analytics');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(state.getKpis).toHaveBeenCalledTimes(2));
    expect(state.getKpis).toHaveBeenLastCalledWith(state.user, 'ALL_TIME', 'ALL');
    view.unmount();
  });
});