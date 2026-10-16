#!/usr/bin/env python3
"""Read and update the repository's privacy-conscious Markdown project memory."""

from __future__ import annotations

import argparse
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MEMORY_FILE = ROOT / "docs" / "ai-toolkit" / "MEMORY.md"
SECTIONS = {"Project context", "Decisions", "Completed work", "Pending work", "Verification notes"}
SENSITIVE_PATTERNS = [
    re.compile(r"(?i)\b(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|password|secret|credential)\s*[:=]\s*\S+"),
    re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._~+/=-]{12,}"),
    re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16})\b"),
    re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
    re.compile(r"(?<!\w)\+?[0-9][0-9 ()-]{8,}[0-9](?!\w)"),
]


def read_memory() -> str:
    if not MEMORY_FILE.is_file():
        raise OSError(f"memory file is missing: {MEMORY_FILE}")
    return MEMORY_FILE.read_text(encoding="utf-8")


def append_memory(section: str, text: str) -> None:
    if section not in SECTIONS:
        raise ValueError(f"section must be one of: {', '.join(sorted(SECTIONS))}")
    if not text.strip() or "\n" in text or "\r" in text:
        raise ValueError("memory entry must be a non-empty single line")
    for pattern in SENSITIVE_PATTERNS:
        if pattern.search(text):
            raise ValueError("entry resembles a credential or personal contact detail; it was not saved")

    contents = read_memory()
    heading = f"## {section}\n"
    start = contents.find(heading)
    if start < 0:
        raise ValueError(f"section not found in memory file: {section}")
    body_start = start + len(heading)
    next_heading = contents.find("\n## ", body_start)
    end = len(contents) if next_heading < 0 else next_heading + 1
    entry = f"- {datetime.now(timezone.utc).date().isoformat()}: {text}\n"
    updated = contents[:end].rstrip("\n") + "\n" + entry + contents[end:]
    MEMORY_FILE.write_text(updated, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("show", help="print the full project memory")
    search = subparsers.add_parser("search", help="print memory lines matching a phrase")
    search.add_argument("query")
    append = subparsers.add_parser("append", help="add a dated, one-line memory entry")
    append.add_argument("--section", required=True)
    append.add_argument("--text", required=True)
    args = parser.parse_args()

    try:
        if args.command == "show":
            print(read_memory(), end="")
        elif args.command == "search":
            matches = [line for line in read_memory().splitlines() if args.query.casefold() in line.casefold()]
            if not matches:
                print("No matching memory entries.")
                return 1
            print("\n".join(matches))
        else:
            append_memory(args.section, args.text)
            print(f"Saved memory in {MEMORY_FILE.relative_to(ROOT)}")
    except (OSError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
