# 23 - LOCAL DEV SETUP

How to bring this project up on a fresh checkout of this machine: dependencies, local Supabase stack, dev server, emulators, and the first-run checklist.

## Current Machine State (2026-08-23)

| Item | State |
|------|-------|
| Node v26.5.0 / npm 11.17.0 | Installed |
| Docker 29.7.2 | Running |
| `node_modules` | Present |
| `dist/` | Present |
| Local Supabase stack | Stopped (`npx supabase start` to launch) |
| Supabase project link | Linked (`lahvcodvgubplzfshare`) |
| Android emulators | 3 online (5556, 5558, 5560) via adb |
| `JAVA_HOME` / `ANDROID_HOME` | NOT SET - Android builds broken until fixed |
| `adb` | Works via full path, not on PATH |

## First-Run Checklist

```powershell
cd "C:\Users\PC\Desktop\calling app"

# 1. Dependencies
npm install

# 2. Local Supabase (Docker must be running)
npx supabase start
npx supabase status          # prints local URLs/keys (local demo values only)

# 3. Dev server (port 3000)
npm run dev

# 4. Optional: link repo to cloud project (needed for db push / functions deploy; already linked on this machine)
npx supabase link --project-ref lahvcodvgubplzfshare
```

## Environment Files

Local development uses [.env.local](file:///c:/Users/PC/Desktop/calling%20app/.env.local), which points at the Dockerized Supabase stack (`http://127.0.0.1:15432`). See [19 - Environment Variables](./19_ENVIRONMENT_VARIABLES.md) for the full file matrix and loading order.

> [!NOTE]
> [.env.staging](file:///c:/Users/PC/Desktop/calling%20app/.env.staging) is populated with the shared cloud project URL/anon key and `VITE_APP_ENV=staging`. Only `SUPABASE_ACCESS_TOKEN` / `SUPABASE_DB_PASSWORD` are intentionally empty (machine-local, needed only for `db push`).

## Local Supabase Ports

From [supabase/config.toml](file:///c:/Users/PC/Desktop/calling%20app/supabase/config.toml) (`project_id = calling_app`):

| Service | Port |
|---------|------|
| PostgreSQL | 15433 |
| API (Kong) | 15432 |
| Studio | 15435 |
| Mailpit (inbucket) | 15436 |

`npx supabase db reset` wipes local data and re-applies all 6 migrations plus [seed.sql](file:///c:/Users/PC/Desktop/calling%20app/supabase/seed.sql).

## Android Development

```powershell
# Fix env vars first (one-time, system-level)
# JAVA_HOME  -> Android Studio JBR, e.g. C:\Program Files\Android\Android Studio\jbr
# ANDROID_HOME -> %LOCALAPPDATA%\Android\Sdk
# Add %LOCALAPPDATA%\Android\Sdk\platform-tools to PATH for adb

npm run build
npx cap sync android
cd android; .\gradlew assembleDebug   # or assembleRelease (needs keystore.properties)
```

Emulators are managed through Android Studio; `adb devices` should list them (currently emulator-5556/5558/5560).

## Everyday Commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Unit/integration tests | `npm test` |
| E2E tests | `npm run test:e2e` |
| Full verification pipeline | `npm run verify` |
| Production build | `npm run build` |
| Local DB reset | `npx supabase db reset` |
| Cloud schema probe | `npx tsx scripts/probeCloudSchema.ts` |

## Related Documents

- [20 - Toolchain & CLI Status](./20_TOOLCHAIN_CLI_STATUS.md)
- [13 - Deployment & Environments](./13_DEPLOYMENT_ENVIRONMENTS.md)
- [12 - Testing & Verification](./12_TESTING_VERIFICATION.md)
