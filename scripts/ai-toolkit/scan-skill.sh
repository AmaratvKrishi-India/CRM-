#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
toolkit_home="${AI_TOOLKIT_HOME:-$root/work/ai-toolkit}"
if [[ "$toolkit_home" != /* ]]; then toolkit_home="$root/$toolkit_home"; fi
scanner="$toolkit_home/venv/skillspector/bin/skillspector"

if [[ $# -lt 1 || $# -gt 2 ]]; then
  printf 'Usage: %s <skill-directory> [report.json]\n' "$0" >&2
  exit 2
fi
if [[ ! -x "$scanner" ]]; then
  printf 'SkillSpector is not installed. Run scripts/ai-toolkit/bootstrap.sh first.\n' >&2
  exit 1
fi

skill_dir="$(realpath "$1")"
case "$skill_dir/" in
  "$root/.agents/skills/"*|"$toolkit_home/samples/"*) ;;
  *)
    printf 'Refusing to scan outside repo-local skills or explicitly staged public skill samples. Do not scan CRM source.\n' >&2
    exit 2
    ;;
esac
if [[ ! -f "$skill_dir/SKILL.md" ]]; then
  printf 'Skill directory must contain SKILL.md: %s\n' "$skill_dir" >&2
  exit 2
fi

report="${2:-$toolkit_home/reports/$(basename "$skill_dir")-skillspector.json}"
mkdir -p "$(dirname "$report")"
"$scanner" scan "$skill_dir" --no-llm --format json --output "$report" --min-coverage 100 --fail-on-incomplete --fail-on-findings
printf 'Static report: %s\n' "$report"
