import React from 'react';
import { CheckCircle2, ArrowRight, RefreshCw, FileSpreadsheet, AlertCircle } from 'lucide-react';
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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-md mx-auto my-6 text-center animate-in zoom-in-95 duration-200">
      {/* Icon */}
      <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ring-emerald-50">
        <CheckCircle2 className="w-8 h-8" />
      </div>

      <h3 className="text-xl font-bold text-slate-900 mb-1">Import Completed!</h3>
      <p className="text-xs text-slate-500 mb-6 flex items-center justify-center gap-1">
        <FileSpreadsheet className="w-3.5 h-3.5" />
        <span className="truncate max-w-[200px]">{fileName}</span>
        <span>•</span>
        <span>{summary.durationMs}ms</span>
      </p>

      {/* Breakdown Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
          <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-tight block mb-0.5">
            Imported New
          </span>
          <span className="text-2xl font-black text-emerald-700">{summary.imported.toLocaleString()}</span>
        </div>

        {summary.updated > 0 ? (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
            <span className="text-[11px] font-semibold text-blue-800 uppercase tracking-tight block mb-0.5">
              Updated Existing
            </span>
            <span className="text-2xl font-black text-blue-700">{summary.updated.toLocaleString()}</span>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
            <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-tight block mb-0.5">
              Duplicates Skipped
            </span>
            <span className="text-2xl font-black text-amber-700">{summary.skippedDuplicates.toLocaleString()}</span>
          </div>
        )}

        <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-center">
          <span className="text-[11px] font-semibold text-rose-800 uppercase tracking-tight block mb-0.5">
            Invalid Skipped
          </span>
          <span className="text-2xl font-black text-rose-700">{summary.skippedInvalid.toLocaleString()}</span>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
          <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-tight block mb-0.5">
            Total Processed
          </span>
          <span className="text-2xl font-black text-slate-800">{summary.totalProcessed.toLocaleString()}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={onViewLeads}
          className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
        >
          <span>View Leads in CRM</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onReset}
          className="w-full py-2.5 px-4 rounded-xl font-medium text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center justify-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Import Another Spreadsheet</span>
        </button>
      </div>
    </div>
  );
};
