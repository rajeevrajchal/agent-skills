# ARIA

ARIA (Accessible Rich Internet Applications) changes the **accessibility tree**: the roles, names, states, and properties that assistive technology reads. It doesn't change appearance, focusability, or keyboard behavior. Every piece of behavior an ARIA role promises must be built in script.

## Contents
- The five rules of ARIA use
- Decision procedure
- Accessible names
- Descriptions
- Hiding content
- States that must stay in sync
- Widget patterns (APG)
- Live regions
- Common misuse
- Testing

## The five rules of ARIA use (W3C "Using ARIA")

1. **Use native HTML** when an element or attribute already has the semantics and behavior.
2. **Don't change native semantics** unless you really have to. Write `<div role="tab"><h2>Title</h2></div>`, not `<h2 role="tab">`.
3. **All interactive ARIA controls must be keyboard operable**, using the key model from the APG pattern.
4. **Don't use `role="presentation"`/`"none"` or `aria-hidden="true"` on focusable elements.**
5. **All interactive elements must have an accessible name.**

"No ARIA is better than bad ARIA": WebAIM's survey found pages using ARIA averaged 41% more detected errors than pages without it.

## Decision procedure

1. Is there a native element? (`button`, `a`, `details`, `dialog`, `popover`, `select`, `input`, `progress`, `meter`, `output`, `nav`, `search`…) → use it. **Stop.**
2. Is there a native attribute? (`disabled`, `required`, `hidden`, `inert`, `open`, `checked`) → use it. **Stop.**
3. Is it a relationship or state that native HTML can't express? (`aria-expanded` on a disclosure button, `aria-current="page"` on the active nav link, `aria-controls`, `aria-describedby`, `aria-live`) → add that attribute only.
4. Is it a composite widget with no native equivalent (tabs, tree, grid, combobox, menu for app commands)? → follow the APG pattern completely: roles, states, keyboard model, and focus management. Budget time for testing.

## Accessible names

Computed in this priority order (simplified):
1. `aria-labelledby` (references visible text; can concatenate several ids)
2. `aria-label`
3. Native labelling: `<label>`, `alt`, `<caption>`, `<legend>`, `<figcaption>`, `<title>` in SVG
4. Text content (for roles that allow name from content: button, link, heading, tab, option…)
5. `title` attribute (last resort; unreliable)

Rules:
- Prefer visible text. The accessible name should contain the visible label text (WCAG 2.5.3).
- `aria-label` is **prohibited** on `generic` (plain `div`/`span`), `presentation`, `paragraph`, `code`, `strong`, `em`, and similar roles, and assistive technology ignores it there. Give the element a role, or use visually hidden text.
- Icon-only buttons: `<button type="button" aria-label="Close">` wrapping an `aria-hidden` SVG, or visually hidden text inside the button.
- Don't repeat the role in the name ("Close button" gets read as "Close button, button").
- Links need distinct names in context ("Read more about pricing", not five identical "Read more" links), or use `aria-describedby` / visually hidden text.

## Descriptions

`aria-describedby` adds supplementary text (hints, errors, format help). It's announced after the name and role. Keep it short. `aria-description` exists but is less supported; prefer `aria-describedby` pointing at visible text.

## Hiding content

| Technique | Visible? | In a11y tree? | Focusable? | Use for |
|---|---|---|---|---|
| `hidden` attribute / `display: none` | No | No | No | Content that isn't currently relevant at all |
| `visibility: hidden` | No (keeps its space) | No | No | Hidden while keeping layout; animations |
| `.visually-hidden` (clip pattern) | No | **Yes** | Yes, if focusable | Screen-reader-only labels and context |
| `aria-hidden="true"` | **Yes** | No | **Still focusable (bug!)** | Decorative icons, duplicated visual content |
| `inert` | Yes | No | No | Background content behind a modal, off-screen drawers |

```css
.visually-hidden:not(:focus):not(:active) {
  clip-path: inset(50%);
  block-size: 1px;
  inline-size: 1px;
  overflow: hidden;
  position: absolute;
  white-space: nowrap;
}
```
The `:not(:focus)` part lets skip links become visible when focused.

## States that must stay in sync

When ARIA exposes a state, script owns keeping it true:

| Attribute | On | Updated when |
|---|---|---|
| `aria-expanded` | The button controlling a disclosure, menu, or combobox | Open/close |
| `aria-selected` | `tab`, `option`, `gridcell` | Selection changes |
| `aria-checked` | `checkbox`, `radio`, `switch`, `menuitemcheckbox` (non-native) | Toggle |
| `aria-pressed` | A toggle `button` | Toggle (keep the label constant) |
| `aria-current` | The current item in a set: `page`, `step`, `date`, `location`, `true` | Navigation |
| `aria-disabled` | A focusable control that's unavailable but should stay discoverable | Availability changes; also block activation in script |
| `aria-invalid` | Form control | After validation |
| `aria-busy` | A region being updated | During loading |
| `aria-activedescendant` | A composite widget's focused container | Virtual focus moves |

Style from the ARIA state so visuals and semantics can't drift apart:
```css
.disclosure[aria-expanded="true"] .chevron { rotate: 180deg; }
.nav a[aria-current="page"] { font-weight: 700; }
```

## Widget patterns (APG)

Follow https://www.w3.org/WAI/ARIA/apg/patterns/ for the exact roles, states, and keyboard model. Summary:

| Pattern | Native first? | Key requirements |
|---|---|---|
| Disclosure (show/hide) | `<details>`, or `<button aria-expanded aria-controls>` | Enter/Space toggles |
| Accordion | `<details name>` group, or buttons inside headings | Each header is a `<button>` inside an `h*`; `aria-expanded` |
| Modal dialog | `<dialog>` + `showModal()` | Labelled; focus in; Esc closes; focus returns to the trigger |
| Tabs | None native | `tablist` > `tab` (`aria-selected`, `aria-controls`) + `tabpanel` (`aria-labelledby`). Arrow keys move between tabs (roving `tabindex`), Tab moves into the panel. Home/End |
| Menu button | For site navigation, use a disclosure with links, **not** `role="menu"` | `role="menu"` is for application-style command menus: `menuitem`s, arrow keys, Esc, typeahead |
| Combobox / autocomplete | `<input list>` + `<datalist>` for simple cases | `role="combobox"` on the input, `aria-expanded`, `aria-controls` → `listbox`, `aria-activedescendant`, arrows/Enter/Esc. Among the hardest patterns; test extensively |
| Listbox | `<select>` (customizable select where supported) | `option`s, `aria-selected`, arrows, typeahead |
| Switch | `<input type="checkbox" role="switch">` | `aria-checked` (native `checked` covers it on an input) |
| Tooltip | Often better as visible text or a toggletip (button + popover) | `role="tooltip"`, shown on hover **and** focus, dismissable with Esc, hoverable (WCAG 1.4.13). Never put essential info only in a tooltip |
| Carousel | Avoid if possible | Pause control, labelled slides, no auto-advance without a pause |
| Breadcrumb | `<nav aria-label="Breadcrumb"><ol>` | `aria-current="page"` on the last item |
| Feed / infinite scroll | Provide a "Load more" button as the fallback | `role="feed"`, `article`s, `aria-busy` |

**Roving tabindex**: in composite widgets (tabs, toolbar, grid), only one item has `tabindex="0"` and the rest have `-1`. Arrow keys move focus and swap the values. Tab leaves the widget.

## Live regions

- `role="status"` (polite; implies `aria-live="polite"`, `aria-atomic="true"`) for "Saved", "3 results", "Loading…".
- `role="alert"` (assertive) only for urgent, time-sensitive errors. It interrupts the user.
- The region element must exist in the DOM **before** you change its text. Inserting a new element that already contains text is often not announced.
- Change the text content. Don't toggle `display` on it.
- Keep messages short. Don't announce every keystroke; debounce search-result counts.
- `aria-live="off"` plus a manual update is sometimes better than chatty regions.

## Common misuse

- `<div role="button">` without `tabindex="0"` and Enter/Space handling. Just use `<button>`.
- `role="menu"` on site navigation. Screen readers switch into application mode and users expect arrow-key menus.
- `aria-label` overriding good visible text, or used on non-interactive `div`s.
- `aria-hidden="true"` on a container that has focusable children.
- `role="presentation"` on a table that has headers.
- Redundant roles (`<button role="button">`, `<ul role="list">` except as the Safari list-style fix).
- `aria-required` on native inputs that already have `required` (redundant but harmless). `aria-disabled` without blocking activation (harmful).
- Invalid or misspelled attributes (`aria-labeledby`, one "l"). Assistive technology silently ignores them.
- Using `aria-live` on large regions that re-render entirely.

## Testing

1. **Browser accessibility tree** (Chrome/Firefox DevTools → Accessibility panel). Check role, name, and state for each control.
2. **Keyboard only.** Tab, Shift+Tab, Enter, Space, arrows, and Esc across every interactive element. Focus is always visible and never trapped (except in a modal).
3. **Screen readers.** At minimum NVDA + Firefox or Chrome (Windows), VoiceOver + Safari (macOS/iOS), and TalkBack + Chrome (Android) for mobile-heavy products.
4. **Automated tools** (axe DevTools, Lighthouse, the WAVE extension) catch roughly a third of issues. They're a floor, not a pass.
