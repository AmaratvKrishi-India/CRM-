import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Layers,
  Search,
  ArrowLeft,
  Sparkles,
  AlertCircle,
  Loader2,
  Check,
} from 'lucide-react';
import { db } from '../../db/database';
import type {
  ParseResult,
  ColumnMapping,
  RecordValidationStatus,
  ImportExecutionSummary,
  SpreadsheetWorkbook,
} from '../../services/excelParser';
import {
  ExcelParserService,
  IMPORT_LIMITS,
} from '../../services/excelParser';
import { BUNDLED_LUCKNOW_DATASET } from '../../services/sampleData';
import { ImportStatsCard } from './ImportStatsCard';
import { ColumnMappingSelector } from './ColumnMappingSelector';
import { ImportPreviewList } from './ImportPreviewList';
import { DuplicateConfirmModal } from './DuplicateConfirmModal';
import { ImportSummaryCard } from './ImportSummaryCard';
import { SyncStatusBadge } from '../sync/SyncStatusBadge';

interface ExcelImporterProps {
  onImportComplete?: () => void;
  onCancel?: () => void;
  currentUserId?: string | null;
}

type ImportStep = 'UPLOAD' | 'PREVIEW' | 'IMPORTING' | 'SUMMARY';

export const ExcelImporter: React.FC<ExcelImporterProps> = ({
  onImportComplete,
  onCancel,
  currentUserId = null,
}) => {
  const [step, setStep] = useState<ImportStep>('UPLOAD');
  const [loadingFile, setLoadingFile] = useState(false);
  const [activeWorkbook, setActiveWorkbook] = useState<SpreadsheetWorkbook | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | RecordValidationStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, percent: 0 });
  const [finalSummary, setFinalSummary] = useState<ImportExecutionSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  /**
   * Processes a raw ArrayBuffer file into an active workbook and parses default sheet.
   */
  const processWorkbook = async (workbook: SpreadsheetWorkbook, name: string) => {
    setLoadingFile(true);
    setErrorMessage(null);
    try {
      if (workbook.sheets.length === 0) {
        throw new Error('The selected workbook contains no sheets.');
      }

      const defaultSheet = workbook.sheets.some((sheet) => sheet.name === 'Data') ? 'Data' : workbook.sheets[0].name;
      setActiveWorkbook(workbook);
      setFileName(name);
      setSelectedSheet(defaultSheet);

      const result = await ExcelParserService.parseSheet(workbook, defaultSheet, db, undefined, name);
      setParseResult(result);
      setStep('PREVIEW');
    } catch (err: unknown) {
      console.error('Failed to parse workbook:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to read the spreadsheet safely.');
    } finally {
      setLoadingFile(false);
    }
  };

  const processWorkbookBuffer = async (buffer: ArrayBuffer, name: string) => {
    const workbook = await ExcelParserService.readWorkbook(buffer, name);
    await processWorkbook(workbook, name);
  };

  /**
   * Handles native file selection from Android/Desktop storage.
   */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > IMPORT_LIMITS.maxFileSizeBytes) {
      setErrorMessage(`The file exceeds the ${IMPORT_LIMITS.maxFileSizeBytes / 1024 / 1024} MB upload limit.`);
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      await processWorkbookBuffer(buffer, file.name);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to read the spreadsheet safely.');
    }
  };

  /**
   * Quick-loads the bundled Lucknow Gyms dataset for instant testing.
   */
  const handleLoadSampleDataset = async () => {
    setLoadingFile(true);
    try {
      const workbook = ExcelParserService.createWorkbookFromRows(BUNDLED_LUCKNOW_DATASET, 'Data');
      await processWorkbook(workbook, 'Lucknow_Gyms_Crawler_Dataset.xlsx');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load sample dataset.');
    } finally {
      setLoadingFile(false);
    }
  };

  /**
   * Handles switching sheets in a multi-sheet workbook.
   */
  const handleSheetChange = async (sheetName: string) => {
    if (!activeWorkbook) return;
    setSelectedSheet(sheetName);
    setLoadingFile(true);
    try {
      const result = await ExcelParserService.parseSheet(activeWorkbook, sheetName, db, undefined, fileName);
      setParseResult(result);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to parse sheet safely.');
    } finally {
      setLoadingFile(false);
    }
  };

  /**
   * Handles column re-mapping changes.
   */
  const handleMappingChange = async (updatedMapping: ColumnMapping) => {
    if (!activeWorkbook || !selectedSheet) return;
    try {
      const result = await ExcelParserService.parseSheet(
        activeWorkbook,
        selectedSheet,
        db,
        updatedMapping,
        fileName
      );
      setParseResult(result);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update mapping safely.');
    }
  };

  /**
   * Executes the actual import process.
   */
  const executeImport = async (allowOverwriteDuplicates = false) => {
    if (!parseResult) return;
    setShowDuplicateModal(false);
    setStep('IMPORTING');
    setImportProgress({ current: 0, total: parseResult.records.length, percent: 0 });

    try {
      const summary = await ExcelParserService.importRecords({
        db,
        records: parseResult.records,
        sourceFile: fileName,
        allowOverwriteDuplicates,
        userId: currentUserId,
        onProgress: (p) => setImportProgress(p),
      });

      setFinalSummary(summary);
      setStep('SUMMARY');
    } catch (err: unknown) {
      console.error('Import failed:', err);
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred while importing leads.');
      setStep('PREVIEW');
    }
  };

  const handleStartImportClick = () => {
    if (!parseResult) return;

    // If there are valid records, import valid records directly
    if (parseResult.summary.valid > 0) {
      executeImport(false);
    } else if (parseResult.summary.duplicates > 0) {
      // If 0 valid and only duplicates exist, prompt user with options
      setShowDuplicateModal(true);
    }
  };

  const handleReset = () => {
    setStep('UPLOAD');
    setActiveWorkbook(null);
    setFileName('');
    setParseResult(null);
    setFinalSummary(null);
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-app text-ink">
      {/* Header Bar */}
      <div className="bg-surface border-b border-line px-4 py-3 shrink-0">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {step === 'PREVIEW' && (
              <button
                type="button"
                onClick={handleReset}
                aria-label="Back to file upload"
                className="min-w-11 min-h-11 -ml-2 text-soft hover:text-ink rounded-xl hover:bg-inset transition-colors flex items-center justify-center"
              >
                <ArrowLeft className="w-5 h-5" aria-hidden="true" />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="text-base font-bold flex items-center gap-1.5 truncate">
                <FileSpreadsheet className="w-5 h-5 text-accent-text shrink-0" aria-hidden="true" />
                <span className="truncate">Excel Lead Importer</span>
              </h1>
              <p className="text-xs text-faint truncate">
                Amaratv Krishi • Lucknow Field Sales Seed Ingestion
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* F18 — sync state visible on this data-entry surface */}
            <SyncStatusBadge />
            {onCancel && step !== 'IMPORTING' && (
              <button
                type="button"
                onClick={onCancel}
                className="min-h-11 text-sm font-semibold text-soft hover:text-ink px-3 rounded-xl hover:bg-inset transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Body (scroll container; action bar sticks to its bottom) */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl w-full mx-auto p-4 flex flex-col min-h-full">
          {/* Error Alert */}
          {errorMessage && (
            <div
              role="alert"
              className="mb-4 p-3 bg-danger-soft border border-danger rounded-xl text-sm text-danger-text flex items-start gap-2 animate-in fade-in"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1">
                <strong>Error:</strong> {errorMessage}
              </div>
            </div>
          )}

          {/* STEP 1: UPLOAD SCREEN */}
          {step === 'UPLOAD' && (
            <div className="space-y-4 my-auto py-6">
              {/* File Dropzone — F3/F16: keyboard-accessible region and a real
                  browse button with its own click handler. */}
              <div
                role="button"
                tabIndex={0}
                aria-label="Select an Excel lead sheet file"
                onClick={openFilePicker}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openFilePicker();
                  }
                }}
                className="border-2 border-dashed border-accent bg-surface hover:bg-accent-soft rounded-2xl p-8 text-center cursor-pointer transition-all shadow-xs group focus:outline-none focus:ring-2 focus:ring-focus-ring"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                   accept=".xlsx,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                  tabIndex={-1}
                  aria-hidden="true"
                />
                <div className="w-14 h-14 bg-accent-soft text-accent-text rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
                  {loadingFile ? (
                    <Loader2 className="w-7 h-7 animate-spin" aria-hidden="true" />
                  ) : (
                    <UploadCloud className="w-7 h-7" aria-hidden="true" />
                  )}
                </div>
                <h3 className="text-base font-bold mb-1">Select Excel Lead Sheet</h3>
                <p className="text-sm text-soft mb-4 max-w-xs mx-auto">
                   Tap to choose a <code>.xlsx</code> or <code>.csv</code> file from your device storage.
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openFilePicker();
                  }}
                  className="min-h-11 inline-flex items-center gap-1.5 px-4 bg-accent text-on-accent rounded-xl text-sm font-semibold shadow-sm hover:bg-accent-hover transition-colors"
                >
                  <span>Browse Files</span>
                </button>
              </div>

              {/* Quick Sample Dataset Button */}
              <div className="bg-inset text-ink rounded-2xl p-4 shadow-sm relative overflow-hidden border border-line">
                <div className="relative z-10 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-accent-text mb-1">
                      <Sparkles className="w-4 h-4" aria-hidden="true" />
                      <span>Quick Test with Lucknow Dataset</span>
                    </div>
                    <h4 className="text-sm font-bold mb-1">Load Lucknow Gyms & Wellness Sheet</h4>
                    <p className="text-xs text-soft leading-relaxed max-w-sm">
                      141 verified fitness centres in Lucknow (LDA Colony, Hazratganj, Alambagh, Charbagh).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLoadSampleDataset}
                    disabled={loadingFile}
                    className="min-h-11 bg-accent hover:bg-accent-hover text-on-accent px-4 rounded-xl font-bold text-sm shrink-0 self-center transition-all active:scale-95 disabled:opacity-50"
                  >
                    {loadingFile ? 'Loading...' : 'Load 141 Leads'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW & VALIDATION SCREEN */}
          {step === 'PREVIEW' && parseResult && (
            <div className="space-y-3 flex-1 flex flex-col">
              {/* Sheet Selector (if multi-sheet) */}
              {parseResult.sheetNames.length > 1 && (
                <div className="flex items-center gap-2 bg-surface p-2.5 rounded-xl border border-line text-sm">
                  <Layers className="w-4 h-4 text-faint shrink-0" aria-hidden="true" />
                  <label htmlFor="import-sheet-select" className="font-semibold text-soft shrink-0">
                    Select Sheet:
                  </label>
                  <select
                    id="import-sheet-select"
                    value={selectedSheet}
                    onChange={(e) => handleSheetChange(e.target.value)}
                    className="min-h-11 bg-inset rounded-xl px-3 text-sm font-medium text-ink border border-line focus:outline-none focus:ring-2 focus:ring-focus-ring"
                  >
                    {parseResult.sheetNames.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Column Mapping Selector */}
              <ColumnMappingSelector
                availableColumns={parseResult.availableColumns}
                mapping={parseResult.detectedMapping}
                onChangeMapping={handleMappingChange}
              />

              {/* Stats Chips (Total, Valid, Dups, Invalid) */}
              <ImportStatsCard
                total={parseResult.summary.total}
                valid={parseResult.summary.valid}
                duplicates={parseResult.summary.duplicates}
                invalid={parseResult.summary.invalid}
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
              />

              {/* Search Box */}
              <div className="relative my-1">
                <label htmlFor="import-preview-search" className="sr-only">
                  Search preview records
                </label>
                <Search
                  className="w-4 h-4 text-faint absolute left-3 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  id="import-preview-search"
                  type="text"
                  placeholder="Search preview by gym name, phone, or locality..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="min-h-11 w-full text-sm bg-surface border border-line rounded-xl pl-9 pr-3 text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-focus-ring font-medium"
                />
              </div>

              {/* Records List */}
              <div className="flex-1">
                <ImportPreviewList
                  records={parseResult.records}
                  filter={activeFilter}
                  searchQuery={searchQuery}
                />
              </div>

              {/* Sticky Bottom One-Hand Action Bar */}
              <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-surface/95 backdrop-blur-md border-t border-line z-30">
                <div className="max-w-2xl mx-auto flex items-center gap-2">
                  {parseResult.summary.duplicates > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowDuplicateModal(true)}
                      className="min-h-11 py-2 px-3 rounded-xl border border-warning bg-warning-soft text-warning-text font-semibold text-sm hover:bg-warning-soft transition-colors shrink-0"
                    >
                      Resolve Dups ({parseResult.summary.duplicates})
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleStartImportClick}
                    disabled={parseResult.summary.valid === 0 && parseResult.summary.duplicates === 0}
                    className="min-h-11 flex-1 py-2 px-4 bg-accent hover:bg-accent-hover disabled:bg-inset-strong disabled:text-faint text-on-accent font-bold text-sm rounded-xl shadow-md active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" aria-hidden="true" />
                    <span>
                      {parseResult.summary.valid > 0
                        ? `Import ${parseResult.summary.valid} Valid Leads`
                        : `Resolve & Import Duplicates`}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: IMPORTING PROGRESS SCREEN */}
          {step === 'IMPORTING' && (
            <div className="my-auto py-12 text-center max-w-sm mx-auto space-y-4">
              <div className="w-16 h-16 bg-accent-soft text-accent-text rounded-full flex items-center justify-center mx-auto animate-pulse">
                <Loader2 className="w-8 h-8 animate-spin" aria-hidden="true" />
              </div>

              <h3 className="text-lg font-bold">Importing Leads into CRM...</h3>
              <p className="text-sm text-soft">
                Normalizing numbers, indexing localities, and storing offline in IndexedDB.
              </p>

              {/* Progress Bar */}
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={importProgress.percent}
                aria-label="Import progress"
                className="w-full bg-inset rounded-full h-3 overflow-hidden"
              >
                <svg
                  aria-hidden="true"
                  className="block w-full h-full transition-all duration-150"
                  viewBox="0 0 100 1"
                  preserveAspectRatio="none"
                >
                  <rect
                    width={Math.max(0, Math.min(100, importProgress.percent))}
                    height="1"
                    rx="0.5"
                    className="fill-accent"
                  />
                </svg>
              </div>

              <div className="flex justify-between text-sm text-soft font-medium" aria-live="polite">
                <span>
                  {importProgress.current} of {importProgress.total} processed
                </span>
                <span>{importProgress.percent}%</span>
              </div>
            </div>
          )}

          {/* STEP 4: FINAL SUMMARY */}
          {step === 'SUMMARY' && finalSummary && (
            <ImportSummaryCard
              summary={finalSummary}
              fileName={fileName}
              onViewLeads={() => {
                if (onImportComplete) onImportComplete();
              }}
              onReset={handleReset}
            />
          )}
        </div>
      </div>

      {/* Duplicate Resolution Confirmation Modal */}
      <DuplicateConfirmModal
        isOpen={showDuplicateModal}
        duplicateCount={parseResult?.summary.duplicates || 0}
        onConfirmSkip={() => executeImport(false)}
        onConfirmOverwrite={() => executeImport(true)}
        onClose={() => setShowDuplicateModal(false)}
      />
    </div>
  );
};
