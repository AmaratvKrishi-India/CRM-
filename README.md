# Amaratv Krishi — Field Sales CRM

<div align="center">

**Offline-first mobile CRM for field sales teams — single Android APK + web admin console**

[![Release](https://img.shields.io/badge/release-v2.0.0-16a34a?style=flat-square)](./release/RELEASE_NOTES.md)
[![Tests](https://img.shields.io/badge/tests-179%20pass-success?style=flat-square)](./docs/BUGFIX_RESULTS.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.0-blue?style=flat-square&logo=typescript)](./tsconfig.json)
[![React](https://img.shields.io/badge/React-19.2-61dafb?style=flat-square&logo=react)](./package.json)
[![Capacitor](https://img.shields.io/badge/Capacitor-8.5-119EFF?style=flat-square&logo=capacitor)](./capacitor.config.ts)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%2B%20RLS-3ECF8E?style=flat-square&logo=supabase)](./supabase)
[![Audit](https://img.shields.io/badge/release%20audit-READY%20(non--blocking%20items)-gold?style=flat-square)](./docs/FINAL_A_TO_Z_RELEASE_AUDIT.md)

</div>

---

Amaratv Krishi is a natural nutrition enterprise (*"From Our Fields to Your Home"*). This CRM is built for its ground sales team in Lucknow, UP: reps discover, call, pitch and close B2B deals with gyms, health clubs and wellness centres — often from areas with poor connectivity. Everything works offline first and syncs when the network returns.

**Live web admin:** <https://crm-blush-omega.vercel.app> · **Android:** signed APK in [`release/`](./release)

## Highlights

- **One APK, two roles.** ADMIN and AGENT share a single binary; routing and data access are enforced per role, with PostgreSQL Row Level Security as the authority (not UI filtering).
- **Offline-first.** Every mutation lands in a durable Dexie (IndexedDB) outbox, survives app restarts, and syncs exactly once on reconnect.
- **Honest call data.** The call lifecycle state machine refuses fabricated talk time: dial-only calls are recorded as UNVERIFIED with zero duration.
- **Excel import + bulk assignment.** Column mapping, phone normalisation (+91 / Lucknow STD), duplicate detection, and audited bulk assignment.
- **Real multi-device sync.** Verified end-to-end across 3 Android emulators (admin + 2 agents) with strict agent-to-agent lead isolation.

## Feature matrix

| Admin | Agent |
|---|---|
| Org-wide dashboard, KPIs, live activity feed | Personal dashboard with assigned leads only |
| Excel lead import with dedup | 1-tap dialler integration + outcome logging |
| Lead review, create, edit, assign (single + bulk) | WhatsApp pitch templates (intent-based) |
| Agent provisioning via Edge Function, edit/deactivate | Remarks, follow-ups, activities, message history |
| Analytics reports + CSV export | Local-notification follow-up reminders |
| Backup / restore (JSON snapshot, LWW merge) | Full offline autonomy with auto-sync |

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
- **Sync:** push→pull with cursor pagination, exponential backoff, idempotency keys, operation-aware push (CREATE/UPDATE upsert, DELETE deletes — never resurrects), Last-Write-Wins merge with a deterministic REMOTE-wins tie-break, and a VERIFIED-duration-wins rule for call records. Data writes and outbox enqueues are atomic. Realtime channels hint; the authoritative pull decides.
- **Security:** org isolation + agent lead isolation + immutability triggers, all enforced in PostgreSQL RLS across 7 migrations (migration 7 local-only pending release).

## Getting started

Prereqs: Node 26+, Docker Desktop (for the local Supabase stack), Android Studio (for emulator/APK work).

```powershell
npm install
copy .env.example .env.local   # then fill in your Supabase URL + anon key

npx supabase start             # local Supabase on 127.0.0.1:15432 (Docker)
npm run dev                    # dev server
```

`.env.local` / `.env.development` target the local Docker stack; `.env.production` targets the live project. See [docs/project-knowledge/23_LOCAL_DEV_SETUP.md](./docs/project-knowledge/23_LOCAL_DEV_SETUP.md) and [19_ENVIRONMENT_VARIABLES.md](./docs/project-knowledge/19_ENVIRONMENT_VARIABLES.md).

## Testing

All counts below were re-run and verified on 2026-08-23 after the final-audit bugfix remediation (see [BUGFIX_RESULTS.md](./docs/BUGFIX_RESULTS.md)):

| Suite | Command | Result |
|---|---|---|
| Unit / integration (31 suites) | `npm run test` | 119 pass |
| Playwright E2E (desktop + mobile) | `npm run test:e2e` | 32 pass |
| Real PostgreSQL + RLS (Docker) | `npx tsx --test tests/realSupabasePostgres.test.ts` | 15 pass |
| 3-emulator multi-device acceptance | `npx tsx --test tests/multiDeviceSync.test.ts` | 13 pass (3 consecutive runs) |
| Production build | `npm run build` | clean |

Android testing uses dynamically detected Android Studio emulators (AVDs) — physical devices are not required.

## Database & migrations

Seven migrations in [`supabase/migrations/`](./supabase/migrations). Migrations 1–6 are applied to both the local Docker stack and production; migration 7 is applied to the local stack only (cloud application is a deliberate release step):

1. Central schema (10 tables, FKs, base indexes)
2. Org-level RLS + profile immutability trigger
3. Call-duration analytics indexes
4. Realtime publication
5. Bulk-assignment audits
6. Agent lead isolation + lead immutability trigger
7. Call-record extended fields (dial attempt id, reported duration, call status) + child-FK CASCADE and leads DELETE policy for cloud hard-delete (local only)

RLS guarantees: users only ever see their own organisation's data; agents only see leads they were assigned or created; audit tables are admin-only.

## Android release

```text
App ID:        com.amaratvkrishi.salescrm
Version:       2.0.0 (versionCode 2) · minSdk 24 / targetSdk 36
APK:           release/AmaratvKrishi-SalesCRM-v2.0.0.apk (7,268,429 bytes)
SHA-256:       A7DD97F61718A7735BE3D0EBD0023F201BEC6B995AA4DD93A3A4E832CD30E0B9
Signing:       APK Signature Scheme v2 (external keystore, not in this repo)
Permissions:   INTERNET, POST_NOTIFICATIONS only · allowBackup=false
```

Install on an emulator/device: `adb install -r release/AmaratvKrishi-SalesCRM-v2.0.0.apk`

## Deployment

- **Web:** Vercel (project `crm`, scope `amaratv-krishi`) — deploys `main` automatically.
- **Backend:** Supabase project `lahvcodvgubplzfshare`; migrations are applied manually with explicit approval (additive-only policy in production).
- **Runbook:** [docs/project-knowledge/22_DEPLOYMENT_RUNBOOK.md](./docs/project-knowledge/22_DEPLOYMENT_RUNBOOK.md)

## Documentation

The authoritative knowledge base lives in [`docs/project-knowledge/`](./docs/project-knowledge/README.md) (23 numbered guides: architecture, roles, database, RLS security model, sync/realtime, Android, web, testing, environments, migrations, runbooks).

Key documents:

| Document | Purpose |
|---|---|
| [BUGFIX_RESULTS.md](./docs/BUGFIX_RESULTS.md) | Final end-to-end audit bugfix results (2026-08-23) |
| [FINAL_A_TO_Z_RELEASE_AUDIT.md](./docs/FINAL_A_TO_Z_RELEASE_AUDIT.md) | Final 30-section release audit + verdict |
| [GATES.md](./GATES.md) | Master acceptance gates (current verified state) |
| [project-knowledge/07_SUPABASE_SECURITY_MODEL.md](./docs/project-knowledge/07_SUPABASE_SECURITY_MODEL.md) | RLS & security model |
| [project-knowledge/08_SYNC_REALTIME_ARCHITECTURE.md](./docs/project-knowledge/08_SYNC_REALTIME_ARCHITECTURE.md) | Sync engine & realtime |
| [project-knowledge/22_DEPLOYMENT_RUNBOOK.md](./docs/project-knowledge/22_DEPLOYMENT_RUNBOOK.md) | Deploy & rollback procedures |
| [project-knowledge/23_LOCAL_DEV_SETUP.md](./docs/project-knowledge/23_LOCAL_DEV_SETUP.md) | Fresh-checkout setup |
| [RELEASE_NOTES.md](./release/RELEASE_NOTES.md) | Release changelog + artefact checksums |

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
docs/           Project knowledge base + audit reports
release/        Signed release APK + release notes
```

## License

© 2026 Amaratv Krishi India. All rights reserved. Proprietary — see [LICENSE](./LICENSE).
Built on open-source software; full attribution and license texts in
[THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md).
*From Our Fields to Your Home.*
