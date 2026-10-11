# Godot Review Checklist

Order findings by impact: **crashes and broken gameplay → physics and lifecycle bugs → architecture coupling → performance (measured, or clearly costly) → style**. For each finding give the file and line, the problem, the consequence, and the smallest fix. Don't rewrite working code for taste.

Optional first pass: `python3 scripts/audit_godot.py <project_dir>` for heuristic leads. Verify each one before reporting it.

## Version and syntax
- [ ] Godot 4 APIs only (no `yield`, `onready var`, `export var`, string-based `connect`, `KinematicBody`, `instance()`).
- [ ] APIs used exist in the project's version (`config/features`).
- [ ] Static typing on members, parameters, and returns; typed arrays and dictionaries; warnings enabled.

## Architecture
- [ ] Scenes run standalone (F6) or fail with a clear warning.
- [ ] Call down, signal up. No `get_parent()` chains or absolute `/root/...` paths in gameplay code.
- [ ] Node references through `%UniqueName` or `@export`, not long string paths.
- [ ] Autoloads are few, focused, and don't hold stale references to level nodes.
- [ ] Authored data lives in Resources. Shared Resources aren't mutated at runtime without `duplicate()`.
- [ ] State machines match the complexity (no framework for three states; no tangle of booleans for ten).
- [ ] No god scripts (over about 400 lines mixing input, movement, animation, UI, and saving).

## Lifecycle
- [ ] `@onready` and children are accessed only after `_ready`. Export setters guard with `is_node_ready()`.
- [ ] Freed objects aren't used afterwards (`is_instance_valid` where references can outlive their targets).
- [ ] Long awaits check validity on resume. No awaits on signals that may never fire.
- [ ] Tweens are bound to their nodes and killed before being replaced.
- [ ] Global signal connections (autoloads) are disconnected on `_exit_tree` if the connection lambda captures this node.

## Physics and movement
- [ ] The right body type for each actor. No per-frame transform setting on `RigidBody3D`.
- [ ] Movement in `_physics_process` with `delta`; visuals and camera in `_process`.
- [ ] Layers and masks are named and minimal. No non-uniform scale on bodies or shapes.
- [ ] Physics changes in callbacks are deferred.
- [ ] Space queries run in `_physics_process` and exclude self.
- [ ] Physics interpolation is on (4.4+) for smooth motion, with `reset_physics_interpolation()` after teleports.

## Input and feel
- [ ] InputMap actions, not keycodes. Gamepad bindings exist. Deadzones are tuned.
- [ ] Gameplay input in `_unhandled_input` or polling, so UI can consume events.
- [ ] Frame-rate-independent smoothing (`1 - exp(-k * delta)`).
- [ ] Tuning values are `@export`ed with ranges and units.
- [ ] Interactions have feedback (animation, sound, particles or camera) within about 100 ms.

## AI and navigation
- [ ] Navigation waits for the map sync. Repathing is throttled.
- [ ] `velocity_computed` is wired when avoidance is enabled.
- [ ] Perception is throttled and staggered. LOS raycasts only for candidates.

## Rendering and performance
- [ ] The renderer matches the target platform. Lighting approach chosen deliberately.
- [ ] Limited shadow-casting lights. Shared materials. MultiMesh for repeated objects.
- [ ] No `load()`, allocations, or string-path `get_node` in per-frame code.
- [ ] Idle and offscreen nodes don't process.
- [ ] Large scenes load in a thread behind a loading screen.

## Data and saving
- [ ] Saves are JSON or ConfigFile in `user://`, versioned, written atomically.
- [ ] No `.tres`/`.res` loaded from user-writable locations.
- [ ] Saves store ids and data, not node paths or object references.

## Output format

```md
### [Severity: High | Medium | Low] <short title>
**Where:** `res://actors/creature/creature.gd:42`
**Problem:** <what is wrong>
**Consequence:** <what the player or developer experiences>
**Fix:** <smallest change, with code if short>
```
End with a one-line overall assessment.
