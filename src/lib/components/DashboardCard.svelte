<script lang="ts">
  import { page } from "$app/stores";
  import { fade } from "svelte/transition";

  type Props = {
    dashboard: {
      id: string;
      title: string;
      description: string | null;
      visibilityMode: string;
      ownerId?: string | null;
      followerCount?: number;
    };
    showBadges?: boolean;
    followed?: boolean;
  };

  const { dashboard, showBadges = false, followed = false }: Props = $props();

  const userId = $derived($page.data.session?.user?.id);
  const isOwner = $derived(userId != null && dashboard.ownerId === userId);

  const visibilityBadgeClasses: Record<string, string> = {
    public:
      "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-700/60",
    private:
      "bg-slate-50 text-slate-500 ring-1 ring-slate-200/60 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-600/60",
  };

  const visibilityLabels: Record<string, string> = {
    public: "Public",
    private: "Private",
  };

  let isHovered = $state(false);
  let hoverTimeout = $state<ReturnType<typeof setTimeout> | null>(null);

  function activate() {
    if (isHovered) return;
    hoverTimeout = setTimeout(() => {
      isHovered = true;
    }, 150);
  }

  function deactivate() {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }
    isHovered = false;
  }
</script>

<a
  href={`/d/${dashboard.id}`}
  class="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-5 shadow-sm ring-1 ring-transparent transition-all duration-200 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-lg hover:ring-blue-100 dark:hover:ring-blue-900 hover:-translate-y-0.5 will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
  onmouseenter={activate}
  onmouseleave={deactivate}
  onfocusin={activate}
  onfocusout={deactivate}
>
  <!-- Grid icon on hover -->
  {#if isHovered}
    <div
      class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04] dark:opacity-[0.06] transition-opacity duration-300"
      transition:fade={{ duration: 400 }}
    >
      <ion-icon name="grid-outline" style="font-size: 96px;"></ion-icon>
    </div>
  {/if}

  <span
    class="relative font-semibold text-slate-900 dark:text-slate-100 truncate"
  >
    {dashboard.title}
  </span>
  <span
    class="relative text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate min-h-5"
  >
    {dashboard.description ?? ""}
  </span>

  {#if dashboard.followerCount != null}
    <div
      class="relative flex items-center gap-1 mt-2 text-xs text-slate-500 dark:text-slate-400"
    >
      <ion-icon name="people-outline" style="font-size: 14px;"></ion-icon>
      <span
        >{dashboard.followerCount}
        {dashboard.followerCount === 1 ? "follower" : "followers"}</span
      >
    </div>
  {/if}

  {#if showBadges || followed}
    <div class="relative flex flex-wrap gap-1.5 mt-2">
      {#if showBadges}
        <span
          class="text-xs font-medium px-2 py-0.5 rounded-full {visibilityBadgeClasses[
            dashboard.visibilityMode
          ] ?? ''}"
        >
          {visibilityLabels[dashboard.visibilityMode] ??
            dashboard.visibilityMode}
        </span>
        {#if !followed}
          {#if isOwner}
            <span
              class="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-200/60 dark:bg-blue-900/30 dark:text-blue-400 dark:ring-blue-700/60"
              >Owner</span
            >
          {:else}
            <span
              class="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 ring-1 ring-slate-200/60 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600/60"
              >Shared</span
            >
          {/if}
        {/if}
      {/if}
      {#if followed}
        <span
          class="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 ring-1 ring-purple-200/60 dark:bg-purple-900/30 dark:text-purple-400 dark:ring-purple-700/60"
        >
          Followed
        </span>
      {/if}
    </div>
  {/if}
</a>
