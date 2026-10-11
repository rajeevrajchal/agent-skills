# Physics

## Contents
- Body types
- Collision layers and masks
- Jolt vs Godot Physics
- Shapes
- Raycasts and shape casts
- Areas and triggers
- Controlling RigidBody3D
- Deferred changes in callbacks
- Fast objects and tunneling
- Picking objects with the mouse

## Body types

| Node | Moved by | Use for |
|---|---|---|
| `CharacterBody3D` | Your code (`velocity` + `move_and_slide()`) | Player, NPCs, creatures |
| `RigidBody3D` | The simulation (forces, impulses, gravity) | Props, ragdolls, throwables, balls |
| `StaticBody3D` | Nothing | Level geometry |
| `AnimatableBody3D` | Animation or code; pushes other bodies | Moving platforms, doors, elevators |
| `Area3D` | Your code; detects only | Triggers, pickups, hurtboxes, sensors, local gravity or wind |
| `VehicleBody3D` | The simulation | Cars (or build a custom raycast vehicle) |
| `SoftBody3D` | The simulation | Cloth and soft objects (costly; use sparingly) |

## Collision layers and masks

- **Layer** = which categories this object **is in**. **Mask** = which categories this object **looks for**.
- A collision happens if A's mask includes B's layer **or** B's mask includes A's layer (for body-to-body contact). Areas detect bodies on layers in the Area's mask.
- Name the layers (Project Settings → Layer Names → 3D Physics). A typical plan:

| # | Name | Typical members |
|---|---|---|
| 1 | world | Static level geometry |
| 2 | player | Player body |
| 3 | creatures | NPCs and animals |
| 4 | props | Movable rigid bodies |
| 5 | interactables | Areas you can interact with |
| 6 | hurtboxes | Damage receivers |
| 7 | hitboxes | Damage dealers |
| 8 | camera_blockers | What the SpringArm collides with |

- In code, use `set_collision_layer_value(n, enabled)` and `set_collision_mask_value(n, enabled)` with 1-based layer numbers, and `@export_flags_3d_physics` for inspector pickers.
- Keep masks minimal. Every unnecessary layer in a mask costs broadphase work and causes surprising interactions.

## Jolt vs Godot Physics

- Jolt is the **default 3D physics engine for new projects since 4.6** (it was available as an option from 4.4). It's generally faster and more stable for stacking, joints, and many bodies.
- Existing projects keep their `physics/3d/physics_engine` setting. Switching engines can change behavior (contact handling, joint parameters, some settings only one engine supports). Test the gameplay after switching, and read the Jolt notes in the docs for unsupported properties.
- Determinism: neither engine guarantees bit-exact results across platforms. Don't build lockstep networking on physics results.

## Shapes

- Cheapest to most expensive: sphere < capsule < box < cylinder < convex hull < concave (trimesh).
- **Concave (trimesh) shapes only on static bodies.** Moving bodies use primitives or convex hulls (or several convex hulls together).
- Keep shapes simple and approximate. Players can't see collision; they feel it.
- **Never scale bodies or shapes non-uniformly.** Set the shape's dimensions instead. Uniform scale on static bodies is tolerated but still best avoided.
- Characters: a capsule. Its radius stops them snagging on edges.

## Raycasts and shape casts

Persistent checks (ground probes, line of sight every frame): use the `RayCast3D` and `ShapeCast3D` nodes, which update every physics frame. Call `force_raycast_update()` if you move them and need the result immediately.

One-off queries (hitscan shot, interaction probe):
```gdscript
func _query_hit(from: Vector3, to: Vector3, mask: int) -> Dictionary:
	var space := get_world_3d().direct_space_state
	var params := PhysicsRayQueryParameters3D.create(from, to, mask, [get_rid()])
	params.collide_with_areas = false
	return space.intersect_ray(params)   # {} if nothing hit; else position, normal, collider, ...
```
- Run space queries **inside `_physics_process`**. Outside it, the space may be locked or out of date.
- Exclude yourself (by RID) to avoid self-hits.
- Use shape casts (`intersect_shape`, `cast_motion`, or `ShapeCast3D`) for "is there room?" and for thick rays (melee sweeps, camera collision).

## Areas and triggers

```gdscript
# pickup.gd on Area3D (mask: player)
signal collected

func _ready() -> void:
	body_entered.connect(_on_body_entered)

func _on_body_entered(body: Node3D) -> void:
	if not body is Player:
		return
	collected.emit()
	set_deferred(&"monitoring", false)        # physics state change: deferred
	queue_free()
```
- `body_entered` and `area_entered` fire once per entry. Use `get_overlapping_bodies()` to poll the current overlaps, which are updated once per physics frame (they can be empty on the frame you enable monitoring).
- `monitoring` = this area detects others. `monitorable` = other areas can detect this one. Turn off what you don't need.
- Area gravity and damping overrides let you build water, wind, and low-gravity zones without code.

## Controlling RigidBody3D

- Apply forces and impulses: `apply_central_impulse(dir * strength)`, `apply_force`, `apply_torque_impulse`.
- Need to teleport or set the velocity precisely? Do it in `_integrate_forces(state)` through `state.transform` and `state.linear_velocity`, not by setting `global_position` every frame.
- Carrying objects: switch to `freeze = true` with `freeze_mode = FREEZE_MODE_KINEMATIC` while held, or pull toward a hold point with a spring-damper force. Re-enable dynamics on release.
- Sleeping bodies don't simulate; `sleeping = false` or applying an impulse wakes them.
- Mass ratios above about 1:100 between interacting bodies cause instability.

## Deferred changes in callbacks

Inside physics callbacks (`body_entered`, `_on_*_entered`, `_integrate_forces`), the physics server is mid-step. Changing the physics state directly can error ("Can't change this state while flushing queries") or be ignored.
- `collision_shape.set_deferred(&"disabled", true)`
- `set_deferred(&"monitoring", false)`
- `call_deferred(&"add_child", projectile)`, or `add_child.call_deferred(projectile)`
- `reparent` and changing the collision layer from callbacks → deferred as well.

## Fast objects and tunneling

- Bullets: prefer hitscan rays, or a ray from the last position to the current one each physics frame, over fast rigid bodies.
- Rigid bodies that must be fast: enable `continuous_cd`, and use thicker colliders.
- `CharacterBody3D` sweeps its motion with `move_and_slide`, so tunneling is rare unless the speed per frame exceeds the wall thickness. Thicken thin walls.
- Increasing physics ticks per second helps but costs CPU. Use it as a last resort.

## Picking objects with the mouse

```gdscript
func _pick(screen_pos: Vector2) -> Dictionary:
	var cam := get_viewport().get_camera_3d()
	var from := cam.project_ray_origin(screen_pos)
	var to := from + cam.project_ray_normal(screen_pos) * 100.0
	var params := PhysicsRayQueryParameters3D.create(from, to, 1 << 4)   # layer 5: interactables
	params.collide_with_areas = true
	return get_world_3d().direct_space_state.intersect_ray(params)
```
Call it from `_physics_process` with a stored click position, or enable `input_ray_pickable` and use the `input_event` signal on a `CollisionObject3D` for simple cases. Remember `1 << (n - 1)` converts 1-based layer `n` to a bit.
