# Architecture

## Contents
- Mental model
- Scene design rules
- Communication: who talks to whom
- Autoloads
- Resources as data
- State machines
- Components vs inheritance
- Folder layout
- Scaling up: servers, MultiMesh, and when ECS-like data helps
- Anti-patterns

## Mental model

- A **node** does one job (render a mesh, detect overlap, play a sound).
- A **scene** is a tree of nodes saved as a reusable unit: a player, a door, an enemy, a HUD, a level.
- A **script** adds behavior to one node, usually the scene's root.
- A **Resource** is shareable, serializable data (meshes, materials, and your own data types).
- **Signals** are events. **Groups** are tags for broadcast and lookup.

Design scenes the way you'd design functions: one responsibility, clear inputs (`@export`), and clear outputs (signals).

## Scene design rules

1. **Runs alone.** Pressing F6 on any scene should not crash it. Missing dependencies are optional or have sane defaults, and the scene can say so with `push_warning`.
2. **Configured from outside.** Use `@export` for tuning and references. The parent or level sets these, or the inspector does.
3. **Speaks through signals.** `opened`, `died(position)`, `item_collected(item: ItemData)`.
4. **The root script owns the scene's public API.** Other scenes call methods on the root, never on its internal children.
5. **Instanced, not copied.** Reuse with scene instances and inherited scenes, not duplicated node trees.
6. **Level scenes compose** gameplay scenes. They don't contain gameplay logic.

## Communication: who talks to whom

| Relationship | Mechanism |
|---|---|
| Parent → child | Direct method call or property set (`$%Door.open()`) |
| Child → parent | A signal the parent connects to |
| Siblings | The parent wires them together (connects A's signal to B's method) |
| Many senders → one listener, or one → many | Groups (`get_tree().call_group("enemies", "alert", pos)`) or signals |
| Truly global events (game paused, level loaded, settings changed) | A small autoload with a few signals |
| Detect "what is this body?" | `body.is_in_group("player")`, or `body is Player` with `class_name`, or `body.has_method("take_damage")` for duck-typed interfaces |

```gdscript
# Level.gd: wires siblings together; neither child knows about the other
func _ready() -> void:
	%PressurePlate.activated.connect(%Gate.open)
	%PressurePlate.deactivated.connect(%Gate.close)
```

Avoid:
- `get_parent().get_parent().do_thing()`: breaks when the tree changes.
- `get_node("/root/Main/World/Player")`: an absolute path couples the code to one scene layout.
- One global event bus for everything: it makes the flow invisible. Keep bus signals for global, cross-cutting events.

## Autoloads

Good uses: `GameState` (persistent run data), `SaveSystem`, `AudioManager` (music and buses), `SceneLoader` (transitions), `Settings`.

Rules:
- Each autoload has one responsibility and a small API.
- Autoloads don't hold references to level nodes that can be freed. If they must, they check `is_instance_valid`.
- Gameplay scenes still run when an autoload isn't present (for test scenes), or the dependency is obvious and documented.
- Prefer an autoload *scene* (`.tscn`) when it needs child nodes (`AudioStreamPlayer`s, timers).

## Resources as data

```gdscript
# res://data/creature_traits.gd
class_name CreatureTraits
extends Resource

@export var display_name: String = "Dog"
@export_range(0.5, 8.0, 0.1, "suffix:m/s") var walk_speed: float = 1.6
@export_range(0.0, 1.0) var curiosity: float = 0.6
@export var favorite_toys: Array[StringName] = []
```
- Author instances as `.tres` files in the editor. Designers tweak them without touching code.
- Resources loaded from disk are **cached and shared**: two nodes that `load()` the same `.tres` get the same object. Call `duplicate()` (or `duplicate(true)` for nested Resources) before mutating per instance, or keep mutable runtime state on the node.
- Use Resources for authored data (stats, items, dialogue, wave definitions). Don't use them for save files from untrusted locations (see `ui-audio-save.md`).

## State machines

**Small (≤ about 5 states, simple transitions)**: an enum and a match statement in the owner script:

```gdscript
enum State { IDLE, WANDER, FOLLOW, SLEEP }
var _state: State = State.IDLE

func _physics_process(delta: float) -> void:
	match _state:
		State.IDLE: _tick_idle(delta)
		State.WANDER: _tick_wander(delta)
		State.FOLLOW: _tick_follow(delta)
		State.SLEEP: _tick_sleep(delta)

func _change_state(next: State) -> void:
	if next == _state:
		return
	_exit_state(_state)
	_state = next
	_enter_state(next)
```

**Larger (many states, each with substantial logic, or shared by several actors)**: node-based states, where each state is a child node with `enter()`, `exit()`, `physics_update(delta)`, and a `transition_requested(to: StringName)` signal. The machine node switches the active state.

**Animation states** belong in `AnimationTree`'s state machine. Gameplay states drive it (`playback.travel("Sleep")`). Don't duplicate gameplay logic in the animation graph.

Hierarchical states or behavior trees are justified only when you have real complexity (many shared transitions, behaviors you reuse across many NPC types). Start flat.

## Components vs inheritance

- **Inheritance** (`extends Enemy`) for genuine "is-a" relationships with shared core behavior. Keep it to one or two levels.
- **Component scenes** (child nodes) for capabilities that mix and match: `HealthComponent`, `HurtboxComponent`, `InteractableComponent`, `FootstepComponent`. The owner finds them with `@export` or `%Name`, and they communicate through signals.
- Extract a component when the second user appears, not before.
- **Duck typing** (`has_method("interact")`) is fine for simple cross-cutting interfaces. A `class_name` base or component check is clearer when the interface grows.

## Folder layout

Group by feature, not by file type, once the project grows:

```
res://
  autoload/           game_state.gd, save_system.gd, audio_manager.tscn
  actors/
    player/           player.tscn, player.gd, player_camera.tscn, player.glb
    creature/         creature.tscn, creature.gd, creature_traits.gd, dog.tres
  interactables/      door/, toy/, food_bowl/
  levels/             garden/, house/
  ui/                 hud/, menus/, theme.tres
  shared/             components/, shaders/, materials/
  data/               items/, dialogue/
  tests/              unit/, scenes/
```
Use snake_case for files and folders (case sensitivity differs between platforms and exported builds), PascalCase for `class_name` and node names.

## Scaling up: servers, MultiMesh, and when ECS-like data helps

Nodes have overhead (about a few hundred bytes plus a callback each). Most games never hit the limits. When you need thousands of similar entities (bullets, crowds, grass, boids):
1. **First, cut per-node work**: disable `_process` on idle nodes, update in a manager on a timer, use `VisibleOnScreenNotifier3D`.
2. **Then go data-oriented**: one manager node holds packed arrays (positions, velocities) and updates them in a loop, rendering through `MultiMeshInstance3D` (instance transforms and colors) and using `PhysicsServer3D` or direct space queries instead of nodes.
3. **GDExtension (C++/Rust)** for hot loops that measure as too slow in GDScript.

This *is* the ECS idea (data in arrays, systems that loop over them), applied only where the entity count demands it. The rest of the game stays node-based. A full ECS framework on top of Godot fights the editor and is rarely worth it.

## Anti-patterns

- God scripts (more than about 400 lines doing input, movement, animation, UI, and saving in one place).
- Deep `get_parent()` chains and absolute node paths.
- Autoloads that grow into a second scene tree.
- Logic split between a script and many signal connections made in the editor that nobody can find (keep connections in code, or consistently in the editor; document which).
- Mutating shared Resources at runtime.
- Premature frameworks: state-machine libraries, DI containers, event buses, and ECS before there's a problem.
