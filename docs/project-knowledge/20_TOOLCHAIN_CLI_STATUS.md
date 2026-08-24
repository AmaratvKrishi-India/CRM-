# 20 - TOOLCHAIN & CLI STATUS

Snapshot of every tool and CLI the project depends on, with login/auth status and what is currently broken.

> [!IMPORTANT]
> Verified live on this machine on 2026-08-23. Re-run the checks in the "How to re-verify" section after any environment change.

## Status Matrix

| Tool | Version | Auth / Login Status | Verdict |
|------|---------|---------------------|---------|
| Node.js | v26.5.0 | n/a | OK |
| npm | 11.17.0 | Not logged in (not required) | OK |
| Vercel CLI | 59.3.0 | Logged in as `amaratvkrishi-india` | OK |
| GitHub CLI (`gh`) | installed | Active account: `AmaratvKrishi-India` (keyring). Second account `DIVINITY-THE-THIRD-EYE` present but inactive | OK |
| Git (repo identity) | installed | `AmaratvKrishi-India <296277231+AmaratvKrishi-India@users.noreply.github.com>` (repo-level config) | OK |
| Git (global identity) | installed | `Divinity <divinity.thethirdeye@gmail.com>` (overridden by repo-level config in this project) | NOTE |
| Supabase CLI | 2.115.0 (via `npx supabase`) | Authenticated (`projects list` works). Project linked in repo (`linked_project: lahvcodvgubplzfshare`) | OK |
| Docker | server 29.7.2 | Running | OK |
| adb | Android SDK platform-tools | Works via full path `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe` (not on PATH). 3 emulators online: 5556, 5558, 5560 | NOTE |
| Java / `java` | not found | `JAVA_HOME` empty, `java` not on PATH | BROKEN |
| Android SDK env | n/a | `ANDROID_HOME` empty | BROKEN |
| Android signing | n/a | [keystore.properties](file:///C:/Users/PC/Documents/AmaratvKrishi-Keys/keystore.properties) present (external, not in Git) | OK |
| node_modules | n/a | Present (installed) | OK |
| dist/ | n/a | Present (last `npm run build` output) | OK |

## What Is Broken Right Now

1. **Android release builds cannot run.** `JAVA_HOME` and `ANDROID_HOME` are unset and `java` is not on PATH, so `gradlew assembleRelease` fails immediately. Fix: set `JAVA_HOME` to the Android Studio JBR (e.g. `C:\Program Files\Android\Android Studio\jbr`) and `ANDROID_HOME` to `%LOCALAPPDATA%\Android\Sdk`, then reopen the shell.
2. ~~**`node_modules` is missing.**~~ FIXED on 2026-08-23: dependencies are installed; `npm test`, `npm run dev`, and `npm run build` all run.
3. **`adb` is not on PATH.** Scripts must call it by full path or add `%LOCALAPPDATA%\Android\Sdk\platform-tools` to PATH.
4. ~~**Supabase project is not linked.**~~ FIXED on 2026-08-22: `npx supabase link --project-ref lahvcodvgubplzfshare` completed; `npx supabase status` now reports the linked project.
5. ~~**`.env.staging` is empty.**~~ FIXED on 2026-08-22: `.env.staging` now carries the cloud project URL, anon key, and `VITE_APP_ENV=staging` (see [19 - Environment Variables](./19_ENVIRONMENT_VARIABLES.md)). `SUPABASE_ACCESS_TOKEN` / `SUPABASE_DB_PASSWORD` remain machine-local and intentionally empty in the file.

## Login Details (non-secret)

- **Vercel:** `vercel whoami` returns `amaratvkrishi-india`. Projects live in team/scope `amaratv-krishi`.
- **GitHub:** `gh auth status` shows two accounts; the active one is `AmaratvKrishi-India` over HTTPS with a fine-grained PAT. Git pushes from this repo are attributed to `AmaratvKrishi-India` because the repo-level `user.name`/`user.email` override the global `Divinity` identity.
- **Supabase:** the CLI token can list projects in org `fyeeutppsgfuhytfaekt`; the only project is `lahvcodvgubplzfshare` ("AmaratvKrishi-India's Project", ap-south-1, ACTIVE_HEALTHY, PostgreSQL 17).
- **npm registry:** not logged in. All dependencies are public, so this is fine.

## How to Re-verify

```powershell
node -v; npm -v
vercel whoami
gh auth status
git config user.name; git config user.email
npx supabase --version
npx supabase projects list
docker version --format '{{.Server.Version}}'
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices
```

## Related Documents

- [21 - Account & Identity Map](./21_ACCOUNT_IDENTITY_MAP.md)
- [22 - Deployment Runbook](./22_DEPLOYMENT_RUNBOOK.md)
- [23 - Local Dev Setup](./23_LOCAL_DEV_SETUP.md)
- [13 - Deployment & Environments](./13_DEPLOYMENT_ENVIRONMENTS.md)
