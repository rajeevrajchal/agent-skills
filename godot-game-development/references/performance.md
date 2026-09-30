# Performance

## Measure before changing anything

1. Run an **exported release build** or at least a debug run on the target device. Editor runs include editor overhead; desktop numbers say nothing about mobile or web.
2. Identify the bottleneck category using the Debugger:
   - **Monitors** tab: FPS, process time, physics process time, draw calls, objects/nodes count, video memory.
   - **Profiler**: script functions by self/total time per frame. Sort by self time.
   - **Visual Profiler**: CPU vs GPU time per render pass.
   - Add custom monitors for your own systems: `Performance.add_custom_monitor(&"game/enemies", func() -> int: return _enemies.size())`.
3. Classify:
   - `Process` or `Physics Process` time high → CPU/script or physics (§ CPU).
   - GPU time high, many draw calls → rendering (§ GPU).
   - Frame spikes (not steady slowness) → allocation/GC (C#), loading on main thread, shader compilation, `print` spam, or a periodic system (pathfinding burst).
4. Change one thing, measure again.

Frame budget: 16.6 ms at 60 FPS, 8.3 ms at 120. Physics runs at a fixed tick; if one tick takes longer than its interval, the engine runs catch-up ticks (up to `max_physics_steps_per_frame`) — the "spiral of death" feels like the game suddenly running in slow motion.

## CPU (script)

- Disable what isn't needed: `set_process(false)` / `set_physics_process(false)` for idle objects; `VisibleOnScreenEnabler2D/3D` to pause offscreen enemies; `process_mode = DISABLED` for dormant subtrees.
- Tick AI decisions at 5–10 Hz with a Timer or frame counter; keep only movement per physics tick.
- Cache: `@onready` node refs, `StringName` literals (`&"run"`) for repeated animation/action names, precomputed values.
- Avoid in hot paths: `get_node()` / `$` lookups, `get_tree().get_nodes_in_group()` every frame, string building, `print`, creating Arrays/Dictionaries per frame, `has_method` + `call` dispatch (use typed references).
- Typed GDScript is measurably faster (typed instructions). `for i in range(n)` over packed arrays; `PackedFloat32Array`/`PackedVector2Array` for large numeric data.
- Distance comparisons with `distance_squared_to`.
- Spatial queries: use physics (`Area`, shape queries) or a grid/spatial hash instead of O(n²) loops over all entities.
- Heavy pure-computation systems (procedural generation, big pathfinding): run on a `WorkerThreadPool` task (no scene-tree access from the thread; hand results back with `call_deferred`), or move the hot loop to C#/GDExtension.

## Physics

- Simplest shapes: circles/capsules/boxes over polygons; convex over concave; `ConcavePolygonShape3D` only for static geometry.
- Reduce pairs: correct layers/masks so things that never interact never get tested (enemies vs enemies, pickups vs world).
- Sleep: RigidBodies sleep when still (`can_sleep`); don't wake them by setting properties every frame.
- Jolt (3D) scales better with many bodies than GodotPhysics3D.
- Thousands of bullets: don't give each an `Area2D`; move them in one manager and raycast/shape-query, or use `PhysicsServer2D` directly.

## GPU / rendering

2D:
- Draw calls batch when consecutive items share texture and material. Use texture atlases (sprite sheets, TileSet atlases); avoid unique materials per sprite; changing `z_index`/order interleaves batches.
- Many identical sprites → `MultiMeshInstance2D`. Many lights with shadows → cost per light per affected item.
- Large full-screen shaders and `hint_screen_texture` copies are fill-rate heavy on mobile.

3D:
- Draw calls: merge static meshes, use `MultiMeshInstance3D` for vegetation/crowds, share materials (same `StandardMaterial3D` resource).
- Shadows: fewer shadow-casting lights, shorter `directional_shadow_max_distance`, disable `cast_shadow` on small objects, lower shadow atlas sizes on mobile.
- LOD (automatic mesh LOD on import), `visibility_range` for distant props, occlusion culling for dense scenes.
- Expensive post effects: SDFGI, volumetric fog, SSR, SSIL — expose them as graphics settings.
- Resolution scaling: `Viewport.scaling_3d_mode` (FSR 1/2, bilinear) and `scaling_3d_scale` for GPU-bound 3D; UI stays sharp.
- Transparent materials are sorted and drawn without depth prepass — keep them few and small.

## Memory and loading

- `preload` pulls resources in when the script loads; a script preloading every level makes startup slow and memory high. Load levels on demand, threaded.
- Texture import: VRAM compression (default for 3D) for large textures; lossless for pixel art/UI. Mipmaps for 3D textures, off for 2D UI.
- Audio: WAV for short SFX, OGG for music (streamed).
- Nodes freed with `queue_free()` release memory; orphan nodes (removed with `remove_child` and never freed) leak — the Monitors "Orphan Nodes" counter shows them (`print_orphan_nodes()` in debug).

## Stutter checklist

| Symptom | Likely cause | Fix |
|---|---|---|
| Hitch the first time an effect/enemy appears | Shader pipeline compilation, or resource loaded on demand | Preload + render once during loading; 4.4+ ubershaders reduce this in Forward+/Mobile |
| Regular spikes every few seconds (C#) | GC from per-frame allocations | Remove allocations in hot paths |
| Hitch on level/area transition | Synchronous `load()`/`instantiate()` of big scenes | Threaded load; split levels into chunks |
| Smooth FPS counter but motion stutters | Physics/render tick mismatch | Physics interpolation (2D 4.3+, 3D 4.4+) |
| Stutter only in windowed mode / with V-Sync off | Frame pacing | Test with V-Sync on; check `max_fps` setting |
