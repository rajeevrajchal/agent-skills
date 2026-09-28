# Animation Review Checklist

Report findings ordered by impact: **broken behavior → leaks/cleanup → accessibility → performance → motion quality → style**. For each finding give the location, the problem, the consequence, and the smallest fix. Don't rewrite working code for taste.

Optionally start with the heuristic scan: `node scripts/audit-gsap.mjs <dir>` — it flags likely issues (missing cleanup, unscoped selectors, layout properties, shipped markers, missing reduced-motion handling). Treat its output as leads to verify, not findings.

## Correctness

- [ ] Animation targets exist at the time the code runs (lifecycle correct, refs populated).
- [ ] `from()` tweens can't stack or re-run into a broken start state (Strict Mode, HMR, re-mount).
- [ ] Interactive animations handle interruption (reverse from current state, no restart jumps).
- [ ] Exit animations actually play (unmount delayed until complete).
- [ ] `scrollTrigger` is on the timeline/top-level tween, not nested.
- [ ] ScrollTrigger positions stay correct after images/fonts/dynamic content load (refresh strategy exists).

## Engineering

- [ ] Code is readable: timelines with defaults and labels; no chains of `delay`.
- [ ] Timelines are structured: one master timeline per coordinated sequence; reusable pieces are functions returning timelines.
- [ ] Large sequences are readable as beats (labels / position parameters), and beats with different triggers live in separate timelines.
- [ ] No unnecessary abstraction (animation managers, config-driven engines, single-use helpers).
- [ ] Cleanup implemented: `useGSAP`, `ctx.revert()`, or `mm.revert()` on unmount; event listeners removed.
- [ ] Selectors scoped to the component root.
- [ ] ScrollTriggers cleaned up with their component; no global `getAll().forEach(kill)` in components.
- [ ] One owner per animated property (no CSS transition + GSAP, no framework `style` binding + GSAP, no competing tweens).
- [ ] Plugins registered once, client-side.
- [ ] `markers` gated to development.
- [ ] Types: targets and timelines typed; no `any`.

## Performance

- [ ] Animates `transform`/`opacity`; layout properties (`width`, `height`, `top`, `left`, `margin`, `padding`) avoided or justified.
- [ ] No expensive filters/shadows animated on large areas.
- [ ] Number of simultaneously animating elements is reasonable; batching/stagger `amount` used for large sets.
- [ ] No DOM queries or measurements per frame.
- [ ] Continuous animations pause offscreen and under reduced motion — or are removed if they communicate nothing.
- [ ] `will-change` not applied globally.

## Accessibility

- [ ] `prefers-reduced-motion` handled with a designed reduced version (not ignored, not "disable everything and leave content hidden").
- [ ] Interface remains understandable and operable without animation; content not hidden when JS fails.
- [ ] Hidden states use `autoAlpha`/`visibility` so invisible elements aren't focusable.
- [ ] No hover-only access to content on touch devices.
- [ ] Auto-playing motion > 5s can be paused; no flashing > 3/s.
- [ ] Split text remains readable by screen readers.

## Motion quality

- [ ] **Is the movement necessary?** Does each animation communicate a change, focus, or relationship?
- [ ] **Is hierarchy clear?** Primary element leads; secondary elements travel less.
- [ ] **Is timing intentional?** Durations match distance and importance; consistent tokens across similar motions.
- [ ] **Too slow?** Users wait for it before acting (UI transitions > ~0.5s, long staggers).
- [ ] **Too fast?** Origin/destination unreadable.
- [ ] **Excessive motion?** Many elements moving at once, large travel, parallax everywhere, bounce/elastic in product UI.
- [ ] Easing matches the physics: `.out` for entrances, `.in` for exits, `.inOut` for moves, `none` for scrub.
- [ ] Overlap between steps — not strictly sequential, not all at once.
- [ ] Mobile has its own values, not scaled desktop values.

## Output format

```md
### [Severity: High | Medium | Low] <short title>
**Where:** `path/file.tsx:42`
**Problem:** <what is wrong>
**Consequence:** <what the user or the next developer experiences>
**Fix:** <smallest change, with code if short>
```
End with a one-line overall assessment, including what is already done well only if it's worth preserving.
