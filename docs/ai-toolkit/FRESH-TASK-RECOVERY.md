# Start a fresh Codex task safely

Last checked: 2026-10-16. Released main: `f6f9d7e199cbc8b56cba6ef82644bbc394c3f5cb`. The post-release security fix is reviewed in a separate PR; check its merge status before assuming main includes it.

1. Open the repository `AmaratvKrishi-India/CRM-`. A GitHub push does not update an existing Codex checkout. Inspect `pwd`, `git status --short --branch`, `git diff --cached --stat`, `git branch -avv`, `git worktree list` and `git log --branches --not --remotes --oneline` before changing branches. Preserve staged work, untracked files and local-only commits. Never reset or force-push to synchronize.
2. `git fetch origin`. Compare `origin/main` with the last verified release. If the checkout is clean, `git switch main` then `git merge --ff-only origin/main`. If dirty or diverged, create a separate detached worktree with `git worktree add --detach work/latest-main origin/main`; leave the original working tree and index intact. Do not nest a worktree in a path already occupied by valuable files.
3. Read `AGENTS.md`, `docs/ai-toolkit/MEMORY.md`, the active tracked plan, and the newest post-release audit. Old reports contain historical hold decisions; use their dated follow-up documents for current status. The owner excludes Android real-backend sync testing and has not resumed VoIP or Drive work.
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
8. Verify GitHub write access with an authorized feature-branch push when work is ready. This task successfully pushed branch deletions and a feature branch. Shell GitHub API access is denied by network policy; connected GitHub tools are separate. Production browser/Supabase hosts are also blocked from direct cloud HTTPS; use supported connectors for read-only evidence, or have the owner update the environment's allowed destinations. Do not bypass the proxy.

## What persists

Git persists AGENTS.md, the five skill definitions, planning helpers and JSON plans, Markdown memory, setup scripts, lockfiles, source, release docs and test baselines. Task-local items do not persist through Git: `node_modules`, `work/ai-toolkit` source checkout and venv, scanner cache, captures/reports, browser binaries and any service authentication. Never commit credentials or customer data as project memory.

The broad tool inventory reported 16/29 ready in this environment. Missing optional standalone tools include Snyk and Windows/mobile/security utilities; it does not mean the five repository skills failed. Do not install every listed utility merely to make that inventory green.

## Cloud revision and publication

The managed environment reports desired/observed revision **2**, running and connected, with current observations, enforced restricted networking, and no configured secrets, runtime variables or outbound identities. This differs from the old report's revision 4; environment instances/configuration versions must be verified each task.

The tools expose status but no environment publish action. **Publication of a reusable environment revision is unverified.** If the owner wants environment-level persistence, open Codex Cloud Settings → Environments, select the CRM environment, review setup prerequisites and allowed destinations, save and publish the revision in the UI, then start a fresh task and recheck observed revision plus toolkit verification. No publish action was performed here.

Storage snapshot after installation/tests (recheck with `df -Pk /workspace`): the measured filesystem is 32,978,704 KiB total, 2,133,136 KiB used, 29,151,464 KiB available (7%). SkillSpector venv is 216 MiB, its pinned editable source 19 MiB, and Playwright cache 267 MiB. No Docker image was downloaded. Recheck available storage in each new task.
