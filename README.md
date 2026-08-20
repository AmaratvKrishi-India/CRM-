# Amaratv Krishi Field Sales CRM (v2.0.0)

> **Enterprise Offline-First Field Sales CRM for Lucknow Nutrition & Fitness Outlets**  
> **Architecture**: Single Unified Android APK for both **ADMIN** and **AGENT** roles.  
> **Core Stack**: React 19 + Vite 8 + Tailwind CSS 4 + Capacitor 8 + Dexie.js v5 (IndexedDB) + Supabase (Auth, PostgreSQL, Realtime, Edge Functions).

---

## Key Invariants & Architectural Principles

1. **Single Unified Android APK**: Both ADMIN and AGENT roles share the same installed application and Supabase organisation. Role routing is enforced across UI, service layers, and Supabase Row Level Security (RLS).
2. **Offline-First Data Authority**: Local Dexie IndexedDB acts as the operational database. Field representatives can create leads, log calls, schedule follow-ups, and dispatch WhatsApp templates with zero network connectivity.
3. **Deterministic Synchronization**: Offline mutations persist to an atomic `outbox` queue and sync via Last-Write-Wins (LWW) and cursor-based pull reconciliation.
4. **Verified Talk-Time Integrity**: Native telephony integration uses `Intent.ACTION_DIAL`. Only calls verified via the native lifecycle state machine contribute to talk-time KPIs; fake durations are strictly impossible.
5. **Zero Client Secrets**: Privileged operations (e.g., agent provisioning) execute inside serverless Edge Functions using environment variables. The Supabase `service_role` key is never bundled in the APK or client web distribution.

---

## Role Matrix & Security Boundaries

| Capability | ADMIN | AGENT | Enforcement Layers |
|---|:---:|:---:|---|
| **Field Calling & Outcomes** | Yes | Yes | UI, Repository, Native Layer |
| **WhatsApp Templates & Catalogue** | Yes | Yes | UI, Native `FileProvider` |
| **Personal & Assigned Leads** | Yes (All Org Leads) | Yes (Assigned Only) | UI, Repository, RLS |
| **Field Lead Registration** | Yes | Yes (Auto-assigned) | UI, Repository, RLS |
| **Bulk Lead Assignment** | Yes | No | UI, Service (`assertAdmin`), RLS |
| **Lead Reassignment** | Yes | No | UI, Service (`assertAdmin`), RLS |
| **Central Data Management & Dedup** | Yes | No | UI, Service (`assertAdmin`) |
| **Excel Spreadsheet Ingestion** | Yes | No | UI, Service (`assertAdmin`), RLS |
| **Agent Provisioning & Deactivation** | Yes | No | UI, Service, Edge Function |
| **Executive Reports & Analytics** | Yes | No | UI, Service (`assertAdmin`) |
| **Local Backup & Snapshot Restore** | Yes | No | UI, Service (`assertAdmin`) |

---

## Project Structure

```text
calling-app/
├── android/                   # Capacitor Android native project (SDK 36, Scheme v2)
├── docs/                      # Comprehensive technical architecture & milestone documentation
├── release/                   # Signed production APK & release checksums
├── src/
│   ├── components/
│   │   ├── admin/             # Admin Shell, Agent Manager, Analytics, Reports, Bulk Assignment
│   │   ├── auth/              # Login, Session Resolution, Role Guards
│   │   ├── common/            # ErrorBoundary, UI primitives, modals
│   │   ├── dashboard/         # Executive & Sales KPIs, pipeline stage breakdowns
│   │   ├── followups/         # Follow-up scheduler & local notification reminders
│   │   ├── import/            # Excel file ingestion & field mapping
│   │   ├── leads/             # MinimalLeadsList, LeadDetail, CreateLeadModal
│   │   └── whatsapp/          # WhatsApp compose modal, template renderer
│   ├── context/               # AuthContext (Supabase Auth & Dexie profile state)
│   ├── db/
│   │   ├── database.ts        # Dexie v5 schema (12 indexed object stores)
│   │   ├── repositories/      # Repositories for all CRM entities
│   │   └── types.ts           # Entity models & interface definitions
│   ├── services/
│   │   ├── realtime/          # Supabase Realtime channel subscriptions
│   │   ├── sync/              # Outbox queue, push/pull workers, conflict resolver
│   │   ├── agentManagementService.ts
│   │   ├── authService.ts
│   │   ├── leadAssignmentService.ts
│   │   ├── nativePlatform.ts  # Dial, WhatsApp, Share, Notifications
│   │   └── supabaseClient.ts  # Singleton client (anon key only)
│   └── App.tsx                # App root, code-split lazy routes, back-button handler
├── supabase/
│   ├── functions/create-agent # Edge Function for secure agent provisioning
│   └── migrations/            # 5 PostgreSQL migrations (schema, RLS, indexes, realtime)
└── tests/                     # 30 Vitest suites (310 automated tests)
```

---

## Build & Test Instructions

### 1. Prerequisites
- Node.js 20+
- npm 10+
- Android Studio / Android SDK (for native builds)

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Quality Gates & Tests
```bash
# Run TypeScript compilation check
npx tsc --noEmit

# Run complete Vitest automated test suite (310 tests)
npm test

# Build production web bundle
npm run build

# Sync web assets and plugins to Android native project
npx cap sync android
```

---

## Release Verification Summary

- **Automated Tests**: **310 / 310 PASSING** (30 test suites)
- **TypeScript Check**: **0 Errors**
- **Production Web Bundle**: Built in 1.21s; `index.js` payload 210 KB (48 KB gzipped) with code-split lazy chunks
- **Android Signing**: Signed with APK Signature Scheme v2 (SHA-256: `36c88f9c0fedc1057a4385fd7d4d0469aaa58250c1268da3592797c921f4bba8`)
