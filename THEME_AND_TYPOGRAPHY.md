# Theme & Typography Architecture

## 1. Explicit Day / Night Mode
- **Not System Theme:** The application theme is an explicit in-app user preference. It does not automatically follow the Android OS system dark/light mode toggle unless chosen by the user.
- **Default Theme:** `NIGHT` (preserves the dark slate, high-contrast visual design optimized for outdoor readability and battery conservation on OLED screens).
- **Persistence:** Stored in `localStorage` (`amaratv_crm_theme_v1`) and applied immediately upon application bootstrap before initial render to prevent flash of unstyled content.
- **Document Root:** Applies `data-theme="night"` or `data-theme="day"` to the `<html>` document element, along with `colorScheme: dark | light`.

### Design Tokens
| Token | Night Theme | Day Theme | Purpose |
| :--- | :--- | :--- | :--- |
| `--bg-app` | `#0f172a` (Slate 900) | `#f8fafc` (Slate 50) | Main background |
| `--bg-surface` | `#1e293b` (Slate 800) | `#ffffff` (White) | Card & modal surfaces |
| `--bg-card` | `#334155` (Slate 700) | `#f1f5f9` (Slate 100) | Nested item containers |
| `--text-primary` | `#f8fafc` (Slate 50) | `#0f172a` (Slate 900) | Primary titles & text |
| `--text-secondary` | `#94a3b8` (Slate 400) | `#475569` (Slate 600) | Subtitles & metadata |
| `--border` | `rgba(148,163,184,0.15)` | `rgba(15,23,42,0.10)` | Card & section borders |
| `--accent` | `#22c55e` (Emerald 500) | `#16a34a` (Emerald 600) | Brand primary action |

---

## 2. Branded App Font — Inter (No System Fonts)
- **Zero System Fonts:** The application strictly avoids default system fonts such as Arial, Roboto, system-ui, or `-apple-system`.
- **Inter Typography:** All headings, bodies, buttons, badges, modals, and tabular data render with the **Inter** font family (weights 400, 500, 600, 700, 800, 900).
- **Implementation:**
  - `index.html`: Preconnects to Google Fonts CDN and embeds the Inter stylesheet with `display=swap`.
  - `src/index.css`: Direct `@import` of Inter and global `font-family: 'Inter', ui-sans-serif, sans-serif` on `html`, `body`, and universal selectors.
  - `tailwind.config.js`: Sets `fontFamily.sans` to `['Inter', 'ui-sans-serif', 'sans-serif']`.
  - `font-feature-settings: "cv02", "cv03", "cv04", "cv11"` enabled for maximum legibility of numerical and alphanumeric data.
