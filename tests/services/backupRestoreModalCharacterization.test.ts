import { createElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  getDatabaseSummary: vi.fn(),
  getAuditLogs: vi.fn(),
  generateBackupPayload: vi.fn(),
  validateBackupJson: vi.fn(),
  mergeRestore: vi.fn(),
  replaceRestore: vi.fn(),
  generateBackupFilename: vi.fn(() => 'amaratv-crm-backup-test.json'),
  downloadJsonFile: vi.fn(),
  serializeBackupPayload: vi.fn(async () => '{"backup":true}'),
  showToast: vi.fn(),
}));

vi.mock('../../src/db', () => ({
  crmData: {
    backup: {
      getDatabaseSummary: state.getDatabaseSummary,
      getAuditLogs: state.getAuditLogs,
      generateBackupPayload: state.generateBackupPayload,
      validateBackupJson: state.validateBackupJson,
      mergeRestore: state.mergeRestore,
      replaceRestore: state.replaceRestore,
    },
  },
}));

vi.mock('../../src/services/backupService', () => ({
  BackupService: {
    generateBackupFilename: state.generateBackupFilename,
    downloadJsonFile: state.downloadJsonFile,
  },
  serializeBackupPayload: state.serializeBackupPayload,
}));

vi.mock('../../src/components/common/Toast', () => ({
  useToast: () => ({ showToast: state.showToast }),
}));

vi.mock('../../src/components/common/Modal', () => ({
  Modal: ({ isOpen, title, children }: { isOpen: boolean; title: string; children: unknown }) =>
    isOpen ? createElement('div', {}, createElement('h2', {}, title), children as never) : null,
}));

import { BackupRestoreModal } from '../../src/components/backup/BackupRestoreModal';

const summary = {
  leadsCount: 4,
  remarksCount: 3,
  callsCount: 2,
  followUpsCount: 1,
  messagesCount: 5,
  templatesCount: 6,
  totalRecords: 21,
};

beforeEach(() => {
  vi.clearAllMocks();
  state.getDatabaseSummary.mockResolvedValue(summary);
  state.getAuditLogs.mockReturnValue([]);
  state.generateBackupPayload.mockResolvedValue({ meta: { version: 1 } });
  state.serializeBackupPayload.mockResolvedValue('{"backup":true}');
});

describe('BackupRestoreModal characterization', () => {
  it('loads the local summary and exports through the backup service without restore mutations', async () => {
    const onDatabaseChanged = vi.fn();
    render(createElement(BackupRestoreModal, {
      isOpen: true,
      onClose: vi.fn(),
      onDatabaseChanged,
    }));

    await screen.findByText('21 Total Records');
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Download CRM Backup File (.json)' }));

    await waitFor(() => expect(state.downloadJsonFile).toHaveBeenCalledWith(
      'amaratv-crm-backup-test.json',
      '{"backup":true}'
    ));
    expect(state.generateBackupPayload).toHaveBeenCalledTimes(1);
    expect(state.serializeBackupPayload).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Backup saved successfully as/)).toBeTruthy();
    expect(onDatabaseChanged).not.toHaveBeenCalled();
    expect(state.mergeRestore).not.toHaveBeenCalled();
    expect(state.replaceRestore).not.toHaveBeenCalled();
  });

  it('preserves roving keyboard navigation across export restore and history tabs', async () => {
    render(createElement(BackupRestoreModal, {
      isOpen: true,
      onClose: vi.fn(),
      onDatabaseChanged: vi.fn(),
    }));

    await screen.findByText('21 Total Records');
    const exportTab = screen.getByRole('tab', { name: 'Export Backup' });
    const restoreTab = screen.getByRole('tab', { name: 'Restore Backup' });
    const historyTab = screen.getByRole('tab', { name: 'History' });

    fireEvent.keyDown(exportTab, { key: 'ArrowRight' });
    await waitFor(() => expect(restoreTab.getAttribute('aria-selected')).toBe('true'));
    expect(document.activeElement).toBe(restoreTab);

    fireEvent.keyDown(restoreTab, { key: 'End' });
    await waitFor(() => expect(historyTab.getAttribute('aria-selected')).toBe('true'));
    expect(document.activeElement).toBe(historyTab);
  });

  it('renders audit history entries and does not perform restore operations', async () => {
    state.getAuditLogs.mockReturnValueOnce([{
      id: 'audit-1',
      operation: 'EXPORT',
      status: 'SUCCESS',
      timestamp: '2026-09-18T00:00:00.000Z',
      summaryText: 'Backup exported',
    }]);

    render(createElement(BackupRestoreModal, {
      isOpen: true,
      onClose: vi.fn(),
      onDatabaseChanged: vi.fn(),
    }));

    await screen.findByText('21 Total Records');
    fireEvent.click(screen.getByRole('tab', { name: 'History' }));

    expect(await screen.findByText('Backup exported')).toBeTruthy();
    expect(screen.getByText(/Export.*Success/)).toBeTruthy();
    expect(state.mergeRestore).not.toHaveBeenCalled();
    expect(state.replaceRestore).not.toHaveBeenCalled();
  });
});
