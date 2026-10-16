# Persistent CRM project memory

This file stores only durable project engineering context. Do not add customer names, phone numbers, emails, CRM records, credentials, access tokens, private keys, or secrets.

## Current post-release status

- Released main is `f6f9d7e`; PRs #7 and #8 are merged. Historical draft/merge holds below are superseded.
- Owner excludes Android real-backend synchronization testing; it is not pending work for this release. VoIP and Drive remain deferred.
- Production Vercel matches main; Production Supabase is `lahvcodvgubplzfshare`, Preview is CRM-Staging `dhoinifpzijqyobcamlv`. Both hosted histories still need only the final timestamp repair, blocked by verified recovery/CLI prerequisites and separate production approval.
- Post-release candidate removes the optional vulnerable Snyk npm wrapper; full and production audits are zero. Use official standalone Snyk for optional manual audits. Check the PR merge status before treating released main as repaired.
- Both obsolete merged remote development branches were deleted and verified. See POST-RELEASE-VERIFICATION.md and FRESH-TASK-RECOVERY.md for current evidence and limitations.
- This task observes cloud revision 2 running; reusable environment publication is unverified. Earlier revision 4 observations belong to an older task.

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
- Repaired the npm dependency audit with `shell-quote` 1.11.0, `source-map-js` 1.2.2, and `smol-toml` 1.9.1; updated Snyk to 1.1308.1 and removed unused Jest plus its dependency tree. Full audit findings fell from 30 (6 critical, 1 high, 23 moderate) to 4 moderate; production-only audit remains at 0. The remaining moderate chain is in Snyk's dev-only dependency tree and is documented in `docs/ai-toolkit/SECURITY.md`.
- Current local checks: typecheck, test-type, ESLint, synthetic production build, bundle budget, 238 targeted Vitest cases, 42 Chromium cases, 11 visual baselines, 2 tablet cases, secret scan, and toolkit verification passed.
- Full local Node suite is blocked by the missing `supabase_db_calling_app` container (349 total: 308 passed, 19 failed, 22 cancelled). Full local Vitest has 252 passed, 27 skipped, and 3 integration suites blocked by unavailable Supabase. The hosted workflow now runs all `tests/integration/` files, including F040 and `supabase-sync`, after disposable Supabase startup and reset.
- Visually reviewed and added 11 Linux Chromium snapshots. Existing Windows snapshots remain unchanged.
- The existing hosted run 50 at `29a1933` completed all 349 Node tests, database reset/migrations/seed, and F047. It stopped at the old dependency audit failure before browser and Android stages. Updated hosted CI for the current work is pending.
- Removed task-created non-scanner source clones and duplicate reconstruction scratch; retained the 19 MiB pinned SkillSpector checkout required by its editable install.
- On GitHub Actions run 47 for `239c5a2`, local Supabase started, all 349 Node tests passed, database reset/migrations/seed passed, and the F047 RLS regression passed. The job stopped at the existing high-severity npm audit gate; later workflow stages were skipped.

## Pending work

- Merge the reviewed post-release repair only after its CI succeeds and production release timing is approved; the candidate removes the Snyk npm chain and preserves audit gates.
- Android real-backend synchronization is excluded by the owner and is not an outstanding requirement.
- Obtain user approval before merging while Vercel `main` promotion is configured to deploy to Production; obtain the required PR review and confirm branch-protection rules.
- Keep local PostgreSQL testing on GitHub-hosted runners; Codex Cloud's VFS container setup cannot fit the Supabase PostgreSQL image.
- The task-local toolkit bootstrap is reproducible and verified. The cloud environment currently reports spec revision 4 observed at revision 4 and running; no publish/write action is exposed in this session.

## Verification notes

- 2026-10-16: memory retrieval smoke test completed. This line is harmless and exists to verify cross-process retrieval of tracked memory.
- 2026-10-16: Codex memory append and retrieval smoke test passed across separate processes
- 2026-10-16: security and regression follow-up; never store live credentials, customer records, or production test data in this memory.
- 2026-10-16: run 58 passed 349 Node tests, 279 Vitest tests, 42 Chromium tests, 2 tablet tests, 11 real-Supabase browser tests, and Android debug/unsigned release build validation on PR head `c6b940b`; no Android device was attached.
- 2026-10-16: run 59's web regression and standard Android builds passed; its artifact job exposed that `rg` is not installed on the Android runner. Removed the redundant search, relied on the existing synthetic asset validator, and made the checksum basename-relative. Run 60 passed and uploaded artifact `CRM-2.0.2-debug-test-only` (ID 12046784892; expires 2026-10-23).
