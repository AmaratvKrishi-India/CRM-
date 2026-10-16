# CRM release maintenance — 17 October 2026 IST

**Safely actionable verification aur branch cleanup complete kiye gaye. Hosted backup, restore rehearsal aur migration-history repair abhi complete nahi hain.** Recovery prerequisites absent hone ki wajah se dono hosted databases par koi mutation nahi kiya gaya. Latest CI/live-smoke outcomes PR #10 ke checks mein verify karein; yeh report un checks ke saath update hoti hai.

## Completed tasks aur GitHub

- Latest fetched/released main: `0eea4febfa7e7e1babf0384f3ce47909d28970e8`. [PR #7](https://github.com/AmaratvKrishi-India/CRM-/pull/7), [#8](https://github.com/AmaratvKrishi-India/CRM-/pull/8), [#9](https://github.com/AmaratvKrishi-India/CRM-/pull/9) merged hain; merge aur relevant branch-head commits ki ancestry main mein verified hai.
- Original `/workspace/CRM-` ka clean `work` checkout at `f6f9d7e` preserve kiya. Naya `/workspace/crm-maintenance` worktree latest main se bana. Staged/uncommitted work nahi tha; destructive reset ya force-push nahi hua.
- `fix/post-release-security` branch unprotected thi, ruleset list empty thi, aur main ke against **zero unique commits** the. Normal `git push origin --delete` successful hua. Cleanup ke turant baad remote par sirf `main` tha.
- Current maintenance branch `chore/post-release-maintenance` [PR #10](https://github.com/AmaratvKrishi-India/CRM-/pull/10) ke liye retained hai. Yeh obsolete branch nahi hai. PR unmerged hai; main merge Vercel Production deploy karta hai.
- Released-main [CI #68](https://github.com/AmaratvKrishi-India/CRM-/actions/runs/38960369058) successful hai. Job steps aur logs verify hue: 349 Node, 279 Vitest, 42 Chromium, 2 tablet, aur 11 separate disposable-Supabase browser tests passed. RLS, migration/seed, audit, secret scan, build aur bundle gates bhi passed.
- Credential-free read-only Production smoke workflow add kiya. Fixed Production URL par fresh desktop/tablet browser context use hota hai; sirf web-origin GET/HEAD allowed hain. Backend requests aur form submissions blocked hain. Public asset configuration aur critical console errors check hote hain; artifact mein sirf redacted outcome hai. No application runtime file/migration SQL change.

## Vercel aur web verification

| Item | Verified result |
| --- | --- |
| Production URL | https://crm-amaratv-krishi.vercel.app |
| Deployment | `dpl_EZYdSQ55knWzQN7ZX4sH5AMcTffX`, **READY**, target Production |
| Deployment SHA | `0eea4febfa7e7e1babf0384f3ce47909d28970e8`, same as released main |
| HTTPS | Authorized connected Vercel fetch ne HTTPS 200 aur CRM HTML return kiya; public browser reachability separately blocked hai |
| Deployment conflict check | Inspected recent deployments READY the; active deployment nahi mila at preflight |
| Production config | URL aur active public anon key `lahvcodvgubplzfshare` se match hue; key values log/publish nahi kiye |
| Preview config | URL aur active public anon key `dhoinifpzijqyobcamlv` se match hue; Production se separate |
| Browser smoke | **BLOCKED**: GitHub browser Vercel protection/login par redirect hua; [access attempt](https://github.com/AmaratvKrishi-India/CRM-/actions/runs/38971051290). Login/assets/console pass claim nahi hai |
| Authenticated smoke | **Not performed**: designated approved test credentials available nahi hain |

Project Vercel Authentication setting `all_except_custom_domains` hai. Protected Vercel fetch ki successful authorized response public login reachability prove nahi karti. New workflow known Vercel protection redirect ko explicit **blocked** artifact aur warning deta hai; orchestration green ho sakti hai, lekin app smoke passed tabhi hoga jab artifact result `passed` ho. Unknown redirects, asset/config/console failures hard failures rehte hain. Protection setting unchanged hai.

Source review mein session persistence, automatic refresh, URL session detection disabled aur dedicated session storage key confirmed hua. Profile unlock ke liye Auth server `getUser()` aur active authorized profile validation hoti hai; sign-out local account data ko lock karta hai. Is code review aur disposable test evidence ko authenticated live Production test ka substitute nahi maana gaya. Provider redirect allowlist aur actual login/refresh/expiry/sign-out flow designated account ke saath abhi verify karna hai.

## Supabase — dono projects

Organization `fyeeutppsgfuhytfaekt` abhi **Free** hai. Dono projects **ACTIVE_HEALTHY** hain.

| Check | Staging | Production |
| --- | --- | --- |
| Name | CRM-Staging | AmaratvKrishi-India's Project |
| Project ID | `dhoinifpzijqyobcamlv` | `lahvcodvgubplzfshare` |
| Backup created in this task | **No** | **No** |
| Retained archive/decryption integrity | **Not verified** | **Not verified** |
| Restore rehearsal | **Not performed** | **Not performed** |
| Final version before | `20261003055436` | `20261003055551` |
| Final version after | **Unchanged** `20261003055436` | **Unchanged** `20261003055551` |
| Total migrations before/after | 19 / 19 | 19 / 19 |
| Canonical final version in Git | `20261003000018` | `20261003000018` |
| Anonymous sync_mutate EXECUTE | Denied | Denied |
| Authenticated/service-role EXECUTE | Preserved | Preserved |
| Public tables without RLS | 0 | 0 |

First 18 migrations Git se match hain. Dono final stored SQL statements canonical Git file se trailing whitespace trim ke baad exact match hue. Koi migration SQL replay nahi hua.

Catalog comparison: 213 public columns, 28 RLS policies, 48 indexes, 18 normalized function definitions/ACLs, table RLS/grants aur triggers match hain. Raw function hashes whitespace/ACL ordering ki wajah se differ karte hain; normalized comparison match hai. Ek CHECK constraint `bulk_assignment_audits_status_check` mein array-versus-element cast deparser formatting alag hai; dono exactly PENDING, COMPLETED, PARTIAL, FAILED statuses permit karte hain. Baaki constraints match hain. Is equivalent formatting ko hosted rewrite ki wajah nahi banaya.

Five internal tables par anon/authenticated SELECT aur authenticated INSERT denied hain; service-role SELECT retained hai. Client roles public schema mein CREATE nahi kar sakte. All 17 definer routines anon EXECUTE deny karte hain; 10 intentional authenticated-callable helpers/RPCs ke grants/search paths inspect hue. Unhe warning clear karne ke liye revoke, disable ya INVOKER mein change nahi kiya.

Catalog snapshot mein other active sessions, possible DDL aur exclusive locks zero the. Yeh point-in-time evidence hai, migration freeze nahi. Hosted operation nahi hua, isliye external deployment automation ko disable nahi kiya.

[Redacted before-state evidence](../database/evidence/2026-10-17-hosted-readonly.json) mein fingerprints, migration statements, boundary checks, extension inventory aur advisor counts hain. Customer rows export nahi kiye. Storage object count dono par zero tha; backup time par dobara check zaroori hai.

### Backup/recovery blocker aur safe next operation

Attached cloud environment mein PostgreSQL secret bindings/TCP grants absent hain; approved credentials, independent key custody, private external retention aur secured disposable restore target is task ko available/verified nahi hain. Existing GitHub recovery-secret inventory available connector/failed CLI authentication se verify nahi ho saki; owner existing approved bindings designate kar sakta hai. Connected SQL tools ka access CLI/pg_dump login nahi deta. Existing provider backups ki accessible recovery readiness establish nahi hui. Free plan par paid-plan daily backups ka assumption nahi kiya.

[Protected manual backup workflow design](../database/HOSTED-BACKUP-WORKFLOW-DESIGN.md) complete hai: separate reviewer-protected environments, fixed project mapping, main-only manual dispatch, TLS, secret-file handling, complete schema/data/Auth/migration metadata, encrypt-before-upload, private retention, download/decrypt integrity, secured PG17-compatible restore aur exact metadata rollback rehearsal. **Design enabled workflow ya verified backup nahi hai.** Existing development-only backup guards unchanged hain.

Verified recovery ke baad Staging par supported CLI `migration repair` se old `20261003055436` reverted aur canonical `20261003000018` applied kiya ja sakta hai. SQL replay nahi hona chahiye. Production ka old version `20261003055551` hai; uske liye independent recovery, successful Staging repair aur explicit authorization naming `lahvcodvgubplzfshare` required hai. [Existing detailed sequence](../database/POST-RELEASE-RECONCILIATION.md) mein rollback prerequisites hain. Abhi dono repair tasks **blocked** hain.

## Security aur PostgreSQL review

Current full npm audit aur production-only audit: **0 vulnerabilities**. Released Snyk wrapper removal present hai. New files ke saath secret gate passed; no high/critical secret finding. Existing moderate/low detections public configuration/identifier references hain; secret values publish nahi kiye.

| Current finding per project | Decision |
| --- | --- |
| 10 authenticated-callable SECURITY DEFINER notices | Required helpers/RPCs; anon denied, paths/grants checked; keep boundaries intact |
| 5 RLS tables without policies | Intentional internal restriction; no permissive policy added |
| 20 unindexed foreign keys | Synthetic query plans/workload assessment ke baad selective index work; no blind index creation |
| 1 profiles_update_policy initplan warning | Future `(select auth.uid())` optimization needs isolated RLS regression/benchmark; not changed |
| Unused indexes | Staging 9, Production 26; usage counters alone removal proof nahi hain; retained |
| Leaked-password protection disabled | Current official docs: Pro or above; Free organization par unavailable |

No-cost recommendation: password manager ke unique long passwords aur Free password-strength controls ki Staging review. Yeh leaked-password screening ka equivalent replacement nahi hai. Login behavior/settings is task mein change nahi kiye. Paid plan approval assume nahi kiya.

PostgreSQL build/channel recheck:

- Staging: **17.6.1.166 / ga**.
- Production: **17.6.1.164 / withdrawn**.
- Official GitHub releases dono tags ko public, non-prerelease tags ke roop mein show karte hain; release bodies mein withdrawal explanation nahi hai. Official docs search/public issue review se exact withdrawal reason ya urgent security finding establish nahi hui. Iska matlab build safe prove ho gaya, aisa claim nahi hai.
- [Official .164 → .166 comparison](https://github.com/supabase/postgres/compare/17.6.1.164...17.6.1.166) mein 14 commits hain, including PostgREST v14.17, pg_cron upgrade-path compatibility aur WAL-G packaging changes. Sirf same PostgreSQL major dekhkar complete service compatibility assume nahi karni chahiye.
- Recommended maintenance: owner Supabase Infrastructure/support se withdrawn reason aur currently supported GA target confirm kare. Independent encrypted recovery, matching extension/cron/Vault/role prerequisites aur Staging compatibility tests ke baad downtime window aur explicit upgrade approval le. Official guide in-place upgrade recommend karta hai; production ko pause/restore ya upgrade is task mein nahi kiya.

Official sources checked: [backups](https://supabase.com/docs/guides/platform/backups), [password security](https://supabase.com/docs/guides/auth/password-security), [platform upgrades](https://supabase.com/docs/guides/platform/upgrading), [release .164](https://github.com/supabase/postgres/releases/tag/17.6.1.164), [release .166](https://github.com/supabase/postgres/releases/tag/17.6.1.166), [advisor remediation](https://supabase.com/docs/guides/database/database-linter). Direct changelog HTTPS egress blocked tha; connected official documentation aur release sources use kiye.

## Regression aur Codex Cloud

Current local checks passed: TypeScript, test types, ESLint, full/production npm audits, secret gate, synthetic guarded production build, bundle budget, 306 database-independent Node tests, 238 non-integration Vitest tests, 42 Chromium tests aur 2 tablet tests. Standard browser suite ke 11 real-Supabase cases intentionally skip hue; separate hosted disposable run unhe cover karta hai.

Initial broader local Node attempt mein missing `supabase_db_calling_app` container ki wajah se 19 tests failed (306 passed); is failure ko pass nahi maana. Supported subset dobara run karke 306/306 pass hue. Full Node/Vitest/RLS/integration proof released-main CI #68 mein hai aur PR CI mein repeat hota hai. Koi test suite hosted customer databases ki taraf point nahi ki gayi.

Bundle: 1,166,394 bytes total JavaScript, 310,375 gzip, 263,941 Brotli, 17 chunks, no budget warnings. Local production build mein synthetic config use hui; actual deployed public configuration separately verify hui.

Five skills verified: security-scanner, gsd-planning, project-memory, internet-research, professional-writing. Fresh pinned SkillSpector 2.12.0 bootstrap aur complete SAFE fixture passed. Project memory/recovery docs refreshed; no credential/customer content store hua.

Toolchain: Node 24.19.0, npm 11.9.0, Python 3.12.14, uv 0.12.23, Supabase CLI 2.116.0. Git fetch/push/deletion works; `gh auth status` task CLI binding ko invalid report karta hai, connected GitHub tools work karte hain. Vercel aur workflow Node 24 use karte hain. No unnecessary Docker image downloaded; VFS unchanged. Storage roughly 27–28 GiB available, 8–9% used; task-end exact snapshot recheck karna hai.

Latest runtime observation: desired/observed **revision 7**, running/connected, restricted network **enforced**, no secret/runtime-variable/outbound-identity bindings. Earlier task-start observation revision 2 tha. **Reusable environment publication unverified**: exposed status tool Publish status/action nahi deta. Source-config version ID ya running state ko publication proof nahi maana.

Fresh task: inspect status/worktrees, fetch latest origin/main, preserve local work, read AGENTS/memory/current plan, run storage guard, bootstrap/verify and locked npm install. PR #10 unmerged ho to its branch checkout karke newest recovery docs padhein; merge ke baad main use karein. Full disposable Supabase integration GitHub runner par rakhein. [Exact recovery instructions](FRESH-TASK-RECOVERY.md) tracked hain; binaries and credentials task-local hain.

## Owner-only remaining actions

1. **Recovery access/custody:** GitHub repository Settings → Environments mein separate Staging/Production recovery environments, owner review/main-only restrictions, approved secret bindings, existing private off-repository retention destination/key custody aur secured disposable recovery infrastructure designate karein. Credentials chat mein na bhejein. Uske baad agent backup implementation, separate encrypted backups aur real restore acceptance finish kar sakta hai.
2. **Production history authorization:** Staging successful repair aur independent Production recovery proof ke baad explicit approval dein naming `lahvcodvgubplzfshare`. Abhi backup gates fail hain, isliye metadata repair approval prematurely request nahi ki gayi.
3. **Protected/authenticated browser access:** Vercel project crm → Settings → Deployment Protection → Protection Bypass for Automation mein approved automation access designate karein; secret ko reviewer-protected GitHub Environment/approved store mein bind karein. Header-based access use ho, query URLs/logs/PR code mein token nahi. Secret-bearing automation ko reviewed main-only manual execution tak restrict karna hoga; current public PR smoke koi bypass secret receive nahi karta. Phir designated securely bound test account aur its synthetic records identify karein. Login, provider redirects, refresh/expiry, logout aur role isolation abhi pending hain; unrelated customer data use nahi hoga. [Official automation guidance](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation).
4. **Reusable environment Publish:** Codex Cloud Settings → Environments → CRM environment kholkar saved revision ka publication status inspect karein. Agar Draft/unpublished hai, setup/network settings review karke **Publish** action karein; phir new task mein observed revision aur bootstrap verification confirm karein. Tool evidence ke bina publication completed claim nahi hua.
5. **Withdrawn build/optional password plan decision:** Supabase support/Infrastructure mein `.164/withdrawn` reason aur offered GA target confirm karein; upgrade ke liye separate approval tabhi jab recovery tested ho. Leaked-password protection chahiye to Pro decision owner ka hai; subscription unchanged hai.
6. **Maintenance PR review:** PR #10 review karein. Main merge Production deployment trigger karega, isliye owner approval ke bina merge nahi kiya.

Android real-backend testing, VoIP, Drive activation, hosted database reset, customer deletion, force-push aur paid resource creation is task mein nahi hue. CI ki disposable local database fixtures hosted CRM projects se separate hain.
