<script lang="ts">
  let {
    steps,
    compact = false,
  }: {
    steps: { number: string; title: string; description: string }[];
    compact?: boolean;
  } = $props();
</script>

<ol
  class={compact
    ? "grid gap-6 sm:grid-cols-3"
    : "grid gap-8 sm:grid-cols-2 lg:grid-cols-4"}
>
  {#each steps as step (step.number)}
    <li class="border-t-2 border-blue-600 pt-5 dark:border-blue-400">
      <span
        class="font-mono text-sm text-blue-600 dark:text-blue-400 {compact
          ? 'font-semibold'
          : 'font-bold'}"
      >
        {step.number} /
      </span>
      <h3
        class="mt-5 font-bold {compact
          ? 'text-lg text-slate-900 dark:text-slate-100'
          : 'text-xl text-slate-950 dark:text-white'}"
      >
        {step.title}
      </h3>
      <p
        class="leading-relaxed text-slate-600 dark:text-slate-400 {compact
          ? 'mt-2 text-sm'
          : 'mt-3'}"
      >
        {step.description}
      </p>
    </li>
  {/each}
</ol>
