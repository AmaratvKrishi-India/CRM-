import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  Upload,
  History,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  FileText,
  Database,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { crmData } from '../../db';
import type {
  BackupValidationResult,
  MergeRestoreResult,
  BackupAuditLog} from '../../services/backupService';
import {
  BackupService,
  serializeBackupPayload,
} from '../../services/backupService';
import { Modal } from '../common/Modal';
import { useToast } from '../common/Toast';
import { labelFor } from '../../lib/labels';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDatabaseChanged: () => void;
}

type BackupTab = 'EXPORT' | 'RESTORE' | 'HISTORY';

const TAB_ORDER: BackupTab[] = ['EXPORT', 'RESTORE', 'HISTORY'];

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  onDatabaseChanged,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<BackupTab>('EXPORT');
  const [dbSummary, setDbSummary] = useState<{
    leadsCount: number;
    remarksCount: number;
    callsCount: number;
    followUpsCount: number;
    messagesCount: number;
    templatesCount: number;
    totalRecords: number;
  } | null>(null);

  const [loadingSummary, setLoadingSummary] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Restore State
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<BackupValidationResult | null>(null);
  const [, setMergeResult] = useState<MergeRestoreResult | null>(null);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [confirmInputText, setConfirmInputText] = useState('');

  // History State
  const [auditLogs, setAuditLogs] = useState<BackupAuditLog[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const tabRefs = useRef<Partial<Record<BackupTab, HTMLButtonElement | null>>>({});

  const loadSummaryAndHistory = async () => {
    setLoadingSummary(true);
    try {
      const summary = await crmData.backup.getDatabaseSummary();
      setDbSummary(summary);
      const logs = crmData.backup.getAuditLogs();
      setAuditLogs(logs);
    } catch (err) {
      console.error('Failed to fetch DB summary:', err);
      showToast({ message: 'Could not load database summary.', tone: 'error' });
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setSuccessMessage(null);
      setUploadedFileName(null);
      setValidationResult(null);
      setMergeResult(null);
      setShowReplaceConfirm(false);
      setConfirmInputText('');
      loadSummaryAndHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleTabKeyDown = (e: React.KeyboardEvent, id: BackupTab) => {
    const idx = TAB_ORDER.indexOf(id);
    let next: BackupTab | null = null;
    if (e.key === 'ArrowRight') next = TAB_ORDER[(idx + 1) % TAB_ORDER.length];
    else if (e.key === 'ArrowLeft') next = TAB_ORDER[(idx - 1 + TAB_ORDER.length) % TAB_ORDER.length];
    else if (e.key === 'Home') next = TAB_ORDER[0];
    else if (e.key === 'End') next = TAB_ORDER[TAB_ORDER.length - 1];
    if (next) {
      e.preventDefault();
      setActiveTab(next);
      tabRefs.current[next]?.focus();
    }
  };

  const handleExportBackup = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const payload = await crmData.backup.generateBackupPayload();
      const filename = BackupService.generateBackupFilename();
      const jsonStr = await serializeBackupPayload(payload);

      BackupService.downloadJsonFile(filename, jsonStr);

      setSuccessMessage(
        `Backup saved successfully as "${filename}" (${(jsonStr.length / 1024).toFixed(1)} KB).`
      );
      await loadSummaryAndHistory();
    } catch (err: any) {
      console.error('Export failed:', err);
      setErrorMessage(err.message || 'Failed to generate backup.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploadedFileName(file.name);
    setErrorMessage(null);
    setSuccessMessage(null);
    setMergeResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const res = crmData.backup.validateBackupJson(text);
        setValidationResult(res);
        if (!res.isValid) {
          setErrorMessage(`Invalid Backup File:\n${res.errors.slice(0, 3).join('\n')}`);
        }
      } catch (err: any) {
        setErrorMessage(`Failed to read backup file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleMergeRestore = async () => {
    if (!validationResult?.payload) return;
    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await crmData.backup.mergeRestore(validationResult.payload);
      setMergeResult(res);
      setSuccessMessage(
        `Merge complete! Added: ${res.added}, Updated: ${res.updated}, Skipped: ${res.skipped} (${res.conflicts} conflicts resolved).`
      );
      await loadSummaryAndHistory();
      onDatabaseChanged();
    } catch (err: any) {
      console.error('Merge restore failed:', err);
      setErrorMessage(err.message || 'Merge restore failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReplaceRestore = async () => {
    if (!validationResult?.payload) return;
    if (confirmInputText.trim().toUpperCase() !== 'REPLACE') {
      setErrorMessage('Please type "REPLACE" to confirm complete database replacement.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await crmData.backup.replaceRestore(validationResult.payload);
      setShowReplaceConfirm(false);
      setSuccessMessage(
        `Database replaced successfully with ${validationResult.summary.totalRecords} records from backup!`
      );
      await loadSummaryAndHistory();
      onDatabaseChanged();
    } catch (err: any) {
      console.error('Replace restore failed:', err);
      setErrorMessage(err.message || 'Replace restore failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatLogDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const tabButtonClass = (selected: boolean) =>
    `min-h-11 py-2 px-3.5 text-sm font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
      selected
        ? 'border-accent text-accent-text bg-surface rounded-t-xl'
        : 'border-transparent text-soft hover:text-ink'
    }`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="CRM Backup & Restore"
      subtitle="Offline JSON Database Management"
      maxWidthClassName="max-w-xl"
      closeOnBackdrop={!showReplaceConfirm}
      headerIcon={
        <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent-text flex items-center justify-center shrink-0">
          <Database className="w-5 h-5" aria-hidden="true" />
        </div>
      }
    >
      {/* Tab Navigation */}
      <div
        role="tablist"
        aria-label="Backup and restore sections"
        className="flex border-b border-line bg-inset px-4 pt-2 -mx-4 -mt-4 mb-4"
      >
        {[
          { id: 'EXPORT' as BackupTab, label: 'Export Backup', icon: Download },
          { id: 'RESTORE' as BackupTab, label: 'Restore Backup', icon: Upload },
          { id: 'HISTORY' as BackupTab, label: 'History', icon: History },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            ref={(el) => {
              tabRefs.current[id] = el;
            }}
            type="button"
            role="tab"
            id={`backup-tab-${id.toLowerCase()}`}
            aria-selected={activeTab === id}
            aria-controls={`backup-panel-${id.toLowerCase()}`}
            tabIndex={activeTab === id ? 0 : -1}
            onClick={() => {
              setActiveTab(id);
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            onKeyDown={(e) => handleTabKeyDown(e, id)}
            className={tabButtonClass(activeTab === id)}
          >
            <Icon className="w-4 h-4" aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Modal Body */}
      <div className="space-y-4">
        {errorMessage && (
          <div
            role="alert"
            className="p-3 bg-danger-soft border border-danger rounded-xl text-sm text-danger-text flex items-start gap-2 animate-in fade-in"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span className="whitespace-pre-wrap">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="p-3 bg-success-soft border border-success rounded-xl text-sm text-success-text flex items-start gap-2 animate-in fade-in"
          >
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* TAB 1: EXPORT BACKUP */}
        {activeTab === 'EXPORT' && (
          <div
            role="tabpanel"
            id="backup-panel-export"
            aria-labelledby="backup-tab-export"
            className="space-y-4"
          >
            <div className="p-3.5 bg-inset rounded-2xl border border-line space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-ink">Current Local Database State</span>
                <span className="text-xs text-soft font-semibold">
                  {dbSummary?.totalRecords || 0} Total Records
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                {[
                  { label: 'Leads', value: dbSummary?.leadsCount },
                  { label: 'Calls', value: dbSummary?.callsCount },
                  { label: 'Remarks', value: dbSummary?.remarksCount },
                  { label: 'Follow-ups', value: dbSummary?.followUpsCount },
                  { label: 'Messages', value: dbSummary?.messagesCount },
                  { label: 'Templates', value: dbSummary?.templatesCount },
                ].map((cell) => (
                  <div key={cell.label} className="bg-surface p-2 rounded-xl border border-line">
                    <span className="text-xs text-faint font-bold block uppercase">{cell.label}</span>
                    <span className="text-base font-black text-ink">{cell.value || 0}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 bg-info-soft border border-info rounded-xl text-sm text-info-text space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                <span>Full Offline Preservation</span>
              </div>
              <p className="text-xs leading-relaxed">
                Exporting creates a versioned JSON snapshot containing all gym leads, call records,
                sales notes, scheduled follow-ups, WhatsApp logs, and pitch templates.
              </p>
            </div>

            <button
              type="button"
              onClick={handleExportBackup}
              disabled={isProcessing || loadingSummary}
              className="min-h-11 w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-accent hover:bg-accent-hover active:scale-[0.99] text-on-accent shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="w-4 h-4" aria-hidden="true" />
              )}
              <span>Download CRM Backup File (.json)</span>
            </button>
          </div>
        )}

        {/* TAB 2: RESTORE BACKUP */}
        {activeTab === 'RESTORE' && (
          <div
            role="tabpanel"
            id="backup-panel-restore"
            aria-labelledby="backup-tab-restore"
            className="space-y-4"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelect}
              className="hidden"
              tabIndex={-1}
              aria-hidden="true"
            />

            {!uploadedFileName ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-11 w-full py-8 border-2 border-dashed border-line-strong hover:border-accent rounded-2xl bg-inset hover:bg-accent-soft text-center space-y-2 transition-colors cursor-pointer"
              >
                <Upload className="w-8 h-8 text-faint mx-auto" aria-hidden="true" />
                <span className="text-sm font-bold text-ink block">
                  Select CRM Backup JSON File
                </span>
                <span className="text-xs text-soft block">
                  Supports amaratv-crm-backup-*.json files
                </span>
              </button>
            ) : (
              <div className="space-y-4">
                {/* File card */}
                <div className="bg-inset border border-line rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-5 h-5 text-accent-text flex-shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink truncate">{uploadedFileName}</p>
                      <p className="text-xs text-faint">
                        {validationResult?.summary.totalRecords || 0} Records in backup payload
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setUploadedFileName(null);
                      setValidationResult(null);
                      setMergeResult(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="min-h-11 px-2 text-sm text-faint hover:text-danger-text"
                  >
                    Change
                  </button>
                </div>

                {/* Comparison Summary Table */}
                {validationResult?.isValid && (
                  <div className="border border-line rounded-2xl overflow-hidden text-sm">
                    <div className="bg-inset p-2.5 font-bold text-soft grid grid-cols-3 text-center">
                      <span className="text-left px-2">Table Entity</span>
                      <span>Current DB</span>
                      <span className="text-accent-text">Backup File</span>
                    </div>

                    <div className="divide-y divide-line p-2 space-y-1">
                      {[
                        { name: 'Leads', current: dbSummary?.leadsCount, backup: validationResult.summary.leadsCount },
                        { name: 'Call History', current: dbSummary?.callsCount, backup: validationResult.summary.callsCount },
                        { name: 'Remarks', current: dbSummary?.remarksCount, backup: validationResult.summary.remarksCount },
                        { name: 'Follow-ups', current: dbSummary?.followUpsCount, backup: validationResult.summary.followUpsCount },
                        { name: 'Messages', current: dbSummary?.messagesCount, backup: validationResult.summary.messagesCount },
                        { name: 'Templates', current: dbSummary?.templatesCount, backup: validationResult.summary.templatesCount },
                      ].map((row) => (
                        <div key={row.name} className="grid grid-cols-3 text-center py-1 font-medium">
                          <span className="text-left px-2 text-soft">{row.name}</span>
                          <span className="text-ink font-bold">{row.current || 0}</span>
                          <span className="text-accent-text font-bold">{row.backup || 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Merge or Replace Buttons */}
                {validationResult?.isValid && (
                  <div className="space-y-2 pt-2">
                    <button
                      type="button"
                      onClick={handleMergeRestore}
                      disabled={isProcessing}
                      className="min-h-11 w-full py-3 px-4 rounded-xl font-bold text-sm bg-accent hover:bg-accent-hover text-on-accent shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <RefreshCw className="w-4 h-4" aria-hidden="true" />
                      )}
                      <span>Merge Backup (Safe / Recommended)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowReplaceConfirm(true)}
                      disabled={isProcessing}
                      className="min-h-11 w-full py-2.5 px-4 rounded-xl font-semibold text-sm text-danger-text hover:bg-danger-soft border border-danger transition-colors flex items-center justify-center gap-1.5"
                    >
                      <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                      <span>Replace Database (Destructive)</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 2-Step Replace Confirmation */}
            {showReplaceConfirm && (
              <div className="p-4 bg-danger-soft border-2 border-danger rounded-2xl space-y-3 animate-in fade-in">
                <div className="flex items-center gap-2 text-danger-text font-bold text-sm">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                  <span>Warning: Destructive Replace Operation</span>
                </div>

                <p className="text-sm text-danger-text leading-relaxed">
                  This will replace the current local database with the selected backup file. A
                  temporary safety snapshot will be held in memory during the transaction.
                </p>

                <div className="space-y-1">
                  <label htmlFor="replace-confirm-input" className="text-xs font-bold text-danger-text uppercase">
                    Type "REPLACE" to confirm:
                  </label>
                  <input
                    id="replace-confirm-input"
                    data-autofocus
                    type="text"
                    placeholder="REPLACE"
                    value={confirmInputText}
                    onChange={(e) => setConfirmInputText(e.target.value)}
                    className="w-full text-sm bg-surface border border-danger rounded-xl p-2 font-bold text-danger-text uppercase focus:ring-2 focus:ring-focus-ring"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowReplaceConfirm(false)}
                    className="min-h-11 flex-1 py-2 text-sm font-semibold text-ink bg-surface border border-line rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleReplaceRestore}
                    disabled={confirmInputText.trim().toUpperCase() !== 'REPLACE' || isProcessing}
                    className="min-h-11 flex-1 py-2 text-sm font-bold text-white bg-danger hover:opacity-90 rounded-xl disabled:opacity-50"
                  >
                    Confirm Replace
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: BACKUP HISTORY */}
        {activeTab === 'HISTORY' && (
          <div
            role="tabpanel"
            id="backup-panel-history"
            aria-labelledby="backup-tab-history"
            className="space-y-2.5"
          >
            {auditLogs.length === 0 ? (
              <div className="text-center py-8 text-sm text-faint">
                No backup or restore operations logged yet.
              </div>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 bg-inset rounded-xl border border-line space-y-1 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                        log.status === 'SUCCESS'
                          ? 'bg-success-soft text-success-text border-success'
                          : 'bg-danger-soft text-danger-text border-danger'
                      }`}
                    >
                      {labelFor(log.operation)} • {labelFor(log.status)}
                    </span>
                    <span className="text-xs text-faint font-mono">
                      {formatLogDate(log.timestamp)}
                    </span>
                  </div>
                  <p className="text-soft font-medium">{log.summaryText}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
