import React from 'react';
import { Phone, MapPin, Tag, AlertCircle, CheckCircle2, Copy, AlertTriangle } from 'lucide-react';
import { ParsedLeadRecord, RecordValidationStatus } from '../../services/excelParser';

interface ImportPreviewListProps {
  records: ParsedLeadRecord[];
  filter: 'ALL' | RecordValidationStatus;
  searchQuery: string;
}

export const ImportPreviewList: React.FC<ImportPreviewListProps> = ({
  records,
  filter,
  searchQuery,
}) => {
  const filteredRecords = records.filter((r) => {
    // Status filter
    if (filter !== 'ALL' && r.validationStatus !== filter) return false;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = r.businessName.toLowerCase().includes(q);
      const matchPhone = r.phoneClean.includes(q) || r.phoneRaw.toLowerCase().includes(q);
      const matchLocality = r.locality.toLowerCase().includes(q);
      const matchAddress = r.address.toLowerCase().includes(q);
      return matchName || matchPhone || matchLocality || matchAddress;
    }

    return true;
  });

  if (filteredRecords.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center my-2">
        <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-medium text-slate-600">No records found matching this filter.</p>
        <p className="text-xs text-slate-400 mt-1">Try changing the status tab or search keyword.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 pb-24">
      <div className="flex items-center justify-between px-1 text-xs text-slate-500 font-medium">
        <span>Showing {filteredRecords.length} of {records.length} records</span>
        <span className="text-[11px] bg-slate-100 px-2 py-0.5 rounded text-slate-600">
          {filter === 'ALL' ? 'All Rows' : filter}
        </span>
      </div>

      {filteredRecords.map((record) => {
        const isValid = record.validationStatus === 'VALID';
        const isDuplicate = record.validationStatus === 'DUPLICATE';
        const isInvalid = record.validationStatus === 'INVALID';

        return (
          <div
            key={record.tempId}
            className={`bg-white rounded-xl border p-3.5 transition-shadow shadow-sm ${
              isValid
                ? 'border-slate-200 hover:border-emerald-300'
                : isDuplicate
                ? 'border-amber-200 bg-amber-50/20 hover:border-amber-300'
                : 'border-rose-200 bg-rose-50/20 hover:border-rose-300'
            }`}
          >
            {/* Header: Title and Status Badge */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded flex-shrink-0">
                  #{record.sourceRow}
                </span>
                <h4 className="text-sm font-bold text-slate-900 truncate">
                  {record.businessName || <span className="text-rose-500 italic">Unnamed Business</span>}
                </h4>
              </div>

              {/* Status Pill */}
              {isValid && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 flex-shrink-0">
                  <CheckCircle2 className="w-3 h-3" /> Ready
                </span>
              )}
              {isDuplicate && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 flex-shrink-0">
                  <Copy className="w-3 h-3" /> Duplicate
                </span>
              )}
              {isInvalid && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 flex-shrink-0">
                  <AlertTriangle className="w-3 h-3" /> Invalid
                </span>
              )}
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-600 mb-2">
              {/* Phone */}
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="font-mono font-medium text-slate-800">
                  {record.phoneE164 || record.phoneRaw || 'No Phone'}
                </span>
                {record.phoneType === 'mobile' && (
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded border border-emerald-200">
                    Mobile
                  </span>
                )}
                {record.phoneType === 'landline' && (
                  <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded border border-blue-200">
                    Landline (0522)
                  </span>
                )}
              </div>

              {/* Category */}
              <div className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium">
                  {record.category}
                </span>
              </div>

              {/* Location */}
              <div className="flex items-start gap-1.5 sm:col-span-2">
                <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="flex flex-wrap items-center gap-1">
                  <span className="font-medium text-slate-700">{record.locality}</span>
                  {record.pincode && (
                    <span className="text-[10px] text-slate-500 bg-slate-100 px-1 rounded">
                      PIN: {record.pincode}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400 truncate max-w-[280px]">
                    • {record.address}
                  </span>
                </div>
              </div>
            </div>

            {/* Validation Issues / Duplicate Info Banner */}
            {record.validationIssues.length > 0 && (
              <div
                className={`mt-2 p-2 rounded-lg text-xs flex flex-col gap-0.5 ${
                  isDuplicate
                    ? 'bg-amber-100/70 text-amber-900 border border-amber-200'
                    : isInvalid
                    ? 'bg-rose-100/70 text-rose-900 border border-rose-200'
                    : 'bg-blue-50 text-blue-800 border border-blue-100'
                }`}
              >
                {record.validationIssues.map((issue, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
                    <span>{issue}</span>
                  </div>
                ))}

                {/* If duplicate context exists */}
                {record.existingLead && (
                  <div className="text-[11px] mt-1 pt-1 border-t border-amber-200/80 text-amber-800">
                    Existing Lead: <strong>{record.existingLead.businessName}</strong> ({record.existingLead.status}, {record.existingLead.callCount} calls logged).
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
