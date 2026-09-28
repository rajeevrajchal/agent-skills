# Vue 3 / Nuxt

## Contents
- Component pattern
- Reacting to state
- Enter/leave with <Transition>
- Lists
- Nuxt specifics
- Anti-patterns

## Component pattern

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, useTemplateRef } from "vue";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const root = useTemplateRef<HTMLElement>("root"); // Vue 3.5+; or ref<HTMLElement | null>(null)
let mm: gsap.MatchMedia | undefined;

onMounted(() => {
  mm = gsap.matchMedia();
  mm.add(
    { motion: "(prefers-reduced-motion: no-preference)", reduce: "(prefers-reduced-motion: reduce)" },
    (ctx) => {
      const { reduce } = ctx.conditions as { motion: boolean; reduce: boolean };
      if (reduce) { gsap.from(".feature", { autoAlpha: 0, duration: 0.2 }); return; }
      gsap.from(".feature", {
        y: 24, autoAlpha: 0, duration: 0.45, stagger: 0.06, ease: "power3.out",
        scrollTrigger: { trigger: root.value, start: "top 80%", once: true },
      });
    },
    root.value!,
  );
});

onUnmounted(() => mm?.revert());
</script>

<template>
  <section ref="root">
    <div v-for="f in features" :key="f.id" class="feature">{{ f.title }}</div>
  </section>
</template>
```

Template refs are populated in `onMounted`, not in `setup`. Elements inside `v-if` that appear later: animate them from a `watch` with `flush: "post"` or an `@enter` hook.

## Reacting to state

```ts
let tl: gsap.core.Timeline | undefined;
let ctx: gsap.Context | undefined;
onMounted(() => { ctx = gsap.context(() => { tl = gsap.timeline({ paused: true }) /* … */; }, root.value!); });
watch(() => props.open, (open) => (open ? tl?.play() : tl?.reverse()));
onUnmounted(() => ctx?.revert());
```

Keep timelines in plain `let` variables (or `shallowRef` if they must be reactive). Never in `ref()`/`reactive()` — deep proxies around GSAP objects cause subtle bugs and overhead.

Don't bind `:style="{ transform }"` on elements GSAP animates.

## Enter/leave with <Transition>

`<Transition>` with JS hooks delays removal until `done()` — the idiomatic GSAP exit path in Vue.

```vue
<Transition :css="false" @enter="onEnter" @leave="onLeave">
  <div v-if="open" class="panel">…</div>
</Transition>
```
```ts
function onEnter(el: Element, done: () => void) {
  gsap.fromTo(el, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: "power3.out", onComplete: done });
}
function onLeave(el: Element, done: () => void) {
  gsap.to(el, { autoAlpha: 0, y: 8, duration: 0.2, ease: "power2.in", onComplete: done });
}
```
`:css="false"` stops Vue from sniffing CSS transitions. If the leave can be interrupted (re-open mid-leave), Vue calls `onEnter` on a new element; kill the old tween with `gsap.killTweensOf(el)` in `@leave-cancelled`/`@enter-cancelled` as needed.

## Lists

`<TransitionGroup>` with the same hooks; use `el.dataset.index` for stagger delay:
```ts
function onEnter(el: Element, done: () => void) {
  const i = Number((el as HTMLElement).dataset.index ?? 0);
  gsap.from(el, { autoAlpha: 0, y: 12, delay: Math.min(i * 0.04, 0.4), duration: 0.3, onComplete: done });
}
```
For reorder, Vue's `move-class` (FLIP via CSS) is usually enough; GSAP Flip when it must coordinate with other motion.

## Nuxt specifics

- `onMounted` is client-only; GSAP code inside it is SSR-safe.
- Register plugins once in `plugins/gsap.client.ts`.
- On route change, page components unmount (cleanup runs). If ScrollTrigger positions are off after navigation, refresh in the `page:finish` hook: `nuxtApp.hook("page:finish", () => requestAnimationFrame(() => ScrollTrigger.refresh()))`.
- `<NuxtPage :transition="...">` accepts the same JS hooks for page transitions — keep them short.

## Anti-patterns

- GSAP calls in `setup` before mount.
- No `onUnmounted` revert.
- Timelines in `ref()`/`reactive()`.
- `<Transition>` without `:css="false"` while also having CSS transitions on the element (double animation).
