<script lang="ts">
  import type { Snippet } from "svelte";

  type Column = {
    key: string;
    label: string;
    sortable?: boolean;
    align?: "left" | "right";
  };

  type Props = {
    columns: Column[];
    currentSort?: string;
    currentOrder?: "asc" | "desc";
    baseUrl: string;
    extraParams?: Record<string, string>;
    rows: Snippet;
  };

  const {
    columns,
    currentSort,
    currentOrder = "asc",
    baseUrl,
    extraParams = {},
    rows,
  }: Props = $props();

  function sortHref(columnKey: string): string {
    const params = new URLSearchParams(extraParams);
    params.set("sort", columnKey);
    params.set("order", currentSort === columnKey && currentOrder === "asc" ? "desc" : "asc");
    return `${baseUrl}?${params.toString()}`;
  }
</script>

<div class="overflow-x-auto rounded-lg bg-white shadow dark:bg-slate-800 dark:shadow-slate-900/50">
  <table class="w-full min-w-[600px] text-sm">
    <thead class="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
      <tr>
        {#each columns as col (col.key)}
          <th
            class="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 {col.align === 'right' ? 'text-right' : 'text-left'}"
          >
            {#if col.sortable}
              <a
                href={sortHref(col.key)}
                class="group inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
              >
                {col.label}
                {#if currentSort === col.key}
                  <span class="text-xs">{currentOrder === "asc" ? "▲" : "▼"}</span>
                {:else}
                  <span
                    class="text-xs text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-500"
                    >▲</span
                  >
                {/if}
              </a>
            {:else}
              {col.label}
            {/if}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody class="divide-y divide-slate-200 dark:divide-slate-700">
      {@render rows()}
    </tbody>
  </table>
</div>
