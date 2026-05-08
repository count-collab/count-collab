<script lang="ts">
  import { untrack } from "svelte";
  import { browser } from "$app/environment";
  import { goto, invalidate } from "$app/navigation";
  import CounterCard from "$lib/components/CounterCard.svelte";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import Pagination from "$lib/components/Pagination.svelte";
  import { onCounterCreated, onCounterUpdated } from "$lib/stores/counters";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();
  const currentQuery = $derived(data.query);
  const currentSort = $derived(data.sort);
  let search = $state("");
  let sort = $state("popular");

  $effect(() => {
    const nextQuery = currentQuery;
    const currentSearch = untrack(() => search);

    if (currentSearch !== nextQuery) {
      search = nextQuery;
    }
  });

  $effect(() => {
    const nextSort = currentSort;
    const s = untrack(() => sort);

    if (s !== nextSort) {
      sort = nextSort;
    }
  });

  $effect(() => {
    if (!browser) return;

    const nextQuery = search.trim();
    const previousQuery = currentQuery;

    if (nextQuery === previousQuery) return;

    const timeoutId = setTimeout(() => {
      const params = new URLSearchParams();

      if (nextQuery) {
        params.set("q", nextQuery);
      }

      const currentSortValue = untrack(() => sort);
      if (currentSortValue && currentSortValue !== "popular") {
        params.set("sort", currentSortValue);
      }

      const queryString = params.toString();
      const href = queryString ? `/counters?${queryString}` : "/counters";

      goto(href, {
        replaceState: true,
        noScroll: true,
        keepFocus: true,
      });
    }, 250);

    return () => {
      clearTimeout(timeoutId);
    };
  });

  function handleSortChange(newSort: string) {
    sort = newSort;

    const params = new URLSearchParams();
    const q = search.trim();
    if (q) {
      params.set("q", q);
    }
    if (newSort && newSort !== "popular") {
      params.set("sort", newSort);
    }

    const queryString = params.toString();
    const href = queryString ? `/counters?${queryString}` : "/counters";

    goto(href, {
      replaceState: true,
      noScroll: true,
      keepFocus: true,
    });
  }

  function clearSearch() {
    search = "";
    const params = new URLSearchParams();
    const currentSortValue = sort;
    if (currentSortValue && currentSortValue !== "popular") {
      params.set("sort", currentSortValue);
    }
    const queryString = params.toString();
    const href = queryString ? `/counters?${queryString}` : "/counters";
    goto(href, {
      replaceState: true,
      noScroll: true,
      keepFocus: true,
    });
  }

  $effect(() => {
    if (!browser) return;

    const unsubUpdate = onCounterUpdated(() => {
      invalidate("counters:list");
    });

    const unsubCreated = onCounterCreated(() => {
      invalidate("counters:list");
    });

    return () => {
      unsubUpdate();
      unsubCreated();
    };
  });
</script>

<MetaTags
  title="Counter Browser | Count Collab"
  description="Browse and track public counters in real-time."
  path="/counters"
/>

<div class="space-y-6">
  <header class="flex flex-col gap-2">
    <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">
      Counter Browser
    </h1>
    <p class="text-slate-600 dark:text-slate-400">
      Explore public counters and follow the latest activity.
    </p>
    <div class="flex flex-col gap-4 pt-2">
      <div class="relative">
        <label for="counter-search" class="sr-only">Search counters</label>
        <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <ion-icon
            name="search-outline"
            style="font-size: 18px;"
            class="text-slate-400 dark:text-slate-500"
            aria-hidden="true"
          ></ion-icon>
        </div>
        <input
          id="counter-search"
          type="search"
          placeholder="Search by title or description"
          bind:value={search}
          class="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-800"
        />
        {#if search}
          <button
            type="button"
            onclick={clearSearch}
            class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition"
            aria-label="Clear search"
          >
            <ion-icon name="close-circle" style="font-size: 18px;" aria-hidden="true"></ion-icon>
          </button>
        {/if}
      </div>
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800" role="tablist" aria-label="Sort counters">
          {#each [{ value: "popular", label: "Popular" }, { value: "newest", label: "Newest" }, { value: "updated", label: "Recently Updated" }] as option (option.value)}
            <button
              type="button"
              role="tab"
              aria-selected={sort === option.value}
              onclick={() => handleSortChange(option.value)}
              class="rounded-md px-3 py-1.5 text-sm font-medium transition {sort === option.value
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}"
            >
              {option.label}
            </button>
          {/each}
        </div>
        {#if data.total > 0}
          <p class="text-sm text-slate-500 dark:text-slate-400 shrink-0">
            {data.total} {data.total === 1 ? "counter" : "counters"}{data.query ? " found" : ""}
          </p>
        {/if}
      </div>
    </div>
  </header>

  {#if data.counters.length === 0}
    {#if data.query}
      <div
        class="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-600 dark:border-slate-600 dark:text-slate-400"
      >
        No counters match "<span class="font-semibold">{data.query}</span>".
        <a href="/counters" class="text-blue-600 dark:text-blue-400"
          >Clear search</a
        >.
      </div>
    {:else}
      <div
        class="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-600 dark:border-slate-600 dark:text-slate-400"
      >
        No public counters yet. <a
          href="/create?type=counter"
          class="text-blue-600 dark:text-blue-400">Create one</a
        > to get started.
      </div>
    {/if}
  {:else}
    <div
      class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
    >
      {#each data.counters as counter (counter.id)}
        <CounterCard {counter} />
      {/each}
    </div>
    <Pagination
      page={data.page}
      totalPages={data.totalPages}
      baseUrl="/counters"
      extraParams={{
        ...(data.query ? { q: data.query } : {}),
        ...(data.sort !== "popular" ? { sort: data.sort } : {}),
      }}
    />
  {/if}
</div>
