#!/usr/bin/env bash
set -uo pipefail

# Read-only inventory. This script never removes files or prunes Docker data.
threshold="${CRM_STORAGE_ALERT_PERCENT:-85}"
if [[ "${1:-}" =~ ^--threshold=([0-9]{1,3})$ ]]; then threshold="${BASH_REMATCH[1]}"; fi
if [[ ! "$threshold" =~ ^[0-9]{1,3}$ ]] || (( threshold < 1 || threshold > 100 )); then
  printf 'Usage: %s [--threshold=1..100] (or CRM_STORAGE_ALERT_PERCENT=1..100)\n' "$0" >&2
  exit 2
fi

printf 'Storage audit (UTC): %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
usage_percent="$(df -P / | awk 'NR==2 {gsub("%", "", $5); print $5}')"
if [[ "$usage_percent" =~ ^[0-9]+$ ]] && (( usage_percent >= threshold )); then
  printf 'ALERT: root filesystem usage is %s%% (threshold %s%%).\n' "$usage_percent" "$threshold"
else
  printf 'Root filesystem usage is %s%% (alert threshold %s%%).\n' "${usage_percent:-unknown}" "$threshold"
fi
printf '\n== Filesystem capacity and type ==\n'
df -hT
printf '\n== Filesystem inode capacity ==\n'
df -i

printf '\n== Top-level visible usage on / (same filesystem only) ==\n'
du -xhd1 / 2>&1 || true

printf '\n== Major paths (one level deep; inaccessible paths are reported) ==\n'
for path in /workspace /home /root /tmp /var /usr /opt /etc /run; do
  if [[ -d "$path" ]]; then
    printf '\n-- %s --\n' "$path"
    du -xhd1 "$path" 2>&1 || true
  fi
done

printf '\n== 30 largest visible directories (bytes; nested entries overlap) ==\n'
du -x -B1 -a / 2>/dev/null | sort -rn -k1,1 | python3 -c '
import os, sys
count = 0
for line in sys.stdin:
    size, path = line.rstrip("\n").split("\t", 1)
    if count < 30 and os.path.isdir(path):
        print(f"{int(size):12d}\t{path}")
        count += 1
'

printf '\n== 30 largest visible files (bytes; sensitive names redacted) ==\n'
{
  find / -xdev -type f -printf '%s\t%p\n' 2>/dev/null
  for path in /tmp /run; do
    [[ -d "$path" ]] && find "$path" -xdev -type f -printf '%s\t%p\n' 2>/dev/null
  done
} | awk -F '\t' 'BEGIN{OFS="\t"} {p=$2; b=tolower(p); if (b ~ /(^|\/)(\.env($|\.)|[^/]*(secret|credential|token|private.key)[^/]*|[^/]*\.(pem|p12|pfx|key))($|\/)/) p="[sensitive path redacted]"; print $1,p}' \
  | sort -rn -k1,1 | sed -n '1,30p' | awk -F '\t' '{printf "%12s\t%s\n",$1,$2}'

printf '\n== Docker inventory (metadata only; no prune) ==\n'
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  docker info --format 'Storage driver={{.Driver}}; data root={{.DockerRootDir}}'
  docker system df -v
else
  printf 'Docker daemon unavailable.\n'
fi

printf '\n== Common development caches ==\n'
for path in \
  /workspace/CRM-/node_modules \
  /workspace/CRM-/dist \
  /workspace/CRM-/test-results \
  /workspace/CRM-/supabase/.temp \
  /workspace/.npm-cache \
  /workspace/.cache \
  /home/agent/.npm \
  /home/agent/.cache \
  /home/agent/.supabase \
  /home/agent/.rclone.conf \
  /root/.npm \
  /root/.cache \
  /var/lib/docker; do
  if [[ -e "$path" ]]; then du -sh "$path" 2>&1 || true; fi
done

printf '\nNotes: du measures the visible merged tree and may not match writable overlay usage.\n'
printf 'Docker VFS data may be hidden behind daemon permissions; docker system df is authoritative for Docker objects.\n'
if [[ "$usage_percent" =~ ^[0-9]+$ ]] && (( usage_percent >= threshold )); then exit 1; fi
