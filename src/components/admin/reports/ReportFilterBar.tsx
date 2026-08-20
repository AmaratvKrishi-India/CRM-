/**
 * Report Filter Bar Component (Phase 2M)
 * Provides preset date range selection, representative selector, locality filter,
 * and quick CSV Export button.
 */

import React from 'react';
import { Filter, Download, Calendar, Users, MapPin } from 'lucide-react';
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

export const ReportFilterBar: React.FC<ReportFilterBarProps> = ({
  filters,
  agents,
  localities,
  onFilterChange,
  onExportCSV,
  exportLoading = false,
}) => {
  return (
    <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl shadow-md space-y-2.5 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
          <Filter className="w-3.5 h-3.5 text-purple-400" />
          <span>Report Scope Filters</span>
        </div>

        <button
          type="button"
          onClick={onExportCSV}
          disabled={exportLoading}
          className="py-1.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition active:scale-95"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{exportLoading ? 'Exporting...' : 'Export CSV'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {/* Date Preset Filter */}
        <div className="relative">
          <select
            value={filters.datePreset || 'ALL_TIME'}
            onChange={(e) => onFilterChange({ datePreset: e.target.value as ReportDatePreset })}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
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
        <div className="relative">
          <select
            value={filters.agentId || 'ALL'}
            onChange={(e) => onFilterChange({ agentId: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
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
        <div className="relative">
          <select
            value={filters.locality || 'ALL'}
            onChange={(e) => onFilterChange({ locality: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
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
