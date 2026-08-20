import React from 'react';
import { CheckCircle2, Copy, AlertTriangle, ListFilter } from 'lucide-react';
import { RecordValidationStatus } from '../../services/excelParser';

interface ImportStatsCardProps {
  total: number;
  valid: number;
  duplicates: number;
  invalid: number;
  activeFilter: 'ALL' | RecordValidationStatus;
  onFilterChange: (filter: 'ALL' | RecordValidationStatus) => void;
}

export const ImportStatsCard: React.FC<ImportStatsCardProps> = ({
  total,
  valid,
  duplicates,
  invalid,
  activeFilter,
  onFilterChange,
}) => {
  return (
    <div className="grid grid-cols-4 gap-2">
      {/* Total */}
      <button
        type="button"
        onClick={() => onFilterChange('ALL')}
        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
          activeFilter === 'ALL'
            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center gap-1 mb-1">
          <ListFilter className="w-3.5 h-3.5 opacity-70" />
          <span className="text-[11px] font-medium tracking-tight uppercase">Total</span>
        </div>
        <span className="text-lg font-bold leading-tight">{total}</span>
      </button>

      {/* Valid */}
      <button
        type="button"
        onClick={() => onFilterChange('VALID')}
        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
          activeFilter === 'VALID'
            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
            : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:border-emerald-300'
        }`}
      >
        <div className="flex items-center gap-1 mb-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span className="text-[11px] font-medium tracking-tight uppercase">Valid</span>
        </div>
        <span className="text-lg font-bold leading-tight">{valid}</span>
      </button>

      {/* Duplicates */}
      <button
        type="button"
        onClick={() => onFilterChange('DUPLICATE')}
        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
          activeFilter === 'DUPLICATE'
            ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
            : 'bg-amber-50 text-amber-800 border-amber-200 hover:border-amber-300'
        }`}
      >
        <div className="flex items-center gap-1 mb-1">
          <Copy className="w-3.5 h-3.5" />
          <span className="text-[11px] font-medium tracking-tight uppercase">Dups</span>
        </div>
        <span className="text-lg font-bold leading-tight">{duplicates}</span>
      </button>

      {/* Invalid */}
      <button
        type="button"
        onClick={() => onFilterChange('INVALID')}
        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
          activeFilter === 'INVALID'
            ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
            : 'bg-rose-50 text-rose-800 border-rose-200 hover:border-rose-300'
        }`}
      >
        <div className="flex items-center gap-1 mb-1">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span className="text-[11px] font-medium tracking-tight uppercase">Invalid</span>
        </div>
        <span className="text-lg font-bold leading-tight">{invalid}</span>
      </button>
    </div>
  );
};
