# GDScript (Godot 4)

Typed, explicit, boring. GDScript rewards simple code: fewer layers, direct node references, signals for events.

## Script skeleton and ordering

Follow the official style guide order so every script reads the same way:

```gdscript
@tool                                   # only if it must run in the editor
class_name Enemy                        # only if other scripts refer to this type
extends CharacterBody2D
## One-line doc comment: what this node is responsible for.

signal died(enemy: Enemy)
signal health_changed(current: int, maximum: int)

enum State { IDLE, CHASE, ATTACK, DEAD }

const KNOCKBACK_DECAY := 8.0

@export var stats: EnemyStats
@export_group("Movement")
@export var move_speed: float = 120.0
@export_range(0.0, 2000.0, 10.0, "suffix:px/s²") var acceleration: float = 900.0

var state: State = State.IDLE
var _health: int

@onready var _sprite: AnimatedSprite2D = %Sprite
@onready var _hurtbox: Area2D = %Hurtbox


func _ready() -> void:
	stats = stats.duplicate()   # shared Resource → per-instance copy
	_health = stats.max_health


func _physics_process(delta: float) -> void:
	...


func take_damage(amount: int) -> void:
	...


func _die() -> void:
	...
```

Order: annotations/class_name/extends → doc → signals → enums → constants → `@export` → public vars → private vars (`_` prefix) → `@onready` → built-in virtuals (`_init`, `_ready`, `_process`, `_physics_process`, `_input`…) → public methods → private methods. `snake_case` for functions/variables/files, `PascalCase` for classes/nodes, `CONSTANT_CASE` for constants and enum members.

Use `class_name` only when other code needs the type (type hints, `is` checks, `instantiate() as Enemy`). Registering every script globally clutters the Create Node dialog.

## Static typing

```gdscript
var speed: float = 200.0          # explicit
var direction := Vector2.ZERO     # inferred — fine when the RHS type is obvious
var enemies: Array[Enemy] = []    # typed array
var costs: Dictionary[StringName, int] = {}   # typed dictionary (4.4+)

func find_nearest(from: Vector2, candidates: Array[Node2D]) -> Node2D:
	var best: Node2D = null
	var best_d := INF
	for c in candidates:
		var d := from.distance_squared_to(c.global_position)
		if d < best_d:
			best_d = d
			best = c
	return best
```

- `:=` fails if the RHS type is Variant (e.g. `var x := dict["k"]`); annotate explicitly or cast: `var hp := dict["hp"] as int`.
- `as` returns `null` on failed object casts — check it: `var enemy := body as Enemy` then `if enemy:`.
- Enable `untyped_declaration`, `unsafe_property_access`, `unsafe_method_access` warnings in Project Settings → Debug → GDScript for strictness in new projects.
- `StringName` (`&"idle"`) for animation names, action names, group names compared often; `NodePath` (`^"path"`) rarely needed directly.

## Signals

```gdscript
signal health_changed(current: int, maximum: int)

func take_damage(amount: int) -> void:
	_health = maxi(_health - amount, 0)
	health_changed.emit(_health, stats.max_health)
	if _health == 0:
		_die()
```

Connecting:

```gdscript
# In the parent that instanced the child ("call down, signal up")
func _spawn_enemy(at: Vector2) -> void:
	var enemy := ENEMY_SCENE.instantiate() as Enemy
	enemy.global_position = at
	enemy.died.connect(_on_enemy_died)
	add_child(enemy)

func _on_enemy_died(enemy: Enemy) -> void:
	_score += enemy.stats.score_value
```

- Bind extra args: `button.pressed.connect(_on_slot_pressed.bind(slot_index))`.
- One-shot: `door.opened.connect(_on_door_opened, CONNECT_ONE_SHOT)`.
- Editor connections (Node dock) are fine for scene-internal wiring; code connections are better for dynamically spawned nodes and are visible in review.
- Don't emit signals for things only the emitter's own script cares about — just call the function.
- Signal names are past-tense events (`died`, `item_collected`), not commands (`kill_player`).

## await / coroutines

```gdscript
func _flash() -> void:
	_sprite.modulate = Color.RED
	await get_tree().create_timer(0.1, false).timeout   # false = pauses with the tree
	if not is_instance_valid(self) or not is_inside_tree():
		return
	_sprite.modulate = Color.WHITE
```

- A function containing `await` is a coroutine; calling it without `await` runs until the first `await` and returns immediately.
- If the node is freed while awaiting, the coroutine does not resume on it — but any **other** object it references may have been freed. Re-validate references after every `await`.
- Don't use `await` chains to sequence gameplay that must be cancellable (stun interrupting an attack). Use a state enum or an `AnimationPlayer`/`Tween` you can stop.
- `await get_tree().process_frame` as a fix for ordering issues is a smell — find which `_ready` runs first and move initialization to the owner.

## Setters, getters, and Inspector-driven updates

```gdscript
@tool
extends Node2D

@export var radius: float = 32.0:
	set(value):
		radius = maxf(value, 1.0)
		if is_node_ready():
			_update_shape()

@onready var _shape: CollisionShape2D = $CollisionShape2D

func _ready() -> void:
	_update_shape()

func _update_shape() -> void:
	(_shape.shape as CircleShape2D).radius = radius
```

Setters for exported vars run when the scene loads, *before* `@onready` vars are assigned — hence the `is_node_ready()` guard plus the call in `_ready()`.

## `@tool` scripts

Run in the editor, so they can corrupt scenes. Guard gameplay: `if Engine.is_editor_hint(): return` in `_process`/`_physics_process`. Never `queue_free()` or add persistent children in editor mode unless that's the point (and then set `owner` so they save). Use `update_configuration_warnings()` + `_get_configuration_warnings()` to tell designers about missing setup instead of crashing.

## Instancing scenes

```gdscript
const BULLET_SCENE: PackedScene = preload("res://weapons/bullet.tscn")

func _fire() -> void:
	var muzzle: Marker2D = %Muzzle
	var bullet := BULLET_SCENE.instantiate() as Bullet
	bullet.direction = muzzle.global_transform.x.normalized()   # plain data: safe before add_child
	get_tree().current_scene.add_child(bullet)   # not add_child(): bullets must not move with the gun
	bullet.global_transform = muzzle.global_transform          # global_* only once in the tree
```

- `preload` for small scenes needed immediately; `load` / `ResourceLoader.load_threaded_request` for big ones (levels).
- Set plain data **before** `add_child` when `_ready` depends on it. Set `global_position`/`global_transform` **after** `add_child` — global transforms are only meaningful inside the tree. (Local `position` can be set either way.)
- Better than `current_scene.add_child`: an exported/`%` reference to a dedicated `Projectiles` container node the level owns.

## Error handling

GDScript has no exceptions. Use:
- `assert(cond, "message")` for programmer errors (stripped from release builds — never put side effects inside).
- `push_error()` / `push_warning()` for recoverable problems; they appear in the Debugger with a stack trace.
- `Error` return codes from engine APIs: `var err := FileAccess.get_open_error()`, `if err != OK:`.
- Return `null` / an empty typed value and document it, rather than silently continuing with bad state.

## Useful idioms

- `get_tree().call_group(&"enemies", &"alert", player_pos)` — broadcast without holding references.
- `is_in_group(&"player")` over checking class names in collision callbacks — or `body is Player` with `class_name`.
- `Engine.get_physics_frames()` / `Time.get_ticks_msec()` for timestamps (coyote time, input buffering).
- `move_toward(current, target, step)` for linear approach; `lerp` with exponential decay for smoothing.
- `static func` for pure helpers in a `class_name` utility script; don't create an autoload just to host functions.
- Inner classes (`class Hit:`) for small data containers; `RefCounted` subclasses for non-node logic objects (pathfinding helpers, inventory model) — they're freed automatically when unreferenced. Plain `Object` subclasses leak unless freed manually.
