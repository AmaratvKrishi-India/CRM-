/**
 * Duplicate Confirm Modal (Import flow)
 * Asks the user how to handle leads that already exist in the local CRM.
 * Rewritten for the shared accessible Modal + design tokens (F1/F2/F5).
 */

import React from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { Modal } from '../common/Modal';

interface DuplicateConfirmModalProps {
  isOpen: boolean;
  duplicateCount: number;
  onConfirmOverwrite: () => void;
  onConfirmSkip: () => void;
  onClose: () => void;
}

export const DuplicateConfirmModal: React.FC<DuplicateConfirmModalProps> = ({
  isOpen,
  duplicateCount,
  onConfirmOverwrite,
  onConfirmSkip,
  onClose,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Duplicate Leads Detected"
      maxWidthClassName="max-w-md"
      closeOnBackdrop={false}
      headerIcon={
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-warning-soft text-warning-text border border-warning">
          <AlertTriangle className="w-5 h-5" aria-hidden="true" />
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-ink font-medium leading-relaxed">
          This Excel file contains{' '}
          <span className="font-bold text-warning-text">{duplicateCount}</span> lead(s) that
          already exist in your local CRM database.
        </p>

        <div className="bg-inset border border-line rounded-xl p-3 text-sm text-soft">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-success-text flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <strong className="text-ink">Sales History Safe Guarantee:</strong>
              <p className="text-soft mt-0.5 leading-relaxed">
                Even if you choose to update existing records, all past call logs, remarks,
                follow-ups, and pipeline statuses are strictly preserved.
              </p>
            </div>
          </div>
        </div>

        <p className="text-sm text-faint">
          How would you like to proceed with the duplicate records?
        </p>

        {/* Actions */}
        <div className="pt-3 border-t border-line flex flex-col gap-2">
          <button
            type="button"
            data-autofocus
            onClick={onConfirmSkip}
            className="w-full min-h-11 py-3 px-4 rounded-xl font-bold text-sm bg-accent hover:bg-accent-hover text-on-accent transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            <span>Skip Duplicates (Recommended)</span>
          </button>

          <button
            type="button"
            onClick={onConfirmOverwrite}
            className="w-full min-h-11 py-2.5 px-4 rounded-xl font-semibold text-sm bg-inset hover:bg-inset-strong border border-line text-ink transition-colors"
          >
            Update Contact Info &amp; Overwrite Details
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-11 py-2 text-center text-sm text-faint hover:text-ink transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
};
