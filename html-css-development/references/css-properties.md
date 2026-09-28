# Choosing CSS Properties and Values

## Contents
- Lookup procedure (MDN)
- Modern replacements for old techniques
- Units
- Color
- Typography
- Shorthand pitfalls
- Inheritance and global keywords
- Support and fallbacks
- Motion and interaction

## Lookup procedure (MDN)

Before using a property you're not certain about, check its MDN page (the MDN MCP `get-doc` / `get-compat` tools, if available):
1. **Baseline badge**: "Widely available" is safe. "Newly available" (interoperable for less than 30 months) is fine with a fallback for older browsers. "Limited availability" needs `@supports` and progressive enhancement.
2. **Markers**: *Experimental*, *Deprecated*, and *Non-standard* mean avoid in production unless you have a reason and a fallback.
3. **Formal definition**: initial value, whether it's inherited, what percentages refer to, whether it's animatable, and whether it's a shorthand or longhand. These explain most surprises.
4. **Formal syntax**: the valid values. Don't guess keywords.

MDN's Properties reference lists every standard property alphabetically, marks shorthands, and lists vendor-prefixed non-standard properties separately. Avoid prefixed properties unless MDN says the prefix is still required (for example, `-webkit-line-clamp` is the interoperable way to clamp lines, and `-webkit-text-stroke` is widely supported).

## Modern replacements for old techniques

| Old technique | Modern property | Notes |
|---|---|---|
| Floats + clearfix for layout | `display: grid` / `flex` | `display: flow-root` if you only need a new block formatting context |
| Margins between siblings | `gap` | In flex and grid |
| Padding-top % hack for ratios | `aspect-ratio: 16 / 9` | |
| `top/right/bottom/left: 0` | `inset: 0` | Logical: `inset-inline`, `inset-block` |
| `transform: translate() rotate()` for independent control | `translate`, `rotate`, `scale` properties | Animate them independently |
| Media query for every font size | `font-size: clamp(1rem, 0.9rem + 0.5vw, 1.25rem)` | Keep a `rem` part so zoom still scales text |
| JS for parent selection | `:has()` | `form:has(:user-invalid)`, `.card:has(img)` |
| JS for container-based layout | Container queries | |
| `:focus` rings shown on click | `:focus-visible` | |
| `:invalid` shown on load | `:user-invalid` | |
| Custom checkbox styling via hidden input + spans | `accent-color`, or `appearance: none` on the input | |
| Manual text balancing with `<br>` | `text-wrap: balance` (headings), `text-wrap: pretty` (paragraphs) | |
| Scrollbar layout shift hacks | `scrollbar-gutter: stable` | |
| `100vh` on mobile | `100dvh` / `100svh` | |
| Sass color functions | `color-mix(in oklch, var(--c) 80%, white)`, relative color syntax `oklch(from var(--c) calc(l + 0.1) c h)` | Check Baseline for relative color |
| Sass nesting | Native nesting | Specificity is unchanged |
| JS scroll-linked effects | `animation-timeline: scroll()/view()` | Check support; progressive enhancement only |
| `-webkit-overflow-scrolling` and other prefixed hacks | Remove | Obsolete |

## Units

| Unit | Use for |
|---|---|
| `rem` | Font sizes, spacing tokens, media query breakpoints. Respects the user's font-size setting |
| `em` | Spacing that should scale with the component's own font size (button padding, icon size) |
| `ch` / `ex` | Measure (`max-inline-size: 65ch`), inline spacing |
| `%` | Relative to the containing block (check what the property's percentage refers to) |
| `fr` | Grid track distribution |
| `vw`/`vh`/`dvh`/`svh` | Viewport-relative; never alone for font size (breaks zoom) |
| `cqi`/`cqb` | Relative to the query container |
| `px` | Borders, hairlines, shadows, small fixed details |
| Unitless | `line-height` (always unitless, so it scales with inherited font sizes) |

Font sizes in `px` ignore the user's browser font-size preference. Use `rem`.

## Color

- Author in `oklch()` for perceptually even palettes. Hex and `rgb()` are fine for fixed brand values.
- Contrast: text at least 4.5:1 (large text, 24px, or 18.66px bold: 3:1). UI components and focus indicators: 3:1 against adjacent colors (WCAG 1.4.3, 1.4.11).
- `currentColor` for icons and borders that should follow the text color.
- `color-scheme` plus `light-dark()` for themes.
- **Forced colors** (Windows High Contrast): backgrounds and shadows get removed. Make sure borders or outlines carry meaning, and use system colors in `@media (forced-colors: active)` (`CanvasText`, `LinkText`, `ButtonText`, `Highlight`). A transparent outline (`outline: 2px solid transparent`) becomes visible in forced colors, which is useful for custom focus styles built with box-shadow.

## Typography

- `font: inherit` on form controls (the reset does this).
- `line-height: 1.5` for body text, tighter (1.1–1.25) for large headings.
- `max-inline-size: 65ch` or so for readable line length.
- `overflow-wrap: anywhere` or `break-word` for user-generated content and URLs. `hyphens: auto` needs the correct `lang`.
- Web fonts: `font-display: swap` (or `optional`), `size-adjust` / `ascent-override` on the fallback to reduce layout shift, and WOFF2 only.
- Text must survive the WCAG 1.4.12 text spacing overrides (line-height 1.5, letter spacing 0.12em, word spacing 0.16em, paragraph spacing 2em). Don't use fixed heights on text containers.

## Shorthand pitfalls

A shorthand sets **every** longhand it covers, resetting any you omit to their initial values.

| Shorthand | Silently resets |
|---|---|
| `background` | `background-image`, `-size`, `-position`, `-repeat`, `-clip`, `-origin`, `-attachment` |
| `font` | `line-height`, `font-variant`, `font-stretch`, `font-weight`, `font-style` |
| `border` | All four sides' width, style, and color (and `border-image`) |
| `transition` / `animation` | Every sub-property, including delay and timing function |
| `flex` | `flex-grow`, `flex-shrink`, `flex-basis` (and `flex: 1` sets basis to `0%`) |
| `inset` / `margin` / `padding` | All sides |
| `grid` / `grid-template` | Areas, rows, columns (and `grid` also resets the auto-flow properties) |
| `all` | Every property except `direction`, `unicode-bidi`, and custom properties |

Use longhands when overriding a single aspect in a variant (`background-color`, not `background`).

## Inheritance and global keywords

- Inherited by default: typography and text properties, `color`, `visibility`, `cursor`, `list-style`, custom properties. Not inherited: box model, layout, background, border, position, and so on.
- `inherit`, `initial` (the spec's initial value, **not** the browser default; `display: initial` is `inline`), `unset`, `revert` (back to the user-agent style), and `revert-layer` (back to the previous cascade layer).
- `all: unset` on a `<button>` removes its focus styles, cursor, and more. Re-add a visible focus style when you do this.

## Support and fallbacks

```css
.card { display: block; }                      /* fallback */
@supports (display: grid) and (grid-template-columns: subgrid) {
  .card { display: grid; grid-template-rows: subgrid; }
}

@supports not (text-wrap: balance) { /* optional: alternative */ }
```
- Put the fallback declaration first, then the enhanced one. Browsers drop declarations they don't understand (forward-compatible parsing), so `display: block; display: grid;` works without `@supports` for simple cases.
- `@supports selector(:has(a))` tests selector support.
- Don't ship experimental features without a fallback that is still usable, not just "unstyled".

## Motion and interaction

- Transition specific properties (`transition: background-color 150ms, transform 150ms`), never `all`.
- Animate `transform` and `opacity`. Width, height, and top animations cause layout on every frame.
- `@media (prefers-reduced-motion: reduce)`: remove large motion and parallax. Keep simple fades.
- `cursor: pointer` on non-link buttons is a design choice. The real requirement is visible hover and focus states.
- `touch-action: manipulation` removes double-tap-zoom delay on custom controls. Never block pinch-zoom globally.
- `pointer-events: none` doesn't remove elements from the tab order or the accessibility tree. Use `inert` or `disabled`.
- Targets are at least 24×24 CSS px (WCAG 2.5.8), and ideally 44×44 on touch. Pad small icons, and use `::after` hit-area extension if needed.
