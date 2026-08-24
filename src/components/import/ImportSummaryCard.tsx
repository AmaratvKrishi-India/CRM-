import React from 'react';
import { CheckCircle2, ArrowRight, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { ImportExecutionSummary } from '../../services/excelParser';

interface ImportSummaryCardProps {
  summary: ImportExecutionSummary;
  fileName: string;
  onViewLeads: () => void;
  onReset: () => void;
}

export const ImportSummaryCard: React.FC<ImportSummaryCardProps> = ({
  summary,
  fileName,
  onViewLeads,
  onReset,
}) => {
  return (
    <div className="bg-surface rounded-2xl border border-line p-6 max-w-md mx-auto my-6 text-center animate-in zoom-in-95 duration-200">
      {/* Icon */}
      <div className="w-16 h-16 bg-success-soft text-success-text rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle2 aria-hidden="true" className="w-8 h-8" />
      </div>

      <h3 className="text-xl font-bold text-ink mb-1">Import Completed!</h3>
      <p className="text-xs text-soft mb-6 flex items-center justify-center gap-1">
        <FileSpreadsheet aria-hidden="true" className="w-3.5 h-3.5" />
        <span className="truncate max-w-[200px]">{fileName}</span>
        <span aria-hidden="true">•</span>
        <span>{summary.durationMs}ms</span>
      </p>

      {/* Breakdown Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-success-soft border border-success/30 rounded-xl p-3 text-center">
          <span className="text-xs font-semibold text-success-text uppercase tracking-tight block mb-0.5">
            Imported New
          </span>
          <span className="text-2xl font-black text-success-text">{summary.imported.toLocaleString()}</span>
        </div>

        {summary.updated > 0 ? (
          <div className="bg-info-soft border border-info/30 rounded-xl p-3 text-center">
            <span className="text-xs font-semibold text-info-text uppercase tracking-tight block mb-0.5">
              Updated Existing
            </span>
            <span className="text-2xl font-black text-info-text">{summary.updated.toLocaleString()}</span>
          </div>
        ) : (
          <div className="bg-warning-soft border border-warning/30 rounded-xl p-3 text-center">
            <span className="text-xs font-semibold text-warning-text uppercase tracking-tight block mb-0.5">
              Duplicates Skipped
            </span>
            <span className="text-2xl font-black text-warning-text">{summary.skippedDuplicates.toLocaleString()}</span>
          </div>
        )}

        <div className="bg-danger-soft border border-danger/30 rounded-xl p-3 text-center">
          <span className="text-xs font-semibold text-danger-text uppercase tracking-tight block mb-0.5">
            Invalid Skipped
          </span>
          <span className="text-2xl font-black text-danger-text">{summary.skippedInvalid.toLocaleString()}</span>
        </div>

        <div className="bg-inset border border-line rounded-xl p-3 text-center">
          <span className="text-xs font-semibold text-soft uppercase tracking-tight block mb-0.5">
            Total Processed
          </span>
          <span className="text-2xl font-black text-ink">{summary.totalProcessed.toLocaleString()}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={onViewLeads}
          className="min-h-11 w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-accent hover:bg-accent-hover text-on-accent active:scale-[0.99] transition-all flex items-center justify-center gap-2"
        >
          <span>View Leads in CRM</span>
          <ArrowRight aria-hidden="true" className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onReset}
          className="min-h-11 w-full py-2.5 px-4 rounded-xl font-medium text-sm text-soft hover:text-ink hover:bg-inset transition-colors flex items-center justify-center gap-1.5"
        >
          <RefreshCw aria-hidden="true" className="w-3.5 h-3.5" />
          <span>Import Another Spreadsheet</span>
        </button>
      </div>
    </div>
  );
};
