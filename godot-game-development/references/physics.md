# Physics

## Choose the body type by who moves it

| Body | Moved by | Typical use | Don't |
|---|---|---|---|
| `CharacterBody2D/3D` | Your code via `velocity` + `move_and_slide()` / `move_and_collide()` | Player, NPCs, enemies | Expect it to be pushed by RigidBodies automatically (push them yourself) |
| `RigidBody2D/3D` | The physics engine | Crates, balls, debris, ragdolls, vehicles (with `VehicleBody3D`) | Set `position`/`rotation` every frame; it fights the solver |
| `AnimatableBody2D/3D` | Code/AnimationPlayer, pushes others | Moving platforms, doors | Use `StaticBody` for moving things (others won't be carried correctly) |
| `StaticBody2D/3D` | Nothing | Walls, floors | — |
| `Area2D/3D` | Anything (it doesn't collide, it detects) | Hitboxes, triggers, pickups, water/gravity zones | Use for solid collision |

## Layers and masks

- **Layer** = which groups this object belongs to. **Mask** = which groups this object scans for.
- A collision/detection happens when A's mask includes B's layer (for Areas: the Area's mask must include the body's layer; `monitoring` must be on).
- Name layers in Project Settings → Layer Names → 2D/3D Physics. Example scheme:

| Bit | Name | Used by |
|---|---|---|
| 1 | world | Tiles, static geometry |
| 2 | player | Player body |
| 3 | enemies | Enemy bodies |
| 4 | player_hurtbox | Area on player receiving damage |
| 5 | enemy_hurtbox | Area on enemies receiving damage |
| 6 | pickups | Collectibles |
| 7 | projectiles | Bullets (if they're bodies/areas) |

- In code use the named helpers: `set_collision_mask_value(3, true)` (1-based bit numbers), not raw bitmasks with magic numbers. Define constants for layer numbers in one script.
- Enemies usually shouldn't collide with each other (mask excludes `enemies`) unless crowding is desired — reduces pile-ups and physics cost.

## Deferred changes during physics callbacks

Signals like `body_entered`, `area_entered`, and `_integrate_forces` run while the physics server is flushing queries. You cannot change collision state there:

```gdscript
func _on_body_entered(body: Node2D) -> void:
	# WRONG: $CollisionShape2D.disabled = true  → "Can't change this state while flushing queries"
	$CollisionShape2D.set_deferred(&"disabled", true)
	set_deferred(&"monitoring", false)
	var effect := PICKUP_FX.instantiate()
	get_parent().add_child.call_deferred(effect)
	queue_free()
```

Same applies to reparenting a physics node, adding bodies, or changing shapes inside these callbacks.

## Queries

Persistent checks (every tick): a `RayCast2D/3D` or `ShapeCast2D/3D` node. It updates once per physics tick; if you move it and need the result immediately, call `force_raycast_update()`.

One-off checks:

```gdscript
func has_line_of_sight(from: Vector2, to: Vector2) -> bool:
	var space := get_world_2d().direct_space_state
	var query := PhysicsRayQueryParameters2D.create(from, to, WORLD_MASK)
	query.exclude = [get_rid()]
	return space.intersect_ray(query).is_empty()
```

- Only call `direct_space_state` from `_physics_process` (or physics callbacks); outside it, results can be stale or it can error with threaded physics.
- `intersect_shape` for "what's in this radius" (explosions); an `Area` with `get_overlapping_bodies()` is simpler for persistent zones but only updates on physics ticks — freshly created Areas report nothing until the next tick.

## Tunneling (fast objects passing through walls)

Causes: distance per tick > thickness of the thinnest collider. Fixes, in order of preference:
1. Bullets: raycast from previous to current position each tick (or a `ShapeCast`), instead of a tiny moving Area.
2. RigidBody: enable `continuous_cd`.
3. Thicker colliders for thin walls; cap max speed.
4. Raise physics ticks per second (costs CPU for everything — last resort).

## Rigid bodies

```gdscript
extends RigidBody3D

func kick(direction: Vector3, strength: float) -> void:
	apply_central_impulse(direction.normalized() * strength)

func _integrate_forces(state: PhysicsDirectBodyState3D) -> void:
	# Safe place to read/modify the body state directly, e.g. clamp speed or teleport.
	if state.linear_velocity.length() > max_speed:
		state.linear_velocity = state.linear_velocity.limit_length(max_speed)
```

- Teleport a RigidBody: set `state.transform` in `_integrate_forces`, or freeze it, move it, unfreeze.
- `freeze` + `freeze_mode = KINEMATIC` to temporarily animate a rigid body.
- Mass ratios above ~1:100 between touching bodies cause instability; stacked boxes jitter with the default solver iterations.
- Pushing RigidBodies from a CharacterBody:
  ```gdscript
  move_and_slide()
  for i in get_slide_collision_count():
  	var col := get_slide_collision(i)
  	var rb := col.get_collider() as RigidBody2D
  	if rb:
  		rb.apply_central_impulse(-col.get_normal() * push_force)
  ```

## CharacterBody details

- `move_and_slide()` uses `velocity` (units/second) and handles delta internally. After calling, `velocity` is updated (e.g. zeroed into walls).
- `is_on_floor()` / `is_on_wall()` / `is_on_ceiling()` are only valid **after** `move_and_slide()` in the same tick (they report the previous call's result before it).
- `up_direction` defines what "floor" means; change it for wall-walking or custom gravity.
- `move_and_collide(motion)` — takes a **displacement** (`velocity * delta`), returns a `KinematicCollision` for custom response (bounce, stop). Use for projectiles or when you don't want sliding.
- `safe_margin` too small → getting stuck on seams; too large → floating. Leave default unless you have a specific problem.

## Physics interpolation and jitter

Physics runs at a fixed rate (60 Hz default); rendering at the monitor's rate (e.g. 144 Hz). Without interpolation, physics objects visibly stutter on high-refresh displays.

- Enable `physics/common/physics_interpolation` (2D since 4.3, 3D since 4.4). Move physics objects only in `_physics_process`.
- After teleporting (respawn, portal), call `reset_physics_interpolation()` on the node or it will visibly slide.
- Cameras that follow interpolated bodies should themselves move in `_physics_process` (interpolated) or read `get_global_transform_interpolated()` in `_process` (3D).
- `physics/common/physics_jitter_fix` is the older mitigation; leave it at default when interpolation is on.

## Physics engines

- 3D: **Jolt** is built in since 4.4 (`physics/3d/physics_engine`) and is the default for new projects in current releases. It's faster and more stable with many bodies and stacking. A few GodotPhysics-specific behaviors differ (e.g. some joint properties, `SoftBody3D` limitations in older versions) — check the Jolt section of the docs when porting.
- 2D: Godot Physics 2D (built-in). Rapier via GDExtension exists if you need determinism or more performance.
- Neither built-in engine is deterministic across machines; don't build lockstep multiplayer on it.
