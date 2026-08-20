/**
 * Report KPI Card Component (Phase 2M)
 * Reusable metric card with badge styling, icon accents, and responsive layout.
 */

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ReportKpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: 'purple' | 'emerald' | 'blue' | 'amber' | 'rose';
  onClick?: () => void;
}

export const ReportKpiCard: React.FC<ReportKpiCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'purple',
  onClick,
}) => {
  const colorStyles = {
    purple: {
      border: 'hover:border-purple-500/40',
      iconBg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      val: 'text-purple-300',
    },
    emerald: {
      border: 'hover:border-emerald-500/40',
      iconBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      val: 'text-emerald-300',
    },
    blue: {
      border: 'hover:border-blue-500/40',
      iconBg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      val: 'text-blue-300',
    },
    amber: {
      border: 'hover:border-amber-500/40',
      iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      val: 'text-amber-300',
    },
    rose: {
      border: 'hover:border-rose-500/40',
      iconBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      val: 'text-rose-300',
    },
  }[color];

  return (
    <div
      onClick={onClick}
      className={`p-4 bg-slate-900 border border-slate-800 ${colorStyles.border} rounded-2xl shadow-md transition-all ${
        onClick ? 'cursor-pointer active:scale-98' : ''
      }`}
    >
      <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
        <span className="font-bold uppercase tracking-wider text-[10px] truncate">{title}</span>
        <div className={`p-1.5 rounded-lg border ${colorStyles.iconBg}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <div className={`text-2xl font-black ${colorStyles.val}`}>{value}</div>
      {subtitle && <div className="text-[11px] text-slate-400 mt-1 truncate">{subtitle}</div>}
    </div>
  );
};
