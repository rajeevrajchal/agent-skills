---
name: html-css-development
description: Write, review, and debug standards-based HTML and CSS following MDN's HTML and CSS references, WAI-ARIA (first rule of ARIA, APG patterns), and the W3C CSS Style Attributes spec. Use when building or refactoring pages, layouts, or components in HTML/CSS (including inside React, Svelte, Vue, or Astro templates); choosing semantic elements; building accessible forms, navigation, dialogs, tabs, or menus; deciding whether ARIA is needed; structuring CSS (cascade layers, specificity, custom properties, naming); building responsive layouts with flexbox, grid, container or media queries; choosing modern CSS properties; fixing layout, overflow, z-index, or specificity bugs; using inline style attributes; or auditing markup and styles for accessibility and standards compliance.
license: MIT
metadata:
  version: "1.0"
  sources: "MDN HTML reference, MDN CSS properties reference, MDN ARIA + WAI-ARIA 1.2 / APG, W3C CSS Style Attributes (REC 2013), WCAG 2.2"
---

# HTML & CSS Development

Act as a senior front-end engineer who writes standards-based markup and CSS. HTML carries **meaning and structure**, CSS carries **presentation**, and JavaScript carries **behavior**. Keep each layer doing its own job. Most accessibility, maintainability, and performance problems come from one layer doing another's work: a `<div>` pretending to be a button, CSS hiding content that should not exist, or inline styles standing in for a stylesheet.

## 0. Sources of truth

Follow these, in this order, when rules conflict or a detail is uncertain:

1. **HTML**: WHATWG HTML Living Standard, as documented on MDN (elements, attributes, content categories).
2. **CSS**: MDN CSS reference and the CSS specs it links to. Before using a property or value, check its **Baseline** status and any experimental, deprecated, or non-standard markers on MDN.
3. **ARIA**: WAI-ARIA 1.2 and the ARIA Authoring Practices Guide (APG) for widget patterns. MDN ARIA pages give per-role and per-attribute rules.
4. **Style attribute**: W3C *CSS Style Attributes*, Recommendation 2013. The 2000 working draft is superseded. It allowed selectors and pseudo-classes inside `style=""`, and the final spec does not.
5. **Accessibility conformance**: WCAG 2.2 level AA.

When you're unsure whether an element, attribute, property, or role is valid, look it up. If the MDN MCP tools are available, use `search` or `get-doc`, and `get-compat` for browser support. Never invent attributes, values, or ARIA roles.

## 1. Pick the mode

| The user wants to… | Mode | Procedure |
|---|---|---|
| Build a page, section, or component | **Build** | §2 build order, then §3–§6 |
| "Review this HTML/CSS", "is this accessible?" | **Review** | Read `references/review-checklist.md`. Optionally run `scripts/audit-html.mjs` first |
| "The layout breaks / z-index doesn't work / my style isn't applied" | **Debug** | Read `references/debugging.md` and follow it in order |
| "Should I use ARIA here?", custom widgets | **ARIA** | §4, then `references/aria.md` |

## 2. Build order: small, working steps

Build in layers. Each step must work before you start the next one. For anything bigger than a single element, list the steps first and share the list with the user when the task is large.

1. **Content and outline (HTML only, no CSS).** Use real content or realistic placeholders. Mark it up with semantic elements: landmarks, a heading outline, lists, forms with labels, tables for tabular data. **Check:** the unstyled page reads in a sensible order, every control works with the keyboard, and the heading outline makes sense.
2. **Layout.** Page-level grid or flex, then each component's internal layout. No colors or decoration yet. **Check:** nothing overflows at 320px wide or at 1440px wide.
3. **Visual styles through tokens.** Use custom properties for color, spacing, type, and radius, applied to components. **Check:** text contrast is at least 4.5:1 (3:1 for large text and UI boundaries).
4. **States.** Style `:hover`, `:focus-visible`, `:active`, `:disabled`, `:user-invalid`, `[aria-expanded="true"]`, `[aria-current]`, `:checked`, and so on. **Check:** you can tab through the page and always see where focus is.
5. **Responsive behavior.** Container queries for components, media queries for page-level changes. Handle user preferences: `prefers-reduced-motion`, `prefers-color-scheme`, `forced-colors`. **Check:** zoom to 200% and 400%, and try narrow containers.
6. **Enhancement.** Add JavaScript behavior, plus ARIA only where native HTML can't express the widget (§4). **Check:** the page still works with JavaScript disabled wherever the platform allows.
7. **Verify.** Run through `references/review-checklist.md`.

Don't jump to step 3 or 6 while step 1 is wrong. Styling or scripting over broken semantics bakes the defects in.

## 3. HTML non-negotiables

Full guidance: `references/html-semantics.md` and `references/forms.md`.

1. **Choose elements by meaning, not appearance.** A link (`<a href>`) navigates. A button (`<button>`) performs an action. Headings form an outline and don't skip levels. Lists are lists. `<div>` and `<span>` are for styling hooks only.
2. **Document basics:** `<!doctype html>`, `<html lang="…">`, `<meta charset="utf-8">`, `<meta name="viewport" content="width=device-width, initial-scale=1">` (never disable zoom), and a unique, descriptive `<title>`.
3. **Landmarks:** one `<main>`. Use `<header>`, `<nav>` (label it when there's more than one), `<aside>`, and `<footer>`. Don't add ARIA roles that duplicate these; the implicit role is already there.
4. **Every form control has a programmatic label**: a `<label for>` or a wrapping `<label>`. Group related controls with `<fieldset>` and `<legend>`. Use the right `type`, `autocomplete`, and native constraint attributes.
5. **Images:** meaningful images get `alt` text that says what the image conveys. Decorative images get `alt=""`. Always set `width` and `height` to prevent layout shift. Use `srcset`/`sizes` or `<picture>` for responsive images.
6. **Follow the content model** (MDN's "Content categories" and each element's "Permitted content"). Never nest interactive content inside interactive content (a `<button>` inside an `<a>`). Never put block content inside `<p>`. `<button>` accepts phrasing content only.
7. **Use native interactive elements before building custom ones:** `<button>`, `<a>`, `<details>`/`<summary>`, `<dialog>`, the `popover` attribute, `<select>`, `<input type=…>`, `<progress>`, `<meter>`.
8. **No presentational or obsolete markup:** `<center>`, `<font>`, `align`, `bgcolor`, `border` on tables and images, `<br>` for spacing, or tables for layout.
9. **Syntax:** lowercase element and attribute names, quoted attribute values, unique `id`s, and boolean attributes written as present or absent (`disabled`, not `disabled="false"`).

## 4. ARIA non-negotiables

Full guidance: `references/aria.md`.

1. **First rule:** if a native element or attribute gives the semantics and behavior you need, use it instead of ARIA. "No ARIA is better than bad ARIA."
2. **Don't change native semantics** unless you really have to (for example, `<h2 role="tab">` is wrong; put the heading inside the tab instead).
3. **ARIA changes what assistive technology announces. It adds no behavior.** Every interactive ARIA role needs you to implement focusability, the keyboard model from the matching APG pattern, and state updates (`aria-expanded`, `aria-selected`, `aria-checked`…) that stay in sync with what's on screen.
4. **Never put `aria-hidden="true"` or `role="presentation"`/`"none"` on a focusable element**, or on an ancestor of one. Use `inert` to disable a whole region.
5. **Every interactive element has an accessible name.** Prefer visible text, then `aria-labelledby`, then `aria-label`. Don't put `aria-label` on generic `<div>`/`<span>` elements that have no role; it's prohibited and unreliable there.
6. **Live regions** (`aria-live`, `role="status"`, `role="alert"`) must be in the DOM *before* their content changes.
7. **Only valid roles and `aria-*` attributes**, used on roles that support them. Check MDN or the ARIA spec; don't guess.

## 5. CSS non-negotiables

Full guidance: `references/css-architecture.md`, `references/css-layout.md`, `references/css-properties.md`.

1. **Control the cascade on purpose.** Order it with `@layer` (reset → base → layout → components → utilities). Keep specificity low and flat: class selectors, with `:where()` for zero-specificity defaults. No ID selectors for styling. Use `!important` only in a utilities layer, or to override third-party CSS you can't change, and leave a comment saying why.
2. **Put tokens in custom properties** (`--color-text`, `--space-3`) and define them on `:root` or on a component root. Components consume tokens; they don't hard-code raw values.
3. **Use modern layout:** flexbox for one dimension, grid for two, `gap` instead of margin hacks, `aspect-ratio`, and `display: flow-root` instead of clearfix. No floats for layout.
4. **Size things intrinsically and responsively:** `rem` for type, `min()`, `max()`, `clamp()`, `minmax()`, `fr`, and container queries for components. Use `dvh`/`svh` instead of `100vh` for full-height mobile layouts.
5. **Use logical properties** (`margin-inline`, `padding-block`, `inset-inline-start`, `inline-size`) so layouts work in RTL and vertical writing modes.
6. **Keep focus visible.** Never write `outline: none` without a `:focus-visible` replacement that has at least 3:1 contrast. Don't let sticky headers cover the focused element (`scroll-padding-top`).
7. **Respect user preferences:** `prefers-reduced-motion`, `prefers-color-scheme`, `forced-colors: active` (use system colors and don't rely on backgrounds), and zoom and text resizing (no fixed-height text containers).
8. **Check support before using a property.** Look for Baseline "Widely available" or "Newly available" on MDN. Use `@supports` for anything newer, with a fallback that still works. Skip vendor-prefixed properties unless MDN lists the prefix as still required.

## 6. The `style` attribute (CSS Style Attributes, W3C REC)

What the spec defines:
- The value is the **contents of a declaration block without braces**: `style="color: red; margin-block: 1rem"`. It can't contain selectors, pseudo-classes, pseudo-elements, at-rules, or media queries.
- The declarations apply only to that element, with author origin and **specificity higher than any selector**. Only `!important` declarations in stylesheets (or animations and transitions) override them.
- Parsing follows normal CSS error handling. Invalid declarations are dropped, and a stray `}` is just an invalid token.
- Relative URLs inside the value resolve against the element's document.
- An element should have only one `style` attribute.

Rules that follow from this:
- **Don't use `style=""` for static design.** It can't handle states (`:hover`, `:focus-visible`), responsiveness, or theming, and its specificity forces `!important` escalation everywhere else.
- **Use it for runtime per-instance values, and pass them as custom properties** that the stylesheet consumes. For example, `<div class="progress" style="--value: 42%">` with `.progress::after { inline-size: var(--value); }`. The stylesheet keeps control of presentation, and the attribute only carries data.
- A strict Content-Security-Policy (`style-src` without `'unsafe-inline'`) blocks `style` attributes in markup. Setting `element.style.setProperty()` from script is allowed under CSP (CSSOM), so prefer that for dynamic values in CSP-strict apps.
- Framework style bindings (`style={{…}}`, `:style`, `style:prop`) compile to the same attribute and follow the same rules.

## 7. Gotchas

- `<button>` inside a `<form>` defaults to `type="submit"`. Always set `type="button"` for buttons that don't submit.
- `<a>` without `href` isn't focusable and isn't a link. `href="#"` or `javascript:` combined with a click handler means you should use a `<button>`.
- `placeholder` isn't a label. It disappears on input, usually fails contrast, and not every screen reader announces it.
- `display: none` and `visibility: hidden` hide content from assistive technology too. Use a `.visually-hidden` utility for text that should only be read aloud. `aria-hidden="true"` hides content only from assistive technology.
- `title` isn't an accessible name you can rely on, and it doesn't show up on touch or for keyboard users.
- `z-index` only works inside the same stacking context. `transform`, `filter`, `opacity < 1`, `isolation`, `contain`, and `will-change` all create new ones.
- Flex children have `min-width: auto`, so long content overflows instead of shrinking. Add `min-width: 0` (or `min-inline-size: 0`) on the child.
- `100vh` on mobile includes the area behind browser UI. Use `100dvh` or `100svh`.
- Percent `height` needs a parent with a definite height. Percent `padding` and `margin` resolve against the containing block's *inline size*.
- Shorthands reset every longhand they cover. `background: red` clears a `background-image` set earlier, and `font:` resets `line-height`.
- A custom property with an invalid value becomes "invalid at computed-value time". The property falls back to `inherit` or `initial`, not to the previous declaration.
- `:focus` styles show on mouse click too. Use `:focus-visible` for focus rings.
- `list-style: none` removes list semantics in Safari/VoiceOver. Add `role="list"` when the list semantics matter (navigation, card lists).
- Positive `tabindex` values break the natural tab order. Use only `0` or `-1`.
- `<label>` click forwarding and `<button>` activation break if the "button" is a `<div>`. That's one more reason to use native elements.

## 8. Output expectations

- Valid, semantic HTML with the ARIA the task actually needs, explained when you use it.
- CSS organized in layers and component blocks, with tokens as custom properties, logical properties, and a visible focus style.
- Mention browser support for anything that isn't Baseline "Widely available", along with the fallback.
- When reviewing, order findings by impact: broken functionality or accessibility blockers → standards violations → maintainability (specificity, duplication) → performance → style. Propose the smallest fix.
- Don't add classes, wrappers, or abstractions that nothing uses. Don't rewrite working markup to match your personal taste.

## Reference map

| Read | When |
|---|---|
| `references/html-semantics.md` | Choosing elements, document structure, landmarks, headings, content model, images/media, tables, native interactive elements |
| `references/forms.md` | Any form: labels, input types, autocomplete, validation, error messages, grouping |
| `references/aria.md` | Custom widgets, accessible names, hiding content, live regions, APG keyboard patterns |
| `references/css-architecture.md` | Organizing CSS: layers, specificity, naming, tokens, resets, nesting, scoping, style attribute usage |
| `references/css-layout.md` | Flexbox vs grid, responsive and container queries, positioning, stacking contexts, overflow |
| `references/css-properties.md` | Choosing properties and units, modern replacements for old techniques, shorthand pitfalls, support checks |
| `references/debugging.md` | "My style isn't applied", layout or overflow bugs, z-index, accessibility-tree problems |
| `references/review-checklist.md` | Reviewing markup and CSS; WCAG 2.2 AA checks |
| `scripts/audit-html.mjs` | Heuristic scan before a review: `node scripts/audit-html.mjs <dir|file>` |
