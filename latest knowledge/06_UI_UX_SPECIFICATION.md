# 06 - UI/UX SPECIFICATION

## Document Metadata
- **DOCUMENT_STATUS:** CURRENT
- **LAST_VERIFIED:** 2026-08-25
- **SOURCE_OF_TRUTH:** Source code analysis (src/components/, src/index.css, src/context/ThemeContext.tsx)
- **SCOPE:** Complete UI/UX specification of the Amaratv Krishi Field Sales CRM
- **RELATED_DOCUMENTS:** 07_DESIGN_SYSTEM.md, 08_ACCESSIBILITY.md, 01_PROJECT_OVERVIEW.md

---

## Screen Inventory

### Authentication Screens
| Screen | Component | Role | Description |
|--------|-----------|------|-------------|
| Login | `LoginScreen.tsx` | ALL | Email/password form, validation, error display, loading state |

### Admin Screens (AdminShell.tsx)
| Screen | Component | Tab/Route | Description |
|--------|-----------|-----------|-------------|
| Dashboard | `AdminDashboardView.tsx` | /admin/dashboard | KPI cards, status distribution, agent performance, live activity feed |
| Leads | `AdminLeadsView.tsx` | /admin/leads | Full org lead list with search/filter, bulk actions |
| Agents | `AdminAgentsView.tsx` | /admin/agents | Agent list with create/edit/delete modals |
| Reports | `AdminReportsView.tsx` | /admin/reports | Multi-tab: Lead Summary, Call Analytics, Agent Performance, Follow-ups |
| Data Management | `AdminDataManagementView.tsx` | /admin/data | Backup/Restore, schema viewer, migration status |

### Agent Screens (SalesDashboard.tsx)
| Screen | Component | Tab/Route | Description |
|--------|-----------|-----------|-------------|
| Dashboard | `SalesDashboard.tsx` | /dashboard | Personal KPIs, assigned leads summary, today's follow-ups |
| Leads List | `MinimalLeadsList.tsx` | /leads | Searchable/filterable list of assigned leads |
| Lead Detail | `LeadDetailView.tsx` | /leads/:id | Full lead info, timeline, call, WhatsApp, follow-up, remarks actions |

### Modals (Shared)
| Modal | Component | Trigger | Description |
|-------|-----------|---------|-------------|
| Create Lead | `CreateLeadModal.tsx` | FAB/Menu | Full lead form with validation |
| Lead Assignment | `LeadAssignmentModal.tsx` | Lead row action | Single lead → agent assignment |
| Bulk Assignment | `BulkLeadAssignmentModal.tsx` | Leads toolbar | Multi-select → bulk assign |
| Call Outcome | `CallOutcomeModal.tsx` | Lead detail "Call" | Dial → outcome → duration → remark |
| Follow-up | `FollowUpModal.tsx` | Lead detail "Follow-up" | Schedule with priority/notes |
| WhatsApp Compose | `WhatsAppComposeModal.tsx` | Lead detail "WhatsApp" | Template selector + rendered preview |
| Create Agent | `CreateAgentModal.tsx` | Agents tab | Email, name, phone, role |
| Edit Agent | `EditAgentModal.tsx` | Agent row | Update agent details |
| Delete Agent | `DeleteAgentModal.tsx` | Agent row | Confirm soft-delete |
| Backup/Restore | `BackupRestoreModal.tsx` | Settings | Full JSON backup/restore |
| Settings | `SettingsModal.tsx` | Header gear | Theme, notifications, sync, device info |
| Import | `ExcelImporter.tsx` | Admin Leads tab | File upload, column mapping, preview |
| Import Stats | `ImportSummaryCard.tsx` | Import flow | Results summary |
| Import Preview | `ImportPreviewList.tsx` | Import flow | Row preview with validation |
| Column Mapping | `ColumnMappingSelector.tsx` | Import flow | Excel column → field mapping |
| Duplicate Confirm | `DuplicateConfirmModal.tsx` | Import flow | Handle duplicates |
| Admin Call History | `AdminCallHistoryModal.tsx` | Admin lead row | View call history for any lead |
| Agent Performance Detail | `AgentPerformanceDetail.tsx` | Reports → agent | Drill-down metrics |
| Confirm Status | `ConfirmStatusModal.tsx` | Various | Generic confirmation |

### Confirmation/Status Modals
| Modal | Purpose |
|-------|---------|
| `ConfirmStatusModal.tsx` | Generic confirm (delete, deactivate, etc.) |
| `ImportSummaryCard.tsx` | Import results |
| `ImportStatsCard.tsx` | Import statistics |
| `ReportKpiCard.tsx` | Report KPI display |
| `ReportFilterBar.tsx` | Report filters |

---

## Navigation Architecture

### Route Structure
```
/ (root)
├── /login                    → LoginScreen (public)
├── /admin (AdminShell)
│   ├── /dashboard            → AdminDashboardView
│   ├── /leads                → AdminLeadsView
│   ├── /agents               → AdminAgentsView
│   ├── /reports              → AdminReportsView
│   └── /data                 → AdminDataManagementView
└── /dashboard (SalesDashboard)
    ├── /                     → SalesDashboard (agent home)
    ├── /leads                → MinimalLeadsList
    └── /leads/:id            → LeadDetailView
```

### Navigation Patterns
- **Admin:** Left sidebar (AdminShell.tsx) with 5 tabs, persistent across admin routes
- **Agent:** Bottom tab bar (SalesDashboard.tsx) with 2 tabs (Dashboard, Leads)
- **Modals:** Stack on top of current screen, focus trap, ESC to close
- **Deep Links:** Lead detail via `/leads/:id` (both admin and agent)

---

## Layout System

### AdminShell Layout
```
┌─────────────────────────────────────────────────────────┐
│ Header: Amaratv Krishi | SyncStatusBadge | Theme | User │
├──────────────┬──────────────────────────────────────────┤
│ Sidebar      │ Main Content Area                         │
│ (5 tabs)     │                                           │
│              │ [Tab Content]                             │
│              │                                           │
└──────────────┴──────────────────────────────────────────┘
```

### SalesDashboard Layout (Mobile-First)
```
┌─────────────────────────────────────┐
│ Header: Dashboard | SyncStatusBadge │
├─────────────────────────────────────┤
│                                     │
│   [Tab Content]                     │
│   (Dashboard or Leads List)         │
│                                     │
├─────────────────────────────────────┤
│ Bottom Tab Bar: [Dashboard] [Leads] │
└─────────────────────────────────────┘
```

### LeadDetailView Layout
```
┌─────────────────────────────────────┐
│ Header: Lead Name | Actions Menu    │
├─────────────────────────────────────┤
│ Tab Bar: [Info] [Timeline] [Calls]  │
├─────────────────────────────────────┤
│                                     │
│   [Tab Panel Content]               │
│                                     │
├─────────────────────────────────────┤
│ FAB: Call | WhatsApp | Follow-up    │
└─────────────────────────────────────┘
```

---

## Component Library

### Core UI Components
| Component | File | Purpose |
|-----------|------|---------|
| Button | Inline in components | Primary, secondary, ghost, danger variants |
| Input | Inline | Text, tel, email, textarea with validation |
| Select | Inline | Native select with options |
| Modal | Inline (pattern) | Backdrop, focus trap, header, actions |
| Card | Inline | Bordered container with padding |
| Badge | Inline | Status indicators, counts |
| Avatar | Inline | User initials with color coding |
| Table | Inline | Sortable, selectable data tables |
| Tabs | Inline | Horizontal tab navigation |
| Accordion | Inline | Collapsible sections |

### Specialized Components
| Component | File | Purpose |
|-----------|------|---------|
| SyncStatusBadge | `SyncStatusBadge.tsx` | Real-time sync status indicator |
| LiveActivityFeed | `LiveActivityFeed.tsx` | Real-time activity stream |
| AgentCard | `AgentCard.tsx` | Agent summary card |
| AgentPerformanceTable | `AgentPerformanceTable.tsx` | Sortable agent metrics table |
| ReportKpiCard | `ReportKpiCard.tsx` | KPI metric display |
| ReportFilterBar | `ReportFilterBar.tsx` | Multi-filter toolbar |
| MinimalLeadsList | `MinimalLeadsList.tsx` | Virtualized lead list |
| LeadDetailView | `LeadDetailView.tsx` | Master lead detail with tabs |
| LeadTimelineView | `LeadTimelineView.tsx` | Chronological activity log |
| CallOutcomeModal | `CallOutcomeModal.tsx` | Call state machine UI |
| FollowUpModal | `FollowUpModal.tsx` | Date/time picker + priority |
| WhatsAppComposeModal | `WhatsAppComposeModal.tsx` | Template picker + preview |
| ExcelImporter | `ExcelImporter.tsx` | Multi-step import wizard |
| ColumnMappingSelector | `ColumnMappingSelector.tsx` | Drag-drop column mapping |
| BackupRestoreModal | `BackupRestoreModal.tsx` | Backup/restore UI |
| SettingsModal | `SettingsModal.tsx` | App settings panel |
| ErrorBoundary | `ErrorBoundary.tsx` | React error boundary wrapper |

---

## Interaction Patterns

### Form Handling
- **Validation:** Inline validation on blur + submit
- **Error Display:** Red text below field, field border red
- **Loading:** Button spinner, disabled state
- **Success:** Toast notification, modal close, list refresh

### List Interactions
- **Search:** Debounced (300ms) input → filter
- **Filter:** Multi-select chips, clear all button
- **Sort:** Column header click (admin tables)
- **Selection:** Checkbox row selection → bulk actions toolbar
- **Pull-to-Refresh:** On mobile lead lists

### Modal Interactions
- **Open:** Slide up from bottom (mobile) / fade in (desktop)
- **Close:** Backdrop click, ESC key, cancel button
- **Focus:** Auto-focus first input
- **Stack:** Multiple modals stack with increasing z-index

### Real-time Updates
- **Activity Feed:** New items prepend with animation
- **Lead List:** Status badge updates in-place
- **Dashboard:** KPI counters increment
- **Sync Badge:** Status changes with color coding

---

## State Management

### UI State (React State)
- Form inputs, validation errors
- Modal open/close
- Tab selection
- Filter/search parameters
- Loading/saving states

### Global State (Context)
- **AuthContext:** User, session, role, organization
- **ThemeContext:** Theme mode (light/dark), toggle function

### Server State (Local Dexie + Sync)
- All entity data (leads, calls, follow-ups, etc.)
- Sync status, last sync time
- Outbox queue status

---

## Responsive Behavior

### Breakpoints (Tailwind CSS v4)
| Breakpoint | Width | Target |
|------------|-------|--------|
| `sm` | 640px | Large phones |
| `md` | 768px | Tablets |
| `lg` | 1024px | Laptops |
| `xl` | 1280px | Desktops |

### Component Responsiveness
| Component | Mobile (<768px) | Tablet (768-1024px) | Desktop (>1024px) |
|-----------|-----------------|---------------------|-------------------|
| AdminShell | Drawer sidebar | Collapsible sidebar | Fixed sidebar |
| SalesDashboard | Bottom tabs | Bottom tabs | Bottom tabs |
| LeadDetailView | Full screen tabs | Full screen tabs | Side panel + detail |
| Tables | Horizontal scroll | Full width | Full width |
| Modals | Full screen | Centered (max-w-lg) | Centered (max-w-2xl) |
| Forms | Single column | Single column | Two column (lg) |

---

## Loading & Error States

### Loading Patterns
| Scenario | Pattern |
|----------|---------|
| Initial page load | Skeleton screens (gray pulses) |
| List fetch | Spinner in list container |
| Modal action | Button spinner + disabled |
| Sync in progress | SyncStatusBadge pulsing |
| Real-time connect | Subtle indicator in header |

### Error Patterns
| Error Type | Display |
|------------|---------|
| Validation | Inline field error (red text) |
| Network/Server | Toast (red) + retry button |
| Auth expired | Redirect to login with message |
| Sync conflict | Silent resolution (LWW), conflict count in badge |
| Critical | ErrorBoundary fallback UI |

### Empty States
| Context | Empty State |
|---------|-------------|
| No leads | Illustration + "Add your first lead" CTA |
| No follow-ups | "No scheduled follow-ups" + create button |
| No call history | "No calls logged yet" |
| No agents | "No agents yet" + create button |
| Search no results | "No leads match your filters" |

---

## Forms & Validation

### Lead Creation/Edit Form
| Field | Type | Validation |
|-------|------|------------|
| Business Name | text | Required, max 200 |
| Category | select | Required (Gym default) |
| Phone | tel | Required, Indian format |
| Alternate Phone | tel | Optional, Indian format |
| Contact Person | text | Optional |
| Address | textarea | Optional |
| Locality | text | Optional |
| Pincode | text | Optional, 6 digits |
| Website | url | Optional, valid URL |
| Rating | number | Optional, 0-5 step 0.1 |
| Review Count | number | Optional, integer |
| Custom Notes | textarea | Optional |

### Call Outcome Form
| Field | Type | Validation |
|-------|------|------------|
| Outcome | select (radio) | Required |
| Duration | auto/number | Auto from state machine |
| Verification | radio | UNVERIFIED default |
| Remark | textarea | Optional |

### Follow-up Form
| Field | Type | Validation |
|-------|------|------------|
| Title | text | Required, max 100 |
| Scheduled At | datetime-local | Required, future |
| Priority | select | Required (MEDIUM default) |
| Notes | textarea | Optional |

---

## Theme & Visual Design

### Color System (CSS Variables in index.css)
```css
:root {
  /* Brand Colors */
  --color-brand-50: #fef7ee;
  --color-brand-100: #fdedd6;
  --color-brand-500: #e8a838;  /* Primary gold */
  --color-brand-600: #d4962e;
  --color-brand-700: #b88126;

  /* Semantic Colors */
  --color-success: #16a34a;
  --color-warning: #eab308;
  --color-error: #dc2626;
  --color-info: #2563eb;

  /* Neutral (Day) */
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f8fafc;
  --color-text-primary: #0f172a;
  --color-text-secondary: #475569;
  --color-border: #e2e8f0;

  /* Neutral (Night) */
  --color-bg-primary-dark: #0f172a;
  --color-bg-secondary-dark: #1e293b;
  --color-text-primary-dark: #f8fafc;
  --color-text-secondary-dark: #94a3b8;
  --color-border-dark: #334155;
}
```

### Typography
- **Font Family:** Inter (self-hosted via @fontsource/inter)
- **Base Size:** 16px (1rem)
- **Scale:** `text-xs` (0.75rem) → `text-sm` (0.875rem) → `text-base` (1rem) → `text-lg` (1.125rem) → `text-xl` (1.25rem) → `text-2xl` (1.5rem) → `text-3xl` (1.875rem)

### Spacing
- **Base Unit:** 4px (0.25rem)
- **Scale:** `p-1` (4px) → `p-2` (8px) → `p-3` (12px) → `p-4` (16px) → `p-6` (24px) → `p-8` (32px)

### Border Radius
- **Small:** `rounded-sm` (2px) - inputs, badges
- **Medium:** `rounded-md` (6px) - buttons, cards
- **Large:** `rounded-lg` (8px) - modals, containers
- **Full:** `rounded-full` - pills, avatars

### Shadows
- **Subtle:** `shadow-sm` - cards, inputs
- **Medium:** `shadow-md` - modals, dropdowns
- **Large:** `shadow-lg` - FAB, elevated surfaces

---

## Animation & Motion

| Interaction | Animation | Duration |
|-------------|-----------|----------|
| Modal open | Slide up + fade | 200ms |
| Modal close | Slide down + fade | 150ms |
| Tab switch | Cross-fade | 150ms |
| List item add | Slide in + fade | 200ms |
| Sync badge pulse | Scale pulse | 1000ms (loop) |
| Toast appear | Slide in + fade | 200ms |
| Button press | Scale down | 100ms |
| Reduced motion | Disabled | N/A |

---

## Accessibility Baseline

See **08_ACCESSIBILITY.md** for detailed accessibility specification. Key implemented features:
- Semantic HTML5 elements
- Focus visible outlines
- ARIA labels on icon buttons
- Color contrast (WCAG AA)
- Keyboard navigation
- Screen reader compatible

---

## Platform-Specific UI

### Android (Capacitor)
- **Status Bar:** Theme-matched color
- **Navigation Bar:** Theme-matched color
- **Safe Areas:** `env(safe-area-inset-*)` for notches
- **Back Button:** Hardware back closes modals, navigates back
- **Keyboard:** `resize` mode, no viewport shift

### Web (Vercel)
- **PWA:** Manifest configured, service worker (planned)
- **Viewport:** Responsive, no zoom lock
- **Fonts:** Self-hosted Inter, preloaded

---

## Known UI Issues

| Issue | Severity | Status |
|-------|----------|--------|
| No skeleton for LeadDetailView tabs | LOW | Not addressed |
| Date picker not native on mobile web | MEDIUM | Uses datetime-local |
| No virtualization for large lead lists | MEDIUM | MinimalLeadsList loads all |
| Toast queue not implemented | LOW | Single toast only |
| No drag-drop in column mapping | LOW | Click to select only |