/**
 * Lightweight toast system (F4 / F17).
 * Announces via an aria-live="polite" region, auto-dismisses with a
 * reading-friendly duration, and offers manual dismissal.
 * Use ToastProvider once near the app root; call useToast() anywhere.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastInput {
  message: string;
  tone?: ToastTone;
  /** Optional action (e.g. Retry). */
  action?: { label: string; onClick: () => void };
  /** Auto-dismiss ms. Default 6000. */
  durationMs?: number;
}

interface ToastItem extends Required<Pick<ToastInput, 'message' | 'tone'>> {
  id: number;
  action?: ToastInput['action'];
}

interface ToastContextValue {
  showToast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const TONE_STYLES: Record<ToastTone, { icon: React.ReactNode; classes: string }> = {
  success: {
    icon: <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" aria-hidden="true" />,
    classes: 'border-success/40',
  },
  error: {
    icon: <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" aria-hidden="true" />,
    classes: 'border-danger/50',
  },
  info: {
    icon: <Info className="w-5 h-5 text-info shrink-0 mt-0.5" aria-hidden="true" />,
    classes: 'border-info/40',
  },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      const item: ToastItem = {
        id,
        message: input.message,
        tone: input.tone ?? 'info',
        action: input.action,
      };
      // Keep at most 3 visible to avoid spamming screen readers.
      setToasts((prev) => [...prev.slice(-2), item]);
      const timer = setTimeout(() => dismiss(id), input.durationMs ?? 6000);
      timers.current.set(id, timer);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* aria-live region so screen readers announce status changes */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed top-3 left-3 right-3 z-[70] flex flex-col items-center gap-2 pointer-events-none"
      >
        {toasts.map((t) => {
          const tone = TONE_STYLES[t.tone];
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto w-full max-w-md bg-elevated text-ink border ${tone.classes} shadow-xl rounded-xl p-3 flex items-start gap-2.5 animate-in fade-in slide-in-from-top duration-200`}
            >
              {tone.icon}
              <p className="text-sm font-medium leading-snug grow min-w-0">{t.message}</p>
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                  className="shrink-0 min-h-11 px-3 rounded-lg text-sm font-bold text-accent-text hover:bg-accent-soft transition-colors"
                >
                  {t.action.label}
                </button>
              )}
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="shrink-0 w-8 h-8 -m-1 flex items-center justify-center rounded-lg text-faint hover:text-ink hover:bg-inset transition-colors"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider.');
  return ctx;
}
