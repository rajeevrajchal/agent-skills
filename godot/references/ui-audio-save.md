# UI, Audio, and Saving

## Contents
- HUD and menus
- Gamepad and keyboard navigation
- Pausing
- UI in the 3D world
- Audio structure
- 3D sound
- Save system
- Settings

## HUD and menus

- Put the HUD in a `CanvasLayer` (layer 1+) above the 3D viewport. Menus go on a higher layer.
- Use containers (`MarginContainer`, `VBoxContainer`, `HBoxContainer`, `GridContainer`) and anchors. Avoid absolute positions.
- Stretch settings: `display/window/stretch/mode = canvas_items`, `aspect = expand`, with a base resolution (for example 1920×1080). Test at 16:9, 16:10, 21:9, and mobile aspect ratios.
- One shared `Theme` resource for fonts, colors, and styles. Use theme type variations for button styles.
- The HUD listens to gameplay signals (`player.health_changed`, `creature.mood_changed`). Gameplay never reaches into UI nodes.
- Text uses `tr()` keys from the start if localization is plausible.

## Gamepad and keyboard navigation

- Every interactive menu must work without a mouse. Call `grab_focus()` on the first button when a menu opens, and set focus neighbors where automatic navigation guesses wrong.
- Give focused controls a visible style (theme `focus` StyleBox).
- Show input glyphs for the active device (detect the last input type in `_input`).

## Pausing

- `get_tree().paused = true` stops nodes whose `process_mode` is `PROCESS_MODE_INHERIT` (the default) or `PAUSABLE`.
- Pause menus and their tweens use `process_mode = PROCESS_MODE_ALWAYS` (or `WHEN_PAUSED`).
- `create_timer()` runs while paused by default. Pass `process_always = false` for gameplay timers.
- Release the mouse capture when pausing (`Input.mouse_mode = Input.MOUSE_MODE_VISIBLE`), and re-capture on resume.

## UI in the 3D world

- Simple labels and icons: `Label3D` and `Sprite3D` with `billboard` on. Set `no_depth_test` if they should show through walls, and `fixed_size` for a constant screen size.
- Interaction prompts: project a 3D point to the screen with `camera.unproject_position(world_pos)` and place a HUD control there. Hide it if `camera.is_position_behind(world_pos)`.
- Interactive in-world screens: a `SubViewport` rendering a Control scene, shown on a mesh with a `ViewportTexture`. Forward input by raycasting to UV coordinates (costly; use it only when needed).

## Audio structure

- Buses: `Master` → `Music`, `SFX`, `Ambience`, `UI`, and optionally `Voice`. Players expose volumes per bus.
- Volume settings: store linear 0–1 and apply with `AudioServer.set_bus_volume_db(idx, linear_to_db(value))`.
- `AudioStreamRandomizer` for variation (random pitch and volume, several clips) on footsteps, barks, and impacts.
- Music: an autoload `AudioManager` with two players for crossfades. `AudioStreamInteractive` (4.3+) for adaptive music with clips and transitions.
- Watch the polyphony limits for rapidly repeated sounds (`max_polyphony` on the player).

## 3D sound

- `AudioStreamPlayer3D` as a child of the emitting object. Tune `unit_size` (distance of full volume), `max_distance`, and the `attenuation_model`.
- Turn on Doppler only for fast objects. Area-based reverb through `Area3D` audio bus overrides (an interior reverb bus).
- Footstep sounds come from animation method tracks or distance traveled. Choose the surface sound from the floor collider's group or metadata.

## Save system

Principles:
- Save **data, not nodes**: ids, positions, stats, flags, and timestamps.
- Use JSON (`JSON.stringify`) or binary with `FileAccess.store_var` (without `full_objects`), in `user://`.
- **Never** load `.tres`/`.res` saves from `user://`. Resources can contain scripts that execute when loaded, and players share save files.
- Include a `version` field and migrate old saves forward.
- Write atomically: write to `save.tmp`, then rename over `save.json`, so a crash mid-write doesn't corrupt the save.

```gdscript
# autoload/save_system.gd
extends Node

const SAVE_PATH := "user://save.json"
const TMP_PATH := "user://save.tmp"
const SAVE_VERSION := 2

func save_game(data: Dictionary) -> Error:
	data["version"] = SAVE_VERSION
	var file := FileAccess.open(TMP_PATH, FileAccess.WRITE)
	if file == null:
		return FileAccess.get_open_error()
	file.store_string(JSON.stringify(data, "\t"))
	file.close()
	return DirAccess.rename_absolute(
		ProjectSettings.globalize_path(TMP_PATH), ProjectSettings.globalize_path(SAVE_PATH))

func load_game() -> Dictionary:
	if not FileAccess.file_exists(SAVE_PATH):
		return {}
	var text := FileAccess.get_file_as_string(SAVE_PATH)
	var parsed: Variant = JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY:
		push_error("Save file corrupt or unreadable")
		return {}
	return _migrate(parsed as Dictionary)

func _migrate(data: Dictionary) -> Dictionary:
	var v: int = int(data.get("version", 1))
	if v < 2:
		data["creature"] = data.get("creature", {"name": "Dog", "bond": 0.0})
	return data
```

- Collect state from saveable nodes through a group (`get_tree().get_nodes_in_group("persist")`), each implementing `to_save() -> Dictionary` and `from_save(d: Dictionary)`. Give each one a stable `save_id` (not a node path that may change).
- JSON turns all numbers into floats and `Vector3` into nothing useful. Serialize vectors as arrays and cast on load.
- Autosave at safe points (scene transitions, after key interactions), not every frame.

## Settings

- Store settings separately from saves with `ConfigFile` (`user://settings.cfg`): audio volumes, sensitivity, graphics quality, keybinds, accessibility options (camera shake, motion).
- Apply settings at startup in an autoload, before the first scene uses them.
- Rebindable controls: modify the `InputMap` at runtime and save the events (keycode, button index, axis) to the config.
