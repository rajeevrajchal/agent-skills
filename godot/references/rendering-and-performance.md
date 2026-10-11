# Rendering and Performance

## Contents
- Renderer choice
- Lighting and global illumination
- Environment and post-processing
- Materials and shaders
- Profiling workflow
- Budgets
- CPU-side optimizations
- GPU-side optimizations
- Mobile and low-end
- Loading and stutter

## Renderer choice

| Renderer | Targets | Notes |
|---|---|---|
| **Forward+** | Desktop, consoles, high-end | All features: SDFGI, VoxelGI, volumetric fog, SSR, SSIL, many lights |
| **Mobile** | Phones, tablets, low-end desktop, XR | Cheaper; fewer lights per object; no SDFGI or volumetric fog; LightmapGI recommended |
| **Compatibility** | Web, very old GPUs | OpenGL 3/WebGL 2; the most limited feature set; baked lighting |

Pick the renderer at the start for the weakest target. Switching later changes the look and the available features. On Windows, Godot 4.6+ defaults to the Direct3D 12 backend (Vulkan is still available).

## Lighting and global illumination

| Approach | Dynamic objects lit? | Cost | Use for |
|---|---|---|---|
| `LightmapGI` (baked) | Via probes | Cheapest at runtime; bake time | Static levels, mobile, the highest-quality static GI |
| `VoxelGI` | Yes | Medium; bake per volume | Small-to-medium indoor scenes with movement |
| `SDFGI` | Yes | Higher; Forward+ only | Large or open outdoor scenes, dynamic time of day |
| `ReflectionProbe` | — | Low to medium | Local reflections; combine with any of the above |
| No GI + ambient | — | Lowest | Stylized or low-poly games |

Lights:
- Shadow-casting lights are the most expensive part of most scenes. Limit them, and turn off shadows on small or fill lights.
- `DirectionalLight3D`: tune `directional_shadow_max_distance` to what's visible (smaller = sharper and cheaper). Use 2–4 splits.
- Omni and spot lights: set `distance_fade` so distant lights turn off.
- `AreaLight3D` (4.7+): rectangular emitters for screens, windows, and panels. Check its cost on your target.
- For a cozy or stylized look: one directional light (warm), ambient from the sky, baked GI or ambient occlusion, gentle fog, and a tonemapper (AgX or Filmic) with tuned exposure.

## Environment and post-processing

`WorldEnvironment` + `Environment`:
- Tonemap: AgX (4.4+) or Filmic for natural highlight rolloff. Set exposure and white explicitly.
- SSAO and SSIL for contact shadows (Forward+). Volumetric fog for atmosphere (Forward+ only, and costly on low-end).
- Glow for emissive highlights (4.6 composites glow before tonemapping).
- Every post effect has a cost. Toggle each one and measure, and expose quality settings to players.

## Materials and shaders

- `StandardMaterial3D` covers most needs. Convert to `ShaderMaterial` only for custom effects.
- Share materials between meshes. Every unique material or shader variant adds draw-call state changes and compile time.
- Per-instance variation without new materials: `instance uniform` in shaders (instance shader parameters), or `MultiMesh` custom data.
- Transparency is expensive (sorting, overdraw). Prefer alpha scissor or alpha hash for foliage.
- Texture import: VRAM Compressed for 3D, mipmaps on, normal maps detected as normal maps. Keep texture sizes appropriate to the screen size of the object.

## Profiling workflow

1. Run a **release-like build** on the **target device** if possible. Editor runs carry overhead.
2. Look at Debugger → Monitors: FPS, process and physics time, draw calls, objects, video memory, physics active bodies.
3. Is the bottleneck CPU or GPU? If process or physics time is near the frame budget, it's the CPU. If the GPU time in the Visual Profiler dominates, it's the GPU. Test by lowering resolution (`scaling_3d_scale` 0.5): if FPS rises, you're GPU-bound.
4. CPU-bound → Debugger → Profiler: find the heavy scripts and functions. Visual Profiler → per-pass GPU cost.
5. Fix the top item, re-measure, and repeat. Keep notes of before and after numbers.

## Budgets

Rough starting budgets per frame (adjust for your target):

| Target | Frame time | Draw calls | Shadow lights | Notes |
|---|---|---|---|---|
| Desktop 60 fps | 16.6 ms | < 2,000–3,000 | a few | |
| Mobile 30–60 fps | 33/16 ms | < 300–500 | 1 | Baked lighting, Mobile renderer |
| Web | 16–33 ms | < 300 | 0–1 | Compatibility renderer |

## CPU-side optimizations

- Don't process idle things: `set_process(false)` and `set_physics_process(false)` when inactive. Use `VisibleOnScreenEnabler3D` to pause offscreen nodes.
- Throttle AI and perception (timers at 5–10 Hz, staggered).
- No `load()`, `get_node()` with string paths, or new allocations (arrays, strings) inside per-frame loops in hot code. Cache them.
- Use the physics layer plan to keep collision pairs low. Prefer simple shapes. Sleep idle rigid bodies.
- Move heavy, independent work to `WorkerThreadPool`. Touch nodes only from the main thread (or use `call_deferred`).
- Pool objects only when profiling shows instancing spikes (many bullets or particles per second). Godot instancing is reasonably fast.
- GDScript hot loops that are still too slow after the above → move them to C# or GDExtension.

## GPU-side optimizations

- **Draw calls**: `MultiMeshInstance3D` for repeated meshes (grass, rocks, crowds); merge static meshes that share a material; fewer materials.
- **LOD**: automatic mesh LOD is generated on import (check the import settings). `visibility_range_begin`/`_end` on `GeometryInstance3D` for manual HLOD (swap to impostors at distance).
- **Culling**: `OccluderInstance3D` with baked occluders for indoor or dense urban scenes. Frustum culling is automatic.
- **Overdraw**: limit large transparent surfaces and particles. Use alpha scissor.
- **Shadows**: lower the shadow atlas size and max distance; fewer shadow-casting lights; `cast_shadow = off` on small props.
- **Resolution**: `scaling_3d_mode` (FSR 1/2, MetalFX on Apple where supported) with `scaling_3d_scale` < 1 on weaker GPUs.
- **Particles**: `GPUParticles3D` for many particles; keep the amount and lifetime modest; use visibility AABBs.

## Mobile and low-end

- Mobile renderer, `LightmapGI`, one shadowed directional light at most, no SSR, SSAO, or volumetric fog.
- Use ASTC/ETC2 texture compression (enable it in the export settings), and smaller textures.
- Limit the physics tick to 60 (or 30 for slow-paced games, with interpolation on).
- Cap the frame rate (`Engine.max_fps`) to save battery for slow-paced games.
- Test thermal throttling: run for 10+ minutes on the device.

## Loading and stutter

- **Shader compilation stutter**: Godot 4.4+ uses ubershaders and pipeline precompilation, which greatly reduce first-use stutter. On older versions, warm up the materials during the loading screen (render them once offscreen).
- **Scene loading**: `ResourceLoader.load_threaded_request(path)` → poll `load_threaded_get_status` → `load_threaded_get`, with a loading screen.
- **Spawning many nodes at once** causes a frame spike. Spread spawning over several frames.
