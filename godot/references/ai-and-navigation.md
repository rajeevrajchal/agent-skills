# AI and Navigation

## Contents
- Navigation setup
- NavigationAgent3D movement (with avoidance)
- Perception: sight and hearing
- Decision-making: choose the simplest model
- Companion / creature behavior (needs + utility)
- Making NPCs feel alive
- Debugging AI

## Navigation setup

1. Add a `NavigationRegion3D` to the level, with the walkable geometry as its children (or set the source geometry by group).
2. Configure the `NavigationMesh`: `agent_radius` and `agent_height` match your largest agent; `cell_size`/`cell_height` must match the navigation map settings (Project Settings → Navigation → 3D) or you'll get warnings and broken edges.
3. Bake it in the editor. For runtime changes, call `bake_navigation_mesh(true)` (on a thread), but don't rebake every frame. Use `NavigationObstacle3D` with `affect_navigation_mesh` (baked carving) or avoidance-only obstacles for dynamic objects.
4. For multiple agent sizes, use separate navigation maps or regions per size.
5. Use `NavigationLink3D` for jumps, ladders, and teleports between disconnected areas.

## NavigationAgent3D movement (with avoidance)

```gdscript
class_name WalkerAgent
extends CharacterBody3D

@export var move_speed: float = 2.0
@export var acceleration: float = 10.0

@onready var _agent: NavigationAgent3D = %NavigationAgent3D

func _ready() -> void:
	_agent.velocity_computed.connect(_on_velocity_computed)
	# The navigation map isn't synced on the first physics frame. Wait before pathing.
	set_physics_process(false)
	await get_tree().physics_frame
	set_physics_process(true)

func go_to(point: Vector3) -> void:
	_agent.target_position = point

func _physics_process(delta: float) -> void:
	var desired := Vector3.ZERO
	if not _agent.is_navigation_finished():
		var next := _agent.get_next_path_position()
		var to_next := next - global_position
		to_next.y = 0.0
		desired = to_next.normalized() * move_speed
	var horizontal := Vector3(velocity.x, 0.0, velocity.z).move_toward(desired, acceleration * delta)
	if _agent.avoidance_enabled:
		_agent.velocity = horizontal          # result arrives via velocity_computed
	else:
		_on_velocity_computed(horizontal)

func _on_velocity_computed(safe_velocity: Vector3) -> void:
	velocity.x = safe_velocity.x
	velocity.z = safe_velocity.z
	if not is_on_floor():
		velocity += get_gravity() * get_physics_process_delta_time()   # get_gravity(): 4.3+
	move_and_slide()
```

- Set `target_position` **when the goal changes**, not every frame. Repathing every frame is costly and causes jitter. For a moving target, repath on a timer (0.2–0.5 s) or when the target has moved more than a threshold.
- `path_desired_distance` and `target_desired_distance` (about 0.5–1.0): too small and agents orbit their waypoints.
- Avoidance (RVO) only steers between agents and obstacles. It doesn't find paths. Set `radius` to match the collider, and keep `max_neighbors` and `neighbor_distance` modest for performance.
- Check `NavigationServer3D.map_get_iteration_id(map) > 0` or wait for `map_changed` when spawning agents at load.

## Perception: sight and hearing

```gdscript
@export var sight_range: float = 12.0
@export_range(0.0, 180.0) var fov_degrees: float = 110.0
@export_flags_3d_physics var sight_blockers: int = 1

func can_see(target: Node3D) -> bool:
	var eye := global_position + Vector3.UP * 0.6
	var to_target := target.global_position + Vector3.UP * 0.5 - eye
	if to_target.length() > sight_range:
		return false
	var facing := -global_basis.z            # or the model's +Z, if the model faces +Z
	if facing.angle_to(to_target) > deg_to_rad(fov_degrees * 0.5):
		return false
	var params := PhysicsRayQueryParameters3D.create(eye, eye + to_target, sight_blockers, [get_rid()])
	return get_world_3d().direct_space_state.intersect_ray(params).is_empty()
```
- Use an `Area3D` sphere as the cheap broad check (who's nearby?), then the FOV test, then the raycast only for candidates.
- Don't run perception every frame for every NPC. Use a `Timer` at 5–10 Hz, staggered between NPCs.
- Hearing: noise events through a signal or a group call (`get_tree().call_group("listeners", "hear", position, loudness)`), with distance falloff.

## Decision-making: choose the simplest model

| Model | Use when |
|---|---|
| Enum state machine | A few clear modes (idle, patrol, chase, flee) |
| Node-based state machine | Many states with substantial per-state logic |
| Utility scoring | Many competing wants; behavior should feel organic (pets, sims, companions) |
| Behavior tree (addon such as LimboAI or Beehave) | Complex reusable behaviors across many NPC types, with designers authoring them |
| GOAP / planners | Rarely justified in small games |

Start with the enum state machine. Move up only when the transitions become a tangle.

## Companion / creature behavior (needs + utility)

For creatures that should feel like they have their own life (pets, companions, wildlife):

```gdscript
class_name CreatureBrain
extends Node
## Picks an activity by scoring needs and context. The owner executes the activity.

signal activity_changed(activity: StringName)

@export var decision_interval: float = 0.75
@export var commitment_bonus: float = 0.15    # hysteresis: stick with the current activity a bit

# Typed Dictionary needs 4.4+; use a plain Dictionary on older versions.
var needs: Dictionary[StringName, float] = { &"energy": 1.0, &"hunger": 0.0, &"social": 0.5, &"play": 0.5 }
var current: StringName = &"idle"

var _elapsed: float = 0.0

func tick(delta: float, ctx: Dictionary) -> void:
	_decay(delta)
	_elapsed += delta
	if _elapsed < decision_interval:
		return
	_elapsed = 0.0
	var best := current
	var best_score := _score(current, ctx) + commitment_bonus
	for activity: StringName in [&"idle", &"wander", &"follow_player", &"seek_food", &"sleep", &"play"]:
		var s := _score(activity, ctx) + randf_range(0.0, 0.05)   # a little noise = personality
		if s > best_score:
			best = activity
			best_score = s
	if best != current:
		current = best
		activity_changed.emit(current)

func _decay(delta: float) -> void:
	needs[&"energy"] = maxf(needs[&"energy"] - 0.01 * delta, 0.0)
	needs[&"hunger"] = minf(needs[&"hunger"] + 0.008 * delta, 1.0)
	needs[&"social"] = maxf(needs[&"social"] - 0.006 * delta, 0.0)

func _score(activity: StringName, ctx: Dictionary) -> float:
	var player_near: bool = ctx.get(&"player_near", false)
	match activity:
		&"sleep": return 1.0 - needs[&"energy"]
		&"seek_food": return needs[&"hunger"] * (1.0 if ctx.get(&"food_available", false) else 0.2)
		&"follow_player": return (1.0 - needs[&"social"]) * (1.0 if player_near else 0.4)
		&"play": return needs[&"play"] * needs[&"energy"] * (1.2 if ctx.get(&"toy_nearby", false) else 0.3)
		&"wander": return 0.25
		_: return 0.2   # idle
```

- **The brain decides and the body executes.** The brain outputs an activity. The owner's state machine runs the movement and animation for it. This keeps both small and testable.
- **Hysteresis** (`commitment_bonus`) prevents flickering between activities.
- **Interactions feed the needs**: petting raises `social`, a thrown toy raises `play` and sets `toy_nearby`. The player sees cause and effect.
- Expose the decay rates and weights in a `CreatureTraits` Resource so different personalities are just data.
- Show the scores in a debug label (`Label3D` above the creature) while tuning.

## Making NPCs feel alive

These matter more than smarter decisions:
- **Reaction latency with variation**: respond 0.1–0.4 s after a stimulus, slightly randomized. Instant is robotic; long feels unresponsive.
- **Gaze**: the head looks at the player or at points of interest (`LookAtModifier3D`, 4.4+), before the body turns.
- **Anticipation**: a short wind-up before actions (crouch before a jump, ears up before running over).
- **Idle variety**: several idle animations and micro-behaviors (sniff, scratch, sit, look around) on randomized timers. Never the same loop.
- **Memory**: remember the last interaction ("was petted 10 s ago" → stays close; "was ignored" → wanders off).
- **Consistent personality**: traits shift probabilities and timings, not hard-coded scripts.
- **Readable state**: the player can tell what the NPC wants from posture, animation, and sound before any UI.

## Debugging AI

- Debug → Visible Navigation shows navmeshes and paths. Check that the agent's path exists and that its radius matches the baked mesh.
- Draw debug: a `Label3D` with the state and scores, `ImmediateMesh` lines for targets and LOS rays, or a debug-draw addon.
- If the agent doesn't move: no navmesh under its start or target position (use `NavigationServer3D.map_get_closest_point`), the first-frame map sync issue, `is_navigation_finished()` already true (target too close), or avoidance is enabled but `velocity_computed` isn't connected.
