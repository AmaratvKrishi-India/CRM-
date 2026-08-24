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
    <div className="grid grid-cols-4 gap-2" role="group" aria-label="Filter preview records by validation status">
      {/* Total */}
      <button
        type="button"
        onClick={() => onFilterChange('ALL')}
        aria-pressed={activeFilter === 'ALL'}
        className={`min-h-11 flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
          activeFilter === 'ALL'
            ? 'bg-inset-strong text-ink border-line-strong shadow-sm'
            : 'bg-surface text-soft border-line hover:border-line-strong'
        }`}
      >
        <div className="flex items-center gap-1 mb-1">
          <ListFilter className="w-3.5 h-3.5 opacity-70" aria-hidden="true" />
          <span className="text-xs font-medium">Total</span>
        </div>
        <span className="text-lg font-bold leading-tight">{total}</span>
      </button>

      {/* Valid */}
      <button
        type="button"
        onClick={() => onFilterChange('VALID')}
        aria-pressed={activeFilter === 'VALID'}
        className={`min-h-11 flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
          activeFilter === 'VALID'
            ? 'bg-success text-on-accent border-success shadow-sm'
            : 'bg-success-soft text-success-text border-success'
        }`}
      >
        <div className="flex items-center gap-1 mb-1">
          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="text-xs font-medium">Valid</span>
        </div>
        <span className="text-lg font-bold leading-tight">{valid}</span>
      </button>

      {/* Duplicates */}
      <button
        type="button"
        onClick={() => onFilterChange('DUPLICATE')}
        aria-pressed={activeFilter === 'DUPLICATE'}
        className={`min-h-11 flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
          activeFilter === 'DUPLICATE'
            ? 'bg-warning text-ink border-warning shadow-sm'
            : 'bg-warning-soft text-warning-text border-warning'
        }`}
      >
        <div className="flex items-center gap-1 mb-1">
          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="text-xs font-medium">Dups</span>
        </div>
        <span className="text-lg font-bold leading-tight">{duplicates}</span>
      </button>

      {/* Invalid */}
      <button
        type="button"
        onClick={() => onFilterChange('INVALID')}
        aria-pressed={activeFilter === 'INVALID'}
        className={`min-h-11 flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
          activeFilter === 'INVALID'
            ? 'bg-danger text-on-accent border-danger shadow-sm'
            : 'bg-danger-soft text-danger-text border-danger'
        }`}
      >
        <div className="flex items-center gap-1 mb-1">
          <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="text-xs font-medium">Invalid</span>
        </div>
        <span className="text-lg font-bold leading-tight">{invalid}</span>
      </button>
    </div>
  );
};
