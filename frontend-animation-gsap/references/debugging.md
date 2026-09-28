# Debugging Workflow

Diagnose before changing values. Work through the steps in order and stop at the first failure — that's the cause. State which step failed and why before proposing a fix.

## Setup for debugging

Add temporarily (remove before shipping):
```ts
const tl = gsap.timeline({ id: "hero" });
// ScrollTrigger: markers: true, id: "hero-st"
// Inspect in console: gsap.getById("hero"), ScrollTrigger.getById("hero-st")
```
Slow everything down to see motion clearly: `gsap.globalTimeline.timeScale(0.2)`.

## Checklist (in order)

**1. Browser console errors**
Any error thrown before or during animation setup stops everything after it. Also check warnings: GSAP logs `"Invalid property"` and `"target not found"`-style warnings (`GSAP target .x not found`).

**2. GSAP import**
- `import { gsap } from "gsap"` (named) or `import gsap from "gsap"`. Plugins: `import { ScrollTrigger } from "gsap/ScrollTrigger"`.
- Multiple GSAP copies (e.g., CDN + npm, or two versions in the bundle): plugins register on one instance, tweens run on the other. Check `npm ls gsap`.

**3. Plugin registration**
`gsap.registerPlugin(ScrollTrigger, Flip, ...)` before use, in client code. Without it, `scrollTrigger` vars are silently ignored and plugin properties become "invalid property" warnings.

**4. Target element**
- `console.log(gsap.utils.toArray(".target", scope))` — empty array = wrong selector, wrong scope, or element not rendered yet.
- Is it the element you think (duplicate class names, a wrapper vs its child)?
- Selector scoped to the component root? Unscoped selectors can hit elements in other components.

**5. DOM availability / framework lifecycle**
- Code runs before mount (React render body, Svelte script body, Vue `setup`) → ref is null.
- Element inside a conditional (`{#if}`, `v-if`, `&&`) that renders later.
- SSR: code ran on the server (SvelteKit, Next.js server component, Nuxt) → `window`/`document` undefined, or no-op.
- Animation created, then element replaced by a re-render (unstable keys, parent re-mount) → GSAP animates a detached node.

**6. Timeline state**
Inspect `tl.paused()`, `tl.progress()`, `tl.duration()`, `tl.isActive()`, `tl.reversed()`.
- Created with `paused: true` and never played.
- Duration 0 → all children are `set`s or targets empty.
- Progress already 1 → it played before it was visible (e.g., on mount while offscreen without a ScrollTrigger).
- Child with `scrollTrigger` nested in a timeline → ScrollTrigger belongs on the parent.

- Large timeline misbehaving somewhere in the middle → bisect: disable beats from the end until it behaves; the last removed beat (or its position parameter) is the cause. Don't retune the whole sequence.

**7. ScrollTrigger configuration**
- `trigger` element exists and is the intended one.
- Correct `scroller` if the page scrolls inside a container.
- `toggleActions`/`once`/`scrub` as intended (scrub with no scrollable distance = no motion).

**8. Start/end positions**
Enable `markers`. If markers are:
- Missing → trigger never created (steps 3, 5, 6).
- In the wrong place → layout changed after measurement (images, fonts, dynamic content, route change) → `ScrollTrigger.refresh()` after the change. Or triggers created out of page order → `refreshPriority` / `ScrollTrigger.sort()`.
- End before start → `end` relative to a short trigger; use `"+=distance"`.

**9. Overwritten or competing tweens**
- `gsap.getTweensOf(target)` — more than one active tween on the same property?
- New tween per event without `overwrite: "auto"` → stacking.
- `from()` rendered immediately and captured another tween's start value → use `fromTo` or `immediateRender: false`.
- React Strict Mode / HMR double-run without context revert → second `from()` starts from the first's hidden state (elements stuck invisible).

**10. CSS conflicts**
- `transition: all` / `transition: transform` on the element → CSS eases every GSAP frame (laggy, rubbery).
- CSS `transform` from a class (e.g., `-translate-x-1/2` in Tailwind) combined with GSAP `x` → GSAP parses and overwrites the transform; use `xPercent: -50` in GSAP instead.
- `!important` styles beat inline styles → no visible change.
- `display: none` element → transforms apply but nothing shows; measurements are 0.
- Inline element (`<span>`) → transforms don't apply; set `display: inline-block`.
- Framework re-render writing `style` → overwrites GSAP inline styles.
- `overflow: hidden` ancestor clipping the moving element.
- Parent with `transform` breaks `position: fixed`/pinning.

**11. Cleanup**
- Animation works on first visit, breaks after navigating away and back → previous instance not reverted: leftover inline styles, duplicate ScrollTriggers, pin-spacers. Check `ScrollTrigger.getAll().length` after navigating back and forth — it should not grow.
- Component-level `ScrollTrigger.getAll().forEach(kill)` killing other components' triggers.

**12. Responsive conditions**
- `matchMedia` query not matching at current width (log `ctx.conditions`).
- Reduced motion is ON in the OS or emulated in DevTools → the reduced branch runs. Very common "it doesn't animate on my machine".
- Values computed once at desktop size and not recalculated → function-based values + `invalidateOnRefresh: true`.

**13. Browser specifics**
Safari: SVG transform-origin differences (set it explicitly), `clip-path` performance, `backdrop-filter` costs. iOS: address-bar resize, momentum scroll with pinning (`ScrollTrigger.normalizeScroll(true)` as a last resort).

## Reporting the fix

State: the failing step, the evidence (log/marker/inspection result), the root cause, and the fix. If a value tweak is part of the fix (e.g., a `start` change), explain why the original value was wrong, not just that the new one works.
