import React, { useState } from 'react';
import { SlidersHorizontal, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { ColumnMapping } from '../../services/excelParser';

interface ColumnMappingSelectorProps {
  availableColumns: string[];
  mapping: ColumnMapping;
  onChangeMapping: (updated: ColumnMapping) => void;
}

export const ColumnMappingSelector: React.FC<ColumnMappingSelectorProps> = ({
  availableColumns,
  mapping,
  onChangeMapping,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleFieldChange = (field: keyof ColumnMapping, value: string) => {
    onChangeMapping({
      ...mapping,
      [field]: value,
    });
  };

  const fields: Array<{ key: keyof ColumnMapping; label: string; required: boolean }> = [
    { key: 'businessName', label: 'Business Name (Title)', required: true },
    { key: 'phone', label: 'Phone Number', required: true },
    { key: 'address', label: 'Full Address', required: true },
    { key: 'category', label: 'Category / Business Type', required: false },
    { key: 'alternatePhone', label: 'Alternate Phone', required: false },
    { key: 'contactPerson', label: 'Contact Person / Owner', required: false },
    { key: 'website', label: 'Website / URL', required: false },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-3">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3.5 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
          <span>Column Field Mapping</span>
          <span className="text-xs font-normal text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            Auto-detected
          </span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {isOpen && (
        <div className="p-3.5 pt-1 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/50">
          {fields.map(({ key, label, required }) => (
            <div key={key} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-700 flex items-center gap-1">
                {label}
                {required && <span className="text-rose-500">*</span>}
              </label>
              <select
                value={mapping[key] || ''}
                onChange={(e) => handleFieldChange(key, e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-medium"
              >
                <option value="">-- None / Skip --</option>
                {availableColumns.map((col) => (
                  <option key={col} value={col}>
                    {col} {mapping[key] === col ? '✓' : ''}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
