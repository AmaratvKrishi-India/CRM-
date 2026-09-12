# 19 — Environment Variables Reference

**Document status:** CURRENT
**Last reviewed:** 2026-09-10
**Source of truth:** `.env.example`, `src/services/supabaseClient.ts`, Vite mode loading, and staging guard tests

This document outlines the environment configuration files and their structures across the Amaratv Krishi Field Sales CRM.

## Environment Files

| File | Size | Purpose |
|------|------|---------|
| `.env` | 400 | Default fallback |
| `.env.local` | 323 | Local Docker Supabase |
| `.env.development` | 331 | Cloud dev/staging |
| `.env.staging` | machine-local | Isolated cloud staging only; it must not use the production project reference |
| `.env.production` | 400 | Production config |
| `.env.example` | 462 | Template for new developers |

> [!CAUTION]
> `.env.staging` must contain a different project reference from `.env.production`.
> `npm run verify:staging-config` checks this before a staging dev server or build
> starts. See [24 - Isolated Supabase Staging](./24_STAGING_ENVIRONMENT.md).

## Variable Names

The following environment variables are used in the client-side application:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous/public API key
- `VITE_APP_ENV` - Application environment (local/development/staging/production)
- `VITE_APP_VERSION` - Application version string

> [!IMPORTANT]
> `SUPABASE_SERVICE_ROLE_KEY` is ONLY used server-side in Edge Functions. It is NEVER to be exposed in client code or `.env` files meant for client usage.

## Security Rules

- **Git Ignored**: The `.gitignore` configuration explicitly excludes all `.env` files except `.env.example`.
- **Secret Scanning**: The `securitySecretScan.test.ts` file automatically verifies that no service role key is accidentally included in the `src/` or `dist/` directories.
- **Production Variables**: In Vercel, environment variables are set via the Vercel CLI/Dashboard and are not committed to source control.

## Loading priority (Vite 8)

For a mode such as `staging`, the installed Vite 8 loader reads files in this order and later definitions win: `.env` → `.env.local` → `.env.[mode]` → `.env.[mode].local`. Existing matching `VITE_*` values already present in the process environment override values loaded from these files.

That precedence is why the staging guard must validate the **resolved staging intent**, not assume `.env.staging` automatically beats every other source. Never put a service-role key or private credential in any Vite-visible environment source.

## The `.env.example` Template

The template used for onboarding new developers is located at [`.env.example`](../../.env.example):

```env
# Amaratv Krishi Field Sales CRM — Environment Configuration Template
# Copy this file to .env.local for local development or .env.staging for staging.
# NEVER place Supabase service-role keys, database passwords, or private signing keys in this file.

# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_public_anon_jwt_token_here

# Application Metadata
VITE_APP_ENV=development
VITE_APP_VERSION=2.0.0
```
