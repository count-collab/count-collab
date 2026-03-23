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
  class="group relative flex flex-col rounded-xl border border-slate-200/80 bg-white/80 backdrop-blur-sm p-5 shadow-sm ring-1 ring-transparent transition-all duration-200 hover:border-blue-300 hover:shadow-lg hover:ring-blue-100 hover:-translate-y-0.5 will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
>
  <span
    class="text-3xl font-extrabold bg-gradient-to-br from-blue-600 to-indigo-500 bg-clip-text text-transparent mb-1"
  >
    {counter.count.toLocaleString()}
  </span>
  <span class="font-semibold text-slate-900 truncate">{counter.title}</span>
  {#if counter.description}
    <span class="text-sm text-slate-500 mt-0.5 truncate"
      >{counter.description}</span
    >
  {/if}
  {#if showBadges}
    <div class="flex gap-1.5 mt-2">
      <span
        class="text-xs font-medium px-2 py-0.5 rounded-full {counter.isPublic
          ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60'
          : 'bg-slate-50 text-slate-500 ring-1 ring-slate-200/60'}"
      >
        {counter.isPublic ? "Public" : "Private"}
      </span>
      {#if counter.ownerId}
        <span class="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700"
          >Owned</span
        >
      {:else}
        <span
          class="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700"
          >Shared</span
        >
      {/if}
    </div>
  {/if}
</a>
