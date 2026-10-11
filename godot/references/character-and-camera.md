# Character Controllers and Cameras

## Contents
- Third-person controller (camera-relative)
- Jump feel: coyote time, buffering, variable height
- Slopes, steps, platforms
- Third-person camera rig
- First-person variant
- Input setup
- Smoothness: physics interpolation
- Tuning cheat sheet

## Third-person controller (camera-relative)

Scene:
```
Player (CharacterBody3D)            script: player.gd
├─ CollisionShape3D                 CapsuleShape3D radius 0.35, height 1.7, position y = 0.85
├─ Model (Node3D)                   instance of character .glb (faces +Z)
│  └─ AnimationTree / AnimationPlayer
└─ CameraRig (Node3D)               top_level = true (follows in code; see camera section)
   └─ SpringArm3D > Camera3D
```

```gdscript
class_name Player
extends CharacterBody3D

@export_group("Movement")
@export var max_speed: float = 5.0
@export var acceleration: float = 40.0      # m/s²: ~0.12 s to full speed
@export var deceleration: float = 50.0
@export var air_control: float = 0.35       # fraction of acceleration in the air
@export var turn_rate: float = 12.0         # higher = snappier facing
@export_group("Jump")
@export var jump_height: float = 1.2
@export var jump_time_to_peak: float = 0.38
@export var fall_gravity_multiplier: float = 1.6
@export var coyote_time: float = 0.12
@export var jump_buffer_time: float = 0.12

@onready var _model: Node3D = %Model
@onready var _camera: Camera3D = %Camera3D

var _coyote_timer: float = 0.0
var _jump_buffer_timer: float = 0.0
# Derived from height/time so designers tune what they see, not physics constants.
var _jump_velocity: float
var _jump_gravity: float

func _ready() -> void:
	_jump_velocity = 2.0 * jump_height / jump_time_to_peak
	_jump_gravity = 2.0 * jump_height / (jump_time_to_peak * jump_time_to_peak)

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed(&"jump"):
		_jump_buffer_timer = jump_buffer_time

func _physics_process(delta: float) -> void:
	_apply_gravity(delta)
	_handle_jump(delta)
	_move(delta)
	move_and_slide()
	_face_movement(delta)

func _apply_gravity(delta: float) -> void:
	if is_on_floor():
		_coyote_timer = coyote_time
		return
	_coyote_timer -= delta
	var g := _jump_gravity
	if velocity.y < 0.0 or not Input.is_action_pressed(&"jump"):
		g *= fall_gravity_multiplier            # faster fall + variable jump height
	velocity.y -= g * delta

func _handle_jump(delta: float) -> void:
	_jump_buffer_timer -= delta
	if _jump_buffer_timer > 0.0 and _coyote_timer > 0.0:
		velocity.y = _jump_velocity
		_jump_buffer_timer = 0.0
		_coyote_timer = 0.0

func _move(delta: float) -> void:
	var input := Input.get_vector(&"move_left", &"move_right", &"move_forward", &"move_back")
	var cam_basis := _camera.global_basis
	# Camera looks along -Z, so its +Z axis points "back". input.y is -1 for move_forward.
	var back := Vector3(cam_basis.z.x, 0.0, cam_basis.z.z).normalized()
	var right := Vector3(cam_basis.x.x, 0.0, cam_basis.x.z).normalized()
	var wish_dir := right * input.x + back * input.y
	if wish_dir.length() > 1.0:
		wish_dir = wish_dir.normalized()

	var target := wish_dir * max_speed
	var horizontal := Vector3(velocity.x, 0.0, velocity.z)
	var rate := acceleration if wish_dir != Vector3.ZERO else deceleration
	if not is_on_floor():
		rate *= air_control
	horizontal = horizontal.move_toward(target, rate * delta)
	velocity.x = horizontal.x
	velocity.z = horizontal.z

func _face_movement(delta: float) -> void:
	var flat := Vector3(velocity.x, 0.0, velocity.z)
	if flat.length_squared() < 0.01:
		return
	var target_yaw := atan2(flat.x, flat.z)     # model faces +Z
	_model.rotation.y = lerp_angle(_model.rotation.y, target_yaw, 1.0 - exp(-turn_rate * delta))
```

Notes:
- `Input.get_vector` already applies a circular deadzone and clamps diagonals.
- Rotate the **model**, not the body: the capsule doesn't need to rotate, and it keeps the camera math simple.
- `move_toward` gives linear acceleration with predictable, tunable timing. Lerp-based velocity is frame-rate dependent unless you use the `exp` weight.

## Jump feel: coyote time, buffering, variable height

- **Coyote time** (0.08–0.15 s): the player can still jump just after leaving a ledge.
- **Jump buffer** (0.08–0.15 s): a press slightly before landing still counts.
- **Variable height**: higher gravity when the button is released or when falling.
- **Faster fall** (×1.4–2.0): jumps feel weighty instead of floaty.
- Derive jump velocity and gravity from **height and time to peak**; designers think in those terms.

## Slopes, steps, platforms

- `floor_max_angle` (default 45°): steeper surfaces count as walls.
- `floor_snap_length` (about 0.1–0.3): keeps the character glued to the ground going down slopes and stairs. Snapping is disabled automatically while velocity points upward from the floor (when jumping).
- `floor_constant_speed = true`: the same speed up and down slopes.
- `floor_stop_on_slope = true`: no sliding while idle on slopes.
- Stairs: use invisible ramp collision over the stair meshes (simplest and most robust), or implement step-up with a shape cast. Prefer ramps.
- Moving platforms: use `AnimatableBody3D` with `sync_to_physics` on. `CharacterBody3D` inherits platform velocity (`platform_on_leave` controls what happens on jump-off).

## Third-person camera rig

```gdscript
# camera_rig.gd on CameraRig (Node3D, top_level = true)
extends Node3D

@export var target: Node3D
@export var follow_height: float = 1.5
@export var follow_sharpness: float = 14.0
@export var mouse_sensitivity: float = 0.0025      # radians per pixel
@export var stick_sensitivity: float = 3.0         # radians per second
@export_range(-89.0, 0.0) var min_pitch_deg: float = -70.0
@export_range(0.0, 89.0) var max_pitch_deg: float = 35.0

@onready var _arm: SpringArm3D = %SpringArm3D

var _yaw: float = 0.0
var _pitch: float = -0.3

func _ready() -> void:
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	if target is CollisionObject3D:
		_arm.add_excluded_object((target as CollisionObject3D).get_rid())   # don't collide with the player
	else:
		push_warning("CameraRig: target should be the player body")

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		var motion := event as InputEventMouseMotion
		_yaw -= motion.relative.x * mouse_sensitivity
		_pitch -= motion.relative.y * mouse_sensitivity
	elif event.is_action_pressed(&"ui_cancel"):
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE

func _process(delta: float) -> void:
	var look := Input.get_vector(&"look_left", &"look_right", &"look_up", &"look_down")
	_yaw -= look.x * stick_sensitivity * delta
	_pitch -= look.y * stick_sensitivity * delta
	_pitch = clampf(_pitch, deg_to_rad(min_pitch_deg), deg_to_rad(max_pitch_deg))
	rotation = Vector3(_pitch, _yaw, 0.0)

	var goal := target.global_position + Vector3.UP * follow_height
	global_position = global_position.lerp(goal, 1.0 - exp(-follow_sharpness * delta))
```

- The `SpringArm3D` (spring_length about 3–5 m) pulls the camera in when geometry blocks it. Give it a small `SphereShape3D` (r ≈ 0.2) so it doesn't clip through walls, and set its `collision_mask` to the environment only.
- Camera follow runs in `_process` (visual). The player moves in `_physics_process`. With physics interpolation on, follow the interpolated position.
- Read mouse look from events (`relative`), never from positions sampled in `_process`. Stick look is per-second, so multiply it by delta.
- Use `InputEventMouseMotion.screen_relative` (4.3+) if you want sensitivity unaffected by viewport scaling.

## First-person variant

```
Player (CharacterBody3D)
├─ CollisionShape3D
└─ Head (Node3D, y = 1.6)       yaw on Player (rotate_y), pitch on Head (rotation.x)
   └─ Camera3D
```
- Yaw rotates the body, and pitch rotates the head, clamped to ±89°.
- Movement direction comes from the body basis: `transform.basis * Vector3(input.x, 0, input.y)`.
- Lower `Camera3D.near` (0.05) to avoid clipping into walls. Render a view-model on a separate visual layer (or a SubViewport) if needed.

## Input setup

Define actions in Project Settings → Input Map with both keyboard and gamepad bindings: `move_left/right/forward/back`, `look_*`, `jump`, `interact`, `pause`.
- Deadzones are set per action (default 0.5 is high for sticks; 0.15–0.2 suits movement).
- Never hard-code `KEY_W` in gameplay; it breaks remapping and other keyboard layouts.
- For local multiplayer, filter by `event.device`.
- Godot 4.7 adds a built-in virtual joystick for touch. On earlier versions use an addon or a simple custom `Control`.

## Smoothness: physics interpolation

Physics ticks at 60 Hz by default. On 120 Hz+ displays, objects moved in physics will stutter unless interpolated.
- Enable `physics/common/physics_interpolation` (3D since 4.4).
- After teleporting a node (respawn, scene start), call `reset_physics_interpolation()` so it doesn't visibly slide.
- Cameras that follow interpolated objects should update in `_process`, using `get_global_transform_interpolated()` if reading the target's transform directly.
- Don't raise physics ticks to 120 just to fix stutter. Interpolation is cheaper and fixes it properly.

## Tuning cheat sheet

| Parameter | Typical | Feel |
|---|---|---|
| Walk / run speed | 2–3 / 5–7 m/s | Human-scale |
| Time to full speed | 0.08–0.2 s | Lower = snappier |
| Turn rate (exp weight) | 8–20 | Lower = heavier character |
| Jump height | 1.0–2.0 m | |
| Time to apex | 0.3–0.45 s | Lower = punchier |
| Fall multiplier | 1.4–2.0 | Higher = less floaty |
| Coyote / buffer | 0.1–0.15 s | Forgiveness |
| Camera distance | 3–5 m | Closer = more intimate, less visibility |
| Camera FOV | 70–80° (third-person), 80–100° (first-person) | |
