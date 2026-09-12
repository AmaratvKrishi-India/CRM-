# 22 — Deployment Runbook

**Document status:** CURRENT
**Last reviewed:** 2026-09-10
**Release authority:** [GATES.md](../../GATES.md) and [16_CURRENT_STATE.md](./16_CURRENT_STATE.md)

Production contains real data. This runbook is a controlled procedure, not authorization to deploy.

## Preflight

1. Confirm the branch, HEAD, working tree, candidate build, and intended environment.
2. Read [GATES.md](../../GATES.md); do not deploy a candidate marked pending or blocked.
3. Verify Node/npm, Docker, Supabase CLI, Vercel account, Android SDK/JDK, and signing prerequisites as applicable.
4. Run `npm run verify:staging-config` for staging. Confirm the staging reference differs from `lahvcodvgubplzfshare`.
5. Ensure no secrets, customer exports, temporary logs, or signing material are in the candidate.

## Web deployment

```powershell
npm ci
npm run typecheck
npm run lint
npm run build
vercel
vercel --prod
```

Use the Vercel project `crm` in the `amaratv-krishi` scope. Verify the deployed URL, login, asset loading, CSP, and Supabase connectivity after deployment. Record the deployment ID and smoke results in a dated report.

## Database migrations

The checkout contains 14 ordered migrations. Before any cloud operation:

1. start a disposable local Supabase stack;
2. apply and test the complete ordered migration set locally;
3. create or select a dedicated isolated staging project;
4. confirm the CLI link and project reference;
5. apply migrations to staging only;
6. run RLS, sync, Realtime, Edge Function, and rollback/cleanup checks;
7. obtain explicit production approval and re-confirm the production reference;
8. apply only the reviewed migration set and record the migration ledger.

Never run `db reset`, seed, destructive SQL, or an unverified `db push` against production.

## Edge Function deployment

Deploy `supabase/functions/create-agent/` only to the verified target project. Set service-role and function secrets in the Supabase project settings, never in Vite environment files. Exercise authentication, admin authorization, validation, rate/abuse controls, conflict behavior, and compensation when the profile insert fails.

## Android release

```powershell
npm run build
npx cap sync android
cd android
.\gradlew assembleRelease
```

Verify package identity, version, manifest permissions, `allowBackup=false`, WebView policy, APK signature, checksum, install, launch, login, sync, offline recovery, and relevant Maestro scenarios. The release keystore must be supplied through the approved external path; it must never be copied into the repository.

## Rollback and incident handling

- Web: use the Vercel deployment history and verify the rollback target before restoring it.
- Database: stop, preserve evidence, and follow the migration-specific rollback/forward-fix procedure; do not improvise a production reset.
- Android: distribute the previously verified signed artifact only if its compatibility and release approval are still valid.
- Sync/data incident: preserve mutation IDs, server revisions, outbox state, and sanitized logs; follow [DELETION_AND_RECOVERY_POLICY.md](./DELETION_AND_RECOVERY_POLICY.md).

## Required record

Every deployment report must contain candidate identity, target identity, commands, migration ledger, artifact digest, test results, smoke results, operator/approval, and rollback point. Link it from [16_CURRENT_STATE.md](./16_CURRENT_STATE.md) and update [GATES.md](../../GATES.md).
