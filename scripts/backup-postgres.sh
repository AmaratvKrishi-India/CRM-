#!/usr/bin/env bash
set -euo pipefail
umask 077

purpose="${CRM_DB_PURPOSE:-}"
case "$purpose" in
  development|testing) ;;
  *) printf 'Set CRM_DB_PURPOSE=development or testing; production exports are not supported.\n' >&2; exit 2 ;;
esac
[[ "${CRM_DB_DATA_CLASSIFICATION:-}" == synthetic ]] || { printf 'Only synthetic development/test data may be archived; set CRM_DB_DATA_CLASSIFICATION=synthetic after checking the database.\n' >&2; exit 2; }

host="${PGHOST:-}"
port="${PGPORT:-}"
case "$host" in 127.0.0.1|localhost|::1) ;; *) printf 'Refusing database export: PGHOST must be loopback.\n' >&2; exit 3 ;; esac
[[ "$port" == 15433 ]] || { printf 'Refusing database export: PGPORT must be local Supabase port 15433.\n' >&2; exit 3; }
[[ -n "${PGDATABASE:-}" && -n "${PGUSER:-}" ]] || { printf 'Set PGDATABASE and PGUSER.\n' >&2; exit 2; }
[[ -z "${PGPASSWORD:-}" ]] || { printf 'Use a protected PGPASSFILE instead of PGPASSWORD.\n' >&2; exit 2; }
[[ -n "${PGPASSFILE:-}" && -f "$PGPASSFILE" && -r "$PGPASSFILE" ]] || { printf 'Set PGPASSFILE to a readable protected credential file.\n' >&2; exit 2; }
pass_mode="$(stat -c '%a' "$PGPASSFILE")"
(( (8#$pass_mode & 077) == 0 )) || { printf 'PGPASSFILE must have owner-only permissions (0600 or stricter).\n' >&2; exit 2; }
[[ -n "${CRM_BACKUP_PASSPHRASE_FILE:-}" && -f "$CRM_BACKUP_PASSPHRASE_FILE" && -r "$CRM_BACKUP_PASSPHRASE_FILE" ]] || { printf 'Set CRM_BACKUP_PASSPHRASE_FILE to a protected encryption-key file.\n' >&2; exit 2; }
key_mode="$(stat -c '%a' "$CRM_BACKUP_PASSPHRASE_FILE")"
(( (8#$key_mode & 077) == 0 )) || { printf 'Encryption-key file must have owner-only permissions (0600 or stricter).\n' >&2; exit 2; }

command -v pg_dump >/dev/null || { printf 'pg_dump is not installed.\n' >&2; exit 127; }
command -v pg_restore >/dev/null || { printf 'pg_restore is not installed.\n' >&2; exit 127; }
command -v gpg >/dev/null || { printf 'gpg is not installed.\n' >&2; exit 127; }

dest_dir="${CRM_BACKUP_DIR:-$(git rev-parse --show-toplevel)/backup-artifacts}"
mkdir -p "$dest_dir"
dest_dir="$(cd "$dest_dir" && pwd)"
timestamp="$(date -u +'%Y%m%dT%H%M%SZ')"
base="crm-postgres_${purpose}_${timestamp}_$$"
encrypted="$dest_dir/${base}.dump.gpg"
manifest="$dest_dir/${base}.manifest.json"
checksum="$dest_dir/${base}.sha256"
tmp_dir="$(mktemp -d)"
chmod 700 "$tmp_dir"
cleanup() { rm -rf -- "$tmp_dir"; }
trap cleanup EXIT

plain="$tmp_dir/database.dump"
verify_plain="$tmp_dir/verify.dump"
pg_dump --format=custom --no-owner --no-acl --host="$host" --port="$port" --username="$PGUSER" --dbname="$PGDATABASE" --no-password --file="$plain"
pg_restore --list "$plain" >/dev/null
gpg --batch --yes --pinentry-mode loopback --passphrase-file "$CRM_BACKUP_PASSPHRASE_FILE" --cipher-algo AES256 --symmetric --output "$encrypted" "$plain"
gpg --batch --yes --pinentry-mode loopback --passphrase-file "$CRM_BACKUP_PASSPHRASE_FILE" --decrypt --output "$verify_plain" "$encrypted" 2>/dev/null
cmp -s "$plain" "$verify_plain" || { printf 'Encrypted backup did not match its plaintext source.\n' >&2; exit 5; }
pg_restore --list "$verify_plain" >/dev/null

file_bytes="$(stat -c '%s' "$encrypted")"
file_sha="$(sha256sum "$encrypted" | awk '{print $1}')"
export CRM_DB_BACKUP_NAME="$(basename "$encrypted")" CRM_DB_BACKUP_BYTES="$file_bytes" CRM_DB_BACKUP_SHA="$file_sha"
export CRM_DB_BACKUP_PURPOSE="$purpose" CRM_DB_BACKUP_CREATED="$timestamp" CRM_DB_BACKUP_NAME_ONLY="$PGDATABASE" CRM_DB_BACKUP_CLASSIFICATION="$CRM_DB_DATA_CLASSIFICATION"
python3 - "$manifest" <<'PY'
import json, os, sys
record = {
    "schema_version": 1,
    "purpose": os.environ["CRM_DB_BACKUP_PURPOSE"],
    "data_classification": os.environ["CRM_DB_BACKUP_CLASSIFICATION"],
    "created_at_utc": os.environ["CRM_DB_BACKUP_CREATED"],
    "database_name": os.environ["CRM_DB_BACKUP_NAME_ONLY"],
    "format": "pg_dump custom archive encrypted with GPG AES-256",
    "archive": os.environ["CRM_DB_BACKUP_NAME"],
    "archive_bytes": int(os.environ["CRM_DB_BACKUP_BYTES"]),
    "sha256": os.environ["CRM_DB_BACKUP_SHA"],
    "restore_verification": "GPG decrypt equality and pg_restore --list passed",
}
with open(sys.argv[1], "w", encoding="utf-8") as f:
    json.dump(record, f, indent=2)
    f.write("\n")
PY
printf '%s  %s\n' "$file_sha" "$(basename "$encrypted")" > "$checksum"
printf '%s\n%s\n%s\n' "$encrypted" "$manifest" "$checksum"
