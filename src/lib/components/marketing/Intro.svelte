<script lang="ts">
  import type { Snippet } from "svelte";
  import SectionLabel from "./SectionLabel.svelte";

  let {
    label,
    heading,
    children,
  }: { label: string; heading: Snippet; children: Snippet } = $props();
</script>

<section class="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
  <div class="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
    <div>
      <SectionLabel text={label} />
      <h2
        class="mt-5 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl"
      >
        {@render heading()}
      </h2>
    </div>
    <div
      class="space-y-5 text-lg leading-relaxed text-slate-600 dark:text-slate-300"
    >
      {@render children()}
    </div>
  </div>
</section>
