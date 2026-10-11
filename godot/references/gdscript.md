# GDScript (Godot 4)

## Contents
- Style and typing
- Exports
- Signals, callables, lambdas
- await and coroutines
- Lifecycle order
- Tool scripts
- Godot 3 → 4 migration table
- Newer language features by version
- C# notes

## Style and typing

Follow the official GDScript style guide: tabs for indentation, `snake_case` for variables and functions, `PascalCase` for classes and nodes, `CONSTANT_CASE` for constants, and a leading `_` on private members and callbacks.

Script order: `class_name` → `extends` → doc comment → signals → enums → constants → `@export` vars → public vars → private vars → `@onready` vars → `_init`/`_ready`/other virtual methods → public methods → private methods.

```gdscript
class_name Creature
extends CharacterBody3D
## A wandering creature that reacts to the player.

signal mood_changed(mood: Mood)

enum Mood { CALM, CURIOUS, EXCITED, SLEEPY }

const ARRIVE_DISTANCE: float = 0.4

@export var traits: CreatureTraits
@export_range(0.0, 20.0, 0.1) var acceleration: float = 8.0

var mood: Mood = Mood.CALM:
	set(value):
		if value == mood:
			return
		mood = value
		mood_changed.emit(mood)

var _target: Vector3

@onready var _agent: NavigationAgent3D = %NavigationAgent3D
@onready var _anim_tree: AnimationTree = %AnimationTree
```

Typing rules:
- Annotate parameters, return types (`-> void`), and member variables.
- Use typed collections: `Array[Node3D]`, `Dictionary[StringName, float]` (typed dictionaries since 4.4).
- Cast nodes with `as` when needed: `var body := node as CharacterBody3D` (gives `null` if the type doesn't match). Check it before use.
- Enable warnings: Project Settings → Debug → GDScript → `untyped_declaration`, `unsafe_*`. Set them to Warn, or Error in strict projects.
- Use `StringName` (`&"run"`) for frequently compared identifiers (animation names, input actions, groups).

## Exports

```gdscript
@export var target: Node3D                         # node reference assigned in the inspector
@export var traits: CreatureTraits                 # Resource
@export_range(0.0, 10.0, 0.1, "suffix:m/s") var speed: float = 4.0
@export_enum("Walk", "Run") var gait: String = "Walk"
@export_flags_3d_physics var sight_mask: int = 1   # physics layer picker
@export_group("Jump")
@export var jump_height: float = 1.2
@export var coyote_time: float = 0.12
@export_category("Debug")
@export var draw_debug: bool = false
@export_tool_button("Rebuild", "Reload") var rebuild := _rebuild  # 4.4+, @tool scripts only
```
- Prefer exported node references over hard-coded paths when the relationship is configured per instance.
- Exported setters run when the scene loads, which can be before `_ready`. Guard with `if not is_node_ready(): return`.

## Signals, callables, lambdas

```gdscript
signal picked_up(item: ItemData)

func _ready() -> void:
	%Area3D.body_entered.connect(_on_body_entered)
	%Timer.timeout.connect(func() -> void: _blink(), CONNECT_ONE_SHOT)
	picked_up.connect(_on_picked_up.bind(&"bonus"))   # bound extra arguments come after the signal's

func _on_body_entered(body: Node3D) -> void:
	if body is Player:
		picked_up.emit(item)
```
- Don't connect inside `_process`. Connect once in `_ready()`, and check `is_connected` if code might connect twice.
- Lambdas capture variables **by value at creation** for locals (they're copies), but objects are references.
- Connections are removed automatically when either object is freed. Stored `Callable`s to freed objects become invalid; check `callable.is_valid()`.

## await and coroutines

```gdscript
func play_greeting() -> void:
	_anim_tree.set(&"parameters/Greet/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_FIRE)
	await get_tree().create_timer(0.6).timeout
	if not is_instance_valid(self) or not is_inside_tree():
		return
	_bark()
```
- `await signal` suspends until the signal fires. If it never fires, the function never resumes; this is a common source of "nothing happens".
- `get_tree().create_timer()` keeps running while paused unless you pass `process_always = false`. Pass `false` for gameplay delays that should respect pause.
- For gameplay timing that must pause, cancel, or be inspected, a `Timer` node or a state with a countdown is clearer than chains of awaits.

## Lifecycle order

1. `_init()`: the object exists; it isn't in the tree and has no children yet.
2. `_enter_tree()`: added to the tree (top-down: parent before children).
3. `_ready()`: once, **children first, then parent** (bottom-up). `@onready` vars are assigned just before.
4. `_process` and `_physics_process` every frame or tick, in tree order (adjust with `process_priority` and `process_physics_priority`).
5. `_exit_tree()`: on removal. Clean up global connections here.
6. `NOTIFICATION_PREDELETE` (via `_notification`) just before freeing.

Re-adding a removed node calls `_enter_tree` again, but not `_ready` (unless `request_ready()` is called).

## Tool scripts

`@tool` scripts run in the editor. Guard runtime-only code with `if Engine.is_editor_hint(): return`. Tool scripts that modify the scene tree, or that error in `_process`, can corrupt scenes or spam errors. Keep them minimal and test them on a copy.

## Godot 3 → 4 migration table

| Godot 3 | Godot 4 |
|---|---|
| `Spatial` | `Node3D` |
| `KinematicBody` | `CharacterBody3D` |
| `RigidBody`, `StaticBody`, `Area` | `RigidBody3D`, `StaticBody3D`, `Area3D` |
| `MeshInstance`, `Camera`, `Position3D` | `MeshInstance3D`, `Camera3D`, `Marker3D` |
| `translation` | `position` |
| `move_and_slide(velocity, Vector3.UP)` | set `velocity` and `up_direction`, then `move_and_slide()` |
| `export var x = 1` | `@export var x: int = 1` |
| `onready var n = $N` | `@onready var n: Node3D = $N` |
| `tool` | `@tool` |
| `yield(obj, "signal")` | `await obj.signal` |
| `connect("sig", self, "_m")` | `sig.connect(_m)` |
| `emit_signal("sig", a)` | `sig.emit(a)` (the old form still works) |
| `setget set_x, get_x` | `var x: int: set = set_x, get = get_x` or inline `set(value):` |
| `scene.instance()` | `scene.instantiate()` |
| `File`, `Directory` | `FileAccess`, `DirAccess` (static open methods) |
| `OS.get_ticks_msec()` | `Time.get_ticks_msec()` |
| `rand_range`, `stepify`, `deg2rad` | `randf_range`, `snapped`, `deg_to_rad` |
| `Transform`, `Quat`, `xform()` | `Transform3D`, `Quaternion`, the `*` operator |
| `PoolStringArray` | `PackedStringArray` |
| `BUTTON_LEFT` | `MOUSE_BUTTON_LEFT` |
| `get_world()` | `get_world_3d()` |
| `funcref(obj, "m")` | `obj.m` (Callable) or `Callable(obj, "m")` |

## Newer language features by version

Check the project's version before using these:
- **4.2**: `Node3D.global_basis`; `look_at(..., use_model_front)`.
- **4.3**: `PhysicsBody3D.get_gravity()` (gravity including areas).
- **4.4**: typed dictionaries; `@export_tool_button`; 3D physics interpolation; Jolt integrated as an option.
- **4.5**: abstract classes and methods (`@abstract`); variadic functions (`...args`).
- **4.6**: Jolt is the default 3D physics engine for new projects; the modular IK nodes (`TwoBoneIK3D`, `FABRIK3D`…).
- **4.7**: `AreaLight3D`; HDR output; built-in virtual joystick; Path3D collider snapping in the editor.

If you're not sure whether an API exists in the project's version, check the class reference for that version.

## C# notes

- Use the .NET build of Godot. Class names match the API with PascalCase methods (`MoveAndSlide()`, `GetNode<Camera3D>("%Camera")`).
- Signals: `[Signal] public delegate void DiedEventHandler(Vector3 position);` then `EmitSignal(SignalName.Died, pos)`, or C# events.
- Exports: `[Export] public float Speed { get; set; } = 4f;`
- Marshalling between C# and the engine has a cost. Cache node references, and avoid calling `GetNode` every frame.
- Use C# collections for internal logic and Godot collections (`Godot.Collections.Array<T>`) only at engine boundaries.
- Web export has historically not supported C# in Godot 4. Check the current status for your version before choosing C# for a web target.
