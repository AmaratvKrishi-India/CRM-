import { createElement } from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SalesCRMDatabase } from '../../src/db/database';
import { SyncQueue } from '../../src/services/sync/syncQueue';
import * as databaseModule from '../../src/db/database';

const state = vi.hoisted(() => ({
  user: { id: 'actor', organizationId: 'org', role: 'ADMIN', status: 'ACTIVE' },
  agents: vi.fn(async () => []), history: vi.fn(async () => null), templates: vi.fn(async () => []),
  stats: vi.fn(async () => ({ totalLeads: 0, unassignedCount: 0, assignedCount: 0, byAgent: {} })),
  leads: vi.fn(async () => ({ leads: [], total: 0 })),
  report: vi.fn(async () => null), activities: vi.fn(async () => []),
  revoke: vi.fn(), catalogue: vi.fn(() => null), attachment: vi.fn(),
  database: null as SalesCRMDatabase | null,
}));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ currentUser: state.user }) }));
vi.mock('../../src/components/common/Toast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../../src/db', () => ({ crmData: {
  get db() { return state.database; },
  leads: { getLeadWithFullHistory: state.history, searchAndFilterLeads: state.leads },
  templates: { getAllTemplates: state.templates },
} }));
vi.mock('../../src/services/agentManagementService', () => ({ AgentManagementService: { getAgents: state.agents } }));
vi.mock('../../src/services/leadAssignmentService', () => ({ LeadAssignmentService: { getAssignmentStats: state.stats } }));
vi.mock('../../src/services/adminReportsService', () => ({ AdminReportsService: { getLeadReport: state.report } }));
vi.mock('../../src/services/realtime/realtimeService', () => ({ RealtimeService: {
  getStatus: () => 'CONNECTED', onActivity: () => () => {}, onEntityChange: () => () => {}, onStatusChange: () => () => {},
} }));
vi.mock('../../src/services/appSettingsService', () => ({ AppSettingsService: {
  getDefaultCatalogue: state.catalogue, createAttachmentFromStoredCatalogue: state.attachment,
} }));
vi.mock('../../src/services/attachmentService', () => ({ AttachmentService: { revokeAttachmentUrl: state.revoke } }));

import { AdminAgentsView } from '../../src/components/admin/AdminAgentsView';
import { AdminLeadsView } from '../../src/components/admin/AdminLeadsView';
import { LeadDetailView } from '../../src/components/leads/LeadDetailView';
import { WhatsAppComposeModal } from '../../src/components/whatsapp/WhatsAppComposeModal';
import { SyncRecoveryPanel } from '../../src/components/sync/SyncRecoveryPanel';
import { LiveActivityFeed } from '../../src/components/admin/LiveActivityFeed';
import { AdminReportsView } from '../../src/components/admin/AdminReportsView';

beforeEach(() => { vi.clearAllMocks(); state.user = { id: 'actor', organizationId: 'org', role: 'ADMIN', status: 'ACTIVE' }; });
describe('F027 stable loader dependencies', () => {
  it('activity loader reloads when its limit changes and stays stable otherwise', async () => {
    const query = { filter: () => query, reverse: () => query, sortBy: state.activities };
    const getter = vi.spyOn(databaseModule, 'getDatabase').mockReturnValue({ activities: query } as never);
    try {
      const view = render(createElement(LiveActivityFeed, { limit: 5 }));
      await waitFor(() => expect(state.activities).toHaveBeenCalledTimes(1));
      view.rerender(createElement(LiveActivityFeed, { limit: 10 }));
      await waitFor(() => expect(state.activities).toHaveBeenCalledTimes(2));
      view.rerender(createElement(LiveActivityFeed, { limit: 10 }));
      expect(state.activities).toHaveBeenCalledTimes(2); view.unmount();
    } finally { getter.mockRestore(); }
  });
  it('report loader remains stable across its state updates and reloads for a new actor', async () => {
    const query = { filter: () => query, toArray: async () => [] };
    const getter = vi.spyOn(databaseModule, 'getDatabase').mockReturnValue({ users: query, leads: query } as never);
    try {
      const view = render(createElement(AdminReportsView));
      await waitFor(() => expect(state.report).toHaveBeenCalledTimes(1));
      view.rerender(createElement(AdminReportsView)); expect(state.report).toHaveBeenCalledTimes(1);
      state.user = { ...state.user, id: 'next-actor' };
      view.rerender(createElement(AdminReportsView));
      await waitFor(() => expect(state.report).toHaveBeenCalledTimes(2)); view.unmount();
    } finally { getter.mockRestore(); }
  });
  it('agent loader runs once for unchanged identity and reloads after identity changes', async () => {
    const view = render(createElement(AdminAgentsView));
    await waitFor(() => expect(state.agents).toHaveBeenCalledTimes(1));
    view.rerender(createElement(AdminAgentsView));
    expect(state.agents).toHaveBeenCalledTimes(1);
    state.user = { ...state.user, id: 'new-actor' };
    view.rerender(createElement(AdminAgentsView));
    await waitFor(() => expect(state.agents).toHaveBeenCalledTimes(2));
  });
  it('lead list loader remains stable across its own state updates', async () => {
    const view = render(createElement(AdminLeadsView));
    await waitFor(() => expect(state.leads).toHaveBeenCalledTimes(1));
    view.rerender(createElement(AdminLeadsView));
    expect(state.leads).toHaveBeenCalledTimes(1);
  });
  it('lead detail reloads for a new lead without repeating unchanged requests', async () => {
    const props = { leadId: 'first', onBack: vi.fn(), onCallLead: vi.fn(), onOpenOutcomeModal: vi.fn(), onOpenWhatsApp: vi.fn() };
    const view = render(createElement(LeadDetailView, props));
    await waitFor(() => expect(state.history).toHaveBeenCalledTimes(1));
    view.rerender(createElement(LeadDetailView, { ...props, leadId: 'second' }));
    await waitFor(() => expect(state.history).toHaveBeenLastCalledWith('second'));
    expect(state.history).toHaveBeenCalledTimes(2);
  });
  it('closing before template loading finishes does not create a stale attachment', async () => {
    let resolve!: (rows: never[]) => void;
    state.templates.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const props = { isOpen: true, lead: { id: 'lead', businessName: 'Gym', phone: '9876543210' } as never,
      onClose: vi.fn(), onSuccess: vi.fn(), onOpenSettings: vi.fn() };
    const view = render(createElement(WhatsAppComposeModal, props));
    view.rerender(createElement(WhatsAppComposeModal, { ...props, isOpen: false }));
    resolve([{ id: 'template', body: 'hello', isDefault: true } as never]);
    await waitFor(() => expect(state.templates).toHaveBeenCalledTimes(1));
    expect(state.catalogue).not.toHaveBeenCalled(); expect(state.attachment).not.toHaveBeenCalled();
  });
  it('a loaded catalogue URL is released exactly once when the modal unmounts', async () => {
    state.templates.mockResolvedValueOnce([{ id: 'template', title: 'Default', body: 'Hello', isDefault: true } as never]);
    state.catalogue.mockReturnValueOnce({ name: 'catalogue.pdf' } as never);
    const attachment = { name: 'catalogue.pdf', localUrl: 'blob:test', isPdf: true, sizeFormatted: '1 KB' };
    state.attachment.mockReturnValueOnce(attachment);
    const view = render(createElement(WhatsAppComposeModal, { isOpen: true,
      lead: { id: 'lead', businessName: 'Gym', phone: '9876543210' } as never,
      onClose: vi.fn(), onSuccess: vi.fn(), onOpenSettings: vi.fn() }));
    await screen.findByText('catalogue.pdf'); view.unmount();
    expect(state.revoke).toHaveBeenCalledExactlyOnceWith(attachment);
  });
});
it('F028 settings recovery exposes inspection, export and an explicit unchanged retry', async () => {
  const db = new SalesCRMDatabase(`F028_UI_${crypto.randomUUID()}`, { organizationId: 'org', userId: 'actor', role: 'ADMIN' });
  state.database = db; const queue = new SyncQueue(db);
  const item = await queue.enqueue({ entityType: 'leads', entityId: 'lead', operation: 'UPDATE', payload: { businessName: 'Saved draft' }, userId: 'actor' });
  await queue.markFailed(item.id, 'network unavailable', { retryable: false });
  try {
    const view = render(createElement(SyncRecoveryPanel));
    await screen.findByText('Inspect saved change');
    fireEvent.click(screen.getByRole('button', { name: 'Export saved change' }));
    const output = await screen.findByRole('textbox', { name: 'Recovery export' });
    expect((output as HTMLTextAreaElement).value).toContain('Saved draft');
    fireEvent.click(screen.getByRole('button', { name: 'Retry unchanged' }));
    await waitFor(async () => expect((await db.outbox.get(item.id))?.status).toBe('PENDING'));
    expect((await db.outbox.get(item.id))?.payload.businessName).toBe('Saved draft');
    view.unmount();
  } finally { state.database = null; db.close(); await db.delete(); }
});
