# Theme and Typography Architecture

**Document status:** CURRENT
**Last reviewed:** 2026-09-10
**Source of truth:** `src/context/ThemeContext.tsx`, `src/index.css`, `index.html`, and `tailwind.config.js`

## Day / Night theme

The theme is an explicit in-app preference and does not automatically follow Android/system dark mode. The default is `NIGHT`, persistence uses `localStorage` key `amaratv_crm_theme_v1`, and the selected mode is applied to `<html>` as `data-theme="night"` or `data-theme="day"` plus the matching `color-scheme`.

Current core tokens are defined in `src/index.css`:

| Token | Night | Day |
|---|---|---|
| `--bg-app` | `#0f172a` | `#f8fafc` |
| `--bg-surface` | `#1e293b` | `#ffffff` |
| `--bg-inset` | `#334155` | `#f1f5f9` |
| `--text-primary` | `#f8fafc` | `#0f172a` |
| `--text-secondary` | `#cbd5e1` | `#475569` |
| `--text-muted` | `#cbd5e1` | `#64748b` |
| `--border` | `#334155` | `#e2e8f0` |
| default `--accent` | `#047857` | `#047857` |

ADMIN role accents override the default agent emerald with purple values through `[data-role="admin"]` selectors.
## Inter typography

Inter is bundled locally through `@fontsource/inter`; `index.html` does **not** load Google Fonts and its CSP keeps `font-src` on `'self'`. `src/index.css` imports the Latin 400/500/600/700/800/900 faces so typography remains available offline.

The global CSS prefers `Inter` and retains `ui-sans-serif, sans-serif` as defensive fallbacks. `tailwind.config.js` uses the same fallback chain for `fontFamily.sans`; therefore the correct statement is “Inter-first with system fallbacks”, not “zero system fonts”.

The app enables `font-feature-settings: "cv02", "cv03", "cv04", "cv11"` on `body` and applies the inherited family to normal text elements. Tailwind semantic color utilities are bridged to CSS variables through `@theme inline`, and the custom `dark:` variant maps to `[data-theme="night"]`.

## Source-of-truth rule

Do not duplicate the complete token sheet in design documentation unless needed for a release snapshot. When a token, font weight, fallback, or role accent changes, `src/index.css` and `ThemeContext.tsx` win over this prose summary.
