<script lang="ts">
  type Props = {
    page: number;
    totalPages: number;
    baseUrl: string;
    extraParams?: Record<string, string>;
  };

  const { page, totalPages, baseUrl, extraParams = {} }: Props = $props();

  function buildHref(p: number): string {
    const params = new URLSearchParams(extraParams);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `${baseUrl}?${qs}` : baseUrl;
  }

  const pages = $derived.by(() => {
    const items: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) items.push(i);
    } else {
      items.push(1);
      if (page > 3) items.push("...");
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) items.push(i);
      if (page < totalPages - 2) items.push("...");
      items.push(totalPages);
    }
    return items;
  });
</script>

{#if totalPages > 1}
  <nav aria-label="Pagination" class="flex items-center justify-center gap-1">
    {#if page > 1}
      <a
        href={buildHref(page - 1)}
        class="px-3 py-1.5 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 transition"
      >
        &larr; Prev
      </a>
    {/if}

    {#each pages as item}
      {#if item === "..."}
        <span class="px-2 py-1.5 text-sm text-slate-400 dark:text-slate-500">&hellip;</span>
      {:else if item === page}
        <span
          class="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white font-medium"
        >
          {item}
        </span>
      {:else}
        <a
          href={buildHref(item)}
          class="px-3 py-1.5 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 transition"
        >
          {item}
        </a>
      {/if}
    {/each}

    {#if page < totalPages}
      <a
        href={buildHref(page + 1)}
        class="px-3 py-1.5 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 transition"
      >
        Next &rarr;
      </a>
    {/if}
  </nav>
{/if}
