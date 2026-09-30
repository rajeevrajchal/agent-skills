# Gameplay Systems: Input, UI, Animation, Audio, Navigation, Spawning

## Input

### Actions, not keys

Define every input as an action (Project Settings → Input Map) with keyboard, gamepad, and mouse events. Code refers only to action names:

```gdscript
var move := Input.get_vector(&"move_left", &"move_right", &"move_up", &"move_down")  # continuous → poll
func _unhandled_input(event: InputEvent) -> void:                                   # discrete → events
	if event.is_action_pressed(&"interact"):
		_interact()
		get_viewport().set_input_as_handled()
```

- Input propagation order: `_input` → Control `_gui_input` → `_shortcut_input` → `_unhandled_key_input` → `_unhandled_input`. Gameplay listens in `_unhandled_input` so open menus consume clicks/keys first.
- `is_action_pressed(action, allow_echo=false)` on events ignores key repeat by default; use `true` for menu navigation.
- Set per-action deadzones in the Input Map; `get_vector` applies them.
- Buffer inputs that matter for feel (jump, attack) with a short timer rather than requiring a frame-perfect press.

### Rebinding

```gdscript
func rebind(action: StringName, new_event: InputEvent) -> void:
	# Replace only the same device class so keyboard and gamepad bindings coexist.
	for existing in InputMap.action_get_events(action):
		if (existing is InputEventKey) == (new_event is InputEventKey):
			InputMap.action_erase_event(action, existing)
	InputMap.action_add_event(action, new_event)
```

Persist bindings (e.g. as `var_to_str` of events or keycodes in a `ConfigFile`) and re-apply at startup from the settings autoload.

## UI (Control nodes)

- **Containers do layout.** `VBoxContainer`, `HBoxContainer`, `GridContainer`, `MarginContainer`, `PanelContainer`. Size children with `size_flags` (Fill, Expand, stretch ratio) and `custom_minimum_size`, not by positioning manually.
- **Anchors** only for the top-level Control of a screen (full rect, top-right corner HUD). Children of containers ignore anchors.
- **Themes**: one project `Theme` resource (set in Project Settings → GUI → Theme → Custom) for fonts, colors, styleboxes. Use theme type variations for button styles; don't override per node.
- **Mouse filter**: `STOP` consumes clicks, `PASS` handles and passes up to parents, `IGNORE` is invisible to the mouse. Full-screen HUD roots and decorative containers → `IGNORE`, or clicks never reach the game world.
- **Gamepad/keyboard navigation**: call `grab_focus()` on the first button when a menu opens; set `focus_neighbor_*` where automatic neighbors are wrong. Test every menu without a mouse.
- **Resolution**: design at a base resolution with stretch mode `canvas_items`, aspect `expand`, and anchor HUD to edges so it works on ultrawide/phone ratios.
- **Pause menus**: `get_tree().paused = true`; set the menu's `process_mode = PROCESS_MODE_WHEN_PAUSED` (or `ALWAYS`). Gameplay nodes inherit `PAUSABLE`.
- HUD binds to game state via signals (`player.health_changed.connect(hud.set_health)`), never by polling the player every frame.
- Localization: wrap user-visible strings in `tr()` (Controls auto-translate their text) and use CSV/PO translation files from the start if localization is likely.

## Animation

| Need | Use |
|---|---|
| Sprite frame animation | `AnimatedSprite2D` + `SpriteFrames` (simple) or `AnimationPlayer` on a `Sprite2D`'s `frame` (when also keying hitboxes, sounds, methods) |
| Keyframed properties, cutscenes, attack hitbox windows, method calls at exact frames | `AnimationPlayer` (Call Method tracks, Audio tracks) |
| Blending locomotion (idle/walk/run by speed), state transitions, one-shots | `AnimationTree` (BlendSpace1D/2D, StateMachine, OneShot) |
| Procedural, code-driven transitions (UI, pickups bobbing, hit flash, door opening by script) | `Tween` |

Tweens:

```gdscript
var _hit_tween: Tween

func flash_hit() -> void:
	if _hit_tween:
		_hit_tween.kill()                       # one owner per property
	_hit_tween = create_tween()                 # bound to this node; dies with it
	_hit_tween.tween_property(_sprite, ^"modulate", Color(3, 3, 3), 0.05)
	_hit_tween.tween_property(_sprite, ^"modulate", Color.WHITE, 0.1)

func pop_in(node: Control) -> void:
	node.scale = Vector2.ZERO
	node.pivot_offset = node.size * 0.5
	var t := create_tween().set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	t.tween_property(node, ^"scale", Vector2.ONE, 0.25)
```

- `create_tween()` on a node binds the tween's lifetime and pause behavior to it. `get_tree().create_tween()` is unbound — it ignores the node's pause mode and outlives it, so a tween targeting a freed node fails mid-sequence.
- `.set_parallel()` for simultaneous tracks, `.chain()` to return to sequence, `.tween_callback()` for events, `.set_loops()` for loops (kill them when done).
- Tweens and AnimationPlayer must not animate the same property at the same time.

AnimationTree:
- Drive parameters from gameplay: `_anim_tree.set(&"parameters/locomotion/blend_position", velocity.length() / max_speed)`.
- Travel the state machine: `(_anim_tree.get(&"parameters/playback") as AnimationNodeStateMachinePlayback).travel(&"attack")`.
- Root motion: set `root_motion_track`, then apply `_anim_tree.get_root_motion_position()` to velocity in `_physics_process` (set the tree's `callback_mode_process` to Physics).

Game feel checklist for actions: anticipation frames, hit-stop (`Engine.time_scale` dip for 50–80 ms, or pause the two actors' animations), screen shake, flash, particles, sound — each small, together they sell the impact. Offer a reduced-shake/flash option.

## Audio

- Buses (Audio tab): `Master` → `Music`, `SFX`, `UI`, `Voice`. Volume sliders set bus volume in dB: `AudioServer.set_bus_volume_db(idx, linear_to_db(value))`, mute at 0.
- `AudioStreamPlayer` (non-positional: music, UI), `AudioStreamPlayer2D/3D` (positional). Set `bus` on each.
- Variation: `AudioStreamRandomizer` resource for pitch/volume randomization and multiple takes instead of code.
- Many overlapping SFX: raise `max_polyphony` on the player instead of spawning a node per sound. For a sound playing when a node frees itself, play it from a persistent player (audio manager) or reparent — a freed `AudioStreamPlayer` stops instantly.
- Music: `AudioStreamOggVorbis` with loop enabled in import; crossfade with two players and Tweens on `volume_db`. `AudioStreamInteractive`/`AudioStreamSynchronized` (4.3+) for adaptive music.
- Import SFX as WAV (low CPU), music as OGG. Web export: audio starts only after a user gesture.

## Navigation and AI

2D/3D setup: `NavigationRegion2D/3D` with a baked navigation mesh (or TileSet navigation layers), `NavigationAgent2D/3D` on the moving actor.

```gdscript
extends CharacterBody2D

@export var speed: float = 100.0
@onready var _agent: NavigationAgent2D = %NavigationAgent2D

func _ready() -> void:
	set_physics_process(false)
	_agent.velocity_computed.connect(_on_velocity_computed)   # only used when avoidance_enabled
	# The navigation map syncs on the first physics frame; querying earlier returns an empty path.
	await get_tree().physics_frame
	set_physics_process(true)

func chase(target: Vector2) -> void:
	_agent.target_position = target

func _physics_process(_delta: float) -> void:
	if _agent.is_navigation_finished():
		velocity = Vector2.ZERO
		return
	var next := _agent.get_next_path_position()
	var desired := global_position.direction_to(next) * speed
	if _agent.avoidance_enabled:
		_agent.velocity = desired            # result arrives via velocity_computed
	else:
		_on_velocity_computed(desired)

func _on_velocity_computed(safe_velocity: Vector2) -> void:
	velocity = safe_velocity
	move_and_slide()
```

- Don't set `target_position` every physics frame for a moving target; repath on a timer (0.2–0.5 s) or when the target moved more than a threshold.
- Agent `radius` must match how the navmesh was baked (`agent_radius` in the NavigationPolygon/Mesh), or actors clip corners.
- Avoidance (RVO) is for crowds of agents; it doesn't avoid static geometry — the navmesh does.
- Rebake at runtime with `bake_navigation_polygon()` / `bake_navigation_mesh(true)` (threaded) after destructible changes; it's not free.

AI structure: enum state machine per enemy (idle → patrol → chase → attack → return), perception via Area (hearing radius) + raycast (line of sight), decisions on a timer (5–10 Hz), movement every physics tick. Behavior trees only when many enemy types share and recombine complex behaviors.

## Spawning and pooling

- Spawn: `instantiate()` → configure → `add_child` to a container the level owns (e.g. `%Enemies`, `%Projectiles`).
- Clean up: projectiles free themselves on hit or via `VisibleOnScreenNotifier2D.screen_exited` / a lifetime Timer — otherwise they accumulate forever.
- Wave definitions as Resources (`WaveData` with `Array[SpawnEntry]`), spawner reads them — designers tune without code.
- Pooling: only after the profiler shows instancing cost (usually hundreds of spawns per second, or heavy scenes with many nodes/shaders compiling). A pool needs a full `reset()` for every piece of state — the source of subtle bugs. Shader compilation stutter on first spawn is solved by pre-warming (instance once offscreen at load), not by pooling.
