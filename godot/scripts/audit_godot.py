#!/usr/bin/env python3
"""Heuristic audit of a Godot 4 project. Findings are leads to verify, not verdicts.

Scans project.godot, *.gd and *.tscn for Godot 3 syntax, lifecycle and physics pitfalls,
coupling smells, per-frame costs, unsafe save loading, typing coverage, and scaled physics nodes.

Usage:
    python3 scripts/audit_godot.py <project_dir> [--json]

Standard library only (Python 3.8+). Exit code 0 always (it's a heuristic report), 2 on usage errors.
"""
from __future__ import annotations

import json
import math
import os
import re
import sys
from typing import Dict, List, Optional, Tuple

SKIP_DIRS = {".godot", ".import", ".git", "addons", "build", "export", "node_modules", ".venv"}

Finding = Dict[str, object]
findings: List[Finding] = []


def add(sev: str, path: str, line: int, rule: str, msg: str) -> None:
    findings.append({"severity": sev, "file": path, "line": line, "rule": rule, "message": msg})


# ---------------------------------------------------------------- project.godot
def audit_project(root: str) -> Dict[str, str]:
    info: Dict[str, str] = {}
    path = os.path.join(root, "project.godot")
    if not os.path.isfile(path):
        add("high", "project.godot", 0, "no-project", "project.godot not found. Is this the project root?")
        return info
    text = open(path, encoding="utf-8", errors="replace").read()
    sections: Dict[str, List[str]] = {}
    current = ""
    for raw in text.splitlines():
        line = raw.strip()
        m = re.match(r"^\[(.+)\]$", line)
        if m:
            current = m.group(1)
            sections.setdefault(current, [])
        elif line and not line.startswith(";"):
            sections.setdefault(current, []).append(line)

    feats = re.search(r'config/features=PackedStringArray\(([^)]*)\)', text)
    if feats:
        items = [s.strip().strip('"') for s in feats.group(1).split(",")]
        version = next((s for s in items if re.match(r"^\d+\.\d+$", s)), "")
        info["version"] = version
        info["renderer"] = ", ".join(s for s in items if s and not re.match(r"^\d", s))
        if version.startswith("3.") or (version and float(version) < 4.0):
            add("high", "project.godot", 0, "godot3-project", f"Project targets Godot {version}. This skill targets Godot 4.")
        elif version and float(version) < 4.4:
            add("low", "project.godot", 0, "old-version",
                f"Godot {version}: 3D physics interpolation, typed dictionaries and some skeleton modifiers need 4.4+.")
    else:
        add("medium", "project.godot", 0, "no-version", "config/features missing; can't tell the engine version.")

    def setting(section: str, key: str) -> Optional[str]:
        for entry in sections.get(section, []):
            k, _, v = entry.partition("=")
            if k.strip() == key:
                return v.strip().strip('"')
        return None

    engine = setting("physics", "3d/physics_engine")
    info["physics_engine"] = engine or "(default: Jolt for new 4.6+ projects, else Godot Physics)"
    if setting("physics", "common/physics_interpolation") != "true":
        add("low", "project.godot", 0, "no-physics-interpolation",
            "Physics interpolation is off. Motion may stutter on high-refresh displays (enable in 4.4+ for 3D).")
    autoloads = sections.get("autoload", [])
    info["autoloads"] = str(len(autoloads))
    if len(autoloads) > 8:
        add("low", "project.godot", 0, "many-autoloads",
            f"{len(autoloads)} autoloads. Check each is a focused global service, not a dumping ground.")
    if not sections.get("input"):
        add("medium", "project.godot", 0, "no-input-map",
            "No custom input actions. Gameplay should use InputMap actions (with gamepad bindings), not keycodes.")
    if not any(k.startswith("3d_physics/") for k in sections.get("layer_names", [])):
        add("low", "project.godot", 0, "unnamed-layers", "3D physics layers are unnamed. Name them in Project Settings → Layer Names.")
    return info


# ---------------------------------------------------------------- GDScript
GODOT3_PATTERNS: List[Tuple[str, str]] = [
    (r"^\s*onready\s+var\b", "`onready var` → `@onready var`"),
    (r"^\s*export(\s*\(|\s+var\b)", "`export var` → `@export var`"),
    (r"^\s*tool\s*$", "`tool` → `@tool`"),
    (r"\byield\s*\(", "`yield(...)` → `await signal`"),
    (r"\.connect\(\s*\"[^\"]+\"\s*,\s*self\s*,", "string connect → `sig.connect(callable)`"),
    (r"\bKinematicBody\b", "`KinematicBody` → `CharacterBody3D`"),
    (r"\bextends\s+Spatial\b|\bSpatial\.new\b", "`Spatial` → `Node3D`"),
    (r"\.instance\(\s*\)", "`.instance()` → `.instantiate()`"),
    (r"\bmove_and_slide\(\s*[^)\s]", "`move_and_slide(velocity, ...)` → set `velocity`, call `move_and_slide()`"),
    (r"\bsetget\b", "`setget` → property `set:`/`get:` syntax"),
    (r"\brand_range\(|\bdeg2rad\(|\brad2deg\(|\bstepify\(", "renamed math helpers (randf_range, deg_to_rad, snapped)"),
    (r"\bFile\.new\(\)|\bDirectory\.new\(\)", "`File`/`Directory` → `FileAccess`/`DirAccess`"),
    (r"\bPool(String|Vector2|Vector3|Int|Real|Color|Byte)Array\b", "`Pool*Array` → `Packed*Array`"),
    (r"\bOS\.get_ticks_msec\(", "`OS.get_ticks_msec` → `Time.get_ticks_msec`"),
    (r"\bBUTTON_(LEFT|RIGHT|MIDDLE)\b", "`BUTTON_*` → `MOUSE_BUTTON_*`"),
    (r"\bget_world\(\)", "`get_world()` → `get_world_3d()`"),
    (r"(^|\s|\.)translation\s*=", "`translation` → `position`"),
]

PHYSICS_CB = re.compile(r"^_on_\w*_(body|area)_(entered|exited|shape_entered|shape_exited)$")
DIRECT_PHYSICS_CHANGE = re.compile(
    r"(\.disabled\s*=|\bmonitoring\s*=|\bmonitorable\s*=|(?<!call_deferred\()\badd_child\(|"
    r"\bcollision_layer\s*=|\bcollision_mask\s*=|set_collision_(layer|mask)_value\(|\breparent\()"
)
BODY_TYPES = ("CharacterBody3D", "RigidBody3D", "StaticBody3D", "AnimatableBody3D", "Area3D")


def split_functions(lines: List[str]) -> List[Tuple[str, int, int]]:
    """Return (name, start_idx, end_idx_exclusive) for each top-level-or-inner func by indentation."""
    funcs = []
    for i, line in enumerate(lines):
        m = re.match(r"^(\s*)(static\s+)?func\s+(\w+)", line)
        if not m:
            continue
        indent = len(m.group(1).expandtabs(4))
        j = i + 1
        while j < len(lines):
            s = lines[j]
            if s.strip() and not s.strip().startswith("#"):
                ind = len(s) - len(s.lstrip())
                ind = len(s[:ind].expandtabs(4))
                if ind <= indent:
                    break
            j += 1
        funcs.append((m.group(3), i, j))
    return funcs


def audit_gd(rel: str, text: str) -> None:
    lines = text.splitlines()
    extends = re.search(r"^extends\s+(\w+)", text, re.M)
    base = extends.group(1) if extends else ""

    # Godot 3 syntax
    for i, line in enumerate(lines, 1):
        code = line.split("#", 1)[0]
        for pat, msg in GODOT3_PATTERNS:
            if re.search(pat, code):
                add("high", rel, i, "godot3-syntax", f"Godot 3 syntax: {msg}.")
                break

    # Coupling smells
    for i, line in enumerate(lines, 1):
        code = line.split("#", 1)[0]
        if re.search(r"get_parent\(\)\s*\.\s*get_parent\(\)", code) or re.search(r"(get_node\(\s*\"|\$\"?)\.\./\.\./", code):
            add("medium", rel, i, "reach-up", "Reaching up the tree (../.. or get_parent chains). Use signals up, or exported references.")
        if re.search(r"(get_node\(\s*\"|\$\"?)/root/", code):
            add("medium", rel, i, "absolute-path", "Absolute /root/ path couples code to one scene layout. Use an autoload name, a group, or an exported reference.")
        if re.search(r"\b(load|ResourceLoader\.load)\(\s*\"user://[^\"]*\.(tres|res|tscn|scn)\"", code):
            add("high", rel, i, "unsafe-resource-load",
                "Loading a Resource/scene from user://. Resources can embed scripts that execute on load; use JSON/ConfigFile for saves.")
        if re.search(r"Input\.is_key_pressed\(\s*KEY_", code):
            add("low", rel, i, "raw-keycode", "Raw keycode in gameplay. Use InputMap actions (remappable, gamepad-friendly).")
        if re.search(r"get_tree\(\)\.create_tween\(", code):
            add("low", rel, i, "unbound-tween", "get_tree().create_tween() isn't bound to a node and keeps running after it's freed. Prefer node.create_tween().")
        if re.search(r"^\s*scale\s*=", code) and base in BODY_TYPES:
            add("medium", rel, i, "scaled-body", f"Setting scale on a {base}. Scale visual children or change the collision shape's size instead.")

    # Per-function checks
    for name, start, end in split_functions(lines):
        body = lines[start + 1:end]
        per_frame = name in ("_process", "_physics_process")
        for k, line in enumerate(body, start + 2):
            code = line.split("#", 1)[0]
            if per_frame and re.search(r"(?<![\w.])(load|preload)\(|ResourceLoader\.load\(", code) and "preload(" not in code:
                add("medium", rel, k, "per-frame-load", f"load() inside {name}. Load once (preload/@onready/_ready) and cache it.")
            if per_frame and re.search(r"get_node\(\s*\"", code):
                add("low", rel, k, "per-frame-get-node", f"String get_node() in {name}. Cache it in an @onready var.")
            if name == "_process" and re.search(r"\bmove_and_slide\(\)", code):
                add("medium", rel, k, "move-in-process", "move_and_slide() in _process. Move physics bodies in _physics_process.")
            if name == "_process" and re.search(r"intersect_(ray|shape)\(", code):
                add("low", rel, k, "query-in-process", "Space query in _process. Run physics queries in _physics_process.")
            if per_frame and re.search(r"\blerp(f|_angle)?\([^()]*,\s*0?\.\d+\s*\)", code):
                add("low", rel, k, "framerate-lerp", "lerp with a constant weight is frame-rate dependent. Use weight = 1.0 - exp(-rate * delta).")
            if PHYSICS_CB.match(name) and DIRECT_PHYSICS_CHANGE.search(code) and "deferred" not in code:
                add("medium", rel, k, "non-deferred-physics-change",
                    f"Physics state change inside {name}. Use set_deferred()/call_deferred() during physics callbacks.")
            if per_frame and base == "RigidBody3D" and re.search(r"^\s*(global_)?(position|transform|global_transform)\s*=", code):
                add("medium", rel, k, "rigidbody-teleport", "Setting a RigidBody3D transform every frame fights the simulation. Use forces/impulses or _integrate_forces.")

    # Typing coverage
    decls = re.findall(r"^\s*(?:@onready\s+|@export[\w_]*(?:\([^)]*\))?\s+)?var\s+\w+\s*(:=|:\s*[\w\[\], .]+|=|$)", text, re.M)
    untyped_vars = sum(1 for d in decls if d in ("=", ""))
    func_sigs = re.findall(r"^\s*(?:static\s+)?func\s+\w+\(([^)]*)\)\s*(->\s*[\w\[\], .]+)?\s*:", text, re.M)
    untyped_params = 0
    total_params = 0
    missing_returns = 0
    for params, ret in func_sigs:
        for p in [p.strip() for p in params.split(",") if p.strip()]:
            total_params += 1
            if ":" not in p.split("=", 1)[0]:
                untyped_params += 1
        if not ret:
            missing_returns += 1
    total = len(decls) + total_params + len(func_sigs)
    untyped = untyped_vars + untyped_params + missing_returns
    if total >= 5 and untyped / total > 0.3:
        add("low", rel, 1, "weak-typing",
            f"{untyped}/{total} declarations untyped (vars {untyped_vars}, params {untyped_params}, returns {missing_returns}). "
            "Static typing catches errors in the editor and runs faster.")

    if len(lines) > 400:
        add("low", rel, 1, "large-script", f"{len(lines)} lines. Check for a god script; split by responsibility (components, states).")
    prints = len(re.findall(r"^\s*print\(", text, re.M))
    if prints > 10:
        add("low", rel, 1, "print-spam", f"{prints} print() calls. Remove or gate debug output (print_debug / a debug flag).")


# ---------------------------------------------------------------- scenes
NODE_RE = re.compile(r'^\[node name="([^"]+)" type="(\w+)"')
XFORM_RE = re.compile(r"^transform = Transform3D\(([^)]*)\)")


def basis_scales(values: List[float]) -> Optional[Tuple[float, float, float]]:
    if len(values) < 9:
        return None
    cols = (values[0:3], values[3:6], values[6:9])
    return tuple(math.sqrt(sum(c * c for c in col)) for col in cols)  # type: ignore[return-value]


def audit_tscn(rel: str, text: str) -> None:
    lines = text.splitlines()
    current: Optional[Tuple[str, str, int]] = None
    node_count = 0
    for i, line in enumerate(lines, 1):
        m = NODE_RE.match(line)
        if m:
            current = (m.group(1), m.group(2), i)
            node_count += 1
            continue
        if line.startswith("[node "):
            current = None  # instanced node without explicit type
            node_count += 1
            continue
        if line.startswith("[editable path="):
            add("low", rel, i, "editable-children",
                "Editable Children on an instanced scene. Edits to imported scenes are fragile; prefer import settings or a wrapper scene.")
        if current and current[1] in BODY_TYPES + ("CollisionShape3D", "CollisionPolygon3D"):
            xm = XFORM_RE.match(line)
            if xm:
                try:
                    vals = [float(v) for v in xm.group(1).split(",")]
                except ValueError:
                    continue
                scales = basis_scales(vals)
                if not scales:
                    continue
                lo, hi = min(scales), max(scales)
                if hi - lo > 0.01 * max(hi, 1e-6):
                    add("medium", rel, i, "nonuniform-physics-scale",
                        f'Node "{current[0]}" ({current[1]}) has non-uniform scale {tuple(round(s, 3) for s in scales)}. '
                        "Physics doesn't support it; resize the shape instead.")
                elif abs(hi - 1.0) > 0.01:
                    add("low", rel, i, "scaled-physics-node",
                        f'Node "{current[0]}" ({current[1]}) is scaled ×{round(hi, 3)}. Prefer shape dimensions over scale.')
    if node_count > 1500:
        add("low", rel, 1, "huge-scene", f"{node_count} nodes in one scene. Consider sub-scenes, MultiMesh, or streaming.")


# ---------------------------------------------------------------- main
def main(argv: List[str]) -> int:
    args = [a for a in argv[1:] if not a.startswith("--")]
    as_json = "--json" in argv
    if len(args) != 1 or not os.path.isdir(args[0]):
        print("usage: audit_godot.py <project_dir> [--json]", file=sys.stderr)
        return 2
    root = os.path.abspath(args[0])
    info = audit_project(root)
    scanned = 0
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            path = os.path.join(dirpath, fn)
            rel = "res://" + os.path.relpath(path, root).replace(os.sep, "/")
            if fn.endswith(".gd"):
                scanned += 1
                audit_gd(rel, open(path, encoding="utf-8", errors="replace").read())
            elif fn.endswith(".tscn"):
                scanned += 1
                audit_tscn(rel, open(path, encoding="utf-8", errors="replace").read())

    order = {"high": 0, "medium": 1, "low": 2}
    findings.sort(key=lambda f: (order[str(f["severity"])], str(f["file"]), int(f["line"])))  # type: ignore[arg-type]
    if as_json:
        print(json.dumps({"project": info, "scanned_files": scanned, "findings": findings}, indent=2))
        return 0
    if info:
        print("Project: " + ", ".join(f"{k}={v}" for k, v in info.items()))
    counts = {s: sum(1 for f in findings if f["severity"] == s) for s in order}
    print(f"Scanned {scanned} files. {len(findings)} potential issue(s) "
          f"(high {counts['high']}, medium {counts['medium']}, low {counts['low']}). Heuristic: verify each.\n")
    for f in findings:
        print(f"[{str(f['severity']).upper()}] {f['file']}:{f['line']}  ({f['rule']})\n    {f['message']}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
