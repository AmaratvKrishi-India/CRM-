# 17 - AI AGENT OPERATING CONTEXT

This is a meta-document meant to guide future AI coding agents working on this project.

## Project Status & Constraints
- The project is FULLY_RELEASED (v2.0.0).
- Production is LIVE. The Supabase Cloud and Vercel environments hold production data and configurations.
- **DO NOT** execute destructive migrations on production.
- **DO NOT** disable Row Level Security (RLS) policies. Agent Lead Isolation is a P0 security requirement.
- **DO NOT** introduce non-offline-first features. Everything must write to Dexie first and sync via the outbox queue.

## Architectural Non-Negotiables
1. **Offline-First Mutability:** Components MUST NOT write directly to Supabase. Call `db.table.add/put` and `syncQueue.enqueue()`. The SyncEngine will handle cloud persistence.
2. **UUID Primary Keys:** All entities use UUID v4. Never use auto-incrementing integers.
3. **Compound Indexes:** Use Dexie compound indexes (e.g., `[organization_id+assigned_to]`) for fast local querying.
4. **Soft Deletes:** Records are marked `deleted_at`, never permanently deleted from local DB, allowing sync to propagate the deletion.
5. **No Secret Leaks:** Never commit `SERVICE_ROLE_KEY` or `keystore` passwords. Edge functions are the only place service role keys are permitted.

## Testing Standards
- **Unit/Integration:** Native Node.js test runner (`tsx --test`). Run via `npm test`. No Jest/Vitest.
- **E2E:** Playwright. Run via `npm run test:e2e`.
- **Pipeline:** Master verification script is [scripts/verify.ts](file:///c:/Users/PC/Desktop/calling%20app/scripts/verify.ts) (`npm run verify`). It enforces a 12-stage gating process. Do not commit code that fails this pipeline.

## Useful Entry Points for AI Analysis
- Database schema: [src/db/database.ts](file:///c:/Users/PC/Desktop/calling%20app/src/db/database.ts) & [src/db/types.ts](file:///c:/Users/PC/Desktop/calling%20app/src/db/types.ts)
- Sync logic: [src/services/sync/syncEngine.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/syncEngine.ts)
- Security logic: [supabase/migrations/20260820000006_rls_agent_lead_isolation.sql](file:///c:/Users/PC/Desktop/calling%20app/supabase/migrations/20260820000006_rls_agent_lead_isolation.sql)
- Entry points: [src/App.tsx](file:///c:/Users/PC/Desktop/calling%20app/src/App.tsx)

## Documentation Maintenance
- The [docs/project-knowledge/](file:///c:/Users/PC/Desktop/calling%20app/docs/project-knowledge) directory contains 19 exhaustive files.
- Whenever you add a new table, component, or configuration, you MUST update the corresponding documentation files (e.g., [06_DATABASE_REFERENCE.md](file:///c:/Users/PC/Desktop/calling%20app/docs/project-knowledge/06_DATABASE_REFERENCE.md), [15_CODEBASE_INDEX.md](file:///c:/Users/PC/Desktop/calling%20app/docs/project-knowledge/15_CODEBASE_INDEX.md)). Keep the documentation aligned with the source code.
