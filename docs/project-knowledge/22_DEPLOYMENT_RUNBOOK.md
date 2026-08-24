# 22 - DEPLOYMENT RUNBOOK

Step-by-step procedures for deploying the web app to Vercel, shipping database migrations to Supabase Cloud, deploying the edge function, and building the release APK.

> [!CAUTION]
> Production is LIVE with real data. Never run destructive migrations, never disable RLS, and never put service-role keys or keystore secrets into client env files or docs. The GitHub repo is PRIVATE.

## Prerequisites (check first)

See [20 - Toolchain & CLI Status](./20_TOOLCHAIN_CLI_STATUS.md). Minimum for any deploy:

1. `node_modules` present (`npm install` if missing).
2. `vercel whoami` returns `amaratvkrishi-india`.
3. `npx supabase projects list` shows `lahvcodvgubplzfshare` ACTIVE_HEALTHY.
4. For APK builds only: `JAVA_HOME` set to Android Studio JBR, `ANDROID_HOME` set, signing file [keystore.properties](file:///C:/Users/PC/Documents/AmaratvKrishi-Keys/keystore.properties) present.

## Web Deploy (Vercel)

Current live project: `crm` in scope `amaratv-krishi`, production URL `https://crm-blush-omega.vercel.app`.

```powershell
# 1. Sanity: build must pass locally first
npm run build

# 2. Preview deploy (optional but recommended)
vercel

# 3. Production deploy
vercel --prod

# 4. Verify
# open https://crm-blush-omega.vercel.app and log in as admin
```

Notes:
- [.vercelignore](file:///c:/Users/PC/Desktop/calling%20app/.vercelignore) excludes `android/` and `node_modules/` from uploads.
- Vercel env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_ENV`, `VITE_APP_VERSION`) are managed in the Vercel dashboard/CLI, not in committed files.
- The old project `divinity-thethirdeye/amaratv-krishi-crm` is orphaned; do not deploy to it (see [21 - Account & Identity Map](./21_ACCOUNT_IDENTITY_MAP.md)).

## Database Migrations (Supabase Cloud)

All 6 migrations are already applied to cloud (see [14 - Migration History](./14_MIGRATION_HISTORY.md)). For a NEW migration:

```powershell
# 1. Link the repo to the cloud project (one-time; already linked as of 2026-08-23)
npx supabase link --project-ref lahvcodvgubplzfshare

# 2. Create the migration file
npx supabase migration new <name>
# edit supabase/migrations/<timestamp>_<name>.sql

# 3. Test locally first
npx supabase db reset   # applies all migrations + seed.sql to local Docker stack
npm test              # must stay green

# 4. Push to cloud
npx supabase db push

# 5. Re-verify cloud schema parity
npx tsx scripts/probeCloudSchema.ts
```

> [!WARNING]
> Migration rules: additive changes only in production; no `DROP` of tables/columns holding data; always keep RLS enabled on every table; keep `SET search_path = public` on trigger functions.

## Edge Function Deploy

The only function is `create-agent` ([supabase/functions/create-agent/index.ts](file:///c:/Users/PC/Desktop/calling%20app/supabase/functions/create-agent/index.ts)).

```powershell
npx supabase link --project-ref lahvcodvgubplzfshare
npx supabase functions deploy create-agent
# confirm secrets are set in the dashboard: SUPABASE_SERVICE_ROLE_KEY (server-side only)
```

## Android APK Release

```powershell
# 1. Web bundle
npm run build

# 2. Sync into the Android project
npx cap sync android

# 3. Release build (needs JAVA_HOME + ANDROID_HOME, see doc 20)
cd android; .\gradlew assembleRelease; cd ..

# 4. Copy the artifact to the release folder with the versioned name
Copy-Item android\app\build\outputs\apk\release\app-release.apk `
  release\AmaratvKrishi-SalesCRM-v<version>.apk
```

Current shipped artifact: [release/AmaratvKrishi-SalesCRM-v2.0.0.apk](file:///c:/Users/PC/Desktop/calling%20app/release/AmaratvKrishi-SalesCRM-v2.0.0.apk) (6.9 MB / 7,268,429 bytes).

## Git / GitHub

```powershell
git status            # review before committing
npm run verify        # full pipeline must pass before a release commit
git add -A; git commit -m "<message>"
git push origin main  # pushes as AmaratvKrishi-India
```

Repo: `AmaratvKrishi-India/CRM-` (PRIVATE — verified via `gh repo view` on 2026-08-22). Local `main` is 1 commit ahead of `origin/main` with a clean working tree as of 2026-08-22; the push is a manual release step.

## Rollback

- **Web:** `vercel rollback` (or select a previous deployment in the Vercel dashboard).
- **Database:** restore from a Supabase PITR/backup in the dashboard, or write a compensating migration. Never drop-and-recreate production tables.
- **APK:** keep every versioned APK in `release/`; redistribute the previous file.

## Related Documents

- [13 - Deployment & Environments](./13_DEPLOYMENT_ENVIRONMENTS.md)
- [19 - Environment Variables](./19_ENVIRONMENT_VARIABLES.md)
- [12 - Testing & Verification](./12_TESTING_VERIFICATION.md)
