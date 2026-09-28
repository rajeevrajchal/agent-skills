# Responsive Animation and Accessibility

## Contents
- gsap.matchMedia mechanics
- Designing per device
- Touch vs hover
- Reduced motion: what changes
- Other accessibility rules
- Testing

## gsap.matchMedia mechanics

```ts
const mm = gsap.matchMedia();

mm.add(
  {
    isDesktop: "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
    isTablet: "(min-width: 640px) and (max-width: 1023px) and (prefers-reduced-motion: no-preference)",
    isMobile: "(max-width: 639px) and (prefers-reduced-motion: no-preference)",
    reduceMotion: "(prefers-reduced-motion: reduce)",
    canHover: "(hover: hover) and (pointer: fine)",
  },
  (context) => {
    const c = context.conditions as { isDesktop: boolean; isTablet: boolean; isMobile: boolean; reduceMotion: boolean; canHover: boolean };
    // create animations for this combination...
    return () => { /* optional: non-GSAP cleanup (listeners) for this branch */ };
  },
  rootEl,  // scope for selector strings
);

// teardown (component unmount): mm.revert();
```

- The callback reruns whenever any condition in the object changes; everything created inside is reverted first. Don't store tweens created in a branch outside it.
- Return a function to remove event listeners added in the branch.
- Use `context.add(() => {...})` for animations created later (e.g., in an event handler) so they're still reverted with the branch.
- `gsap.matchMediaRefresh()` forces re-evaluation (e.g., after a user toggles an in-app "reduce motion" setting stored in a class).

## Designing per device

Don't multiply desktop values by 0.5. Decide per device:

| Aspect | Desktop | Tablet | Mobile |
|---|---|---|---|
| Travel distance | 40–80px hero, 20–40px UI | ~70% of desktop | 8–24px |
| Duration | Baseline | Slightly shorter | 20–35% shorter |
| Simultaneous elements | Many with stagger | Fewer | Group into one block when possible |
| Pin + scrub | Acceptable for storytelling | Case by case | Usually replaced by a simple reveal |
| Parallax | Subtle | Minimal | Off |
| Trigger | Hover, scroll, pointer | Tap + scroll | Tap + scroll; no hover-only reveals |
| Layout direction | Horizontal sections OK | Consider vertical | Vertical |

Stagger of a 12-item grid: desktop 3 columns ripples; mobile single column should reveal per item as it enters (batch), not as one long stagger.

## Touch vs hover

- `(hover: hover) and (pointer: fine)` → hover effects. Otherwise, provide the same information without hover (visible by default or on tap).
- Never hide essential content behind hover animation.
- Pointer-follow effects (magnetic buttons, custom cursors): desktop fine-pointer only.
- On touch, respond on `pointerdown` for press feedback; don't delay navigation for an exit animation longer than ~200ms.

## Reduced motion: what changes

`prefers-reduced-motion: reduce` means *reduce*, not *remove everything*. Opacity and color changes are generally fine and help communicate state.

| Keep | Reduce | Remove |
|---|---|---|
| Opacity fades (short) | Translations → ≤ ~8px or none | Parallax |
| Color/background transitions | Durations → short (≤ 0.2–0.3s) | Scroll-scrubbed movement and pinning-as-storytelling |
| Instant state changes | Stagger → very small or none | Zoom/scale-heavy transitions |
| Focus indicators | | Infinite/ambient loops, auto-playing motion |
| Progress feedback | | Smooth scrolling libraries |

Reduced-motion content must be in its **final, readable state** — if a scrubbed timeline reveals text, the reduced branch shows the text immediately.

Minimal pattern when a component has no breakpoint logic:
```ts
mm.add("(prefers-reduced-motion: no-preference)", () => { /* full motion */ }, rootEl);
mm.add("(prefers-reduced-motion: reduce)", () => { gsap.from(".item", { autoAlpha: 0, duration: 0.2 }); }, rootEl);
```

Also honor it outside GSAP: CSS transitions/animations via `@media (prefers-reduced-motion: reduce)`, video autoplay, Lottie, canvas loops.

WCAG: 2.3.3 Animation from Interactions (AAA) — motion triggered by interaction can be disabled; 2.2.2 Pause, Stop, Hide (A) — auto-playing motion longer than 5s must be pausable; 2.3.1 — no flashing more than 3 times per second.

## Other accessibility rules

- Hidden ≠ inaccessible: use `autoAlpha` so hidden elements are `visibility: hidden` (removed from tab order and a11y tree). `opacity: 0` alone leaves invisible focusable elements.
- Don't animate focus away: when a modal opens, move focus after it is visible (or immediately — focus works on `visibility: visible` elements only; set visible in the first frame).
- Animations must not delay access: controls usable during entrance animation (no `pointer-events: none` for the whole intro).
- Text reveals with SplitText: keep the original text accessible (`aria-label` on the parent, `aria-hidden` on split pieces — SplitText 3.13+ handles this with its `aria` option, default `"auto"`).
- Scrolljacking must not trap keyboard users: pinned sections must still scroll with arrow keys/space/Page Down.
- Provide an in-app motion toggle for heavy experiences; implement via a root class + `gsap.matchMediaRefresh()` or an extra condition.

## Testing

- Chrome DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion".
- macOS: System Settings → Accessibility → Display → Reduce motion. iOS: Accessibility → Motion. Windows: Settings → Accessibility → Visual effects → Animation effects.
- Resize across breakpoints *after* load to verify branches revert cleanly (no leftover inline transforms, no ghost pin-spacers).
- Test with keyboard only and a screen reader for entrance-heavy pages.
