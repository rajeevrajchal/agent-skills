# HTML & CSS Review Checklist

Order findings by impact: **functional or accessibility blockers → standards violations → maintainability → performance → style**. For each finding give the location, the problem, the consequence, and the smallest fix. Don't rewrite working code for taste.

Optional first pass: `node scripts/audit-html.mjs <dir>` for heuristic leads. Verify each one before reporting it. Automated checks find a minority of real issues.

## HTML structure & semantics

- [ ] `lang` on `<html>`, `charset`, a viewport without zoom restrictions, a unique `<title>`.
- [ ] One `<main>`; landmarks labelled when repeated; a skip link to main content.
- [ ] Heading outline is logical, with no skipped levels on the way down; headings aren't chosen for size.
- [ ] Links navigate and buttons act; no clickable `div`/`span`; no `href="#"` buttons.
- [ ] Lists, tables, `dl`, `figure`, and `time` are used where the content is that thing.
- [ ] Content model respected: no interactive elements nested in interactive elements, no blocks in `<p>`, only valid children in lists and tables.
- [ ] Unique `id`s; `for`/`aria-*` references resolve.
- [ ] No obsolete or presentational elements and attributes.
- [ ] Native elements used where available (`dialog`, `details`, `popover`, `progress`).

## Images & media

- [ ] `alt` text fits the image's purpose (informative, functional, or decorative `alt=""`).
- [ ] `width`/`height` set; responsive `srcset`/`sizes` where it matters; the LCP image isn't lazy-loaded.
- [ ] Decorative SVGs are `aria-hidden`; meaningful SVGs have a role and a name.
- [ ] Video has captions; autoplay content can be paused.
- [ ] `iframe`s have a `title`.

## Forms

- [ ] Every control has a visible, programmatic label; groups use `fieldset`/`legend`.
- [ ] Correct `type`, `autocomplete`, and `inputmode`.
- [ ] Errors are text (not color only), linked with `aria-describedby`, shown after interaction, with focus managed on submit.
- [ ] Buttons have an explicit `type`.

## ARIA

- [ ] ARIA only where native HTML can't express it (first rule).
- [ ] All roles and `aria-*` attributes are valid and allowed on that role; no redundant roles.
- [ ] Custom widgets follow the APG keyboard model; states (`aria-expanded`, `aria-selected`, …) stay in sync.
- [ ] No `aria-hidden` or `role="presentation"` on focusable content or its ancestors.
- [ ] Every interactive element has an accessible name that includes its visible label.
- [ ] Live regions exist before updates; `alert` is used sparingly.

## Keyboard & focus (WCAG 2.1.1, 2.4.3, 2.4.7, 2.4.11)

- [ ] Everything interactive can be reached and operated with the keyboard.
- [ ] Focus order matches visual and reading order; no positive `tabindex`.
- [ ] Focus is always visible (`:focus-visible` with 3:1 contrast), never removed without a replacement.
- [ ] Focus isn't hidden under sticky headers or footers (`scroll-padding`).
- [ ] Modals trap focus and restore it on close; no other keyboard traps.

## Visual accessibility (WCAG 1.4.x, 2.5.8)

- [ ] Text contrast is at least 4.5:1 (large text 3:1); UI component and focus contrast at least 3:1.
- [ ] Information isn't conveyed by color alone.
- [ ] Reflows at 320 CSS px without horizontal scrolling (except tables, maps, and code).
- [ ] Text zooms to 200% and survives text-spacing overrides; no fixed-height text boxes.
- [ ] Targets are at least 24×24 CSS px.
- [ ] Works in forced-colors mode; respects `prefers-reduced-motion`.

## CSS architecture

- [ ] Cascade organized with `@layer` or a clear order; third-party CSS contained.
- [ ] Low, flat specificity; no ID selectors; `!important` only in utilities or documented overrides.
- [ ] Tokens (custom properties) instead of repeated raw values; semantic token names.
- [ ] Components don't set their own outer margins or placement.
- [ ] `style=""` used only for per-instance data (preferably as custom properties), never for static design.
- [ ] Logical properties used; no RTL-hostile physical offsets without reason.
- [ ] Modern layout (grid/flex/gap); no float layouts or clearfix.
- [ ] Nesting kept shallow.

## CSS correctness & support

- [ ] Properties and values valid (MDN); no guessed keywords.
- [ ] Features beyond Baseline "Widely available" have a fallback or `@supports`.
- [ ] No vendor-prefixed properties unless required.
- [ ] Shorthands don't silently reset earlier longhands.
- [ ] Visual order matches DOM order (no meaningful reordering with `order` or `grid-area`).

## Performance

- [ ] No layout-triggering animations (width, height, top, left); transitions list specific properties.
- [ ] Fonts: WOFF2, `font-display`, critical fonts preloaded, fallback metrics set.
- [ ] No unused large CSS; no huge DOM of wrapper divs.
- [ ] Images sized and lazy-loaded appropriately.

## Output format

```md
### [Severity: High | Medium | Low] <short title>
**Where:** `path/file.html:42`
**Problem:** <what is wrong, citing the rule (e.g. "WCAG 2.4.7", "first rule of ARIA", "MDN: <p> permitted content")>
**Consequence:** <who is affected and how>
**Fix:** <smallest change, with a code snippet if short>
```
End with a one-line overall assessment.
