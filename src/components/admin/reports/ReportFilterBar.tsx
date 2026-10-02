/**
 * Report Filter Bar Component (Phase 2M)
 * Provides preset date range selection, representative selector, locality filter,
 * and quick CSV Export button.
 * Rewritten for design tokens + labeled selects (F1/F2).
 */

import React from 'react';
import { Filter, Download } from 'lucide-react';
import type { ReportDatePreset, ReportFilterOptions } from '../../../services/adminReportsService';
import type { User } from '../../../db/types';
import { AppSelect } from '../../common/AppSelect';

interface ReportFilterBarProps {
  filters: ReportFilterOptions;
  agents: User[];
  localities: string[];
  onFilterChange: (newFilters: Partial<ReportFilterOptions>) => void;
  onExportCSV: () => void;
  exportLoading?: boolean;
}

export const ReportFilterBar: React.FC<ReportFilterBarProps> = ({
  filters,
  agents,
  localities,
  onFilterChange,
  onExportCSV,
  exportLoading = false,
}) => {
  return (
    <div className="p-3.5 bg-surface border border-line rounded-2xl shadow-md space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-soft font-bold uppercase tracking-wider text-xs">
          <Filter className="w-4 h-4 text-accent-text" aria-hidden="true" />
          <span>Report Scope Filters</span>
        </div>

        <button
          type="button"
          onClick={onExportCSV}
          disabled={exportLoading}
          className="min-h-11 py-1.5 px-3 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-50 text-on-accent font-bold text-sm flex items-center gap-1.5 shadow-md transition active:scale-[0.98]"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          <span>{exportLoading ? 'Exporting...' : 'Export CSV'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AppSelect
          id="report-filter-date"
          ariaLabel="Date range"
          label="Date range"
          value={filters.datePreset || 'ALL_TIME'}
          onChange={(value) => onFilterChange({ datePreset: value as ReportDatePreset })}
          options={[
            { value: 'ALL_TIME', label: 'All Time' },
            { value: 'TODAY', label: 'Today' },
            { value: 'YESTERDAY', label: 'Yesterday' },
            { value: 'LAST_7_DAYS', label: 'Last 7 Days' },
            { value: 'LAST_30_DAYS', label: 'Last 30 Days' },
            { value: 'THIS_MONTH', label: 'This Month' },
            { value: 'PREV_MONTH', label: 'Previous Month' },
          ]}
        />

        <AppSelect
          id="report-filter-agent"
          ariaLabel="Representative"
          label="Representative"
          value={filters.agentId || 'ALL'}
          onChange={(value) => onFilterChange({ agentId: value })}
          options={[
            { value: 'ALL', label: 'All Team' },
            { value: 'UNASSIGNED', label: 'Unassigned Leads' },
            ...agents.map((agent) => ({ value: agent.id, label: agent.name })),
          ]}
        />

        <AppSelect
          id="report-filter-locality"
          ariaLabel="Locality"
          label="Locality"
          value={filters.locality || 'ALL'}
          onChange={(value) => onFilterChange({ locality: value })}
          options={[
            { value: 'ALL', label: 'All Areas' },
            ...localities.map((locality) => ({ value: locality, label: locality })),
          ]}
        />
      </div>
    </div>
  );
};
