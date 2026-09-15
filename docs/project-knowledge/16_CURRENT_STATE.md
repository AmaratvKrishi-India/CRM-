# 16 — Current State and Release Decision

**Document status:** CURRENT
**Last reviewed:** 2026-09-15
**Release decision:** **NOT RELEASE-APPROVED**
**Branch:** `codex/release-readiness`
**Application version:** `2.0.0`
**Production Supabase:** `lahvcodvgubplzfshare` — **17/17 migrations**
**Vercel project:** `crm` / `prj_oQvjAM8zwuJUGwDXDKIhc5IMyJ7W`

Physical-device verification is explicitly **WAIVED BY USER** for this release decision. It is not recorded as PASS.

## Current verified source position

The release candidate has been deliberately staged while preserving unrelated scratch/generated work. The current candidate includes the synchronization/database/mobile hardening, migration 17, test and audit tooling fixes, removal of confirmed dead files, dependency remediation, and a release-branch GitHub Actions trigger.

Latest verified evidence before the final post-trigger freeze:

- `npm run test:all`: **10/10 suites, 0 failed, 0 skipped**.
- Strict `npm run verify`: **0 command failures**.
- Full Playwright matrix: **212/212** across Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari, and Tablet.
- Real PostgreSQL/RLS integration: PASS.
- Real three-emulator synchronization: PASS on the primary exact-candidate verifier run.
- Accessibility: **11/11**, zero Axe violations.
- Mutation score: **81.74%** (94 killed, 19 survived, 2 uncovered, 115 total).
- Semgrep: **0 findings**.
- Gitleaks tracked-source scan: **no leaks**.
- Custom secret scan: **0 Critical / 0 High**.
- npm audit / OSV / Trivy: **0 current dependency vulnerabilities**.
- dependency-cruiser: no architecture violations.
- Supabase local DB lint: no schema errors.
- Android lint/build and emulator smoke: PASS.

A second back-to-back multi-device run inside `audit:deep` exposed an Agent B login-request timeout; downstream Agent B assertions then cascaded. Because the immediately preceding exact-candidate three-emulator run passed, this was classified as a harness reliability defect. The harness now has a bounded login retry and still requires an observed HTTP 200 auth response. The final exact tree must be reverified after this change.

## Production database

Fresh read-only production evidence confirms all **17/17 migrations**, including `20260913185759_security_definer_helper_execute_hardening`. Fresh production/local comparison matched the public table set, RLS-enabled tables, policies, SECURITY DEFINER function names, and realtime publication membership.

Current advisor findings are reviewed debt, not new P0/P1 blockers: 5 RLS-no-policy INFO findings on internal tables, 10 authenticated SECURITY DEFINER WARN findings, leaked-password-protection WARN, 20 unindexed-FK INFO findings, one RLS init-plan WARN, and 28 unused-index INFO findings.

## Android release artifact status

The current source produces `app-release-unsigned.apk` only. Current unsigned APK SHA-256 is `ACC41B43BDB973E2FC3A67E64601904C8793B5CB3F148F1ECCADC8F9B92CA4AD`, size **6,145,603 bytes**.

No production `.jks`, `.keystore`, `keystore.properties`, `ANDROID_KEYSTORE_PROPERTIES`, current signed APK, or current AAB is available in the repository or searched user workspace. Therefore current production signing, signed APK/AAB verification, and exact signed-artifact MobSF closure are **BLOCKED**.
Historical signed hashes and certificate evidence remain useful historical evidence only and must not be represented as current artifacts after source changes.

## Vercel and GitHub state

The currently public production deployment `dpl_GbqEsSY9Y3Gi79Z8u2QPRFiX1Fjr` is healthy but carries `gitDirty=1` and points to historical SHA `c6bb3ed718503de614212643aa26d877dce8b1c5`; it does **not** satisfy final exact-SHA provenance.

The release workflow now includes `codex/release-readiness` in its push trigger so the final release commit can obtain exact-SHA GitHub Actions evidence. Repository rulesets and branch protection are unavailable on the current private-repository plan (GitHub API 403); this is an external governance limitation.

## Remaining release closure

1. Reverify the final exact tree after the CI-trigger/login-harness changes.
2. Create and push the release commit; prove local SHA = remote SHA and ahead/behind 0.
3. Require GitHub Actions SUCCESS for that exact release SHA.
4. Produce/promote a clean exact-SHA Vercel deployment and complete production smoke/header/runtime checks.
5. Update the final production release report and living documentation.
6. Supply the existing production Android signing material, rebuild/sign APK/AAB, verify certificate/hashes, and run MobSF against the exact signed APK.

Until the existing production signing identity is available and all remaining closure evidence is complete, the authoritative decision is:

**NOT RELEASE-APPROVED**
