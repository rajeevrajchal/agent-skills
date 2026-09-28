# Motion Design

Motion answers three questions for the user: *what changed*, *where should I look*, and *what caused what*. If an animation answers none of them, it's decoration — keep it short and subtle, or remove it.

## Contents
- Choreography procedure
- Principles that matter in UI
- Easing: choosing by physics
- Duration
- Stagger
- Direction, distance, scale, depth
- Critiquing feel

## Choreography procedure

1. **Rank elements by importance.** One primary element leads. Supporting elements follow. Ambient elements (background, decoration) move least or not at all.
2. **Order by reading and causality.** Elements animate in the order the user should process them, and effects follow causes (the button responds before the panel opens).
3. **Overlap, don't queue.** Start each step before the previous one ends (position parameter `"<0.1"` or `"-=0.2"`). Strictly sequential steps feel slow; everything at once feels chaotic.
4. **Keep total time short.** A UI transition that blocks interaction should finish in under ~0.5s. A first-load hero may take ~1–1.5s total but must not block scrolling or clicking.
5. **Check the reverse.** If the sequence can be reversed (close, scroll back, hover out), watch it backwards. Exits are usually faster and simpler than entrances — often `tl.reverse()` is wrong and a separate, shorter exit is right.

## Principles that matter in UI

- **Hierarchy** — the most important element moves first and/or most. Secondary elements travel less and change less.
- **Rhythm** — consistent durations and stagger intervals across a product make it feel coherent. Define 3–4 duration tokens and reuse them.
- **Anticipation** — a small wind-up before a large move (slight scale-down before a card flies out). Use sparingly; in productivity UI it reads as delay.
- **Acceleration / deceleration** — nothing physical starts or stops instantly. Entering elements decelerate into place; exiting elements accelerate away.
- **Follow-through and overlap** — parts of an object settle at slightly different times (a panel arrives, its content settles 0.05–0.1s later). This is what separates crafted motion from mechanical motion.
- **Direction** — motion implies spatial relationships. A drawer that slides in from the right exits to the right. "Next" moves content leftward (in LTR), "back" moves it rightward. Keep it consistent across the product.
- **Scale and depth** — scaling up + fading in suggests approaching the viewer; use it for modals and focus states. Keep UI scale deltas small (0.95→1, not 0.5→1).
- **Visual focus** — while something important animates, everything else stays still. Competing motion splits attention.

## Easing: choosing by physics

Decide what the object is doing, then pick the family. Higher power = more pronounced curve.

| Family | Character | Use for |
|---|---|---|
| `none` | Constant speed | Scroll-scrubbed tweens, progress tied to real values, continuous rotation. Almost never for UI entrances |
| `power1` | Very gentle | Subtle fades, color shifts, small nudges |
| `power2` | Natural default | Most UI transitions; exits (`.in`); on-screen moves (`.inOut`) |
| `power3` | Confident | Entrances with some travel: cards, panels |
| `power4` | Dramatic | Large reveals, headline text |
| `expo` | Very fast start, very long settle | Hero reveals, large distances, editorial feel. Overused — the long tail can feel sluggish in UI |
| `sine` | Soft, symmetric | Ambient loops with `yoyo`, gentle floats |
| `circ` | Snaps hard near the end | Mechanical, decisive motion; sparingly |
| `back` | Overshoots, then settles | Small playful elements: badges, toggles, toasts. Overshoot 1.2–1.7. Never on large panels or text blocks |
| `elastic` / `bounce` | Oscillates | Games, toys, mascots. Almost never in product UI |

Direction suffix:
- `.out` — decelerate. Arriving, entering, responding to input. **The default.**
- `.in` — accelerate. Leaving, exiting, falling away.
- `.inOut` — both. Moving between two on-screen positions.

A brand motion language can use `CustomEase` for one signature curve — define it once and reuse it everywhere.

## Duration

Duration scales with distance and size. An 8px tooltip nudge and a 1000px page slide can't share a duration.

- Micro (icon, press, toggle): 0.12–0.2s
- Small element enter: 0.2–0.35s
- Panel, card, modal: 0.3–0.5s
- Page / hero: 0.6–1.2s
- Exits: ~60–80% of the matching entrance

Too slow is the more common failure: if the user waits for the animation before acting, it's too slow. Too fast: the user can't tell where something came from or went. Mobile distances are shorter, so durations should be too.

## Stagger

Stagger says "these are a group; read them in order".

- `each: 0.03–0.08` for lists. For long or dynamic lists use `amount` (total seconds across all items) so 50 items don't take 4 seconds.
- `from: "start"` for reading order; `"center"`/`"edges"` for symmetric layouts; `grid: "auto"` with `from: index | "center"` for 2D grids — the ripple should originate from something meaningful (the clicked cell, the focal point).
- Only visible items need to stagger. Items below the fold get their own trigger or no animation.

## Direction, distance, scale, depth

- UI entrance travel: 16–40px desktop, 8–24px mobile. Larger only for hero moments.
- Prefer `yPercent`/`xPercent` when element sizes vary (text lines, masked reveals).
- Masked reveals (text rising from behind a clip) feel more crafted than fading text: wrap each line in an `overflow: hidden` parent and animate `yPercent: 100 → 0`.
- Parallax: background moves less than foreground. Keep the difference subtle; heavy parallax causes motion sickness and is removed under reduced motion.

## Critiquing feel

When the user says it "feels off", check in this order:
1. **Wrong ease direction** — an entrance using `.in` crashes into place.
2. **Too slow** — cut duration by 30% and compare.
3. **No overlap** — steps queued strictly one after another.
4. **Everything moves equally** — no hierarchy; reduce distance on secondary elements.
5. **Too much distance** — travel larger than the element itself rarely looks good in UI.
6. **Inconsistent tokens** — different durations/eases for the same kind of motion across the product.
