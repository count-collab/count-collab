<script lang="ts">
  import type { Counter } from "$lib/db/schema";

  type Props = {
    counter: Counter;
    showBadges?: boolean;
  };

  const { counter, showBadges = false }: Props = $props();
</script>

<a
  href={`/c/${counter.id}`}
  class="flex flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-400 hover:shadow-md"
>
  <span class="text-3xl font-bold text-blue-600 mb-2">
    {counter.count.toLocaleString()}
  </span>
  <span class="font-semibold text-slate-900 truncate">{counter.title}</span>
  {#if counter.description}
    <span class="text-sm text-slate-500 mt-0.5 line-clamp-2"
      >{counter.description}</span
    >
  {/if}
  {#if showBadges}
    <div class="flex gap-1.5 mt-2">
      <span
        class="text-xs px-2 py-0.5 rounded-full {counter.isPublic
          ? 'bg-green-100 text-green-700'
          : 'bg-slate-100 text-slate-600'}"
      >
        {counter.isPublic ? "Public" : "Private"}
      </span>
      {#if counter.ownerId}
        <span class="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700"
          >Owned</span
        >
      {:else}
        <span
          class="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
          >Shared</span
        >
      {/if}
    </div>
  {/if}
</a>
