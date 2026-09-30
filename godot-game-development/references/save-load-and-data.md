# Save/Load and Data

## Choose the format

| Data | Format | Why |
|---|---|---|
| Authored game data (items, enemies, levels config) | `.tres` Resources in `res://` | Inspector editing, type safety, shipped with the game |
| Player settings (volume, bindings, graphics) | `ConfigFile` at `user://settings.cfg` | Human-readable INI, simple sections/keys |
| Save games | JSON or `var_to_bytes` (without objects) at `user://saves/slot_N.*` | Safe to load, versionable, debuggable (JSON) |
| Large binary state (voxel worlds) | `FileAccess.store_buffer` with your own layout, optionally compressed | Size/speed |

**Don't load save games as Resources** (`ResourceLoader.load("user://save.tres")`) when saves can be shared or edited: a `.tres` can embed a script that runs on load. The same applies to `bytes_to_var_with_objects`/`str_to_var` on untrusted input. For purely local single-player games the risk is lower, but JSON is still easier to migrate and debug.

`user://` maps to the OS app-data folder (`OS.get_user_data_dir()`); `res://` is read-only in exported games.

## Save game pattern

Each saveable node knows how to serialize itself; a `SaveManager` autoload collects and writes.

```gdscript
# systems/save_manager.gd  (autoload "SaveManager")
extends Node

const SAVE_VERSION := 2
const SAVE_DIR := "user://saves"

signal saved(slot: int)
signal loaded(slot: int)

func save_game(slot: int) -> Error:
	var data := {
		"version": SAVE_VERSION,
		"timestamp": Time.get_unix_time_from_system(),
		"level": get_tree().current_scene.scene_file_path,
		"nodes": [],
	}
	for node in get_tree().get_nodes_in_group(&"persist"):
		if not node.has_method(&"save_state"):
			push_warning("%s is in 'persist' but has no save_state()" % node.get_path())
			continue
		var entry: Dictionary = node.call(&"save_state")
		entry["path"] = str(node.get_path())
		data["nodes"].append(entry)

	DirAccess.make_dir_recursive_absolute(SAVE_DIR)
	var final_path := "%s/slot_%d.json" % [SAVE_DIR, slot]
	var tmp_path := final_path + ".tmp"
	var file := FileAccess.open(tmp_path, FileAccess.WRITE)
	if file == null:
		return FileAccess.get_open_error()
	file.store_string(JSON.stringify(data, "\t"))
	file.close()
	# Write-then-rename: a crash mid-write never corrupts the existing save.
	var err := DirAccess.rename_absolute(tmp_path, final_path)
	if err == OK:
		saved.emit(slot)
	return err


func read_save(slot: int) -> Dictionary:
	var path := "%s/slot_%d.json" % [SAVE_DIR, slot]
	if not FileAccess.file_exists(path):
		return {}
	var text := FileAccess.get_file_as_string(path)
	var parsed: Variant = JSON.parse_string(text)
	if not (parsed is Dictionary):
		push_error("Corrupt save in slot %d" % slot)
		return {}
	return _migrate(parsed as Dictionary)


func _migrate(data: Dictionary) -> Dictionary:
	var version: int = int(data.get("version", 1))
	if version < 2:
		# v1 stored "hp"; v2 uses "health".
		for entry: Dictionary in data.get("nodes", []):
			if entry.has("hp"):
				entry["health"] = entry["hp"]
				entry.erase("hp")
	data["version"] = SAVE_VERSION
	return data
```

A saveable node:

```gdscript
func _ready() -> void:
	add_to_group(&"persist")

func save_state() -> Dictionary:
	return {
		"position": [global_position.x, global_position.y],   # JSON has no Vector2
		"health": _health,
	}

func load_state(state: Dictionary) -> void:
	var p: Array = state.get("position", [0.0, 0.0])
	global_position = Vector2(float(p[0]), float(p[1]))
	_health = int(state.get("health", stats.max_health))
```

Notes:
- JSON numbers come back as `float`; cast with `int()` explicitly.
- Vectors/Colors don't survive JSON; store arrays or use `var_to_str`/`str_to_var` for engine types (safe without objects, but not human-friendly).
- Saving by node path breaks when the scene tree changes. For spawned entities (dropped items, enemies), store the scene path + state and re-instance on load; for fixed level objects, use a stable `@export var save_id: StringName`.
- Always version saves and migrate on read. Players keep old saves across updates.
- Web: `user://` is IndexedDB-backed; writes persist when the browser allows it. Mobile: save on `NOTIFICATION_APPLICATION_PAUSED` / focus-out, the OS may kill the app without warning.

## Settings

```gdscript
const SETTINGS_PATH := "user://settings.cfg"
var _config := ConfigFile.new()

func load_settings() -> void:
	_config.load(SETTINGS_PATH)   # missing file → empty config, defaults below apply
	var music: float = _config.get_value("audio", "music", 0.8)
	AudioServer.set_bus_volume_db(AudioServer.get_bus_index(&"Music"), linear_to_db(music))
	var fullscreen: bool = _config.get_value("video", "fullscreen", false)
	DisplayServer.window_set_mode(
		DisplayServer.WINDOW_MODE_FULLSCREEN if fullscreen else DisplayServer.WINDOW_MODE_WINDOWED)

func set_setting(section: String, key: String, value: Variant) -> void:
	_config.set_value(section, key, value)
	_config.save(SETTINGS_PATH)
```

## Loading screens / threaded loading

```gdscript
signal progress_changed(ratio: float)
signal finished(scene: PackedScene)

var _path: String

func begin(path: String) -> void:
	_path = path
	ResourceLoader.load_threaded_request(path)
	set_process(true)

func _process(_delta: float) -> void:
	var progress: Array = []
	var status := ResourceLoader.load_threaded_get_status(_path, progress)
	match status:
		ResourceLoader.THREAD_LOAD_IN_PROGRESS:
			progress_changed.emit(progress[0])
		ResourceLoader.THREAD_LOAD_LOADED:
			set_process(false)
			finished.emit(ResourceLoader.load_threaded_get(_path) as PackedScene)
		ResourceLoader.THREAD_LOAD_FAILED, ResourceLoader.THREAD_LOAD_INVALID_RESOURCE:
			set_process(false)
			push_error("Failed to load %s" % _path)
```

Instantiating a huge scene still happens on the main thread and can hitch; split big levels into chunks if that's measurable.

## Resource gotchas

- `load()` caches: two `load("res://x.tres")` calls return the same object. Mutating it mutates everywhere. `duplicate(true)` for a deep copy. How arrays/dictionaries *containing* resources are copied changed across 4.x releases (4.5 added `duplicate_deep()`), so verify nested data is actually copied in your version.
- `ResourceSaver.save()` on a loaded `res://` resource at runtime writes to the project only in the editor; exported games can't write `res://`.
- Move and rename files inside the editor's FileSystem dock, never in the OS file manager. Godot 4.4+ references scripts and resources by UID, which survives moves only if the `.uid` files are committed and moved along.
