# 08 - ACCESSIBILITY

## Document Metadata
- **DOCUMENT_STATUS:** CURRENT
- **LAST_VERIFIED:** 2026-08-25
- **SOURCE_OF_TRUTH:** Source code audit (src/components/, src/index.css, tests/appTypography.test.ts, tests/themeMode.test.ts)
- **SCOPE:** Accessibility compliance status for Amaratv Krishi Field Sales CRM
- **RELATED_DOCUMENTS:** 06_UI_UX_SPECIFICATION.md, 07_DESIGN_SYSTEM.md

---

## Compliance Summary

| Standard | Level | Status | Notes |
|----------|-------|--------|-------|
| WCAG 2.1 | AA | **PARTIAL** | Core features compliant; gaps documented below |
| Section 508 | - | **PARTIAL** | Aligns with WCAG 2.1 AA |
| EN 301 549 | - | **PARTIAL** | EU standard alignment |

---

## Implemented Accessibility Features

### 1. Semantic HTML Structure
| Element | Implementation | Verified |
|---------|----------------|----------|
| Page landmarks | `<header>`, `<main>`, `<nav>`, `<footer>`, `<aside>` | ✅ |
| Heading hierarchy | h1 → h2 → h3 (no skipped levels) | ✅ |
| Lists | `<ul>`, `<ol>`, `<li>` for all lists | ✅ |
| Tables | `<table>`, `<thead>`, `<tbody>`, `<th scope="col">` | ✅ |
| Forms | `<form>`, `<label for="id">`, `<input id="id">` | ✅ |
| Buttons | `<button>` (not `<div onClick>`) | ✅ |
| Links | `<a href>` for navigation | ✅ |

### 2. Keyboard Navigation
| Feature | Implementation | Verified |
|---------|----------------|----------|
| Focus visible | `:focus-visible` outlines on all interactive elements | ✅ |
| Tab order | Logical DOM order matches visual order | ✅ |
| Focus trap | Modals trap focus (Tab cycles within modal) | ✅ |
| Escape key | Closes modals, dropdowns | ✅ |
| Skip links | Not implemented | ❌ |

### 3. Focus Management
```css
/* Global focus styles (index.css) */
:focus-visible {
  outline: 2px solid var(--color-brand-500);
  outline-offset: 2px;
}

/* Button focus */
button:focus-visible,
a:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible {
  outline: 2px solid var(--color-brand-500);
  outline-offset: 2px;
}

/* Modal focus trap */
.modal-content:focus-within {
  /* Focus stays within modal */
}
```

### 4. ARIA Implementation
| Component | ARIA Attributes | Verified |
|-----------|----------------|----------|
| Modals | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` | ✅ |
| Tabs | `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls` | ✅ |
| Dropdowns | `aria-expanded`, `aria-haspopup`, `aria-controls` | ✅ |
| Tooltips | `role="tooltip"`, `aria-describedby` | ❌ Not implemented |
| Live regions | `aria-live="polite"` for activity feed | ✅ |
| Status | `aria-live="assertive"` for sync errors | ✅ |
| Form errors | `aria-invalid="true"`, `aria-describedby` error ID | ✅ |
| Loading | `aria-busy="true"` on async actions | ✅ |

### 5. Color Contrast (WCAG AA)
| Combination | Ratio | Status |
|-------------|-------|--------|
| Primary text on white | 12.6:1 | ✅ AAA |
| Secondary text on white | 7.0:1 | ✅ AAA |
| Brand gold on white | 3.2:1 | ❌ AA (large text only) |
| White on brand gold | 4.1:1 | ✅ AA |
| Error red on white | 5.9:1 | ✅ AAA |
| Success green on white | 4.8:1 | ✅ AA |
| Border on white | 3.0:1 | ❌ AA (UI components) |
| **Dark mode** | | |
| Primary text on dark | 15.3:1 | ✅ AAA |
| Secondary text on dark | 8.6:1 | ✅ AAA |
| Brand gold on dark | 6.8:1 | ✅ AA |
| Error red on dark | 7.2:1 | ✅ AAA |

**Known Contrast Issues:**
- Brand gold (`#e8a838`) on white fails AA for normal text (3.2:1) - used in buttons
- Border color (`#e2e8f0`) on white fails AA for UI components (3.0:1)

### 6. Touch Targets
| Element | Min Size | Status |
|---------|----------|--------|
| Buttons | 48x48px | ✅ |
| Touch targets | 44x44px (iOS) / 48x48px (Android) | ✅ |
| FAB | 56x56px | ✅ |
| Tab bar items | Full width / 48px height | ✅ |
| List items | Full width / 56px height | ✅ |

### 7. Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```
- **Status:** ✅ Implemented in `index.css`
- **Tested:** `themeMode.test.ts` verifies

### 8. Zoom & Text Scaling
| Feature | Support |
|---------|---------|
| Browser zoom (up to 200%) | ✅ No horizontal scroll |
| Text-only zoom | ✅ Relative units (rem) |
| System font size | ✅ Respects `rem` base |

---

## Component-Level Accessibility

### Modals (All 20+ modals)
| Requirement | Implementation |
|-------------|----------------|
| `role="dialog"` + `aria-modal="true"` | ✅ |
| `aria-labelledby` pointing to heading | ✅ |
| Focus trap (Tab cycles within) | ✅ |
| Initial focus on first focusable element | ✅ |
| Return focus to trigger on close | ✅ |
| ESC closes modal | ✅ |
| Backdrop click closes (configurable) | ✅ |
| Body scroll lock | ✅ |

### Forms (All forms)
| Requirement | Implementation |
|-------------|----------------|
| `<label for="id">` linked to `<input id="id">` | ✅ |
| Required fields marked (`aria-required="true"`) | ✅ |
| Error messages linked (`aria-describedby`) | ✅ |
| `aria-invalid="true"` on error | ✅ |
| Helper text linked (`aria-describedby`) | ✅ |
| Autocomplete attributes | ⚠️ Partial |

### Tables (Admin reports, lead lists)
| Requirement | Implementation |
|-------------|----------------|
| `<th scope="col">` for headers | ✅ |
| `<caption>` for table description | ❌ Missing |
| Row headers (`scope="row"`) | ❌ Not applicable |
| Sortable column indicators | `aria-sort` | ❌ |

### Navigation
| Requirement | Implementation |
|-------------|----------------|
| Skip to main content | ❌ Not implemented |
| Breadcrumb | ❌ Not implemented |
| Current page indicator | ✅ `aria-current="page"` |
| Hamburger menu (mobile) | `aria-expanded`, `aria-controls` | ✅ |

### Images & Icons
| Requirement | Implementation |
|-------------|----------------|
| Decorative icons | `aria-hidden="true"` | ✅ |
| Informative images | `alt` text | ✅ |
| Lucide icons | Wrapped with `aria-hidden` + text label | ✅ |

---

## Screen Reader Testing

### Tested Combinations
| Screen Reader | Browser | Status |
|---------------|---------|--------|
| NVDA | Chrome | ✅ Manual testing |
| NVDA | Firefox | ✅ Manual testing |
| VoiceOver | Safari (iOS) | ❌ Not tested |
| TalkBack | Chrome (Android) | ❌ Not tested |
| JAWS | Chrome | ❌ Not tested |

### Key Flows Verified
- Login → Dashboard navigation
- Lead list → Lead detail → Actions (call, WhatsApp, follow-up)
- Modal open/close cycles
- Form validation errors
- Sync status announcements

---

## Automated Accessibility Tests

### Current Test Coverage
| Test File | Tests | Coverage |
|-----------|-------|----------|
| `appTypography.test.ts` | 4 | Font size, contrast tokens |
| `themeMode.test.ts` | 4 | Theme switching, reduced motion |
| E2E | 32 | Basic navigation, modals |

### Missing Automated Tests
- axe-core integration
- jest-axe for component tests
- Lighthouse CI for regression

---

## Known Accessibility Gaps

| Gap | Severity | Component | Effort | Status |
|-----|----------|-----------|--------|--------|
| Skip to main content link | HIGH | All pages | Low | NOT STARTED |
| Brand gold contrast on white | HIGH | Buttons, links | Medium | NOT STARTED |
| Border contrast on inputs | MEDIUM | All inputs | Low | NOT STARTED |
| Table captions | MEDIUM | Admin tables | Low | NOT STARTED |
| Sortable column ARIA | LOW | Admin tables | Medium | NOT STARTED |
| Tooltip ARIA | LOW | Future feature | Low | NOT STARTED |
| Autocomplete attributes | LOW | Forms | Low | NOT STARTED |
| Breadcrumb navigation | LOW | Admin screens | Medium | NOT STARTED |
| Mobile screen reader testing | HIGH | Android/iOS | High | NOT STARTED |
| Focus indicator on disabled elements | LOW | Buttons | Low | NOT STARTED |

---

## Recommended Remediation Plan

### Phase 1 (High Impact, Low Effort)
1. Add skip to main content link
2. Fix border contrast (darken `--color-border` to `#cbd5e1`)
3. Add table captions to admin tables
4. Add `autocomplete` attributes to forms

### Phase 2 (Medium Effort)
1. Fix brand gold contrast (darken to `#d4962e` for text, keep `#e8a838` for backgrounds)
2. Add `aria-sort` to sortable columns
3. Implement breadcrumb navigation

### Phase 3 (Testing & Polish)
1. Test with VoiceOver (iOS) and TalkBack (Android)
2. Integrate axe-core in CI
3. Add Lighthouse CI gate

---

## Verification Checklist (Per Release)

- [ ] All modals trap focus correctly
- [ ] All forms have labeled inputs
- [ ] All errors announced via `aria-live`
- [ ] Color contrast passes WCAG AA (automated + manual)
- [ ] Keyboard navigation works end-to-end
- [ ] Reduced motion respected
- [ ] Zoom to 200% works without horizontal scroll
- [ ] Screen reader reads key flows correctly

---

## Testing Commands

```bash
# Manual accessibility audit
npm run dev
# Open in Chrome → DevTools → Lighthouse → Accessibility

# Automated (when implemented)
npx axe-core ./src/**/*.tsx

# Theme mode tests (includes reduced motion)
npm test -- tests/themeMode.test.ts

# Typography tests (includes contrast tokens)
npm test -- tests/appTypography.test.ts
```