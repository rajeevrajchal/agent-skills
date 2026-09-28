#!/usr/bin/env node
// Heuristic HTML/CSS/ARIA audit. Findings are leads to verify, not verdicts.
// Scans .html/.htm/.svelte/.vue/.astro/.jsx/.tsx/.css/.scss files.
// Usage: node scripts/audit-html.mjs <dir|file> [--json]
// No dependencies. Node 18+.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const MARKUP_EXTS = new Set([".html", ".htm", ".svelte", ".vue", ".astro", ".jsx", ".tsx"]);
const CSS_EXTS = new Set([".css", ".scss", ".pcss"]);
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", ".nuxt", ".svelte-kit", ".output", "coverage", ".turbo", ".vercel", "vendor"]);

const VALID_ARIA = new Set(`activedescendant atomic autocomplete braillelabel brailleroledescription busy checked colcount colindex colindextext colspan controls current describedby description details disabled dropeffect errormessage expanded flowto grabbed haspopup hidden invalid keyshortcuts label labelledby level live modal multiline multiselectable orientation owns placeholder posinset pressed readonly relevant required roledescription rowcount rowindex rowindextext rowspan selected setsize sort valuemax valuemin valuenow valuetext`.split(/\s+/).map((a) => `aria-${a}`));

const VALID_ROLES = new Set(`alert alertdialog application article banner blockquote button caption cell checkbox code columnheader combobox comment complementary contentinfo definition deletion dialog directory document emphasis feed figure form generic grid gridcell group heading img image insertion link list listbox listitem log main mark marquee math menu menubar menuitem menuitemcheckbox menuitemradio meter navigation none note option paragraph presentation progressbar radio radiogroup region row rowgroup rowheader scrollbar search searchbox separator slider spinbutton status strong subscript suggestion superscript switch tab table tablist tabpanel term textbox time timer toolbar tooltip tree treegrid treeitem`.split(/\s+/));

const IMPLICIT_ROLE = {
  nav: "navigation", main: "main", button: "button", li: "listitem", aside: "complementary",
  table: "table", article: "article", dialog: "dialog", search: "search", progress: "progressbar",
  hr: "separator", h1: "heading", h2: "heading", h3: "heading", h4: "heading", h5: "heading", h6: "heading",
  select: "combobox", textarea: "textbox", details: "group", figure: "figure", form: "form",
};

const OBSOLETE_ELEMENTS = new Set(["center", "font", "marquee", "blink", "big", "strike", "tt", "frame", "frameset", "acronym", "basefont", "applet", "dir"]);
const OBSOLETE_ATTRS = ["align", "bgcolor", "valign", "cellpadding", "cellspacing", "hspace", "vspace", "frameborder", "marginwidth", "marginheight"];
const INTERACTIVE = new Set(["a", "button", "input", "select", "textarea", "details", "summary", "iframe", "label", "audio", "video", "embed"]);
const NON_INTERACTIVE_CLICK_TARGETS = new Set(["div", "span", "li", "p", "section", "article", "img", "td", "tr", "i", "svg", "header", "footer", "main", "ul", "h1", "h2", "h3", "h4", "h5", "h6"]);
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const PREFIX_ALLOW = new Set(["-webkit-line-clamp", "-webkit-box-orient", "-webkit-text-stroke", "-webkit-text-stroke-width", "-webkit-text-stroke-color", "-webkit-text-fill-color", "-webkit-tap-highlight-color", "-webkit-font-smoothing", "-moz-osx-font-smoothing", "-webkit-appearance", "-webkit-backdrop-filter", "-webkit-mask", "-webkit-mask-image", "-webkit-user-select", "-webkit-background-clip"]);

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const target = args.find((a) => !a.startsWith("--"));
if (!target) { console.error("Usage: node audit-html.mjs <dir|file> [--json]"); process.exit(2); }
const root = resolve(target);
let base;
try { base = statSync(root).isDirectory() ? root : dirname(root); } catch { console.error(`Not found: ${root}`); process.exit(2); }

function walk(path, out) {
  let st;
  try { st = statSync(path); } catch { return out; }
  if (st.isDirectory()) {
    for (const name of readdirSync(path)) if (!SKIP_DIRS.has(name)) walk(join(path, name), out);
  } else {
    const ext = extname(path);
    if (MARKUP_EXTS.has(ext) || CSS_EXTS.has(ext)) out.push(path);
  }
  return out;
}

function lineAt(src, idx) {
  let n = 1;
  for (let i = 0; i < idx && i < src.length; i++) if (src.charCodeAt(i) === 10) n++;
  return n;
}

// ---------- markup tokenizer ----------
// Returns tags: { name, closing, selfClosing, attrs: Map<lowerName, {raw, value, dynamic}>, index }
function tokenize(src, isJsLike) {
  const tags = [];
  const styleBlocks = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const lt = src.indexOf("<", i);
    if (lt === -1) break;
    if (src.startsWith("<!--", lt)) { const end = src.indexOf("-->", lt + 4); i = end === -1 ? n : end + 3; continue; }
    let j = lt + 1;
    let closing = false;
    if (src[j] === "/") { closing = true; j++; }
    const m = /^[a-zA-Z][\w.:-]*/.exec(src.slice(j, j + 64));
    if (!m) { i = lt + 1; continue; }
    const rawName = m[0];
    j += rawName.length;
    // parse attributes until '>' outside quotes/braces
    const attrs = new Map();
    let selfClosing = false;
    let ok = false;
    while (j < n) {
      while (j < n && /\s/.test(src[j])) j++;
      if (src[j] === ">") { ok = true; j++; break; }
      if (src[j] === "/" && src[j + 1] === ">") { selfClosing = true; ok = true; j += 2; break; }
      if (src[j] === "{") { // JSX spread {...props} or svelte {attr}
        const end = matchBrace(src, j); if (end === -1) break;
        const inner = src.slice(j + 1, end).trim();
        if (inner.startsWith("...")) attrs.set("{...", { raw: inner, value: "", dynamic: true });
        else if (/^[a-zA-Z_$][\w$]*$/.test(inner)) attrs.set(inner.toLowerCase(), { raw: inner, value: "", dynamic: true });
        j = end + 1; continue;
      }
      const am = /^[^\s=>\/"'{}]+/.exec(src.slice(j, j + 128));
      if (!am) break;
      const aname = am[0];
      j += aname.length;
      while (j < n && /\s/.test(src[j])) j++;
      let value = "";
      let dynamic = false;
      let present = true;
      if (src[j] === "=") {
        j++;
        while (j < n && /\s/.test(src[j])) j++;
        const q = src[j];
        if (q === '"' || q === "'") {
          const end = src.indexOf(q, j + 1); if (end === -1) break;
          value = src.slice(j + 1, end); j = end + 1;
          if (/[{]/.test(value) && !isJsLike) dynamic = /\{[^}]*\}/.test(value); // svelte/vue/astro interpolation
          if (/^\s*\{\{.*\}\}\s*$/.test(value)) dynamic = true;
        } else if (q === "{") {
          const end = matchBrace(src, j); if (end === -1) break;
          value = src.slice(j + 1, end).trim(); j = end + 1;
          const lit = /^["'`]([^"'`]*)["'`]$/.exec(value);
          if (lit) value = lit[1]; else if (/^(true|false|-?\d+)$/.test(value)) { /* literal */ } else dynamic = true;
          if (value === "false") present = false;
        } else {
          const vm = /^[^\s>]+/.exec(src.slice(j)); if (!vm) break;
          value = vm[0]; j += value.length;
        }
      }
      if (present) attrs.set(normalizeAttr(aname), { raw: aname, value, dynamic });
    }
    if (!ok) { i = lt + 1; continue; }
    const name = rawName;
    tags.push({ name, lname: name.toLowerCase(), closing, selfClosing, attrs, index: lt });
    const lower = name.toLowerCase();
    if (!closing && !selfClosing && (lower === "script" || lower === "style")) {
      const end = src.toLowerCase().indexOf(`</${lower}`, j);
      if (lower === "style") styleBlocks.push({ css: src.slice(j, end === -1 ? n : end), offset: j });
      i = end === -1 ? n : end; continue;
    }
    i = j;
  }
  return { tags, styleBlocks };
}

function matchBrace(src, start) {
  let depth = 0; let q = null;
  for (let k = start; k < src.length; k++) {
    const c = src[k];
    if (q) { if (c === "\\") { k++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return k; }
  }
  return -1;
}

function normalizeAttr(a) {
  const map = { classname: "class", htmlfor: "for", tabindex: "tabindex" };
  const low = a.toLowerCase();
  if (map[low]) return map[low];
  if (/^(on:click|@click|v-on:click|onclick|\(click\))$/.test(low)) return "@click";
  if (/^(on:keydown|@keydown|v-on:keydown|onkeydown|onkeyup|on:keyup|@keyup)$/.test(low)) return "@key";
  if (low.startsWith(":") || low.startsWith("v-bind:")) return low.replace(/^v-bind:|^:/, ""); // vue bound attr
  if (low.startsWith("bind:")) return low; // svelte binding
  return low;
}

// ---------- markup audit ----------
function auditMarkup(file, src, add) {
  const isJsLike = /\.(jsx|tsx)$/.test(file);
  const { tags, styleBlocks } = tokenize(src, isJsLike);
  const isDocument = tags.some((t) => t.lname === "html" && !t.closing);
  const labelFor = new Set();
  const ids = new Map();
  for (const t of tags) {
    if (t.closing) continue;
    if (t.lname === "label" && t.attrs.get("for") && !t.attrs.get("for").dynamic) labelFor.add(t.attrs.get("for").value);
    const id = t.attrs.get("id");
    if (id && !id.dynamic && id.value) {
      if (ids.has(id.value)) add("medium", t.index, "duplicate-id", `Duplicate id "${id.value}" (also at line ${lineAt(src, ids.get(id.value))}). label[for], aria-* references and fragment links resolve to the first only.`);
      else ids.set(id.value, t.index);
    }
  }

  if (isDocument) {
    const htmlTag = tags.find((t) => t.lname === "html" && !t.closing);
    if (!htmlTag.attrs.has("lang")) add("high", htmlTag.index, "html-lang", "<html> has no lang attribute (WCAG 3.1.1).");
    if (!tags.some((t) => t.lname === "meta" && t.attrs.has("charset"))) add("medium", 0, "meta-charset", "No <meta charset>.");
    if (!tags.some((t) => t.lname === "meta" && t.attrs.get("name")?.value === "viewport")) add("medium", 0, "meta-viewport", "No <meta name=\"viewport\">.");
    if (!tags.some((t) => t.lname === "title" && !t.closing)) add("high", 0, "document-title", "No <title> (WCAG 2.4.2).");
    const mains = tags.filter((t) => t.lname === "main" && !t.closing && !t.attrs.has("hidden"));
    if (mains.length === 0) add("medium", 0, "no-main", "No <main> landmark.");
  }
  const mains = tags.filter((t) => t.lname === "main" && !t.closing && !t.attrs.has("hidden"));
  if (mains.length > 1) add("medium", mains[1].index, "multiple-main", "More than one visible <main>.");

  const stack = [];
  let lastHeading = 0;
  for (const t of tags) {
    const a = t.attrs;
    const get = (k) => a.get(k);
    const val = (k) => a.get(k)?.value ?? "";
    if (t.closing) {
      for (let k = stack.length - 1; k >= 0; k--) if (stack[k].lname === t.lname) { stack.length = k; break; }
      continue;
    }
    // Only lowercase names are HTML elements; Capitalized = components
    if (t.name !== t.lname) continue;
    const ln = t.lname;
    const inside = (name) => stack.some((s) => s.lname === name);
    const role = val("role").trim();
    const hasClick = a.has("@click");
    const tabindex = get("tabindex");
    const focusable = (ln === "a" && a.has("href")) || ["button", "input", "select", "textarea", "summary", "iframe"].includes(ln) || (tabindex && !tabindex.dynamic && Number(tabindex.value) >= 0);

    // viewport zoom
    if (ln === "meta" && val("name") === "viewport" && /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/.test(val("content")))
      add("high", t.index, "zoom-disabled", "Viewport meta disables zoom (user-scalable=no / maximum-scale=1). Fails WCAG 1.4.4.");

    // obsolete
    if (OBSOLETE_ELEMENTS.has(ln)) add("medium", t.index, "obsolete-element", `<${ln}> is obsolete. Use semantic HTML + CSS.`);
    for (const oa of OBSOLETE_ATTRS) if (a.has(oa) && !(oa === "align" && ln === "svg")) { add("low", t.index, "obsolete-attribute", `Presentational attribute "${oa}" on <${ln}>. Use CSS.`); break; }
    if (a.has("border") && ["img", "table"].includes(ln)) add("low", t.index, "obsolete-attribute", `Presentational "border" on <${ln}>. Use CSS.`);

    // images
    if (ln === "img" && !a.has("alt") && !a.has("{...")) add("high", t.index, "img-alt", "<img> without alt. Informative → describe; decorative → alt=\"\" (WCAG 1.1.1).");
    if (ln === "img" && !(a.has("width") && a.has("height"))) add("low", t.index, "img-dimensions", "<img> without width/height → layout shift (CLS).");
    if (ln === "iframe" && !a.has("title")) add("medium", t.index, "iframe-title", "<iframe> without title.");

    // headings
    const hm = /^h([1-6])$/.exec(ln);
    if (hm) {
      const lvl = Number(hm[1]);
      if (lastHeading && lvl > lastHeading + 1) add("medium", t.index, "heading-skip", `Heading jumps from h${lastHeading} to h${lvl}. Don't skip levels going down.`);
      lastHeading = lvl;
    }

    // form controls & labels
    const type = val("type").toLowerCase();
    if ((ln === "input" && !["hidden", "submit", "button", "reset", "image"].includes(type)) || ln === "select" || ln === "textarea") {
      const id = get("id");
      const labelled = a.has("aria-label") || a.has("aria-labelledby") || inside("label") || (id && (id.dynamic || labelFor.has(id.value))) || a.has("{...");
      if (!labelled) {
        const ph = a.has("placeholder") ? " It has a placeholder, which is not a label." : "";
        add("high", t.index, "control-label", `<${ln}${type ? ` type="${type}"` : ""}> has no associated label (label[for], wrapping label, aria-labelledby).${ph} Verify if the label is composed elsewhere.`);
      }
    }
    if (ln === "button" && !a.has("type") && inside("form")) add("low", t.index, "button-type", "<button> in a <form> without type defaults to submit. Set type=\"button\" for non-submit buttons.");

    // clickable non-interactive
    let reportedFocus = false;
    if (hasClick && NON_INTERACTIVE_CLICK_TARGETS.has(ln)) {
      if (!role) add("high", t.index, "click-non-interactive", `Click handler on <${ln}>. Use <button> (action) or <a href> (navigation).`);
      else if (!tabindex) reportedFocus = true, add("high", t.index, "role-not-focusable", `<${ln} role="${role}"> with click handler is not focusable. Prefer a native element; otherwise add tabindex="0" and Enter/Space handling.`);
      else if (!a.has("@key")) add("medium", t.index, "no-key-handler", `<${ln} role="${role}"> has a click handler but no key handler. Custom controls need Enter/Space (APG).`);
    }
    if (ln === "a") {
      const href = get("href");
      if (!href && hasClick) add("high", t.index, "link-without-href", "<a> with click handler and no href is not focusable. Use <button type=\"button\">.");
      else if (href && !href.dynamic && (href.value === "#" || /^javascript:/i.test(href.value)) && hasClick)
        add("medium", t.index, "fake-link", `<a href="${href.value}"> used as a button. Use <button type="button">.`);
    }

    // nested interactive
    if ((ln === "a" && a.has("href")) || ln === "button") {
      const outer = stack.find((s) => (s.lname === "a" && s.attrs.has("href")) || s.lname === "button");
      if (outer) add("high", t.index, "nested-interactive", `<${ln}> nested inside <${outer.lname}>. Interactive content can't contain interactive content.`);
    }
    if (["input", "select", "textarea"].includes(ln) && type !== "hidden") {
      const outer = stack.find((s) => (s.lname === "a" && s.attrs.has("href")) || s.lname === "button");
      if (outer) add("high", t.index, "nested-interactive", `<${ln}> nested inside <${outer.lname}>.`);
    }

    // tabindex
    if (tabindex && !tabindex.dynamic && Number(tabindex.value) > 0) add("medium", t.index, "positive-tabindex", `tabindex="${tabindex.value}" breaks natural tab order. Use 0 or -1.`);

    // ARIA attributes
    for (const [k, v] of a) {
      if (k.startsWith("aria-") && !VALID_ARIA.has(k)) add("high", t.index, "invalid-aria-attr", `Unknown ARIA attribute "${v.raw}"${k === "aria-labeledby" ? " (spelled aria-labelledby)" : ""}. Assistive tech ignores it.`);
    }
    if (val("aria-hidden") === "true" && focusable) add("high", t.index, "aria-hidden-focusable", `aria-hidden="true" on focusable <${ln}>. Keyboard users reach an element screen readers can't see. Use inert or remove it from tab order.`);
    if (role && !get("role").dynamic) {
      for (const r of role.split(/\s+/)) {
        if (!VALID_ROLES.has(r) && !/^(doc|graphics)-[a-z]+$/.test(r)) add("high", t.index, "invalid-role", `Invalid role "${r}".`);
      }
      const first = role.split(/\s+/)[0];
      if (IMPLICIT_ROLE[ln] === first) add("low", t.index, "redundant-role", `role="${first}" is redundant on <${ln}>.`);
      if (ln === "a" && a.has("href") && first === "link") add("low", t.index, "redundant-role", "role=\"link\" is redundant on <a href>.");
      if ((first === "presentation" || first === "none") && focusable) add("high", t.index, "presentation-focusable", `role="${first}" on focusable <${ln}> is ignored and confusing.`);
      if (first === "menu" && inside("nav")) add("medium", t.index, "menu-in-nav", "role=\"menu\" inside <nav>. Site navigation should be links (disclosure pattern), not an application menu.");
      if (!reportedFocus && ["button", "link", "checkbox", "switch", "slider", "spinbutton", "combobox", "textbox"].includes(first) && !INTERACTIVE.has(ln) && !tabindex)
        add("high", t.index, "role-not-focusable", `role="${first}" on <${ln}> without tabindex. It can't be reached by keyboard.`);
    }
    if ((ln === "div" || ln === "span") && !role && (a.has("aria-label") || a.has("aria-labelledby")))
      add("medium", t.index, "aria-label-generic", `aria-label/labelledby on a generic <${ln}> without a role is prohibited and ignored by many screen readers.`);

    // style attribute
    const style = get("style");
    if (style && !style.dynamic) {
      const decls = style.value.split(";").map((d) => d.trim()).filter(Boolean);
      const nonCustom = decls.filter((d) => !d.startsWith("--"));
      if (/!important/.test(style.value)) add("medium", t.index, "style-attr-important", "!important inside a style attribute. Nothing in stylesheets can override it except other !important declarations.");
      else if (nonCustom.length) add("low", t.index, "style-attr", `Static style attribute (${nonCustom.map((d) => d.split(":")[0]).join(", ")}). Move static design to the stylesheet; pass per-instance data as custom properties (style="--x: …").`);
      if (/[{}]|:hover|:focus/.test(style.value)) add("medium", t.index, "style-attr-syntax", "style attribute contains braces/pseudo-classes. It only accepts a declaration list (CSS Style Attributes, REC 2013).");
    }

    if (!VOID.has(ln) && !t.selfClosing) stack.push(t);
  }

  for (const b of styleBlocks) auditCss(file, src, b.css, b.offset, add);
}

// ---------- CSS audit ----------
function stripComments(css) { return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")); }

function auditCss(file, fullSrc, css, offset, add) {
  const src = stripComments(css);
  const at = (i) => offset + i;
  const hasFocusVisible = /:focus-visible/.test(src);

  // rules: selector { body }
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  for (const m of src.matchAll(ruleRe)) {
    const selector = m[1].trim();
    const body = m[2];
    const idx = m.index;
    if (/(^|[\s,>+~(])#[a-zA-Z][\w-]*/.test(selector) && !selector.startsWith("@") && !/^#[0-9a-f]{3,8}$/i.test(selector))
      add("low", at(idx), "id-selector", `ID selector "${selector.slice(0, 60)}". IDs outrank any number of classes; use a class.`);
    if (/\boutline\s*:\s*(none|0)\b/.test(body)) {
      if (/:focus-visible/.test(selector)) add("high", at(idx), "outline-removed", "outline removed inside a :focus-visible rule. Verify another visible indicator (3:1 contrast) replaces it.");
      else if (!hasFocusVisible) add("high", at(idx), "outline-removed", `outline removed on "${selector.slice(0, 60)}" and no :focus-visible style in this file. Focus must stay visible (WCAG 2.4.7).`);
      else add("low", at(idx), "outline-removed", `outline removed on "${selector.slice(0, 60)}". A :focus-visible rule exists in this file; verify it covers this element.`);
    }
  }
  for (const m of src.matchAll(/!important/g)) add("low", at(m.index), "important", "!important. Acceptable in a utilities layer or to override third-party CSS; otherwise fix the cascade (layers/specificity).");
  for (const m of src.matchAll(/transition\s*:\s*all\b/g)) add("low", at(m.index), "transition-all", "transition: all. List the specific properties.");
  for (const m of src.matchAll(/\b100vh\b/g)) add("low", at(m.index), "vh-unit", "100vh includes area behind mobile browser UI. Consider 100dvh/100svh (with a vh fallback if needed).");
  for (const m of src.matchAll(/(?:^|[;{\s])(-(?:webkit|moz|ms|o)-[a-z-]+)\s*:/g)) {
    if (!PREFIX_ALLOW.has(m[1])) add("low", at(m.index), "vendor-prefix", `Vendor-prefixed property ${m[1]}. Check MDN; use the standard property unless the prefix is still required.`);
  }
  for (const m of src.matchAll(/font-size\s*:\s*\d+(\.\d+)?px/g)) add("low", at(m.index), "px-font-size", "font-size in px ignores the user's font-size preference. Use rem.");
  for (const m of src.matchAll(/z-index\s*:\s*(\d{4,})/g)) add("low", at(m.index), "z-index-scale", `z-index: ${m[1]}. Use a small token scale and fix stacking contexts instead.`);
  for (const m of src.matchAll(/(?:^|[;{\s])float\s*:\s*(left|right)/g)) add("low", at(m.index), "float-layout", "float. Fine for wrapping text around media; use flex/grid for layout.");
  for (const m of src.matchAll(/user-select\s*:\s*none/g)) add("low", at(m.index), "user-select-none", "user-select: none. Make sure it isn't blocking copy of meaningful text.");
}

// ---------- run ----------
const files = walk(root, []);
const findings = [];
for (const f of files) {
  let src;
  try { src = readFileSync(f, "utf8"); } catch { continue; }
  const rel = relative(base, f) || f;
  const add = (severity, index, rule, message) => findings.push({ file: rel, line: lineAt(src, index ?? 0), severity, rule, message });
  if (CSS_EXTS.has(extname(f))) auditCss(rel, src, src, 0, add);
  else auditMarkup(rel, src, add);
}

const order = { high: 0, medium: 1, low: 2 };
findings.sort((a, b) => order[a.severity] - order[b.severity] || a.file.localeCompare(b.file) || a.line - b.line);

if (asJson) {
  console.log(JSON.stringify({ scannedFiles: files.length, findings }, null, 2));
} else {
  const counts = findings.reduce((c, f) => ((c[f.severity] = (c[f.severity] ?? 0) + 1), c), {});
  console.log(`Scanned ${files.length} files. ${findings.length} potential issue(s) (high ${counts.high ?? 0}, medium ${counts.medium ?? 0}, low ${counts.low ?? 0}). Heuristic — verify each; automated checks miss most real accessibility issues.\n`);
  for (const f of findings) console.log(`[${f.severity.toUpperCase()}] ${f.file}:${f.line}  (${f.rule})\n    ${f.message}`);
}
