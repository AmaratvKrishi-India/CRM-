# Changelog

## 2.0.0 — 2026-09-09 verification refresh

- Hardened child-record RLS against inaccessible parent leads (F047).
- Disabled Android WebView debugging in release builds (F048).
- Added keyboard skip links to the agent and admin shells (F049).
- Changed lead search to bounded cursor pagination (F050).
- Verified Docker-backed server ordering and sync tests: 22/22 passing.
- Verified current emulator offline recovery, export interruption, queue-capacity, and restart scenarios.

Known external release prerequisites remain documented in `docs/project-knowledge/FINAL_RELEASE_SIGNOFF_2026-09-09.md`.

## Documentation refresh — 2026-09-10

- Made `docs/README.md` the documentation entry point and authority map.
- Removed the superseded legacy guide mirror, old audit/remediation/handoff reports, duplicate gate documents, and the completed directory-organization plan.
- Retained the living source-verified guides, ADRs, current release notes, reference material, and the latest September 9 release verification.
- Refreshed current-state links, repository counts, release-gate references, and documentation-maintenance rules.
