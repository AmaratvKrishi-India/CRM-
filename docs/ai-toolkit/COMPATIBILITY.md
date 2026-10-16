# Tool compatibility

| Upstream tool | Codex status | What is present here | What is not installed |
| --- | --- | --- | --- |
| [NVIDIA SkillSpector](https://github.com/NVIDIA/SkillSpector) | Installed and verified | Static scan CLI 2.12.0 at `e8850a88c02dfc53cf8abead1ff753d35b5ba853`, pinned locked dependencies, and a local scan skill. | LLM/provider analysis and MCP server extras. |
| [GSD Core](https://github.com/open-gsd/gsd-core) | Adapted and verified | `gsd-planning` Codex skill, JSON plan validation/reporting, milestone/phase/task states, dependencies, and a completed sample plan. | Upstream npm package and its install/build scripts. |
| [Claude-Mem](https://github.com/thedotmack/claude-mem) | Adapted and verified | `project-memory` skill and standard-library Markdown memory helper. The upstream source has Codex hook entries in `plugin/hooks/codex-hooks.json`. | Worker, Bun runtime, native hooks, SQLite/FTS/vector store, hosted memory, login, and cloud sync. Compatibility of the complete plugin with this Codex Cloud session is not claimed. |
| [Agent-Reach](https://github.com/Panniantong/Agent-Reach) | Adapted and verified | `internet-research` skill and a public-only helper for GitHub HEAD refs and allowlisted technical documentation. | Upstream CLI, social platform channels, browser/cookie integrations, optional MCP servers, and paid/proxy services. |
| [No AI Slop](https://github.com/petergyang/no-ai-slop) | Adapted and verified | Its writing rules and evaluation checklist in `professional-writing`, with upstream MIT license attribution and no runtime dependencies. | Upstream plugin installer. |

All skills use the repository-local Codex format: a `SKILL.md` with YAML frontmatter containing `name` and `description`. They are loaded on demand from `.agents/skills/`.

## Environment requirements

- Node.js 24 and existing npm dependencies remain as supplied by the CRM workspace.
- Python 3.12, Git, and `uv` are required only to rebuild/run SkillSpector.
- The GSD plan, memory, and research helpers use Python's standard library. The writing skill has no runtime.
- No new global executable, npm package, Docker image, API credential, browser profile, or model is required for the adapted tools.
