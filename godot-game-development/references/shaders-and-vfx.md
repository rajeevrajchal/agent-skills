# Shaders and VFX

## When a shader is the right tool

Use a shader when the effect is per-pixel or per-vertex (dissolve, outline, hit flash on a textured sprite, water, wind sway on foliage, palette swap, screen distortion). Use `modulate`, Tweens, or AnimationPlayer when a whole-node property change is enough: tint, fade, and scale need no shader. `modulate` multiplies, so it can darken or tint but can't turn a textured sprite solid white — a clean white hit flash needs the small shader below (or an over-bright `modulate` like `Color(3, 3, 3)` if the slightly blown-out look is acceptable).

## Shader types

| `shader_type` | Applies to |
|---|---|
| `canvas_item` | 2D nodes and Controls |
| `spatial` | 3D meshes |
| `particles` | GPUParticles process shader (custom motion) |
| `sky` | `Sky` resource in WorldEnvironment |
| `fog` | FogVolume (Forward+) |

Files are `.gdshader`; assign via a `ShaderMaterial`. Reusable snippets go in `.gdshaderinc` and are included with `#include "res://shaders/common.gdshaderinc"`.

## 2D examples

Hit flash (white-out that preserves alpha):

```glsl
shader_type canvas_item;

uniform vec4 flash_color : source_color = vec4(1.0);
uniform float flash_amount : hint_range(0.0, 1.0) = 0.0;

void fragment() {
	vec4 tex = texture(TEXTURE, UV);
	COLOR = vec4(mix(tex.rgb, flash_color.rgb, flash_amount), tex.a);
}
```

Drive it from GDScript with a Tween on `material:shader_parameter/flash_amount`:

```gdscript
var t := create_tween()
t.tween_property(_sprite, ^"material:shader_parameter/flash_amount", 1.0, 0.03)
t.tween_property(_sprite, ^"material:shader_parameter/flash_amount", 0.0, 0.12)
```

The material is shared between all instances using the same resource — enable **Local to Scene** on the ShaderMaterial or `duplicate()` it, or one hit flashes every enemy. In 3D, prefer `instance uniform` (per-instance values without duplicating materials).

Dissolve:

```glsl
shader_type canvas_item;

uniform sampler2D noise_tex : repeat_enable;
uniform float progress : hint_range(0.0, 1.0) = 0.0;
uniform float edge_width = 0.05;
uniform vec4 edge_color : source_color = vec4(1.0, 0.5, 0.1, 1.0);

void fragment() {
	vec4 tex = texture(TEXTURE, UV);
	float n = texture(noise_tex, UV).r;
	float cut = step(progress, n);
	float edge = step(progress, n + edge_width) - cut;
	COLOR = vec4(mix(tex.rgb, edge_color.rgb, edge), tex.a * max(cut, edge));
}
```

Use a `NoiseTexture2D` resource for `noise_tex` — no image asset needed.

## 3D example: wind sway for foliage

```glsl
shader_type spatial;
render_mode cull_disabled;

uniform sampler2D albedo_tex : source_color, filter_linear_mipmap;
uniform float sway_strength = 0.1;
uniform float sway_speed = 1.5;
instance uniform float phase_offset = 0.0;   // set per MeshInstance3D, no material duplication

void vertex() {
	// Assumes model origin at the base; vertices higher up sway more.
	float h = max(VERTEX.y, 0.0);
	float wave = sin(TIME * sway_speed + phase_offset + NODE_POSITION_WORLD.x * 0.3);
	VERTEX.x += wave * sway_strength * h * h;
}

void fragment() {
	vec4 c = texture(albedo_tex, UV);
	ALBEDO = c.rgb;
	ALPHA_SCISSOR_THRESHOLD = 0.5;
	ALPHA = c.a;
}
```

`ALPHA_SCISSOR_THRESHOLD` avoids the cost and sorting problems of true transparency for foliage cutouts.

## Rules

- `source_color` hint on color uniforms and albedo samplers (correct sRGB → linear conversion). Missing it → washed-out colors.
- Filtering/repeat are sampler hints (`filter_nearest`, `repeat_enable`), not texture import settings, in Godot 4.
- `hint_range` on floats for Inspector sliders designers can use.
- Branching on uniforms is fine; heavy per-pixel loops and many texture reads are what cost. Profile with the GPU profiler/`Visual Profiler`.
- Transparency in 3D (`ALPHA` < 1 without scissor) disables depth write and causes sorting issues — use it sparingly; prefer alpha scissor or hash.
- First use of a new shader/material combo compiles at runtime and can hitch. Godot 4.4+ has ubershader-based pipeline pre-compilation that reduces this in Forward+/Mobile; for remaining hitches, pre-warm by rendering the effect once during a loading screen.
- `VisualShader` is fine for designers; keep programmer-facing effects in text shaders (diffable, reviewable).

## Screen-space effects

- 2D post-process: a `CanvasLayer` with a full-rect `ColorRect` whose shader samples `uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap;` Set the ColorRect's `mouse_filter` to Ignore.
- 3D post-process: a full-screen quad `MeshInstance3D` (spatial shader, `render_mode unshaded`, with `hint_screen_texture` / `hint_depth_texture`) or, in 4.3+, a `CompositorEffect` for compute-based effects in Forward+/Mobile.
- Built-in first: glow, tonemap, color adjustments, fog, SSAO, and DOF in `WorldEnvironment`/`CameraAttributes` cover most needs.

## Particles

- `GPUParticles2D/3D` for large counts; `CPUParticles2D/3D` for Compatibility renderer/web consistency, few particles, or when you need to read particle state. Convert between them from the node's toolbar menu.
- One-shot bursts (hit sparks): `one_shot = true`, `explosiveness = 1.0`, `emitting = true` to fire; free after `finished` signal (4.1+), or reuse the same emitter with `restart()`.
- Set `visibility_rect`/`visibility_aabb` generously (or generate it from the toolbar), otherwise particles get culled when the emitter is offscreen.
- Trails: `trail_enabled` (GPU, 3D/2D) or `Line2D` updated per frame for sword swipes.
- Texture atlases with `particles_anim_*` for animated flipbooks instead of many emitters.
