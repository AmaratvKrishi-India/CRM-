# Codex repository guidance

## Session continuity

- Before substantial work, read `docs/ai-toolkit/MEMORY.md` or run `python3 scripts/ai-toolkit/memory.py show`.
- Record only durable technical decisions, architecture notes, completed work, and pending work. Never store customer names, contact details, CRM records, credentials, tokens, or secrets.
- Use `python3 scripts/ai-toolkit/memory.py append --section "Decisions" --text "..."` to add a memory entry. The helper rejects common credential and contact patterns; review all memory text before committing.

## Planning and storage

- For multi-step development work, create or update a Git-tracked plan under `docs/ai-toolkit/plans/` with milestones, phases, task IDs, dependencies, and statuses. Validate it with `python3 scripts/ai-toolkit/plan.py validate <plan.json>` and summarize it with `python3 scripts/ai-toolkit/plan.py report <plan.json>`.
- Before installing dependencies or starting containers, run `scripts/ai-toolkit/check-storage.sh`. Do not change the managed Docker storage driver. In this Codex Cloud workspace Docker uses VFS; run full Supabase tests on GitHub-hosted runners instead of repeatedly extracting PostgreSQL images here.

## On-demand skills

Codex discovers repository skills from `.agents/skills/<skill-name>/SKILL.md`. Load only the relevant skill for a task. The available skills are `security-scanner`, `gsd-planning`, `project-memory`, `internet-research`, and `professional-writing`.

## External services

- Google Drive work is on hold. Preserve the existing scripts and documentation and do not configure OAuth, rclone, uploads, schedules, or Drive tests unless the user explicitly resumes that work.
- Use synthetic data for tests. Never connect test suites to production databases or deploy from this repository without explicit authorization.
