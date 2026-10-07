<script lang="ts">
  import { untrack } from "svelte";
  import FullscreenOverlay from "$lib/components/FullscreenOverlay.svelte";
  import OwnerFilter from "$lib/components/OwnerFilter.svelte";
  import type { CounterVisibilityMode } from "$lib/db/schema";
  import {
    collectTeams,
    matchesOwnerFilter,
    type OwnerFilterValue,
  } from "$lib/utils/owner-filter";

  type SearchResult = {
    id: string;
    title: string;
    description: string | null;
    count: number;
    visibilityMode: CounterVisibilityMode;
    ownerId: string | null;
    teamId: string | null;
    teamName: string | null;
    /** Personally owned or owned by one of the user's teams. */
    isMine: boolean;
    onDashboard: boolean;
  };

  type Scope = "mine" | "others";

  let {
    open = $bindable(),
    dashboardId,
    existingCounterIds,
    onAdd,
  }: {
    open: boolean;
    dashboardId: string;
    existingCounterIds: string[];
    onAdd: (counterId: string) => void;
  } = $props();

  const uid = $props.id();
  const scopeLimits: Record<Scope, number> = { mine: 50, others: 20 };

  const visibilityBadgeClasses: Record<CounterVisibilityMode, string> = {
    public:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    public_readonly:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    private:
      "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  };

  const visibilityLabels: Record<CounterVisibilityMode, string> = {
    public: "Public",
    public_readonly: "Read-only",
    private: "Private",
  };

  class ApiError extends Error {}

  let query = $state("");
  let suggestedMine = $state<SearchResult[]>([]);
  let suggestedOthers = $state<SearchResult[]>([]);
  let resultMine = $state<SearchResult[]>([]);
  let resultOthers = $state<SearchResult[]>([]);
  let loadingSuggestions = $state(false);
  let searching = $state(false);
  let hasSearched = $state(false);
  let error = $state<string | null>(null);
  let addedIds = $state<Set<string>>(new Set());
  let ownerFilter = $state<OwnerFilterValue>("all");
  let searchInput = $state<HTMLInputElement | null>(null);
  let suggestionsSeq = 0;
  let searchSeq = 0;

  const isAdded = (r: SearchResult) =>
    addedIds.has(r.id) || existingCounterIds.includes(r.id) || r.onDashboard;

  const teams = $derived(collectTeams([...suggestedMine, ...resultMine]));
  // Fall back to "all" if the filter control disappears (no team counters loaded)
  const activeFilter = $derived(teams.length > 0 ? ownerFilter : "all");
  const mineItems = $derived(hasSearched ? resultMine : suggestedMine);
  const filteredMine = $derived(
    mineItems.filter((r) => matchesOwnerFilter(r, activeFilter)),
  );
  const otherItems = $derived(hasSearched ? resultOthers : suggestedOthers);
  const isLoading = $derived(
    !hasSearched && (loadingSuggestions || searching),
  );

  $effect(() => {
    if (!open) return;
    untrack(() => {
      query = "";
      suggestedMine = [];
      suggestedOthers = [];
      resultMine = [];
      resultOthers = [];
      hasSearched = false;
      error = null;
      addedIds = new Set();
      ownerFilter = "all";
      loadSuggestions();
    });
    // Runs after FullscreenOverlay's own focus handling
    const timer = setTimeout(() => searchInput?.focus(), 0);
    return () => clearTimeout(timer);
  });

  $effect(() => {
    const q = query.trim();
    searchSeq++;

    if (!q) {
      resultMine = [];
      resultOthers = [];
      hasSearched = false;
      searching = false;
      error = null;
      return;
    }

    searching = true;
    const timer = setTimeout(() => search(q), 300);
    return () => clearTimeout(timer);
  });

  async function fetchScope(scope: Scope, q: string): Promise<SearchResult[]> {
    const params = new URLSearchParams({
      scope,
      limit: String(scopeLimits[scope]),
    });
    if (q) params.set("q", q);
    const response = await fetch(
      `/api/dashboards/${dashboardId}/search-counters?${params}`,
    );
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new ApiError(
        body.error ?? body.message ?? "Failed to search counters.",
      );
    }
    const data: { items: SearchResult[] } = await response.json();
    return data.items;
  }

  function fetchBoth(q: string) {
    return Promise.all([fetchScope("mine", q), fetchScope("others", q)]);
  }

  function errorMessage(e: unknown) {
    return e instanceof ApiError ? e.message : "Network error. Please try again.";
  }

  async function loadSuggestions() {
    const seq = ++suggestionsSeq;
    loadingSuggestions = true;
    try {
      const [mine, others] = await fetchBoth("");
      if (seq !== suggestionsSeq) return;
      suggestedMine = mine;
      suggestedOthers = others;
    } catch (e) {
      if (seq === suggestionsSeq) error = errorMessage(e);
    } finally {
      if (seq === suggestionsSeq) loadingSuggestions = false;
    }
  }

  async function search(q: string) {
    const seq = ++searchSeq;
    error = null;
    try {
      const [mine, others] = await fetchBoth(q);
      if (seq !== searchSeq) return;
      resultMine = mine;
      resultOthers = others;
      hasSearched = true;
    } catch (e) {
      if (seq === searchSeq) error = errorMessage(e);
    } finally {
      if (seq === searchSeq) searching = false;
    }
  }

  function handleAdd(result: SearchResult) {
    if (isAdded(result)) return;
    addedIds = new Set([...addedIds, result.id]);
    onAdd(result.id);
  }
</script>

{#snippet counterRow(result: SearchResult)}
  <li
    class="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-700/50"
  >
    <div class="min-w-0 flex-1">
      <p
        class="truncate text-base font-semibold text-slate-900 dark:text-slate-100"
      >
        {result.title}
      </p>
      {#if result.description}
        <p class="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
          {result.description}
        </p>
      {/if}
      <div class="mt-2 flex flex-wrap items-center gap-2">
        <span
          class="text-sm font-semibold tabular-nums text-blue-600 dark:text-blue-400"
        >
          {result.count.toLocaleString()}
        </span>
        <span
          class="rounded-full px-2 py-0.5 text-xs {visibilityBadgeClasses[
            result.visibilityMode
          ]}"
        >
          {visibilityLabels[result.visibilityMode]}
        </span>
        {#if result.teamId}
          <span
            class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-300"
          >
            <ion-icon name="people-outline" aria-hidden="true"></ion-icon>
            <span class="sr-only">Team:</span>
            {result.teamName ?? "Team"}
          </span>
        {/if}
      </div>
    </div>
    {#if isAdded(result)}
      <span
        class="inline-flex shrink-0 items-center gap-1 px-4 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400"
      >
        <ion-icon name="checkmark-circle" aria-hidden="true" style="font-size: 18px;"
        ></ion-icon>
        Added
      </span>
    {:else}
      <button
        type="button"
        onclick={() => handleAdd(result)}
        aria-label="Add {result.title}"
        class="inline-flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
      >
        <ion-icon name="add-outline" aria-hidden="true" style="font-size: 18px;"
        ></ion-icon>
        Add
      </button>
    {/if}
  </li>
{/snippet}

{#snippet emptyText(text: string)}
  <p
    class="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400"
  >
    {text}
  </p>
{/snippet}

<FullscreenOverlay bind:open title="Add Counter" maxWidth="max-w-3xl">
  <div class="relative">
    <ion-icon
      name="search-outline"
      aria-hidden="true"
      class="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
      style="font-size: 24px;"
    ></ion-icon>
    <input
      bind:this={searchInput}
      bind:value={query}
      type="text"
      placeholder="Search counters…"
      aria-label="Search counters"
      class="w-full border-0 border-b-2 border-slate-300 bg-transparent py-2 pl-9 pr-9 text-xl font-semibold text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-0 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 sm:text-2xl"
    />
    {#if searching}
      <span
        role="status"
        aria-label="Searching"
        class="absolute right-0 top-1/2 flex -translate-y-1/2 text-slate-400 dark:text-slate-500"
      >
        <ion-icon
          name="sync-outline"
          aria-hidden="true"
          class="animate-spin"
          style="font-size: 20px;"
        ></ion-icon>
      </span>
    {/if}
  </div>

  {#if error}
    <p role="alert" class="text-sm text-red-600 dark:text-red-400">{error}</p>
  {:else if isLoading}
    <p class="text-sm text-slate-500 dark:text-slate-400">Loading counters…</p>
  {:else}
    <section class="space-y-4" aria-labelledby="{uid}-mine">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h3
          id="{uid}-mine"
          class="text-lg font-semibold text-slate-900 dark:text-slate-100"
        >
          Your Counters
        </h3>
        {#if teams.length > 0}
          <OwnerFilter bind:value={ownerFilter} {teams} />
        {/if}
      </div>
      {#if mineItems.length === 0}
        {@render emptyText(
          hasSearched
            ? "None of your counters match this search."
            : "You don't have any counters yet.",
        )}
      {:else if filteredMine.length === 0}
        {@render emptyText("No counters in this filter.")}
      {:else}
        <ul class="space-y-3">
          {#each filteredMine as result (result.id)}
            {@render counterRow(result)}
          {/each}
        </ul>
      {/if}
    </section>

    <section class="space-y-4" aria-labelledby="{uid}-others">
      <h3
        id="{uid}-others"
        class="text-lg font-semibold text-slate-900 dark:text-slate-100"
      >
        {hasSearched ? "Other Counters" : "Popular"}
      </h3>
      {#if otherItems.length === 0}
        {@render emptyText(
          hasSearched
            ? "No other counters match this search."
            : "No popular counters to show.",
        )}
      {:else}
        <ul class="space-y-3">
          {#each otherItems as result (result.id)}
            {@render counterRow(result)}
          {/each}
        </ul>
      {/if}
    </section>
  {/if}

  {#snippet footer()}
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
        {#if addedIds.size > 0}
          {addedIds.size} added
        {/if}
      </p>
      <button
        type="button"
        onclick={() => (open = false)}
        class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
      >
        Done
      </button>
    </div>
  {/snippet}
</FullscreenOverlay>
