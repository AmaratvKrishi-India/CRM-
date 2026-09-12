# 05 — Business Workflow

**Document status:** CURRENT
**Last reviewed:** 2026-09-10
**Source of truth:** feature components, repositories, services, and [01_PROJECT_OVERVIEW.md](./01_PROJECT_OVERVIEW.md)

This document outlines the end-to-end business workflow and operational lifecycle of the Amaratv Krishi Field Sales CRM. It covers everything from lead ingestion to execution, follow-ups, and final synchronization.

## 1. Lead Ingestion (Admin)
- **Admin Dashboard**: The Admin logs into the system and navigates to the DATA tab.
- **Data Parsing**: The `ExcelImporter` parses incoming XLSX/CSV files containing lead information.
- **Auto-Mapping**: Column mapping automatically detects standard CRM headers (e.g., Name, Phone, City, State, Crop).
- **Data Cleansing**: The `Lead Normalizer` cleans and standardizes phone numbers (applying E.164 formatting with the +91 prefix) and address fields.
- **Deduplication**: The system performs deduplication checks against existing Dexie database records to prevent redundant entries.
- **Audit**: `ImportAudit` records the batch statistics (success, failure, duplicates) for administrative review.

## 2. Assignment (Admin)
- **Initial State**: Imported leads arrive in the system with a `NEW` status and are initially unassigned.
- **Admin View**: The Admin uses the `AdminLeadsView` to filter and select leads.
- **Bulk Assignment**: The Admin selects multiple leads and uses the `BulkLeadAssignmentModal` to assign them to a target Agent.
- **Audit Trail**: `BulkAssignmentAudit` logs the assignment operation for tracking purposes.
- **Synchronization**: The `SyncEngine` pushes the new assignments to the Supabase backend. Realtime subscriptions broadcast these updates to the assigned Agent's device immediately.

## 3. Execution & Telephony (Agent)
- **Agent Initialization**: The Agent opens the app, and the background sync fetches all newly assigned leads.
- **Dialing**: The Agent taps on a lead to initiate a call. The native phone dialer opens via Capacitor using a `tel:` intent.
- **Lifecycle Tracking**: `CallLifecycleService` tracks the telephony state machine (`IDLE` -> `DIALING` -> `OUTCOME_PENDING`).
- **Outcome Prompt**: Once the call concludes and the app resumes, the `CallOutcomeModal` prompts the agent to record the result of the call.
- **Duration Tracking**: The app records the call attempt and outcome without fabricating talk time. App pause/resume timing is lifecycle evidence only; it does **not** make a duration VERIFIED. A call remains `UNVERIFIED` with zero verified duration unless trusted/native telephony evidence provides a verified duration; any device-reported estimate is stored separately as `reportedDurationSeconds`.

## 4. Outcome Processing & State Machine
- **Pipeline Mapping**: The recorded outcome is mapped to a Pipeline Status via `callOutcomeMapping.ts`. Standard mappings include:
  - **Order Placed** -> `CUSTOMER`
  - **Sample Requested** -> `SAMPLE_REQUESTED`
  - **Interested** -> `INTERESTED`
  - **Call Later** -> `FOLLOW_UP`
  - **Wrong Number** -> `WRONG_NUMBER`
- **Logging**: The `CallHistory` and `Activity` logs are appended with the new state and details of the interaction.

## 5. Follow-ups & Remarks
- **Scheduling**: If the outcome is "Call Later", the `FollowUpModal` allows the agent to schedule a callback with a specified priority (`LOW`, `MEDIUM`, `HIGH`, `URGENT`).
- **Notifications**: The Capacitor Local Notifications plugin schedules a native OS alert to remind the agent at the designated follow-up time.
- **Contextual Notes**: The Agent can add a `CUSTOM` remark or select a `QUICK_TAG` (e.g., 'Price too high', 'Not interested in current season') to provide context for future interactions.

## 6. WhatsApp Outreach
- **Initiation**: The Agent taps the WhatsApp icon on a lead's profile.
- **Composition**: The `WhatsAppComposeModal` opens, presenting templated messaging options.
- **Template Rendering**: `TemplateRenderer` dynamically replaces variables like `{{businessName}}` or `{{contactName}}` with actual lead data.
- **Attachments**: An optional catalogue PDF can be attached based on the `AppSettings` default configuration.
- **Execution**: Text-only outreach opens the WhatsApp web/deep-link target built as `https://wa.me/<number>?text=...`. Attachment flows use the native Capacitor Share sheet so the catalogue and message can be handed to an installed compatible app without relying on a `whatsapp://` URI.
- **Logging**: `MessageHistory` logs the outreach attempt, including the template used and timestamp.

## 7. Synchronization & Cloud Audit
- **Local Writes**: Every local change (status update, call log, remark) writes to the Dexie `outbox` for offline-first resilience.
- **Background Push**: The `BackgroundSyncManager` continuously pushes outbox entries to the Supabase PostgreSQL backend when a connection is available.
- **Data Integrity**: Cloud immutability triggers protect core fields (e.g., original lead data) from unauthorized or accidental modification.
- **Real-time Admin Analytics**: Admin dashboards update via Realtime subscriptions, displaying accurate talk times, pipeline shifts, and agent performance metrics.
