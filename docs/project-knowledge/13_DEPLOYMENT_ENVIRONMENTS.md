# 13 — Deployment Environments

**Document status:** CURRENT
**Last reviewed:** 2026-09-10
**Source of truth:** `.env.example`, `vite.config.ts`, `vercel.json`, `supabase/config.toml`, `supabase/migrations/`, and [24_STAGING_ENVIRONMENT.md](./24_STAGING_ENVIRONMENT.md)

## Environment matrix

| Environment | Client configuration | Backend rule | Use |
|---|---|---|---|
| Local | `.env.local` / local Vite mode | Dockerized Supabase on loopback | development and disposable integration tests |
| Development | `.env.development` | only an explicitly verified non-production target | development when needed |
| Staging | ignored `.env.staging` | isolated Supabase project with a different reference | release candidate and external verification |
| Production | Vercel-managed variables / `.env.production` | protected Supabase project `lahvcodvgubplzfshare` | live users and data |

The staging guard rejects missing values, placeholders, production references, and service-role keys. Do not use the production project as staging.

## Client variables

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_ENV`
- `VITE_APP_VERSION`

Only the public anon key belongs in Vite client configuration. `SUPABASE_SERVICE_ROLE_KEY`, database passwords, access tokens, JWT secrets, and signing credentials remain server- or machine-local.

## Local stack

`supabase/config.toml` defines the local project and ports. Start it with:

```powershell
npx supabase start
npx supabase migration up --local
```

`npx supabase db reset --local` is destructive to local data and must be used only for a disposable stack.

## Web deployment

The web target is Vercel project `crm` in the `amaratv-krishi` scope at <https://crm-blush-omega.vercel.app>. Build locally with `npm run build`; verify the exact candidate before any production deployment. Environment variables are managed through Vercel, not committed files.

## Android deployment

Build the web bundle, sync Capacitor, and build the intended Android variant. Release signing uses an external `keystore.properties` file that must not enter the repository. The current workspace does not contain the release keystore; the published v2.0.0 APK is historical evidence.

## Database deployment

Apply the 14 ordered migrations from `supabase/migrations/` only after:

1. local disposable validation;
2. verified staging project identity and schema checks;
3. explicit target confirmation;
4. review of backup, rollback, RLS, and migration-ledger consequences.

See [14_MIGRATION_HISTORY.md](./14_MIGRATION_HISTORY.md), [22_DEPLOYMENT_RUNBOOK.md](./22_DEPLOYMENT_RUNBOOK.md), and [GATES.md](../../GATES.md).
