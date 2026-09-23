# Current Acceptance Gates

**Last reviewed:** 2026-09-20
**Decision:** **RELEASE-CANDIDATE — NOT RELEASE-APPROVED**
**Branch:** `main`
**Candidate base SHA:** `aaa1d0c7fffdb464c6af2fc13baf2bb778fccd7d`
**Candidate working tree:** release-closure fixes are currently uncommitted; record the final exact SHA after commit.
**Previously approved source SHA:** `642487043191292b8dbd0e87e498879068403572`
**Current production deployment:** `dpl_EzsayArGERwSg4itFtBDUku3wamd` (previous approved source only)
**Production URL:** `https://crm-blush-omega.vercel.app`

This file is the living gate summary for the current checkout. Historical deployment
reports and signed artifacts are intentionally not stored in this repository; rerun
candidate-specific checks before relying on them.

## Current evidence

| Gate | Current result | Evidence |
|---|---|---|
| TypeScript | PASS | `npm run typecheck` |
| Type tests | PASS | `npm run test:type` |
| ESLint | PASS | `npm run lint` |
| Node suite | PASS | `npm test` — 347/347 |
| Vitest suite | PASS | `npm run test:vitest` — 267/267 |
| Production web build | PASS | `npm run build` |
| Bundle budget | PASS | `npm run test:perf:bundle` — no warnings |
| Chromium browser suite | PASS WITH SKIPS | Mock-mode: 42 passed, 9 skipped; real-backend: 11/11 passed, including UI restore, backup export, reconnect recovery, and captured `tel:` handoff |
| Native handoff contracts | PASS WITH DEVICE GAP | Real browser captured `tel:` handoff; native/share fallback contract tests pass; physical Android dialer/share behavior still needs device acceptance |
| Visual regression suite | PASS | `npm run test:e2e:visual` — 11/11 |
| Mutation suite | PASS WITH SURVIVORS | `npm run audit:mutation` — 93.91% (108 killed, 7 survived, 0 uncovered) |
| Dependency audit | PASS | `npm audit --audit-level=high` — 0 vulnerabilities |
| Semgrep / secret scan | PASS | Semgrep 0 findings; secret scan 0 critical/high findings after honoring ignored generated paths; Gitleaks no leaks |
| Staging configuration | PASS | `npm run verify:staging-config` |
| Release configuration | PASS | `npm run verify:release-config` |
| Android release asset configuration | PASS | `npm run verify:android-release-assets` |
| Android lint | PASS | `npm run audit:android` |
| Database / architecture checks | PASS | `supabase db lint --local` — no schema errors; dependency-cruiser — 0 violations |
| Current signed APK/AAB build | PASS | APK 4,568,935 bytes, SHA-256 `6962707604471E945E1E8AB2C61B45205A1464C4B73C9C138C925FA1D6B1D17D`; AAB 4,441,902 bytes, SHA-256 `59D7EA468AB181736C86AB21D914DECFD59BBEBD793657CBE17AF20553673F04`; APK v2 signature verified |
| Local Supabase/RLS parity | PASS | Fresh 17-migration reset plus three-device RLS/sync acceptance — 13/13 |
| Current Android acceptance profile | NOT RECORDED | Rerun the selected Android profile for the exact candidate checkout |
| Real Edge Function acceptance | PASS | `npm run test:edge:real` — admin auth, provisioning, replay/idempotency, rejection, persistence, and audit |
| Full release profile | NOT RECORDED | Rerun the full profile after the final source commit |
| Exact-source CI | NOT RUN FOR CANDIDATE | Previous success was for `6424870…`, not this SHA |
| Production deployment/smoke | NOT RUN FOR CANDIDATE | Current production still identifies the previous approved source |
| Exact current APK emulator acceptance | PASS (RECORDED) | Fresh signed APK was installed and launched on `emulator-5556`; `MainActivity` was focused and process `6174` was alive before the later disposable-AVD recycle |
| Physical-device acceptance | WAIVED IN PRIOR CLOSURE | Reconfirm or perform exact-artifact device smoke before final signoff |

## Remaining release blockers

1. Commit the release-closure fixes and record the resulting exact candidate SHA.
2. Repeat the full release profile after the final source commit and retain the exact-SHA result outside the repository.
3. Re-run exact signed APK smoke after the final source commit, retaining the artifact hash and launch evidence; the current three-emulator sync and native lifecycle suites pass on local debug artifacts.
4. Run candidate-source CI and record the successful workflow run.
5. Deploy the candidate web bundle and perform production smoke/provenance checks against the candidate SHA.
6. Record candidate APK/AAB digests with the release handoff; keep signed artifacts outside the repository.
7. Decide and document the remaining product-scope items: physical native dialer/share acceptance, OS-level sync after app kill, legacy Maestro flows, and any partial security-review follow-ups.

## Known intentional limitation

JavaScript sync runs on login, foreground/resume, visibility, focus, network reconnect, and a foreground interval. OS-level synchronization after the app is fully killed is not implemented; shipping that behavior requires a native WorkManager integration or explicit product acceptance of the limitation.

**Final approval remains open until the candidate-specific blockers above are closed or explicitly accepted by the release owner.**
