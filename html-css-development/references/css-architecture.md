# CSS Architecture

## Contents
- The cascade, in the order it decides
- Cascade layers
- Specificity strategy
- Naming and component boundaries
- Tokens with custom properties
- Reset / base
- Nesting and scoping
- Style attributes and dynamic values
- File organization
- Anti-patterns

## The cascade, in the order it decides

When two declarations target the same property on the same element, the winner is decided by, in order:
1. **Origin and importance**: transitions > `!important` user agent > `!important` user > `!important` author > animations > normal author > normal user > normal user agent.
2. **Context**: shadow DOM encapsulation (for `!important`, the order flips).
3. **Style attribute**: author declarations in `style=""` beat any selector (CSS Style Attributes spec).
4. **Layers**: unlayered styles beat all layered styles. Among layers, the one declared later wins. `!important` reverses layer order.
5. **Specificity**: (id, class/attribute/pseudo-class, type/pseudo-element).
6. **Scope proximity** (`@scope`, where supported).
7. **Order of appearance**: last one wins.

Most "my style doesn't apply" bugs sit at steps 4–5. Design so you win at step 4 (layers) and rarely need step 5.

## Cascade layers

```css
@layer reset, base, layout, components, utilities;

@import url("vendor/datepicker.css") layer(vendor); /* third-party CSS contained in a layer */

@layer reset      { *, *::before, *::after { box-sizing: border-box; } }
@layer base       { body { font: 1rem/1.5 var(--font-body); color: var(--color-text); } }
@layer layout     { .stack > * + * { margin-block-start: var(--stack-space, 1rem); } }
@layer components { .card { … } }
@layer utilities  { .visually-hidden { … } .mt-0 { margin-block-start: 0 !important; } }
```

- Declare the order once, at the top of the entry stylesheet.
- A utility beats a component even when the component selector is more specific, because layer order is compared before specificity.
- Put third-party CSS in a low layer. Your components then override it without specificity battles.
- Unlayered CSS beats every layer. Treat it as intentional (for example, a legacy stylesheet during migration), not as an accident.

## Specificity strategy

- Use single class selectors for components and their parts: `.card`, `.card__title` (or `.card-title`).
- **No IDs in selectors.** An id outranks any number of classes. Keep ids for fragment links, `for`/`aria-*` references, and script.
- Avoid qualifying with element type (`div.card`) and deep descendant chains (`.page .main .card h3`).
- `:where()` has zero specificity, which makes it ideal for defaults users should override: `:where(.prose) :where(h2) { margin-block: 2em 0.5em; }`.
- `:is()` takes the specificity of its most specific argument, so be careful with ids inside it.
- State hooks: use `[aria-expanded="true"]`, `[aria-current]`, `:checked`, `:disabled`, `[data-state="open"]`. Style real state, not duplicated `.is-open` classes, when an ARIA or native state exists.
- Reserve `!important` for the utilities layer and for overriding inline styles from third-party code. Leave a comment each time.

## Naming and component boundaries

Any consistent convention works. Pick one per project and document it:
- **BEM-ish**: `.block`, `.block__element`, `.block--modifier`. Explicit, flat specificity, easy to grep.
- **Utility-first** (Tailwind): the same principles still apply. Use semantic HTML underneath, and `@apply` or components for repeated patterns.
- **Scoped framework styles** (Svelte, Vue `scoped`, CSS Modules): short local class names are fine. Keep global tokens and base styles in global CSS.

A component styles **its own internals only**. Its outer spacing and placement come from the parent layout (`gap`, stack utilities). That's what makes components reusable.

## Tokens with custom properties

```css
:root {
  /* primitives */
  --blue-600: oklch(0.55 0.18 255);
  --gray-900: oklch(0.2 0.01 260);
  /* semantic tokens: components use these */
  --color-text: var(--gray-900);
  --color-accent: var(--blue-600);
  --color-surface: white;
  --space-1: 0.25rem; --space-2: 0.5rem; --space-3: 1rem; --space-4: 1.5rem; --space-5: 2.5rem;
  --radius-2: 0.5rem;
  --font-body: system-ui, sans-serif;
  --step-0: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);
  --step-2: clamp(1.5rem, 1.3rem + 1vw, 2rem);
}

@media (prefers-color-scheme: dark) {
  :root { --color-text: oklch(0.93 0.01 260); --color-surface: oklch(0.18 0.01 260); }
}
```

- Two tiers is enough: primitives, then semantic tokens. Components reference semantic tokens.
- `color-scheme: light dark` on `:root` makes native controls and scrollbars follow the theme. `light-dark()` (Baseline 2024) lets you set per-scheme values inline.
- Component-level custom properties are the component's public API: `.button { --button-bg: var(--color-accent); background: var(--button-bg); }`. Variants override `--button-bg`.
- Register properties with `@property` when you need type checking, animation, or non-inheritance.
- Fallbacks: `var(--x, 1rem)`. Remember that an invalid value makes the declaration "invalid at computed-value time" (it falls back to `inherit` or `initial`), not to the previous declaration.

## Reset / base

Keep resets small and modern. Don't blanket-reset everything to zero and then rebuild it.
```css
@layer reset {
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; }
  img, svg, video, canvas { display: block; max-inline-size: 100%; }
  img, video { block-size: auto; }
  input, button, textarea, select { font: inherit; }
  p, h1, h2, h3, h4, h5, h6 { overflow-wrap: break-word; }
  h1, h2, h3 { text-wrap: balance; }
  :target { scroll-margin-block: 5ex; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
  }
}
```
Don't remove `outline` in the reset. Don't set `list-style: none` globally (it removes list semantics in Safari).

## Nesting and scoping

- **Native CSS nesting** is Baseline (2023, with the relaxed syntax in late 2023). Nest to at most two or three levels, mostly for states and media or container queries:
  ```css
  .card {
    padding: var(--space-3);
    &:hover { box-shadow: var(--shadow-2); }
    & .card__title { font-size: var(--step-2); }
    @container (min-width: 30rem) { display: grid; grid-template-columns: 1fr 2fr; }
  }
  ```
  Nesting doesn't reduce specificity: `.a { .b {} }` compiles to `.a .b` (0,2,0).
- `@scope (.card) to (.card__content) { … }` gives donut scoping. Check Baseline status before relying on it, and fall back to class naming.

## Style attributes and dynamic values

Per the CSS Style Attributes spec, `style=""` holds declarations only, applies to one element, and outranks all selectors. So:
- Use it for per-instance **data**, passed as custom properties: `style="--progress: 42%; --accent: #c33"`. The stylesheet decides what to do with them.
- Never use it for static styling, states, or responsive rules.
- In script, prefer `el.style.setProperty("--progress", "42%")`. It works under a strict CSP, unlike `style` attributes in markup.
- If a framework binds `style` directly on an element, don't also target that property from the stylesheet. The inline value always wins.

## File organization

A reasonable default:
```
styles/
  index.css         @layer order + @imports
  tokens.css        custom properties
  reset.css
  base.css          element defaults (typography, links, forms)
  layout.css        page grid, stack/cluster/sidebar primitives
  components/*.css  one file per component (or co-located with the component)
  utilities.css
```
Co-locate component styles with components in frameworks. Keep tokens, reset, and base global.

## Anti-patterns

- Specificity wars: `.page .sidebar .nav a.active` → `#nav a` → `!important`.
- Magic numbers (`top: 37px`, `margin-left: -3px`). Derive values from tokens or from layout (`gap`, grid alignment).
- Presentation classes in markup that fight semantics (`.h1` on a `<p>` as the main page title).
- Styling by DOM position (`div > div > span`), which breaks on any markup change.
- Duplicated tokens (the same hex value in 40 places).
- Global `* { transition: all 0.3s }`.
- Framework-generated inline styles for static design.
