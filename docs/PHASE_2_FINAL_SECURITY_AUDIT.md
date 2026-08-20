# Phase 2 Final Security & Permission Boundaries Audit

## 1. Executive Summary
This document provides the definitive security audit for the **Amaratv Krishi Field Sales CRM (Phase 2)**. The application enforces a strict single-APK architecture with three-tier defense-in-depth authorization across the UI, local business logic services, and central Supabase PostgreSQL Row Level Security (RLS).

---

## 2. Client Secret & Credential Leakage Audit
- **Inspection Targets**: `src/`, `android/`, `dist/`, `.env*`, and build outputs.
- **Audited Secret Terms**:
  - `SUPABASE_SERVICE_ROLE_KEY` / `service_role`
  - Private RSA / ECDSA signing keys
  - Hardcoded master passwords / JWT secret tokens
- **Finding**: **PASS (CLEAN)**
  - Zero service-role credentials exist within the client bundle, source code, or distribution assets.
  - The privileged `service_role` key is strictly confined to the serverless Edge Function runtime (`supabase/functions/create-agent/index.ts`).
  - The client only consumes the public `anon` key (`VITE_SUPABASE_ANON_KEY`) for standard user authentication.

---

## 3. Android Telephony & Permissions Audit
- **Manifest File**: [`android/app/src/main/AndroidManifest.xml`](file:///c:/Users/PC/Desktop/calling%20app/android/app/src/main/AndroidManifest.xml)
- **Declared Permissions**:
  - `android.permission.INTERNET` (Cloud sync & auth)
  - `android.permission.POST_NOTIFICATIONS` (Follow-up reminders)
- **Prohibited Invasive Permissions Verification**:
  - `CALL_PHONE`: **NOT PRESENT** (Uses user-controlled `Intent.ACTION_DIAL`)
  - `READ_CALL_LOG` / `WRITE_CALL_LOG`: **NOT PRESENT**
  - `READ_PHONE_STATE`: **NOT PRESENT**
  - `READ_CONTACTS` / `WRITE_CONTACTS`: **NOT PRESENT**
  - `RECORD_AUDIO`: **NOT PRESENT**
  - `CAMERA`: **NOT PRESENT**
  - `ACCESS_FINE_LOCATION`: **NOT PRESENT**
- **Finding**: **PASS (100% Privacy Compliant)**

---

## 4. Role Authorization & Privilege Escalation Defenses
- **UI Boundary**:
  - Agent accounts cannot render the Admin Shell, Agent Provisioning screen, Organization KPI Dashboard, or Reports View.
- **Service Boundary**:
  - `AdminAnalyticsService`, `AdminReportsService`, `AgentManagementService`, and `LeadAssignmentService` enforce `assertAdmin(actor)` requiring `actor.role === 'ADMIN'` and `actor.status === 'ACTIVE'`.
  - Inactive administrators and agents are immediately rejected from all operations.
- **Database / RLS Boundary**:
  - PostgreSQL trigger `enforce_profile_role_immutability()` prevents non-superusers from updating `role` or `organization_id`.
  - Organization isolation is enforced across all 9 central tables with `auth.jwt() -> organization_id` match.

---

## 5. CSV Export & Backup Sanitization Audit
- **CSV Exports (`AdminReportsService.exportReportToCSV`)**:
  - Exports Leads, Call Records, Agent Productivity, Follow-ups, and Activities.
  - Output strictly sanitizes double quotes and formula characters (`=`, `+`, `-`, `@`).
  - Auth tokens, user passwords, refresh tokens, and internal API keys are completely omitted.
- **Local Backup (`BackupService.generateBackupPayload`)**:
  - Versioned JSON payload (Schema v2).
  - Validated against schema; sensitive credentials and service keys are excluded.

---

## 6. Call Duration & Anti-Fabrication Invariants
- **Dialer Trigger**: One-tap native dialer trigger via `Intent.ACTION_DIAL`.
- **Duration Tracking**: Calls without telephony confirmation are logged with `verificationStatus === 'UNVERIFIED'`.
- **Zero Fake Duration**: Unverified calls contribute **0 seconds** to total verified talk time, average call duration, and rep performance KPIs.
- **Dial Attempt Deduplication**: In-memory `dialAttemptId` and call lifecycle state machine prevent duplicate call logging and ghost call entries.
