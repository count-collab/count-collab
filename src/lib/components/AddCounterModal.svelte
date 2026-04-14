<script lang="ts">
  import Modal from "$lib/components/Modal.svelte";
  import type { CounterVisibilityMode } from "$lib/db/schema";

  type SearchResult = {
    id: string;
    title: string;
    description: string | null;
    count: number;
    visibilityMode: CounterVisibilityMode;
    ownerId: string | null;
  };

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

  let query = $state("");
  let results = $state<SearchResult[]>([]);
  let suggestions = $state<SearchResult[]>([]);
  let currentUserId = $state<string | null>(null);
  let loading = $state(false);
  let loadingSuggestions = $state(false);
  let error = $state<string | null>(null);
  let hasSearched = $state(false);
  let addedCounterId = $state<string | null>(null);
  let justAddedIds = $state<Set<string>>(new Set());
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let searchInput = $state<HTMLInputElement | null>(null);

  const filteredResults = $derived(
    results.filter(
      (r) => !existingCounterIds.includes(r.id) || justAddedIds.has(r.id),
    ),
  );

  const filteredSuggestions = $derived(
    suggestions.filter(
      (r) => !existingCounterIds.includes(r.id) || justAddedIds.has(r.id),
    ),
  );

  const ownedSuggestions = $derived(
    currentUserId
      ? filteredSuggestions.filter((r) => r.ownerId === currentUserId)
      : [],
  );

  const popularSuggestions = $derived(
    currentUserId
      ? filteredSuggestions.filter((r) => r.ownerId !== currentUserId)
      : filteredSuggestions,
  );

  $effect(() => {
    if (open) {
      query = "";
      results = [];
      suggestions = [];
      currentUserId = null;
      error = null;
      hasSearched = false;
      addedCounterId = null;
      justAddedIds = new Set();
      setTimeout(() => searchInput?.focus(), 50);
      fetchSuggestions();
    }
  });

  $effect(() => {
    const q = query.trim();

    if (debounceTimer) clearTimeout(debounceTimer);

    if (!q) {
      results = [];
      hasSearched = false;
      loading = false;
      return;
    }

    loading = true;
    debounceTimer = setTimeout(() => {
      fetchResults(q);
    }, 300);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  });

  async function fetchSuggestions() {
    loadingSuggestions = true;
    try {
      const response = await fetch(
        `/api/dashboards/${dashboardId}/search-counters?limit=20`,
      );
      if (response.ok) {
        const data: { items: SearchResult[]; userId: string } =
          await response.json();
        suggestions = data.items;
        currentUserId = data.userId;
      }
    } catch {
      // silently fail for suggestions
    } finally {
      loadingSuggestions = false;
    }
  }

  async function fetchResults(q: string) {
    error = null;
    try {
      const response = await fetch(
        `/api/dashboards/${dashboardId}/search-counters?q=${encodeURIComponent(q)}&limit=10`,
      );
      if (!response.ok) {
        const body = await response.json();
        error = body.error ?? "Failed to search counters.";
        return;
      }
      const data: { items: SearchResult[]; userId: string } =
        await response.json();
      results = data.items;
      currentUserId = data.userId;
      hasSearched = true;
    } catch {
      error = "Network error. Please try again.";
    } finally {
      loading = false;
    }
  }

  function handleAdd(counterId: string) {
    addedCounterId = counterId;
    justAddedIds = new Set([...justAddedIds, counterId]);
    onAdd(counterId);
    setTimeout(() => {
      if (addedCounterId === counterId) addedCounterId = null;
      justAddedIds = new Set(
        [...justAddedIds].filter((id) => id !== counterId),
      );
      results = results.filter((r) => r.id !== counterId);
      suggestions = suggestions.filter((r) => r.id !== counterId);
    }, 1500);
  }
</script>

{#snippet counterRow(result: SearchResult)}
  <li
    class="flex items-center gap-3 px-3 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition"
  >
    <div class="flex-1 min-w-0">
      <p
        class="text-sm font-medium text-slate-700 dark:text-slate-300 truncate"
      >
        {result.title}
      </p>
      {#if result.description}
        <p class="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
          {result.description}
        </p>
      {/if}
      <div class="flex items-center gap-2 mt-1">
        <span
          class="text-xs font-semibold tabular-nums text-blue-600 dark:text-blue-400"
        >
          {result.count.toLocaleString()}
        </span>
        <span
          class="text-xs px-1.5 py-0.5 rounded-full {visibilityBadgeClasses[
            result.visibilityMode
          ]}"
        >
          {visibilityLabels[result.visibilityMode]}
        </span>
      </div>
    </div>
    {#if addedCounterId === result.id}
      <span
        class="shrink-0 px-3 py-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1"
      >
        <ion-icon name="checkmark-circle" style="font-size: 16px;"></ion-icon>
        Added
      </span>
    {:else}
      <button
        type="button"
        onclick={() => handleAdd(result.id)}
        class="shrink-0 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
      >
        <ion-icon name="add-outline" style="font-size: 16px;"></ion-icon>
        Add
      </button>
    {/if}
  </li>
{/snippet}

<Modal bind:open title="Add Counter" maxWidth="max-w-2xl">
  <div class="space-y-4">
    <div class="relative">
      <svg
        class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        viewBox="0 0 24 24"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        bind:this={searchInput}
        bind:value={query}
        type="text"
        placeholder="Search counters..."
        class="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      {#if loading}
        <div class="absolute right-3 top-1/2 -translate-y-1/2">
          <ion-icon
            name="sync-outline"
            style="font-size: 16px;"
            class="text-slate-400 dark:text-slate-500 animate-spin"
          ></ion-icon>
        </div>
      {/if}
    </div>

    {#if error}
      <p class="text-sm text-red-600 dark:text-red-400">{error}</p>
    {:else if hasSearched && filteredResults.length === 0 && !loading}
      <div class="py-6 text-center">
        <ion-icon
          name="search-outline"
          style="font-size: 32px;"
          class="text-slate-300 dark:text-slate-600 mb-2"
        ></ion-icon>
        <p class="text-sm text-slate-400 dark:text-slate-500">
          No counters found. Try a different search.
        </p>
      </div>
    {:else if hasSearched && filteredResults.length > 0}
      <ul
        class="max-h-[28rem] overflow-y-auto overflow-x-hidden divide-y divide-slate-100 dark:divide-slate-700/50 -mx-1"
      >
        {#each filteredResults as result (result.id)}
          {@render counterRow(result)}
        {/each}
      </ul>
    {:else if !hasSearched && !loading}
      <div class="max-h-[28rem] overflow-y-auto overflow-x-hidden space-y-4">
        {#if loadingSuggestions}
          <p class="text-sm text-slate-400 dark:text-slate-500">
            Loading suggestions...
          </p>
        {:else if ownedSuggestions.length > 0}
          <div>
            <p
              class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 px-1"
            >
              Your Counters
            </p>
            <ul
              class="divide-y divide-slate-100 dark:divide-slate-700/50 -mx-1"
            >
              {#each ownedSuggestions as result (result.id)}
                {@render counterRow(result)}
              {/each}
            </ul>
          </div>
        {/if}
        {#if !loadingSuggestions && popularSuggestions.length > 0}
          <div>
            <p
              class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 px-1"
            >
              Popular Counters
            </p>
            <ul
              class="divide-y divide-slate-100 dark:divide-slate-700/50 -mx-1"
            >
              {#each popularSuggestions as result (result.id)}
                {@render counterRow(result)}
              {/each}
            </ul>
          </div>
        {/if}
        {#if !loadingSuggestions && filteredSuggestions.length === 0}
          <p class="text-sm text-slate-400 dark:text-slate-500">
            No counters available to add.
          </p>
        {/if}
      </div>
    {/if}
  </div>
</Modal>
