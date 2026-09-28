# ScrollTrigger

## Contents
- toggleActions vs scrub vs pin
- start / end syntax
- Patterns: reveal, scrub, pin, batch, horizontal section
- Refresh and recalculation
- Responsive ScrollTrigger
- Nested scrollers and smooth-scroll libraries
- Cleanup
- Debugging with markers
- Common mistakes

## toggleActions vs scrub vs pin

| Question | Answer → |
|---|---|
| Is this a discrete event ("section arrived → play")? | **toggleActions**. Animation runs on its own clock at its own duration |
| Should animation progress be tied 1:1 to scroll position (the user can scrub back and forth)? | **scrub**. Duration becomes irrelevant; only relative durations inside the timeline matter |
| Must the section stay on screen while its content animates? | **pin** (almost always with scrub) |

Default to toggleActions. Scrub and pin hijack the user's scroll; use them when the scroll *is* the interaction (storytelling, product walkthrough), not for ordinary content reveals. Pinning is often wrong on mobile.

`toggleActions: "onEnter onLeave onEnterBack onLeaveBack"`, each one of `play pause resume reverse restart reset complete none`.
- Reveal once: `once: true` (kills the trigger after first enter — cheapest), or `"play none none none"`.
- Reveal and hide when scrolling back up past it: `"play none none reverse"`.

`scrub: true` locks to scrollbar; `scrub: 0.5–1` adds catch-up smoothing (seconds) — usually feels better. Use `ease: "none"` on scrubbed tweens unless you want non-linear mapping within the range.

## start / end syntax

`"<trigger point> <scroller point>"`: `start: "top 80%"` = when the trigger's top hits 80% down the viewport.

- Common reveal: `start: "top 85%"`.
- Pin for a fixed scroll distance: `start: "top top", end: "+=1500"` (or `end: () => "+=" + el.offsetWidth` for layout-dependent distance, with `invalidateOnRefresh: true`).
- `end: "bottom top"` = until the trigger's bottom leaves the top of the viewport.
- Relative/computed values must be functions if they depend on layout, so they recompute on refresh.

## Patterns

**Section reveal**
```ts
gsap.timeline({
  scrollTrigger: { trigger: section, start: "top 80%", once: true },
  defaults: { ease: "power3.out", duration: 0.5 },
})
  .from(section.querySelector("h2"), { y: 30, autoAlpha: 0 })
  .from(section.querySelectorAll(".card"), { y: 24, autoAlpha: 0, stagger: 0.06 }, "<0.15");
```

**Many elements → batch** (one trigger per element is wasteful and they won't coordinate):
```ts
gsap.set(".tile", { autoAlpha: 0, y: 24 });
ScrollTrigger.batch(".tile", {
  start: "top 90%",
  once: true,
  onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, stagger: 0.05, overwrite: true }),
});
```

**Pinned, scrubbed story section**
```ts
const tl = gsap.timeline({
  defaults: { ease: "none" },
  scrollTrigger: { trigger: section, start: "top top", end: "+=2000", scrub: 0.8, pin: true, anticipatePin: 1 },
});
tl.to(stepsInner, { yPercent: -66 })
  .addLabel("step2")
  .to(image, { scale: 1.1 }, "<");
```
Animate the children, not the pinned `section` itself.

**Horizontal scroll section**
```ts
const distance = () => track.scrollWidth - window.innerWidth;
const tween = gsap.to(track, {
  x: () => -distance(),
  ease: "none",
  scrollTrigger: { trigger: wrapper, start: "top top", end: () => "+=" + distance(),
                   pin: true, scrub: 1, invalidateOnRefresh: true },
});
// Children animating as they pass: use containerAnimation
gsap.from(panel, { autoAlpha: 0, y: 40,
  scrollTrigger: { trigger: panel, containerAnimation: tween, start: "left 70%" } });
```
`containerAnimation` requires the container tween to use `ease: "none"`. Pinning and snapping aren't supported on triggers that use `containerAnimation`.

**Snap** (`snap: 1 / (steps - 1)` or `snap: "labels"`) — only for clearly stepwise sections; snapping fights the user when content lengths vary.

## Refresh and recalculation

ScrollTrigger measures positions on creation and on `resize`/`load`. It does **not** know when layout shifts for other reasons. Call `ScrollTrigger.refresh()` after:
- images/embeds without fixed dimensions load (better: reserve space with `width`/`height`/`aspect-ratio`)
- web fonts finish (`document.fonts.ready.then(() => ScrollTrigger.refresh())`)
- accordion/tab/content expansion above triggers
- data-driven content renders
- client-side route change that reuses the scroller (after new page is mounted)

Refresh is expensive (it reverts and re-measures everything) — call it once after the change, debounced, not per frame or per item.

Order matters: triggers are refreshed in creation order. Create them top-to-bottom in page order; if not possible (components mount out of order), use `refreshPriority` or call `ScrollTrigger.sort()`.

`invalidateOnRefresh: true` makes the tween re-record its start/end values on refresh — required when values are functions of layout.

Mobile address-bar show/hide changes viewport height: `ScrollTrigger.config({ ignoreMobileResize: true })` (the default in recent versions) avoids refresh storms; use `svh`/`lvh` units for full-height sections. `ScrollTrigger.normalizeScroll(true)` can fix iOS jitter with pinning but changes native scroll behavior — use only when needed.

## Responsive ScrollTrigger

Put ScrollTriggers inside `gsap.matchMedia()` branches. When the query stops matching, triggers (and pin spacers) are reverted automatically. Typical: pin + scrub on desktop; simple `once` reveals on mobile; nothing but fades under reduced motion.

## Nested scrollers and smooth-scroll libraries

- If the page scrolls inside an element (app shell, modal, `overflow: auto` container), pass `scroller: containerEl` to every trigger, or set once with `ScrollTrigger.defaults({ scroller })`. Wrong scroller = triggers never fire.
- Pinning inside a transformed or `will-change: transform` ancestor breaks `position: fixed`. Use `pinReparent: true` or restructure.
- Pinning inside flex/grid parents can collapse spacing; `pinSpacing` defaults work for block layout. Check with markers.
- **Lenis / ScrollSmoother**: sync their loop with GSAP's ticker so there's one RAF:
  ```ts
  const lenis = new Lenis();
  lenis.on("scroll", ScrollTrigger.update);
  const raf = (time: number) => lenis.raf(time * 1000);
  gsap.ticker.add(raf);
  gsap.ticker.lagSmoothing(0);
  // cleanup: gsap.ticker.remove(raf); lenis.destroy();
  ```
  ScrollSmoother (GSAP) integrates automatically; it requires the `#smooth-wrapper > #smooth-content` structure. Disable smooth scrolling under reduced motion.

## Cleanup

- Inside `useGSAP` / `gsap.context` / `matchMedia`: ScrollTriggers are reverted with the context — no manual kill needed.
- Outside a context: `st.kill()` or `tween.scrollTrigger?.kill()`; `ScrollTrigger.getAll().forEach(t => t.kill())` only on full-page teardown you own (never in a component — it kills other components' triggers).
- After a route change: old page context reverted → new page mounts → triggers created → `ScrollTrigger.refresh()` once.

## Debugging with markers

`markers: true` draws start/end lines for trigger (green/red) and scroller. Gate it:
```ts
markers: import.meta.env.DEV && { startColor: "green", endColor: "red", indent: 40 }
```
If markers appear in the wrong place, the layout changed after measurement (→ refresh) or the wrong scroller is used. If no markers appear, the ScrollTrigger was never created (plugin not registered, code path not reached, or it's on a nested tween).

## Common mistakes

1. `scrollTrigger` on a tween nested inside a timeline — put it on the timeline.
2. Plugin not registered — the `scrollTrigger` key is silently ignored.
3. Scrubbed tween with an ease — progress mapping feels uneven.
4. Animating the pinned element's transform — fights the pin.
5. Creating triggers before content/images are laid out, without a refresh.
6. One trigger per list item instead of `batch`.
7. `ScrollTrigger.getAll().forEach(kill)` in a component cleanup.
8. Pin + scrub on mobile where it traps short viewports.
9. `markers: true` shipped to production.
10. Using `start` values with pixel offsets tuned by eye to paper over a missing refresh.
