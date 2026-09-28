#!/usr/bin/env node
// Heuristic scan for common GSAP problems. Findings are leads to verify, not verdicts.
// Usage: node scripts/audit-gsap.mjs <dir|file> [--json]
// No dependencies. Node 18+.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".svelte", ".vue", ".astro"]);
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", ".nuxt", ".svelte-kit", ".output", "coverage", ".turbo", ".vercel"]);
const LAYOUT_PROPS = ["width", "height", "top", "left", "right", "bottom", "margin", "marginTop", "marginLeft", "marginRight", "marginBottom", "padding", "paddingTop", "paddingLeft", "paddingRight", "paddingBottom"];
const EXPENSIVE_PROPS = ["filter", "backdropFilter", "boxShadow"];

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const target = args.find((a) => !a.startsWith("--"));
if (!target) {
  console.error("Usage: node audit-gsap.mjs <dir|file> [--json]");
  process.exit(2);
}
const root = resolve(target);
const base = (() => { try { return statSync(root).isDirectory() ? root : dirname(root); } catch { return process.cwd(); } })();

function walk(path, out) {
  let st;
  try { st = statSync(path); } catch { return out; }
  if (st.isDirectory()) {
    for (const name of readdirSync(path)) {
      if (SKIP_DIRS.has(name)) continue;
      walk(join(path, name), out);
    }
  } else if (EXTS.has(extname(path))) {
    out.push(path);
  }
  return out;
}

function lineOf(src, index) {
  let line = 1;
  for (let i = 0; i < index && i < src.length; i++) if (src.charCodeAt(i) === 10) line++;
  return line;
}

// Returns the argument text of a call starting at the "(" index, respecting nesting and strings.
function callArgs(src, openIdx) {
  let depth = 0;
  let quote = null;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === "\\") { i++; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "(") depth++;
    else if (ch === ")") { depth--; if (depth === 0) return src.slice(openIdx + 1, i); }
  }
  return src.slice(openIdx + 1, Math.min(src.length, openIdx + 800));
}

const TWEEN_CALL = /\b(?:gsap|tl|timeline|\w+Tl|\w+Timeline)\s*\.\s*(to|from|fromTo)\s*\(/g;

function auditFile(file, src) {
  const findings = [];
  const add = (severity, index, rule, message) =>
    findings.push({ file, line: index == null ? 1 : lineOf(src, index), severity, rule, message });

  const usesGsap = /from\s+["']gsap(?:\/[\w-]+)?["']|require\(["']gsap|\bgsap\s*\./.test(src);
  if (!usesGsap) return findings;

  const createsAnimations = /\bgsap\s*\.\s*(to|from|fromTo|timeline|set|quickTo)\s*\(|ScrollTrigger\s*\.\s*create\s*\(/.test(src);
  const isComponent = /\.(tsx|jsx|svelte|vue)$/.test(file) || /\buse(Effect|LayoutEffect)\s*\(|onMount\s*\(|onMounted\s*\(/.test(src);
  const hasCleanup = /\buseGSAP\s*\(|\.revert\s*\(|\.kill\s*\(|killTweensOf\s*\(|\bctx\b.*revert|onUnmounted|onBeforeUnmount|onDestroy/.test(src);
  const hasReducedMotion = /prefers-reduced-motion|reduceMotion|reducedMotion|reduce-motion/i.test(src);
  const hasMatchMedia = /gsap\s*\.\s*matchMedia\s*\(/.test(src);

  // 1. Missing cleanup in components
  if (createsAnimations && isComponent && !hasCleanup) {
    add("high", src.search(/\bgsap\s*\./), "missing-cleanup",
      "Component creates GSAP animations but no revert/kill/useGSAP cleanup was found. Leaks tweens/ScrollTriggers and breaks on re-mount or Strict Mode.");
  }

  // 2. React useEffect with GSAP instead of useGSAP
  for (const m of src.matchAll(/\buse(?:Layout)?Effect\s*\(/g)) {
    const body = callArgs(src, m.index + m[0].length - 1);
    if (/\bgsap\s*\.|ScrollTrigger/.test(body) && !/revert\s*\(|kill\s*\(/.test(body)) {
      add("high", m.index, "effect-without-revert",
        "GSAP inside useEffect/useLayoutEffect without revert. Prefer useGSAP({ scope }) or return () => ctx.revert().");
    }
  }

  // 3. Unscoped DOM queries
  for (const m of src.matchAll(/document\s*\.\s*(querySelector(?:All)?|getElementsByClassName|getElementById)\s*\(/g)) {
    if (isComponent) add("medium", m.index, "unscoped-query",
      "Document-wide query in a component that uses GSAP. Scope to the component root (ref / gsap.context scope / gsap.utils.toArray(sel, root)).");
  }

  // 4. Shipped markers
  for (const m of src.matchAll(/markers\s*:\s*true/g)) {
    add("medium", m.index, "markers-shipped", "ScrollTrigger markers: true. Gate behind a dev flag (e.g. import.meta.env.DEV).");
  }

  // 5. Global ScrollTrigger kill
  for (const m of src.matchAll(/ScrollTrigger\s*\.\s*getAll\s*\(\s*\)\s*\.\s*forEach/g)) {
    add("medium", m.index, "global-kill",
      "ScrollTrigger.getAll().forEach(...) kills triggers owned by other components. Revert this component's context instead.");
  }

  // 6. Tween vars inspection
  for (const m of src.matchAll(TWEEN_CALL)) {
    const argsText = callArgs(src, m.index + m[0].length - 1);
    for (const p of LAYOUT_PROPS) {
      const re = new RegExp(`(^|[\\s{,])${p}\\s*:`);
      if (re.test(argsText)) {
        add("medium", m.index, "layout-property",
          `Tween animates "${p}" (triggers layout every frame). Prefer transforms (x/y/scale/xPercent) or Flip.`);
        break;
      }
    }
    for (const p of EXPENSIVE_PROPS) {
      if (new RegExp(`(^|[\\s{,])${p}\\s*:`).test(argsText)) {
        add("low", m.index, "expensive-property", `Tween animates "${p}" (paint-heavy). Verify with a profile on mobile, or fake with a cross-fade.`);
      }
    }
    if (/\bopacity\s*:\s*0\b/.test(argsText) && !/autoAlpha/.test(argsText) && m[1] !== "to") {
      add("low", m.index, "opacity-not-autoalpha", "Hidden state uses opacity: 0. Consider autoAlpha so invisible elements aren't focusable/clickable.");
    }
    if (/ease\s*:\s*["'`](elastic|bounce)/.test(argsText)) {
      add("low", m.index, "playful-ease", "elastic/bounce ease. Fine for playful/game UI; usually wrong in product UI.");
    }
    if (/repeat\s*:\s*-1/.test(argsText)) {
      add("low", m.index, "infinite-loop", "Infinite loop. Pause it offscreen and disable under reduced motion.");
    }
    if (/scrub\s*:/.test(argsText) && /ease\s*:\s*["'`](?!none)/.test(argsText) && !/defaults/.test(argsText)) {
      add("low", m.index, "scrub-with-ease", "Scrubbed tween with a non-linear ease. Scroll mapping will feel uneven; use ease: \"none\" unless intended.");
    }
  }

  // 7. Nested scrollTrigger on timeline child (heuristic: tl.to(..., { scrollTrigger }))
  for (const m of src.matchAll(/\b(?!gsap\b)(\w+)\s*\.\s*(to|from|fromTo)\s*\(/g)) {
    const obj = m[1];
    if (!/^(tl|timeline|\w+Tl|\w+Timeline|master)$/.test(obj)) continue;
    const argsText = callArgs(src, m.index + m[0].length - 1);
    if (/scrollTrigger\s*:/.test(argsText)) {
      add("high", m.index, "nested-scrolltrigger",
        `scrollTrigger on a tween inside timeline "${obj}". Put scrollTrigger on the timeline itself.`);
    }
  }

  // 8. Reduced motion
  if (createsAnimations && !hasReducedMotion) {
    add("medium", null, "no-reduced-motion",
      hasMatchMedia
        ? "gsap.matchMedia is used but no prefers-reduced-motion condition was found in this file."
        : "No prefers-reduced-motion handling found in this file (may be handled globally — verify).");
  }

  // 9. CSS transition conflicts in single-file components
  if (/\.(svelte|vue|astro)$/.test(file)) {
    for (const m of src.matchAll(/transition\s*:\s*(all|transform|opacity)\b/g)) {
      add("low", m.index, "css-transition-conflict",
        `CSS "transition: ${m[1]}" in a file that uses GSAP. If GSAP animates the same property on that element, they fight.`);
    }
  }

  // 10. Svelte: GSAP at script top level (runs during SSR / before bind:this)
  if (file.endsWith(".svelte")) {
    const script = src.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    if (script) {
      const body = script[1];
      const lines = body.split("\n");
      let depth = 0;
      for (let i = 0; i < lines.length; i++) {
        const ln = lines[i];
        if (depth === 0 && /^\s*gsap\s*\.\s*(to|from|fromTo|timeline|set)\s*\(/.test(ln)) {
          add("high", src.indexOf(ln), "svelte-top-level",
            "GSAP call at <script> top level runs during SSR and before bind:this. Move into onMount/$effect/attachment.");
        }
        depth += (ln.match(/[{(]/g) || []).length - (ln.match(/[})]/g) || []).length;
        if (depth < 0) depth = 0;
      }
    }
  }

  return findings;
}

const files = walk(root, []);
const all = [];
let usesScrollTrigger = false;
let registersScrollTrigger = false;

for (const f of files) {
  let src;
  try { src = readFileSync(f, "utf8"); } catch { continue; }
  if (/scrollTrigger\s*:|ScrollTrigger\s*\.\s*(create|batch)/.test(src)) usesScrollTrigger = true;
  if (/registerPlugin\s*\([^)]*ScrollTrigger/.test(src)) registersScrollTrigger = true;
  all.push(...auditFile(relative(base, f) || f, src));
}

if (usesScrollTrigger && !registersScrollTrigger) {
  all.unshift({ file: ".", line: 0, severity: "high", rule: "plugin-not-registered",
    message: "ScrollTrigger is used but gsap.registerPlugin(ScrollTrigger) was not found. Unregistered, the scrollTrigger key is silently ignored." });
}

const order = { high: 0, medium: 1, low: 2 };
all.sort((a, b) => order[a.severity] - order[b.severity] || a.file.localeCompare(b.file) || a.line - b.line);

if (asJson) {
  console.log(JSON.stringify({ scannedFiles: files.length, findings: all }, null, 2));
} else {
  console.log(`Scanned ${files.length} files. ${all.length} potential issue(s). Heuristic — verify each before reporting.\n`);
  for (const f of all) {
    console.log(`[${f.severity.toUpperCase()}] ${f.file}:${f.line}  (${f.rule})\n    ${f.message}`);
  }
}
