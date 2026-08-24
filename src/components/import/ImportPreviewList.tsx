import React, { useMemo } from 'react';
import { Phone, MapPin, Tag, AlertCircle, CheckCircle2, Copy, AlertTriangle } from 'lucide-react';
import { ParsedLeadRecord, RecordValidationStatus } from '../../services/excelParser';

interface ImportPreviewListProps {
  records: ParsedLeadRecord[];
  filter: 'ALL' | RecordValidationStatus;
  searchQuery: string;
}

const STATUS_META: Record<
  RecordValidationStatus,
  { label: string; pill: string; card: string; icon: React.ReactNode }
> = {
  VALID: {
    label: 'Ready',
    pill: 'bg-success-soft text-success-text',
    card: 'border-line bg-surface',
    icon: <CheckCircle2 aria-hidden="true" className="w-3.5 h-3.5" />,
  },
  DUPLICATE: {
    label: 'Duplicate',
    pill: 'bg-warning-soft text-warning-text',
    card: 'border-warning/40 bg-warning-soft/40',
    icon: <Copy aria-hidden="true" className="w-3.5 h-3.5" />,
  },
  INVALID: {
    label: 'Invalid',
    pill: 'bg-danger-soft text-danger-text',
    card: 'border-danger/40 bg-danger-soft/40',
    icon: <AlertTriangle aria-hidden="true" className="w-3.5 h-3.5" />,
  },
};

export const ImportPreviewList: React.FC<ImportPreviewListProps> = ({
  records,
  filter,
  searchQuery,
}) => {
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((r) => {
      if (filter !== 'ALL' && r.validationStatus !== filter) return false;
      if (!q) return true;
      return (
        r.businessName.toLowerCase().includes(q) ||
        r.phoneClean.toLowerCase().includes(q) ||
        r.phoneRaw.toLowerCase().includes(q) ||
        r.locality.toLowerCase().includes(q) ||
        r.address.toLowerCase().includes(q)
      );
    });
  }, [records, filter, searchQuery]);

  if (filtered.length === 0) {
    return (
      <div className="bg-surface border border-line rounded-2xl p-8 text-center">
        <AlertCircle aria-hidden="true" className="w-8 h-8 text-faint mx-auto mb-2" />
        <p className="text-sm font-semibold text-ink">No records match</p>
        <p className="text-xs text-soft mt-1">
          Try a different search term or switch the filter above.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-24">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-medium text-soft" role="status">
          Showing {filtered.length} of {records.length} records
        </p>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-inset text-soft border border-line">
          {filter === 'ALL' ? 'All Rows' : filter}
        </span>
      </div>

      {filtered.map((record) => {
        const meta = STATUS_META[record.validationStatus];
        const phoneDisplay = record.phoneE164 || record.phoneRaw || 'No Phone';
        return (
          <div
            key={record.tempId}
            className={`rounded-2xl border p-4 ${meta.card}`}
          >
            {/* Header row */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0 text-xs font-mono font-semibold px-1.5 py-0.5 rounded-md bg-inset text-soft border border-line">
                  #{record.sourceRow}
                </span>
                <h4 className="text-sm font-bold text-ink truncate">
                  {record.businessName || (
                    <span className="italic text-faint font-medium">Unnamed Business</span>
                  )}
                </h4>
              </div>
              <span
                className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${meta.pill}`}
              >
                {meta.icon}
                {meta.label}
              </span>
            </div>

            {/* Details */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm text-soft">
                <Phone aria-hidden="true" className="w-3.5 h-3.5 text-faint shrink-0" />
                <span className="font-medium">{phoneDisplay}</span>
                {record.phoneType === 'mobile' ? (
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-success-soft text-success-text">
                    Mobile
                  </span>
                ) : (
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-info-soft text-info-text">
                    Landline (0522)
                  </span>
                )}
              </div>

              {record.category && (
                <div className="flex items-center gap-2 text-sm text-soft">
                  <Tag aria-hidden="true" className="w-3.5 h-3.5 text-faint shrink-0" />
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-inset text-soft border border-line">
                    {record.category}
                  </span>
                </div>
              )}

              {(record.locality || record.pincode || record.address) && (
                <div className="flex items-start gap-2 text-sm text-soft">
                  <MapPin aria-hidden="true" className="w-3.5 h-3.5 text-faint shrink-0 mt-0.5" />
                  <span className="min-w-0">
                    {[record.locality, record.pincode].filter(Boolean).join(' · ')}
                    {record.address && (
                      <span className="block text-xs text-faint truncate">{record.address}</span>
                    )}
                  </span>
                </div>
              )}
            </div>

            {/* Validation issues */}
            {record.validationIssues.length > 0 && (
              <div
                className={`mt-3 rounded-xl px-3 py-2 text-xs font-medium ${
                  record.validationStatus === 'DUPLICATE'
                    ? 'bg-warning-soft text-warning-text'
                    : record.validationStatus === 'INVALID'
                      ? 'bg-danger-soft text-danger-text'
                      : 'bg-info-soft text-info-text'
                }`}
              >
                <ul className="space-y-1">
                  {record.validationIssues.map((issue, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span
                        aria-hidden="true"
                        className="w-1 h-1 rounded-full bg-current mt-1.5 shrink-0"
                      />
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Duplicate context */}
            {record.existingLead && (
              <p className="mt-2 text-xs text-faint">
                Existing Lead: {record.existingLead.businessName} ({record.existingLead.status},{' '}
                {record.existingLead.callCount} calls logged)
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};
