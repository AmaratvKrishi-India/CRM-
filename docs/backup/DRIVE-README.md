# Amaratv Krishi CRM Google Drive archive

This Drive tree is an archival destination. GitHub remains the source of truth for source code. PostgreSQL data and Docker storage must stay on a local or database filesystem, never on a Drive mount. Do not upload production customer information, customer call records, unencrypted database dumps, credentials, or unsanitized logs.

| Folder | Purpose |
| --- | --- |
| `01-Source-Backups/Daily` | Optional daily verified Git commit archives. |
| `01-Source-Backups/Weekly` | Weekly Git commit archives with branch, SHA, timestamp, manifest, and SHA-256 checksum. |
| `01-Source-Backups/Monthly` | Monthly source snapshots for longer-term retention. |
| `02-Database-Backups/Development` | Encrypted synthetic-data development database exports only. |
| `02-Database-Backups/Testing` | Encrypted synthetic-data disposable test database exports only. |
| `02-Database-Backups/Production-Approved-Only` | Reserved and intentionally unused. Production export requires separate explicit authorization and security review. |
| `03-Codex-Reports/Storage-Audits` | Sanitized filesystem and Docker storage reports. |
| `03-Codex-Reports/Environment-Reports` | Reproducible environment and compatibility reports. |
| `03-Codex-Reports/Error-Reports` | Redacted error summaries without secrets or customer data. |
| `03-Codex-Reports/Optimization-Reports` | Storage and workflow optimization results. |
| `04-Testing/Frontend` | Frontend test summaries and sanitized evidence. |
| `04-Testing/Backend` | Backend test summaries and sanitized evidence. |
| `04-Testing/Database` | PostgreSQL migration, dump, and restore verification reports. |
| `04-Testing/Integration` | Sanitized end-to-end and integration test reports. |
| `05-Builds/Web` | Reproducible web build artifacts when needed. |
| `05-Builds/Android` | Android debug/test artifacts; never upload signing keys. |
| `05-Builds/Releases` | Approved release artifacts only. |
| `06-Documentation/Architecture` | Architecture notes and diagrams. |
| `06-Documentation/Database-Schema` | Schema documentation and migration summaries, not database exports. |
| `06-Documentation/API` | API specifications and integration notes. |
| `06-Documentation/Setup-Guides` | Setup and environment guides, including `MASTER-SETUP.md`. |
| `06-Documentation/Recovery-Guides` | Backup verification and recovery instructions. |
| `07-Debugging/Screenshots` | Screenshots after checking that no customer data or tokens are visible. |
| `07-Debugging/Sanitized-Logs` | Logs reviewed and redacted before upload. |
| `07-Debugging/Error-Analysis` | Error analysis without personal or production data. |
| `08-Development-Assets/Test-Datasets` | Synthetic test datasets only. |
| `08-Development-Assets/Design-Assets` | Approved design assets. |
| `09-VoIP-Integration/Research` | VoIP research and vendor notes. |
| `09-VoIP-Integration/Architecture` | Future VoIP architecture documents. |
| `09-VoIP-Integration/Testing` | Sanitized VoIP integration test artifacts. |
| `09-VoIP-Integration/Reports` | VoIP progress and evaluation reports. |
| `10-Master-Reports/Backup-Status` | Backup run status and verification manifests. |
| `10-Master-Reports/Storage-Summary` | Current and historical storage summaries. |
| `10-Master-Reports/Development-Progress` | Development progress summaries. |

Archives use UTC timestamps, include the source branch and commit SHA, and are verified by reading the uploaded bytes back and comparing SHA-256. Keep multiple generations; no retention job deletes old backups automatically.
