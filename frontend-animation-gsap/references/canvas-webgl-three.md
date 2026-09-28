# GSAP with Canvas 2D, WebGL, and Three.js

The pattern is the same everywhere: **GSAP tweens plain values; a render function draws from those values.** GSAP never draws.

## Contents
- Canvas 2D
- Raw WebGL / shader uniforms
- Three.js
- ScrollTrigger driving a scene
- Lifecycle and cleanup
- Reduced motion and performance

## Canvas 2D

Keep a typed state object, tween it, draw from it on the GSAP ticker.

```ts
type Blob = { x: number; y: number; r: number; alpha: number };

export function mountCanvas(canvas: HTMLCanvasElement): () => void {
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) throw new Error("2D context unavailable");

  const dpr = Math.min(window.devicePixelRatio, 2);
  const resize = () => {
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener("resize", resize);

  const blob: Blob = { x: 100, y: 100, r: 20, alpha: 0 };

  const draw = () => {
    ctx2d.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    ctx2d.globalAlpha = blob.alpha;
    ctx2d.beginPath();
    ctx2d.arc(blob.x, blob.y, blob.r, 0, Math.PI * 2);
    ctx2d.fill();
  };

  const gctx = gsap.context(() => {
    gsap.timeline()
      .to(blob, { alpha: 1, r: 60, duration: 0.6, ease: "power3.out" })
      .to(blob, { x: 400, duration: 1, ease: "power2.inOut" });
  });

  gsap.ticker.add(draw);
  return () => {
    gsap.ticker.remove(draw);
    gctx.kill();
    window.removeEventListener("resize", resize);
  };
}
```

If the scene is static between animations, draw in the timeline's `onUpdate` instead of every tick.

## Raw WebGL / shader uniforms

Tween the uniform value holder, upload in the render loop:

```ts
const uniforms = { uProgress: 0, uIntensity: 1 };
gsap.to(uniforms, { uProgress: 1, duration: 1.2, ease: "power2.inOut" });

function render(): void {
  gl.useProgram(program);
  gl.uniform1f(uProgressLoc, uniforms.uProgress);
  gl.uniform1f(uIntensityLoc, uniforms.uIntensity);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}
gsap.ticker.add(render);
```

Transitions between images/states are usually one `uProgress` 0→1 tween with the easing in GSAP and the effect in the shader. Keep easing in one place — don't also ease inside the shader unless intended.

## Three.js

Three objects expose numeric properties on vectors, eulers, colors, and materials. Tween those objects.

```ts
import * as THREE from "three";

// Position / rotation / scale: tween the Vector3 / Euler
gsap.to(mesh.position, { x: 2, y: 0.5, duration: 1, ease: "power3.inOut" });
gsap.to(mesh.rotation, { y: Math.PI, duration: 1.2, ease: "power2.inOut" });
gsap.to(mesh.scale, { x: 1.2, y: 1.2, z: 1.2, duration: 0.4, ease: "back.out(1.5)" });

// Material: opacity requires transparent: true
material.transparent = true;
gsap.to(material, { opacity: 0, duration: 0.5 });

// Color: tween r/g/b of the THREE.Color
const target = new THREE.Color("#ff6600");
gsap.to(material.color, { r: target.r, g: target.g, b: target.b, duration: 0.6 });

// ShaderMaterial uniforms: tween the { value } holder
gsap.to(shaderMaterial.uniforms.uProgress, { value: 1, duration: 1.5, ease: "power2.inOut" });
```

**Camera moves** — tween `camera.position` and a look-at target together; update in `onUpdate`:
```ts
const lookAt = new THREE.Vector3();
gsap.timeline({ defaults: { duration: 1.4, ease: "power3.inOut" }, onUpdate: () => camera.lookAt(lookAt) })
  .to(camera.position, { x: 4, y: 2, z: 6 })
  .to(lookAt, { x: 0, y: 1, z: 0 }, "<");
```
With `OrbitControls`, tween `controls.target` and call `controls.update()` in `onUpdate`; disable controls during the tween so user input doesn't fight it.

Quaternion interpolation: for arbitrary 3D orientation changes, tweening Euler angles can take odd paths. Tween a `t` from 0→1 and `slerp` quaternions in `onUpdate`.

**Render loop**: with `renderer.setAnimationLoop(render)` running continuously, GSAP value changes are picked up automatically. For render-on-demand scenes, call `renderer.render(scene, camera)` in the timeline's `onUpdate`, or add a render function to `gsap.ticker` only while animating.

React Three Fiber: GSAP works on refs inside `useGSAP`/`useLayoutEffect`; `useFrame` renders. Kill tweens on unmount; R3F disposes objects when they leave the tree.

## ScrollTrigger driving a scene

Scrubbed timelines work on scene values exactly like DOM properties:

```ts
gsap.timeline({
  defaults: { ease: "none" },
  scrollTrigger: { trigger: "#story", start: "top top", end: "+=3000", scrub: 1, pin: true },
})
  .to(camera.position, { z: 2 })
  .to(mesh.rotation, { y: Math.PI * 2 }, "<")
  .to(shaderMaterial.uniforms.uProgress, { value: 1 }, ">-0.3");
```

The canvas is usually `position: fixed` or inside the pinned section; the DOM text overlays it.

## Lifecycle and cleanup

1. Kill tweens (`ctx.kill()` / `mm.revert()`) and remove `gsap.ticker` listeners.
2. Stop the render loop (`renderer.setAnimationLoop(null)`, `cancelAnimationFrame`).
3. Dispose GPU resources: geometries, materials, textures, render targets; `renderer.dispose()`; for full teardown `renderer.forceContextLoss()`.
4. Remove resize listeners / ResizeObservers.

Tweens must die before objects are disposed — otherwise GSAP keeps writing to disposed objects and holds references that prevent GC.

## Reduced motion and performance

- Reduced motion: stop auto-rotation, camera drift, particle ambience, scroll-scrubbed camera flights; show the final composed frame or a static poster.
- Cap `devicePixelRatio` at 2 (1.5 on low-end mobile).
- Pause rendering when the canvas is offscreen (IntersectionObserver / ScrollTrigger `onToggle`) and when the tab is hidden.
- Per-particle motion belongs in a shader or a single update loop, not in thousands of tweens.
