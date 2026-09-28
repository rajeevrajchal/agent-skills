# GSAP + PixiJS

GSAP is a value tweener — it animates numeric properties on any object. PixiJS display objects are plain objects with numeric properties, so GSAP animates them directly. Pixi renders; GSAP changes values. Keep those two jobs separate.

## Contents
- What to tween
- Timelines on scene objects
- Rendering vs animation: one loop
- Scene lifecycle and cleanup
- PixiPlugin (optional)
- Game-state separation
- Pitfalls

## What to tween (Pixi v8)

```ts
import { gsap } from "gsap";
import type { Sprite, Container } from "pixi.js";

declare const sprite: Sprite;

gsap.to(sprite, {
  x: 500,
  y: 300,
  rotation: Math.PI * 2,   // radians
  alpha: 1,
  duration: 2,
  ease: "power3.inOut",
});

// scale, pivot, anchor, skew are ObservablePoints → tween the point object itself
gsap.to(sprite.scale, { x: 1.2, y: 1.2, duration: 0.3, ease: "back.out(1.6)" });
gsap.to(sprite.anchor, { x: 0.5, duration: 0.2 });
```

| Property | Notes |
|---|---|
| `x`, `y` | On the display object, or `position` point: `gsap.to(sprite.position, { x, y })` |
| `rotation` | Radians. Use `angle` for degrees |
| `alpha` | 0–1. `visible = false` in `onComplete` if fully hidden, to skip rendering |
| `scale` / `skew` / `pivot` / `anchor` | Tween the point: `gsap.to(sprite.scale, { x, y })` |
| `tint` | A color number; tweening it directly interpolates the number, not the color. Use PixiPlugin or tween an `{r,g,b}` proxy and write `tint` in `onUpdate` |
| Filter params | Tween the filter object: `gsap.to(blurFilter, { strength: 0 })` |

Containers: tween the container to move a group; tween children for internal choreography. Same hierarchy thinking as DOM.

## Timelines on scene objects

```ts
function introScene(logo: Sprite, cards: readonly Container[]): gsap.core.Timeline {
  return gsap.timeline({ defaults: { ease: "power3.out" } })
    .fromTo(logo, { alpha: 0, y: logo.y + 40 }, { alpha: 1, y: logo.y, duration: 0.6 })
    .from(logo.scale, { x: 0.8, y: 0.8, duration: 0.6 }, "<")
    .from(cards, { alpha: 0, y: "+=30", duration: 0.4, stagger: 0.06 }, "<0.2");
}
```

Relative values (`"+=30"`) work on object properties. Stagger works on arrays of display objects. Labels, position parameters, `reverse()`, `timeScale()` all apply.

DOM and Pixi objects can live in the same timeline — useful for hybrid UIs where a DOM heading and a canvas effect must stay in sync.

## Rendering vs animation: one loop

By default Pixi's `Application` renders every frame on its own ticker, and GSAP updates on `gsap.ticker`. Both use `requestAnimationFrame`, so values set by GSAP are picked up on the next Pixi render — this works fine for most scenes.

If you want a single loop (render-on-demand, or strict ordering: update values → render):

```ts
const app = new Application();
await app.init({ autoStart: false, resizeTo: host, antialias: true });
host.appendChild(app.canvas);

const render = () => app.render();
gsap.ticker.add(render); // GSAP updates tweens first, then calls listeners → render
```

For static scenes that only change during animations, render only while animations are active (e.g., `onUpdate: render` on the timeline) to save battery.

## Scene lifecycle and cleanup

Pixi v8 `init()` is async — the component may unmount before it resolves. Guard against it:

```ts
export async function mountScene(host: HTMLElement): Promise<() => void> {
  const app = new Application();
  let destroyed = false;

  await app.init({ resizeTo: host, backgroundAlpha: 0 });
  if (destroyed) { app.destroy(true, { children: true }); return () => {}; }
  host.appendChild(app.canvas);

  const logo = Sprite.from(await Assets.load("/logo.png"));
  app.stage.addChild(logo);

  // Every tween created inside a matchMedia branch is tracked by `mm`.
  const mm = gsap.matchMedia();
  mm.add("(prefers-reduced-motion: reduce)", () => { logo.alpha = 1; });
  mm.add("(prefers-reduced-motion: no-preference)", () => {
    introScene(logo, []);
    gsap.to(logo, { rotation: 0.05, yoyo: true, repeat: -1, duration: 2, ease: "sine.inOut" });
  });

  return () => {
    destroyed = true;
    mm.kill();                                           // 1. stop tweens first (kill, not revert: the objects are about to be destroyed)
    app.destroy(true, { children: true, texture: false }); // 2. then destroy Pixi objects
  };
}
```

Order matters: kill tweens **before** destroying display objects, otherwise GSAP writes to destroyed objects on the next tick (errors like reading `_x` of null).

In frameworks: call `mountScene` in `useGSAP`/`onMount`/`onMounted`, and call the returned disposer in cleanup. Because mount is async, store the promise and dispose when it resolves if the component already unmounted.

## PixiPlugin (optional)

`gsap/PixiPlugin` adds a `pixi: {}` vars object with conveniences: degrees for rotation, combined `scale`, color tweening for `tint`, and filter shortcuts (`blur`, `brightness`, `saturation`, `hue`, `colorize`).

```ts
import { PixiPlugin } from "gsap/PixiPlugin";
import * as PIXI from "pixi.js";
gsap.registerPlugin(PixiPlugin);
PixiPlugin.registerPIXI(PIXI);

gsap.to(sprite, { pixi: { scale: 1.2, rotation: 90, tint: 0xff6600 }, duration: 0.5 });
```

Use it when you need color tweening or filter shortcuts. For position/alpha/rotation, direct property tweens are simpler and have no version coupling. Verify the plugin supports your Pixi major version (filter shortcuts depend on Pixi's filter classes) before relying on it.

## Game-state separation

For games and simulations, GSAP should animate **presentation**, not **game state**:
- Game logic updates the model on a fixed or delta-time step (position in grid, HP, score).
- Presentation reads the model and uses GSAP to tween sprites toward the new state (a unit sliding to its new tile, a health bar easing down, a score counting up).
- Never let game logic read positions from tweened sprites — the tween is mid-flight and non-deterministic. The model is the source of truth.
- For per-frame physics or thousands of particles, use a plain update loop (Pixi ticker or your own), not one tween per particle. GSAP is for authored transitions, UI, and choreography.
- Pause/slow-motion: `gsap.globalTimeline.pause()` / `.timeScale(0.5)` affects all GSAP animations; keep a separate timeline for UI you don't want paused.

## Pitfalls

- `gsap.to(sprite, { scale: 1.2 })` — `sprite.scale` is a point object, not a number, so GSAP can't interpolate it. Target the point: `gsap.to(sprite.scale, { x: 1.2, y: 1.2 })`.
- Degrees passed to `rotation` (radians).
- Creating a new tween per frame in the ticker.
- Animating thousands of sprites with individual tweens → use a particle container and your own loop.
- Forgetting `app.destroy()` → WebGL context leak; browsers cap live contexts (~16) and will drop old ones.
- Reduced motion: stop ambient loops and parallax in the scene too, not just DOM animation.
