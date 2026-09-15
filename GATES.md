# Current Acceptance Gates

**Last reviewed:** 2026-09-15
**Decision:** **NOT RELEASE-APPROVED**
**Branch:** `codex/release-readiness`
**Authority:** `docs/project-knowledge/COMPLETE_AUDIT_2026-09-14.md` pending final closure report `docs/project-knowledge/FINAL_PRODUCTION_RELEASE_2026-09-14.md`
**Historical evidence:** `docs/project-knowledge/FINAL_RELEASE_SIGNOFF_2026-09-09.md` is preserved as superseded historical evidence only and is not current release approval.

Physical-device acceptance is explicitly **WAIVED BY USER** for this release decision. It is not recorded as PASS.

## Gate summary

| Gate | Status | Current evidence |
|---|---|---|
| Core configured test runner | PASS | `npm run test:all` **10/10**, 0 failed, 0 skipped on the exact candidate before final harness/CI-trigger freeze |
| Strict release verifier | PASS / RE-RUN REQUIRED | Primary exact-candidate verifier completed with 0 command failures; final tree changed only for CI trigger + bounded emulator login retry and must be reverified |
| Full Playwright matrix | PASS | **212/212** across Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari, and Tablet |
| Production build | PASS | TypeScript/Vite production build exits 0 |
| Local Supabase / RLS | PASS | 17 migrations apply; real PostgreSQL/RLS integration passes |
| Multi-device synchronization | PASS / RE-RUN REQUIRED | Primary exact-candidate three-emulator run passed; a second immediate back-to-back run exposed an Agent B login-request harness timeout; bounded retry added without weakening HTTP 200 assertion |
| Production Supabase parity | PASS | Fresh live evidence: **17/17 migrations** and local/production catalog parity |
| Production Supabase advisors | PASS WITH REVIEWED FINDINGS | No new P0/P1; existing security/performance INFO/WARN debt documented |
| Dependency / supply-chain audit | PASS | npm audit, OSV and Trivy report 0 current vulnerabilities |
| Semgrep / Gitleaks | PASS | Semgrep 0 findings; tracked-source Gitleaks no leaks |
| Mutation testing | PASS | **81.74%**, 94 killed / 19 survived / 2 uncovered |
| Android lint/build/emulator | PASS | Android lint/build and emulator smoke pass |
| Current production-signed APK/AAB | **BLOCKED** | Existing production signing key/config is unavailable; current source produces an unsigned release APK only |
| Current signed APK MobSF | **BLOCKED** | Historical MobSF evidence cannot substitute for a newly signed artifact after source changes |
| Physical-device signed-artifact acceptance | **WAIVED BY USER** | User explicitly waived physical hardware verification |
| GitHub exact-SHA CI | PENDING | Release-branch push trigger added; final commit must receive successful remote workflow evidence |
| GitHub rulesets / branch protection | EXTERNAL LIMITATION | Private-repository plan returns HTTP 403; no visibility/plan change authorized |
| Vercel exact-SHA production provenance | PENDING | Existing READY production deployment is historical `c6bb3ed...` with `gitDirty=1` and cannot count as final proof |
| Production web smoke | PENDING FINAL DEPLOY | Must be rerun after clean exact-SHA production promotion |

## Android artifact evidence

Current unsigned APK:

- Path: `android/app/build/outputs/apk/release/app-release-unsigned.apk`
- SHA-256: `ACC41B43BDB973E2FC3A67E64601904C8793B5CB3F148F1ECCADC8F9B92CA4AD`
- Size: **6,145,603 bytes**

Historical production signing evidence (certificate `A131697E3CDF7ADE44C5C3DF3563E6CBB9FA54969B5A718CE03DA49A20DC0ED6`, older signed APK/AAB hashes and older MobSF scan) is **historical only** for the changed candidate and must not be used as current final artifact proof.

## Remaining hard closure

1. Reverify the final staged tree after the CI-trigger and emulator-login harness changes.
2. Commit and push the exact candidate; prove local/remote SHA identity and successful GitHub Actions for that SHA.
3. Promote/deploy that exact clean SHA to Vercel production and rerun production smoke/headers/runtime checks.
4. Complete final release documentation.
5. Recover the existing production Android signing material, create exact signed APK/AAB, verify certificate/hashes, and run MobSF on the exact signed APK.

**NOT RELEASE-APPROVED**
