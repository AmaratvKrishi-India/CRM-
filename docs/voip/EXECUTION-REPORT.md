# VoIP pilot execution report — 17 October 2026 IST

**Interim verdict: DEVELOPMENT INCOMPLETE for real JioFiber calling.** A safe mock implementation is reviewable. The pinned upstream candidates fail the security gate; real integration, HTTPS Windows handoff and hardware/carrier acceptance remain blocked. This report is updated with final regression/CI evidence before handoff. No merge or Production deployment is authorized.

Repository `AmaratvKrishi-India/CRM-`; original `/workspace/CRM-` checkout `work` at released 0eea4fe preserved. Isolated worktree `/workspace/crm-voip`, branch `chore/post-release-maintenance`, [open PR #10](https://github.com/AmaratvKrishi-India/CRM-/pull/10). Actual starting head was **d7a5d6d100a6bd32315a7c1ccd17f831a50b2a59**, newer than the prompt snapshot. Released main was **0eea4febfa7e7e1babf0384f3ce47909d28970e8**. No upstream binary or installer was executed.

| Work item | Status | Evidence / limit | Next action / owner |
| --- | --- | --- | --- |
| Source audit / license / hashes | PASS | `UPSTREAM-SECURITY-REVIEW.md`, `upstream-lock.json`, `python3 scripts/verify-voip-upstream.py` passed | Reviewer: audit decision; live execution rejected |
| CRM mock/provider/settings | PASS | Typed providers, scoped opt-in flags, current lead/DNC, manual outcomes, unverified zero duration | Synthetic accounts only |
| Companion policy/contract | PASS | 27 `node --test companion/server.test.mjs` cases; no real engine connection | Windows CI pending current commit |
| Operations guards | PASS | 10 `node --test tests/voip/*.test.mjs` cases | No backup or hosted write is executed |
| New service/lifecycle tests | PASS | 15 Windows tests; full non-integration Vitest 253/253 in 18 files | Disposable backend regression in existing CI |
| New Chromium actual HTTP path | PASS | 4/4 browser tests, including synthetic lead → companion → outcome → history, axe, refresh and Android UA | Local Linux Chromium only |
| Type/lint/test types/build/bundle | PASS | `npm run typecheck`, `lint`, `test:type`, guarded synthetic `build`, bundle gate; 1,178,712 JS bytes / 314,125 gzip / 266,948 Brotli, 17 chunks, no warnings | Final CI repeats existing gates |
| Dependency/secret/toolkit | PASS | Full npm audit zero vulnerabilities; `secret-scanner-test.ts --fail-on-found`; pinned toolkit SAFE fixture complete with 0 findings | No remote source analyzer used |
| Broad Node/Chromium/tablet regression | NOT_RUN | In progress at initial feature commit; final results follow | Codex continues and repairs failures |
| Windows source packaging | NOT_RUN | Workflow added; package whitelist/checksums generated locally | Run current-head Windows CI |
| Local Production read-only attempt | FAIL | Browser navigation failed under cloud egress restriction; zero viewports passed | Use authorized hosted runner, do not call this app success |
| Hosted Preview browser | BLOCKED | Exact Preview HEAD attempt denied CONNECT tunnel HTTP 403 by environment policy | Owner-approved access/test identity; guarded hosted E2E only Staging |
| Protected Production browser | BLOCKED | Baseline run [38978746789](https://github.com/AmaratvKrishi-India/CRM-/actions/runs/38978746789) workflow success; actual logs/artifact `result=blocked` / Vercel Deployment Protection | Optional protected manual header-only workflow prepared; no secret created |
| Live upstream/Jio/Windows/Bluetooth | BLOCKED | TLS peer verification disabled in source; unauthenticated global control bind; no authorized Windows hardware/carrier test | Source/security/license remediation then owner acceptance |
| Hosted recovery/migration/PG upgrade | BLOCKED | Missing approved contracts; readiness validator/template only; no dump/upload/restore/history repair/reset/upgrade | Ordered owner gates in remaining-operations doc |
| Merge / Production feature enablement | BLOCKED | Not authorized | Owner only after all hard gates |

## Change and evidence navigation

[Architecture](ARCHITECTURE.md), [setup and uninstall](SETUP-WINDOWS.md), [threat model](THREAT-MODEL.md), [test matrix](TEST-MATRIX.md), [manual acceptance](MANUAL-ACCEPTANCE.md), [remaining operations](REMAINING-OWNER-OPERATIONS.md), [rollback](ROLLBACK.md), [decision log](DECISIONS.md), [notices](THIRD-PARTY-NOTICES.md). Source files and commit lists are recorded after the final push. Prior CI 73 at d7a5d6d was green and does not validate this feature.

## Explicit exclusions and limits

No live SIP/IMS registration, Jio OTP, carrier call, customer call, recording, Windows binary installation, firewall/registry/service changes, hosted Supabase mutation, customer export, migration SQL, Production configuration change or merge. No verified headset audio, carrier duration or real answered timestamp. Mock registration/carrier fields remain false. The HTTP demo's tab identity and memory-only budget are insufficient for future live operation without additional attestation, OS isolation and durable local policy.

Existing recovery evidence reports 19 hosted migrations with Staging `20261003055436`, Production `20261003055551`, canonical `20261003000018`; unchanged by this task, not freshly revalidated hosted catalogs. Existing withdrawn PG 17.6.1.164 security-backport coverage remains unverified. No Git backup, local reset or successful CI is represented as hosted recoverability.
