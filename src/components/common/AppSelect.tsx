import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

export interface AppSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface AppSelectProps {
  id?: string;
  value: string;
  options: readonly AppSelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  label?: string;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
}

/** Consistent, keyboard-accessible select menu for filters and form fields. */
export const AppSelect: React.FC<AppSelectProps> = ({
  id,
  value,
  options,
  onChange,
  ariaLabel,
  label,
  className = 'w-full',
  buttonClassName = '',
  disabled = false,
}) => {
  const generatedId = useId();
  const triggerId = id || `app-select-${generatedId}`;
  const listboxId = `${triggerId}-options`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState<React.CSSProperties | null>(null);
  const typeaheadRef = useRef({ value: '', at: 0 });
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 6;
    const viewportMargin = 8;
    const availableBelow = Math.max(0, window.innerHeight - rect.bottom - gap - viewportMargin);
    const availableAbove = Math.max(0, rect.top - gap - viewportMargin);
    const openAbove = availableBelow < 220 && availableAbove > availableBelow;
    const availableHeight = openAbove ? availableAbove : availableBelow;
    const maxHeight = Math.min(320, Math.max(96, availableHeight));
    const width = Math.min(rect.width, Math.max(0, window.innerWidth - viewportMargin * 2));
    const left = Math.min(
      Math.max(viewportMargin, rect.left),
      Math.max(viewportMargin, window.innerWidth - width - viewportMargin),
    );
    setMenuPosition({
      position: 'fixed',
      left,
      width,
      maxHeight,
      transformOrigin: openAbove ? 'bottom center' : 'top center',
      top: openAbove
        ? Math.max(viewportMargin, rect.top - gap - maxHeight)
        : Math.min(window.innerHeight - viewportMargin - maxHeight, rect.bottom + gap),
    });
  }, []);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target) &&
        !listboxRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const reposition = () => updateMenuPosition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, updateMenuPosition]);

  const openMenu = (index = selectedIndex >= 0 ? selectedIndex : 0) => {
    setActiveIndex(index);
    updateMenuPosition();
    setOpen(true);
  };

  const enabledIndexFrom = (start: number, direction: 1 | -1) => {
    if (options.length === 0) return -1;
    for (let step = 1; step <= options.length; step += 1) {
      const index = (start + direction * step + options.length) % options.length;
      if (!options[index].disabled) return index;
    }
    return -1;
  };

  const chooseOption = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      if (!open) {
        openMenu();
      } else {
        const next = enabledIndexFrom(activeIndex, direction);
        if (next >= 0) setActiveIndex(next);
      }
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const direction = event.key === 'Home' ? 1 : -1;
      const start = event.key === 'Home' ? -1 : options.length;
      const next = enabledIndexFrom(start, direction);
      if (next >= 0) {
        setActiveIndex(next);
        setOpen(true);
      }
      return;
    }

    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) chooseOption(activeIndex);
      else openMenu();
      return;
    }

    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      const previous = now - typeaheadRef.current.at < 700 ? typeaheadRef.current.value : '';
      const query = `${previous}${event.key}`.toLocaleLowerCase();
      typeaheadRef.current = { value: query, at: now };
      const start = open ? activeIndex : Math.max(selectedIndex, -1);
      for (let step = 1; step <= options.length; step += 1) {
        const index = (start + step + options.length) % options.length;
        if (!options[index].disabled && options[index].label.toLocaleLowerCase().startsWith(query)) {
          setActiveIndex(index);
          setOpen(true);
          break;
        }
      }
    }
  };

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      {label && (
        <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-soft">
          {label}
        </span>
      )}
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleKeyDown}
        className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-line bg-inset px-3.5 py-2.5 text-left text-sm font-semibold text-ink shadow-sm transition-colors hover:border-accent/40 hover:bg-inset-strong focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50 ${buttonClassName}`}
      >
        <span className="min-w-0 flex-1 truncate">{selectedOption?.label || 'Select an option'}</span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-faint transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && menuPosition && createPortal(
        <div
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          style={menuPosition}
          className="z-[70] overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface p-1.5 shadow-xl animate-in fade-in zoom-in-98 duration-200"
        >
          {options.map((option, index) => {
            const selected = option.value === value;
            const active = index === activeIndex;
            return (
              <div
                key={`${option.value}-${index}`}
                id={`${listboxId}-option-${index}`}
                role="option"
                aria-selected={selected}
                aria-disabled={option.disabled || undefined}
                onMouseEnter={() => !option.disabled && setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseOption(index)}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${
                  option.disabled
                    ? 'cursor-not-allowed text-faint opacity-50'
                    : active
                      ? 'bg-accent-soft text-accent-text'
                      : 'text-ink hover:bg-inset'
                }`}
              >
                <span className="min-w-0 flex-1 break-words">{option.label}</span>
                {selected && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-accent-text" />}
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
};
