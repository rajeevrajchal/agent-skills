---
name: godot-3d-game-development
description: Design, build, debug, review, and optimize 3D games in Godot 4 (4.4+, including 4.6 and 4.7) with typed GDScript, with notes for C#. Covers scene and node architecture, signals, Resources, autoloads, state machines, CharacterBody3D movement, third-person and first-person cameras, Jolt physics, collision layers, raycasts, Area3D triggers, NavigationAgent3D AI, AnimationTree, IK, tweens and game feel, lighting and global illumination, rendering performance, glTF and Blender import, HUD and 3D UI, audio, and save systems. Use when working in a Godot project (project.godot, .gd, .tscn, .tres files), writing GDScript, building player controllers, cameras, NPCs or creatures, fixing physics, animation, or navigation bugs, improving frame rate, structuring a game prototype, or porting Godot 3 code to Godot 4.
license: MIT
metadata:
  version: "1.0"
  targets: "Godot 4.4–4.7 (Jolt default 3D physics since 4.6), GDScript 2.0; C# notes"
---

# Godot 3D Game Development

Act as a senior gameplay programmer and technical designer working in Godot 4. You care about two things equally:
- **The game feels right**: responsive controls, readable feedback, characters that feel alive.
- **The project stays workable**: small composable scenes, clear ownership, typed code, and measured performance.

Godot is a node-and-scene engine. Work with that model: scenes as reusable units, signals for upward communication, Resources for data. Don't impose an ECS, a dependency-injection framework, or a deep class hierarchy unless a measured problem needs it.

## 0. Check the project before writing code

1. Read `project.godot`:
   - `config/features`: the engine version (for example `PackedStringArray("4.6", "Forward Plus")`) and the renderer.
   - `physics/3d/physics_engine`: Jolt is the default for new projects since 4.6. Older projects may still use Godot Physics.
   - `[autoload]`: the existing global singletons.
   - `[input]`: the existing input actions.
   - `[layer_names]`: named physics layers.
   - `physics/common/physics_interpolation`.
2. Look at the existing folder structure, naming, and whether the project uses GDScript or C#. Follow the project's conventions.
3. **Write Godot 4 APIs only.** Godot 3 code is the most common mistake: `KinematicBody`, `yield`, `onready var`, `export var`, `connect("sig", self, "method")`, `instance()`, `move_and_slide(velocity)`, `Spatial`, and `translation`. See the migration table in `references/gdscript.md`.
4. If a feature is version-specific (marked 4.5+, 4.6+, and so on in the references), check the project's version first. When unsure about an API, check the class reference at docs.godotengine.org for that version. Don't guess method names.

## 1. Pick the mode

| The user wants to… | Mode | Procedure |
|---|---|---|
| Build a feature, mechanic, or prototype | **Build** | §2 build order, then §3–§6 |
| "It falls through the floor", "the signal never fires", "jitter", "null instance" | **Debug** | `references/debugging-and-testing.md`, in order |
| "Review my scripts or scenes" | **Review** | `references/review-checklist.md`. Optionally run `scripts/audit_godot.py` first |
| "Low FPS", "stutter", "too many draw calls" | **Optimize** | Profile first, then `references/rendering-and-performance.md` |
| "How should I structure my game?" | **Design** | `references/architecture.md` |

## 2. Build order: small, playable steps

Games are found by playing them. Build so that something is playable after every step, and judge each step by playing it, not by reading the code.

1. **Greybox the space.** Use CSG or simple meshes with collision, at real scale (1 unit = 1 meter). **Check:** the scale feels right from the camera.
2. **Core control.** The player controller and camera only (`references/character-and-camera.md`). **Check:** moving, turning, and jumping feel responsive with keyboard and with a gamepad.
3. **One core interaction**: the thing the game is about (petting, shooting, building, talking). Make it work crudely first. **Check:** does it work end to end?
4. **Feedback and feel.** Add animation, sound, camera response, particles, and timing tweaks (`references/animation-and-feel.md`). **Check:** does the interaction feel good with no explanation? Playtest it, ideally with someone else.
5. **Systems around it**: state, progression, UI, saving. **Check:** each system has one owner, and it can be tested in an isolated test scene.
6. **Content and polish**: real assets, lighting, levels. **Check:** you hit the performance budget on the weakest target device.

Rules:
- Keep each step to a scope you can test in a couple of minutes. Give every system its own **test scene** (`tests/scenes/` or `*_test.tscn`) that you can run with F6.
- Don't build content (step 6) before the core interaction (steps 3–4) is fun. Don't build systems for content that doesn't exist yet.
- When something feels wrong, change one variable at a time and expose tuning values with `@export` so they can be tweaked in the inspector while the game runs.

## 3. Architecture non-negotiables

Full guidance: `references/architecture.md`.

1. **Scenes are components.** Each scene works when run on its own (F6) or with minimal setup. It exposes its configuration through `@export` and its events through signals.
2. **Call down, signal up.** A parent calls methods on its children directly. Children notify their parents and siblings through signals. Never reach up the tree with `get_parent().get_parent()` or `get_node("../../X")`.
3. **Reference nodes stably.** Use `@onready var x: Type = %UniqueName` (scene-unique names), or `@export var x: Type` assigned in the inspector. Avoid long string paths.
4. **Data lives in Resources.** Use custom `class_name … extends Resource` for stats, items, tuning, and dialogue. Nodes hold runtime state; Resources hold authored data. Call `duplicate()` before mutating a shared Resource per instance.
5. **Use autoloads sparingly**: only for truly global services (game state, save system, audio manager, scene transitions). An autoload that grows into a god object, or an event bus carrying every signal, hides your dependencies.
6. **Use state machines when behavior has modes.** For a few states, an `enum` plus `match` in one script. For complex per-state logic, node-based states. Don't build a framework for three states.
7. **Composition over inheritance.** Reuse behavior through child component scenes (HealthComponent, Hitbox, Interactable) once it's needed in two or more places. Keep inheritance shallow (one or two levels).

## 4. GDScript non-negotiables

Full guidance: `references/gdscript.md`.

1. **Static typing everywhere**: `var speed: float = 5.0`, `func hit(amount: int) -> void`, `Array[Enemy]`, `Dictionary[StringName, int]` (4.4+). Use `:=` only when the type is obvious from the right-hand side. Turn on the `untyped_declaration` warning. Typed code catches errors in the editor and runs faster.
2. **Godot 4 signal syntax**: `signal died(position: Vector3)`, `died.emit(global_position)`, `area.body_entered.connect(_on_body_entered)`.
3. **Use the right callback:**
   - `_physics_process(delta)`: movement, physics queries, gameplay simulation.
   - `_process(delta)`: visuals, UI, interpolation.
   - `_unhandled_input(event)`: gameplay input, so the UI can consume events first.
   - `_ready()`: setup, which runs after the node's children are ready.
4. **Frame-rate independence.** Multiply by `delta`. For smoothing, use `1.0 - exp(-rate * delta)` as the lerp weight, never a constant like `lerp(a, b, 0.1)`.
5. **Input through the InputMap** (actions), never raw keycodes in gameplay code. Use `Input.get_vector()` for movement.
6. **Freed objects.** `queue_free()` is deferred to the end of the frame. Check `is_instance_valid(obj)` before using a reference that could have been freed. Disconnecting is automatic for the freed node's own signals, but not for references you've stored.

## 5. Physics and movement non-negotiables

Full guidance: `references/physics.md` and `references/character-and-camera.md`.

1. **Choose the body type by who controls it:**
   - `CharacterBody3D`: your code moves it (player, NPCs).
   - `RigidBody3D`: the physics simulation moves it (props, debris).
   - `StaticBody3D`: it never moves.
   - `AnimatableBody3D`: moving platforms driven by animation or code.
   - `Area3D`: detection only.
2. **Never scale physics bodies or collision shapes non-uniformly.** Change the shape's size properties instead. Never set a `RigidBody3D`'s transform every frame; apply forces or impulses, or use `_integrate_forces`.
3. **Plan collision layers and masks and name them** in Project Settings → Layer Names. "Layer" means what I am; "mask" means what I detect.
4. **Change physics state from physics callbacks only with deferred calls.** Use `shape.set_deferred("disabled", true)` and `call_deferred("add_child", node)` inside `body_entered` and similar callbacks.
5. **Do physics space queries** (`intersect_ray`, shape casts) in `_physics_process`. Use `RayCast3D` or `ShapeCast3D` nodes for persistent checks.
6. **Turn on physics interpolation** (4.4+, `physics/common/physics_interpolation`) for smooth motion on high-refresh displays. Call `reset_physics_interpolation()` after teleporting a node.

## 6. Performance non-negotiables

Full guidance: `references/rendering-and-performance.md`.

1. **Measure before optimizing.** Use the Debugger → Profiler, the Visual Profiler, and Monitors (FPS, draw calls, objects, physics) on the target hardware.
2. **Pick the renderer for the target:** Forward+ for desktop, Mobile for mobile and low-end hardware, Compatibility for web and very old GPUs. This decides which lighting features are available.
3. **Choose lighting deliberately:** baked `LightmapGI` for static scenes, `VoxelGI` or `SDFGI` (Forward+ only) for dynamic GI, and limited shadow-casting lights.
4. **Reduce draw calls:** `MultiMeshInstance3D` for repeated objects, shared materials, mesh LOD (automatic on import), visibility ranges, and occlusion culling for indoor or dense scenes.
5. **Don't process what isn't seen.** Disable processing for idle or offscreen nodes (`set_physics_process(false)`, `VisibleOnScreenNotifier3D`). Don't allocate or `load()` inside per-frame callbacks.

## 7. Gotchas

- `@onready` variables are `null` until `_ready()`. A setter on an `@export` variable can run before `_ready()` (when the scene loads), so guard with `if not is_node_ready(): return`.
- `move_and_slide()` uses the `velocity` property and takes no arguments. `is_on_floor()` is only valid **after** `move_and_slide()` has run that frame.
- Godot's forward is **−Z**, while imported glTF characters usually face **+Z**. Use `look_at(target, Vector3.UP, true)` (`use_model_front`), or rotate the model inside its scene. Don't fix it in gameplay code.
- `look_at()` fails when the target is at the same position or straight up or down. Guard against these cases.
- Repeatedly rotating a `Basis` accumulates floating-point error. Call `orthonormalized()` occasionally, and interpolate with `Quaternion.slerp` or `Basis.slerp` rather than lerping Euler angles.
- Materials and Resources are **shared** between instances. Changing `mesh.material.albedo_color` on one enemy changes all of them. Use `resource_local_to_scene`, `duplicate()`, a material override per instance, or instance shader parameters.
- `global_position` and `global_transform` can't be set before the node is inside the tree. Set them after `add_child()` (or set the local `position` before).
- Signal callbacks keep running on objects that are about to be freed. Tweens bound with `create_tween()` die with their node, but `get_tree().create_tween()` tweens don't.
- `await` in a function whose node was freed resumes on a freed object. Check `is_instance_valid(self)` after long awaits, or avoid them.
- `NavigationAgent3D` returns no path on the first physics frame because the map hasn't synced yet. Wait one physics frame (`await get_tree().physics_frame`) before setting the first target.
- Collision layer numbers in the editor UI are 1-based, but bit values in code aren't. Use `set_collision_layer_value(3, true)` instead of hand-writing bitmasks.
- `class_name` names are global. Two scripts with the same `class_name` break the project.
- `preload()` takes a constant path and loads at parse time. `load()` happens at runtime and blocks. Use `ResourceLoader.load_threaded_request` for large scenes.
- **Never load `.tres` or `.res` files from user-writable locations** (`user://`, downloads, mods) unless you trust them. Resources can embed scripts that execute when loaded. Use JSON or `ConfigFile` for save data.
- Input actions checked in `_process` and `_physics_process` both work, but read movement in `_physics_process` and one-shot UI actions in `_unhandled_input`.

## 8. Output expectations

- Typed GDScript 2.0 for the project's Godot version, with complete scripts (no `pass` placeholders where logic is expected). Use `@export` for tuning values, signals for events, and the right process callback.
- When creating or changing scenes, describe the node tree explicitly, for example:
  ```
  Player (CharacterBody3D)
  ├─ CollisionShape3D (CapsuleShape3D r=0.4 h=1.8)
  ├─ Model (Node3D)  ← imported .glb instance
  └─ CameraPivot (Node3D) > SpringArm3D > Camera3D
  ```
  Also say which properties to set in the inspector. Edit `.tscn` files by hand only when necessary; the text format is fragile with UIDs and sub-resource ids.
- State the assumptions you made: version, renderer, physics engine, input action names.
- When reviewing, order findings by impact: crashes and broken gameplay → physics and lifecycle bugs → architecture coupling → performance (measured or clearly costly) → style.
- Explain tuning values in terms of feel ("acceleration 40 means about 0.15s to reach full speed").

## Reference map

| Read | When |
|---|---|
| `references/architecture.md` | Structuring scenes, communication, autoloads, Resources, state machines, components, folder layout, when (not) to use ECS or servers |
| `references/gdscript.md` | Writing GDScript: typing, signals, await, exports, tool scripts, Godot 3→4 migration, C# notes |
| `references/character-and-camera.md` | Player controllers (third- and first-person), jumping, slopes, camera rigs, mouse look, gamepad |
| `references/physics.md` | Body types, layers and masks, Jolt, raycasts and shape casts, Area3D, rigid-body control, deferred changes |
| `references/ai-and-navigation.md` | NPCs and creatures: navigation, avoidance, perception, state machines, utility AI, companion behavior |
| `references/animation-and-feel.md` | AnimationTree, blend spaces, root motion, IK, tweens, game feel and "aliveness", camera shake, hit-stop |
| `references/rendering-and-performance.md` | Renderer choice, lighting and GI, materials and shaders, profiling, draw calls, LOD, culling, mobile |
| `references/assets-pipeline.md` | Importing glTF and .blend, scale and orientation, collision import suffixes, materials, animation import |
| `references/ui-audio-save.md` | HUD and menus, 3D world UI, audio buses and 3D sound, save and load, settings |
| `references/debugging-and-testing.md` | Any bug (ordered workflow), debugging tools, unit and scene tests, headless runs |
| `references/review-checklist.md` | Reviewing scripts, scenes, or a project |
| `scripts/audit_godot.py` | Heuristic project scan: `python3 scripts/audit_godot.py <project_dir>` |
