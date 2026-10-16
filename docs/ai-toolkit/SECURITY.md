# AI toolkit security review

**Review date:** 2026-10-16 (UTC)

**Method:** Inspect official README, source manifests, relevant installers/hooks, and licenses. Pin upstreams to the commit SHAs below. Run SkillSpector 2.12.0 in static-only mode (`--no-llm`) on the upstream skill bundles. The scan inputs were public upstream files only; no CRM source, credentials, or customer data were sent to an external scanner. This checked-in document is the retained security report. Raw JSON output and public source clones remain task-local scratch and are not committed.

## NVIDIA SkillSpector

- Source: https://github.com/NVIDIA/SkillSpector/tree/e8850a88c02dfc53cf8abead1ff753d35b5ba853
- License: Apache-2.0; project states Python 3.12+.
- Installed from the reviewed checkout with `uv sync --locked --no-dev`, 69 exact locked packages installed into a dedicated virtual environment. Static scan mode was verified with LLM analysis disabled. No model, provider credential, external LLM service, or MCP extra was configured.
- The source manifest includes provider and cloud SDK dependencies (OpenAI, LangChain, AWS, Google Auth) even though static use does not configure those providers. This adds weight and attack surface; no credentials were supplied. Static scans can use SkillSpector's public OSV lookup for package metadata. Do not use this scanner on private CRM source.
- Harmless sample result: risk 0/100 (LOW), recommendation `SAFE`, 0 issues, 100% coverage, execution successful.
- A positive result from one sample does not establish that the scanner itself is vulnerability-free. The scanner source was reviewed, but it was not self-scanned before installation.

## Upstream skill scans

All commands used the local scanner with `--no-llm --format json`; recursive scans were bounded by SkillSpector's own analysis limits.

| Source (pinned commit) | Scan result | Decision |
| --- | --- | --- |
| GSD Core `open-gsd/gsd-core` `374d9dd1be07880f31e88857e7f0087e21bc5fbb` | 72 skill directories found; 32 scanned, 40 omitted after the aggregate safety limit. Overall LOW, max score 14, but only 23.61% reported file coverage. Several findings were LOW/MEDIUM and in documentation/skill text. | Incomplete review; no upstream installer or code executed. Use the small, independently written Codex planning workflow only. |
| Claude-Mem `thedotmack/claude-mem` `b8fc2ef9bab0dd1438d6cc8699c6884445ad409b` | 23 skill directories scanned; overall CRITICAL, max score 100, partial coverage (26.09%). CRITICAL/HIGH findings appeared in bundled Agent Cost Report, `ccs-align`, `mode-creator`, `standup`, and `version-bump` skills. The directly relevant `mem-search` and `learn-codebase` skill folders individually reported LOW with 0 issues. | Do not install the full bundled plugin. Its Codex hook file was inspected, but the worker/runtime/hooks were not installed. Use the independent Markdown memory adapter. |
| Agent-Reach `Panniantong/Agent-Reach` `94f06c1969dfc1834001269d79d3ad0972d9dee6` | Score 95/100 CRITICAL, 7 findings, 88.9% coverage. Findings included incomplete inspection of `references/career.md`, a YARA information-stealer signature in text about cookies, an anti-refusal match on login-state wording, an unpinned `uvx mcp-server-linkedin` command, and a public external Bilibili endpoint. | Do not install the upstream skill/CLI. Cookie/browser/social integrations are outside the requested public-only scope. Use the separate allowlisted public research adapter. |
| No AI Slop `petergyang/no-ai-slop` `000650b156983f5159695b441477f4e63b25dc85` | Skill scan complete, 0 issues, LOW 0/100, `SAFE`, 100% coverage. | Copy/adapt the writing instructions and evaluation checklist under the upstream MIT license. No installation script or runtime dependency used. |

Agent-Reach's YARA and anti-refusal findings may be contextual false positives: the flagged text discusses manually supplied cookies and how to detect an expired login. Those instructions are not needed here. The incomplete artifact and external API findings remain visible in the report and are not suppressed. Claude-Mem findings relate to the full bundle; the clean results for two individual skills do not clear the rest of the plugin or its install hooks.

## Codex skill bundle scans

The five adapted repository skills each produced zero scanner findings. `professional-writing` received a complete `SAFE` result (100% file coverage). SkillSpector marked the other four as `CAUTION`/partial because references from a standalone skill directory point to helper scripts or docs elsewhere in the repository. Their analyzed files had zero findings, but those four results are not treated as complete reviews. The `scan-skill.sh` wrapper fails closed when SkillSpector reports incomplete coverage. A complete harmless fixture scan is the functional smoke test for the scanner integration.

## Installation and permission review

- `uv sync` used the upstream lockfile and declared Python build backend. It did not invoke the repositories' shell installer scripts.
- GSD's README recommends a live `npx` installer; the package declares build/prepare scripts and runtime dependencies. Not run.
- Claude-Mem's documented setup installs lifecycle hooks, a worker, numerous tree-sitter grammars, and can initiate hosted-provider sign-in. Its Codex hook entries execute local Node worker code. Not run.
- Agent-Reach's installer can provision multiple platform tools, MCP integrations, and optional cookie-backed channels. Not run.
- No AI Slop's content can be copied without runtime dependencies; only the reviewed skill and eval text were adapted.
- No remote LLM analyzer, browser-cookie access, account integration, private API, paid service, or Google Drive authorization was used.
