#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
remote="${CRM_GDRIVE_REMOTE:-gdrive}"
if [[ ! "$remote" =~ ^[A-Za-z0-9_-]+$ ]]; then
  printf 'CRM_GDRIVE_REMOTE must be a configured rclone remote name, without a colon.\n' >&2
  exit 2
fi
command -v rclone >/dev/null || { printf 'rclone is not installed.\n' >&2; exit 127; }
configured_remotes="$(rclone listremotes 2>/dev/null || true)"
if ! printf '%s\n' "$configured_remotes" | grep -Fxq "${remote}:"; then
  printf 'rclone remote "%s" is not configured. Configure and authorize it before uploads.\n' "$remote" >&2
  exit 3
fi
if [[ "${CRM_GDRIVE_SKIP_ABOUT:-0}" != 1 ]]; then
  rclone about "${remote}:" >/dev/null || { printf 'Configured remote is not readable as Google Drive; no upload was attempted.\n' >&2; exit 3; }
fi
root="${remote}:Amaratv-Krishi-CRM"

folders=(
  '01-Source-Backups/Daily' '01-Source-Backups/Weekly' '01-Source-Backups/Monthly'
  '02-Database-Backups/Development' '02-Database-Backups/Testing' '02-Database-Backups/Production-Approved-Only'
  '03-Codex-Reports/Storage-Audits' '03-Codex-Reports/Environment-Reports' '03-Codex-Reports/Error-Reports' '03-Codex-Reports/Optimization-Reports'
  '04-Testing/Frontend' '04-Testing/Backend' '04-Testing/Database' '04-Testing/Integration'
  '05-Builds/Web' '05-Builds/Android' '05-Builds/Releases'
  '06-Documentation/Architecture' '06-Documentation/Database-Schema' '06-Documentation/API' '06-Documentation/Setup-Guides' '06-Documentation/Recovery-Guides'
  '07-Debugging/Screenshots' '07-Debugging/Sanitized-Logs' '07-Debugging/Error-Analysis'
  '08-Development-Assets/Test-Datasets' '08-Development-Assets/Design-Assets'
  '09-VoIP-Integration/Research' '09-VoIP-Integration/Architecture' '09-VoIP-Integration/Testing' '09-VoIP-Integration/Reports'
  '10-Master-Reports/Backup-Status' '10-Master-Reports/Storage-Summary' '10-Master-Reports/Development-Progress'
)

sha256_file() { sha256sum "$1" | awk '{print $1}'; }
sha256_remote() { rclone cat "$1" | sha256sum | awk '{print $1}'; }
verify_upload() {
  local source="$1" destination="$2" expected actual
  expected="$(sha256_file "$source")"
  rclone copyto "$source" "$destination"
  actual="$(sha256_remote "$destination")"
  [[ "$expected" == "$actual" ]] || { printf 'Remote checksum verification failed for %s.\n' "$(basename "$source")" >&2; return 5; }
}

ensure_structure() {
  rclone mkdir "$root"
  for folder in "${folders[@]}"; do rclone mkdir "$root/$folder"; done
  rclone lsf --dirs-only "$root" >/dev/null
  verify_upload "$repo_root/docs/backup/DRIVE-README.md" "$root/README.md"
  verify_upload "$repo_root/MASTER-SETUP.md" "$root/06-Documentation/Setup-Guides/MASTER-SETUP.md"
  verify_upload "$repo_root/docs/backup/STORAGE-AUDIT.md" "$root/03-Codex-Reports/Storage-Audits/STORAGE-AUDIT.md"
}

case "${1:-}" in
  init)
    ensure_structure
    printf 'Drive folder structure and setup documentation uploaded and checksum-verified.\n'
    ;;
  verify)
    rclone mkdir "$root"
    token="$(date -u +'%Y%m%dT%H%M%SZ')_$$"
    local_file="$(mktemp)"
    remote_file="$root/.codex-drive-verify-${token}.txt"
    trap 'rm -f -- "$local_file"' EXIT
    printf 'Amaratv Krishi CRM harmless Drive verification\ncreated_at_utc=%s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" > "$local_file"
    verify_upload "$local_file" "$remote_file"
    rclone deletefile "$remote_file"
    printf 'Google Drive read/write and byte-integrity check passed; the temporary test file was removed.\n'
    ;;
  source)
    ensure_structure
    category="${CRM_SOURCE_BACKUP_CATEGORY:-Weekly}"
    case "$category" in Daily|Weekly|Monthly) ;; *) printf 'Unsupported source category.\n' >&2; exit 2 ;; esac
    output="$(CRM_BACKUP_DIR="${CRM_BACKUP_DIR:-$repo_root/backup-artifacts}" "$repo_root/scripts/backup-source.sh" "${2:-HEAD}" "${CRM_BACKUP_DIR:-$repo_root/backup-artifacts}")"
    mapfile -t files <<< "$output"
    dest="$root/01-Source-Backups/$category"
    for file in "${files[@]}"; do verify_upload "$file" "$dest/$(basename "$file")"; done
    printf 'Source archive, manifest, and checksum uploaded and verified: %s\n' "$(basename "${files[0]}")"
    ;;
  database)
    ensure_structure
    purpose="${CRM_DB_PURPOSE:-}"
    case "$purpose" in development|testing) ;; *) printf 'CRM_DB_PURPOSE must be development or testing; production upload is unsupported.\n' >&2; exit 2 ;; esac
    [[ "${CRM_DB_DATA_CLASSIFICATION:-}" == synthetic ]] || { printf 'Only synthetic development/test data may be uploaded.\n' >&2; exit 2; }
    encrypted="${2:-}"
    [[ -n "$encrypted" && -f "$encrypted" && "$encrypted" == *.dump.gpg ]] || { printf 'Pass one encrypted .dump.gpg file.\n' >&2; exit 2; }
    dest="$root/02-Database-Backups/$([[ "$purpose" == development ]] && printf Development || printf Testing)"
    verify_upload "$encrypted" "$dest/$(basename "$encrypted")"
    for sidecar in "${encrypted%.dump.gpg}.manifest.json" "${encrypted%.dump.gpg}.sha256"; do
      [[ -f "$sidecar" ]] && verify_upload "$sidecar" "$dest/$(basename "$sidecar")"
    done
    printf 'Encrypted %s database backup uploaded and checksum-verified.\n' "$purpose"
    ;;
  report)
    ensure_structure
    category="${2:-}"
    file="${3:-}"
    case "$category" in
      Storage-Audits|Environment-Reports|Error-Reports|Optimization-Reports|Frontend|Backend|Database|Integration|Web|Android|Releases|Architecture|Database-Schema|API|Setup-Guides|Recovery-Guides|Screenshots|Sanitized-Logs|Error-Analysis|Test-Datasets|Design-Assets|Research|Backup-Status|Storage-Summary|Development-Progress) ;;
      *) printf 'Use a leaf folder name from DRIVE-README.md.\n' >&2; exit 2 ;;
    esac
    [[ -f "$file" ]] || { printf 'Report/artifact file not found.\n' >&2; exit 2; }
    case "${file,,}" in *.dump|*.sql|*.csv|*.xlsx|*.sqlite|*.db|*.env|*.pem|*.key) printf 'Refusing potentially sensitive/unprotected artifact.\n' >&2; exit 3 ;; esac
    destination=""
    for folder in "${folders[@]}"; do
      [[ "${folder##*/}" == "$category" ]] && { destination="$root/$folder"; break; }
    done
    [[ -n "$destination" ]] || { printf 'No mapped Drive destination for that category.\n' >&2; exit 2; }
    verify_upload "$file" "$destination/$(basename "$file")"
    printf 'Artifact uploaded and checksum-verified to %s.\n' "${destination#*:}"
    ;;
  *)
    printf 'Usage: %s {init|verify|source [COMMIT]|database ENCRYPTED.dump.gpg|report LEAF_FOLDER FILE}\n' "$0" >&2
    exit 2
    ;;
esac
