#!/usr/bin/env python3
"""Validate a JSON task plan: structure, dependencies, cycles, parallel waves, coverage.

Usage:
    python3 scripts/check_plan.py plan.json [--json]

Exit codes: 0 = valid (warnings allowed), 1 = errors found, 2 = usage / unreadable input.
Standard library only (Python 3.8+). See assets/plan-template.md for the format.
"""
from __future__ import annotations

import json
import sys
from typing import Any, Dict, List, Set

VALID_KINDS = {"discover", "act", "check"}
MAX_REASONABLE_TASKS = 15


def load(path: str) -> Dict[str, Any]:
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except FileNotFoundError:
        fail_usage(f"File not found: {path}")
    except json.JSONDecodeError as exc:
        fail_usage(f"Invalid JSON in {path}: line {exc.lineno} col {exc.colno}: {exc.msg}")
    if not isinstance(data, dict):
        fail_usage("Top level must be a JSON object with 'objective', 'success_criteria', 'tasks'.")
    return data


def fail_usage(msg: str) -> None:
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(2)


def find_cycle(graph: Dict[str, List[str]]) -> List[str]:
    """Return one dependency cycle as a list of ids, or [] if acyclic."""
    WHITE, GREY, BLACK = 0, 1, 2
    color = {n: WHITE for n in graph}
    stack: List[str] = []

    def visit(node: str) -> List[str]:
        color[node] = GREY
        stack.append(node)
        for dep in graph.get(node, []):
            if dep not in color:
                continue
            if color[dep] == GREY:
                return stack[stack.index(dep):] + [dep]
            if color[dep] == WHITE:
                found = visit(dep)
                if found:
                    return found
        stack.pop()
        color[node] = BLACK
        return []

    for n in graph:
        if color[n] == WHITE:
            cyc = visit(n)
            if cyc:
                return cyc
    return []


def waves(graph: Dict[str, List[str]]) -> List[List[str]]:
    """Kahn-style layering: tasks in the same wave have all dependencies in earlier waves."""
    remaining = {n: set(d for d in deps if d in graph) for n, deps in graph.items()}
    done: Set[str] = set()
    result: List[List[str]] = []
    while remaining:
        ready = sorted(n for n, deps in remaining.items() if deps <= done)
        if not ready:
            break  # cycle; reported separately
        result.append(ready)
        done.update(ready)
        for n in ready:
            del remaining[n]
    return result


def check(plan: Dict[str, Any]) -> Dict[str, Any]:
    errors: List[str] = []
    warnings: List[str] = []

    objective = plan.get("objective")
    if not isinstance(objective, str) or not objective.strip():
        errors.append("Missing 'objective' (one sentence describing the outcome).")

    criteria = plan.get("success_criteria", [])
    if not isinstance(criteria, list) or not criteria:
        warnings.append("No 'success_criteria'. Validation will have nothing concrete to check against.")
        criteria = []
    criteria_ids = {str(c).split(":", 1)[0].strip() for c in criteria if isinstance(c, str) and ":" in c}

    tasks = plan.get("tasks")
    if not isinstance(tasks, list) or not tasks:
        errors.append("Missing or empty 'tasks' list.")
        return {"errors": errors, "warnings": warnings, "waves": []}

    graph: Dict[str, List[str]] = {}
    by_id: Dict[str, Dict[str, Any]] = {}
    for i, t in enumerate(tasks):
        where = f"tasks[{i}]"
        if not isinstance(t, dict):
            errors.append(f"{where}: must be an object.")
            continue
        tid = t.get("id")
        if not isinstance(tid, str) or not tid.strip():
            errors.append(f"{where}: missing 'id'.")
            continue
        if tid in by_id:
            errors.append(f"Duplicate task id '{tid}'.")
            continue
        if not str(t.get("task", "")).strip():
            errors.append(f"{tid}: missing 'task' description.")
        deps = t.get("depends_on", [])
        if not isinstance(deps, list) or not all(isinstance(d, str) for d in deps):
            errors.append(f"{tid}: 'depends_on' must be a list of task ids.")
            deps = []
        if tid in deps:
            errors.append(f"{tid}: depends on itself.")
        kind = t.get("kind")
        if kind is not None and kind not in VALID_KINDS:
            errors.append(f"{tid}: kind '{kind}' must be one of {sorted(VALID_KINDS)}.")
        if not str(t.get("check", "")).strip():
            warnings.append(f"{tid}: no 'check'. How will you know it succeeded?")
        if not str(t.get("produces", "")).strip() and kind != "check":
            warnings.append(f"{tid}: no 'produces'. Name the output the next task consumes.")
        if t.get("irreversible") and not any(
            t2.get("checkpoint") for t2 in tasks if isinstance(t2, dict) and t2.get("id") in deps
        ) and not t.get("checkpoint"):
            warnings.append(f"{tid}: irreversible but no checkpoint on it or its dependencies. Add a user-approval checkpoint.")
        for c in t.get("criteria", []) or []:
            if criteria_ids and c not in criteria_ids:
                warnings.append(f"{tid}: references unknown success criterion '{c}'.")
        graph[tid] = deps
        by_id[tid] = t

    for tid, deps in graph.items():
        for d in deps:
            if d not in graph:
                errors.append(f"{tid}: depends on unknown task '{d}'.")

    cycle = find_cycle(graph)
    if cycle:
        errors.append("Dependency cycle: " + " -> ".join(cycle))

    # Ordering heuristics
    for tid, t in by_id.items():
        if t.get("kind") == "discover":
            for d in graph[tid]:
                if by_id.get(d, {}).get("kind") == "act":
                    warnings.append(f"{tid}: discovery task depends on action task '{d}'. Can discovery run earlier?")

    if len(by_id) > MAX_REASONABLE_TASKS:
        warnings.append(
            f"{len(by_id)} tasks. Check for over-decomposition; leaves should be one action with one check."
        )
    if not any(t.get("kind") == "check" for t in by_id.values()):
        warnings.append("No task of kind 'check'. Add a final validation task against the success criteria.")

    if criteria_ids:
        covered = {c for t in by_id.values() for c in (t.get("criteria") or [])}
        missing = sorted(criteria_ids - covered)
        if covered and missing:
            warnings.append("Success criteria not covered by any task: " + ", ".join(missing))

    return {"errors": errors, "warnings": warnings, "waves": [] if cycle else waves(graph)}


def main(argv: List[str]) -> int:
    args = [a for a in argv[1:] if not a.startswith("--")]
    as_json = "--json" in argv
    if len(args) != 1:
        fail_usage("usage: check_plan.py plan.json [--json]")
    plan = load(args[0])
    report = check(plan)

    if as_json:
        print(json.dumps(report, indent=2))
    else:
        for e in report["errors"]:
            print(f"ERROR   {e}")
        for w in report["warnings"]:
            print(f"WARNING {w}")
        if report["waves"]:
            print("\nExecution waves (tasks in a wave can run in parallel):")
            for i, wave in enumerate(report["waves"], 1):
                print(f"  Wave {i}: {', '.join(wave)}")
        status = "INVALID" if report["errors"] else "OK"
        print(f"\n{status}: {len(report['errors'])} error(s), {len(report['warnings'])} warning(s).")
    return 1 if report["errors"] else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
