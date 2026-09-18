# Current Acceptance Gates

**Last reviewed:** 2026-09-15
**Decision:** **RELEASE-APPROVED**
**Branch:** `codex/release-readiness`
**Release source SHA:** `642487043191292b8dbd0e87e498879068403572`
**Production deployment:** `dpl_EzsayArGERwSg4itFtBDUku3wamd`
**Production URL:** `https://crm-blush-omega.vercel.app`
**Authority:** `docs/project-knowledge/FINAL_PRODUCTION_RELEASE_2026-09-14.md`

Physical-device acceptance is explicitly **WAIVED BY USER** for this release decision. It is not recorded as PASS.

## Gate summary

| Gate | Status | Final evidence |
|---|---|---|
| Core configured test runner | PASS | `npm run test:all` **10/10**, 0 failed, 0 skipped |
| Core Node suite | PASS | **318/318** on the CI-approved release source |
| Strict release verifier | PASS | Final verifier completed with **0 command failures** |
| Full Playwright matrix | PASS | **212/212** across Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari, and Tablet |
| Production build | PASS | TypeScript/Vite production build exits 0 |
| Local Supabase / RLS | PASS | 17 migrations apply; real PostgreSQL/RLS integration passes |
| Multi-device synchronization | PASS | Fresh real three-emulator workflow **13/13 PASS** |
| Production Supabase parity | PASS | Fresh live evidence: **17/17 migrations** and local/production catalog parity |
| Production Supabase advisors | PASS WITH REVIEWED FINDINGS | No new P0/P1; existing INFO/WARN debt documented |
| Dependency / supply-chain audit | PASS | npm audit, OSV and Trivy report 0 current vulnerabilities |
| Semgrep / Gitleaks | PASS | Semgrep 0 findings; tracked-source Gitleaks no leaks |
| Mutation testing | PASS | **81.74%**, 94 killed / 19 survived / 2 uncovered |
| Android lint/build/emulator | PASS | Android lint/build, emulator smoke, and clean-checkout Android audit pass |
| Production-signed APK/AAB | PASS | Permanent production key created; APK/AAB signed and signer-verified |
| Current signed APK MobSF | PASS WITH REVIEWED HEURISTICS | 0 trackers, 0 secrets, 0 code-analysis highs; two reviewed StrandHogg manifest heuristics |
| Physical-device signed-artifact acceptance | WAIVED BY USER | User explicitly waived physical hardware verification |
| GitHub exact-source CI | PASS | Workflow run `34962704887` SUCCESS on `642487043191292b8dbd0e87e498879068403572` |
| GitHub rulesets / branch protection | EXTERNAL LIMITATION | Private-repository plan returns HTTP 403; no visibility/plan change authorized |
| Vercel production provenance | PASS | `dpl_EzsayArGERwSg4itFtBDUku3wamd` is READY/production with `gitCommitSha` and `releaseSourceSha` equal to `6424870…`, `gitDirty=0` |
| Production web smoke | PASS | Root/JS/CSS 200; correct title; Sign In renders; production Supabase configured; no localhost; strict security headers |
| Production browser/runtime errors | PASS | 0 console errors, 0 page errors, 0 failed requests; no error/fatal runtime logs in final checked window |

## Android artifact evidence

- APK SHA-256: `6FC5638347BE9EA45D65C98F80BE32B91FA1EF4F522F7F76970F00B61C48C9A5`
- APK size: **6,153,539 bytes**
- AAB SHA-256: `685A0923DEBC34890840662D134D17B4069EDBAC5F7D3436B5A319B394CB4AB8`
- AAB size: **5,977,051 bytes**
- Production certificate SHA-256: `3A:58:1C:93:98:F0:77:F9:37:10:94:C5:17:88:D0:40:9F:D4:76:4C:01:84:A9:5F:52:7D:BF:BD:2B:FF:2E:38`
- Key alias: `crm-production`
- Certificate validity: through **2054-01-31**

## Closure note

The first preview-promotion attempt was rejected as release evidence because its bundle had Supabase unconfigured. The authoritative production artifact was rebuilt from the clean exact release source with the validated ignored production environment, verified locally, and deployed as a Vercel prebuilt artifact. The final live bundle contains the expected production Supabase project and no unconfigured fallback.

Any commit after the release source SHA that changes only these release documents is a post-release documentation closure and does not change the deployed application or Android artifacts.

**RELEASE-APPROVED**
