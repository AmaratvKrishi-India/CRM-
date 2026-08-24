
---

## PHASE 11: ADMIN PANEL (EMU-3, logged in as ADMIN)

> EMU-3 = Pixel Tablet, API 34, logged in with ADMIN credentials.
> All admin tests run here unless stated otherwise.

### 11.1 Admin Shell Layout & Navigation

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 11.1.1 | Login as ADMIN on EMU-3 | AdminShell loads: dark slate-900 background, sticky header with ShieldCheck icon in purple box |
| 11.1.2 | Observe header left | Admin name displayed, purple "ADMIN" badge (uppercase, 9px), email below in slate-400 |
| 11.1.3 | Observe header right | SyncStatusBadge visible, "Sign Out" button (LogOut icon, slate-700 bg) |
| 11.1.4 | Observe bottom nav bar | 6 tabs visible: Overview (Home icon), Leads (UserCheck), Agents (Users), Data (Database), Reports (BarChart3), Settings (Settings) |
| 11.1.5 | Verify active tab highlight | HOME tab highlighted: purple-400 text, purple-500/10 bg, bold font |
| 11.1.6 | Tap "Leads" tab | LEADS tab activates (purple highlight), AdminLeadsView renders, HOME tab returns to slate-400 |
| 11.1.7 | Tap "Agents" tab | AGENTS tab activates, AdminAgentsView renders |
| 11.1.8 | Tap "Data" tab | DATA tab activates, AdminDataManagementView renders |
| 11.1.9 | Tap "Reports" tab | REPORTS tab activates, AdminReportsView renders |
| 11.1.10 | Tap "Settings" tab | SETTINGS tab activates, Administrator Account card renders |
| 11.1.11 | Tap "Overview" tab | Returns to HOME/AdminDashboardView |
| 11.1.12 | Rapid-tap all 6 tabs in sequence | No crash, no white flash, each view renders correctly |
| 11.1.13 | Rotate tablet to landscape | Layout adapts: max-w-3xl content centered, bottom nav remains sticky |
| 11.1.14 | Rotate back to portrait | Layout restores without state loss |

### 11.2 Admin Dashboard — Header & Quick Actions

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 11.2.1 | On HOME tab, observe top card | Purple gradient card: Sparkles icon + "EXECUTIVE OVERVIEW" label, logo image, "Amaratv Krishi Field CRM" title, welcome text with admin name |
| 11.2.2 | Tap "Sales Mode" button (emerald, PhoneCall icon) | App switches to Field Sales Mode (agent dashboard appears) |
| 11.2.3 | Navigate back to Admin (via app logic) | AdminShell reappears |
| 11.2.4 | Tap "Call History" button (slate-800, Clock icon, purple border) | AdminCallHistoryModal opens |
| 11.2.5 | Observe modal content | List of recent calls: agent name, lead name, duration, outcome, timestamp |
| 11.2.6 | Scroll call list down | More calls load / list scrolls smoothly |
| 11.2.7 | Tap X / close button on modal | Modal closes, back to dashboard |
| 11.2.8 | Tap "Switch to Field Sales Mode" button (purple-600, in sidebar card) | Same as 11.2.2 — enters sales mode |
| 11.2.9 | Return to admin | AdminShell visible |
| 11.2.10 | Tap "Sign Out from Admin Console" (rose button in sidebar) | Session clears, LoginScreen appears |
| 11.2.11 | Re-login as ADMIN | AdminShell loads fresh |

### 11.3 Admin Dashboard — Global Filters

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 11.3.1 | Observe filter bar below header | Filter icon + "Filters:" label, two dropdowns: Date Range + Agent |
| 11.3.2 | Tap Date Range dropdown | Options: All Time, Today, Yesterday, Last 7 Days, Last 30 Days |
| 11.3.3 | Select "Today" | KPI cards refresh showing only today's data |
| 11.3.4 | Select "Last 7 Days" | KPI cards refresh with 7-day data |
| 11.3.5 | Select "Last 30 Days" | KPI cards refresh with 30-day data |
| 11.3.6 | Select "Yesterday" | KPI cards refresh |
| 11.3.7 | Select "All Time" | Full data restored |
| 11.3.8 | Tap Agent dropdown | Options: "All Representatives" + list of agent names |
| 11.3.9 | Select a specific agent | All KPIs, pipeline, performance table filter to that agent |
| 11.3.10 | Select "All Representatives" | Data resets to org-wide |
| 11.3.11 | Combine: "Last 7 Days" + specific agent | Both filters apply simultaneously, data reflects intersection |

### 11.4 Admin Dashboard — KPI Cards

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 11.4.1 | Observe KPI grid | 4 cards in 2x2 grid (or 4-col on tablet): Total Leads, Total Calls, Verified Talk Time, Follow-ups |
| 11.4.2 | Verify Total Leads card | Blue UserPlus icon, large number, sub-text: "X assigned" + "Y unassigned" (amber) |
| 11.4.3 | Tap Total Leads card | Navigates to LEADS tab (AdminLeadsView) |
| 11.4.4 | Return to HOME | Dashboard visible |
| 11.4.5 | Verify Total Calls card | Emerald PhoneCall icon, large number, sub-text: "X verified" (emerald) + "Y unverified" |
| 11.4.6 | Tap Total Calls card | AdminCallHistoryModal opens |
| 11.4.7 | Close modal | Back to dashboard |
| 11.4.8 | Verify Verified Talk Time card | Purple Clock icon, formatted duration (e.g. "2h 15m"), sub-text: "Avg: Xm / verified call" |
| 11.4.9 | Verify Follow-ups card | Amber Calendar icon, total count, sub-text: "X today" (amber) + "Y overdue" (rose) or "Z done" (emerald) |
| 11.4.10 | Verify numbers match reality | Cross-check counts against known data in Supabase |

### 11.5 Admin Dashboard — Pipeline Visualizer

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 11.5.1 | Scroll to pipeline section | "SALES PIPELINE STAGE DISTRIBUTION" header with TrendingUp icon, "Tap stage to view leads" hint |
| 11.5.2 | Observe stage rows | Each row: stage label, count, percentage, colored progress bar |
| 11.5.3 | Verify bar colors | CUSTOMER=emerald, NOT_INTERESTED/DO_NOT_CONTACT/WRONG_NUMBER=rose, INTERESTED/SAMPLE_REQUESTED/NEGOTIATION=purple, FOLLOW_UP=amber, others=blue |
| 11.5.4 | Verify bar widths | Proportional to percentage (min 4%) |
| 11.5.5 | Tap "NEW" stage row | Navigates to LEADS tab filtered by NEW status |
| 11.5.6 | Return to HOME | Dashboard visible |
| 11.5.7 | Tap "INTERESTED" stage row | Navigates to LEADS tab filtered by INTERESTED |
| 11.5.8 | Return to HOME | Dashboard visible |
| 11.5.9 | Tap "CUSTOMER" stage row | Navigates to LEADS tab filtered by CUSTOMER |
| 11.5.10 | Return to HOME | Dashboard visible |
| 11.5.11 | With agent filter active, tap a stage | Navigates to LEADS with both status + agent filter applied |

### 11.6 Admin Dashboard — Agent Performance Table

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 11.6.1 | Scroll to performance section | "REPRESENTATIVE PERFORMANCE SCORECARDS" header with Users icon |
| 11.6.2 | Tap "Manage Accounts" link (purple, ArrowRight) | Navigates to AGENTS tab |
| 11.6.3 | Return to HOME | Dashboard visible |
| 11.6.4 | Observe performance table | Rows per agent: name, calls count, verified calls, talk time, leads assigned, conversion rate |
| 11.6.5 | Tap on an agent row | AgentPerformanceDetail modal/panel opens showing detailed stats for that agent |
| 11.6.6 | Observe detail content | Agent name, avatar/initials, KPI breakdown, recent activity |
| 11.6.7 | Close detail | Back to performance table |
| 11.6.8 | Tap different agent row | Detail for that agent opens |
| 11.6.9 | Close detail | Back to table |
| 11.6.10 | Verify data matches date range filter | Change date range → table numbers update |

### 11.7 Admin Dashboard — Live Activity Feed

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 11.7.1 | Scroll to activity feed section | LiveActivityFeed component visible with recent activities |
| 11.7.2 | Observe feed items | Each item: activity type icon, description text, agent name, relative timestamp |
| 11.7.3 | On EMU-1 (agent), log a call outcome | Activity created |
| 11.7.4 | Observe EMU-3 feed (within 5s) | New activity appears at top of feed via Realtime WebSocket |
| 11.7.5 | On EMU-1, change a lead status | Activity created |
| 11.7.6 | Observe EMU-3 feed | Lead status change activity appears |
| 11.7.7 | Scroll feed down | Older activities visible, smooth scroll |
| 11.7.8 | Verify KPI auto-refresh | After EMU-1 activity, KPI numbers on EMU-3 update without manual refresh |

### 11.8 Admin Leads View — Layout & KPI Counters

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 11.8.1 | Tap "Leads" bottom tab | AdminLeadsView loads |
| 11.8.2 | Observe KPI row | 3 cards: "Total Leads" (white), "Assigned" (purple), "Unassigned" (amber) with counts |
| 11.8.3 | Observe search bar | Search icon, placeholder "Search leads by business, phone, or locality..." |
| 11.8.4 | Observe filter pills row | Horizontal scrollable pills: "All Leads (N)", "Unassigned (N)", "Assigned (N)", then one pill per agent name |
| 11.8.5 | Verify active pill styling | Active pill: purple-600 bg, white text, shadow. Inactive: slate-800 bg, slate-400 text |

### 11.9 Admin Leads View — Search & Filter

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 11.9.1 | Tap search bar | Keyboard appears, cursor in field |
| 11.9.2 | Type a known business name | List filters in real-time to matching leads |
| 11.9.3 | Clear search text | Full list restores |
| 11.9.4 | Type a known phone number (partial) | Matching leads shown |
| 11.9.5 | Clear search | Full list |
| 11.9.6 | Type a known locality | Leads in that locality shown |
| 11.9.7 | Clear search | Full list |
| 11.9.8 | Type gibberish "zzz999" | Empty state: "No leads found" message |
| 11.9.9 | Clear search | Full list restores |
| 11.9.10 | Tap "Unassigned" pill | List shows only unassigned leads, pill turns purple |
| 11.9.11 | Tap "Assigned" pill | List shows only assigned leads |
| 11.9.12 | Tap a specific agent pill | List shows only that agent's leads |
| 11.9.13 | Tap "All Leads" pill | Full list restores |
| 11.9.14 | Tap status dropdown (if present) | Status options: ALL, NEW, CONTACTED, INTERESTED, etc. |
| 11.9.15 | Select "INTERESTED" | List filters to INTERESTED leads |
| 11.9.16 | Reset to ALL | Full list |
| 11.9.17 | Combine: agent pill + status filter | Intersection of both filters shown |

### 11.10 Admin Leads View — Lead Cards & Single Assignment

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 11.10.1 | Observe a lead card | Business name, phone (Phone icon), locality (MapPin icon), status badge, assigned agent name or "Unassigned" |
| 11.10.2 | Observe checkbox on card | Square/CheckSquare icon on left for multi-select |
| 11.10.3 | Tap checkbox on one lead | Checkbox fills (CheckSquare), lead selected |
| 11.10.4 | Tap checkbox again | Checkbox empties (Square), lead deselected |
| 11.10.5 | Tap "Assign" button on an unassigned lead card | LeadAssignmentModal opens: agent list with radio/select |
| 11.10.6 | Observe modal | Lead business name shown, list of active agents, confirm button |
| 11.10.7 | Select an agent | Agent highlighted/selected |
| 11.10.8 | Tap "Assign" / confirm button | Assignment saves, modal closes, lead card updates to show agent name |
| 11.10.9 | Verify KPI counters update | "Assigned" count +1, "Unassigned" count -1 |
| 11.10.10 | Tap "Assign" on an already-assigned lead | Modal opens showing current agent pre-selected (reassignment) |
| 11.10.11 | Select different agent, confirm | Lead reassigned, card updates |
| 11.10.12 | Cancel assignment modal (X or back) | Modal closes, no change |

### 11.11 Admin Leads View — Bulk Selection & Bulk Assignment

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 11.11.1 | Tap "Select All Filtered" / CheckSquare header | All visible leads selected, checkboxes filled |
| 11.11.2 | Observe selection count | "N selected" indicator appears |
| 11.11.3 | Tap "Clear" | All checkboxes empty, selection cleared |
| 11.11.4 | Select 3 leads individually | 3 checkboxes filled, count shows 3 |
| 11.11.5 | Tap "Bulk Assign" button (appears when selection > 0) | BulkLeadAssignmentModal opens |
| 11.11.6 | Observe modal | "Assign N leads to:" text, agent list |
| 11.11.7 | Select an agent | Agent selected |
| 11.11.8 | Tap confirm | All 3 leads assigned, modal closes, cards update, selection cleared |
| 11.11.9 | Verify KPI counters | Assigned +3, Unassigned -3 |
| 11.11.10 | Filter to "Unassigned", select all, bulk assign | All unassigned leads assigned to chosen agent |
| 11.11.11 | Cancel bulk modal | No changes, selection retained |
| 11.11.12 | Select all filtered → tap "Select All" again | Deselects all (toggle behavior) |

### 11.12 Admin Agents View — Layout & Stats

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 11.12.1 | Tap "Agents" bottom tab | AdminAgentsView loads |
| 11.12.2 | Observe top banner | Users icon + "Sales Representatives" title, subtitle text, "Provision New Agent" button (blue, UserPlus icon) |
| 11.12.3 | Observe KPI stats row | 3 tappable cards: Total (blue), Active (emerald), Inactive (rose) with counts |
| 11.12.4 | Observe search bar | Search icon, placeholder "Search by name, email or phone..." |
| 11.12.5 | Observe agent cards | Each card: agent name, email, phone, status badge (ACTIVE=emerald / INACTIVE=rose), action buttons |

### 11.13 Admin Agents View — Search & Filter

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 11.13.1 | Tap "Active" KPI card | List filters to ACTIVE agents only, card highlights (emerald border) |
| 11.13.2 | Tap "Inactive" KPI card | List filters to INACTIVE agents, card highlights (rose border) |
| 11.13.3 | Tap "Total" KPI card | All agents shown, card highlights (blue border) |
| 11.13.4 | Type agent name in search | List filters to matching agent |
| 11.13.5 | Type agent email (partial) | Matching agent shown |
| 11.13.6 | Type agent phone (partial) | Matching agent shown |
| 11.13.7 | Clear search | Full list restores |
| 11.13.8 | Type gibberish | Empty state: Users icon, "No sales agents found", "No agents matched your search query" text |
| 11.13.9 | Clear search | List restores |

### 11.14 Admin Agents View — Create Agent

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 11.14.1 | Tap "Provision New Agent" button | CreateAgentModal opens |
| 11.14.2 | Observe modal fields | Name, Email, Phone, Password fields (all required) |
| 11.14.3 | Leave all empty, tap "Create" | Validation errors shown on each field |
| 11.14.4 | Enter name only, tap "Create" | Email/phone/password errors remain |
| 11.14.5 | Enter invalid email "notanemail" | Email validation error |
| 11.14.6 | Enter valid name + email + phone + short password (< 6 chars) | Password length error |
| 11.14.7 | Enter all valid data | No errors |
| 11.14.8 | Tap "Create" / submit | Loading spinner, then success: modal closes, new agent card appears in list |
| 11.14.9 | Verify new agent card | Name, email, phone shown, status = ACTIVE |
| 11.14.10 | Verify Total KPI incremented | Total count +1, Active count +1 |
| 11.14.11 | Cancel create modal (X) | Modal closes, no agent created |

### 11.15 Admin Agents View — Edit Agent

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 11.15.1 | Tap "Edit" button on an agent card | EditAgentModal opens with current values pre-filled |
| 11.15.2 | Verify pre-filled fields | Name, email, phone match agent data |
| 11.15.3 | Change name field | New name typed |
| 11.15.4 | Tap "Save" / submit | Loading, then success: modal closes, agent card shows updated name |
| 11.15.5 | Reopen edit | Updated name pre-filled |
| 11.15.6 | Change phone number | New phone typed |
| 11.15.7 | Save | Phone updated on card |
| 11.15.8 | Cancel edit | No changes applied |

### 11.16 Admin Agents View — Activate / Deactivate

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 11.16.1 | Tap "Deactivate" button on an ACTIVE agent | ConfirmStatusModal opens: "Deactivate [name]?" warning |
| 11.16.2 | Observe modal | Warning text, Cancel + Confirm buttons |
| 11.16.3 | Tap "Cancel" | Modal closes, agent remains ACTIVE |
| 11.16.4 | Tap "Deactivate" again | ConfirmStatusModal opens |
| 11.16.5 | Tap "Confirm" | Agent status changes to INACTIVE, badge turns rose, card updates |
| 11.16.6 | Verify KPI | Active -1, Inactive +1 |
| 11.16.7 | Tap "Activate" on the INACTIVE agent | ConfirmStatusModal: "Activate [name]?" |
| 11.16.8 | Confirm | Agent returns to ACTIVE, badge emerald |
| 11.16.9 | Verify KPI | Active +1, Inactive -1 |
| 11.16.10 | On EMU-1, attempt login with deactivated agent credentials | Login fails or shows "Account deactivated" error |
| 11.16.11 | Reactivate agent on EMU-3 | Status ACTIVE |
| 11.16.12 | On EMU-1, login again with same credentials | Login succeeds |

### 11.17 Admin Agents View — Delete Agent

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 11.17.1 | Tap "Delete" button on an agent card | DeleteAgentModal opens with strong warning |
| 11.17.2 | Observe modal | Red/rose warning, agent name, "This action cannot be undone" text, Cancel + Delete buttons |
| 11.17.3 | Tap "Cancel" | Modal closes, agent untouched |
| 11.17.4 | Tap "Delete" again | DeleteAgentModal opens |
| 11.17.5 | Tap "Delete" / confirm | Loading, then agent removed from list |
| 11.17.6 | Verify KPI | Total -1 |
| 11.17.7 | Verify leads assigned to deleted agent | Leads become unassigned or retain reference (check behavior) |
| 11.17.8 | Search for deleted agent name | Not found in list |

### 11.18 Admin Data Management — Sub-Tab Navigation

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 11.18.1 | Tap "Data" bottom tab | AdminDataManagementView loads |
| 11.18.2 | Observe sub-tab bar | 4 tabs: DATABASE, IMPORTS, CLEANUP, HEALTH |
| 11.18.3 | Verify default active tab | DATABASE active (highlighted) |
| 11.18.4 | Tap "IMPORTS" | Import Center renders, IMPORTS highlighted |
| 11.18.5 | Tap "CLEANUP" | Duplicate Cleanup renders |
| 11.18.6 | Tap "HEALTH" | Health & Sync Inspector renders |
| 11.18.7 | Tap "DATABASE" | Back to Lead Database Explorer |

### 11.19 Admin Data — DATABASE Sub-Tab (Lead Explorer)

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 11.19.1 | On DATABASE tab, observe layout | Search bar, filter dropdowns (Status, Locality, Source), lead list, total count |
| 11.19.2 | Observe total count | "N leads" displayed |
| 11.19.3 | Type in search bar | Leads filter by business/phone/locality |
| 11.19.4 | Clear search | Full list |
| 11.19.5 | Tap Status filter dropdown | Options: ALL + all LeadStatus values |
| 11.19.6 | Select "CUSTOMER" | Only CUSTOMER leads shown |
| 11.19.7 | Reset to ALL | Full list |
| 11.19.8 | Tap Locality filter dropdown | Options: ALL + distinct localities from data |
| 11.19.9 | Select a locality | Only leads from that locality |
| 11.19.10 | Reset to ALL | Full list |
| 11.19.11 | Tap Source filter dropdown | Options: ALL + distinct sources (e.g. EXCEL_IMPORT, MANUAL) |
| 11.19.12 | Select "EXCEL_IMPORT" | Only imported leads shown |
| 11.19.13 | Reset to ALL | Full list |
| 11.19.14 | Combine all 3 filters + search | Intersection shown |
| 11.19.15 | Scroll lead list | Smooth scroll, all columns visible: name, phone, locality, status, source, assigned agent |
| 11.19.16 | Verify lead count matches filter | Displayed count = filtered results |

### 11.20 Admin Data — IMPORTS Sub-Tab

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 11.20.1 | Tap "IMPORTS" sub-tab | Import Center renders |
| 11.20.2 | Observe layout | "Open Excel Importer" button + Import Audit History list |
| 11.20.3 | Tap "Open Excel Importer" | ExcelImporter component opens (same as Phase 8) |
| 11.20.4 | Close importer | Back to IMPORTS sub-tab |
| 11.20.5 | Observe audit history | List of past imports: filename, date, total rows, imported count, skipped count, status |
| 11.20.6 | Verify most recent import at top | Chronological order |
| 11.20.7 | Tap an audit entry (if expandable) | Details expand: error rows, skip reasons |
| 11.20.8 | Verify audit matches Phase 8 import | The import done in Phase 8 appears here |

### 11.21 Admin Data — CLEANUP Sub-Tab (Duplicates)

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 11.21.1 | Tap "CLEANUP" sub-tab | Duplicate detection runs, loading spinner |
| 11.21.2 | Observe results | Duplicate clusters grouped by phone number |
| 11.21.3 | Observe a cluster | Phone number header, list of duplicate leads with names/sources |
| 11.21.4 | Verify cluster count | Matches known duplicate data |
| 11.21.5 | Tap "Merge/Cleanup" button on a cluster | Confirmation dialog: "Soft-delete N duplicates?" |
| 11.21.6 | Cancel | No changes |
| 11.21.7 | Tap cleanup again, confirm | Duplicates soft-deleted, success message appears, cluster removed from list |
| 11.21.8 | Verify success message | Green toast/banner: "Cleanup complete" |
| 11.21.9 | Switch to DATABASE tab, search deleted lead's phone | Only the kept lead appears, deleted ones hidden |
| 11.21.10 | If no duplicates exist | Empty state: "No duplicates found" with CheckCircle icon |

### 11.22 Admin Data — HEALTH Sub-Tab

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 11.22.1 | Tap "HEALTH" sub-tab | Health metrics load |
| 11.22.2 | Observe metrics grid | Total Leads, Assigned, Unassigned, Active Agents, Inactive Agents, Total Calls, Verified Calls |
| 11.22.3 | Observe sync section | Pending Sync Count, Failed Sync Count, Last Sync Timestamp |
| 11.22.4 | Verify Pending Sync = 0 | After successful sync, outbox empty |
| 11.22.5 | Verify Failed Sync = 0 | No failed operations |
| 11.22.6 | Verify Last Sync timestamp | Recent, matches actual last sync time |
| 11.22.7 | On EMU-1, go offline, make a change, come back online | Pending sync count temporarily > 0 on EMU-3 HEALTH tab |
| 11.22.8 | After EMU-1 syncs | Pending returns to 0 |
| 11.22.9 | Tap "Refresh" button (RefreshCw icon) if present | Metrics reload with spinner |

### 11.23 Admin Reports View — Tab Navigation

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 11.23.1 | Tap "Reports" bottom tab | AdminReportsView loads |
| 11.23.2 | Observe report tabs | 7 tabs: LEADS, CALLS, PRODUCTIVITY, FOLLOW_UPS, WHATSAPP, IMPORTS, ACTIVITY |
| 11.23.3 | Verify default tab | LEADS active |
| 11.23.4 | Observe filter bar | ReportFilterBar: Date preset dropdown, Agent dropdown, Locality dropdown |
| 11.23.5 | Tap each tab in sequence | Each renders its report content without crash |

### 11.24 Admin Reports — LEADS Report

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 11.24.1 | On LEADS tab | Lead report KPI cards visible: total leads, by status breakdown |
| 11.24.2 | Verify KPI numbers | Match known data |
| 11.24.3 | Change date preset to "Last 7 Days" | Report refreshes with 7-day data |
| 11.24.4 | Change agent filter | Report shows only that agent's leads |
| 11.24.5 | Change locality filter | Report filters by locality |
| 11.24.6 | Reset all filters to ALL | Full report |
| 11.24.7 | Tap "Export CSV" / Download button | CSV file downloads / share intent opens |
| 11.24.8 | Verify export loading state | Button shows spinner during export |

### 11.25 Admin Reports — CALLS Report

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 11.25.1 | Tap "CALLS" tab | Call report renders: total calls, verified calls, talk time KPIs |
| 11.25.2 | Verify KPI cards | Total calls count, verified count, total talk time, avg duration |
| 11.25.3 | Change date filter | Numbers update |
| 11.25.4 | Change agent filter | Shows only that agent's calls |
| 11.25.5 | Observe call breakdown | By outcome type, by verification status |

### 11.26 Admin Reports — PRODUCTIVITY Report

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 11.26.1 | Tap "PRODUCTIVITY" tab | Agent productivity table renders |
| 11.26.2 | Observe table columns | Agent name, calls made, verified calls, talk time, leads handled, follow-ups completed |
| 11.26.3 | Verify data per agent | Matches known activity |
| 11.26.4 | Change date range | Table updates |
| 11.26.5 | Observe ranking/sorting | Agents sorted by productivity metric |

### 11.27 Admin Reports — FOLLOW_UPS Report

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 11.27.1 | Tap "FOLLOW_UPS" tab | Follow-up report renders |
| 11.27.2 | Observe KPIs | Total follow-ups, completed, overdue, pending |
| 11.27.3 | Change date filter | Numbers update |
| 11.27.4 | Change agent filter | Agent-specific follow-up stats |

### 11.28 Admin Reports — WHATSAPP Report

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 11.28.1 | Tap "WHATSAPP" tab | WhatsApp engagement report renders |
| 11.28.2 | Observe KPIs | Total messages sent, templates used, attachment count |
| 11.28.3 | Change date filter | Numbers update |
| 11.28.4 | Change agent filter | Agent-specific WhatsApp stats |

### 11.29 Admin Reports — IMPORTS Report

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 11.29.1 | Tap "IMPORTS" tab | Import audit report renders |
| 11.29.2 | Observe data | Import batches: filename, date, rows, success/skip counts |
| 11.29.3 | Verify matches Phase 8 import | Test import visible |

### 11.30 Admin Reports — ACTIVITY Report

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 11.30.1 | Tap "ACTIVITY" tab | Activity log renders |
| 11.30.2 | Observe entries | Chronological list: action type, actor, target, timestamp |
| 11.30.3 | Change date filter | Activity filtered by range |
| 11.30.4 | Change agent filter | Only that agent's activities |
| 11.30.5 | Scroll list | Smooth, all entries visible |

### 11.31 Admin Settings Tab

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 11.31.1 | Tap "Settings" bottom tab | Administrator Account card renders |
| 11.31.2 | Observe fields | Name, Email, Phone, Role (purple "ADMIN"), Status (emerald) |
| 11.31.3 | Verify data matches logged-in admin | All fields correct |
| 11.31.4 | Observe additional sections | Any preference toggles, sync controls, logout button |
| 11.31.5 | Tap "Sign Out" in settings | Session clears, LoginScreen appears |
| 11.31.6 | Re-login | AdminShell loads |

### 11.32 Admin Header — Sign Out Button

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 11.32.1 | Tap "Sign Out" button in header (LogOut icon) | Session clears immediately |
| 11.32.2 | Observe | LoginScreen appears, no admin data visible |
| 11.32.3 | Press hardware back | Cannot navigate back to admin (session gone) |
| 11.32.4 | Re-login as ADMIN | Fresh AdminShell |

### 11.33 Admin — SyncStatusBadge

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 11.33.1 | Observe SyncStatusBadge in header | Shows current sync state (SYNCED green dot / IDLE) |
| 11.33.2 | Disable network on EMU-3 | Badge transitions to OFFLINE (amber/red) |
| 11.33.3 | Re-enable network | Badge transitions: SYNCING → SYNCED |
| 11.33.4 | Tap badge (if tappable) | May trigger manual sync or show details |

---
<!-- PART5 -->
