# Persistent CRM project memory

This file stores only durable project engineering context. Do not add customer names, phone numbers, emails, CRM records, credentials, access tokens, private keys, or secrets.

## Project context

- The repository is an offline-first sales CRM built with React, TypeScript, Vite, Capacitor, and Supabase.
- Supabase migrations define PostgreSQL 17 schemas and depend on Supabase Auth (`auth.users`, `auth.uid()`), roles, RLS, Realtime, and extensions including `pgcrypto`, `uuid-ossp`, and `pg_cron`.
- The Codex Cloud Docker storage driver is VFS. Full Supabase/PostgreSQL integration tests belong on a supported GitHub-hosted runner rather than repeated local image extraction.

## Decisions

- Keep the development work on `development/crm-storage-backup`; leave `main` unchanged and keep PR #7 as a draft.
- Google Drive setup remains postponed. Preserve its existing scripts and documentation; do not configure OAuth, rclone, uploads, scheduling, or tests.
- Keep Codex skills and task memory in Git. Rebuild SkillSpector from the pinned upstream commit and lockfile when a cloud task starts.
- Use a local Markdown memory adapter in place of the complete Claude-Mem worker. Do not persist customer data, secrets, credentials, or transcripts.
- Use a public-only research adapter. Do not use browser cookies, private account integrations, or paid APIs.

## Completed work

- Preserved the original main base `729208d` and the development commits `86e1098` and `ff76607`.
- Added the five repo-local Codex skills, a pinned SkillSpector bootstrap, memory and planning helpers, and a public documentation research helper.
- Verified the sample memory survives retrieval by a separate process (`memory retrieval smoke test`, 2026-10-16).
- Verified TypeScript application and type tests, ESLint, production build, 238 targeted Vitest cases, 306 PostgreSQL-independent Node tests, and 31 functional Chromium cases.
- Reviewed the dependency audit and secret-scan output; no automatic dependency upgrades were applied.
- Removed task-created public source clones and duplicate reconstruction scratch after recording pinned commits and scan results.

## Pending work

- Wait for GitHub Actions on PR #7 to run the full disposable PostgreSQL/Supabase, RLS, Auth, and real browser integration coverage; Codex Cloud's local DB container is unavailable under VFS.
- Resolve or formally accept the existing npm audit high/critical findings through a separate dependency review.
- Add Linux Chromium visual baselines in a separately reviewed change if Linux visual regression coverage is required.
- Publish the environment revision in Codex Cloud settings if a retained environment image is desired; the UI action is not exposed in the current session.

## Verification notes

- 2026-10-16: memory retrieval smoke test completed. This line is harmless and exists to verify cross-process retrieval of tracked memory.
- 2026-10-16: Codex memory append and retrieval smoke test passed across separate processes
