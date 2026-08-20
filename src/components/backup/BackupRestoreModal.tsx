import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  Upload,
  History,
  X,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  FileText,
  Database,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { crmData } from '../../db';
import {
  BackupService,
  CRMBackupPayload,
  BackupValidationResult,
  MergeRestoreResult,
  BackupAuditLog,
} from '../../services/backupService';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDatabaseChanged: () => void;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  onDatabaseChanged,
}) => {
  const [activeTab, setActiveTab] = useState<'EXPORT' | 'RESTORE' | 'HISTORY'>('EXPORT');
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
  const [mergeResult, setMergeResult] = useState<MergeRestoreResult | null>(null);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [confirmInputText, setConfirmInputText] = useState('');

  // History State
  const [auditLogs, setAuditLogs] = useState<BackupAuditLog[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSummaryAndHistory = async () => {
    setLoadingSummary(true);
    try {
      const summary = await crmData.backup.getDatabaseSummary();
      setDbSummary(summary);
      const logs = crmData.backup.getAuditLogs();
      setAuditLogs(logs);
    } catch (err) {
      console.error('Failed to fetch DB summary:', err);
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
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExportBackup = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const payload = await crmData.backup.generateBackupPayload();
      const filename = BackupService.generateBackupFilename();
      const jsonStr = JSON.stringify(payload, null, 2);

      BackupService.downloadJsonFile(filename, jsonStr);

      setSuccessMessage(`Backup saved successfully as "${filename}" (${(jsonStr.length / 1024).toFixed(1)} KB).`);
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm truncate">CRM Backup & Restore</h3>
              <p className="text-[11px] text-slate-400">Offline JSON Database Management</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2">
          {[
            { id: 'EXPORT', label: 'Export Backup', icon: Download },
            { id: 'RESTORE', label: 'Restore Backup', icon: Upload },
            { id: 'HISTORY', label: 'History', icon: History },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setActiveTab(id as any);
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`py-2 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
                activeTab === id
                  ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-xl'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span className="whitespace-pre-wrap">{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* TAB 1: EXPORT BACKUP */}
          {activeTab === 'EXPORT' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">
                    Current Local Database State
                  </span>
                  <span className="text-[11px] text-slate-500 font-semibold">
                    {dbSummary?.totalRecords || 0} Total Records
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Leads</span>
                    <span className="text-sm font-black text-slate-900">{dbSummary?.leadsCount || 0}</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Calls</span>
                    <span className="text-sm font-black text-slate-900">{dbSummary?.callsCount || 0}</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Remarks</span>
                    <span className="text-sm font-black text-slate-900">{dbSummary?.remarksCount || 0}</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Follow-ups</span>
                    <span className="text-sm font-black text-slate-900">{dbSummary?.followUpsCount || 0}</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Messages</span>
                    <span className="text-sm font-black text-slate-900">{dbSummary?.messagesCount || 0}</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Templates</span>
                    <span className="text-sm font-black text-slate-900">{dbSummary?.templatesCount || 0}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Full Offline Preservation</span>
                </div>
                <p className="text-[11px] text-blue-700 leading-relaxed">
                  Exporting creates a versioned JSON snapshot containing all gym leads, call records, sales notes, scheduled follow-ups, WhatsApp logs, and pitch templates.
                </p>
              </div>

              <button
                type="button"
                onClick={handleExportBackup}
                disabled={isProcessing || loadingSummary}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>Download CRM Backup File (.json)</span>
              </button>
            </div>
          )}

          {/* TAB 2: RESTORE BACKUP */}
          {activeTab === 'RESTORE' && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileSelect}
                className="hidden"
              />

              {!uploadedFileName ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-8 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl bg-slate-50 hover:bg-emerald-50/30 text-center space-y-2 transition-colors cursor-pointer"
                >
                  <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                  <span className="text-xs font-bold text-slate-800 block">
                    Select CRM Backup JSON File
                  </span>
                  <span className="text-[11px] text-slate-400 block">
                    Supports amaratv-crm-backup-*.json files
                  </span>
                </button>
              ) : (
                <div className="space-y-4">
                  {/* File card */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{uploadedFileName}</p>
                        <p className="text-[10px] text-slate-400">
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
                      className="text-xs text-slate-400 hover:text-rose-600 px-2 py-1"
                    >
                      Change
                    </button>
                  </div>

                  {/* Comparison Summary Table */}
                  {validationResult?.isValid && (
                    <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
                      <div className="bg-slate-100 p-2.5 font-bold text-slate-700 grid grid-cols-3 text-center">
                        <span className="text-left px-2">Table Entity</span>
                        <span>Current DB</span>
                        <span className="text-emerald-700">Backup File</span>
                      </div>

                      <div className="divide-y divide-slate-100 p-2 space-y-1">
                        {[
                          { name: 'Leads', current: dbSummary?.leadsCount, backup: validationResult.summary.leadsCount },
                          { name: 'Call History', current: dbSummary?.callsCount, backup: validationResult.summary.callsCount },
                          { name: 'Remarks', current: dbSummary?.remarksCount, backup: validationResult.summary.remarksCount },
                          { name: 'Follow-ups', current: dbSummary?.followUpsCount, backup: validationResult.summary.followUpsCount },
                          { name: 'Messages', current: dbSummary?.messagesCount, backup: validationResult.summary.messagesCount },
                          { name: 'Templates', current: dbSummary?.templatesCount, backup: validationResult.summary.templatesCount },
                        ].map((row) => (
                          <div key={row.name} className="grid grid-cols-3 text-center py-1 font-medium">
                            <span className="text-left px-2 text-slate-600">{row.name}</span>
                            <span className="text-slate-800 font-bold">{row.current || 0}</span>
                            <span className="text-emerald-700 font-bold">{row.backup || 0}</span>
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
                        className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                        <span>MERGE BACKUP (Safe / Recommended)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowReplaceConfirm(true)}
                        disabled={isProcessing}
                        className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-rose-700 hover:bg-rose-50 border border-rose-200 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        <span>REPLACE DATABASE (Destructive)</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 2-Step Replace Confirmation Modal */}
              {showReplaceConfirm && (
                <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl space-y-3 animate-in fade-in">
                  <div className="flex items-center gap-2 text-rose-900 font-bold text-xs">
                    <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                    <span>Warning: Destructive Replace Operation</span>
                  </div>

                  <p className="text-xs text-rose-800 leading-relaxed">
                    This will replace the current local database with the selected backup file. A temporary safety snapshot will be held in memory during the transaction.
                  </p>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-rose-900 uppercase">
                      Type "REPLACE" to confirm:
                    </label>
                    <input
                      type="text"
                      placeholder="REPLACE"
                      value={confirmInputText}
                      onChange={(e) => setConfirmInputText(e.target.value)}
                      className="w-full text-xs bg-white border border-rose-300 rounded-xl p-2 font-bold text-rose-900 uppercase focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowReplaceConfirm(false)}
                      className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleReplaceRestore}
                      disabled={confirmInputText.trim().toUpperCase() !== 'REPLACE' || isProcessing}
                      className="flex-1 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl disabled:opacity-50"
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
            <div className="space-y-2.5">
              {auditLogs.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No backup or restore operations logged yet.
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          log.status === 'SUCCESS'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {log.operation} • {log.status}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {formatLogDate(log.timestamp)}
                      </span>
                    </div>
                    <p className="text-slate-700 font-medium">{log.summaryText}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
