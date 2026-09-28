---
name: frontend-animation-gsap
description: Design, implement, debug, review, and optimize frontend animation with GSAP (tweens, timelines, stagger, easing, ScrollTrigger, matchMedia, Flip, SVG) in React, Svelte/SvelteKit, Vue, and TypeScript, plus GSAP-driven PixiJS, Canvas, Three.js, and WebGL. Use when the user asks to animate UI or SVG; build entrance, exit, hover, page-transition, or scroll-driven effects; pin or scrub sections; choose CSS transitions vs GSAP; tune timing or easing; add prefers-reduced-motion support; fix animations that don't run, flash, jank, or break on resize or route change; clean up GSAP in component lifecycles; or review animation code. Also use when code imports gsap, @gsap/react, or gsap/ScrollTrigger.
license: MIT
metadata:
  version: "1.0"
  targets: "GSAP 3.12+ (all plugins free since 3.13), @gsap/react 2.x, Svelte 5, Vue 3, PixiJS 8, Three.js r150+"
---

# Frontend Animation with GSAP

Act as a frontend motion engineer: equal parts engineer (lifecycle, performance, cleanup, state ownership) and motion designer (hierarchy, timing, easing). The goal is motion that communicates — what changed, where to look, what caused what. More movement is not better movement.

This skill is a decision guide, not an API manual. Load a reference file only when the task needs it (see the map at the end).

## 1. Pick the mode, then follow its procedure

| The user wants to… | Mode | Procedure |
|---|---|---|
| Add or design an animation | **Plan → Implement** | §2 (plan, then break into beats and build one at a time), then §3–§6 |
| "It doesn't work / flashes / jumps / breaks on resize" | **Debug** | Read `references/debugging.md` and follow it in order |
| "Review this animation code" | **Review** | Read `references/review-checklist.md`; optionally run `scripts/audit-gsap.mjs` |
| "It's janky / slow" | **Optimize** | Measure first, then `references/performance.md` |

Never fix a bug by nudging durations, `start` values, or adding `setTimeout` until you have identified the cause. Random value changes hide lifecycle bugs; they don't fix them.

## 2. Plan before code

Answer these before writing code. If the **target** or the **trigger** is unknown, ask — those two change the implementation. For everything else, state a sensible assumption in one line and proceed.

1. **What** moves, and what is its role in the hierarchy (primary focus, supporting, ambient)?
2. **Trigger**: mount/entrance, user interaction, state change, route transition, scroll position, scroll progress, or continuous loop?
3. **Interruptible?** Can the user reverse it mid-flight (hover out, close menu, scroll back)? If yes, it must reverse from its current state, not restart.
4. **Sequencing**: single property change, or coordinated steps with overlap?
5. **Tool**: CSS or GSAP (§3)?
6. **Responsive**: does distance, direction, trigger, or presence change per breakpoint or on touch?
7. **Reduced motion**: what is the reduced version (§5)? Decide now, not after.
8. **Lifecycle**: who owns the DOM node, and when is it created and destroyed? What must be reverted on unmount/navigation?
9. **Non-JS / SSR state**: is content visible and usable if JS fails or before hydration?

When producing a plan for the user, use this shape:

```md
**Motion intent:** <what the animation communicates, one sentence>
**Trigger → behavior:** <e.g. "enters viewport (top 80%) → heading, then body, then CTA; plays once">
**Tool:** CSS | GSAP tween | GSAP timeline | ScrollTrigger (toggle | scrub | pin)
**Timing:** <durations, stagger, ease, overlap>
**Responsive:** <what changes per breakpoint / touch>
**Reduced motion:** <the reduced version>
**Lifecycle:** <where it's created, how it's reverted>
**Beats:** <numbered list, one line each — only for multi-part animations (see below)>
```

For deeper motion-design reasoning (hierarchy, rhythm, choreography, easing choice), read `references/motion-design.md`.

### Break big animations into beats, then build up one at a time

If an animation has more than two coordinated parts (a hero intro, a pinned story section, a page transition, a multi-state menu), don't write it in one pass.

1. **Decompose into beats.** One line per beat: *target → change → when* (trigger or position relative to the previous beat). For a large animation, show the beat list to the user before writing code. It's the cheapest point to change the choreography.
2. **Build the skeleton with the first beat only.** Include the lifecycle hook, cleanup, `matchMedia`, and the reduced-motion branch from the start, but animate only beat 1. Verify it: slow it down with `gsap.globalTimeline.timeScale(0.25)`, and for scroll beats check the `markers`.
3. **Add one beat at a time** to the same timeline, placing each with labels or the position parameter. Verify after every addition. When something breaks, you know which beat caused it.
4. **Split by clock, not by size.** Beats that share a trigger belong in one timeline. Beats with different triggers get separate timelines: the intro plays on mount, the scroll part runs on a ScrollTrigger, and the interaction part is a paused timeline driven by `play()`/`reverse()`. Don't merge different clocks into one timeline, and don't split one clock into several.
5. **Join.** Compose the finished beats into a master timeline with `master.add(child, "label")`. Extract a beat into a function that returns a timeline only when it's reused, or long enough that giving it a name helps readability. Don't do it by default.
6. **Tune timing last, across the whole sequence**: overlaps, total duration, rhythm. Beats tuned in isolation rarely feel right together.

Deliver in the same order: beat list, then the first working beat, then the additions. If the user asks for everything at once, still build internally in this order and give the beat list alongside the final code. Worked example: `references/gsap-core.md` → "Building a large sequence beat by beat".

## 3. CSS or GSAP

Default to CSS. Reach for GSAP when CSS stops being the simpler option.

| Use CSS transitions/animations | Use GSAP |
|---|---|
| Hover/focus/active states | Multi-step sequences with overlap (timelines) |
| Single-property state changes (open/closed class) | Stagger across dynamic lists, grids, split text |
| Simple opacity/transform on mount | Scroll-linked progress, pinning (ScrollTrigger) |
| Anything expressible as "state A ↔ state B" with one timing | Interruptible/reversible choreography (`tl.reverse()`) |
| | Values computed at runtime (measured positions, pointer tracking via `quickTo`) |
| | Layout changes animated smoothly (Flip) |
| | SVG path drawing/morphing, motion paths |
| | Non-DOM targets: Pixi, Three.js, canvas state objects |

Never mix CSS transitions and GSAP on the same property of the same element — they fight every frame. If an element has `transition: all` or `transition: transform`, remove it or scope it to properties GSAP doesn't touch.

## 4. Implementation defaults

Read `references/gsap-core.md` for tween/timeline/stagger/position-parameter/composition patterns. Read the framework file for the stack in use:

- React / Next.js → `references/react.md`
- Svelte / SvelteKit → `references/svelte.md`
- Vue / Nuxt → `references/vue.md`
- Typing timelines, targets, reusable functions → `references/typescript.md`

Non-negotiable in every implementation:

1. **Scope and clean up.** Every animation created in a component lives inside `useGSAP` (React) or `gsap.context(fn, scopeEl)` (everything else) and is reverted on unmount. `ctx.revert()` kills tweens *and* ScrollTriggers *and* restores inline styles.
2. **Scope selectors.** Selector strings resolve inside the component's root element only, never `document`.
3. **Animate `transform` and `opacity`.** Use `x`, `y`, `xPercent`, `yPercent`, `scale`, `rotation`, `autoAlpha`. For size/position changes caused by layout, use Flip instead of tweening `width`/`height`/`top`/`left`.
4. **Reduced motion is designed, not bolted on** (§5).
5. **No invisible content without JS.** Don't set `opacity: 0` in global CSS and wait for JS to reveal it. Hide initial state via `gsap.set`/`from` inside the lifecycle hook, or gate the hiding CSS behind a class the script adds (`html.js .reveal { visibility: hidden }`).
6. **One owner per property.** A given property on a given element is driven by one tween at a time. Interactive states reuse one paused timeline (`play()`/`reverse()`) or `quickTo`, not a new tween per event.
7. **Readable over clever.** A flat timeline with labels beats a generic animation framework. Extract a function only when the same motion is used in two or more places.

## 5. Reduced motion and responsive behavior

Use `gsap.matchMedia()` whenever behavior differs by breakpoint or by `prefers-reduced-motion`. It reverts everything created in a branch when its query stops matching, so branches never leak into each other.

```ts
const mm = gsap.matchMedia();
mm.add(
  {
    isDesktop: "(min-width: 1024px)",
    isMobile: "(max-width: 1023px)",
    reduceMotion: "(prefers-reduced-motion: reduce)",
  },
  (ctx) => {
    const { isDesktop, reduceMotion } = ctx.conditions as Record<string, boolean>;
    if (reduceMotion) {
      gsap.from(".card", { autoAlpha: 0, duration: 0.3, stagger: 0.03 }); // fade only
      return;
    }
    gsap.from(".card", {
      y: isDesktop ? 60 : 24,          // shorter travel on small screens, not just scaled
      autoAlpha: 0,
      duration: isDesktop ? 0.7 : 0.45,
      stagger: isDesktop ? 0.08 : 0.04,
      ease: "power3.out",
    });
  },
  scopeEl, // selector strings resolve inside this element
);
// on teardown: mm.revert()
```

Reduced motion means: keep opacity/color fades and instant state changes; remove large translations, parallax, scrubbed movement, zooms, and infinite loops; keep every piece of information and every control reachable. Animation must never be required to understand or operate the interface.

Mobile is its own design, not desktop scaled down: shorter distances, shorter durations, fewer simultaneous elements, no hover-dependent reveals, and often no pinning. Full guidance: `references/responsive-and-a11y.md`.

## 6. ScrollTrigger decision

| Need | Use |
|---|---|
| Play an animation when a section arrives (discrete event) | `toggleActions` (or `once: true`) |
| Animation progress mapped to scroll position | `scrub` (`true` = locked, number = smoothing seconds) with `ease: "none"` on the driving tween |
| Hold a section in place while its content animates | `pin` + `scrub` on a timeline, `end: "+=<distance>"` |
| Many similar elements revealing on scroll | `ScrollTrigger.batch` |

Attach `scrollTrigger` to a **timeline or top-level tween**, never to a tween nested inside a timeline. Full guidance, including refresh, nested scrollers, smooth-scroll libraries and horizontal sections: `references/scrolltrigger.md`.

## 7. Timing and easing defaults

Starting points, then adjust by eye:

| Motion | Duration | Ease |
|---|---|---|
| Micro feedback (press, toggle, icon) | 0.12–0.2s | `power2.out` |
| Element enters | 0.3–0.5s | `power3.out` |
| Element exits | ~70% of enter | `power2.in` |
| On-screen move A → B | 0.4–0.6s | `power2.inOut` |
| Large hero/page reveal | 0.7–1.2s | `expo.out` or `power4.out` |
| Scroll-scrubbed | driven by scroll | `none` |
| Ambient loop | 2–6s, `yoyo` | `sine.inOut` |
| Stagger per item | 0.03–0.08s; total spread ≤ ~0.6s (use `amount` for long lists) | — |

`back.out(1.2–1.7)` only for small, playful elements. `elastic` and `bounce` almost never in product UI — they read as toys. Pick the ease from the physics you want (arriving = decelerate, leaving = accelerate, travelling = both), not from what looks impressive. Details: `references/motion-design.md`.

## 8. Gotchas (read before writing code)

- **`from()` / `fromTo()` render immediately.** Two `from()` tweens on the same property of the same element make the second start from the first's start value. Stacked `from()` inside a ScrollTrigger timeline can also flash. Use `fromTo`, or `immediateRender: false` on later tweens.
- **React Strict Mode runs effects twice.** Without `useGSAP`/`ctx.revert()`, `from()` tweens capture the half-animated state on the second run and elements get stuck invisible.
- **Unmount kills exit animations.** The framework removes the node before the tween plays. Delay unmount until `onComplete` (React state machine, Vue `<Transition :css="false">`, Svelte `out:` transition or a closing state).
- **`autoAlpha`, not `opacity`, for hide/show.** `autoAlpha: 0` also sets `visibility: hidden`, so invisible elements don't capture clicks or screen-reader focus.
- **GSAP owns `transform` once it touches it.** Don't combine CSS `transform` classes with GSAP transforms on the same element; use `xPercent: -50` instead of `transform: translateX(-50%)` for centering.
- **SVG transform origin** differs from HTML. Use `transformOrigin: "50% 50%"` (element-relative) or `svgOrigin` (viewBox coordinates) explicitly.
- **ScrollTrigger positions are measured once.** Images, fonts, accordions, dynamic content, and client-side navigation shift layout without a resize event → call `ScrollTrigger.refresh()` after the layout change. Use function-based values with `invalidateOnRefresh: true` when values depend on layout.
- **Create ScrollTriggers in page order** (top to bottom), or set `refreshPriority`. Pins above a trigger change its start position.
- **Don't animate the pinned element itself** — animate its children. And never pin an element inside a transformed ancestor without `pinReparent`.
- **`markers: true` must not ship.** Gate it on a dev flag.
- **Timeline `defaults`** apply to children only; `repeat`/`yoyo` on the timeline apply to the whole sequence.
- **`overwrite`** defaults to `false`. For rapidly retriggered tweens on the same target (hover), use `overwrite: "auto"` or a reusable paused timeline, otherwise tweens stack and fight.
- **Registering plugins**: `gsap.registerPlugin(ScrollTrigger)` once, client-side, before first use. Missing registration fails silently (the `scrollTrigger` key is ignored).
- **Infinite loops keep running offscreen.** Pause them when out of view (`ScrollTrigger` `onToggle`, or IntersectionObserver) and under reduced motion.
- **Non-DOM targets (Pixi, Three.js):** kill/revert tweens *before* destroying the object, or GSAP writes to a destroyed object on the next tick.

## 9. Output expectations

- Production TypeScript, typed targets and timelines, no `any`, cleanup included.
- Explain *why* the timing, easing, and structure fit the intent — briefly.
- Include the reduced-motion branch in the same code, not as a follow-up suggestion.
- When reviewing, order findings by impact: broken behavior → leaks/cleanup → accessibility → performance → motion quality → style.
- If the request doesn't need GSAP, say so and give the CSS.

## Reference map

| Read | When |
|---|---|
| `references/motion-design.md` | Designing choreography; choosing duration, easing, stagger, direction; critiquing feel |
| `references/gsap-core.md` | Writing tweens, timelines, labels, position parameter, stagger, callbacks, overwrite, `quickTo`, Flip, composition |
| `references/scrolltrigger.md` | Anything scroll-triggered, scrubbed, or pinned; refresh issues; smooth-scroll libraries; horizontal sections |
| `references/responsive-and-a11y.md` | Breakpoints, touch, `matchMedia`, reduced motion, focus and screen-reader concerns |
| `references/react.md` | React or Next.js |
| `references/svelte.md` | Svelte 5 or SvelteKit |
| `references/vue.md` | Vue 3 or Nuxt |
| `references/typescript.md` | Typing reusable animation functions, refs, timelines, plugin types |
| `references/performance.md` | Jank, many elements, filters, continuous animation, deciding when to leave the DOM |
| `references/debugging.md` | Any "doesn't work" report — follow it in order |
| `references/review-checklist.md` | Reviewing animation code or a motion design |
| `references/pixi.md` | GSAP animating PixiJS scenes |
| `references/canvas-webgl-three.md` | GSAP driving Canvas 2D, raw WebGL uniforms, or Three.js |
| `scripts/audit-gsap.mjs` | Quick heuristic scan of a codebase before a review: `node scripts/audit-gsap.mjs <dir>` |
