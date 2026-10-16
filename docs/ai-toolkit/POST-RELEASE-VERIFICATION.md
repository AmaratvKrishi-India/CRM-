# Post-release verification — 2026-10-16

Release under review: `f6f9d7e199cbc8b56cba6ef82644bbc394c3f5cb`. This document records observed results, including limitations. Candidate dependency changes must pass the new PR's CI before merge. No production deployment was triggered by this task.

## GitHub and workspace

The existing checkout was clean on local `work` at `729208d`. Fetch advanced origin/main to `f6f9d7e`; a clean tracking main was created without reset. There were zero staged paths and no local-only commits. The reported 66 staged paths were not present in this environment. Accessible workspace/task-directory discovery found no older CRM checkout to recover. The old local `work` branch remains preserved.

PR #7 is merged at `7c62e0a`; PR #8 is merged at `f6f9d7e`. Both development branch heads are ancestors of main. GitHub branch metadata marked both unprotected and repository rulesets returned an empty collection. No PR was open at preflight. Deleted `development/crm-storage-backup` and `fix/backup-workflow-default-branch` with ordinary `git push --delete`, then verified GitHub and ls-remote showed only main. A local bundle also retains their heads. Main was never deleted or force-updated.

GitHub reports main unprotected. The detailed protection endpoint is unavailable to the integration (403); no rule was changed. Retain main, the preserved local work branch, and the new fix branch while its PR is open. Git push access is verified. The new PR should remain unmerged until review/CI and release timing are resolved; a main merge normally triggers Vercel Production.

## Production web

Vercel reports deployment `dpl_CBppfeu9twWwKLFdAcWEsnRoQAVA`, READY, target production, branch main and SHA `f6f9d7e`. Alias `https://crm-amaratv-krishi.vercel.app` belongs to that deployment. HTTPS root fetch through the connected Vercel tool returned 200 with CSP, HSTS, nosniff, frame-denial and referrer-policy headers. All nine initial JS/CSS assets returned 200. Two additional login-support chunks returned 200; later optional-chunk connector requests failed and are not claimed verified.

The app renders its login at `/` and uses in-app state, not URL routes. A probed `/login` returned 404; no source route promises that URL. Captured production HTML and initial assets rendered locally in Chromium with a visible Sign In button and password field. The local capture supplies the repository favicon and blocks all Supabase traffic. It is a static-build render check, not a live authenticated production browser session or proof of live console health.

Direct production navigation is blocked by the cloud egress policy. No designated test account was supplied, so no authenticated production operation was attempted. Live browser console and authenticated login remain unverified; no customer records were accessed. Local browser regressions and disposable CI provide separate application coverage.

Environment metadata has only four client variables per environment: Supabase URL/key, app environment and version, with separate Production and Preview records. Endpoint values confirm Production → `lahvcodvgubplzfshare` and Preview → `dhoinifpzijqyobcamlv`. The configured production public key is present in the bundle and decodes to role **anon**. Captured initial bundles contain no service-role JWT, actual secret-key pattern, or known synthetic testing credential markers. Vendor source contains a generic `sb_secret_` validation prefix; this is not a credential. This scan covers the captured initial assets, not every deployment file or all historical artifacts. No variable values or keys are included in this report.

## Supabase

Both projects have exactly 19 migrations with the same first 18 versions as Git. Final timestamps remain staging `20261003055436`, production `20261003055551`, versus canonical `20261003000018`. Final SQL and effective grants match. Schema metadata matches between hosted projects; anon cannot execute sync_mutate. No hosted changes were made. Backup/recovery capability and CLI permissions are unverified, and production has no project-specific mutation approval.

Read [the reconciliation and security review](../database/POST-RELEASE-RECONCILIATION.md) for exact proposed commands, rollback prerequisites, advisor classifications and owner actions. Advisor counts remain 10 callable definer helpers, 5 internal no-policy tables, disabled password protection, 20 unindexed foreign keys and one initplan warning per project. Unused-index counts are 9 staging and 26 production. Do not treat this review as blanket security clearance.

## Actual validation

| Check | Candidate local result | Released main CI run 66 |
| --- | --- | --- |
| Typecheck, test types, ESLint | Passed | Typecheck/lint passed |
| Clean npm install | Passed | Passed |
| Full / production npm audit | 0 / 0 findings | Gate passed with historical moderate chain |
| Secret gate | Passed after excluding ignored task tool fixtures; positive control rejected | Passed |
| Guarded synthetic production build | Passed | Passed |
| Bundle budget | Passed: 1,166,394 raw / 310,375 gzip / 263,941 Brotli bytes, 17 JS chunks | Passed |
| Node | 306 passed, 0 failed/cancelled/skipped | 349 passed |
| Vitest | 18 files, 252 passed, 0 failed | 21 files, 279 passed |
| Chromium + tablet | 44 passed, 11 skipped | 42 Chromium + 2 tablet passed; 11 standard-suite skips |
| Separate real-Supabase browser tests | Not run locally | 11 passed against disposable Supabase |
| Toolkit | Bootstrap and verify passed, 5 definitions, complete SAFE fixture | Not asserted |

Local Node excludes f002AgentProvisioning and f003ServerOrdering (43 database-dependent cases) because no disposable PostgreSQL container exists. Existing runner exclusions for multiDeviceSync/realSupabasePostgres are preserved. Local Vitest excludes three hosted-container-dependent integration files (27 cases). The 11 browser skips are the separately run real-Supabase cases. No test source was modified or skip added by this task. Browser tests include mocked offline/online synchronization, accessibility, 11 visual comparisons and tablet boundaries; they do not establish hosted database behavior.

[Main CI run 66](https://github.com/AmaratvKrishi-India/CRM-/actions/runs/38936872560) completed successfully; its web steps include disposable migrations/seed, database-backed Node tests, full Vitest including RLS, and real browser CRUD/multi-client sync. This is existing main evidence, not validation of an untested PR head. The new PR's run is tracked separately in the delivered report.

No Android real-backend synchronization test was performed or remains required for this task. No VoIP/Drive setup, paid resource, hosted reset, unreviewed db push, force-push or customer-data mutation occurred.

## Persistence

See [fresh-task recovery](FRESH-TASK-RECOVERY.md), [dependency repair](../security/POST-RELEASE-DEPENDENCIES.md) and the tracked `plans/post-release.json`. Toolkit binaries/browser caches require task-local installation. Cloud revision 2 is observed running; reusable environment publication is not verified.
