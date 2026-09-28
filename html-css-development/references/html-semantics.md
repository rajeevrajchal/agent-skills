# HTML Semantics

## Contents
- Document skeleton
- Landmarks
- Headings and outline
- Choosing the element
- Content model (what may nest in what)
- Text-level semantics
- Images and media
- Tables
- Native interactive elements
- Global attributes worth knowing
- Performance-related markup

## Document skeleton

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Order history – Acme</title>          <!-- page-specific first, site name last -->
  <meta name="description" content="…">
  <link rel="stylesheet" href="/styles.css">
  <script type="module" src="/app.js"></script> <!-- modules are deferred by default -->
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header>…<nav aria-label="Primary">…</nav></header>
  <main id="main">…</main>
  <footer>…</footer>
</body>
</html>
```

- `charset` must be within the first 1024 bytes.
- Never use `user-scalable=no` or `maximum-scale=1`. Disabling zoom fails WCAG 1.4.4.
- Set `lang` on `<html>`. Mark passages in another language with `lang` on that element.

## Landmarks

| Element | Implicit role | Notes |
|---|---|---|
| `<header>` | `banner` | Only when it's not inside `article`/`aside`/`main`/`nav`/`section` |
| `<nav>` | `navigation` | Major navigation blocks only. Give each one a label (`aria-label="Primary"`, `"Breadcrumb"`) when there are several |
| `<main>` | `main` | Exactly one visible `<main>` per page |
| `<aside>` | `complementary` | Tangential content |
| `<footer>` | `contentinfo` | Only when it's not inside sectioning content |
| `<section>` | `region` | Only when it has an accessible name (`aria-labelledby` pointing at its heading) |
| `<form>` | `form` | Only when it has an accessible name |
| `<search>` | `search` | Wraps search forms and filters |

Don't write `role="navigation"` on `<nav>` or `role="main"` on `<main>`. Those roles are redundant.

## Headings and outline

- One `<h1>` for the page topic. Nested sections use `h2`–`h6` **without skipping levels** on the way down. Going back up by any amount is fine.
- Headings describe the section that follows them. Don't choose a heading level for its font size; style it with CSS.
- `<section>` and `<article>` don't reset heading levels. The document outline algorithm was never implemented by browsers or screen readers.
- `<hgroup>` groups a heading with subtitle or tagline paragraphs.
- Card titles in a list are usually headings (`h3` under a section `h2`) so screen-reader users can jump between them.

## Choosing the element

| Need | Use | Not |
|---|---|---|
| Go to another page or anchor | `<a href>` | `<button onclick="location=…">`, `<span onclick>` |
| Perform an action | `<button type="button">` | `<a href="#">`, `<div onclick>` |
| Submit a form | `<button type="submit">` | `<input type="button">` + JS |
| Self-contained, redistributable item (post, card, comment) | `<article>` | `<div class="card">` |
| Thematic group with a heading | `<section aria-labelledby>` | `<div>` with a heading |
| Grouping for styling only | `<div>` | `<section>` |
| List of items (nav links, cards, steps) | `<ul>`/`<ol>` + `<li>` | stacked `<div>`s |
| Name/value pairs | `<dl>`, `<dt>`, `<dd>` | table or divs |
| Figure with caption | `<figure>` + `<figcaption>` | `<div>` + `<p class="caption">` |
| Quote | `<blockquote cite>` / `<q>` | italic `<p>` |
| Date/time | `<time datetime="2026-09-28">` | plain text |
| Contact info for the nearest article/body | `<address>` | — |
| Expand/collapse | `<details>` + `<summary>` | custom div toggle |
| Modal | `<dialog>` + `showModal()` | `div.modal` + focus-trap library |
| Non-modal popup (menu, tooltip-ish panel) | `popover` attribute + `popovertarget` | hand-rolled toggling |
| Progress / gauge | `<progress>` / `<meter>` | `div role="progressbar"` |
| Line break that belongs to the content (poems, addresses) | `<br>` | `<br>` for spacing |
| Thematic break | `<hr>` | border-only div |

## Content model (what may nest in what)

Check each element's **Permitted content** and **Permitted parents** on MDN. The most frequently broken rules:

- `<p>` contains only phrasing content. It can't hold `<div>`, `<ul>`, headings, or another `<p>`. The parser closes the `<p>` early, which silently breaks your CSS.
- `<a>` may contain flow content (a whole card), but **no interactive descendants**: no nested links, buttons, or inputs.
- `<button>` contains phrasing content only, with no interactive descendants.
- `<ul>`/`<ol>` contain only `<li>` (plus script-supporting elements). `<dl>` contains `<dt>`/`<dd>` groups, optionally wrapped in a `<div>`.
- `<label>` holds at most one labelable control, and never another `<label>`.
- `<table>` → `<caption>`?, `<colgroup>`*, `<thead>`?, `<tbody>`*, `<tfoot>`?. Rows go inside those groups.
- `<summary>` must be the first child of `<details>`.
- Headings go inside `<summary>`, never the other way round.

A card that links somewhere, with a secondary button inside, can't wrap the whole card in `<a>`. Link the title instead and stretch its click area with a `::after` overlay (`position: absolute; inset: 0`), and raise the secondary button above it with `position: relative; z-index: 1`.

## Text-level semantics

- `<strong>` means importance, `<em>` means stress emphasis. `<b>` and `<i>` carry no importance: use them for keywords, and for foreign terms together with `lang`.
- `<mark>` highlights relevance (search matches), `<small>` is for side comments or fine print, `<s>` marks content that's no longer accurate, and `<del>`/`<ins>` mark edits.
- `<abbr title>` for abbreviations: expand on first use in the text too, since `title` isn't reliably exposed.
- `<code>`, `<kbd>`, `<samp>`, `<var>`, `<pre>` for technical content.
- `<dfn>` for the defining instance of a term.

## Images and media

**alt decision:**
1. Conveys information → `alt` states the information ("Revenue up 12% since Q2", not "chart").
2. Is a link or button's only content → `alt` describes the destination or action ("Home", "Search").
3. Decorative or duplicated by adjacent text → `alt=""` (and consider a CSS background instead).
4. Complex (charts, diagrams) → short `alt` plus a longer description nearby or in `<figcaption>`.
Never start alt text with "image of".

**Responsive images:**
```html
<img
  src="/img/hero-800.jpg"
  srcset="/img/hero-400.jpg 400w, /img/hero-800.jpg 800w, /img/hero-1600.jpg 1600w"
  sizes="(min-width: 64rem) 50vw, 100vw"
  width="1600" height="900"
  alt="…"
  loading="lazy" decoding="async">
```
- `width`/`height` let the browser reserve space via the aspect ratio, which prevents layout shift. CSS `max-inline-size: 100%; block-size: auto;` keeps the image responsive.
- `<picture>` + `<source media>` for art direction (a different crop per breakpoint). `<source type="image/avif">` for format fallback.
- **Don't lazy-load the LCP image** (usually the hero). Add `fetchpriority="high"` to it instead.
- Inline `<svg>` icons: decorative → `aria-hidden="true" focusable="false"`. Meaningful → `role="img"` plus `<title>` or `aria-label`.

**Video/audio:** `<video controls>` with `<track kind="captions">`. Avoid autoplay with sound; muted autoplay loops longer than 5s need a pause control. Add `playsinline` for inline iOS playback.

**`<iframe>`:** always add a `title`, `loading="lazy"` when below the fold, and a `sandbox` attribute for untrusted content.

## Tables

Use tables for tabular data only, never for layout.
```html
<table>
  <caption>Orders, September 2026</caption>
  <thead>
    <tr><th scope="col">Order</th><th scope="col">Date</th><th scope="col">Total</th></tr>
  </thead>
  <tbody>
    <tr><th scope="row">#1042</th><td><time datetime="2026-09-12">12 Sep</time></td><td>€84.00</td></tr>
  </tbody>
</table>
```
- `<caption>` names the table. `scope` on `<th>` identifies header direction. Complex multi-level headers use `id`/`headers`.
- For responsive tables, wrap in a scroll container: `<div class="table-scroll" role="region" aria-labelledby="cap-id" tabindex="0">` so keyboard users can scroll it. Don't change `display` on table elements (this can strip table semantics in some browsers).
- Sortable columns: put a `<button>` inside the `<th>` and `aria-sort` on the `<th>`.

## Native interactive elements

**`<dialog>`**
```html
<dialog id="confirm" aria-labelledby="confirm-title">
  <h2 id="confirm-title">Delete project?</h2>
  <form method="dialog">
    <button value="cancel">Cancel</button>
    <button value="delete">Delete</button>
  </form>
</dialog>
```
- `showModal()` gives you a focus trap, Esc to close, `inert` on the rest of the page, the top layer, and `::backdrop`. `show()` is non-modal.
- `<form method="dialog">` closes the dialog and sets `returnValue`. Return focus to the invoking control on close. Browsers do this for `showModal()`, but verify it in your framework.
- Put `autofocus` on the element that should receive focus first.
- The declarative `command`/`commandfor` attributes on buttons can open dialogs without script. Check Baseline status before relying on them.

**`popover`**
```html
<button popovertarget="menu">Options</button>
<div id="menu" popover>…</div>
```
Top layer, light dismiss, and Esc for free. `popover="manual"` turns off light dismiss. Pair it with CSS anchor positioning where supported, with a fallback. A popover isn't modal; use `<dialog>` for modal content.

**`<details>`/`<summary>`**: a disclosure with no JavaScript. `name="group"` on several `<details>` makes an exclusive accordion. Keep the `summary` text concise, and don't put interactive content inside `<summary>`.

## Global attributes worth knowing

- `hidden` removes content from rendering and the accessibility tree. `hidden="until-found"` keeps it findable by find-in-page (where supported).
- `inert` makes a subtree non-interactive and hides it from assistive technology. Use it for off-screen drawers and background content.
- `tabindex="0"` adds a custom widget to the tab order. `tabindex="-1"` makes an element focusable by script only. Never use positive values.
- `data-*` for script and style hooks that carry data. Don't store presentation in them.
- `dir="auto"` for user-generated text of unknown direction.
- `translate="no"` for brand names and code.
- `enterkeyhint` and `inputmode` to tune virtual keyboards.
- `autocapitalize` and `spellcheck` for text inputs.

## Performance-related markup

- `<link rel="preload" as="font" type="font/woff2" crossorigin>` only for critical fonts. `preconnect` to critical third-party origins.
- Use `defer` or `type="module"` for scripts in `<head>`. Avoid parser-blocking scripts.
- `loading="lazy"` for below-the-fold images and iframes.
- Keep the DOM lean. Excess wrapper `<div>`s cost layout time and make CSS harder.
