# 16 — Current State and Release Decision

**Document status:** CURRENT
**Last reviewed:** 2026-09-15
**Release decision:** **RELEASE-APPROVED**
**Branch:** `codex/release-readiness`
**Release source SHA:** `642487043191292b8dbd0e87e498879068403572`
**Application version:** `2.0.0`
**Production Supabase:** `lahvcodvgubplzfshare` — **17/17 migrations**
**Vercel project:** `crm` / `prj_oQvjAM8zwuJUGwDXDKIhc5IMyJ7W`
**Production deployment:** `dpl_EzsayArGERwSg4itFtBDUku3wamd`
**Production URL:** `https://crm-blush-omega.vercel.app`

Physical-device verification is explicitly **WAIVED BY USER** for this release decision. It is not recorded as PASS.

## Verified release state

The release source completed local verification, deep audit, signed Android artifact closure, remote Git integration, exact-source GitHub Actions verification, production Supabase verification, Vercel production deployment, and live production smoke.

- `npm run test:all`: **10/10 suites**, 0 failed, 0 skipped.
- Core Node suite: **318/318 PASS**.
- Strict `npm run verify`: **0 command failures**.
- Full Playwright matrix: **212/212 PASS**.
- Real three-emulator synchronization: **13/13 PASS**.
- Accessibility: **11/11**, zero Axe violations.
- Mutation score: **81.74%** (94 killed, 19 survived, 2 uncovered).
- Semgrep: **0 findings**.
- Gitleaks tracked-source scan: **no leaks**.- Custom secret scan: **0 Critical / 0 High**.
- npm audit / OSV / Trivy: **0 current dependency vulnerabilities**.
- dependency-cruiser: **0 violations**.
- Local Supabase lint: **no schema errors**.
- Android lint/build/emulator smoke: PASS.
- GitHub Actions run `34962704887`: **SUCCESS** on exact release source SHA `642487043191292b8dbd0e87e498879068403572`.

## Production database

Production project `lahvcodvgubplzfshare` is at **17/17 migrations**, including `20260913185759_security_definer_helper_execute_hardening`.

Reviewed advisor debt remains non-blocking: 5 `rls_enabled_no_policy` INFO findings, 10 authenticated `SECURITY DEFINER` WARN findings, leaked-password-protection WARN, 20 unindexed-FK INFO findings, one RLS init-plan WARN on `profiles_update_policy`, and 28 unused-index INFO findings. No new P0/P1 production database issue was found.

## Android release artifacts

The permanent production signing identity is `crm-production`, RSA 4096 / SHA256withRSA, certificate SHA-256 `3A:58:1C:93:98:F0:77:F9:37:10:94:C5:17:88:D0:40:9F:D4:76:4C:01:84:A9:5F:52:7D:BF:BD:2B:FF:2E:38`, valid through **2054-01-31**.

- Signed APK SHA-256: `6FC5638347BE9EA45D65C98F80BE32B91FA1EF4F522F7F76970F00B61C48C9A5` — **6,153,539 bytes**.
- Signed AAB SHA-256: `685A0923DEBC34890840662D134D17B4069EDBAC5F7D3436B5A319B394CB4AB8` — **5,977,051 bytes**.
- APK/AAB signer verification: PASS.
- Current APK MobSF: 0 trackers, 0 secrets, 0 code-analysis highs; two reviewed/non-blocking StrandHogg manifest heuristics.
- Signing material remains outside Git with a restricted backup under `C:\Users\PC\Desktop\KEYS`.

## Production deployment
The authoritative production deployment is `dpl_EzsayArGERwSg4itFtBDUku3wamd` at `https://crm-blush-omega.vercel.app`.

Vercel reports `target=production`, `READY`, explicit `gitCommitSha=642487043191292b8dbd0e87e498879068403572`, `releaseSourceSha=642487043191292b8dbd0e87e498879068403572`, and `gitDirty=0`.

The first attempt to promote the exact Git preview was rejected as final evidence after smoke testing showed its JavaScript had Supabase unconfigured. The final production artifact was instead built from a clean detached worktree at the exact release source SHA using the validated ignored production environment, verified before upload, and deployed as a Vercel prebuilt production artifact.

Final production smoke:

- Root HTTP **200**.
- Main JS and CSS HTTP **200**.
- Correct title: `Amaratv Krishi - Field Sales CRM`.
- Sign In screen renders; `Authentication Setup Required` is absent.
- Live JS contains the expected production Supabase project and no unconfigured fallback.
- No localhost/127.0.0.1 endpoint leakage.
- CSP, HSTS, `X-Content-Type-Options: nosniff`, and `X-Frame-Options: DENY` are present.
- Browser console errors: **0**.
- Page errors: **0**.
- Failed browser requests: **0**.
- Production error/fatal runtime log query over the final checked window returned no entries.

## Git and closure semantics

The deployed application source is SHA `642487043191292b8dbd0e87e498879068403572`, which is also the exact SHA that passed GitHub CI. A later commit containing only release documentation is a post-release documentation closure; it does not alter the web application, Android artifacts, database migrations, or the approved release source.

GitHub rulesets/branch protection remain unavailable on the current private-repository plan and return HTTP 403. This is an external governance limitation, not a P0/P1 product defect.

Current authoritative decision:

**RELEASE-APPROVED**
