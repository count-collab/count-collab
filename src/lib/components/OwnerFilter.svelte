<script lang="ts">
  import type { OwnerFilterValue } from "$lib/utils/owner-filter";

  let {
    value = $bindable(),
    teams,
  }: {
    value: OwnerFilterValue;
    teams: { id: string; name: string }[];
  } = $props();

  const options = $derived([
    { value: "all", label: "All" },
    { value: "personal", label: "Personal" },
    ...teams.map((t) => ({ value: t.id, label: t.name })),
  ]);
</script>

<div
  class="inline-flex flex-wrap rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-1"
  role="group"
  aria-label="Filter by owner"
>
  {#each options as option (option.value)}
    <button
      type="button"
      onclick={() => (value = option.value)}
      aria-pressed={value === option.value}
      class="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors {value ===
      option.value
        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}"
    >
      {#if option.value !== "all" && option.value !== "personal"}
        <ion-icon name="people-outline" aria-hidden="true"></ion-icon>
      {/if}
      {option.label}
    </button>
  {/each}
</div>
