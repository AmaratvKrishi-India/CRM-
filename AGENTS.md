<!-- graft:start -->
## Repository discovery and Graft

This checkout may contain a locally generated source graph under `graft/`. The directory is intentionally ignored and regenerable, so do not assume it exists in a fresh clone or treat it as repository authority. Use it as a navigation aid when present.

### Tool availability rule

Do not assume optional local CLIs are installed. Before using Graft or ripgrep, check availability (`Get-Command graft -ErrorAction SilentlyContinue`, `Get-Command rg -ErrorAction SilentlyContinue` on PowerShell, or the shell equivalent).

If the `graft` CLI is available:
- `graft map` gives repository orientation.
- `graft ask "<question>" --source` locates and explains relevant spans.
- `graft grep "<literal>"` is the exhaustive indexed search.
- `graft skeleton <file>` summarizes definitions.
- `graft callers <symbol>` traces call relationships.
- After large code changes, refresh the graph with `graft build`.

If the `graft` CLI is unavailable, **do not block the task**. Browse `graft/INDEX.md` and its linked nodes directly, then verify claims against the exact source ranges before editing.

For literal/exhaustive text search, prefer `rg` when installed. If `rg` is unavailable, use `git grep -n`, PowerShell `Get-ChildItem ... | Select-String`, or another repository-aware search available in the environment.

### Source and edit discipline

- Treat graph nodes as navigation aids, not as authority over newer source code.
- If a graph span is truncated or appears stale, open the exact source range before finalizing.
- For exhaustive tasks, verify every relevant occurrence; ranked search results alone are not exhaustive.
- Preserve unrelated dirty working-tree changes. Inspect `git status` before overlapping edits.
- Do not infer current behavior from superseded reports; use living docs plus current source/migrations/tests.
- Do not commit, push, deploy, sign, or run production migrations unless explicitly authorized.

The Graft CLI and `rg` are convenience tools, not hard prerequisites for working in this checkout. If a local `graft/` graph exists, it may supplement repository-native search; otherwise use `git grep`, PowerShell `Select-String`, or equivalent source search directly.
<!-- graft:end -->
