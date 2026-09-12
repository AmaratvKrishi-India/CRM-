# Operational Error Reporting Policy (F045)

**Document status:** CURRENT
**Last reviewed:** 2026-09-10
**Source of truth:** `src/services/operationalReportingService.ts`, Migration 11, focused tests, and environment-specific deployment evidence

The repository **does implement** a bounded Supabase/Postgres operational-error reporting path. Migration 11 defines `operational_errors`, `operational_error_readers`, `report_operational_error`, reader authorization, and 90-day expiry cleanup; the client service calls the reporting RPC without using the CRM business-mutation outbox.

Repository implementation is not the same as verified cloud deployment. The retained current documentation does not provide enough live-environment evidence to assert that every staging/production migration, reader grant, retention job, and ingestion path is deployed right now. Reverify the target environment before making that claim.

## Approved data boundary

Diagnostics are grouped by build, platform, operation and a fixed error category such as network, timeout, authentication, authorization, validation, conflict, or unexpected. Use bounded counts/timestamps rather than raw request or response bodies.

Never persist access/refresh tokens, passwords, authorization headers, service-role keys, session IDs, emails, phone numbers, names, notes, lead/customer payloads, spreadsheet contents, backup files, screenshots, database dumps, console history, or arbitrary exception text.

Business/audit events and operational diagnostics have different purposes and must not duplicate each other's sensitive payloads.

## Authorization, retention, and failure behavior

`operational_error_readers` is the explicit technical-reader boundary. Application callers use the reporting RPC rather than direct privileged access. `expire_operational_errors()` implements retention cleanup for records older than the approved 90-day window.

Collector/reporting failure is non-blocking: it must not prevent the CRM write or synchronization operation that encountered the error. Operational reporting also does not reuse, acknowledge, or discard business mutation outbox entries.

## Verification rule

Before stating that the collector is live in an environment, verify all of the following against that exact project: Migration 11 applied, reporting RPC callable under intended identities, unauthorized reading denied, authorized reader access confirmed, redaction/allowlist tests passing, retention cleanup functioning, and client ingestion reaching that same project.

See [24_STAGING_ENVIRONMENT.md](./24_STAGING_ENVIRONMENT.md) for the staging isolation rules.
