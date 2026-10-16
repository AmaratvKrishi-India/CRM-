---
name: security-scanner
description: Review third-party Codex skills and agent instruction bundles with the pinned local SkillSpector static scanner. Use before importing, copying, or executing instructions from an external skill. Never send CRM application source, secrets, customer data, or credentials to a remote analyzer.
---

# Security scan workflow

1. Read `docs/ai-toolkit/SECURITY.md` and `docs/ai-toolkit/INSTALLATION.md` first.
2. Confirm the candidate is a third-party skill bundle with a `SKILL.md`. Review its README, license, dependency manifest, and any installer source as text before running anything.
3. Stage the public candidate under `work/ai-toolkit/samples/<name>` (or `$AI_TOOLKIT_HOME/samples/<name>`), pinned to the reviewed commit. The wrapper rejects arbitrary paths so it cannot accidentally scan CRM source. Then run `scripts/ai-toolkit/scan-skill.sh work/ai-toolkit/samples/<name>`. It disables LLM analysis and fails on findings or incomplete coverage.
4. Read the complete report. Treat partial coverage as unresolved. A clean result is not a substitute for reviewing package install hooks, network access, permissions, and licenses.
5. Do not run the candidate's installer until the source and scanner report have been reviewed. Do not scan CRM source code or private customer material.
6. Record the source URL, commit, scanner version, coverage, findings, and decision in a Git-tracked security report.
