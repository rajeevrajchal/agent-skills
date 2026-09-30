---
name: godot-game-development
description: Design, implement, debug, review, and optimize 2D and 3D games in Godot 4 with typed GDScript (and C# where the project uses it). Covers scene and node architecture, signals, resources, autoloads, state machines, CharacterBody/RigidBody/Area physics, collision layers, TileMapLayer, cameras, pixel-art setup, 3D transforms and controllers, import pipelines, lighting and renderer choice, navigation, input actions, UI/Control layout, animation (AnimationPlayer, AnimationTree, Tween), shaders, save/load, multiplayer, performance profiling, testing, and export. Use when the user is building or fixing a Godot game; asks how to structure scenes, move a character, detect collisions, spawn enemies, save progress, or port Godot 3 code; reports jitter, tunneling, stuttering, "Can't change this state while flushing queries", null instance errors, or broken exports; or when the project contains project.godot, .gd, .tscn, .tres, or .gdshader files.
license: MIT
metadata:
  version: "1.0"
  targets: "Godot 4.4+ (4.3 minimum for TileMapLayer, Parallax2D, 2D physics interpolation), GDScript 2.0, Godot .NET (C#) 4.x"
---

# Godot 2D/3D Game Development

Act as a senior gameplay engineer who ships Godot games: equal parts engine programmer (lifecycle, physics ticks, ownership, performance) and game designer (feel, readability, iteration speed). The goal is a game that feels right and a project that stays easy to change. Architecture exists to serve iteration speed, not the other way around.

This skill is a decision guide, not an API manual. Load a reference file only when the task needs it (map at the end).

## 1. Pick the mode, then follow its procedure

| The user wants to… | Mode | Procedure |
|---|---|---|
| Build a mechanic, system, or feature | **Plan → Implement** | §2, then §3–§7 and the matching reference |
| Start a new project | **Setup** | §3 (version, renderer, 2D/3D settings), `references/architecture.md` |
| "It errors / jitters / falls through the floor / doesn't detect" | **Debug** | `references/debugging.md`, in order |
| "Review this Godot code/project" | **Review** | `references/review-checklist.md`; optionally run `scripts/audit-godot.mjs` |
| "It's slow / stutters" | **Optimize** | Profile first, then `references/performance.md` |
| Port Godot 3 code or a tutorial | **Port** | §8 Godot 3 → 4 table; the audit script flags leftovers |

Never fix a bug by tweaking magic numbers, adding `await get_tree().process_frame`, or sprinkling `call_deferred` until you can name the cause. Those hide ordering bugs; they don't fix them.

## 2. Plan before code

Answer these first. If the **Godot version** or **2D vs 3D** is unknown and it matters, check `project.godot` (`config/features=PackedStringArray("4.x", ...)`) before asking. For everything else, state an assumption in one line and proceed.

1. **Player-facing behavior**: what does the player see and feel? ("jump is snappy, forgiving at ledges" — not "add jump").
2. **Owner**: which scene owns this state? Who creates and frees the nodes involved?
3. **Clock**: does it run per rendered frame (`_process`), per physics tick (`_physics_process`), on input (`_unhandled_input`), or on an event (signal/timer)?
4. **Communication**: who needs to know when it happens? (Direct call down, signal up — §4.)
5. **Data vs behavior**: is there tunable data (stats, waves, items) that designers change? → `Resource`, not constants scattered in scripts.
6. **Scale**: how many instances at once — 1, 100, 10 000? It decides nodes vs `MultiMesh` vs servers.
7. **Pause, death, scene change**: what happens to this system when the game pauses, the owner is freed, or the level reloads?
8. **Target platform**: desktop, mobile, web? It constrains renderer, physics budget, threads, and C#.

For larger features, plan the shape in this form before writing code:

```md
**Behavior:** <what the player experiences, one sentence>
**Scenes/nodes:** <new scenes, their root type, key children>
**State owner:** <which node owns the state; who reads it>
**Clock:** <_physics_process | _process | input | signal | Timer>
**Signals:** <emitter.signal(args) → listener>
**Data:** <Resources / exported values designers tune>
**Lifecycle:** <spawn, pause, free, reload behavior>
**Steps:** <numbered, each one playable/verifiable>
```

### Build in playable slices

Make each step runnable in the editor with F6 (run current scene) before adding the next. A character controller is built as: move → collide → jump → feel tuning (coyote time, buffering, acceleration) → animation hookup → effects. Tune feel only after the mechanics are correct, and tune with exported variables so iteration happens in the Inspector while the game runs, not by editing code.

## 3. Project setup decisions

| Decision | Default | Change when |
|---|---|---|
| Language | Typed GDScript | Team is C#-first, heavy algorithmic code, or you need .NET libraries → `references/csharp.md`. C# cannot export to web in Godot 4 |
| Renderer (3D) | Forward+ | Mobile target → Mobile; web or low-end/old GPUs → Compatibility (no SDFGI/VoxelGI/volumetric fog) |
| Renderer (2D-only) | Compatibility is fine and exports everywhere | Need 2D features only in Forward+/Mobile — check the docs page for the feature |
| 3D physics | Jolt (built in since 4.4, the default for new projects in current releases) | Legacy project relying on GodotPhysics3D quirks |
| Physics tick | 60 Hz + **physics interpolation on** (`physics/common/physics_interpolation`) | Fast precise games may want 120 Hz — measure cost first |
| Pixel art | Default texture filter **Nearest**, stretch mode `viewport` or `canvas_items`, scale mode `integer` | High-res 2D → `canvas_items` + Linear |
| Static typing | Enable `debug/gdscript/warnings/untyped_declaration` = Warn (or Error) | Never loosen it in a new project |

Version control: commit `project.godot`, every `.tscn`/`.tres`/`.gd`/`.gdshader`, `*.import`, and every `*.uid` file (Godot 4.4+ uses them to keep references stable across renames). Ignore `.godot/` only. Details: `references/testing-and-export.md`.

## 4. Architecture defaults

Read `references/architecture.md` for the full reasoning. The short version:

1. **Scenes are the unit of composition.** A scene is a reusable, self-contained thing (Player, Enemy, Door, HUD). It must run on its own with F6 or with obvious stubbed inputs.
2. **Call down, signal up.** A parent may call methods on its children directly. A child never reaches up (`get_parent()`, `../../`) — it emits a signal, and whoever instanced it connects. Siblings communicate through their common parent or a signal.
3. **Reference nodes by `@onready var x: Type = %UniqueName`** or `@export var x: Type`, never by long relative paths. Paths break when the scene tree is edited.
4. **Autoloads for truly global services only** (save system, audio bus manager, scene transitions, event bus if you genuinely need one). Game state that belongs to a level or a player does not go in an autoload. More than ~5 autoloads is a smell.
5. **Resources for data.** Stats, item definitions, wave tables, and weapon configs are `class_name X extends Resource` with `@export` fields, saved as `.tres`, edited in the Inspector. They are shared by default — `duplicate()` before mutating per-instance state (§7).
6. **State machines: start with an `enum` + `match`.** Promote to node-based states only when states have their own substantial data, children, or editor configuration. A generic state-machine framework for a 3-state enemy is over-engineering.
7. **Components (child nodes like `HealthComponent`, `Hitbox`) only when the behavior is shared across unrelated entity types.** One entity type → keep it in the entity's script. Don't port Unity's GetComponent style or a full ECS onto Godot; nodes and scenes already are the composition system.
8. **Scale by technique, not by framework.** Hundreds of identical things → `MultiMeshInstance`, `GPUParticles`, or direct `PhysicsServer`/`RenderingServer` calls in one manager node — not ECS for its own sake.

## 5. Implementation rules (non-negotiable)

1. **Typed GDScript everywhere**: `var speed: float = 200.0`, `func take_damage(amount: int) -> void`, `:=` when the type is obvious from the right-hand side. Typed code is faster, catches errors at parse time, and autocompletes.
2. **Right callback for the job.** Movement, forces, raycasts, anything touching physics → `_physics_process(delta)`. Visual-only (UI animation, camera smoothing without interpolation) → `_process(delta)`. Discrete input (jump, pause, interact) → `_unhandled_input(event)` so UI can consume it first. Continuous input (move axis) → poll `Input.get_vector()` in `_physics_process`.
3. **Input goes through InputMap actions**, never hard-coded keys. Define actions in Project Settings → Input Map (or in code at startup for a rebinding system).
4. **Don't change physics state inside physics callbacks.** In `body_entered`/`area_entered`/`_on_*_collided`, use `set_deferred("disabled", true)`, `set_deferred("monitoring", false)`, and `add_child.call_deferred(node)`. Changing them directly produces "Can't change this state while flushing queries".
5. **`queue_free()`, not `free()`**, for nodes in the tree. After an `await`, a signal, or a timer, a referenced node may be gone → `is_instance_valid(node)` before use.
6. **Frame-rate independence.** Positions: multiply by `delta` when you move manually. `CharacterBody` `velocity` is already per second — `move_and_slide()` applies delta, so never write `velocity = dir * speed * delta`. Accelerations do use delta: `velocity.y += gravity * delta`. Smoothing: `x = lerp(x, target, 1.0 - exp(-sharpness * delta))`, not `lerp(x, target, 0.1)`.
7. **Cache node lookups.** `@onready` vars, not `get_node()`/`$` inside `_process`. Disable callbacks you don't need: `set_physics_process(false)` for idle objects.
8. **Clean up what you start.** Tweens: `create_tween()` from the node (it dies with the node); kill the previous tween before starting another on the same property. Timers created with `get_tree().create_timer()` keep running while the tree is paused by default — pass `process_always = false` when gameplay timers must pause. Connecting a bound method (`hit.connect(_on_hit)`) is auto-removed when the listener is freed; for long-lived emitters (autoloads, the player) prefer method callables over lambdas that capture nodes, or disconnect in `_exit_tree()`.
9. **No `TODO` placeholders or pseudo-code** in delivered scripts. If an asset or scene is assumed, say so and give its expected node structure.

## 6. Physics and movement decision

| Need | Use |
|---|---|
| Player, NPC, anything moved by code that collides and slides | `CharacterBody2D/3D` + `move_and_slide()` |
| Crates, debris, ragdolls, anything the simulation should move | `RigidBody2D/3D`; push with `apply_impulse`/`apply_central_force`; set state in `_integrate_forces`, never `position =` |
| Moving platforms, doors, elevators | `AnimatableBody2D/3D` (with `sync_to_physics`) |
| Level geometry | `StaticBody2D/3D` or TileMapLayer/GridMap collision |
| Triggers, hitboxes, hurtboxes, detection zones, pickups | `Area2D/3D` + `body_entered` / `area_entered` |
| Line-of-sight, ground check, one-off query | `RayCast2D/3D` node (persistent) or `PhysicsDirectSpaceState` query (one-off) |
| Fast bullets | Raycast/ShapeCast per tick, or `continuous_cd` on RigidBody; not a tiny Area that tunnels |

Collision **layer** = what I am; **mask** = what I detect. Name the layers in Project Settings → Layer Names and document them; unnamed layer bits are the #1 source of "collision doesn't fire". Full guide: `references/physics.md`.

## 7. Gotchas (read before writing code)

- **Godot 3 code in Godot 4.** Tutorials and model memory are full of Godot 3 API. See §8. `export var`, `onready`, `yield`, `KinematicBody`, `move_and_slide(velocity, Vector2.UP)`, `connect("x", self, "_on_x")` are all Godot 3.
- **Resources are shared.** Two enemies loading the same `stats.tres` share one object; `stats.health -= 10` damages both. `duplicate()` in `_ready()` or enable **Local to Scene** on the resource.
- **`@onready` runs just before `_ready`**, after children are ready. Accessing child nodes in `_init()` or in a setter fired by the Inspector before the node enters the tree returns null — guard setters with `if not is_node_ready(): return`.
- **`_ready()` runs children first, parent last.** A child can't rely on the parent being set up in its own `_ready`; the parent should configure its children.
- **3D forward is `-Z`.** `-global_basis.z` is where a node faces; `look_at()` points `-Z` at the target. Imported models facing `+Z` need a 180° rotation on the import, not in gameplay code.
- **Jitter** with a camera following a physics body is almost always tick mismatch. Enable physics interpolation (4.3+ in 2D, 4.4+ in 3D) and don't teleport interpolated objects without `reset_physics_interpolation()`.
- **Navigation map isn't ready on frame 1.** `NavigationAgent` path queries in `_ready()` return nothing; wait one physics frame (`await get_tree().physics_frame`) or for `NavigationServer*.map_changed`.
- **Control nodes eat mouse input.** A full-screen `Control` with `mouse_filter = STOP` blocks clicks to the game world. HUD containers usually want `MOUSE_FILTER_IGNORE`.
- **`TileMap` is deprecated since 4.3.** Use one `TileMapLayer` node per layer.
- **Loading user-supplied `.tres`/`.res` can execute scripts.** Save games and mods loaded from `user://` should be JSON/`ConfigFile`/binary `var_to_bytes` without objects — `references/save-load-and-data.md`.
- **Floating-point drift in large 3D worlds** (> ~8 km from origin) causes jitter; use origin shifting or a double-precision build.
- **`print()` in hot paths** costs real time in exports too. Remove it or guard with `OS.is_debug_build()`.

## 8. Godot 3 → 4 porting table

| Godot 3 | Godot 4 |
|---|---|
| `export var x = 1`, `onready var`, `tool` | `@export var x := 1`, `@onready var`, `@tool` |
| `yield(obj, "signal")` | `await obj.signal` |
| `connect("hit", self, "_on_hit")` / `emit_signal("hit", 1)` | `hit.connect(_on_hit)` / `hit.emit(1)` |
| `setget set_x, get_x` | `var x: int: set = set_x, get = get_x` (or inline `set(value):`) |
| `KinematicBody2D`, `move_and_slide(vel, Vector2.UP)` | `CharacterBody2D`; set `velocity`, call `move_and_slide()`, `up_direction` property |
| `Spatial`, `Position2D`, `Navigation2D` | `Node3D`, `Marker2D`, `NavigationRegion2D` + `NavigationAgent2D` |
| `scene.instance()` | `scene.instantiate()` |
| `rand_range()`, `deg2rad()`, `stepify()` | `randf_range()`, `deg_to_rad()`, `snapped()` |
| `PoolStringArray` etc. | `PackedStringArray` etc. |
| `OS.get_ticks_msec()` | `Time.get_ticks_msec()` |
| `Tween` node + `interpolate_property` | `var t := create_tween(); t.tween_property(...)` |
| `TileMap` with layers | `TileMapLayer` nodes (4.3+) |
| `ParallaxBackground`/`ParallaxLayer` | `Parallax2D` (4.3+) |

## 9. Output expectations

- Complete, typed GDScript (or C#) that runs as written, with the node tree it expects stated explicitly:
  ```
  Player (CharacterBody2D)  — player.gd
  ├── Sprite (AnimatedSprite2D)
  ├── Collision (CollisionShape2D)
  └── CoyoteTimer (Timer, one_shot)
  ```
- Tunable values as `@export` (grouped with `@export_group`), not literals buried in methods.
- Explain *why* the structure and clock fit the problem — briefly. If the user's proposed architecture (an autoload for everything, a state-machine framework, ECS, object pooling without measurements) is heavier than the problem needs, say so and give the simpler version.
- When reviewing, order findings: crashes/incorrect behavior → lifecycle/leaks → physics/frame-rate correctness → architecture/coupling → performance → feel → style.

## Reference map

| Read | When |
|---|---|
| `references/gdscript.md` | Writing any GDScript: typing, signals, await, setters, lambdas, static funcs, idioms, errors |
| `references/architecture.md` | Structuring scenes, autoloads, signals vs direct calls, state machines, components, data Resources, scene switching |
| `references/2d.md` | Platformer/top-down controllers, TileMapLayer, Camera2D, pixel art, Parallax2D, y-sorting, 2D lights |
| `references/3d.md` | Transforms and Basis, first/third-person controllers, camera, model import, lighting and renderer features, GridMap, LOD |
| `references/physics.md` | Body types, layers/masks, deferred changes, raycasts/shape queries, tunneling, interpolation, Jolt |
| `references/gameplay-systems.md` | Input/rebinding, UI and HUD, animation (AnimationPlayer/Tree, Tween), audio, navigation/AI, spawning |
| `references/shaders-and-vfx.md` | `.gdshader` canvas_item/spatial shaders, uniforms, particles, post-processing |
| `references/save-load-and-data.md` | Save games, settings, Resources vs JSON, loading screens, threaded loading |
| `references/multiplayer.md` | High-level multiplayer: authority, RPCs, MultiplayerSpawner/Synchronizer, validation |
| `references/csharp.md` | Godot .NET projects: signals, exports, lifetime, allocation, interop with GDScript |
| `references/performance.md` | Profiling, CPU/GPU bottlenecks, many entities, draw calls, physics budget, memory |
| `references/testing-and-export.md` | Unit/integration tests (GUT, gdUnit4), headless CI, linting, VCS, export presets, web/mobile |
| `references/debugging.md` | Any "doesn't work" report — follow it in order |
| `references/review-checklist.md` | Reviewing Godot code or a project |
| `scripts/audit-godot.mjs` | Heuristic project scan before a review or port: `node scripts/audit-godot.mjs <project-dir>` |
