# GSAP Core Patterns

## Contents
- Choosing the tween method
- Timelines, labels, position parameter
- Stagger
- Callbacks and promises
- Overwrite and property ownership
- Interactive states: reusable timelines and quickTo
- Reusable functions and timeline composition
- Building a large sequence beat by beat
- Flip (layout changes)
- SVG
- CSS + GSAP coexistence

## Choosing the tween method

| Method | Use when |
|---|---|
| `gsap.to(t, vars)` | Animate from the current state to a target. The default for state changes |
| `gsap.from(t, vars)` | Entrance: element's CSS state is the *end* state. Renders immediately (see gotchas) |
| `gsap.fromTo(t, from, to)` | Both ends must be explicit — re-runnable entrances, anything that can be triggered while mid-flight, stacked tweens on one property |
| `gsap.set(t, vars)` | Instant state (initial hidden state, resetting). Equivalent to a zero-duration `to` |

Prefer `fromTo` over `from` whenever the animation can replay or the start state might not be the resting CSS state.

## Timelines, labels, position parameter

Use a timeline as soon as two tweens relate in time. Never chain with `delay` — delays break when one duration changes.

```ts
const tl = gsap.timeline({ defaults: { duration: 0.5, ease: "power3.out" } });

tl.from(".hero__title", { yPercent: 100, autoAlpha: 0 })
  .from(".hero__copy", { y: 20, autoAlpha: 0 }, "<0.15")   // 0.15s after previous START
  .addLabel("cta")
  .from(".hero__cta", { scale: 0.95, autoAlpha: 0, duration: 0.3 }, "cta-=0.1")
  .from(".hero__media", { autoAlpha: 0, duration: 0.8 }, "<");  // with previous
```

Position parameter cheat sheet:

| Value | Meaning |
|---|---|
| (omitted) | After the end of the timeline |
| `1.2` | Absolute time |
| `"+=0.2"` / `"-=0.2"` | Gap/overlap relative to end of timeline |
| `"<"` / `">"` | Start / end of previous tween |
| `"<0.1"` / `">-0.1"` | Offset from previous start / end |
| `"label"`, `"label+=0.3"` | At/relative to a label |

Labels make timelines readable and let you `tl.play("cta")`, `tl.tweenTo("open")`, or `tl.seek("end")`. Use them for named phases rather than magic numbers.

## Stagger

```ts
gsap.from(items, {
  y: 24,
  autoAlpha: 0,
  duration: 0.4,
  ease: "power3.out",
  stagger: { each: 0.05, from: "start" },   // or { amount: 0.5 } for long/dynamic lists
});

// Grid ripple from clicked cell
gsap.to(cells, { scale: 0.9, yoyo: true, repeat: 1, duration: 0.2,
  stagger: { grid: "auto", from: clickedIndex, amount: 0.4 } });
```

## Callbacks and promises

- `onStart`, `onComplete`, `onUpdate`, `onReverseComplete`, `onInterrupt` (fires when killed/overwritten mid-flight).
- Tweens and timelines are thenable: `await tl.play()` — useful for route transitions. Be aware the promise never resolves if the animation is killed; don't block navigation on it without a fallback.
- Keep callbacks thin: set state, dispatch an event, unmount a node. Don't start unrelated tweens from `onComplete` — put them in the timeline.
- Callbacks run outside framework reactivity guarantees; in React, don't `setState` on an unmounted component — `useGSAP` revert kills the animation first, so callbacks won't fire after unmount.

## Overwrite and property ownership

`overwrite` defaults to `false`: a new tween on the same target/property runs **alongside** the old one and they fight.

- `overwrite: "auto"` — on first render, kills only the *overlapping properties* of other active tweens on the same targets. Right choice for retriggered `to()` tweens (pointer follow, hover without a timeline).
- `overwrite: true` — kills all tweens of the same targets immediately, regardless of properties. Blunt; rarely needed.
- `gsap.killTweensOf(target, "x,y")` — explicit, scoped kill.

Better than overwrite in most interactive cases: design so each property has one owner (one paused timeline or one `quickTo`).

## Interactive states: reusable timelines and quickTo

Build once, control many times. Don't create a new tween on every event.

```ts
// Hover / open-close: build once, paused; play/reverse from the current point.
const tl = gsap.timeline({ paused: true, defaults: { duration: 0.25, ease: "power2.out" } })
  .to(icon, { rotation: 90 })
  .to(panel, { autoAlpha: 1, y: 0 }, "<");

button.addEventListener("pointerenter", () => tl.play());
button.addEventListener("pointerleave", () => tl.reverse());
```

If exit should differ from entrance (faster, different ease), use two tweens with `overwrite: "auto"` or `tl.timeScale(1.5).reverse()`.

For high-frequency values (pointer follow, drag, velocity-driven motion) use `quickTo` — it reuses one tween and just retargets it:

```ts
const xTo = gsap.quickTo(cursor, "x", { duration: 0.4, ease: "power3.out" });
const yTo = gsap.quickTo(cursor, "y", { duration: 0.4, ease: "power3.out" });
const onMove = (e: PointerEvent) => { xTo(e.clientX); yTo(e.clientY); };
window.addEventListener("pointermove", onMove);
// cleanup: removeEventListener + ctx.revert()
```

Use `gsap.quickSetter` only when you want no easing at all (setting a value every frame).

## Reusable functions and timeline composition

Extract a function when the same motion appears in 2+ places. The function returns a timeline (or tween) and never plays itself inside a parent — the caller decides placement.

```ts
export function revealLines(lines: gsap.TweenTarget, opts: { stagger?: number } = {}): gsap.core.Timeline {
  return gsap.timeline()
    .from(lines, { yPercent: 100, duration: 0.6, ease: "power4.out", stagger: opts.stagger ?? 0.08 });
}

const master = gsap.timeline();
master
  .add(revealLines(title.querySelectorAll(".line")))
  .add(revealLines(sub.querySelectorAll(".line"), { stagger: 0.04 }), "<0.2")
  .add("interactive");  // label
```

Rules:
- Nested timelines are placed with `add(child, position)`. The parent controls playback; don't give children `scrollTrigger`, `paused`, or `repeat` unless intended.
- Keep a single master timeline per coordinated sequence. Multiple independent timelines that must stay in sync will drift.
- Don't build a generic "animation engine" or config-driven registry. Plain functions returning timelines are enough.
- Register an effect (`gsap.registerEffect`) only for a small design-system vocabulary used across many components.

## Building a large sequence beat by beat

Example: hero intro plus scroll-out.

**Beat list (agreed before code)**
1. Title lines rise from mask (on mount)
2. Copy fades up, overlapping the title
3. CTA scales in
4. Media reveals with a clip-path wipe, alongside beat 2
5. On scroll: media drifts up and the title fades out (desktop only, different clock → separate timeline)

**Step 1: skeleton + beat 1.** Lifecycle, scope, and the reduced-motion branch go in now, not later.
```ts
mm.add({ motion: "(prefers-reduced-motion: no-preference)", reduce: "(prefers-reduced-motion: reduce)" }, (ctx) => {
  const { reduce } = ctx.conditions as { motion: boolean; reduce: boolean };
  if (reduce) { gsap.from(".hero > *", { autoAlpha: 0, duration: 0.2 }); return; }

  const intro = gsap.timeline({ defaults: { ease: "power3.out", duration: 0.6 } });
  intro.from(".hero__line", { yPercent: 100, stagger: 0.08, ease: "power4.out" });   // beat 1
}, root);
```
Verify beat 1 alone, slowed down.

**Steps 2–4: add one beat at a time**, each placed relative to the others, verifying after each:
```ts
  intro
    .from(".hero__line", { yPercent: 100, stagger: 0.08, ease: "power4.out" })        // 1
    .addLabel("body", "-=0.4")
    .from(".hero__copy", { y: 20, autoAlpha: 0 }, "body")                              // 2
    .fromTo(".hero__media", { clipPath: "inset(0 100% 0 0)" },
            { clipPath: "inset(0 0% 0 0)", duration: 0.9, ease: "expo.out" }, "body")  // 4 (with 2)
    .from(".hero__cta", { scale: 0.95, autoAlpha: 0, duration: 0.35 }, "<0.2");       // 3
```

**Step 5: the separate clock.** Scroll behavior gets its own timeline and trigger instead of being appended to `intro`:
```ts
  if (window.matchMedia("(min-width: 1024px)").matches) {   // or a matchMedia condition
    gsap.timeline({ defaults: { ease: "none" },
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 0.6 } })
      .to(".hero__media", { yPercent: -15 })
      .to(".hero__title", { autoAlpha: 0 }, "<");
  }
```

**Step 6: join and tune.** Only if the intro becomes reused or long, extract beats into functions (`titleIn()`, `bodyIn()`) and compose them with `intro.add(titleIn()).add(bodyIn(), "-=0.4")`. Then tune overlaps and total duration while watching the whole sequence.

**Bisecting a broken sequence:** comment out beats (or `.add` calls) from the end until the problem disappears. The last beat you removed is the culprit, or its position parameter is.

## Flip (layout changes)

When layout changes (reorder, filter, expand into place, move between containers), don't tween `width`/`top`. Record, change layout, animate the difference with transforms:

```ts
import { Flip } from "gsap/Flip";
gsap.registerPlugin(Flip);

const state = Flip.getState(items);          // 1. record
container.classList.toggle("grid--list");    // 2. change DOM/layout (or update framework state and wait for render)
Flip.from(state, {                           // 3. animate from old to new
  duration: 0.5, ease: "power2.inOut", stagger: 0.02, absolute: true,
  onEnter: (els) => gsap.fromTo(els, { autoAlpha: 0, scale: 0.9 }, { autoAlpha: 1, scale: 1 }),
  onLeave: (els) => gsap.to(els, { autoAlpha: 0, scale: 0.9 }),
});
```

In frameworks, capture state before the state change and call `Flip.from` after the DOM has updated (React `useLayoutEffect` keyed on the change, Svelte `await tick()`, Vue `await nextTick()`).

## SVG

- Transform origin: set `transformOrigin: "50% 50%"` explicitly, or `svgOrigin: "200 150"` (viewBox coordinates) to rotate multiple elements around a shared point.
- Line drawing: `DrawSVGPlugin` (`drawSVG: "0% 100%"`). Without it, animate `strokeDashoffset` from `getTotalLength()`.
- Morphing: `MorphSVGPlugin` handles mismatched point counts. Don't hand-tween `d` strings.
- Motion along a path: `MotionPathPlugin` with `autoRotate`.
- Animate `attr: { cx, r, ... }` for geometry attributes; CSS transforms for position/scale/rotation.
- Keep `viewBox` fixed; animate inside it. Scale via CSS on the `<svg>`.
- `vector-effect: non-scaling-stroke` if strokes must not scale with `scale` tweens.

All plugins (SplitText, MorphSVG, DrawSVG, ScrollSmoother, etc.) have been free and in the public `gsap` package since 3.13. Import from `gsap/<Plugin>` and register.

## CSS + GSAP coexistence

- CSS owns layout, resting states, and simple hover/focus. GSAP owns the properties it animates, for the element's lifetime.
- Remove `transition` on properties GSAP animates (`transition: all` is the usual culprit).
- Use CSS custom properties as a bridge when CSS needs GSAP-driven values: `gsap.to(el, { "--progress": 1 })` and use `var(--progress)` in CSS (keep it to transform/opacity-affecting uses).
- Use `clearProps: "transform,opacity"` in `onComplete` only when CSS must regain control afterwards (e.g., a hover transition defined in CSS) — otherwise leave inline styles.
