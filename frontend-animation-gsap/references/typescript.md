# TypeScript with GSAP

GSAP ships its own types (`gsap` namespace is global once `gsap` is imported). No `@types/gsap`.

## Useful types

| Type | Use |
|---|---|
| `gsap.TweenTarget` | Anything GSAP accepts as a target (selector, element, array, NodeList, object) |
| `gsap.TweenVars` | Vars for `to`/`from`/`set` |
| `gsap.TimelineVars` | Vars for `gsap.timeline()` |
| `gsap.core.Tween` | Return of `gsap.to` etc. |
| `gsap.core.Timeline` | Return of `gsap.timeline()` |
| `gsap.core.Animation` | Common base of tween/timeline (for functions accepting either) |
| `gsap.Context` | Return of `gsap.context()` |
| `gsap.MatchMedia` | Return of `gsap.matchMedia()` |
| `gsap.Position` | Timeline position parameter |
| `gsap.EaseString` / `gsap.EaseFunction` | Ease values |
| `gsap.QuickToFunc` | Return of `gsap.quickTo` |
| `ScrollTrigger.Vars` | ScrollTrigger config (import `ScrollTrigger` from `gsap/ScrollTrigger`) |
| `Flip.FlipState` | Return of `Flip.getState` |

## Reusable animation functions

Accept the narrowest target type you actually need; return the animation; let callers override vars.

```ts
import { gsap } from "gsap";

type RevealOptions = Pick<gsap.TweenVars, "duration" | "ease" | "stagger" | "delay"> & { distance?: number };

export function reveal(targets: gsap.TweenTarget, { distance = 24, ...vars }: RevealOptions = {}): gsap.core.Tween {
  return gsap.from(targets, {
    y: distance,
    autoAlpha: 0,
    duration: 0.45,
    ease: "power3.out",
    ...vars,
  });
}

export function panelIn(panel: HTMLElement, items: readonly HTMLElement[]): gsap.core.Timeline {
  return gsap.timeline({ defaults: { ease: "power3.out" } })
    .fromTo(panel, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.3 })
    .from(items, { autoAlpha: 0, y: 8, stagger: 0.03, duration: 0.25 }, "<0.05");
}
```

Composition: `master.add(panelIn(p, items), "open")` — the position is `gsap.Position`.

## Refs

- React: `useRef<HTMLDivElement>(null)`; inside `useGSAP` the ref is populated. Assert once at the top (`const el = root.current; if (!el) return;`) rather than `!` everywhere.
- Timeline refs: `useRef<gsap.core.Timeline | null>(null)`.
- Svelte: `let root: HTMLElement;` with `bind:this` (use `let root = $state<HTMLElement>()` only if reactivity on the ref is needed).
- Vue: `useTemplateRef<HTMLElement>("root")` or `ref<HTMLElement | null>(null)`.

## Selector results

`querySelectorAll` returns `NodeListOf<Element>`; type it: `root.querySelectorAll<HTMLElement>(".card")`. `gsap.utils.toArray<HTMLElement>(".card", root)` returns a typed array scoped to `root`.

## Non-DOM targets

GSAP tweens any object's numeric properties. Type the target and GSAP checks nothing about property names — so wrap to keep safety:

```ts
type Uniforms = { uProgress: { value: number }; uIntensity: { value: number } };
function animateProgress(u: Uniforms, to: number): gsap.core.Tween {
  return gsap.to(u.uProgress, { value: to, duration: 0.8, ease: "power2.inOut" });
}
```

## matchMedia conditions

`context.conditions` is typed loosely (`Record<string, boolean>`-like). Cast once to a named type:
```ts
type Conditions = { isDesktop: boolean; reduceMotion: boolean };
const { isDesktop, reduceMotion } = ctx.conditions as Conditions;
```

## Avoid

- `any` for targets — use `gsap.TweenTarget` or the concrete element type.
- Wrapping every GSAP call in typed helpers. Type the functions that are genuinely reused; inline the rest.
- Generic "AnimationService" classes with registries. Functions returning timelines compose better and are easier to test.
