<script lang="ts">
  let {
    items,
  }: {
    items: { label: string; title: string; description: string }[];
  } = $props();
</script>

<div
  class="grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 dark:border-slate-700 dark:bg-slate-700 md:grid-cols-3"
>
  {#each items as item (item.label)}
    <article class="bg-white p-7 dark:bg-slate-800 sm:p-8">
      <span
        class="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400"
      >
        {item.label}
      </span>
      <h3 class="mt-8 text-xl font-bold text-slate-950 dark:text-white">
        {item.title}
      </h3>
      <p class="mt-3 leading-relaxed text-slate-600 dark:text-slate-400">
        {item.description}
      </p>
    </article>
  {/each}
</div>
