# PHASE 6 CONFIGURATION AUDIT

Audit date: 2026-09-03  
Workspace: `C:\Users\PC\Desktop\calling app - Copy`  
Audit mode: **READ-ONLY**  
Scope: B1 Vercel security headers/CSP and B5 authenticated agent-provisioning configuration.

This report is the sole file created for this audit because the request explicitly requires a report. No application source, deployment configuration, environment value, database, Supabase project, Vercel deployment, commit, or remote repository was modified.

## B1 Vercel Configuration

| Check | Result | Evidence |
|---|---|---|
| Vercel configuration file | CONFIGURED in the working tree | `vercel.json` contains a catch-all header rule. |
| Vercel project link | CONFIGURED | `.vercel/project.json` links project `crm`; project and organization IDs were not reproduced here. |
| Hosting model | STATIC Vite/Vercel | `vite.config.ts` has the Vite React/Tailwind build; no repository middleware, server, or reverse-proxy header layer was found. |
| Repository policy active in Vercel | UNKNOWN | `git diff` shows the header policy is not in `HEAD`; no deployment was authorized or performed. |
| Vercel CLI evidence | NOT AVAILABLE | The `vercel` command was not available on PATH; dependencies were not installed for this audit. |

`vercel.json` parses as valid JSON and declares one route-wide header rule with six required headers. The file is configuration evidence only; it is not proof that the current Vercel deployment uses it.

## B1 Header Configuration

The following values are configured in the current working tree. `APPEARS_ACTIVE` is deliberately not asserted because no candidate Preview deployment was available.

```text
HEADER: Content-Security-Policy
CONFIGURED: YES
SOURCE_FILE: vercel.json
CONFIGURATION: default-src self; script-src self; style-src self; local/data images; local fonts; Supabase HTTPS/WebSocket connections; frames/objects denied; base/form/frame ancestors restricted; insecure requests upgraded
APPEARS_ACTIVE: UNKNOWN
CONFIDENCE: HIGH for repository configuration; LOW for live effect

HEADER: X-Content-Type-Options
CONFIGURED: YES
SOURCE_FILE: vercel.json
CONFIGURATION: nosniff
APPEARS_ACTIVE: UNKNOWN
CONFIDENCE: HIGH for repository configuration; LOW for live effect

HEADER: X-Frame-Options
CONFIGURED: YES
SOURCE_FILE: vercel.json
CONFIGURATION: DENY
APPEARS_ACTIVE: UNKNOWN
CONFIDENCE: HIGH for repository configuration; LOW for live effect

HEADER: Referrer-Policy
CONFIGURED: YES
SOURCE_FILE: vercel.json
CONFIGURATION: strict-origin-when-cross-origin
APPEARS_ACTIVE: UNKNOWN
CONFIDENCE: HIGH for repository configuration; LOW for live effect

HEADER: Permissions-Policy
CONFIGURED: YES
SOURCE_FILE: vercel.json
CONFIGURATION: camera, microphone, geolocation, payment, and USB disabled
APPEARS_ACTIVE: UNKNOWN
CONFIDENCE: HIGH for repository configuration; LOW for live effect

HEADER: Strict-Transport-Security
CONFIGURED: YES
SOURCE_FILE: vercel.json
CONFIGURATION: max-age=31536000; includeSubDomains; preload
APPEARS_ACTIVE: UNKNOWN
CONFIDENCE: HIGH for repository configuration; LOW for live effect
```

## B1 CSP Compatibility

**CSP_COMPATIBILITY: READY (static repository evidence only)**

- `script-src 'self'` is compatible with the external module script in `index.html`; no inline script was found in `src` or `index.html`.
- `style-src 'self'` is compatible with the current source scan; no inline `style` attribute, `<style>` block, or `dangerouslySetInnerHTML` use was found in the audited application surface.
- Inter is imported from the local `@fontsource/inter` package. The existing build output contains local font assets rather than a remote font origin.
- `connect-src` allows the Supabase HTTPS and Realtime WebSocket origins used by the application.
- The existing `wa.me` usage is a navigation URL, not an application API or resource origin that requires adding it to `connect-src`.
- The existing `dist/index.html` contains an external script and no inline style/script. No new build was run because this was a read-only configuration audit.

The CSP is therefore compatible with the current repository surface as inspected. This does not establish browser enforcement on a deployed URL.

## B1 Preview Readiness

**B1_PREVIEW_READY: PARTIAL**

Repository-side readiness is present:

- `vercel.json` is syntactically valid and contains the required headers.
- `package.json` exposes `npm run build`, and the project is configured as a Vite React application.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are the required browser configuration variables; values were not printed.
- The current source/build surface is compatible with the restrictive CSP.

Deployment-side readiness is not verifiable:

- No authorized non-production Preview URL, Preview ID, or deployed candidate commit identity is documented.
- The canonical documented URL is the live production host, not an authorized Preview target.
- No same-Preview header response or browser CSP enforcement evidence exists.

## B1 Live Evidence

**B1_LIVE_EVIDENCE: AVAILABLE — FAIL / BLOCKED**

The retained read-only evidence artifact is `test-results/security/phase6-b1-live-csp-20260903-final.json`, targeting the documented canonical host `https://crm-blush-omega.vercel.app`.

The retained live check reported:

| Live check | Result |
|---|---|
| HTTP response | 200 from Vercel |
| Content-Security-Policy | Missing |
| X-Content-Type-Options | Missing |
| X-Frame-Options | Missing |
| Referrer-Policy | Missing |
| Permissions-Policy | Missing |
| Strict-Transport-Security | Present with `max-age=63072000; includeSubDomains; preload`, not the repository value |
| CSP score | 0/100 |
| OWASP header score | 15/100 |
| Overall retained scanner score | 6/100 |

The live response was not treated as a Preview response and could not be mapped to the current working-tree candidate. A fresh same-Preview check is required after an authorized deployment. Phase 6 is not declared PASS.

## B5 Staging Configuration

**B5_STAGING_CONFIGURED: PARTIAL**

The current filesystem contains `.env.staging` and the expected variable names, but the staging file targets the protected production Supabase project:

| Variable/configuration | Presence | Safe target classification |
|---|---|---|
| `VITE_SUPABASE_URL` | CONFIGURED | `lahvcodvgubplzfshare.supabase.co` — production project |
| `VITE_SUPABASE_ANON_KEY` | CONFIGURED; value withheld | Same production project context |
| `VITE_APP_ENV` | CONFIGURED | `staging` label only; it does not create isolation |
| `VITE_APP_VERSION` | CONFIGURED | Value withheld |
| `SUPABASE_ACCESS_TOKEN` | PRESENT; value withheld | Secret-bearing variable in the staging file; not used |
| `SUPABASE_DB_PASSWORD` | PRESENT; value withheld | Secret-bearing variable in the staging file; not used |

For comparison, `.env.development` and `.env.local` point to the local Supabase endpoint, while `.env.production` points to the same production project. `.env.example` contains placeholders only. The repository's local `supabase/config.toml` describes a local project (`calling_app`) and is not a hosted staging configuration.

The older release-verification notes describe `.env.staging` as empty; the current read-only filesystem inspection found it populated. The current file target is authoritative for this audit and is unsafe as staging isolation because it resolves to production.

## B5 Environment Isolation

**B5_STAGING_ISOLATED: NO**

- `.env.staging` and `supabase/.temp/linked-project.json` both resolve to the production Supabase project reference `lahvcodvgubplzfshare`.
- No separate hosted staging project, staging database, staging Auth identity set, or staging Edge Function deployment was evidenced.
- No staging function version or deployment-to-commit mapping was evidenced.
- The application represents organization membership/scope through `profiles.organization_id`; no separate staging membership store was evidenced.
- No production writes, user creation, migration, or destructive operation was performed by this audit.

Production references were identified for safety classification only. Secret values were not printed, sent, or used.

## B5 Edge Function

**FUNCTION_PRESENT: YES**  
**FUNCTION_DEPLOYABLE: UNKNOWN**  
**REMOTE_DEPLOYMENT_PROVEN: NO**

`supabase/functions/create-agent/index.ts` is present and its source contains the required server-side controls:

- Required server bindings are named `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`; values were not accessed or printed.
- Only `POST` is accepted after CORS preflight handling; malformed JSON is rejected.
- The incoming `Authorization` header is required and validated with Supabase Auth.
- The caller profile is resolved by `auth_user_id`, must be active, must be `ADMIN`, and must have an organization.
- The request accepts `name`, `email`, `phone`, and `password`; organization and role are server-derived.
- Duplicate profile lookup is scoped to the caller organization and returns a conflict response.
- The created profile is forced to role `AGENT` and status `ACTIVE`.
- The response returns sanitized camelCase fields including `id`, `authUserId`, `organizationId`, `name`, `email`, `phone`, `role`, `status`, `createdBy`, and `createdAt`; no password is returned.
- Profile/Auth compensation is isolated so one rejected cleanup operation does not skip the other.
- Audit-write ambiguity is checked before deleting a provisioned agent, preventing an append-only audit row from being left pointing at a deleted profile.

The source contains a wildcard `Access-Control-Allow-Origin` value. That existing behavior was recorded for manual review; it was not changed during this audit. No remote Edge Function version or environment binding was available to verify.

## B5 Client Contract

**B5_CONTRACT: MATCH for the audited provisioning contract**

| Contract item | Client | Edge Function | Result |
|---|---|---|---|
| Function name | `create-agent` | `create-agent` | MATCH |
| Request: name | Sends trimmed name | Reads/validates `name` | MATCH |
| Request: email | Sends normalized email | Reads/normalizes `email` | MATCH |
| Request: phone | Sends trimmed phone | Reads/normalizes `phone` | MATCH |
| Request: password | Sends temporary password | Reads/validates `password` | MATCH |
| Organization | Does not supply authority; verifies returned organization | Derives from authenticated admin profile | MATCH / server-authoritative |
| Role | Requires returned `AGENT` | Forces `AGENT` | MATCH / server-authoritative |
| Returned organization | Requires `agent.organizationId` and matches actor organization | Returns `organizationId` | MATCH |
| Error contract | Handles transport errors and `edgeData.error` | Returns `{ error: ... }` | MATCH |
| Local cache timing | Writes local profile only after verified server result | Returns only after Auth/profile/audit path | MATCH |

The modal exposes a status selection, but the Edge Function intentionally owns the initial status (`ACTIVE`) and the service does not include status in the function request. This is server authority, not a mismatch for the required email/name/profile/organization/role contract.

## B5 Authenticated Test Readiness

**B5_AUTH_READY: NO — NOT READY FOR AUTHENTICATED STAGING EXECUTION**

Local/mock supporting tests and source guards exist, but they do not prove a deployed authenticated workflow. No production or non-isolated staging identities were created or used.

| Required test | Repository/source support | Isolated staging execution |
|---|---|---|
| Admin creates agent | Client and Edge Function paths; local/mock tests | NOT READY — no staging endpoint and admin identity |
| Created agent login | Auth/profile contract exists | NOT READY — no staging agent identity |
| Duplicate email | Client/source and local/mock duplicate paths | NOT READY — no staging Auth/profile state |
| Non-admin denial | Client guard and Edge Function role check | NOT READY — no authenticated staging identity |
| Network failure | Client error/no-local-cache tests | NOT READY — no staging failure injection |
| No orphan Auth/profile | Source compensation and local/mock regression support | NOT READY — no staging state inspection |
| Rollback, including rejected cleanup | Source compensation paths | NOT READY — no controlled staging failure injection |
| Audit event and audit-write ambiguity | Source audit/reconciliation path | NOT READY — no staging audit-row inspection |

`tests/phase2Authentication.test.ts`, `tests/bugfixRegression.test.ts`, and `tests/securitySecretScan.test.ts` are supporting evidence only. They do not substitute for the requested authenticated staging matrix.

## Production Safety

| Safety check | Result |
|---|---|
| Production reference found | YES — canonical Vercel host and Supabase project are documented; `.env.staging` also points to the production Supabase project |
| Production database writes | NONE performed |
| Production Auth user creation | NONE performed |
| Production migrations | NONE performed |
| Production deployment | NONE performed |
| Secret values printed | NO |
| Secret values used | NO |
| Existing dirty worktree changes | PRESERVED; not attributed to this audit |
| Audit-only report write | YES — this report was created as explicitly required |

The presence of secret-named variables in `.env.staging` was recorded without revealing values. The file must not be used for staging tests while it targets production.

## Configuration Matrix

| Area | Status | Basis |
|---|---|---|
| B1 Vercel configuration | CONFIGURED — working-tree only | Valid `vercel.json`; not deployed from this candidate |
| B1 security headers | CONFIGURED — repository only | Six required headers present |
| B1 CSP | CONFIGURED; static compatibility READY | Current source/build surface is compatible; live enforcement unknown |
| B1 Vercel project link | CONFIGURED | `.vercel/project.json` project name `crm` |
| B1 Preview readiness | PARTIAL | Build/config ready; no authorized Preview URL/ID/commit evidence |
| B1 live Preview available | NO | Only the documented production host is identified |
| B1 live evidence | AVAILABLE — FAIL/BLOCKED | Retained production-host read-only response omitted required headers |
| B5 staging configuration | PARTIAL | `.env.staging` exists but resolves to production |
| B5 staging isolation | NO | Same protected production Supabase project reference |
| B5 environment target | PRODUCTION | `lahvcodvgubplzfshare.supabase.co` |
| B5 Edge Function | CONFIGURED — source only | Auth, org, role, response, rollback, and audit paths are present; remote deployment unknown |
| B5 client/function contract | MATCH | Required request/response/error fields align |
| B5 authenticated staging readiness | NO | No isolated endpoint, identities, or executable staging matrix |

## Missing Prerequisites

### B1

- **What already exists:** valid `vercel.json` header policy, valid Vercel project link, Vite build path, required browser variable names, and static CSP-compatible application output.
- **What is missing:** an authorized non-production Vercel Preview URL/ID, deployed candidate commit identity, actual same-Preview response headers, and same-Preview browser CSP enforcement evidence.
- **Manual action required:** deploy the intended candidate to an authorized non-production Preview and run the header/browser checks against that exact Preview. This audit did not deploy.
- **Can be done without production:** YES.
- **Can be done without source changes:** YES, assuming the existing working-tree configuration is the intended candidate.

### B5

- **What already exists:** the `create-agent` Edge Function source, client invocation/validation, local/mock supporting tests, and source-level Auth/org/role/rollback/audit controls.
- **What is missing:** an isolated Supabase staging project, staging schema/migrations, a deployed staging function version, non-production admin/agent test identities, safe failure-injection capability, and state/audit inspection access.
- **Manual action required:** provision or authorize an isolated staging environment, deploy the current intended function/configuration there, create non-production identities, execute the complete test matrix, inspect Auth/profile/audit state, and clean up staging data.
- **Can be done without production:** YES.
- **Can be done without source changes:** YES for the currently audited contract; deployment/environment work is still required.

## Recommended Manual Actions

1. Use a human-authorized Vercel Preview deployment for the exact candidate commit, then verify all six headers and browser CSP enforcement on that same Preview URL.
2. Confirm the approved HSTS value before accepting the header gate; the retained live production value differs from the repository value.
3. Establish a genuinely separate Supabase staging project and replace the production-targeting `.env.staging` configuration with non-production values. Do not reuse the present production secret-bearing entries.
4. Deploy and identify the staging `create-agent` function version, create only non-production test identities, and run the authenticated matrix in this report.
5. Inspect Auth users, `profiles`, and `activities` after success and each failure/rollback case; preserve evidence without recording passwords, service-role keys, access tokens, or database passwords.
6. Do not declare Phase 6 PASS until B1 same-Preview evidence and B5 authenticated isolated-staging evidence both exist.

## Final Audit Fields

```text
CONFIGURATION_AUDIT_STATUS: BLOCKED / NOT READY FOR PHASE 6 PASS
B1_CONFIGURED: YES — repository working-tree only; active deployment unknown
B1_PREVIEW_READY: PARTIAL
B1_LIVE_EVIDENCE: AVAILABLE — live production-host check failed required headers; authorized Preview unavailable
B5_STAGING_CONFIGURED: PARTIAL — file exists but targets production
B5_STAGING_ISOLATED: NO
B5_AUTH_READY: NO — local/mock support only; authenticated staging execution not ready
B5_CONTRACT: MATCH
MISSING_PREREQUISITES: Authorized same-candidate Vercel Preview evidence; isolated Supabase staging project/function/identities/state evidence
SOURCE_CHANGES_REQUIRED: NO
MANUAL_ACTIONS_REQUIRED: YES — see Recommended Manual Actions
PRODUCTION_MODIFIED: NO
DEPLOYMENT_PERFORMED: NO
COMMITS_CREATED: NO
PUSH_PERFORMED: NO
REPORT: docs/project-knowledge/PHASE_6_CONFIGURATION_AUDIT.md
```
