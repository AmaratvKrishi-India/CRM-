# Amaratv Krishi — Field Sales CRM

<div align="center">

**Offline-first mobile CRM for field sales teams — single Android APK + web admin console**

[Acceptance gates](./GATES.md) · [Contributing](./CONTRIBUTING.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue?style=flat-square&logo=typescript)](./tsconfig.json)
[![React](https://img.shields.io/badge/React-19.2-61dafb?style=flat-square&logo=react)](./package.json)
[![Capacitor](https://img.shields.io/badge/Capacitor-8.5-119EFF?style=flat-square&logo=capacitor)](./capacitor.config.ts)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%2B%20RLS-3ECF8E?style=flat-square&logo=supabase)](./supabase)

</div>

---

Amaratv Krishi is a natural nutrition enterprise (*"From Our Fields to Your Home"*). This CRM is built for its ground sales team in Lucknow, UP: reps discover, call, pitch and close B2B deals with gyms, health clubs and wellness centres — often from areas with poor connectivity. Everything works offline first and syncs when the network returns.

> The current checkout remains **not release-approved** until the gates in [`GATES.md`](./GATES.md) are green for the exact candidate.

**Live web admin:** <https://crm-blush-omega.vercel.app> · **Android:** prepare a candidate with `npm run release:android:prepare`

## Highlights

- **One APK, two roles.** ADMIN and AGENT share a single binary; routing and data access are enforced per role, with PostgreSQL Row Level Security as the authority (not UI filtering).
- **Offline-first.** Every mutation lands in a durable Dexie (IndexedDB) outbox, survives app restarts, and uses durable mutation identities for idempotent retry after reconnect.
- **Honest call data.** The call lifecycle state machine refuses fabricated talk time: dial-only calls are recorded as UNVERIFIED with zero duration.
- **Excel import + bulk assignment.** Column mapping, phone normalisation (+91 / Lucknow STD), duplicate detection, and audited bulk assignment.
- **Multi-device sync.** The local integration suite exercises actual outbox push and second-client pull. Android/staging verification must be rerun for the exact checkout before release decisions.

## Feature matrix

| Admin | Agent |
|---|---|
| Org-wide dashboard, KPIs, live activity feed | Personal dashboard with assigned leads only |
| Excel lead import with dedup | 1-tap dialler integration + outcome logging |
| Lead review, create, edit, assign (single + bulk) | WhatsApp pitch templates (intent-based) |
| Agent provisioning via Edge Function, edit/deactivate | Remarks, follow-ups, activities, message history |
| Analytics reports + CSV export | Local-notification follow-up reminders |
| Backup / restore (validated JSON snapshot and merge) | Full offline autonomy with auto-sync |

## Architecture

```text
┌────────────────────────────┐        ┌──────────────────────────────┐
│  React 19 + Vite + Tailwind│        │  Supabase                    │
│  (Capacitor 8 → Android)   │  push  │  PostgreSQL + RLS            │
│                            │ ─────► │  Auth · Realtime · Edge Fn   │
│  Dexie (IndexedDB)         │  pull  │  (create-agent, admin-only)  │
│  outbox queue + sync engine│ ◄───── │                              │
└────────────────────────────┘        └──────────────────────────────┘
```

- **Client:** React + TypeScript + Vite + Tailwind, wrapped with Capacitor for Android.
- **Local store:** Dexie repositories; every write creates an outbox record.
- **Sync:** conditional writes against server revisions, durable mutation UUIDs, incremental server-revision cursors, classified retries and explicit retained conflicts. Data writes and outbox enqueues are atomic. Realtime events complement the authoritative pull.
- **Security:** organization isolation, agent lead isolation, immutable records, purge controls, abuse controls, operational reporting boundaries, and child-record hardening are represented in the ordered migration history. The current deployment status is documented separately; this checkout contains 14 migration files.

## Getting started

Prereqs: Node 26+, Docker Desktop (for the local Supabase stack), Android Studio (for emulator/APK work).

```powershell
npm install
copy .env.example .env.local   # then fill in your Supabase URL + anon key

npx supabase start             # local Supabase on 127.0.0.1:15432 (Docker)
npm run dev                    # dev server
```

`.env.local` targets the local Docker stack; other Vite modes are environment-specific and must be verified before use. See [`.env.example`](./.env.example) for the required variables.

## Testing

The repository contains several overlapping test runners. Treat verification results as scoped evidence, and use [GATES.md](./GATES.md) for the current release decision.

| Suite | Command | Current status source |
|---|---|---|
| Node-runner suite | `npm run test:node` | [GATES.md](./GATES.md) |
| Vitest suite | `npm run test:vitest` | [GATES.md](./GATES.md) |
| Playwright E2E (desktop + mobile) | `npm run test:e2e` | Latest scoped verification only; do not reuse historical counts |
| Real PostgreSQL + RLS (Docker) | `npx tsx --test tests/realSupabasePostgres.test.ts` | Latest scoped verification only |
| Multi-device / Android acceptance | `npx tsx --test tests/multiDeviceSync.test.ts` | Latest scoped verification only |
| Production build | `npm run build` | [GATES.md](./GATES.md) |

Android testing uses dynamically detected Android Studio emulators (AVDs) — physical devices are not required.

## Database & migrations

Fourteen ordered migrations live in [`supabase/migrations/`](./supabase/migrations). Local, staging, and production application status must be verified independently before any database deployment:

1. Central schema (10 tables, FKs, base indexes)
2. Org-level RLS + profile immutability trigger
3. Call-duration analytics indexes
4. Realtime publication
5. Bulk-assignment audits
6. Agent lead isolation + lead immutability trigger
7. Call-record extended fields, child-delete policy, and purge controls
8–14. Server ordering, agent-provisioning abuse controls, lead purge, operational reporting, conflict HTTP status, call-attempt identity, and child-lead RLS hardening

RLS guarantees: users only ever see their own organisation's data; agents only see leads they were assigned or created; audit tables are admin-only.

## Android release

Run `npm run release:android:prepare` to build the web app, sync Capacitor, and verify
the release configuration. Keep signed APK/AAB files and their hashes outside this
repository unless a release task explicitly requires them.

## Deployment

- **Web:** Vercel (project `crm`, scope `amaratv-krishi`) — deploys `main` automatically.
- **Backend:** Supabase is the backend platform. Production is protected and migrations are applied manually with explicit approval; verify the target project and migration state before every operation.
- **Runbook:** follow the deployment commands in `package.json` and confirm the target project before every deployment.

## Documentation

Project guidance is intentionally kept concise and close to the code: this README,
[`CONTRIBUTING.md`](./CONTRIBUTING.md), [`GATES.md`](./GATES.md), and the source,
tests, and configuration files are authoritative. Historical reports and generated
release documents are not kept in the repository.

## Repository layout

```text
src/            React app (components, context, db repositories, services)
  services/sync     SyncEngine: push, pull, queue, conflict resolver, background sync
  services/realtime Org-filtered realtime channels
supabase/       Migrations, seed, Edge Function (create-agent)
android/        Capacitor Android project
tests/          Unit/integration + real-Postgres + multi-device suites
e2e/            Playwright specs
scripts/        Verification & probe tooling
public/          Static web assets
```

## License

© 2026 Amaratv Krishi India. All rights reserved. Proprietary — see [LICENSE](./LICENSE).
Built on open-source software; full attribution and license texts in
[THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md).
*From Our Fields to Your Home.*
