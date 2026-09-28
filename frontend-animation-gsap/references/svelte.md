# Svelte 5 / SvelteKit

## Contents
- Where GSAP code runs
- Component pattern (onMount + gsap.context)
- Reusable pattern: attachment / action
- Reacting to state
- Enter/exit: Svelte transitions vs GSAP
- SvelteKit navigation and ScrollTrigger
- Anti-patterns

## Where GSAP code runs

SvelteKit renders on the server first. GSAP must only touch the DOM in the browser:
- `onMount` and `$effect` run only in the browser — put GSAP code there.
- Register plugins inside `onMount` or in a module only imported client-side. Importing `gsap` at module top level is SSR-safe; *calling* DOM-dependent APIs (`ScrollTrigger.create`, `document.querySelector`) at module top level is not.
- Guard any other access with `import { browser } from "$app/environment"`.

## Component pattern (onMount + gsap.context)

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import { gsap } from "gsap";
  import { ScrollTrigger } from "gsap/ScrollTrigger";

  let root: HTMLElement;

  onMount(() => {
    gsap.registerPlugin(ScrollTrigger); // idempotent

    const mm = gsap.matchMedia();
    mm.add(
      { motion: "(prefers-reduced-motion: no-preference)", reduce: "(prefers-reduced-motion: reduce)" },
      (ctx) => {
        const { reduce } = ctx.conditions as { motion: boolean; reduce: boolean };
        if (reduce) {
          gsap.from(".card", { autoAlpha: 0, duration: 0.2 });
          return;
        }
        gsap.from(".card", {
          y: 24, autoAlpha: 0, duration: 0.45, ease: "power3.out", stagger: 0.06,
          scrollTrigger: { trigger: root, start: "top 80%", once: true },
        });
      },
      root, // scope selectors to this component
    );

    return () => mm.revert(); // kills tweens + ScrollTriggers, restores inline styles
  });
</script>

<section bind:this={root}>
  {#each items as item (item.id)}
    <article class="card">{item.title}</article>
  {/each}
</section>
```

If there's no matchMedia, use `const ctx = gsap.context(() => { ... }, root); return () => ctx.revert();`.

`bind:this` is set before `onMount` runs, so `root` is available. For elements inside `{#if}` blocks that appear later, animate them where they mount (an attachment/action on that element), not from the parent's `onMount`.

## Reusable pattern: attachment / action

For per-element behavior reused across components, use an attachment (Svelte 5.29+, `{@attach}`) or an action (`use:`). Both give you the node when mounted and a teardown.

```ts
// lib/motion/reveal.ts
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Attachment } from "svelte/attachments";

export function reveal(opts: { y?: number; delay?: number } = {}): Attachment<HTMLElement> {
  return (node) => {
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(node, {
        y: opts.y ?? 24, autoAlpha: 0, duration: 0.5, delay: opts.delay ?? 0, ease: "power3.out",
        scrollTrigger: { trigger: node, start: "top 85%", once: true },
      });
    });
    return () => mm.revert();
  };
}
```
```svelte
<h2 {@attach reveal({ y: 16 })}>Features</h2>
```

Attachments re-run when reactive values read inside them change (with teardown first). Read options *outside* the returned function if you don't want re-runs, or pass them as arguments as above.

## Reacting to state

Build the timeline once in `onMount`, drive it from `$effect`:

```svelte
<script lang="ts">
  let { open }: { open: boolean } = $props();
  let root: HTMLElement;
  let tl: gsap.core.Timeline | undefined;

  onMount(() => {
    const ctx = gsap.context(() => {
      tl = gsap.timeline({ paused: true, defaults: { duration: 0.25, ease: "power2.out" } })
        .to(".panel", { autoAlpha: 1, y: 0 })
        .from(".panel li", { y: 8, autoAlpha: 0, stagger: 0.03 }, "<0.05");
    }, root);
    return () => ctx.revert();
  });

  $effect(() => {
    if (open) tl?.play(); else tl?.reverse();
  });
</script>
```

`$effect` runs after `onMount` on first render, so `tl` exists. Don't make `tl` a `$state` — it's an imperative handle, not UI state.

Don't bind GSAP-animated properties through `style:transform={...}` — Svelte will overwrite GSAP's inline transform on update.

## Enter/exit: Svelte transitions vs GSAP

- Simple enter/exit of a conditional element → Svelte's built-in `transition:`/`in:`/`out:` (CSS-based, delays unmount automatically, respects the component tree). This is the CSS option in Svelte; use it by default.
- Coordinated GSAP exit (multiple elements, timeline) → keep the element mounted during a `closing` phase and unmount in `onComplete`:
  ```ts
  let phase = $state<"open" | "closing" | "closed">("closed");
  function close() {
    phase = "closing";
    gsap.to(panel, { autoAlpha: 0, y: 12, duration: 0.2, ease: "power2.in", onComplete: () => { phase = "closed"; } });
  }
  ```
  `{#if phase !== "closed"} … {/if}`

Svelte's `{#each}` with `animate:flip` covers simple list reordering without GSAP. Use GSAP Flip only for cross-container moves or when it must be part of a timeline.

## SvelteKit navigation and ScrollTrigger

- Page components unmount on navigation → their `onMount` cleanup reverts triggers. Layout components persist across navigations — don't create page-specific triggers in `+layout.svelte`.
- After navigation, the new page's triggers are created in its `onMount`. If positions are wrong (images/fonts), refresh once:
  ```ts
  import { afterNavigate } from "$app/navigation";
  afterNavigate(() => { requestAnimationFrame(() => ScrollTrigger.refresh()); });
  ```
- SvelteKit restores scroll position on back navigation; triggers created before the restore may fire `onEnter` immediately — this is usually fine with `once: true`.
- Page transitions: prefer `onNavigate` + the View Transitions API for cross-page transitions; GSAP for in-page choreography.

## Anti-patterns

- GSAP calls in the `<script>` body (runs during SSR, and before `bind:this` is set).
- Missing `return () => ctx.revert()` in `onMount`.
- `document.querySelectorAll` instead of scoped selectors or bound refs.
- Timelines stored in `$state` (proxy wrapping an imperative object).
- Using `$effect` to create tweens on every change without cleanup (`$effect` should return a teardown if it creates animations).
