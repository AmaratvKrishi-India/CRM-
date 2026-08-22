# 19 - ENVIRONMENT VARIABLES REFERENCE

This document outlines the environment configuration files and their structures across the Amaratv Krishi Field Sales CRM.

## Environment Files

| File | Size | Purpose |
|------|------|---------|
| `.env` | 400 | Default fallback |
| `.env.local` | 323 | Local Docker Supabase |
| `.env.development` | 331 | Cloud dev/staging |
| `.env.staging` | 123 | Staging config |
| `.env.production` | 400 | Production config |
| `.env.example` | 462 | Template for new developers |

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

## Loading Priority (Vite)

Vite uses the following hierarchy for loading environment variables:
1. `.env.local` (highest priority)
2. `.env.[mode]` (e.g., `.env.development`, `.env.production`, etc.)
3. `.env` (lowest priority)

## The `.env.example` Template

The template used for onboarding new developers is located at [c:\Users\PC\Desktop\calling app\.env.example](file:///c:/Users/PC/Desktop/calling%20app/.env.example):

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
