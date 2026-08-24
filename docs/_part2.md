
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
<!-- PART3 -->
