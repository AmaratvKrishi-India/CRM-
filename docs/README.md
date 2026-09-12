# Documentation Guide

**Last reviewed:** 2026-09-10

This directory contains the current, source-verified project documentation for the Amaratv Krishi Field Sales CRM. Superseded audits, remediation reports, handoffs, and duplicate legacy guides have been removed so older conclusions cannot be mistaken for current state.

## Start here

1. [Current state and release decision](./project-knowledge/16_CURRENT_STATE.md)
2. [System architecture](./project-knowledge/02_SYSTEM_ARCHITECTURE.md)
3. [Local development setup](./project-knowledge/23_LOCAL_DEV_SETUP.md)
4. [Testing and verification](./project-knowledge/12_TESTING_VERIFICATION.md)
5. [Security model](./project-knowledge/07_SUPABASE_SECURITY_MODEL.md)
6. [Sync and realtime](./project-knowledge/08_SYNC_REALTIME_ARCHITECTURE.md)
7. [Deployment runbook](./project-knowledge/22_DEPLOYMENT_RUNBOOK.md)
8. [Architecture decisions](./decisions/README.md)

## Documentation authority

| Question | Authoritative document |
|---|---|
| What is true in the current checkout? | [16_CURRENT_STATE.md](./project-knowledge/16_CURRENT_STATE.md) |
| Is the candidate safe to release? | [GATES.md](../GATES.md) and [FINAL_RELEASE_SIGNOFF_2026-09-09.md](./project-knowledge/FINAL_RELEASE_SIGNOFF_2026-09-09.md) |
| How does the application work? | The living guides indexed in [project-knowledge/README.md](./project-knowledge/README.md) |
| Why was an architecture decision made? | [decisions/](./decisions/README.md) |
| What changed between releases? | [CHANGELOG.md](../CHANGELOG.md) and [release notes](../release/RELEASE_NOTES.md) |
| Where is non-authoritative reference material? | [reference/](./reference/README.md) |

Generated `graft/`, local scratch output, reports, screenshots, and test artifacts are not project documentation.