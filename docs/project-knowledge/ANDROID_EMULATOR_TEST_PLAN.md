# Android Studio Emulator Test Plan (DETAILED)
## Amaratv Krishi Sales CRM — Tap-by-Tap Functional Coverage

**App:** com.amaratvkrishi.salescrm (Amaratv Krishi Sales CRM)
**Platform:** Android via Capacitor 8, WebView-based UI
**Backend:** Supabase (Auth, Postgres, Realtime)
**Local DB:** Dexie (IndexedDB) — offline-first
**Test Environment:** 3 Android Studio Emulators (AVD)
**Date:** 2026-08-23
**Total Test Cases:** 1157 individual steps across 188 sub-sections, 18 phases

---

## 0. EMULATOR SETUP & PRE-TEST CHECKLIST

### 0.1 Emulator Configuration (Android Studio > Device Manager)

| ID | Device Profile | API | RAM | Purpose |
|----|---------------|-----|-----|---------|
| EMU-1 | Pixel 7, 1080x2400, 420dpi | API 34 (Android 14) | 2048 MB | Primary AGENT device — all sales flows |
| EMU-2 | Pixel 5, 1080x2340, 440dpi | API 33 (Android 13) | 2048 MB | Second AGENT — conflict & multi-user tests |
| EMU-3 | Pixel Tablet, 2560x1600, 320dpi | API 34 (Android 14) | 4096 MB | ADMIN panel — large-screen layout verification |

### 0.2 Build & Install Steps (repeat for each emulator)

1. Open Android Studio, load project from `C:\Users\PC\Desktop\calling app\android`.
2. Ensure `npm run build` has produced fresh `dist/` and `npx cap sync android` has copied web assets.
3. Select EMU-1 in device dropdown, click Run (green triangle) or `Shift+F10`.
4. Wait for "BUILD SUCCESSFUL" in Build panel, app auto-launches on emulator.
5. Repeat for EMU-2 and EMU-3 (use `adb -s emulator-5556 install` if Android Studio only targets one).
6. Verify app icon appears in launcher: drag up from bottom > find "Amaratv Krishi Sales CRM".

### 0.3 Pre-Test Conditions Per Emulator

| Condition | EMU-1 | EMU-2 | EMU-3 |
|-----------|-------|-------|-------|
| WhatsApp installed | YES (install via APK) | NO (test fallback) | NO |
| Network ON at start | YES | YES | YES |
| Notification permission | Grant when prompted | Deny (test denial path) | Grant |
| User account | agent1@amaratvkrishi.com | agent2@amaratvkrishi.com | admin@amaratvkrishi.com |
| App data cleared before suite | YES | YES | YES |

### 0.4 Test Data Prerequisites

- Supabase project running with seeded users (1 ADMIN, 2 AGENTs, 1 INACTIVE user).
- At least 50 leads assigned to agent1, 30 to agent2, 20 unassigned.
- At least 5 leads with phoneType='landline', 3 with phoneType='invalid'.
- At least 3 message templates in DB (categories: INTRO, FOLLOW_UP, PRICING).
- 1 catalogue PDF uploaded in app settings.
- Test Excel file ready: `test_import.xlsx` (3 sheets, 100 rows, 5 duplicates, 3 invalid rows).
- Test backup file: `backup_valid.json` and `backup_corrupt.json` (truncated).

### 0.5 ADB Quick Reference (use throughout testing)

```bash
adb devices                                    # list emulators
adb -s emulator-5554 shell am start -n com.amaratvkrishi.salescrm/.MainActivity
adb -s emulator-5554 shell pm clear com.amaratvkrishi.salescrm   # clear app data
adb -s emulator-5554 shell am kill com.amaratvkrishi.salescrm    # simulate process death
adb -s emulator-5554 shell svc wifi disable                      # network off
adb -s emulator-5554 shell svc wifi enable                       # network on
adb -s emulator-5554 shell svc data disable
adb -s emulator-5554 shell svc data enable
adb -s emulator-5554 emu gsm call 9876543210                     # simulate incoming call
adb -s emulator-5554 exec-out screencap -p > evidence.png
adb -s emulator-5554 shell screenrecord /sdcard/test_phase_X.mp4
adb -s emulator-5554 logcat -d -s Capacitor:* > logcat.txt
```

---

## PHASE 1: LOGIN SCREEN & AUTHENTICATION (EMU-1)

### 1.1 First Launch & Login Screen Render

**Precondition:** App data cleared, no active session.

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 1.1.1 | Tap app icon in launcher | Splash screen appears briefly (app icon centered), then LoginScreen loads |
| 1.1.2 | Observe top branding area | Logo image (logo.png) in white rounded square, "Amaratv Krishi" title, subtitle "Field Sales CRM • Lucknow" in emerald text |
| 1.1.3 | Observe description text | "Sign in to access your designated gym leads, pitch catalogue, and sales workflows." visible below subtitle |
| 1.1.4 | Observe login card | Rounded card with "Email / Login ID" label + input field with Mail icon on left, placeholder "e.g. rahul@amaratvkrishi.com" |
| 1.1.5 | Observe password field | "Password" label + input with Lock icon on left, Eye icon on right, placeholder "Enter your password" |
| 1.1.6 | Observe Sign In button | Full-width emerald button with Lock icon + "Sign In" text |
| 1.1.7 | Observe footer text | "Accounts are managed & provisioned by Administrators." with Shield icon |
| 1.1.8 | Observe bottom status | "Amaratv Krishi CRM v2.0 • Offline-First Sales Engine" |
| 1.1.9 | Observe top-right corner | Theme toggle button (Moon icon in day mode) |
| 1.1.10 | Verify NO registration link | No "Sign Up", "Forgot Password", or social login buttons anywhere |

### 1.2 Theme Toggle on Login Screen

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 1.2.1 | Tap Moon icon (top-right) | Background transitions to dark (slate-900 gradient), text becomes white, button shows Sun icon |
| 1.2.2 | Verify card styling | Login card background becomes dark slate-800, inputs become dark |
| 1.2.3 | Tap Sun icon | Returns to light mode, all colors revert |
| 1.2.4 | Kill app, relaunch | Theme preference persists (stays in last selected mode) |

### 1.3 Empty Field Validation

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 1.3.1 | Tap "Sign In" with both fields empty | Error box appears: rose-colored banner with AlertCircle icon, text "Please enter both email and password." |
| 1.3.2 | Type only email "agent1@amaratvkrishi.com", leave password empty, tap Sign In | Same error message appears |
| 1.3.3 | Clear email, type only password "<test-password>", tap Sign In | Same error message appears |
| 1.3.4 | Verify error box styling | Rose background (rose-500/10), rose border, AlertCircle icon on left, text in rose-600 |

### 1.4 Invalid Credentials

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 1.4.1 | Type email: "wrong@amaratvkrishi.com" | Text appears in email field |
| 1.4.2 | Type password: "<wrong-password>" | Dots appear in password field |
| 1.4.3 | Tap "Sign In" | Button shows Loader2 spinner + "Signing In..." text, button becomes disabled (opacity 50%) |
| 1.4.4 | Wait 2-3 seconds | Spinner disappears, error box appears: "Invalid email or password." |
| 1.4.5 | Verify button re-enabled | Sign In button returns to normal state, tappable again |
| 1.4.6 | Verify fields not cleared | Email and password text still present in fields |

### 1.5 Password Visibility Toggle

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 1.5.1 | Type "<test-password>" in password field | Dots/masked characters shown |
| 1.5.2 | Tap Eye icon (right side of password field) | Password text becomes visible as plain text, icon changes to EyeOff |
| 1.5.3 | Tap EyeOff icon | Password masked again, icon reverts to Eye |

### 1.6 Valid AGENT Login

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 1.6.1 | Type email: "agent1@amaratvkrishi.com" | Text visible in field |
| 1.6.2 | Type correct password | Masked in field |
| 1.6.3 | Tap "Sign In" | Button shows spinner + "Signing In...", inputs become disabled (opacity 50%) |
| 1.6.4 | Wait for auth response | LoginScreen disappears, SalesDashboard loads with loading spinner "Loading sales metrics..." |
| 1.6.5 | Dashboard fully loaded | Header shows logo + "Amaratv Krishi" + "Lucknow Field Sales Dashboard", KPI grid visible |
| 1.6.6 | Verify bottom nav bar | 3 tabs visible: Dashboard (LayoutDashboard icon), Leads (Users icon), Follow-ups (Calendar icon) |
| 1.6.7 | Verify Dashboard tab active | Dashboard tab highlighted in emerald with bg-emerald-50 |

### 1.7 Valid ADMIN Login (EMU-3)

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 1.7.1 | On EMU-3, type admin email + password, tap Sign In | AdminShell loads (dark slate-900 background) |
| 1.7.2 | Verify admin header | ShieldCheck icon in purple box, admin name, "ADMIN" badge in purple, email below |
| 1.7.3 | Verify SyncStatusBadge | Visible in header right side |
| 1.7.4 | Verify Sign Out button | Visible with LogOut icon |
| 1.7.5 | Verify bottom nav | Admin tabs: Home, Leads, Agents, Data, Reports (dark themed) |

### 1.8 Inactive User Rejection

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 1.8.1 | Logout if logged in | Back to LoginScreen |
| 1.8.2 | Type inactive user email + valid password | Fields populated |
| 1.8.3 | Tap Sign In | Spinner shows, then error message appears (user inactive/not provisioned) |
| 1.8.4 | Verify no dashboard loads | Still on LoginScreen |

### 1.9 Network Error on Login

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 1.9.1 | Run: `adb -s emulator-5554 shell svc wifi disable` | Wi-Fi off on emulator |
| 1.9.2 | Run: `adb -s emulator-5554 shell svc data disable` | Mobile data off |
| 1.9.3 | Type valid credentials, tap Sign In | Spinner shows for several seconds |
| 1.9.4 | Wait for timeout | Error: "Network error. Please check your internet connection and try again." |
| 1.9.5 | Re-enable network: `adb shell svc wifi enable` | Wi-Fi icon returns in status bar |
| 1.9.6 | Tap Sign In again | Login succeeds this time |

### 1.10 Session Persistence Across App Kill

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 1.10.1 | Login successfully as agent1 | Dashboard visible |
| 1.10.2 | Swipe up from bottom (home gesture) | App goes to background |
| 1.10.3 | Open Recents (swipe up & hold), swipe app away | App process killed |
| 1.10.4 | Tap app icon again | App launches directly to Dashboard — NO login screen |
| 1.10.5 | Verify user context | Agent name visible in header subtitle |

### 1.11 Sign Out

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 1.11.1 | From Dashboard, tap Settings gear icon (top-right) | SettingsModal opens |
| 1.11.2 | Scroll to bottom of Settings, tap "Logout" button | Modal closes |
| 1.11.3 | Verify LoginScreen appears | Email/password fields empty, no session |
| 1.11.4 | Press hardware back | App minimizes (does not crash) |
| 1.11.5 | Reopen app | Still on LoginScreen (session cleared) |

### 1.12 Missing Supabase Configuration

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 1.12.1 | (Only if testable) Build APK without VITE_SUPABASE_URL | App launches |
| 1.12.2 | Observe login card | Amber warning box: "Authentication Setup Required" with Info icon, explains missing env vars |
| 1.12.3 | Verify Sign In button | Disabled (opacity 50%, cursor-not-allowed) |

---

## PHASE 2: SALES DASHBOARD (EMU-1, logged in as agent1)

### 2.1 Dashboard Header Verification

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 2.1.1 | Observe sticky top header | Dark slate-900 bar: logo (white bg rounded), "Amaratv Krishi" title, subtitle "Lucknow Field Sales Dashboard" |
| 2.1.2 | Observe right side of header | SyncStatusBadge visible (shows current sync state) |
| 2.1.3 | Verify AGENT role header | No Settings gear, no Backup button, no Import button (those are ADMIN-only) |
| 2.1.4 | Scroll down, then scroll back up | Header remains sticky at top |

### 2.2 KPI Metrics Grid (3x3 grid)

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 2.2.1 | Observe section heading | "Today & Pipeline Performance" in uppercase slate text |
| 2.2.2 | Verify "Total Leads" card | White card, Users icon (blue), numeric count displayed in bold |
| 2.2.3 | Verify "Calls Today" card | PhoneCall icon (emerald), count of calls made today |
| 2.2.4 | Verify "WA Pitches" card | MessageSquare icon (emerald), count of WhatsApp messages today |
| 2.2.5 | Tap "Interested" card (emerald tinted) | Navigates to LEADS tab with status filter = INTERESTED |
| 2.2.6 | Press back (hardware) | Returns to Dashboard |
| 2.2.7 | Tap "Samples" card (amber tinted) | Navigates to LEADS with filter = SAMPLE_REQUESTED |
| 2.2.8 | Press back | Returns to Dashboard |
| 2.2.9 | Tap "Customers" card (dark emerald) | Navigates to LEADS with filter = CUSTOMER |
| 2.2.10 | Press back | Returns to Dashboard |
| 2.2.11 | Tap "Due Today" card | Navigates to FOLLOW_UPS tab |
| 2.2.12 | Press back | Returns to Dashboard |
| 2.2.13 | Tap "Overdue" card (rose tinted) | Navigates to FOLLOW_UPS tab |
| 2.2.14 | Press back | Returns to Dashboard |
| 2.2.15 | Tap "Uncontacted" card | Navigates to LEADS with filter = NEW |
| 2.2.16 | Press back | Returns to Dashboard |

### 2.3 Today's Follow-ups Section

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 2.3.1 | Scroll to "Today's Follow-ups (N)" section | Calendar icon + heading with count |
| 2.3.2 | Verify "View All" link | Right-aligned emerald text with ChevronRight icon |
| 2.3.3 | Tap "View All" | Navigates to FOLLOW_UPS tab |
| 2.3.4 | Navigate back to Dashboard | Dashboard visible |
| 2.3.5 | If follow-ups exist: observe first card | White card with emerald border: lead name (bold), locality + scheduled time, priority badge (blue) |
| 2.3.6 | Tap lead name area in follow-up card | Opens LeadDetailView for that lead |
| 2.3.7 | Press back | Returns to Dashboard |
| 2.3.8 | Tap "Mark Done" button (emerald) on follow-up card | Follow-up marked complete, card disappears, dashboard data reloads |
| 2.3.9 | Verify count decremented | "Today's Follow-ups (N-1)" shown |
| 2.3.10 | Tap "Call" button (dark) on a follow-up card | Dialer opens with lead's number |
| 2.3.11 | Return from dialer | Outcome modal appears (see Phase 5) |
| 2.3.12 | Cancel outcome modal | Back to Dashboard |
| 2.3.13 | Tap "WhatsApp" button on mobile-number follow-up | WhatsApp compose modal opens |
| 2.3.14 | Close WhatsApp modal (X button) | Back to Dashboard |
| 2.3.15 | If NO follow-ups today | Green CheckCircle2 + "No Follow-ups Due Today" + "You are all caught up for today!" message |

### 2.4 Sales Pipeline Section

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 2.4.1 | Scroll to "Sales Pipeline (Tap to Filter Leads)" | TrendingUp icon + heading |
| 2.4.2 | Observe pipeline grid | 2-column grid (4 on tablet): each cell shows status label + count + ChevronRight |
| 2.4.3 | Tap "NEW" pipeline cell | Navigates to LEADS filtered by NEW |
| 2.4.4 | Verify filter applied | Leads list shows only NEW status leads |
| 2.4.5 | Press back | Returns to Dashboard |
| 2.4.6 | Tap "CONTACTED" cell | LEADS filtered by CONTACTED |
| 2.4.7 | Press back | Dashboard |
| 2.4.8 | Tap "INTERESTED" cell | LEADS filtered by INTERESTED |
| 2.4.9 | Press back | Dashboard |
| 2.4.10 | Tap "FOLLOW_UP" cell | LEADS filtered by FOLLOW_UP |
| 2.4.11 | Press back | Dashboard |
| 2.4.12 | Tap "NEGOTIATION" cell | LEADS filtered by NEGOTIATION |
| 2.4.13 | Press back | Dashboard |
| 2.4.14 | Tap "NOT_INTERESTED" cell | LEADS filtered by NOT_INTERESTED |
| 2.4.15 | Press back | Dashboard |

### 2.5 Localities Breakdown Section

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 2.5.1 | Scroll to "Lucknow Localities Breakdown" | MapPin icon + heading |
| 2.5.2 | Observe table header | 3 columns: "Locality / Area", "Total Leads", "Interested/Cust" |
| 2.5.3 | Observe first locality row | Locality name (bold), total count (center), interested+customers count (right, emerald) + ChevronRight |
| 2.5.4 | Tap first locality row | Navigates to LEADS filtered by that locality |
| 2.5.5 | Verify locality filter active | Only leads from that locality shown |
| 2.5.6 | Press back | Dashboard |
| 2.5.7 | Tap second locality row | Same behavior, different locality filter |
| 2.5.8 | Press back | Dashboard |

### 2.6 Recent Activity Stream

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 2.6.1 | Scroll to "Recent Activity Stream" | Activity icon + heading |
| 2.6.2 | Observe activity items | Each row: colored icon circle (dark=call, emerald=whatsapp, blue=follow-up, amber=other), business name, timestamp, title, optional detail |
| 2.6.3 | Tap first activity row | Opens LeadDetailView for that lead |
| 2.6.4 | Press back | Dashboard |
| 2.6.5 | If no activities | "No sales activity recorded yet." message in white card |

### 2.7 Bottom Navigation Bar

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 2.7.1 | Observe bottom bar | White/blur bar with 3 tabs: Dashboard, Leads, Follow-ups |
| 2.7.2 | Verify Dashboard tab active | Emerald text + emerald-50 background |
| 2.7.3 | Tap "Leads" tab | LEADS list loads, Leads tab highlighted, filters reset to ALL |
| 2.7.4 | Tap "Follow-ups" tab | Follow-ups view loads, Calendar tab highlighted |
| 2.7.5 | Verify badge on Follow-ups tab | If pending follow-ups > 0: rose circle badge with count (or "9+" if >9) |
| 2.7.6 | Tap "Dashboard" tab | Dashboard loads again |
| 2.7.7 | Rapid-tap between tabs 10 times | No crash, no white screen, final state matches last tap |

### 2.8 Dashboard Loading State

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 2.8.1 | Clear app data, login fresh | Dashboard shows Loader2 spinner + "Loading sales metrics..." |
| 2.8.2 | Wait for data | Spinner replaced by full dashboard content |
| 2.8.3 | Verify no flash of empty content | Smooth transition from loading to data |

### 2.9 Dashboard Empty State (agent with 0 leads)

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 2.9.1 | Login as agent with no assigned leads | Dashboard loads with all KPI counts = 0 |
| 2.9.2 | Verify no crash | All sections render, pipeline shows 0s, localities section hidden |
| 2.9.3 | Verify follow-ups section | "No Follow-ups Due Today" message |
| 2.9.4 | Verify activity stream | "No sales activity recorded yet." |

---

## PHASE 3: LEADS LIST & FILTERING (EMU-1)

### 3.1 Leads List Header & Initial Load

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 3.1.1 | Tap "Leads" in bottom nav | Leads list loads |
| 3.1.2 | Observe sticky header | Dark slate-900: logo + "Amaratv Krishi CRM", subtitle "Field Sales • [Agent Name]" |
| 3.1.3 | Verify header right side (AGENT) | "+" button visible (add lead). No Settings/Backup/Import buttons (admin-only) |
| 3.1.4 | Observe search bar | Search input with Search icon, placeholder for searching leads |
| 3.1.5 | Observe filter row | Two dropdowns: Status filter (default "ALL") and Locality filter (default "ALL") |
| 3.1.6 | Observe stats line | "Assigned to You: N leads" in slate text |
| 3.1.7 | Verify lead cards visible | White rounded cards with business name, locality, status badge |

### 3.2 Lead Card Anatomy & Interactions

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 3.2.1 | Observe first lead card top row | Business name (bold, truncate) + ChevronRight icon, locality • PIN • category below |
| 3.2.2 | Observe status badge | Colored pill: NEW=blue, CONTACTED=purple, INTERESTED=emerald, SAMPLE_REQUESTED=amber, CUSTOMER=dark emerald, WRONG_NUMBER/DO_NOT_CONTACT=rose |
| 3.2.3 | Observe address line | Single-line truncated address in slate-400 |
| 3.2.4 | Observe phone row | Phone icon (emerald) + E.164 number in monospace font. Landline shows "0522" blue badge |
| 3.2.5 | Observe action buttons | "WhatsApp" emerald button (mobile only) or "WA N/A" disabled pill (landline). Call button (dark) |
| 3.2.6 | Tap business name area | Opens LeadDetailView |
| 3.2.7 | Press back | Returns to leads list at same scroll position |
| 3.2.8 | Tap address line | Also opens LeadDetailView |
| 3.2.9 | Press back | Leads list |
| 3.2.10 | Tap "Call" button on a mobile lead | Dialer opens with correct number |
| 3.2.11 | Return from dialer | Outcome modal appears |
| 3.2.12 | Tap X on outcome modal | Modal closes, back to leads list |
| 3.2.13 | Tap "WhatsApp" button on mobile lead | WhatsApp compose modal opens |
| 3.2.14 | Tap X on WhatsApp modal | Modal closes |
| 3.2.15 | Verify landline lead | WhatsApp button shows "WA N/A" (not tappable), Call button still active |
| 3.2.16 | Verify invalid-phone lead | Call button disabled or hidden, WhatsApp unavailable |

### 3.3 Search Functionality

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 3.3.1 | Tap search input | Keyboard appears, cursor in field |
| 3.3.2 | Type "Gold" (partial business name) | List filters to leads containing "Gold" in name |
| 3.3.3 | Verify count updates | "Assigned to You: N leads" shows reduced count |
| 3.3.4 | Clear search text (backspace all) | Full list returns |
| 3.3.5 | Type a phone number "7054" | Filters to leads with matching phone digits |
| 3.3.6 | Type nonsense "zzzzz999" | Empty state: "No Leads Assigned Yet" or 0 results message |
| 3.3.7 | Clear search | List restores |

### 3.4 Status Filter Dropdown

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 3.4.1 | Tap Status dropdown | Options appear: ALL, NEW, CONTACTED, INTERESTED, SAMPLE_REQUESTED, FOLLOW_UP, NEGOTIATION, CUSTOMER, NOT_INTERESTED, WRONG_NUMBER, DO_NOT_CONTACT |
| 3.4.2 | Select "NEW" | List shows only NEW leads, all badges show "NEW" in blue |
| 3.4.3 | Select "CUSTOMER" | Only CUSTOMER leads shown (dark emerald badges) |
| 3.4.4 | Select "ALL" | All leads return |

### 3.5 Locality Filter Dropdown

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 3.5.1 | Tap Locality dropdown | All distinct localities listed (e.g. Alambagh, Gomti Nagar, LDA Colony...) + "ALL" |
| 3.5.2 | Select "Alambagh" | Only leads with locality=Alambagh shown |
| 3.5.3 | Verify each card | All show "Alambagh" in locality field |
| 3.5.4 | Select "ALL" | All localities return |

### 3.6 Combined Filters

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 3.6.1 | Set Status = "INTERESTED" | Filtered list |
| 3.6.2 | Also set Locality = "Gomti Nagar" | Further filtered: only INTERESTED leads in Gomti Nagar |
| 3.6.3 | Verify count | Count reflects intersection |
| 3.6.4 | Set Status = "ALL", keep locality | Only locality filter active |
| 3.6.5 | Set both to "ALL" | Full list restored |

### 3.7 Filter from Dashboard Navigation

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 3.7.1 | Go to Dashboard, tap "Interested" KPI card | Leads list opens with Status dropdown pre-set to INTERESTED |
| 3.7.2 | Verify dropdown shows "INTERESTED" | Not "ALL" |
| 3.7.3 | Go back to Dashboard, tap a locality row | Leads list opens with Locality dropdown pre-set |
| 3.7.4 | Tap "Leads" in bottom nav (fresh) | Filters reset to ALL/ALL |

### 3.8 Create New Lead (CreateLeadModal)

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 3.8.1 | Tap "+" button in header (or "Add New Field Lead" in empty state) | CreateLeadModal slides up from bottom (rounded-t-3xl sheet) |
| 3.8.2 | Observe modal header | Emerald-700 bar: Building2 icon, "Add New Field Lead" title, subtitle "Create and assign lead directly to your pipeline", X close button |
| 3.8.3 | Observe form fields | Business/Gym Name* (Building2 icon), Phone* and Locality (2-col grid), Contact Person, Category (default "Gym"), Address, Status dropdown (default NEW), Notes textarea |
| 3.8.4 | Tap X button | Modal closes, no lead created |
| 3.8.5 | Reopen modal, tap "Save" with all fields empty | Error: "Business / Gym Name is required." in rose box |
| 3.8.6 | Type business name "Test Gym Alpha", leave phone empty, tap Save | Error: "Phone number is required." |
| 3.8.7 | Fill: Name="Test Gym Alpha", Phone="+91 98765 43210", Locality="Gomti Nagar", Contact="Rahul Verma", Category="Gym", Address="Sector 5, Gomti Nagar", Status="NEW", Notes="Walked in yesterday" | All fields populated |
| 3.8.8 | Tap "Save Lead" / submit button | Loading spinner in button, then modal closes |
| 3.8.9 | Verify lead in list | "Test Gym Alpha" appears at top of list with NEW badge |
| 3.8.10 | Tap the new lead | Detail view shows all entered data, phone normalized to +919876543210 |
| 3.8.11 | Verify source field | Shows "Field Entry (Agent1 Name)" |
| 3.8.12 | Verify assignedTo | Lead assigned to creating agent |
| 3.8.13 | Press back | Leads list |

### 3.9 Scroll Performance

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 3.9.1 | With 100+ leads, fling scroll down fast | Smooth scrolling, no frame drops visible |
| 3.9.2 | Scroll to very bottom | Last lead card visible, no extra whitespace |
| 3.9.3 | Scroll back to top | First lead visible, header intact |
| 3.9.4 | Verify list limit | Max 150 leads rendered (per code limit) |

### 3.10 Empty Leads State

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 3.10.1 | Login as agent with 0 leads | Empty state: Building2 icon in emerald circle, "No Leads Assigned Yet", explanation text |
| 3.10.2 | Verify CTA button | "Add New Field Lead" emerald button with Plus icon |
| 3.10.3 | Tap "Add New Field Lead" | CreateLeadModal opens |

---

## PHASE 4: LEAD DETAIL VIEW (EMU-1)

### 4.1 Detail View Header & Profile Card

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 4.1.1 | Tap any lead from list | LeadDetailView loads (spinner "Loading lead profile..." briefly) |
| 4.1.2 | Observe sticky header | Dark bar: "Back" button (ArrowLeft icon) on left, status badge pill on right |
| 4.1.3 | Observe profile card | Business name (large bold), category pill (slate-100), contact person with User icon |
| 4.1.4 | Observe phone row | Phone icon + E.164 number in monospace bold. Landline shows "Lucknow Landline (0522)" blue badge |
| 4.1.5 | Observe address row | MapPin icon, locality bold + PIN, full address below in slate-400 |
| 4.1.6 | Observe stats bar (3-col) | "Calls" count, "Last Spoke" date, "Follow-up" date |
| 4.1.7 | Verify stats accuracy | Call count matches actual calls, dates formatted "23 Aug" style |

### 4.2 Next Follow-up Card (in Detail)

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 4.2.1 | If follow-up exists: observe blue card | "Next Follow-up" label + priority badge, title, scheduled date/time with Clock icon, optional notes |
| 4.2.2 | Tap "Cancel" button | Browser confirm dialog: "Cancel this follow-up reminder?" |
| 4.2.3 | Tap "OK" on confirm | Follow-up cancelled, card changes to "No follow-up reminder set" + "Schedule Follow-up" button |
| 4.2.4 | Tap "Reschedule" button (before cancelling) | FollowUpModal opens pre-filled with existing data |
| 4.2.5 | Change date, tap Save | Modal closes, card shows new date |
| 4.2.6 | Tap "Complete" button (emerald) | Follow-up marked done, card changes to empty state |
| 4.2.7 | If NO follow-up: observe slate card | "No follow-up reminder set" + blue "Schedule Follow-up" button with Plus icon |
| 4.2.8 | Tap "Schedule Follow-up" | FollowUpModal opens with defaults |

### 4.3 Action Buttons (Call / WhatsApp / Log Outcome)

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 4.3.1 | Observe 2-col button grid | "CALL" (dark slate-900, PhoneCall icon emerald) and "WHATSAPP" (emerald-600, MessageSquare icon) |
| 4.3.2 | Tap "CALL" | Native dialer opens with lead's number pre-filled |
| 4.3.3 | Return to app | Outcome modal opens automatically |
| 4.3.4 | Cancel outcome modal | Back to detail view |
| 4.3.5 | Tap "WHATSAPP" (mobile lead) | WhatsApp compose modal opens |
| 4.3.6 | Close modal | Back to detail |
| 4.3.7 | Verify landline lead | WHATSAPP button replaced with disabled "WhatsApp unavailable — landline" grey button |
| 4.3.8 | Verify invalid phone | CALL button disabled (grey) |
| 4.3.9 | Tap "Log Call Outcome & Add Remark" (full-width, bordered) | Outcome modal opens WITHOUT dialer (manual logging) |
| 4.3.10 | Save an outcome | Modal closes, call history updates |

### 4.4 History Tabs Navigation

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 4.4.1 | Observe tab row | 4 tabs: "Calls (N)", "Remarks (N)", "Follow-ups (N)", "WhatsApp (N)" with counts |
| 4.4.2 | Verify "Calls" tab active by default | Dark bg-slate-900 pill style |
| 4.4.3 | Tap "Remarks" tab | Remarks list shown, "Add Note" button appears on right |
| 4.4.4 | Tap "Follow-ups" tab | Follow-ups list shown, "Schedule" button appears on right |
| 4.4.5 | Tap "WhatsApp" tab | Message history shown |
| 4.4.6 | Tap "Calls" tab again | Call history shown |
| 4.4.7 | Horizontal scroll tabs (if overflow) | All tabs accessible |

### 4.5 Calls Tab Content

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 4.5.1 | Observe call records | Each: outcome badge (colored), duration, date/time, remark if any |
| 4.5.2 | Verify outcome badge colors | CONNECTED=emerald, CALLBACK=blue, BUSY/NO_ANSWER=amber, WRONG_NUMBER/INVALID=rose |
| 4.5.3 | If no calls | Empty message "No calls logged yet" or similar |
| 4.5.4 | Verify chronological order | Most recent call first |

### 4.6 Remarks Tab & Add Note

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 4.6.1 | Tap "Remarks" tab | Existing remarks listed with content + timestamp |
| 4.6.2 | Tap "Add Note" button (emerald, Plus icon) | Inline text input appears |
| 4.6.3 | Type "Owner asked for pricing details" | Text visible in input |
| 4.6.4 | Tap Save/submit | Saving state, then remark appears in list immediately |
| 4.6.5 | Verify remark content | Shows typed text, type=CUSTOM, author="Sales Rep" |
| 4.6.6 | Try saving empty remark | Nothing happens / validation prevents empty save |

### 4.7 Follow-ups Tab

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 4.7.1 | Tap "Follow-ups" tab | This lead's follow-ups listed with status, date, priority |
| 4.7.2 | Tap "Schedule" button | FollowUpModal opens |
| 4.7.3 | Fill title "Send sample", date tomorrow, priority HIGH, tap Save | Modal closes, new follow-up appears in tab |
| 4.7.4 | Tap Complete on a pending follow-up | Status changes to COMPLETED |
| 4.7.5 | Tap Cancel on a pending follow-up | Confirm dialog, then status = CANCELLED |

### 4.8 WhatsApp/Messages Tab

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 4.8.1 | Tap "WhatsApp" tab | Message history: channel, status, content preview, timestamp |
| 4.8.2 | Verify status badges | INITIATED / SENT / FAILED styling |
| 4.8.3 | If no messages | Empty state message |

### 4.9 Back Navigation & Error State

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 4.9.1 | Tap "Back" button in header | Returns to leads list |
| 4.9.2 | Hardware back button | Same: returns to leads list |
| 4.9.3 | (Edge) Open detail for deleted lead ID | Error card: AlertCircle + "Lead Profile Error" + message + "Return to Leads List" button |
| 4.9.4 | Tap "Return to Leads List" | Navigates back to leads |

---

---

## PHASE 5: CALL LIFECYCLE & OUTCOME LOGGING (EMU-1 + EMU-2)

### 5.1 Initiate Call from Leads List

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 5.1.1 | On EMU-1, navigate to Leads tab | Lead list visible |
| 5.1.2 | Tap dark "Call" button on first mobile lead | App triggers `tel:` intent — native Android Dialer opens with lead's number pre-filled |
| 5.1.3 | Observe emulator dialer | Correct E.164 number shown in dialer UI |
| 5.1.4 | Verify app went to background | Recent apps shows CRM app behind dialer |
| 5.1.5 | In dialer, tap the green call button | Call connects (emulator simulates) |
| 5.1.6 | End the call (red button) | Dialer closes or shows call ended |
| 5.1.7 | Press back / tap CRM in recents | App returns to foreground, CallOutcomeModal opens automatically |
| 5.1.8 | Verify outcome modal header | Dark header: PhoneCall icon in emerald box, lead businessName, phoneE164 • locality in mono text, X button |

### 5.2 Outcome Modal — Outcome Selection Grid

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 5.2.1 | Observe "Call Outcome *" section | 2-column grid of 7 buttons: Connected, Busy, No Answer, Wrong Number, Callback Requested, Invalid Number, Other |
| 5.2.2 | Verify default selection | "Connected" selected (dark bg-slate-900, white text) |
| 5.2.3 | Tap "Busy" | Busy becomes dark/selected, Connected reverts to slate-50. Status dropdown auto-updates to recommended status |
| 5.2.4 | Verify follow-up auto-check | Selecting BUSY auto-checks "Schedule Next Follow-up?" and pre-fills title "Call back [BusinessName]" |
| 5.2.5 | Tap "No Answer" | Selected. Status recommendation updates |
| 5.2.6 | Tap "Wrong Number" | Selected. Status auto-set to WRONG_NUMBER |
| 5.2.7 | Tap "Callback Requested" | Selected. Follow-up auto-enabled with title "Call back [BusinessName]" |
| 5.2.8 | Tap "Invalid Number" | Selected. Status auto-set to WRONG_NUMBER or INVALID handling |
| 5.2.9 | Tap "Other" | Selected. Status unchanged from recommendation |
| 5.2.10 | Tap "Connected" again | Returns to default selection |

### 5.3 Quick Sales Remarks Chips

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 5.3.1 | Observe "Quick Remark (Optional)" section | Wrap-around chips in emerald-50 style (e.g. "Interested in Sample", "Call Later", "Meeting Required", "Asked for Sample", "Already Using Competitor", etc.) |
| 5.3.2 | Tap "Call Later" chip | Chip turns solid emerald-600 white text. Follow-up checkbox auto-checks, title pre-fills "Call Later — [BusinessName]" |
| 5.3.3 | Tap same chip again | Deselects (toggle off), chip reverts to light style |
| 5.3.4 | Tap "Meeting Required" | Selected, follow-up auto-enabled with "Meeting Required — [BusinessName]" |
| 5.3.5 | Tap "Asked for Sample" | Selected, follow-up auto-enabled |
| 5.3.6 | Select a neutral chip (e.g. "Already Using Competitor") | Selected, no auto follow-up trigger |
| 5.3.7 | Verify status auto-update | Each remark may adjust recommended lead status per callOutcomeMapping rules |

### 5.4 Call Duration Section

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 5.4.1 | Observe "Call Duration" box (slate-50 rounded) | Amber badge: "Unverified (ACTION_DIAL)" |
| 5.4.2 | Verify automatic talk time row | "Automatic Talk Time:" → "Duration unavailable" (italic) — app never fabricates duration |
| 5.4.3 | Tap reported minutes input (right side) | Keyboard opens, number input, placeholder "e.g. 3" |
| 5.4.4 | Type "5" | Value shown |
| 5.4.5 | Type "0" | Accepted (0 minutes) |
| 5.4.6 | Type "150" (exceeds max=120) | Input clamped or rejected per max attribute |
| 5.4.7 | Type "-2" | Rejected (min=0) |
| 5.4.8 | Type "2.5" | Accepted (step allows decimals), stored as 150 seconds |
| 5.4.9 | Leave empty | No duration recorded (null) |

### 5.5 Sales Notes Textarea

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 5.5.1 | Observe "Sales Notes / Observation" label | FileText icon + label |
| 5.5.2 | Tap textarea | Keyboard opens, placeholder "e.g. Owner interested in 500g sample..." |
| 5.5.3 | Type "Owner wants 10kg order next month. Spoke with trainer Vikram." | Text visible, 2 rows height |
| 5.5.4 | Type 500+ characters | Textarea scrolls internally, all text preserved |

### 5.6 Follow-up Scheduling Section (inside Outcome Modal)

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 5.6.1 | Observe blue box "Schedule Next Follow-up?" | Checkbox on right (unchecked by default unless auto-triggered) |
| 5.6.2 | Tap checkbox to check | Section expands: 4 preset buttons (Tomorrow, 2 Days, 3 Days, 1 Week) + custom date input + title input |
| 5.6.3 | Verify "Tomorrow" selected by default | Blue-600 highlight on Tomorrow button |
| 5.6.4 | Tap "2 Days" | Highlight moves to 2 Days |
| 5.6.5 | Tap "3 Days" | Highlight moves |
| 5.6.6 | Tap "1 Week" | Highlight moves |
| 5.6.7 | Tap custom date input | Native Android date picker opens |
| 5.6.8 | Pick a date 5 days ahead | Date input populated, preset buttons deselect |
| 5.6.9 | Observe follow-up title input | Pre-filled if auto-triggered, else empty with default fallback |
| 5.6.10 | Edit title to "Deliver sample pack" | Text updates |
| 5.6.11 | Uncheck checkbox | Section collapses, follow-up data discarded |

### 5.7 Save Outcome — Happy Path

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 5.7.1 | Set: Outcome=CONNECTED, Quick Remark="Interested in Sample", Notes="Wants 500g sample", Duration=4, Follow-up checked (Tomorrow) | All fields populated |
| 5.7.2 | Tap "Save" / submit button at bottom | Button shows spinner, form disabled |
| 5.7.3 | Wait for save | Modal closes automatically |
| 5.7.4 | Verify lead status updated | Lead card shows new status (e.g. INTERESTED) |
| 5.7.5 | Open lead detail > Calls tab | New call record: CONNECTED badge, 4 min (240s) reported duration, UNVERIFIED flag |
| 5.7.6 | Check Remarks tab | Quick remark + custom note saved |
| 5.7.7 | Check Follow-ups tab | New follow-up scheduled for tomorrow 10:00 AM, title present |
| 5.7.8 | Verify lead.callCount | Incremented by 1 |
| 5.7.9 | Verify lead.lastContactedAt | Updated to current timestamp |
| 5.7.10 | Verify dashboard "Calls Today" KPI | Incremented |

### 5.8 Cancel / Skip Outcome

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 5.8.1 | Initiate a call, return to app | Outcome modal opens |
| 5.8.2 | Tap X button (top-right of modal) | Modal closes. No call record created |
| 5.8.3 | Verify Calls tab unchanged | No new entry |
| 5.8.4 | Verify lead status unchanged | Same status as before |
| 5.8.5 | Initiate call again, return, press hardware BACK | Modal closes (back button handler cancels outcome), state reset |
| 5.8.6 | Verify no ghost call record | Calls tab still unchanged |

### 5.9 Manual Outcome Logging (No Dialer)

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 5.9.1 | Open lead detail | Detail view visible |
| 5.9.2 | Tap "Log Call Outcome & Add Remark" button | Outcome modal opens directly (no dialer intent fired) |
| 5.9.3 | Select NO_ANSWER, save | Call record created with NO_ANSWER outcome |
| 5.9.4 | Verify status auto-update | Lead status updated per mapping (e.g. stays NEW or moves to FOLLOW_UP) |

### 5.10 App Kill During Active Call

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 5.10.1 | Tap Call on a lead | Dialer opens |
| 5.10.2 | While in dialer, run: `adb -s emulator-5554 shell am kill com.amaratvkrishi.salescrm` | App process killed |
| 5.10.3 | End call, tap app icon | App cold-starts |
| 5.10.4 | Verify no crash | App loads to dashboard or login |
| 5.10.5 | Verify pending attempt handling | No duplicate call record, no stuck outcome modal loop. Pending dial attempt recovered from localStorage or cleaned |
| 5.10.6 | Make a fresh call | Normal flow works |

### 5.11 Rapid Double-Tap Call Prevention

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 5.11.1 | On leads list, rapidly double-tap Call button | Only ONE dialer intent fires |
| 5.11.2 | Return to app | Only ONE outcome modal, one pending attempt |
| 5.11.3 | Save outcome | Exactly one call record created |

### 5.12 Sequential Calls to Different Leads

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 5.12.1 | Call Lead A, return, save CONNECTED | Record saved for Lead A |
| 5.12.2 | Immediately call Lead B, return, save BUSY | Record saved for Lead B |
| 5.12.3 | Open Lead A detail > Calls | Shows only Lead A's call |
| 5.12.4 | Open Lead B detail > Calls | Shows only Lead B's call |
| 5.12.5 | Verify no cross-contamination | Each record linked to correct leadId |

### 5.13 Landline & Invalid Number Calls

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 5.13.1 | Find a landline lead (0522 badge) | Call button active |
| 5.13.2 | Tap Call | Dialer opens with landline number (0522XXXXXXX) |
| 5.13.3 | Return, save outcome | Works identically to mobile flow |
| 5.13.4 | Find invalid-phone lead | Call button disabled (grey) or hidden |
| 5.13.5 | Attempt tap on disabled call | Nothing happens, no dialer |

### 5.14 Incoming Call Interruption (Emulator GSM)

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 5.14.1 | While app is in foreground, run: `adb -s emulator-5554 emu gsm call 9876543210` | Incoming call UI appears |
| 5.14.2 | Answer and end call | App returns to foreground |
| 5.14.3 | Verify no false outcome modal | Outcome modal should NOT open (no dial was initiated by app) |
| 5.14.4 | Verify app state intact | Same screen as before interruption |

---

## PHASE 6: WHATSAPP COMPOSE & MESSAGING (EMU-1 has WhatsApp, EMU-2 does not)

### 6.1 Modal Open & Template Auto-Load

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 6.1.1 | On EMU-1, tap "WhatsApp" button on a mobile lead | WhatsAppComposeModal slides up |
| 6.1.2 | Observe header | Emerald-700 bar: MessageSquare icon, lead businessName, phoneE164 • locality, Settings gear icon, X button |
| 6.1.3 | Observe template selector | Dropdown/select showing template list. Default template (isDefault) auto-selected |
| 6.1.4 | Observe message preview area | Rendered template text with {{businessName}} replaced by actual lead name, {{locality}} replaced |
| 6.1.5 | Verify no raw variables | No "{{" visible in rendered message |
| 6.1.6 | If default catalogue configured | Attachment chip visible showing catalogue PDF name |

### 6.2 Template Switching

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 6.2.1 | Tap template dropdown | All templates listed (INTRO, FOLLOW_UP, PRICING, etc.) |
| 6.2.2 | Select a FOLLOW_UP template | Message preview re-renders with new template body + lead variables |
| 6.2.3 | Select PRICING template | Preview updates again |
| 6.2.4 | Switch back to INTRO | Preview returns to intro text |

### 6.3 Message Editing

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 6.3.1 | Tap "Edit" / pencil icon (Edit3) | Message becomes editable textarea |
| 6.3.2 | Append " — Special discount this week!" to text | Text updates |
| 6.3.3 | Delete a line | Text updates |
| 6.3.4 | Verify edited text persists in modal | While switching focus, text stays |

### 6.4 Attachment Handling

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 6.4.1 | Tap Paperclip / attach button | Android file picker opens |
| 6.4.2 | Navigate to Downloads, select an image (.jpg) | Attachment chip appears: file name + ImageIcon + size |
| 6.4.3 | Tap remove (Trash2) on attachment | Attachment cleared, chip disappears |
| 6.4.4 | Re-attach, select a PDF | PDF chip with FileText icon shown |
| 6.4.5 | Try attaching oversized/invalid file (if validation exists) | Error message shown: validation error text in rose box |
| 6.4.6 | Attach catalogue PDF (if in Downloads) | Catalogue attached |

### 6.5 Send — WhatsApp Installed (EMU-1)

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 6.5.1 | With message ready, no attachment, tap "Send" (emerald button with Send icon) | Button shows Loader2 spinner "Launching..." |
| 6.5.2 | Wait | WhatsApp app opens with contact pre-selected and message pre-filled |
| 6.5.3 | Verify message text in WhatsApp | Matches composed text with lead variables rendered |
| 6.5.4 | Verify phone number | WhatsApp opened for correct E.164 number |
| 6.5.5 | Press back to CRM | Modal closed, lead list visible |
| 6.5.6 | Open lead detail > WhatsApp tab | New message record: channel=WHATSAPP, status=INITIATED, content preview matches |
| 6.5.7 | Verify dashboard "WA Pitches" KPI | Incremented |

### 6.6 Send — With Attachment (Share Intent)

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 6.6.1 | Attach catalogue PDF, tap Send | Native Share sheet opens (Capacitor Share plugin) with file + text |
| 6.6.2 | Select WhatsApp from share sheet | WhatsApp opens with file attached |
| 6.6.3 | Verify message logged | MessageHistory record created |

### 6.7 Send — WhatsApp NOT Installed (EMU-2)

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 6.7.1 | On EMU-2, open WhatsApp compose for a mobile lead | Modal opens normally |
| 6.7.2 | Tap Send | Attempts wa.me URL or share intent |
| 6.7.3 | Observe result | Error message: "Could not open WhatsApp. Please ensure WhatsApp or WhatsApp Business is installed on your device." OR browser opens wa.me link |
| 6.7.4 | Verify message status | If launch failed, logged message status updated to FAILED |
| 6.7.5 | Verify no crash | Modal stays open, user can retry or close |

### 6.8 Landline & Invalid Phone Guards

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 6.8.1 | Open compose for landline lead (via admin or direct) | Blue warning box: "WhatsApp Unavailable for Landlines" + explanation to use Phone Call |
| 6.8.2 | Tap Send anyway | Error: "WhatsApp is unavailable for this phone number." |
| 6.8.3 | Open compose for invalid-phone lead | Rose warning: "Invalid phone number. WhatsApp messaging cannot be initiated." |

### 6.9 First-Time Setup (No Templates)

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 6.9.1 | (Setup: delete all templates via Settings first) | Templates table empty |
| 6.9.2 | Open WhatsApp compose | First-time setup card: Sparkles icon, "Create Your Default WhatsApp Message", explanation text |
| 6.9.3 | Tap "Create Default" button | Default INTRO template created, message preview populates with standard pitch |
| 6.9.4 | Verify template saved | Settings > Messages tab shows "Amaratv Krishi — Standard Intro Pitch" |

### 6.10 Settings Gear & Catalogue Warning

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 6.10.1 | Tap Settings gear in compose header | Compose modal closes, SettingsModal opens (MESSAGES tab) |
| 6.10.2 | Close settings | Return to previous view |
| 6.10.3 | (Setup: delete catalogue file after configuring) | Compose shows amber warning: "Default catalogue is unavailable. Please select another file." |

### 6.11 Cancel Compose

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 6.11.1 | Open compose, type message, attach file | State populated |
| 6.11.2 | Tap X button | Modal closes |
| 6.11.3 | Verify no message logged | WhatsApp tab in lead detail unchanged |
| 6.11.4 | Reopen compose | Fresh state (attachment revoked, no stale data) |
| 6.11.5 | Hardware back with modal open | Modal closes (back handler) |

---

## PHASE 7: FOLLOW-UPS VIEW (EMU-1)

### 7.1 View Load & Grouped Sections

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 7.1.1 | Tap "Follow-ups" in bottom nav | FollowUpsView loads (spinner briefly) |
| 7.1.2 | Observe grouping | Three sections: OVERDUE (rose/warning), TODAY (emerald), UPCOMING (blue/slate) |
| 7.1.3 | Verify OVERDUE section | Past-due follow-ups with AlertTriangle icon, warning styling |
| 7.1.4 | Verify TODAY section | Follow-ups scheduled today with Clock icon |
| 7.1.5 | Verify UPCOMING section | Future follow-ups with Calendar icon + date |
| 7.1.6 | Observe each follow-up card | Lead business name, locality, title, scheduled time, priority badge |
| 7.1.7 | Verify filter chips | ALL / OVERDUE / TODAY / UPCOMING chips at top |

### 7.2 Filter Chips

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 7.2.1 | Tap "OVERDUE" chip | Only overdue section visible |
| 7.2.2 | Tap "TODAY" chip | Only today section |
| 7.2.3 | Tap "UPCOMING" chip | Only upcoming section |
| 7.2.4 | Tap "ALL" | All three sections return |

### 7.3 Complete a Follow-up

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 7.3.1 | Tap "Complete" / CheckCircle2 button on a TODAY follow-up | Follow-up status → COMPLETED |
| 7.3.2 | Verify card removed from pending list | Card disappears or moves to completed styling |
| 7.3.3 | Verify badge count | Bottom nav Follow-ups badge decrements |
| 7.3.4 | Open associated lead detail > Follow-ups tab | Shows COMPLETED status |

### 7.4 Reschedule / Edit Follow-up

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 7.4.1 | Tap edit / RotateCcw icon on a follow-up card | FollowUpModal opens pre-filled: title, notes, priority, scheduledAt |
| 7.4.2 | Verify pre-fill accuracy | All fields match existing follow-up |
| 7.4.3 | Change date using preset buttons (Tomorrow/2 Days/3 Days/1 Week) | Date input updates |
| 7.4.4 | Or tap datetime input | Native Android date/time picker opens |
| 7.4.5 | Pick new date+time | Input populated |
| 7.4.6 | Change priority to URGENT | Priority selector updates |
| 7.4.7 | Edit title and notes | Text updates |
| 7.4.8 | Tap Save | Spinner, modal closes, follow-up moves to new date group |
| 7.4.9 | Verify local notification rescheduled | Old notification cancelled, new one scheduled (if permission granted) |

### 7.5 Create Follow-up Manually

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 7.5.1 | Tap "+" / Plus button in FollowUpsView header | FollowUpModal opens with lead selector or from a lead context |
| 7.5.2 | Verify default title | "Follow-up regarding Amaratv Krishi sample & pricing" |
| 7.5.3 | Verify default date | Tomorrow at 10:00 AM |
| 7.5.4 | Verify default priority | MEDIUM |
| 7.5.5 | Clear title, tap Save | Error: "Please enter a follow-up title / objective." |
| 7.5.6 | Clear date, tap Save | Error: "Please select a scheduled date and time." |
| 7.5.7 | Fill valid data, tap Save | Follow-up created, appears in correct group |
| 7.5.8 | Verify notification scheduled | LocalNotification scheduled for future date (check with `adb shell dumpsys alarm` or notification panel) |

### 7.6 Priority Levels Visual

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 7.6.1 | Create 4 follow-ups with LOW, MEDIUM, HIGH, URGENT | All created |
| 7.6.2 | Observe priority badges | Each shows correct label, distinct color intensity (URGENT most prominent) |

### 7.7 Actions from Follow-up Card

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 7.7.1 | Tap PhoneCall icon on follow-up card | Dialer opens for associated lead |
| 7.7.2 | Return | Outcome modal appears |
| 7.7.3 | Cancel outcome | Back to follow-ups |
| 7.7.4 | Tap MessageSquare icon | WhatsApp compose opens for associated lead |
| 7.7.5 | Close compose | Back to follow-ups |
| 7.7.6 | Tap lead business name | Opens LeadDetailView |
| 7.7.7 | Press back | Returns to Follow-ups view |

### 7.8 Empty State

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 7.8.1 | Complete/cancel all follow-ups | List empty |
| 7.8.2 | Observe empty state | "No pending follow-ups" message with icon |
| 7.8.3 | Verify badge | Bottom nav badge hidden (count=0) |

### 7.9 Local Notification Integration

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 7.9.1 | Create follow-up scheduled 2 minutes from now | Saved |
| 7.9.2 | Press Home (app backgrounds) | App in background |
| 7.9.3 | Wait 2 minutes | Notification appears in status bar: follow-up title + lead name |
| 7.9.4 | Pull down notification shade | Notification visible with app icon, emerald accent color |
| 7.9.5 | Tap notification | App opens (or navigates to relevant screen) |
| 7.9.6 | On EMU-2 (permission DENIED) | No notification appears, app functions normally |

---

---

## PHASE 8: EXCEL IMPORT (EMU-1, logged in as ADMIN)

### 8.1 Import Screen Entry

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 8.1.1 | Login as ADMIN on EMU-1 | Dashboard shows admin buttons: Settings gear, "Backup", "Import Data" (emerald) |
| 8.1.2 | Tap "Import Data" button | IMPORT tab loads: ExcelImporter with upload area (UploadCloud icon, "Upload Excel / CSV" prompt) |
| 8.1.3 | Verify bottom nav hidden | Import tab has no bottom navigation bar |
| 8.1.4 | Verify cancel option | Back/cancel control visible to return to dashboard |

### 8.2 File Upload

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 8.2.1 | Tap upload area | Android file picker opens |
| 8.2.2 | Navigate to Download folder | Files listed |
| 8.2.3 | Select `test_import.xlsx` | Loading spinner "Parsing file..." shown |
| 8.2.4 | Wait for parse | PREVIEW step loads: file name displayed, sheet selector (if multi-sheet), stats card |
| 8.2.5 | Verify ImportStatsCard | Shows: Total Rows, Valid, Warnings, Invalid counts |

### 8.3 Multi-Sheet Selection

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 8.3.1 | Observe sheet tabs/selector | All sheet names from workbook listed (e.g. "Sheet1", "Gyms", "Contacts") |
| 8.3.2 | Tap second sheet | Preview re-parses with that sheet's data, stats update |
| 8.3.3 | Tap back to first sheet | Original data returns |

### 8.4 Column Mapping

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 8.4.1 | Observe ColumnMappingSelector | Auto-detected mappings: Excel column → CRM field (businessName, phone, locality, address, category, etc.) |
| 8.4.2 | Verify auto-detection accuracy | "Business Name" → businessName, "Phone" → phone, "Area" → locality (reasonable matches) |
| 8.4.3 | Tap a mapping dropdown | All CRM field options listed |
| 8.4.4 | Change "Phone" mapping to a different column | Preview rows update with new phone data |
| 8.4.5 | Set a column to "Skip/Ignore" | That column excluded from import |
| 8.4.6 | Verify required field indicators | businessName and phone marked as required |

### 8.5 Preview List & Validation

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 8.5.1 | Observe ImportPreviewList | Rows with business name, phone, locality, validation status badge |
| 8.5.2 | Verify VALID rows | Green check / normal styling |
| 8.5.3 | Verify WARNING rows | Amber styling (e.g. missing optional field, unusual phone format) |
| 8.5.4 | Verify INVALID rows | Rose styling (e.g. missing business name or phone) |
| 8.5.5 | Tap filter chips: ALL / VALID / WARNING / INVALID | List filters accordingly |
| 8.5.6 | Type in search box | Filters preview by business name |
| 8.5.7 | Clear search | Full preview returns |
| 8.5.8 | Scroll through 100 rows | Smooth, all rows rendered |

### 8.6 Duplicate Detection

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 8.6.1 | File contains 5 phone numbers already in DB | Stats card shows duplicate count |
| 8.6.2 | Tap "Import" / proceed button | DuplicateConfirmModal appears |
| 8.6.3 | Observe modal | Shows: N duplicates found, options: "Skip Duplicates" and "Overwrite/Update Existing" |
| 8.6.4 | Tap "Skip Duplicates" | Import proceeds, duplicates excluded |
| 8.6.5 | (Repeat with fresh file) Tap "Overwrite" | Import proceeds, existing records updated with new data |

### 8.7 Import Execution & Progress

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 8.7.1 | Confirm import | IMPORTING step: progress bar with "current / total" and percentage |
| 8.7.2 | Observe progress animation | Bar fills incrementally (e.g. 10/95 → 95/95) |
| 8.7.3 | Wait for completion | SUMMARY step loads |

### 8.8 Import Summary

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 8.8.1 | Observe ImportSummaryCard | Total processed, Successfully imported, Skipped (duplicates), Failed/Invalid counts |
| 8.8.2 | Verify counts match preview stats | Numbers consistent |
| 8.8.3 | Tap "Done" / "View Leads" | Navigates to LEADS tab |
| 8.8.4 | Verify imported leads in list | New leads visible with correct data |
| 8.8.5 | Open one imported lead | All fields mapped correctly: name, phone (normalized), locality, address, category |
| 8.8.6 | Verify source field | Shows "Excel Seed: [filename]" or similar |
| 8.8.7 | Verify createdBy | Set to admin user ID |

### 8.9 Invalid File Handling

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 8.9.1 | Tap upload, select a .txt file | Error message: invalid file type, no crash |
| 8.9.2 | Select a .pdf file | Same: error shown |
| 8.9.3 | Select an empty .xlsx (0 rows) | Error or "No data found" message |
| 8.9.4 | Select corrupted .xlsx (rename .txt to .xlsx) | Parse error shown gracefully |

### 8.10 Cancel Import Mid-Flow

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 8.10.1 | Upload file, reach PREVIEW step | Preview visible |
| 8.10.2 | Tap Cancel / back arrow | Returns to Dashboard |
| 8.10.3 | Verify no partial import | Leads table unchanged |
| 8.10.4 | Hardware back during preview | Same: returns to dashboard, no partial state |

### 8.11 Large File Performance

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 8.11.1 | Upload 500-row Excel file | Parses within 5 seconds |
| 8.11.2 | Preview renders | First batch visible, scrollable |
| 8.11.3 | Import all 500 | Progress bar completes, no ANR dialog |
| 8.11.4 | Verify all 500 in database | Count matches |

### 8.12 Bundled Sample Data

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 8.12.1 | If "Load Sample Dataset" button visible on UPLOAD step | Tap it |
| 8.12.2 | Wait | BUNDLED_LUCKNOW_DATASET loads into preview |
| 8.12.3 | Import | Lucknow gym dataset imported successfully |

### 8.13 Import Audit Trail (verify in Admin Data)

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 8.13.1 | After import, go to Admin > DATA > IMPORTS | Import audit list shows new entry |
| 8.13.2 | Verify audit fields | File name, timestamp, total rows, imported count, user who imported |

---

## PHASE 9: BACKUP & RESTORE (EMU-1, ADMIN)

### 9.1 Backup Modal Open & Summary

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 9.1.1 | On Dashboard (admin), tap "Backup" button | BackupRestoreModal opens |
| 9.1.2 | Observe tabs | EXPORT / RESTORE / HISTORY tabs at top |
| 9.1.3 | Observe EXPORT tab (default) | DB summary loading spinner, then counts: Leads, Remarks, Calls, Follow-ups, Messages, Templates, Total Records |
| 9.1.4 | Verify counts match dashboard | Numbers consistent with actual data |

### 9.2 Export Backup

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 9.2.1 | Tap "Export Backup" / Download button | Processing spinner "Generating backup..." |
| 9.2.2 | Wait | Android share sheet OR file save dialog appears with JSON file |
| 9.2.3 | Choose "Save to Downloads" (if file save) | File saved: `amaratv_backup_[timestamp].json` |
| 9.2.4 | Or choose share to Gmail/Drive | Share intent fires correctly |
| 9.2.5 | Success message shown | Green CheckCircle2 + "Backup exported successfully" |
| 9.2.6 | Verify file in Downloads via file picker | File exists, non-zero size |

### 9.3 Restore — Valid File

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 9.3.1 | Tap "RESTORE" tab | Upload area shown |
| 9.3.2 | Tap upload, select `backup_valid.json` | Validation runs (spinner) |
| 9.3.3 | Validation passes | ValidationResult shown: record counts per table, green styling |
| 9.3.4 | Observe restore options | "Merge" (add/update without deleting) and "Replace" (full wipe + restore) |
| 9.3.5 | Tap "Merge Restore" | Processing spinner, then MergeRestoreResult: added, updated, skipped counts |
| 9.3.6 | Verify success message | Green banner with result summary |
| 9.3.7 | Close modal, check leads list | Data intact, no duplicates from merge |

### 9.4 Restore — Replace (Destructive)

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 9.4.1 | Upload valid backup again | Validation passes |
| 9.4.2 | Tap "Replace" option | Confirmation gate appears: must type specific text (e.g. "REPLACE") |
| 9.4.3 | Try tapping confirm without typing | Button disabled or error shown |
| 9.4.4 | Type wrong text | Confirm button stays disabled |
| 9.4.5 | Type correct confirmation text | Button enables |
| 9.4.6 | Tap confirm | Processing spinner "Replacing database..." |
| 9.4.7 | Wait | Success message, all data replaced with backup contents |
| 9.4.8 | Verify leads list | Exactly matches backup data |

### 9.5 Restore — Invalid File

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 9.5.1 | Select `backup_corrupt.json` (truncated) | Validation runs |
| 9.5.2 | Validation fails | Rose error: "Invalid backup file" or parse error message |
| 9.5.3 | Select a .xlsx file | Rejected: wrong format error |
| 9.5.4 | Select empty .json | Rejected |
| 9.5.5 | Verify no data changed | Existing data untouched after failed restore |

### 9.6 Backup History Tab

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 9.6.1 | Tap "HISTORY" tab | List of past backup/restore operations |
| 9.6.2 | Verify entries | Timestamp, operation type (EXPORT/RESTORE_MERGE/RESTORE_REPLACE), record counts |
| 9.6.3 | Verify latest operation at top | Chronological order |

### 9.7 Restore on Empty Database

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 9.7.1 | Clear app data (`adb shell pm clear`), login as admin | Empty database |
| 9.7.2 | Open Backup modal > RESTORE | Upload area |
| 9.7.3 | Upload valid backup, merge restore | All records restored |
| 9.7.4 | Verify dashboard KPIs | Counts match backup data |

### 9.8 Hardware Back & Modal Close

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 9.8.1 | With backup modal open, press hardware back | Modal closes, dashboard visible |
| 9.8.2 | Tap X button | Modal closes |

---

## PHASE 10: SETTINGS & TEMPLATES MODAL (EMU-1)

### 10.1 Modal Open & Tab Structure

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 10.1.1 | Tap Settings gear icon (dashboard header, admin) | SettingsModal opens |
| 10.1.2 | Observe tabs | MESSAGES / CATALOGUE / PREFERENCES |
| 10.1.3 | Verify MESSAGES tab default | Template list visible |

### 10.2 Template List & Categories

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 10.2.1 | Observe template cards | Each: title, category badge (INTRO/FOLLOW_UP/PRICING/SAMPLE_OFFER/RE_ENGAGE), body preview, star if default |
| 10.2.2 | Verify default template starred | Star icon filled on default |
| 10.2.3 | Scroll through all templates | All visible |

### 10.3 Create New Template

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 10.3.1 | Tap "+" / Plus button | Create form appears: Title input, Category dropdown, Body textarea, variable reference |
| 10.3.2 | Observe TEMPLATE_VARIABLES reference | List: {{businessName}}, {{contactPersonOrSir}}, {{contactPerson}}, {{locality}}, {{city}}, etc. with descriptions |
| 10.3.3 | Type title: "Sample Follow-up" | Text in field |
| 10.3.4 | Select category: FOLLOW_UP | Dropdown updates |
| 10.3.5 | Type body: "Hi {{contactPersonOrSir}}, following up on the sample we sent to {{businessName}} in {{locality}}. Let us know your feedback!" | Text in textarea |
| 10.3.6 | Tap Save | Template saved, appears in list |
| 10.3.7 | Verify in WhatsApp compose | New template available in dropdown |

### 10.4 Edit Template

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 10.4.1 | Tap Edit3 (pencil) icon on a template | Edit form opens pre-filled |
| 10.4.2 | Modify body text | Textarea updates |
| 10.4.3 | Tap Save | Updated in list |
| 10.4.4 | Verify in compose modal | Updated text renders |

### 10.5 Delete Template

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 10.5.1 | Tap Trash2 icon on a template | Confirmation prompt |
| 10.5.2 | Confirm delete | Template removed from list |
| 10.5.3 | Verify in compose | Deleted template no longer in dropdown |

### 10.6 Template Preview

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 10.6.1 | Tap Eye (preview) icon on template | Preview renders using SAMPLE_LEAD data: "Skywards Fitness Zone", "Amit Sharma", "Alambagh" |
| 10.6.2 | Verify all variables substituted | No {{ }} in preview |
| 10.6.3 | Close preview | Back to list |

### 10.7 Copy & Star Template

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 10.7.1 | Tap Copy icon | Template body copied to clipboard (toast or icon feedback) |
| 10.7.2 | Paste in any text field | Full template text with {{variables}} appears |
| 10.7.3 | Tap Star icon on a different template | Becomes default (starred), previous default unstarred |
| 10.7.4 | Open WhatsApp compose | New default template auto-selected |

### 10.8 Catalogue Tab

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 10.8.1 | Tap "CATALOGUE" tab | Catalogue management area |
| 10.8.2 | If no catalogue uploaded | Upload prompt with Upload icon |
| 10.8.3 | Tap Upload | Android file picker opens |
| 10.8.4 | Select a PDF file | Upload processes, catalogue card appears: file name, size, upload date |
| 10.8.5 | Tap preview/eye on catalogue | PDF opens or share intent |
| 10.8.6 | Verify in WhatsApp compose | Catalogue auto-attached as default attachment |
| 10.8.7 | Tap delete on catalogue | Confirmation, then removed |
| 10.8.8 | Verify compose modal | No auto-attachment, or warning if it was default |

### 10.9 Preferences Tab

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 10.9.1 | Tap "PREFERENCES" tab | Theme toggle, sync controls, user info, logout |
| 10.9.2 | Observe theme section | Sun/Moon toggle showing current theme (DAY/NIGHT) |
| 10.9.3 | Tap theme toggle | App theme switches immediately (all modals, backgrounds) |
| 10.9.4 | Kill app, relaunch | Theme persists |
| 10.9.5 | Observe sync section | Current sync status, "Sync Now" button |
| 10.9.6 | Tap "Sync Now" | Sync triggers, status transitions: SYNCING → SYNCED |
| 10.9.7 | Observe user info | Current user name, email, role displayed |
| 10.9.8 | Tap "Logout" (LogOut icon) | Session cleared, LoginScreen appears |

### 10.10 Settings Modal Close

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 10.10.1 | Tap X button | Modal closes |
| 10.10.2 | Hardware back | Modal closes |
| 10.10.3 | Reopen settings | Previous state fresh, no stale data |

---

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

## PHASE 12: SYNC ENGINE (ALL 3 EMULATORS)

> Tests offline-first bidirectional sync between local Dexie and Supabase.
> Sync triggers: app startup, online event, interval timer, manual sync.
> States: IDLE → SYNCING → SYNCED / OFFLINE / ERROR.

### 12.1 Sync on App Startup

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 12.1.1 | Force-stop app on EMU-1 (`adb shell am force-stop com.amaratvkrishi.salescrm`) | App killed |
| 12.1.2 | Relaunch app | Login screen or dashboard loads |
| 12.1.3 | Observe SyncStatusBadge immediately | Badge shows SYNCING (spinner/amber) within 1-2 seconds |
| 12.1.4 | Wait for sync to complete | Badge transitions to SYNCED (green check) |
| 12.1.5 | Verify no error toast | No red error messages during startup sync |
| 12.1.6 | Repeat on EMU-2 | Same behavior |
| 12.1.7 | Repeat on EMU-3 (admin) | Same behavior in AdminShell header badge |

### 12.2 Manual Sync Trigger

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 12.2.1 | On EMU-1, open Settings → PREFERENCES tab | Sync section visible with "Sync Now" button |
| 12.2.2 | Tap "Sync Now" | Button shows loading state, badge → SYNCING |
| 12.2.3 | Wait 3-5 seconds | Badge → SYNCED, button returns to normal |
| 12.2.4 | Verify last sync timestamp updated | Timestamp shows current time |
| 12.2.5 | Tap "Sync Now" again immediately | Second sync runs without error |

### 12.3 Offline Mode — Queue Operations

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 12.3.1 | On EMU-1, enable Airplane Mode (`adb shell svc wifi disable && adb shell svc data disable`) | Network off |
| 12.3.2 | Observe SyncStatusBadge | Transitions to OFFLINE (amber/red indicator) |
| 12.3.3 | Navigate to a lead detail | Lead loads from local Dexie (no spinner hang) |
| 12.3.4 | Change lead status to INTERESTED | Status updates locally, saved to Dexie |
| 12.3.5 | Add a remark to the lead | Remark saved locally |
| 12.3.6 | Log a call outcome (DIAL → outcome) | Call record saved locally |
| 12.3.7 | Create a follow-up | Follow-up saved locally |
| 12.3.8 | Verify all changes visible in UI | Lead shows INTERESTED, remark visible, call logged, follow-up in list |
| 12.3.9 | Observe badge | Still OFFLINE, pending operations queued |
| 12.3.10 | Kill app, relaunch (still offline) | All local changes persist, app functional |

### 12.4 Online Reconnection — Push Queued Changes

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 12.4.1 | Disable Airplane Mode on EMU-1 (`adb shell svc wifi enable`) | Network restored |
| 12.4.2 | Observe badge within 2 seconds | `online` event fires → badge → SYNCING |
| 12.4.3 | Wait for sync complete | Badge → SYNCED |
| 12.4.4 | On EMU-3 (admin), check the lead | Status = INTERESTED, remark visible, call logged |
| 12.4.5 | Verify follow-up visible on EMU-3 | Follow-up appears in admin data |
| 12.4.6 | On EMU-3, check HEALTH tab → Pending Sync | Count = 0 after EMU-1 sync |

### 12.5 Pull — Receive Remote Changes

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 12.5.1 | On EMU-3 (admin), reassign a lead from agent1 to agent2 | Assignment saved |
| 12.5.2 | On EMU-1 (agent1), trigger manual sync | Sync runs |
| 12.5.3 | Check leads list on EMU-1 | Reassigned lead no longer in agent1's list (or marked) |
| 12.5.4 | On EMU-2 (agent2), trigger manual sync | Sync runs |
| 12.5.5 | Check leads list on EMU-2 | Newly assigned lead appears |
| 12.5.6 | Open the lead on EMU-2 | Full lead data present, correct status |

### 12.6 Sync Conflict Resolution

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 12.6.1 | On EMU-1, enable Airplane Mode | Offline |
| 12.6.2 | On EMU-2, enable Airplane Mode | Offline |
| 12.6.3 | On EMU-1, change Lead X status to INTERESTED | Saved locally |
| 12.6.4 | On EMU-2, change same Lead X status to CUSTOMER | Saved locally |
| 12.6.5 | Disable Airplane on EMU-1, wait for sync | EMU-1 pushes INTERESTED |
| 12.6.6 | Disable Airplane on EMU-2, wait for sync | EMU-2 pushes CUSTOMER |
| 12.6.7 | Observe conflict resolution | Last-write-wins or merge strategy applies (check SyncConflictResolver logic) |
| 12.6.8 | On EMU-3, verify final state of Lead X | One definitive status, no data corruption |
| 12.6.9 | On both EMU-1 and EMU-2, sync again | Both converge to same status |
| 12.6.10 | Verify no duplicate records | Lead X exists once, not twice |

### 12.7 Sync Interval Timer

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 12.7.1 | On EMU-1, note current sync timestamp | Record time |
| 12.7.2 | Make a change (add remark) | Change saved |
| 12.7.3 | Do NOT manually sync, wait for interval (check config, typically 60s) | Auto-sync triggers |
| 12.7.4 | Observe badge | SYNCING → SYNCED without manual action |
| 12.7.5 | Verify change on EMU-3 | Remark visible |

### 12.8 Sync Error Handling

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 12.8.1 | On EMU-1, disable network | Offline |
| 12.8.2 | Make 5 changes (status, remarks, calls) | All queued |
| 12.8.3 | Re-enable network but with invalid Supabase URL (if testable) or simulate server error | Sync attempts, fails |
| 12.8.4 | Observe badge | ERROR state (red indicator) |
| 12.8.5 | Verify app remains functional | Can still navigate, view leads, make changes |
| 12.8.6 | Restore valid connection | Next sync succeeds, ERROR → SYNCED |
| 12.8.7 | Verify all 5 changes pushed | Data on server matches local |

### 12.9 Background Sync Manager

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 12.9.1 | On EMU-1, make a change, then press Home (background app) | App backgrounded |
| 12.9.2 | Wait 30 seconds | Background sync may trigger |
| 12.9.3 | Return to app | App resumes, check if change synced |
| 12.9.4 | On EMU-3, verify change present | Data arrived via background sync |

### 12.10 Sync State Persistence Across Restart

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 12.10.1 | On EMU-1, go offline, make 3 changes | Queued |
| 12.10.2 | Force-stop app | Killed |
| 12.10.3 | Relaunch (still offline) | App loads, changes still local |
| 12.10.4 | Re-enable network | Sync triggers on startup + online event |
| 12.10.5 | Verify all 3 changes synced | Server has all data |

---

## PHASE 13: REALTIME / WEBSOCKET (ALL 3 EMULATORS)

> Tests Supabase Realtime WebSocket: org-scoped channels, live updates,
> deduplication, reconnection, in-app notifications.

### 13.1 WebSocket Connection on Login

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 13.1.1 | Login on EMU-1 (agent1) | RealtimeService connects |
| 13.1.2 | Observe connection indicator (if visible) | Status: CONNECTED |
| 13.1.3 | Login on EMU-2 (agent2) | Second WebSocket connects |
| 13.1.4 | Login on EMU-3 (admin) | Third WebSocket connects |
| 13.1.5 | Verify all 3 maintain connection for 60s | No disconnections, no error logs |

### 13.2 Live Lead Assignment Notification

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 13.2.1 | On EMU-3, assign a new lead to agent1 | Assignment saved + broadcast |
| 13.2.2 | On EMU-1, observe within 5 seconds | In-app notification appears: "New lead assigned" |
| 13.2.3 | Check leads list on EMU-1 | New lead appears without manual refresh |
| 13.2.4 | On EMU-2, verify NO notification | agent2 not affected, no false notification |

### 13.3 Live Activity Feed Update (Admin)

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 13.3.1 | On EMU-3, open Admin Dashboard HOME tab | LiveActivityFeed visible |
| 13.3.2 | On EMU-1, log a call outcome | Activity broadcast |
| 13.3.3 | Observe EMU-3 feed within 5s | New entry appears at top |
| 13.3.4 | On EMU-2, send a WhatsApp message | Activity broadcast |
| 13.3.5 | Observe EMU-3 feed | WhatsApp activity appears |
| 13.3.6 | On EMU-1, create a follow-up | Activity broadcast |
| 13.3.7 | Observe EMU-3 feed | Follow-up activity appears |
| 13.3.8 | Verify KPI cards auto-update | Total Calls / Follow-ups count increments |

### 13.4 Entity Change Propagation

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 13.4.1 | On EMU-1, change Lead X status to NEGOTIATION | Saved + broadcast |
| 13.4.2 | On EMU-3, open Admin LEADS tab | Lead X shows NEGOTIATION without manual refresh |
| 13.4.3 | On EMU-3, observe pipeline visualizer | NEGOTIATION count +1, previous stage -1 |
| 13.4.4 | On EMU-2 (if Lead X visible), check status | Updated via realtime or next sync |

### 13.5 Deduplication

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 13.5.1 | On EMU-1, rapidly change lead status 3 times in 5 seconds | 3 broadcasts sent |
| 13.5.2 | On EMU-3, observe activity feed | No duplicate entries for same event, deduplication works |
| 13.5.3 | Verify final state | Lead shows last status only |

### 13.6 WebSocket Reconnection

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 13.6.1 | On EMU-1, disable network for 10 seconds | WebSocket disconnects |
| 13.6.2 | Re-enable network | WebSocket reconnects |
| 13.6.3 | Observe reconnection behavior | Status: DISCONNECTED → CONNECTING → CONNECTED |
| 13.6.4 | On EMU-3, make a change during EMU-1 disconnection | Change broadcast (EMU-1 misses it) |
| 13.6.5 | After EMU-1 reconnects | Reconciliation sync runs, missed data pulled |
| 13.6.6 | Verify EMU-1 has the change | Data consistent after reconnect |

### 13.7 Realtime After Logout

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 13.7.1 | On EMU-1, logout | WebSocket disconnects, channel unsubscribed |
| 13.7.2 | On EMU-3, make a change | Broadcast sent |
| 13.7.3 | On EMU-1 (login screen) | No notification, no crash, no stale listener errors |
| 13.7.4 | Re-login on EMU-1 | Fresh WebSocket connects |

### 13.8 In-App Notification Display

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 13.8.1 | Trigger a realtime notification on EMU-1 (assign lead via EMU-3) | Toast/banner appears at top of screen |
| 13.8.2 | Observe notification content | Lead name, action description, timestamp |
| 13.8.3 | Wait for auto-dismiss | Notification fades after 3-5 seconds |
| 13.8.4 | Tap notification (if tappable) | Navigates to relevant lead |
| 13.8.5 | Trigger 3 notifications rapidly | They stack or queue, no overlap/crash |

---

## PHASE 14: ANDROID NATIVE BEHAVIOR (ALL EMULATORS)

### 14.1 Hardware Back Button — Full State Matrix

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 14.1.1 | On DASHBOARD, press back | App minimizes (goes to background), does NOT exit |
| 14.1.2 | Return to app | Dashboard resumes |
| 14.1.3 | Navigate to LEADS, press back | Returns to DASHBOARD |
| 14.1.4 | Navigate to LEAD DETAIL, press back | Returns to LEADS list |
| 14.1.5 | Open Settings modal, press back | Settings modal closes |
| 14.1.6 | Open Backup modal, press back | Backup modal closes |
| 14.1.7 | Open WhatsApp compose, press back | Compose closes |
| 14.1.8 | Open Outcome modal, press back | Outcome cancels + closes |
| 14.1.9 | On IMPORT screen, press back | Returns to DASHBOARD |
| 14.1.10 | On FOLLOW_UPS view, press back | Returns to DASHBOARD |
| 14.1.11 | On LOGIN screen, press back | App minimizes or exits (no crash) |
| 14.1.12 | On Admin HOME, press back | App minimizes |
| 14.1.13 | On Admin LEADS/AGENTS/DATA/REPORTS, press back | Returns to Admin HOME or minimizes |
| 14.1.14 | Open any modal → press back → verify modal state | Modal closes, underlying view intact |

### 14.2 App Lifecycle — Background / Foreground

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 14.2.1 | Press Home button (app backgrounds) | App in background |
| 14.2.2 | Wait 10 seconds, return to app | App resumes exactly where left off, no reload |
| 14.2.3 | Open another app (Chrome), wait 30s, return | App resumes, state preserved |
| 14.2.4 | Background app for 5 minutes, return | App resumes or cold-starts gracefully |
| 14.2.5 | Verify scroll position preserved | List scroll position same as before backgrounding |
| 14.2.6 | Verify form inputs preserved | Any typed text still in fields |

### 14.3 App Lifecycle — Process Death

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 14.3.1 | Navigate to a specific lead detail | Lead visible |
| 14.3.2 | Force-stop: `adb shell am force-stop com.amaratvkrishi.salescrm` | Process killed |
| 14.3.3 | Relaunch app from launcher | App cold-starts |
| 14.3.4 | Observe | Login screen OR dashboard (session persisted), no crash |
| 14.3.5 | If session persisted | Dashboard loads, data intact |
| 14.3.6 | Navigate to same lead | All data present |

### 14.4 Screen Rotation

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 14.4.1 | On Dashboard (portrait), rotate to landscape | Layout adapts, no crash |
| 14.4.2 | Verify all elements visible | No clipped text, no overflow |
| 14.4.3 | Rotate back to portrait | Original layout restores |
| 14.4.4 | On Lead Detail, rotate | Detail view adapts |
| 14.4.5 | On Admin Shell (EMU-3 tablet), rotate | max-w-3xl content re-centers |
| 14.4.6 | During a modal open, rotate | Modal remains open, content visible |
| 14.4.7 | During keyboard visible, rotate | Keyboard dismisses or repositions, no crash |

### 14.5 Android Intents & Deep Links

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 14.5.1 | Tap phone number on lead detail | Dialer intent fires, native dialer opens with number pre-filled |
| 14.5.2 | Return to app | App resumes, outcome modal may appear |
| 14.5.3 | Tap WhatsApp button | WhatsApp intent fires (EMU-1: WhatsApp opens, EMU-2: error/fallback) |
| 14.5.4 | Return from WhatsApp | App resumes |
| 14.5.5 | Tap share/export (if any) | Android share sheet opens |
| 14.5.6 | Select a share target | Content shared, return to app |

### 14.6 Notification System (Android 13+ POST_NOTIFICATIONS)

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 14.6.1 | On EMU-1 (API 34), verify notification permission granted | Permission dialog was accepted in Phase 1 |
| 14.6.2 | Create follow-up for 1 minute from now | Saved |
| 14.6.3 | Background app, wait 1 minute | Local notification fires |
| 14.6.4 | Pull notification shade | Notification visible: app icon, follow-up title, lead name |
| 14.6.5 | Tap notification | App opens to relevant screen |
| 14.6.6 | Dismiss notification | Notification removed |
| 14.6.7 | On EMU-2 (permission DENIED), create follow-up | No notification, app functions normally |
| 14.6.8 | On EMU-2, go to Android Settings → App → Notifications | Permission shows DENIED |
| 14.6.9 | Grant permission manually via Android Settings | Permission enabled |
| 14.6.10 | Create another follow-up, background, wait | Notification now appears |

### 14.7 Keyboard & Input Behavior

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 14.7.1 | Tap any text input | Keyboard appears, input scrolls into view |
| 14.7.2 | Type text | Characters appear correctly |
| 14.7.3 | Tap outside input | Keyboard dismisses |
| 14.7.4 | On login screen, tap password field | Keyboard shows, password masked |
| 14.7.5 | Toggle password visibility (eye icon) | Password visible/hidden |
| 14.7.6 | In search bar, type and submit | Search executes, keyboard dismisses |
| 14.7.7 | Long-press text field | Copy/paste context menu appears |
| 14.7.8 | Paste text from clipboard | Text pastes correctly |

### 14.8 WebView / Capacitor Specific

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 14.8.1 | Verify app renders in WebView | No white flash, no desktop scrollbar artifacts |
| 14.8.2 | Check viewport | Content fills screen, no horizontal scroll on main views |
| 14.8.3 | Verify status bar | App renders below status bar, no overlap |
| 14.8.4 | Verify navigation bar (bottom gesture) | Content not hidden behind gesture bar |
| 14.8.5 | Check splash screen on cold start | Splash shows briefly, then app loads |
| 14.8.6 | Verify app icon in launcher | Correct icon displayed |
| 14.8.7 | Verify app label | "Amaratv Krishi" or configured name |

---

## PHASE 15: MULTI-DEVICE CONCURRENT SCENARIOS

### 15.1 Admin Assigns While Agent Works

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 15.1.1 | EMU-1 (agent1): viewing leads list | List visible |
| 15.1.2 | EMU-3 (admin): assign 5 new leads to agent1 | Assignment saved |
| 15.1.3 | EMU-1: observe within 5s | New leads appear in list via realtime |
| 15.1.4 | EMU-1: open one new lead | Full data present |
| 15.1.5 | EMU-1: log a call on that lead | Call saved |
| 15.1.6 | EMU-3: verify call in dashboard | Call count incremented |

### 15.2 Two Agents Working Same Lead Pool

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 15.2.1 | EMU-1 and EMU-2 both online | Both connected |
| 15.2.2 | EMU-1: change Lead A status | Saved |
| 15.2.3 | EMU-2: view Lead A (if accessible) | Status updated |
| 15.2.4 | EMU-2: add remark to Lead B | Saved |
| 15.2.5 | EMU-1: view Lead B | Remark visible after sync |
| 15.2.6 | Both agents log calls simultaneously | Both calls saved, no conflict |
| 15.2.7 | EMU-3: verify both calls in dashboard | Call count +2 |

### 15.3 Admin + Agent Simultaneous Edits

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 15.3.1 | EMU-3: open Lead X in admin data explorer | Lead visible |
| 15.3.2 | EMU-1: open same Lead X in detail view | Lead visible |
| 15.3.3 | EMU-1: change status to FOLLOW_UP | Saved |
| 15.3.4 | EMU-3: observe Lead X | Status updates to FOLLOW_UP |
| 15.3.5 | EMU-3: reassign Lead X to agent2 | Saved |
| 15.3.6 | EMU-1: observe Lead X | Assignment updates (or lead removed from agent1 list) |

### 15.4 Offline Agent + Online Admin

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 15.4.1 | EMU-1: enable Airplane Mode | Offline |
| 15.4.2 | EMU-1: make 3 changes (status, remark, call) | Queued locally |
| 15.4.3 | EMU-3: assign new lead to agent1 | Saved to server |
| 15.4.4 | EMU-1: re-enable network | Sync runs |
| 15.4.5 | EMU-1: verify new lead appears | Pulled from server |
| 15.4.6 | EMU-3: verify agent1's 3 changes | Pushed to server |
| 15.4.7 | Verify no data loss | All 4 operations present |

### 15.5 Three Emulators Full Workflow

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 15.5.1 | EMU-3: import 10 leads via Excel | Import complete |
| 15.5.2 | EMU-3: bulk assign 5 to agent1, 5 to agent2 | Assignment complete |
| 15.5.3 | EMU-1: verify 5 leads visible | Correct leads shown |
| 15.5.4 | EMU-2: verify 5 leads visible | Correct leads shown |
| 15.5.5 | EMU-1: call lead 1, log CONNECTED | Call saved |
| 15.5.6 | EMU-2: call lead 6, log NOT_ANSWERED | Call saved |
| 15.5.7 | EMU-1: WhatsApp lead 2 | Message sent |
| 15.5.8 | EMU-2: create follow-up for lead 7 | Follow-up saved |
| 15.5.9 | EMU-3: verify dashboard KPIs | 2 calls, 1 WhatsApp, 1 follow-up reflected |
| 15.5.10 | EMU-3: verify activity feed | 4 activities visible |
| 15.5.11 | EMU-3: verify reports | All data in reports |

---

## PHASE 16: EDGE CASES & ERROR HANDLING

### 16.1 Network Edge Cases

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 16.1.1 | Login with network, then immediately disable | App loads cached data or shows offline message |
| 16.1.2 | Attempt login with no network | Error: "No internet connection" or similar |
| 16.1.3 | Attempt login with wrong credentials + no network | Appropriate error (cannot verify) |
| 16.1.4 | During sync, disable network mid-sync | Sync fails gracefully, ERROR state, no crash |
| 16.1.5 | Re-enable network | Sync retries and succeeds |
| 16.1.6 | Rapidly toggle network 5 times | App handles transitions, no crash |
| 16.1.7 | Switch from WiFi to mobile data mid-session | App continues, sync reconnects |

### 16.2 Empty Data States

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 16.2.1 | Login as agent with 0 assigned leads | Dashboard shows 0 counts, leads list shows empty state |
| 16.2.2 | Observe empty leads list | "No leads" message with icon, not blank white |
| 16.2.3 | Observe empty follow-ups | "No pending follow-ups" message |
| 16.2.4 | Admin with 0 agents | Agents view shows "No sales representatives" + "Provision First Agent" button |
| 16.2.5 | Admin reports with no data | Reports show 0 values, not errors |
| 16.2.6 | Admin activity feed with no activities | Empty state message |

### 16.3 Large Data Volume

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 16.3.1 | Import 500+ leads via Excel | Import completes without timeout |
| 16.3.2 | Open leads list | List renders, scroll smooth (may paginate/virtualize) |
| 16.3.3 | Scroll to bottom | No crash, no ANR |
| 16.3.4 | Search in 500 leads | Results return within 2 seconds |
| 16.3.5 | Admin data explorer with 500 leads | Loads, filters work |
| 16.3.6 | Admin reports with 500 leads | KPIs compute correctly |

### 16.4 Special Characters & Input Validation

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 16.4.1 | Create/edit lead with name containing Hindi text (e.g. "राम कृषि") | Saves and displays correctly |
| 16.4.2 | Lead name with special chars: `@#$%&*()` | Saves without error |
| 16.4.3 | Lead name with emoji: 🌾🚜 | Saves and displays |
| 16.4.4 | Very long business name (200+ chars) | Truncates in UI, saves fully |
| 16.4.5 | Phone number with spaces/dashes | Normalized or validated |
| 16.4.6 | Empty required field submission | Validation error shown |
| 16.4.7 | SQL injection attempt in search: `'; DROP TABLE leads;--` | No effect, treated as literal string |
| 16.4.8 | XSS attempt in remark: `<script>alert(1)</script>` | Rendered as text, not executed |

### 16.5 Session & Auth Edge Cases

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 16.5.1 | Login, then clear app data via Android Settings | Session wiped, login screen on next launch |
| 16.5.2 | Login on EMU-1, then login same account on EMU-2 | Both sessions work (or first invalidated, check behavior) |
| 16.5.3 | Logout on EMU-1, verify EMU-2 unaffected | EMU-2 session intact |
| 16.5.4 | Attempt to access app after token expiry (wait or simulate) | Redirect to login or token refresh |
| 16.5.5 | Login as AGENT, verify no admin panel access | No admin tabs/buttons visible |
| 16.5.6 | Login as ADMIN, verify agent features accessible | Admin can enter Sales Mode |

### 16.6 Rapid Interaction Stress

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 16.6.1 | Rapidly tap a button 20 times | No duplicate actions, no crash |
| 16.6.2 | Rapidly switch between tabs 10 times | No crash, final tab renders |
| 16.6.3 | Open and close modal rapidly 10 times | No crash, no orphaned overlays |
| 16.6.4 | Scroll list rapidly up and down | No crash, no rendering artifacts |
| 16.6.5 | Type rapidly in search field | No lag, no crash |
| 16.6.6 | Tap multiple leads rapidly | Only one detail opens |

---

## PHASE 17: PERFORMANCE & STABILITY

### 17.1 App Launch Performance

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 17.1.1 | Cold start: force-stop, launch, time to interactive | < 5 seconds to usable state |
| 17.1.2 | Warm start: background, return, time to interactive | < 2 seconds |
| 17.1.3 | Login to dashboard time | < 3 seconds after credentials entered |
| 17.1.4 | Observe for jank/stutter during launch | Smooth 60fps rendering |

### 17.2 Memory & Resource Usage

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 17.2.1 | Monitor memory via `adb shell dumpsys meminfo com.amaratvkrishi.salescrm` | Reasonable heap (< 200MB) |
| 17.2.2 | Navigate through all views 5 times | No memory leak (heap stable) |
| 17.2.3 | Leave app open for 10 minutes | No growing memory, no ANR |
| 17.2.4 | Check battery usage in Android Settings | Normal drain, no wakelock abuse |

### 17.3 Scroll Performance

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 17.3.1 | Scroll leads list (100+ items) rapidly | Smooth, no frame drops |
| 17.3.2 | Scroll admin data explorer | Smooth |
| 17.3.3 | Scroll activity feed | Smooth |
| 17.3.4 | Scroll reports tables | Smooth |
| 17.3.5 | Fling scroll and tap item during momentum | Tap registers correctly |

### 17.4 Long Session Stability

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 17.4.1 | Keep app open for 30 minutes, interact periodically | No crash, no degradation |
| 17.4.2 | Perform 50+ operations in sequence | All succeed, no state corruption |
| 17.4.3 | Verify sync still works after long session | Manual sync succeeds |
| 17.4.4 | Verify realtime still connected | WebSocket alive |

---

## PHASE 18: SECURITY & DATA INTEGRITY

### 18.1 Authentication Security

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 18.1.1 | Login with valid credentials | Success |
| 18.1.2 | Login with wrong password | Error message, no crash |
| 18.1.3 | Login with non-existent email | Error message |
| 18.1.4 | Login with empty fields | Validation errors |
| 18.1.5 | Attempt SQL injection in email field | Treated as literal, error shown |
| 18.1.6 | Verify password not logged in console | No plaintext password in logcat |
| 18.1.7 | Verify session token stored securely | Not in plain SharedPreferences (check) |

### 18.2 Role-Based Access Control

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 18.2.1 | Login as AGENT | No admin panel, no admin buttons |
| 18.2.2 | Verify agent cannot see other agents' leads | Only assigned leads visible |
| 18.2.3 | Verify agent cannot access admin data endpoints | No UI path exists |
| 18.2.4 | Login as ADMIN | Full admin panel + sales mode |
| 18.2.5 | Verify admin can see all agents' data | All leads, all calls visible |
| 18.2.6 | Deactivated agent attempts login | Blocked with error |

### 18.3 Data Integrity

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 18.3.1 | Create lead, verify all fields saved | Every field persists |
| 18.3.2 | Update lead, verify old values replaced | No stale data |
| 18.3.3 | Soft-delete lead, verify hidden from lists | deletedAt set, not shown |
| 18.3.4 | Verify call records immutable after save | Cannot edit logged calls |
| 18.3.5 | Verify sync does not duplicate records | Record count stable after multiple syncs |
| 18.3.6 | Verify foreign key integrity | Lead → Agent references valid |
| 18.3.7 | Export/backup, verify data completeness | All records in backup |
| 18.3.8 | Restore backup, verify data matches | Round-trip integrity |

### 18.4 Network Security

| Step | Action | Expected UI State |
|------|--------|-------------------|
| 18.4.1 | Verify all API calls use HTTPS | No plaintext HTTP in logcat |
| 18.4.2 | Verify Supabase key not exposed in UI | No key visible in rendered content |
| 18.4.3 | Verify WebSocket uses WSS | Encrypted connection |

---

## EXECUTION SCHEDULE

| Day | Phases | Emulators | Est. Time |
|-----|--------|-----------|-----------|
| Day 1 | Phase 1 (Login) + Phase 2 (Dashboard) + Phase 3 (Leads List) | EMU-1 | 3 hours |
| Day 2 | Phase 4 (Lead Detail) + Phase 5 (Call Lifecycle) | EMU-1 + EMU-2 | 3 hours |
| Day 3 | Phase 6 (WhatsApp) + Phase 7 (Follow-ups) | EMU-1 + EMU-2 | 2.5 hours |
| Day 4 | Phase 8 (Excel Import) + Phase 9 (Backup/Restore) | EMU-1 | 2.5 hours |
| Day 5 | Phase 10 (Settings/Templates) + Phase 11.1-11.11 (Admin Shell + Dashboard + Leads) | EMU-1 + EMU-3 | 3 hours |
| Day 6 | Phase 11.12-11.33 (Admin Agents + Data + Reports + Settings) | EMU-3 | 3 hours |
| Day 7 | Phase 12 (Sync Engine) | All 3 | 3 hours |
| Day 8 | Phase 13 (Realtime) + Phase 14 (Android Native) | All 3 | 3 hours |
| Day 9 | Phase 15 (Multi-Device) + Phase 16 (Edge Cases) | All 3 | 3 hours |
| Day 10 | Phase 17 (Performance) + Phase 18 (Security) + Regression | All 3 | 3 hours |

**Total: ~29 hours across 10 days**

---

## PASS / FAIL CRITERIA

| Criteria | Pass Condition |
|----------|---------------|
| Functional | Every step's "Expected UI State" matches actual |
| Stability | Zero crashes across all phases |
| Data Integrity | No data loss, no duplicates after sync |
| Performance | Cold start < 5s, no ANR, smooth scroll |
| Security | No auth bypass, no data leak between roles |
| Offline | All operations work offline, sync on reconnect |
| Realtime | Updates propagate within 5 seconds |
| Compatibility | All 3 emulators (API 33, 34, tablet) pass |

---

## BUG REPORT TEMPLATE

```
BUG ID: BUG-XXX
Phase/Step: e.g. 5.3.2
Emulator: EMU-1 / EMU-2 / EMU-3
Severity: CRITICAL / HIGH / MEDIUM / LOW
Title: [One-line summary]
Steps to Reproduce:
  1. ...
  2. ...
Expected: [from test plan]
Actual: [what happened]
Screenshot/Video: [attach]
Logcat (if relevant): [paste relevant lines]
Network State: Online / Offline
Reproducible: Always / Sometimes / Once
```

---

## ADB QUICK REFERENCE (for all phases)

```bash
# List emulators
adb devices

# Target specific emulator
adb -s emulator-5554 <command>   # EMU-1
adb -s emulator-5556 <command>   # EMU-2
adb -s emulator-5558 <command>   # EMU-3

# Network control
adb shell svc wifi disable
adb shell svc wifi enable
adb shell svc data disable
adb shell svc data enable

# Airplane mode (requires root or settings toggle)
adb shell settings put global airplane_mode_on 1
adb shell am broadcast -a android.intent.action.AIRPLANE_MODE

# Force stop / launch
adb shell am force-stop com.amaratvkrishi.salescrm
adb shell monkey -p com.amaratvkrishi.salescrm -c android.intent.category.LAUNCHER 1

# Screenshot
adb exec-out screencap -p > screen.png

# Logcat (filtered)
adb logcat -s Capacitor:* Chromium:*

# Memory info
adb shell dumpsys meminfo com.amaratvkrishi.salescrm

# Clear app data
adb shell pm clear com.amaratvkrishi.salescrm

# Install APK
adb install -r app/build/outputs/apk/debug/app-debug.apk

# Push test file to device
adb push test_leads.xlsx /sdcard/Download/
```

---

*END OF TEST PLAN — 18 Phases, 188 Sub-sections, 1157 Individual Steps*
