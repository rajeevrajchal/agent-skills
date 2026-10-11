# Animation and Game Feel

## Contents
- Which animation tool
- AnimationTree setup
- Driving the tree from gameplay
- Root motion
- Skeleton modifiers: look-at, IK, spring bones
- Tweens
- Game feel toolkit
- Aliveness checklist for characters and creatures

## Which animation tool

| Need | Tool |
|---|---|
| Authored clips from Blender (walk, idle, jump) | `AnimationPlayer` (imported) |
| Blending and transitions between clips driven by gameplay | `AnimationTree` (state machine + blend spaces) |
| Simple property motion (UI pop, door swing, pickup bob) | `Tween` |
| Procedural bones (head look, foot placement, tails, ears) | Skeleton modifiers (`LookAtModifier3D`, IK nodes, `SpringBoneSimulator3D`) |
| Cutscenes and sequenced events | `AnimationPlayer` with method, audio, and property tracks |

## AnimationTree setup

Typical locomotion graph (root: `AnimationNodeStateMachine`):

```
StateMachine
├─ Locomotion   (BlendSpace1D on speed: 0 Idle, 1.6 Walk, 5 Run)
├─ Jump         (Start → Air loop → Land)
├─ Sit / Sleep  (with transitions in and out)
└─ OneShot nodes or a BlendTree overlay for Bark, Wag, Greet (layered on top)
```
- Point the tree at the `AnimationPlayer` (`anim_player`) and set `active = true`. Don't also call `AnimationPlayer.play()`; the tree owns playback.
- Set transition crossfade times (0.1–0.25 s) in the state machine. Use `advance_mode = Auto` with conditions or expressions for automatic transitions. Use `travel()` for gameplay-requested ones.
- Use `AnimationNodeBlend2` or `Add2` with a bone filter for upper-body layers (wagging while walking).

## Driving the tree from gameplay

```gdscript
@onready var _tree: AnimationTree = %AnimationTree
@onready var _playback: AnimationNodeStateMachinePlayback = _tree.get(&"parameters/playback")

func _update_animation(delta: float) -> void:
	var speed := Vector3(velocity.x, 0.0, velocity.z).length()
	var current: float = _tree.get(&"parameters/Locomotion/blend_position")
	_tree.set(&"parameters/Locomotion/blend_position", lerpf(current, speed, 1.0 - exp(-10.0 * delta)))
	if not is_on_floor():
		_playback.travel(&"Jump")
	elif _playback.get_current_node() == &"Jump":
		_playback.travel(&"Locomotion")

func greet() -> void:
	_tree.set(&"parameters/Greet/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_FIRE)
```
- Parameter paths match the node names in the tree. Copy them from the inspector (hover a parameter) to avoid typos; a wrong path fails silently.
- Gameplay state drives animation, never the reverse. Use animation **method or signal tracks** only for timing-critical events (footstep sounds, the hit frame).
- Smooth the blend parameters (as above) so speed changes don't pop.

## Root motion

When animation should move the character (precise attacks, climbing, natural creature gaits):
- Set `AnimationTree.root_motion_track` to the root bone's position track.
- Each physics frame: `var motion := _tree.get_root_motion_position()`, rotate it into world space (`_model.global_basis * motion` or `quaternion * motion`), then divide by delta to get a velocity, and apply it through `move_and_slide()`.
- Mixing root motion and code-driven speed is fiddly. Choose one per state.

## Skeleton modifiers: look-at, IK, spring bones

Skeleton modifiers are children of a `Skeleton3D` and run after animation each frame:
- `LookAtModifier3D` (4.4+): head and neck track a target with angle limits and smoothing. It's essential for characters that notice the player.
- IK nodes (4.6+): `TwoBoneIK3D` (legs, arms), `FABRIK3D`, and others for chains. Use them for foot placement on uneven ground, or paws reaching for objects. Use raycasts to find the ground targets.
- `SpringBoneSimulator3D` (4.4+): secondary motion on ears, tails, hair, and cloth straps. It's very cheap aliveness.
- Use `influence` to blend modifiers in and out (turn look-at down while sleeping).
- Older projects (before 4.4) don't have these nodes. They use a `BoneAttachment3D` with manual bone pose overrides, or addons.

## Tweens

```gdscript
var _squash_tween: Tween

func squash() -> void:
	if _squash_tween:
		_squash_tween.kill()                 # interrupt cleanly; don't stack tweens
	_squash_tween = create_tween()           # bound to this node: dies with it
	_squash_tween.tween_property(_model, ^"scale", Vector3(1.15, 0.85, 1.15), 0.08) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	_squash_tween.tween_property(_model, ^"scale", Vector3.ONE, 0.25) \
		.set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
```
- One tween per property owner. Kill or replace it before starting a new one.
- `create_tween()` on a node binds the tween to it. `get_tree().create_tween()` isn't bound and keeps running after the node is freed.
- Use `set_parallel()`, `chain()`, `tween_callback()`, and `tween_interval()` for sequences. Don't nest awaits.
- `set_pause_mode(Tween.TWEEN_PAUSE_PROCESS)` for UI tweens during a pause.
- Scale only visual children (`Model`), never physics bodies.

## Game feel toolkit

Use these sparingly and deliberately; each one should communicate something.

| Technique | Implementation | Use for |
|---|---|---|
| Squash and stretch | Tween model scale (preserve volume) | Landing, jumping, being petted or poked |
| Anticipation | A short reverse motion before the action | Jumps, attacks, a creature preparing to run |
| Hit-stop | Pause the affected nodes 40–100 ms (avoid global `Engine.time_scale` spikes if audio or UI should continue) | Impacts |
| Camera shake | Trauma value (0–1) decaying over time; offset = trauma² × noise (`FastNoiseLite`) | Impacts, explosions; keep it subtle and offer a settings toggle |
| Camera lag and lead | Follow sharpness; offset toward the movement direction | Sense of speed and weight |
| FOV kick | Briefly widen FOV on sprint or dash | Speed |
| Particles | `GPUParticles3D` one-shots (dust on landing, hearts on petting) | Confirmation of actions |
| Sound | Randomized pitch (±5–10%), layered, synced to the animation frame | Every interaction needs a sound |
| Haptics | `Input.start_joy_vibration` (weak/strong, short) | Gamepad feedback |
| Easing | `EASE_OUT` for arrivals, `EASE_IN` for departures | Every tween |

Accessibility: provide options to reduce camera shake, flashes, and motion blur.

## Aliveness checklist for characters and creatures

- [ ] Responds to input or interaction within about 100 ms (even if just a head turn or ear flick).
- [ ] Idle isn't a single loop: several variants on randomized timers.
- [ ] Head or gaze tracks points of interest before the body turns.
- [ ] Secondary motion on appendages (spring bones), plus breathing (a subtle additive animation).
- [ ] Transitions are blended; no pops between states.
- [ ] Timing has slight randomness (reaction delays, idle durations, sound pitch).
- [ ] Actions have anticipation and follow-through.
- [ ] Every interaction has animation + sound + (where fitting) particles or camera response.
- [ ] Its mood or intent is readable from posture and animation without UI.
- [ ] Personality is data (traits Resource) that shifts timings and probabilities.
