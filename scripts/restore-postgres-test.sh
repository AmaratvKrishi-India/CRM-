#!/usr/bin/env bash
set -euo pipefail

purpose="${CRM_DB_PURPOSE:-}"
case "$purpose" in
  development|testing) ;;
  *) printf 'Set CRM_DB_PURPOSE=development or testing; production targets are not supported.\n' >&2; exit 2 ;;
esac
[[ "${CRM_DB_DATA_CLASSIFICATION:-}" == synthetic ]] || { printf 'Restore is restricted to archives explicitly classified as synthetic test data.\n' >&2; exit 2; }
host="${PGHOST:-}"
port="${PGPORT:-}"
case "$host" in 127.0.0.1|localhost|::1) ;; *) printf 'Refusing restore: PGHOST must be loopback.\n' >&2; exit 3 ;; esac
[[ "$port" == 15433 ]] || { printf 'Refusing restore: PGPORT must be local Supabase port 15433.\n' >&2; exit 3; }
[[ "${CRM_RESTORE_DATABASE:-}" =~ ^crm_restore_test_[a-z0-9_]+$ ]] || { printf 'CRM_RESTORE_DATABASE must use the crm_restore_test_ prefix.\n' >&2; exit 2; }
[[ "$CRM_RESTORE_DATABASE" == "${PGDATABASE:-}" ]] || { printf 'PGDATABASE must equal CRM_RESTORE_DATABASE.\n' >&2; exit 2; }
[[ -z "${PGPASSWORD:-}" ]] || { printf 'Use a protected PGPASSFILE instead of PGPASSWORD.\n' >&2; exit 2; }
[[ -n "${PGPASSFILE:-}" && -f "$PGPASSFILE" && -r "$PGPASSFILE" ]] || { printf 'Set PGPASSFILE to a readable protected credential file.\n' >&2; exit 2; }
pass_mode="$(stat -c '%a' "$PGPASSFILE")"
(( (8#$pass_mode & 077) == 0 )) || { printf 'PGPASSFILE must have owner-only permissions (0600 or stricter).\n' >&2; exit 2; }
[[ -n "${CRM_BACKUP_PASSPHRASE_FILE:-}" && -f "$CRM_BACKUP_PASSPHRASE_FILE" && -r "$CRM_BACKUP_PASSPHRASE_FILE" ]] || { printf 'Set CRM_BACKUP_PASSPHRASE_FILE to a protected encryption-key file.\n' >&2; exit 2; }
key_mode="$(stat -c '%a' "$CRM_BACKUP_PASSPHRASE_FILE")"
(( (8#$key_mode & 077) == 0 )) || { printf 'Encryption-key file must have owner-only permissions (0600 or stricter).\n' >&2; exit 2; }

backup="${1:-}"
[[ -n "$backup" && -f "$backup" && "$backup" == *.dump.gpg ]] || { printf 'Pass one encrypted .dump.gpg backup file.\n' >&2; exit 2; }
command -v pg_restore >/dev/null || { printf 'pg_restore is not installed.\n' >&2; exit 127; }
command -v psql >/dev/null || { printf 'psql is not installed.\n' >&2; exit 127; }
command -v gpg >/dev/null || { printf 'gpg is not installed.\n' >&2; exit 127; }

tmp_dir="$(mktemp -d)"
chmod 700 "$tmp_dir"
trap 'rm -rf -- "$tmp_dir"' EXIT
plain="$tmp_dir/restore.dump"
gpg --batch --yes --pinentry-mode loopback --passphrase-file "$CRM_BACKUP_PASSPHRASE_FILE" --decrypt --output "$plain" "$backup" 2>/dev/null
pg_restore --list "$plain" >/dev/null

# Refuse any target containing application objects; this restore never uses
# --clean, DROP, or a supplied production URL.
psql -X --no-password --host="$host" --port="$port" --username="${PGUSER:?Set PGUSER}" --dbname="$CRM_RESTORE_DATABASE" \
  --set=ON_ERROR_STOP=1 --tuples-only --no-align \
  --command="SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p','v','m','S','f') AND n.nspname NOT IN ('pg_catalog','information_schema','pg_toast');" \
  > "$tmp_dir/object-count"
object_count="$(tr -d '[:space:]' < "$tmp_dir/object-count")"
[[ "$object_count" == 0 ]] || { printf 'Refusing restore: target database contains application objects. Use a new empty test database.\n' >&2; exit 5; }

pg_restore --exit-on-error --no-owner --no-privileges --host="$host" --port="$port" --username="$PGUSER" --dbname="$CRM_RESTORE_DATABASE" "$plain"
printf 'Restore completed into local test database %s. No existing objects were dropped.\n' "$CRM_RESTORE_DATABASE"
