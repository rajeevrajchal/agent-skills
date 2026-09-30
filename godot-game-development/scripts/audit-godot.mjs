#!/usr/bin/env node
// Heuristic scan of a Godot 4 project for common problems. Findings are leads to verify, not verdicts.
// Usage: node scripts/audit-godot.mjs <project-dir|file.gd> [--json]
// No dependencies. Node 18+.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const SKIP_DIRS = new Set([".godot", ".import", ".git", ".mono", "addons", "node_modules", "build", "bin", "obj", "export"]);
const SCRIPT_EXTS = new Set([".gd"]);
const RESOURCE_EXTS = new Set([".tscn", ".tres"]);

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const includeAddons = args.includes("--include-addons");
const target = args.find((a) => !a.startsWith("--"));
if (!target) {
  console.error("Usage: node audit-godot.mjs <project-dir|file.gd> [--json] [--include-addons]");
  process.exit(2);
}
if (includeAddons) SKIP_DIRS.delete("addons");

const root = resolve(target);
let rootIsDir;
try {
  rootIsDir = statSync(root).isDirectory();
} catch {
  console.error(`Not found: ${root}`);
  process.exit(2);
}
const base = rootIsDir ? root : dirname(root);

// Nearest ancestor containing project.godot (res:// root).
function findProjectRoot(start) {
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, "project.godot"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
const projectRoot = findProjectRoot(base);

function walk(path, out) {
  let st;
  try { st = statSync(path); } catch { return out; }
  if (st.isDirectory()) {
    for (const name of readdirSync(path)) {
      if (SKIP_DIRS.has(name)) continue;
      walk(join(path, name), out);
    }
  } else {
    out.push(path);
  }
  return out;
}

const findings = [];
const add = (severity, file, line, rule, message) => findings.push({ file, line, severity, rule, message });

// Strip a trailing "# comment" that is not inside a string literal.
function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === "\\") { i++; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === "#") return line.slice(0, i);
  }
  return line;
}

const indentOf = (line) => (line.match(/^[\t ]*/)?.[0] ?? "").replace(/\t/g, "    ").length;

// ---------------------------------------------------------------------------
// GDScript rules
// ---------------------------------------------------------------------------

const GODOT3_RULES = [
  [/^\s*export\s*(\(|var\b)/, "`export var` is Godot 3. Use `@export var` (with `@export_range` etc. for hints)."],
  [/^\s*onready\s+var\b/, "`onready var` is Godot 3. Use `@onready var`."],
  [/^\s*tool\s*$/, "`tool` is Godot 3. Use `@tool`."],
  [/\byield\s*\(/, "`yield()` is Godot 3. Use `await obj.signal_name`."],
  [/\.connect\(\s*["']\w+["']\s*,\s*\w+\s*,\s*["']/, "String-based `connect(\"sig\", obj, \"method\")` is Godot 3. Use `sig.connect(method)`."],
  [/\bKinematicBody(2D)?\b/, "`KinematicBody` is Godot 3. Use `CharacterBody2D/3D` with the `velocity` property."],
  [/\bmove_and_slide\s*\(\s*[^)\s]/, "`move_and_slide(velocity, ...)` is Godot 3. Set `velocity` and call `move_and_slide()` with no arguments."],
  [/\.instance\s*\(\s*\)/, "`PackedScene.instance()` is Godot 3. Use `instantiate()`."],
  [/\bsetget\b/, "`setget` is Godot 3. Use `var x: T: set = _set_x, get = _get_x` or inline `set(value):`."],
  [/\b(rand_range|deg2rad|rad2deg|stepify|range_lerp)\s*\(/, "Godot 3 function name. Use randf_range / deg_to_rad / rad_to_deg / snapped / remap."],
  [/\bPool(Byte|Int|Real|String|Vector2|Vector3|Color)Array\b/, "`Pool*Array` is Godot 3. Use `Packed*Array`."],
  [/\bOS\.get_ticks_(msec|usec)\b/, "`OS.get_ticks_*` moved to `Time.get_ticks_*` in Godot 4."],
  [/^\s*extends\s+(Spatial|Position2D|Position3D|Navigation2D|Navigation)\s*$/, "Godot 3 node type. Use Node3D / Marker2D / Marker3D / NavigationRegion + NavigationAgent."],
  [/\binterpolate_property\s*\(/, "Tween node API is Godot 3. Use `create_tween().tween_property(...)`."],
  [/\bemit_signal\s*\(\s*["']/, null], // handled separately as low severity
];

const PHYSICS_CALLBACK = /^(_on_\w*_(body|area)(_shape)?_(entered|exited)|_integrate_forces)$/;

function auditScript(file, src) {
  const lines = src.split(/\r?\n/);
  const hasMoveAndSlide = /\bmove_and_slide\s*\(/.test(src);
  let func = null; // { name, indent }
  let untypedVars = 0, untypedFuncs = 0, firstUntypedLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const code = stripComment(raw);
    if (!code.trim()) continue;
    const n = i + 1;
    const indent = indentOf(code);

    // Function scope tracking by indentation.
    if (func && indent <= func.indent) func = null;
    const fm = code.match(/^(\s*)(?:static\s+)?func\s+(\w+)\s*\(([^)]*)\)\s*(->\s*[\w.\[\], ]+)?\s*:/);
    if (fm) {
      func = { name: fm[2], indent: indentOf(fm[1]) };
      const params = fm[3].trim();
      const untypedParam = params && params.split(",").some((p) => p.trim() && !/[:=]/.test(p));
      if (!fm[4] || untypedParam) {
        untypedFuncs++;
        firstUntypedLine ||= n;
      }
      continue;
    }

    // 1. Godot 3 API
    for (const [re, msg] of GODOT3_RULES) {
      if (msg && re.test(code)) add("high", file, n, "godot3-api", msg);
    }
    if (/\bemit_signal\s*\(\s*["']/.test(code)) {
      add("low", file, n, "string-signal", "String-based `emit_signal(\"x\")`. Prefer `x.emit(...)` — typo-safe and checked by the parser.");
    }
    if (/\bTileMap\b(?!Layer)/.test(code)) {
      add("medium", file, n, "deprecated-tilemap", "`TileMap` is deprecated since 4.3. Use one `TileMapLayer` node per layer.");
    }

    // 2. Physics state changed inside physics callbacks
    if (func && PHYSICS_CALLBACK.test(func.name) && !/call_deferred|set_deferred/.test(code)) {
      if (/\.(disabled|monitoring|monitorable)\s*=[^=]/.test(code) || /\b(add_child|remove_child|reparent)\s*\(/.test(code)) {
        add("high", file, n, "physics-callback-state",
          `Changing collision/tree state inside ${func.name}() → "Can't change this state while flushing queries". Use set_deferred(...) / add_child.call_deferred(...).`);
      }
    }

    // 3. CharacterBody velocity multiplied by delta
    if (hasMoveAndSlide) {
      const vm = code.match(/^\s*velocity(\.[xyz])?\s*=\s*(.+)$/);
      if (vm && /\*\s*delta\b/.test(vm[2]) && !/\bvelocity\b/.test(vm[2])) {
        add("medium", file, n, "velocity-times-delta",
          "`velocity = ... * delta` before move_and_slide(). velocity is per second and move_and_slide applies delta itself — movement will be ~60× too slow and frame-rate dependent. Multiply only accelerations by delta.");
      }
    }

    // 4. Brittle upward / absolute node paths
    if (/get_parent\(\)\s*\.\s*get_parent\(\)/.test(code) || /(get_node(_or_null)?\(\s*["']|\$["']?)\.\.\//.test(code)) {
      add("medium", file, n, "upward-node-path",
        "Reaches up the tree (../ or get_parent chain). Breaks when the scene is re-parented; prefer a signal (call down, signal up) or an @export reference.");
    } else if (/(get_node(_or_null)?\(\s*["']|\$["'])\/root\//.test(code)) {
      add("low", file, n, "absolute-node-path",
        "Absolute /root/ path. Scene can't run standalone; use the autoload name, a group, or an injected reference.");
    }

    // 5. Lookups / prints in per-frame callbacks
    if (func && (func.name === "_process" || func.name === "_physics_process")) {
      if (/\bget_node\s*\(|(^|[^\w"'%])\$[\w"]|get_nodes_in_group\s*\(|\bfind_child\s*\(/.test(code)) {
        add("medium", file, n, "lookup-per-frame", `Node lookup inside ${func.name}(). Cache it in an @onready var (or a list updated on spawn/free).`);
      }
      if (/^\s*print(_debug)?\s*\(/.test(code)) {
        add("low", file, n, "print-per-frame", `print() inside ${func.name}() — costs time every frame, also in exports. Remove or guard with OS.is_debug_build().`);
      }
    }

    // 6. free() on nodes
    if (/(^|[^\w])(self\.)?free\s*\(\s*\)/.test(code) && !/queue_free|\.call\(/.test(code)) {
      add("low", file, n, "immediate-free",
        "free() destroys immediately; for nodes in the tree prefer queue_free() (freed safely at end of frame). Fine for non-Node Objects.");
    }

    // 7. SceneTree timers/tweens that ignore the owner
    if (/create_timer\s*\(\s*[^,()]+\)/.test(code)) {
      add("low", file, n, "timer-ignores-pause",
        "get_tree().create_timer(t) keeps running while the tree is paused (process_always defaults to true). Pass false for gameplay timers, and re-check references after awaiting it.");
    }
    if (/get_tree\(\)\s*\.\s*create_tween\s*\(/.test(code)) {
      add("low", file, n, "unbound-tween",
        "get_tree().create_tween() isn't bound to a node: it ignores that node's pause mode and outlives it. Prefer create_tween() on the animated node.");
    }

    // 8. Untyped declarations (aggregated)
    if (/^\s*var\s+\w+\s*=(?!=)/.test(code) && !/^\s*var\s+\w+\s*:=/.test(code)) {
      untypedVars++;
      firstUntypedLine ||= n;
    }
  }

  if (untypedVars + untypedFuncs > 0) {
    add("low", file, firstUntypedLine, "untyped",
      `${untypedVars} untyped var(s), ${untypedFuncs} func(s) with untyped params or no return type. Typed GDScript is faster and catches errors at parse time.`);
  }
}

// ---------------------------------------------------------------------------
// Resource/scene rules and res:// references
// ---------------------------------------------------------------------------

const GODOT3_NODE_TYPES = /type="(KinematicBody2D|KinematicBody|Spatial|Position2D|Position3D|Navigation2D|Navigation|ParallaxBackground|ParallaxLayer)"/;

function checkResPath(file, line, resPath) {
  if (!projectRoot || resPath.includes("%") || resPath.includes("{")) return;
  const clean = resPath.replace(/^res:\/\//, "").split("::")[0];
  if (!clean) return;
  if (!existsSync(join(projectRoot, clean))) {
    add("high", file, line, "missing-resource",
      `res://${clean} does not exist. Moved outside the editor or deleted? Fix the reference (the UID may still resolve if .uid files are intact).`);
  }
}

function auditResource(file, src) {
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const ext = ln.match(/^\[ext_resource\b.*\bpath="(res:\/\/[^"]+)"/);
    if (ext) checkResPath(file, i + 1, ext[1]);
    const t3 = ln.match(GODOT3_NODE_TYPES);
    if (t3) {
      const deprecated = t3[1].startsWith("Parallax");
      add(deprecated ? "low" : "high", file, i + 1, deprecated ? "deprecated-node" : "godot3-node",
        deprecated ? `${t3[1]} is superseded by Parallax2D (4.3+).` : `${t3[1]} is a Godot 3 node type; the scene won't load correctly in Godot 4.`);
    }
    if (/type="TileMap"/.test(ln)) {
      add("medium", file, i + 1, "deprecated-tilemap", "TileMap node is deprecated since 4.3. Use the editor's \"Extract TileMap layers as individual TileMapLayer nodes\".");
    }
  }
}

function checkScriptLoads(file, src) {
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const code = stripComment(lines[i]);
    for (const m of code.matchAll(/\b(?:pre)?load\s*\(\s*["'](res:\/\/[^"']+)["']\s*\)/g)) checkResPath(file, i + 1, m[1]);
  }
}

// ---------------------------------------------------------------------------
// Project-level rules
// ---------------------------------------------------------------------------

function parseVersion(projectSrc) {
  const m = projectSrc.match(/config\/features=PackedStringArray\(([^)]*)\)/);
  const v = m?.[1].match(/"(\d+)\.(\d+)"/);
  return v ? [Number(v[1]), Number(v[2])] : null;
}

function findGitignore(start) {
  let dir = start;
  for (;;) {
    const p = join(dir, ".gitignore");
    if (existsSync(p)) return p;
    if (existsSync(join(dir, ".git"))) return null;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function auditProject(scriptFiles) {
  if (!projectRoot) {
    add("low", ".", 0, "no-project", "No project.godot found at or above the target; res:// references and project settings were not checked.");
    return;
  }
  const projectFile = join(projectRoot, "project.godot");
  const rel = relative(base, projectFile) || "project.godot";
  const src = readFileSync(projectFile, "utf8");
  const version = parseVersion(src);
  const atLeast = (maj, min) => version && (version[0] > maj || (version[0] === maj && version[1] >= min));

  if (version && version[0] < 4) {
    add("high", rel, 0, "godot3-project", `Project targets Godot ${version.join(".")}. This skill and scan assume Godot 4.`);
  }

  const autoloadSection = src.match(/\[autoload\]([\s\S]*?)(\n\[|$)/);
  const autoloads = autoloadSection ? autoloadSection[1].split("\n").filter((l) => /^\w+=/.test(l)) : [];
  if (autoloads.length > 5) {
    add("low", rel, 0, "autoload-sprawl",
      `${autoloads.length} autoloads (${autoloads.map((l) => l.split("=")[0]).join(", ")}). Check that each is a global service, not level/player state.`);
  }

  if (atLeast(4, 3) && !/^\s*(physics\/)?common\/physics_interpolation\s*=\s*true/m.test(src)) {
    add("low", rel, 0, "no-physics-interpolation",
      "Physics interpolation is off. On high-refresh displays, physics-driven motion and follow cameras will stutter (2D: 4.3+, 3D: 4.4+).");
  }

  const gitignore = findGitignore(projectRoot);
  if (gitignore) {
    const gi = readFileSync(gitignore, "utf8").split(/\r?\n/).map((l) => l.trim());
    const giRel = relative(base, gitignore) || ".gitignore";
    if (gi.some((l) => /^\*?\.uid$/.test(l))) {
      add("high", giRel, 0, "uid-ignored", ".uid files are ignored. Godot 4.4+ needs them committed or references break for everyone else after renames/moves.");
    }
    if (gi.some((l) => /^\*\.import$/.test(l))) {
      add("medium", giRel, 0, "import-ignored", "*.import files are ignored. They store per-asset import settings and should be committed.");
    }
    if (!gi.some((l) => /^\/?\.godot\/?$/.test(l))) {
      add("medium", giRel, 0, "godot-dir-not-ignored", ".godot/ is not ignored. It's a regenerated cache and causes huge noisy diffs.");
    }
  }

  if (atLeast(4, 4) && scriptFiles.length > 0) {
    const missing = scriptFiles.filter((f) => !existsSync(`${f}.uid`));
    if (missing.length === scriptFiles.length) {
      add("medium", rel, 0, "uid-missing",
        `No .gd.uid files next to ${scriptFiles.length} script(s). Open the project in Godot 4.4+ (or run Project → Tools → Upgrade Project Files) and commit the generated .uid files.`);
    } else if (missing.length > 0) {
      add("medium", relative(base, missing[0]), 0, "uid-missing",
        `${missing.length} script(s) have no .uid file (first: ${relative(base, missing[0])}). Not committed, or created outside the editor.`);
    }
  }
}

// ---------------------------------------------------------------------------

const allFiles = rootIsDir ? walk(root, []) : [root];
const scriptFiles = allFiles.filter((f) => SCRIPT_EXTS.has(extname(f)));
const resourceFiles = allFiles.filter((f) => RESOURCE_EXTS.has(extname(f)));

for (const f of scriptFiles) {
  let src;
  try { src = readFileSync(f, "utf8"); } catch { continue; }
  const rel = relative(base, f) || f;
  auditScript(rel, src);
  checkScriptLoads(rel, src);
}
for (const f of resourceFiles) {
  let src;
  try { src = readFileSync(f, "utf8"); } catch { continue; }
  auditResource(relative(base, f) || f, src);
}
if (rootIsDir) auditProject(scriptFiles);

const order = { high: 0, medium: 1, low: 2 };
findings.sort((a, b) => order[a.severity] - order[b.severity] || a.file.localeCompare(b.file) || a.line - b.line);

const scanned = scriptFiles.length + resourceFiles.length;
if (asJson) {
  console.log(JSON.stringify({ projectRoot, scannedFiles: scanned, findings }, null, 2));
} else {
  console.log(`Scanned ${scriptFiles.length} scripts and ${resourceFiles.length} scenes/resources${projectRoot ? ` (project: ${projectRoot})` : ""}. ${findings.length} potential issue(s). Heuristic — verify each before reporting.\n`);
  for (const f of findings) {
    console.log(`[${f.severity.toUpperCase()}] ${f.file}:${f.line}  (${f.rule})\n    ${f.message}`);
  }
}
