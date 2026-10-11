# Assets Pipeline

## Contents
- Formats
- Blender conventions
- Wrapping imported scenes
- Collision from import
- Import settings that matter
- Animations: import, loop, retarget
- Textures and materials
- Checklist for a new model

## Formats

- **glTF 2.0 (`.glb`)** is the preferred interchange format: meshes, materials, skeletons, animations, and cameras.
- **`.blend`** direct import works when the Blender executable path is set in the Editor Settings. It's convenient, but every team member needs Blender installed. It converts through glTF under the hood.
- FBX is supported through the built-in FBX importer (ufbx, 4.3+). Prefer glTF when you control the export.
- OBJ only for simple static meshes (no materials, hierarchy, or animation).

## Blender conventions

- **Units**: metric, 1 Blender unit = 1 m. Model at real scale (a dog about 0.5–0.7 m tall, doors 2.1 m).
- **Apply transforms** (Ctrl+A → All Transforms) before export. Unapplied scale breaks physics and animation.
- **Orientation**: model characters facing Blender's −Y (front view). glTF export converts this to facing +Z in Godot. Godot cameras and `look_at` use −Z as forward, so use `look_at(..., use_model_front = true)`, or rotate the model 180° inside the wrapper scene.
- **Origin**: at the feet (characters, props) or at the hinge (doors). Godot places the node at the origin.
- **Naming**: meaningful object and bone names. Use the import suffixes below for collision and behavior.

## Wrapping imported scenes

Don't edit an imported `.glb` scene directly; changes are lost on reimport. Instead:
1. Create a **wrapper scene** (`creature.tscn`) with your own root (`CharacterBody3D`) and add the `.glb` as a child instance (`Model`).
2. Add collision, scripts, the `AnimationTree`, and modifiers in the wrapper.
3. If you must tweak an imported node, use the Advanced Import Settings (per-node and per-mesh options) or an import script (`EditorScenePostImport`), not "Editable Children".

Inherited scenes (Scene → New Inherited Scene) also work, but wrapper scenes survive model changes better.

## Collision from import

Name suffixes in Blender, or per-mesh options in Advanced Import Settings:

| Suffix | Result |
|---|---|
| `-col` | Mesh + StaticBody3D with a trimesh collision shape |
| `-colonly` | Collision only (mesh removed); use a simplified proxy mesh |
| `-convcol` / `-convcolonly` | Convex hull collision |
| `-rigid` | RigidBody3D |
| `-navmesh` | Becomes a NavigationMesh source |
| `-noimp` | Not imported |

For levels, model simple collision proxies (`-colonly`) rather than using the visual mesh as collision.

## Import settings that matter

- **Meshes**: Generate LODs (on by default), Shadow Meshes, Light Baking → Static Lightmaps (generates UV2 for `LightmapGI`).
- **Root type**: set the import root type (for example `Node3D`), and keep gameplay types in the wrapper.
- **Materials and animations → "Save to file"**: extract them to `.tres` and `.res` files so you can edit materials and keep the edits across reimports.
- **Import scripts**: automate repeatable fixes (set layers, assign shared materials, configure loops).

## Animations: import, loop, retarget

- Name actions clearly in Blender (`idle`, `walk`, `run`, `sit_down`, `sleep_loop`, `wag`). Use NLA tracks or actions exported as separate animations.
- Set looping in Advanced Import Settings (Loop Mode) or with the `-loop`/`-cycle` name suffix.
- Bake constraints and IK in Blender on export. Godot imports the resulting keyframes, not the Blender constraints.
- Shared animations across characters: use a `BoneMap` with a `SkeletonProfile` (humanoid for people). Non-humanoid creatures with different rigs need their own animation sets or a custom profile.
- Keep the animation sample rate and key reduction sensible. Overly aggressive compression causes foot sliding.

## Textures and materials

- PBR textures: albedo, normal (OpenGL-style +Y green; glTF uses this convention), ORM (occlusion/roughness/metallic packed).
- Import 3D textures as VRAM Compressed. Godot detects normal maps from material usage; confirm the detection in the import dock.
- Use texture sizes appropriate to on-screen size (a small prop needs 512–1024, not 4K).
- Stylized or cozy look: flat or vertex-color materials and a small shared palette texture reduce draw calls and memory.

## Checklist for a new model

- [ ] Real-world scale, transforms applied, origin placed sensibly.
- [ ] Faces the expected direction in Godot (check with an arrow gizmo).
- [ ] Wrapped in a gameplay scene, with no edits to the imported scene.
- [ ] Collision is simple and correctly layered.
- [ ] Materials extracted or shared. Textures compressed and appropriately sized.
- [ ] Animations named, looped where needed, and previewed in an `AnimationPlayer`.
- [ ] LODs generated. UV2 present if lightmapped.
