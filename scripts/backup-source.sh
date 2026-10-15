#!/usr/bin/env bash
set -euo pipefail
umask 077

repo_root="$(git rev-parse --show-toplevel)"
ref="${1:-HEAD}"
dest_dir="${2:-${CRM_BACKUP_DIR:-$repo_root/backup-artifacts}}"
commit="$(git -C "$repo_root" rev-parse --verify "${ref}^{commit}")"
short_sha="${commit:0:12}"
branch="${CRM_SOURCE_BRANCH:-$(git -C "$repo_root" branch --show-current)}"
branch="${branch:-detached}"
branch_slug="$(printf '%s' "$branch" | tr '/ ' '--' | tr -cd '[:alnum:]_.-')"
category="${CRM_SOURCE_BACKUP_CATEGORY:-Weekly}"

case "$category" in
  Daily|Weekly|Monthly) ;;
  *) printf 'Unsupported source backup category. Use Daily, Weekly, or Monthly.\n' >&2; exit 2 ;;
esac

# A source archive is only produced from a commit already present on the
# matching origin branch. This prevents unpushed or ambiguous working copies
# from being presented as verified backups.
remote_ref="refs/remotes/origin/$branch"
if ! git -C "$repo_root" show-ref --verify --quiet "$remote_ref"; then
  git -C "$repo_root" fetch --quiet --no-tags origin "$branch" || {
    printf 'Unable to verify origin/%s; no archive was created.\n' "$branch" >&2
    exit 3
  }
  remote_ref=FETCH_HEAD
fi
if ! git -C "$repo_root" merge-base --is-ancestor "$commit" "$remote_ref"; then
  printf 'Refusing to archive: commit is not verified on origin/%s. Push it first.\n' "$branch" >&2
  exit 3
fi

# Reject tracked credentials/private keys and generated dependency/build trees.
mapfile -d '' tracked_paths < <(git -C "$repo_root" ls-tree -rz --name-only "$commit")
for path in "${tracked_paths[@]}"; do
  base="${path##*/}"
  lower="$(printf '%s' "$path" | tr '[:upper:]' '[:lower:]')"
  base_lower="$(printf '%s' "$base" | tr '[:upper:]' '[:lower:]')"
  case "$base_lower" in
    .env|.env.*)
      case "$base_lower" in .env.example|.env.sample|.env.template) ;; *) printf 'Refusing to archive: tracked environment file detected.\n' >&2; exit 4 ;; esac
      ;;
    *.pem|*.p12|*.pfx|*.key|*.p8|*.asc|id_rsa*|id_ed25519*|.rclone.conf|rclone.conf|*.rclone.conf|*service-account*.json|*credentials*.json|client_secret*.json|token.json|*.dump|*.dump.gpg|*.sql.gz|*.sqlite|*.sqlite3|*.db)
      printf 'Refusing to archive: tracked credential or private-key file detected.\n' >&2; exit 4 ;;
  esac
  case "/$lower/" in
    */node_modules/*|*/.cache/*|*/.npm/*|*/dist/*|*/coverage/*|*/test-results/*|*/playwright-report/*|*/.supabase/*|*/backup-artifacts/*|*/android/build/*|*/android/*/build/*|*/.gradle/*)
      printf 'Refusing to archive: tracked generated dependency/cache/build output detected.\n' >&2; exit 4 ;;
  esac
done

timestamp="$(date -u +'%Y%m%dT%H%M%SZ')"
name="crm-source_${branch_slug}_${timestamp}_${short_sha}_$$"
mkdir -p "$dest_dir"
dest_dir="$(cd "$dest_dir" && pwd)"
archive="$dest_dir/${name}.tar.gz"
manifest="$dest_dir/${name}.manifest.json"
checksum="$dest_dir/${name}.sha256"
tmp_archive="$(mktemp "$dest_dir/.source-archive.XXXXXX")"
tmp_manifest="$(mktemp "$dest_dir/.source-manifest.XXXXXX")"
tmp_checksum="$(mktemp "$dest_dir/.source-checksum.XXXXXX")"
cleanup() { rm -f -- "$tmp_archive" "$tmp_manifest" "$tmp_checksum"; }
trap cleanup EXIT

git -C "$repo_root" archive --format=tar --prefix="Amaratv-Krishi-CRM_${branch_slug}_${short_sha}/" "$commit" -- . \
  ':(exclude,glob)node_modules/**' ':(exclude,glob)**/node_modules/**' \
  ':(exclude,glob).cache/**' ':(exclude,glob)**/.cache/**' \
  ':(exclude,glob).npm/**' ':(exclude,glob)**/.npm/**' \
  ':(exclude,glob)dist/**' ':(exclude,glob)**/dist/**' \
  ':(exclude,glob)coverage/**' ':(exclude,glob)**/coverage/**' \
  ':(exclude,glob)test-results/**' ':(exclude,glob)**/test-results/**' \
  ':(exclude,glob)playwright-report/**' ':(exclude,glob)**/playwright-report/**' \
  ':(exclude,glob).supabase/**' ':(exclude,glob)**/.supabase/**' \
  ':(exclude,glob)backup-artifacts/**' ':(exclude,glob)**/backup-artifacts/**' \
  ':(exclude,glob)android/build/**' ':(exclude,glob)android/**/build/**' ':(exclude,glob)**/.gradle/**' \
  | gzip -n -6 > "$tmp_archive"

archive_bytes="$(stat -c '%s' "$tmp_archive")"
archive_sha="$(sha256sum "$tmp_archive" | awk '{print $1}')"
commit_time="$(git -C "$repo_root" show -s --format=%cI "$commit")"
export CRM_ARCHIVE_NAME="$(basename "$archive")" CRM_ARCHIVE_BYTES="$archive_bytes" CRM_ARCHIVE_SHA="$archive_sha"
export CRM_BRANCH="$branch" CRM_COMMIT="$commit" CRM_COMMIT_TIME="$commit_time" CRM_CREATED_AT="$timestamp"
python3 - "$tmp_manifest" <<'PY'
import json, os, sys
record = {
    "schema_version": 1,
    "repository": "AmaratvKrishi-India/CRM-",
    "branch": os.environ["CRM_BRANCH"],
    "commit": os.environ["CRM_COMMIT"],
    "commit_time": os.environ["CRM_COMMIT_TIME"],
    "created_at_utc": os.environ["CRM_CREATED_AT"],
    "archive": os.environ["CRM_ARCHIVE_NAME"],
    "archive_bytes": int(os.environ["CRM_ARCHIVE_BYTES"]),
    "sha256": os.environ["CRM_ARCHIVE_SHA"],
    "includes_worktree_changes": False,
    "includes_generated_dependencies": False,
}
with open(sys.argv[1], "w", encoding="utf-8") as f:
    json.dump(record, f, indent=2)
    f.write("\n")
PY
printf '%s  %s\n' "$archive_sha" "$(basename "$archive")" > "$tmp_checksum"
mv -- "$tmp_archive" "$archive"
mv -- "$tmp_manifest" "$manifest"
mv -- "$tmp_checksum" "$checksum"
trap - EXIT
printf '%s\n%s\n%s\n' "$archive" "$manifest" "$checksum"
