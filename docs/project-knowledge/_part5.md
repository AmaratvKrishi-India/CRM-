
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

*END OF TEST PLAN — 18 Phases, 170+ Sub-sections, 900+ Individual Steps*
