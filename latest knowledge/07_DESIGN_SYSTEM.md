# 07 - DESIGN SYSTEM

## Document Metadata
- **DOCUMENT_STATUS:** CURRENT
- **LAST_VERIFIED:** 2026-08-25
- **SOURCE_OF_TRUTH:** `src/index.css`, `tailwind.config.js`, `src/components/`, `@fontsource/inter`
- **SCOPE:** Complete design token inventory and component styling rules
- **RELATED_DOCUMENTS:** 06_UI_UX_SPECIFICATION.md, 08_ACCESSIBILITY.md

---

## Color Tokens

### Brand Colors (Amaratv Krishi Gold)
| Token | Value | Usage |
|-------|-------|-------|
| `--color-brand-50` | `#fef7ee` | Subtle backgrounds |
| `--color-brand-100` | `#fdedd6` | Hover states, light accents |
| `--color-brand-500` | `#e8a838` | **Primary brand color** - buttons, links, active states |
| `--color-brand-600` | `#d4962e` | Hover on primary |
| `--color-brand-700` | `#b88126` | Pressed/active on primary |

### Semantic Colors
| Token | Light Value | Dark Value | Usage |
|-------|-------------|------------|-------|
| `--color-success` | `#16a34a` | `#22c55e` | Success states, confirmed |
| `--color-warning` | `#eab308` | `#facc15` | Warnings, pending |
| `--color-error` | `#dc2626` | `#ef4444` | Errors, destructive |
| `--color-info` | `#2563eb` | `#3b82f6` | Info, neutral actions |

### Neutral Colors (Day Theme)
| Token | Value | Usage |
|-------|-------|-------|
| `--color-bg-primary` | `#ffffff` | Page background, cards |
| `--color-bg-secondary` | `#f8fafc` | Section backgrounds, inputs |
| `--color-bg-tertiary` | `#f1f5f9` | Subtle separators |
| `--color-text-primary` | `#0f172a` | Primary text, headings |
| `--color-text-secondary` | `#475569` | Secondary text, labels |
| `--color-text-muted` | `#94a3b8` | Placeholders, disabled |
| `--color-border` | `#e2e8f0` | Borders, dividers |
| `--color-border-strong` | `#cbd5e1` | Focus rings, emphasis |

### Neutral Colors (Night Theme)
| Token | Value | Usage |
|-------|-------|-------|
| `--color-bg-primary-dark` | `#0f172a` | Page background, cards |
| `--color-bg-secondary-dark` | `#1e293b` | Section backgrounds, inputs |
| `--color-bg-tertiary-dark` | `#334155` | Subtle separators |
| `--color-text-primary-dark` | `#f8fafc` | Primary text, headings |
| `--color-text-secondary-dark` | `#94a3b8` | Secondary text, labels |
| `--color-text-muted-dark` | `#64748b` | Placeholders, disabled |
| `--color-border-dark` | `#334155` | Borders, dividers |
| `--color-border-strong-dark` | `#475569` | Focus rings, emphasis |

### Role-Based Colors
| Role | Color | Usage |
|------|-------|-------|
| ADMIN | `#e8a838` (brand) | Admin badges, headers |
| AGENT | `#2563eb` (info) | Agent badges, accents |

---

## Typography Tokens

### Font Family
```css
--font-family-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-family-mono: 'JetBrains Mono', 'Fira Code', monospace;
```
- **Source:** Self-hosted via `@fontsource/inter` (weights 400, 500, 600, 700)
- **Fallback:** System font stack for performance

### Type Scale
| Token | Size | Line Height | Weight | Usage |
|-------|------|-------------|--------|-------|
| `text-xs` | 0.75rem (12px) | 1.5 | 400 | Captions, timestamps |
| `text-sm` | 0.875rem (14px) | 1.5 | 400 | Body small, labels |
| `text-base` | 1rem (16px) | 1.5 | 400 | **Base body text** |
| `text-lg` | 1.125rem (18px) | 1.5 | 400 | Large body, emphasis |
| `text-xl` | 1.25rem (20px) | 1.4 | 500 | Subheadings |
| `text-2xl` | 1.5rem (24px) | 1.3 | 600 | Section headings |
| `text-3xl` | 1.875rem (30px) | 1.2 | 700 | Page titles |
| `text-4xl` | 2.25rem (36px) | 1.1 | 700 | Hero titles |

### Font Weights
| Token | Value | Usage |
|-------|-------|-------|
| `font-normal` | 400 | Body text |
| `font-medium` | 500 | Emphasis, labels |
| `font-semibold` | 600 | Headings, buttons |
| `font-bold` | 700 | Titles, strong emphasis |

---

## Spacing Tokens

### Base Unit: 4px (0.25rem)
| Token | Value | Usage |
|-------|-------|-------|
| `space-0` | 0 | Reset |
| `space-1` | 4px | Tight gaps |
| `space-2` | 8px | **Default gap** |
| `space-3` | 12px | Medium gaps |
| `space-4` | 16px | **Default padding** |
| `space-5` | 20px | Large gaps |
| `space-6` | 24px | Section spacing |
| `space-8` | 32px | Major sections |
| `space-10` | 40px | Page margins |
| `space-12` | 48px | Hero sections |
| `space-16` | 64px | Large vertical rhythm |

---

## Border Radius Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-none` | 0 | Sharp corners |
| `rounded-sm` | 2px | Inputs, badges, pills |
| `rounded-md` | 6px | **Default** - buttons, cards, modals |
| `rounded-lg` | 8px | Large containers, sheets |
| `rounded-xl` | 12px | Feature cards |
| `rounded-2xl` | 16px | Hero elements |
| `rounded-full` | 9999px | Avatars, pills, FAB |

---

## Shadow Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-none` | none | Flat |
| `shadow-sm` | `0 1px 2px 0 rgb(0 0 0 / 0.05)` | Cards, inputs (day) |
| `shadow-md` | `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)` | **Default elevation** - modals, dropdowns |
| `shadow-lg` | `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)` | FAB, elevated panels |
| `shadow-xl` | `0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)` | Sheets, dialogs |
| `shadow-inner` | `inset 0 2px 4px 0 rgb(0 0 0 / 0.05)` | Input focus (inset) |

---

## Component Styling Rules

### Buttons
```css
/* Primary */
.btn-primary {
  background: var(--color-brand-500);
  color: white;
  padding: 0.5rem 1rem; /* py-2 px-4 */
  border-radius: var(--rounded-md);
  font-weight: 500;
  transition: all 150ms ease;
}

.btn-primary:hover { background: var(--color-brand-600); }
.btn-primary:active { background: var(--color-brand-700); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

/* Secondary */
.btn-secondary {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

/* Ghost */
.btn-ghost {
  background: transparent;
  color: var(--color-text-primary);
}

.btn-ghost:hover { background: var(--color-bg-tertiary); }

/* Danger */
.btn-danger {
  background: var(--color-error);
  color: white;
}
```

### Inputs
```css
.input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--rounded-md);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 1rem;
  transition: border-color 150ms, box-shadow 150ms;
}

.input:focus {
  outline: none;
  border-color: var(--color-brand-500);
  box-shadow: 0 0 0 3px var(--color-brand-100);
}

.input:disabled {
  background: var(--color-bg-tertiary);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.input-error {
  border-color: var(--color-error);
}

.input-error:focus {
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
}
```

### Cards
```css
.card {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--rounded-lg);
  box-shadow: var(--shadow-sm);
  padding: var(--space-4);
}

.card-hover:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--color-border-strong);
}
```

### Badges
```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: var(--rounded-full);
}

.badge-success { background: #dcfce7; color: #166534; }
.badge-warning { background: #fef9c3; color: #854d0e; }
.badge-error { background: #fee2e2; color: #991b1b; }
.badge-info { background: #dbeafe; color: #1e40af; }
.badge-neutral { background: #f1f5f9; color: #475569; }

/* Dark variants */
.dark .badge-success { background: #14532d; color: #dcfce7; }
/* ... etc */
```

### Status Indicators (Lead Status)
```css
.status-new { background: #dbeafe; color: #1e40af; }
.status-contacted { background: #fef9c3; color: #854d0e; }
.status-interested { background: #dcfce7; color: #166534; }
.status-sample { background: #fce7f3; color: #9d174d; }
.status-followup { background: #ede9fe; color: #5b21b6; }
.status-negotiation { background: #fff7ed; color: #9a3412; }
.status-customer { background: #dcfce7; color: #166534; }
.status-not-interested { background: #f1f5f9; color: #64748b; }
.status-wrong-number { background: #fee2e2; color: #991b1b; }
.status-dnc { background: #fef2f2; color: #991b1b; }
```

---

## Layout Tokens

### Container Widths
| Token | Value | Usage |
|-------|-------|-------|
| `max-w-screen-sm` | 640px | Mobile forms |
| `max-w-screen-md` | 768px | Tablet content |
| `max-w-screen-lg` | 1024px | Desktop content |
| `max-w-screen-xl` | 1280px | Wide desktop |
| `max-w-2xl` | 42rem (672px) | Modal max width |
| `max-w-4xl` | 56rem (896px) | Large modal max width |

### Grid & Flex
```css
/* Standard grid */
.grid-cols-1 { grid-template-columns: repeat(1, 1fr); }
.sm:grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
.lg:grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
.xl:grid-cols-4 { grid-template-columns: repeat(4, 1fr); }

/* Flex patterns */
.flex-center { display: flex; align-items: center; justify-content: center; }
.flex-between { display: flex; align-items: center; justify-content: space-between; }
.flex-col { display: flex; flex-direction: column; }
.gap-2 { gap: 0.5rem; }
.gap-4 { gap: 1rem; }
.gap-6 { gap: 1.5rem; }
```

---

## Z-Index Scale

| Layer | Z-Index | Usage |
|-------|---------|-------|
| Base | 0 | Page content |
| Dropdown | 10 | Select menus |
| Sticky Header | 20 | Table headers |
| Modal Backdrop | 40 | Modal overlay |
| Modal | 50 | Modal content |
| Toast | 60 | Notifications |
| Tooltip | 70 | Hover tooltips |
| Critical | 9999 | Emergency overlays |

---

## Breakpoint Tokens (Tailwind v4)

| Token | Min-Width | Target |
|-------|-----------|--------|
| `sm` | 640px | Large phones |
| `md` | 768px | Tablets |
| `lg` | 1024px | Laptops |
| `xl` | 1280px | Desktops |
| `2xl` | 1536px | Large desktops |

---

## Theme Implementation

### ThemeContext.tsx
```typescript
type ThemeMode = 'light' | 'dark' | 'system';

const ThemeContext = createContext<{
  mode: ThemeMode;
  resolvedMode: 'light' | 'dark';
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
}>(defaultValue);

// Persists to localStorage, respects system preference
// Applies `data-theme="light|dark"` to <html>
```

### CSS Theme Switching
```css
/* Light (default) */
:root, [data-theme="light"] {
  --color-bg-primary: #ffffff;
  --color-text-primary: #0f172a;
  /* ... all light tokens */
}

/* Dark */
[data-theme="dark"] {
  --color-bg-primary: #0f172a;
  --color-text-primary: #f8fafc;
  /* ... all dark tokens */
}
```

---

## Unused / Deprecated Tokens

| Token | Status | Notes |
|-------|--------|-------|
| `--color-primary` | ❌ DEPRECATED | Use `--color-brand-500` |
| `--color-secondary` | ❌ DEPRECATED | Use semantic colors |
| `shadow-2xl` | ⚠️ UNUSED | Not in any component |
| `rounded-3xl` | ⚠️ UNUSED | Not in any component |
| `space-20` | ⚠️ UNUSED | Not in any component |

---

## Tailwind Config Reference (tailwind.config.js)

```javascript
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fef7ee',
          100: '#fdedd6',
          500: '#e8a838',
          600: '#d4962e',
          700: '#b88126',
        },
        // Semantic colors mapped to CSS variables
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slideUp 200ms ease-out',
        'slide-down': 'slideDown 150ms ease-in',
        'fade-in': 'fadeIn 200ms ease-out',
        'fade-out': 'fadeOut 150ms ease-in',
      },
      keyframes: {
        slideUp: { '0%': { transform: 'translateY(100%)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        slideDown: { '0%': { transform: 'translateY(0)', opacity: '1' }, '100%': { transform: 'translateY(100%)', opacity: '0' } },
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        fadeOut: { '0%': { opacity: '1' }, '100%': { opacity: '0' } },
      },
    },
  },
  plugins: [],
};
```