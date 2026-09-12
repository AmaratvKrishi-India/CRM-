# Project Knowledge Base

**Document status:** CURRENT INDEX
**Last reviewed:** 2026-09-11
**Current-state authority:** [16_CURRENT_STATE.md](./16_CURRENT_STATE.md)
**Release-gate authority:** [GATES.md](../../GATES.md)
**Latest completed historical verification evidence:** [FINAL_RELEASE_SIGNOFF_2026-09-09.md](./FINAL_RELEASE_SIGNOFF_2026-09-09.md)

This directory contains the living source-verified guides plus retained dated verification evidence. The 2026-09-09 sign-off is historical evidence only and does not approve newer working-tree changes. Older audit, remediation, handoff, phase, and duplicate reports were removed because their conclusions were superseded by the current checkout.

## Product and application

- [01 — Project overview](./01_PROJECT_OVERVIEW.md)
- [03 — Roles and permissions](./03_ROLES_AND_PERMISSIONS.md)
- [04 — Navigation map](./04_NAVIGATION_MAP.md)
- [05 — Business workflow](./05_BUSINESS_WORKFLOW.md)
- [10 — Android application](./10_ANDROID_APPLICATION.md)
- [11 — Web/admin application](./11_WEB_ADMIN_APPLICATION.md)
- [16 — Current state and release decision](./16_CURRENT_STATE.md)

## Architecture and data

- [02 — System architecture](./02_SYSTEM_ARCHITECTURE.md)
- [06 — Database reference](./06_DATABASE_REFERENCE.md)
- [07 — Supabase security model](./07_SUPABASE_SECURITY_MODEL.md)
- [08 — Sync and realtime architecture](./08_SYNC_REALTIME_ARCHITECTURE.md)
- [09 — API and data contracts](./09_API_DATA_CONTRACTS.md)
- [14 — Migration history](./14_MIGRATION_HISTORY.md)
- [18 — Edge functions](./18_EDGE_FUNCTIONS.md)
## Engineering and operations

- [12 — Testing and verification](./12_TESTING_VERIFICATION.md)
- [13 — Deployment environments](./13_DEPLOYMENT_ENVIRONMENTS.md)
- [15 — Codebase index](./15_CODEBASE_INDEX.md)
- [17 — AI agent operating context](./17_AI_AGENT_CONTEXT.md)
- [19 — Environment variables](./19_ENVIRONMENT_VARIABLES.md)
- [20 — Toolchain and CLI status](./20_TOOLCHAIN_CLI_STATUS.md)
- [21 — Account identity map](./21_ACCOUNT_IDENTITY_MAP.md)
- [22 — Deployment runbook](./22_DEPLOYMENT_RUNBOOK.md)
- [23 — Local development setup](./23_LOCAL_DEV_SETUP.md)
- [24 — Isolated staging environment](./24_STAGING_ENVIRONMENT.md)

## Focused current references

- [Agent lifecycle architecture](./AGENT_LIFECYCLE_ARCHITECTURE.md)
- [Background sync architecture](./BACKGROUND_SYNC_ARCHITECTURE.md)
- [Deletion and recovery policy](./DELETION_AND_RECOVERY_POLICY.md)
- [Import format and phone validation](./IMPORT_FORMAT_AND_PHONE_VALIDATION.md)
- [Operational error reporting](./OPERATIONAL_ERROR_REPORTING.md)
- [Theme and typography](./THEME_AND_TYPOGRAPHY.md)

## Maintenance rule

Update the relevant living guide when implementation changes. Record durable architecture rationale in [`../decisions/`](../decisions/). New release verification may be added as a dated report only while it remains the newest authority; once superseded, remove it after folding any still-valid conclusions into the living guides and `GATES.md`.
