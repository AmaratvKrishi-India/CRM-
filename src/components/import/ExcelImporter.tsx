import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
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
import {
  ExcelParserService,
  ParseResult,
  ColumnMapping,
  RecordValidationStatus,
  ImportExecutionSummary,
} from '../../services/excelParser';
import { BUNDLED_LUCKNOW_DATASET } from '../../services/sampleData';
import { ImportStatsCard } from './ImportStatsCard';
import { ColumnMappingSelector } from './ColumnMappingSelector';
import { ImportPreviewList } from './ImportPreviewList';
import { DuplicateConfirmModal } from './DuplicateConfirmModal';
import { ImportSummaryCard } from './ImportSummaryCard';

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
  const [activeWorkbook, setActiveWorkbook] = useState<XLSX.WorkBook | null>(null);
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

  /**
   * Processes a raw ArrayBuffer file into an active workbook and parses default sheet.
   */
  const processWorkbookBuffer = async (buffer: ArrayBuffer, name: string) => {
    setLoadingFile(true);
    setErrorMessage(null);
    try {
      const wb = ExcelParserService.readWorkbook(buffer);
      if (wb.SheetNames.length === 0) {
        throw new Error('The selected workbook contains no sheets.');
      }

      const defaultSheet = wb.SheetNames.includes('Data') ? 'Data' : wb.SheetNames[0];
      setActiveWorkbook(wb);
      setFileName(name);
      setSelectedSheet(defaultSheet);

      const result = await ExcelParserService.parseSheet(wb, defaultSheet, db, undefined, name);
      setParseResult(result);
      setStep('PREVIEW');
    } catch (err: any) {
      console.error('Failed to parse workbook:', err);
      setErrorMessage(err.message || 'Failed to read Excel file. Please ensure it is a valid .xlsx or .xls file.');
    } finally {
      setLoadingFile(false);
    }
  };

  /**
   * Handles native file selection from Android/Desktop storage.
   */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const buffer = await file.arrayBuffer();
    await processWorkbookBuffer(buffer, file.name);
  };

  /**
   * Quick-loads the bundled Lucknow Gyms dataset for instant testing.
   */
  const handleLoadSampleDataset = async () => {
    setLoadingFile(true);
    try {
      const ws = XLSX.utils.json_to_sheet(BUNDLED_LUCKNOW_DATASET);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data');
      const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      await processWorkbookBuffer(wbOut, 'Lucknow_Gyms_Crawler_Dataset.xlsx');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load sample dataset.');
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
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to parse sheet.');
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
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update mapping.');
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
    } catch (err: any) {
      console.error('Import failed:', err);
      setErrorMessage(err.message || 'An error occurred while importing leads.');
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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header Bar */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 shadow-xs">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            {step === 'PREVIEW' && (
              <button
                type="button"
                onClick={handleReset}
                className="p-1.5 -ml-1 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
                title="Back to file upload"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h1 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <span>Excel Lead Importer</span>
              </h1>
              <p className="text-[11px] text-slate-500">
                Amaratv Krishi • Lucknow Field Sales Seed Ingestion
              </p>
            </div>
          </div>

          {onCancel && step !== 'IMPORTING' && (
            <button
              type="button"
              onClick={onCancel}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 max-w-2xl w-full mx-auto p-4 flex flex-col">
        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong>Error:</strong> {errorMessage}
            </div>
          </div>
        )}

        {/* STEP 1: UPLOAD SCREEN */}
        {step === 'UPLOAD' && (
          <div className="space-y-4 my-auto py-6">
            {/* File Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-white hover:bg-emerald-50/30 rounded-2xl p-8 text-center cursor-pointer transition-all shadow-xs group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
                {loadingFile ? (
                  <Loader2 className="w-7 h-7 animate-spin" />
                ) : (
                  <UploadCloud className="w-7 h-7" />
                )}
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-1">
                Select Excel Lead Sheet
              </h3>
              <p className="text-xs text-slate-500 mb-4 max-w-xs mx-auto">
                Tap to choose a <code>.xlsx</code> or <code>.xls</code> file from your device storage.
              </p>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow-sm group-hover:bg-emerald-700 transition-colors"
              >
                <span>Browse Files</span>
              </button>
            </div>

            {/* Quick Sample Dataset Button */}
            <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="relative z-10 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 mb-1">
                    <Sparkles className="w-4 h-4" />
                    <span>Quick Test with Lucknow Dataset</span>
                  </div>
                  <h4 className="text-sm font-bold mb-1">
                    Load Lucknow Gyms & Wellness Sheet
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed max-w-sm">
                    141 verified fitness centres in Lucknow (LDA Colony, Hazratganj, Alambagh, Charbagh).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLoadSampleDataset}
                  disabled={loadingFile}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3.5 py-2.5 rounded-xl font-bold text-xs flex-shrink-0 self-center transition-all active:scale-95 disabled:opacity-50"
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
              <div className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200 text-xs">
                <Layers className="w-4 h-4 text-slate-500" />
                <span className="font-semibold text-slate-700">Select Sheet:</span>
                <select
                  value={selectedSheet}
                  onChange={(e) => handleSheetChange(e.target.value)}
                  className="bg-slate-100 rounded-lg px-2 py-1 font-medium text-slate-800 border-none focus:ring-2 focus:ring-emerald-500"
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
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search preview by gym name, phone, or locality..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-medium"
              />
            </div>

            {/* Records List */}
            <div className="flex-1 overflow-y-auto">
              <ImportPreviewList
                records={parseResult.records}
                filter={activeFilter}
                searchQuery={searchQuery}
              />
            </div>

            {/* Sticky Bottom One-Hand Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40">
              <div className="max-w-2xl mx-auto flex items-center gap-2">
                {parseResult.summary.duplicates > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowDuplicateModal(true)}
                    className="py-3 px-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 font-semibold text-xs hover:bg-amber-100 transition-colors flex-shrink-0"
                  >
                    Resolve Dups ({parseResult.summary.duplicates})
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleStartImportClick}
                  disabled={parseResult.summary.valid === 0 && parseResult.summary.duplicates === 0}
                  className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-600/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
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

        {/* STEP 3: IMPORTING PROGRESS MODAL / SCREEN */}
        {step === 'IMPORTING' && (
          <div className="my-auto py-12 text-center max-w-sm mx-auto space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-pulse">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>

            <h3 className="text-lg font-bold text-slate-900">
              Importing Leads into CRM...
            </h3>
            <p className="text-xs text-slate-500">
              Normalizing numbers, indexing localities, and storing offline in IndexedDB.
            </p>

            {/* Progress Bar */}
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-emerald-600 h-full transition-all duration-150 rounded-full"
                style={{ width: `${importProgress.percent}%` }}
              />
            </div>

            <div className="flex justify-between text-xs text-slate-600 font-medium">
              <span>{importProgress.current} of {importProgress.total} processed</span>
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
