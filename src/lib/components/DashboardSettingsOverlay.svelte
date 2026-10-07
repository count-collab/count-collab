<script lang="ts">
  import FullscreenOverlay from "$lib/components/FullscreenOverlay.svelte";
  import TransferOwnershipSection from "$lib/components/TransferOwnershipSection.svelte";
  import {
    DASHBOARD_MAX_GRID_COLUMNS,
    DASHBOARD_MIN_GRID_COLUMNS,
  } from "$lib/dashboard-grid";
  import type { DashboardVisibilityMode } from "$lib/db/schema";

  let {
    open = $bindable(),
    dashboard,
    canTransfer = false,
    team = null,
    transferTargets = [],
    dashboardCounters = [],
    onsave,
  }: {
    open: boolean;
    dashboard: {
      id: string;
      title: string;
      description: string | null;
      visibilityMode: DashboardVisibilityMode;
      gridColumns: number;
    };
    canTransfer?: boolean;
    team?: { id: string; name: string } | null;
    transferTargets?: { id: string; name: string }[];
    dashboardCounters?: {
      id: string;
      title: string | null;
      teamId: string | null;
      owned: boolean;
    }[];
    onsave?: () => void;
  } = $props();

  let title = $state("");
  let description = $state("");
  let visibilityMode = $state<DashboardVisibilityMode>("public");
  let gridColumns = $state(DASHBOARD_MAX_GRID_COLUMNS);
  let isSaving = $state(false);
  let saveError = $state("");

  // Initialize local state from dashboard prop when overlay opens
  $effect(() => {
    if (open) {
      title = dashboard.title;
      description = dashboard.description ?? "";
      visibilityMode = dashboard.visibilityMode;
      gridColumns = dashboard.gridColumns;
      isSaving = false;
      saveError = "";
    }
  });

  function close() {
    open = false;
  }

  async function handleSave() {
    if (isSaving || !title.trim()) return;
    isSaving = true;
    saveError = "";

    try {
      const res = await fetch(`/api/dashboards/${dashboard.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          visibility: visibilityMode,
          gridColumns,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        saveError =
          body.error ?? body.message ?? "Failed to save dashboard settings.";
        return;
      }

      onsave?.();
      close();
    } catch {
      saveError = "Network error. Please try again.";
    } finally {
      isSaving = false;
    }
  }

  const visibilityOptions: {
    value: DashboardVisibilityMode;
    label: string;
    icon: string;
    desc: string;
  }[] = [
    {
      value: "public",
      label: "Public",
      icon: "globe-outline",
      desc: "Anyone with the link can view",
    },
    {
      value: "private",
      label: "Private",
      icon: "lock-closed-outline",
      desc: "Only invited members or people with the private link can access",
    },
  ];

  const columnOptions = Array.from(
    { length: DASHBOARD_MAX_GRID_COLUMNS - DASHBOARD_MIN_GRID_COLUMNS + 1 },
    (_, i) => DASHBOARD_MIN_GRID_COLUMNS + i,
  );
</script>

<FullscreenOverlay bind:open title="Dashboard Settings">
        <!-- Section 1: Name & Description -->
        <section class="space-y-4">
          <div class="space-y-4">
            <input
              type="text"
              bind:value={title}
              placeholder="Give it a name..."
              required
              class="w-full bg-transparent border-0 border-b-2 border-slate-300 dark:border-slate-600 text-2xl font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-0 py-2 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-0"
            />
            <input
              type="text"
              bind:value={description}
              placeholder="Add a description (optional)"
              class="w-full bg-transparent border-0 border-b-2 border-slate-300 dark:border-slate-600 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-0 py-1 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-0"
            />
          </div>
        </section>

        <!-- Section 2: Visibility -->
        <section class="space-y-4">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Visibility
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {#each visibilityOptions as opt}
              <button
                type="button"
                onclick={() => (visibilityMode = opt.value)}
                class="flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all cursor-pointer
                {visibilityMode === opt.value
                  ? 'ring-2 ring-blue-600 dark:ring-blue-400 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'}"
              >
                <ion-icon
                  name={opt.icon}
                  class="text-3xl text-blue-600 dark:text-blue-400"
                ></ion-icon>
                <span
                  class="text-base font-semibold text-slate-900 dark:text-slate-100"
                  >{opt.label}</span
                >
                <span
                  class="text-sm text-slate-600 dark:text-slate-400 text-center"
                  >{opt.desc}</span
                >
              </button>
            {/each}
          </div>
        </section>

        <!-- Section 3: Layout -->
        <section class="space-y-4">
          <div class="space-y-1">
            <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Layout
            </h3>
            <p class="text-sm text-slate-600 dark:text-slate-400">
              Number of columns on larger screens. Counters that no longer fit
              are moved to the next free spot.
            </p>
          </div>
          <div class="grid grid-cols-4 gap-3" role="radiogroup" aria-label="Columns">
            {#each columnOptions as cols (cols)}
              <button
                type="button"
                role="radio"
                aria-checked={gridColumns === cols}
                aria-label="{cols} columns"
                onclick={() => (gridColumns = cols)}
                class="flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all cursor-pointer
                {gridColumns === cols
                  ? 'ring-2 ring-blue-600 dark:ring-blue-400 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'}"
              >
                <span class="flex h-6 w-full gap-0.5" aria-hidden="true">
                  {#each { length: cols }, i (i)}
                    <span
                      class="flex-1 rounded-sm {gridColumns === cols
                        ? 'bg-blue-400 dark:bg-blue-500'
                        : 'bg-slate-300 dark:bg-slate-600'}"
                    ></span>
                  {/each}
                </span>
                <span
                  class="text-base font-semibold text-slate-900 dark:text-slate-100"
                  >{cols}</span
                >
              </button>
            {/each}
          </div>
        </section>

        {#if canTransfer}
          <TransferOwnershipSection
            type="dashboard"
            entityId={dashboard.id}
            {team}
            {transferTargets}
            {dashboardCounters}
            ontransferred={close}
          />
        {/if}

  {#snippet footer()}
    <div class="space-y-2">
      {#if saveError}
        <p class="text-sm text-red-600 dark:text-red-400">{saveError}</p>
      {/if}
      <div class="flex items-center justify-end gap-3">
        <button
          type="button"
          onclick={close}
          class="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onclick={handleSave}
          disabled={isSaving || !title.trim()}
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {#if isSaving}
            Saving…
          {:else}
            Save changes
          {/if}
        </button>
      </div>
    </div>
  {/snippet}
</FullscreenOverlay>
