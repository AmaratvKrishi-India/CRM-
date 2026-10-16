# AI toolkit security review

**Review date:** 2026-10-16 (UTC)

**Method:** Inspect official README, source manifests, relevant installers/hooks, and licenses. Pin upstreams to the commit SHAs below. Run SkillSpector 2.12.0 in static-only mode (`--no-llm`) on the upstream skill bundles. The scan inputs were public upstream files only; no CRM source, credentials, or customer data were sent to an external scanner. Upstream scan output remains summarized below. The separate npm dependency audit JSON is retained under [`dependency-audit/`](dependency-audit/).

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

## CRM npm dependency audit

**Run date:** 2026-10-16 (UTC). Full output is retained in [`dependency-audit/dependency-audit-before.json`](dependency-audit/dependency-audit-before.json), [`dependency-audit/dependency-audit-after.json`](dependency-audit/dependency-audit-after.json), and the corresponding production-only JSON files.

| Scope | Before | After |
| --- | ---: | ---: |
| Full lockfile | 30 affected packages: 6 critical, 1 high, 23 moderate | 4 moderate, 0 high, 0 critical |
| Production (`npm audit --omit=dev`) | 0 | 0 |

All 30 findings before the changes were in development-only packages. None of the affected packages ships in the CRM production dependency tree. The remaining four moderate findings are also development-only. The existing `npm audit --audit-level=high` gate is unchanged and passes; the moderate Snyk findings remain visible in both npm output and the checked-in report.

### Repairs applied

| Package | Change | Dependency path and impact |
| --- | --- | --- |
| `shell-quote` | 1.10.0 → 1.11.0 via a root npm override | Appium 3.8.0 → `@appium/support` 7.2.8 and `teen_process` 4.2.1 → `shell-quote`. GHSA-pqg4-j6r4-53mv affects `>=1.8.4 <1.11.0` and describes command injection in `quote()` with a crafted line terminator after a comment token. The package is actively imported by Appium process helpers, so this was reachable when using the development Appium CLI. No CRM production path uses Appium. The override stays within shell-quote 1.x; `npm ls` confirmed both Appium dependency paths resolve to 1.11.0, and Appium 3.8.0 starts successfully.
| `source-map-js` | 1.2.1 → 1.2.2 | Used by PostCSS/Vite, Tailwind's build plugin, and Vitest coverage. GHSA-68fv-2mgg-jv7q affects `<1.2.2` and allows event-loop denial of service when parsing specially crafted indexed source-map offsets. This is reachable in development/build tooling when processing untrusted source maps; it is not part of the shipped production dependency tree.
| `smol-toml` | 1.8.0 → 1.9.1 | Used by Knip's TOML reader. GHSA-r4xh-jqrq-34v2 affects `<=1.8.0` and describes quadratic parse time from repeated key rescans. A crafted TOML file could consume excessive time when Knip parses it. It is limited to the developer dead-code audit tool.
| `jest` | Removed direct dev dependency `^30.5.2` | Knip marked it unused. The repository has no Jest config, Jest script, or Jest imports; configured tests use Node `node:test` and Vitest. Removing it also removed its vulnerable `@jest/*` → `babel-plugin-istanbul` → `@istanbuljs/load-nyc-config` → `js-yaml` 3.x → `argparse` → `sprintf-js` chain. `scripts/verify-toolchain.ts` no longer expects Jest as an installed alternative runner.
| `snyk` | 1.1307.3 → 1.1308.1 within the declared `^1.1307.3` range | Snyk is retained because the manual Windows audit workflow invokes it. Updating within the allowed range did not fix the upstream dependency tree; no safe Snyk release was available during this audit.

The lockfile removes 251 package entries, primarily Jest-only packages; the retained package versions changed only for `shell-quote`, `smol-toml`, `snyk`, and `source-map-js`. The lockfile was regenerated with npm rather than patched by hand, and retained platform metadata for packages still installed.

### Remaining moderate finding

- **Advisory:** GHSA-hp3w-g68c-fv3c (`sprintf-js` denial of service from unbounded precision specifiers; affected `sprintf-js <=1.1.3`).
- **Path:** `snyk@1.1308.1` → `global-agent@3.0.0` / `roarr@2.15.4` → `sprintf-js@1.1.2`.
- **Reachability and impact:** this is a dev-only Snyk CLI logging dependency and is absent from the CRM runtime. A crafted format string can make the formatter spend excessive time; the potential impact is a stuck developer audit process. The Snyk wrapper's binary could not be downloaded in this workspace, so its end-to-end CLI path was not exercised. The package relationship itself is confirmed in the npm lockfile.
- **Why it remains:** the registry's latest `sprintf-js` is 1.1.3, still inside the advisory range. Snyk 1.1308.1 bundles vulnerable `roarr` and `global-agent`; npm's suggested “fix” is a breaking downgrade to Snyk 1.1306.4. We did not force a downgrade or remove an actively referenced audit tool.
- **Recommended resolution:** update Snyk when it ships a patched dependency tree, or review replacing its npm wrapper with a supported binary distribution that removes these packages. Keep the finding visible and rerun the full audit after that change.

The initial full audit also reported `global-agent` and `roarr` through this same Snyk dependency chain. Their advisories do not add a separate application runtime path; the retained JSON preserves their individual package and advisory metadata.

### Reachability summary

`shell-quote` was imported in active Appium process helpers and received the minimal patched override. `source-map-js` is loaded by the local build pipeline when handling source maps. `smol-toml` is loaded when Knip parses TOML. Jest and its transitive chain were unused and removed. Snyk remains a manual development tool with one unresolved moderate dependency chain. None of these tools is shipped or called by the CRM production application. The production-only audit confirmed zero findings before and after the repair.

The Snyk wrapper attempted to download its CLI from `downloads.snyk.io` and `static.snyk.io`; both connections were reset by the enforced workspace egress policy. No network-policy bypass was attempted. npm audit itself ran locally and its high-severity gate passed.
