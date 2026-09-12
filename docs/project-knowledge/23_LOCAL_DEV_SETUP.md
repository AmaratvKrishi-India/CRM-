# 23 — Local Development Setup

**Document status:** CURRENT
**Last reviewed:** 2026-09-10
**Source of truth:** `package.json`, `.env.example`, `supabase/config.toml`, and the contributor workflow

## Prerequisites

- Node 26+ and npm with the committed lockfile
- Docker Desktop for local Supabase
- Android Studio, JDK, Android SDK, and an emulator for native work
- Git and the repository's configured tooling

## Fresh checkout

```powershell
cd "C:\path\to\calling app - Copy"
npm ci
Copy-Item .env.example .env.local
# Fill only the local Supabase URL, public anon key, and local app mode.
npx supabase start
npx supabase migration up --local
npm run dev
```

Do not copy production secrets into `.env.local`. Use [19_ENVIRONMENT_VARIABLES.md](./19_ENVIRONMENT_VARIABLES.md) for the loading matrix.

## Local Supabase

The local project is configured in [`supabase/config.toml`](../../supabase/config.toml). Start/stop commands:

```powershell
npx supabase start
npx supabase status
npx supabase migration up --local
npx supabase stop
```

`npx supabase db reset --local` destroys local data and should be used only when the stack is disposable. The current checkout contains 14 ordered migrations; apply them in filename order.

## Development commands

| Task | Command |
|---|---|
| Web dev server | `npm run dev` |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Production build | `npm run build` |
| Node tests | `npm run test:node` |
| Vitest tests | `npm run test:vitest` |
| Chromium E2E | `npm run test:e2e:chromium` |
| Full verification wrapper | `npm run verify` |
| Bundle budget | `npm run test:perf:bundle` |
| Staging guard | `npm run verify:staging-config` |

## Android development

```powershell
npm run build
npx cap sync android
cd android
.\gradlew assembleDebug
```

Set `JAVA_HOME` to the Android Studio JBR and `ANDROID_HOME` to the SDK before building. Use the full ADB path or add platform-tools to PATH. Record emulator serial, API level, WebView version, package identity, and artifact digest in native evidence.

## Safe test boundaries

- Local writes target local Supabase only.
- Staging uses an isolated project reference and passes the staging guard first.
- Production is protected and is never a default test target.
- Preserve the current working tree; do not reset or clean another contributor's changes.

## Related documents

- [20 — Toolchain and CLI status](./20_TOOLCHAIN_CLI_STATUS.md)
- [22 — Deployment runbook](./22_DEPLOYMENT_RUNBOOK.md)
- [24 — Isolated staging environment](./24_STAGING_ENVIRONMENT.md)
- [12 — Testing and verification](./12_TESTING_VERIFICATION.md)
