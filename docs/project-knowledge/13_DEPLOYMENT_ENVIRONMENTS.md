# 13 - DEPLOYMENT & ENVIRONMENTS

This document details the deployment configurations, environment setups, and build processes for the Amaratv Krishi Field Sales CRM project.

## Environment Variables

The project uses multiple `.env` files to manage configuration across different environments. 

**Environment Files:**
- [`.env`](file:///c:/Users/PC/Desktop/calling%20app/.env) (400 bytes) — default fallback
- [`.env.local`](file:///c:/Users/PC/Desktop/calling%20app/.env.local) (323 bytes) — local Docker Supabase
- [`.env.development`](file:///c:/Users/PC/Desktop/calling%20app/.env.development) (331 bytes) — cloud staging
- [`.env.staging`](file:///c:/Users/PC/Desktop/calling%20app/.env.staging) (123 bytes) — staging config (currently all values EMPTY, see [19 - Environment Variables](./19_ENVIRONMENT_VARIABLES.md))
- [`.env.production`](file:///c:/Users/PC/Desktop/calling%20app/.env.production) (400 bytes) — production
- [`.env.example`](file:///c:/Users/PC/Desktop/calling%20app/.env.example) (462 bytes) — template for new developers

**Key Variable Names:**
*(Note: Actual values are omitted for security reasons. Refer to the respective files or cloud console for values.)*
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_ENV`
- `VITE_APP_VERSION`

> [!CAUTION]
> The `SERVICE_ROLE_KEY` is highly privileged and is **NEVER** present in client code or frontend environment variables.

## `.gitignore` Security

The project's [[`.gitignore`](file:///c:/Users/PC/Desktop/calling%20app/.gitignore)] is configured to exclude sensitive files, build artifacts, and local environments from version control:

- **Environment Files:** `.env`, `.env.*` (except `.env.example`)
- **Android Signing Keys:** `*.jks`, `*.keystore`, `keystore.properties`
- **Build & Dependencies:** `node_modules/`, `dist/`, `android/app/build/`, `android/build/`, `android/.gradle/`
- **IDE & Logs:** `.idea/`, `.vscode/`, `*.log`
- **Local State & Agents:** `supabase/.temp/`, `local/`, `.agents/`, `.gemini/`, `.claude/`, `.vercel`

## Local Development Environment

The local development setup relies on Dockerized Supabase and the Vite dev server.

- **Database:** Supabase CLI / Docker
  - Config: [supabase/config.toml](file:///c:/Users/PC/Desktop/calling%20app/supabase/config.toml)
  - `project_id`: calling_app
  - Database Port: 15433
  - API Port: 15432
  - Studio Port: 15435
- **Commands:**
  - Start: `supabase start`
  - Stop: `supabase stop`
  - Reset: `supabase db reset` (applies all migrations and [seed.sql](file:///c:/Users/PC/Desktop/calling%20app/supabase/seed.sql))
- **Frontend:** Vite dev server runs on port 3000
- **Android:** Capacitor syncs to the built web bundle (run build first)

## Production Environment

The production stack utilizes Supabase Cloud for backend services and Vercel for web hosting.

- **Backend:** Supabase Cloud (`lahvcodvgubplzfshare.supabase.co`)
- **Web Host:** Vercel ([https://crm-blush-omega.vercel.app](https://crm-blush-omega.vercel.app))
- **Vercel Project:** `amaratv-krishi/crm` (team `amaratv-krishi`, account `amaratvkrishi-india`)
- **Configuration:** [[`vercel.json`](file:///c:/Users/PC/Desktop/calling%20app/vercel.json)] (`{"name": "amaratv-krishi-crm"}` — legacy name; the linked project is `crm` in scope `amaratv-krishi`)
- **Vercel Ignores:** [[`.vercelignore`](file:///c:/Users/PC/Desktop/calling%20app/.vercelignore)] (`android/`, `node_modules/`)
- **Vercel Env Vars:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_ENV`, `VITE_APP_VERSION`
- **Android Production:** Gradle outputs `android/app/build/outputs/apk/release/app-release.apk`; the shipped artifact is [release/AmaratvKrishi-SalesCRM-v2.0.0.apk](file:///c:/Users/PC/Desktop/calling%20app/release/AmaratvKrishi-SalesCRM-v2.0.0.apk) (6.9 MB / 7,268,429 bytes)
- **Supabase Link:** Repo is currently NOT linked (`npx supabase status` reports `linked_project: null`). Run `npx supabase link --project-ref lahvcodvgubplzfshare` before `db push` / `functions deploy`.

## Build Commands

Defined in [[`package.json`](file:///c:/Users/PC/Desktop/calling%20app/package.json)], the project utilizes the following key commands:

- **Web Dev:** `npm run dev` (starts Vite on port 3000)
- **Web Build:** `npm run build` (runs `tsc && vite build`)
- **Web Preview:** `npm run preview`
- **Android Build:** `cd android && gradlew assembleRelease` (requires `JAVA_HOME` and `ANDROID_HOME` — both currently UNSET, see [20 - Toolchain & CLI Status](./20_TOOLCHAIN_CLI_STATUS.md))
- **Tests:** `npm test`, `npm run test:e2e`, `npm run verify`

## Configuration Files

### Vite Configuration ([[`vite.config.ts`](file:///c:/Users/PC/Desktop/calling%20app/vite.config.ts)])
- **Plugins:** `react`, `tailwindcss`
- **Server:** Port 3000, `host: true`
- **Build:** `chunkSizeWarningLimit` set to 600
- **Manual Chunks:** Configured for `xlsx`, `supabase`, `dexie`, `lucide`, `react` to optimize bundle size.

### TypeScript Configuration ([[`tsconfig.json`](file:///c:/Users/PC/Desktop/calling%20app/tsconfig.json)])
- **Target:** `ES2022`
- **Module:** `ESNext`
- **JSX:** `react-jsx`
- **Strict Mode:** Enabled
- **Root Directory:** `./src`
- **Output Directory:** `./dist`

### Capacitor Configuration ([[`capacitor.config.ts`](file:///c:/Users/PC/Desktop/calling%20app/capacitor.config.ts)])
- **appId:** `com.amaratvkrishi.salescrm`
- **webDir:** `dist`
- **androidScheme:** `https`

## Related Documents

- [22 - Deployment Runbook](./22_DEPLOYMENT_RUNBOOK.md) — step-by-step deploy procedures
- [23 - Local Dev Setup](./23_LOCAL_DEV_SETUP.md) — first-run checklist for this machine
- [20 - Toolchain & CLI Status](./20_TOOLCHAIN_CLI_STATUS.md) — tool health snapshot
