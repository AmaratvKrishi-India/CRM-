import { createElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  user: { id: 'admin-1', name: 'Admin', organizationId: 'org', role: 'ADMIN', status: 'ACTIVE' },
  search: vi.fn(),
  localities: vi.fn(),
  onEntityChange: vi.fn(() => () => undefined),
}));

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ currentUser: state.user }),
}));

vi.mock('../../src/db', () => ({
  crmData: {
    leads: {
      searchAndFilterLeads: state.search,
      getDistinctLocalities: state.localities,
    },
  },
}));

vi.mock('../../src/services/realtime/realtimeService', () => ({
  RealtimeService: {
    onEntityChange: state.onEntityChange,
  },
}));

vi.mock('../../src/lib/useDebouncedValue', () => ({
  useDebouncedValue: (value: string) => value,
}));

vi.mock('../../src/components/leads/CreateLeadModal', () => ({
  CreateLeadModal: () => null,
}));

import { MinimalLeadsList } from '../../src/components/leads/MinimalLeadsList';

const leadOne = {
  id: 'lead-1',
  businessName: 'Gym One',
  locality: 'Gomti Nagar',
  pincode: '226010',
  category: 'GYM',
  address: 'Main Road',
  phone: '9876543210',
  phoneE164: '+919876543210',
  phoneType: 'mobile',
  status: 'NEW',
} as never;

const leadTwo = {
  id: 'lead-2',
  businessName: 'Gym Two',
  locality: 'Hazratganj',
  category: 'GYM',
  address: 'Market Road',
  phone: '0522123456',
  phoneE164: '+91522123456',
  phoneType: 'landline',
  status: 'CONTACTED',
} as never;

const renderList = (overrides: Record<string, unknown> = {}) => {
  const props = {
    onOpenImporter: vi.fn(),
    onOpenLead: vi.fn(),
    onCallLead: vi.fn(),
    onOpenWhatsApp: vi.fn(),
    onOpenBackupModal: vi.fn(),
    onOpenSettings: vi.fn(),
    ...overrides,
  };
  return { props, view: render(createElement(MinimalLeadsList, props as never)) };
};

beforeEach(() => {
  vi.clearAllMocks();
  state.user = { id: 'admin-1', name: 'Admin', organizationId: 'org', role: 'ADMIN', status: 'ACTIVE' };
  state.search.mockReset();
  state.localities.mockReset();
  state.search.mockResolvedValue({ leads: [], total: 0 });
  state.localities.mockResolvedValue([]);
});

describe('MinimalLeadsList characterization', () => {
  it('renders loaded leads and preserves lead, WhatsApp, call, and admin actions', async () => {
    state.search.mockResolvedValueOnce({ leads: [leadOne, leadTwo], total: 2 });
    state.localities.mockResolvedValueOnce(['Gomti Nagar', 'Hazratganj']);
    const { props, view } = renderList();

    await screen.findByText('Gym One');
    expect(screen.getByText('Gym Two')).toBeTruthy();
    expect(screen.getByText(/Total in Database:/)).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Area:' })).toBeTruthy();

    const leadButton = view.container.querySelector('#lead-item-0');
    expect(leadButton).toBeTruthy();
    fireEvent.click(leadButton as HTMLButtonElement);
    expect(props.onOpenLead).toHaveBeenCalledWith('lead-1');

    fireEvent.click(screen.getByRole('button', { name: 'Send WhatsApp pitch to Gym One' }));
    expect(props.onOpenWhatsApp).toHaveBeenCalledWith(leadOne);

    fireEvent.click(screen.getByRole('button', { name: 'Call Gym One' }));
    expect(props.onCallLead).toHaveBeenCalledWith(leadOne);

    expect(screen.getByLabelText('WhatsApp unavailable â€” landline')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Settings and pitch templates' }));
    fireEvent.click(screen.getByRole('button', { name: 'Backup' }));
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(props.onOpenSettings).toHaveBeenCalledTimes(1);
    expect(props.onOpenBackupModal).toHaveBeenCalledTimes(1);
    expect(props.onOpenImporter).toHaveBeenCalledTimes(1);
  });

  it('scopes agent queries to the agent and preserves initial status and locality filters', async () => {
    state.user = { id: 'agent-7', name: 'Rep', organizationId: 'org', role: 'AGENT', status: 'ACTIVE' };
    state.search.mockResolvedValueOnce({ leads: [leadOne], total: 1 });
    state.localities.mockResolvedValueOnce(['Gomti Nagar']);

    renderList({ initialStatusFilter: 'NEW', initialLocalityFilter: 'Gomti Nagar' });

    await screen.findByText('Gym One');
    expect(state.search).toHaveBeenCalledWith(expect.objectContaining({
      assignedTo: 'agent-7',
      status: 'NEW',
      locality: 'Gomti Nagar',
      limit: 150,
      offset: 0,
    }));
    expect(screen.getByText(/Field Sales/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Import' })).toBeNull();
  });

  it('shows a load error and retries the same list successfully', async () => {
    state.search
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce({ leads: [leadOne], total: 1 });
    state.localities.mockResolvedValueOnce(['Gomti Nagar']);

    renderList();

    expect(await screen.findByText('Could not load leads from the local database.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Gym One')).toBeTruthy();
    expect(state.search).toHaveBeenCalledTimes(2);
  });

  it('appends the next page using the current rendered lead count as the offset', async () => {
    state.search
      .mockResolvedValueOnce({ leads: [leadOne], total: 2 })
      .mockResolvedValueOnce({ leads: [leadTwo], total: 2 });
    state.localities.mockResolvedValueOnce([]);

    renderList();

    await screen.findByText('Gym One');
    fireEvent.click(screen.getByRole('button', { name: 'Load More (1 remaining)' }));

    expect(await screen.findByText('Gym Two')).toBeTruthy();
    expect(screen.getByText('Gym One')).toBeTruthy();
    expect(state.search).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 1, limit: 150 }));
  });
});
