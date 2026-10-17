# Start a fresh Codex task safely

Last checked: 17 October 2026 IST (16 October UTC). Released main: `0eea4febfa7e7e1babf0384f3ce47909d28970e8`. PRs #7, #8 and #9 are merged; the Snyk wrapper fix is released and both dependency audits are clean. See `RELEASE-MAINTENANCE-2026-10-17.md` and `plans/post-release-maintenance.json` for the current task; older plans are historical.

1. Open the repository `AmaratvKrishi-India/CRM-`. A GitHub push does not update an existing Codex checkout. Inspect `pwd`, `git status --short --branch`, `git diff --cached --stat`, `git branch -avv`, `git worktree list` and `git log --branches --not --remotes --oneline` before changing branches. Preserve staged work, untracked files and local-only commits. Never reset or force-push to synchronize.
2. `git fetch origin`. Compare `origin/main` with the last verified release. If the checkout is clean, `git switch main` then `git merge --ff-only origin/main`. If dirty or diverged, create a separate detached worktree with `git worktree add --detach work/latest-main origin/main`; leave the original working tree and index intact. Do not nest a worktree in a path already occupied by valuable files.
3. Read `AGENTS.md`, `docs/ai-toolkit/MEMORY.md`, the active tracked plan, and the newest post-release audit. Old reports contain historical hold decisions; use their dated follow-up documents for current status. The owner excludes Android real-backend sync testing and Drive; VoIP mock development was resumed on 17 October. Read docs/voip/EXECUTION-REPORT.md and the jiofiber-voip-integration plan; real-Jio execution remains blocked by upstream security review.
4. Run `bash scripts/ai-toolkit/check-storage.sh` before installing. Verified toolchain: Node 24.19.0, npm 11.9.0, Python 3.12.14, uv 0.12.23, Supabase CLI 2.116.0. The workflow and Vercel both select Node 24. Use the committed npm and uv lockfiles.
5. Inspect setup scripts before execution, then run:

   ```bash
   bash scripts/ai-toolkit/bootstrap.sh
   bash scripts/ai-toolkit/verify.sh
   npm ci
   ```

   In a cloud task that does not need Cypress, `CYPRESS_INSTALL_BINARY=0 npm ci` avoids its unused browser download. Playwright Chromium is installed separately when tests need it. No Docker image is needed for the toolkit.
6. Verify the five `.agents/skills/*/SKILL.md` definitions. `security-scanner` wraps pinned NVIDIA SkillSpector 2.12.0; `gsd-planning`, `project-memory`, `internet-research` and `professional-writing` provide the reviewed GSD, Claude-Mem, public Agent-Reach and No AI Slop adapters. Their upstream plugin runtimes are not installed. Toolkit verification checks all five definitions, plan validation, cross-process memory retrieval and a complete SAFE scanner fixture. Public research helper discovery was also exercised with NVIDIA/SkillSpector. This chat does not expose a repository-skill UI discovery API, so native menu registration cannot be independently asserted.
7. Keep integration tests on disposable GitHub-hosted Supabase infrastructure. This cloud environment uses Docker VFS; do not repeatedly pull PostgreSQL images or change the storage driver. Never redirect test suites to a hosted CRM project. Keep the npm audit and secret-scanning gates enabled.
8. Verify GitHub write access with an authorized feature-branch push when work is ready. Git fetch and normal branch deletion worked in this maintenance task. `gh auth status` failed for the task's CLI binding; do not replace or print credentials. Connected GitHub tools remain usable and are separate from shell authentication. Production browser/Supabase hosts are blocked by direct cloud HTTPS policy; use connected read-only tools or the credential-free `Production read-only smoke` workflow. Do not bypass the proxy. Authenticated live testing still requires a designated securely bound test account.

9. Read `docs/database/HOSTED-BACKUP-WORKFLOW-DESIGN.md` before hosted maintenance. Both databases retain 19 migrations with mismatched final versions; no hosted backup or repair has been completed. Preserve the current guards until private backup retention, decryption, secured restore rehearsal and exact metadata rollback are verified. Production requires separate project-specific authorization. Never run hosted `db push`, reset or migration SQL replay to hide this drift.

## What persists

Git persists AGENTS.md, the five skill definitions, planning helpers and JSON plans, Markdown memory, setup scripts, lockfiles, source, release docs and test baselines. Task-local items do not persist through Git: `node_modules`, `work/ai-toolkit` source checkout and venv, scanner cache, captures/reports, browser binaries and any service authentication. Never commit credentials or customer data as project memory.

The broad tool inventory reported 16/29 ready in this environment. Missing optional standalone tools include Snyk and Windows/mobile/security utilities; it does not mean the five repository skills failed. Do not install every listed utility merely to make that inventory green.

## Cloud revision and publication

The current VoIP task observed desired/observed revision **2**, running and connected, with current observations, enforced restricted networking, and no configured secrets, runtime variables or outbound identities. The preceding maintenance task observed revision 7 in its own environment instance; recheck revisions after environment changes and in each new task. This status does not establish PostgreSQL connectivity or publication.

The tools expose status but no environment publish action. **Publication of a reusable environment revision is unverified.** If the owner wants environment-level persistence, open Codex Cloud Settings → Environments, select the CRM environment, review setup prerequisites and allowed destinations, save and publish the revision in the UI, then start a fresh task and recheck observed revision plus toolkit verification. No publish action was performed here.

Latest storage snapshot after fresh bootstrap and regression dependencies: about 28 GiB available, 9% used on a 32 GiB filesystem. No Docker image was downloaded. Recheck with `scripts/ai-toolkit/check-storage.sh` and avoid duplicate installations in another worktree. Keep the pinned editable SkillSpector source required by its venv.
