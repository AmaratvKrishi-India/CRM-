# Codex AI toolkit

This toolkit adds five repo-local Codex skills and one pinned, isolated static scanner. The skills live in `.agents/skills/` and are loaded only when relevant; the scanner environment is rebuilt under ignored `work/ai-toolkit/` by the setup script.

## Install and verify

```bash
scripts/ai-toolkit/check-storage.sh
scripts/ai-toolkit/bootstrap.sh
scripts/ai-toolkit/verify.sh
```

No application dependency was added to `package.json` or `package-lock.json`. The setup does not start Docker, install PostgreSQL, configure Google Drive, or request API credentials.

## Skills

| Codex skill | Invocation | Purpose |
| --- | --- | --- |
| `security-scanner` | `/security-scanner` | Review third-party skill bundles with pinned SkillSpector. |
| `gsd-planning` | `/gsd-planning` | Track milestones, phases, dependencies, and task status in Git. |
| `project-memory` | `/project-memory` | Retrieve and update privacy-conscious project memory. |
| `internet-research` | `/internet-research` | Retrieve public GitHub refs and official technical documentation with citations. |
| `professional-writing` | `/professional-writing` | Edit or inspect business and technical writing using No AI Slop rules. |

Codex discovers these skills from `.agents/skills/<directory>/SKILL.md` when the repository is open. Invoke one by its slash name or let Codex select it from the description. Read the chosen `SKILL.md` only when needed; the five skill files are not added to every task's context.

See [post-release verification](POST-RELEASE-VERIFICATION.md) and [fresh-task recovery](FRESH-TASK-RECOVERY.md) for the latest release state; the audit results below are historical.

## Current status

- NVIDIA SkillSpector 2.12.0 is installed and verified in an isolated Python 3.12 environment. The pinned source commit and full lockfile are in `scripts/ai-toolkit/bootstrap.sh`.
- GSD Core is adapted as a Git-tracked Codex planning skill. The upstream package installer is not run.
- Claude-Mem is adapted as a small Git-tracked Markdown memory and standard-library helper. The upstream plugin is not installed.
- Agent-Reach is adapted as a public-only GitHub/documentation workflow using existing `git` and Python. Its broad third-party integrations are not installed.
- No AI Slop is adapted as the `professional-writing` skill under its MIT license, with no runtime dependencies.
- Dependency audit repairs reduced findings from 30 (6 critical, 1 high, 23 moderate) to 4 moderate in the dev-only Snyk CLI chain. The production dependency audit reports 0 before and after. The existing high-severity audit gate remains unchanged.
- `scripts/ai-toolkit/verify.sh` validates all five skills and the scanner, planning, and memory smoke checks. Full PostgreSQL/Supabase integration runs on GitHub-hosted runners because Codex Cloud uses Docker VFS.

See `INSTALLATION.md`, `COMPATIBILITY.md`, `SECURITY.md`, `MEMORY.md`, and `TEST-RESULTS.md` for exact versions, findings, limitations, and validation.

The raw npm audit JSON is retained under [`dependency-audit/`](dependency-audit/).
