/**
 * Report KPI Card Component (Phase 2M)
 * Reusable metric card with badge styling, icon accents, and responsive layout.
 * Rewritten for design tokens + button semantics when clickable (F1/F3).
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface ReportKpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: 'purple' | 'emerald' | 'blue' | 'amber' | 'rose';
  onClick?: () => void;
}

/** Map the legacy colour names onto the shared token families. */
const colorStyles: Record<
  NonNullable<ReportKpiCardProps['color']>,
  { border: string; iconBg: string; val: string }
> = {
  purple: {
    border: 'hover:border-accent/50',
    iconBg: 'bg-accent-soft text-accent-text border-accent/30',
    val: 'text-accent-text',
  },
  emerald: {
    border: 'hover:border-success/50',
    iconBg: 'bg-success-soft text-success-text border-success/30',
    val: 'text-success-text',
  },
  blue: {
    border: 'hover:border-info/50',
    iconBg: 'bg-info-soft text-info border-info/30',
    val: 'text-info',
  },
  amber: {
    border: 'hover:border-warning/50',
    iconBg: 'bg-warning-soft text-warning-text border-warning/30',
    val: 'text-warning-text',
  },
  rose: {
    border: 'hover:border-danger/50',
    iconBg: 'bg-danger-soft text-danger-text border-danger/30',
    val: 'text-danger-text',
  },
};

export const ReportKpiCard: React.FC<ReportKpiCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'purple',
  onClick,
}) => {
  const styles = colorStyles[color];

  const content = (
    <>
      <div className="flex items-start justify-between gap-2 text-xs text-soft mb-1.5">
        <span className="min-w-0 flex-1 font-semibold leading-snug break-words">{title}</span>
        <div className={`hidden sm:block shrink-0 p-1.5 rounded-lg border ${styles.iconBg}`}>
          <Icon className="w-4 h-4" aria-hidden="true" />
        </div>
      </div>
      <div className={`text-2xl font-bold tabular-nums break-words ${styles.val}`}>{value}</div>
      {subtitle && <div className="text-xs text-soft mt-1 leading-snug break-words">{subtitle}</div>}
    </>
  );

  const baseClass = `w-full min-w-0 p-3 sm:p-4 bg-surface border border-line ${styles.border} rounded-2xl transition-[border-color,transform] text-left`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${baseClass} active:scale-98`}>
        {content}
      </button>
    );
  }

  return <div className={baseClass}>{content}</div>;
};
