/**
 * Report Filter Bar Component (Phase 2M)
 * Provides preset date range selection, representative selector, locality filter,
 * and quick CSV Export button.
 * Rewritten for design tokens + labeled selects (F1/F2).
 */

import React from 'react';
import { Filter, Download } from 'lucide-react';
import { ReportDatePreset, ReportFilterOptions } from '../../../services/adminReportsService';
import { User } from '../../../db/types';

interface ReportFilterBarProps {
  filters: ReportFilterOptions;
  agents: User[];
  localities: string[];
  onFilterChange: (newFilters: Partial<ReportFilterOptions>) => void;
  onExportCSV: () => void;
  exportLoading?: boolean;
}

const selectClass =
  'w-full min-h-11 bg-inset border border-line rounded-xl px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-focus-ring';

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
          className="min-h-11 py-1.5 px-3 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-50 text-on-accent font-bold text-sm flex items-center gap-1.5 shadow-md transition active:scale-95"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          <span>{exportLoading ? 'Exporting...' : 'Export CSV'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {/* Date Preset Filter */}
        <div>
          <label htmlFor="report-filter-date" className="sr-only">
            Date range
          </label>
          <select
            id="report-filter-date"
            value={filters.datePreset || 'ALL_TIME'}
            onChange={(e) => onFilterChange({ datePreset: e.target.value as ReportDatePreset })}
            className={selectClass}
          >
            <option value="ALL_TIME">Date: All Time</option>
            <option value="TODAY">Date: Today</option>
            <option value="YESTERDAY">Date: Yesterday</option>
            <option value="LAST_7_DAYS">Date: Last 7 Days</option>
            <option value="LAST_30_DAYS">Date: Last 30 Days</option>
            <option value="THIS_MONTH">Date: This Month</option>
            <option value="PREV_MONTH">Date: Previous Month</option>
          </select>
        </div>

        {/* Representative Filter */}
        <div>
          <label htmlFor="report-filter-agent" className="sr-only">
            Representative
          </label>
          <select
            id="report-filter-agent"
            value={filters.agentId || 'ALL'}
            onChange={(e) => onFilterChange({ agentId: e.target.value })}
            className={selectClass}
          >
            <option value="ALL">Rep: All Team</option>
            <option value="UNASSIGNED">Rep: Unassigned Leads</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                Rep: {a.name}
              </option>
            ))}
          </select>
        </div>

        {/* Locality Filter */}
        <div>
          <label htmlFor="report-filter-locality" className="sr-only">
            Locality
          </label>
          <select
            id="report-filter-locality"
            value={filters.locality || 'ALL'}
            onChange={(e) => onFilterChange({ locality: e.target.value })}
            className={selectClass}
          >
            <option value="ALL">Locality: All Areas</option>
            {localities.map((loc) => (
              <option key={loc} value={loc}>
                Locality: {loc}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
