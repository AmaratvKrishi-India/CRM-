# Amaratv Krishi CRM: environment, storage, and backup setup

## Architecture and current status

- GitHub (`AmaratvKrishi-India/CRM-`) is the source of truth. Work for this initiative belongs on `development/crm-storage-backup`.
- The CRM uses Node.js 24, npm, Vite, TypeScript, Vitest, Node's test runner, Playwright, and Supabase migrations.
- Codex Cloud currently exposes an overlay filesystem rounded by `df -hT` to 32 GB (33.77 GB decimal, 31.45 GiB). Its writable-layer `df` usage is very small, while `du` sees read-only base-image content. Those values cannot be reconciled by deleting project files.
- Docker reports the `vfs` storage driver, four unused Supabase support images (about 615 MB), no containers, no volumes, and no build cache. `vfs` copies layers rather than sharing them copy-on-write. Pulling/unpacking the pinned Supabase PostgreSQL 17 image previously exhausted the quota. The daemon config does not set another storage driver, and the managed daemon is not configurable from this unprivileged checkout.
- No native `postgres`, `psql`, `pg_dump`, or `pg_restore` executable is available on PATH. The Supabase CLI 2.116.0 is already installed as a project dependency and can be invoked with `npx --no-install supabase`; it is not installed globally. The project migrations depend on Supabase schemas/services, `uuid-ossp`, and `pg_cron`; a SQLite substitute or a PostgreSQL WASM engine without those services is not a valid full integration test. Do not run the full image pull here unless the platform supplies a supported non-VFS driver or more ephemeral storage.
- `rclone` is installed, but this Codex execution environment has no rclone config or remote. Google Drive uploads are prepared but are not authenticated or tested against Google Drive yet.

## Lightweight development workflow

```bash
cd /workspace/CRM-
export XDG_CACHE_HOME=/workspace/.cache
export PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright
export SUPABASE_TELEMETRY_DISABLED=1
```

Use the existing `node_modules` when present. For a fresh environment, install from the lockfile into the existing package cache:

```bash
CYPRESS_INSTALL_BINARY=0 npm ci --prefer-offline --cache /workspace/.npm-cache
npm run typecheck
npm run test:type
npm run lint
npm run build:local-test
npm run test:perf:bundle
npm run test:vitest -- --exclude='tests/integration/**'
```

The last command runs unit-level Vitest tests only. The local Chromium onboarding configuration uses system Chromium and disables videos to avoid browser/ffmpeg downloads. Run browser tests with:

```bash
VITE_SUPABASE_URL=http://127.0.0.1:15432 \
VITE_SUPABASE_ANON_KEY=playwright-test-anon-key \
npm run dev -- --host 127.0.0.1 --port 4174 --strictPort

# In a second terminal, after the Vite server is ready:
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4174 \
npx --no-install playwright test --config local/onboarding.playwright.config.ts \
  auth.spec.ts crm-navigation.spec.ts --reporter=line
```

These credentials are mock-test values; this starts no backend. Do not print local preview URLs or real Supabase credentials. Full PostgreSQL/Supabase integration tests need the Supabase services and are not verified in this 32 GiB `vfs` environment. Existing CI runs the full stack on a GitHub-hosted runner; the Codex Cloud install script should not pull that stack.

## Storage tools

```bash
scripts/storage-audit.sh
docker system df -v
```

The audit is read-only and exits with a threshold alert at 85% by default (`scripts/storage-audit.sh --threshold=80`). `df` is the authority for filesystem quota; `du` reports visible merged-tree sizes and may include read-only lower image layers. Do not run `docker system prune`, `npm cache clean`, or remove platform/runtime files as a quota fix. Reproducible `node_modules` and caches can be recreated but currently support this checkout; their cleanup is not necessary while the writable overlay has ample free space. The measured breakdown is in [`docs/backup/STORAGE-AUDIT.md`](docs/backup/STORAGE-AUDIT.md).

The storage driver is set by the managed Docker-in-Docker platform, not by the project. The current daemon uses VFS and its config does not specify a replacement driver. Only platform-supported configuration can change it. VFS layer copying is the cause of the large transient extraction footprint; the CRM source tree and empty test database are not the root cause.

## Google Drive authorization and uploads

`scripts/google-drive-backup.sh` uses the configured rclone remote named `gdrive` by default. It creates the folder tree described in [`docs/backup/DRIVE-README.md`](docs/backup/DRIVE-README.md), uploads documents/source backups, and verifies every uploaded file by reading it back and comparing SHA-256. It never mounts Drive as a live filesystem.

The Codex environment was checked: `/home/agent/.rclone.conf` does not exist and `rclone listremotes` returns no remotes. No Google Drive connector is attached. Do not paste OAuth output, token JSON, passwords, or client secrets into chat or commit them.

For the prepared manual GitHub backup workflow, use an Android device with Termux:

1. Install Termux from its official source, then run `pkg update` and `pkg install rclone coreutils`.
2. Run `rclone config`, create a remote named `gdrive` of type `drive`, choose the narrowest usable `drive.file` scope, and complete Google's browser authorization. Keep the generated config private on the device.
3. Encode the config locally without sending it to chat: `base64 -w 0 ~/.config/rclone/rclone.conf`. In GitHub Settings → Environments, open `crm-drive-backups`, restrict deployment branches to `development/crm-storage-backup`, and add the output directly as an environment secret named `RCLONE_CONFIG_B64`. Do not add it as a normal variable, repository file, or chat message.
4. After the workflow is merged to the default branch, from GitHub on Android open Actions → “Manual CRM source backup” → Run workflow on `development/crm-storage-backup`. Check that the run is within your existing free Actions allowance before starting it; do not run if it would incur a charge. The workflow first performs a temporary Drive read/write check, then uploads the commit archive, manifest, checksum, folder README, storage audit, and this setup guide.

The workflow has no schedule. GitHub only offers `workflow_dispatch` for workflows present on the repository's default branch. This branch keeps `main` unchanged, so the workflow is prepared in the PR and cannot be launched until the user merges it to the default branch; its job is restricted to `development/crm-storage-backup`. Configure daily/weekly/monthly schedules only after a manual run verifies the OAuth secret persists and a successful read/write cycle is confirmed. Retention is manual; no old backup is deleted.

To use Drive from an environment with an already configured rclone remote:

```bash
CRM_GDRIVE_REMOTE=gdrive scripts/google-drive-backup.sh verify
CRM_GDRIVE_REMOTE=gdrive CRM_SOURCE_BACKUP_CATEGORY=Weekly scripts/google-drive-backup.sh source HEAD
```

## Source backup format

`scripts/backup-source.sh [COMMIT] [OUTPUT_DIR]` only archives a commit that is present on `origin/<branch>`. Archives are complete snapshots; GitHub keeps the incremental history. The manifest records repository, branch, commit, commit time, creation time, byte count, and SHA-256. `.gitignore` excludes backup output. The archive excludes generated dependencies, caches, build outputs, and test results, and refuses tracked environment/private-key/credential files. It does not include uncommitted work.

## PostgreSQL backup and restore

The scripts support only a local development/testing Supabase database at loopback port `15433`. Production export and restore are rejected, and the scripts require an explicit `CRM_DB_DATA_CLASSIFICATION=synthetic` attestation before they export, restore, or upload data. They require `PGPASSFILE` with owner-only permissions and a protected `CRM_BACKUP_PASSPHRASE_FILE`; they never accept `PGPASSWORD`. The dump is encrypted with GPG AES-256, decrypted into a private temporary directory for equality and `pg_restore --list` checks, and the plaintext temporary files are removed when the script exits. Upload only `.dump.gpg` files and their manifest/checksum sidecars.

```bash
CRM_DB_PURPOSE=testing CRM_DB_DATA_CLASSIFICATION=synthetic \
PGHOST=127.0.0.1 PGPORT=15433 PGDATABASE=postgres PGUSER=postgres \
PGPASSFILE=/path/to/protected/pgpass \
CRM_BACKUP_PASSPHRASE_FILE=/path/to/protected/backup-passphrase \
scripts/backup-postgres.sh
```

For restore testing, create a new empty database named with the `crm_restore_test_` prefix on the local test instance, then set `CRM_RESTORE_DATABASE` and `PGDATABASE` to that same name and run:

```bash
CRM_DB_PURPOSE=testing CRM_DB_DATA_CLASSIFICATION=synthetic CRM_RESTORE_DATABASE=crm_restore_test_YYYYMMDD \
PGHOST=127.0.0.1 PGPORT=15433 PGDATABASE=crm_restore_test_YYYYMMDD PGUSER=postgres \
PGPASSFILE=/path/to/protected/pgpass \
CRM_BACKUP_PASSPHRASE_FILE=/path/to/protected/backup-passphrase \
scripts/restore-postgres-test.sh /path/to/encrypted.dump.gpg
```

Restore never uses `--clean` or drops objects and refuses non-empty targets. Use only disposable local test databases. A full restore test has not run because this environment has no PostgreSQL client/server and cannot safely unpack the Supabase PostgreSQL image under VFS.

## Recovery and retention

For source, compare the manifest SHA-256 with the archive, then extract into a new directory and check out its recorded commit. GitHub remains the authoritative repository. For database recovery, first copy the encrypted archive to a private local test environment, verify its SHA-256, decrypt with the separately held passphrase, inspect with `pg_restore --list`, and restore to a newly created disposable local database. Never restore to production without a separate approval and recovery plan.

Keep daily source archives for 14 days, weekly archives for 12 weeks, and monthly archives for 12 months as a proposed policy. These are recommendations only; the current tooling does not automatically delete any backup. Keep encrypted database backups according to the data owner's approved retention requirements.

## Current limitations

- Google Drive auth is not configured, and no Drive upload has been claimed or tested. A one-time GitHub Actions secret setup and manual workflow run are required.
- The Codex Cloud overlay currently has roughly 30 GiB free by `df`; visible lower-layer files cannot be attributed to writable usage. The previous quota failure happened during PostgreSQL image unpacking, due to VFS amplification.
- Changing Docker's storage driver requires platform support; the project cannot safely change the managed daemon.
- Full Supabase/PostgreSQL migration/integration and restore tests are blocked in this environment. CI or a supported native PostgreSQL/Supabase test service is required.
- Android toolchains and Android release builds are not part of the lightweight Codex setup.
