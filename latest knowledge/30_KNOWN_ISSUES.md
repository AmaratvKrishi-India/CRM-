# 30 - KNOWN ISSUES

## Document Metadata
- **DOCUMENT_STATUS:** CURRENT
- **LAST_VERIFIED:** 2026-08-25
- **SOURCE_OF_TRUTH:** `BUGFIX_RESULTS.md`, `GATES.md`, test results, audit reports
- **SCOPE:** Only confirmed current issues (not historical bugs)
- **RELATED_DOCUMENTS:** `BUGFIX_RESULTS.md`, `GATES.md`, `16_CURRENT_STATE.md`

---

## Issue Classification

| Category | Description |
|----------|-------------|
| **BUG** | Functional defect affecting users |
| **ACCEPTED_RISK** | Known limitation, consciously accepted |
| **CAPABILITY_GAP** | Feature not implemented, not a bug |
| **TECHNICAL_DEBT** | Code quality issue, no user impact |

---

## Current Issues (2026-08-25)

### BUG-001: Mobile Web Performance (LCP/TBT)
| Field | Value |
|-------|-------|
| **ID** | PERF-001 |
| **Severity** | MEDIUM |
| **Type** | BUG |
| **Description** | Mobile LCP (3.2s) exceeds 2.5s target; TBT (220ms) exceeds 200ms target |
| **Reproduction** | Run Lighthouse mobile audit on production URL |
| **Impact** | Poor mobile user experience, potential SEO impact |
| **Workaround** | None |
| **Status** | OPEN |
| **Release Impact** | None (released) |
| **Root Cause** | Large main bundle, font loading, no preloading |
| **Fix Plan** | Preload fonts, tree-shake lucide icons, optimize images |

### BUG-002: Accessibility - Color Contrast
| Field | Value |
|-------|-------|
| **ID** | A11Y-001 |
| **Severity** | MEDIUM |
| **Type** | BUG |
| **Description** | Brand gold (#e8a838) on white fails WCAG AA (3.2:1 ratio) |
| **Reproduction** | Run axe-core or Lighthouse accessibility audit |
| **Impact** | WCAG AA non-compliance, readability issues for low vision |
| **Workaround** | None |
| **Status** | OPEN |
| **Release Impact** | None (released) |
| **Fix Plan** | Darken brand gold for text (#d4962e), keep #e8a838 for backgrounds |

### BUG-003: Accessibility - Missing Skip Links
| Field | Value |
|-------|-------|
| **ID** | A11Y-002 |
| **Severity** | LOW |
| **Type** | BUG |
| **Description** | No "Skip to main content" link for keyboard users |
| **Reproduction** | Tab through page from top |
| **Impact** | Keyboard users must tab through full header |
| **Workaround** | None |
| **Status** | OPEN |
| **Release Impact** | None |
| **Fix Plan** | Add skip link as first focusable element |

---

### ACCEPTED_RISK-001: No iOS Support
| Field | Value |
|-------|-------|
| **ID** | PLAT-001 |
| **Severity** | LOW |
| **Type** | ACCEPTED_RISK |
| **Description** | Capacitor iOS not built/tested; Android-only distribution |
| **Reproduction** | N/A |
| **Impact** | iOS users cannot use app |
| **Workaround** | Web app works on iOS Safari |
| **Status** | ACCEPTED |
| **Release Impact** | None |
| **Rationale** | Target market is Android (field sales in Lucknow); iOS not in scope |

### ACCEPTED_RISK-002: No Physical Device Testing
| Field | Value |
|-------|-------|
| **ID** | TEST-001 |
| **Severity** | MEDIUM |
| **Type** | ACCEPTED_RISK |
| **Description** | All Android testing on AVDs only; no physical device verification |
| **Reproduction** | N/A |
| **Impact** | Potential device-specific bugs undetected |
| **Workaround** | 3 AVDs with different API levels tested |
| **Status** | ACCEPTED |
| **Release Impact** | None |
| **Rationale** | AVDs cover target API range; physical devices not available |

### ACCEPTED_RISK-003: No Encryption for Local Data
| Field | Value |
|-------|-------|
| **ID** | SEC-001 |
| **Severity** | MEDIUM |
| **Type** | ACCEPTED_RISK |
| **Description** | Dexie/IndexedDB data not encrypted at rest on device |
| **Reproduction** | N/A |
| **Impact** | Physical device access could expose data |
| **Workaround** | Android `allowBackup=false`, device encryption |
| **Status** | ACCEPTED |
| **Release Impact** | None |
| **Rationale** | Internal tool, device encryption sufficient; no sensitive financial data |

### ACCEPTED_RISK-004: No MFA for Authentication
| Field | Value |
|-------|-------|
| **ID** | AUTH-001 |
| **Severity** | MEDIUM |
| **Type** | ACCEPTED_RISK |
| **Description** | Only email/password auth; no MFA/TOTP |
| **Reproduction** | N/A |
| **Impact** | Credential compromise = full account access |
| **Workaround** | Strong password policy, session rotation |
| **Status** | ACCEPTED |
| **Release Impact** | None |
| **Rationale** | Internal tool, limited user base, low attack surface |

### ACCEPTED_RISK-005: Cross-Org Restore Allowed
| Field | Value |
|-------|-------|
| **ID** | DATA-001 |
| **Severity** | LOW |
| **Type** | ACCEPTED_RISK |
| **Description** | Backup restore allows cross-organization (warning only, not blocked) |
| **Reproduction** | Restore backup from different org |
| **Impact** | Potential data leakage if admin error |
| **Workaround** | Warning shown in UI; org ID displayed |
| **Status** | ACCEPTED |
| **Release Impact** | None |
| **Rationale** | Admin-only feature; warning sufficient for internal use |

---

### CAPABILITY_GAP-001: No PWA/Service Worker
| Field | Value |
|-------|-------|
| **ID** | FEAT-001 |
| **Severity** | LOW |
| **Type** | CAPABILITY_GAP |
| **Description** | Web app not installable as PWA; no offline web support |
| **Reproduction** | Open web app on mobile, no install prompt |
| **Impact** | Web users cannot install; offline web not supported |
| **Workaround** | Android app for offline; web requires network |
| **Status** | PLANNED |
| **Release Impact** | None |
| **Planned** | Q3 2026 |

### CAPABILITY_GAP-002: No Push Notifications (FCM)
| Field | Value |
|-------|-------|
| **ID** | FEAT-002 |
| **Severity** | LOW |
| **Type** | CAPABILITY_GAP |
| **Description** | Only local notifications; no FCM push for background alerts |
| **Reproduction** | N/A |
| **Impact** | No server-initiated notifications |
| **Workaround** | Local notifications for follow-ups; realtime for in-app |
| **Status** | PLANNED |
| **Release Impact** | None |
| **Planned** | Q4 2026 |

### CAPABILITY_GAP-003: No Multi-Language Support
| Field | Value |
|-------|-------|
| **ID** | FEAT-003 |
| **Severity** | LOW |
| **Type** | CAPABILITY_GAP |
| **Description** | English only; no Hindi/English toggle for Lucknow market |
| **Reproduction** | N/A |
| **Impact** | Non-English speakers may struggle |
| **Workaround** | English UI; field agents bilingual |
| **Status** | PLANNED |
| **Release Impact** | None |
| **Planned** | Q1 2027 |

### CAPABILITY_GAP-004: No Scheduled/Recurring Follow-ups
| Field | Value |
|-------|-------|
| **ID** | FEAT-004 |
| **Severity** | LOW |
| **Type** | CAPABILITY_GAP |
| **Description** | Follow-ups are one-time only; no recurring schedules |
| **Reproduction** | Create follow-up, no repeat option |
| **Impact** | Manual re-entry for recurring tasks |
| **Workaround** | Manual re-create |
| **Status** | PLANNED |
| **Release Impact** | None |
| **Planned** | Q2 2027 |

### CAPABILITY_GAP-005: No Photo Attachments for Leads
| Field | Value |
|-------|-------|
| **ID** | FEAT-005 |
| **Severity** | LOW |
| **Type** | CAPABILITY_GAP |
| **Description** | Cannot attach photos to leads (gym photos, visiting cards) |
| **Reproduction** | N/A |
| **Impact** | Limited visual context for leads |
| **Workaround** | Notes in remarks |
| **Status** | PLANNED |
| **Release Impact** | None |
| **Planned** | Q3 2027 |

---

### TECHNICAL_DEBT-001: No Virtualization for Large Lists
| Field | Value |
|-------|-------|
| **ID** | TECH-001 |
| **Severity** | LOW |
| **Type** | TECHNICAL_DEBT |
| **Description** | Lead lists render all items; no virtualization |
| **Reproduction** | Load 1000+ leads |
| **Impact** | Memory/performance degradation at scale |
| **Workaround** | Current dataset < 200 leads |
| **Status** | OPEN |
| **Release Impact** | None |
| **Fix Plan** | React Window / react-virtual when needed |

### TECHNICAL_DEBT-002: No Centralized Error Reporting
| Field | Value |
|-------|-------|
| **ID** | TECH-002 |
| **Severity** | LOW |
| **Type** | TECHNICAL_DEBT |
| **Description** | Errors only in console + toast; no Sentry/DataDog integration |
| **Reproduction** | N/A |
| **Impact** | Hard to track production errors |
| **Workaround** | Manual log review |
| **Status** | OPEN |
| **Release Impact** | None |
| **Fix Plan** | Add Sentry when scale requires |

### TECHNICAL_DEBT-003: No Performance Budgets in CI
| Field | Value |
|-------|-------|
| **ID** | TECH-003 |
| **Severity** | LOW |
| **Type** | TECHNICAL_DEBT |
| **Description** | No automated performance regression detection |
| **Reproduction** | N/A |
| **Impact** | Performance regressions may slip through |
| **Workaround** | Manual Lighthouse per release |
| **Status** | PLANNED |
| **Release Impact** | None |
| **Fix Plan** | Lighthouse CI + bundle size gate |

### TECHNICAL_DEBT-004: Single Toast Queue
| Field | Value |
|-------|-------|
| **ID** | TECH-004 |
| **Severity** | LOW |
| **Type** | TECHNICAL_DEBT |
| **Description** | Only one toast shown at a time; new replaces old |
| **Reproduction** | Trigger multiple toasts rapidly |
| **Impact** | User may miss notifications |
| **Workaround** | Long duration + action buttons |
| **Status** | OPEN |
| **Release Impact** | None |
| **Fix Plan** | Toast stack/queue component |

### TECHNICAL_DEBT-005: No Visual Regression Testing
| Field | Value |
|-------|-------|
| **ID** | TECH-005 |
| **Severity** | LOW |
| **Type** | TECHNICAL_DEBT |
| **Description** | UI changes not automatically caught |
| **Reproduction** | N/A |
| **Impact** | Visual bugs may slip through |
| **Workaround** | Manual QA per release |
| **Status** | OPEN |
| **Release Impact** | None |
| **Fix Plan** | Playwright visual comparison when needed |

---

## Issue Summary

| Category | Count | Critical | High | Medium | Low |
|----------|-------|----------|------|--------|-----|
| **BUG** | 3 | 0 | 0 | 2 | 1 |
| **ACCEPTED_RISK** | 5 | 0 | 0 | 3 | 2 |
| **CAPABILITY_GAP** | 5 | 0 | 0 | 0 | 5 |
| **TECHNICAL_DEBT** | 5 | 0 | 0 | 0 | 5 |
| **TOTAL** | **18** | **0** | **0** | **5** | **13** |

---

## Resolution Tracking

| Issue ID | Target Resolution | Owner | Status |
|----------|-------------------|-------|--------|
| PERF-001 | Q3 2026 | Frontend | PLANNED |
| A11Y-001 | Q3 2026 | Frontend | PLANNED |
| A11Y-002 | Q3 2026 | Frontend | PLANNED |
| TECH-001 | When needed | Frontend | BACKLOG |
| TECH-002 | Q4 2026 | Backend | PLANNED |
| TECH-003 | Q3 2026 | DevOps | PLANNED |

---

## Historical Issues (Resolved in v2.0.0)

The following issues were fixed in the v2.0.0 release (see `BUGFIX_RESULTS.md`):

| Bug ID | Description | Fixed In | Verification |
|--------|-------------|----------|--------------|
| BUG-1 | Call duration not verified | v2.0.0 | Migration 7 + tests |
| BUG-2 | Message history duplicate realtime | v2.0.0 | Insert-if-absent |
| BUG-3 | Follow-up notification not firing | v2.0.0 | Local notifications |
| BUG-4 | Outbox enqueue not atomic | v2.0.0 | Transaction fix |
| BUG-5 | LWW tie-break not deterministic | v2.0.0 | REMOTE wins |
| BUG-6 | Agent sees other agents' leads | v2.0.0 | Migration 6 RLS |
| BUG-7 | Sync conflict resolver missing | v2.0.0 | 4-rule resolver |
| BUG-8 | Delete not propagated (soft delete) | v2.0.0 | Migration 7 CASCADE |
| BUG-9 | Backup restore loses unsynced data | v2.0.0 | Outbox rebuild |
| BUG-10 | Realtime not triggering sync | v2.0.0 | SyncEngine integration |
| BUG-11 | Call lifecycle state machine gaps | v2.0.0 | Complete state machine |

---

## Issue Reporting Process

1. **User reports** → GitHub Issue with template
2. **Triage** → Assign category, severity, owner
3. **Reproduce** → Verify in local/staging
4. **Fix** → Branch, fix, test, PR
5. **Verify** → All tests pass, manual QA
6. **Release** → Include in next version

---

## Contact

For issue escalation or questions:
- **Technical Lead:** [Contact]
- **QA Lead:** [Contact]
- **Security:** [Contact]