# CSS Layout

## Contents
- Choosing a layout method
- Layout primitives
- Grid patterns
- Flexbox patterns
- Responsive: container vs media queries
- Positioning, containing blocks, stacking contexts
- Overflow and scrolling
- Viewport units and full-height layouts
- Writing modes and logical properties

## Choosing a layout method

| Need | Use |
|---|---|
| Items in a row or column, content-sized, wrapping | Flexbox |
| Rows **and** columns aligned together; page regions; card grids | Grid |
| Nested items aligning to a parent's tracks | `subgrid` (Baseline 2023) |
| Vertical rhythm between siblings | `gap` in a flex/grid column, or a stack primitive |
| Centering | `display: grid; place-items: center;` |
| Overlapping layers (text on image) | Grid with all children in the same area (`grid-area: 1 / 1`) |
| Sticky header / sidebar | `position: sticky` |
| Popups anchored to a trigger | The `popover` top layer + CSS anchor positioning where supported, else JS positioning |
| Float text around an image | `float` (its only remaining legitimate use) |

## Layout primitives

Small, composable, content-agnostic primitives replace most breakpoints.

```css
/* Stack: vertical rhythm */
.stack { display: flex; flex-direction: column; gap: var(--stack-gap, var(--space-3)); }

/* Cluster: wrapping inline group (tags, buttons) */
.cluster { display: flex; flex-wrap: wrap; gap: var(--cluster-gap, var(--space-2)); align-items: center; }

/* Auto grid: as many columns as fit, no media queries */
.auto-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--min, 16rem)), 1fr));
  gap: var(--space-4);
}

/* Sidebar: sidebar + content that wraps when content gets too narrow */
.with-sidebar { display: flex; flex-wrap: wrap; gap: var(--space-4); }
.with-sidebar > :first-child { flex-basis: 16rem; flex-grow: 1; }
.with-sidebar > :last-child { flex-basis: 0; flex-grow: 999; min-inline-size: 60%; }

/* Center: readable measure */
.center { box-sizing: content-box; max-inline-size: 65ch; margin-inline: auto; padding-inline: var(--space-3); }
```

`min(100%, 16rem)` inside `minmax` stops overflow in containers narrower than the minimum.

## Grid patterns

```css
.page {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas: "header" "main" "footer";
  min-block-size: 100dvh;
  grid-template-rows: auto 1fr auto;          /* sticky footer */
}
@media (min-width: 64rem) {
  .page { grid-template-columns: 16rem minmax(0, 1fr); grid-template-areas: "header header" "nav main" "footer footer"; }
}

/* Full-bleed within a centered content column */
.content {
  display: grid;
  grid-template-columns: [full-start] minmax(var(--space-3), 1fr) [content-start] min(65ch, 100% - 2 * var(--space-3)) [content-end] minmax(var(--space-3), 1fr) [full-end];
}
.content > * { grid-column: content; }
.content > .full-bleed { grid-column: full; }
```

- Use `minmax(0, 1fr)` rather than `1fr` when content (long words, `<pre>`, tables) might force a track wider than the container.
- `grid-template-areas` makes layouts readable and easy to rearrange per breakpoint. **Visual order must match DOM order** for reading and focus (WCAG 1.3.2, 2.4.3). Don't reorder meaningful content with `order`, `grid-area`, or `flex-direction: row-reverse`.

## Flexbox patterns

- `flex: 1` = `1 1 0%`: equal distribution regardless of content. `flex: auto` = `1 1 auto`: distribution based on content size.
- A flex child's default `min-width: auto` stops it from shrinking below its content. Add `min-inline-size: 0` to let text truncate (`text-overflow: ellipsis` also needs `overflow: hidden; white-space: nowrap;`).
- Push an item to the end: `margin-inline-start: auto`.
- `gap` works in flex (Baseline). Don't use margins to space siblings.
- `align-items: baseline` aligns mixed font sizes by their text.

## Responsive: container vs media queries

- **Container queries** for components, which respond to the space they're given, not the viewport:
  ```css
  .card-list { container-type: inline-size; container-name: cards; }
  @container cards (min-width: 40rem) { .card { grid-template-columns: 12rem 1fr; } }
  ```
  `container-type: inline-size` applies size containment on the inline axis. The container can't size itself from its children's width. Put it on a wrapper, not the component itself, when that matters.
  Container units (`cqi`, `cqb`) size typography and spacing relative to the container.
- **Media queries** for page-level layout and user preferences. Use range syntax (Baseline 2023): `@media (width >= 64rem)`. Define breakpoints in `rem` or `em` so they respect user font size.
- Prefer intrinsic layouts (auto-grid, flex-wrap, `clamp()`) over breakpoints. Add a breakpoint when the content breaks, not at device widths.
- Preference queries: `prefers-reduced-motion`, `prefers-color-scheme`, `prefers-contrast`, `forced-colors`, `hover`/`pointer` (don't assume touch from width).

## Positioning, containing blocks, stacking contexts

**Containing block** (what `position` offsets and percentages resolve against):
- `absolute` → the nearest positioned ancestor (`position` other than `static`), **or** any ancestor with `transform`, `filter`, `perspective`, `contain: layout/paint`, `container-type`, or `will-change` of those.
- `fixed` → the viewport, **unless** an ancestor has `transform`, `filter`, `perspective`, `contain`, `backdrop-filter`, or `will-change: transform`. Then it behaves like `absolute` inside that ancestor. This is a classic "my modal is stuck inside the card" bug. The top layer (`<dialog>`, `popover`) avoids it entirely.
- `sticky` → sticks within its scrolling ancestor and is limited by its parent's box. It fails if any ancestor between it and the scroller has `overflow: hidden/auto/scroll`.

**Stacking contexts**: `z-index` only compares siblings within the same stacking context. New contexts come from: a positioned element with a `z-index` other than auto, `opacity < 1`, `transform`, `filter`, `mix-blend-mode`, `isolation: isolate`, `contain: paint`, flex/grid children with a `z-index`, `will-change` of those, and `position: fixed/sticky`.
- Use a small z-index scale as tokens (`--z-dropdown: 10; --z-sticky: 20; --z-overlay: 30;`), not 9999.
- `isolation: isolate` on a component root contains its internal z-indexes.
- Use the top layer (`dialog`, `popover`) for modals and popups instead of z-index races.

## Overflow and scrolling

- `overflow: hidden` clips focus rings, sticky children, and dropdowns. Prefer `overflow: clip` when you only want to clip (it doesn't create a scroll container) or `overflow-x: clip` to stop horizontal page overflow.
- Page-level horizontal scrollbars: find the culprit (DevTools, or `* { outline: 1px solid red }`). Don't hide it with `body { overflow-x: hidden }`.
- Scrollable regions must be keyboard reachable: `tabindex="0"`, plus a `role="region"` with a label when there's no focusable content inside.
- `scrollbar-gutter: stable` prevents layout shift when scrollbars appear.
- `overscroll-behavior: contain` on modals and side panels stops scroll chaining to the page.
- `scroll-padding-top: var(--header-height)` on the scroller keeps anchor targets and focused elements from hiding under a sticky header (WCAG 2.4.11).
- Scroll snap (`scroll-snap-type`) for carousels. Keep it `proximity` unless the items are page-like.

## Viewport units and full-height layouts

- `100vh` = the largest viewport on mobile (the area behind browser UI). Use `100dvh` (dynamic), `100svh` (small, stable), or `100lvh`.
- Prefer `min-block-size` over `block-size` for full-height sections so content can grow.
- Account for safe areas on notched devices: `padding-inline: max(var(--space-3), env(safe-area-inset-left));` with `viewport-fit=cover` in the meta viewport.

## Writing modes and logical properties

Use logical properties by default so layouts adapt to `dir="rtl"` and vertical writing modes:

| Physical | Logical |
|---|---|
| `width` / `height` | `inline-size` / `block-size` |
| `min-width` / `max-height` | `min-inline-size` / `max-block-size` |
| `margin-left` / `margin-right` | `margin-inline-start` / `margin-inline-end` (or `margin-inline`) |
| `padding-top` / `padding-bottom` | `padding-block-start` / `padding-block-end` (or `padding-block`) |
| `top` / `left` / `right` / `bottom` | `inset-block-start` / `inset-inline-start` … (or `inset`) |
| `border-left` | `border-inline-start` |
| `text-align: left` | `text-align: start` |
| `float: left` | `float: inline-start` |

Physical properties are still right for things tied to the physical screen: shadows with a light direction, and some transforms.
