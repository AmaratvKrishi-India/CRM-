import React, { useState } from 'react';
import { SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
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
    <div className="bg-surface rounded-xl border border-line shadow-sm overflow-hidden mb-3">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="column-mapping-panel"
        className="min-h-11 w-full flex items-center justify-between p-3.5 text-left text-sm font-semibold text-ink hover:bg-inset transition-colors"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-accent-text" aria-hidden="true" />
          <span>Column Field Mapping</span>
          <span className="text-xs font-normal text-accent-text bg-accent-soft px-2 py-0.5 rounded-full border border-accent">
            Auto-detected
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-faint" aria-hidden="true" />
        ) : (
          <ChevronDown className="w-4 h-4 text-faint" aria-hidden="true" />
        )}
      </button>

      {isOpen && (
        <div
          id="column-mapping-panel"
          className="p-3.5 pt-2 border-t border-line grid grid-cols-1 sm:grid-cols-2 gap-3 bg-inset"
        >
          {fields.map(({ key, label, required }) => (
            <div key={key} className="flex flex-col gap-1">
              <label htmlFor={`mapping-${key}`} className="text-sm font-medium text-soft flex items-center gap-1">
                {label}
                {required && <span className="text-danger-text">*</span>}
              </label>
              <select
                id={`mapping-${key}`}
                value={mapping[key] || ''}
                onChange={(e) => handleFieldChange(key, e.target.value)}
                className="min-h-11 text-sm bg-surface border border-line rounded-xl p-2.5 text-ink focus:outline-none focus:ring-2 focus:ring-focus-ring font-medium"
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
