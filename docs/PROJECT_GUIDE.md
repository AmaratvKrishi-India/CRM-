# Project guide

This guide describes the source in this checkout. Release, staging, and device claims are tracked separately in [GATES.md](../GATES.md).

## Purpose and workflows

Amaratv Krishi Field Sales CRM supports field sales teams that manage business leads, calls, follow-ups, and WhatsApp outreach. ADMIN users manage organization-wide leads and agent accounts. AGENT users work their assigned or created leads. Both roles use one application binary.

The client stores work locally in Dexie/IndexedDB. A mutation and its outbox entry are written atomically, then sent to Supabase when connectivity allows. Server revisions and stable mutation IDs support conditional writes and retries. PostgreSQL RLS is the authoritative tenant and role boundary; hiding a row in the interface is not authorization.

## Architecture and source map

- `src/App.tsx` and `src/components/`: login, role-specific screens, lead workflows, reports, settings, backup, and recovery UI.
- `src/context/`: authentication, role, and theme context.
- `src/db/`: Dexie schema, account-scoped repositories, and local persistence.
- `src/services/sync/`: durable mutation queue, push/pull, revision checks, retry classification, and retained conflicts.
- `src/services/realtime/`: Supabase Realtime subscriptions and local reconciliation.
- `supabase/migrations/`: 18 ordered SQL migrations for schema, RLS, sync, audit, and integrity controls.
- `supabase/functions/create-agent/`: administrator-authorized agent provisioning.
- `android/` and `capacitor.config.ts`: Capacitor Android project and native plugins.
- `tests/`: top-level Node tests plus Vitest service, database, utility, and integration tests.
- `e2e/`: Playwright browser suites, snapshots, and Maestro Android flows.
- `scripts/`: configuration guards, verification runners, build analysis, and audit helpers.

The main checked-in package version is 2.0.0. The Android application ID is `com.amaratvkrishi.salescrm`; the Gradle configuration uses version name 2.0.0, version code 2, minimum SDK 24, and target SDK 36.

The canonical checkout is `C:\Users\PC\Desktop\calling app - Copy`, connected to [AmaratvKrishi-India/CRM-](https://github.com/AmaratvKrishi-India/CRM-) on `main`. Vercel project `crm` serves production at [crm-blush-omega.vercel.app](https://crm-blush-omega.vercel.app).

## Prerequisites and local setup

GitHub CI and Vercel use Node 24. `package.json` does not set an `engines` range. This desktop checkout uses Node 26.5.0 and npm 12.0.2; a clean `npm ci --allow-remote=all` passed here. npm 12 blocked 15 package lifecycle scripts pending local approval, while the updated Node 24 CI run is pending. See [Known issues](./KNOWN_ISSUES.md) for the remaining dependency-audit finding.

For the app without a local backend, configure the ignored `.env.local` file for the intended Supabase environment. For local backend development, Docker Desktop must be running:

```powershell
npm ci
Copy-Item .env.example .env.local
# Fill the local URL and public anon/publishable key from the local Supabase setup.
npx supabase start
npx supabase migration up --local
npm run dev
```

On this desktop's npm 12 installation, use `npm ci --allow-remote=all` because its local remote-fetch policy otherwise blocks registry packages. Do not add that setting to the project configuration; the GitHub and Vercel Node 24 environments use the normal `npm ci` command.

The local API is configured on `127.0.0.1:15432`; the database is on port 15433. Local Studio is configured on port 15435. Do not run `supabase db reset` on a stack that contains data you need; it destroys local database contents.

## Configuration and secrets

`.env.example` names these client variables without providing production credentials:

| Variable | Use |
|---|---|
| `VITE_SUPABASE_URL` | Supabase API URL for the selected environment. |
| `VITE_SUPABASE_ANON_KEY` | Public anon/publishable key used by the client. |
| `VITE_APP_ENV` | Client environment label consumed by app configuration. |
| `VITE_APP_VERSION` | Client version label. |

Use the anon/publishable key only in the browser bundle. Service-role keys, database passwords, auth credentials, Android signing properties, and customer data must remain outside source control. The local Supabase `status` command prints credentials; do not copy its full output into logs or reports.

Vercel keeps Production and Preview settings separate:

| Target | `VITE_APP_ENV` | Supabase project |
|---|---|---|
| Production | `production` | `lahvcodvgubplzfshare` |
| Preview | `staging` | `dhoinifpzijqyobcamlv` |

Both targets use app version `2.0.0`. The staging and production local environment files are ignored by Git. Do not copy their key values into documentation or source.

The read-only `scripts/prod_smoke.ps1` utility reads `.env.production` for Supabase URL and anon-key values, then requests one lead ID and calls `current_profile_id`. Set `CRM_WEB_URL` to the absolute HTTP(S) production URL to include a website GET; without it, that check is skipped. It does not create or change records. Current results are recorded in [GATES.md](../GATES.md).

Android release signing reads the path in `ANDROID_KEYSTORE_PROPERTIES` when set, otherwise Gradle checks `android/keystore.properties`. That file is Git-ignored. Do not add keystores or signing values to the repository.

## Development and tests

| Area | Command | Notes |
|---|---|---|
| Development server | `npm run dev` | Vite local development server. |
| TypeScript | `npm run typecheck` | App TypeScript check. |
| Type tests | `npm run test:type` | Type-level tests. |
| Lint | `npm run lint` | ESLint over `src`. |
| Node suite | `npm test -- --runInBand` | Top-level Node tests; F002/F003 database fixtures require the local Docker Supabase container. |
| Vitest | `npm run test:vitest` | Service and integration tests; database integration uses loopback-only Supabase checks and cleanup fixtures. |
| Browser | `npm run test:e2e:chromium` | Starts a strict local Vite server; backend-backed or unsupported cases may be skipped. |
| Bundle budget | `npm run test:perf:bundle` | Measures built chunk sizes and writes ignored reports. |
| Production build | `npm run build` | Release config guard, TypeScript, and Vite production build. |
| Staging build | `npm run build:staging` | Requires the staging config guard to pass. |

Node tests that create temporary PostgreSQL databases require the local Docker container `supabase_db_calling_app`. Vitest integration helpers verify that the backend URL is loopback before creating fixtures. Do not point test writers at staging or production. See [CONTRIBUTING.md](../CONTRIBUTING.md) for test safety and [GATES.md](../GATES.md) for results from this checkout.

## Database and deployment

The local Supabase project configuration and migrations live under `supabase/`. The migration directory currently contains 18 SQL files; the latest child-read reassignment hardening is `20260923000017_child_read_reassignment_hardening.sql`. Production and staging both report all 18 migrations applied and RLS enabled on all 16 public tables. Live SQL inspection verified all five affected child-read policies in both projects: linked records follow current parent-lead visibility while retaining organization-admin access. The `activities` policy also allows a user to read their own unlinked activities. The deployed `create-agent` source matches local code in both projects, and both report `verify_jwt=true`; an unauthenticated staging POST returned HTTP 401. Production was not changed during the staging alignment. Keep applied migrations immutable and add a new migration for future schema or policy changes.

Local migration application is documented in the setup section. Vercel project `crm` uses the repository root, the Vite framework, `npm run build`, and Node.js 24. Its install command and output directory are not explicitly overridden; Vercel applies package-manager and Vite defaults (`dist`). Production uses the `main` branch and the production Supabase project; Preview uses the staging Supabase project. The canonical checkout is locally linked to this Vercel project. Vercel handles deployments from its Git connection. Apply staging or production migrations only through the current approved backend workflow after confirming the target and migration state. A local build does not prove deployment success.

## Android workflow

Run `npm run release:android:prepare` to run the release web build, sync the generated web assets into the Capacitor Android project, and validate Android release asset configuration. The Capacitor web directory is `dist`; synced assets are generated and can be recreated by this command.

Use Android Studio and an emulator or physical device for native builds and acceptance. Record the device/API level, WebView, APK identity, and tested flows. A successful web build or Gradle compilation is not device acceptance. Keep signed APK/AAB files outside this repository unless a release task specifically requires them.

## Data safety

Backup restore validates account scope and record shape and rejects files larger than 25 MiB before reading them. The local recovery panel lets users inspect/export retained sync work and explicitly retry it after resolving the cause. Do not clear app storage or delete unsynced work to make a test pass.

See [Known issues and limitations](./KNOWN_ISSUES.md) for background sync behavior, historical QA context, deferred audit questions, and unverified cloud state.
