# Amaratv Krishi CRM — Technical Documentation Hub

> **Project Target**: Single Android APK for both ADMIN and AGENT users.  
> **Core Stack**: React 19 + Vite 8 + Tailwind CSS 4 + Capacitor 8 + Dexie.js (IndexedDB) + Supabase (Auth, PostgreSQL, Realtime, Edge Functions).  
> **Verified State**: 286 / 286 Automated Tests Passing • Physical Android Handset 10/10 Passing (`vivo V2319`, Android 16) • Signed Release APK Verified (Scheme v2).

---

## Master Documentation Directory

All system architecture, design specifications, security audits, and milestone verification records are centralized within this `docs/` folder:

| # | Document | Scope & Description |
|:---:|---|---|
| 1 | [`PHASE_2_STATUS.md`](./PHASE_2_STATUS.md) | **Milestone Progress Tracker**: Comprehensive status checklist for Phases 2A through 2N. |
| 2 | [`PHASE_2_PRODUCTION_READINESS.md`](./PHASE_2_PRODUCTION_READINESS.md) | **Production Readiness & Gate Assessment**: Definitive release gate review and status. |
| 3 | [`PHASE_2_FINAL_SECURITY_AUDIT.md`](./PHASE_2_FINAL_SECURITY_AUDIT.md) | **Final Security Audit**: Secret leakage checks, Android permission audit, and role guards. |
| 4 | [`PHASE_2_MULTI_USER_QA.md`](./PHASE_2_MULTI_USER_QA.md) | **Multi-User QA & Sync**: Shared lead lifecycle, LWW conflict matrix, and offline-first queue. |
| 5 | [`PHASE_2_ARCHITECTURE.md`](./PHASE_2_ARCHITECTURE.md) | **Core Multi-Tenant Architecture**: Design principles, single-APK architecture, offline-first Dexie layer. |
| 6 | [`AUTHENTICATION_ARCHITECTURE.md`](./AUTHENTICATION_ARCHITECTURE.md) | **Auth & Session Foundation (2C)**: Supabase Auth integration, session tokens, biometric/offline fallback. |
| 7 | [`ADMIN_AGENT_MANAGEMENT.md`](./ADMIN_AGENT_MANAGEMENT.md) | **Admin Agent Console (2D)**: Representative creation, status toggles, credential reset, UI role guard. |
| 8 | [`CENTRAL_DATABASE_ARCHITECTURE.md`](./CENTRAL_DATABASE_ARCHITECTURE.md) | **Cloud DB & RLS (2E)**: PostgreSQL schema, organization isolation, and row-level security policies. |
| 9 | [`OFFLINE_SYNC_ARCHITECTURE.md`](./OFFLINE_SYNC_ARCHITECTURE.md) | **Bidirectional Sync Engine (2F)**: Outbox queue, push/pull workers, cursor tracking, and conflict resolution. |
| 10 | [`PHASE_2G_SUPABASE_VERIFICATION.md`](./PHASE_2G_SUPABASE_VERIFICATION.md) | **Live Connectivity Report (2G)**: Verification against remote Supabase project and table structures. |
| 11 | [`SECURE_AGENT_PROVISIONING.md`](./SECURE_AGENT_PROVISIONING.md) | **Edge Function Provisioning (2H)**: Admin-only `create-agent` edge function with service-role security. |
| 12 | [`SHARED_LEAD_OPERATIONS.md`](./SHARED_LEAD_OPERATIONS.md) | **Collaborative Leads (2I)**: Shared visibility, multi-agent assignment, reassignment, and timeline audit logs. |
| 13 | [`CALL_DURATION_ARCHITECTURE.md`](./CALL_DURATION_ARCHITECTURE.md) | **Verified Call Duration (2J)**: Native call lifecycle state machine and strict zero-fake talk time invariant. |
| 14 | [`REALTIME_ARCHITECTURE.md`](./REALTIME_ARCHITECTURE.md) | **Realtime WebSockets (2K)**: Organization-scoped channel subscriptions, non-destructive Dexie ingest, and live ticker. |
| 15 | [`ADMIN_DASHBOARD_ARCHITECTURE.md`](./ADMIN_DASHBOARD_ARCHITECTURE.md) | **Admin CRM Dashboard (2L)**: Executive KPI cards, 8-stage pipeline visualizer, and agent scorecards. |
| 16 | [`ANALYTICS_REPORTS_ARCHITECTURE.md`](./ANALYTICS_REPORTS_ARCHITECTURE.md) | **Analytics & Reports Suite (2M)**: 7-category reporting engine, multi-dimension filters, and sanitized CSV exports. |
| 17 | [`RELEASE_NOTES.md`](./RELEASE_NOTES.md) | **Release Changelog**: Production build, APK signing, and feature version history. |

---

## Architectural Guarantees & Invariants
1. **Single Android APK**: ADMIN and AGENT use the exact same installed app. Role-based navigation is enforced at UI, Service, and RLS database layers.
2. **Offline-First Authority**: Local Dexie IndexedDB is always the primary operational data store. Cloud disconnections never prevent field sales operations.
3. **Zero Fake Talk Time**: Only calls confirmed with `verificationStatus === 'VERIFIED'` contribute to talk-time analytics.
4. **Zero Client Secrets**: The Supabase `service_role` key is strictly kept in secure serverless Edge Functions and never embedded in the Android APK.
