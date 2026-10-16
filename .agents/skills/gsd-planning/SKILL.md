---
name: gsd-planning
description: Break multi-step CRM development into Git-tracked milestones, phases, dependency-aware tasks, and a completion report. Use when planning or tracking a feature, regression fix, infrastructure change, or multi-step investigation.
---

# Structured development planning

Use the repository-local plan format as the Codex-compatible GSD workflow. The upstream GSD Core installer is not required.

1. Read `docs/ai-toolkit/MEMORY.md` and the current project plan if one exists.
2. Create or update a JSON plan under `docs/ai-toolkit/plans/`. Include a milestone, ordered phases, stable task IDs, `depends_on` task IDs, and a status for each task (`pending`, `in_progress`, `completed`, or `blocked`).
3. Keep tasks small enough to verify independently. Mark a task blocked with a short `blocker` field when progress depends on external access or a platform capability.
4. Do not mark a task completed until its acceptance check passes. A completed task may depend only on completed tasks.
5. Validate and report the plan:

   ```bash
   python3 scripts/ai-toolkit/plan.py validate docs/ai-toolkit/plans/<plan>.json
   python3 scripts/ai-toolkit/plan.py report docs/ai-toolkit/plans/<plan>.json
   ```

6. Update task statuses as work proceeds, then include the report and remaining blockers in the final response.
