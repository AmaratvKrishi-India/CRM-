# Persistent CRM project memory

This file stores only durable project engineering context. Do not add customer names, phone numbers, emails, CRM records, credentials, access tokens, private keys, or secrets.

## Current post-release status

- Released main is `0eea4febfa7e7e1babf0384f3ce47909d28970e8`; PRs #7, #8 and #9 are merged. Historical draft/merge holds below are superseded.
- Owner excludes Android real-backend synchronization testing; it is not pending work for this release. Owner resumed VoIP feature development on 17 October; real activation remains blocked. Drive remains deferred.
- Production Vercel matches main; Production Supabase is `lahvcodvgubplzfshare`, Preview is CRM-Staging `dhoinifpzijqyobcamlv`. Both hosted histories still need only the final timestamp repair, blocked by verified recovery/CLI prerequisites and separate production approval.
- Released PR #9 removed the optional vulnerable Snyk npm wrapper; full and production audits are zero. Use official standalone Snyk for optional manual audits. Check the PR merge status before treating released main as repaired.
- Both obsolete merged remote development branches were deleted and verified. See POST-RELEASE-VERIFICATION.md and FRESH-TASK-RECOVERY.md for current evidence and limitations.
- Latest task observed runtime desired/observed revision 2 running/connected with enforced restricted network and no secret bindings; revision numbers in historical reports describe earlier instances. Reusable environment publication remains unverified.

## Project context

- The repository is an offline-first sales CRM built with React, TypeScript, Vite, Capacitor, and Supabase.
- Supabase migrations define PostgreSQL 17 schemas and depend on Supabase Auth (`auth.users`, `auth.uid()`), roles, RLS, Realtime, and extensions including `pgcrypto`, `uuid-ossp`, and `pg_cron`.
- The Codex Cloud Docker storage driver is VFS. Full Supabase/PostgreSQL integration tests belong on a supported GitHub-hosted runner rather than repeated local image extraction.

## Decisions

- Historical PR #7 draft/merge holds are superseded: PRs #7, #8 and #9 are merged. Current verified released main is `0eea4febfa7e7e1babf0384f3ce47909d28970e8`. See the newest maintenance report before acting on older entries.
- Google Drive setup remains postponed. Preserve its existing scripts and documentation; do not configure OAuth, rclone, uploads, scheduling, or tests.
- Keep Codex skills and task memory in Git. Rebuild SkillSpector from the pinned upstream commit and lockfile when a cloud task starts.
- Use a local Markdown memory adapter in place of the complete Claude-Mem worker. Do not persist customer data, secrets, credentials, or transcripts.
- Use a public-only research adapter. Do not use browser cookies, private account integrations, or paid APIs.
- 2026-10-17: Windows calling pilot uses a paired loopback mock companion only. Pinned upstream source rejects live execution due to carrier TLS bypass and unauthenticated global control bindings; no configuration override exists. Native Android dialer is preserved; hosted recovery, commercial carrier authorization and Windows acceptance remain separate gates.
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

- Hosted backups and recovery rehearsal remain blocked: no approved PostgreSQL credentials, private external retention destination, independent encryption-key custody or secured disposable restore target are configured. No hosted migration history may change before these gates pass.
- Both hosted projects retain 19 migrations. Final versions: Staging `20261003055436`, Production `20261003055551`; canonical Git version `20261003000018`. Production also requires successful Staging repair and explicit authorization naming `lahvcodvgubplzfshare`.
- Review Production `17.6.1.164/withdrawn` with Supabase support. No public explanation established a security incident or urgency. Staging is `17.6.1.166/ga`. Do not upgrade without tested recovery and explicit approval.
- Leaked-password protection still requires Pro or above; organization is Free. No paid upgrade or login-setting change was made. Review Free password-strength controls on Staging and recommend unique long passwords/password managers.
- Authenticated live smoke requires a designated securely supplied test account and synthetic authorized records. Android real-backend sync and Drive remain excluded. VoIP mock development is authorized; real-Jio mode is blocked by the pinned source audit.
- Historical maintenance runtime reported revision 7; the current task reobserved revision 2, running/connected, enforced restricted network and no secret bindings or outbound identities. Reusable environment publication is unverified. Check Codex Settings → Environments → CRM and Publish in the UI if the saved revision is still Draft.
- Preserve the original `work` checkout. Maintenance work uses an isolated worktree based on latest main; any new PR remains unmerged pending approval where main triggers Vercel Production.

## Verification notes

- 2026-10-16: memory retrieval smoke test completed. This line is harmless and exists to verify cross-process retrieval of tracked memory.
- 2026-10-16: Codex memory append and retrieval smoke test passed across separate processes
- 2026-10-16: security and regression follow-up; never store live credentials, customer records, or production test data in this memory.
- 2026-10-16: run 58 passed 349 Node tests, 279 Vitest tests, 42 Chromium tests, 2 tablet tests, 11 real-Supabase browser tests, and Android debug/unsigned release build validation on PR head `c6b940b`; no Android device was attached.
- 2026-10-16: run 59's web regression and standard Android builds passed; its artifact job exposed that `rg` is not installed on the Android runner. Removed the redundant search, relied on the existing synthetic asset validator, and made the checksum basename-relative. Run 60 passed and uploaded artifact `CRM-2.0.2-debug-test-only` (ID 12046784892; expires 2026-10-23).

- 2026-10-17 IST maintenance: PR #9 Snyk wrapper removal is released; current full and production npm audits both report zero vulnerabilities. Earlier Snyk-risk-acceptance instructions are superseded.
- Released-main CI #68 (`38960369058`) passed 349 Node, 279 Vitest, 42 Chromium, 2 tablet and 11 disposable-Supabase browser scenarios, plus RLS/build/security gates.
- Deleted unprotected merged branch `fix/post-release-security` normally after verifying zero unique commits. Original local work was preserved.
- Rechecked hosted RLS, internal-table grants and anonymous sync_mutate denial. Columns/policies/indexes/table grants/triggers match; all 18 function definitions and ACLs match after normalization. One CHECK has equivalent array-cast formatting. No hosted SQL mutation or customer-row export occurred.
- Reproduced all five toolkit skills and pinned SkillSpector SAFE fixture. Current recovery entrypoints are FRESH-TASK-RECOVERY.md and the newest maintenance report; old plans/reports are historical snapshots.

- 2026-10-17 IST: GitHub-hosted public Production smoke reached Vercel Deployment Protection instead of the CRM. Approved automation access is required; a blocked artifact/warning is not an application smoke pass. No Vercel protection setting was weakened.

- 2026-10-17 IST PostgreSQL follow-up: upstream 17.7–17.11 contain security fixes after 17.6; published Supabase .164 build config pins 17.6. Exact hosted security-backport coverage is unverified. Prioritize provider confirmation of patched GA target/backports; do not treat .166 or npm audit zero as proof of database patch coverage. No upgrade authorized or performed.
