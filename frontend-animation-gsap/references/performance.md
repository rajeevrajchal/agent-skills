# Performance

## Contents
- Measure first
- Property cost
- Layout thrashing and DOM queries
- Many elements
- Filters, shadows, blur
- Continuous animation
- When to leave the DOM

## Measure first

Don't optimize by guessing. In Chrome DevTools:
1. Performance panel → record the interaction with 4–6× CPU throttling (approximates mid-range mobile).
2. Look for long frames (> 16.7ms at 60Hz). Identify which phase dominates: **Scripting** (too much JS per frame), **Rendering/Layout** (layout-triggering properties, forced reflow), **Painting** (large repaints, filters, shadows), **Composite** (too many layers).
3. Rendering tab → *Paint flashing* and *Layer borders* to see what repaints and what's composited.
4. Fix the dominant cost, then re-measure. Test on a real low/mid-range phone before calling it done.

## Property cost

| Cost | Properties | Notes |
|---|---|---|
| Cheap (composite only) | `transform` (`x`, `y`, `scale`, `rotation`, `xPercent`), `opacity` | Default choice |
| Paint | `color`, `background-color`, `box-shadow`, `border-radius`, `clip-path`*, `filter` | OK for small elements, costly on large areas |
| Layout (worst) | `width`, `height`, `top`, `left`, `margin`, `padding`, `font-size`, `border-width` | Triggers layout of the element and often its siblings/parents every frame |

\* `clip-path` on a small element is fine; on full-screen elements it repaints each frame.

Replacements:
- Size change → `scale` (on an inner wrapper to avoid scaling children weirdly), or Flip for layout-driven changes.
- Position → `x`/`y`.
- Height expand (accordion) → animate `height` only if the content is small and the region is isolated; otherwise Flip or `clip-path`/`scaleY` reveal with counter-scaled content. Measured `height: "auto"` tweening in GSAP works but is layout per frame — acceptable for one accordion, not for 20 simultaneous.
- Shadow grow → cross-fade `opacity` of a pseudo-element or second layer that already has the larger shadow.

`will-change: transform` — apply only to elements that animate *often* (or just before a heavy animation), not globally. Each layer costs memory; hundreds of layers hurt more than they help, especially on mobile. GSAP already promotes transforms with `force3D: "auto"` during the tween.

## Layout thrashing and DOM queries

- Don't interleave reads (`getBoundingClientRect`, `offsetWidth`) and writes (style changes) in loops. Read everything first, then write.
- Don't query the DOM in `onUpdate` or per frame. Cache elements and measurements; recompute on resize/refresh only.
- Function-based values (`x: () => el.offsetWidth`) are evaluated at tween creation/`invalidate()`, not every frame — fine.
- Use `gsap.utils.toArray(sel, scope)` once, not repeated selector strings in many tweens.
- Batch work: one timeline with stagger instead of N independent tweens with delays; `ScrollTrigger.batch` instead of N triggers.
- Pointer-driven motion: `quickTo`/`quickSetter`, not a new tween per `pointermove`.

## Many elements

Rough DOM budgets for smooth transform/opacity animation on mid-range mobile: tens of elements animating simultaneously is comfortable; low hundreds is possible with care; beyond that, the DOM is the bottleneck.

Tactics before leaving the DOM:
1. Animate only what's visible (IntersectionObserver / ScrollTrigger to start/stop).
2. Animate a parent container instead of each child when they move together.
3. Reduce simultaneous animations — longer stagger `amount` or fewer items with motion.
4. Split text by lines or words, not characters, for long passages.
5. Simplify DOM inside animated elements (fewer nested nodes, no expensive shadows).

## Filters, shadows, blur

- `filter: blur()` and `backdrop-filter` are among the most expensive properties; animating them on large elements drops frames on most devices. Fake with cross-fades between a sharp and pre-blurred layer, or keep the blurred area small.
- Animated `box-shadow` repaints each frame; cross-fade instead.
- `mix-blend-mode` on animated elements forces extra compositing work.

## Continuous animation

Infinite loops (floating shapes, marquees, shimmer) cost battery and CPU even when offscreen.
- Pause when out of view: `ScrollTrigger.create({ trigger: el, onToggle: (self) => self.isActive ? loop.play() : loop.pause() })`.
- Pause when the tab is hidden — GSAP's ticker already throttles with `requestAnimationFrame`, but pause expensive work (canvas, video) via `visibilitychange`.
- Disable under reduced motion.
- Ask whether the loop communicates anything. If not, it's a candidate for removal.

## When to leave the DOM

Consider Canvas 2D, PixiJS (WebGL 2D), or Three.js when:
- Hundreds to thousands of independently moving items (particles, confetti, data points, sprite-based scenes).
- Per-pixel effects (distortion, displacement, noise, shaders) that CSS filters can't do cheaply.
- Game-like scenes with a render loop, hit-testing on moving objects, or physics.
- The profile shows layout/paint dominated by the sheer number of nodes even with transform-only animation.

Stay in the DOM when content must be accessible, selectable, indexable, or responsive to text layout — or when the count is under a few dozen. A hybrid is common: DOM for UI and text, canvas for the effect layer behind it. GSAP drives both from the same timeline (see `pixi.md` and `canvas-webgl-three.md`).
