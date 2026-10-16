#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
toolkit_home="${AI_TOOLKIT_HOME:-$root/work/ai-toolkit}"
if [[ "$toolkit_home" != /* ]]; then toolkit_home="$root/$toolkit_home"; fi
toolkit_home="$(mkdir -p "$toolkit_home" && cd "$toolkit_home" && pwd)"
source_dir="$toolkit_home/upstream/skillspector"
venv_dir="$toolkit_home/venv/skillspector"
skillspector_commit="e8850a88c02dfc53cf8abead1ff753d35b5ba853"
skillspector_repo="https://github.com/NVIDIA/SkillSpector.git"

"$root/scripts/ai-toolkit/check-storage.sh"
for command_name in git python3 uv; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'Required command is unavailable: %s\n' "$command_name" >&2
    exit 1
  fi
done

mkdir -p "$(dirname "$source_dir")"
if [[ ! -d "$source_dir/.git" ]]; then
  git clone --filter=blob:none --no-checkout "$skillspector_repo" "$source_dir"
else
  configured_remote="$(git -C "$source_dir" remote get-url origin 2>/dev/null || true)"
  if [[ "$configured_remote" != "$skillspector_repo" ]]; then
    printf 'Refusing to use unexpected SkillSpector checkout: %s\n' "$configured_remote" >&2
    exit 1
  fi
fi

git -C "$source_dir" fetch --depth=1 origin "$skillspector_commit"
git -C "$source_dir" checkout --detach "$skillspector_commit"
actual_commit="$(git -C "$source_dir" rev-parse HEAD)"
if [[ "$actual_commit" != "$skillspector_commit" ]]; then
  printf 'SkillSpector commit mismatch: expected %s, received %s\n' "$skillspector_commit" "$actual_commit" >&2
  exit 1
fi

export UV_PROJECT_ENVIRONMENT="$venv_dir"
export UV_CACHE_DIR="$toolkit_home/cache/uv"
uv sync --locked --no-dev --project "$source_dir"
"$venv_dir/bin/skillspector" --version
printf 'Installed SkillSpector %s in %s\n' "$skillspector_commit" "$venv_dir"
