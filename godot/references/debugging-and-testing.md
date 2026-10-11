# Debugging and Testing

## Contents
- Debugging workflow (in order)
- Tools
- Symptom → likely cause
- Testing strategy
- Headless and CI

## Debugging workflow (in order)

Diagnose before changing values. Stop at the first step that explains the problem, and state the evidence.

1. **Read the error.** Debugger → Errors tab: the message, the stack trace, and the script line. In 4.6+, Output panel errors link to the script. "Invalid get index … on base Nil" means a null reference: something wasn't assigned, isn't ready yet, or was freed.
2. **Is the code running at all?** Add a `print_debug()` or breakpoint. Common reasons it isn't: the script isn't attached, the method name is misspelled (`_physics_proccess`), `set_process(false)`, `process_mode` disabled or the tree is paused, or the node isn't in the tree.
3. **Is the node what you think it is?** Inspect the **Remote** scene tree while the game runs (Scene dock → Remote): the existence, transforms, properties, and groups of nodes. Wrong path? Wrong instance? A duplicate?
4. **Lifecycle and timing**: accessed before `_ready` (`@onready` is null), parent `_ready` assumptions about child state, freed nodes used after `queue_free`, navigation used on the first physics frame, awaits never resuming.
5. **Signals**: is it connected (Node dock → Signals, or `is_connected`)? Is it emitted (breakpoint on `emit`)? Does the signature match? Was the connection made on a different instance?
6. **Physics**: Debug → Visible Collision Shapes. Check the layers and masks (both sides), the shape sizes, scale on bodies, deferred changes in callbacks, `monitoring`/`monitorable`, the body type (Static vs Character vs Rigid), and that `move_and_slide()` is actually called.
7. **Transforms and math**: local vs global (`position` vs `global_position`), the forward axis (−Z vs the model's +Z), accumulated basis error, delta missing or applied twice, angles in degrees vs radians.
8. **Shared Resources**: unexpected changes on other instances → a shared material or Resource was mutated.
9. **Animation**: `AnimationTree.active`, parameter path typos (fail silently), the player and tree both trying to play, a filter blocking tracks, root motion not applied.
10. **Version and API**: Godot 3 syntax, or an API that doesn't exist in this version (check the class reference for the project's version).
11. **Import and assets**: reimport, check the import settings (scale, root type, loop), and whether the wrapper scene still references the correct model.

## Tools

- `print_debug()` includes the script and line. `print_rich()` adds color. `push_warning()` and `push_error()` appear in the Errors tab with a stack trace.
- Breakpoints (click the gutter, or write `breakpoint`), step through, inspect locals.
- Debug menu: Visible Collision Shapes, Visible Navigation, Visible Paths, Visible Avoidance.
- Remote tree plus live property editing while the game runs, for tuning.
- Debugger → Monitors, Profiler, Visual Profiler, Network Profiler.
- ObjectDB snapshots and diffing (4.6+) for memory and leak investigation. `Performance.get_monitor(Performance.OBJECT_ORPHAN_NODE_COUNT)` catches leaked nodes that were never freed.
- In-game debug overlay: a `Label` on a `CanvasLayer` showing state, speed, and AI scores, toggled with a debug action.

## Symptom → likely cause

| Symptom | Check first |
|---|---|
| Falls through the floor | Floor has no collision, or a mask/layer mismatch; scaled collision shape; spawn position inside geometry |
| Jittery movement on high-refresh monitors | Physics interpolation off; camera following in the wrong callback |
| Character slides on slopes or can't climb | `floor_max_angle`, `floor_stop_on_slope`, `floor_snap_length` |
| `body_entered` never fires | Area `monitoring` off; mask doesn't include the body's layer; the "body" is actually an Area (use `area_entered`) |
| "Can't change this state while flushing queries" | Physics change inside a callback → `set_deferred`/`call_deferred` |
| Animation doesn't play | Tree inactive; wrong parameter path; the AnimationPlayer is driven elsewhere |
| NPC doesn't move | No navmesh at its position; first-frame sync; `velocity_computed` not connected when avoidance is on |
| All enemies change color together | Shared material mutated |
| Works in the editor, fails in the export | Files not included in the export filter; case-sensitive paths; `load()` on non-exported `res://` paths; missing export templates |
| Stutter the first time an effect appears | Shader compilation (warm up, or use 4.4+ ubershaders); loading on the main thread |

## Testing strategy

- **Test scenes** per system (`tests/scenes/creature_test.tscn`): a minimal setup with debug controls. These are the main way to iterate on feel.
- **Unit tests** for pure logic (utility scoring, save migration, inventory math), with **GUT** or **gdUnit4**. Keep that logic in plain classes or Resources so it can be tested without a scene.
- **Integration tests** for scene behavior that can be simulated: instance the scene, step frames (`await get_tree().physics_frame`), and assert on the state.
- **Playtests** for feel. No automated test tells you if petting feels good. Write down what you observed and what you changed.

```gdscript
# tests/unit/test_creature_brain.gd (GUT)
extends GutTest

func test_sleep_wins_when_exhausted() -> void:
	var brain := CreatureBrain.new()
	brain.needs[&"energy"] = 0.05
	brain.decision_interval = 0.0
	brain.tick(0.01, {})
	assert_eq(brain.current, &"sleep")
	brain.free()
```

## Headless and CI

- `godot --headless --path . --editor --quit` imports assets and reports script parse errors without opening a window. It's a fast smoke check (flags vary slightly between versions; check `godot --help`).
- Run the GUT tests headless: `godot --headless --path . -s addons/gut/gut_cmdln.gd -gexit`. gdUnit4 ships its own command-line runner.
- Export in CI with `godot --headless --export-release "<preset>" build/game.exe` after installing the export templates for the exact engine version.
- Pin the engine version in CI to match `config/features` in `project.godot`.
