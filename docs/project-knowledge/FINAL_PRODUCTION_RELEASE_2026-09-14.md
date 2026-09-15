# Final Production Release Closure — 2026-09-14

**Closure refreshed:** 2026-09-15
**Decision:** **RELEASE-APPROVED**
**Branch:** `codex/release-readiness`
**Release source SHA:** `642487043191292b8dbd0e87e498879068403572`
**Application version:** `2.0.0`
**Production Supabase:** `lahvcodvgubplzfshare`
**Vercel project:** `crm` / `prj_oQvjAM8zwuJUGwDXDKIhc5IMyJ7W`
**Production deployment:** `dpl_EzsayArGERwSg4itFtBDUku3wamd`
**Production URL:** `https://crm-blush-omega.vercel.app`

This is the authoritative final-closure report. Earlier signoff/audit documents remain historical evidence and are superseded where they conflict with this report.

Physical-device acceptance is **WAIVED BY USER** and is not recorded as PASS.

## Executive status

All required application, database, security, CI, Android signing/artifact, deployment-provenance, and live production smoke gates are closed for the release source SHA.

The final production deployment is READY and explicitly records both `gitCommitSha` and `releaseSourceSha` as `642487043191292b8dbd0e87e498879068403572`, with `gitDirty=0`.

A first promotion attempt was deliberately rejected after smoke testing showed that preview-built JavaScript had Supabase unconfigured. That artifact is not release evidence. The authoritative production deployment was rebuilt from the clean exact source with the validated ignored production environment and deployed as a verified prebuilt production artifact.

## Final source and Git provenance
- Release source SHA: `642487043191292b8dbd0e87e498879068403572`.
- GitHub CI run `34962704887`: **SUCCESS** on that exact SHA.
- Prior local/remote branch state was aligned at the release source before documentation closure.
- The fully audited application commit and subsequent CI-only fixes are included in this release source.
- Unrelated working-tree drift, scratch files, backups, generated reports, and credentials were deliberately excluded.
- No force push, history rewrite, destructive reset, or signing-material commit was performed.

A post-release documentation-only commit may follow this source SHA. Such a commit does not change the approved application source, deployed web assets, Android artifacts, or database schema.

## Verification evidence

| Gate | Final result |
|---|---|
| `npm run test:all` | **PASS — 10/10**, 0 failed, 0 skipped |
| Core Node suite | **PASS — 318/318** |
| Strict release verifier | **PASS — 0 command failures** |
| Full Playwright matrix | **PASS — 212/212** |
| Accessibility | **PASS — 11/11**, zero Axe violations |
| Real PostgreSQL/RLS | PASS |
| Real three-emulator synchronization | **PASS — 13/13** |
| Production build | PASS |
| Semgrep | **0 findings** |
| Gitleaks | **no leaks** |
| Custom secret scan | **0 Critical / 0 High** |
| npm audit / OSV / Trivy | **0 current vulnerabilities/issues** |
| dependency-cruiser | **0 violations** |
| Local Supabase lint | **no schema errors** |
| Mutation | **81.74%** — 94 killed / 19 survived / 2 uncovered || Android lint/build/emulator | PASS |
| Final `npm run audit:deep` | **PASS — configured deep-audit gates green** |
| GitHub exact-source CI | **PASS — run `34962704887` SUCCESS** |
| Production Supabase parity | **PASS — 17/17 migrations** |
| Vercel production provenance | **PASS — READY, exact release source metadata, `gitDirty=0`** |
| Live production smoke | **PASS** |

## Production Supabase

Fresh production verification confirms **17/17 migrations**. Latest migration:

`20260913185759_security_definer_helper_execute_hardening`

Fresh catalog evidence matches the verified local schema/RLS/function/realtime surface. No new P0 or P1 production database issue was detected.

Reviewed non-blocking advisor debt remains: 5 `rls_enabled_no_policy` INFO findings, 10 authenticated `SECURITY DEFINER` WARN findings, leaked-password-protection WARN, 20 unindexed-FK INFO findings, one `auth_rls_initplan` WARN on `profiles_update_policy`, and 28 unused-index INFO findings.

## Android production signing and artifacts

A permanent production signing identity was created because no Android package had previously been distributed.

- Alias: `crm-production`
- Algorithm: RSA 4096 / SHA256withRSA
- Certificate valid through: **2054-01-31**
- Certificate SHA-256: `3A:58:1C:93:98:F0:77:F9:37:10:94:C5:17:88:D0:40:9F:D4:76:4C:01:84:A9:5F:52:7D:BF:BD:2B:FF:2E:38`
- Signing material is external to Git and ACL-restricted, with a backup under `C:\Users\PC\Desktop\KEYS`.
Final signed artifacts:

- APK SHA-256: `6FC5638347BE9EA45D65C98F80BE32B91FA1EF4F522F7F76970F00B61C48C9A5`
- APK size: **6,153,539 bytes**
- AAB SHA-256: `685A0923DEBC34890840662D134D17B4069EDBAC5F7D3436B5A319B394CB4AB8`
- AAB size: **5,977,051 bytes**
- APK signer verification: PASS.
- AAB signer verification: PASS.
- Current signed-APK MobSF: 0 trackers, 0 secrets, 0 code-analysis highs, 0 certificate highs/warnings.
- Two StrandHogg manifest heuristics remain reviewed/non-blocking because the packaged app targets SDK 36 and uses explicit empty `android:taskAffinity`.

## Vercel production closure

Authoritative production deployment:

- Deployment ID: `dpl_EzsayArGERwSg4itFtBDUku3wamd`
- Production URL: `https://crm-blush-omega.vercel.app`
- State: **READY**
- Target: **production**
- `gitCommitSha`: `642487043191292b8dbd0e87e498879068403572`
- `releaseSourceSha`: `642487043191292b8dbd0e87e498879068403572`
- `gitDirty`: `0`

The initial preview-promotion deployment was superseded after smoke testing found its generated JavaScript had Supabase unconfigured. It was not accepted as final production evidence.

The final production artifact was built in a clean detached worktree at the exact release source SHA using the ignored validated `.env.production`, and the prebuilt output was checked before deployment to confirm the expected production Supabase project was embedded and the unconfigured fallback was absent.
## Final production smoke

Live production checks on `https://crm-blush-omega.vercel.app`:

- Root HTTP **200**.
- Emitted main JavaScript HTTP **200**.
- Emitted CSS HTTP **200**.
- Title: `Amaratv Krishi - Field Sales CRM`.
- Sign In screen rendered successfully.
- `Authentication Setup Required` was absent.
- Live JavaScript contains the expected production Supabase project reference.
- Supabase-unconfigured fallback is absent.
- No localhost or loopback endpoint references were found in the live main bundle.
- CSP is present and restricts connections to self plus Supabase HTTPS/WSS.
- HSTS is present.
- `X-Content-Type-Options: nosniff` is present.
- `X-Frame-Options: DENY` is present.
- Browser console errors: **0**.
- Browser page errors: **0**.
- Failed browser requests: **0**.
- Final production error/fatal runtime-log query returned no entries.

## Governance note

GitHub branch protection/rulesets remain unavailable through the current private-repository plan and return HTTP 403. This is an external governance limitation; repository visibility and plan were not changed.

The Vercel project’s cloud-stored environment configuration should be revalidated before any future Git-triggered rebuild. The approved current production artifact itself is correctly configured because it was built from the validated local ignored production environment and then smoke-tested live.
## Final decision

All current release-blocking gates are closed for release source SHA `642487043191292b8dbd0e87e498879068403572`.

Physical-device verification remains **WAIVED BY USER**, not PASS. Reviewed advisor/governance/deployment-maintenance items remain non-blocking follow-up work and do not invalidate the current released artifact.

**RELEASE-APPROVED**
