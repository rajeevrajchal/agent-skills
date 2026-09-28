# React / Next.js

## Contents
- Setup
- useGSAP: the default
- Event-driven animations (contextSafe)
- Reacting to state/props
- Exit animations
- Lists and Flip
- Next.js specifics
- Anti-patterns

## Setup

```bash
npm i gsap @gsap/react
```

Register plugins once, in a client module imported by animated components:

```ts
// lib/gsap.ts
"use client";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);
export { gsap, ScrollTrigger, useGSAP };
```

## useGSAP: the default

`useGSAP` = `useIsomorphicLayoutEffect` + `gsap.context()` + automatic `revert()` on unmount/dependency change. It makes Strict Mode double-invocation safe.

```tsx
"use client";
import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

export function Hero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        { motion: "(prefers-reduced-motion: no-preference)", reduce: "(prefers-reduced-motion: reduce)" },
        (ctx) => {
          const { reduce } = ctx.conditions as { motion: boolean; reduce: boolean };
          if (reduce) {
            gsap.from(".hero__content > *", { autoAlpha: 0, duration: 0.2 });
            return;
          }
          gsap.timeline({ defaults: { ease: "power3.out", duration: 0.6 } })
            .from(".hero__title", { yPercent: 100, autoAlpha: 0 })
            .from(".hero__copy", { y: 20, autoAlpha: 0 }, "<0.15")
            .from(".hero__cta", { y: 12, autoAlpha: 0, duration: 0.4 }, "<0.1");
        },
        root, // scope for matchMedia selectors
      );
      // matchMedia created inside useGSAP is reverted with the context.
    },
    { scope: root },
  );

  return (
    <section ref={root} className="hero">
      <div className="hero__content">
        <h1 className="hero__title">…</h1>
        <p className="hero__copy">…</p>
        <a className="hero__cta" href="/start">Start</a>
      </div>
    </section>
  );
}
```

Config:
- `scope` — selector strings resolve inside this ref. Always set it.
- `dependencies` — like `useEffect` deps; animation reverts and re-runs when they change.
- `revertOnUpdate: true` — revert on every dependency change (default only reverts on unmount; dependency changes just re-run).

## Event-driven animations (contextSafe)

Animations created in event handlers run *after* the hook body, so they aren't in the context and won't be reverted. Wrap handlers with `contextSafe`:

```tsx
const root = useRef<HTMLDivElement>(null);
const tl = useRef<gsap.core.Timeline | null>(null);

const { contextSafe } = useGSAP(
  () => {
    tl.current = gsap.timeline({ paused: true, defaults: { duration: 0.25, ease: "power2.out" } })
      .to(".menu__panel", { autoAlpha: 1, y: 0 })
      .from(".menu__item", { y: 8, autoAlpha: 0, stagger: 0.03 }, "<0.05");
  },
  { scope: root },
);

const toggle = contextSafe((open: boolean) => {
  if (open) tl.current?.play();
  else tl.current?.reverse();
});
```

For listeners added manually inside `useGSAP`, wrap with `contextSafe` and return a cleanup that removes them:

```tsx
useGSAP((_ctx, contextSafe) => {
  const onEnter = contextSafe!(() => gsap.to(".card", { y: -4, overwrite: "auto" }));
  const el = root.current!;
  el.addEventListener("pointerenter", onEnter);
  return () => el.removeEventListener("pointerenter", onEnter);
}, { scope: root });
```

## Reacting to state/props

Two options — pick by whether the animation is a *function of state* or a *one-off reaction*:

1. **Timeline driven by state** (open/closed, step index): build the timeline once, then drive it from a separate effect.
   ```tsx
   useGSAP(() => { isOpen ? tl.current?.play() : tl.current?.reverse(); }, { dependencies: [isOpen] });
   ```
   Keep the build in its own `useGSAP` without deps so it isn't rebuilt on each toggle.
2. **Rebuild on data change** (list content changed): `dependencies: [items]`, `revertOnUpdate: true`.

Don't store GSAP-animated values in React state. React owns structure; GSAP owns the in-between frames. If both write `style.transform`, React's next render wins and causes jumps — never put `style={{ transform }}` on an element GSAP animates.

## Exit animations

React removes the node immediately on unmount. Use a phase state:

```tsx
type Phase = "open" | "closing" | "closed";
const [phase, setPhase] = useState<Phase>("closed");

useGSAP(() => {
  if (phase !== "closing") return;
  gsap.to(panelRef.current, { autoAlpha: 0, y: 12, duration: 0.2, ease: "power2.in",
    onComplete: () => setPhase("closed") });
}, { dependencies: [phase], scope: root });

return phase !== "closed" ? <div ref={panelRef}>…</div> : null;
```

For route transitions in Next.js App Router, keep transitions short and prefer entrance-only animations, or use the View Transitions API; blocking navigation on exit tweens is fragile.

## Lists and Flip

- Stable `key`s are mandatory — GSAP holds references to DOM nodes; key churn replaces nodes mid-animation.
- Flip: capture `Flip.getState()` before `setState`, run `Flip.from()` in a `useLayoutEffect`/`useGSAP` keyed on the change (DOM updated, not yet painted).

```tsx
const flipState = useRef<Flip.FlipState | null>(null);
const reorder = () => { flipState.current = Flip.getState(".item", { props: "opacity" }); setItems(shuffle); };
useGSAP(() => {
  if (!flipState.current) return;
  Flip.from(flipState.current, { duration: 0.4, ease: "power2.inOut", stagger: 0.02 });
  flipState.current = null;
}, { dependencies: [items], scope: root });
```

## Next.js specifics

- Any file calling GSAP needs `"use client"`. Keep animated parts as small client components; the rest stays server-rendered.
- Initial hidden state: avoid SSR'd `opacity: 0`. Let `useGSAP` (layout effect) set it before paint, or gate CSS on a class added client-side. `useGSAP` runs before paint on the client, so `from()` doesn't flash for client-rendered content; for SSR content there can be a frame of the final state before hydration — acceptable (content is visible), or hide with `.js-anim` gating if needed.
- After client-side route changes, ScrollTriggers from the new page are created on mount; call `ScrollTrigger.refresh()` once after images/fonts settle if positions are off.

## Anti-patterns

- `useEffect(() => { gsap.to(...) }, [])` with no cleanup → Strict Mode doubles, leaks ScrollTriggers.
- `gsap.to(".box", …)` without `scope` → animates every `.box` in the document.
- Creating a new tween in `onMouseEnter` each time without `overwrite` or a reusable timeline.
- `ScrollTrigger.getAll().forEach(t => t.kill())` in component cleanup.
- Wrapping GSAP in a custom context/provider/animation manager before there is a second consumer.
