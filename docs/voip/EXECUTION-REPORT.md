# VoIP pilot execution report — 17 October 2026 IST

**Verdict: DEVELOPMENT INCOMPLETE for real JioFiber calling.** A safe mock implementation is reviewable. The pinned upstream candidates fail the security gate; real integration, HTTPS Windows handoff and hardware/carrier acceptance remain blocked. No merge or Production deployment is authorized.

Repository `AmaratvKrishi-India/CRM-`; original `/workspace/CRM-` checkout `work` at released 0eea4fe preserved. Isolated worktree `/workspace/crm-voip`, branch `chore/post-release-maintenance`, [open PR #10](https://github.com/AmaratvKrishi-India/CRM-/pull/10). Actual starting head was **d7a5d6d100a6bd32315a7c1ccd17f831a50b2a59**, newer than the prompt snapshot. Released main was **0eea4febfa7e7e1babf0384f3ce47909d28970e8**. No upstream binary or installer was executed.

| Work item | Status | Evidence / limit | Next action / owner |
| --- | --- | --- | --- |
| Source audit / license / hashes | PASS | `UPSTREAM-SECURITY-REVIEW.md`, `upstream-lock.json`, `python3 scripts/verify-voip-upstream.py` passed | Reviewer: audit decision; live execution rejected |
| Initial source-fetch hygiene | FAIL | Git source checkout included inert tracked prebuilt assets; none ran, clones removed after audit | Corrected verifier fetches pinned text only; disclosed, not a no-download pass |
| CRM mock/provider/settings | PASS | Typed providers, scoped opt-in flags, current lead/DNC, manual outcomes, unverified zero duration | Synthetic accounts only |
| Companion policy/contract | PASS | 27 `node --test companion/server.test.mjs` cases; no real engine connection | Windows job passed at final runtime 24fac77 |
| Operations guards | PASS | 10 `node --test tests/voip/*.test.mjs` cases | No backup or hosted write is executed |
| New service/lifecycle tests | PASS | 17/17 Windows tests; 255/255 non-integration Vitest tests in 18 files | Disposable backend regression in existing CI |
| New Chromium actual HTTP path | PASS | 6/6 focused browser tests: synthetic lead → companion → outcome → history, axe, refresh, explicit disable after connection loss, Android UA and synthetic HTTPS Production-CSP denial | Local Linux Chromium only |
| Type/lint/test types/build/bundle | PASS | `npm run typecheck`, `lint`, `test:type`, guarded synthetic `build`, bundle gate; 1,178,776 JS bytes / 314,154 gzip / 267,020 Brotli, 17 chunks, no warnings | Final CI repeats existing gates |
| Dependency/secret/toolkit | PASS | Full npm audit zero vulnerabilities; `secret-scanner-test.ts --fail-on-found`; pinned toolkit SAFE fixture complete with 0 findings | No remote source analyzer used |
| Optional automated Semgrep SAST | NOT_RUN | `npm run audit:security` cannot start: Semgrep executable unavailable; manual source/threat review completed | Run reviewed scanner/rules in an approved tooling environment; no clean SAST claim |
| Full disposable web CI baseline | PASS | [Release readiness 77](https://github.com/AmaratvKrishi-India/CRM-/actions/runs/39005557889) at 24fac77: 349 Node, 296 Vitest, 47 Chromium (+11 skipped for separate backend suite), 2 tablet, 11 disposable-backend browser cases; web job passed | Final paused-selection UI fix passed 6 local cases; final-head CI is linked from PR checks |
| Supported local Node regression | PASS | 306/306 database-independent tests; excludes F002/F003 server suites plus existing separate runner exclusions | Full disposable suites in CI |
| Android build baseline | PASS | Release readiness 77 at 24fac77: debug + unsigned release build SUCCESSFUL; synthetic test APK build SUCCESSFUL; artifact 12091371582, expires 24 October | Build proof only; no Android device or live synchronization claim |
| Full local Node command | FAIL | 349 total: 308 passed, 19 failed, 22 cancelled; absent supabase_db_calling_app | Never substitute hosted customer DB; use GitHub disposable runner |
| Broad local Chromium/tablet regression | PASS | 46 passed, 11 separate real-Supabase cases skipped; 2/2 tablet. All 11 existing visual baselines unchanged | Disposable CI separately runs the skipped backend browser cases |
| Windows source packaging / web mock CI | PASS | [VoIP synthetic pilot 4](https://github.com/AmaratvKrishi-India/CRM-/actions/runs/39005557947), both jobs passed at 24fac77 | Source ZIP/checksum artifact; not hardware/carrier acceptance |
| Local Production read-only attempt | FAIL | Browser navigation failed under cloud egress restriction; zero viewports passed | Use authorized hosted runner, do not call this app success |
| Hosted Preview browser | BLOCKED | Exact Preview HEAD attempt denied CONNECT tunnel HTTP 403 by environment policy | Owner-approved access/test identity; guarded hosted E2E only Staging |
| Protected Production browser | BLOCKED | Current inspected run [39005557959](https://github.com/AmaratvKrishi-India/CRM-/actions/runs/39005557959) workflow success; actual logs/artifact `result=blocked` / Vercel Deployment Protection | Optional protected manual header-only workflow prepared; no secret created |
| Live upstream/Jio/Windows/Bluetooth | BLOCKED | TLS peer verification disabled in source; unauthenticated global control bind; no authorized Windows hardware/carrier test | Source/security/license remediation then owner acceptance |
| Hosted recovery/migration/PG upgrade | BLOCKED | Missing approved contracts; readiness validator/template only; no dump/upload/restore/history repair/reset/upgrade | Ordered owner gates in remaining-operations doc |
| Merge / Production feature enablement | BLOCKED | Not authorized | Owner only after all hard gates |

## Change and evidence navigation

[Architecture](ARCHITECTURE.md), [setup and uninstall](SETUP-WINDOWS.md), [threat model](THREAT-MODEL.md), [test matrix](TEST-MATRIX.md), [manual acceptance](MANUAL-ACCEPTANCE.md), [remaining operations](REMAINING-OWNER-OPERATIONS.md), [rollback](ROLLBACK.md), [decision log](DECISIONS.md), [notices](THIRD-PARTY-NOTICES.md). Feature commit `72319a793b08ba3e7fdd6b4e53715e279e02bf40`; browser isolation fix `7a4982421c8ef9fd80d084f8fbd281830c903dfd`. Compatibility/security verification commit `a33dd7b840a9e0088fca962f4bd2ce12cad8fef8` uses the existing UUID helper so disabled-provider startup does not require randomUUID in older native WebViews; it also adds event-ordering and synthetic HTTPS CSP checks. Final runtime guard commit `24fac77ab5e87ddca343e6625b0fe294d1989678` additionally rejects Production public-key claims even on local mock URLs; 17 targeted tests passed after this change. Exact final evidence-only head is visible in the open PR. Prior CI 73 at d7a5d6d was green and does not validate this feature.

## Explicit exclusions and limits

No live SIP/IMS registration, Jio OTP, carrier call, customer call, recording, Windows binary installation, firewall/registry/service changes, hosted Supabase mutation, customer export, migration SQL, Production configuration change or merge. No verified headset audio, carrier duration or real answered timestamp. Mock registration/carrier fields remain false. A synthetic HTTPS origin with the actual Production CSP is tested to deny loopback fetch; this is policy proof, not an actual hosted-to-Windows acceptance test. The HTTP demo's tab identity and memory-only budget are insufficient for future live operation without additional attestation, OS isolation and durable local policy.

Existing recovery evidence reports 19 hosted migrations with Staging `20261003055436`, Production `20261003055551`, canonical `20261003000018`; unchanged by this task, not freshly revalidated hosted catalogs. Existing withdrawn PG 17.6.1.164 security-backport coverage remains unverified. No Git backup, local reset or successful CI is represented as hosted recoverability.

## Full touched file inventory (feature work from d7a5d6d)

```text
.github/workflows/manual-protected-production-smoke.yml
.github/workflows/voip-mock.yml
companion/protocol.mjs
companion/server.mjs
companion/server.test.mjs
docs/ai-toolkit/FRESH-TASK-RECOVERY.md
docs/ai-toolkit/MEMORY.md
docs/ai-toolkit/plans/jiofiber-voip-integration.json
docs/database/hosted-recovery-contract.example.json
docs/voip/ARCHITECTURE.md
docs/voip/DECISIONS.md
docs/voip/EXECUTION-REPORT.md
docs/voip/MANUAL-ACCEPTANCE.md
docs/voip/REMAINING-OWNER-OPERATIONS.md
docs/voip/ROLLBACK.md
docs/voip/SETUP-WINDOWS.md
docs/voip/TEST-MATRIX.md
docs/voip/THIRD-PARTY-NOTICES.md
docs/voip/THREAT-MODEL.md
docs/voip/UPSTREAM-SECURITY-REVIEW.md
docs/voip/upstream-lock.json
e2e/global-setup.ts
e2e/windows-calling.spec.ts
index.html
playwright.config.ts
scripts/check-browser-environment.py
scripts/deployment-protection.mjs
scripts/hosted-recovery-readiness.mjs
scripts/package-voip-companion.mjs
scripts/preview-test-guard.mjs
scripts/production-readonly-smoke.mjs
scripts/verify-voip-upstream.py
src/App.tsx
src/components/settings/SettingsModal.tsx
src/components/settings/WindowsCallingSettings.tsx
src/services/callLifecycleService.ts
src/services/calling/callProvider.ts
src/services/calling/nativeDialerProvider.ts
src/services/calling/windowsJioProvider.ts
tests/services/windowsCalling.test.ts
tests/voip/operations.test.mjs
vite.config.ts
```

## Reproducible local commands

```bash
node --test companion/server.test.mjs tests/voip/*.test.mjs
npx vitest run tests/services tests/db tests/utils --reporter dot
npx playwright test e2e/windows-calling.spec.ts --project=chromium
npm run test:e2e:chromium
npx playwright test e2e/tablet-responsive.spec.ts --project=Tablet
npm run typecheck
npm run lint
npm run test:type
VITE_SUPABASE_URL=https://codex-offline-test.supabase.co VITE_SUPABASE_ANON_KEY=offline-test-only-placeholder-do-not-authenticate npm run build
npm run test:perf:bundle
npm audit --audit-level=high
npm audit --omit=dev --audit-level=high
npx tsx scripts/secret-scanner-test.ts --fail-on-found
python3 scripts/verify-voip-upstream.py
python3 scripts/ai-toolkit/plan.py validate docs/ai-toolkit/plans/jiofiber-voip-integration.json
bash scripts/ai-toolkit/verify.sh
```

The full local `npm test -- --runInBand` failed solely at missing disposable-DB prerequisites (details above). Supported 306-case subset: Node runner files under tests/*.test.ts excluding f002AgentProvisioning, f003ServerOrdering, multiDeviceSync and realSupabasePostgres. These exclusions are local execution scope only: no CI tests were removed or made optional. The first broad browser run exposed the shared-fixture opt-in error; it was repaired with a dedicated pilot identity and all existing snapshots then passed unchanged.

Windows artifact at runtime 24fac77: `windows-mock-companion-source`, ID `12090228261`, wrapper digest `sha256:581d37a0c1370cf765714f561ab2ce066de3c5aa97316ffe69f1085b4a9d2277`, expiry 24 October 2026. It contains a source ZIP and its SHA-256 sidecar; verify both the sidecar and inner SHA256SUMS before local execution. This is not a signed upstream telephony binary.

Audit handling correction: the initial Git source checkouts also fetched upstream-tracked prebuilt assets as inert repository blobs. No asset was executed, provisioned or copied into CRM/package output, and no standalone release installer was fetched. Task-created temporary upstream clones were removed after text/hash review. Subsequent verification fetches only the selected pinned text files. The initial checkout should have been text-only; this is disclosed rather than claimed as no binary download.

Final recovery UI change: a failed/expired companion session keeps the Windows selection paused and exposes **Disable and unpair**, allowing explicit return to the native/manual dialer. A sixth focused browser case covers this actual connection-loss flow. No silent fallback or redial was added.

## Closure and final-head proof

The complete baseline at 24fac77 passed both Release readiness jobs, the unprivileged Windows/web-mock jobs and the public smoke orchestration. The smoke artifact remains BLOCKED, not app success. The final handoff commit contains the separately tested paused-selection Settings fix plus evidence/plan/continuity updates. Its exact SHA and current-head workflow URLs are in [PR #10](https://github.com/AmaratvKrishi-India/CRM-/pull/10) and the task handoff; do not infer its checks from an older green run. All 42 touched paths are listed above. `main` remains 0eea4febfa7e7e1babf0384f3ce47909d28970e8, PR OPEN; no merge or Production change.

Tracked plan: 17 completed mock/preparation tasks, 6 blocked external gates (upstream security/live transport, carrier authorization, Windows acceptance, protected browser, hosted recovery/migration and final merge). Real telephony remains DEVELOPMENT INCOMPLETE. No only-manual-testing claim is made: upstream hardening, session attestation/OS isolation, durable real-call policy and actual HTTPS Windows handoff still require implementation/review before live acceptance.
