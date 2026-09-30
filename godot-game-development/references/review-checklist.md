# Godot Review Checklist

Report findings ordered by impact: **crashes/incorrect behavior → lifecycle/leaks → physics/frame-rate correctness → architecture/coupling → performance → feel → style**. For each finding give the location, the problem, the consequence, and the smallest fix. Don't rewrite working code for taste.

Optionally start with the heuristic scan: `node scripts/audit-godot.mjs <project-dir>` — it flags Godot 3 leftovers, unsafe physics-callback changes, `velocity * delta` misuse, brittle node paths, per-frame lookups, missing `.uid` tracking, and broken `res://` references. Treat its output as leads to verify, not findings.

## Correctness

- [ ] Godot 4 API only (no `export var`, `onready`, `yield`, `KinematicBody`, `connect("x", self, "y")`, `instance()`).
- [ ] Node references resolve: `%UniqueName`/`@export` refs, no fragile `../../` paths; `@onready` not used before `_ready`.
- [ ] Physics state changes inside physics callbacks use `set_deferred`/`call_deferred`.
- [ ] `global_*` transforms set after `add_child`; data needed by `_ready` set before.
- [ ] References re-validated after `await`, timers, and signals (`is_instance_valid`).
- [ ] Shared Resources not mutated per instance (duplicate or keep runtime state in the node).
- [ ] Discrete input handled in `_unhandled_input` (UI can consume it); actions via InputMap, not keycodes.
- [ ] Pause behavior defined: `process_mode` set on menus/gameplay; gameplay timers pause (`create_timer(t, false)` or Timer nodes).
- [ ] Scene reload / level change leaves no stale references in autoloads.

## Physics and frame-rate independence

- [ ] Movement and physics queries in `_physics_process`; visuals in `_process`.
- [ ] `CharacterBody.velocity` in units/second (no `* delta` before `move_and_slide()`); accelerations multiplied by delta.
- [ ] Smoothing uses `1.0 - exp(-k * delta)` or `move_toward`, not fixed-fraction lerp per frame.
- [ ] RigidBodies moved with impulses/forces or in `_integrate_forces`, not by setting `position`.
- [ ] Collision layers/masks named and minimal; no non-uniform scale on physics nodes.
- [ ] Fast projectiles can't tunnel (raycast/ShapeCast/CCD).
- [ ] Physics interpolation on (4.3+ 2D / 4.4+ 3D) or jitter otherwise handled; teleports reset interpolation.

## Lifecycle and resources

- [ ] `queue_free()` for tree nodes; no orphaned nodes from `remove_child` without free.
- [ ] Spawned objects are freed (lifetime timer, offscreen notifier, on hit); counts stay bounded.
- [ ] Tweens created from the owning node; previous tween killed before a new one on the same property; infinite loops stopped.
- [ ] Signals connected once (not in `_enter_tree` repeatedly); long-lived emitters don't hold lambdas into freed nodes.
- [ ] `@tool` scripts guard gameplay with `Engine.is_editor_hint()`.
- [ ] Threads/WorkerThreadPool tasks don't touch the scene tree; results returned via `call_deferred`.

## Architecture

- [ ] Call down, signal up: no `get_parent()` chains or `/root/...` lookups from children.
- [ ] Each scene runs standalone (F6) or with obvious stubs.
- [ ] Autoloads limited to global services; no level/player state or node references cached in them.
- [ ] State machine complexity matches the problem (enum + match unless there's a reason).
- [ ] Components/managers/base classes exist because of real reuse, not anticipation.
- [ ] Tunable values `@export`ed or in Resources; no magic numbers buried in logic.
- [ ] Feature-based folder layout; one script per scene root unless composition requires more.

## Performance

- [ ] No `get_node`/`$`/group lookups, allocations, or `print` in per-frame hot paths.
- [ ] Idle objects disable processing; offscreen AI paused; AI decisions ticked below frame rate.
- [ ] Large identical-object counts use MultiMesh/particles/servers, not thousands of nodes.
- [ ] Layers/masks avoid unnecessary collision pairs.
- [ ] Big scenes loaded threaded; first-use hitches pre-warmed.
- [ ] Renderer and effects match the target platform (Compatibility for web).

## Security and data

- [ ] Save games/settings are JSON/ConfigFile, not `.tres` loaded from `user://`; no `bytes_to_var_with_objects` on untrusted data.
- [ ] Saves are versioned and written atomically (temp file + rename).
- [ ] Multiplayer: `any_peer` RPCs validate sender and arguments; server-authoritative state.
- [ ] No secrets (keystore passwords, API keys) in `export_presets.cfg` or scripts.

## Project hygiene

- [ ] `.godot/` ignored; `*.uid` and `*.import` committed.
- [ ] Exact engine version pinned (editor, CI, export templates).
- [ ] Static typing warnings enabled; scripts fully typed.
- [ ] Tests exist for rule-heavy logic (inventory, damage, save migration).

## Feel (for gameplay code)

- [ ] Controls respond immediately (acceleration curves tuned, input buffering and coyote time where genre-appropriate).
- [ ] Feedback on every player action and every hit (sound, flash, particles, shake — scaled to importance).
- [ ] Accessibility options where effects are intense: screen shake, flashing, rebinding, text size.

## Output format

```md
### [Severity: High | Medium | Low] <short title>
**Where:** `path/file.gd:42`
**Problem:** <what is wrong>
**Consequence:** <what the player or the next developer experiences>
**Fix:** <smallest change, with code if short>
```

End with a one-line overall assessment, including what is already done well only if it's worth preserving.
