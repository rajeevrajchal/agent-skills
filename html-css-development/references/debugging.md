# Debugging HTML & CSS

Diagnose before changing things. Work through the steps in order and stop at the first one that explains the problem. Report the failing step, the evidence, and the fix. Never "fix" by adding `!important`, raising specificity, or adding magic numbers until you know why the original rule lost.

## A. "My style isn't applied"

1. **Does the selector match?** In DevTools, select the element and check the Styles pane. If the rule isn't listed, the selector doesn't match: a typo, the wrong class, framework scoping (Svelte/Vue scoped styles don't reach child components; use `:global()` or `:deep()` deliberately), or the element is rendered by a different component.
2. **Is the stylesheet loaded?** Check the Network panel and the order of `<link>` tags. With CSS-in-JS or modules, check that the import actually ran.
3. **Is the declaration struck through?** Then it lost the cascade. Check, in this order:
   - A `style` attribute or framework style binding on the element (inline beats every selector).
   - **Layer**: is the losing rule in an earlier layer, or is the winner unlayered?
   - **Specificity**: compare the (id, class, type) triples.
   - **Order**: same layer and specificity, so the later one wins.
   - `!important` somewhere.
4. **Is the declaration invalid?** A yellow warning icon means an invalid value or an unsupported property. Check the syntax on MDN. For custom properties, open the Computed pane: an invalid `var()` result falls back to `inherit`/`initial` ("invalid at computed-value time").
5. **Is it applied but has no effect?** The property needs a precondition:
   - `z-index` needs a positioned element (or a flex/grid item) and only works within its stacking context (see C).
   - `width`/`height` on inline elements → change `display`.
   - `transform` on an inline element → `display: inline-block`.
   - Percent `height` → the parent needs a definite height.
   - `position: sticky` → an ancestor has `overflow` set, or no `top`/`inset` value is given.
   - `gap`/`justify-content` → the parent isn't flex/grid.
   - `text-overflow: ellipsis` → needs `overflow: hidden` + `white-space: nowrap` + a constrained width (and `min-inline-size: 0` in flex).
   - `vertical-align` → only affects inline and table-cell boxes.
   - A property inherited from somewhere else overrides a value you expected to inherit.
6. **Is a shorthand resetting it?** A later `background:`/`font:`/`transition:` resets the longhand you set.

## B. Layout and overflow bugs

1. Outline everything temporarily: `* { outline: 1px solid rgb(255 0 0 / 0.4); }`. Or use the DevTools flex/grid overlays.
2. **Horizontal scroll on the page**: find the widest element (Console: `[...document.querySelectorAll("*")].filter(e => e.scrollWidth > document.documentElement.clientWidth)`). Usual culprits: a fixed `width` in px, `100vw` (it includes the scrollbar), long unbreakable strings, images without `max-inline-size: 100%`, or grid `1fr` tracks that need `minmax(0, 1fr)`.
3. **Flex item won't shrink**: `min-width: auto` → add `min-inline-size: 0`.
4. **Unexpected gap above or below**: margin collapse between parent and child (fix with `display: flow-root`, padding, or flex/grid on the parent), or inline image baseline space (`display: block` on the image).
5. **Content overlapping**: absolute positioning taking content out of flow, negative margins, or fixed heights with growing content.
6. **Works at one width, breaks at another**: check media and container query ranges for overlaps or gaps. Does the container actually have `container-type`?
7. **Layout shift**: images and iframes without dimensions, late-loading fonts without fallback metrics, content injected above existing content.

## C. z-index and "stuck inside" problems

1. Find the stacking context of both elements. In DevTools, check the Layers panel, or walk up the ancestors looking for `opacity < 1`, `transform`, `filter`, `isolation`, `z-index` on positioned or flex/grid items, `position: fixed/sticky`, `contain`, and `will-change`.
2. Elements in different contexts compare by their **context roots' z-index**, not their own.
3. Fix at the right level: move the element (portal it to the body), use the top layer (`<dialog>`, `popover`), or remove the property creating the unwanted context. Don't raise to `z-index: 99999`.
4. `position: fixed` element scrolling with a container → an ancestor has `transform`/`filter`/`contain`/`will-change` and has become its containing block.

## D. Accessibility-tree problems

1. Open DevTools → Accessibility (Chrome: enable the full-page accessibility tree). Check the **role**, **name**, and **states** of the control.
2. **Name missing or wrong**: follow the name computation order (`aria-labelledby` → `aria-label` → native label → content → `title`). Is an `aria-labelledby` id misspelled or pointing at a hidden element? Is `aria-label` on a generic element, where it gets ignored?
3. **Element missing from the tree**: `display: none`, `visibility: hidden`, `hidden`, `aria-hidden` on an ancestor, or `inert`.
4. **Wrong role**: redundant or overridden roles, or `role="presentation"` removing semantics. A `<ul>` with `list-style: none` shows as no list in Safari.
5. **Keyboard problems**: not focusable (a `div` with a click handler, `<a>` without `href`), focus lost after DOM changes (the element was removed; move focus deliberately), a focus trap without an escape, or tab order different from visual order (CSS reordering or positive `tabindex`).
6. **Announcements missing**: the live region was added together with its text (it must exist first), or `display` was toggled instead of the text changing.

## E. HTML parsing surprises

- Styles or DOM look wrong around a `<p>` → the parser auto-closed the `<p>` because a block element appeared inside it. View the DOM (not the source) to confirm.
- A table's content is rendered outside the table → invalid children were moved out ("foster parenting").
- Duplicate `id`s → `label for`, `aria-*`, and fragment links go to the first match only.
- Run the W3C Nu HTML Checker (https://validator.w3.org/nu/) for parser-level errors.
