#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
toolkit_home="${AI_TOOLKIT_HOME:-$root/work/ai-toolkit}"
if [[ "$toolkit_home" != /* ]]; then toolkit_home="$root/$toolkit_home"; fi
scanner="$toolkit_home/venv/skillspector/bin/skillspector"
reports="$toolkit_home/reports"

"$root/scripts/ai-toolkit/check-storage.sh"
if [[ ! -x "$scanner" ]]; then
  printf 'SkillSpector is not installed. Run scripts/ai-toolkit/bootstrap.sh first.\n' >&2
  exit 1
fi
version="$("$scanner" --version)"
[[ "$version" == "SkillSpector v2.12.0" ]] || { printf 'Unexpected scanner version: %s\n' "$version" >&2; exit 1; }

python3 - "$root" <<'PY'
from pathlib import Path
import sys

root = Path(sys.argv[1])
skills = sorted((root / ".agents" / "skills").glob("*/SKILL.md"))
if len(skills) != 5:
    raise SystemExit(f"Expected 5 repo-local skills, found {len(skills)}")
for skill in skills:
    text = skill.read_text(encoding="utf-8")
    if not text.startswith("---\n") or "\nname:" not in text or "\ndescription:" not in text:
        raise SystemExit(f"Invalid Codex skill frontmatter: {skill.relative_to(root)}")
print(f"Validated {len(skills)} Codex skill definitions")
PY

python3 "$root/scripts/ai-toolkit/plan.py" validate "$root/docs/ai-toolkit/plans/sample-development-plan.json"
python3 "$root/scripts/ai-toolkit/memory.py" search "memory retrieval smoke test" >/dev/null

mkdir -p "$reports"
sample_report="$reports/skillspector-smoke.json"
"$scanner" scan "$root/scripts/ai-toolkit/fixtures/safe-sample" --no-llm --format json --output "$sample_report" --min-coverage 100 --fail-on-incomplete
python3 - "$sample_report" <<'PY'
import json
import sys

report = json.load(open(sys.argv[1], encoding="utf-8"))
assessment = report.get("risk_assessment", {})
coverage = report.get("analysis_completeness", {})
assert report.get("execution_successful") is True
assert coverage.get("is_complete") is True
assert assessment.get("recommendation") == "SAFE"
assert not report.get("issues")
print("SkillSpector smoke test passed: complete scan, 0 findings, SAFE recommendation")
PY
