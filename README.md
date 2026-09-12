# Amaratv Krishi — Field Sales CRM

<div align="center">

**Offline-first mobile CRM for field sales teams — single Android APK + web admin console**

[![Release](https://img.shields.io/badge/release-v2.0.0-16a34a?style=flat-square)](./release/RELEASE_NOTES.md)
[Current state](./docs/project-knowledge/16_CURRENT_STATE.md) · [Contributing](./CONTRIBUTING.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue?style=flat-square&logo=typescript)](./tsconfig.json)
[![React](https://img.shields.io/badge/React-19.2-61dafb?style=flat-square&logo=react)](./package.json)
[![Capacitor](https://img.shields.io/badge/Capacitor-8.5-119EFF?style=flat-square&logo=capacitor)](./capacitor.config.ts)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%2B%20RLS-3ECF8E?style=flat-square&logo=supabase)](./supabase)

</div>

---

Amaratv Krishi is a natural nutrition enterprise (*"From Our Fields to Your Home"*). This CRM is built for its ground sales team in Lucknow, UP: reps discover, call, pitch and close B2B deals with gyms, health clubs and wellness centres — often from areas with poor connectivity. Everything works offline first and syncs when the network returns.

> The v2.0.0 APK is the historical shipped artifact. The current checkout is a release-readiness candidate and remains **not release-approved** until the gates in [`GATES.md`](./GATES.md) are green for the exact candidate.

**Live web admin:** <https://crm-blush-omega.vercel.app> · **Android:** signed APK in [`release/`](./release)

## Highlights

- **One APK, two roles.** ADMIN and AGENT share a single binary; routing and data access are enforced per role, with PostgreSQL Row Level Security as the authority (not UI filtering).
- **Offline-first.** Every mutation lands in a durable Dexie (IndexedDB) outbox, survives app restarts, and uses durable mutation identities for idempotent retry after reconnect.
- **Honest call data.** The call lifecycle state machine refuses fabricated talk time: dial-only calls are recorded as UNVERIFIED with zero duration.
- **Excel import + bulk assignment.** Column mapping, phone normalisation (+91 / Lucknow STD), duplicate detection, and audited bulk assignment.
- **Multi-device sync.** The local integration suite exercises actual outbox push and second-client pull. Current Android/staging verification is tracked in the current verification report.

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

`.env.local` targets the local Docker stack; other Vite modes are environment-specific and must be verified before use. See [docs/project-knowledge/23_LOCAL_DEV_SETUP.md](./docs/project-knowledge/23_LOCAL_DEV_SETUP.md) and [19_ENVIRONMENT_VARIABLES.md](./docs/project-knowledge/19_ENVIRONMENT_VARIABLES.md).

## Testing

The repository contains several overlapping test runners. Treat verification results as scoped evidence, and use [GATES.md](./GATES.md) for the current release decision. Do not infer current release approval from historical v2.0.0 counts in the release notes.

| Suite | Command | Current status source |
|---|---|---|
| Node-runner suite | `npm run test:node` | [GATES.md](./GATES.md) / [current state](./docs/project-knowledge/16_CURRENT_STATE.md) |
| Vitest suite | `npm run test:vitest` | [GATES.md](./GATES.md) / [current state](./docs/project-knowledge/16_CURRENT_STATE.md) |
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

```text
App ID:        com.amaratvkrishi.salescrm
Version:       2.0.0 (versionCode 2) · minSdk 24 / targetSdk 36
APK:           release/AmaratvKrishi-SalesCRM-v2.0.0.apk (7,272,377 bytes)
SHA-256:       2E9E08631C0FCE733156B16B7FB57DD39999F128BB56C3A11B6DD0BE9ECB763D
Signing:       APK Signature Scheme v2 (external keystore, not in this repo)
Permissions:   INTERNET, POST_NOTIFICATIONS only · allowBackup=false
```

Install on an emulator/device: `adb install -r release/AmaratvKrishi-SalesCRM-v2.0.0.apk`

## Deployment

- **Web:** Vercel (project `crm`, scope `amaratv-krishi`) — deploys `main` automatically.
- **Backend:** Supabase is the backend platform. Production is protected and migrations are applied manually with explicit approval; verify the target project and migration state before every operation.
- **Runbook:** [docs/project-knowledge/22_DEPLOYMENT_RUNBOOK.md](./docs/project-knowledge/22_DEPLOYMENT_RUNBOOK.md)

## Documentation

The documentation landing page is [`docs/README.md`](./docs/README.md). Current, source-verified guides are indexed in [`docs/project-knowledge/`](./docs/project-knowledge/README.md), architecture decisions live in [`docs/decisions/`](./docs/decisions/README.md), and non-authoritative generated/reference material lives under [`docs/reference/`](./docs/reference/README.md). Superseded audit, remediation, handoff, and duplicate guide documents have been removed from the working documentation set.

Key documents:

| Document | Purpose |
|---|---|
| [16_CURRENT_STATE.md](./docs/project-knowledge/16_CURRENT_STATE.md) | Current checkout, release decision, evidence precedence, and blockers |
| [FINAL_RELEASE_SIGNOFF_2026-09-09.md](./docs/project-knowledge/FINAL_RELEASE_SIGNOFF_2026-09-09.md) | Latest dated release verification and signing caveat |
| [GATES.md](./GATES.md) | Master acceptance gates (current verified state) |
| [project-knowledge/07_SUPABASE_SECURITY_MODEL.md](./docs/project-knowledge/07_SUPABASE_SECURITY_MODEL.md) | RLS & security model |
| [project-knowledge/08_SYNC_REALTIME_ARCHITECTURE.md](./docs/project-knowledge/08_SYNC_REALTIME_ARCHITECTURE.md) | Sync engine & realtime |
| [project-knowledge/22_DEPLOYMENT_RUNBOOK.md](./docs/project-knowledge/22_DEPLOYMENT_RUNBOOK.md) | Deploy & rollback procedures |
| [project-knowledge/23_LOCAL_DEV_SETUP.md](./docs/project-knowledge/23_LOCAL_DEV_SETUP.md) | Fresh-checkout setup |
| [RELEASE_NOTES.md](./release/RELEASE_NOTES.md) | Shipped v2.0.0 artifact and historical release notes |

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
docs/           Current living guides, ADRs, and non-authoritative reference material
release/        Signed release APK + release notes
scratch/        Local experiments and temporary evidence (not canonical)
```

## License

© 2026 Amaratv Krishi India. All rights reserved. Proprietary — see [LICENSE](./LICENSE).
Built on open-source software; full attribution and license texts in
[THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md).
*From Our Fields to Your Home.*

Import preparation and supported phone checks: [Import format guide](docs/project-knowledge/IMPORT_FORMAT_AND_PHONE_VALIDATION.md).
Deletion and failed-sync recovery: [Recovery policy](docs/project-knowledge/DELETION_AND_RECOVERY_POLICY.md).
