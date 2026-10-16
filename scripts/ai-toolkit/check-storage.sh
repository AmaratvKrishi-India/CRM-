#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
min_free_gb="${AI_TOOLKIT_MIN_FREE_GB:-2}"
warn_percent="${AI_TOOLKIT_STORAGE_WARN_PERCENT:-85}"

if [[ ! "$min_free_gb" =~ ^[1-9][0-9]*$ || ! "$warn_percent" =~ ^[0-9]{1,3}$ ]] || (( warn_percent < 1 || warn_percent > 100 )); then
  printf 'Invalid storage thresholds. Set AI_TOOLKIT_MIN_FREE_GB (integer >= 1) and AI_TOOLKIT_STORAGE_WARN_PERCENT (1..100).\n' >&2
  exit 2
fi

read -r available_kb use_percent < <(df -Pk "$root" | awk 'NR == 2 { gsub("%", "", $5); print $4, $5 }')
available_gb=$((available_kb / 1024 / 1024))
printf 'Workspace: %s\nAvailable: %s GiB\nUsed: %s%%\n' "$root" "$available_gb" "$use_percent"

if (( available_kb < min_free_gb * 1024 * 1024 )); then
  printf 'ERROR: less than %s GiB remains; skipping installation or container startup.\n' "$min_free_gb" >&2
  exit 1
fi
if (( use_percent >= warn_percent )); then
  printf 'WARNING: filesystem usage is at or above %s%%.\n' "$warn_percent" >&2
fi

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  driver="$(docker info --format '{{.Driver}}' 2>/dev/null || true)"
  printf 'Docker storage driver: %s\n' "${driver:-unknown}"
  if [[ "$driver" == vfs ]]; then
    printf 'VFS is active. This script will not alter Docker; avoid pulling the Supabase PostgreSQL image in this workspace.\n'
  fi
else
  printf 'Docker daemon unavailable.\n'
fi
