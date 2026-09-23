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
  report: vi.fn(async () => null), callReport: vi.fn(async () => null),
  productivityReport: vi.fn(async () => []), followUpReport: vi.fn(async () => null),
  whatsAppReport: vi.fn(async () => null), importReport: vi.fn(async () => null),
  activityReport: vi.fn(async () => []), activities: vi.fn(async () => []),
  revoke: vi.fn(), catalogue: vi.fn(() => null), attachment: vi.fn(),
  logMessage: vi.fn(async () => ({ id: 'message-1' })), updateMessageStatus: vi.fn(async () => undefined),
  openWhatsApp: vi.fn(), share: vi.fn(async () => true), createTemplate: vi.fn(async () => ({ id: 'template-created', body: 'Created intro', isDefault: true })),
  database: null as SalesCRMDatabase | null,
}));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ currentUser: state.user }) }));
vi.mock('../../src/components/common/Toast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../../src/db', () => ({ crmData: {
  get db() { return state.database; },
  leads: { getLeadWithFullHistory: state.history, searchAndFilterLeads: state.leads },
  templates: { getAllTemplates: state.templates, createTemplate: state.createTemplate },
  messages: { logMessage: state.logMessage, updateMessageStatus: state.updateMessageStatus },
} }));
vi.mock('../../src/services/agentManagementService', () => ({ AgentManagementService: { getAgents: state.agents } }));
vi.mock('../../src/services/leadAssignmentService', () => ({ LeadAssignmentService: { getAssignmentStats: state.stats } }));
vi.mock('../../src/services/adminReportsService', () => ({ AdminReportsService: {
  getLeadReport: state.report, getCallReport: state.callReport,
  getAgentProductivityReport: state.productivityReport, getFollowUpReport: state.followUpReport,
  getWhatsAppReport: state.whatsAppReport, getImportReport: state.importReport,
  getActivityReport: state.activityReport,
} }));
vi.mock('../../src/services/realtime/realtimeService', () => ({ RealtimeService: {
  getStatus: () => 'CONNECTED', onActivity: () => () => {}, onEntityChange: () => () => {}, onStatusChange: () => () => {},
} }));
vi.mock('../../src/services/appSettingsService', () => ({ AppSettingsService: {
  getDefaultCatalogue: state.catalogue, createAttachmentFromStoredCatalogue: state.attachment,
} }));
vi.mock('../../src/services/attachmentService', () => ({ AttachmentService: { revokeAttachmentUrl: state.revoke } }));
vi.mock('../../src/services/nativePlatform', () => ({ NativePlatformService: { openWhatsApp: state.openWhatsApp, share: state.share } }));
vi.mock('../../src/components/sync/SyncStatusBadge', () => ({ SyncStatusBadge: () => null }));

import { AdminAgentsView } from '../../src/components/admin/AdminAgentsView';
import { AdminLeadsView } from '../../src/components/admin/AdminLeadsView';
import { LeadDetailView } from '../../src/components/leads/LeadDetailView';
import { WhatsAppComposeModal } from '../../src/components/whatsapp/WhatsAppComposeModal';
import { SyncRecoveryPanel } from '../../src/components/sync/SyncRecoveryPanel';
import { LiveActivityFeed } from '../../src/components/admin/LiveActivityFeed';
import { AdminReportsView } from '../../src/components/admin/AdminReportsView';

const leadHistoryFixture = {
  lead: {
    id: 'lead-loaded', businessName: 'Loaded Gym', category: 'GYM', contactPerson: 'Owner',
    phone: '9876543210', phoneE164: '+919876543210', phoneType: 'mobile', locality: 'Gomti Nagar',
    pincode: '226010', address: 'Main Road', callCount: 3, status: 'INTERESTED',
    lastContactedAt: '2026-09-17T10:00:00.000Z', nextFollowUpAt: '2026-09-20T10:00:00.000Z',
  },
  callHistory: [{ id: 'call-1', outcome: 'CONNECTED', startedAt: '2026-09-17T10:00:00.000Z', remark: 'Call note' }],
  remarks: [{ id: 'remark-1', author: 'Rep', createdAt: '2026-09-17T11:00:00.000Z', content: 'Needs sample' }],
  followUps: [{ id: 'follow-1', status: 'PENDING', scheduledAt: '2026-09-20T10:00:00.000Z', title: 'Sample delivery', notes: 'Bring catalogue', priority: 'HIGH' }],
  messageHistory: [{ id: 'msg-1', sentStatus: 'SENT', sentAt: '2026-09-17T12:00:00.000Z', messageContent: 'WhatsApp pitch sent' }],
};

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
      expect(screen.getByRole('tab', { name: 'Leads' }).getAttribute('aria-selected')).toBe('true');
      expect(screen.getByRole('tab', { name: 'Calls' }).getAttribute('aria-selected')).toBe('false');
      view.rerender(createElement(AdminReportsView)); expect(state.report).toHaveBeenCalledTimes(1);
      state.user = { ...state.user, id: 'next-actor' };
      view.rerender(createElement(AdminReportsView));
      await waitFor(() => expect(state.report).toHaveBeenCalledTimes(2)); view.unmount();
    } finally { getter.mockRestore(); }
  });
  it('loads the matching report service when each report tab becomes active', async () => {
    const query = { filter: () => query, toArray: async () => [] };
    const getter = vi.spyOn(databaseModule, 'getDatabase').mockReturnValue({ users: query, leads: query } as never);
    try {
      const view = render(createElement(AdminReportsView));
      await waitFor(() => expect(state.report).toHaveBeenCalledTimes(1));
      const cases = [
        ['Calls', state.callReport],
        ['Productivity', state.productivityReport],
        ['Follow-ups', state.followUpReport],
        ['WhatsApp', state.whatsAppReport],
        ['Imports', state.importReport],
        ['Activity Log', state.activityReport],
      ] as const;
      for (const [name, loader] of cases) {
        fireEvent.click(screen.getByRole('tab', { name }));
        await waitFor(() => expect(loader).toHaveBeenCalledTimes(1));
      }
      view.unmount();
    } finally { getter.mockRestore(); }
  });
  it('renders populated lead report metrics without changing report semantics', async () => {
    state.report.mockResolvedValueOnce({
      totalLeads: 7,
      statusBreakdown: { NEW: 3 },
      unassignedLeads: 2,
      assignedLeads: 5,
      leadsCreatedByAgent: [],
      leadsAssignedToAgent: [],
      convertedCustomers: 1,
      conversionPercentage: 14,
    });
    const query = { filter: () => query, toArray: async () => [] };
    const getter = vi.spyOn(databaseModule, 'getDatabase').mockReturnValue({ users: query, leads: query } as never);
    try {
      const view = render(createElement(AdminReportsView));
      await screen.findByText('7');
      expect(screen.getByText('5 Assigned')).toBeTruthy();
      expect(screen.getByText('14% Conversion Rate')).toBeTruthy();
      expect(screen.getByText('Awaiting first contact')).toBeTruthy();
      view.unmount();
    } finally { getter.mockRestore(); }
  });
  it('renders populated call report metrics without changing report semantics', async () => {
    state.callReport.mockResolvedValueOnce({
      totalCalls: 9, callsByAgent: [], callsByDay: [], callsByOutcome: { CONNECTED: 3 },
      verifiedCalls: 4, unverifiedCalls: 5, verifiedTalkTimeSeconds: 3661,
      averageVerifiedDurationSeconds: 65, longestVerifiedDurationSeconds: 125, talkTimeByAgent: [],
    });
    const query = { filter: () => query, toArray: async () => [] };
    const getter = vi.spyOn(databaseModule, 'getDatabase').mockReturnValue({ users: query, leads: query } as never);
    try {
      const view = render(createElement(AdminReportsView));
      await waitFor(() => expect(state.report).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByRole('tab', { name: 'Calls' }));
      await screen.findByText('9');
      expect(screen.getByText('4 Verified')).toBeTruthy();
      expect(screen.getByText('1h 1m')).toBeTruthy();
      expect(screen.getByText('1m 5s')).toBeTruthy();
      expect(screen.getByText('2m 5s')).toBeTruthy();
      view.unmount();
    } finally { getter.mockRestore(); }
  });
  it('renders populated follow-up report metrics without changing report semantics', async () => {
    state.followUpReport.mockResolvedValueOnce({
      totalFollowUps: 13, today: 2, upcoming: 4, overdue: 3, completed: 5, cancelled: 1,
      completionPercentage: 38, overduePercentage: 23, followUpsByAgent: [],
    });
    const query = { filter: () => query, toArray: async () => [] };
    const getter = vi.spyOn(databaseModule, 'getDatabase').mockReturnValue({ users: query, leads: query } as never);
    try {
      const view = render(createElement(AdminReportsView));
      await waitFor(() => expect(state.report).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByRole('tab', { name: 'Follow-ups' }));
      await screen.findByText('13');
      expect(screen.getByText('38% Completed')).toBeTruthy();
      expect(screen.getByText('Successfully concluded')).toBeTruthy();
      expect(screen.getByText('Action required')).toBeTruthy();
      expect(screen.getByText('23% Overdue')).toBeTruthy();
      view.unmount();
    } finally { getter.mockRestore(); }
  });
  it('renders populated WhatsApp report metrics without changing report semantics', async () => {
    state.whatsAppReport.mockResolvedValueOnce({
      totalInitiated: 17, totalFailed: 2, byAgent: [], byDate: [], templateUsage: [],
      mostUsedTemplateName: 'Harvest Pitch', landlinePreventedCount: 6,
    });
    const query = { filter: () => query, toArray: async () => [] };
    const getter = vi.spyOn(databaseModule, 'getDatabase').mockReturnValue({ users: query, leads: query } as never);
    try {
      const view = render(createElement(AdminReportsView));
      await waitFor(() => expect(state.report).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByRole('tab', { name: 'WhatsApp' }));
      await screen.findByText('17');
      expect(screen.getByText('Templates dispatched')).toBeTruthy();
      expect(screen.getByText('6')).toBeTruthy();
      expect(screen.getByText('0522 guard protected')).toBeTruthy();
      expect(screen.getByText('Harvest Pitch')).toBeTruthy();
      view.unmount();
    } finally { getter.mockRestore(); }
  });
  it('report tabs preserve roving keyboard navigation', async () => {
    const query = { filter: () => query, toArray: async () => [] };
    const getter = vi.spyOn(databaseModule, 'getDatabase').mockReturnValue({ users: query, leads: query } as never);
    try {
      const view = render(createElement(AdminReportsView));
      await waitFor(() => expect(state.report).toHaveBeenCalledTimes(1));
      const leadsTab = screen.getByRole('tab', { name: 'Leads' });
      fireEvent.keyDown(leadsTab, { key: 'ArrowRight' });
      await waitFor(() => expect(screen.getByRole('tab', { name: 'Calls' }).getAttribute('aria-selected')).toBe('true'));
      expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Calls' }));
      view.unmount();
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
  it('renders a loaded mobile lead and preserves profile actions plus history navigation', async () => {
    state.history.mockResolvedValueOnce(leadHistoryFixture as never);
    const props = {
      leadId: 'lead-loaded',
      onBack: vi.fn(),
      onCallLead: vi.fn(),
      onOpenOutcomeModal: vi.fn(),
      onOpenWhatsApp: vi.fn(),
    };
    render(createElement(LeadDetailView, props));

    await screen.findByRole('heading', { name: 'Loaded Gym' });
    expect(screen.getByText('Contact: Owner')).toBeTruthy();
    expect(screen.getAllByText('Sample delivery').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Back to leads list' }));
    fireEvent.click(screen.getByRole('button', { name: 'Call' }));
    fireEvent.click(screen.getByRole('button', { name: 'WhatsApp' }));
    fireEvent.click(screen.getByRole('button', { name: 'Log call outcome & add remark' }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(props.onCallLead).toHaveBeenCalledWith(leadHistoryFixture.lead);
    expect(props.onOpenWhatsApp).toHaveBeenCalledWith(leadHistoryFixture.lead);
    expect(props.onOpenOutcomeModal).toHaveBeenCalledWith(leadHistoryFixture.lead);

    const callsTab = screen.getByRole('tab', { name: 'Calls (1)' });
    fireEvent.keyDown(callsTab, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Remarks (1)' }).getAttribute('aria-selected')).toBe('true'));
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Remarks (1)' }));
    expect(screen.getByText('Needs sample')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Follow-ups (1)' }));
    expect(screen.getAllByText('Bring catalogue').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('tab', { name: 'WhatsApp (1)' }));
    expect(screen.getByText('WhatsApp pitch sent')).toBeTruthy();
  });

  it('keeps WhatsApp disabled for a loaded landline lead', async () => {
    state.history.mockResolvedValueOnce({
      ...leadHistoryFixture,
      lead: {
        ...leadHistoryFixture.lead,
        phone: '0522123456',
        phoneE164: '+91522123456',
        phoneType: 'landline',
      },
      followUps: [],
    } as never);
    render(createElement(LeadDetailView, {
      leadId: 'lead-loaded',
      onBack: vi.fn(),
      onCallLead: vi.fn(),
      onOpenOutcomeModal: vi.fn(),
      onOpenWhatsApp: vi.fn(),
    }));

    await screen.findByRole('heading', { name: 'Loaded Gym' });
    expect(screen.getByText('Lucknow landline (0522)')).toBeTruthy();
    const unavailable = screen.getByRole('button', { name: 'WhatsApp unavailable — landline number' }) as HTMLButtonElement;
    expect(unavailable.disabled).toBe(true);
    expect(screen.getByText('No follow-up reminder set')).toBeTruthy();
  });

  it('blocks WhatsApp handoff for landlines without creating a message log', async () => {
    state.templates.mockResolvedValueOnce([{ id: 'template', title: 'Default', body: 'Hello {{businessName}}', isDefault: true } as never]);
    render(createElement(WhatsAppComposeModal, {
      isOpen: true,
      lead: { id: 'lead', businessName: 'Gym', locality: 'Lucknow', phone: '0522123456', phoneType: 'landline' } as never,
      onClose: vi.fn(), onSuccess: vi.fn(), onOpenSettings: vi.fn(),
    }));
    await screen.findByText('WhatsApp unavailable for landlines');
    const sendButton = screen.getByRole('button', { name: /Quick send:/ });
    expect((sendButton as HTMLButtonElement).disabled).toBe(true);
    expect(state.logMessage).not.toHaveBeenCalled();
    expect(state.openWhatsApp).not.toHaveBeenCalled();
  });
  it('logs a WhatsApp message, hands it off, marks it sent, and closes on success', async () => {
    state.templates.mockResolvedValueOnce([{ id: 'template', title: 'Default', body: 'Hello {{businessName}}', isDefault: true } as never]);
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    render(createElement(WhatsAppComposeModal, {
      isOpen: true,
      lead: { id: 'lead', businessName: 'Gym', locality: 'Lucknow', phone: '9876543210', phoneE164: '+919876543210', phoneType: 'mobile' } as never,
      onClose, onSuccess, onOpenSettings: vi.fn(),
    }));
    const sendButton = await screen.findByRole('button', { name: /Quick send:/ });
    await waitFor(() => expect((sendButton as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(sendButton);
    await waitFor(() => expect(state.updateMessageStatus).toHaveBeenCalledWith('message-1', 'SENT'));
    expect(state.logMessage).toHaveBeenCalledWith(expect.objectContaining({
      leadId: 'lead',
      channel: 'WHATSAPP',
      recipientPhone: '+919876543210',
      sentStatus: 'INITIATED',
    }));
    expect(state.openWhatsApp).toHaveBeenCalledWith('+919876543210', 'Hello Gym');
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('marks the message failed and keeps the modal open when WhatsApp handoff throws', async () => {
    state.templates.mockResolvedValueOnce([{ id: 'template', title: 'Default', body: 'Hello {{businessName}}', isDefault: true } as never]);
    state.openWhatsApp.mockImplementationOnce(() => { throw new Error('handoff failed'); });
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    render(createElement(WhatsAppComposeModal, {
      isOpen: true,
      lead: { id: 'lead', businessName: 'Gym', locality: 'Lucknow', phone: '9876543210', phoneType: 'mobile' } as never,
      onClose, onSuccess, onOpenSettings: vi.fn(),
    }));
    const sendButton = await screen.findByRole('button', { name: /Quick send:/ });
    await waitFor(() => expect((sendButton as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(sendButton);
    await waitFor(() => expect(state.updateMessageStatus).toHaveBeenCalledWith('message-1', 'FAILED'));
    expect(await screen.findByText(/Could not open WhatsApp/)).toBeTruthy();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
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
