#!/usr/bin/env python3
"""Validate and summarize small Git-tracked development plans."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

STATUSES = {"pending", "in_progress", "completed", "blocked"}


def load_plan(path: Path) -> dict[str, Any]:
    try:
        plan = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"cannot read JSON plan: {error}") from error
    if not isinstance(plan, dict) or not isinstance(plan.get("milestone"), str):
        raise ValueError("plan must be an object with a milestone string")
    phases = plan.get("phases")
    if not isinstance(phases, list) or not phases:
        raise ValueError("plan must contain at least one phase")
    return plan


def validate(plan: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    phase_ids: set[str] = set()
    tasks: dict[str, dict[str, Any]] = {}

    for phase_index, phase in enumerate(plan["phases"]):
        if not isinstance(phase, dict):
            errors.append(f"phase {phase_index + 1} must be an object")
            continue
        phase_id = phase.get("id")
        if not isinstance(phase_id, str) or not phase_id:
            errors.append(f"phase {phase_index + 1} needs a non-empty id")
        elif phase_id in phase_ids:
            errors.append(f"duplicate phase id: {phase_id}")
        else:
            phase_ids.add(phase_id)
        phase_tasks = phase.get("tasks")
        if not isinstance(phase_tasks, list) or not phase_tasks:
            errors.append(f"phase {phase_id or phase_index + 1} needs tasks")
            continue
        for task_index, task in enumerate(phase_tasks):
            label = f"phase {phase_id or phase_index + 1}, task {task_index + 1}"
            if not isinstance(task, dict):
                errors.append(f"{label} must be an object")
                continue
            task_id = task.get("id")
            if not isinstance(task_id, str) or not task_id:
                errors.append(f"{label} needs a non-empty id")
                continue
            if task_id in tasks:
                errors.append(f"duplicate task id: {task_id}")
                continue
            if not isinstance(task.get("title"), str) or not task["title"].strip():
                errors.append(f"task {task_id} needs a title")
            status = task.get("status")
            if status not in STATUSES:
                errors.append(f"task {task_id} has unsupported status {status!r}")
            dependencies = task.get("depends_on", [])
            if not isinstance(dependencies, list) or any(not isinstance(item, str) for item in dependencies):
                errors.append(f"task {task_id} depends_on must be a list of task ids")
                dependencies = []
            tasks[task_id] = {**task, "depends_on": dependencies}

    for task_id, task in tasks.items():
        for dependency_id in task["depends_on"]:
            dependency = tasks.get(dependency_id)
            if dependency is None:
                errors.append(f"task {task_id} references unknown dependency {dependency_id}")
            elif dependency_id == task_id:
                errors.append(f"task {task_id} cannot depend on itself")
            elif task.get("status") == "completed" and dependency.get("status") != "completed":
                errors.append(f"completed task {task_id} has incomplete dependency {dependency_id}")

    return errors


def all_tasks(plan: dict[str, Any]) -> list[dict[str, Any]]:
    return [task for phase in plan["phases"] if isinstance(phase, dict) for task in phase.get("tasks", []) if isinstance(task, dict)]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    for command in ("validate", "report"):
        sub = subparsers.add_parser(command)
        sub.add_argument("plan", type=Path)
    args = parser.parse_args()

    try:
        plan = load_plan(args.plan)
    except ValueError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2
    errors = validate(plan)
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    tasks = all_tasks(plan)
    counts = {status: sum(task.get("status") == status for task in tasks) for status in sorted(STATUSES)}
    if args.command == "validate":
        print(f"VALID: {plan['milestone']} ({len(plan['phases'])} phases, {len(tasks)} tasks)")
        return 0
    print(f"Milestone: {plan['milestone']}")
    print(f"Tasks: {len(tasks)} total; {counts['completed']} completed; {counts['pending']} pending; {counts['in_progress']} in progress; {counts['blocked']} blocked")
    for phase in plan["phases"]:
        phase_tasks = phase["tasks"]
        phase_done = sum(task.get("status") == "completed" for task in phase_tasks)
        print(f"- {phase['id']}: {phase_done}/{len(phase_tasks)} completed")
        for task in phase_tasks:
            deps = ", ".join(task.get("depends_on", [])) or "none"
            print(f"  [{task['status']}] {task['id']}: {task['title']} (depends on: {deps})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
