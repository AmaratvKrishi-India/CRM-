# Isolated Supabase staging environment

**Document status:** CURRENT
**Last reviewed:** 2026-09-10
**Production reference:** `lahvcodvgubplzfshare`
**Rule:** staging must use a different project reference

## Current status

Production is the Supabase project with reference `lahvcodvgubplzfshare` and URL `https://lahvcodvgubplzfshare.supabase.co`. It must never be used as staging.

Recent 2026-09-09 verification evidence used the isolated staging reference `dhoinifpzijqyobcamlv`. Treat that reference as evidence context, not permanent authorization: re-verify project identity, health, schema, credentials, and environment-file precedence before every staging run. If `.env.staging` points to production or an unknown project, `npm run dev:staging` and `npm run build:staging` must fail closed.

When an operator creates or selects the new project, record only its non-secret name, reference, URL and dashboard path here. Do not add database passwords, access tokens, JWT secrets, service-role keys or anon-key values to this document.

## Safe configuration workflow

1. In Supabase, create or select an isolated project named `Amaratv Krishi CRM — Staging`. Confirm its project reference differs from `lahvcodvgubplzfshare` before any database action.
2. Put the new project URL, its public anon key and `VITE_APP_ENV=staging` in the ignored local `.env.staging` file. Keep production values only in `.env.production`.
3. Run `npm run verify:staging-config`. It rejects missing values, placeholders, a production reference, and a service-role key in the Vite environment file.
4. Link the Supabase CLI to the staging reference immediately before staging-only cloud operations; confirm the linked reference again. Never use `db push`, `db reset`, seed, or destructive SQL against production.
5. Run `npx supabase db push` only after the link is confirmed as staging. The ordered SQL in `supabase/migrations/` is the schema source of truth. Do not copy production customer data; use the synthetic local seed or fresh staging data.
6. Deploy `create-agent` to the same verified staging project, then set its server-side secrets in that project's dashboard only. Do not place them in a Vite environment file.

## Required staging verification evidence

- Staging reference differs from production; URL and CLI link show the staging reference.
- Auth users/sessions are created in staging only.
- Migrations succeed and RLS checks use staging-only synthetic identities.
- The `supabase_realtime` publication and a two-client event test work in staging.
- `create-agent` is deployed and responds from the staging project URL.
- Staging test data, Edge Function calls and Realtime subscriptions cannot alter production because their project references and credentials are distinct.

## F045 operational reporting policy

Collector: sanitized operational error records in the application-owned Supabase/Postgres reporting path; it is separate from business/audit events.

Owner: Project Engineering / Technical Admin. Readers: engineering and explicitly authorized technical administrators only. Retention: 90 days, with a verified deletion/expiry process. Store only timestamps, build/platform, operation and a fixed error category. Never store passwords, access tokens, service-role keys, JWT secrets, headers, session IDs, raw request/response data, customer PII, lead data, backup data or arbitrary exception messages. Redact before persistence and enforce the existing RLS/access-control rules.

The repository now contains the operational-error collector implementation (Migration 11 plus `operationalReportingService.ts`), but repository presence alone does not prove live staging deployment. Do not claim the collector is deployed until that exact staging project has been reverified for schema/application of Migration 11, authorization, retention cleanup, redaction/allowlist behavior, and end-to-end ingestion.
