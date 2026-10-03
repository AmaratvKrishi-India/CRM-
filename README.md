# Amaratv Krishi Field Sales CRM

Offline-first sales CRM for field representatives and administrators. The web client runs in a browser and is packaged for Android with Capacitor. Local IndexedDB storage and a durable outbox support work during network loss; Supabase PostgreSQL Row Level Security remains the server authorization boundary.

**Release version:** 2.0.2. Signed Android artifacts and release verification are distributed through [GitHub Releases](https://github.com/AmaratvKrishi-India/CRM-/releases). See [GATES.md](./GATES.md) for acceptance evidence and remaining limitations.

## Canonical project and cloud services

- **Local project:** `C:\Users\PC\Desktop\calling app - Copy`
- **GitHub:** [AmaratvKrishi-India/CRM-](https://github.com/AmaratvKrishi-India/CRM-), default branch `main`.
- **Vercel:** project `crm`; production URL [crm-blush-omega.vercel.app](https://crm-blush-omega.vercel.app). Production is assigned to `main`; Preview builds use the staging Supabase project.
- **Supabase:** Production project `lahvcodvgubplzfshare`; staging project `dhoinifpzijqyobcamlv`. Client keys are kept in ignored local environment files and Vercel settings, not in this document.

Production and Preview have separate Vercel values for the Supabase URL, public anon key, app environment, and app version. The setup and deployment details are in the [project guide](./docs/PROJECT_GUIDE.md); current cloud evidence and limits are in [known issues](./docs/KNOWN_ISSUES.md) and [acceptance gates](./GATES.md).

## Capabilities

- ADMIN and AGENT workflows in one application.
- Lead import, review, assignment, reporting, and data backup/restore.
- Agent calling and WhatsApp workflows, activity history, and follow-up reminders.
- Offline-first writes with queued synchronization, conflict handling, and local recovery tools.
- Supabase Auth, PostgreSQL RLS, Realtime, and an admin-only agent provisioning function.

## Start here

- [Project guide](./docs/PROJECT_GUIDE.md): architecture, setup, configuration, testing, Android, and deployment.
- [Known issues and limitations](./docs/KNOWN_ISSUES.md): confirmed limits, historical findings, and evidence gaps.
- [Acceptance gates](./GATES.md): results from the latest checkout review.
- [Contributing](./CONTRIBUTING.md): local workflow and safety notes.

## Quick start

Prerequisites: Node.js and npm, plus Docker Desktop for local Supabase and database-backed tests. GitHub CI and Vercel use Node 24. This desktop checkout currently has Node 26.5.0 and npm 12.0.2; `package.json` does not declare a Node engine range.

**Fresh-install and audit status:** package.json and package-lock.json are synchronized, and npm audit reports zero vulnerabilities. Hosted Node 24 CI clean install and the dependency security gate pass. Local npm 12 can block package lifecycle scripts under its approval policy. Current acceptance evidence and cleanup/device checklists are in GATES.md, docs/KNOWN_ISSUES.md, docs/ANDROID_DEVICE_ACCEPTANCE.md, and docs/CONSOLIDATION_CLEANUP.md.

```powershell
npm ci
Copy-Item .env.example .env.local
# Edit .env.local with the required values; keep it out of Git.
npx supabase start
npx supabase migration up --local
npm run dev
```

Set the four variable names listed in [`.env.example`](./.env.example): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_ENV`, and `VITE_APP_VERSION`. Use only a public anon/publishable key in the client. Never put a service-role key, signing key, password, or customer export in source control. Local Supabase uses API port 15432 and database port 15433.

## Verification

```powershell
npm run typecheck
npm run test:type
npm run lint
npm test -- --runInBand
npm run test:vitest
npm run test:e2e:chromium
npm run test:e2e:real
npm run build
```

The Node suite and Vitest integration tests need the local Docker-backed Supabase stack. The Chromium suite starts a strict local Vite server and uses test auth mocks. `npm run test:e2e:real` runs the local-Supabase CRUD and multi-client browser cases; its endpoint guard refuses non-loopback database targets. The CI workflow schedules both suites separately. Read [GATES.md](./GATES.md) for exact results and limitations before using historical or partial evidence as a release decision.

## Builds and release

- `npm run build` runs the release configuration gate, TypeScript, and the production Vite build.
- `npm run build:staging` validates staging configuration and creates a staging build.
- `npm run release:android:prepare` builds the web app, syncs Capacitor Android assets, and verifies release asset configuration.
- Android signing properties are supplied through `ANDROID_KEYSTORE_PROPERTIES` or the ignored `android/keystore.properties` file. Keep all signing material external to Git.
The canonical Vercel project is crm, with Production on main and Preview using staging settings. The sync_mutate security migration has been applied to hosted Staging and then Production. Future database changes should use the reviewed migration workflow and confirm the target first.

## Project layout

```text
src/                 React application, components, data, and services
src/db/              Dexie database and repositories
src/services/sync/   outbox, push/pull, conflict recovery, and sync state
supabase/            19 ordered migration files, local config, and Edge Function
android/             Capacitor Android project
tests/               Node, Vitest, database, and service tests
e2e/                 Playwright browser tests and Maestro flows
scripts/              build, verification, audit, and release helpers
docs/                 project guide and known issues
```

## License

Proprietary; see [LICENSE](./LICENSE). Third-party notices are in [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md).
