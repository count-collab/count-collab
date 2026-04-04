<script lang="ts">
  import { fade } from "svelte/transition";
  import CounterBadges from "$lib/components/CounterBadges.svelte";
  import type { Counter, CounterVisibilityMode } from "$lib/db/schema";
  import RollingNumber from "./RollingNumber.svelte";
  import Sparkline from "./Sparkline.svelte";

  type Props = {
    counter: Counter;
    showBadges?: boolean;
  };

  const { counter, showBadges = false }: Props = $props();
  const visibilityBadgeClasses: Record<CounterVisibilityMode, string> = {
    public: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-700/60",
    public_readonly: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/70 dark:bg-amber-900/30 dark:text-amber-400 dark:ring-amber-700/70",
    private: "bg-slate-50 text-slate-500 ring-1 ring-slate-200/60 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-600/60",
  };

  let activateTimeout = $state<ReturnType<typeof setTimeout> | null>(null);
  let isActive = $state(false);

  function getVisibilityMode(counter: Counter): CounterVisibilityMode {
    return counter.visibilityMode ?? (counter.isPublic ? "public" : "private");
  }

  const visibilityMode = $derived(getVisibilityMode(counter));

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
  class="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-5 shadow-sm ring-1 ring-transparent transition-all duration-200 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-lg hover:ring-blue-100 dark:hover:ring-blue-900 hover:-translate-y-0.5 will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
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
    class="relative text-3xl font-extrabold text-blue-600 dark:text-blue-400 mb-1"
  >
    <RollingNumber value={counter.count} />
  </span>
  <span class="relative font-semibold text-slate-900 dark:text-slate-100 truncate">{counter.title}</span>
  <span class="relative text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate min-h-5"
    >{counter.description ?? ""}</span
  >
  {#if showBadges}
    <CounterBadges
      visibilityMode={visibilityMode}
      ownership={counter.ownerId ? "owner" : "shared"}
      containerClass="relative flex gap-1.5 mt-2"
      visibilityBadgeBaseClass="text-xs font-medium px-2 py-0.5 rounded-full"
      visibilityBadgeClasses={visibilityBadgeClasses}
    />
  {/if}
</a>

