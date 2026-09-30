# Debugging

Follow in order. Name the cause before changing code; timing hacks (`await process_frame`, `call_deferred` everywhere, arbitrary delays) hide ordering bugs instead of fixing them.

## 1. Read the actual error

- Debugger → Errors tab has the full stack trace; click through to the line. Warnings matter too (unsafe casts, unused signals often reveal the bug).
- Common messages:

| Message | Cause | Fix |
|---|---|---|
| `Invalid access to property or key 'x' on a base object of type 'null instance'` | Node reference is null: wrong path, `@onready` accessed before ready, node freed, or `get_node` from a scene run standalone | Check the path/`%UniqueName`; guard setters with `is_node_ready()`; `is_instance_valid()` after awaits |
| `Node not found: "Sprite2D" (relative to "/root/...")` | Path wrong or node renamed/moved | Use `%UniqueName` or `@export var` refs |
| `Can't change this state while flushing queries` | Changing collision state inside a physics callback | `set_deferred` / `call_deferred` (`references/physics.md`) |
| `Attempt to call function 'x' in base 'previously freed'` | Using a node after `queue_free()` | `is_instance_valid()`; disconnect or stop timers/tweens owned by others |
| `Parser Error: ... not found in base self` / `Identifier "x" not declared` | Godot 3 API or typo | §Godot 3 → 4 table in SKILL.md |
| `Cannot call method 'x' on a null value` right after `instantiate()` | Calling methods that use `@onready` vars before `add_child` | Call after adding to the tree, or pass data via plain properties |
| `Trying to assign value of type 'X' to a variable of type 'Y'` | Typed variable receiving wrong/`null` value (e.g. `as` cast failed) | Check the source; handle `null` explicitly |
| `Condition "!is_inside_tree()" is true` | Using `global_*`, `get_tree()`, or `get_viewport()` on a node not in the tree | Add to tree first |
| `Resource file not found: res://...` / broken dependency dialog | File moved outside the editor, missing `.uid` | Move files in the FileSystem dock; commit `.uid` files; fix dependencies dialog |

## 2. Inspect the live scene

- While running: Scene dock → **Remote** tab shows the real runtime tree; select nodes to see live property values. Most "the node isn't there / has wrong values" questions end here.
- Debug menu: **Visible Collision Shapes**, **Visible Navigation**, **Visible Paths** — enable for any physics/navigation bug.
- Breakpoints (F9 / `breakpoint` keyword), step, and inspect locals. Faster than `print` for logic bugs.
- `print_debug()` includes file and line; `print_stack()`; `push_warning()` shows in the Debugger with a trace.

## 3. Category-specific checks

**Collision/detection doesn't fire**
1. Visible Collision Shapes on — are shapes where you think, with non-zero size?
2. Layer/mask: does the *detector's mask* include the *other's layer*? (Area: `monitoring` on; other side's `monitorable` on for area-area.)
3. Signal actually connected (green icon in the Node dock or `.connect` in code executed)?
4. Right signal: `body_entered` for PhysicsBodies/TileMapLayers, `area_entered` for Areas.
5. Node type: `CollisionShape2D` must be a direct child of the body/area; disabled shape?
6. Scale: non-uniform/negative scale on physics nodes?

**Falls through floor / passes through walls** → tunneling (speed vs thickness), floor collider missing on that layer, `velocity * delta` passed to `move_and_slide`, or position set directly on a RigidBody. `references/physics.md` → Tunneling.

**Jitter / stutter** → physics interpolation off; camera updated in `_process` while target moves in `_physics_process`; pixel snapping vs smooth camera conflict; teleport without `reset_physics_interpolation()`.

**Movement speed differs by frame rate** → missing `delta` for manual movement, or `lerp(a, b, 0.1)` per frame; moving in `_process` without delta.

**Character sticks to walls / can't climb small steps** → `floor_max_angle`, `floor_snap_length`, capsule instead of box, `safe_margin`.

**Input doesn't respond** → action name typo (StringName mismatch silently returns false — check the Input Map), a Control with `mouse_filter = STOP` covering the screen, `set_input_as_handled()` earlier in the chain, node paused (`process_mode`), window not focused.

**Animation doesn't play / snaps back** → AnimationTree active and overriding AnimationPlayer; calling `play()` every frame restarts one-shot animations (check `current_animation` first or use the state machine); Tween and AnimationPlayer animating the same property; `RESET` track values.

**Navigation agent doesn't move** → path requested before the map synced (first frame), navmesh not baked or on a different navigation layer, `agent_radius` too large for corridors, target off the navmesh (`NavigationServer*.map_get_closest_point`).

**Works in editor, broken in export** → files excluded by export filters (resources loaded by dynamic string paths aren't auto-detected — add to "Export selected resources" or filters); `res://` writes; case-sensitive paths (Windows/macOS ignore case, Linux/Android/web don't); missing `.import`d resources for files loaded via `FileAccess` instead of `load()`; debug-only `assert` side effects.

**Resource changes affect every instance** → shared Resource (`duplicate()` / Local to Scene).

**Signals fire twice** → connected both in the editor and in code, or connected again each time a scene re-enters the tree (`_ready` runs once, `_enter_tree` runs every time; guard with `is_connected`).

## 4. Isolate

- Run the scene alone (F6). If it breaks only inside the full game, the bug is in the wiring (who connects/configures it), not in the scene.
- Build a minimal reproduction scene with only the involved nodes.
- Bisect with version control when something used to work.

## 5. Fix at the cause, then verify

Verify the fix in the scenario that failed and one adjacent scenario (pause/unpause, scene reload, different frame rate via `Engine.max_fps = 30`, a slow machine). Frame-rate-dependent bugs often only appear at high or low FPS.
