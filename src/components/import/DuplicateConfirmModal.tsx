import React from 'react';
import { AlertTriangle, ShieldCheck, X } from 'lucide-react';

interface DuplicateConfirmModalProps {
  isOpen: boolean;
  duplicateCount: number;
  onConfirmOverwrite: () => void;
  onConfirmSkip: () => void;
  onClose: () => void;
}

export const DuplicateConfirmModal: React.FC<DuplicateConfirmModalProps> = ({
  isOpen,
  duplicateCount,
  onConfirmOverwrite,
  onConfirmSkip,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 bg-amber-50 border-b border-amber-100 flex items-start justify-between">
          <div className="flex items-center gap-2 text-amber-800">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <h3 className="font-bold text-base">Duplicate Leads Detected</h3>
          </div>
          <button
            onClick={onClose}
            className="text-amber-700 hover:text-amber-900 p-1 rounded-lg hover:bg-amber-100/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-3">
          <p className="text-sm text-slate-700 font-medium">
            This Excel file contains <span className="font-bold text-amber-700">{duplicateCount}</span> lead(s) that already exist in your local CRM database.
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 space-y-2">
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Sales History Safe Guarantee:</strong>
                <p className="text-slate-500 mt-0.5">
                  Even if you choose to update existing records, all past call logs, remarks, follow-ups, and pipeline statuses are strictly preserved.
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            How would you like to proceed with the duplicate records?
          </p>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-2">
          <button
            type="button"
            onClick={onConfirmSkip}
            className="w-full py-3 px-4 rounded-xl font-semibold text-sm bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.99] transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <span>Skip Duplicates (Recommended)</span>
          </button>

          <button
            type="button"
            onClick={onConfirmOverwrite}
            className="w-full py-2.5 px-4 rounded-xl font-medium text-xs bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 active:scale-[0.99] transition-all"
          >
            Update Contact Info & Overwrite Details
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-center text-xs text-slate-400 hover:text-slate-600"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
