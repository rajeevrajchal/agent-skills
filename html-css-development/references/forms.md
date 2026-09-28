# Forms

## Contents
- Labelling
- Grouping
- Input types, autocomplete, keyboards
- Required, help text, and errors
- Native validation
- Buttons
- Custom controls
- Checklist

## Labelling

Every control needs a programmatic label. In order of preference:

```html
<!-- 1. Explicit -->
<label for="email">Email</label>
<input id="email" name="email" type="email" autocomplete="email">

<!-- 2. Implicit (wrapping) -->
<label><input type="checkbox" name="terms"> I accept the terms</label>

<!-- 3. Visible text elsewhere -->
<input aria-labelledby="qty-heading" …>

<!-- 4. Last resort: no visible label possible (search box with icon button) -->
<input type="search" aria-label="Search products">
```

- Labels stay visible. `placeholder` is only for example formats, never the label.
- A visible label and an `aria-label` must match, or the `aria-label` must at least start with the visible text (WCAG 2.5.3 Label in Name, for voice control users).
- Click on a label → focuses or toggles the control. This only works with native controls.

## Grouping

Radio groups, checkbox groups, and composite fields (date parts, address) use `<fieldset>` + `<legend>`:

```html
<fieldset>
  <legend>Delivery speed</legend>
  <label><input type="radio" name="speed" value="standard" checked> Standard</label>
  <label><input type="radio" name="speed" value="express"> Express</label>
</fieldset>
```
Reset the fieldset's default look with CSS (`border: 0; padding: 0; margin: 0; min-inline-size: 0;`), not by swapping it for a `<div>`.

## Input types, autocomplete, keyboards

| Data | Markup |
|---|---|
| Email | `type="email" autocomplete="email"` |
| Phone | `type="tel" autocomplete="tel"` |
| Name | `type="text" autocomplete="name"` (or `given-name`, `family-name`) |
| New password | `type="password" autocomplete="new-password"` |
| Current password | `type="password" autocomplete="current-password"` |
| One-time code | `inputmode="numeric" autocomplete="one-time-code"` |
| Postal code | `type="text" autocomplete="postal-code"` (not `number`: codes have leading zeros and letters) |
| Card number | `inputmode="numeric" autocomplete="cc-number"` (not `type="number"`) |
| Quantity / true numbers | `type="number" min max step` |
| Date | `type="date"` (native picker), or three labelled fields for memorable dates like date of birth |
| Search | `type="search"` inside `<search>` or `<form role="search">` |
| URL | `type="url" autocomplete="url"` |

- `type="number"` is only for values you'd do arithmetic on. It has scroll-wheel and spinner quirks and drops leading zeros.
- `autocomplete` tokens are standardized (see MDN "HTML attribute: autocomplete"). Using them satisfies WCAG 1.3.5 Identify Input Purpose.
- `enterkeyhint="search|send|next|done"` tunes the mobile Enter key.

## Required, help text, and errors

```html
<label for="pw">Password <span aria-hidden="true">*</span></label>
<input id="pw" name="pw" type="password" required minlength="12"
       autocomplete="new-password"
       aria-describedby="pw-hint pw-error"
       aria-invalid="true">
<p id="pw-hint" class="hint">At least 12 characters.</p>
<p id="pw-error" class="error">Password must be at least 12 characters.</p>
```

- `required` is announced automatically. The visual `*` is `aria-hidden` and explained once at the top of the form ("* required").
- Hints and errors are linked with `aria-describedby`. Error text says what's wrong **and** how to fix it.
- Set `aria-invalid="true"` only after validation fails, not on page load.
- Show errors after the user has interacted: use `:user-invalid` (Baseline 2023), not `:invalid`, which matches empty required fields on load.
- On submit with errors: move focus to an error summary at the top (a list of links to each field), or to the first invalid field. Also announce the errors in a live region if the page doesn't reload.
- Don't rely on color alone. Pair the red border with an icon and text.

## Native validation

Use native constraints (`required`, `type`, `min`/`max`, `minlength`/`maxlength`, `pattern`, `step`) as the single source of rules. For custom error UI:

```ts
form.noValidate = true; // suppress native bubbles, keep the constraint API
form.addEventListener("submit", (e) => {
  if (!form.checkValidity()) {
    e.preventDefault();
    for (const el of form.elements) {
      if (el instanceof HTMLInputElement && !el.validity.valid) renderError(el, el.validationMessage);
    }
    focusFirstInvalid(form);
  }
});
```

`setCustomValidity("message")` for rules the attributes can't express (password confirmation). Reset it with `setCustomValidity("")` on input.

Server-side validation is always required. Client-side validation is a UX aid, not security.

## Buttons

- `<button type="submit">` submits, `type="button"` does nothing by default, and `type="reset"` is rarely wanted.
- Button text says the outcome ("Create account", not "Submit").
- Disabled submit buttons hide the reason and aren't focusable. Prefer keeping the button enabled and showing validation errors. If you must disable it, explain why in visible text.
- While submitting, keep the button focusable, add `aria-disabled="true"`, block repeat clicks in script, and announce progress through `role="status"`.

## Custom controls

Before building a custom select, checkbox, or toggle:
- Style native controls first: `accent-color`, `appearance: none` plus custom styles on checkboxes and radios (keep the `<input>`), and `field-sizing: content` where supported.
- Customizable `<select>` (`appearance: base-select`) is arriving in browsers. Check Baseline status; use it as progressive enhancement.
- A toggle switch is `<button type="button" role="switch" aria-checked="false">`, or `<input type="checkbox" role="switch">`.
- If a custom listbox or combobox is truly needed, follow the APG pattern exactly (`references/aria.md`). Budget for full keyboard support and testing with real screen readers.

## Checklist

- [ ] Every control has a visible, programmatic label.
- [ ] Groups use `fieldset`/`legend`.
- [ ] Correct `type`, `autocomplete`, and `inputmode`.
- [ ] Hints and errors linked with `aria-describedby`. Errors say how to fix the problem.
- [ ] Errors shown after interaction, focus managed on submit, not color-only.
- [ ] Buttons have explicit `type` and outcome-describing text.
- [ ] The form works with keyboard only, and with autofill and password managers.
- [ ] Targets are at least 24×24 CSS px (WCAG 2.5.8).
