# 20 — Toolchain and CLI Status

**Document status:** CURRENT
**Last reviewed:** 2026-09-11
**Source of truth:** `package.json`, `package-lock.json`, contributor setup, and dated verification reports

This document records repository requirements and the latest known verification constraints. Machine login state is intentionally not treated as a permanent project fact; re-run the commands below before deployment or release work.

## Repository toolchain

| Tool | Repository version / expectation |
|---|---|
| Node.js | Node 26+ |
| npm | use the committed lockfile |
| TypeScript | 6.0.3 |
| Vite | 8.2.2 |
| React | 19.2.8 |
| Capacitor core / Android | 8.5.1 |
| Playwright | 1.62.1 |
| Vitest | 4.x |
| Supabase CLI | use the installed `npx supabase` version; verify before migration work |
| Docker | required for local Supabase integration tests |
| Android SDK/JDK | required for emulator and APK work |

## Current constraints

- Docker-backed checks must be rerun from a stable Docker Desktop engine when the named pipe or local stack is unavailable.
- Android release signing cannot be completed from this workspace because the external release keystore is not present here.
- `adb`, `JAVA_HOME`, and `ANDROID_HOME` are machine configuration concerns; do not encode one developer's absolute paths in project documentation.
- The working tree contains pre-existing changes. Preserve them and capture branch/HEAD before a verification run.
- On the 2026-09-10 Windows audit machine, neither the optional `graft` CLI nor `rg` was on PATH. The local `graft/` directory is ignored and regenerable rather than checked in. When it exists it may be used as a navigation aid; otherwise fall back to `git grep`, PowerShell `Select-String`, or equivalent source search rather than failing solely because those conveniences are absent.

## Re-verify

```powershell
node -v
npm -v
npx supabase --version
docker version
git status --short
npm run typecheck
npm run lint
npm run build
```

For Android, also verify the JDK, SDK, connected emulator serial, WebView version, APK digest, and package identity. For staging, run `npm run verify:staging-config` before starting Vite or applying migrations.

## Account and secret rules

- Do not record tokens, passwords, service-role keys, JWT secrets, session values, customer data, or keystore passwords.
- Use the repository-level Git identity only when it is explicitly configured for the task.
- Confirm Vercel and Supabase project identity before any deployment operation.

## Related documents

- [19 — Environment variables](./19_ENVIRONMENT_VARIABLES.md)
- [22 — Deployment runbook](./22_DEPLOYMENT_RUNBOOK.md)
- [23 — Local development setup](./23_LOCAL_DEV_SETUP.md)
- [24 — Isolated staging environment](./24_STAGING_ENVIRONMENT.md)
- [GATES.md](../../GATES.md)
