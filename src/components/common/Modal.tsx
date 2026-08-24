/**
 * Shared accessible modal shell (F5 / F2).
 * Provides: role="dialog", aria-modal, labelled title, focus trap,
 * initial focus, focus restore on close, Escape close, optional
 * backdrop-click close, and body scroll lock.
 *
 * Destructive or multi-step modals should pass closeOnBackdrop={false}
 * so a stray tap cannot discard user input.
 */

import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Accessible title rendered in the header; also used for aria-labelledby. */
  title: string;
  /** Optional subtitle under the title. */
  subtitle?: string;
  children: React.ReactNode;
  /** Allow Escape to close. Default true. */
  closeOnEscape?: boolean;
  /** Allow backdrop click to close. Default true; disable for destructive/multi-step flows. */
  closeOnBackdrop?: boolean;
  /** Hide the header close (X) button. Default false. */
  hideCloseButton?: boolean;
  /** Max width utility class for the panel. */
  maxWidthClassName?: string;
  /** Tone for the header icon area (kept neutral; callers pass their own icon). */
  headerIcon?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  closeOnEscape = true,
  closeOnBackdrop = true,
  hideCloseButton = false,
  maxWidthClassName = 'max-w-md',
  headerIcon,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const subtitleId = useId();
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Focus management: remember trigger, move focus in, restore on close.
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    if (panel) {
      const first = panel.querySelector<HTMLElement>('[data-autofocus]');
      const focusTarget =
        first || panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) || panel;
      focusTarget.focus();
    }

    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen]);

  // Escape close + focus trap.
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        const panel = panelRef.current;
        if (!panel) return;
        const focusables = Array.from(
          panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => el.offsetParent !== null || el === document.activeElement);
        if (focusables.length === 0) {
          e.preventDefault();
          panel.focus();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || !panel.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, closeOnEscape, onClose]);

  // Body scroll lock while open.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200"
        aria-hidden="true"
        onClick={closeOnBackdrop ? onClose : undefined}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        tabIndex={-1}
        className={`relative w-full ${maxWidthClassName} bg-surface text-ink border border-line rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92dvh] flex flex-col animate-in fade-in zoom-in-98 duration-200`}
      >
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-line shrink-0">
          <div className="flex items-start gap-2.5 min-w-0">
            {headerIcon}
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-bold leading-tight truncate">
                {title}
              </h2>
              {subtitle && (
                <p id={subtitleId} className="text-sm text-soft mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {!hideCloseButton && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="shrink-0 w-11 h-11 -mr-2 -mt-1 flex items-center justify-center rounded-xl text-faint hover:text-ink hover:bg-inset transition-colors"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="overflow-y-auto px-4 py-4 grow">{children}</div>
      </div>
    </div>
  );
};
