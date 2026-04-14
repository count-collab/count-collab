<script lang="ts">
  import type { FaqItem } from "$lib/data/faq";

  const { items }: { items: FaqItem[] } = $props();

  let openIndex = $state<number | null>(null);

  function toggle(index: number) {
    openIndex = openIndex === index ? null : index;
  }
</script>

<div class="divide-y divide-slate-200 dark:divide-slate-700 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60">
  {#each items as item, i (item.question)}
    <div>
      <button
        type="button"
        onclick={() => toggle(i)}
        class="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
        aria-expanded={openIndex === i}
      >
        <span class="text-base font-semibold text-slate-900 dark:text-slate-100">
          {item.question}
        </span>
        <svg
          class="h-5 w-5 shrink-0 text-slate-400 dark:text-slate-500 transition-transform duration-200 {openIndex === i ? 'rotate-180' : ''}"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2.5"
        >
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {#if openIndex === i}
        <div class="px-6 pb-5 text-slate-600 dark:text-slate-400 leading-relaxed">
          {item.answer}
        </div>
      {/if}
    </div>
  {/each}
</div>
