<script lang="ts">
  import { fade } from "svelte/transition";
  import type { Counter } from "$lib/db/schema";
  import Sparkline from "./Sparkline.svelte";

  type Props = {
    counter: Counter;
    showBadges?: boolean;
  };

  const { counter, showBadges = false }: Props = $props();

  let activateTimeout = $state<ReturnType<typeof setTimeout> | null>(null);
  let isActive = $state(false);

  function activate() {
    if (isActive) return;
    activateTimeout = setTimeout(() => {
      isActive = true;
    }, 150);
  }

  function deactivate() {
    if (activateTimeout) {
      clearTimeout(activateTimeout);
      activateTimeout = null;
    }
    isActive = false;
  }
</script>

<a
  href={`/c/${counter.id}`}
  class="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white/80 backdrop-blur-sm p-5 shadow-sm ring-1 ring-transparent transition-all duration-200 hover:border-blue-300 hover:shadow-lg hover:ring-blue-100 hover:-translate-y-0.5 will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
  onmouseenter={activate}
  onmouseleave={deactivate}
  onfocusin={activate}
  onfocusout={deactivate}
>
  <!-- Sparkline background overlay -->
  {#if isActive}
    <div
      class="absolute inset-x-0 bottom-0 h-3/5 pointer-events-none transition-opacity duration-300"
      transition:fade={{ duration: 400 }}
    >
      <Sparkline counterId={counter.id} />
    </div>
  {/if}

  <span
    class="relative text-3xl font-extrabold bg-gradient-to-br from-blue-600 to-indigo-500 bg-clip-text text-transparent mb-1"
  >
    {counter.count.toLocaleString()}
  </span>
  <span class="relative font-semibold text-slate-900 truncate">{counter.title}</span>
  <span class="relative text-sm text-slate-500 mt-0.5 truncate min-h-5"
    >{counter.description ?? ""}</span
  >
  {#if showBadges}
    <div class="relative flex gap-1.5 mt-2">
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

