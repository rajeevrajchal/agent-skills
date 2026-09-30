# Architecture

The right Godot architecture is usually less than you think. Scenes, nodes, signals, groups, and Resources already give you composition, messaging, and data-driven design. Add structure when a concrete problem appears — a second entity type that needs the same behavior, a designer who needs to tune data, a bug caused by unclear ownership — not in anticipation.

## Project layout

Organize by feature, not by file type:

```
res://
├── actors/
│   ├── player/        player.tscn, player.gd, player_stats.tres, sprites/
│   └── enemies/
│       ├── slime/     slime.tscn, slime.gd, slime_stats.tres
│       └── enemy_stats.gd          # shared Resource class
├── levels/            level_01.tscn, level_base.gd
├── ui/                hud.tscn, pause_menu.tscn, theme.tres
├── systems/           save_manager.gd (autoload), audio_manager.gd (autoload)
├── shared/            hitbox.gd, hurtbox.gd, health_component.gd  (only if reused)
└── main.tscn
```

A feature folder holds everything needed to delete or move that feature. `scripts/`, `scenes/`, `textures/` top-level folders scatter one feature across the project.

## Ownership: who creates, who frees, who holds state

Every piece of state has exactly one owner node. Others read it through signals or a reference passed down.

| State | Typical owner |
|---|---|
| Player health, ammo, position | Player scene |
| Enemies alive, wave progress | Level (or a `WaveSpawner` child of the level) |
| Score for this run | Level or a `Run` node under `Main`, not an autoload |
| Settings, unlocked levels, save slots | `SaveManager` autoload |
| Current scene, transitions | `Main` scene or a `SceneManager` autoload |

When the level is freed, everything it owns is freed. If state must survive level reloads (score across levels), move ownership up one level (`Main`), still not necessarily into an autoload.

## Communication patterns

| Situation | Pattern |
|---|---|
| Parent tells child to do something | Direct method call: `%Weapon.fire()` |
| Child reports an event | Signal; the parent connects |
| Sibling ↔ sibling | Parent wires them in its `_ready` (`hud.bind(player)` or connect player's signal to HUD method) |
| One-to-many broadcast to unknown receivers | Group call: `get_tree().call_group(&"enemies", &"on_alarm")` |
| Collision says "you hit something" | The receiver checks type/group: `if body.has_method(&"take_damage")` or `if body is Damageable` |
| Truly global event with many unrelated listeners (achievements, analytics, tutorial triggers) | An `Events` autoload holding only signals — as a last resort, not the default |

The global event bus is attractive because it removes wiring, and that's its cost: you lose the ability to see who talks to whom, and every scene now depends on the bus. Use it only for events whose listeners genuinely span the whole game.

Wiring siblings through the parent:

```gdscript
# level.gd
@onready var _player: Player = %Player
@onready var _hud: Hud = %Hud

func _ready() -> void:
	_player.health_changed.connect(_hud.set_health)
	_player.died.connect(_on_player_died)
```

The HUD has no idea a Player exists; it exposes `set_health(current, maximum)`. Both scenes stay testable in isolation.

## Autoloads

Legitimate autoloads: save/settings persistence, audio bus/music manager, scene transition manager, input-rebinding persistence, a platform/services wrapper (achievements, analytics). Warning signs:

- Holding references to nodes that belong to a level (`Global.player`) — they go stale when the level reloads and cause null errors.
- Storing gameplay state "because it's convenient" — it survives reloads you wanted to reset and makes tests order-dependent.
- Five+ autoloads calling each other — you've built a hidden global object graph.

If you need a player reference globally, use a group (`get_tree().get_first_node_in_group(&"player")`) queried when needed, not cached forever.

## Scene switching

Small games: `get_tree().change_scene_to_file("res://levels/level_02.tscn")` or `change_scene_to_packed()`. It frees the current scene at the end of the frame; autoloads survive.

When you need a loading screen, a persistent HUD, or transitions, use a `Main` scene that owns a `LevelContainer` and swaps children:

```gdscript
# main.gd
@onready var _level_container: Node = %LevelContainer
var _current_level: Node

func load_level(path: String) -> void:
	if _current_level:
		_current_level.queue_free()
	var scene := load(path) as PackedScene
	_current_level = scene.instantiate()
	_level_container.add_child(_current_level)
```

For large levels use threaded loading (`references/save-load-and-data.md`).

## State machines

Start here:

```gdscript
enum State { IDLE, RUN, JUMP, FALL }
var _state: State = State.IDLE

func _physics_process(delta: float) -> void:
	match _state:
		State.IDLE, State.RUN:
			_ground_move(delta)
			if Input.is_action_just_pressed(&"jump"):
				_enter(State.JUMP)
		State.JUMP:
			_air_move(delta)
			if velocity.y > 0.0:
				_enter(State.FALL)
		State.FALL:
			_air_move(delta)
			if is_on_floor():
				_enter(State.IDLE)
	move_and_slide()

func _enter(new_state: State) -> void:
	if new_state == _state:
		return
	_state = new_state
	match new_state:
		State.JUMP:
			velocity.y = -jump_velocity
			_sprite.play(&"jump")
		State.IDLE:
			_sprite.play(&"idle")
		...
```

Promote to node-per-state (`StateMachine` node with `State` children implementing `enter/exit/physics_update`) when:
- There are more than ~6–8 states, **and** states carry their own data or timers, **or**
- Designers need to configure states per-entity in the editor, **or**
- Several entity types share the same states.

For animation-driven states (attack windows, combos), `AnimationTree`'s state machine can *be* the state machine; don't duplicate it in code.

Hierarchical state machines, pushdown automata, and behavior trees are for AI with many behaviors. Don't reach for them for a player controller.

## Components

A component is a child node with a focused responsibility, used by *different* entity types:

```gdscript
# shared/health_component.gd
class_name HealthComponent
extends Node

signal changed(current: int, maximum: int)
signal depleted

@export var max_health: int = 10
var current: int

func _ready() -> void:
	current = max_health

func damage(amount: int) -> void:
	if current == 0:
		return
	current = maxi(current - amount, 0)
	changed.emit(current, max_health)
	if current == 0:
		depleted.emit()
```

Used by Player, enemies, and destructible crates → it earns its existence. Used only by the player → it's indirection; keep `health` in `player.gd`.

The classic trio `Hitbox` (Area that deals damage) + `Hurtbox` (Area that receives it) + `HealthComponent` is worth it in action games with many damage sources. Put hitboxes and hurtboxes on dedicated collision layers.

## Data-driven design with Resources

```gdscript
# actors/enemies/enemy_stats.gd
class_name EnemyStats
extends Resource

@export var max_health: int = 3
@export var move_speed: float = 80.0
@export var contact_damage: int = 1
@export var drops: Array[LootEntry] = []
```

Designers create `slime_stats.tres`, `bat_stats.tres` in the FileSystem dock and tune them in the Inspector. Code reads `stats.move_speed`. Rules:

- Resources are shared: `duplicate()` (or `duplicate(true)` for nested resources/arrays of resources) before storing per-instance runtime values in them — or keep runtime values (current health) in the node and treat the Resource as read-only config. The second is simpler.
- Resources are for authored data. Runtime save state goes to a save file (see `save-load-and-data.md`).
- Don't build a generic "data registry" autoload that loads every `.tres` at startup until you actually need lookups by ID (e.g. save files referencing items). Then it's justified.

## ECS, servers, and scale

Godot's node tree is not an ECS, and bolting one on (via GDScript) costs more than it saves for almost every game. Choose by count and behavior:

| Instances | Approach |
|---|---|
| < ~500 active, individual behavior | Normal scenes/nodes |
| Thousands, identical visuals, simple motion | One manager node + `MultiMeshInstance2D/3D`; positions in a `PackedVector2Array`; update in one loop |
| Thousands with collision | Manager node using `PhysicsServer2D/3D` (shapes/areas) or spatial hashing in code |
| Pure visual particles | `GPUParticles2D/3D` (or `CPUParticles` for Compatibility / deterministic control) |
| Heavy simulation logic | GDExtension (C++/Rust) or C# for that one system |

Measure first (`references/performance.md`). A bullet-hell with 2000 bullets needs the second row; a platformer with 40 enemies does not.

## Anti-patterns to name in reviews

- `get_parent().get_parent().get_node("HUD")` — upward/brittle path coupling.
- Autoload as a dumping ground (`Global.gd` with 60 variables).
- `Manager` classes for things that already have an owner node (`EnemyManager` that duplicates what the level does).
- A base class hierarchy `Entity → Character → Enemy → FlyingEnemy → Bat` five levels deep; prefer composition via scenes and small components.
- A generic event bus signal for every interaction, including parent-child ones.
- Premature object pooling in GDScript without profiler evidence (instancing a small scene is cheap; pooling adds reset bugs).
- Scenes that can't run standalone because they `get_node("/root/Main/...")` in `_ready`.
