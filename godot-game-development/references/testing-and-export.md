# Testing, CI, Version Control, and Export

## Version control

`.gitignore` for Godot 4:

```gitignore
# Godot 4 cache/import data — regenerated on open
.godot/
# Exports
/build/
*.tmp
# .NET
.mono/
bin/
obj/
```

Commit: `project.godot`, `export_presets.cfg` (minus secrets — keystore passwords/credentials go in environment variables or the editor settings, not the preset), all `.tscn/.tres/.gd/.gdshader/.cs`, `*.import` files (they carry import settings), and **all `*.uid` files** (4.4+; without them references break when others pull). Never ignore `*.uid` or `*.import`.

Scenes are text (`.tscn`) and merge poorly when two people edit the same scene. Mitigate by splitting large scenes into sub-scenes owned by different people, and use `.gitattributes` with `*.tscn text eol=lf` to prevent line-ending noise. Use Git LFS for large binary assets (`.png`, `.glb`, `.wav`, `.ogg`, `.psd`).

## What to test

Test logic that is easy to get wrong and expensive to check by hand: damage formulas, inventory rules, save migration, procedural generation invariants, state machine transitions, pathfinding helpers. Don't unit-test "the sprite moves" — playtest it.

Push logic into testable units:
- Pure functions (`static func` in a utility class) and `RefCounted` model objects (Inventory, Wallet) — no scene tree needed.
- Scenes that can be instantiated standalone (no `/root/Main` lookups in `_ready`).

## Frameworks

- **GUT** (Godot Unit Test) — GDScript, mature, CLI runner.
- **gdUnit4** — GDScript and C#, scene runner for simulating input and frames, editor integration, CI GitHub Action.

gdUnit4 example:

```gdscript
# tests/inventory_test.gd
extends GdUnitTestSuite

func test_add_stacks_same_item() -> void:
	var inv := Inventory.new(10)
	var potion := preload("res://items/potion.tres")
	inv.add(potion, 3)
	inv.add(potion, 2)
	assert_int(inv.count_of(potion)).is_equal(5)
	assert_int(inv.used_slots()).is_equal(1)

func test_player_takes_damage() -> void:
	var runner := scene_runner("res://actors/player/player.tscn")
	var player := runner.scene() as Player
	player.take_damage(3)
	assert_int(player.health).is_equal(player.stats.max_health - 3)
```

GUT example:

```gdscript
extends GutTest

func test_migrates_v1_save() -> void:
	var v1 := {"version": 1, "nodes": [{"hp": 7}]}
	var migrated := SaveManager._migrate(v1)
	assert_eq(migrated["nodes"][0]["health"], 7)
	assert_false(migrated["nodes"][0].has("hp"))
```

## Headless CI

Useful commands (Godot 4 binary as `godot`):

```bash
# Import assets and build the .godot cache (required before running tests on a fresh checkout)
godot --headless --path . --import

# Parse-check a script without running it
godot --headless --path . --check-only --script res://actors/player/player.gd

# Run GUT
godot --headless --path . -s res://addons/gut/gut_cmdln.gd -gdir=res://tests -gexit

# Export
godot --headless --path . --export-release "Windows Desktop" build/windows/game.exe
```

Linting/formatting: `gdtoolkit` (`pip install "gdtoolkit==4.*"`) provides `gdlint` and `gdformat`. Run both in CI; configure rules in `gdlintrc`.

Turn on GDScript warnings as errors for CI-critical ones (Project Settings → Debug → GDScript): `untyped_declaration`, `unsafe_call_argument`, `unused_variable`, `shadowed_variable`, `return_value_discarded` (for `Error` returns).

Minimal GitHub Actions job:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    container: barichello/godot-ci:4.4   # pin to your exact Godot version
    steps:
      - uses: actions/checkout@v4
        with: { lfs: true }
      - run: godot --headless --path . --import
      - run: godot --headless --path . -s res://addons/gut/gut_cmdln.gd -gdir=res://tests -gexit
```

Pin the exact engine version everywhere (CI image, export templates, team editors). Mixed minor versions rewrite scene files and cause churn.

## Export

- Install export templates matching the editor version exactly.
- One export preset per target; use **feature tags** for platform differences: `OS.has_feature("mobile")`, `OS.has_feature("web")`, or custom tags (`demo`, `steam`) set per preset.
- Exclude editor-only and test folders from exports (preset → Resources → filters to exclude: `tests/*, addons/gut/*`).
- Release builds strip `assert()`; debug builds keep them. Test the release build before shipping.
- Encryption of the PCK is available with a custom-built template and key; it deters casual extraction, it doesn't stop determined users.

Platform notes:

| Target | Notes |
|---|---|
| Web | Compatibility renderer. Threads need COOP/COEP headers (SharedArrayBuffer); the single-threaded export (4.3+) avoids that requirement for hosts like itch.io. No C#. Audio starts after a user gesture. Keep the PCK small. |
| Android | Gradle build for plugins; set up keystore for release; test on low-end devices; Mobile or Compatibility renderer; handle `NOTIFICATION_APPLICATION_PAUSED`. |
| iOS | Export produces an Xcode project; build and sign on macOS. |
| Desktop | Code signing/notarization for macOS; Windows icon/rcedit set in editor settings. |
| Dedicated server | "Dedicated Server" export mode strips visuals; run `--headless`. |
| Consoles | Via licensed third-party porting partners; not in the open-source engine. |
