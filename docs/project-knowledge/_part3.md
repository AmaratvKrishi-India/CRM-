
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
<!-- PART4 -->
